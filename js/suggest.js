/**
 * Smart app suggestion: rank the tiles for the number currently typed using
 * everything local — the entry's own history (last app + explicit default),
 * global app usage, and the time-of-day affinity of each app.
 * Pure functions only, so scoring is unit-testable.
 */

/** Weights: an explicit per-entry default always wins; recency beats fashion. */
const W_DEFAULT = 100;
const W_LAST_USED = 12;
const W_GLOBAL = 4;
const W_HOUR = 3;

/**
 * @param {{app?: string, lastApp?: string, count?: number, lastUsed?: number}|null} entry history entry for the typed number
 * @param {{byApp?: Record<string, number>, byHour?: Record<string, number>}} stats aggregate stats
 * @param {number} [hour] 0-23, defaults to now
 * @returns {string|null} suggested app id
 */
export function suggestApp(entry, stats, hour = new Date().getHours()) {
  const byApp = stats?.byApp ?? {};
  const byHour = stats?.byHour ?? {};
  const hourKey = String(((Number(hour) || 0) % 24 + 24) % 24);

  const globalMax = Math.max(1, ...Object.values(byApp).map(Number));
  const hourMax = Math.max(1, ...Object.values(byHour).map(Number));

  let best = null;
  let bestScore = 0;
  for (const [app, count] of Object.entries(byApp)) {
    let score = (Number(count) / globalMax) * W_GLOBAL;
    score += ((Number(byHour[hourKey]) && app === bestHourApp(byHour, hourKey) ? 1 : 0)) * W_HOUR;
    if (entry?.app === app) score += W_DEFAULT;
    if (entry?.lastApp === app) score += W_LAST_USED;
    if (score > bestScore) {
      bestScore = score;
      best = app;
    }
  }
  return best;
}

/** The app most used in this hour bucket. */
function bestHourApp(byHour, hourKey) {
  let best = null;
  let bestN = 0;
  for (const [app, n] of Object.entries(byHour)) {
    if (Number(n) > bestN) {
      bestN = Number(n);
      best = app;
    }
  }
  return best;
}

/**
 * True when the suggestion should be surfaced (meaningful signal, not a
 * one-off launch from months ago).
 * @param {string|null} appId
 * @param {{byApp?: Record<string, number>}} stats
 */
export function isConfident(appId, stats) {
  if (!appId) return false;
  return (Number(stats?.byApp?.[appId]) || 0) >= 2 || (Number(stats?.byApp?.[appId]) || 0) > 0;
}
