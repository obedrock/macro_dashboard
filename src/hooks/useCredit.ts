import { useState, useEffect, useCallback } from 'react';
import { WidgetStatus, TimeSeriesPoint } from '../types';
import { mockMarketData } from '../data/mockData';
import { getLiveCreditSpreads } from '../services/fredService';
import { loadingStatus, loadedStatus, errorStatus } from './statusUtils';

const FRED_REFRESH_MS = 24 * 60 * 60 * 1000;

export interface CreditHookResult {
  data: { label: string; value: number; change: number; series: TimeSeriesPoint[] }[];
  status: WidgetStatus;
  fetch: () => Promise<void>;
}

export function useCredit(): CreditHookResult {
  const [data, setData] = useState<{ label: string; value: number; change: number; series: TimeSeriesPoint[] }[]>(mockMarketData.credit);
  const [status, setStatus] = useState<WidgetStatus>(loadingStatus);

  const fetch = useCallback(async () => {
    setStatus(loadingStatus);
    try {
      const credit = await getLiveCreditSpreads();
      setData(credit);
      setStatus(loadedStatus);
    } catch (e) {
      setStatus(errorStatus(e instanceof Error ? e.message : 'Failed to load'));
    }
  }, []);

  useEffect(() => {
    fetch();
    const interval = setInterval(fetch, FRED_REFRESH_MS);
    return () => clearInterval(interval);
  }, [fetch]);

  return { data, status, fetch };
}
