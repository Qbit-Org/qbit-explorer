import { SingleFlightCache } from '../../utils/single-flight-cache';

const TTL = 60_000;
const COOLDOWN = 5_000;

interface Deferred<T> {
  promise: Promise<T>;
  resolve: (value: T) => void;
  reject: (error: unknown) => void;
}

function deferred<T>(): Deferred<T> {
  let resolve!: (value: T) => void;
  let reject!: (error: unknown) => void;
  const promise = new Promise<T>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
}

describe('SingleFlightCache', () => {
  let cache: SingleFlightCache<string>;

  beforeEach(() => {
    jest.useFakeTimers();
    cache = new SingleFlightCache<string>(TTL, COOLDOWN);
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  test('shares one computation among the callers that miss together', async () => {
    const result = deferred<string>();
    const compute = jest.fn(() => result.promise);

    const callers = Array.from({ length: 100 }, () => cache.get('key', compute));
    expect(compute).toHaveBeenCalledTimes(1);

    result.resolve('value');
    expect(await Promise.all(callers)).toEqual(Array(100).fill('value'));
    expect(compute).toHaveBeenCalledTimes(1);
  });

  test('serves a result without computing until its lifetime is up, then computes again', async () => {
    const compute = jest.fn()
      .mockResolvedValueOnce('first')
      .mockResolvedValueOnce('second');

    expect(await cache.get('key', compute)).toBe('first');

    jest.advanceTimersByTime(TTL - 1);
    expect(await cache.get('key', compute)).toBe('first');
    expect(compute).toHaveBeenCalledTimes(1);

    jest.advanceTimersByTime(1);
    expect(await cache.get('key', compute)).toBe('second');
    expect(compute).toHaveBeenCalledTimes(2);
  });

  test('counts a result\'s lifetime from the end of its computation', async () => {
    const result = deferred<string>();
    const compute = jest.fn(() => result.promise);

    const caller = cache.get('key', compute);
    jest.advanceTimersByTime(30_000);
    result.resolve('slow');
    await caller;

    jest.advanceTimersByTime(TTL - 1);
    expect(await cache.get('key', compute)).toBe('slow');
    expect(compute).toHaveBeenCalledTimes(1);
  });

  test('shares one computation among the callers that find a result expired', async () => {
    const compute = jest.fn().mockResolvedValueOnce('first');
    await cache.get('key', compute);
    jest.advanceTimersByTime(TTL);

    const refresh = deferred<string>();
    compute.mockReturnValueOnce(refresh.promise);
    const callers = Array.from({ length: 10 }, () => cache.get('key', compute));
    refresh.resolve('second');

    expect(await Promise.all(callers)).toEqual(Array(10).fill('second'));
    expect(compute).toHaveBeenCalledTimes(2);
  });

  test('computes each key on its own', async () => {
    const a = deferred<string>();
    const b = deferred<string>();
    const computeA = jest.fn(() => a.promise);
    const computeB = jest.fn(() => b.promise);

    const callerA = cache.get('a', computeA);
    const callerB = cache.get('b', computeB);
    b.resolve('b');
    expect(await callerB).toBe('b');
    a.resolve('a');
    expect(await callerA).toBe('a');

    expect(await cache.get('a', computeA)).toBe('a');
    expect(await cache.get('b', computeB)).toBe('b');
    expect(computeA).toHaveBeenCalledTimes(1);
    expect(computeB).toHaveBeenCalledTimes(1);
  });

  test('gives every caller of a failed computation its error, and stores no result', async () => {
    const result = deferred<string>();
    const compute = jest.fn(() => result.promise);
    const error = new Error('database is down');

    const callers = Array.from({ length: 100 }, () => cache.get('key', compute));
    result.reject(error);

    const outcomes = await Promise.allSettled(callers);
    expect(outcomes).toEqual(Array(100).fill({ status: 'rejected', reason: error }));
    expect(compute).toHaveBeenCalledTimes(1);
  });

  test('answers with a failure during its cooldown, then computes again', async () => {
    const error = new Error('database is down');
    const compute = jest.fn()
      .mockRejectedValueOnce(error)
      .mockResolvedValueOnce('recovered');

    await expect(cache.get('key', compute)).rejects.toBe(error);

    jest.advanceTimersByTime(COOLDOWN - 1);
    await expect(cache.get('key', compute)).rejects.toBe(error);
    expect(compute).toHaveBeenCalledTimes(1);

    jest.advanceTimersByTime(1);
    expect(await cache.get('key', compute)).toBe('recovered');
    expect(compute).toHaveBeenCalledTimes(2);

    // the failure is gone with the recovery, and the result has its full lifetime
    jest.advanceTimersByTime(TTL - 1);
    expect(await cache.get('key', compute)).toBe('recovered');
    expect(compute).toHaveBeenCalledTimes(2);
  });

  test('keeps failing once per cooldown while the computation keeps failing', async () => {
    const compute = jest.fn(async (): Promise<string> => {
      throw new Error('database is down');
    });

    for (let second = 0; second < 60; second++) {
      await Promise.allSettled(Array.from({ length: 10 }, () => cache.get('key', compute)));
      jest.advanceTimersByTime(1000);
    }

    expect(compute).toHaveBeenCalledTimes(60_000 / COOLDOWN);
  });

  test('does not serve an expired result when its refresh fails', async () => {
    const error = new Error('database is down');
    const compute = jest.fn()
      .mockResolvedValueOnce('first')
      .mockRejectedValueOnce(error)
      .mockResolvedValueOnce('second');

    expect(await cache.get('key', compute)).toBe('first');
    jest.advanceTimersByTime(TTL);

    await expect(cache.get('key', compute)).rejects.toBe(error);
    await expect(cache.get('key', compute)).rejects.toBe(error);

    jest.advanceTimersByTime(COOLDOWN);
    expect(await cache.get('key', compute)).toBe('second');
    expect(compute).toHaveBeenCalledTimes(3);
  });

  test('does not let a failing key hold up another', async () => {
    const failing = jest.fn().mockRejectedValue(new Error('database is down'));
    const working = jest.fn().mockResolvedValue('value');

    await expect(cache.get('failing', failing)).rejects.toThrow('database is down');
    expect(await cache.get('working', working)).toBe('value');
    expect(working).toHaveBeenCalledTimes(1);
  });

  test('treats a computation that throws before returning a promise as a failure', async () => {
    const compute = jest.fn<Promise<string>, []>()
      .mockImplementationOnce(() => {
        throw new Error('thrown synchronously');
      })
      .mockResolvedValueOnce('recovered');

    await expect(cache.get('key', compute)).rejects.toThrow('thrown synchronously');

    jest.advanceTimersByTime(COOLDOWN);
    expect(await cache.get('key', compute)).toBe('recovered');
    expect(compute).toHaveBeenCalledTimes(2);
  });
});
