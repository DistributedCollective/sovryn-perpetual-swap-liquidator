//if/when we'll need more than one script parameter, we can use a proper module to parse the CLI args, like minimist or yargs
let configPath = process.argv?.[2] || "../.env";
require("dotenv").config({ path: configPath });

import TelegramNotifier from "./notifier/TelegramNotifier";
import { getPerpetualIdsSerial, getTraderIdsSerial, getTradersStates, liquidateByBotV2, unlockTrader } from "./liquidations";
import { walletUtils, perpQueries, perpUtils } from "@sovryn/perpetual-swap";
import { v4 as uuidv4 } from "uuid";
const fetch = require("node-fetch");
const { getSigningManagersConnectedToRandomNode, getNumTransactions } = walletUtils;
const { queryTraderState, queryAMMState, queryPerpParameters } = perpQueries;
const { getMarkPrice } = perpUtils;

const { MANAGER_ADDRESS, NODE_URLS, OWNER_ADDRESS, MAX_BLOCKS_BEFORE_RECONNECT, TELEGRAM_BOT_SECRET, TELEGRAM_CHANNEL_ID } = process.env;

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
                    let markPrice = getMarkPrice(ammsData[perpId]);

                    const liquidationResult = await liquidateByBotV2(
                        signingManagers,
                        OWNER_ADDRESS,
                        perpId,
                        markPrice,
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
                await sendHeartBeat("LIQ_BLOCK_PROCESSED", {
                    blockNumber,
                    runId,
                    duration: timeEnd - timeStart,
                });

                numBlocks++;
                if (numBlocks >= maxBlocks) {
                    return resolve();
                }
            } catch (e) {
                console.log(`Error in block processing callback:`, e);
                await notifier.sendMessage(`Error in block processing callback ${(e as Error).message}`);
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
                let newTraderState = await queryTraderState(driverManager, perpId, traderId);
                if (newTraderState.marginAccountPositionBC != 0) {
                    tradersPositions[perpId][traderId] = newTraderState;
                } else {
                    delete tradersPositions[perpId][traderId];
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
        let [driverManager, ...signingManagers] = await getConnectedAndFundedSigners(0, 11);

        tradersPositions = await initializeLiquidator(signingManagers);

        if(process.env.HEARTBEAT_SHOULD_RESTART_URL){
            let intervalId = setInterval( () => shouldRestart(runId, 'LIQ_BLOCK_PROCESSED'), 5_000);
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

            [driverManager, ...signingManagers] = await getConnectedAndFundedSigners(0, 11);
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
    let bscNodeURLs = JSON.parse(NODE_URLS || "[]");
    let signers = Array();
    let areLiquidatorsFunded = Array();
    let numRetries = 0;
    let maxRetries = 100;
    let included = false;
    let fundedSigners = Array();
    let fundedWalletAddresses = Array();
    let timeStart = new Date().getTime();
    while (true) {
        try {
            //get an array of signingWallets
            signers = getSigningManagersConnectedToRandomNode(MANAGER_ADDRESS, MNEMONIC, bscNodeURLs, fromWallet, numSigners) || [];

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
            console.log;
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
                "Accept": "application/json",
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

async function shouldRestart(runId, heartbeatCode){
    try {
        let heartbeatUrl = process.env.HEARTBEAT_SHOULD_RESTART_URL;
        if (!heartbeatUrl) {
            console.warn("Env var HEARTBEAT_SHOULD_RESTART_URL is not set, so if the nodes are pausing the connection, can not restart automatically.");
            return;
        }
        
        let res = await fetch(heartbeatUrl + `/${runId}/${heartbeatCode}`, {
            method: "GET",
            headers: {
                "Accept": "application/json",
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
        if(restartRes?.shouldRestart){
            console.warn(`Restarting ${runId}. Time since last heartbeat: ${res?.timeSinceLastHeartbeat}`);
            process.exit(1);
        }
    } catch (error) {
        console.warn(`Error when shouldRestart:`, error);
    }
}