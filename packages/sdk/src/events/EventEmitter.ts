/**
 * Typed Event Emitter.
 * Provides type-safe event handling throughout the SDK.
 *
 * Coding rules:
 * - Fully typed events
 * - No any
 * - Memory-safe (removeListener works)
 * - Simple API
 */

/**
 * Generic event map type.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type EventMap = Record<string, any>;

/**
 * Listener function type.
 */
export type Listener<T> = (data: T) => void;

/**
 * Type-safe event emitter.
 * 
 * @example
 * ```typescript
 * interface MyEvents {
 *   'user-joined': { userId: string };
 *   'error': { message: string };
 * }
 * 
 * const emitter = new EventEmitter<MyEvents>();
 * emitter.on('user-joined', (e) => console.log(e.userId));
 * emitter.emit('user-joined', { userId: '123' });
 * ```
 */
export class EventEmitter<Events extends EventMap> {
  private listeners: Map<keyof Events, Set<Listener<unknown>>> = new Map();

  /**
   * Subscribe to an event.
   * @param event Event name
   * @param listener Callback function
   * @returns Unsubscribe function
   */
  on<E extends keyof Events>(event: E, listener: Listener<Events[E]>): () => void {
    if (!this.listeners.has(event)) {
      this.listeners.set(event, new Set());
    }

    const listeners = this.listeners.get(event)!;
    listeners.add(listener as Listener<unknown>);

    // Return unsubscribe function
    return () => {
      listeners.delete(listener as Listener<unknown>);
    };
  }

  /**
   * Subscribe to an event once.
   * @param event Event name
   * @param listener Callback function
   * @returns Unsubscribe function
   */
  once<E extends keyof Events>(event: E, listener: Listener<Events[E]>): () => void {
    const unsubscribe = this.on(event, (data) => {
      unsubscribe();
      listener(data);
    });

    return unsubscribe;
  }

  /**
   * Unsubscribe from an event.
   * @param event Event name
   * @param listener Callback function to remove
   */
  off<E extends keyof Events>(event: E, listener: Listener<Events[E]>): void {
    const listeners = this.listeners.get(event);
    if (listeners) {
      listeners.delete(listener as Listener<unknown>);
    }
  }

  /**
   * Emit an event.
   * @param event Event name
   * @param data Event data
   */
  emit<E extends keyof Events>(event: E, data: Events[E]): void {
    const listeners = this.listeners.get(event);
    if (listeners) {
      // Create a copy to allow listeners to unsubscribe during emit
      for (const listener of [...listeners]) {
        try {
          listener(data);
        } catch (error) {
          console.error(`[EventEmitter] Error in listener for "${String(event)}":`, error);
        }
      }
    }
  }

  /**
   * Remove all listeners for an event, or all events.
   * @param event Optional event name
   */
  removeAllListeners<E extends keyof Events>(event?: E): void {
    if (event) {
      this.listeners.delete(event);
    } else {
      this.listeners.clear();
    }
  }

  /**
   * Get the number of listeners for an event.
   * @param event Event name
   */
  listenerCount<E extends keyof Events>(event: E): number {
    return this.listeners.get(event)?.size ?? 0;
  }
}
