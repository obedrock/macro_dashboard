interface CacheEntry<T> {
  data: T;
  expiresAt: number;
}

class DataCache {
  private store = new Map<string, CacheEntry<unknown>>();

  set<T>(key: string, data: T, ttlMs: number): void {
    this.store.set(key, { data, expiresAt: Date.now() + ttlMs });
  }

  get<T>(key: string): T | null {
    const entry = this.store.get(key);
    if (!entry) return null;
    if (Date.now() > entry.expiresAt) {
      this.store.delete(key);
      return null;
    }
    return entry.data as T;
  }

  invalidate(key: string): void {
    this.store.delete(key);
  }
}

export const cache = new DataCache();

export const TTL = {
  TWELVEDATA_REST: 60 * 1000,
  FINNHUB: 5 * 60 * 1000,
  FINNHUB_CALENDAR: 6 * 60 * 60 * 1000,
  FRED: 24 * 60 * 60 * 1000,
};
