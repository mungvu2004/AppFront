import { describe, expect, it, vi } from 'vitest';

import tailwindConfig from '../../../../tailwind.config';

import {
  AMBIENT_LOOP_MS,
  clampProgress,
  createTransition,
  cssDurationMs,
  DURATION,
  durationMs,
  EASE,
  easingOf,
  SPRING,
  MOTION_DURATION_NAMES,
  MOTION_DURATIONS_MS,
  MOTION_EASING_NAMES,
  MOTION_EASINGS,
  prefersReducedMotion,
  REDUCED_MOTION_QUERY,
  sampleTransition,
  subscribeReducedMotion,
  type MediaMatcher,
  type MotionEasing,
} from '..';

/**
 * The durations `tailwind.config.ts` declares, and the only ones rule B allows.
 * Restated here so that a change to the table has to be a deliberate change to
 * this list too.
 */
const ALLOWED_DURATIONS_MS = [120, 180, 260, 340, 700];

/** How finely a curve is checked for bounce and overshoot. */
const CURVE_SAMPLE_COUNT = 200;

const sampleCurve = (easing: MotionEasing): number[] =>
  Array.from({ length: CURVE_SAMPLE_COUNT + 1 }, (_unused, index) =>
    easing.at(index / CURVE_SAMPLE_COUNT),
  );

/* -------------------------------------------------------------------------- */
/* A media query list that a test can toggle.                                  */
/* -------------------------------------------------------------------------- */

interface FakeMatcher {
  readonly matcher: MediaMatcher;
  readonly listenerCount: () => number;
  readonly lastQuery: () => string | null;
  readonly set: (reduced: boolean) => void;
}

const createFakeMatcher = (initial: boolean, options: { legacy?: boolean } = {}): FakeMatcher => {
  const listeners = new Set<() => void>();
  let matches = initial;
  let lastQuery: string | null = null;

  const legacy = options.legacy === true;

  const query = {
    get matches() {
      return matches;
    },
    media: REDUCED_MOTION_QUERY,
    ...(legacy
      ? {
          addListener: (listener: () => void) => listeners.add(listener),
          removeListener: (listener: () => void) => listeners.delete(listener),
        }
      : {
          addEventListener: (_event: string, listener: () => void) => listeners.add(listener),
          removeEventListener: (_event: string, listener: () => void) => listeners.delete(listener),
        }),
  };

  return {
    matcher: {
      matchMedia: (requested: string) => {
        lastQuery = requested;

        return query as unknown as MediaQueryList;
      },
    },
    listenerCount: () => listeners.size,
    lastQuery: () => lastQuery,
    set: (reduced: boolean) => {
      matches = reduced;
      [...listeners].forEach((listener) => listener());
    },
  };
};

/* -------------------------------------------------------------------------- */
/* Rule B, made machine-checkable.                                             */
/* -------------------------------------------------------------------------- */

/** `260ms` / `1.4s` out of an animation shorthand, in milliseconds. */
const durationOf = (shorthand: string): number | null => {
  const match = /(\d+(?:\.\d+)?)(ms|s)\b/.exec(shorthand);

  if (match === null) {
    return null;
  }

  const value = Number(match[1]);

  return match[2] === 's' ? value * 1000 : value;
};

describe('rule B: every animation in tailwind.config.ts is on the ladder', () => {
  const animations = tailwindConfig.theme?.extend?.animation as
    | Record<string, string>
    | undefined;

  it('finds the animations to check', () => {
    expect(animations).toBeDefined();
    expect(Object.keys(animations ?? {}).length).toBeGreaterThan(0);
  });

  it('paces each one at an interaction speed or a whole ambient beat', () => {
    const offLadder = Object.entries(animations ?? {}).filter(([, shorthand]) => {
      const ms = durationOf(shorthand);

      if (ms === null) {
        return true;
      }

      const isSpeed = Object.values(MOTION_DURATIONS_MS).includes(ms);
      const isWholeBeat = ms % AMBIENT_LOOP_MS === 0;

      return !isSpeed && !isWholeBeat;
    });

    // Named rather than counted, so a failure says which animation drifted.
    expect(offLadder.map(([name, shorthand]) => `${name}: ${shorthand}`)).toEqual([]);
  });
});

