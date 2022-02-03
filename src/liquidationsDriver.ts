//if/when we'll need more than one script parameter, we can use a proper module to parse the CLI args, like minimist or yargs
let configPath = process.argv?.[2] || "../.env";
require("dotenv").config({ path: configPath });
import TelegramNotifier from "./notifier/TelegramNotifier";
import { getPerpetualIdsSerial, getTraderIdsSerial, getTradersStates, liquidateByBotV2, unlockTrader } from "./liquidations";
import { walletUtils, perpQueries, perpUtils } from "@sovryn/perpetual-swap";
const { getSigningManagersConnectedToRandomNode, getNumTransactions } = walletUtils;
const { queryTraderState, queryAMMState, queryPerpParameters } = perpQueries;
const { getMarkPrice } = perpUtils;

const { MANAGER_ADDRESS, NODE_URL, OWNER_ADDRESS, MAX_BLOCKS_BEFORE_RECONNECT, TELEGRAM_BOT_SECRET, TELEGRAM_CHANNEL_ID } = process.env;

const fundingLevelAlerts = {
    green: 10,
    yellow: 5,
    red: 2,
};

const MNEMONIC = process.env.MNEMONIC;
if (!MNEMONIC) {
    console.log(`ERROR: Mnemonic is not present.`);
    process.exit(1);
}

/**
 * {
 *      [perpId]: {
 *          [traderId]: traderState
 *      }
 * }
 */
let tradersPositions = {};

/**
 * {
 *      [perpId]: AMMState
 * }
 */
let ammsData = {};

/**
 * {
 *      [perpId]: PerpParams
 * }
 */
let perpsParams = {};

/**
 * {
 *      [perpId]: Instance of a mini oracle factory. An instance which can only call getSpotPrice() method
 * }
 */
let notifier = getTelegramNotifier(TELEGRAM_BOT_SECRET, TELEGRAM_CHANNEL_ID);
/**
 * Run the liquidation script for a period of maxBlocks
 * @param signingManager a signing manager contract instance
 * @param maxBlocks the number of blocks after the current readManager gets re-connected
 * @returns
 */
function runForNumBlocks<T>(driverManager, signingManagers, maxBlocks): Promise<void> {
    return new Promise((resolve, reject) => {
        driverManager.once("error", (e) => {
            console.log(`driverManager.once('error') triggered`, e);
            reject(e);
        });
        let numBlocks = 0;

        //things happening in each block: check for unsafe traders and liquidate them
        driverManager.provider.on("block", async (blockNumber) => {
            try {
                let timeStart = new Date().getTime();
                let numTraders = 0;
                for (const perpId in tradersPositions) {
                    numTraders += Object.keys(tradersPositions[perpId]).length || 0;

                    ammsData[perpId] = await queryAMMState(driverManager, perpId as unknown as number);
                    let oraclePrice = getMarkPrice(ammsData[perpId]);

                    const liquidationResult = await liquidateByBotV2(
                        signingManagers,
                        OWNER_ADDRESS,
                        perpId,
                        oraclePrice,
                        tradersPositions[perpId],
                        perpsParams[perpId],
                        ammsData[perpId]
                    );
                    if (Object.keys(liquidationResult || {}).length) {
                        console.log(`Liquidations in perpetual ${perpId}: `, JSON.stringify(liquidationResult, null, 2));
                        continue;
                    }
                }
                let timeEnd = new Date().getTime();
                if (numBlocks % 50 === 0) {
                    console.log(`[${new Date()} (${timeEnd - timeStart} ms) block: ${blockNumber}] numBlocks ${numBlocks} active traders ${numTraders}`);
                }

                numBlocks++;
                if (numBlocks >= maxBlocks) {
                    return resolve();
                }
            } catch (e) {
                console.log(`Error in block processing callback:`, e);
                notifier.sendMessage(`Error in block processing callback ${(e as Error).message}`);
                return reject(e);
            }
        });

        /** Things happening when the perp state changes: refresh the traderIds var
         *
         */
        driverManager.on("UpdateMarkPrice", async (perpId, fMarkPricePremium, fSpotIndexPrice, blockTimestamp) => {
            try {
                await refreshPerpInfo(driverManager, perpId);
            } catch (error) {
                console.log(`Error in UpdateMarkPrice callback handler`, error);
                notifier.sendMessage(`Error in UpdateMarkPrice callback handler ${(error as any).message}`);
            }
        });

        driverManager.on("RealizedPnL", async (perpId, traderId, pnlCC, blockTimestamp) => {
            try {
                let newTraderState = await queryTraderState(driverManager, perpId, traderId);
                if (newTraderState.marginAccountPositionBC != 0) {
                    tradersPositions[perpId][traderId] = newTraderState;
                } else {
                    delete tradersPositions[perpId][traderId];
                }
            } catch (e) {
                console.log(`Error in RealizedPnLRealizedPnL event handler perpId ${perpId}, traderId ${traderId}:`, e);
                notifier.sendMessage(`Error in RealizedPnLRealizedPnL event handler perpId ${perpId}, traderId ${traderId}: ${(e as any).message}`);
            }
        });
    });
}

