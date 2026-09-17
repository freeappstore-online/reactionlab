import { useCallback, useRef, useState } from 'react';
import { afterDelay, now, randomDelay, reactionTime } from '../services/timing';
import { ms } from '../services/stats';
import type { Trial } from '../types';
import {
  INPUT_LOCKOUT_MS,
  useFrameTimer,
  useKeyInput,
  useStage,
  useVisibilityPause,
} from './shared';
import type { TestProps } from './shared';

/** Share of stimuli that must be withheld on. */
const NO_GO_RATE = 0.3;
/** No-go stimuli need a window long enough that withholding is a real choice. */
const GO_WINDOW_MS = 1000;
/** How long a per-trial verdict stays up before the next stimulus is armed. */
const FEEDBACK_MS = 800;

type Verdict = 'hit' | 'miss' | 'falseAlarm' | 'correctReject' | 'falseStart';

const VERDICT_COPY: Readonly<Record<Verdict, string>> = {
  hit: 'Good',
  miss: 'Too slow',
  falseAlarm: 'Should have held',
  correctReject: 'Held it',
  falseStart: 'Too soon',
};

/**
 * Go / No-Go.
 *
 * Measures response inhibition alongside speed: the score only rewards fast
 * responses that were supposed to happen. Unlike the other modes this one
 * paces itself, because pausing for a tap between trials would let you reset
 * your guard before every stimulus.
 */
export function GoNoGoTest({ settings, onComplete }: TestProps): React.ReactElement {
  const stage = useStage<HTMLButtonElement>();
  const timer = useFrameTimer();

  const onsetRef = useRef(0);
  const isNoGoRef = useRef(false);
  const respondedRef = useRef(false);
  const lockUntilRef = useRef(0);
  const trialsRef = useRef<Trial[]>([]);
  const completedRef = useRef(0);
  const startedRef = useRef<number | null>(null);
  const doneRef = useRef(false);

  const [completed, setCompleted] = useState(0);
  const [verdict, setVerdict] = useState<{ kind: Verdict; rt: number | null } | null>(null);

  const finish = useCallback(() => {
    if (doneRef.current) return;
    doneRef.current = true;
    timer.clear();
    const trials = trialsRef.current;
    const correct = trials.filter(
      (t) => t.outcome === 'hit' || t.outcome === 'correctReject',
    ).length;
    onComplete({
      trials,
      durationMs: now() - (startedRef.current ?? now()),
      accuracy: trials.length === 0 ? null : correct / trials.length,
    });
  }, [onComplete, timer]);

  // Declared as a ref so `startTrial` and `settle` can call each other without
  // a circular `useCallback` dependency.
  const startTrialRef = useRef<() => void>(() => undefined);

  const settle = useCallback(
    (kind: Verdict, rtMs: number | null) => {
      timer.clear();
      setVerdict({ kind, rt: rtMs });

      if (kind === 'falseStart') {
        // A false start does not consume a trial — the same stimulus is re-armed.
        trialsRef.current.push({ index: completedRef.current, outcome: 'falseStart', rtMs: null });
      } else {
        trialsRef.current.push({ index: completedRef.current, outcome: kind, rtMs });
        completedRef.current += 1;
        setCompleted(completedRef.current);
      }

      if (completedRef.current >= settings.trials) {
        finish();
        return;
      }

      lockUntilRef.current = now() + FEEDBACK_MS;
      stage.goTo('feedback');
      timer.set(
        afterDelay(FEEDBACK_MS, () => {
          startTrialRef.current();
        }),
      );
    },
    [finish, settings.trials, stage, timer],
  );

  const startTrial = useCallback(() => {
    if (doneRef.current) return;
    lockUntilRef.current = now() + INPUT_LOCKOUT_MS;
    stage.goTo('wait');

    timer.set(
      afterDelay(randomDelay(settings.minDelayMs, settings.maxDelayMs), (frameTs) => {
        const noGo = Math.random() < NO_GO_RATE;
        isNoGoRef.current = noGo;
        onsetRef.current = frameTs;
        respondedRef.current = false;
        stage.goTo(noGo ? 'hold' : 'go');

        timer.set(
          afterDelay(GO_WINDOW_MS, () => {
            if (respondedRef.current) return;
            respondedRef.current = true;
            settle(noGo ? 'correctReject' : 'miss', null);
          }),
        );
      }),
    );
  }, [settings.maxDelayMs, settings.minDelayMs, settle, stage, timer]);

  startTrialRef.current = startTrial;

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
          settle('falseStart', null);
          return;
        case 'go':
        case 'hold': {
          if (respondedRef.current) return;
          respondedRef.current = true;
          const rt = reactionTime(onsetRef.current, event);
          if (rt === null) {
            settle('falseStart', null);
            return;
          }
          settle(isNoGoRef.current ? 'falseAlarm' : 'hit', rt);
          return;
        }
        case 'feedback':
          // Self-paced: presses between trials are ignored, not penalised.
          return;
        case 'paused':
          startTrial();
          return;
      }
    },
    [settle, stage.phaseRef, startTrial],
  );

  useVisibilityPause(() => {
    if (doneRef.current) return;
    const phase = stage.phaseRef.current;
    if (phase === 'idle' || phase === 'paused') return;
    timer.clear();
    respondedRef.current = true;
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

  return (
    <div className="runner">
      <div className="runner__bar">
        <h1>Go / No-Go</h1>
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
            Blue means respond. Red means hold — do nothing at all until it clears. Trials run back
            to back once you start.
          </span>
        </span>

        <span className="stage__phase" data-for="wait">
          <span className="stage__headline">Wait…</span>
        </span>

        <span className="stage__phase" data-for="go">
          <span className="stage__headline">GO</span>
        </span>

        <span className="stage__phase" data-for="hold">
          <span className="stage__headline">STOP</span>
        </span>

        <span className="stage__phase" data-for="feedback">
          <span className="stage__readout tnum">
            {verdict === null ? '' : verdict.rt === null ? VERDICT_COPY[verdict.kind] : ms(verdict.rt)}
          </span>
          <span className="stage__sub">
            {verdict === null
              ? ''
              : verdict.rt === null
                ? ''
                : `milliseconds — ${VERDICT_COPY[verdict.kind].toLowerCase()}`}
          </span>
        </span>

        <span className="stage__phase" data-for="paused">
          <span className="stage__headline">Paused</span>
          <span className="stage__sub">
            You left the tab mid-trial, so that one was discarded. Tap to resume — trials will run
            back to back again.
          </span>
        </span>
      </button>

      <p className="keyhint">
        <kbd>Space</kbd> to respond. Withholding is scored just as heavily as reacting.
      </p>
    </div>
  );
}
