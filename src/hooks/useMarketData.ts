import { useState, useEffect, useCallback, useRef } from 'react';
import { MarketData, WidgetStatuses, WidgetStatus, PriceItem, ResultWarning, WsStatus } from '../types';
import { mockMarketData } from '../data/mockData';
import {
  getTwelveEquities,
  getTwelveFX,
  getTwelveCommodities,
  getTwelveRates,
  buildRibbonFromWs,
} from '../services/twelveDataService';
import { wsManager } from '../services/wsManager';
import {
  getFinnhubNews,
  getFinnhubEconomicCalendar,
  getFinnhubFedWatch,
} from '../services/finnhubService';
import {
  getLiveCreditSpreads,
  getLiveInflation,
  getFredFedFundsRate,
  getFredVix,
  getFredTipsBreakeven,
  getFredTreasuryYields,
  getFredYieldCurve,
  getFredYieldCurveOverlays,
} from '../services/fredService';

const TWELVE_REST_REFRESH_MS = 60 * 1000;
const NEWS_REFRESH_MS = 5 * 60 * 1000;
const CALENDAR_REFRESH_MS = 2 * 60 * 60 * 1000;
const INFLATION_CHECK_MS = 24 * 60 * 60 * 1000;
const FRED_REFRESH_MS = 24 * 60 * 60 * 1000;

function msUntilNextCalendarRefresh(): number {
  const now = new Date();

  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: 'America/New_York',
    hour: 'numeric',
    minute: 'numeric',
    second: 'numeric',
    hour12: false,
  }).formatToParts(now);

  const etHour = parseInt(parts.find(p => p.type === 'hour')!.value, 10) % 24;
  const etMinute = parseInt(parts.find(p => p.type === 'minute')!.value, 10);
  const etSecond = parseInt(parts.find(p => p.type === 'second')!.value, 10);

  const etSecondsNow = etHour * 3600 + etMinute * 60 + etSecond;
  const target835 = 8 * 3600 + 35 * 60;

  const msTo835 = etSecondsNow < target835
    ? (target835 - etSecondsNow) * 1000
    : (86400 - etSecondsNow + target835) * 1000;

  const msToTwoHour = CALENDAR_REFRESH_MS - (now.getTime() % CALENDAR_REFRESH_MS);
  return Math.min(msTo835, msToTwoHour);
}

const loadingStatus: WidgetStatus = { state: 'loading' };
const loadedStatus: WidgetStatus = { state: 'loaded' };
function errorStatus(msg: string): WidgetStatus {
  return { state: 'error', error: msg };
}
function warnedStatus(warnings: ResultWarning[]): WidgetStatus {
  return { state: 'loaded', error: warnings.map(w => w.message).join('; ') };
}

const DEFAULT_STATUSES: WidgetStatuses = {
  ribbon: loadingStatus,
  equities: loadingStatus,
  fx: loadingStatus,
  commodities: loadingStatus,
  rates: loadingStatus,
  yields: loadingStatus,
  credit: loadingStatus,
  inflation: loadingStatus,
  news: loadingStatus,
  calendar: loadingStatus,
};

