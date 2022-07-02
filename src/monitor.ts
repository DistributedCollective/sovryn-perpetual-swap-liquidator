/**
 *  Accepts client requests and checks the health of the Sovryn node in 60s interval
 *  If the system is not healthy it sends a message to the telegram group
 */
const axios = require("axios");
const { formatEther } = require("ethers/lib/utils");

//  import A from '../secrets/accounts';
//  import C from './contract';
//  import conf from '../config/config';
const { PUBLIC_NODE_PROVIDER, BLOCK_EXPLORER } = process.env;
//  import common from './common';
import dbCtrl from "./db";
//  import accounts from '../secrets/accounts';
//  import arbitrageCtrl from './arbitrage';

class MonitorController {
    private driverManager;
    private signingManagers;
    private positions;

    start(driverManager, signingManagers, positions) {
        this.positions = positions;
        this.signingManagers = signingManagers;
        this.driverManager = driverManager;

        //  if(conf.errorBotTelegram!="") {
        //      let p = this;
        //      setInterval(() => {
        //         // p.checkSystem();
        //      }, 1000 * 60);
        //  }
    }

    /**
     * Wrapper for health signals, called from client
     */
    async getSignals(cb: any = null) {
        const resp = {
            blockInfoLn: await this.getCurrentBlockPrivateNode(),
            blockInfoPn: await this.getCurrentBlockPublicNode(),
            accountInfoLiq: await this.getAccountsInfo(null),
            positionInfo: await this.getOpenPositions(),
            //  liqInfo: await this.getOpenLiquidations(),
        };
        if (typeof cb === "function") cb(resp);
        else return resp;
    }

    //  async getAddresses(cb) {
    //      const resp = {
    //          liquidator: await Promise.all(accounts.liquidator.map(async (account) => await this.getAccountInfoForFrontend(account, "liquidator"))),
    //          rollover: await this.getAccountInfoForFrontend(accounts.rollover[0], "rollover"),
    //          arbitrage: await this.getAccountInfoForFrontend(accounts.arbitrage[0], "arbitrage"),
    //      };
    //      if (conf.watcherContract) {
    //          resp.watcher = await this.getAccountInfoForFrontend(
    //              {
    //                  adr: conf.watcherContract,
    //              },
    //              "watcher contract"
    //          );
    //      }
    //      if (typeof cb === "function") cb(resp);
    //      else return resp;
    //  }

    async getTotals(cb, last24h) {
        console.log(last24h ? "get last 24h totals" : "get totals");
        const liquidator = await dbCtrl.getTotals("liquidator", last24h);
        const resp = {
            totalLiquidations: liquidator?.totalActionsNumber,
            totalLiquidatorProfit: Number(liquidator?.profit).toFixed(6),
        };
        if (typeof cb === "function") cb(resp);
        else return resp;
    }

    /**
     * Internal check
     */
    //  async checkSystem() {
    //     //  if (conf.network === "test") return;

    //      const sInfo = await this.getSignals();
    //      for (let b in sInfo.accountInfoLiq) {
    //          if (sInfo.accountInfoLiq[b] < 0.001)
    //              common.telegramBot.sendMessage("No money left for liquidator-wallet " + b + " on " + conf.network + " network");
    //      }

    //      for (let b in sInfo.accountInfoRoll) {
    //          if (sInfo.accountInfoRoll[b] < 0.001)
    //              common.telegramBot.sendMessage("No money left for rollover-wallet " + b + " on " + conf.network + " network");
    //      }

    //      for (let b in sInfo.accountInfoArb) {
    //          if (sInfo.accountInfoArb[b] < 0.001)
    //              common.telegramBot.sendMessage("No money left for arbitrage-wallet " + b + " on " + conf.network + " network");
    //      }
    //  }

    getCurrentBlockPublicNode() {
        let p = this;
        console.log(`getCurrentBlockPublicNode`, PUBLIC_NODE_PROVIDER);
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
        let accountWithInfo = {
            driverManagerAddress: this.driverManager.address,
            signingManagers: {},
        };
        let balancesPromises = Array();
        let addressesPromises = Array();
        for (const manager of this.signingManagers) {
            addressesPromises.push(manager.signer.getAddress());
        }
        let walletsAddresses = await Promise.all(addressesPromises);

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
        }

        let balances = await Promise.all(balancesPromises);
        for (let i = 0; i < balances.length; i++) {
            accountWithInfo.signingManagers[walletsAddresses[i]] = balances[i];
        }

        if (typeof cb === "function") cb(accountWithInfo);

        return accountWithInfo;
    }

    // async getAccountInfoForFrontend(account, type) {
    //     if (!account) return null;
    //     const tokenAddresses = C.getAllTokenAddresses();
    //     let _wrtcBal = await C.web3.eth.getBalance(account.adr);
    //     _wrtcBal = Number(C.web3.utils.fromWei(_wrtcBal, "Ether"));

    //     let accountWithInfo = {
    //         address: account.adr,
    //         type,
    //         rBtcBalance: {
    //             balance: _wrtcBal.toFixed(5),
    //             overThreshold: _wrtcBal > conf.balanceThresholds["rbtc"],
    //         },
    //         tokenBalances: await Promise.all(
    //             tokenAddresses.map(async (tokenAddress) => ({
    //                 token: C.getTokenSymbol(tokenAddress),
    //                 balance: Number(C.web3.utils.fromWei(await C.getWalletTokenBalance(account.adr, tokenAddress), "Ether")).toFixed(5),
    //             }))
    //         ),
    //     };
    //     accountWithInfo.tokenBalances = accountWithInfo.tokenBalances.map((tokenBalance) => ({
    //         ...tokenBalance,
    //         token: tokenBalance.token === "rbtc" ? "wrbtc" : tokenBalance.token,
    //         overThreshold: tokenBalance.balance > conf.balanceThresholds[tokenBalance.token],
    //     }));

    //     let rbtcBal = Number(accountWithInfo.rBtcBalance.balance) || 0;
    //     let usdBal = 0;
    //     for (const tokenBal of accountWithInfo.tokenBalances) {
    //         let bal = Number(tokenBal.balance) || 0;
    //         if (tokenBal.token == "wrbtc") bal += rbtcBal;
    //         if (bal <= 0) continue;
    //         const price = await this.getUsdPrice(tokenBal.token);
    //         usdBal += price * bal || 0;
    //     }

    //     accountWithInfo.usdBalance = usdBal.toFixed(2);

    //     return accountWithInfo;
    // }

    getOpenPositions() {
        return Object.keys(this.positions).length;
    }

    //todo: add from-to, to be called from cliet
    async getOpenPositionsDetails(cb) {
        if (typeof cb === "function") cb(this.positions);
    }
    
}

export default new MonitorController();
