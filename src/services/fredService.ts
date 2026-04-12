import { cache, TTL } from './cache';
import { DataResult, ResultWarning, TimeSeriesPoint, YieldCurveData } from '../types';
import { rateLimiter } from './rateLimiter';
import { RateLimitError, HttpError, ValidationError, toUserMessage, httpStatusToCategory } from './errorMessages';
import { FredResponseSchema } from './schemas';

const FRED_BASE = 'https://api.stlouisfed.org/fred';
const API_KEY = import.meta.env.VITE_FRED_API_KEY as string;

async function fetchSeries(seriesId: string, limit = 365): Promise<TimeSeriesPoint[]> {
  const cacheKey = `fred:${seriesId}:${limit}`;
  const cached = cache.get<TimeSeriesPoint[]>(cacheKey);
  if (cached) return cached;

  if (rateLimiter.isBlocked('fred')) {
    throw new RateLimitError('Rate limit reached — retrying shortly');
  }

  const url = new URL(`${FRED_BASE}/series/observations`);
  url.searchParams.set('series_id', seriesId);
  url.searchParams.set('api_key', API_KEY);
  url.searchParams.set('file_type', 'json');
  url.searchParams.set('sort_order', 'desc');
  url.searchParams.set('limit', String(limit));

  const res = await fetch(url.toString());

  if (res.status === 429) {
    rateLimiter.onRateLimit('fred');
    throw new RateLimitError('Rate limit reached — retrying shortly');
  }

  if (!res.ok) {
    throw new HttpError(res.status, seriesId);
  }

  rateLimiter.onSuccess('fred');
  const json = await res.json();
  const parsed = FredResponseSchema.safeParse(json);
  if (!parsed.success) {
    throw new ValidationError('Unexpected data format');
  }

  const points: TimeSeriesPoint[] = parsed.data.observations
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

export async function getFredFedFundsRate(): Promise<DataResult<number | null>> {
  try {
    const value = await fetchLatestValue('DFEDTARU');
    return { status: 'ok', data: value, source: 'live', timestamp: Date.now() };
  } catch (e) {
    let category: ReturnType<typeof httpStatusToCategory> = 'unknown';
    if (e instanceof RateLimitError) category = 'rate_limit';
    else if (e instanceof ValidationError) category = 'validation';
    else if (e instanceof HttpError) category = httpStatusToCategory(e.status);
    return { status: 'error', error: toUserMessage(category), source: 'fallback', timestamp: Date.now() };
  }
}

export type FredTreasuryYields = {
  y2: number | null;
  y5: number | null;
  y10: number | null;
  y20: number | null;
  y30: number | null;
};

export async function getFredTreasuryYields(): Promise<DataResult<FredTreasuryYields>> {
  const [y2, y5, y10, y20, y30] = await Promise.allSettled([
    fetchLatestValue('DGS2'),
    fetchLatestValue('DGS5'),
    fetchLatestValue('DGS10'),
    fetchLatestValue('DGS20'),
    fetchLatestValue('DGS30'),
  ]);

  const allFailed = [y2, y5, y10, y20, y30].every(r => r.status === 'rejected');
  if (allFailed) {
    return { status: 'error', error: toUserMessage('server_error'), source: 'fallback', timestamp: Date.now() };
  }

  const warnings: ResultWarning[] = [];
  const seriesLabels: Record<string, string> = {
    DGS2: 'Treasury 2Y unavailable',
    DGS5: 'Treasury 5Y unavailable',
    DGS10: 'Treasury 10Y unavailable',
    DGS20: 'Treasury 20Y unavailable',
    DGS30: 'Treasury 30Y unavailable',
  };

  const y2Val = y2.status === 'fulfilled' ? y2.value : null;
  const y5Val = y5.status === 'fulfilled' ? y5.value : null;
  const y10Val = y10.status === 'fulfilled' ? y10.value : null;
  const y20Val = y20.status === 'fulfilled' ? y20.value : null;
  const y30Val = y30.status === 'fulfilled' ? y30.value : null;

  if (y2.status === 'rejected') warnings.push({ field: 'DGS2', message: seriesLabels['DGS2'] });
  if (y5.status === 'rejected') warnings.push({ field: 'DGS5', message: seriesLabels['DGS5'] });
  if (y10.status === 'rejected') warnings.push({ field: 'DGS10', message: seriesLabels['DGS10'] });
  if (y20.status === 'rejected') warnings.push({ field: 'DGS20', message: seriesLabels['DGS20'] });
  if (y30.status === 'rejected') warnings.push({ field: 'DGS30', message: seriesLabels['DGS30'] });

  const data: FredTreasuryYields = { y2: y2Val, y5: y5Val, y10: y10Val, y20: y20Val, y30: y30Val };
  const source = warnings.length > 0 ? 'partial' : 'live';

  return { status: 'ok', data, source, timestamp: Date.now(), warnings: warnings.length > 0 ? warnings : undefined };
}

export async function getFredTipsBreakeven(): Promise<DataResult<number | null>> {
  try {
    const value = await fetchLatestValue('T10YIE');
    return { status: 'ok', data: value, source: 'live', timestamp: Date.now() };
  } catch (e) {
    let category: ReturnType<typeof httpStatusToCategory> = 'unknown';
    if (e instanceof RateLimitError) category = 'rate_limit';
    else if (e instanceof ValidationError) category = 'validation';
    else if (e instanceof HttpError) category = httpStatusToCategory(e.status);
    return { status: 'error', error: toUserMessage(category), source: 'fallback', timestamp: Date.now() };
  }
}

export async function getFredVix(): Promise<DataResult<number | null>> {
  try {
    const value = await fetchLatestValue('VIXCLS');
    return { status: 'ok', data: value, source: 'live', timestamp: Date.now() };
  } catch (e) {
    let category: ReturnType<typeof httpStatusToCategory> = 'unknown';
    if (e instanceof RateLimitError) category = 'rate_limit';
    else if (e instanceof ValidationError) category = 'validation';
    else if (e instanceof HttpError) category = httpStatusToCategory(e.status);
    return { status: 'error', error: toUserMessage(category), source: 'fallback', timestamp: Date.now() };
  }
}

export type CreditItem = {
  label: string;
  value: number;
  change: number;
  series: TimeSeriesPoint[];
};

export async function getLiveCreditSpreads(): Promise<DataResult<CreditItem[]>> {
  const warnings: ResultWarning[] = [];

  try {
    const [hyResult, igResult] = await Promise.allSettled([
      fetchSeries('BAMLH0A0HYM2', 365),
      fetchSeries('BAMLC0A0CM', 365),
    ]);

    const hyFailed = hyResult.status === 'rejected';
    const igFailed = igResult.status === 'rejected';

    if (hyFailed && igFailed) {
      return { status: 'error', error: toUserMessage('server_error'), source: 'fallback', timestamp: Date.now() };
    }

    const hySeries = hyFailed ? [] : hyResult.value;
    const igSeries = igFailed ? [] : igResult.value;

    if (hyFailed) warnings.push({ field: 'BAMLH0A0HYM2', message: 'HY OAS series unavailable' });
    if (igFailed) warnings.push({ field: 'BAMLC0A0CM', message: 'IG OAS series unavailable' });

    const hyLast = hySeries[hySeries.length - 1]?.value ?? 0;
    const hyPrev = hySeries[hySeries.length - 2]?.value ?? hyLast;
    const igLast = igSeries[igSeries.length - 1]?.value ?? 0;
    const igPrev = igSeries[igSeries.length - 2]?.value ?? igLast;

    const diffSeries: TimeSeriesPoint[] = hySeries.map((p, i) => ({
      date: p.date,
      value: parseFloat((p.value - (igSeries[i]?.value ?? p.value)).toFixed(1)),
    }));

    const items: CreditItem[] = [
      { label: 'HY OAS Spread', value: hyLast, change: parseFloat((hyLast - hyPrev).toFixed(1)), series: hySeries },
      { label: 'IG OAS Spread', value: igLast, change: parseFloat((igLast - igPrev).toFixed(1)), series: igSeries },
      {
        label: 'HY-IG Differential',
        value: parseFloat((hyLast - igLast).toFixed(1)),
        change: parseFloat((hyLast - hyPrev - (igLast - igPrev)).toFixed(1)),
        series: diffSeries,
      },
    ];

    const source = warnings.length > 0 ? 'partial' : 'live';
    return { status: 'ok', data: items, source, timestamp: Date.now(), warnings: warnings.length > 0 ? warnings : undefined };
  } catch (e) {
    let category: ReturnType<typeof httpStatusToCategory> = 'unknown';
    if (e instanceof RateLimitError) category = 'rate_limit';
    else if (e instanceof HttpError) category = httpStatusToCategory(e.status);
    return { status: 'error', error: toUserMessage(category), source: 'fallback', timestamp: Date.now() };
  }
}

export type InflationItem = {
  label: string;
  sublabel: string;
  value: number;
  mom: number | null;
  series: TimeSeriesPoint[];
  dataThrough: string;
};

async function getInflationSeries(seriesId: string): Promise<{
  yoy: number;
  mom: number;
  series: TimeSeriesPoint[];
  dataThrough: string;
}> {
  const raw = await fetchSeries(seriesId, 60);
  if (raw.length < 13) throw new Error('Insufficient data');

  const last = raw[raw.length - 1];
  const prev = raw[raw.length - 2];
  const yearAgo = raw[raw.length - 13];

  const yoy = yearAgo && yearAgo.value !== 0
    ? parseFloat(((last.value - yearAgo.value) / yearAgo.value * 100).toFixed(2))
    : 0;

  const mom = prev && prev.value !== 0
    ? parseFloat(((last.value - prev.value) / prev.value * 100).toFixed(2))
    : 0;

  const yoySeries: TimeSeriesPoint[] = raw.slice(12).map((p, i) => {
    const ya = raw[i];
    const pct = ya && ya.value !== 0
      ? parseFloat(((p.value - ya.value) / ya.value * 100).toFixed(2))
      : 0;
    return { date: p.date, value: pct };
  });

  const dataThrough = last.date;

  return { yoy, mom, series: yoySeries.slice(-24), dataThrough };
}

async function getLevelSeriesWithDate(seriesId: string): Promise<{
  value: number;
  series: TimeSeriesPoint[];
  dataThrough: string;
}> {
  const raw = await fetchSeries(seriesId, 60);
  if (raw.length === 0) throw new Error('No data');
  const last = raw[raw.length - 1];
  return { value: parseFloat(last.value.toFixed(2)), series: raw.slice(-24), dataThrough: last.date };
}

export async function getLiveInflation(): Promise<DataResult<InflationItem[]>> {
  const [cpi, coreCpi, pce, corePce, breakeven5y, breakeven1y] = await Promise.allSettled([
    getInflationSeries('CPIAUCSL'),
    getInflationSeries('CPILFESL'),
    getInflationSeries('PCEPI'),
    getInflationSeries('PCEPILFE'),
    getLevelSeriesWithDate('T5YIE'),
    getLevelSeriesWithDate('EXPINF1YR'),
  ]);

  const allFailed = [cpi, coreCpi, pce, corePce, breakeven5y, breakeven1y].every(r => r.status === 'rejected');
  if (allFailed) {
    return { status: 'error', error: toUserMessage('server_error'), source: 'fallback', timestamp: Date.now() };
  }

  const warnings: ResultWarning[] = [];
  const allResults: [PromiseSettledResult<unknown>, string][] = [
    [cpi, 'CPIAUCSL'],
    [coreCpi, 'CPILFESL'],
    [pce, 'PCEPI'],
    [corePce, 'PCEPILFE'],
    [breakeven5y, 'T5YIE'],
    [breakeven1y, 'EXPINF1YR'],
  ];

  for (const [result, seriesId] of allResults) {
    if (result.status === 'rejected') {
      warnings.push({ field: seriesId, message: `${seriesId} series unavailable` });
    }
  }

  function formatDate(d: string) {
    const dt = new Date(d + 'T00:00:00');
    return dt.toLocaleDateString('en-US', { month: 'short', year: 'numeric' });
  }

  const items: InflationItem[] = [
    {
      label: 'CPI',
      sublabel: 'YoY % chg · All Items',
      value: cpi.status === 'fulfilled' ? cpi.value.yoy : 0,
      mom: cpi.status === 'fulfilled' ? cpi.value.mom : null,
      series: cpi.status === 'fulfilled' ? cpi.value.series : [],
      dataThrough: cpi.status === 'fulfilled' ? formatDate(cpi.value.dataThrough) : '—',
    },
    {
      label: 'Core CPI',
      sublabel: 'YoY % chg · Ex Food & Energy',
      value: coreCpi.status === 'fulfilled' ? coreCpi.value.yoy : 0,
      mom: coreCpi.status === 'fulfilled' ? coreCpi.value.mom : null,
      series: coreCpi.status === 'fulfilled' ? coreCpi.value.series : [],
      dataThrough: coreCpi.status === 'fulfilled' ? formatDate(coreCpi.value.dataThrough) : '—',
    },
    {
      label: 'PCE',
      sublabel: 'YoY % chg · All Items',
      value: pce.status === 'fulfilled' ? pce.value.yoy : 0,
      mom: pce.status === 'fulfilled' ? pce.value.mom : null,
      series: pce.status === 'fulfilled' ? pce.value.series : [],
      dataThrough: pce.status === 'fulfilled' ? formatDate(pce.value.dataThrough) : '—',
    },
    {
      label: 'Core PCE',
      sublabel: 'YoY % chg · Ex Food & Energy',
      value: corePce.status === 'fulfilled' ? corePce.value.yoy : 0,
      mom: corePce.status === 'fulfilled' ? corePce.value.mom : null,
      series: corePce.status === 'fulfilled' ? corePce.value.series : [],
      dataThrough: corePce.status === 'fulfilled' ? formatDate(corePce.value.dataThrough) : '—',
    },
    {
      label: '5yr Breakeven',
      sublabel: '% · Market Inflation Expectation',
      value: breakeven5y.status === 'fulfilled' ? breakeven5y.value.value : 2.4,
      mom: null,
      series: breakeven5y.status === 'fulfilled' ? breakeven5y.value.series : [],
      dataThrough: breakeven5y.status === 'fulfilled' ? formatDate(breakeven5y.value.dataThrough) : '—',
    },
    {
      label: '1yr Expectation',
      sublabel: '% · Cleveland Fed Model',
      value: breakeven1y.status === 'fulfilled' ? breakeven1y.value.value : 2.8,
      mom: null,
      series: breakeven1y.status === 'fulfilled' ? breakeven1y.value.series : [],
      dataThrough: breakeven1y.status === 'fulfilled' ? formatDate(breakeven1y.value.dataThrough) : '—',
    },
  ];

  const source = warnings.length > 0 ? 'partial' : 'live';
  return { status: 'ok', data: items, source, timestamp: Date.now(), warnings: warnings.length > 0 ? warnings : undefined };
}

export type FedBalanceSheet = {
  totalAssets: number | null;
  treasuries: number | null;
  mortgageBackedSecurities: number | null;
};

export async function getFredFedBalanceSheet(): Promise<DataResult<FedBalanceSheet>> {
  const [walcl, treast, wshomcb] = await Promise.allSettled([
    fetchLatestValue('WALCL'),
    fetchLatestValue('TREAST'),
    fetchLatestValue('WSHOMCB'),
  ]);

  const allFailed = [walcl, treast, wshomcb].every(r => r.status === 'rejected');
  if (allFailed) {
    return { status: 'error', error: toUserMessage('server_error'), source: 'fallback', timestamp: Date.now() };
  }

  const warnings: ResultWarning[] = [];
  if (walcl.status === 'rejected') warnings.push({ field: 'WALCL', message: 'Total assets series unavailable' });
  if (treast.status === 'rejected') warnings.push({ field: 'TREAST', message: 'Treasuries series unavailable' });
  if (wshomcb.status === 'rejected') warnings.push({ field: 'WSHOMCB', message: 'MBS series unavailable' });

  const data: FedBalanceSheet = {
    totalAssets: walcl.status === 'fulfilled' ? walcl.value : null,
    treasuries: treast.status === 'fulfilled' ? treast.value : null,
    mortgageBackedSecurities: wshomcb.status === 'fulfilled' ? wshomcb.value : null,
  };

  const source = warnings.length > 0 ? 'partial' : 'live';
  return { status: 'ok', data, source, timestamp: Date.now(), warnings: warnings.length > 0 ? warnings : undefined };
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

export async function getFredYieldCurve(): Promise<DataResult<YieldCurveData[]>> {
  try {
    const results = await Promise.allSettled(
      YIELD_CURVE_MATURITIES.map(({ seriesId }) => fetchLatestValue(seriesId))
    );

    const warnings: ResultWarning[] = [];
    const data: YieldCurveData[] = YIELD_CURVE_MATURITIES.map(({ maturity }, i) => {
      const result = results[i];
      const current = result.status === 'fulfilled' ? result.value : null;
      if (current === null) {
        warnings.push({ field: maturity, message: `${maturity} yield unavailable` });
      }
      return {
        maturity,
        current: current ?? 0,
        oneMonthAgo: 0,
        oneYearAgo: 0,
      };
    });

    const source = warnings.length > 0 ? 'partial' : 'live';
    return { status: 'ok', data, source, timestamp: Date.now(), warnings: warnings.length > 0 ? warnings : undefined };
  } catch (e) {
    let category: ReturnType<typeof httpStatusToCategory> = 'unknown';
    if (e instanceof RateLimitError) category = 'rate_limit';
    else if (e instanceof HttpError) category = httpStatusToCategory(e.status);
    return { status: 'error', error: toUserMessage(category), source: 'fallback', timestamp: Date.now() };
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

  if (rateLimiter.isBlocked('fred')) {
    return null;
  }

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

  if (res.status === 429) {
    rateLimiter.onRateLimit('fred');
    return null;
  }

  if (!res.ok) return null;

  rateLimiter.onSuccess('fred');
  const json = await res.json();
  const parsed = FredResponseSchema.safeParse(json);
  if (!parsed.success) return null;

  const valid = parsed.data.observations.filter(o => o.value !== '.').reverse();
  if (valid.length === 0) return null;

  const value = parseFloat(valid[0].value);
  cache.set(cacheKey, value, TTL.FRED);
  return value;
}

export async function getFredYieldCurveOverlays(currentCurve: YieldCurveData[]): Promise<DataResult<YieldCurveData[]>> {
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
    const warnings: ResultWarning[] = [];

    for (const r of results) {
      if (r.status === 'fulfilled') {
        overlayMap.set(r.value.maturity, { oneMonthAgo: r.value.oneMonthAgo, oneYearAgo: r.value.oneYearAgo });
      } else {
        warnings.push({ field: 'overlay', message: 'Some yield curve overlay data unavailable' });
      }
    }

    const data = currentCurve.map(point => {
      const overlay = overlayMap.get(point.maturity);
      return {
        ...point,
        oneMonthAgo: overlay?.oneMonthAgo ?? point.oneMonthAgo,
        oneYearAgo: overlay?.oneYearAgo ?? point.oneYearAgo,
      };
    });

    const source = warnings.length > 0 ? 'partial' : 'live';
    return { status: 'ok', data, source, timestamp: Date.now(), warnings: warnings.length > 0 ? warnings : undefined };
  } catch {
    return { status: 'ok', data: currentCurve, source: 'partial', timestamp: Date.now(), warnings: [{ field: 'overlays', message: 'Overlay data unavailable' }] };
  }
}
