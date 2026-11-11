/**
 * An HTTP error's status code and, when it can be trusted, its status text, such as "400 Bad Request".
 * HTTP/2 has no status text, and Angular's XHR backend fills in 'OK' instead, so 'OK' is trusted only on a 200.
 */
export function httpErrorStatus(e: { status?: number, statusText?: string } | null | undefined): string {
  const statusText = e?.statusText === 'OK' && e.status !== 200 ? '' : e?.statusText;
  return [e?.status, statusText].filter((part) => part !== undefined && part !== null && part !== '').join(' ');
}

/**
 * Whether a transaction page should wait for a transaction it failed to load, tracking it over the websocket:
 * the backend doesn't have it yet (404), or its node can't look it up yet (503: under the none and electrum
 * backends, qbitd's txindex is disabled or still building).
 */
export function isAwaitableTransactionError(e: { status?: number } | null | undefined): boolean {
  return e?.status === 404 || e?.status === 503;
}
