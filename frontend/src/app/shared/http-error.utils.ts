/**
 * An HTTP error's status code and, when it can be trusted, its status text, such as "400 Bad Request".
 * HTTP/2 has no status text, and Angular's XHR backend fills in 'OK' instead, so 'OK' is trusted only on a 200.
 */
export function httpErrorStatus(e: { status?: number, statusText?: string } | null | undefined): string {
  const statusText = e?.statusText === 'OK' && e.status !== 200 ? '' : e?.statusText;
  return [e?.status, statusText].filter((part) => part !== undefined && part !== null && part !== '').join(' ');
}
