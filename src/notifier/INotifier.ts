export interface INotifier {
  sendMessage(message: string, extra: string): Promise<void>;
}
