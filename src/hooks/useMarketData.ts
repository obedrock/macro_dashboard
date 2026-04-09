import { useState, useEffect, useCallback, useRef } from 'react';
import { MarketData, WidgetStatuses, WidgetStatus } from '../types';
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
  getFredYieldCurveOverlays,
  getFredMarketSnapshot,
  applyFredSnapshot,
  getFredYieldCurve,
} from '../services/fredService';

const REST_REFRESH_MS = 60 * 1000;
const NEWS_REFRESH_MS = 5 * 60 * 1000;
const CALENDAR_REFRESH_MS = 6 * 60 * 60 * 1000;
const FRED_REFRESH_MS = 24 * 60 * 60 * 1000;

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
      const rates = await getTwelveRates();
      setData(prev => ({ ...prev, rates }));
      setStatus('rates', loadedStatus);
    } catch (e) {
      setStatus('rates', errorStatus(e instanceof Error ? e.message : 'Failed to load'));
    }
  }, []);

  const fetchFredSnapshot = useCallback(async () => {
    try {
      const snapshot = await getFredMarketSnapshot();
      setData(prev => {
        const updated = applyFredSnapshot(snapshot, {
          ribbon: prev.ribbon,
          rates: prev.rates,
          equities: prev.equities,
          commodities: prev.commodities,
        });

        ribbonBase.current = updated.ribbon;

        return {
          ...prev,
          ribbon: updated.ribbon,
          rates: updated.rates,
          equities: updated.equities,
          commodities: updated.commodities,
        };
      });
    } catch {}
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

  const fetchInflation = useCallback(async () => {
    setStatus('inflation', loadingStatus);
    try {
      const inflation = await getLiveInflation();
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
        const newRibbon = buildRibbonFromWs(ribbonBase.current);
        if (update.symbol === 'SPY' || update.symbol === 'CL1:COM' || update.symbol === 'XAU/USD') {
          setStatus('ribbon', loadedStatus);
          ribbonBase.current = newRibbon;
          return { ...prev, ribbon: newRibbon, lastUpdated: new Date() };
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
      fetchNews(),
      fetchCalendar(),
    ]).then(() => setLastUpdated(new Date()));

    fetchFredSnapshot();
    fetchYields();
    fetchCredit();
    fetchInflation();

    const restInterval = setInterval(() => {
      fetchEquities();
      fetchFX();
      fetchCommodities();
      fetchRates();
      setLastUpdated(new Date());
    }, REST_REFRESH_MS);

    const newsInterval = setInterval(fetchNews, NEWS_REFRESH_MS);
    const calendarInterval = setInterval(fetchCalendar, CALENDAR_REFRESH_MS);
    const fredInterval = setInterval(() => {
      fetchFredSnapshot();
      fetchCredit();
      fetchInflation();
      fetchYields();
    }, FRED_REFRESH_MS);

    return () => {
      clearInterval(restInterval);
      clearInterval(newsInterval);
      clearInterval(calendarInterval);
      clearInterval(fredInterval);
    };
  }, [fetchEquities, fetchFX, fetchCommodities, fetchRates, fetchNews, fetchCalendar, fetchFredSnapshot, fetchYields, fetchCredit, fetchInflation]);

  const retryWidget = useCallback((key: keyof WidgetStatuses) => {
    switch (key) {
      case 'equities': fetchEquities(); break;
      case 'fx': fetchFX(); break;
      case 'commodities': fetchCommodities(); break;
      case 'rates': fetchRates(); break;
      case 'yields': fetchYields(); break;
      case 'credit': fetchCredit(); break;
      case 'inflation': fetchInflation(); break;
      case 'news': fetchNews(); break;
      case 'calendar': fetchCalendar(); break;
      default: break;
    }
  }, [fetchEquities, fetchFX, fetchCommodities, fetchRates, fetchYields, fetchCredit, fetchInflation, fetchNews, fetchCalendar]);

  const loading = Object.values(statuses).some(s => s.state === 'loading');

  return { data, statuses, loading, lastUpdated, refresh, retryWidget };
}
