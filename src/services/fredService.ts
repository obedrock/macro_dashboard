import { cache, TTL } from './cache';
import { TimeSeriesPoint, YieldCurveData, PriceItem } from '../types';
import { mockMarketData } from '../data/mockData';

const FRED_BASE = 'https://api.stlouisfed.org/fred';
const API_KEY = import.meta.env.VITE_FRED_API_KEY as string;

type FredObservation = {
  date: string;
  value: string;
};

type FredResponse = {
  observations: FredObservation[];
};

async function fetchSeries(
  seriesId: string,
  limit = 365
): Promise<TimeSeriesPoint[]> {
  const cacheKey = `fred:${seriesId}:${limit}`;
  const cached = cache.get<TimeSeriesPoint[]>(cacheKey);
  if (cached) return cached;

  const url = new URL(`${FRED_BASE}/series/observations`);
  url.searchParams.set('series_id', seriesId);
  url.searchParams.set('api_key', API_KEY);
  url.searchParams.set('file_type', 'json');
  url.searchParams.set('sort_order', 'desc');
  url.searchParams.set('limit', String(limit));

  const res = await fetch(url.toString());
  if (!res.ok) throw new Error(`FRED ${res.status}: ${seriesId}`);

  const json: FredResponse = await res.json();
  const points: TimeSeriesPoint[] = json.observations
    .filter(o => o.value !== '.')
    .map(o => ({ date: o.date, value: parseFloat(o.value) }))
    .reverse();

  cache.set(cacheKey, points, TTL.FRED);
  return points;
}

async function fetchLatestValue(seriesId: string): Promise<number | null> {
  try {
    const series = await fetchSeries(seriesId, 10);
    return series.length > 0 ? series[series.length - 1].value : null;
  } catch {
    return null;
  }
}

export type CreditItem = {
  label: string;
  value: number;
  change: number;
  series: TimeSeriesPoint[];
};

export async function getLiveCreditSpreads(): Promise<CreditItem[]> {
  const HY_SERIES = 'BAMLH0A0HYM2';
  const IG_SERIES = 'BAMLC0A0CM';

  try {
    const [hySeries, igSeries] = await Promise.all([
      fetchSeries(HY_SERIES, 365),
      fetchSeries(IG_SERIES, 365),
    ]);

    const hyLast = hySeries[hySeries.length - 1]?.value ?? mockMarketData.credit[0].value;
    const hyPrev = hySeries[hySeries.length - 2]?.value ?? hyLast;
    const igLast = igSeries[igSeries.length - 1]?.value ?? mockMarketData.credit[1].value;
    const igPrev = igSeries[igSeries.length - 2]?.value ?? igLast;

    const diffSeries: TimeSeriesPoint[] = hySeries.map((p, i) => ({
      date: p.date,
      value: parseFloat((p.value - (igSeries[i]?.value ?? p.value)).toFixed(1)),
    }));

    return [
      { label: 'HY OAS Spread', value: hyLast, change: parseFloat((hyLast - hyPrev).toFixed(1)), series: hySeries },
      { label: 'IG OAS Spread', value: igLast, change: parseFloat((igLast - igPrev).toFixed(1)), series: igSeries },
      {
        label: 'HY-IG Differential',
        value: parseFloat((hyLast - igLast).toFixed(1)),
        change: parseFloat((hyLast - hyPrev - (igLast - igPrev)).toFixed(1)),
        series: diffSeries,
      },
    ];
  } catch {
    return mockMarketData.credit;
  }
}

export type InflationItem = {
  label: string;
  value: number;
  series: TimeSeriesPoint[];
};

export async function getLiveInflation(): Promise<InflationItem[]> {
  async function getYoYSeries(seriesId: string): Promise<{ value: number; series: TimeSeriesPoint[] }> {
    const raw = await fetchSeries(seriesId, 36);
    if (raw.length < 13) throw new Error('Insufficient data');

    const yoy: TimeSeriesPoint[] = raw.slice(12).map((p, i) => {
      const yearAgo = raw[i];
      const pct = yearAgo.value !== 0
        ? parseFloat(((p.value - yearAgo.value) / yearAgo.value * 100).toFixed(1))
        : 0;
      return { date: p.date, value: pct };
    });

    return { value: yoy[yoy.length - 1]?.value ?? 0, series: yoy };
  }

  try {
    const [cpi, coreCpi, pce, corePce] = await Promise.allSettled([
      getYoYSeries('CPIAUCSL'),
      getYoYSeries('CPILFESL'),
      getYoYSeries('PCEPI'),
      getYoYSeries('PCEPILFE'),
    ]);

    const fb = mockMarketData.inflation;
    return [
      { label: 'CPI YoY', value: cpi.status === 'fulfilled' ? cpi.value.value : fb[0].value, series: cpi.status === 'fulfilled' ? cpi.value.series : fb[0].series },
      { label: 'Core CPI', value: coreCpi.status === 'fulfilled' ? coreCpi.value.value : fb[1].value, series: coreCpi.status === 'fulfilled' ? coreCpi.value.series : fb[1].series },
      { label: 'PCE YoY', value: pce.status === 'fulfilled' ? pce.value.value : fb[2].value, series: pce.status === 'fulfilled' ? pce.value.series : fb[2].series },
      { label: 'Core PCE', value: corePce.status === 'fulfilled' ? corePce.value.value : fb[3].value, series: corePce.status === 'fulfilled' ? corePce.value.series : fb[3].series },
    ];
  } catch {
    return mockMarketData.inflation;
  }
}

