interface CachedValue<T> {
  value: T;
  expiresAt: number;
}

interface CachedFailure {
  error: unknown;
  retryAt: number;
}

/**
 * Caches the result of an expensive asynchronous computation per key, and runs at most one
 * computation per key at a time.
 *
 * - A result is served for `ttlMs` from the moment its computation finished. It expires when it is
 *   next read, so no timer runs.
 * - A caller that misses while its key is being computed shares that computation and its outcome
 *   instead of starting another.
 * - A failed computation stores no result. Its key answers with the same error for
 *   `failureCooldownMs`, so that the callers arriving during an outage don't each start a
 *   computation, and the first call after that computes again.
 *
 * Nothing removes a key, so callers must draw their keys from a fixed set.
 */
export class SingleFlightCache<T> {
  private values = new Map<string, CachedValue<T>>();
  private failures = new Map<string, CachedFailure>();
  private inFlight = new Map<string, Promise<T>>();

  constructor(
    private ttlMs: number,
    private failureCooldownMs: number,
  ) {}

  public get(key: string, compute: () => Promise<T>): Promise<T> {
    const cached = this.values.get(key);
    if (cached && Date.now() < cached.expiresAt) {
      return Promise.resolve(cached.value);
    }

    const running = this.inFlight.get(key);
    if (running) {
      return running;
    }

    const failure = this.failures.get(key);
    if (failure && Date.now() < failure.retryAt) {
      return Promise.reject(failure.error);
    }

    const computation = this.$compute(key, compute);
    this.inFlight.set(key, computation);
    // Registered after the computation is stored, so this runs however it ends, and before any
    // caller sees the outcome: a caller that asks again right away never finds a settled promise.
    const clear = (): void => {
      this.inFlight.delete(key);
    };
    computation.then(clear, clear);
    return computation;
  }

  private async $compute(key: string, compute: () => Promise<T>): Promise<T> {
    try {
      const value = await compute();
      this.values.set(key, { value, expiresAt: Date.now() + this.ttlMs });
      this.failures.delete(key);
      return value;
    } catch (e) {
      this.failures.set(key, { error: e, retryAt: Date.now() + this.failureCooldownMs });
      throw e;
    }
  }
}
