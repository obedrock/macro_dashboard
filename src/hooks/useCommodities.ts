import { useState, useEffect, useCallback } from 'react';
import { PriceItem, WidgetStatus, DataSource } from '../types';
import { mockMarketData } from '../data/mockData';
import { getTwelveCommodities } from '../services/twelveDataService';
import { loadingStatus, loadedStatus, errorStatus, warnedStatus } from './statusUtils';

const TWELVE_REST_REFRESH_MS = 60 * 1000;

export interface CommoditiesHookResult {
  data: PriceItem[];
  status: WidgetStatus;
  fetch: () => Promise<void>;
  lastFetched: number;
  source: DataSource;
}

export function useCommodities(): CommoditiesHookResult {
  const [data, setData] = useState<PriceItem[]>(mockMarketData.commodities);
  const [status, setStatus] = useState<WidgetStatus>(loadingStatus);
  const [lastFetched, setLastFetched] = useState<number>(0);
  const [source, setSource] = useState<DataSource>('fallback');

  const fetch = useCallback(async () => {
    setStatus(loadingStatus);
    try {
      const result = await getTwelveCommodities();
      if (result.status === 'error') {
        setStatus(errorStatus(result.error));
        return;
      }
      setData(result.data);
      setLastFetched(Date.now());
      setSource(result.source);
      setStatus(result.warnings?.length ? warnedStatus(result.warnings) : loadedStatus);
    } catch (e) {
      setStatus(errorStatus(e instanceof Error ? e.message : 'Failed to load'));
    }
  }, []);

  useEffect(() => {
    fetch();
    const interval = setInterval(fetch, TWELVE_REST_REFRESH_MS);
    return () => clearInterval(interval);
  }, [fetch]);

  return { data, status, fetch, lastFetched, source };
}
