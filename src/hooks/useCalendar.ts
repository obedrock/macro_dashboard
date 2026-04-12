import { useState, useEffect, useCallback, useRef } from 'react';
import { EconomicEvent, FomcData, WidgetStatus } from '../types';
import { mockMarketData } from '../data/mockData';
import { getFinnhubEconomicCalendar, getFinnhubFedWatch } from '../services/finnhubService';
import { loadingStatus, loadedStatus, errorStatus } from './statusUtils';

const CALENDAR_REFRESH_MS = 2 * 60 * 60 * 1000;

function msUntilNextCalendarRefresh(): number {
  const now = new Date();
  const etOffset = -5 * 60;
  const utcNow = now.getTime() + now.getTimezoneOffset() * 60000;
  const etNow = new Date(utcNow + etOffset * 60000);

  const next835 = new Date(etNow);
  next835.setHours(8, 35, 0, 0);
  if (etNow >= next835) next835.setDate(next835.getDate() + 1);

  const msTo835 = next835.getTime() - etNow.getTime();
  const msToTwoHour = CALENDAR_REFRESH_MS - (etNow.getTime() % CALENDAR_REFRESH_MS);

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
      const [calendar, fomc] = await Promise.all([
        getFinnhubEconomicCalendar(),
        getFinnhubFedWatch(),
      ]);
      setData({ economicCalendar: calendar, fomc });
      setStatus(loadedStatus);
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
