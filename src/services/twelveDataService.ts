import { cache, TTL } from './cache';
import { PriceItem, TimeSeriesPoint } from '../types';
import { mockMarketData } from '../data/mockData';

const API_KEY = import.meta.env.VITE_TWELVEDATA_API_KEY as string;
const REST_BASE = 'https://api.twelvedata.com';
const WS_URL = `wss://ws.twelvedata.com/v1/quotes/price?apikey=${API_KEY}`;

export type RibbonTickUpdate = {
  symbol: string;
  price: number;
  timestamp: number;
};

export type WsCallback = (update: RibbonTickUpdate) => void;

const WS_SYMBOLS = ['SPY', 'QQQ', 'DIA', 'IWM', 'CL1:COM', 'XAU/USD', 'XAG/USD', 'HG1:COM'];

let ws: WebSocket | null = null;
const wsCallbacks: Set<WsCallback> = new Set();
let wsReconnectTimer: ReturnType<typeof setTimeout> | null = null;
let wsConnected = false;
export const lastPrices: Record<string, number> = {};
export const prevPrices: Record<string, number> = {};

function connectWebSocket() {
  if (ws && (ws.readyState === WebSocket.CONNECTING || ws.readyState === WebSocket.OPEN)) return;

  ws = new WebSocket(WS_URL);

  ws.onopen = () => {
    wsConnected = true;
    ws!.send(JSON.stringify({ action: 'subscribe', params: { symbols: WS_SYMBOLS.join(',') } }));
  };

  ws.onmessage = (evt) => {
    try {
      const msg = JSON.parse(evt.data as string);
      if (msg.event === 'price' && msg.symbol && msg.price != null) {
        const sym = msg.symbol as string;
        const price = parseFloat(msg.price);
        if (!isNaN(price)) {
          prevPrices[sym] = lastPrices[sym] ?? price;
          lastPrices[sym] = price;
          const update: RibbonTickUpdate = { symbol: sym, price, timestamp: Date.now() };
          wsCallbacks.forEach(cb => cb(update));
        }
      }
    } catch {}
  };

  ws.onclose = () => {
    wsConnected = false;
    if (wsReconnectTimer) clearTimeout(wsReconnectTimer);
    wsReconnectTimer = setTimeout(connectWebSocket, 5000);
  };

  ws.onerror = () => {
    ws?.close();
  };
}

export function subscribeWebSocket(cb: WsCallback): () => void {
  wsCallbacks.add(cb);
  connectWebSocket();
  return () => {
    wsCallbacks.delete(cb);
    if (wsCallbacks.size === 0 && ws) {
      ws.close();
      ws = null;
      wsConnected = false;
    }
  };
}

export function isWsConnected(): boolean {
  return wsConnected;
}

async function tdFetch<T>(path: string): Promise<T> {
  const url = `${REST_BASE}${path}`;
  const separator = path.includes('?') ? '&' : '?';
  const res = await fetch(`${url}${separator}apikey=${API_KEY}`);
  if (!res.ok) throw new Error(`TwelveData ${res.status}: ${path}`);
  const json = await res.json();
  if ((json as { status?: string }).status === 'error') {
    throw new Error(`TwelveData: ${(json as { message?: string }).message}`);
  }
  return json as T;
}

type TdQuote = {
  symbol: string;
  name?: string;
  close: string;
  change: string;
  percent_change: string;
  open?: string;
  high?: string;
  low?: string;
};

type TdBatchResult = TdQuote | { status: string; message: string };
type TdBatchQuote = Record<string, TdBatchResult>;

function isTdQuote(v: unknown): v is TdQuote {
  return typeof v === 'object' && v !== null && 'close' in v && 'percent_change' in v;
}

async function fetchBatchQuotes(symbols: string[]): Promise<TdBatchQuote> {
  const joined = symbols.join(',');
  const cacheKey = `td:batch:${joined}`;
  const cached = cache.get<TdBatchQuote>(cacheKey);
  if (cached) return cached;

  const encoded = encodeURIComponent(joined);
  const data = await tdFetch<TdBatchQuote>(`/quote?symbol=${encoded}&dp=4`);
  cache.set(cacheKey, data, TTL.TWELVEDATA_REST);
  return data;
}

async function fetchSingleQuote(symbol: string): Promise<TdQuote | null> {
  const cacheKey = `td:quote:${symbol}`;
  const cached = cache.get<TdQuote>(cacheKey);
  if (cached) return cached;

  try {
    const encoded = encodeURIComponent(symbol);
    const data = await tdFetch<TdQuote>(`/quote?symbol=${encoded}&dp=4`);
    if (isTdQuote(data)) {
      cache.set(cacheKey, data, TTL.TWELVEDATA_REST);
      return data;
    }
    return null;
  } catch {
    return null;
  }
}

