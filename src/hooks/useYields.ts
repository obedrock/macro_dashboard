import { useState, useEffect, useCallback } from 'react';
import { YieldCurveData, WidgetStatus } from '../types';
import { mockMarketData } from '../data/mockData';
import { getFredYieldCurve, getFredYieldCurveOverlays } from '../services/fredService';
import { loadingStatus, loadedStatus, errorStatus } from './statusUtils';

const FRED_REFRESH_MS = 24 * 60 * 60 * 1000;

export interface YieldsHookResult {
  data: YieldCurveData[];
  status: WidgetStatus;
  fetch: () => Promise<void>;
}

export function useYields(): YieldsHookResult {
  const [data, setData] = useState<YieldCurveData[]>(mockMarketData.yieldCurve);
  const [status, setStatus] = useState<WidgetStatus>(loadingStatus);

  const fetch = useCallback(async () => {
    setStatus(loadingStatus);
    try {
      const fredCurve = await getFredYieldCurve();
      const baseCurve = fredCurve ?? mockMarketData.yieldCurve;
      const overlaid = await getFredYieldCurveOverlays(baseCurve).catch(() => baseCurve);
      setData(overlaid);
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
