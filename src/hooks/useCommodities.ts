import { useState, useEffect, useCallback } from 'react';
import { PriceItem, WidgetStatus } from '../types';
import { mockMarketData } from '../data/mockData';
import { getTwelveCommodities } from '../services/twelveDataService';
import { loadingStatus, loadedStatus, errorStatus } from './statusUtils';

const TWELVE_REST_REFRESH_MS = 60 * 1000;

export interface CommoditiesHookResult {
  data: PriceItem[];
  status: WidgetStatus;
  fetch: () => Promise<void>;
}

export function useCommodities(): CommoditiesHookResult {
  const [data, setData] = useState<PriceItem[]>(mockMarketData.commodities);
  const [status, setStatus] = useState<WidgetStatus>(loadingStatus);

  const fetch = useCallback(async () => {
    setStatus(loadingStatus);
    try {
      const commodities = await getTwelveCommodities();
      setData(commodities);
      setStatus(loadedStatus);
    } catch (e) {
      setStatus(errorStatus(e instanceof Error ? e.message : 'Failed to load'));
    }
  }, []);

  useEffect(() => {
    fetch();
    const interval = setInterval(fetch, TWELVE_REST_REFRESH_MS);
    return () => clearInterval(interval);
  }, [fetch]);

  return { data, status, fetch };
}
