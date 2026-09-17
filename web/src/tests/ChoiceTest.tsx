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

/** Home-row keys under the index and middle fingers of each hand. */
const KEYS = ['a', 's', 'k', 'l'] as const;

/**
 * Choice Reaction Time.
 *
 * Same measurement as the simple test with a decision stage bolted on: the
 * response is only correct if it names the target that actually lit up.
 */
export function ChoiceTest({ settings, onComplete }: TestProps): React.ReactElement {
  const stage = useStage<HTMLDivElement>();
  const timer = useFrameTimer();

  const targetsRef = useRef<(HTMLButtonElement | null)[]>([]);
  const activeRef = useRef<number | null>(null);
  const onsetRef = useRef(0);
  const respondedRef = useRef(false);
  const lockUntilRef = useRef(0);
  const trialsRef = useRef<Trial[]>([]);
  const completedRef = useRef(0);
  const startedRef = useRef<number | null>(null);
  const doneRef = useRef(false);

  const [completed, setCompleted] = useState(0);
  const [lastResult, setLastResult] = useState<{ rt: number | null; correct: boolean } | null>(null);
  const [falseStarts, setFalseStarts] = useState(0);

  /** Writes the lit target straight to the DOM — no React commit in the path. */
  const paintActive = useCallback((index: number | null) => {
    activeRef.current = index;
    targetsRef.current.forEach((el, i) => {
      if (el !== null) el.dataset['active'] = String(index === i);
    });
  }, []);

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

  const advance = useCallback(
    (trial: Trial) => {
      trialsRef.current.push(trial);
      completedRef.current += 1;
      setCompleted(completedRef.current);
      paintActive(null);
      if (completedRef.current >= settings.trials) finish();
      else {
        lockUntilRef.current = now() + INPUT_LOCKOUT_MS;
        stage.goTo('feedback');
      }
    },
    [finish, paintActive, settings.trials, stage],
  );

  const startTrial = useCallback(() => {
    if (doneRef.current) return;
    lockUntilRef.current = now() + INPUT_LOCKOUT_MS;
    paintActive(null);
    stage.goTo('wait');

    timer.set(
      afterDelay(randomDelay(settings.minDelayMs, settings.maxDelayMs), (frameTs) => {
        const index = Math.floor(Math.random() * KEYS.length);
        onsetRef.current = frameTs;
        respondedRef.current = false;
        paintActive(index);
        stage.goTo('go');

        timer.set(
          afterDelay(RESPONSE_WINDOW_MS, () => {
            if (respondedRef.current) return;
            respondedRef.current = true;
            setLastResult({ rt: null, correct: false });
            advance({ index: completedRef.current, outcome: 'miss', rtMs: null });
          }),
        );
      }),
    );
  }, [advance, paintActive, settings.maxDelayMs, settings.minDelayMs, stage, timer]);

  const recordFalseStart = useCallback(() => {
    timer.clear();
    paintActive(null);
    trialsRef.current.push({ index: completedRef.current, outcome: 'falseStart', rtMs: null });
    setFalseStarts((n) => n + 1);
    lockUntilRef.current = now() + INPUT_LOCKOUT_MS;
    stage.goTo('hold');
  }, [paintActive, stage, timer]);

  const respond = useCallback(
    (index: number, event: Event) => {
      if (respondedRef.current) return;
      respondedRef.current = true;
      timer.clear();

      const rt = reactionTime(onsetRef.current, event);
      if (rt === null) {
        recordFalseStart();
        return;
      }

      const correct = index === activeRef.current;
      setLastResult({ rt, correct });
      advance({
        index: completedRef.current,
        outcome: correct ? 'hit' : 'wrong',
        rtMs: rt,
      });
    },
    [advance, recordFalseStart, timer],
  );

  /** One handler for the whole stage; the target, if any, comes off the event. */
  const handleInput = useCallback(
    (index: number | null, event: Event) => {
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
          if (index !== null) respond(index, event);
          return;
        case 'hold':
        case 'feedback':
        case 'paused':
          startTrial();
          return;
      }
    },
    [recordFalseStart, respond, stage.phaseRef, startTrial],
  );

  useVisibilityPause(() => {
    if (doneRef.current) return;
    const phase = stage.phaseRef.current;
    if (phase === 'idle' || phase === 'paused') return;
    timer.clear();
    respondedRef.current = true;
    paintActive(null);
    lockUntilRef.current = now() + INPUT_LOCKOUT_MS;
    stage.goTo('paused');
  });

  const onPointerDown = useCallback(
    (event: React.PointerEvent<HTMLDivElement>) => {
      const el = event.target instanceof Element ? event.target.closest('[data-index]') : null;
      const raw = el instanceof HTMLElement ? el.dataset['index'] : undefined;
      const index = raw === undefined ? null : Number.parseInt(raw, 10);
      handleInput(index === null || Number.isNaN(index) ? null : index, event.nativeEvent);
    },
    [handleInput],
  );

  useKeyInput([...KEYS, 'space', 'enter'], (key, event) => {
    const index = KEYS.indexOf(key as (typeof KEYS)[number]);
    handleInput(index === -1 ? null : index, event);
  });

  return (
    <div className="runner">
      <div className="runner__bar">
        <h1>Choice Reaction</h1>
        {falseStarts > 0 && (
          <span className="badge badge--error">
            {falseStarts} false start{falseStarts === 1 ? '' : 's'}
          </span>
        )}
        <span className="runner__progress tnum">
          {Math.min(completed + 1, settings.trials)} / {settings.trials}
        </span>
      </div>

      <div
        ref={stage.ref}
        className="stage"
        data-phase={stage.phase}
        onPointerDown={onPointerDown}
        role="group"
        aria-label="Choice reaction stage"
      >
        <span className="stage__phase" data-for="idle">
          <span className="stage__headline">Tap to begin</span>
          <span className="stage__sub">
            One of the four targets will light up. Hit that one — tap it, or press its key.
          </span>
        </span>

        <span className="stage__phase" data-for="wait">
          <span className="stage__headline">Wait…</span>
        </span>

        <span className="stage__phase" data-for="go">
          <span className="stage__sub">Hit the lit target</span>
        </span>

        <span className="stage__phase" data-for="hold">
          <span className="stage__headline">Too soon</span>
          <span className="stage__sub">
            Nothing had lit up yet. Tap anywhere to retry this trial.
          </span>
        </span>

        <span className="stage__phase" data-for="feedback">
          <span className="stage__readout tnum">
            {lastResult === null || lastResult.rt === null ? 'Missed' : ms(lastResult.rt)}
          </span>
          <span className="stage__sub">
            {lastResult === null
              ? ''
              : lastResult.rt === null
                ? 'No response inside the window.'
                : lastResult.correct
                  ? 'milliseconds — correct target'
                  : 'milliseconds — wrong target'}
          </span>
          <span className="stage__sub">Tap to continue</span>
        </span>

        <span className="stage__phase" data-for="paused">
          <span className="stage__headline">Paused</span>
          <span className="stage__sub">
            You left the tab mid-trial, so that one was discarded. Tap anywhere to resume.
          </span>
        </span>

        {/* Always mounted: only `data-active` changes when a target lights up. */}
        <div className="choice">
          {KEYS.map((key, i) => (
            <button
              key={key}
              type="button"
              className="choice__target"
              data-index={i}
              data-active="false"
              ref={(el) => {
                targetsRef.current[i] = el;
              }}
              aria-label={`Target ${i + 1}, key ${key.toUpperCase()}`}
            >
              <span className="choice__key">{key.toUpperCase()}</span>
            </button>
          ))}
        </div>
      </div>

      <p className="keyhint">
        Keys <kbd>A</kbd> <kbd>S</kbd> <kbd>K</kbd> <kbd>L</kbd> map to the four targets, left to
        right.
      </p>
    </div>
  );
}
