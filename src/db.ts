/**
 * DB controller
 */
const p = require("path");
const SQLite3 = require('sqlite3');

const TroveModel = require("./models/troveModel");
const TroveStatus = require("./models/troveStatus");
const Utils = require("./utils/utils");

const sqlite3 = SQLite3.verbose();

class DbCtrl {
    private db;
    private troveModel;
    private 
    async initDb(dbName) {
        return new Promise(resolve => {
            const file = p.join(__dirname, '../dbs/' + dbName);
            this.db = new sqlite3.Database(file, sqlite3.OPEN_READWRITE | sqlite3.OPEN_CREATE, (err) => {
                if (err) {
                    console.error(err.message, file);
                } else {

                    console.log('Connected to the ' + dbName + ' database.');

                    this.initRepos().catch(console.error).finally(() => resolve(null));
                }
            });
        });
    }

    /**
     * @private
     */
    async initRepos() {
        try {
            this.troveModel = new TroveModel(this.db);

            await this.troveModel.createTable();
        } catch (e) {
            console.error(e);
        }
    }

    /**
     * Insert a trove
     */
    async addTrove(trove) {
        try {
            const exists = await this.troveModel.findOne({
                owner: trove.ownerAddress,
                status: [TroveStatus.open, TroveStatus.liquidating]
            });
            const collateralBtc = trove.collateral.toString();
            const borrowedUsd = trove.debt.toString();
            if (exists) {
                return this.troveModel.update({ id: exists.id }, {
                    collateralBtc: collateralBtc,
                    borrowedUsd: borrowedUsd,
                    status: exists.status == TroveStatus.liquidating ? exists.status : trove.status,
                    icr: trove.icr
                });
            }

            return await this.troveModel.insert({
                owner: trove.ownerAddress,
                collateralBtc: collateralBtc,
                borrowedUsd: borrowedUsd,
                status: trove.status,
                icr: trove.icr,
            });
        } catch (e) {
            console.error(e);
        }
    }

    async updateTrove(id, { liquidator, txHash, profit, status }) {
        try {
            await this.troveModel.update({ id }, {
                liquidator,
                txHash,
                profit,
                status,
                liquidatedAt: Utils.formatDate(Date.now() / 1000)
            });
        } catch (e) {
            console.error(e);
        }
    }

    async updateLiquidatingTrove(ownerAddress, { liquidator, txHash, profit, status }) {
        const liquidating = await this.db.getTrove(ownerAddress, TroveStatus.liquidating);
        if (liquidating) {
            await this.db.updateTrove(liquidating.id, {
                liquidator,
                txHash,
                profit,
                status,
            });
        }
    }

    /**
     * Count total successful, failed liquidated troves
     */
    async getTotals(last24H) {
        try {
            let profit = 0;
            const sqlQuery = last24H ? // select either all actions or only the last 24h ones
                `SELECT * FROM troves WHERE liquidatedAt BETWEEN DATETIME('now', '-1 day') 
                    AND DATETIME('now') 
                    AND status IN ('liquidated', 'failed')` :
                `SELECT * FROM troves WHERE status IN ('liquidated', 'failed')`;
            const rows = await this.troveModel.all(sqlQuery);
            let successActions = 0, failedActions = 0;

            rows.forEach((row) => {
                if (row.profit) {
                    profit += Number(row.profit);
                }
                if (row.status == TroveStatus.liquidated) successActions ++;
                else failedActions ++;
            });
            return { successActions, failedActions, profit };
        } catch (e) {
            console.error(e);
        }
    }

    async getTrove(ownerAddress, status = 'open') {
        return await this.troveModel.findOne({ owner: ownerAddress, status: status });
    }

    async listTroves({ status, limit, offset } = {status: '', limit: 10, offset: 0}) {
        const cond = { status: ''};
        let orderBy;
        if (status) cond.status = status;
        const list = await this.troveModel.find(cond, {
            limit: limit || 100,
            offset,
            orderBy: {
                status: -1,
                icr: 1,
            }
        });
        return list || [];
    }

    async countTroves({ status } = { status: ''}) {
        const cond = {status: ''};
        if (status) cond.status = status;
        const count = await this.troveModel.count(cond);
        return count;
    }
}

module.exports = new DbCtrl();
