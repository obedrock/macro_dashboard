import { useState, useEffect, useCallback, useRef } from 'react';
import { MarketData, WidgetStatuses, WidgetStatus, PriceItem } from '../types';
import { mockMarketData } from '../data/mockData';
import {
  getTwelveEquities,
  getTwelveFX,
  getTwelveCommodities,
  getTwelveRates,
  buildRibbonFromWs,
  subscribeWebSocket,
} from '../services/twelveDataService';
import {
  getFinnhubNews,
  getFinnhubEconomicCalendar,
  getFinnhubFedWatch,
} from '../services/finnhubService';
import {
  getLiveCreditSpreads,
  getLiveInflation,
  getFredFedFundsRate,
  getFredTreasuryYields,
  getFredYieldCurve,
  getFredYieldCurveOverlays,
} from '../services/fredService';

const TWELVE_REST_REFRESH_MS = 60 * 1000;
const NEWS_REFRESH_MS = 5 * 60 * 1000;
const CALENDAR_REFRESH_MS = 2 * 60 * 60 * 1000;
const INFLATION_CHECK_MS = 24 * 60 * 60 * 1000;
const FRED_YIELDS_REFRESH_MS = 24 * 60 * 60 * 1000;

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

const loadingStatus: WidgetStatus = { state: 'loading' };
const loadedStatus: WidgetStatus = { state: 'loaded' };
function errorStatus(msg: string): WidgetStatus {
  return { state: 'error', error: msg };
}

const DEFAULT_STATUSES: WidgetStatuses = {
  ribbon: loadingStatus,
  equities: loadingStatus,
  fx: loadingStatus,
  commodities: loadingStatus,
  rates: loadingStatus,
  yields: loadingStatus,
  credit: loadingStatus,
  inflation: loadingStatus,
  news: loadingStatus,
  calendar: loadingStatus,
};

