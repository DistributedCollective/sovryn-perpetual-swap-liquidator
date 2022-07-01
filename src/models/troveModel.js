const Utils = require("../utils/utils");
const BaseModel = require("./baseModel");

module.exports = class TroveModel extends BaseModel {
    constructor(db) {
        super(db, 'troves', `CREATE TABLE IF NOT EXISTS troves (
            id INTEGER PRIMARY KEY,
            owner text,
            collateralBtc text,
            borrowedUsd text,
            status text,
            icr text,
            liquidator text,
            dateAdded datetime,
            liquidatedAt datetime,
            txHash text,
            profit text
            )`);
    }

    async createTable() {
        try {
            const troveTable = await super.createTable();

            console.log("Created Trove table", troveTable);

            return troveTable;
        } catch (e) {
            console.log('Can not create Trove table', e);
        }
    }

    insert(data) {
        return super.insert({
            ...data,
            dateAdded: Utils.formatDate(Date.now() / 1000)
        });
    }

}