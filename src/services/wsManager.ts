import type { WsStatus } from '../types';

const API_KEY = import.meta.env.VITE_TWELVEDATA_API_KEY as string;
const WS_URL = `wss://ws.twelvedata.com/v1/quotes/price?apikey=${API_KEY}`;
const WS_SYMBOLS = ['SPY', 'QQQ', 'DIA', 'IWM', 'CL1:COM', 'XAU/USD', 'XAG/USD', 'HG1:COM'];
const INITIAL_DELAY_MS = 1_000;
const MAX_DELAY_MS = 30_000;
const JITTER_MS = 1_000;
const MAX_ATTEMPTS = 10;
const HEARTBEAT_INTERVAL_MS = 10_000;
const PONG_TIMEOUT_MS = 5_000;

export type RibbonTickUpdate = { symbol: string; price: number; timestamp: number };
export type WsCallback = (update: RibbonTickUpdate) => void;
export type StatusCallback = (status: WsStatus) => void;

export class WebSocketManager {
  private ws: WebSocket | null = null;
  // Per D-08: 'connecting' is the initial state. subscribe() calls connect() implicitly,
  // so consumers always see 'connecting' with a connection attempt in flight.
  private status: WsStatus = 'connecting';
  private attempt = 0;
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  private heartbeatTimer: ReturnType<typeof setInterval> | null = null;
  private pongTimer: ReturnType<typeof setTimeout> | null = null;
  private lastPrices: Record<string, number> = {};
  private prevPrices: Record<string, number> = {};
  private tickCallbacks: Set<WsCallback> = new Set();
  private statusCallbacks: Set<StatusCallback> = new Set();

  connect(): void {
    if (
      this.ws?.readyState === WebSocket.CONNECTING ||
      this.ws?.readyState === WebSocket.OPEN
    ) {
      return;
    }

    this.setStatus('connecting');
    this.ws = new WebSocket(WS_URL);

    this.ws.onopen = () => {
      if (this.reconnectTimer) {
        clearTimeout(this.reconnectTimer);
        this.reconnectTimer = null;
      }
      this.attempt = 0;
      this.setStatus('connected');
      this.ws!.send(
        JSON.stringify({ action: 'subscribe', params: { symbols: WS_SYMBOLS.join(',') } }),
      );
      this.startHeartbeat();
    };

    this.ws.onmessage = (evt: MessageEvent) => {
      this.clearPongTimer();
      try {
        const msg = JSON.parse(evt.data as string);
        if (msg.event === 'price' && msg.symbol && msg.price != null) {
          const sym = msg.symbol as string;
          const price = parseFloat(msg.price);
          if (!isNaN(price)) {
            this.prevPrices[sym] = this.lastPrices[sym] ?? price;
            this.lastPrices[sym] = price;
            const update: RibbonTickUpdate = { symbol: sym, price, timestamp: Date.now() };
            this.tickCallbacks.forEach(cb => cb(update));
          }
        }
      } catch {}
    };

    this.ws.onclose = () => {
      this.stopHeartbeat();
      if (this.tickCallbacks.size === 0) return;
      if (this.attempt >= MAX_ATTEMPTS) {
        this.setStatus('failed');
        return;
      }
      this.setStatus('reconnecting');
      this.attempt += 1;
      this.reconnectTimer = setTimeout(() => this.connect(), this.nextDelay());
    };

    this.ws.onerror = () => {
      this.ws?.close();
    };
  }

  subscribe(cb: WsCallback): () => void {
    this.tickCallbacks.add(cb);
    this.connect();
    return () => {
      this.tickCallbacks.delete(cb);
      if (this.tickCallbacks.size === 0) {
        this.disconnect();
      }
    };
  }

  onStatusChange(cb: StatusCallback): () => void {
    this.statusCallbacks.add(cb);
    cb(this.status);
    return () => {
      this.statusCallbacks.delete(cb);
    };
  }

  getPrice(symbol: string): number | undefined {
    return this.lastPrices[symbol];
  }

  getPrevPrice(symbol: string): number | undefined {
    return this.prevPrices[symbol];
  }

  reconnect(): void {
    this.attempt = 0;
    this.ws = null;
    this.connect();
  }

  disconnect(): void {
    this.stopHeartbeat();
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }
  }

  private nextDelay(): number {
    const base = Math.min(INITIAL_DELAY_MS * Math.pow(2, this.attempt - 1), MAX_DELAY_MS);
    const jitter = Math.random() * JITTER_MS;
    return base + jitter;
  }

  private setStatus(newStatus: WsStatus): void {
    this.status = newStatus;
    this.statusCallbacks.forEach(cb => cb(newStatus));
  }

  private startHeartbeat(): void {
    this.stopHeartbeat();
    this.heartbeatTimer = setInterval(() => {
      if (this.ws?.readyState === WebSocket.OPEN) {
        this.ws.send(JSON.stringify({ event: 'heartbeat' }));
        this.pongTimer = setTimeout(() => this.handleSilentDrop(), PONG_TIMEOUT_MS);
      }
    }, HEARTBEAT_INTERVAL_MS);
  }

  private stopHeartbeat(): void {
    if (this.heartbeatTimer) {
      clearInterval(this.heartbeatTimer);
      this.heartbeatTimer = null;
    }
    this.clearPongTimer();
  }

  private clearPongTimer(): void {
    if (this.pongTimer) {
      clearTimeout(this.pongTimer);
      this.pongTimer = null;
    }
  }

  private handleSilentDrop(): void {
    this.ws?.close();
  }
}

export const wsManager = new WebSocketManager();
