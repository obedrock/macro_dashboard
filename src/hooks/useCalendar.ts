import { useState, useEffect, useCallback, useRef } from 'react';
import { EconomicEvent, FomcData, ResultWarning, WidgetStatus } from '../types';
import { mockMarketData } from '../data/mockData';
import { getFinnhubEconomicCalendar, getFinnhubFedWatch } from '../services/finnhubService';
import { loadingStatus, loadedStatus, errorStatus, warnedStatus } from './statusUtils';

const CALENDAR_REFRESH_MS = 2 * 60 * 60 * 1000;

function msUntilNextCalendarRefresh(): number {
  const now = new Date();

  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: 'America/New_York',
    hour: 'numeric',
    minute: 'numeric',
    second: 'numeric',
    hour12: false,
  }).formatToParts(now);

  const etHour = parseInt(parts.find(p => p.type === 'hour')!.value, 10) % 24;
  const etMinute = parseInt(parts.find(p => p.type === 'minute')!.value, 10);
  const etSecond = parseInt(parts.find(p => p.type === 'second')!.value, 10);

  const etSecondsNow = etHour * 3600 + etMinute * 60 + etSecond;
  const target835 = 8 * 3600 + 35 * 60;

  const msTo835 = etSecondsNow < target835
    ? (target835 - etSecondsNow) * 1000
    : (86400 - etSecondsNow + target835) * 1000;

  const msToTwoHour = CALENDAR_REFRESH_MS - (now.getTime() % CALENDAR_REFRESH_MS);
  return Math.min(msTo835, msToTwoHour);
}

export interface CalendarHookResult {
  data: { economicCalendar: EconomicEvent[]; fomc: FomcData };
  status: WidgetStatus;
  fetch: () => Promise<void>;
}

export function useCalendar(): CalendarHookResult {
  const [data, setData] = useState<{ economicCalendar: EconomicEvent[]; fomc: FomcData }>({
    economicCalendar: mockMarketData.economicCalendar,
    fomc: mockMarketData.fomc,
  });
  const [status, setStatus] = useState<WidgetStatus>(loadingStatus);
  const calendarTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const calendarIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const fetch = useCallback(async () => {
    setStatus(loadingStatus);
    try {
      const [calResult, fomcResult] = await Promise.all([
        getFinnhubEconomicCalendar(),
        getFinnhubFedWatch(),
      ]);

      const warnings: ResultWarning[] = [];
      const calData = calResult.status === 'ok' ? calResult.data : null;
      const fomcData = fomcResult.status === 'ok' ? fomcResult.data : null;

      if (calResult.status === 'error') warnings.push({ field: 'calendar', message: calResult.error });
      if (fomcResult.status === 'error') warnings.push({ field: 'fomc', message: fomcResult.error });
      if (calResult.status === 'ok' && calResult.warnings?.length) warnings.push(...calResult.warnings);
      if (fomcResult.status === 'ok' && fomcResult.warnings?.length) warnings.push(...fomcResult.warnings);

      if (!calData && !fomcData) {
        setStatus(errorStatus(warnings.map(w => w.message).join('; ')));
        return;
      }

      setData(prev => ({
        economicCalendar: calData ?? prev.economicCalendar,
        fomc: fomcData ?? prev.fomc,
      }));
      setStatus(warnings.length ? warnedStatus(warnings) : loadedStatus);
    } catch (e) {
      setStatus(errorStatus(e instanceof Error ? e.message : 'Failed to load'));
    }
  }, []);

  useEffect(() => {
    fetch();

    const delay = msUntilNextCalendarRefresh();
    calendarTimeoutRef.current = setTimeout(() => {
      fetch();
      calendarIntervalRef.current = setInterval(fetch, CALENDAR_REFRESH_MS);
    }, delay);

    return () => {
      if (calendarTimeoutRef.current !== null) clearTimeout(calendarTimeoutRef.current);
      if (calendarIntervalRef.current !== null) clearInterval(calendarIntervalRef.current);
    };
  }, [fetch]);

  return { data, status, fetch };
}
