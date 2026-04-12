export type Provider = 'twelvedata' | 'fred' | 'finnhub';

const INITIAL_DELAY_MS = 5_000;
const MAX_DELAY_MS = 5 * 60 * 1000;
const JITTER_MS = 1_000;

interface ProviderState {
  blockedUntil: number;
  attempt: number;
}

class RateLimiter {
  private state: Record<Provider, ProviderState> = {
    twelvedata: { blockedUntil: 0, attempt: 0 },
    fred: { blockedUntil: 0, attempt: 0 },
    finnhub: { blockedUntil: 0, attempt: 0 },
  };

  isBlocked(provider: Provider): boolean {
    return Date.now() < this.state[provider].blockedUntil;
  }

  onRateLimit(provider: Provider): void {
    const s = this.state[provider];
    s.attempt += 1;
    const baseDelay = Math.min(INITIAL_DELAY_MS * Math.pow(2, s.attempt - 1), MAX_DELAY_MS);
    const jitter = Math.random() * JITTER_MS;
    s.blockedUntil = Date.now() + baseDelay + jitter;
  }

  onSuccess(provider: Provider): void {
    this.state[provider] = { blockedUntil: 0, attempt: 0 };
  }

  msUntilUnblocked(provider: Provider): number {
    return Math.max(0, this.state[provider].blockedUntil - Date.now());
  }
}

export const rateLimiter = new RateLimiter();
