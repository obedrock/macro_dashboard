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
  getFredVix,
  getFredTipsBreakeven,
  getFredTreasuryYields,
  getFredYieldCurve,
  getFredYieldCurveOverlays,
} from '../services/fredService';

const TWELVE_REST_REFRESH_MS = 60 * 1000;
const NEWS_REFRESH_MS = 5 * 60 * 1000;
const CALENDAR_REFRESH_MS = 2 * 60 * 60 * 1000;
const INFLATION_CHECK_MS = 24 * 60 * 60 * 1000;
const FRED_REFRESH_MS = 24 * 60 * 60 * 1000;

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

  const fetchRates = useCallback(async () => {
    setStatus('rates', loadingStatus);
    try {
      const [tdRates, fredYields, fedFundsRate, tipsBreakeven, vix] = await Promise.all([
        getTwelveRates(),
        getFredTreasuryYields(),
        getFredFedFundsRate(),
        getFredTipsBreakeven(),
        getFredVix(),
      ]);

      const fb = mockMarketData.rates;

      const y2Val = tdRates.y2Val ?? fredYields.y2 ?? fb[1].value;
      const y5Val = tdRates.y5Val ?? fredYields.y5 ?? fb[2].value;
      const y10Val = tdRates.y10Val ?? fredYields.y10 ?? fb[3].value;
      const y20Val = tdRates.y20Val ?? fredYields.y20 ?? fb[4].value;
      const y30Val = tdRates.y30Val ?? fredYields.y30 ?? fb[5].value;

      const spread2s10s = parseFloat(((y10Val - y2Val) * 100).toFixed(1));
      const spread2s30s = parseFloat(((y30Val - y2Val) * 100).toFixed(1));

      const rates: PriceItem[] = [
        fedFundsRate != null
          ? { ...fb[0], value: parseFloat((fedFundsRate - 0.125).toFixed(3)) }
          : fb[0],
        {
          ...fb[1],
          value: y2Val,
          change: tdRates.y2Change ?? fb[1].change,
          changePct: tdRates.y2Pct ?? fb[1].changePct,
        },
        { ...fb[2], value: y5Val },
        {
          ...fb[3],
          value: y10Val,
          change: tdRates.y10Change ?? fb[3].change,
          changePct: tdRates.y10Pct ?? fb[3].changePct,
        },
        { ...fb[4], value: y20Val },
        { ...fb[5], value: y30Val },
        tipsBreakeven != null ? { ...fb[6], value: tipsBreakeven } : fb[6],
        { ...fb[7], value: spread2s10s },
        { ...fb[8], value: spread2s30s },
      ];

      const ribbon = [...ribbonBase.current];
      ribbon[1] = { ...ribbon[1], value: y10Val };
      if (vix != null) ribbon[5] = { ...ribbon[5], value: vix };
      ribbonBase.current = ribbon;

      setData(prev => ({
        ...prev,
        rates,
        ribbon,
        equities: vix != null
          ? prev.equities.map((e, i) => i === 4 ? { ...e, value: vix } : e)
          : prev.equities,
      }));

      setStatus('rates', loadedStatus);
    } catch (e) {
      setStatus('rates', errorStatus(e instanceof Error ? e.message : 'Failed to load'));
    }
  }, []);

  const fetchYields = useCallback(async () => {
    setStatus('yields', loadingStatus);
    try {
      const fredCurve = await getFredYieldCurve();
      const baseCurve = fredCurve ?? mockMarketData.yieldCurve;
      const overlaid = await getFredYieldCurveOverlays(baseCurve).catch(() => baseCurve);
      setData(prev => ({ ...prev, yieldCurve: overlaid }));
      setStatus('yields', loadedStatus);
    } catch (e) {
      setStatus('yields', errorStatus(e instanceof Error ? e.message : 'Failed to load'));
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
      const latestDate = inflation[0]?.dataThrough ?? '';

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
      fetchRates(),
    ]);
    setLastUpdated(new Date());
  }, [fetchEquities, fetchFX, fetchCommodities, fetchRates]);

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
      fetchRates(),
      fetchYields(),
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

    const fredInterval = setInterval(() => {
      fetchRates();
      fetchYields();
      fetchCredit();
    }, FRED_REFRESH_MS);

    const inflationInterval = setInterval(() => fetchInflation(false), INFLATION_CHECK_MS);

    let calendarTimer: ReturnType<typeof setTimeout> | ReturnType<typeof setInterval>;
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
      clearInterval(fredInterval);
      clearInterval(inflationInterval);
      clearTimeout(calendarTimer as ReturnType<typeof setTimeout>);
      clearInterval(calendarTimer as ReturnType<typeof setInterval>);
    };
  }, [fetchEquities, fetchFX, fetchCommodities, fetchRates, fetchYields, fetchNews, fetchCalendar, fetchCredit, fetchInflation]);

  const retryWidget = useCallback((key: keyof WidgetStatuses) => {
    switch (key) {
      case 'equities': fetchEquities(); break;
      case 'fx': fetchFX(); break;
      case 'commodities': fetchCommodities(); break;
      case 'rates': fetchRates(); break;
      case 'yields': fetchYields(); break;
      case 'credit': fetchCredit(); break;
      case 'inflation': fetchInflation(true); break;
      case 'news': fetchNews(); break;
      case 'calendar': fetchCalendar(); break;
      default: break;
    }
  }, [fetchEquities, fetchFX, fetchCommodities, fetchRates, fetchYields, fetchCredit, fetchInflation, fetchNews, fetchCalendar]);

  const loading = Object.values(statuses).some(s => s.state === 'loading');

  return { data, statuses, loading, lastUpdated, refresh, retryWidget };
}
