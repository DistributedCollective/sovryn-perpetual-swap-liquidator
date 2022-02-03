import { Telegram } from "telegraf";
import { INotifier } from "./INotifier";

export default class TelegramNotifier implements INotifier {
    private bot;
    private telegramId;

    constructor(telegramSecret: string, telegramId: string) {
        this.bot = new Telegram(telegramSecret);
        this.telegramId = telegramId;
    }

    async sendMessage(message: string, extra = {}): Promise<void> {
        try {
            await this.bot.sendMessage(this.telegramId, message, extra);
        } catch (err) {
            console.log(err);
        }
    }
}
