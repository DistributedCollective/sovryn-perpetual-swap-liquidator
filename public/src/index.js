const socket = io();

class AppCtrl {
    constructor($scope) {
        this.lastBlockOurNode = 0;
        this.lastBlockExternalNode = 0;
        this.accounts = []
        this.blockExplorer = '';

        this.$scope = $scope;

        this.start();
    }

    static get $inject() {
        return ['$scope'];
    }

    start() {
        console.log(`AppCtrl started`);

        this.getSignals();
        this.getAccountsInfo();
        this.getNetworkData();
        this.getTotals(); // fire only once
        this.getLast24HTotals();
        this.getOpenPositions();

        setInterval(() => {
            this.getSignals();
            this.getAccountsInfo();
            this.getLast24HTotals();
        }, 15000);
    }

    getSignals() {
        let p=this;

        socket.emit("getSignals", (res) => {
            console.log("response signals", res);

            p.lastBlockOurNode = res.blockInfoPn;
            p.lastBlockExternalNode = res.blockInfoLn;
            p.perpName = res.perpName;

            p.$scope.$applyAsync();
        });
    }

    getAccountsInfo() {
        let p=this;

        socket.emit("getAccountsInfo", (res) => {
            console.log("response addresses:", res);

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
        })
    }

    getOpenPositions() {
        let p=this;

        socket.emit("getOpenPositions", (res) => {
            console.log("open positions:", res);
            p.openPositions = [...res.openPositions];

            p.positionsOverview = {
                markPrice: res.markPrice,
                totalOpenPositionsSize: 0,
                totalCollateral: 0,
                totalLongs: 0,
                totalShorts: 0,
            }

            for (const position of res.openPositions){
                p.positionsOverview.totalLongs += position.marginAccountPositionBC > 0 ? position.marginAccountPositionBC : 0;
                p.positionsOverview.totalShorts += position.marginAccountPositionBC < 0 ? Math.abs(position.marginAccountPositionBC) : 0;
            }
            p.positionsOverview.totalOpenPositionsSize = p.positionsOverview.totalLongs + p.positionsOverview.totalShorts;

            p.$scope.$applyAsync();
        })
    }

    getTotals() {
        let p=this;

        socket.emit("getTotals", (res) => {
            console.log("response totals for liquidations, arbitrages and rollovers:", res);

            p.totalLiquidations = res.totalLiquidations;
            p.totalArbitrages = res.totalArbitrages;
            p.totalRollovers = res.totalRollovers;

            p.totalLiquidatorProfit = res.totalLiquidatorProfit;
            p.totalArbitrageProfit = res.totalArbitrageProfit;
            p.totalRolloverProfit = res.totalRolloverProfit;

            p.$scope.$applyAsync();
        })
    }

    getLast24HTotals() {
        let p=this;

        socket.emit("getLast24HTotals", (res) => {
            console.log("response last 24h totals for liquidations, arbitrages and rollovers:", res);

            p.last24HLiquidations = res.totalLiquidations;
            p.last24HArbitrages = res.totalArbitrages;
            p.last24HRollovers = res.totalRollovers;

            p.last24HLiquidatorProfit = res.totalLiquidatorProfit;
            p.last24HArbitrageProfit = res.totalArbitrageProfit;
            p.last24HRolloverProfit = res.totalRolloverProfit;

            p.$scope.$applyAsync();
        })
    }
}

angular.module('app', []).controller('appCtrl', AppCtrl);

angular.bootstrap(document, ['app']);
