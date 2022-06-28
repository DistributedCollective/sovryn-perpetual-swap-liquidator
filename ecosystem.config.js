module.exports = {
  apps : [{
    name   : "liquidator-btcusd",
    autorestart: false,
    script : "ts-node src/main.ts",
    max_memory_restart : "1000M",
    log_date_format : "YYYY-MM-DD HH:mm Z",
    env: {
      PERP_ID: "0x369d7c01e026e750d616303e0fa4ac262c55e4ebe19a54cbf15d814b03b1182b",
      IDX_ADDR_START: 0,
      NUM_ADDRESSES: 3,
      PERP_NAME: 'BTCUSD',
    }
  },
  {
    name   : "liquidator-bnbusd",
    script : "ts-node src/main.ts",
    max_memory_restart : "1000M",
    log_date_format : "YYYY-MM-DD HH:mm Z",
    env: {
      PERP_ID: "0x75848bb7f08d2e009e76fdad5a1c6129e48df34d81245405f9c43b53d204dfaf",
      IDX_ADDR_START: 0,
      NUM_ADDRESSES: 3,
      PERP_NAME: 'BNBUSD',
    }
  }]
}
