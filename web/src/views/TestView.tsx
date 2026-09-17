import { useCallback, useMemo, useState } from 'react';
import { MODE_META } from '../modes';
import { DATA_VERSION } from '../types';
import type { SessionRecord, TestMode } from '../types';
import { summarise } from '../services/stats';
import { scoreSession } from '../services/scoring';
import { createId, isPersistent, loadSessionsFor, saveSession } from '../services/storage';
import { useSessions, useSettings } from '../hooks/useStore';
import { MODE_ICON } from '../components/Shell';
import { Icon } from '../components/Icon';
import { Results } from '../components/Results';
import { Sparkline } from '../components/Sparkline';
import type { SparklinePoint } from '../components/Sparkline';
import type { TestOutcome } from '../tests/shared';
import { SimpleTest } from '../tests/SimpleTest';
import { ChoiceTest } from '../tests/ChoiceTest';
import { GoNoGoTest } from '../tests/GoNoGoTest';
import { AimTest } from '../tests/AimTest';

const ENGINES = {
  simple: SimpleTest,
  choice: ChoiceTest,
  gonogo: GoNoGoTest,
  aim: AimTest,
} as const;

const HOW_TO: Readonly<Record<TestMode, readonly string[]>> = {
  simple: [
    'The panel stays dark for an unpredictable moment.',
    'The instant it turns blue, tap it or hit Space.',
    'Responding before it changes is a false start and the trial is retried.',
  ],
  choice: [
    'Four targets sit dark along the panel.',
    'One lights up — hit that target, by tap or by its letter key.',
    'Hitting the wrong one still records a time, but counts against accuracy.',
  ],
  gonogo: [
    'A blue panel means go: respond immediately.',
    'A red panel means no-go: do nothing at all and wait it out.',
    'Roughly one stimulus in three is a no-go.',
  ],
  aim: [
    'A target appears somewhere in the panel. Click or tap it.',
    'The next one appears the moment the last is hit.',
    'Time is measured from one hit to the next, so misses cost you.',
  ],
};

interface TestViewProps {
  readonly mode: TestMode;
  readonly onHome: () => void;
  readonly onHistory: () => void;
}

type Phase =
  | { readonly name: 'intro' }
  | { readonly name: 'running'; readonly runId: number }
  | { readonly name: 'done'; readonly session: SessionRecord; readonly before: readonly SessionRecord[] };

export function TestView({ mode, onHome, onHistory }: TestViewProps): React.ReactElement {
  const meta = MODE_META[mode];
  const [settings] = useSettings();
  const allSessions = useSessions();
  const [phase, setPhase] = useState<Phase>({ name: 'intro' });

  const history = useMemo(
    () => allSessions.filter((s) => s.mode === mode),
    [allSessions, mode],
  );

  const Engine = ENGINES[mode];

  const handleComplete = useCallback(
    (outcome: TestOutcome) => {
      // Snapshot the prior runs before saving, so "personal best" on the
      // results screen compares against history rather than against itself.
      const before = loadSessionsFor(mode);
      const stats = summarise(outcome.trials, outcome.accuracy);
      const session: SessionRecord = {
        id: createId(),
        mode,
        startedAt: Date.now(),
        durationMs: outcome.durationMs,
        trials: outcome.trials,
        stats,
        score: scoreSession(mode, stats),
        config: {
          trials: settings.trials,
          minDelayMs: settings.minDelayMs,
          maxDelayMs: settings.maxDelayMs,
        },
        version: DATA_VERSION,
      };
      saveSession(session);
      setPhase({ name: 'done', session, before });
    },
    [mode, settings.maxDelayMs, settings.minDelayMs, settings.trials],
  );

  const start = useCallback(() => {
    // A fresh key on every run resets the engine's refs without extra plumbing.
    setPhase({ name: 'running', runId: Date.now() });
  }, []);

  if (phase.name === 'running') {
    return (
      <div className="runner">
        <Engine key={phase.runId} settings={settings} onComplete={handleComplete} />
        <div className="row">
          <button
            type="button"
            className="btn btn--ghost btn--sm"
            onClick={() => {
              setPhase({ name: 'intro' });
            }}
          >
            Quit this run — nothing is saved
          </button>
        </div>
      </div>
    );
  }

  if (phase.name === 'done') {
    return (
      <Results
        session={phase.session}
        previous={phase.before}
        onRetry={start}
        onHome={onHome}
        onHistory={onHistory}
        persisted={isPersistent()}
      />
    );
  }

  const points: readonly SparklinePoint[] = history
    .filter((s) => s.stats.mean !== null)
    .slice(0, 20)
    .reverse()
    .map((s) => ({
      value: s.stats.mean ?? 0,
      label: new Date(s.startedAt).toLocaleDateString(undefined, {
        month: 'short',
        day: 'numeric',
      }),
    }));

  return (
    <div className="view">
      <div className="view__head">
        <div className="row">
          <span className="testcard__icon">
            <Icon name={MODE_ICON[mode]} />
          </span>
          <h1>{meta.name}</h1>
        </div>
        <p>{meta.description}</p>
      </div>

      <section className="card stack">
        <h2 className="card__title">How it runs</h2>
        <ol className="stack" style={{ margin: 0, paddingLeft: '1.1rem' }}>
          {HOW_TO[mode].map((line) => (
            <li key={line} style={{ fontSize: '0.9375rem' }}>
              {line}
            </li>
          ))}
        </ol>
        <p className="card__note">
          {mode === 'aim'
            ? `${settings.trials * 2} targets this run.`
            : `${settings.trials} trials this run, with ${(settings.minDelayMs / 1000).toFixed(1)}–${(settings.maxDelayMs / 1000).toFixed(1)}s between them.`}{' '}
          Change that in Settings.
        </p>
        <button type="button" className="btn btn--primary" onClick={start}>
          <Icon name="play" size={18} /> Start {meta.name}
        </button>
      </section>

      <section className="card stack">
        <h2 className="card__title">Your trend</h2>
        {history.length === 0 ? (
          <div className="empty">
            <p className="empty__title">Nothing recorded yet</p>
            <p className="empty__body">
              Finish a run and this becomes a chart of your mean reaction time over your last
              twenty sessions.
            </p>
          </div>
        ) : (
          <Sparkline
            points={points}
            unit="ms"
            lowerIsBetter
            caption={`${meta.primaryLabel} over your last ${points.length} runs`}
          />
        )}
      </section>
    </div>
  );
}
