export interface Handler<T = any, R = void> {
  handle(commandOrEvent: T): Promise<R> | R;
}
