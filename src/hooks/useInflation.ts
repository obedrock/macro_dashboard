import { useState, useEffect, useCallback, useRef } from 'react';
import { WidgetStatus } from '../types';
import { mockMarketData } from '../data/mockData';
import { getLiveInflation, InflationItem } from '../services/fredService';
import { loadingStatus, loadedStatus, errorStatus } from './statusUtils';

const INFLATION_CHECK_MS = 24 * 60 * 60 * 1000;

export interface InflationHookResult {
  data: InflationItem[];
  status: WidgetStatus;
  fetch: (forceRefresh?: boolean) => Promise<void>;
}

export function useInflation(): InflationHookResult {
  const [data, setData] = useState<InflationItem[]>(mockMarketData.inflation);
  const [status, setStatus] = useState<WidgetStatus>(loadingStatus);
  const lastInflationDate = useRef<string>('');

  const fetch = useCallback(async (forceRefresh = false) => {
    setStatus(loadingStatus);
    try {
      const inflation = await getLiveInflation();
      const latestDate = inflation[0]?.dataThrough ?? '';

      if (!forceRefresh && latestDate && latestDate === lastInflationDate.current) {
        setStatus(loadedStatus);
        return;
      }

      lastInflationDate.current = latestDate;
      setData(inflation);
      setStatus(loadedStatus);
    } catch (e) {
      setStatus(errorStatus(e instanceof Error ? e.message : 'Failed to load'));
    }
  }, []);

  useEffect(() => {
    fetch(true);
    const interval = setInterval(() => fetch(false), INFLATION_CHECK_MS);
    return () => clearInterval(interval);
  }, [fetch]);

  return { data, status, fetch };
}
