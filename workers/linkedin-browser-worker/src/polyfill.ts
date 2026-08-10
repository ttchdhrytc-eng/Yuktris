import { WebSocket as WS } from 'ws';

if (typeof globalThis.WebSocket === 'undefined') {
  (globalThis as unknown as { WebSocket: typeof WS }).WebSocket = WS;
}
