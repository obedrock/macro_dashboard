import { cache, TTL } from './cache';
import { DataResult, PriceItem, TimeSeriesPoint } from '../types';
import { mockMarketData } from '../data/mockData';
import { rateLimiter } from './rateLimiter';
import { RateLimitError, HttpError, ValidationError, toUserMessage, httpStatusToCategory } from './errorMessages';
import { TdBatchResultSchema, TdQuoteSchema, TdTimeSeriesSchema } from './schemas';

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
  if (rateLimiter.isBlocked('twelvedata')) {
    throw new RateLimitError('Rate limit reached — retrying shortly');
  }

  const url = `${REST_BASE}${path}`;
  const separator = path.includes('?') ? '&' : '?';
  const res = await fetch(`${url}${separator}apikey=${API_KEY}`);

  if (res.status === 429) {
    rateLimiter.onRateLimit('twelvedata');
    throw new RateLimitError('Rate limit reached — retrying shortly');
  }

  if (!res.ok) {
    throw new HttpError(res.status, path);
  }

  rateLimiter.onSuccess('twelvedata');
  const json = await res.json();

  if ((json as { status?: string }).status === 'error') {
    throw new HttpError(400, (json as { message?: string }).message ?? 'TwelveData error');
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

type TdBatchQuote = Record<string, unknown>;

async function fetchBatchQuotes(symbols: string[]): Promise<TdBatchQuote> {
  const joined = symbols.join(',');
  const cacheKey = `td:batch:${joined}`;
  const cached = cache.get<TdBatchQuote>(cacheKey);
  if (cached) return cached;

  const encoded = encodeURIComponent(joined);
  const raw = await tdFetch<unknown>(`/quote?symbol=${encoded}&dp=4`);

  const parsed = TdBatchResultSchema.safeParse(raw);
  if (!parsed.success) {
    throw new ValidationError('Unexpected data format');
  }

  cache.set(cacheKey, parsed.data as TdBatchQuote, TTL.TWELVEDATA_REST);
  return parsed.data as TdBatchQuote;
}

async function fetchSingleQuote(symbol: string): Promise<TdQuote | null> {
  const cacheKey = `td:quote:${symbol}`;
  const cached = cache.get<TdQuote>(cacheKey);
  if (cached) return cached;

  try {
    const encoded = encodeURIComponent(symbol);
    const raw = await tdFetch<unknown>(`/quote?symbol=${encoded}&dp=4`);
    const parsed = TdQuoteSchema.safeParse(raw);
    if (parsed.success) {
      cache.set(cacheKey, parsed.data as TdQuote, TTL.TWELVEDATA_REST);
      return parsed.data as TdQuote;
    }
    return null;
  } catch {
    return null;
  }
}

function getQuote(batch: TdBatchQuote, symbol: string): TdQuote | null {
  const entry = batch[symbol];
  const parsed = TdQuoteSchema.safeParse(entry);
  return parsed.success ? parsed.data as TdQuote : null;
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

export async function getTwelveEquities(): Promise<DataResult<PriceItem[]>> {
  try {
    const symbols = ['SPY', 'QQQ', 'DIA', 'IWM'];
    const batch = await fetchBatchQuotes(symbols);
    const fb = mockMarketData.equities;

    const spyQ = getQuote(batch, 'SPY');
    const qqqQ = getQuote(batch, 'QQQ');
    const diaQ = getQuote(batch, 'DIA');
    const iwmQ = getQuote(batch, 'IWM');
    const vixFallback = fb[4];

    const data: PriceItem[] = [
      etfScaled(spyQ, fb[0], 'S&P 500', 10),
      etfScaled(qqqQ, fb[1], 'Nasdaq', 28),
      etfScaled(diaQ, fb[2], 'Dow Jones', 100),
      etfScaled(iwmQ, fb[3], 'Russell 2000', 10),
      vixFallback,
    ];

    return { status: 'ok', data, source: 'live', timestamp: Date.now() };
  } catch (e) {
    let category: ReturnType<typeof httpStatusToCategory> = 'unknown';
    if (e instanceof RateLimitError) category = 'rate_limit';
    else if (e instanceof ValidationError) category = 'validation';
    else if (e instanceof HttpError) category = httpStatusToCategory(e.status);
    return { status: 'error', error: toUserMessage(category), source: 'fallback', timestamp: Date.now() };
  }
}

export async function getTwelveFX(): Promise<DataResult<PriceItem[]>> {
  try {
    const symbols = ['EUR/USD', 'USD/JPY', 'GBP/USD', 'USD/CNY', 'DX-Y.NYB'];
    const batch = await fetchBatchQuotes(symbols);
    const fb = mockMarketData.fx;

    const dxyQ = getQuote(batch, 'DX-Y.NYB');
    const eurusd = getQuote(batch, 'EUR/USD');
    const usdjpy = getQuote(batch, 'USD/JPY');
    const gbpusd = getQuote(batch, 'GBP/USD');
    const usdcny = getQuote(batch, 'USD/CNY');

    const data: PriceItem[] = [
      dxyQ ? toItem(dxyQ, fb[0], 'DXY') : fb[0],
      eurusd ? toItem(eurusd, fb[1], 'EUR/USD') : fb[1],
      usdjpy ? toItem(usdjpy, fb[2], 'USD/JPY') : fb[2],
      gbpusd ? toItem(gbpusd, fb[3], 'GBP/USD') : fb[3],
      usdcny ? toItem(usdcny, fb[4], 'USD/CNY') : fb[4],
    ];

    return { status: 'ok', data, source: 'live', timestamp: Date.now() };
  } catch (e) {
    let category: ReturnType<typeof httpStatusToCategory> = 'unknown';
    if (e instanceof RateLimitError) category = 'rate_limit';
    else if (e instanceof ValidationError) category = 'validation';
    else if (e instanceof HttpError) category = httpStatusToCategory(e.status);
    return { status: 'error', error: toUserMessage(category), source: 'fallback', timestamp: Date.now() };
  }
}

export async function getTwelveCommodities(): Promise<DataResult<PriceItem[]>> {
  try {
    const symbols = ['CL1:COM', 'BZ:COM', 'XAU/USD', 'XAG/USD', 'HG1:COM', 'GAS/USD'];
    const batch = await fetchBatchQuotes(symbols);
    const fb = mockMarketData.commodities;

    const wtiQ = getQuote(batch, 'CL1:COM');
    const brentQ = getQuote(batch, 'BZ:COM');
    const goldQ = getQuote(batch, 'XAU/USD');
    const silverQ = getQuote(batch, 'XAG/USD');
    const copperQ = getQuote(batch, 'HG1:COM');
    const natgasQ = getQuote(batch, 'GAS/USD');

    const wtiItem = wtiQ ? { ...toItem(wtiQ, fb[0], 'WTI Crude'), prefix: '$' } : fb[0];
    const brentItem = brentQ ? { ...toItem(brentQ, fb[1], 'Brent Crude'), prefix: '$' } : fb[1];
    const natgasItem = natgasQ ? { ...toItem(natgasQ, fb[2], 'Natural Gas'), prefix: '$' } : fb[2];
    const goldItem = goldQ ? { ...toItem(goldQ, fb[3], 'Gold'), prefix: '$' } : fb[3];
    const silverItem = silverQ ? { ...toItem(silverQ, fb[4], 'Silver'), prefix: '$' } : fb[4];
    const copperItem = copperQ ? { ...toItem(copperQ, fb[5], 'Copper'), prefix: '$' } : fb[5];

    const data: PriceItem[] = [wtiItem, brentItem, natgasItem, goldItem, silverItem, copperItem];
    return { status: 'ok', data, source: 'live', timestamp: Date.now() };
  } catch (e) {
    let category: ReturnType<typeof httpStatusToCategory> = 'unknown';
    if (e instanceof RateLimitError) category = 'rate_limit';
    else if (e instanceof ValidationError) category = 'validation';
    else if (e instanceof HttpError) category = httpStatusToCategory(e.status);
    return { status: 'error', error: toUserMessage(category), source: 'fallback', timestamp: Date.now() };
  }
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

export async function getTwelveRates(): Promise<DataResult<TwelveRatesResult>> {
  try {
    const symbols = ['US2Y', 'US5Y', 'US10Y', 'US20Y', 'US30Y'];
    const batch = await fetchBatchQuotes(symbols);

    const y2 = getQuote(batch, 'US2Y');
    const y5 = getQuote(batch, 'US5Y');
    const y10 = getQuote(batch, 'US10Y');
    const y20 = getQuote(batch, 'US20Y');
    const y30 = getQuote(batch, 'US30Y');

    const data: TwelveRatesResult = {
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

    return { status: 'ok', data, source: 'live', timestamp: Date.now() };
  } catch (e) {
    let category: ReturnType<typeof httpStatusToCategory> = 'unknown';
    if (e instanceof RateLimitError) category = 'rate_limit';
    else if (e instanceof ValidationError) category = 'validation';
    else if (e instanceof HttpError) category = httpStatusToCategory(e.status);
    return { status: 'error', error: toUserMessage(category), source: 'fallback', timestamp: Date.now() };
  }
}

export async function getTwelveTimeSeries(
  symbol: string,
  interval: string,
  outputsize: number
): Promise<DataResult<TimeSeriesPoint[]>> {
  const cacheKey = `td:ts:${symbol}:${interval}:${outputsize}`;
  const cached = cache.get<TimeSeriesPoint[]>(cacheKey);
  if (cached) {
    return { status: 'ok', data: cached, source: 'cache', timestamp: Date.now() };
  }

  try {
    const encoded = encodeURIComponent(symbol);
    const raw = await tdFetch<unknown>(
      `/time_series?symbol=${encoded}&interval=${interval}&outputsize=${outputsize}&dp=4`
    );

    const parsed = TdTimeSeriesSchema.safeParse(raw);
    if (!parsed.success) {
      throw new ValidationError('Unexpected data format');
    }

    if (!parsed.data.values?.length) {
      throw new ValidationError('No time series data');
    }

    const points: TimeSeriesPoint[] = parsed.data.values
      .map(v => ({ date: v.datetime, value: parseFloat(v.close) }))
      .reverse();

    cache.set(cacheKey, points, TTL.TWELVEDATA_REST);
    return { status: 'ok', data: points, source: 'live', timestamp: Date.now() };
  } catch (e) {
    let category: ReturnType<typeof httpStatusToCategory> = 'unknown';
    if (e instanceof RateLimitError) category = 'rate_limit';
    else if (e instanceof ValidationError) category = 'validation';
    else if (e instanceof HttpError) category = httpStatusToCategory(e.status);
    return { status: 'error', error: toUserMessage(category), source: 'fallback', timestamp: Date.now() };
  }
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

// Unused export kept for module interface compatibility during Plan 02 transition
// Plan 03 (hook migration) will update callers to handle DataResult
export { fetchSingleQuote };
