const SECONDS_PER_DAY = 24 * 60 * 60;

export const TIMESPAN_SECONDS: Record<string, number> = {
  '24h': SECONDS_PER_DAY,
  '3d': 3 * SECONDS_PER_DAY,
  '1w': 7 * SECONDS_PER_DAY,
  '1m': 30 * SECONDS_PER_DAY,
  '3m': 90 * SECONDS_PER_DAY,
  '6m': 180 * SECONDS_PER_DAY,
  '1y': 365 * SECONDS_PER_DAY,
  '2y': 2 * 365 * SECONDS_PER_DAY,
  '3y': 3 * 365 * SECONDS_PER_DAY,
};

export function expectedBlocksForSeconds(seconds: number, targetSpacingSeconds: number): number {
  const spacingSeconds = targetSpacingSeconds > 0 ? targetSpacingSeconds : 60;
  return Math.ceil(seconds / spacingSeconds);
}

export function expectedBlocksForTimespan(timespan: string, targetSpacingSeconds: number): number {
  return expectedBlocksForSeconds(TIMESPAN_SECONDS[timespan] ?? 0, targetSpacingSeconds);
}