(async function main() {
    try {
        let [driverManager, ...signingManagers] = await getConnectedAndFundedSigners(0, 11);

        tradersPositions = await initializeLiquidator(signingManagers);

        while (true) {
            try {
                let res = await runForNumBlocks(driverManager, signingManagers, MAX_BLOCKS_BEFORE_RECONNECT);
                console.log(`Ran for ${MAX_BLOCKS_BEFORE_RECONNECT}`);
            } catch (error) {
                console.log(`Error in while(true):`, error);
                // notifier.sendMessage(`Error in while(true): ${(error as any).message}`);
            }

            //remove event listeners and reconnect
            driverManager.provider.removeAllListeners();
            driverManager.removeAllListeners();

            [driverManager, ...signingManagers] = await getConnectedAndFundedSigners(0, 11);
        }
    } catch (error) {
        console.log(`General error while liquidating users, exiting process`, error);
        notifier.sendMessage(`General error while liquidating users: ${(error as any).message}. Exiting.`);
        process.exit(1);
    }
})();

async function checkFundingHealth(accounts) {
    //TODO: do this in batches?
    const accCheckPromises = Array();
    for (const account of accounts) {
        accCheckPromises.push(getNumTransactions(account, 4_000_000));
    }

    const res = await Promise.all(accCheckPromises);
    return res;
}

async function initializeLiquidator(signingManagers) {
    let driverManager = signingManagers[0];
    const perpetualIds = (await getPerpetualIdsSerial(driverManager)) || [];

    let positions = {};
    let traderIds = await getTraderIdsSerial(driverManager, perpetualIds || []);
    let numTraders = 0;
    for (const perpId of Object.keys(traderIds)) {
        [positions[perpId]] = await Promise.all([getTradersStates(signingManagers, perpId, traderIds[perpId]), refreshPerpInfo(driverManager, perpId)]);

        console.log(perpsParams[perpId].oracleS2Addr);
        numTraders += (traderIds[perpId] || []).length;
        for (const traderId of traderIds[perpId]) {
            unlockTrader(traderId, true);
        }
    }
    console.log(`Initial total traders: ${numTraders}`);
    return positions;
}

async function refreshPerpInfo(signingManager, perpId) {
    [ammsData[perpId], perpsParams[perpId]] = await Promise.all([
        queryAMMState(signingManager, perpId).catch((e) => {
            console.log(`Error while queryAMMState in refreshPerpInfo`, e);
            return null;
        }),
        queryPerpParameters(signingManager, perpId).catch((e) => {
            console.log(`Error while queryPerpParameters in refreshPerpInfo`, e);
            return null;
        }),
    ]);
}

function getTelegramNotifier(telegramSecret, telegramChannel) {
    if (!telegramSecret || !telegramChannel) {
        console.error(
            `Can not instantiate the telegramNotifier because either telegramSecret ("${telegramSecret}"), or telegramChannelId ("telegramChannel") is missing. Exiting.`
        );
        process.exit(1);
    }
    return new TelegramNotifier(telegramSecret, telegramChannel);
}

async function getConnectedAndFundedSigners(fromWallet, numSigners, includeDriverManager = true) {
    let extraNodes = NODE_URL ? [NODE_URL] : [];
    let signers = Array();
    let areLiquidatorsFunded = Array();
    let numRetries = 0;
    let maxRetries = 100;
    while (true) {
        try {
            //get an array of signingWallets
            signers = getSigningManagersConnectedToRandomNode(MANAGER_ADDRESS, MNEMONIC, extraNodes, fromWallet, numSigners) || [];

            //get the number of liquidations each can make [{[liquidatorAddress]: numLiquidations}]
            //this also checks whether the signingManagers are connected and the node responds properly
            areLiquidatorsFunded = await checkFundingHealth(signers);
            break;
        } catch (error) {
            console.log;
            numRetries++;
            if (numRetries >= maxRetries) {
                let msg = `[${new Date()}] FATAL: could not connect to a node after ${maxRetries} attempts. Exiting!`;
                console.error(msg);
                notifier.sendMessage(msg);
                process.exit(1);
            }
        }
    }

    let included = false;
    let fundedSigners = Array();
    for (let i = 0; i < areLiquidatorsFunded.length; i++) {
        let liquidator = areLiquidatorsFunded[i];
        let [liqAddr, numLiquidations] = Object.entries(liquidator)[0];
        if (typeof numLiquidations !== "number") {
            console.log(`Unable to instantiate signer with address ${liqAddr}, i=${i}, ${(numLiquidations as any).toString()}`);
            continue;
        }
        if (numLiquidations > 0) {
            fundedSigners.push(signers[i]);
            continue;
        }
        if (includeDriverManager && !included) {
            fundedSigners.unshift(signers[i]);
        }
    }

    if (fundedSigners.length === 0 || (includeDriverManager && fundedSigners.length === 1)) {
        let msg = `[${new Date()}] FATAL: there are no funded liquidators. Can not liquidate because there are no tx fee sufficient funds in the selected wallets. Exiting! ${JSON.stringify(
            areLiquidatorsFunded,
            null,
            2
        )}`;
        console.error(msg);
        notifier.sendMessage(msg);
        process.exit(1);
    }
    console.log(`Funded signingManagers:`, fundedSigners);
    return fundedSigners;
}
