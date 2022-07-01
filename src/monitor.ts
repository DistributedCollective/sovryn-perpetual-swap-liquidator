const { Wallet } = require("ethers");
const { formatEther } = require("ethers/lib/utils");
const db = require("./db");
const config = require("./configs");

class Monitor {
    private driverManager;
    private signingManagers;
    init(driverManager, signingManagers) {
        this.driverManager = driverManager;
        this.signingManagers = signingManagers;
    }

    /**
     * Load all detail of account wallets on this relayer
     */
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

        for (const wallet of walletsAddresses){            
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

        cb(accountWithInfo);
    }

    /**
     * Load total processed orders, profit
     */
    async getTotals(cb, last24h = false) {
        const result = await db.getTotals(last24h);
        console.log(result);
        cb(result);
    }

    getNetworkData(cb) {
        const resp = {
            blockExplorer: config.blockExplorer,
        };
        cb(resp);
    }

    async listTroves({ status = "", offset = 0, limit = 10 }, cb) {
        const troves = await db.listTroves({ status, limit, offset, latest: true });
        const total = await db.countTroves({ status });
        cb({
            list: troves,
            total,
            offset,
            limit,
        });
    }
}

module.exports = new Monitor();
