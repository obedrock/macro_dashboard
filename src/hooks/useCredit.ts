import { useState, useEffect, useCallback } from 'react';
import { WidgetStatus, TimeSeriesPoint, DataSource } from '../types';
import { mockMarketData } from '../data/mockData';
import { getLiveCreditSpreads } from '../services/fredService';
import { loadingStatus, loadedStatus, errorStatus, warnedStatus } from './statusUtils';

const FRED_REFRESH_MS = 24 * 60 * 60 * 1000;

export interface CreditHookResult {
  data: { label: string; value: number; change: number; series: TimeSeriesPoint[] }[];
  status: WidgetStatus;
  fetch: () => Promise<void>;
  lastFetched: number;
  source: DataSource;
}

export function useCredit(): CreditHookResult {
  const [data, setData] = useState<{ label: string; value: number; change: number; series: TimeSeriesPoint[] }[]>(mockMarketData.credit);
  const [status, setStatus] = useState<WidgetStatus>(loadingStatus);
  const [lastFetched, setLastFetched] = useState<number>(0);
  const [source, setSource] = useState<DataSource>('fallback');

  const fetch = useCallback(async () => {
    setStatus(loadingStatus);
    try {
      const result = await getLiveCreditSpreads();
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
    const interval = setInterval(fetch, FRED_REFRESH_MS);
    return () => clearInterval(interval);
  }, [fetch]);

  return { data, status, fetch, lastFetched, source };
}
