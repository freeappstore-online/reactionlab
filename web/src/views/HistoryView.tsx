import { useMemo, useState } from 'react';
import { MODE_META } from '../modes';
import { TEST_MODES } from '../types';
import type { SessionRecord, TestMode } from '../types';
import { mean as meanOf, ms, percent } from '../services/stats';
import { bestTime, scoreBand } from '../services/scoring';
import { deleteSession } from '../services/storage';
import { useSessions } from '../hooks/useStore';
import { Icon } from '../components/Icon';
import { Sparkline } from '../components/Sparkline';
import type { SparklinePoint } from '../components/Sparkline';

type Filter = TestMode | 'all';

const TREND_LIMIT = 30;

export function HistoryView(): React.ReactElement {
  const sessions = useSessions();
  const [filter, setFilter] = useState<Filter>('all');

  const visible = useMemo(
    () => (filter === 'all' ? sessions : sessions.filter((s) => s.mode === filter)),
    [filter, sessions],
  );

  // A trend line only means anything within a single mode — the modes have
  // different baselines, so mixing them would draw a sawtooth.
  const trendMode: TestMode | null = filter === 'all' ? null : filter;
  const points: readonly SparklinePoint[] =
    trendMode === null
      ? []
      : visible
          .filter((s) => s.stats.mean !== null)
          .slice(0, TREND_LIMIT)
          .reverse()
          .map((s) => ({
            value: s.stats.mean ?? 0,
            label: formatDay(s.startedAt),
          }));

  const means = visible.map((s) => s.stats.mean).filter((v): v is number => v !== null);

  return (
    <div className="view">
      <div className="view__head">
        <h1>History</h1>
        <p>Every run you have completed on this device, newest first.</p>
      </div>

      <div className="segmented" role="group" aria-label="Filter by test">
        <button
          type="button"
          className="segmented__btn"
          aria-pressed={filter === 'all'}
          onClick={() => {
            setFilter('all');
          }}
        >
          All tests
        </button>
        {TEST_MODES.map((mode) => (
          <button
            key={mode}
            type="button"
            className="segmented__btn"
            aria-pressed={filter === mode}
            onClick={() => {
              setFilter(mode);
            }}
          >
            {MODE_META[mode].name}
          </button>
        ))}
      </div>

      {visible.length === 0 ? (
        <section className="card">
          <div className="empty">
            <p className="empty__title">
              {sessions.length === 0 ? 'No runs recorded yet' : 'Nothing in this test yet'}
            </p>
            <p className="empty__body">
              {sessions.length === 0
                ? 'Finish any test and it will show up here, along with a trend line once you have two runs in the same mode.'
                : 'Run this test once and its results will appear here.'}
            </p>
          </div>
        </section>
      ) : (
        <>
          <section className="card">
            <div className="stats">
              <div className="stat">
                <span className="stat__label">Runs</span>
                <span className="stat__value tnum">{visible.length}</span>
              </div>
              <div className="stat">
                <span className="stat__label">Average of means</span>
                <span className="stat__value tnum">
                  {ms(meanOf(means))}
                  <span className="stat__unit">ms</span>
                </span>
              </div>
              <div className="stat">
                <span className="stat__label">Fastest trial</span>
                <span className="stat__value tnum">
                  {ms(bestTime(visible))}
                  <span className="stat__unit">ms</span>
                </span>
              </div>
              <div className="stat">
                <span className="stat__label">Best score</span>
                <span className="stat__value tnum">
                  {visible.reduce((best, s) => Math.max(best, s.score), 0)}
                </span>
              </div>
            </div>
          </section>

          {trendMode !== null && (
            <section className="card stack">
              <h2 className="card__title">{MODE_META[trendMode].name} trend</h2>
              <Sparkline
                points={points}
                unit="ms"
                lowerIsBetter
                caption={`${MODE_META[trendMode].primaryLabel} over your last ${points.length} runs`}
              />
            </section>
          )}

          {trendMode === null && (
            <p className="card__note">
              Pick a single test above to see its trend line — the modes have different baselines,
              so a combined chart would be meaningless.
            </p>
          )}

          <section className="card card--flush">
            <ul className="list">
              {visible.map((session) => (
                <SessionRow key={session.id} session={session} />
              ))}
            </ul>
          </section>
        </>
      )}
    </div>
  );
}

function SessionRow({ session }: { session: SessionRecord }): React.ReactElement {
  const meta = MODE_META[session.mode];
  return (
    <li className="list__item">
      <div className="list__main">
        <span className="list__title">{meta.name}</span>
        <span className="list__meta">
          {formatDateTime(session.startedAt)} · {session.stats.scored} scored ·{' '}
          {session.stats.accuracy === null
            ? 'accuracy n/a'
            : `${percent(session.stats.accuracy)} accurate`}
          {session.stats.falseStarts > 0 &&
            ` · ${session.stats.falseStarts} false start${session.stats.falseStarts === 1 ? '' : 's'}`}
        </span>
      </div>
      <span className={`badge badge--${scoreBand(session.score)}`}>{session.score}</span>
      <span className="list__value tnum">
        {ms(session.stats.mean)}
        <span className="stat__unit">ms</span>
      </span>
      <button
        type="button"
        className="btn btn--ghost btn--sm"
        aria-label={`Delete the ${meta.name} run from ${formatDateTime(session.startedAt)}`}
        onClick={() => {
          deleteSession(session.id);
        }}
      >
        <Icon name="trash" size={16} />
      </button>
    </li>
  );
}

function formatDay(epochMs: number): string {
  return new Date(epochMs).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}

function formatDateTime(epochMs: number): string {
  return new Date(epochMs).toLocaleString(undefined, {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
}
