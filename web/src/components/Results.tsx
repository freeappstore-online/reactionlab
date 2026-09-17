import { MODE_META } from '../modes';
import { ms, percent } from '../services/stats';
import { MAX_SCORE, scoreBand } from '../services/scoring';
import type { SessionRecord, Trial } from '../types';
import { Icon } from './Icon';

interface ResultsProps {
  readonly session: SessionRecord;
  /** Earlier sessions in the same mode, so "personal best" excludes this run. */
  readonly previous: readonly SessionRecord[];
  readonly onRetry: () => void;
  readonly onHome: () => void;
  readonly onHistory: () => void;
  readonly persisted: boolean;
}

export function Results({
  session,
  previous,
  onRetry,
  onHome,
  onHistory,
  persisted,
}: ResultsProps): React.ReactElement {
  const meta = MODE_META[session.mode];
  const { stats } = session;

  const previousBestTime = previous.reduce<number | null>(
    (best, s) => (s.stats.best !== null && (best === null || s.stats.best < best) ? s.stats.best : best),
    null,
  );
  const previousBestScore = previous.reduce<number>((best, s) => Math.max(best, s.score), 0);

  const isPersonalBestTime =
    stats.best !== null && (previousBestTime === null || stats.best < previousBestTime);
  const isPersonalBestScore = previous.length > 0 && session.score > previousBestScore;

  // A run where nothing scored is a real outcome, not an error — say so plainly
  // rather than printing a page of dashes.
  const nothingScored = stats.scored === 0;

  return (
    <div className="runner">
      <div className="runner__bar">
        <h1>{meta.name} — results</h1>
        {isPersonalBestTime && (
          <span className="badge badge--success">
            <Icon name="trophy" size={14} /> Personal best
          </span>
        )}
        {!isPersonalBestTime && isPersonalBestScore && (
          <span className="badge badge--accent">Best score yet</span>
        )}
      </div>

      {!persisted && (
        <p className="notice notice--warning">
          This browser is blocking local storage, so the run below could not be saved. Everything
          else works — nothing is ever sent anywhere.
        </p>
      )}

      {nothingScored ? (
        <div className="card">
          <div className="empty">
            <p className="empty__title">No usable trials in this run</p>
            <p className="empty__body">
              {stats.falseStarts > 0
                ? `Every attempt was a false start (${stats.falseStarts} of them). Wait for the stimulus before you respond — the timer only starts when the panel changes.`
                : 'Nothing was answered inside the response window. Try again when you are ready to watch the panel.'}
            </p>
          </div>
        </div>
      ) : (
        <div className="grid">
          <section className="card stack">
            <span className="stat__label">{meta.primaryLabel}</span>
            <div className="stat stat--hero">
              <span className="stat__value tnum">
                {ms(stats.mean)}
                <span className="stat__unit">{meta.primaryUnit}</span>
              </span>
            </div>
            <p className="card__note">
              Median {ms(stats.median)} {meta.primaryUnit} · best {ms(stats.best)}{' '}
              {meta.primaryUnit} · spread ±{ms(stats.sd)} {meta.primaryUnit}
            </p>
          </section>

          <section className="card stack">
            <span className="stat__label">Session score</span>
            <div className="stat stat--hero">
              <span className="stat__value tnum">
                {session.score}
                <span className="stat__unit">/ {MAX_SCORE}</span>
              </span>
            </div>
            <p className="card__note">
              Speed against the {meta.floorMs}–{meta.ceilMs} {meta.primaryUnit} band for this test,
              scaled by accuracy.
            </p>
            <span className={`badge badge--${scoreBand(session.score)}`}>
              {previous.length === 0
                ? 'First run in this mode'
                : `Previous best ${previousBestScore}`}
            </span>
          </section>
        </div>
      )}

      <section className="card stack">
        <h2 className="card__title">Breakdown</h2>
        <div className="stats">
          <Stat label="Scored trials" value={String(stats.scored)} />
          {meta.accuracyLabel !== null && (
            <Stat label={meta.accuracyLabel} value={percent(stats.accuracy)} />
          )}
          <Stat label="False starts" value={String(stats.falseStarts)} />
          {session.mode === 'gonogo' && <Stat label="Misses" value={String(stats.misses)} />}
          {session.mode === 'gonogo' && (
            <Stat label="False alarms" value={String(stats.falseAlarms)} />
          )}
          {session.mode === 'aim' && (
            <Stat label="Off-target clicks" value={String(stats.falseAlarms)} />
          )}
          {session.mode !== 'gonogo' && session.mode !== 'aim' && (
            <Stat label="Missed" value={String(stats.misses)} />
          )}
          <Stat label="Run time" value={`${(session.durationMs / 1000).toFixed(1)}s`} />
        </div>
      </section>

      {session.trials.length > 0 && (
        <section className="card stack">
          <h2 className="card__title">Every trial</h2>
          <ul className="trials">
            {session.trials.map((trial, i) => (
              <TrialChip key={i} trial={trial} best={stats.best} />
            ))}
          </ul>
          <p className="card__note">
            Times are measured from the animation-frame the stimulus was painted on to the input
            event that answered it.
          </p>
        </section>
      )}

      <div className="row">
        <button type="button" className="btn btn--primary" onClick={onRetry}>
          <Icon name="repeat" size={18} /> Run it again
        </button>
        <button type="button" className="btn" onClick={onHistory}>
          <Icon name="history" size={18} /> See history
        </button>
        <button type="button" className="btn btn--ghost" onClick={onHome}>
          All tests
        </button>
      </div>
    </div>
  );
}

const OUTCOME_LABEL: Readonly<Record<Trial['outcome'], string>> = {
  hit: 'hit',
  wrong: 'wrong target',
  miss: 'missed',
  falseAlarm: 'false alarm',
  correctReject: 'held',
  falseStart: 'too soon',
};

function TrialChip({ trial, best }: { trial: Trial; best: number | null }): React.ReactElement {
  const ok = trial.outcome === 'hit' || trial.outcome === 'correctReject';
  const isBest = trial.rtMs !== null && best !== null && trial.rtMs === best;
  return (
    <li className="trial" data-ok={ok} data-best={isBest}>
      {trial.rtMs === null ? OUTCOME_LABEL[trial.outcome] : `${ms(trial.rtMs)} ms`}
      {trial.rtMs !== null && trial.outcome !== 'hit' && ` · ${OUTCOME_LABEL[trial.outcome]}`}
    </li>
  );
}

function Stat({ label, value }: { label: string; value: string }): React.ReactElement {
  return (
    <div className="stat">
      <span className="stat__label">{label}</span>
      <span className="stat__value tnum">{value}</span>
    </div>
  );
}
