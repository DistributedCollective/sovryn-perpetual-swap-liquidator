module.exports = {
  apps : [{
    name   : "liquidator-btcusd",
    script : "ts-node src/main.ts",
    max_memory_restart : "1000M",
    log_date_format : "YYYY-MM-DD HH:mm Z",
    env: {
      PERP_ID: "0xada5013122d395ba3c54772283fb069b10426056ef8ca54750cb9bb552a59e7d",
      IDX_ADDR_START: 0,
      NUM_ADDRESSES: 11,
      PERP_NAME: 'BTCUSD',
    }
  },
  {
    name   : "liquidator-bnbusd",
    script : "ts-node src/main.ts",
    max_memory_restart : "1000M",
    log_date_format : "YYYY-MM-DD HH:mm Z",
    env: {
      PERP_ID: "0xcc69885fda6bcc1a4ace058b4a62bf5e179ea78fd58a1ccd71c22cc9b688792f",
      IDX_ADDR_START: 0,
      NUM_ADDRESSES: 11,
      PERP_NAME: 'BNBUSD',
    }
  }]
}