export interface FredMarketSnapshot {
  vix: number | null;
  dgs10: number | null;
  dgs5: number | null;
  dgs30: number | null;
  dgs2: number | null;
  wti: number | null;
  brent: number | null;
  natgas: number | null;
  fedFundsUpper: number | null;
}

export async function getFredMarketSnapshot(): Promise<FredMarketSnapshot> {
  const cacheKey = 'fred:market:snapshot';
  const cached = cache.get<FredMarketSnapshot>(cacheKey);
  if (cached) return cached;

  const [vix, dgs10, dgs5, dgs30, dgs2, wti, brent, natgas, fedFunds] = await Promise.allSettled([
    fetchLatestValue('VIXCLS'),
    fetchLatestValue('DGS10'),
    fetchLatestValue('DGS5'),
    fetchLatestValue('DGS30'),
    fetchLatestValue('DGS2'),
    fetchLatestValue('DCOILWTICO'),
    fetchLatestValue('DCOILBRENTEU'),
    fetchLatestValue('DHHNGSP'),
    fetchLatestValue('DFEDTARU'),
  ]);

  const snapshot: FredMarketSnapshot = {
    vix: vix.status === 'fulfilled' ? vix.value : null,
    dgs10: dgs10.status === 'fulfilled' ? dgs10.value : null,
    dgs5: dgs5.status === 'fulfilled' ? dgs5.value : null,
    dgs30: dgs30.status === 'fulfilled' ? dgs30.value : null,
    dgs2: dgs2.status === 'fulfilled' ? dgs2.value : null,
    wti: wti.status === 'fulfilled' ? wti.value : null,
    brent: brent.status === 'fulfilled' ? brent.value : null,
    natgas: natgas.status === 'fulfilled' ? natgas.value : null,
    fedFundsUpper: fedFunds.status === 'fulfilled' ? fedFunds.value : null,
  };

  cache.set(cacheKey, snapshot, TTL.FRED);
  return snapshot;
}

export function applyFredSnapshot(
  snapshot: FredMarketSnapshot,
  currentData: {
    ribbon: PriceItem[];
    rates: PriceItem[];
    equities: PriceItem[];
    commodities: PriceItem[];
  }
): {
  ribbon: PriceItem[];
  rates: PriceItem[];
  equities: PriceItem[];
  commodities: PriceItem[];
} {
  const ribbon = [...currentData.ribbon];
  const rates = [...currentData.rates];
  const equities = [...currentData.equities];
  const commodities = [...currentData.commodities];

  if (snapshot.dgs10 != null) {
    ribbon[1] = { ...ribbon[1], value: snapshot.dgs10 };
    rates[3] = { ...rates[3], value: snapshot.dgs10 };
  }
  if (snapshot.vix != null) {
    ribbon[5] = { ...ribbon[5], value: snapshot.vix };
    equities[4] = { ...equities[4], value: snapshot.vix };
  }
  if (snapshot.wti != null) {
    ribbon[3] = { ...ribbon[3], value: snapshot.wti };
    commodities[0] = { ...commodities[0], value: snapshot.wti };
  }
  if (snapshot.brent != null) {
    commodities[1] = { ...commodities[1], value: snapshot.brent };
  }
  if (snapshot.natgas != null) {
    commodities[2] = { ...commodities[2], value: snapshot.natgas };
  }
  if (snapshot.dgs5 != null) {
    rates[2] = { ...rates[2], value: snapshot.dgs5 };
  }
  if (snapshot.dgs2 != null) {
    rates[1] = { ...rates[1], value: snapshot.dgs2 };
    rates[6] = {
      ...rates[6],
      value: snapshot.dgs10 != null
        ? parseFloat(((snapshot.dgs10 - snapshot.dgs2) * 100).toFixed(1))
        : rates[6].value,
    };
  }
  if (snapshot.dgs30 != null) {
    rates[4] = { ...rates[4], value: snapshot.dgs30 };
  }
  if (snapshot.fedFundsUpper != null) {
    const lo = parseFloat((snapshot.fedFundsUpper - 0.25).toFixed(2));
    const hi = snapshot.fedFundsUpper;
    rates[0] = {
      ...rates[0],
      value: parseFloat(((lo + hi) / 2).toFixed(3)),
    };
  }

  return { ribbon, rates, equities, commodities };
}