/* -------------------------------------------------------------------------- */
/* Durations.                                                                  */
/* -------------------------------------------------------------------------- */

describe('motion durations', () => {
  it('declares exactly four speeds, quickest first', () => {
    expect(MOTION_DURATION_NAMES).toEqual(['instant', 'fast', 'standard', 'slow']);
    expect(Object.keys(MOTION_DURATIONS_MS)).toHaveLength(4);
  });

  it('is the table the product moves at', () => {
    expect(MOTION_DURATIONS_MS).toEqual({
      instant: 120,
      fast: 180,
      standard: 260,
      slow: 340,
    });
  });

  it('picks every duration from the ladder tailwind.config.ts declares', () => {
    MOTION_DURATION_NAMES.forEach((name) => {
      expect(ALLOWED_DURATIONS_MS).toContain(MOTION_DURATIONS_MS[name]);
    });
  });

  it('gets slower down the list', () => {
    const values = MOTION_DURATION_NAMES.map((name) => MOTION_DURATIONS_MS[name]);

    expect(values).toEqual([...values].sort((left, right) => left - right));
    expect(new Set(values).size).toBe(values.length);
  });

  it('cannot be edited at runtime', () => {
    expect(Object.isFrozen(MOTION_DURATIONS_MS)).toBe(true);
  });

  it('reads a duration by name', () => {
    expect(durationMs('instant')).toBe(120);
    expect(durationMs('fast')).toBe(180);
    expect(durationMs('standard')).toBe(260);
    expect(durationMs('slow')).toBe(340);
  });

  it('reports every duration as zero under reduced motion', () => {
    MOTION_DURATION_NAMES.forEach((name) => {
      expect(durationMs(name, { reducedMotion: true })).toBe(0);
    });
  });

  it('keeps the full duration when reduced motion is off or unstated', () => {
    MOTION_DURATION_NAMES.forEach((name) => {
      expect(durationMs(name, { reducedMotion: false })).toBe(MOTION_DURATIONS_MS[name]);
      expect(durationMs(name, {})).toBe(MOTION_DURATIONS_MS[name]);
    });
  });

  it('writes a CSS time, and a zero one under reduced motion', () => {
    expect(cssDurationMs('standard')).toBe('260ms');
    expect(cssDurationMs('slow', { reducedMotion: true })).toBe('0ms');
  });

  it('keeps the ambient loop out of the four speeds but still on the allowed ladder', () => {
    expect(AMBIENT_LOOP_MS).toBe(700);
    expect(ALLOWED_DURATIONS_MS).toContain(AMBIENT_LOOP_MS);
    expect(Object.values(MOTION_DURATIONS_MS)).not.toContain(AMBIENT_LOOP_MS);
  });
});

/* -------------------------------------------------------------------------- */
/* The framer-motion compatibility layer.                                      */
/* -------------------------------------------------------------------------- */

