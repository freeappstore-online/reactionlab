import { useCallback, useRef, useState } from 'react';
import { now, reactionTime } from '../services/timing';
import type { Trial } from '../types';
import { useVisibilityPause } from './shared';
import type { TestProps } from './shared';

/** Aim runs twice the configured trial count — a handful of targets is no test. */
const TARGET_MULTIPLIER = 2;
/** Keeps a new target from landing on top of the one just cleared. */
const MIN_SEPARATION = 1.6;
const PLACEMENT_ATTEMPTS = 10;

interface Point {
  readonly x: number;
  readonly y: number;
}

/**
 * Aim Trainer.
 *
 * Measures visual search plus pointing, timed from the frame a target is
 * painted to the input that hits it. Clicks that land anywhere else are
 * recorded as false alarms and pull accuracy down without polluting the
 * reaction times.
 */
export function AimTest({ settings, onComplete }: TestProps): React.ReactElement {
  const total = settings.trials * TARGET_MULTIPLIER;

  const boardRef = useRef<HTMLDivElement | null>(null);
  const targetRef = useRef<HTMLButtonElement | null>(null);

  const onsetRef = useRef(0);
  const lastPointRef = useRef<Point | null>(null);
  const trialsRef = useRef<Trial[]>([]);
  const hitsRef = useRef(0);
  const strayRef = useRef(0);
  const startedRef = useRef<number | null>(null);
  const pauseStartRef = useRef<number | null>(null);
  const pausedMsRef = useRef(0);
  const runningRef = useRef(false);
  const doneRef = useRef(false);
  const frameRef = useRef(0);

  const [hits, setHits] = useState(0);
  const [stray, setStray] = useState(0);
  const [running, setRunning] = useState(false);

  const finish = useCallback(() => {
    if (doneRef.current) return;
    doneRef.current = true;
    runningRef.current = false;
    cancelAnimationFrame(frameRef.current);

    const target = targetRef.current;
    if (target !== null) target.style.visibility = 'hidden';

    const attempted = hitsRef.current + strayRef.current;
    onComplete({
      trials: trialsRef.current,
      // Time spent with the tab in the background is not time spent aiming.
      durationMs: now() - (startedRef.current ?? now()) - pausedMsRef.current,
      accuracy: attempted === 0 ? null : hitsRef.current / attempted,
    });
  }, [onComplete]);

  /**
   * Positions the target and records its onset.
   *
   * The style write happens now; the `requestAnimationFrame` callback that
   * follows runs at the top of the frame that paints it, so `frameTs` is the
   * moment the target became visible.
   */
  const placeTarget = useCallback(() => {
    const board = boardRef.current;
    const target = targetRef.current;
    if (board === null || target === null) return;

    const size = target.offsetWidth || 64;
    const margin = size / 2 + 6;
    const w = board.clientWidth - margin * 2;
    const h = board.clientHeight - margin * 2;

    let point: Point = { x: margin + w / 2, y: margin + h / 2 };
    if (w > 0 && h > 0) {
      const previous = lastPointRef.current;
      for (let attempt = 0; attempt < PLACEMENT_ATTEMPTS; attempt++) {
        const candidate: Point = {
          x: margin + Math.random() * w,
          y: margin + Math.random() * h,
        };
        point = candidate;
        if (previous === null) break;
        if (Math.hypot(candidate.x - previous.x, candidate.y - previous.y) >= size * MIN_SEPARATION)
          break;
      }
    }

    lastPointRef.current = point;
    target.style.left = `${point.x}px`;
    target.style.top = `${point.y}px`;
    target.style.visibility = 'visible';

    cancelAnimationFrame(frameRef.current);
    frameRef.current = requestAnimationFrame((frameTs) => {
      onsetRef.current = frameTs;
    });
  }, []);

  const registerHit = useCallback(
    (event: Event) => {
      const rt = reactionTime(onsetRef.current, event);
      hitsRef.current += 1;
      setHits(hitsRef.current);
      trialsRef.current.push({
        index: trialsRef.current.length,
        outcome: 'hit',
        rtMs: rt,
      });

      if (hitsRef.current >= total) {
        finish();
        return;
      }
      placeTarget();
    },
    [finish, placeTarget, total],
  );

  const registerStray = useCallback(() => {
    strayRef.current += 1;
    setStray(strayRef.current);
    trialsRef.current.push({
      index: trialsRef.current.length,
      outcome: 'falseAlarm',
      rtMs: null,
    });
  }, []);

  const onPointerDown = useCallback(
    (event: React.PointerEvent<HTMLDivElement>) => {
      if (doneRef.current) return;

      if (!runningRef.current) {
        runningRef.current = true;
        if (startedRef.current === null) startedRef.current = now();
        if (pauseStartRef.current !== null) {
          pausedMsRef.current += now() - pauseStartRef.current;
          pauseStartRef.current = null;
        }
        setRunning(true);
        placeTarget();
        return;
      }

      const onTarget =
        event.target instanceof Element && event.target.closest('.aim__target') !== null;
      if (onTarget) registerHit(event.nativeEvent);
      else registerStray();
    },
    [placeTarget, registerHit, registerStray],
  );

  useVisibilityPause(() => {
    if (doneRef.current || !runningRef.current) return;
    // The live target's onset is now meaningless, so retire it and hand the
    // board back with a fresh one once the user is looking again.
    runningRef.current = false;
    pauseStartRef.current = now();
    cancelAnimationFrame(frameRef.current);
    const target = targetRef.current;
    if (target !== null) target.style.visibility = 'hidden';
    setRunning(false);
  });

  return (
    <div className="runner">
      <div className="runner__bar">
        <h1>Aim Trainer</h1>
        {stray > 0 && (
          <span className="badge badge--error">
            {stray} missed click{stray === 1 ? '' : 's'}
          </span>
        )}
        <span className="runner__progress tnum">
          {Math.min(hits + 1, total)} / {total}
        </span>
      </div>

      <div
        ref={boardRef}
        className="aim"
        onPointerDown={onPointerDown}
        role="group"
        aria-label="Aim trainer board"
        style={{ '--aim-size': 'clamp(2.75rem, 9vw, 4.25rem)' } as React.CSSProperties}
      >
        <button
          type="button"
          ref={targetRef}
          className="aim__target"
          style={{ visibility: 'hidden', left: '50%', top: '50%' }}
          aria-label="Target"
          tabIndex={-1}
        />

        {!running && (
          <div className="aim__intro">
            <span className="stage__headline">{hits === 0 ? 'Tap to begin' : 'Paused'}</span>
            <span className="stage__sub">
              {hits === 0
                ? `${total} targets. Each one appears the instant the last is cleared — clicks that miss cost you accuracy.`
                : `You left the tab, so that target was discarded and the clock stopped. Tap to resume with ${total - hits} to go.`}
            </span>
          </div>
        )}

        <div className="aim__hud">
          <span>
            {hits} / {total} cleared
          </span>
          <span>{stray} missed</span>
        </div>
      </div>

      <p className="keyhint">
        This mode needs a mouse, trackpad or touchscreen — there is no keyboard equivalent to
        aiming.
      </p>
    </div>
  );
}
