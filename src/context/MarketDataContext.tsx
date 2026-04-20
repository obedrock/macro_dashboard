/* eslint-disable react-refresh/only-export-components */
import React, { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react';
import { MarketData, WidgetStatuses, WidgetStatus, WsStatus, DataSource, WidgetTimestamps, WidgetSources } from '../types';
import { mockMarketData } from '../data/mockData';
import { wsManager } from '../services/wsManager';
import { buildRibbonFromWs } from '../services/twelveDataService';
import { useEquities } from '../hooks/useEquities';
import { useFX } from '../hooks/useFX';
import { useCommodities } from '../hooks/useCommodities';
import { useRates } from '../hooks/useRates';
import { useYields } from '../hooks/useYields';
import { useCredit } from '../hooks/useCredit';
import { useInflation } from '../hooks/useInflation';
import { useNews } from '../hooks/useNews';
import { useCalendar } from '../hooks/useCalendar';
import { loadingStatus, loadedStatus } from '../hooks/statusUtils';

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

const DEFAULT_TIMESTAMPS: WidgetTimestamps = {
  ribbon: 0, equities: 0, fx: 0, commodities: 0, rates: 0,
  yields: 0, credit: 0, inflation: 0, news: 0, calendar: 0,
};

const DEFAULT_SOURCES: WidgetSources = {
  ribbon: 'fallback', equities: 'fallback', fx: 'fallback', commodities: 'fallback',
  rates: 'fallback', yields: 'fallback', credit: 'fallback', inflation: 'fallback',
  news: 'fallback', calendar: 'fallback',
};

interface MarketDataContextType {
  data: MarketData;
  statuses: WidgetStatuses;
  loading: boolean;
  lastUpdated: Date;
  refresh: () => Promise<void>;
  retryWidget: (key: keyof WidgetStatuses) => void;
  wsStatus: WsStatus;
  widgetTimestamps: WidgetTimestamps;
  widgetSources: WidgetSources;
  now: number;
}

const MarketDataCtx = createContext<MarketDataContextType>({
  data: mockMarketData,
  statuses: DEFAULT_STATUSES,
  loading: true,
  lastUpdated: new Date(),
  refresh: async () => {},
  retryWidget: () => {},
  wsStatus: 'connecting',
  widgetTimestamps: DEFAULT_TIMESTAMPS,
  widgetSources: DEFAULT_SOURCES,
  now: Date.now(),
});

export function MarketDataProvider({ children }: { children: React.ReactNode }) {
  const equities = useEquities();
  const fx = useFX();
  const commodities = useCommodities();
  const rates = useRates();
  const yields = useYields();
  const credit = useCredit();
  const inflation = useInflation();
  const news = useNews();
  const calendar = useCalendar();

  const equitiesFetch = equities.fetch;
  const fxFetch = fx.fetch;
  const commoditiesFetch = commodities.fetch;
  const ratesFetch = rates.fetch;
  const yieldsFetch = yields.fetch;
  const creditFetch = credit.fetch;
  const inflationFetch = inflation.fetch;
  const newsFetch = news.fetch;
  const calendarFetch = calendar.fetch;

  const [ribbonData, setRibbonData] = useState<MarketData['ribbon']>(mockMarketData.ribbon);
  const [ribbonStatus, setRibbonStatus] = useState<WidgetStatus>(loadingStatus);
  const [ribbonLastFetched, setRibbonLastFetched] = useState<number>(0);
  const [wsStatus, setWsStatus] = useState<WsStatus>('connecting');
  const [lastUpdated, setLastUpdated] = useState<Date>(new Date());
  const [now, setNow] = useState<number>(Date.now());
  const ribbonBase = useRef<MarketData['ribbon']>(mockMarketData.ribbon);

  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 30_000);
    return () => clearInterval(id);
  }, []);

  useEffect(() => {
    setRibbonStatus(loadingStatus);
    const unsubTick = wsManager.subscribe((update) => {
      if (update.symbol === 'SPY' || update.symbol === 'CL1:COM' || update.symbol === 'XAU/USD') {
        const newRibbon = buildRibbonFromWs(ribbonBase.current);
        setRibbonStatus(loadedStatus);
        setRibbonLastFetched(Date.now());
        ribbonBase.current = newRibbon;
        setRibbonData(newRibbon);
      }
    });
    const unsubStatus = wsManager.onStatusChange(setWsStatus);

    setTimeout(() => {
      setRibbonStatus(prev => prev.state === 'loading' ? loadedStatus : prev);
    }, 8000);

    return () => {
      unsubTick();
      unsubStatus();
    };
  }, []);

  // Sync ribbon from REST data so ticker strip matches cards
  // Ribbon layout: [0] S&P 500 (SPY), [1] 10Y Yield, [2] DXY, [3] WTI, [4] Gold, [5] VIX
  useEffect(() => {
    setRibbonData(prev => {
      const next = [...prev];
      // SPY from equities
      const spy = equities.data[0];
      if (spy && spy.value !== mockMarketData.equities[0].value) {
        next[0] = { ...next[0], value: spy.value, change: spy.change, changePct: spy.changePct };
      }
      // VIX from equities
      const vix = equities.data[4];
      if (vix && vix.value !== mockMarketData.equities[4].value) {
        next[5] = { ...next[5], value: vix.value, change: vix.change, changePct: vix.changePct };
      }
      ribbonBase.current = next;
      return next;
    });
  }, [equities.data]);

  useEffect(() => {
    if (rates.y10Val !== null) {
      setRibbonData(prev => {
        const next = [...prev];
        next[1] = { ...next[1], value: rates.y10Val! };
        ribbonBase.current = next;
        return next;
      });
    }
  }, [rates.y10Val]);

  useEffect(() => {
    // DXY from FX hook (index 0)
    const dxy = fx.data[0];
    if (dxy && dxy.value !== mockMarketData.fx[0].value) {
      setRibbonData(prev => {
        const next = [...prev];
        next[2] = { ...next[2], value: dxy.value, change: dxy.change, changePct: dxy.changePct };
        ribbonBase.current = next;
        return next;
      });
    }
  }, [fx.data]);

  useEffect(() => {
    // WTI from commodities hook (index 0), Gold (index 3)
    const wti = commodities.data[0];
    const gold = commodities.data[3];
    setRibbonData(prev => {
      const next = [...prev];
      if (wti && wti.value !== mockMarketData.commodities[0].value) {
        next[3] = { ...next[3], value: wti.value, change: wti.change, changePct: wti.changePct };
      }
      if (gold && gold.value !== mockMarketData.commodities[3].value) {
        next[4] = { ...next[4], value: gold.value, change: gold.change, changePct: gold.changePct };
      }
      ribbonBase.current = next;
      return next;
    });
  }, [commodities.data]);

  const data: MarketData = {
    ribbon: ribbonData,
    rates: rates.data,
    equities: equities.data,
    fx: fx.data,
    commodities: commodities.data,
    credit: credit.data,
    inflation: inflation.data,
    yieldCurve: yields.data,
    news: news.data,
    fomc: calendar.data.fomc,
    economicCalendar: calendar.data.economicCalendar,
    lastUpdated,
  };

  const statuses: WidgetStatuses = {
    ribbon: ribbonStatus,
    equities: equities.status,
    fx: fx.status,
    commodities: commodities.status,
    rates: rates.status,
    yields: yields.status,
    credit: credit.status,
    inflation: inflation.status,
    news: news.status,
    calendar: calendar.status,
  };

  const widgetTimestamps: WidgetTimestamps = {
    ribbon: ribbonLastFetched,
    equities: equities.lastFetched,
    fx: fx.lastFetched,
    commodities: commodities.lastFetched,
    rates: rates.lastFetched,
    yields: yields.lastFetched,
    credit: credit.lastFetched,
    inflation: inflation.lastFetched,
    news: news.lastFetched,
    calendar: calendar.lastFetched,
  };

  const widgetSources: WidgetSources = {
    ribbon: wsStatus === 'connected' ? 'live' : 'fallback' as DataSource,
    equities: equities.source,
    fx: fx.source,
    commodities: commodities.source,
    rates: rates.source,
    yields: yields.source,
    credit: credit.source,
    inflation: inflation.source,
    news: news.source,
    calendar: calendar.source,
  };

  const loading = Object.values(statuses).some(s => s.state === 'loading');

  const refresh = useCallback(async () => {
    await Promise.all([
      equitiesFetch(),
      fxFetch(),
      commoditiesFetch(),
      ratesFetch(),
    ]);
    setLastUpdated(new Date());
  }, [equitiesFetch, fxFetch, commoditiesFetch, ratesFetch]);

  const retryWidget = useCallback((key: keyof WidgetStatuses) => {
    switch (key) {
      case 'equities': equitiesFetch(); break;
      case 'fx': fxFetch(); break;
      case 'commodities': commoditiesFetch(); break;
      case 'rates': ratesFetch(); break;
      case 'yields': yieldsFetch(); break;
      case 'credit': creditFetch(); break;
      case 'inflation': inflationFetch(true); break;
      case 'news': newsFetch(); break;
      case 'calendar': calendarFetch(); break;
      default: break;
    }
  }, [equitiesFetch, fxFetch, commoditiesFetch, ratesFetch, yieldsFetch, creditFetch, inflationFetch, newsFetch, calendarFetch]);

  return (
    <MarketDataCtx.Provider value={{ data, statuses, loading, lastUpdated, refresh, retryWidget, wsStatus, widgetTimestamps, widgetSources, now }}>
      {children}
    </MarketDataCtx.Provider>
  );
}

export function useMarketData() {
  return useContext(MarketDataCtx);
}
