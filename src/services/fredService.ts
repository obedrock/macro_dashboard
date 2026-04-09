import { cache, TTL } from './cache';
import { TimeSeriesPoint, YieldCurveData } from '../types';
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

async function fetchSeries(seriesId: string, limit = 365): Promise<TimeSeriesPoint[]> {
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

export async function getFredFedFundsRate(): Promise<number | null> {
  return fetchLatestValue('DFEDTARU');
}

export type FredTreasuryYields = {
  y2: number | null;
  y5: number | null;
  y10: number | null;
  y20: number | null;
  y30: number | null;
};

export async function getFredTreasuryYields(): Promise<FredTreasuryYields> {
  const [y2, y5, y10, y20, y30] = await Promise.allSettled([
    fetchLatestValue('DGS2'),
    fetchLatestValue('DGS5'),
    fetchLatestValue('DGS10'),
    fetchLatestValue('DGS20'),
    fetchLatestValue('DGS30'),
  ]);

  return {
    y2: y2.status === 'fulfilled' ? y2.value : null,
    y5: y5.status === 'fulfilled' ? y5.value : null,
    y10: y10.status === 'fulfilled' ? y10.value : null,
    y20: y20.status === 'fulfilled' ? y20.value : null,
    y30: y30.status === 'fulfilled' ? y30.value : null,
  };
}

export async function getFredTipsBreakeven(): Promise<number | null> {
  return fetchLatestValue('T10YIE');
}

export async function getFredVix(): Promise<number | null> {
  return fetchLatestValue('VIXCLS');
}

export type CreditItem = {
  label: string;
  value: number;
  change: number;
  series: TimeSeriesPoint[];
};

export async function getLiveCreditSpreads(): Promise<CreditItem[]> {
  try {
    const [hySeries, igSeries] = await Promise.all([
      fetchSeries('BAMLH0A0HYM2', 365),
      fetchSeries('BAMLC0A0CM', 365),
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
  latestDataDate?: string;
};

async function getYoYSeries(seriesId: string): Promise<{ value: number; series: TimeSeriesPoint[]; latestDate: string }> {
  const raw = await fetchSeries(seriesId, 36);
  if (raw.length < 13) throw new Error('Insufficient data');

  const yoy: TimeSeriesPoint[] = raw.slice(12).map((p, i) => {
    const yearAgo = raw[i];
    const pct = yearAgo.value !== 0
      ? parseFloat(((p.value - yearAgo.value) / yearAgo.value * 100).toFixed(1))
      : 0;
    return { date: p.date, value: pct };
  });

  return {
    value: yoy[yoy.length - 1]?.value ?? 0,
    series: yoy,
    latestDate: raw[raw.length - 1]?.date ?? '',
  };
}

export async function getLiveInflation(): Promise<InflationItem[]> {
  try {
    const [cpi, coreCpi, pce, corePce] = await Promise.allSettled([
      getYoYSeries('CPIAUCSL'),
      getYoYSeries('CPILFESL'),
      getYoYSeries('PCEPI'),
      getYoYSeries('PCEPILFE'),
    ]);

    const fb = mockMarketData.inflation;
    return [
      {
        label: 'CPI YoY',
        value: cpi.status === 'fulfilled' ? cpi.value.value : fb[0].value,
        series: cpi.status === 'fulfilled' ? cpi.value.series : fb[0].series,
        latestDataDate: cpi.status === 'fulfilled' ? cpi.value.latestDate : undefined,
      },
      {
        label: 'Core CPI',
        value: coreCpi.status === 'fulfilled' ? coreCpi.value.value : fb[1].value,
        series: coreCpi.status === 'fulfilled' ? coreCpi.value.series : fb[1].series,
        latestDataDate: coreCpi.status === 'fulfilled' ? coreCpi.value.latestDate : undefined,
      },
      {
        label: 'PCE YoY',
        value: pce.status === 'fulfilled' ? pce.value.value : fb[2].value,
        series: pce.status === 'fulfilled' ? pce.value.series : fb[2].series,
        latestDataDate: pce.status === 'fulfilled' ? pce.value.latestDate : undefined,
      },
      {
        label: 'Core PCE',
        value: corePce.status === 'fulfilled' ? corePce.value.value : fb[3].value,
        series: corePce.status === 'fulfilled' ? corePce.value.series : fb[3].series,
        latestDataDate: corePce.status === 'fulfilled' ? corePce.value.latestDate : undefined,
      },
    ];
  } catch {
    return mockMarketData.inflation;
  }
}

export type FedBalanceSheet = {
  totalAssets: number | null;
  treasuries: number | null;
  mortgageBackedSecurities: number | null;
};

export async function getFredFedBalanceSheet(): Promise<FedBalanceSheet> {
  const [walcl, treast, wshomcb] = await Promise.allSettled([
    fetchLatestValue('WALCL'),
    fetchLatestValue('TREAST'),
    fetchLatestValue('WSHOMCB'),
  ]);

  return {
    totalAssets: walcl.status === 'fulfilled' ? walcl.value : null,
    treasuries: treast.status === 'fulfilled' ? treast.value : null,
    mortgageBackedSecurities: wshomcb.status === 'fulfilled' ? wshomcb.value : null,
  };
}

const YIELD_CURVE_MATURITIES = [
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

export async function getFredYieldCurve(): Promise<YieldCurveData[] | null> {
  try {
    const results = await Promise.allSettled(
      YIELD_CURVE_MATURITIES.map(({ seriesId }) => fetchLatestValue(seriesId))
    );

    return YIELD_CURVE_MATURITIES.map(({ maturity }, i) => {
      const result = results[i];
      const current = result.status === 'fulfilled' ? result.value : null;
      const fb = mockMarketData.yieldCurve.find(p => p.maturity === maturity) ?? mockMarketData.yieldCurve[0];
      return {
        maturity,
        current: current ?? fb.current,
        oneMonthAgo: fb.oneMonthAgo,
        oneYearAgo: fb.oneYearAgo,
      };
    });
  } catch {
    return null;
  }
}

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

export async function getFredYieldCurveOverlays(currentCurve: YieldCurveData[]): Promise<YieldCurveData[]> {
  try {
    const oneMonthAgoDate = isoDateOffset(-30);
    const oneYearAgoDate = isoDateOffset(-365);

    const results = await Promise.allSettled(
      YIELD_CURVE_MATURITIES.map(async ({ maturity, seriesId }) => {
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
