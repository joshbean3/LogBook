import { ProviderError, type ProviderId } from './types.js';

/**
 * A token bucket shared by every account on one provider: Strava allows 100 reads per 15 minutes per app, whoever the
 * athlete is, so the budget is global. `take` spends one call or throws `rate_limited`; a 429 from the provider blocks
 * the bucket for the rest of the window (`backoff`). Pure (an injectable clock), so it is tested without waiting.
 */
export class TokenBucket {
  private stamps: number[] = [];
  private blockedUntil = 0;
  constructor(
    private readonly provider: ProviderId,
    readonly limit: number,
    readonly windowMs: number,
    private readonly now: () => number = Date.now,
  ) {}

  /** Calls left in the current window (0 while backing off). */
  remaining(): number {
    const t = this.now();
    if (t < this.blockedUntil) return 0;
    this.stamps = this.stamps.filter((s) => s > t - this.windowMs);
    return Math.max(0, this.limit - this.stamps.length);
  }

  take(): void {
    const t = this.now();
    if (t < this.blockedUntil) throw new ProviderError(`${this.provider} rate limit reached. Try again in ${Math.ceil((this.blockedUntil - t) / 60_000)} min.`, 'rate_limited', this.provider);
    if (this.remaining() <= 0) throw new ProviderError(`${this.provider} rate limit reached. Try again in a few minutes.`, 'rate_limited', this.provider);
    this.stamps.push(t);
  }

  /** The provider said 429: stop every account's calls until the window turns. */
  backoff(ms = this.windowMs): void {
    this.blockedUntil = Math.max(this.blockedUntil, this.now() + ms);
  }

  reset(): void {
    this.stamps = [];
    this.blockedUntil = 0;
  }
}

/** Strava: 100 reads per 15 minutes per application; 90 leaves room for the webhook's own fetches. */
export const stravaBucket = new TokenBucket('strava', 90, 15 * 60_000);
export const corosBucket = new TokenBucket('coros', 90, 15 * 60_000);
