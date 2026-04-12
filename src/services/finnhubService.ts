import { cache, TTL } from './cache';
import { DataResult, NewsItem, EconomicEvent, FomcData } from '../types';
import { mockFomcData } from '../data/mockData';
import { rateLimiter } from './rateLimiter';
import { RateLimitError, HttpError, ValidationError, toUserMessage, httpStatusToCategory } from './errorMessages';
import { FinnhubNewsResponseSchema, FinnhubCalendarResponseSchema } from './schemas';

const API_KEY = import.meta.env.VITE_FINNHUB_API_KEY as string;
const BASE = 'https://finnhub.io/api/v1';

async function finnhubFetch<T>(path: string): Promise<T> {
  if (rateLimiter.isBlocked('finnhub')) {
    throw new RateLimitError(`Rate limit reached — retrying shortly`);
  }

  const res = await fetch(`${BASE}${path}`, {
    headers: { 'X-Finnhub-Token': API_KEY },
  });

  if (res.status === 429) {
    rateLimiter.onRateLimit('finnhub');
    throw new RateLimitError('Rate limit reached — retrying shortly');
  }

  if (!res.ok) {
    throw new HttpError(res.status, path);
  }

  rateLimiter.onSuccess('finnhub');
  return res.json() as Promise<T>;
}

function classifySentiment(headline: string): 'positive' | 'negative' | 'neutral' {
  const h = headline.toLowerCase();
  const pos = ['rally', 'surge', 'gain', 'rise', 'beat', 'record', 'jump', 'boost', 'strong', 'growth', 'recovery', 'soar', 'climb', 'positive', 'upside', 'bull'];
  const neg = ['fall', 'drop', 'slump', 'decline', 'miss', 'loss', 'crash', 'plunge', 'weak', 'down', 'recession', 'fear', 'risk', 'warning', 'slide', 'sell', 'cut', 'tariff', 'trade war'];
  const posScore = pos.filter(w => h.includes(w)).length;
  const negScore = neg.filter(w => h.includes(w)).length;
  if (posScore > negScore) return 'positive';
  if (negScore > posScore) return 'negative';
  return 'neutral';
}

function formatNewsTime(ts: number): string {
  const diffMs = Date.now() - ts * 1000;
  const diffMin = Math.floor(diffMs / 60000);
  if (diffMin < 60) return `${diffMin} min ago`;
  const diffHr = Math.floor(diffMin / 60);
  if (diffHr < 24) return `${diffHr} hr ago`;
  return `${Math.floor(diffHr / 24)} days ago`;
}

function mapImpact(impact: string): 'high' | 'medium' | 'low' {
  if (impact === '3' || impact === 'high') return 'high';
  if (impact === '2' || impact === 'medium') return 'medium';
  return 'low';
}

function formatEventDate(dateStr: string): string {
  try {
    const d = new Date(dateStr);
    return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  } catch {
    return dateStr;
  }
}

function formatEventTime(timeStr: string): string {
  if (!timeStr || timeStr === 'N/A') return 'TBD';
  try {
    const [h, m] = timeStr.split(':').map(Number);
    const ampm = h >= 12 ? 'PM' : 'AM';
    const hour = h % 12 || 12;
    return `${hour}:${String(m).padStart(2, '0')} ${ampm} ET`;
  } catch {
    return timeStr;
  }
}

export async function getFinnhubNews(): Promise<DataResult<NewsItem[]>> {
  const cacheKey = 'finnhub:news:general';
  const cached = cache.get<NewsItem[]>(cacheKey);
  if (cached) {
    return { status: 'ok', data: cached, source: 'cache', timestamp: Date.now() };
  }

  try {
    const raw = await finnhubFetch<unknown>('/news?category=general');
    const parsed = FinnhubNewsResponseSchema.safeParse(raw);
    if (!parsed.success) {
      throw new ValidationError('Unexpected data format');
    }

    const items: NewsItem[] = parsed.data
      .filter(n => n.headline && n.source && n.url)
      .slice(0, 20)
      .map(n => ({
        id: String(n.id),
        headline: n.headline,
        source: n.source,
        time: formatNewsTime(n.datetime),
        url: n.url,
        sentiment: classifySentiment(n.headline),
      }));

    cache.set(cacheKey, items, TTL.FINNHUB);
    return { status: 'ok', data: items, source: 'live', timestamp: Date.now() };
  } catch (e) {
    let category: ReturnType<typeof httpStatusToCategory> = 'unknown';
    if (e instanceof RateLimitError) category = 'rate_limit';
    else if (e instanceof ValidationError) category = 'validation';
    else if (e instanceof HttpError) category = httpStatusToCategory(e.status);
    return { status: 'error', error: toUserMessage(category), source: 'fallback', timestamp: Date.now() };
  }
}

