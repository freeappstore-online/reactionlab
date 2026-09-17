import { MODE_META } from '../modes';
import type { SessionRecord, SessionStats, TestMode } from '../types';

export const MAX_SCORE = 1000;

/** Speed component, 0..1, linear between the mode's floor and ceiling. */
export function speedFactor(mode: TestMode, meanMs: number | null): number {
  if (meanMs === null || !Number.isFinite(meanMs)) return 0;
  const { floorMs, ceilMs } = MODE_META[mode];
  const raw = (ceilMs - meanMs) / (ceilMs - floorMs);
  return Math.min(1, Math.max(0, raw));
}

/**
 * A single 0..1000 figure per session: `1000 x speed x accuracy`.
 *
 * Both factors are already 0..1, so the score degrades smoothly — a fast run
 * riddled with false starts cannot outrank a clean one just by being quick.
 */
export function scoreSession(mode: TestMode, stats: SessionStats): number {
  const speed = speedFactor(mode, stats.mean);
  const accuracy = stats.accuracy === null ? 1 : Math.min(1, Math.max(0, stats.accuracy));
  return Math.round(MAX_SCORE * speed * accuracy);
}

/** The headline number for a session — always "lower is better", in ms. */
export function primaryMetric(session: SessionRecord): number | null {
  return session.stats.mean;
}

export function bestSession(sessions: readonly SessionRecord[]): SessionRecord | null {
  let best: SessionRecord | null = null;
  for (const s of sessions) {
    if (best === null || s.score > best.score) best = s;
  }
  return best;
}

/** Personal best reaction time across sessions, ignoring runs with no valid trial. */
export function bestTime(sessions: readonly SessionRecord[]): number | null {
  let best: number | null = null;
  for (const s of sessions) {
    const t = s.stats.best;
    if (t !== null && (best === null || t < best)) best = t;
  }
  return best;
}

export function scoreBand(score: number): 'accent' | 'success' | 'warning' {
  if (score >= 750) return 'success';
  if (score >= 400) return 'accent';
  return 'warning';
}
