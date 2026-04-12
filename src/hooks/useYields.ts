import { useState, useEffect, useCallback } from 'react';
import { YieldCurveData, WidgetStatus, DataSource } from '../types';
import { mockMarketData } from '../data/mockData';
import { getTreasuryYieldCurve, getTreasuryYieldCurveOverlays } from '../services/treasuryService';
import { loadingStatus, loadedStatus, errorStatus, warnedStatus } from './statusUtils';

const FRED_REFRESH_MS = 24 * 60 * 60 * 1000;

export interface YieldsHookResult {
  data: YieldCurveData[];
  status: WidgetStatus;
  fetch: () => Promise<void>;
  lastFetched: number;
  source: DataSource;
}

export function useYields(): YieldsHookResult {
  const [data, setData] = useState<YieldCurveData[]>(mockMarketData.yieldCurve);
  const [status, setStatus] = useState<WidgetStatus>(loadingStatus);
  const [lastFetched, setLastFetched] = useState<number>(0);
  const [source, setSource] = useState<DataSource>('fallback');

  const fetch = useCallback(async () => {
    setStatus(loadingStatus);
    try {
      const curveResult = await getTreasuryYieldCurve();
      if (curveResult.status === 'error') {
        setStatus(errorStatus(curveResult.error));
        return;
      }
      const baseCurve = curveResult.data;
      const overlayResult = await getTreasuryYieldCurveOverlays(baseCurve);
      const finalCurve = overlayResult.status === 'ok' ? overlayResult.data : baseCurve;
      const warnings = [
        ...(curveResult.warnings || []),
        ...(overlayResult.status === 'ok'
          ? (overlayResult.warnings || [])
          : [{ field: 'overlays', message: 'Historical overlay unavailable' }]),
      ];
      setData(finalCurve);
      setLastFetched(Date.now());
      setSource(warnings.length > 0 ? 'partial' : 'live');
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

  return { data, status, fetch, lastFetched, source };
}
