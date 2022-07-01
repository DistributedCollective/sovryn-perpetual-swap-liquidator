const _ = require('lodash');

module.exports = class BaseModel {
    constructor(db, tableName, createTableSQL) {
        this.db = db;
        this.table = tableName;
        this.createTableSQL = createTableSQL;
    }

    run(sql, params = []) {
        return new Promise((resolve, reject) => {
            this.db.run(sql, params, function (err) {
                if (err) {
                    console.error('Error running sql ' + sql);
                    console.error(err);
                    reject(err);
                }
                else {
                    resolve({ id: this.lastID });
                }
            });
        });
    }

    all(sql, params = []) {
        return new Promise((resolve, reject) => {
            this.db.all(sql, params, (err, rows) => {
                if (err) {
                    console.error('Error running sql: ' + sql);
                    console.error(err);
                    reject(err);
                }
                else {
                    resolve(rows);
                }
            });
        });
    }

    get(sql, params = []) {
        return new Promise((resolve, reject) => {
            this.db.get(sql, params, (err, result) => {
                if (err) {
                    console.log('Error running sql: ' + sql);
                    console.log(err);
                    reject(err);
                }
                else {
                    resolve(result);
                }
            });
        });
    }

    async createTable() {
        return await this.run(this.createTableSQL);
    }

    parseWhereClause(criteria) {
        return _.keys(criteria).map(k => {
            if (criteria[k] instanceof Array) {
                const clause = `${k} IN (${criteria[k].map(v => `'${v}'`).join(',')})`;
                delete criteria[k];
                return clause;
            }
            return `${k} = ?`;
        }).join(' AND ');
    }


    /**
     *
     * @param {object} criteria - query object for finding a user
     */
    findOne(criteria) {
        const where = this.parseWhereClause(criteria);
        const params = _.values(criteria);
        const sql = `SELECT * FROM ${this.table} WHERE ${where}`;

        return this.get(sql, params);
    }

    /**
     * Find list of users by some criteria
     * @param criteria
     * @param limit
     * @param offset
     * @param orderBy
     */
    find(criteria, { limit = 10, offset = 0, orderBy = null } = {}) {
        let sql = `SELECT * FROM ${this.table}`;

        if (_.size(criteria) > 0) {
            const where = this.parseWhereClause(criteria);
            sql += ' WHERE ' + where;
        }

        if (_.size(orderBy) > 0) {
            sql += ' ORDER BY ' + _.keys(orderBy).map(f => f + ' ' + (orderBy[f] > 0 ? 'ASC' : 'DESC')).join(', ');
        }

        if (limit > 0) {
            sql += ' LIMIT ' + limit;
        }
        if (offset > 0) {
            sql += ' OFFSET ' + offset;
        }

        const params = _.values(criteria);
        return this.all(sql, params);
    }

    async insert(data) {
        const params = _.values(data);
        const sql = `
            INSERT INTO ${this.table} (${_.keys(data).join(',')})
            VALUES (${_.map(data, () => '?').join(',')})
        `;

        const result = await this.run(sql, params);

        if (result && result.id != null) {
            return await this.findOne({ id: result.id });
        } else {
            return Promise.reject("Can not insert new item to table " + this.table);
        }
    }

    async update(criteria, updateObject) {
        const updateFields = _.keys(updateObject).map(key => key + ' = ?').join(', ');
        const where = this.parseWhereClause(criteria);
        const params = _.values(updateObject).concat(_.values(criteria));
        const sql = `
            UPDATE ${this.table}
            SET ${updateFields}
            WHERE ${where}
        `;

        return this.run(sql, params);
    }

    async delete(criteria) {
        const params = _.values(criteria);
        const where = this.parseWhereClause(criteria);
        const sql = `
            DELETE FROM ${this.table} WHERE ${where}
        `;

        return this.run(sql, params);
    }

    async count(criteria) {
        let sql = `Select Count(*) as total FROM ${this.table}`;

        if (_.size(criteria) > 0) {
            const where = this.parseWhereClause(criteria);
            sql += ' WHERE ' + where;
        }

        const params = _.values(criteria);
        const res = await this.all(sql, params);
        return res && res[0] && res[0].total || 0;
    }
}