describe('framer-motion constants', () => {
  it('still hands the shipped overlays exactly the seconds they had before', () => {
    // Pinned against the historical src/lib/motion.ts. A change here is a change
    // to how five already-reviewed overlays move.
    expect(DURATION).toEqual({
      fast: 0.12,
      quick: 0.18,
      default: 0.26,
      slow: 0.34,
      expand: 0.7,
    });
  });

  it('derives every one of those seconds from the millisecond table', () => {
    expect(DURATION.fast * 1000).toBeCloseTo(MOTION_DURATIONS_MS.instant, 9);
    expect(DURATION.quick * 1000).toBeCloseTo(MOTION_DURATIONS_MS.fast, 9);
    expect(DURATION.default * 1000).toBeCloseTo(MOTION_DURATIONS_MS.standard, 9);
    expect(DURATION.slow * 1000).toBeCloseTo(MOTION_DURATIONS_MS.slow, 9);
    expect(DURATION.expand * 1000).toBeCloseTo(AMBIENT_LOOP_MS, 9);
  });

  it('leaves the shipped curves untouched', () => {
    expect(EASE).toEqual({
      default: [0.32, 0.72, 0, 1],
      out: [0, 0, 0.58, 1],
      inOut: [0.42, 0, 0.58, 1],
      // Lifted out of Combobox, Select and Tabs, which each held it as a literal.
      standard: [0.4, 0, 0.2, 1],
    });
  });

  it('damps the one spring at least critically, so the sheet cannot bounce', () => {
    const { mass, stiffness, damping } = SPRING.sheet;

    // Below 2·√(k·m) the system is underdamped and overshoots its target. The
    // inequality is checked rather than the literal so that raising the
    // stiffness cannot quietly reintroduce a bounce.
    expect(damping).toBeGreaterThanOrEqual(2 * Math.sqrt(stiffness * mass));
  });

  it('still snaps the sheet with a spring rather than a tween', () => {
    expect(SPRING.sheet.type).toBe('spring');
    expect(SPRING.sheet).toEqual({ type: 'spring', mass: 1, damping: 30, stiffness: 220 });
  });

  it('keeps the lifted curve distinct from the symmetric inOut it resembles', () => {
    // If these two ever converge it must be a deliberate migration, not a slip:
    // three shipped controls move on EASE.standard.
    expect(EASE.standard).not.toEqual([...MOTION_EASINGS.inOut.points]);
  });
});

/* -------------------------------------------------------------------------- */
/* Curves.                                                                     */
/* -------------------------------------------------------------------------- */

describe('motion easings', () => {
  it('declares exactly three curves', () => {
    expect(MOTION_EASING_NAMES).toEqual(['enter', 'exit', 'inOut']);
    expect(Object.keys(MOTION_EASINGS)).toHaveLength(3);
  });

  it('starts at rest and arrives exactly, without a rounding error', () => {
    MOTION_EASING_NAMES.forEach((name) => {
      expect(easingOf(name).at(0)).toBe(0);
      expect(easingOf(name).at(1)).toBe(1);
    });
  });

  it('never turns back on itself — no bounce', () => {
    MOTION_EASING_NAMES.forEach((name) => {
      const values = sampleCurve(easingOf(name));

      values.forEach((value, index) => {
        if (index > 0) {
          expect(value).toBeGreaterThanOrEqual(values[index - 1] as number);
        }
      });
    });
  });

  it('never leaves the unit interval — no overshoot, no elastic', () => {
    MOTION_EASING_NAMES.forEach((name) => {
      sampleCurve(easingOf(name)).forEach((value) => {
        expect(value).toBeGreaterThanOrEqual(0);
        expect(value).toBeLessThanOrEqual(1);
      });
    });
  });

  it('keeps every control point inside the unit square, which is what forbids a spring', () => {
    MOTION_EASING_NAMES.forEach((name) => {
      easingOf(name).points.forEach((coordinate) => {
        expect(coordinate).toBeGreaterThanOrEqual(0);
        expect(coordinate).toBeLessThanOrEqual(1);
      });
    });
  });

  it('decelerates on the way in: past halfway before half the time', () => {
    expect(easingOf('enter').at(0.5)).toBeGreaterThan(0.5);
  });

  it('accelerates on the way out: still short of halfway at half the time', () => {
    expect(easingOf('exit').at(0.5)).toBeLessThan(0.5);
  });

  it('is exactly halfway at half the time, being eased at both ends equally', () => {
    expect(easingOf('inOut').at(0.5)).toBeCloseTo(0.5, 6);
  });

  it('mirrors itself either side of the midpoint, so a move back is the move out reversed', () => {
    const inOut = easingOf('inOut');
    const [x1, y1, x2, y2] = inOut.points;

    // The algebraic condition for symmetry about (0.5, 0.5).
    expect(x2).toBeCloseTo(1 - x1, 9);
    expect(y2).toBeCloseTo(1 - y1, 9);

    expect(inOut.at(0.25) + inOut.at(0.75)).toBeCloseTo(1, 6);
    expect(inOut.at(0.1) + inOut.at(0.9)).toBeCloseTo(1, 6);
  });

  it('describes the same curve to CSS that it samples in JavaScript', () => {
    expect(easingOf('enter').css).toBe('cubic-bezier(0, 0, 0.2, 1)');
    expect(easingOf('exit').css).toBe('cubic-bezier(0.4, 0, 1, 1)');
    expect(easingOf('inOut').css).toBe('cubic-bezier(0.4, 0, 0.6, 1)');
  });

  it('clamps progress that arrives out of range or not a number', () => {
    const inOut = easingOf('inOut');

    expect(inOut.at(-1)).toBe(0);
    expect(inOut.at(2)).toBe(1);
    expect(inOut.at(Number.NaN)).toBe(0);
    expect(clampProgress(Number.POSITIVE_INFINITY)).toBe(0);
    expect(clampProgress(0.25)).toBe(0.25);
  });

  it('inverts its own curve accurately enough to be invisible', () => {
    // x(t) is solved by bisection; check the round trip at the awkward middle.
    const inOut = easingOf('inOut');

    expect(inOut.at(0.5)).toBeCloseTo(0.5, 6);
    expect(inOut.at(0.1)).toBeGreaterThan(0);
    expect(inOut.at(0.9)).toBeLessThan(1);
  });
});

