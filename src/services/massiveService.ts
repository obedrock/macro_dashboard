import { restClient } from '@massive.com/client-js';
import { cache, TTL } from './cache';
import { PriceItem, YieldCurveData } from '../types';
import { mockMarketData } from '../data/mockData';

const API_KEY = import.meta.env.VITE_MASSIVE_API_KEY as string;

let _client: ReturnType<typeof restClient> | null = null;
function getClient() {
  if (!_client) _client = restClient(API_KEY);
  return _client;
}

const RATE_LIMIT_MS = 1500;
let lastCallTime = 0;

async function rateLimit() {
  const now = Date.now();
  const wait = RATE_LIMIT_MS - (now - lastCallTime);
  if (wait > 0) await new Promise(r => setTimeout(r, wait));
  lastCallTime = Date.now();
}

type PrevAggResult = { T: string; c: number; o: number; h: number; l: number; v: number };
type PrevAggResponse = { results?: PrevAggResult[]; status: string };

async function fetchPrevForex(ticker: string): Promise<PrevAggResult | null> {
  const cacheKey = `massive:forex:${ticker}`;
  const cached = cache.get<PrevAggResult>(cacheKey);
  if (cached) return cached;

  await rateLimit();
  const client = getClient();
  const res = await (client.getPreviousForexAggregates({ forexTicker: ticker }) as Promise<PrevAggResponse>);
  const result = res.results?.[0] ?? null;
  if (result) cache.set(cacheKey, result, TTL.MASSIVE);
  return result;
}

async function fetchTreasuryYields(): Promise<Record<string, number>> {
  const cacheKey = 'massive:treasury';
  const cached = cache.get<Record<string, number>>(cacheKey);
  if (cached) return cached;

  await rateLimit();
  const client = getClient();
  const res = await client.getFedV1TreasuryYields({ limit: 2, sort: 'date.desc' });

  const latest = res.results?.[0] ?? {};
  const yields: Record<string, number> = {
    yield_1_month: latest.yield_1_month ?? 0,
    yield_3_month: latest.yield_3_month ?? 0,
    yield_6_month: latest.yield_6_month ?? 0,
    yield_1_year: latest.yield_1_year ?? 0,
    yield_2_year: latest.yield_2_year ?? 0,
    yield_3_year: latest.yield_3_year ?? 0,
    yield_5_year: latest.yield_5_year ?? 0,
    yield_7_year: latest.yield_7_year ?? 0,
    yield_10_year: latest.yield_10_year ?? 0,
    yield_20_year: latest.yield_20_year ?? 0,
    yield_30_year: latest.yield_30_year ?? 0,
  };

  cache.set(cacheKey, yields, TTL.MASSIVE);
  return yields;
}

function forexToPriceItem(
  bar: PrevAggResult | null,
  fallback: PriceItem,
  label: string,
  decimals = 2
): PriceItem {
  if (!bar?.c) return fallback;
  const value = parseFloat(bar.c.toFixed(decimals));
  const change = parseFloat((bar.c - bar.o).toFixed(decimals));
  const changePct = bar.o !== 0 ? parseFloat(((change / bar.o) * 100).toFixed(2)) : 0;
  return { ...fallback, label, value, change, changePct };
}

export async function getMassiveCommodities(): Promise<PriceItem[]> {
  try {
    const fb = mockMarketData.commodities;
    const xauusd = await fetchPrevForex('C:XAUUSD');
    const xagusd = await fetchPrevForex('C:XAGUSD');

    return [
      fb[0],
      fb[1],
      fb[2],
      xauusd ? forexToPriceItem(xauusd, fb[3], 'Gold', 2) : fb[3],
      xagusd ? forexToPriceItem(xagusd, fb[4], 'Silver', 2) : fb[4],
      fb[5],
    ];
  } catch {
    return mockMarketData.commodities;
  }
}

export async function getMassiveRates(): Promise<PriceItem[]> {
  try {
    const yields = await fetchTreasuryYields();
    const fb = mockMarketData.rates;

    const y2 = yields.yield_2_year || fb[1].value;
    const y5 = yields.yield_5_year || fb[2].value;
    const y10 = yields.yield_10_year || fb[3].value;
    const y30 = yields.yield_30_year || fb[4].value;
    const spread = parseFloat(((y10 - y2) * 100).toFixed(1));

    return [
      fb[0],
      { ...fb[1], value: y2 },
      { ...fb[2], value: y5 },
      { ...fb[3], value: y10 },
      { ...fb[4], value: y30 },
      fb[5],
      { ...fb[6], value: spread },
    ];
  } catch {
    return mockMarketData.rates;
  }
}

export async function getMassiveYieldCurve(): Promise<YieldCurveData[]> {
  try {
    const yields = await fetchTreasuryYields();
    const fb = mockMarketData.yieldCurve;

    const mapping: Record<string, keyof typeof yields> = {
      '1M': 'yield_1_month',
      '3M': 'yield_3_month',
      '6M': 'yield_6_month',
      '1Y': 'yield_1_year',
      '2Y': 'yield_2_year',
      '3Y': 'yield_3_year',
      '5Y': 'yield_5_year',
      '7Y': 'yield_7_year',
      '10Y': 'yield_10_year',
      '20Y': 'yield_20_year',
      '30Y': 'yield_30_year',
    };

    return fb.map(point => {
      const key = mapping[point.maturity];
      const live = key && yields[key] ? yields[key] : point.current;
      return { ...point, current: live };
    });
  } catch {
    return mockMarketData.yieldCurve;
  }
}

export async function getMassiveRibbonRates(): Promise<number | null> {
  try {
    const yields = await fetchTreasuryYields();
    return yields.yield_10_year || null;
  } catch {
    return null;
  }
}
