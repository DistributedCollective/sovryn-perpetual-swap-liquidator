let configPath = process.argv?.[2] || "../.env";
require("dotenv").config({ path: configPath });

import { marketTradeWithLeverage, placeMaxLeverageOrder } from "./trades";
import { getSigningManagerInstances } from "../utils/walletUtils";
import { getPerpetualIdsSerial } from "./liquidations";

const MANAGER_ABI = require(`../liquidations/${process.env.MANAGER_INTERFACE_NAME}`);

(async function main() {
    try {
        const [signingManager] = await getSigningManagerInstances(process.env.MANAGER_ADDRESS, MANAGER_ABI, process.env.NODE_URL, process.env.MTM, 1, 1);
        const [perpId] = (await getPerpetualIdsSerial(signingManager)) || [];

        let res = await placeMaxLeverageOrder(signingManager, perpId, 0.002);
    } catch (error) {
        console.log(`General error: `, error);
    }
})();
