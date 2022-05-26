//if/when we'll need more than one script parameter, we can use a proper module to parse the CLI args, like minimist or yargs
const configFileName = process.argv?.[2] || ".env";
const path = require("path");
let configPath = path.resolve(__dirname, "../", configFileName);
require("dotenv").config({ path: configPath });

import TelegramNotifier from "./notifier/TelegramNotifier";
import { getPerpTraderIds, getTradersStates, liquidateByBotV2, unlockTrader } from "./liquidations";
import { AMMState, PerpParameters, perpQueries, perpUtils } from "@sovryn/perpetual-swap";
import * as walletUtils from "@sovryn/perpetual-swap/dist/scripts/utils/walletUtils";
import { v4 as uuidv4 } from "uuid";
const fetch = require("node-fetch");
const { getSigningManagersConnectedToFastestNode, getNumTransactions } = walletUtils;
const { queryTraderState, queryAMMState, queryPerpParameters } = perpQueries;
const { getMarkPrice } = perpUtils;

//configured in the .env file
const { MANAGER_ADDRESS, NODE_URLS, OWNER_ADDRESS, MAX_BLOCKS_BEFORE_RECONNECT, TELEGRAM_BOT_SECRET, TELEGRAM_CHANNEL_ID } = process.env;

//configured in the liquidator-ecosystem.config.js
const { PERP_ID, PERP_NAME, IDX_ADDR_START, NUM_ADDRESSES } = process.env;

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

const runId = uuidv4();
console.log(`runId: ${runId}`);

/**
 * {
 *          [traderId]: traderState
 * }
 */
let tradersPositions = {};

let ammState: AMMState | null;

let perpsParams: PerpParameters | null;

let notifier = getTelegramNotifier(TELEGRAM_BOT_SECRET, TELEGRAM_CHANNEL_ID);
let blockProcessingErrors = 0;
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
        let numBlocks = -1;

        //things happening in each block: check for unsafe traders and liquidate them
        let blockProcessing = 0;
        driverManager.provider.on("block", async (blockNumber) => {
            try {
                if (blockProcessing) {
                    if (blockNumber - blockProcessing > 5) {
                        console.log(
                            `LIQUIDATOR_${PERP_NAME || "undefined"} Skip processing block ${blockNumber} because block ${blockProcessing} is still being processed (we're ${blockNumber - blockProcessing} blocks behind). Node ${driverManager.provider.connection.url}`
                        );
                    }
                    if (blockNumber - blockProcessing > 100) {
                        let msg = `LIQUIDATOR_${PERP_NAME || "undefined"} Block processing is falling behind. Block being processed is ${blockProcessing}, while current blockNumber is ${blockNumber} (we're ${blockNumber - blockProcessing} blocks behind). Node ${driverManager.provider.connection.url}`;
                        console.warn(msg);
                        await notifier.sendMessage(msg);
                        process.exit(1);
                    }
                    return;
                }
                blockProcessing = blockNumber;
                let timeStart = new Date().getTime();
                let numTraders = 0;
                numBlocks++;
                numTraders += Object.keys(tradersPositions).length || 0;

                ammState = await queryAMMState(driverManager, PERP_ID as unknown as number);
                let markPrice = getMarkPrice(ammState);

                if (perpsParams !== null) {
                    const liquidationResult = await liquidateByBotV2(
                        signingManagers,
                        OWNER_ADDRESS,
                        PERP_ID as any,
                        markPrice,
                        tradersPositions,
                        perpsParams,
                        ammState
                    );
                    if (Object.keys(liquidationResult || {}).length) {
                        console.log(`Liquidations in perpetual ${PERP_ID}: `, JSON.stringify(liquidationResult, null, 2));
                        for (const traderId in liquidationResult){
                            const liquidationMessage = `[LIQUIDATION in ${PERP_NAME}] [${traderId}](https://${process.env.TESTNET ? 'testnet.' : ''}bscscan.com/tx/${liquidationResult?.[traderId]?.result?.hash}) \\- ${liquidationResult?.[traderId]?.status}`;
                            console.log(`liquidationMessage: `, liquidationMessage)
                            await notifier.sendMessage(liquidationMessage, {parse_mode: 'MarkdownV2'});
                        }
                    }
                } else {
                    console.warn(`perpParams is null`);
                }

                let timeEnd = new Date().getTime();
                if (numBlocks % 50 === 0) {
                    console.log(`[${new Date()} (${timeEnd - timeStart} ms) block: ${blockNumber}] numBlocks ${numBlocks} active traders ${numTraders}`);
                }
                await sendHeartBeat(`LIQ_${PERP_NAME || "undefined"}_BLOCK_PROCESSED`, {
                    blockNumber,
                    runId,
                    duration: timeEnd - timeStart,
                });
                blockProcessingErrors = 0;
                if (numBlocks >= maxBlocks) {
                    return resolve();
                }
                blockProcessing = 0;
            } catch (e) {
                console.log(`Error in block processing callback:`, e);
                blockProcessingErrors++;
                blockProcessing = 0;
                if (blockProcessingErrors >= 5) {
                    await notifier.sendMessage(`Error in block processing callback ${(e as Error).message}`);
                    blockProcessingErrors = 0;
                }
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
                await notifier.sendMessage(`Error in UpdateMarkPrice callback handler ${(error as any).message}`);
            }
        });

        driverManager.on("RealizedPnL", async (perpId, traderId, pnlCC, blockTimestamp) => {
            try {
                if(perpId.toLowerCase() !== PERP_ID?.toLowerCase()){
                    return;
                }
                let newTraderState = await queryTraderState(driverManager, perpId, traderId);
                console.log(`RealizedPnL. Trader ${traderId}, new pos ${newTraderState.marginAccountPositionBC}, pnl ${pnlCC}`);
                if (newTraderState.marginAccountPositionBC != 0) {
                    tradersPositions[traderId] = newTraderState;
                } else {
                    delete tradersPositions[traderId];
                }
            } catch (e) {
                console.log(`Error in RealizedPnLRealizedPnL event handler perpId ${perpId}, traderId ${traderId}:`, e);
                await notifier.sendMessage(`Error in RealizedPnLRealizedPnL event handler perpId ${perpId}, traderId ${traderId}: ${(e as any).message}`);
            }
        });
    });
}