function toItem(q: TdQuote, fallback: PriceItem, label: string): PriceItem {
  const value = parseFloat(q.close);
  const change = parseFloat(q.change);
  const changePct = parseFloat(q.percent_change);
  if (isNaN(value)) return fallback;
  return { ...fallback, label, value, change, changePct };
}

function etfScaled(q: TdQuote | null, fb: PriceItem, label: string, mult: number): PriceItem {
  if (!q) return fb;
  return {
    ...fb, label,
    value: parseFloat((parseFloat(q.close) * mult).toFixed(2)),
    change: parseFloat((parseFloat(q.change) * mult).toFixed(2)),
    changePct: parseFloat(q.percent_change),
  };
}

function wsToItem(sym: string, fallback: PriceItem, label: string, valueMultiplier = 1): PriceItem {
  const wsPrice = lastPrices[sym];
  const prev = prevPrices[sym];
  if (wsPrice == null) return fallback;
  const value = parseFloat((wsPrice * valueMultiplier).toFixed(2));
  const change = prev ? parseFloat(((wsPrice - prev) * valueMultiplier).toFixed(3)) : 0;
  const changePct = prev ? parseFloat(((wsPrice - prev) / prev * 100).toFixed(2)) : 0;
  return { ...fallback, label, value, change, changePct };
}

export async function getTwelveEquities(): Promise<PriceItem[]> {
  const symbols = ['SPY', 'QQQ', 'DIA', 'IWM'];
  const batch = await fetchBatchQuotes(symbols);
  const fb = mockMarketData.equities;

  const spyQ = isTdQuote(batch['SPY']) ? batch['SPY'] : null;
  const qqqQ = isTdQuote(batch['QQQ']) ? batch['QQQ'] : null;
  const diaQ = isTdQuote(batch['DIA']) ? batch['DIA'] : null;
  const iwmQ = isTdQuote(batch['IWM']) ? batch['IWM'] : null;
  const vixFallback = fb[4];

  return [
    etfScaled(spyQ, fb[0], 'S&P 500', 10),
    etfScaled(qqqQ, fb[1], 'Nasdaq', 28),
    etfScaled(diaQ, fb[2], 'Dow Jones', 100),
    etfScaled(iwmQ, fb[3], 'Russell 2000', 10),
    vixFallback,
  ];
}

export async function getTwelveFX(): Promise<PriceItem[]> {
  const symbols = ['EUR/USD', 'USD/JPY', 'GBP/USD', 'USD/CNY', 'DX-Y.NYB'];
  const batch = await fetchBatchQuotes(symbols);
  const fb = mockMarketData.fx;

  const dxyQ = isTdQuote(batch['DX-Y.NYB']) ? batch['DX-Y.NYB'] : null;
  const eurusd = isTdQuote(batch['EUR/USD']) ? batch['EUR/USD'] : null;
  const usdjpy = isTdQuote(batch['USD/JPY']) ? batch['USD/JPY'] : null;
  const gbpusd = isTdQuote(batch['GBP/USD']) ? batch['GBP/USD'] : null;
  const usdcny = isTdQuote(batch['USD/CNY']) ? batch['USD/CNY'] : null;

  return [
    dxyQ ? toItem(dxyQ, fb[0], 'DXY') : fb[0],
    eurusd ? toItem(eurusd, fb[1], 'EUR/USD') : fb[1],
    usdjpy ? toItem(usdjpy, fb[2], 'USD/JPY') : fb[2],
    gbpusd ? toItem(gbpusd, fb[3], 'GBP/USD') : fb[3],
    usdcny ? toItem(usdcny, fb[4], 'USD/CNY') : fb[4],
  ];
}

export async function getTwelveCommodities(): Promise<PriceItem[]> {
  const symbols = ['CL1:COM', 'BZ:COM', 'XAU/USD', 'XAG/USD', 'HG1:COM', 'GAS/USD'];
  const batch = await fetchBatchQuotes(symbols);
  const fb = mockMarketData.commodities;

  const wtiQ = isTdQuote(batch['CL1:COM']) ? batch['CL1:COM'] : null;
  const brentQ = isTdQuote(batch['BZ:COM']) ? batch['BZ:COM'] : null;
  const goldQ = isTdQuote(batch['XAU/USD']) ? batch['XAU/USD'] : null;
  const silverQ = isTdQuote(batch['XAG/USD']) ? batch['XAG/USD'] : null;
  const copperQ = isTdQuote(batch['HG1:COM']) ? batch['HG1:COM'] : null;
  const natgasQ = isTdQuote(batch['GAS/USD']) ? batch['GAS/USD'] : null;

  const wtiItem = wtiQ ? { ...toItem(wtiQ, fb[0], 'WTI Crude'), prefix: '$' } : fb[0];
  const brentItem = brentQ ? { ...toItem(brentQ, fb[1], 'Brent Crude'), prefix: '$' } : fb[1];
  const natgasItem = natgasQ ? { ...toItem(natgasQ, fb[2], 'Natural Gas'), prefix: '$' } : fb[2];
  const goldItem = goldQ ? { ...toItem(goldQ, fb[3], 'Gold'), prefix: '$' } : fb[3];
  const silverItem = silverQ ? { ...toItem(silverQ, fb[4], 'Silver'), prefix: '$' } : fb[4];
  const copperItem = copperQ ? { ...toItem(copperQ, fb[5], 'Copper'), prefix: '$' } : fb[5];

  return [wtiItem, brentItem, natgasItem, goldItem, silverItem, copperItem];
}

