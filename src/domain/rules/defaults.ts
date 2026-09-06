/**
 * The rule book the application actually runs.
 *
 * `registry.ts` knows how to *hold* rules and ships the eight built-ins; the
 * three groups next door — `geometry/`, `function/`, `fitout/` — hold seventeen
 * more. Something has to put the twenty-five in one book, and this file is that
 * something.
 *
 * **Why a separate module rather than a few lines in `registry.ts`.** The three
 * groups import `Rule`, `RuleContext` and the scope helpers *from* `registry.ts`.
 * If `registry.ts` imported them back to compose the default book, the four
 * files would form an import cycle, and `pnpm cycles` keeps this repo at zero.
 * Composition therefore lives one layer above the pieces it composes, which is
 * the ordinary fix — and the one the cycle gate's own message asks for.
 *
 * **Why not a call in `main.tsx`.** It used to be exactly that: the seventeen
 * were written, tested, and registered by nobody, because registering them was
 * a line somebody had to remember to write in the app shell. Nobody did, for
 * long enough that a QC screen built its own private registry to work around it
 * (`screens/qc/RoomLabelReview/roomLabelReviewGateway.ts`). A default that is
 * only true when a caller remembers is not a default. So the full book is what
 * `createDefaultRuleRegistry()` *is*, there is no partial one to reach for, and
 * a screen that calls `selectViolations(state)` sees all twenty-five without
 * asking. The `register*` functions still exist and still take an explicit
 * registry — they are how a caller builds a *narrower* book on purpose, which
 * is a different thing from the default being narrow by accident.
 *
 * Twenty-five registered, twenty-three enabled: `registerFunctionRules` stands
 * `ROOM-HAS-DOOR` and `ROOM-MIN-AREA` down, because the function group covers
 * the same ground with better messages and both firing would report every room
 * twice. Both are still in the book, still listed, and can be switched back on.
 */

import { createRuleRegistry, BUILT_IN_RULES, type Rule, type RuleRegistry } from './registry';
import { FITOUT_RULES, registerFitoutRules } from './fitout';
import { FUNCTION_RULES, registerFunctionRules } from './function';
import { GEOMETRY_RULES, registerGeometryRules } from './geometry';

/**
 * Every rule that ships, in the order violations are listed in.
 *
 * The built-ins first, because they are the cheapest checks and the ones every
 * other rule assumes have already been made; then geometry, function, fit-out —
 * the order a QC report reads, from what stops the model being buildable to
 * what merely furnishes it badly.
 */
export const ALL_RULES: readonly Rule[] = [
  ...BUILT_IN_RULES,
  ...GEOMETRY_RULES,
  ...FUNCTION_RULES,
  ...FITOUT_RULES,
];

/**
 * A fresh registry holding every rule that ships.
 *
 * Registration goes through the three `register*` functions rather than one
 * `createRuleRegistry(ALL_RULES)` call, because registering is not only adding:
 * the function group also switches off the two built-ins it supersedes, and
 * that decision belongs next to the rules that make it, not here.
 *
 * A test that wants a narrower book builds its own with `createRuleRegistry`
 * and the `register*` functions, instead of switching rules off in the shared
 * one.
 */
export function createDefaultRuleRegistry(): RuleRegistry {
  const registry = createRuleRegistry(BUILT_IN_RULES);

  registerGeometryRules(registry);
  registerFunctionRules(registry);
  registerFitoutRules(registry);

  return registry;
}

let sharedRegistry: RuleRegistry | null = null;

/**
 * The registry the application shares.
 *
 * One instance, because switching a rule off is a project-wide decision and the
 * status bar and the QC panel have to agree about it. Tests should build their
 * own with `createDefaultRuleRegistry` instead of switching rules off in here.
 */
export function defaultRuleRegistry(): RuleRegistry {
  if (sharedRegistry === null) {
    sharedRegistry = createDefaultRuleRegistry();
  }

  return sharedRegistry;
}
