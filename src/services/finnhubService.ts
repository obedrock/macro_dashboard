import { cache, TTL } from './cache';
import { NewsItem, EconomicEvent } from '../types';
import { mockNews, mockEconomicCalendar, mockFomcData } from '../data/mockData';

const API_KEY = import.meta.env.VITE_FINNHUB_API_KEY as string;
const BASE = 'https://finnhub.io/api/v1';

async function finnhubFetch<T>(path: string): Promise<T> {
  const res = await fetch(`${BASE}${path}`, {
    headers: { 'X-Finnhub-Token': API_KEY },
  });
  if (!res.ok) throw new Error(`Finnhub ${res.status}: ${path}`);
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

type FinnhubNewsRaw = {
  id: number;
  headline: string;
  source: string;
  datetime: number;
  url: string;
  summary?: string;
};

export async function getFinnhubNews(): Promise<NewsItem[]> {
  const cacheKey = 'finnhub:news:general';
  const cached = cache.get<NewsItem[]>(cacheKey);
  if (cached) return cached;

  try {
    const raw = await finnhubFetch<FinnhubNewsRaw[]>('/news?category=general');
    const items: NewsItem[] = raw
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

    if (items.length > 0) {
      cache.set(cacheKey, items, TTL.FINNHUB);
      return items;
    }
    return mockNews;
  } catch {
    return mockNews;
  }
}

type FinnhubCalendarEvent = {
  event: string;
  time: string;
  date: string;
  country: string;
  impact: string;
  prev: string | null;
  estimate: string | null;
  actual: string | null;
};

type FinnhubCalendarResponse = {
  economicCalendar?: FinnhubCalendarEvent[];
};

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

export async function getFinnhubEconomicCalendar(): Promise<EconomicEvent[]> {
  const cacheKey = 'finnhub:calendar';
  const cached = cache.get<EconomicEvent[]>(cacheKey);
  if (cached) return cached;

  try {
    const now = new Date();
    const fromDate = now.toISOString().split('T')[0];
    const toDate = new Date(now.getTime() + 45 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];

    const raw = await finnhubFetch<FinnhubCalendarResponse>(
      `/calendar/economic?from=${fromDate}&to=${toDate}`
    );

    const events = raw.economicCalendar ?? [];
    const usEvents = events
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

    if (usEvents.length > 0) {
      cache.set(cacheKey, usEvents, TTL.FINNHUB_CALENDAR);
      return usEvents;
    }
    return mockEconomicCalendar;
  } catch {
    return mockEconomicCalendar;
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

export async function getFinnhubFedWatch(): Promise<typeof mockFomcData> {
  const cacheKey = 'finnhub:fedwatch';
  const cached = cache.get<typeof mockFomcData>(cacheKey);
  if (cached) return cached;

  const dates = getUpcomingFomcDates();
  const result = {
    ...mockFomcData,
    nextMeeting: dates[0] ?? mockFomcData.nextMeeting,
    meetings: mockFomcData.meetings.map((m, i) => ({
      ...m,
      date: dates[i] ?? m.date,
    })),
  };

  cache.set(cacheKey, result, TTL.FINNHUB_CALENDAR);
  return result;
}
