import { useCallback, useEffect, useRef, useState } from 'react';
import type { Settings, Trial } from '../types';

/**
 * Visual state of a test stage. Each one has a colour and a block of copy that
 * are already in the DOM and selected purely by CSS, so switching phase costs
 * one attribute write and nothing else.
 */
export type StagePhase = 'idle' | 'wait' | 'go' | 'hold' | 'feedback' | 'paused';

export interface TestOutcome {
  readonly trials: readonly Trial[];
  readonly durationMs: number;
  /** 0..1, defined per mode — see the README. `null` when nothing was attempted. */
  readonly accuracy: number | null;
}

export interface TestProps {
  readonly settings: Settings;
  readonly onComplete: (outcome: TestOutcome) => void;
}

/** How long a stimulus stays up before the trial is scored as a miss. */
export const RESPONSE_WINDOW_MS = 2000;

/**
 * Input made within this long of a phase change is swallowed. It stops the tail
 * of the press that ended one trial from registering as a false start on the
 * next, without ever masking a genuine reaction.
 */
export const INPUT_LOCKOUT_MS = 250;

export interface Stage<E extends HTMLElement> {
  readonly ref: React.RefObject<E | null>;
  /** For rendering; always trails `phaseRef` by one React commit. */
  readonly phase: StagePhase;
  /** Authoritative, readable synchronously from event handlers. */
  readonly phaseRef: React.RefObject<StagePhase>;
  /**
   * Moves to a phase, writing `data-phase` on the stage element immediately.
   *
   * Called from inside a `requestAnimationFrame` callback, the write lands in
   * that same frame — so the stimulus is painted on the frame whose timestamp
   * was recorded as its onset, with no React render in between.
   */
  readonly goTo: (next: StagePhase) => void;
}

export function useStage<E extends HTMLElement>(initial: StagePhase = 'idle'): Stage<E> {
  const ref = useRef<E | null>(null);
  const phaseRef = useRef<StagePhase>(initial);
  const [phase, setPhase] = useState<StagePhase>(initial);

  const goTo = useCallback((next: StagePhase) => {
    phaseRef.current = next;
    if (ref.current !== null) ref.current.dataset['phase'] = next;
    setPhase(next);
  }, []);

  return { ref, phase, phaseRef, goTo };
}

/** Holds the single in-flight frame timer for a stage, cancelling on unmount. */
export function useFrameTimer(): {
  readonly set: (cancel: () => void) => void;
  readonly clear: () => void;
} {
  const cancelRef = useRef<(() => void) | null>(null);

  const clear = useCallback(() => {
    cancelRef.current?.();
    cancelRef.current = null;
  }, []);

  const set = useCallback(
    (cancel: () => void) => {
      cancelRef.current?.();
      cancelRef.current = cancel;
    },
    [],
  );

  useEffect(() => clear, [clear]);

  return { set, clear };
}

/**
 * Window-level key handling for a stage.
 *
 * Key repeat is dropped, and the browser's own scroll-on-space is suppressed
 * so a held spacebar cannot move the page mid-trial.
 *
 * @param keys lower-cased keys to accept, or `null` to accept any key
 */
export function useKeyInput(
  keys: readonly string[] | null,
  handler: (key: string, event: KeyboardEvent) => void,
): void {
  const handlerRef = useRef(handler);
  handlerRef.current = handler;

  const keysRef = useRef(keys);
  keysRef.current = keys;

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent): void => {
      if (event.repeat || event.metaKey || event.ctrlKey || event.altKey) return;

      const key = event.key === ' ' ? 'space' : event.key.toLowerCase();
      const accepted = keysRef.current;
      if (accepted !== null && !accepted.includes(key)) return;

      // Space and the arrow keys scroll by default.
      if (key === 'space' || key.startsWith('arrow')) event.preventDefault();

      handlerRef.current(key, event);
    };

    window.addEventListener('keydown', onKeyDown);
    return () => {
      window.removeEventListener('keydown', onKeyDown);
    };
  }, []);
}

/**
 * Calls `onHide` whenever the page stops being visible.
 *
 * Animation frames stop in a backgrounded tab, so an armed stimulus simply
 * waits — and would then fire on the first frame after the user comes back,
 * before their attention is anywhere near the screen. Every test treats that
 * as a paused trial and makes the user restart it deliberately, rather than
 * recording a reaction to something they never saw coming.
 */
export function useVisibilityPause(onHide: () => void): void {
  const ref = useRef(onHide);
  ref.current = onHide;

  useEffect(() => {
    const handler = (): void => {
      if (document.hidden) ref.current();
    };
    document.addEventListener('visibilitychange', handler);
    return () => {
      document.removeEventListener('visibilitychange', handler);
    };
  }, []);
}

/** Accuracy for the reaction modes: clean responses over everything attempted. */
export function attemptAccuracy(trials: readonly Trial[], correct: number): number | null {
  if (trials.length === 0) return null;
  return correct / trials.length;
}
