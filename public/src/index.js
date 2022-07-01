const socket = io();


class AppCtrl {
    constructor($scope) {
        this.accounts = [];
        this.blockExplorer = '';

        this.totalProfit = 0;
        this.last24HProfit = 0;
        this.totalSuccess = 0;
        this.totalFailed = 0;
        this.total24HSuccess = 0;
        this.total24HFailed = 0;

        this.$scope = $scope;
        this.start();
    }

    static get $inject() {
        return ['$scope'];
    }

    start() {
        this.getAccountsInfo();
        this.getNetworkData();
        this.getTotals(); // fire only once
        this.getLast24HTotals();

        setInterval(() => {
            this.getAccountsInfo();
            this.getLast24HTotals();
        }, 15000);
    }

    getAccountsInfo() {
        let p=this;

        socket.emit("getAccountsInfo", (res) => {
            console.log("response account:", res.signingManagers);
            p.accounts = res;
            p.$scope.$applyAsync();
        });
    }

    getNetworkData() {
        let p=this;

        socket.emit("getNetworkData", (res) => {
            console.log("network data:", res);

            p.blockExplorer = res.blockExplorer;

            p.$scope.$applyAsync();
        });
    }

    getTotals() {
        let p=this;

        socket.emit("getTotals", (res) => {
            console.log("response totals:", res);
            p.totalSuccess = res.successActions;
            p.totalFailed = res.failedActions;
            p.totalProfit = res.profit;
            p.$scope.$applyAsync();
        });
    }

    getLast24HTotals() {
        let p=this;

        socket.emit("getLast24HTotals", (res) => {
            console.log("response last 24h totals:", res);
            p.total24HSuccess = res.successActions;
            p.total24HFailed = res.failedActions;
            p.last24HProfit = res.profit;
            p.$scope.$applyAsync();
        });
    }
}


class TrovesCtrl {
    constructor($scope) {
        this.troves = {
            list: [],
            status: "",
            page: 1,
            limit: 100,
            total: 0,
        };

        this.$scope = $scope;
        this.listTroves(true);
        this.getNetworkData();

        setInterval(() => {
            this.listTroves();
        }, 30000);
    }

    static get $inject() {
        return ['$scope'];
    }

    getNetworkData() {
        let p = this;

        socket.emit("getNetworkData", (res) => {
            p.blockExplorer = res.blockExplorer;

            p.$scope.$applyAsync();
        })
    }

    listTroves(resetPage) {
        const p = this;
        const tableData = this.troves;
        const page = resetPage ? 0 : tableData.page;
        const offset = (page - 1) * tableData.limit;
        const filter = {
            offset: offset,
            limit: tableData.limit,
            status: tableData.status,
        };
        socket.emit('listTroves', filter, (result) => {
            tableData.list = result.list;
            tableData.total = result.total;
            tableData.page = Math.floor(result.offset / result.limit) + 1;
            p.$scope.$applyAsync();
        });
    }

    short(text) {
        return text.substr(0, 4) + '...' + text.substr(text.length - 4);
    }
}

angular.module('app', ['ui.bootstrap'])
    .controller('appCtrl', AppCtrl)
    .controller('trovesCtrl', TrovesCtrl)
    ;

angular.bootstrap(document, ['app']);