const YIELD_CURVE_FRED_SERIES: { maturity: string; seriesId: string }[] = [
  { maturity: '1M', seriesId: 'DGS1MO' },
  { maturity: '3M', seriesId: 'DGS3MO' },
  { maturity: '6M', seriesId: 'DGS6MO' },
  { maturity: '1Y', seriesId: 'DGS1' },
  { maturity: '2Y', seriesId: 'DGS2' },
  { maturity: '3Y', seriesId: 'DGS3' },
  { maturity: '5Y', seriesId: 'DGS5' },
  { maturity: '7Y', seriesId: 'DGS7' },
  { maturity: '10Y', seriesId: 'DGS10' },
  { maturity: '20Y', seriesId: 'DGS20' },
  { maturity: '30Y', seriesId: 'DGS30' },
];

function isoDateOffset(days: number): string {
  const d = new Date();
  d.setDate(d.getDate() + days);
  return d.toISOString().split('T')[0];
}

async function fetchYieldOnDate(seriesId: string, targetDate: string): Promise<number | null> {
  const cacheKey = `fred:yield:${seriesId}:${targetDate}`;
  const cached = cache.get<number>(cacheKey);
  if (cached !== null && cached !== undefined) return cached;

  const target = new Date(targetDate);
  const startDate = new Date(target);
  startDate.setDate(startDate.getDate() - 10);

  const url = new URL(`${FRED_BASE}/series/observations`);
  url.searchParams.set('series_id', seriesId);
  url.searchParams.set('api_key', API_KEY);
  url.searchParams.set('file_type', 'json');
  url.searchParams.set('sort_order', 'desc');
  url.searchParams.set('observation_start', startDate.toISOString().split('T')[0]);
  url.searchParams.set('observation_end', targetDate);
  url.searchParams.set('limit', '5');

  const res = await fetch(url.toString());
  if (!res.ok) return null;

  const json: FredResponse = await res.json();
  const valid = json.observations.filter(o => o.value !== '.').reverse();
  if (valid.length === 0) return null;

  const value = parseFloat(valid[0].value);
  cache.set(cacheKey, value, TTL.FRED);
  return value;
}

export async function getFredYieldCurve(): Promise<YieldCurveData[] | null> {
  try {
    const results = await Promise.allSettled(
      YIELD_CURVE_FRED_SERIES.map(({ maturity, seriesId }) =>
        fetchLatestValue(seriesId).then(v => ({ maturity, value: v }))
      )
    );

    const points: YieldCurveData[] = YIELD_CURVE_FRED_SERIES.map(({ maturity }, i) => {
      const r = results[i];
      const current = r.status === 'fulfilled' && r.value.value != null ? r.value.value : null;
      const fb = mockMarketData.yieldCurve.find(p => p.maturity === maturity) ?? mockMarketData.yieldCurve[0];
      return {
        maturity,
        current: current ?? fb.current,
        oneMonthAgo: fb.oneMonthAgo,
        oneYearAgo: fb.oneYearAgo,
      };
    });
    return points;
  } catch {
    return null;
  }
}

export async function getFredYieldCurveOverlays(
  currentCurve: YieldCurveData[]
): Promise<YieldCurveData[]> {
  try {
    const oneMonthAgoDate = isoDateOffset(-30);
    const oneYearAgoDate = isoDateOffset(-365);

    const results = await Promise.allSettled(
      YIELD_CURVE_FRED_SERIES.map(async ({ maturity, seriesId }) => {
        const [oneMonthAgo, oneYearAgo] = await Promise.all([
          fetchYieldOnDate(seriesId, oneMonthAgoDate),
          fetchYieldOnDate(seriesId, oneYearAgoDate),
        ]);
        return { maturity, oneMonthAgo, oneYearAgo };
      })
    );

    const overlayMap = new Map<string, { oneMonthAgo: number | null; oneYearAgo: number | null }>();
    for (const r of results) {
      if (r.status === 'fulfilled') {
        overlayMap.set(r.value.maturity, { oneMonthAgo: r.value.oneMonthAgo, oneYearAgo: r.value.oneYearAgo });
      }
    }

    return currentCurve.map(point => {
      const overlay = overlayMap.get(point.maturity);
      return {
        ...point,
        oneMonthAgo: overlay?.oneMonthAgo ?? point.oneMonthAgo,
        oneYearAgo: overlay?.oneYearAgo ?? point.oneYearAgo,
      };
    });
  } catch {
    return currentCurve;
  }
}
