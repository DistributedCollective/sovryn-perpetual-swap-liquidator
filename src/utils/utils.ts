const { Telegram } = require('telegraf');

const {TELEGRAM_BOT_SECRET, TELEGRAM_CHANNEL_ID} = process.env;
let telegramBot;
if (TELEGRAM_BOT_SECRET) {
    telegramBot = new Telegram(TELEGRAM_BOT_SECRET);
}

module.exports = new class Utils {
    formatDate(date) {
        const output = new Date(parseInt(date) * 1000).toISOString().slice(0, 19).replace("T", " ");
        return output;
    }

    waste(seconds) {
        return new Promise(resolve => setTimeout(resolve, seconds * 1000));
    }

    async sendTelegramMsg(msg) {
        if (telegramBot) {
            try {
                await telegramBot.sendMessage(TELEGRAM_CHANNEL_ID, msg, { parse_mode: 'HTML' });
            } catch (e) {
                console.error(e);
            }
        }
    }
}