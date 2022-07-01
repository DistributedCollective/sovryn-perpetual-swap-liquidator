module.exports = {
    node: "https://bsc.sovryn.app/testnet",
    db: "zero_testnet.db",
    blockExplorer: "https://testnet.bscscan.com/",
    serverPort: 3004,
    telegram: {
        apiToken: process.env.TELEGRAM_APITOKEN,
        chatId: process.env.TELEGRAM_CHATID
    },
};
