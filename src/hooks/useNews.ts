import { useState, useEffect, useCallback } from 'react';
import { NewsItem, WidgetStatus, DataSource } from '../types';
import { mockMarketData } from '../data/mockData';
import { getFinnhubNews } from '../services/finnhubService';
import { loadingStatus, loadedStatus, errorStatus, warnedStatus } from './statusUtils';

const NEWS_REFRESH_MS = 5 * 60 * 1000;

export interface NewsHookResult {
  data: NewsItem[];
  status: WidgetStatus;
  fetch: () => Promise<void>;
  lastFetched: number;
  source: DataSource;
}

export function useNews(): NewsHookResult {
  const [data, setData] = useState<NewsItem[]>(mockMarketData.news);
  const [status, setStatus] = useState<WidgetStatus>(loadingStatus);
  const [lastFetched, setLastFetched] = useState<number>(0);
  const [source, setSource] = useState<DataSource>('fallback');

  const fetch = useCallback(async () => {
    setStatus(loadingStatus);
    try {
      const result = await getFinnhubNews();
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
    const interval = setInterval(fetch, NEWS_REFRESH_MS);
    return () => clearInterval(interval);
  }, [fetch]);

  return { data, status, fetch, lastFetched, source };
}
