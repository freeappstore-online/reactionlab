import { useCallback, useRef, useState } from 'react';
import { afterDelay, now, randomDelay, reactionTime } from '../services/timing';
import { ms } from '../services/stats';
import type { Trial } from '../types';
import {
  INPUT_LOCKOUT_MS,
  RESPONSE_WINDOW_MS,
  attemptAccuracy,
  useFrameTimer,
  useKeyInput,
  useStage,
  useVisibilityPause,
} from './shared';
import type { TestProps } from './shared';

/**
 * Simple Reaction Time.
 *
 * One stimulus, one response, nothing to decide — the cleanest measure of
 * sensorimotor latency this app takes, and the reference implementation the
 * other three modes follow.
 */
export function SimpleTest({ settings, onComplete }: TestProps): React.ReactElement {
  const stage = useStage<HTMLButtonElement>();
  const timer = useFrameTimer();

  const onsetRef = useRef(0);
  const respondedRef = useRef(false);
  const lockUntilRef = useRef(0);
  const trialsRef = useRef<Trial[]>([]);
  const completedRef = useRef(0);
  const startedRef = useRef<number | null>(null);
  const doneRef = useRef(false);

  const [completed, setCompleted] = useState(0);
  const [lastRt, setLastRt] = useState<number | null>(null);
  const [falseStarts, setFalseStarts] = useState(0);

  const finish = useCallback(() => {
    if (doneRef.current) return;
    doneRef.current = true;
    timer.clear();

    const trials = trialsRef.current;
    const hits = trials.filter((t) => t.outcome === 'hit').length;
    onComplete({
      trials,
      durationMs: now() - (startedRef.current ?? now()),
      accuracy: attemptAccuracy(trials, hits),
    });
  }, [onComplete, timer]);

  const startTrial = useCallback(() => {
    if (doneRef.current) return;
    lockUntilRef.current = now() + INPUT_LOCKOUT_MS;
    stage.goTo('wait');

    timer.set(
      afterDelay(randomDelay(settings.minDelayMs, settings.maxDelayMs), (frameTs) => {
        // This callback runs inside the frame that paints the stimulus, so
        // `frameTs` is the onset of what the eye is about to see.
        onsetRef.current = frameTs;
        respondedRef.current = false;
        stage.goTo('go');

        // Nobody watching forever: an unanswered stimulus is a miss.
        timer.set(
          afterDelay(RESPONSE_WINDOW_MS, () => {
            if (respondedRef.current) return;
            respondedRef.current = true;
            trialsRef.current.push({ index: completedRef.current, outcome: 'miss', rtMs: null });
            completedRef.current += 1;
            setCompleted(completedRef.current);
            setLastRt(null);
            if (completedRef.current >= settings.trials) finish();
            else {
              lockUntilRef.current = now() + INPUT_LOCKOUT_MS;
              stage.goTo('feedback');
            }
          }),
        );
      }),
    );
  }, [finish, settings.maxDelayMs, settings.minDelayMs, settings.trials, stage, timer]);

  const recordFalseStart = useCallback(() => {
    timer.clear();
    trialsRef.current.push({ index: completedRef.current, outcome: 'falseStart', rtMs: null });
    setFalseStarts((n) => n + 1);
    lockUntilRef.current = now() + INPUT_LOCKOUT_MS;
    stage.goTo('hold');
  }, [stage, timer]);

  const recordHit = useCallback(
    (event: Event) => {
      if (respondedRef.current) return; // second input on the same stimulus
      respondedRef.current = true;
      timer.clear();

      const rt = reactionTime(onsetRef.current, event);
      if (rt === null) {
        // Input timestamped before the stimulus: not a real reaction.
        recordFalseStart();
        return;
      }

      trialsRef.current.push({ index: completedRef.current, outcome: 'hit', rtMs: rt });
      completedRef.current += 1;
      setCompleted(completedRef.current);
      setLastRt(rt);

      if (completedRef.current >= settings.trials) finish();
      else if (settings.perTrialFeedback) {
        lockUntilRef.current = now() + INPUT_LOCKOUT_MS;
        stage.goTo('feedback');
      } else startTrial();
    },
    [finish, recordFalseStart, settings.perTrialFeedback, settings.trials, stage, startTrial, timer],
  );

  const handleInput = useCallback(
    (event: Event) => {
      if (doneRef.current) return;
      if (now() < lockUntilRef.current) return;

      switch (stage.phaseRef.current) {
        case 'idle':
          startedRef.current = now();
          startTrial();
          return;
        case 'wait':
          recordFalseStart();
          return;
        case 'go':
          recordHit(event);
          return;
        case 'hold':
        case 'feedback':
        case 'paused':
          startTrial();
          return;
      }
    },
    [recordFalseStart, recordHit, stage.phaseRef, startTrial],
  );

  useVisibilityPause(() => {
    if (doneRef.current) return;
    const phase = stage.phaseRef.current;
    if (phase === 'idle' || phase === 'paused') return;
    timer.clear();
    respondedRef.current = true; // discard anything still in flight
    lockUntilRef.current = now() + INPUT_LOCKOUT_MS;
    stage.goTo('paused');
  });

  const onPointerDown = useCallback(
    (event: React.PointerEvent<HTMLButtonElement>) => {
      handleInput(event.nativeEvent);
    },
    [handleInput],
  );

  useKeyInput(['space', 'enter'], (_key, event) => {
    handleInput(event);
  });

  const remaining = Math.max(0, settings.trials - completed);

  return (
    <div className="runner">
      <div className="runner__bar">
        <h1>Simple Reaction</h1>
        {falseStarts > 0 && (
          <span className="badge badge--error">
            {falseStarts} false start{falseStarts === 1 ? '' : 's'}
          </span>
        )}
        <span className="runner__progress tnum">
          {Math.min(completed + 1, settings.trials)} / {settings.trials}
        </span>
      </div>

      <button
        type="button"
        ref={stage.ref}
        className="stage"
        data-phase={stage.phase}
        onPointerDown={onPointerDown}
        aria-live="polite"
      >
        <span className="stage__phase" data-for="idle">
          <span className="stage__headline">Tap to begin</span>
          <span className="stage__sub">
            Wait for the panel to turn blue, then react as fast as you can. {settings.trials} trials.
          </span>
        </span>

        <span className="stage__phase" data-for="wait">
          <span className="stage__headline">Wait…</span>
          <span className="stage__sub">Hold steady until this panel changes.</span>
        </span>

        {/* Pre-rendered so the stimulus never waits on a React commit. */}
        <span className="stage__phase" data-for="go">
          <span className="stage__headline">NOW</span>
        </span>

        <span className="stage__phase" data-for="hold">
          <span className="stage__headline">Too soon</span>
          <span className="stage__sub">
            That press landed before the stimulus, so it wasn&apos;t counted. Tap to retry this
            trial.
          </span>
        </span>

        <span className="stage__phase" data-for="feedback">
          <span className="stage__readout tnum">{lastRt === null ? 'Missed' : ms(lastRt)}</span>
          <span className="stage__sub">
            {lastRt === null
              ? 'No response inside the window.'
              : `milliseconds — ${remaining} to go`}
          </span>
          <span className="stage__sub">Tap to continue</span>
        </span>

        <span className="stage__phase" data-for="paused">
          <span className="stage__headline">Paused</span>
          <span className="stage__sub">
            You left the tab mid-trial, so that one was thrown away rather than timed against a
            stimulus you never saw. Tap to pick up where you left off.
          </span>
        </span>
      </button>

      <p className="keyhint">
        <kbd>Space</kbd> works too — and is usually a few milliseconds faster than a tap.
      </p>
    </div>
  );
}