export async function getFinnhubEconomicCalendar(): Promise<DataResult<EconomicEvent[]>> {
  const cacheKey = 'finnhub:calendar';
  const cached = cache.get<EconomicEvent[]>(cacheKey);
  if (cached) {
    return { status: 'ok', data: cached, source: 'cache', timestamp: Date.now() };
  }

  try {
    const now = new Date();
    const fromDate = now.toISOString().split('T')[0];
    const toDate = new Date(now.getTime() + 45 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];

    const raw = await finnhubFetch<unknown>(
      `/calendar/economic?from=${fromDate}&to=${toDate}`
    );

    const parsed = FinnhubCalendarResponseSchema.safeParse(raw);
    if (!parsed.success) {
      throw new ValidationError('Unexpected data format');
    }

    const events = parsed.data.economicCalendar ?? [];
    const usEvents: EconomicEvent[] = events
      .filter(e => e.country === 'US' && e.event)
      .slice(0, 20)
      .map((e, i) => ({
        id: String(i + 1),
        date: formatEventDate(e.date),
        time: formatEventTime(e.time),
        name: e.event,
        previous: e.prev ?? 'N/A',
        consensus: e.estimate ?? 'N/A',
        actual: e.actual ?? undefined,
        importance: mapImpact(e.impact),
      }));

    cache.set(cacheKey, usEvents, TTL.FINNHUB_CALENDAR);
    return { status: 'ok', data: usEvents, source: 'live', timestamp: Date.now() };
  } catch (e) {
    let category: ReturnType<typeof httpStatusToCategory> = 'unknown';
    if (e instanceof RateLimitError) category = 'rate_limit';
    else if (e instanceof ValidationError) category = 'validation';
    else if (e instanceof HttpError) category = httpStatusToCategory(e.status);
    return { status: 'error', error: toUserMessage(category), source: 'fallback', timestamp: Date.now() };
  }
}

const FOMC_DATES_2026 = [
  'Jan 28-29, 2026',
  'Mar 18-19, 2026',
  'May 6-7, 2026',
  'Jun 17-18, 2026',
  'Jul 29-30, 2026',
  'Sep 16-17, 2026',
  'Oct 28-29, 2026',
  'Dec 9-10, 2026',
];

export function getUpcomingFomcDates(): string[] {
  const now = new Date();
  const upcoming: string[] = [];
  const months: Record<string, number> = { Jan: 0, Feb: 1, Mar: 2, Apr: 3, May: 4, Jun: 5, Jul: 6, Aug: 7, Sep: 8, Oct: 9, Nov: 10, Dec: 11 };

  for (const d of FOMC_DATES_2026) {
    const match = d.match(/(\w+)\s+(\d+)/);
    if (!match) continue;
    const mo = months[match[1]] ?? 0;
    const day = parseInt(match[2]);
    const yearMatch = d.match(/(\d{4})/);
    const year = yearMatch ? parseInt(yearMatch[1]) : now.getFullYear();
    const meetDate = new Date(year, mo, day + 1);
    if (meetDate >= now) upcoming.push(d);
    if (upcoming.length >= 3) break;
  }
  return upcoming.length > 0 ? upcoming : FOMC_DATES_2026.slice(0, 3);
}

export async function getFinnhubFedWatch(): Promise<DataResult<FomcData>> {
  const cacheKey = 'finnhub:fedwatch';
  const cached = cache.get<FomcData>(cacheKey);
  if (cached) {
    return { status: 'ok', data: cached, source: 'cache', timestamp: Date.now() };
  }

  try {
    const dates = getUpcomingFomcDates();
    const result: FomcData = {
      ...mockFomcData,
      nextMeeting: dates[0] ?? mockFomcData.nextMeeting,
      meetings: mockFomcData.meetings.map((m, i) => ({
        ...m,
        date: dates[i] ?? m.date,
      })),
    };

    cache.set(cacheKey, result, TTL.FINNHUB_CALENDAR);
    return { status: 'ok', data: result, source: 'live', timestamp: Date.now() };
  } catch (e) {
    const category: ReturnType<typeof httpStatusToCategory> = 'unknown';
    return { status: 'error', error: toUserMessage(category), source: 'fallback', timestamp: Date.now() };
  }
}
