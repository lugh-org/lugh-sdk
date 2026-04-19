import type { LughAuthEvent, LughAuthEventPayload } from "./types.js";

type AnyListener = (payload: unknown) => void;

export class EventBus {
  private listeners: Map<LughAuthEvent, Set<AnyListener>> = new Map();

  on<E extends LughAuthEvent>(
    event: E,
    handler: (payload: LughAuthEventPayload[E]) => void,
  ): () => void {
    let set = this.listeners.get(event);
    if (!set) {
      set = new Set();
      this.listeners.set(event, set);
    }
    const wrapped = handler as AnyListener;
    set.add(wrapped);
    return () => {
      set!.delete(wrapped);
    };
  }

  emit<E extends LughAuthEvent>(
    event: E,
    payload: LughAuthEventPayload[E],
  ): void {
    const set = this.listeners.get(event);
    if (!set) return;
    for (const handler of set) {
      try {
        handler(payload);
      } catch {
        // Listener errors are swallowed to protect the emitter.
      }
    }
  }
}
