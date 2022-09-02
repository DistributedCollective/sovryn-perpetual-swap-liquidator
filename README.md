# Sovryn perpetuals swap liquidator
Liquidation scripts for Sovryn Perpetual Swaps
 
## Install it
```
$ git clone https://github.com/DistributedCollective/sovryn-perpetual-swap-liquidator.git
$ cd sovryn-perpetual-swap-liquidator
$ npm install
$ npm install -g ts-node
``` 

## Configure it

For now there are 2 perpetuals running: BTC/USD and BNB/USD. In order to have one liquidator instance working for each of these, we have it configured as an app in the ecosystem.config.js file for testnet and ecosystem-mainnet.config.js for mainnet.
We describe the config process for testnet.
Edit the ecosystem.config.js file:

Make sure that `OWNER_ADDRESS` is **one of your wallet addresses**, because that's where the commissions earned by liquidating traders will end into!

Make sure the `MANAGER_ADDRESS` and `TOKEN_ADDRESS` point to the AMM that's currently in use and the rBTC ERC20 contract. 

There are a few other env variable which needs to be configured in the above file:

- `PERP_ID` - the address of the perpetual
- `IDX_START_ADDR` - the index of the start wallet generated using the MNEMONIC (ie: for IDX_START_ADDR=3, the derivation path of the starting wallet is m/44'/60'/0'/0/3)
- `NUM_ADDRESSES` is the number of wallets that'll be used to relay orders concurrently. (ie: if IDX_START_ADDR=3 and NUM_ADDRESSES=3, then the derivation path of the last wallet used will be m/44'/60'/0'/0/5)
- `PERP_NAME` - this is used when sending heartbeats and in logs to differentiate between perpetuals and testnet/mainnet
- `NODE_URLS` - a list of nodes where the liquidator will connect to (it will choose a random one from this list)
- `PUBLIC_NODE_PROVIDER` - a single node which we query to get the latest block mined. This number is compared with the latest block mined by the node the liquidator is connected to.
- `DB_NAME` - the filename of the sqlite db used for storing/retrieving info cached for the dashboard.
- `BLOCK_EXPLORER` - the URL of the block explorer, used when displaying transactions/wallet URLs
- `SERVER_PORT` - the port where the dashboard for the current perpetual can be accessed
- `BALANCE_THRESHOLD` - the BNB amount below which liquidator wallet account is shown in red in the dashboard
- `GRAPHQL_ENDPOINT` - we use this to get the latest liquidations, to display them in the dashboard


The `HEARTBEAT_LISTENER_URL` is a heartbeat listening API endpoint. [TheNurse](https://github.com/DistributedCollective/TheNurse) is a project that's being built for this. If there's a running instance of TheNurse at `https://thenurse.example.com`, then `HEARTBEAT_LISTENER_URL` would be set to `https://thenurse.example.com/api/heartbeats`

Create and edit the `.env` file (`mv .env-example .env`):
Configure `TELEGRAM_BOT_SECRET` and `TELEGRAM_CHANNEL_ID` with the correct credentials of a telegram bot ([here's how you can create your own](https://core.telegram.org/bots#3-how-do-i-create-a-bot)) so that the liquidator can send you notifications* if something goes wrong.

## Run it.

The liquidator bot needs access to a mnemonic that represents a bip39 seed phrase, so it can create multiple wallet instances that can liquidate multiple traders concurrently.

The call to `getConnectedAndFundedSigners(0, 11)` in the `liquidationsDriver.ts` file, returns up to 11 wallet** instances, from which the first one is used to listen to the smart contract emitted events and the last (up to) ten are used to liquidate traders.

The liquidator reads the mnemonic from the `MNEMONIC` environment variable. Whether you set it in the .env file, or from the CLI in the terminal where you start the script, it doesn't matter.

Once the `MNEMONIC` env variable is configured, run:
```
$ ts-node src/liquidationsDriver.ts .env
```

Or, to start it with pm2:

```
$ pm2 start liquidator-ecosystem.config.js
```


# Notes:

\* The script won't start without the telegram credentials configured. If you want to start it started without configuring the telegram bot, comment out all the references to the `notifier` variable in the `liquidationsDriver.ts` file.
  
** up to 11, meaning the function will filter out the wallets that are not funded with the equivalent of 4 million gas in testnet BSC, to make sure all of them are able to liquidate at least once.
