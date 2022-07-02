module.exports = {
  apps : [{
    name   : "testnet-liquidator-btcusd",
    script : "ts-node src/main.ts",
    max_memory_restart : "1000M",
    log_date_format : "YYYY-MM-DD HH:mm Z",
    watch: ['src'],
    env: {
      PERP_ID: "0x369d7c01e026e750d616303e0fa4ac262c55e4ebe19a54cbf15d814b03b1182b",
      IDX_ADDR_START: 0,
      NUM_ADDRESSES: 3,
      PERP_NAME: 'TESTNET-BTCUSD',
      MANAGER_ADDRESS:"0xE952cCc755758A127623163e96B032619Bb42143",
      TOKEN_ADDRESS:"0xcF3D22A034Fa157985F0Fe71F15477446f80Be26",
      NODE_URLS:'["https://bsc.sovryn.app/testnet","https://data-seed-prebsc-1-s1.binance.org:8545/","https://data-seed-prebsc-2-s1.binance.org:8545/","http://data-seed-prebsc-1-s2.binance.org:8545/","http://data-seed-prebsc-2-s2.binance.org:8545/","https://data-seed-prebsc-1-s3.binance.org:8545","https://data-seed-prebsc-2-s3.binance.org:8545"]',
      PUBLIC_NODE_PROVIDER: 'https://data-seed-prebsc-1-s1.binance.org:8545/',
      HEARTBEAT_LISTENER_URL:"https://thenurse.prforge.com/api/heartbeats",
      HEARTBEAT_SHOULD_RESTART_URL:"https://thenurse.prforge.com/api/heartbeats/should-restart",
      OWNER_ADDRESS:"0xE7c7417D1360B188401f4dd4bc757A0bc4dE433f",
      TESTNET: true,
      DB_NAME: "liquidator_testnet_btcusd.db",
      BLOCK_EXPLORER: "https://testnet.bscscan.com/",
      SERVER_PORT: 3004,
    }
  },
  {
    name   : "testnet-liquidator-bnbusd",
    script : "ts-node src/main.ts",
    max_memory_restart : "1000M",
    log_date_format : "YYYY-MM-DD HH:mm Z",
    env: {
      PERP_ID: "0x75848bb7f08d2e009e76fdad5a1c6129e48df34d81245405f9c43b53d204dfaf",
      IDX_ADDR_START: 0,
      NUM_ADDRESSES: 3,
      PERP_NAME: 'TESTNET-BNBUSD',
      MANAGER_ADDRESS:"0xE952cCc755758A127623163e96B032619Bb42143",
      TOKEN_ADDRESS:"0xcF3D22A034Fa157985F0Fe71F15477446f80Be26",
      NODE_URLS:'["https://bsc.sovryn.app/testnet","https://data-seed-prebsc-1-s1.binance.org:8545/","https://data-seed-prebsc-2-s1.binance.org:8545/","http://data-seed-prebsc-1-s2.binance.org:8545/","http://data-seed-prebsc-2-s2.binance.org:8545/","https://data-seed-prebsc-1-s3.binance.org:8545","https://data-seed-prebsc-2-s3.binance.org:8545"]',
      HEARTBEAT_LISTENER_URL:"https://thenurse.prforge.com/api/heartbeats",
      HEARTBEAT_SHOULD_RESTART_URL:"https://thenurse.prforge.com/api/heartbeats/should-restart",
      OWNER_ADDRESS:"0xE7c7417D1360B188401f4dd4bc757A0bc4dE433f",
      TESTNET: true,
      DB_NAME: "liquidator_testnet_bnbusd.db",
      BLOCK_EXPLORER: "https://testnet.bscscan.com/",
      SERVER_PORT: 3005,
    }
  }]
}
