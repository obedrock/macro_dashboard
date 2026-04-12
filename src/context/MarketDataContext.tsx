/* eslint-disable react-refresh/only-export-components */
import React, { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react';
import { MarketData, WidgetStatuses, WidgetStatus, WsStatus } from '../types';
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

interface MarketDataContextType {
  data: MarketData;
  statuses: WidgetStatuses;
  loading: boolean;
  lastUpdated: Date;
  refresh: () => Promise<void>;
  retryWidget: (key: keyof WidgetStatuses) => void;
  wsStatus: WsStatus;
}

const MarketDataCtx = createContext<MarketDataContextType>({
  data: mockMarketData,
  statuses: DEFAULT_STATUSES,
  loading: true,
  lastUpdated: new Date(),
  refresh: async () => {},
  retryWidget: () => {},
  wsStatus: 'connecting',
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
  const [wsStatus, setWsStatus] = useState<WsStatus>('connecting');
  const [lastUpdated, setLastUpdated] = useState<Date>(new Date());
  const ribbonBase = useRef<MarketData['ribbon']>(mockMarketData.ribbon);

  useEffect(() => {
    setRibbonStatus(loadingStatus);
    const unsubTick = wsManager.subscribe((update) => {
      if (update.symbol === 'SPY' || update.symbol === 'CL1:COM' || update.symbol === 'XAU/USD') {
        const newRibbon = buildRibbonFromWs(ribbonBase.current);
        setRibbonStatus(loadedStatus);
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
    if (rates.vix !== null) {
      setRibbonData(prev => {
        const next = [...prev];
        next[5] = { ...next[5], value: rates.vix! };
        ribbonBase.current = next;
        return next;
      });
    }
  }, [rates.vix]);

  const data: MarketData = {
    ribbon: ribbonData,
    rates: rates.data,
    equities: rates.vix !== null
      ? equities.data.map((e, i) => i === 4 ? { ...e, value: rates.vix! } : e)
      : equities.data,
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
    <MarketDataCtx.Provider value={{ data, statuses, loading, lastUpdated, refresh, retryWidget, wsStatus }}>
      {children}
    </MarketDataCtx.Provider>
  );
}

export function useMarketData() {
  return useContext(MarketDataCtx);
}