export function useMarketData() {
  const [data, setData] = useState<MarketData>(mockMarketData);
  const [statuses, setStatuses] = useState<WidgetStatuses>(DEFAULT_STATUSES);
  const [lastUpdated, setLastUpdated] = useState<Date>(new Date());
  const ribbonBase = useRef<MarketData['ribbon']>(mockMarketData.ribbon);
  const lastInflationDate = useRef<string>('');

  function setStatus(key: keyof WidgetStatuses, status: WidgetStatus) {
    setStatuses(prev => ({ ...prev, [key]: status }));
  }

  const fetchEquities = useCallback(async () => {
    setStatus('equities', loadingStatus);
    try {
      const equities = await getTwelveEquities();
      setData(prev => ({ ...prev, equities }));
      setStatus('equities', loadedStatus);
    } catch (e) {
      setStatus('equities', errorStatus(e instanceof Error ? e.message : 'Failed to load'));
    }
  }, []);

  const fetchFX = useCallback(async () => {
    setStatus('fx', loadingStatus);
    try {
      const fx = await getTwelveFX();
      setData(prev => ({ ...prev, fx }));
      setStatus('fx', loadedStatus);
    } catch (e) {
      setStatus('fx', errorStatus(e instanceof Error ? e.message : 'Failed to load'));
    }
  }, []);

  const fetchCommodities = useCallback(async () => {
    setStatus('commodities', loadingStatus);
    try {
      const commodities = await getTwelveCommodities();
      setData(prev => ({ ...prev, commodities }));
      setStatus('commodities', loadedStatus);
    } catch (e) {
      setStatus('commodities', errorStatus(e instanceof Error ? e.message : 'Failed to load'));
    }
  }, []);

  const fetchRatesAndYields = useCallback(async () => {
    setStatus('rates', loadingStatus);
    setStatus('yields', loadingStatus);
    try {
      const [tdRates, fredYields] = await Promise.all([
        getTwelveRates(),
        getFredTreasuryYields(),
      ]);

      const fedFundsRate = await getFredFedFundsRate();

      const rates: PriceItem[] = [...tdRates];

      if (fedFundsRate != null) {
        const lo = parseFloat((fedFundsRate - 0.25).toFixed(2));
        const hi = fedFundsRate;
        rates[0] = { ...rates[0], value: parseFloat(((lo + hi) / 2).toFixed(3)) };
      }
      if (fredYields.dgs2 != null) {
        rates[1] = { ...rates[1], value: fredYields.dgs2 };
      }
      if (fredYields.dgs5 != null) {
        rates[2] = { ...rates[2], value: fredYields.dgs5 };
      }
      if (fredYields.dgs10 != null) {
        rates[3] = { ...rates[3], value: fredYields.dgs10 };
      }
      if (fredYields.dgs30 != null) {
        rates[4] = { ...rates[4], value: fredYields.dgs30 };
      }
      if (fredYields.dgs10 != null && fredYields.dgs2 != null) {
        rates[6] = {
          ...rates[6],
          value: parseFloat(((fredYields.dgs10 - fredYields.dgs2) * 100).toFixed(1)),
        };
      }

      const ribbon = [...ribbonBase.current];
      if (fredYields.dgs10 != null) ribbon[1] = { ...ribbon[1], value: fredYields.dgs10 };
      if (fredYields.vix != null) ribbon[5] = { ...ribbon[5], value: fredYields.vix };
      ribbonBase.current = ribbon;

      const equitiesVix = fredYields.vix;

      setData(prev => ({
        ...prev,
        rates,
        ribbon,
        equities: equitiesVix != null
          ? prev.equities.map((e, i) => i === 4 ? { ...e, value: equitiesVix } : e)
          : prev.equities,
      }));

      const fredCurve = await getFredYieldCurve();
      const baseCurve = fredCurve ?? mockMarketData.yieldCurve;
      const overlaid = await getFredYieldCurveOverlays(baseCurve).catch(() => baseCurve);
      setData(prev => ({ ...prev, yieldCurve: overlaid }));

      setStatus('rates', loadedStatus);
      setStatus('yields', loadedStatus);
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Failed to load';
      setStatus('rates', errorStatus(msg));
      setStatus('yields', errorStatus(msg));
    }
  }, []);

  const fetchCredit = useCallback(async () => {
    setStatus('credit', loadingStatus);
    try {
      const credit = await getLiveCreditSpreads();
      setData(prev => ({ ...prev, credit }));
      setStatus('credit', loadedStatus);
    } catch (e) {
      setStatus('credit', errorStatus(e instanceof Error ? e.message : 'Failed to load'));
    }
  }, []);

  const fetchInflation = useCallback(async (forceRefresh = false) => {
    setStatus('inflation', loadingStatus);
    try {
      const inflation = await getLiveInflation();
      const latestDate = inflation[0]?.latestDataDate ?? '';

      if (!forceRefresh && latestDate && latestDate === lastInflationDate.current) {
        setStatus('inflation', loadedStatus);
        return;
      }

      lastInflationDate.current = latestDate;
      setData(prev => ({ ...prev, inflation }));
      setStatus('inflation', loadedStatus);
    } catch (e) {
      setStatus('inflation', errorStatus(e instanceof Error ? e.message : 'Failed to load'));
    }
  }, []);

  const fetchNews = useCallback(async () => {
    setStatus('news', loadingStatus);
    try {
      const news = await getFinnhubNews();
      setData(prev => ({ ...prev, news }));
      setStatus('news', loadedStatus);
    } catch (e) {
      setStatus('news', errorStatus(e instanceof Error ? e.message : 'Failed to load'));
    }
  }, []);

  const fetchCalendar = useCallback(async () => {
    setStatus('calendar', loadingStatus);
    try {
      const [calendar, fomc] = await Promise.allSettled([
        getFinnhubEconomicCalendar(),
        getFinnhubFedWatch(),
      ]);
      setData(prev => ({
        ...prev,
        economicCalendar: calendar.status === 'fulfilled' ? calendar.value : prev.economicCalendar,
        fomc: fomc.status === 'fulfilled' ? fomc.value : prev.fomc,
      }));
      setStatus('calendar', loadedStatus);
    } catch (e) {
      setStatus('calendar', errorStatus(e instanceof Error ? e.message : 'Failed to load'));
    }
  }, []);

  const refresh = useCallback(async () => {
    await Promise.all([
      fetchEquities(),
      fetchFX(),
      fetchCommodities(),
      fetchRatesAndYields(),
    ]);
    setLastUpdated(new Date());
  }, [fetchEquities, fetchFX, fetchCommodities, fetchRatesAndYields]);

  useEffect(() => {
    setStatus('ribbon', loadingStatus);
    const unsubscribe = subscribeWebSocket((update) => {
      setData(prev => {
        if (update.symbol === 'SPY' || update.symbol === 'CL1:COM' || update.symbol === 'XAU/USD') {
          const newRibbon = buildRibbonFromWs(ribbonBase.current);
          setStatus('ribbon', loadedStatus);
          ribbonBase.current = newRibbon;
          return { ...prev, ribbon: newRibbon };
        }
        return prev;
      });
    });

    setTimeout(() => {
      setStatuses(prev => ({
        ...prev,
        ribbon: prev.ribbon.state === 'loading' ? loadedStatus : prev.ribbon,
      }));
    }, 8000);

    return unsubscribe;
  }, []);

  useEffect(() => {
    Promise.all([
      fetchEquities(),
      fetchFX(),
      fetchCommodities(),
      fetchRatesAndYields(),
      fetchNews(),
      fetchCalendar(),
      fetchCredit(),
    ]).then(() => setLastUpdated(new Date()));

    fetchInflation(true);

    const restInterval = setInterval(() => {
      fetchEquities();
      fetchFX();
      fetchCommodities();
      setLastUpdated(new Date());
    }, TWELVE_REST_REFRESH_MS);

    const newsInterval = setInterval(fetchNews, NEWS_REFRESH_MS);

    const fredYieldsInterval = setInterval(fetchRatesAndYields, FRED_YIELDS_REFRESH_MS);

    const inflationInterval = setInterval(() => fetchInflation(false), INFLATION_CHECK_MS);

    let calendarTimer: ReturnType<typeof setTimeout>;
    function scheduleCalendar() {
      const delay = msUntilNextCalendarRefresh();
      calendarTimer = setTimeout(() => {
        fetchCalendar();
        calendarTimer = setInterval(fetchCalendar, CALENDAR_REFRESH_MS);
      }, delay);
    }
    scheduleCalendar();

    return () => {
      clearInterval(restInterval);
      clearInterval(newsInterval);
      clearInterval(fredYieldsInterval);
      clearInterval(inflationInterval);
      clearTimeout(calendarTimer);
      clearInterval(calendarTimer);
    };
  }, [fetchEquities, fetchFX, fetchCommodities, fetchRatesAndYields, fetchNews, fetchCalendar, fetchCredit, fetchInflation]);

  const retryWidget = useCallback((key: keyof WidgetStatuses) => {
    switch (key) {
      case 'equities': fetchEquities(); break;
      case 'fx': fetchFX(); break;
      case 'commodities': fetchCommodities(); break;
      case 'rates': fetchRatesAndYields(); break;
      case 'yields': fetchRatesAndYields(); break;
      case 'credit': fetchCredit(); break;
      case 'inflation': fetchInflation(true); break;
      case 'news': fetchNews(); break;
      case 'calendar': fetchCalendar(); break;
      default: break;
    }
  }, [fetchEquities, fetchFX, fetchCommodities, fetchRatesAndYields, fetchCredit, fetchInflation, fetchNews, fetchCalendar]);

  const loading = Object.values(statuses).some(s => s.state === 'loading');

  return { data, statuses, loading, lastUpdated, refresh, retryWidget };
}