export type TwelveRatesResult = {
  y2Val: number | null;
  y2Change: number | null;
  y2Pct: number | null;
  y5Val: number | null;
  y10Val: number | null;
  y10Change: number | null;
  y10Pct: number | null;
  y20Val: number | null;
  y30Val: number | null;
};

export async function getTwelveRates(): Promise<TwelveRatesResult> {
  const symbols = ['US2Y', 'US5Y', 'US10Y', 'US20Y', 'US30Y'];
  const batch = await fetchBatchQuotes(symbols);

  const y2 = isTdQuote(batch['US2Y']) ? batch['US2Y'] : null;
  const y5 = isTdQuote(batch['US5Y']) ? batch['US5Y'] : null;
  const y10 = isTdQuote(batch['US10Y']) ? batch['US10Y'] : null;
  const y20 = isTdQuote(batch['US20Y']) ? batch['US20Y'] : null;
  const y30 = isTdQuote(batch['US30Y']) ? batch['US30Y'] : null;

  return {
    y2Val: y2 ? parseFloat(parseFloat(y2.close).toFixed(3)) : null,
    y2Change: y2 ? parseFloat(y2.change) : null,
    y2Pct: y2 ? parseFloat(y2.percent_change) : null,
    y5Val: y5 ? parseFloat(parseFloat(y5.close).toFixed(3)) : null,
    y10Val: y10 ? parseFloat(parseFloat(y10.close).toFixed(3)) : null,
    y10Change: y10 ? parseFloat(y10.change) : null,
    y10Pct: y10 ? parseFloat(y10.percent_change) : null,
    y20Val: y20 ? parseFloat(parseFloat(y20.close).toFixed(3)) : null,
    y30Val: y30 ? parseFloat(parseFloat(y30.close).toFixed(3)) : null,
  };
}

type TdTimeSeries = {
  values: { datetime: string; close: string }[];
};

export async function getTwelveTimeSeries(
  symbol: string,
  interval: string,
  outputsize: number
): Promise<TimeSeriesPoint[]> {
  const cacheKey = `td:ts:${symbol}:${interval}:${outputsize}`;
  const cached = cache.get<TimeSeriesPoint[]>(cacheKey);
  if (cached) return cached;

  const encoded = encodeURIComponent(symbol);
  const data = await tdFetch<TdTimeSeries>(
    `/time_series?symbol=${encoded}&interval=${interval}&outputsize=${outputsize}&dp=4`
  );

  if (!data.values?.length) throw new Error('No time series data');

  const points: TimeSeriesPoint[] = data.values
    .map(v => ({ date: v.datetime, value: parseFloat(v.close) }))
    .reverse();

  cache.set(cacheKey, points, TTL.TWELVEDATA_REST);
  return points;
}

export function buildRibbonFromWs(fallback: PriceItem[]): PriceItem[] {
  const spyWs = lastPrices['SPY'];
  const prevSpy = prevPrices['SPY'];
  const wtiWs = lastPrices['CL1:COM'];
  const goldWs = lastPrices['XAU/USD'];

  return [
    spyWs != null
      ? {
          ...fallback[0],
          label: 'S&P 500',
          value: parseFloat((spyWs * 10).toFixed(2)),
          change: prevSpy ? parseFloat(((spyWs - prevSpy) * 10).toFixed(2)) : 0,
          changePct: prevSpy ? parseFloat(((spyWs - prevSpy) / prevSpy * 100).toFixed(2)) : 0,
        }
      : fallback[0],
    fallback[1],
    fallback[2],
    wtiWs != null ? wsToItem('CL1:COM', fallback[3], 'WTI Crude') : fallback[3],
    goldWs != null ? wsToItem('XAU/USD', fallback[4], 'Gold') : fallback[4],
    fallback[5],
  ];
}
