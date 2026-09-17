import type { SessionStats, Trial } from '../types';

/** Reaction times that count toward speed statistics. */
const SCORED_OUTCOMES = new Set(['hit', 'wrong']);

export function mean(values: readonly number[]): number | null {
  if (values.length === 0) return null;
  let total = 0;
  for (const v of values) total += v;
  return total / values.length;
}

export function median(values: readonly number[]): number | null {
  if (values.length === 0) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  if (sorted.length % 2 === 1) return sorted[mid] ?? null;
  const lo = sorted[mid - 1];
  const hi = sorted[mid];
  if (lo === undefined || hi === undefined) return null;
  return (lo + hi) / 2;
}

/** Population standard deviation. Needs at least two samples to mean anything. */
export function stdDev(values: readonly number[]): number | null {
  if (values.length < 2) return null;
  const avg = mean(values);
  if (avg === null) return null;
  let sum = 0;
  for (const v of values) sum += (v - avg) ** 2;
  return Math.sqrt(sum / values.length);
}

export function minOf(values: readonly number[]): number | null {
  if (values.length === 0) return null;
  return values.reduce((a, b) => (b < a ? b : a));
}

export function maxOf(values: readonly number[]): number | null {
  if (values.length === 0) return null;
  return values.reduce((a, b) => (b > a ? b : a));
}

/** Reaction times of every trial that produced one, in trial order. */
export function scoredTimes(trials: readonly Trial[]): number[] {
  const out: number[] = [];
  for (const trial of trials) {
    if (trial.rtMs !== null && SCORED_OUTCOMES.has(trial.outcome)) out.push(trial.rtMs);
  }
  return out;
}

/**
 * Builds the stats block for a finished session.
 *
 * `accuracy` is passed in because its definition differs per mode (see the
 * README); everything else is derived the same way everywhere.
 */
export function summarise(trials: readonly Trial[], accuracy: number | null): SessionStats {
  const times = scoredTimes(trials);

  let falseStarts = 0;
  let misses = 0;
  let falseAlarms = 0;
  for (const trial of trials) {
    if (trial.outcome === 'falseStart') falseStarts++;
    else if (trial.outcome === 'miss') misses++;
    else if (trial.outcome === 'falseAlarm') falseAlarms++;
  }

  return {
    scored: times.length,
    mean: mean(times),
    median: median(times),
    best: minOf(times),
    worst: maxOf(times),
    sd: stdDev(times),
    accuracy,
    falseStarts,
    misses,
    falseAlarms,
  };
}

/** Rounds to whole milliseconds for display without ever showing `-0`. */
export function ms(value: number | null): string {
  if (value === null || !Number.isFinite(value)) return '—';
  return String(Math.round(value));
}

export function percent(value: number | null): string {
  if (value === null || !Number.isFinite(value)) return '—';
  return `${Math.round(value * 100)}%`;
}
