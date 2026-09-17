/**
 * The one and only place this app touches persistent storage.
 *
 * Everything ReactionLab knows about you lives in `localStorage` under the
 * `reactionlab.v1.*` keys below. There is no network layer, no analytics, no
 * cookies and no remote sync — deleting these keys deletes the whole record.
 *
 * Every read is defensive: storage can be disabled (private mode, locked-down
 * browsers), full, or hold data written by an older build, and none of those
 * may take the app down.
 */
import { isTestMode } from '../modes';
import { DATA_VERSION } from '../types';
import type {
  SessionConfig,
  SessionRecord,
  SessionStats,
  Settings,
  StreakRecord,
  TestMode,
  Trial,
  TrialOutcome,
} from '../types';

const KEYS = {
  sessions: 'reactionlab.v1.sessions',
  settings: 'reactionlab.v1.settings',
  streak: 'reactionlab.v1.streak',
} as const;

/** Newest-first cap, so a heavy user cannot grow the record without bound. */
const MAX_SESSIONS = 500;

export const DEFAULT_SETTINGS: Settings = {
  trials: 8,
  minDelayMs: 1200,
  maxDelayMs: 3500,
  perTrialFeedback: true,
  version: DATA_VERSION,
};

export const EMPTY_STREAK: StreakRecord = {
  current: 0,
  longest: 0,
  lastDay: null,
  version: DATA_VERSION,
};

export const SETTINGS_LIMITS = {
  trials: { min: 3, max: 20 },
  delayMs: { min: 500, max: 6000 },
} as const;

/* ------------------------------------------------------------- low level */

let memoryFallback: Map<string, string> | null = null;

/**
 * Returns the real `localStorage`, or `null` if it is unavailable. Accessing
 * `window.localStorage` itself throws in some privacy configurations, so even
 * the probe is wrapped.
 */
function store(): Storage | null {
  try {
    const ls = window.localStorage;
    const probe = '__reactionlab_probe__';
    ls.setItem(probe, '1');
    ls.removeItem(probe);
    return ls;
  } catch {
    return null;
  }
}

let cachedStore: Storage | null | undefined;

function storage(): Storage | null {
  if (cachedStore === undefined) cachedStore = store();
  return cachedStore;
}

/** True when scores will actually survive a reload. Surfaced in the UI. */
export function isPersistent(): boolean {
  return storage() !== null;
}

function readRaw(key: string): string | null {
  const ls = storage();
  if (ls === null) return memoryFallback?.get(key) ?? null;
  try {
    return ls.getItem(key);
  } catch {
    return null;
  }
}

/** @returns false when the write could not be persisted (quota, private mode). */
function writeRaw(key: string, value: string): boolean {
  const ls = storage();
  if (ls === null) {
    memoryFallback ??= new Map();
    memoryFallback.set(key, value);
    return false;
  }
  try {
    ls.setItem(key, value);
    return true;
  } catch {
    return false;
  }
}

function removeRaw(key: string): void {
  memoryFallback?.delete(key);
  const ls = storage();
  if (ls === null) return;
  try {
    ls.removeItem(key);
  } catch {
    /* nothing sensible to do */
  }
}

function parseJson(key: string): unknown {
  const raw = readRaw(key);
  if (raw === null) return null;
  try {
    return JSON.parse(raw) as unknown;
  } catch {
    // Corrupt entry: drop it rather than fail every future read.
    removeRaw(key);
    return null;
  }
}

