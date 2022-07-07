module.exports = {
  apps: [
  {
    name: "mainnet-liquidator-btcusd",
    script: "ts-node src/main.ts",
    max_memory_restart: "1000M",
    log_date_format: "YYYY-MM-DD HH:mm Z",
    env: {
      PERP_ID: "0x369d7c01e026e750d616303e0fa4ac262c55e4ebe19a54cbf15d814b03b1182b",
      IDX_ADDR_START: 0,
      NUM_ADDRESSES: 4,
      PERP_NAME: 'MAINNET-BTCUSD',
      MANAGER_ADDRESS: "0x86f586dc122d31E7654f89eb566B779C3D843e22",
      TOKEN_ADDRESS: "0x6a7F2d2e5D5756729e875c8F8fC254448E763Fdf",
      NODE_URLS: '["https://bsc.sovryn.app/testnet","https://bsc-dataseed1.binance.org/","https://bsc-dataseed2.binance.org/","https://bsc-dataseed3.binance.org/","https://bsc-dataseed4.binance.org/","https://bsc-dataseed1.defibit.io/","https://bsc-dataseed2.defibit.io/","https://bsc-dataseed3.defibit.io/", "https://bsc-dataseed4.defibit.io/", "https://bsc-dataseed1.ninicoin.io/", "https://bsc-dataseed2.ninicoin.io/", "https://bsc-dataseed3.ninicoin.io/", "https://bsc-dataseed4.ninicoin.io/"]',
      PUBLIC_NODE_PROVIDER: 'https://bsc-dataseed1.binance.org/',
      HEARTBEAT_LISTENER_URL: "https://thenurse.prforge.com/api/heartbeats",
      HEARTBEAT_SHOULD_RESTART_URL: "https://thenurse.prforge.com/api/heartbeats/should-restart",
      OWNER_ADDRESS: "0x6a7F2d2e5D5756729e875c8F8fC254448E763Fdf", //treasury address
      TESTNET: false,
      DB_NAME: "liquidator_mainnet_btcusd.db",
      BLOCK_EXPLORER: "https://www.bscscan.com/",
      SERVER_PORT: 2004,
      BALANCE_THRESHOLD: 1,
      GRAPHQL_ENDPOINT: "https://api.thegraph.com/subgraphs/name/distributedcollective/sovryn-perpetual-futures",
    }
  },
  ]
}
