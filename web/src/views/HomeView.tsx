import { useMemo } from 'react';
import { MODE_META } from '../modes';
import { TEST_MODES } from '../types';
import type { SessionRecord, TestMode } from '../types';
import { ms } from '../services/stats';
import { bestTime } from '../services/scoring';
import { isPersistent } from '../services/storage';
import { useSessions, useStreak } from '../hooks/useStore';
import { pathFor } from '../hooks/useRoute';
import { Icon } from '../components/Icon';
import { MODE_ICON } from '../components/Shell';

interface HomeViewProps {
  readonly onOpenTest: (mode: TestMode) => void;
}

export function HomeView({ onOpenTest }: HomeViewProps): React.ReactElement {
  const sessions = useSessions();
  const streak = useStreak();

  const byMode = useMemo(() => {
    const map = new Map<TestMode, SessionRecord[]>();
    for (const mode of TEST_MODES) map.set(mode, []);
    for (const session of sessions) map.get(session.mode)?.push(session);
    return map;
  }, [sessions]);

  const overallBest = bestTime(sessions);
  const isEmpty = sessions.length === 0;

  return (
    <div className="view">
      <div className="view__head">
        <h1>{isEmpty ? 'Four ways to measure a reflex' : 'Welcome back'}</h1>
        <p>
          {isEmpty
            ? 'Pick a test to get started. Everything you record is written to this browser and nowhere else.'
            : `${sessions.length} run${sessions.length === 1 ? '' : 's'} recorded on this device.`}
        </p>
      </div>

      {!isPersistent() && (
        <p className="notice notice--warning">
          This browser is blocking local storage, so results will vanish when you close the tab. The
          tests themselves work exactly the same.
        </p>
      )}

      {!isEmpty && (
        <section className="card">
          <div className="stats">
            <div className="stat">
              <span className="stat__label">Day streak</span>
              <span className="stat__value tnum">
                {streak}
                <span className="stat__unit">{streak === 1 ? 'day' : 'days'}</span>
              </span>
            </div>
            <div className="stat">
              <span className="stat__label">Fastest ever</span>
              <span className="stat__value tnum">
                {ms(overallBest)}
                <span className="stat__unit">ms</span>
              </span>
            </div>
            <div className="stat">
              <span className="stat__label">Sessions</span>
              <span className="stat__value tnum">{sessions.length}</span>
            </div>
            <div className="stat">
              <span className="stat__label">Modes tried</span>
              <span className="stat__value tnum">
                {TEST_MODES.filter((m) => (byMode.get(m)?.length ?? 0) > 0).length}
                <span className="stat__unit">/ {TEST_MODES.length}</span>
              </span>
            </div>
          </div>
        </section>
      )}

      <div className="grid">
        {TEST_MODES.map((mode) => {
          const meta = MODE_META[mode];
          const runs = byMode.get(mode) ?? [];
          const best = bestTime(runs);
          return (
            <a
              key={mode}
              className="card testcard"
              href={pathFor({ name: 'test', mode })}
              onClick={(event) => {
                // Let modified clicks open a new tab as usual.
                if (event.metaKey || event.ctrlKey || event.shiftKey) return;
                event.preventDefault();
                onOpenTest(mode);
              }}
            >
              <div className="testcard__top">
                <span className="testcard__icon">
                  <Icon name={MODE_ICON[mode]} />
                </span>
                {runs.length > 0 && <span className="badge">{runs.length} runs</span>}
              </div>
              <div className="stack" style={{ gap: '0.25rem' }}>
                <h2 className="card__title">{meta.name}</h2>
                <p className="testcard__desc">{meta.tagline}</p>
              </div>
              <p className="testcard__foot">
                {best === null ? (
                  <span>Not attempted yet</span>
                ) : (
                  <>
                    <span className="tnum" style={{ fontWeight: 700, color: 'var(--ink)' }}>
                      {ms(best)} ms
                    </span>
                    <span>best</span>
                  </>
                )}
              </p>
            </a>
          );
        })}
      </div>

      {isEmpty && (
        <section className="card">
          <div className="empty">
            <p className="empty__title">Nothing recorded yet</p>
            <p className="empty__body">
              Your scores, streaks and settings are stored locally in this browser. There is no
              account, no sync and no network request after the app has loaded — clearing your
              browser data clears ReactionLab completely.
            </p>
          </div>
        </section>
      )}
    </div>
  );
}