/* ------------------------------------------------------------- validation */

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function num(value: unknown, fallback: number): number {
  return typeof value === 'number' && Number.isFinite(value) ? value : fallback;
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

const OUTCOMES: readonly TrialOutcome[] = [
  'hit',
  'wrong',
  'miss',
  'falseAlarm',
  'correctReject',
  'falseStart',
];

function parseTrial(value: unknown, index: number): Trial | null {
  if (!isRecord(value)) return null;
  const outcome = value['outcome'];
  if (typeof outcome !== 'string' || !OUTCOMES.includes(outcome as TrialOutcome)) return null;
  const rt = value['rtMs'];
  return {
    index: num(value['index'], index),
    outcome: outcome as TrialOutcome,
    rtMs: typeof rt === 'number' && Number.isFinite(rt) ? rt : null,
  };
}

function parseStats(value: unknown): SessionStats {
  const v = isRecord(value) ? value : {};
  const optional = (key: string): number | null => {
    const n = v[key];
    return typeof n === 'number' && Number.isFinite(n) ? n : null;
  };
  return {
    scored: num(v['scored'], 0),
    mean: optional('mean'),
    median: optional('median'),
    best: optional('best'),
    worst: optional('worst'),
    sd: optional('sd'),
    accuracy: optional('accuracy'),
    falseStarts: num(v['falseStarts'], 0),
    misses: num(v['misses'], 0),
    falseAlarms: num(v['falseAlarms'], 0),
  };
}

function parseConfig(value: unknown): SessionConfig {
  const v = isRecord(value) ? value : {};
  return {
    trials: num(v['trials'], DEFAULT_SETTINGS.trials),
    minDelayMs: num(v['minDelayMs'], DEFAULT_SETTINGS.minDelayMs),
    maxDelayMs: num(v['maxDelayMs'], DEFAULT_SETTINGS.maxDelayMs),
  };
}

function parseSession(value: unknown): SessionRecord | null {
  if (!isRecord(value)) return null;

  const mode = value['mode'];
  if (typeof mode !== 'string' || !isTestMode(mode)) return null;

  const id = value['id'];
  const rawTrials = value['trials'];
  const trials = Array.isArray(rawTrials)
    ? rawTrials.map(parseTrial).filter((t): t is Trial => t !== null)
    : [];

  return {
    id: typeof id === 'string' && id.length > 0 ? id : createId(),
    mode,
    startedAt: num(value['startedAt'], 0),
    durationMs: num(value['durationMs'], 0),
    trials,
    stats: parseStats(value['stats']),
    score: clamp(Math.round(num(value['score'], 0)), 0, 1000),
    config: parseConfig(value['config']),
    version: DATA_VERSION,
  };
}

/* ------------------------------------------------------------ change feed */

type Listener = () => void;
const listeners = new Set<Listener>();

/** Subscribe to any mutation made through this module. */
export function subscribe(listener: Listener): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

function emit(): void {
  for (const listener of listeners) listener();
}

/* ---------------------------------------------------------------- sessions */

let sessionCache: readonly SessionRecord[] | null = null;

export function loadSessions(): readonly SessionRecord[] {
  if (sessionCache !== null) return sessionCache;
  const parsed = parseJson(KEYS.sessions);
  const list = Array.isArray(parsed)
    ? parsed.map(parseSession).filter((s): s is SessionRecord => s !== null)
    : [];
  // Newest first is the order every screen wants.
  list.sort((a, b) => b.startedAt - a.startedAt);
  sessionCache = list;
  return sessionCache;
}

export function loadSessionsFor(mode: TestMode): readonly SessionRecord[] {
  return loadSessions().filter((s) => s.mode === mode);
}

function persistSessions(next: readonly SessionRecord[]): void {
  sessionCache = next;
  writeRaw(KEYS.sessions, JSON.stringify(next));
  emit();
}

/** Saves a finished run and folds it into the streak. Returns the stored record. */
export function saveSession(session: SessionRecord): SessionRecord {
  const next = [session, ...loadSessions()].slice(0, MAX_SESSIONS);
  persistSessions(next);
  recordActivity(session.startedAt);
  return session;
}

export function deleteSession(id: string): void {
  persistSessions(loadSessions().filter((s) => s.id !== id));
}

/* ---------------------------------------------------------------- settings */

let settingsCache: Settings | null = null;

export function loadSettings(): Settings {
  if (settingsCache !== null) return settingsCache;
  const parsed = parseJson(KEYS.settings);
  settingsCache = normaliseSettings(isRecord(parsed) ? parsed : {});
  return settingsCache;
}

/** Clamps every field into range and repairs an inverted delay window. */
export function normaliseSettings(input: Record<string, unknown>): Settings {
  const { trials, delayMs } = SETTINGS_LIMITS;

  const minDelayMs = clamp(
    Math.round(num(input['minDelayMs'], DEFAULT_SETTINGS.minDelayMs)),
    delayMs.min,
    delayMs.max,
  );
  const maxDelayMs = clamp(
    Math.round(num(input['maxDelayMs'], DEFAULT_SETTINGS.maxDelayMs)),
    minDelayMs,
    delayMs.max,
  );

  return {
    trials: clamp(Math.round(num(input['trials'], DEFAULT_SETTINGS.trials)), trials.min, trials.max),
    minDelayMs,
    maxDelayMs,
    perTrialFeedback:
      typeof input['perTrialFeedback'] === 'boolean'
        ? input['perTrialFeedback']
        : DEFAULT_SETTINGS.perTrialFeedback,
    version: DATA_VERSION,
  };
}

export function saveSettings(patch: Partial<Settings>): Settings {
  const next = normaliseSettings({ ...loadSettings(), ...patch });
  settingsCache = next;
  writeRaw(KEYS.settings, JSON.stringify(next));
  emit();
  return next;
}

/* ------------------------------------------------------------------ streak */

export function dayKey(epochMs: number): string {
  const d = new Date(epochMs);
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${d.getFullYear()}-${month}-${day}`;
}

function daysBetween(from: string, to: string): number {
  const a = Date.parse(`${from}T00:00:00`);
  const b = Date.parse(`${to}T00:00:00`);
  if (Number.isNaN(a) || Number.isNaN(b)) return Number.NaN;
  return Math.round((b - a) / 86_400_000);
}

let streakCache: StreakRecord | null = null;

export function loadStreak(): StreakRecord {
  if (streakCache !== null) return streakCache;
  const parsed = parseJson(KEYS.streak);
  if (!isRecord(parsed)) {
    streakCache = EMPTY_STREAK;
    return streakCache;
  }
  const lastDay = parsed['lastDay'];
  streakCache = {
    current: Math.max(0, Math.round(num(parsed['current'], 0))),
    longest: Math.max(0, Math.round(num(parsed['longest'], 0))),
    lastDay: typeof lastDay === 'string' && lastDay.length === 10 ? lastDay : null,
    version: DATA_VERSION,
  };
  return streakCache;
}

/**
 * Folds a completed session's day into the streak: same day is a no-op, the
 * next calendar day extends it, any longer gap restarts it at 1.
 */
export function recordActivity(epochMs: number): StreakRecord {
  const today = dayKey(epochMs);
  const prev = loadStreak();

  let current: number;
  if (prev.lastDay === null) current = 1;
  else if (prev.lastDay === today) current = Math.max(1, prev.current);
  else if (daysBetween(prev.lastDay, today) === 1) current = prev.current + 1;
  else current = 1;

  const next: StreakRecord = {
    current,
    longest: Math.max(prev.longest, current),
    lastDay: today,
    version: DATA_VERSION,
  };
  streakCache = next;
  writeRaw(KEYS.streak, JSON.stringify(next));
  emit();
  return next;
}

/**
 * The streak as it stands *now* — a stored streak goes stale once more than a
 * day has passed without a session, and displaying the stale number would lie.
 */
export function currentStreak(now: number = Date.now()): number {
  const streak = loadStreak();
  if (streak.lastDay === null) return 0;
  const gap = daysBetween(streak.lastDay, dayKey(now));
  if (Number.isNaN(gap) || gap > 1) return 0;
  return streak.current;
}

/* -------------------------------------------------------------- lifecycle */

export interface ExportBundle {
  readonly app: 'reactionlab';
  readonly version: typeof DATA_VERSION;
  readonly exportedAt: string;
  readonly settings: Settings;
  readonly streak: StreakRecord;
  readonly sessions: readonly SessionRecord[];
}

/** Builds the download payload. Nothing here ever leaves the device on its own. */
export function exportAll(): ExportBundle {
  return {
    app: 'reactionlab',
    version: DATA_VERSION,
    exportedAt: new Date().toISOString(),
    settings: loadSettings(),
    streak: loadStreak(),
    sessions: loadSessions(),
  };
}

/** Removes every ReactionLab key. Irreversible, and the UI confirms first. */
export function clearAll(): void {
  for (const key of Object.values(KEYS)) removeRaw(key);
  sessionCache = null;
  settingsCache = null;
  streakCache = null;
  emit();
}

export function clearSessions(): void {
  persistSessions([]);
}

/** Cryptographically random where available, time-based only as a fallback. */
export function createId(): string {
  const c: Crypto | undefined = globalThis.crypto;
  if (c !== undefined && typeof c.randomUUID === 'function') return c.randomUUID();
  return `s-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}

/** Approximate bytes held under the ReactionLab keys, for the settings screen. */
export function storageFootprint(): number {
  let total = 0;
  for (const key of Object.values(KEYS)) {
    total += (readRaw(key)?.length ?? 0) * 2; // UTF-16 code units
  }
  return total;
}
