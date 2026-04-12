import { useState, useEffect, useCallback, useRef } from 'react';
import { WidgetStatus, DataSource } from '../types';
import { mockMarketData } from '../data/mockData';
import { InflationItem } from '../services/fredService';
import { getBlsInflation } from '../services/blsService';
import { loadingStatus, loadedStatus, errorStatus, warnedStatus } from './statusUtils';

const INFLATION_CHECK_MS = 24 * 60 * 60 * 1000;

export interface InflationHookResult {
  data: InflationItem[];
  status: WidgetStatus;
  fetch: (forceRefresh?: boolean) => Promise<void>;
  lastFetched: number;
  source: DataSource;
}

export function useInflation(): InflationHookResult {
  const [data, setData] = useState<InflationItem[]>(mockMarketData.inflation);
  const [status, setStatus] = useState<WidgetStatus>(loadingStatus);
  const [lastFetched, setLastFetched] = useState<number>(0);
  const [source, setSource] = useState<DataSource>('fallback');
  const lastInflationDate = useRef<string>('');

  const fetch = useCallback(async (forceRefresh = false) => {
    setStatus(loadingStatus);
    try {
      const result = await getBlsInflation();
      if (result.status === 'error') {
        setStatus(errorStatus(result.error));
        return;
      }
      const inflation = result.data;
      const latestDate = inflation[0]?.dataThrough ?? '';

      if (!forceRefresh && latestDate && latestDate === lastInflationDate.current) {
        setStatus(loadedStatus);
        return;
      }

      lastInflationDate.current = latestDate;
      setData(inflation);
      setLastFetched(Date.now());
      setSource(result.source);
      setStatus(result.warnings?.length ? warnedStatus(result.warnings) : loadedStatus);
    } catch (e) {
      setStatus(errorStatus(e instanceof Error ? e.message : 'Failed to load'));
    }
  }, []);

  useEffect(() => {
    fetch(true);
    const interval = setInterval(() => fetch(false), INFLATION_CHECK_MS);
    return () => clearInterval(interval);
  }, [fetch]);

  return { data, status, fetch, lastFetched, source };
}
