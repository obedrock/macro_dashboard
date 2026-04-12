import { useState, useEffect, useCallback } from 'react';
import { YieldCurveData, WidgetStatus } from '../types';
import { mockMarketData } from '../data/mockData';
import { getFredYieldCurve, getFredYieldCurveOverlays } from '../services/fredService';
import { loadingStatus, loadedStatus, errorStatus, warnedStatus } from './statusUtils';

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
      const curveResult = await getFredYieldCurve();
      if (curveResult.status === 'error') {
        setStatus(errorStatus(curveResult.error));
        return;
      }
      const baseCurve = curveResult.data;
      const overlayResult = await getFredYieldCurveOverlays(baseCurve);
      const finalCurve = overlayResult.status === 'ok' ? overlayResult.data : baseCurve;
      const warnings = [
        ...(curveResult.warnings || []),
        ...(overlayResult.status === 'ok'
          ? (overlayResult.warnings || [])
          : [{ field: 'overlays', message: 'Historical overlay unavailable' }]),
      ];
      setData(finalCurve);
      setStatus(warnings.length ? warnedStatus(warnings) : loadedStatus);
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
