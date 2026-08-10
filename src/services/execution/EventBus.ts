// ============================================================
// EventBus — In-memory event bus for execution events
// ============================================================

import type { ExecutionEvent, EventHandler, ExecutionEventType } from '@/types/execution-engine';

class EventBus {
  private handlers = new Map<ExecutionEventType | '*', Set<EventHandler>>();

  on(eventType: ExecutionEventType | '*', handler: EventHandler): () => void {
    if (!this.handlers.has(eventType)) {
      this.handlers.set(eventType, new Set());
    }
    this.handlers.get(eventType)!.add(handler);
    return () => this.off(eventType, handler);
  }

  off(eventType: ExecutionEventType | '*', handler: EventHandler): void {
    this.handlers.get(eventType)?.delete(handler);
  }

  emit(event: ExecutionEvent): void {
    const specific = this.handlers.get(event.type);
    const wildcard = this.handlers.get('*');
    specific?.forEach((h) => {
      try { h(event); } catch (e) { console.error('[EventBus] Handler error:', e); }
    });
    wildcard?.forEach((h) => {
      try { h(event); } catch (e) { console.error('[EventBus] Handler error:', e); }
    });
  }

  clear(): void {
    this.handlers.clear();
  }
}

export const eventBus = new EventBus();
