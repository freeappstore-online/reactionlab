/**
 * Timing primitives for the test stages.
 *
 * Every measurement in this app is taken from the `performance.now()` clock —
 * a monotonic, sub-millisecond timeline that is immune to the wall clock being
 * adjusted mid-session. `Date.now()` is used only for labelling a session with
 * a calendar date; it never appears in a subtraction.
 *
 * `requestAnimationFrame` timestamps share that same clock, which is what makes
 * it possible to schedule a stimulus and record its onset in one place.
 */

export function now(): number {
  return performance.now();
}

/** Uniform random delay in `[minMs, maxMs]`, rounded to whole milliseconds. */
export function randomDelay(minMs: number, maxMs: number): number {
  const lo = Math.min(minMs, maxMs);
  const hi = Math.max(minMs, maxMs);
  return Math.round(lo + Math.random() * (hi - lo));
}

export type FrameCallback = (frameTs: number) => void;

/**
 * Runs `onFire` on the first animation frame at or after `delayMs` from now.
 *
 * A `setTimeout` would fire at an arbitrary point inside a frame and leave the
 * stimulus waiting up to another whole frame to be painted, with no record of
 * when that happened. Polling frames instead means the callback runs *inside*
 * the frame that will paint the stimulus, and `frameTs` is that frame's own
 * timestamp — so a DOM write made in the callback and the onset time recorded
 * beside it describe the same paint.
 *
 * @returns a cancel function, safe to call more than once.
 */
export function afterDelay(delayMs: number, onFire: FrameCallback): () => void {
  const target = now() + Math.max(0, delayMs);
  let handle = 0;
  let cancelled = false;

  const tick = (frameTs: number): void => {
    if (cancelled) return;
    if (frameTs >= target) {
      onFire(frameTs);
      return;
    }
    handle = requestAnimationFrame(tick);
  };

  handle = requestAnimationFrame(tick);

  return () => {
    if (cancelled) return;
    cancelled = true;
    cancelAnimationFrame(handle);
  };
}

/**
 * Reaction time from a recorded stimulus onset to an input event.
 *
 * Prefers the event's own `timeStamp` (captured by the browser when the input
 * was received, before any JS ran) and falls back to reading the clock now.
 * Both are on the `performance.now()` timeline in every browser this app
 * supports.
 *
 * @returns the elapsed milliseconds, or `null` if the result is not usable.
 */
export function reactionTime(onsetTs: number, event: Event): number | null {
  const stamp = Number.isFinite(event.timeStamp) && event.timeStamp > 0 ? event.timeStamp : now();
  const delta = stamp - onsetTs;
  // A negative delta means the event predates the stimulus — that is a false
  // start, and the caller handles it separately rather than storing nonsense.
  if (!Number.isFinite(delta) || delta < 0) return null;
  return delta;
}