/* -------------------------------------------------------------------------- */
/* Sampling a transition without keeping time.                                 */
/* -------------------------------------------------------------------------- */

describe('sampleTransition', () => {
  it('is at the start before any time has passed', () => {
    expect(sampleTransition({ duration: 'standard' }, 0)).toEqual({ value: 0, done: false });
  });

  it('is at the end once the full duration has passed', () => {
    expect(sampleTransition({ duration: 'standard' }, 260)).toEqual({ value: 1, done: true });
  });

  it('stays at the end afterwards rather than running on', () => {
    expect(sampleTransition({ duration: 'fast' }, 10_000)).toEqual({ value: 1, done: true });
  });

  it('is part way through part way through', () => {
    const { value, done } = sampleTransition({ duration: 'standard', easing: 'inOut' }, 130);

    expect(done).toBe(false);
    expect(value).toBeCloseTo(0.5, 6);
  });

  it('applies the curve it is given', () => {
    const eased = sampleTransition({ duration: 'slow', easing: 'enter' }, 170);
    const linearHalf = 0.5;

    expect(eased.value).toBeGreaterThan(linearHalf);
  });

  it('is finished at once under reduced motion, at zero elapsed', () => {
    MOTION_DURATION_NAMES.forEach((name) => {
      expect(sampleTransition({ duration: name, reducedMotion: true }, 0)).toEqual({
        value: 1,
        done: true,
      });
    });
  });
});

/* -------------------------------------------------------------------------- */
/* A transition that keeps its own time.                                       */
/* -------------------------------------------------------------------------- */

