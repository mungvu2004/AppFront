import { createRequire } from 'node:module';

import { RuleTester } from 'eslint';
import { describe, it } from 'vitest';

/**
 * The rule is CommonJS, because ESLint loads its plugins that way; this file is
 * ESM, because vitest runs it. `createRequire` is the bridge, and it is the only
 * reason this file is not a plain import.
 */
const requireFromHere = createRequire(import.meta.url);
const rule = requireFromHere('../no-raw-duration.js') as Parameters<RuleTester['run']>[1];

/** Inside the gate: the rule watches all of `src/`. */
const COMPONENT_FILE = 'src/components/ui/SampleCard.tsx';
const SCREEN_FILE = 'src/screens/qc/SampleScreen.tsx';
const HOOK_FILE = 'src/hooks/useSampleTween.ts';
const LIBRARY_FILE = 'src/lib/three/camera/sample.ts';

/** The one exemption: the module that owns the durations. */
const MOTION_MODULE_FILE = 'src/lib/motion/sample.ts';

/** Outside `src/` entirely. */
const CONFIG_FILE = 'scripts/sample.ts';

const ruleTester = new RuleTester({
  parserOptions: { ecmaVersion: 2020, sourceType: 'module' },
});

describe('local/no-raw-duration', () => {
  it('is registered under a name the config can reach', () => {
    const plugin = requireFromHere('../index.js') as { rules: Record<string, unknown> };

    if (plugin.rules['no-raw-duration'] !== rule) {
      throw new Error('eslint-rules/index.js chưa export no-raw-duration.');
    }
  });
});

ruleTester.run('no-raw-duration', rule, {
  valid: [
    // The fix: name the slot and let src/lib/motion decide what it means.
    {
      code: 'const t = { duration: durationSeconds("fast") };',
      filename: COMPONENT_FILE,
    },
    {
      code: 'const s = { transition: `opacity ${cssDurationMs("fast")} ease` };',
      filename: COMPONENT_FILE,
    },
    {
      code: 'const c = "animate-selection-enter motion-reduce:animate-none";',
      filename: COMPONENT_FILE,
    },

    // Theme-backed Tailwind utilities are the point of having a theme.
    { code: 'const c = "transition-colors duration-120";', filename: COMPONENT_FILE },
    { code: 'const c = "transition-opacity duration-standard";', filename: SCREEN_FILE },

    // Zero means "no animation" — a decision, not a duration.
    { code: 'const t = { duration: 0 };', filename: COMPONENT_FILE },
    { code: 'const t = { exit: { transition: { duration: 0 } } };', filename: COMPONENT_FILE },

    // Not a time, and not a property that can carry one.
    { code: 'const s = { transition: "none" };', filename: COMPONENT_FILE },
    { code: 'const label = "Optimistic Async (800ms)";', filename: SCREEN_FILE },
    { code: 'const help = "Hoàn tác trong 8s";', filename: COMPONENT_FILE },
    { code: 'const n = { width: 180 };', filename: COMPONENT_FILE },

    // The motion module is where durations are supposed to be written.
    { code: 'const t = { duration: 0.18 };', filename: MOTION_MODULE_FILE },
    { code: 'const s = { transition: "opacity 180ms ease" };', filename: MOTION_MODULE_FILE },

    // A duration as a parameter default is caller-supplied, not hardcoded —
    // this is the `useNumberTween(value, durationMs)` shape and it stays legal.
    { code: 'export const tween = (ms = MOTION_DURATIONS_MS.standard) => ms;', filename: HOOK_FILE },
    { code: 'export const tween = (ms = 260) => ms;', filename: HOOK_FILE },

    // Outside src/ the rule is silent.
    { code: 'const t = { duration: 0.18 };', filename: CONFIG_FILE },
  ],
  invalid: [
    // A duration typed straight into a framer-motion transition.
    {
      code: 'const t = { duration: 0.18 };',
      filename: COMPONENT_FILE,
      errors: [{ message: /durationSeconds\(\)/u }],
    },
    {
      code: 'const t = { duration: 260 };',
      filename: SCREEN_FILE,
      errors: 1,
    },
    {
      code: 'const t = { type: "tween", ease: EASE.default, duration: 0.34 };',
      filename: COMPONENT_FILE,
      errors: 1,
    },

    // A time spelled out inside a CSS string.
    {
      code: 'const s = { transition: "opacity 180ms ease" };',
      filename: COMPONENT_FILE,
      errors: [{ message: /cssDurationMs\(\)/u }],
    },
    {
      code: 'const s = { transition: "stroke 120ms ease, stroke-width 120ms ease" };',
      filename: COMPONENT_FILE,
      errors: 1,
    },
    {
      code: 'const s = { animation: "spin 1.6s linear infinite" };',
      filename: COMPONENT_FILE,
      errors: 1,
    },
    {
      code: 'const s = { animationDuration: "700ms" };',
      filename: SCREEN_FILE,
      errors: 1,
    },
    {
      code: 'const s = { transition: `opacity 0.3s ${curve}` };',
      filename: COMPONENT_FILE,
      errors: 1,
    },

    // Tailwind arbitrary values, which never touch the theme at all. This is the
    // shape that hid a 1.6s sweep whose keyframe was never even declared.
    {
      code: 'const c = "animate-[pipeline-sweep_1.6s_infinite]";',
      filename: COMPONENT_FILE,
      errors: [{ message: /arbitrary value/u }],
    },
    {
      code: 'const c = "animate-[dropdown-open_120ms_ease-out_forwards]";',
      filename: COMPONENT_FILE,
      errors: 1,
    },
    {
      code: 'const c = "transition-all duration-[300ms]";',
      filename: COMPONENT_FILE,
      errors: 1,
    },
    {
      code: 'const c = "hover:delay-[150ms]";',
      filename: SCREEN_FILE,
      errors: 1,
    },
    {
      code: 'const c = `flex ${base} animate-[skeleton-scan_2s_linear_infinite]`;',
      filename: COMPONENT_FILE,
      errors: 1,
    },

    // The widened gate: a hook or a plain library module can breach the
    // one-place-for-durations invariant just as easily as a view can.
    {
      code: 'const t = { duration: 0.18 };',
      filename: HOOK_FILE,
      errors: 1,
    },
    {
      code: 'const s = { animation: "sweep 1.6s linear infinite" };',
      filename: LIBRARY_FILE,
      errors: 1,
    },
    {
      code: 'const t = { duration: 340 };',
      filename: LIBRARY_FILE,
      errors: 1,
    },
  ],
});
