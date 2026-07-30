export interface DomainEvent<T = Record<string, unknown>> {
  id: string;
  name: string;
  timestamp: number;
  payload: T;
  userId?: string;
  branchId?: string;
}

type EventHandler<T = any> = (event: DomainEvent<T>) => void | Promise<void>;

export class DomainEvents {
  private static handlers: Map<string, Set<EventHandler>> = new Map();

  /**
   * Subscribe a handler to a specific domain event name.
   */
  static subscribe<T = any>(eventName: string, handler: EventHandler<T>): () => void {
    if (!this.handlers.has(eventName)) {
      this.handlers.set(eventName, new Set());
    }
    const set = this.handlers.get(eventName)!;
    set.add(handler);

    return () => {
      set.delete(handler);
    };
  }

  /**
   * Publish a domain event to all registered subscribers.
   */
  static async publish<T = any>(
    eventName: string,
    payload: T,
    metadata?: { userId?: string; branchId?: string }
  ): Promise<void> {
    const event: DomainEvent<T> = {
      id: crypto.randomUUID(),
      name: eventName,
      timestamp: Date.now(),
      payload,
      userId: metadata?.userId,
      branchId: metadata?.branchId,
    };

    const subscribers = this.handlers.get(eventName);
    if (!subscribers || subscribers.size === 0) return;

    for (const handler of Array.from(subscribers)) {
      try {
        await handler(event);
      } catch (err) {
        console.error(`[DomainEvents] Error handling event "${eventName}":`, err);
      }
    }
  }
}