describe('createTransition', () => {
  it('starts at the far end from where it is heading', () => {
    expect(createTransition({ duration: 'standard' }).value).toBe(0);
    expect(createTransition({ duration: 'standard' }, { direction: 'backward' }).value).toBe(1);
  });

  it('takes the duration of the slot it names', () => {
    expect(createTransition({ duration: 'instant' }).durationMs).toBe(120);
    expect(createTransition({ duration: 'slow' }).durationMs).toBe(340);
  });

  it('advances to the end and stops there', () => {
    const transition = createTransition({ duration: 'standard' });

    transition.advance(130);
    expect(transition.done).toBe(false);
    expect(transition.progress).toBeCloseTo(0.5, 6);

    transition.advance(130);
    expect(transition.done).toBe(true);
    expect(transition.value).toBe(1);

    transition.advance(1_000);
    expect(transition.progress).toBe(1);
  });

  it('ignores a step that is zero, negative or not a number', () => {
    const transition = createTransition({ duration: 'standard' });

    transition.advance(0);
    transition.advance(-50);
    transition.advance(Number.NaN);

    expect(transition.progress).toBe(0);
  });

  it('reverses from where it is rather than jumping to the end first', () => {
    const transition = createTransition({ duration: 'standard' });

    transition.advance(130);
    const midpoint = transition.value;

    transition.aimAt('backward');

    expect(transition.value).toBe(midpoint);
    expect(transition.done).toBe(false);

    transition.advance(130);
    expect(transition.progress).toBe(0);
    expect(transition.done).toBe(true);
  });

  it('counts as done when it has arrived at the backward end too', () => {
    const transition = createTransition({ duration: 'standard' }, { direction: 'backward' });

    transition.advance(260);

    expect(transition.value).toBe(0);
    expect(transition.done).toBe(true);
  });

  it('jumps to an end on request', () => {
    const transition = createTransition({ duration: 'slow' });

    transition.settleAt('forward');

    expect(transition.value).toBe(1);
    expect(transition.done).toBe(true);
  });

  it('is over before it starts under reduced motion, and cannot be advanced', () => {
    const transition = createTransition({ duration: 'slow', reducedMotion: true });

    expect(transition.durationMs).toBe(0);
    expect(transition.value).toBe(1);
    expect(transition.done).toBe(true);

    transition.advance(10);
    expect(transition.value).toBe(1);
  });

  it('snaps straight to the other end when reversed under reduced motion', () => {
    const transition = createTransition({ duration: 'standard', reducedMotion: true });

    transition.aimAt('backward');

    expect(transition.value).toBe(0);
    expect(transition.done).toBe(true);
  });

  it('can be resumed from a position a caller already had', () => {
    const transition = createTransition({ duration: 'standard' }, { progress: 0.5 });

    expect(transition.progress).toBe(0.5);
  });
});

/* -------------------------------------------------------------------------- */
/* The operating system preference.                                            */
/* -------------------------------------------------------------------------- */

describe('prefersReducedMotion', () => {
  it('asks the standard media query', () => {
    const fake = createFakeMatcher(false);

    prefersReducedMotion(fake.matcher);

    expect(fake.lastQuery()).toBe('(prefers-reduced-motion: reduce)');
  });

  it('reports the setting', () => {
    expect(prefersReducedMotion(createFakeMatcher(true).matcher)).toBe(true);
    expect(prefersReducedMotion(createFakeMatcher(false).matcher)).toBe(false);
  });

  it('allows motion when the environment has no matchMedia at all', () => {
    const blind: MediaMatcher = {
      matchMedia: undefined as unknown as MediaMatcher['matchMedia'],
    };

    expect(prefersReducedMotion(blind)).toBe(false);
  });

  it('allows motion when matchMedia throws rather than propagating the failure', () => {
    const throwing: MediaMatcher = {
      matchMedia: () => {
        throw new Error('unsupported');
      },
    };

    expect(prefersReducedMotion(throwing)).toBe(false);
  });
});

describe('subscribeReducedMotion', () => {
  it('reports a change while the application is open', () => {
    const fake = createFakeMatcher(false);
    const listener = vi.fn();

    subscribeReducedMotion(listener, fake.matcher);
    fake.set(true);

    expect(listener).toHaveBeenCalledWith(true);
  });

  it('stops listening once unsubscribed', () => {
    const fake = createFakeMatcher(false);
    const listener = vi.fn();

    const unsubscribe = subscribeReducedMotion(listener, fake.matcher);
    expect(fake.listenerCount()).toBe(1);

    unsubscribe();
    expect(fake.listenerCount()).toBe(0);

    fake.set(true);
    expect(listener).not.toHaveBeenCalled();
  });

  it('falls back to the deprecated listener pair for older Safari', () => {
    const fake = createFakeMatcher(false, { legacy: true });
    const listener = vi.fn();

    const unsubscribe = subscribeReducedMotion(listener, fake.matcher);
    fake.set(true);

    expect(listener).toHaveBeenCalledWith(true);

    unsubscribe();
    expect(fake.listenerCount()).toBe(0);
  });

  it('returns a usable unsubscribe when there is nothing to subscribe to', () => {
    const throwing: MediaMatcher = {
      matchMedia: () => {
        throw new Error('unsupported');
      },
    };

    expect(() => subscribeReducedMotion(vi.fn(), throwing)()).not.toThrow();
  });
});
