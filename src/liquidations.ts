import { readFileSync, unlinkSync, writeFileSync } from "fs";
import { perpMath, perpQueries, perpUtils, TraderState, PerpParameters, AMMState } from "@sovryn/perpetual-swap";
const { isTraderMarginSafe } = perpMath;
const { queryTraderState, queryAMMState, queryPerpParameters } = perpQueries;
const { calculateApproxLiquidationPrice, getPrice } = perpUtils;

type SafeTraders = {
    [traderAddress: string]: boolean;
};

export type TradersStates = {
    [traderId: string]: TraderState;
};

/**
 *
 * @param signingManagers an array of Perpetual Manager contract instances, with connected and funded wallets
 * @param owner
 * @param perpId the perpetual in which to liquidate unsafe traders
 * @param traders an array with all the traders in the perpetual
 * @returns
 */
// export async function liquidateByBot(signingManagers, owner, perpId: string, traders: string[]) {
//     try {
//         let batchSize = signingManagers.length;
//         let results = Object();

//         let safeTradersPromises = Array();
//         let safeTradersSettled = Array();
//         // Liquidate all unsafe traders in perpetual
//         let safeTraders: SafeTraders = {};

//         let i = 0;
//         for (const traderId of traders) {
//             let signingManager = signingManagers[i % signingManagers.length];
//             safeTradersPromises.push(
//                 signingManager.isTraderMaintenanceMarginSafe(perpId, traderId).then((isSafe) => (safeTraders[traderId] = { safe: isSafe }))
//             );
//             if (safeTradersPromises.length === batchSize) {
//                 safeTradersSettled.concat(await Promise.all(safeTradersPromises));
//                 safeTradersPromises = [];
//                 let liquidations = await liquidateUnsafeTraders(signingManagers, safeTraders, owner, perpId);
//                 results = { ...results, ...liquidations };
//                 safeTraders = {};
//             }
//             i++;
//         }

//         //there might be a last, not full batch we have to clear
//         if (safeTradersPromises.length) {
//             safeTradersSettled.concat(await Promise.all(safeTradersPromises));
//             let liquidations = await liquidateUnsafeTraders(signingManagers, safeTraders, owner);
//             results = { ...results, ...liquidations };
//         }

//         // console.log(`Number of traders:  ${Object.keys(safeTraders).length}. Unsafe ones: ${Object.values(safeTraders).filter( (traderInfo: TraderInfo) => !(traderInfo?.safe) ).length}`)
//         return results;
//     } catch (error) {
//         console.log(`Error: `, error);
//     }
// }

/**
 *
 * @param signingManagers an array of Perpetual Manager contract instances, with connected and funded wallets
 * @param owner the wallet wich collects the liquidation fees
 * @param perpId the perpetual in which to liquidate unsafe traders
 * @param traders an array with all the traders in the perpetual
 * @param tradersState an object which has the traderId as keys and traderState as value
 * @param perpParams the perpetual parameters
 * @param ammData the AMM state
 * @returns
 */
export async function liquidateByBotV2(
    signingManagers,
    owner,
    perpId: string,
    markPrice,
    tradersStates: TradersStates,
    perpParams: PerpParameters,
    ammData: AMMState
) {
    let unsafeTraderIds = {};

    for (const traderId in tradersStates) {
        if (tradersStates[traderId].marginAccountPositionBC != 0 && !isTraderSafe(tradersStates[traderId], markPrice, perpParams, ammData)) {
            unsafeTraderIds[traderId] = false;
        }
    }
    if (!Object.keys(unsafeTraderIds).length) {
        return;
    }
    let liquidations = await liquidateUnsafeTraders(signingManagers, unsafeTraderIds, owner, perpId);
    return liquidations;
}

function isTraderSafe(traderState, markPrice, perpParams, ammData) {
    let traderLiquidationPrice = calculateApproxLiquidationPrice(traderState, ammData, perpParams, 0, 0);

    return traderState.marginAccountPositionBC > 0 ? markPrice >= traderLiquidationPrice : markPrice <= traderLiquidationPrice;
}

async function getAllPerpetualIds(signingManagers): Promise<any[] | undefined> {
    try {
        let perpIdGetterPromises = Array();
        let perpetualIds = Array();
        let manager = signingManagers[1];
        // Get Perpetual IDs for all Perps in all pools
        let poolCount = (await manager.getPoolCount()).toNumber();
        for (let i = 1; i < poolCount + 1; i++) {
            let perpetualCount = await manager.getPerpetualCountInPool(i);
            for (let j = 0; j < perpetualCount; j++) {
                let currentManager = signingManagers[j % signingManagers.length];
                perpIdGetterPromises.push(currentManager.getPerpetualId(i, j));
                if (perpIdGetterPromises.length === signingManagers.length) {
                    let ids = await Promise.all(perpIdGetterPromises);
                    perpetualIds.concat(ids);
                    perpIdGetterPromises = [];
                }
            }
        }
        if (perpIdGetterPromises.length) {
            let ids = await Promise.all(perpIdGetterPromises);
            perpetualIds.concat(ids);
        }

        return perpetualIds;
    } catch (e) {
        console.log(`Error: `, e);
    }
}

export async function getPerpetualIdsSerial(manager): Promise<any[] | undefined> {
    try {
        let perpertualIds = Array();
        let poolCount = (await manager.getPoolCount()).toNumber();
        for (let i = 1; i < poolCount + 1; i++) {
            let perpetualCount = await manager.getPerpetualCountInPool(i);
            for (let j = 0; j < perpetualCount; j++) {
                let perpId = await manager.getPerpetualId(i, j);
                perpertualIds.push(perpId);
            }
        }
        return perpertualIds;
    } catch (error) {
        console.log(`Error in getPerpetualIdsSerial()`, error);
    }
}

