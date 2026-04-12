import { useState, useEffect, useCallback } from 'react';
import { PriceItem, ResultWarning, WidgetStatus } from '../types';
import { mockMarketData } from '../data/mockData';
import { getTwelveRates } from '../services/twelveDataService';
import {
  getFredTreasuryYields,
  getFredFedFundsRate,
  getFredTipsBreakeven,
  getFredVix,
} from '../services/fredService';
import { loadingStatus, loadedStatus, errorStatus, warnedStatus } from './statusUtils';

const FRED_REFRESH_MS = 24 * 60 * 60 * 1000;

export interface RatesHookResult {
  data: PriceItem[];
  status: WidgetStatus;
  fetch: () => Promise<void>;
  y10Val: number | null;
  vix: number | null;
}

export function useRates(): RatesHookResult {
  const [data, setData] = useState<PriceItem[]>(mockMarketData.rates);
  const [status, setStatus] = useState<WidgetStatus>(loadingStatus);
  const [y10Val, setY10Val] = useState<number | null>(null);
  const [vix, setVix] = useState<number | null>(null);

  const fetch = useCallback(async () => {
    setStatus(loadingStatus);
    try {
      const [tdResult, fredYieldsResult, fedFundsResult, tipsResult, vixResult] = await Promise.all([
        getTwelveRates(),
        getFredTreasuryYields(),
        getFredFedFundsRate(),
        getFredTipsBreakeven(),
        getFredVix(),
      ]);

      const warnings: ResultWarning[] = [];
      const tdRates = tdResult.status === 'ok' ? tdResult.data : null;
      const fredYields = fredYieldsResult.status === 'ok' ? fredYieldsResult.data : null;
      const fedFundsRate = fedFundsResult.status === 'ok' ? fedFundsResult.data : null;
      const tipsBreakeven = tipsResult.status === 'ok' ? tipsResult.data : null;
      const vixVal = vixResult.status === 'ok' ? vixResult.data : null;

      if (tdResult.status === 'error') warnings.push({ field: 'twelvedata_rates', message: tdResult.error });
      if (fredYieldsResult.status === 'error') warnings.push({ field: 'fred_yields', message: fredYieldsResult.error });
      if (fedFundsResult.status === 'error') warnings.push({ field: 'fed_funds', message: fedFundsResult.error });
      if (tipsResult.status === 'error') warnings.push({ field: 'tips', message: tipsResult.error });
      if (vixResult.status === 'error') warnings.push({ field: 'vix', message: vixResult.error });

      if (tdResult.status === 'ok' && tdResult.warnings?.length) warnings.push(...tdResult.warnings);
      if (fredYieldsResult.status === 'ok' && fredYieldsResult.warnings?.length) warnings.push(...fredYieldsResult.warnings);

      if (!tdRates && !fredYields) {
        setStatus(errorStatus(warnings.map(w => w.message).join('; ')));
        return;
      }

      const fb = mockMarketData.rates;

      const y2Val = tdRates?.y2Val ?? fredYields?.y2 ?? fb[1].value;
      const y5Val = tdRates?.y5Val ?? fredYields?.y5 ?? fb[2].value;
      const computedY10Val = tdRates?.y10Val ?? fredYields?.y10 ?? fb[3].value;
      const y20Val = tdRates?.y20Val ?? fredYields?.y20 ?? fb[4].value;
      const y30Val = tdRates?.y30Val ?? fredYields?.y30 ?? fb[5].value;

      const spread2s10s = parseFloat(((computedY10Val - y2Val) * 100).toFixed(1));
      const spread2s30s = parseFloat(((y30Val - y2Val) * 100).toFixed(1));

      const rates: PriceItem[] = [
        fedFundsRate != null
          ? { ...fb[0], value: parseFloat((fedFundsRate - 0.125).toFixed(3)) }
          : fb[0],
        {
          ...fb[1],
          value: y2Val,
          change: tdRates?.y2Change ?? fb[1].change,
          changePct: tdRates?.y2Pct ?? fb[1].changePct,
        },
        { ...fb[2], value: y5Val },
        {
          ...fb[3],
          value: computedY10Val,
          change: tdRates?.y10Change ?? fb[3].change,
          changePct: tdRates?.y10Pct ?? fb[3].changePct,
        },
        { ...fb[4], value: y20Val },
        { ...fb[5], value: y30Val },
        tipsBreakeven != null ? { ...fb[6], value: tipsBreakeven } : fb[6],
        { ...fb[7], value: spread2s10s },
        { ...fb[8], value: spread2s30s },
      ];

      setData(rates);
      setY10Val(computedY10Val);
      setVix(vixVal);
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

  return { data, status, fetch, y10Val, vix };
}
