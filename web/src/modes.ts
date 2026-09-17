import type { TestMode, TestModeMeta } from './types';

/**
 * `floorMs` / `ceilMs` bound the speed component of the score. They are chosen
 * per mode from the typical human range for that task, not tuned to any user.
 */
export const MODE_META: Readonly<Record<TestMode, TestModeMeta>> = {
  simple: {
    id: 'simple',
    name: 'Simple Reaction',
    tagline: 'One stimulus, one response',
    description:
      'The screen holds, then flips. Tap or press the moment it does. Measures raw sensorimotor latency with nothing to decide.',
    primaryLabel: 'Mean reaction',
    primaryUnit: 'ms',
    floorMs: 150,
    ceilMs: 500,
    accuracyLabel: 'Clean starts',
  },
  choice: {
    id: 'choice',
    name: 'Choice Reaction',
    tagline: 'Four targets, pick the right one',
    description:
      'One of four targets lights up. Hit that one and only that one. Adds a decision stage on top of raw reaction speed.',
    primaryLabel: 'Mean reaction',
    primaryUnit: 'ms',
    floorMs: 250,
    ceilMs: 750,
    accuracyLabel: 'Correct choices',
  },
  gonogo: {
    id: 'gonogo',
    name: 'Go / No-Go',
    tagline: 'Respond, or hold back',
    description:
      'Blue means go, red means freeze. Roughly one stimulus in three is a no-go. Measures response inhibition as much as speed.',
    primaryLabel: 'Mean on go',
    primaryUnit: 'ms',
    floorMs: 250,
    ceilMs: 700,
    accuracyLabel: 'Correct responses',
  },
  aim: {
    id: 'aim',
    name: 'Aim Trainer',
    tagline: 'Hit every target, fast',
    description:
      'Targets appear one at a time in random positions. Clear them all. Measures visual search and pointing speed together.',
    primaryLabel: 'Time per target',
    primaryUnit: 'ms',
    floorMs: 350,
    ceilMs: 1200,
    accuracyLabel: 'On-target clicks',
  },
};

export function isTestMode(value: string): value is TestMode {
  return Object.prototype.hasOwnProperty.call(MODE_META, value);
}
