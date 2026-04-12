import { useState, useEffect, useCallback } from 'react';
import { PriceItem, WidgetStatus } from '../types';
import { mockMarketData } from '../data/mockData';
import { getTwelveEquities } from '../services/twelveDataService';
import { loadingStatus, loadedStatus, errorStatus } from './statusUtils';

const TWELVE_REST_REFRESH_MS = 60 * 1000;

export interface EquitiesHookResult {
  data: PriceItem[];
  status: WidgetStatus;
  fetch: () => Promise<void>;
}

export function useEquities(): EquitiesHookResult {
  const [data, setData] = useState<PriceItem[]>(mockMarketData.equities);
  const [status, setStatus] = useState<WidgetStatus>(loadingStatus);

  const fetch = useCallback(async () => {
    setStatus(loadingStatus);
    try {
      const equities = await getTwelveEquities();
      setData(equities);
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
