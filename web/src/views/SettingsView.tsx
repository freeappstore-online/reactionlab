import { useState } from 'react';
import {
  DEFAULT_SETTINGS,
  SETTINGS_LIMITS,
  clearAll,
  clearSessions,
  exportAll,
  isPersistent,
  storageFootprint,
} from '../services/storage';
import { useSessions, useSettings } from '../hooks/useStore';
import { Icon } from '../components/Icon';

export function SettingsView(): React.ReactElement {
  const [settings, update] = useSettings();
  const sessions = useSessions();
  const [confirming, setConfirming] = useState<'none' | 'sessions' | 'all'>('none');

  const download = (): void => {
    // Built and consumed entirely in the page — the file never touches a server.
    const blob = new Blob([JSON.stringify(exportAll(), null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = `reactionlab-${new Date().toISOString().slice(0, 10)}.json`;
    anchor.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="view">
      <div className="view__head">
        <h1>Settings</h1>
        <p>These apply to every test and are saved alongside each run.</p>
      </div>

      <section className="card stack">
        <h2 className="card__title">Test setup</h2>

        <div className="field">
          <label className="field__label" htmlFor="trials">
            Trials per session
            <span className="field__value tnum">{settings.trials}</span>
          </label>
          <input
            id="trials"
            type="range"
            min={SETTINGS_LIMITS.trials.min}
            max={SETTINGS_LIMITS.trials.max}
            step={1}
            value={settings.trials}
            onChange={(event) => {
              update({ trials: Number(event.target.value) });
            }}
          />
          <p className="field__hint">
            More trials give a steadier mean. Aim Trainer runs twice this many targets (
            {settings.trials * 2}).
          </p>
        </div>

        <div className="field">
          <label className="field__label" htmlFor="minDelay">
            Shortest wait before a stimulus
            <span className="field__value tnum">{(settings.minDelayMs / 1000).toFixed(1)}s</span>
          </label>
          <input
            id="minDelay"
            type="range"
            min={SETTINGS_LIMITS.delayMs.min}
            max={SETTINGS_LIMITS.delayMs.max}
            step={100}
            value={settings.minDelayMs}
            onChange={(event) => {
              update({ minDelayMs: Number(event.target.value) });
            }}
          />
        </div>

        <div className="field">
          <label className="field__label" htmlFor="maxDelay">
            Longest wait before a stimulus
            <span className="field__value tnum">{(settings.maxDelayMs / 1000).toFixed(1)}s</span>
          </label>
          <input
            id="maxDelay"
            type="range"
            min={SETTINGS_LIMITS.delayMs.min}
            max={SETTINGS_LIMITS.delayMs.max}
            step={100}
            value={settings.maxDelayMs}
            onChange={(event) => {
              update({ maxDelayMs: Number(event.target.value) });
            }}
          />
          <p className="field__hint">
            The wait is drawn uniformly from this window. A wider window makes the stimulus harder
            to anticipate; the range is clamped so the longest can never fall below the shortest.
          </p>
        </div>

        <label className="switch">
          <span>
            <span style={{ fontWeight: 600 }}>Show the result after every trial</span>
            <br />
            <span className="field__hint">
              Off means the next trial arms itself immediately, with no pause to read your time.
            </span>
          </span>
          <input
            type="checkbox"
            checked={settings.perTrialFeedback}
            onChange={(event) => {
              update({ perTrialFeedback: event.target.checked });
            }}
          />
        </label>

        <div className="row">
          <button
            type="button"
            className="btn btn--sm"
            onClick={() => {
              update(DEFAULT_SETTINGS);
            }}
          >
            Reset to defaults
          </button>
        </div>
      </section>

      <section className="card stack">
        <h2 className="card__title">Your data</h2>
        <p className="card__note">
          ReactionLab keeps {sessions.length} session{sessions.length === 1 ? '' : 's'}, your
          settings and your streak in this browser&apos;s local storage — about{' '}
          {(storageFootprint() / 1024).toFixed(1)} KB. Nothing is uploaded, and there are no
          cookies or analytics of any kind.
        </p>
        {!isPersistent() && (
          <p className="notice notice--warning">
            Local storage is unavailable in this browser context, so nothing can be saved between
            visits.
          </p>
        )}

        <div className="row">
          <button type="button" className="btn" onClick={download}>
            <Icon name="download" size={18} /> Export as JSON
          </button>

          {confirming === 'sessions' ? (
            <>
              <button
                type="button"
                className="btn btn--danger"
                onClick={() => {
                  clearSessions();
                  setConfirming('none');
                }}
              >
                Yes, delete {sessions.length} runs
              </button>
              <button
                type="button"
                className="btn btn--ghost"
                onClick={() => {
                  setConfirming('none');
                }}
              >
                Cancel
              </button>
            </>
          ) : (
            <button
              type="button"
              className="btn btn--danger"
              disabled={sessions.length === 0}
              onClick={() => {
                setConfirming('sessions');
              }}
            >
              <Icon name="trash" size={18} /> Delete all runs
            </button>
          )}
        </div>

        <div className="row">
          {confirming === 'all' ? (
            <>
              <button
                type="button"
                className="btn btn--danger"
                onClick={() => {
                  clearAll();
                  setConfirming('none');
                }}
              >
                Yes, erase everything
              </button>
              <button
                type="button"
                className="btn btn--ghost"
                onClick={() => {
                  setConfirming('none');
                }}
              >
                Cancel
              </button>
            </>
          ) : (
            <button
              type="button"
              className="btn btn--ghost btn--sm"
              onClick={() => {
                setConfirming('all');
              }}
            >
              Erase runs, settings and streak
            </button>
          )}
        </div>
      </section>
    </div>
  );
}