(async function main() {
    try {
        let [driverManager, ...signingManagers] = await getConnectedAndFundedSigners(IDX_ADDR_START, NUM_ADDRESSES);

        tradersPositions = await initializeLiquidator(signingManagers);

        if (process.env.HEARTBEAT_SHOULD_RESTART_URL) {
            //only check if dead after 1 minute after the script started, so it has enough time to send some heartbeats
            setTimeout(() => {
                console.log(`Starting to check if shouldRestart....`);
                setInterval(() => shouldRestart(runId, `LIQ_${PERP_NAME || "undefined"}_BLOCK_PROCESSED`), 5_000);
            }, 60_000);
        } else {
            console.warn("Env var HEARTBEAT_SHOULD_RESTART_URL is not set, so if the nodes are pausing the connection, can not restart automatically.");
        }

        while (true) {
            try {
                let res = await runForNumBlocks(driverManager, signingManagers, MAX_BLOCKS_BEFORE_RECONNECT);
                console.log(`Ran for ${MAX_BLOCKS_BEFORE_RECONNECT}`);
            } catch (error) {
                console.log(`Error in while(true):`, error);
                // await notifier.sendMessage(`Error in while(true): ${(error as any).message}`);
            }

            //remove event listeners and reconnect
            driverManager.provider.removeAllListeners();
            driverManager.removeAllListeners();

            [driverManager, ...signingManagers] = await getConnectedAndFundedSigners(IDX_ADDR_START, NUM_ADDRESSES);
        }
    } catch (error) {
        console.log(`General error while liquidating users, exiting process`, error);
        await notifier.sendMessage(`General error while liquidating users: ${(error as any).message}. Exiting.`);
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

    let positions = {};
    let traderIds = await getPerpTraderIds(driverManager, PERP_ID);
    let numTraders = 0;

    [positions] = await Promise.all([getTradersStates(signingManagers, PERP_ID, traderIds), refreshPerpInfo(driverManager, PERP_ID)]);

    numTraders += (traderIds || []).length;
    for (const traderId of traderIds) {
        unlockTrader(traderId, true);
    }

    console.log(`Initial total traders: ${numTraders}`);
    return positions;
}

async function refreshPerpInfo(signingManager, perpId) {
    [ammState, perpsParams] = await Promise.all([
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
    let bscNodeURLs = JSON.parse(NODE_URLS || "[]");
    let signers = Array();
    let areLiquidatorsFunded = Array();
    let numRetries = 0;
    let maxRetries = 10;
    let included = false;
    let fundedSigners = Array();
    let fundedWalletAddresses = Array();
    let timeStart = new Date().getTime();
    while (true) {
        try {
            //get an array of signingWallets
            signers = await getSigningManagersConnectedToFastestNode(MANAGER_ADDRESS, MNEMONIC, bscNodeURLs, fromWallet, numSigners, PERP_ID) || [];

            //get the number of liquidations each can make [{[liquidatorAddress]: numLiquidations}]
            //this also checks whether the signingManagers are connected and the node responds properly
            areLiquidatorsFunded = await checkFundingHealth(signers);
            areLiquidatorsFunded = areLiquidatorsFunded.sort((a, b) => {
                let [liqAddrA, numLiquidationsA] = Object.entries(a)[0];
                let [liqAddrB, numLiquidationsB] = Object.entries(b)[0];
                return parseInt(numLiquidationsB as any) - parseInt(numLiquidationsA as any);
            });
            for (let i = 0; i < areLiquidatorsFunded.length; i++) {
                let liquidator = areLiquidatorsFunded[i];
                let [liqAddr, numLiquidations] = Object.entries(liquidator)[0];
                if (typeof numLiquidations !== "number") {
                    console.log(`Unable to instantiate signer with address ${liqAddr}, i=${i}, ${(numLiquidations as any).toString()}`);
                    continue;
                }
                if (numLiquidations > 0) {
                    fundedSigners.push(signers[i]);
                    fundedWalletAddresses.push(liquidator);
                    continue;
                }
                if (includeDriverManager && !included) {
                    fundedSigners.unshift(signers[i]);
                    fundedWalletAddresses.unshift(liquidator);
                    included = true;
                }
            }
            if (fundedSigners.length === 0 || (includeDriverManager && fundedSigners.length === 1)) {
                let msg = `[${new Date()}] WARN: there are no funded liquidators. Can not liquidate because there are no tx fee sufficient funds in the selected wallets. Retrying! ${JSON.stringify(
                    areLiquidatorsFunded,
                    null,
                    2
                )}`;
                console.warn(msg);
                throw new Error(msg);
            }
            break;
        } catch (error) {
            console.log(error);
            numRetries++;
            if (numRetries >= maxRetries) {
                let msg = `[${new Date()}] FATAL: could not connect to a node after ${maxRetries} attempts. Exiting!`;
                console.error(msg);
                await notifier.sendMessage(msg);
                process.exit(1);
            }
        }
    }

    let timeEnd = new Date().getTime();
    console.log(`(${timeEnd - timeStart} ms) Funded liquidator wallets after ${numRetries} connection attempts:`, fundedWalletAddresses);
    return fundedSigners;
}

async function sendHeartBeat(code, payload) {
    try {
        let heartbeatUrl = process.env.HEARTBEAT_LISTENER_URL;
        if (!heartbeatUrl) {
            console.warn("Env var HEARTBEAT_LISTENER_URL is not set, so it's impossible to send heartbeats");
            return;
        }
        let runnerId = payload.runId;
        delete payload.runId;
        let res = await fetch(heartbeatUrl, {
            method: "POST",
            headers: {
                Accept: "application/json",
                "Content-Type": "application/json",
            },
            body: JSON.stringify(
                {
                    heartbeatCode: code,
                    payload,
                    runnerUuid: runnerId,
                },
                null,
                2
            ),
        });
        if (res.statusText.toLowerCase() !== "created") {
            let responseText = await res.text();
            let msg = `Error sending heartBeats: ${res.statusText}; response text: ${responseText}`;
            console.warn(msg);
            await notifier.sendMessage(msg);
        }
    } catch (error) {
        console.warn(`Error sending heartbeat:`, error);
    }
}

async function shouldRestart(runId, heartbeatCode) {
    try {
        let heartbeatUrl = process.env.HEARTBEAT_SHOULD_RESTART_URL;
        if (!heartbeatUrl) {
            console.warn("Env var HEARTBEAT_SHOULD_RESTART_URL is not set, so if the nodes are pausing the connection, can not restart automatically.");
            return;
        }

        let res = await fetch(heartbeatUrl + `/${runId}/${heartbeatCode}`, {
            method: "GET",
            headers: {
                Accept: "application/json",
                "Content-Type": "application/json",
            },
        });
        if (res.statusText.toLowerCase() !== "ok") {
            let responseText = await res.text();
            let msg = `Error when shouldRestart: ${res.statusText}; response text: ${responseText}`;
            console.warn(msg);
            await notifier.sendMessage(msg);
            return;
        }

        let restartRes = await res.json();
        if (restartRes?.shouldRestart) {
            console.warn(`Restarting ${runId}. Time since last heartbeat: ${res?.timeSinceLastHeartbeat}`);
            process.exit(1);
        }
    } catch (error) {
        console.warn(`Error when shouldRestart:`, error);
    }
}
