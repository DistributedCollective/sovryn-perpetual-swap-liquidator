/**
 * Datbase controller.
 */

const sqlite3 = require('sqlite3').verbose();
const path = require('path');

import Liquidator from './models/liquidator';


class DbCtrl {

    private db;
    private liqRepo;

    async initDb(dbName) {
        return new Promise(resolve => {
            const file = path.join(__dirname, '../dbs/' + dbName);
            this.db = new sqlite3.Database(file, sqlite3.OPEN_READWRITE | sqlite3.OPEN_CREATE, (err) => {
                if (err) {
                    console.error(err.message, file);
                } else {

                    console.log('Connected to the ' + dbName + ' database.');

                    this.initRepos().catch(console.error).then(() => resolve('Database initialized'));
                }
            });
        });
    }

    /**
     * @private
     */
    async initRepos() {
        try {

            this.liqRepo = new Liquidator(this.db);
            await this.liqRepo.createTable();
        } catch (e) {
            console.error(e);
        }
    }


    async addLiquidate({liquidatorAdr, liquidatedAdr, amount, pos, loanId, profit, txHash, status}) {
        try {
            return await this.liqRepo.insert({
                liquidatorAdr,
                liquidatedAdr,
                amount,
                pos,
                loanId,
                profit,
                txHash,
                status
            })
        } catch (e) {
            console.error(e);
        }
    }

    async getTotals(repo, last24H) {
        try {
            let table;
            let profit = 0;
            switch(repo) {
                case 'liquidator': table = this.liqRepo; break;
                default: console.warn("Not a known table. Returning liquidations table as default"); table = this.liqRepo;
            }
            const sqlQuery = last24H ? // select either all actions or only the last 24h ones
                `SELECT * FROM ${repo} WHERE dateAdded BETWEEN DATETIME('now', '-1 day') AND DATETIME('now')` :
                `SELECT * FROM ${repo}`;
            const allRows = await table.all(sqlQuery, (err, rows) => { return rows });

            allRows.forEach((row) => {
                if (repo === 'liquidator') {
                    if (row.profit) {
                        let [profitValue, symbol] = row.profit.split(' ');
                        symbol = symbol.toLowerCase();
                        // const symbolPrice = usdPrices[symbol] ? usdPrices[symbol] : 1;
                        // const fee = config.liquidationTxFee * usdPrices['rbtc'] || 0;
                        profit += (Number(profitValue) /* * symbolPrice- fee*/);
                    }
                } else {
                    profit += Number(row.profit);
                }
                return row;
            })
            return { totalActionsNumber: allRows.length, profit };
        } catch (e) {
            console.error(e);
        }
    }
}

export default new DbCtrl();
