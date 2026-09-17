import { MODE_META } from '../modes';
import { TEST_MODES } from '../types';
import { MAX_SCORE } from '../services/scoring';

export function AboutView(): React.ReactElement {
  return (
    <div className="view">
      <div className="view__head">
        <h1>About ReactionLab</h1>
        <p>Four reaction and focus tests, measured properly and kept to yourself.</p>
      </div>

      <section className="card stack">
        <h2 className="card__title">How the timing works</h2>
        <p className="card__note">
          Every measurement comes from <code>performance.now()</code>, a monotonic clock with
          sub-millisecond resolution. A stimulus is scheduled by polling animation frames rather
          than with <code>setTimeout</code>, so the moment it is painted and the timestamp recorded
          as its onset describe the same frame. Your reaction is read from the input event&apos;s
          own timestamp, which the browser captures before any of this app&apos;s code runs.
        </p>
        <p className="card__note">
          The wall clock is used for one thing only: labelling a run with a date. It never appears
          in a subtraction, so changing your system time cannot corrupt a score.
        </p>
        <p className="card__note">
          Input made before a stimulus appears is a false start and is never recorded as a
          reaction. A second input on the same stimulus is ignored, and a press within 250 ms of a
          phase change is swallowed so the tail of one response cannot spill into the next trial.
        </p>
      </section>

      <section className="card stack">
        <h2 className="card__title">Scoring</h2>
        <p className="card__note">
          Each run gets a score out of {MAX_SCORE}: your speed within the band below, multiplied by
          your accuracy for that mode. Both factors run 0–1, so a fast but sloppy run cannot
          outrank a clean one on speed alone.
        </p>
        <ul className="list" style={{ marginTop: '0.5rem' }}>
          {TEST_MODES.map((mode) => {
            const meta = MODE_META[mode];
            return (
              <li key={mode} className="list__item" style={{ paddingInline: 0 }}>
                <div className="list__main">
                  <span className="list__title">{meta.name}</span>
                  <span className="list__meta">
                    {meta.floorMs}–{meta.ceilMs} ms band
                    {meta.accuracyLabel === null ? '' : ` · accuracy: ${meta.accuracyLabel}`}
                  </span>
                </div>
              </li>
            );
          })}
        </ul>
      </section>

      <section className="card stack">
        <h2 className="card__title">Privacy</h2>
        <p className="card__note">
          ReactionLab makes no network requests after it has loaded. There is no analytics, no
          telemetry, no cookies, no accounts and no third-party script — the single external
          resource is the web-font stylesheet, fetched once and then served from the offline cache.
        </p>
        <p className="card__note">
          Your runs, settings and streak live in this browser&apos;s local storage under the{' '}
          <code>reactionlab.v1.*</code> keys. Settings has an export button and a delete button;
          clearing your browser&apos;s site data removes everything just as completely.
        </p>
      </section>

      <section className="card stack">
        <h2 className="card__title">Offline</h2>
        <p className="card__note">
          A service worker caches the whole app on first load, so it launches from your home screen
          and runs with no connection at all. Install it from your browser&apos;s menu — &ldquo;Add
          to Home Screen&rdquo; on iOS, &ldquo;Install app&rdquo; on Chrome and Edge.
        </p>
      </section>

      <section className="card stack">
        <h2 className="card__title">License</h2>
        <p className="card__note">
          MIT. Copy it, fork it, ship it — the full text is in the LICENSE file at the root of the
          repository.
        </p>
      </section>
    </div>
  );
}