export function useMarketData() {
  const [data, setData] = useState<MarketData>(mockMarketData);
  const [statuses, setStatuses] = useState<WidgetStatuses>(DEFAULT_STATUSES);
  const [lastUpdated, setLastUpdated] = useState<Date>(new Date());
  const [wsStatus, setWsStatus] = useState<WsStatus>('connecting');
  const ribbonBase = useRef<MarketData['ribbon']>(mockMarketData.ribbon);
  const lastInflationDate = useRef<string>('');

  function setStatus(key: keyof WidgetStatuses, status: WidgetStatus) {
    setStatuses(prev => ({ ...prev, [key]: status }));
  }

  const fetchEquities = useCallback(async () => {
    setStatus('equities', loadingStatus);
    try {
      const result = await getTwelveEquities();
      if (result.status === 'error') {
        setStatus('equities', errorStatus(result.error));
        return;
      }
      setData(prev => ({ ...prev, equities: result.data }));
      setStatus('equities', result.warnings?.length ? warnedStatus(result.warnings) : loadedStatus);
    } catch (e) {
      setStatus('equities', errorStatus(e instanceof Error ? e.message : 'Failed to load'));
    }
  }, []);

  const fetchFX = useCallback(async () => {
    setStatus('fx', loadingStatus);
    try {
      const result = await getTwelveFX();
      if (result.status === 'error') {
        setStatus('fx', errorStatus(result.error));
        return;
      }
      setData(prev => ({ ...prev, fx: result.data }));
      setStatus('fx', result.warnings?.length ? warnedStatus(result.warnings) : loadedStatus);
    } catch (e) {
      setStatus('fx', errorStatus(e instanceof Error ? e.message : 'Failed to load'));
    }
  }, []);

  const fetchCommodities = useCallback(async () => {
    setStatus('commodities', loadingStatus);
    try {
      const result = await getTwelveCommodities();
      if (result.status === 'error') {
        setStatus('commodities', errorStatus(result.error));
        return;
      }
      setData(prev => ({ ...prev, commodities: result.data }));
      setStatus('commodities', result.warnings?.length ? warnedStatus(result.warnings) : loadedStatus);
    } catch (e) {
      setStatus('commodities', errorStatus(e instanceof Error ? e.message : 'Failed to load'));
    }
  }, []);

  const fetchRates = useCallback(async () => {
    setStatus('rates', loadingStatus);
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
      const vix = vixResult.status === 'ok' ? vixResult.data : null;

      if (tdResult.status === 'error') warnings.push({ field: 'twelvedata_rates', message: tdResult.error });
      if (fredYieldsResult.status === 'error') warnings.push({ field: 'fred_yields', message: fredYieldsResult.error });
      if (fedFundsResult.status === 'error') warnings.push({ field: 'fed_funds', message: fedFundsResult.error });
      if (tipsResult.status === 'error') warnings.push({ field: 'tips', message: tipsResult.error });
      if (vixResult.status === 'error') warnings.push({ field: 'vix', message: vixResult.error });

      if (tdResult.status === 'ok' && tdResult.warnings?.length) warnings.push(...tdResult.warnings);
      if (fredYieldsResult.status === 'ok' && fredYieldsResult.warnings?.length) warnings.push(...fredYieldsResult.warnings);

      if (!tdRates && !fredYields) {
        setStatus('rates', errorStatus(warnings.map(w => w.message).join('; ')));
        return;
      }

      const fb = mockMarketData.rates;

      const y2Val = tdRates?.y2Val ?? fredYields?.y2 ?? fb[1].value;
      const y5Val = tdRates?.y5Val ?? fredYields?.y5 ?? fb[2].value;
      const y10Val = tdRates?.y10Val ?? fredYields?.y10 ?? fb[3].value;
      const y20Val = tdRates?.y20Val ?? fredYields?.y20 ?? fb[4].value;
      const y30Val = tdRates?.y30Val ?? fredYields?.y30 ?? fb[5].value;

      const spread2s10s = parseFloat(((y10Val - y2Val) * 100).toFixed(1));
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
          value: y10Val,
          change: tdRates?.y10Change ?? fb[3].change,
          changePct: tdRates?.y10Pct ?? fb[3].changePct,
        },
        { ...fb[4], value: y20Val },
        { ...fb[5], value: y30Val },
        tipsBreakeven != null ? { ...fb[6], value: tipsBreakeven } : fb[6],
        { ...fb[7], value: spread2s10s },
        { ...fb[8], value: spread2s30s },
      ];

      const ribbon = [...ribbonBase.current];
      ribbon[1] = { ...ribbon[1], value: y10Val };
      if (vix != null) ribbon[5] = { ...ribbon[5], value: vix };
      ribbonBase.current = ribbon;

      setData(prev => ({
        ...prev,
        rates,
        ribbon,
        equities: vix != null
          ? prev.equities.map((e, i) => i === 4 ? { ...e, value: vix } : e)
          : prev.equities,
      }));

      setStatus('rates', warnings.length ? warnedStatus(warnings) : loadedStatus);
    } catch (e) {
      setStatus('rates', errorStatus(e instanceof Error ? e.message : 'Failed to load'));
    }
  }, []);

  const fetchYields = useCallback(async () => {
    setStatus('yields', loadingStatus);
    try {
      const curveResult = await getFredYieldCurve();
      if (curveResult.status === 'error') {
        setStatus('yields', errorStatus(curveResult.error));
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
      setData(prev => ({ ...prev, yieldCurve: finalCurve }));
      setStatus('yields', warnings.length ? warnedStatus(warnings) : loadedStatus);
    } catch (e) {
      setStatus('yields', errorStatus(e instanceof Error ? e.message : 'Failed to load'));
    }
  }, []);

  const fetchCredit = useCallback(async () => {
    setStatus('credit', loadingStatus);
    try {
      const result = await getLiveCreditSpreads();
      if (result.status === 'error') {
        setStatus('credit', errorStatus(result.error));
        return;
      }
      setData(prev => ({ ...prev, credit: result.data }));
      setStatus('credit', result.warnings?.length ? warnedStatus(result.warnings) : loadedStatus);
    } catch (e) {
      setStatus('credit', errorStatus(e instanceof Error ? e.message : 'Failed to load'));
    }
  }, []);

  const fetchInflation = useCallback(async (forceRefresh = false) => {
    setStatus('inflation', loadingStatus);
    try {
      const result = await getLiveInflation();
      if (result.status === 'error') {
        setStatus('inflation', errorStatus(result.error));
        return;
      }
      const inflation = result.data;
      const latestDate = inflation[0]?.dataThrough ?? '';

      if (!forceRefresh && latestDate && latestDate === lastInflationDate.current) {
        setStatus('inflation', loadedStatus);
        return;
      }

      lastInflationDate.current = latestDate;
      setData(prev => ({ ...prev, inflation }));
      setStatus('inflation', result.warnings?.length ? warnedStatus(result.warnings) : loadedStatus);
    } catch (e) {
      setStatus('inflation', errorStatus(e instanceof Error ? e.message : 'Failed to load'));
    }
  }, []);

  const fetchNews = useCallback(async () => {
    setStatus('news', loadingStatus);
    try {
      const result = await getFinnhubNews();
      if (result.status === 'error') {
        setStatus('news', errorStatus(result.error));
        return;
      }
      setData(prev => ({ ...prev, news: result.data }));
      setStatus('news', result.warnings?.length ? warnedStatus(result.warnings) : loadedStatus);
    } catch (e) {
      setStatus('news', errorStatus(e instanceof Error ? e.message : 'Failed to load'));
    }
  }, []);

  const fetchCalendar = useCallback(async () => {
    setStatus('calendar', loadingStatus);
    try {
      const [calResult, fomcResult] = await Promise.all([
        getFinnhubEconomicCalendar(),
        getFinnhubFedWatch(),
      ]);

      const warnings: ResultWarning[] = [];
      const calData = calResult.status === 'ok' ? calResult.data : null;
      const fomcData = fomcResult.status === 'ok' ? fomcResult.data : null;

      if (calResult.status === 'error') warnings.push({ field: 'calendar', message: calResult.error });
      if (fomcResult.status === 'error') warnings.push({ field: 'fomc', message: fomcResult.error });
      if (calResult.status === 'ok' && calResult.warnings?.length) warnings.push(...calResult.warnings);
      if (fomcResult.status === 'ok' && fomcResult.warnings?.length) warnings.push(...fomcResult.warnings);

      if (!calData && !fomcData) {
        setStatus('calendar', errorStatus(warnings.map(w => w.message).join('; ')));
        return;
      }

      setData(prev => ({
        ...prev,
        ...(calData && { economicCalendar: calData }),
        ...(fomcData && { fomc: fomcData }),
      }));
      setStatus('calendar', warnings.length ? warnedStatus(warnings) : loadedStatus);
    } catch (e) {
      setStatus('calendar', errorStatus(e instanceof Error ? e.message : 'Failed to load'));
    }
  }, []);

  const refresh = useCallback(async () => {
    await Promise.all([
      fetchEquities(),
      fetchFX(),
      fetchCommodities(),
      fetchRates(),
    ]);
    setLastUpdated(new Date());
  }, [fetchEquities, fetchFX, fetchCommodities, fetchRates]);

  useEffect(() => {
    setStatus('ribbon', loadingStatus);
    const unsubTick = wsManager.subscribe((update) => {
      setData(prev => {
        if (update.symbol === 'SPY' || update.symbol === 'CL1:COM' || update.symbol === 'XAU/USD') {
          const newRibbon = buildRibbonFromWs(ribbonBase.current);
          setStatus('ribbon', loadedStatus);
          ribbonBase.current = newRibbon;
          return { ...prev, ribbon: newRibbon };
        }
        return prev;
      });
    });
    const unsubStatus = wsManager.onStatusChange(setWsStatus);

    setTimeout(() => {
      setStatuses(prev => ({
        ...prev,
        ribbon: prev.ribbon.state === 'loading' ? loadedStatus : prev.ribbon,
      }));
    }, 8000);

    return () => {
      unsubTick();
      unsubStatus();
    };
  }, []);

  useEffect(() => {
    Promise.all([
      fetchEquities(),
      fetchFX(),
      fetchCommodities(),
      fetchRates(),
      fetchYields(),
      fetchNews(),
      fetchCalendar(),
      fetchCredit(),
    ]).then(() => setLastUpdated(new Date()));

    fetchInflation(true);

    const restInterval = setInterval(() => {
      fetchEquities();
      fetchFX();
      fetchCommodities();
      setLastUpdated(new Date());
    }, TWELVE_REST_REFRESH_MS);

    const newsInterval = setInterval(fetchNews, NEWS_REFRESH_MS);

    const fredInterval = setInterval(() => {
      fetchRates();
      fetchYields();
      fetchCredit();
    }, FRED_REFRESH_MS);

    const inflationInterval = setInterval(() => fetchInflation(false), INFLATION_CHECK_MS);

    let calendarTimer: ReturnType<typeof setTimeout> | ReturnType<typeof setInterval>;
    function scheduleCalendar() {
      const delay = msUntilNextCalendarRefresh();
      calendarTimer = setTimeout(() => {
        fetchCalendar();
        calendarTimer = setInterval(fetchCalendar, CALENDAR_REFRESH_MS);
      }, delay);
    }
    scheduleCalendar();

    return () => {
      clearInterval(restInterval);
      clearInterval(newsInterval);
      clearInterval(fredInterval);
      clearInterval(inflationInterval);
      clearTimeout(calendarTimer as ReturnType<typeof setTimeout>);
      clearInterval(calendarTimer as ReturnType<typeof setInterval>);
    };
  }, [fetchEquities, fetchFX, fetchCommodities, fetchRates, fetchYields, fetchNews, fetchCalendar, fetchCredit, fetchInflation]);

  const retryWidget = useCallback((key: keyof WidgetStatuses) => {
    switch (key) {
      case 'equities': fetchEquities(); break;
      case 'fx': fetchFX(); break;
      case 'commodities': fetchCommodities(); break;
      case 'rates': fetchRates(); break;
      case 'yields': fetchYields(); break;
      case 'credit': fetchCredit(); break;
      case 'inflation': fetchInflation(true); break;
      case 'news': fetchNews(); break;
      case 'calendar': fetchCalendar(); break;
      default: break;
    }
  }, [fetchEquities, fetchFX, fetchCommodities, fetchRates, fetchYields, fetchCredit, fetchInflation, fetchNews, fetchCalendar]);

  const loading = Object.values(statuses).some(s => s.state === 'loading');

  return { data, statuses, loading, lastUpdated, refresh, retryWidget, wsStatus };
}
