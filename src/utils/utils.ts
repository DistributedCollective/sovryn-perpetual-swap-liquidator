const { Telegram } = require('telegraf');
const cfg = require('../configs');

let telegramBot;
if (cfg.telegram && cfg.telegram.apiToken) {
    telegramBot = new Telegram(cfg.telegram.apiToken);
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
                await telegramBot.sendMessage(cfg.telegram.chatId, msg, { parse_mode: 'HTML' });
            } catch (e) {
                console.error(e);
            }
        }
    }
}