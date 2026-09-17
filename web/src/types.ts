/** Schema version for everything persisted by `services/storage.ts`. */
export const DATA_VERSION = 1;

export type TestMode = 'simple' | 'choice' | 'gonogo' | 'aim';

export const TEST_MODES: readonly TestMode[] = ['simple', 'choice', 'gonogo', 'aim'];

/**
 * What happened on a single stimulus.
 *
 * - `hit`            responded correctly (RT recorded)
 * - `wrong`          responded, but to the wrong target (RT recorded)
 * - `miss`           a go stimulus that got no response inside the window
 * - `falseAlarm`     responded to a no-go stimulus
 * - `correctReject`  correctly withheld on a no-go stimulus
 * - `falseStart`     responded before the stimulus appeared
 */
export type TrialOutcome = 'hit' | 'wrong' | 'miss' | 'falseAlarm' | 'correctReject' | 'falseStart';

export interface Trial {
  /** 0-based position within the session. False starts share the index they interrupted. */
  readonly index: number;
  readonly outcome: TrialOutcome;
  /** Milliseconds from stimulus onset to input; `null` when no input was made. */
  readonly rtMs: number | null;
}

export interface SessionStats {
  /** Trials with a usable reaction time (`hit` or `wrong`). */
  readonly scored: number;
  readonly mean: number | null;
  readonly median: number | null;
  readonly best: number | null;
  readonly worst: number | null;
  /** Population standard deviation of the scored reaction times. */
  readonly sd: number | null;
  /** 0..1 — meaning is mode-specific, see README. `null` when not applicable. */
  readonly accuracy: number | null;
  readonly falseStarts: number;
  readonly misses: number;
  readonly falseAlarms: number;
}

export interface SessionRecord {
  readonly id: string;
  readonly mode: TestMode;
  /** Wall-clock epoch ms. Used only for grouping/display, never for measurement. */
  readonly startedAt: number;
  /** Total elapsed time of the run, from `performance.now()` deltas. */
  readonly durationMs: number;
  readonly trials: readonly Trial[];
  readonly stats: SessionStats;
  /** 0..1000, see `services/scoring.ts`. */
  readonly score: number;
  readonly config: SessionConfig;
  readonly version: typeof DATA_VERSION;
}

/** The knobs a session was run with, snapshotted so old records stay meaningful. */
export interface SessionConfig {
  readonly trials: number;
  readonly minDelayMs: number;
  readonly maxDelayMs: number;
}

export interface Settings {
  /** Stimuli per session (targets per session for Aim, which uses 2x this). */
  readonly trials: number;
  readonly minDelayMs: number;
  readonly maxDelayMs: number;
  /** Show the millisecond result after every individual trial. */
  readonly perTrialFeedback: boolean;
  readonly version: typeof DATA_VERSION;
}

export interface StreakRecord {
  readonly current: number;
  readonly longest: number;
  /** Local calendar day of the most recent completed session, as `YYYY-MM-DD`. */
  readonly lastDay: string | null;
  readonly version: typeof DATA_VERSION;
}

export interface TestModeMeta {
  readonly id: TestMode;
  readonly name: string;
  readonly tagline: string;
  readonly description: string;
  /** What the headline number on the results screen measures. */
  readonly primaryLabel: string;
  readonly primaryUnit: string;
  /** Reaction times at or below this score full marks for speed. */
  readonly floorMs: number;
  /** Reaction times at or above this score zero for speed. */
  readonly ceilMs: number;
  /** How the accuracy figure is derived, for the results screen and README. */
  readonly accuracyLabel: string | null;
}