/**
 *
 * @param manager the perpetual manager contract instance
 * @param perpetualIds an array of all the perpetual ids
 * @returns {
 *      [perpId]: [traderAddr1, traderAddr1, ....]
 * }
 */
export async function getTraderIdsSerial(manager, perpetualIds: number[]) {
    let traderIds = Object();
    // Get trader IDs for all traders in all pools
    for (const perpId of perpetualIds || []) {
        traderIds[perpId] = await getPerpTraderIds(manager, perpId);
    }
    return traderIds;
}

export async function getPerpTraderIds(manager, perpId) {
    let allTraders = await manager.getActivePerpAccounts(perpId);
    let timeStart = new Date().getTime();
    let chunkSize = 30;
    let numTraders = await manager.countActivePerpAccounts(perpId);
    let tradersChunkPromises = Array();
    let from = 0;
    let to = chunkSize - 1;
    while (from < numTraders) {
        tradersChunkPromises.push(
            manager.getActivePerpAccountsByChunks(perpId, from, to).catch((e) => {
                console.log(`Error when getActivePerpAccountsByChunks. perpId: ${perpId}, from ${from}, to ${to}`, e);
                throw e;
            })
        );
        from += chunkSize;
    }
    let tradersChunks = await Promise.all(tradersChunkPromises);

    // let traders = (tradersChunks as string[][]).flat();
    let traders = Array();
    for (const chunk of tradersChunks) {
        traders = traders.concat(chunk);
    }
    let timeEnd = new Date().getTime();
    console.log(`[${new Date()}] Retrieved ${traders.length} traders in ${timeEnd - timeStart} ms`);
    return traders;
}

async function liquidateUnsafeTraders(signingManagers, safeTraders, owner, perpId) {
    let liquidationPromises = Array();
    let i = 0;
    let batchSize = signingManagers.length;
    let result = Object();
    for (const traderId in safeTraders) {
        if (!safeTraders[traderId].safe && !isTraderLocked(traderId)) {
            lockTrader(traderId);
            let signingManager = signingManagers[i % signingManagers.length];
            liquidationPromises.push(
                signingManager
                    .liquidateByAMM(perpId, owner, traderId, { gasLimit: 4_000_000 })
                    .then((tx) => tx) /*tx is in mempool*/
                    .then((settledTx) => (result[traderId] = { perpId: perpId, traderId, status: "SUCCESS", result: settledTx })) /*tx is mined*/
                    .catch((e) => (result[traderId] = { perpId: perpId, traderId, status: "FAILED", error: e }))
                    .finally(() => setTimeout(() => unlockTrader(traderId), 15_000)) //unlock the trader after 5 blocks, to make sure the liquidation was propagated
            );
        } else {
            if (isTraderLocked(traderId)) {
                console.log(`[${new Date()}] Trader ${traderId} is locked. Not attempting to liquidate it again.`);
            }
        }
        if (liquidationPromises.length === batchSize) {
            await Promise.all(liquidationPromises);
            liquidationPromises = [];
        }
        i++;
    }
    if (liquidationPromises.length) {
        await Promise.all(liquidationPromises);
    }
    return result;
}

function lockTrader(traderId) {
    const lockingFileName = getLockingFileName(traderId);
    writeFileSync(lockingFileName, new Date().toString());
}

function isTraderLocked(traderId): boolean {
    const lockingFileName = getLockingFileName(traderId);
    try {
        const content = readFileSync(lockingFileName);
        return !!content;
    } catch (e) {
        //an error is thrown when file does not exist. If a user is not locked, it won't have this lock file, so we don't consider this an actual error, but an indication of user-not-locked
    }
    return false;
}

export async function getTradersStates(signingManagers, perpId, traderIds): Promise<TradersStates> {
    let batchSize = signingManagers.length;
    let results = Object();

    let tradersStatePromises = Array();
    let tradersStateSettled = Array();

    let i = 0;
    for (const traderId of traderIds) {
        let signingManager = signingManagers[i % signingManagers.length];
        tradersStatePromises.push(queryTraderState(signingManager, perpId, traderId));
        if (tradersStatePromises.length === batchSize) {
            tradersStateSettled = tradersStateSettled.concat(await Promise.all(tradersStatePromises));
            tradersStatePromises = [];
        }
        i++;
    }

    //there might be a last, not full batch we have to clear
    if (tradersStatePromises.length) {
        tradersStateSettled = tradersStateSettled.concat(await Promise.all(tradersStatePromises));
    }

    //this should never happen
    if (traderIds.length !== tradersStateSettled.length) {
        throw new Error(
            `[getTradersStates] traderIds length (${traderIds.length}) is different from tradersStateSettled's length (${tradersStateSettled.length})`
        );
    }
    i = -1;
    for (const traderId of traderIds) {
        ++i;
        if (tradersStateSettled[i].marginAccountPositionBC === 0) {
            console.log(`Trader ${traderId} has no open position?`, tradersStateSettled[i]);
            continue;
        }
        results[traderId] = tradersStateSettled[i];
    }
    return results;
}

export function unlockTrader(traderId, ignoreUnlocked = false) {
    const lockingFolder = getLockingFileName(traderId);
    try {
        unlinkSync(lockingFolder);
    } catch (error) {
        if (!ignoreUnlocked) {
            throw new Error(`Trader ${traderId} is not locked.`);
        }
    }
}

function getLockingFileName(traderId): string {
    return (process.env.LOCKING_FOLDER || "/tmp") + "/trader" + traderId.toString().toLowerCase() + ".lock";
}
