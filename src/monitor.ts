/**
 *  Accepts client requests and returns internal info about the liquitator
 */
const axios = require("axios");
const { formatEther } = require("ethers/lib/utils");

const { PUBLIC_NODE_PROVIDER, BLOCK_EXPLORER, BALANCE_THRESHOLD, PERP_ID } = process.env;
import { ABK64x64ToFloat } from "@sovryn/perpetual-swap/dist/scripts/utils/perpMath";
import { calculateApproxLiquidationPrice, getMarkPrice, TraderState } from "@sovryn/perpetual-swap/dist/scripts/utils/perpUtils";

const ethers = require("ethers");
const BN = ethers.BigNumber;

import dbCtrl from "./db";

class MonitorController {
    private driverManager;
    private signingManagers;

    start(driverManager, signingManagers) {
        this.signingManagers = signingManagers;
        this.driverManager = driverManager;
    }

    /**
     * Wrapper for health signals, called from client
     */
    async getSignals(cb: any = null) {
        const resp = {
            blockInfoLn: await this.getCurrentBlockPrivateNode(),
            blockInfoPn: await this.getCurrentBlockPublicNode(),
            accountInfoLiq: await this.getAccountsInfo(null),
            perpName: process.env.PERP_NAME,
        };
        if (typeof cb === "function") cb(resp);
        else return resp;
    }

    async getTotals(cb, last24h) {
        const liquidator = await dbCtrl.getTotals("liquidator", last24h);
        const resp = {
            totalLiquidations: liquidator?.totalActionsNumber,
            totalLiquidatorProfit: Number(liquidator?.profit).toFixed(6),
        };
        if (typeof cb === "function") cb(resp);
        else return resp;
    }

    async getOpenPositions(ammState, perpParams, tradersPositions, cb) {
        let markPrice = getMarkPrice(ammState as any);
        let positionsWithLiquidationPrice = Array();
        for (const [traderId, traderState] of Object.entries(tradersPositions)) {
            let liquidationPrice = calculateApproxLiquidationPrice(traderState as TraderState, ammState, perpParams, 0, 0);
            let position = Object.assign(
                {
                    liquidationPrice,
                    traderAddress: traderId,
                },
                traderState
            );
            positionsWithLiquidationPrice.push(position);
        }
        if (typeof cb === "function")
            return cb({
                openPositions: positionsWithLiquidationPrice,
                markPrice,
            });
        return {
            openPositions: positionsWithLiquidationPrice,
            markPrice,
        };
    }

    async getLatestLiquidations(cb) {
        try {
            const endpoint = process.env.GRAPHQL_ENDPOINT;
            const headers = {
                "content-type": "application/json",
            };
            const graphqlQuery = {
                query: `{
                perpetuals(where:{id: "${PERP_ID}"}, subgraphError: allow){
                    liquidates(first: 5, orderBy: blockTimestamp, orderDirection: desc){
                      trader{
                      id
                    }
                    amountLiquidatedBC
                    liquidationPrice
                    newPositionSizeBC
                    transaction{
                      id
                    }
                  }
                }
            }`,
            };

            const response = await axios({
                url: endpoint,
                method: "post",
                headers: headers,
                data: graphqlQuery,
            });

            let liquidations = Array();
            for (const l of response?.data?.data?.perpetuals[0]?.liquidates || []) {
                liquidations.push({
                    trader: l.trader.id,
                    amountLiquidatedBC: ABK64x64ToFloat(BN.from(l.amountLiquidatedBC || "0")),
                    liquidationPrice: ABK64x64ToFloat(BN.from(l.liquidationPrice || "0")),
                    newPositionSizeBC: ABK64x64ToFloat(BN.from(l.newPositionSizeBC || "0")),
                    txId: l.transaction.id,
                });
            }
            cb({ liquidations });
        } catch (e) {
            console.log(`Error in getLatestLiquidations: ${e}`);
        }
    }

    getCurrentBlockPublicNode() {
        let p = this;
        return new Promise((resolve) => {
            axios({
                method: "post",
                url: PUBLIC_NODE_PROVIDER,
                data: {
                    method: "eth_blockNumber",
                    jsonrpc: "2.0",
                    params: [],
                    id: 1,
                },
                headers: { "Content-Type": "application/json" },
            })
                .then((response) => {
                    if (response.data && response.data.result) {
                        const res = parseInt(response.data.result);
                        resolve(res);
                    } else resolve(-1);
                })
                .catch((e) => {
                    console.error("error getting block-nr from public node");
                    console.error(e);
                    resolve(-1);
                });
        });
    }

    async getCurrentBlockPrivateNode() {
        try {
            let bNr = await this.driverManager.provider.getBlockNumber();
            bNr = parseInt(bNr);
            return bNr;
        } catch (e) {
            console.error("error getting block-nr from private node");
            //console.error(e);
            return -1;
        }
    }

    getNetworkData(cb) {
        const resp = {
            blockExplorer: BLOCK_EXPLORER,
        };
        if (typeof cb === "function") cb(resp);
        else return resp;
    }

    async getAccountsInfo(cb) {
        let accountWithInfo = Array();

        let dmAddress = await this.driverManager.signer.getAddress();
        let [dmBalance, dmLastBlock] = await Promise.all([
            this.driverManager.provider.getBalance(dmAddress).then((b) => formatEther(b)),
            this.driverManager.provider
                .getBlockNumber()
                .then((bNr) => parseInt(bNr))
                .catch((e) => -2),
        ]);

        accountWithInfo.push({
            address: dmAddress,
            balance: dmBalance,
            balanceThreshold: -1,
            overThreshold: true,
            accountType: "driverManager",
            lastBlock: dmLastBlock,
            nodeUrl: this.driverManager.provider.connection.url,
        });

        let balancesPromises = Array();
        let addressesPromises = Array();
        let lastBlockPromises = Array();
        for (const manager of this.signingManagers) {
            addressesPromises.push(manager.signer.getAddress());
        }
        let walletsAddresses = await Promise.all(addressesPromises);

        let i = 0;
        for (const wallet of walletsAddresses) {
            balancesPromises.push(
                this.driverManager.provider
                    .getBalance(wallet)
                    .then((balance) => formatEther(balance))
                    .catch((e) => {
                        console.log(`Error getting balance for account: ${e}`);
                        return 0;
                    })
            );

            lastBlockPromises.push(
                this.signingManagers[i].provider
                    .getBlockNumber()
                    .then((bNr) => parseInt(bNr))
                    .catch((e) => -2)
            );
        }

        let balances = await Promise.all(balancesPromises);
        let lastBlocks = await Promise.all(lastBlockPromises);

        for (let i = 0; i < balances.length; i++) {
            accountWithInfo.push({
                address: walletsAddresses[i],
                balance: balances[i],
                balanceThreshold: BALANCE_THRESHOLD,
                overThreshold: balances[i] > parseInt(BALANCE_THRESHOLD || "0"),
                accountType: "signingManager",
                lastBlock: lastBlocks[i],
                nodeUrl: this.signingManagers[i].provider.connection.url,
            });
        }

        if (typeof cb === "function") cb(accountWithInfo);

        return accountWithInfo;
    }
}

export default new MonitorController();
