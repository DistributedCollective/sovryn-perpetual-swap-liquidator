const ethers = require("ethers");
import { perpMath, perpQueries, perpUtils } from "@sovryn/perpetual-swap";
const { queryTraderState, queryAMMState, queryPerpParameters } = perpQueries;
const { getPrice, getRequiredMarginCollateral, getMaxInitialLeverage } = perpUtils;
const { ABK64x64ToFloat, floatToABK64x64 } = perpMath;

const BN = ethers.BigNumber;
const MASK_MARKET_ORDER = BN.from("0x40000000");
const MASK_CLOSE_ONLY = BN.from("0x80000000");
const ZERO_ADDRESS = "0x0000000000000000000000000000000000000000";

const TOKEN_ABI = require("./ERC20.json");

/**
 * Place a market order of size 'tradeSize' and leverage 'leverage'.
 * @param signingManager a perpetual manager contract instance with a funded wallet attached to it.
 * @param collateralWallet an ERC20 token instance with a wallet attached to it. This is used to fund the trade.
 * @param perpId the perpetual id
 * @param tradeSize the total amount bought (>0) or sold (<0), in base currency (not 'cents'/sats)
 * @param leverage the desired leverage of the position
 */
export async function marketTradeWithLeverage(signingManager, perpId, tradeSize, leverage, perpAmmTraderState, skipIncreaseAllowance = false) {
    try {
        let timeStart = new Date().getTime();
        if (tradeSize === 0) {
            console.log(`tradeSize must not be 0`);
            return;
        }
        const signer = signingManager.signer;
        const token = new ethers.Contract(process.env.TOKEN_ADDRESS, TOKEN_ABI, signer);

        const traderAddr = await signer.getAddress();
        const managerAddress = signingManager.address;

        let { traderState, ammState, perpParams } = perpAmmTraderState;

        let traderNewPosition = traderState.marginAccountPositionBC + tradeSize;
        // let traderNewPosition = tradeSize;
        let price = getPrice(traderNewPosition, perpParams, ammState);
        let slippage = 0.001; // 0.1%
        let priceMultiplier = tradeSize > 0 ? 1 + slippage : 1 - slippage;
        let limitPrice = price * priceMultiplier; //set the limit price 'slippage' percent higher/lower than the current perp price
        console.log(`Perp price ${price}. Order price: ${limitPrice}. Our new pos: ${tradeSize}`);

        let traderCashToAdd = getRequiredMarginCollateral(leverage, traderNewPosition, perpParams, ammState, traderState);
        let txReceipt;
        if (traderCashToAdd > 0 && !skipIncreaseAllowance /*&& leverage === 0*/) {
            console.log(`adding ${traderCashToAdd} as collateral`);

            const txIncreaseAllowance = await token.increaseAllowance(managerAddress, floatToABK64x64(traderCashToAdd));
            txReceipt = await txIncreaseAllowance.wait();
            console.log(`Increased allowance`);

            // // deposit to perpetual
            // const txDeposit = await signingManager.deposit(perpId, floatToABK64x64(traderCashToAdd), { gasLimit: 1_000_000 });
            // txReceipt = await txDeposit.wait();
            // console.log(`Deposited amount ${traderCashToAdd}`, txReceipt);
        }

        const secondsNow = Math.floor(new Date().getTime() / 1000);
        let order = {
            iPerpetualId: perpId,
            traderAddr: traderAddr,
            fAmount: floatToABK64x64(tradeSize),
            fLimitPrice: floatToABK64x64(limitPrice),
            fLeverage: floatToABK64x64(leverage),
            iDeadline: BN.from(secondsNow + 60 * 10), //10 minutes
            referrerAddr: ZERO_ADDRESS,
            flags: MASK_MARKET_ORDER,
            createdTimestamp: BN.from(secondsNow),
        };

        console.log(`Trader state before placing trade`, traderState);
        let txTrade = await signingManager.trade(order, { gasLimit: 3_000_000 });
        console.log(`Order is in mempool`, /*txTrade,*/ txTrade.hash);

        txReceipt = await txTrade.wait();
        console.log(`Traded successfully. `, /*txReceipt*/);

        traderState = await queryTraderState(signingManager, perpId, traderAddr);
        
        console.log(`traderState after trade`, traderState);
        let timeEnd = new Date().getTime();
        console.log(`Total time to place the order: ${timeEnd - timeStart} ms`);
        // let receipt = await ethers.provider.getTransactionReceipt(txTrade.hash);
        // console.log("trade: gasUsed = " + receipt.gasUsed);
        return txReceipt.transactionHash;
    } catch (e) {
        console.log(`Error: `, e);
        throw e;
    }
}

export async function placeMaxLeverageOrder(signingManager, perpId, tradeSize) {
    try {
        const signer = signingManager.signer;
        const traderAddr = await signer.getAddress();

        let [traderState, ammState, perpParams] = await Promise.all([
            queryTraderState(signingManager, perpId, traderAddr),
            queryAMMState(signingManager, perpId),
            queryPerpParameters(signingManager, perpId),
        ]);

        let traderNewPosition = traderState.marginAccountPositionBC + tradeSize;
        const maxLeverage = await getMaxInitialLeverage(traderNewPosition, perpParams);
        console.log(`Trader:
              Existing position ${traderState.marginAccountPositionBC}
              New position ${traderNewPosition},
              Max Leverage ${maxLeverage}`);

        return await marketTradeWithLeverage(signingManager, perpId, tradeSize, maxLeverage * 0.97, { traderState, ammState, perpParams });
    } catch (error) {
        console.log(`Error: `, error);
    }
}

export async function closeOpenPosition(signingManager, perpId, perpAmmTraderState) {
    try {
        const signer = signingManager.signer;
        const traderAddr = await signer.getAddress();
        let { traderState, ammState, perpParams } = perpAmmTraderState || {};
        if (!perpAmmTraderState || !traderState) {
            [traderState, ammState, perpParams] = await Promise.all([
                queryTraderState(signingManager, perpId, traderAddr),
                queryAMMState(signingManager, perpId),
                queryPerpParameters(signingManager, perpId),
            ]);
        }
        let tradeSize = -1 * traderState.marginAccountPositionBC;
        if(tradeSize === 0){
          return;
        }
        const secondsNow = Math.floor(new Date().getTime() / 1000);
        let perpPrice = getPrice(0, perpParams, ammState);

        /*set a price that we are certain it will close the existing position:
        - 0 for long positions
        - price x 10 for short positions
        */
       //TODO calculate a proper slippage and decide whether that's acceptable or not.
        let limitPrice = traderState.marginAccountPositionBC > 0 ? 0 : perpPrice * 10;
        let order = {
            iPerpetualId: perpId,
            traderAddr: traderAddr,
            fAmount: floatToABK64x64(tradeSize),
            fLimitPrice: floatToABK64x64(limitPrice),
            fLeverage: floatToABK64x64(0),
            iDeadline: BN.from(secondsNow + 60 * 10), //10 minutes
            referrerAddr: ZERO_ADDRESS,
            flags: MASK_CLOSE_ONLY,
            createdTimestamp: BN.from(secondsNow),
        };

        let txTrade = await signingManager.trade(order, { gasLimit: 2_000_000 });
        console.log(`Order is in mempool`, /*txTrade,*/ txTrade.hash);

        let txReceipt = await txTrade.wait();
        console.log(`Position closed successfully: `, txReceipt.transactionHash);
    } catch (e) {
        console.log(`Error closing position`, e);
    }
}
