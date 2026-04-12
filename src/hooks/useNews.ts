import { useState, useEffect, useCallback } from 'react';
import { NewsItem, WidgetStatus } from '../types';
import { mockMarketData } from '../data/mockData';
import { getFinnhubNews } from '../services/finnhubService';
import { loadingStatus, loadedStatus, errorStatus } from './statusUtils';

const NEWS_REFRESH_MS = 5 * 60 * 1000;

export interface NewsHookResult {
  data: NewsItem[];
  status: WidgetStatus;
  fetch: () => Promise<void>;
}

export function useNews(): NewsHookResult {
  const [data, setData] = useState<NewsItem[]>(mockMarketData.news);
  const [status, setStatus] = useState<WidgetStatus>(loadingStatus);

  const fetch = useCallback(async () => {
    setStatus(loadingStatus);
    try {
      const news = await getFinnhubNews();
      setData(news);
      setStatus(loadedStatus);
    } catch (e) {
      setStatus(errorStatus(e instanceof Error ? e.message : 'Failed to load'));
    }
  }, []);

  useEffect(() => {
    fetch();
    const interval = setInterval(fetch, NEWS_REFRESH_MS);
    return () => clearInterval(interval);
  }, [fetch]);

  return { data, status, fetch };
}
