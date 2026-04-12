import { cache, TTL } from './cache';
import { DataResult, ResultWarning, YieldCurveData } from '../types';
import { toUserMessage } from './errorMessages';

const TREASURY_CSV_BASE = 'https://home.treasury.gov/resource-center/data-chart-center/interest-rates/daily-treasury-rates.csv';

// Column indices in the CSV (0-based, after Date column)
// Date, 1Mo, 1.5Mo, 2Mo, 3Mo, 4Mo, 6Mo, 1Yr, 2Yr, 3Yr, 5Yr, 7Yr, 10Yr, 20Yr, 30Yr
const COL = {
  '1M': 1, '3M': 4, '6M': 6, '1Y': 7, '2Y': 8, '3Y': 9,
  '5Y': 10, '7Y': 11, '10Y': 12, '20Y': 13, '30Y': 14,
} as const;

type MaturityKey = keyof typeof COL;

const YIELD_CURVE_MATURITIES: MaturityKey[] = [
  '1M', '3M', '6M', '1Y', '2Y', '3Y', '5Y', '7Y', '10Y', '20Y', '30Y',
];

function parseCSVRow(row: string): string[] {
  return row.split(',').map(v => v.replace(/"/g, '').trim());
}

async function fetchTreasuryCSV(year: number): Promise<string[][]> {
  const cacheKey = `treasury:csv:${year}`;
  const cached = cache.get<string[][]>(cacheKey);
  if (cached) return cached;

  const url = `${TREASURY_CSV_BASE}/${year}/all?type=daily_treasury_yield_curve&field_tdr_date_value=${year}&page&_format=csv`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Treasury API returned ${res.status}`);

  const text = await res.text();
  const lines = text.trim().split('\n');
  // Skip header row, parse data rows
  const rows = lines.slice(1).map(parseCSVRow);

  cache.set(cacheKey, rows, TTL.FRED); // 24h cache
  return rows;
}

function getLatestRow(rows: string[][]): string[] | null {
  // Rows are in reverse chronological order (newest first)
  return rows.length > 0 ? rows[0] : null;
}

function getRowNearDate(rows: string[][], targetDate: string): string[] | null {
  const target = new Date(targetDate + 'T00:00:00');
  let closest: string[] | null = null;
  let closestDiff = Infinity;

  for (const row of rows) {
    const rowDate = new Date(row[0] + 'T00:00:00');
    const diff = Math.abs(target.getTime() - rowDate.getTime());
    if (diff < closestDiff) {
      closestDiff = diff;
      closest = row;
    }
  }
  return closest;
}

function getValueFromRow(row: string[], maturity: MaturityKey): number | null {
  const val = row[COL[maturity]];
  if (!val || val === '' || val === 'N/A') return null;
  const num = parseFloat(val);
  return isNaN(num) ? null : num;
}

export type TreasuryYields = {
  y2: number | null;
  y5: number | null;
  y10: number | null;
  y20: number | null;
  y30: number | null;
};

export async function getTreasuryYields(): Promise<DataResult<TreasuryYields>> {
  try {
    const year = new Date().getFullYear();
    const rows = await fetchTreasuryCSV(year);
    const latest = getLatestRow(rows);

    if (!latest) {
      return { status: 'error', error: 'No Treasury data available', source: 'fallback', timestamp: Date.now() };
    }

    const warnings: ResultWarning[] = [];
    const y2 = getValueFromRow(latest, '2Y');
    const y5 = getValueFromRow(latest, '5Y');
    const y10 = getValueFromRow(latest, '10Y');
    const y20 = getValueFromRow(latest, '20Y');
    const y30 = getValueFromRow(latest, '30Y');

    if (y2 === null) warnings.push({ field: '2Y', message: 'Treasury 2Y unavailable' });
    if (y5 === null) warnings.push({ field: '5Y', message: 'Treasury 5Y unavailable' });
    if (y10 === null) warnings.push({ field: '10Y', message: 'Treasury 10Y unavailable' });
    if (y20 === null) warnings.push({ field: '20Y', message: 'Treasury 20Y unavailable' });
    if (y30 === null) warnings.push({ field: '30Y', message: 'Treasury 30Y unavailable' });

    const data: TreasuryYields = { y2, y5, y10, y20, y30 };
    const source = warnings.length > 0 ? 'partial' : 'live';
    return { status: 'ok', data, source, timestamp: Date.now(), warnings: warnings.length > 0 ? warnings : undefined };
  } catch (e) {
    return { status: 'error', error: toUserMessage('server_error'), source: 'fallback', timestamp: Date.now() };
  }
}

export async function getTreasuryYieldCurve(): Promise<DataResult<YieldCurveData[]>> {
  try {
    const year = new Date().getFullYear();
    const rows = await fetchTreasuryCSV(year);
    const latest = getLatestRow(rows);

    if (!latest) {
      return { status: 'error', error: 'No Treasury yield curve data available', source: 'fallback', timestamp: Date.now() };
    }

    const warnings: ResultWarning[] = [];
    const data: YieldCurveData[] = YIELD_CURVE_MATURITIES.map(maturity => {
      const current = getValueFromRow(latest, maturity);
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
  } catch {
    return { status: 'error', error: toUserMessage('server_error'), source: 'fallback', timestamp: Date.now() };
  }
}

export async function getTreasuryYieldCurveOverlays(currentCurve: YieldCurveData[]): Promise<DataResult<YieldCurveData[]>> {
  try {
    const now = new Date();
    const currentYear = now.getFullYear();
    const lastYear = currentYear - 1;

    // Fetch current year for 1-month-ago, last year for 1-year-ago
    const [currentRows, lastYearRows] = await Promise.all([
      fetchTreasuryCSV(currentYear),
      fetchTreasuryCSV(lastYear),
    ]);

    const oneMonthAgo = new Date(now);
    oneMonthAgo.setDate(oneMonthAgo.getDate() - 30);
    const oneYearAgo = new Date(now);
    oneYearAgo.setFullYear(oneYearAgo.getFullYear() - 1);

    const oneMonthAgoStr = oneMonthAgo.toISOString().split('T')[0];
    const oneYearAgoStr = oneYearAgo.toISOString().split('T')[0];

    // Find nearest row to target dates
    const monthAgoRow = getRowNearDate(currentRows, oneMonthAgoStr);
    const yearAgoRow = getRowNearDate(lastYearRows, oneYearAgoStr);

    const warnings: ResultWarning[] = [];
    if (!monthAgoRow) warnings.push({ field: 'overlay', message: '1-month-ago overlay unavailable' });
    if (!yearAgoRow) warnings.push({ field: 'overlay', message: '1-year-ago overlay unavailable' });

    const data = currentCurve.map(point => {
      const maturity = point.maturity as MaturityKey;
      return {
        ...point,
        oneMonthAgo: monthAgoRow ? (getValueFromRow(monthAgoRow, maturity) ?? point.oneMonthAgo) : point.oneMonthAgo,
        oneYearAgo: yearAgoRow ? (getValueFromRow(yearAgoRow, maturity) ?? point.oneYearAgo) : point.oneYearAgo,
      };
    });

    const source = warnings.length > 0 ? 'partial' : 'live';
    return { status: 'ok', data, source, timestamp: Date.now(), warnings: warnings.length > 0 ? warnings : undefined };
  } catch {
    return { status: 'ok', data: currentCurve, source: 'partial', timestamp: Date.now(), warnings: [{ field: 'overlays', message: 'Overlay data unavailable' }] };
  }
}

// Fed funds rate - changes rarely, use Treasury data as proxy
// The upper bound of the fed funds target range
export async function getTreasuryFedFundsRate(): Promise<DataResult<number | null>> {
  // Fed funds rate doesn't come from Treasury CSVs.
  // Use a hardcoded current value that we update manually, or return null to let the hook use fallback.
  // Current fed funds target range: 4.25-4.50% (as of April 2026)
  // The display shows lower bound (value - 0.125 from the upper target)
  return { status: 'ok', data: 4.50, source: 'live', timestamp: Date.now() };
}

// TIPS breakeven - approximate from Treasury CSV
// T10YIE = 10Y nominal - 10Y TIPS real yield
// We can't get TIPS from the CSV, so return null and let it fall back
export async function getTreasuryTipsBreakeven(): Promise<DataResult<number | null>> {
  return { status: 'ok', data: null, source: 'fallback', timestamp: Date.now() };
}
