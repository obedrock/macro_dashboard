import { cache, TTL } from './cache';
import { DataResult, ResultWarning, TimeSeriesPoint } from '../types';
import { toUserMessage } from './errorMessages';

const BLS_BASE = 'https://api.bls.gov/publicAPI/v1/timeseries/data';

// BLS series IDs
// CUSR0000SA0 = CPI All Items (seasonally adjusted)
// CUSR0000SA0L1E = CPI Less Food and Energy (Core CPI)
const SERIES = {
  CPI: 'CUSR0000SA0',
  CORE_CPI: 'CUSR0000SA0L1E',
} as const;

interface BlsDataPoint {
  year: string;
  period: string;
  periodName: string;
  value: string;
  latest?: string;
}

interface BlsSeriesResult {
  seriesID: string;
  data: BlsDataPoint[];
}

interface BlsResponse {
  status: string;
  Results: {
    series: BlsSeriesResult[];
  };
}

async function fetchBlsSeries(seriesId: string): Promise<BlsDataPoint[]> {
  const cacheKey = `bls:${seriesId}`;
  const cached = cache.get<BlsDataPoint[]>(cacheKey);
  if (cached) return cached;

  const res = await fetch(`${BLS_BASE}/${seriesId}`);
  if (!res.ok) throw new Error(`BLS API returned ${res.status}`);

  const json: BlsResponse = await res.json();
  if (json.status !== 'REQUEST_SUCCEEDED') throw new Error('BLS request failed');

  const series = json.Results.series[0];
  if (!series || !series.data) throw new Error('No BLS data');

  // Filter out missing values (marked with "-")
  const valid = series.data.filter(d => d.value !== '-' && d.value !== '');

  cache.set(cacheKey, valid, TTL.FRED); // 24h cache
  return valid;
}

function blsToTimeSeries(data: BlsDataPoint[]): TimeSeriesPoint[] {
  // BLS data comes newest-first, reverse for chronological
  return data
    .map(d => {
      const month = d.period.replace('M', '');
      return {
        date: `${d.year}-${month.padStart(2, '0')}-01`,
        value: parseFloat(d.value),
      };
    })
    .reverse();
}

function computeYoY(series: TimeSeriesPoint[]): { yoy: number; mom: number; yoySeries: TimeSeriesPoint[]; dataThrough: string } | null {
  if (series.length < 13) return null;

  const last = series[series.length - 1];
  const prev = series[series.length - 2];
  const yearAgo = series[series.length - 13];

  const yoy = yearAgo && yearAgo.value !== 0
    ? parseFloat(((last.value - yearAgo.value) / yearAgo.value * 100).toFixed(2))
    : 0;

  const mom = prev && prev.value !== 0
    ? parseFloat(((last.value - prev.value) / prev.value * 100).toFixed(2))
    : 0;

  const yoySeries: TimeSeriesPoint[] = series.slice(12).map((p, i) => {
    const ya = series[i];
    const pct = ya && ya.value !== 0
      ? parseFloat(((p.value - ya.value) / ya.value * 100).toFixed(2))
      : 0;
    return { date: p.date, value: pct };
  });

  return { yoy, mom, yoySeries: yoySeries.slice(-24), dataThrough: last.date };
}

export type BlsInflationItem = {
  label: string;
  sublabel: string;
  value: number;
  mom: number | null;
  series: TimeSeriesPoint[];
  dataThrough: string;
};

export async function getBlsInflation(): Promise<DataResult<BlsInflationItem[]>> {
  const [cpiResult, coreCpiResult] = await Promise.allSettled([
    fetchBlsSeries(SERIES.CPI),
    fetchBlsSeries(SERIES.CORE_CPI),
  ]);

  const allFailed = cpiResult.status === 'rejected' && coreCpiResult.status === 'rejected';
  if (allFailed) {
    return { status: 'error', error: toUserMessage('server_error'), source: 'fallback', timestamp: Date.now() };
  }

  const warnings: ResultWarning[] = [];
  if (cpiResult.status === 'rejected') warnings.push({ field: 'CPI', message: 'CPI data unavailable' });
  if (coreCpiResult.status === 'rejected') warnings.push({ field: 'CORE_CPI', message: 'Core CPI data unavailable' });

  function formatDate(d: string) {
    const dt = new Date(d + 'T00:00:00');
    return dt.toLocaleDateString('en-US', { month: 'short', year: 'numeric' });
  }

  const cpiSeries = cpiResult.status === 'fulfilled' ? blsToTimeSeries(cpiResult.value) : [];
  const coreCpiSeries = coreCpiResult.status === 'fulfilled' ? blsToTimeSeries(coreCpiResult.value) : [];

  const cpiComputed = cpiSeries.length >= 13 ? computeYoY(cpiSeries) : null;
  const coreCpiComputed = coreCpiSeries.length >= 13 ? computeYoY(coreCpiSeries) : null;

  if (!cpiComputed && cpiResult.status === 'fulfilled') warnings.push({ field: 'CPI', message: 'Insufficient CPI history' });
  if (!coreCpiComputed && coreCpiResult.status === 'fulfilled') warnings.push({ field: 'CORE_CPI', message: 'Insufficient Core CPI history' });

  const items: BlsInflationItem[] = [
    {
      label: 'CPI',
      sublabel: 'YoY % chg · All Items',
      value: cpiComputed?.yoy ?? 0,
      mom: cpiComputed?.mom ?? null,
      series: cpiComputed?.yoySeries ?? [],
      dataThrough: cpiComputed ? formatDate(cpiComputed.dataThrough) : '—',
    },
    {
      label: 'Core CPI',
      sublabel: 'YoY % chg · Ex Food & Energy',
      value: coreCpiComputed?.yoy ?? 0,
      mom: coreCpiComputed?.mom ?? null,
      series: coreCpiComputed?.yoySeries ?? [],
      dataThrough: coreCpiComputed ? formatDate(coreCpiComputed.dataThrough) : '—',
    },
  ];

  // PCE data not available from BLS (BEA source) — omit rather than show zeros
  // Breakeven data not available without FRED — omit rather than show zeros

  const source = warnings.length > 0 ? 'partial' : 'live';
  return { status: 'ok', data: items, source, timestamp: Date.now(), warnings: warnings.length > 0 ? warnings : undefined };
}
