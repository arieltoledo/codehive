import { EventEmitter } from "node:events";
import type { DomainEvent } from "./types.js";

export class EventBus extends EventEmitter {
  emit<T extends DomainEvent["type"]>(
    type: T,
    payload: Extract<DomainEvent, { type: T }>["payload"]
  ): boolean {
    return super.emit(type, payload);
  }

  on<T extends DomainEvent["type"]>(
    type: T,
    handler: (payload: Extract<DomainEvent, { type: T }>["payload"]) => void
  ): this {
    return super.on(type, handler);
  }
}
