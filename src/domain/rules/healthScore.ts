/**
 * One number for "how is this model doing", and the two lists a report is built
 * from.
 *
 * A QC session produces hundreds of violations. Nobody reads hundreds of
 * anything, so the first thing a report has to answer is whether the model is
 * nearly finished or nearly hopeless — and it has to answer the same way twice
 * running, or the number is worse than no number. Everything here is therefore
 * **pure and determinate**: the score is a function of the violation list and
 * of nothing else, with no clock, no randomness, no dependence on the order the
 * rules happened to run in.
 *
 * The scale is deliberately blunt. A hundred is a model with nothing wrong;
 * every violation takes points off according to how badly it hurts, and the
 * floor is zero — a model cannot be worse than worthless, and a score of −40
 * would say nothing a score of 0 does not. The weights are the whole of the
 * judgement:
 *
 * - **8 for a `critical`** — something that cannot be built or cannot be used.
 *   A dozen of them leaves 4 points and the thirteenth takes the model to zero,
 *   which is about right: a dozen unbuildable things is not a drawing that
 *   needs corrections, it is a drawing that needs redoing.
 * - **3 for a `warning`** — real, arguable, and often signed off.
 * - **1 for a `suggestion`** — worth a glance, never worth blocking on.
 *
 * The weights live in `SEVERITY_PENALTY` rather than inside the function, so a
 * project that weighs safety differently changes a table.
 *
 * This module returns severities and numbers. It says nothing about colour,
 * about tokens, or about how any of it should be drawn: which band of score
 * gets which treatment is the interface's decision, made with the interface's
 * vocabulary, and making it here would put a design token in the domain.
 */

import type { LevelId } from '../spatial/types';
import { RULE_SEVERITIES, type RuleSeverity, type Violation } from './registry';

/* -------------------------------------------------------------------------- */
/* The scale.                                                                  */
/* -------------------------------------------------------------------------- */

/** A model with nothing wrong with it. */
export const HEALTH_SCORE_MAX = 100;

/** The floor. Nothing scores below it, however long the list gets. */
export const HEALTH_SCORE_MIN = 0;

/** Points each severity costs. The whole of the judgement, in one table. */
export const SEVERITY_PENALTY: Readonly<Record<RuleSeverity, number>> = {
  critical: 8,
  warning: 3,
  suggestion: 1,
};

/** How many violations of each severity a list holds. */
export type SeverityCounts = Readonly<Record<RuleSeverity, number>>;

/** The score, and every term that produced it. */
export interface HealthScore {
  /** Within `[0, 100]`, always a whole number. */
  readonly score: number;
  /** Points taken off before the floor was applied. */
  readonly penalty: number;
  /** Points the floor absorbed; `0` unless the penalty passed 100. */
  readonly clampedPenalty: number;
  readonly counts: SeverityCounts;
  readonly total: number;
  /** The worst severity present, or `null` for a clean model. */
  readonly worstSeverity: RuleSeverity | null;
}

/** The violations found on one level, with that level's own score. */
export interface LevelViolationGroup {
  /** The level, or `null` for the findings that are about the whole building. */
  readonly levelId: LevelId | null;
  /** In the order they were given, so a caller can sort them as it likes. */
  readonly violations: readonly Violation[];
  readonly counts: SeverityCounts;
  readonly score: number;
}

/* -------------------------------------------------------------------------- */
/* Counting.                                                                   */
/* -------------------------------------------------------------------------- */

function emptyCounts(): Record<RuleSeverity, number> {
  return { critical: 0, warning: 0, suggestion: 0 };
}

/** How many of each severity, counted once, in a fixed set of keys. */
export function countBySeverity(violations: readonly Violation[]): SeverityCounts {
  const counts = emptyCounts();

  for (const violation of violations) {
    counts[violation.severity] += 1;
  }

  return counts;
}

/** The worst severity in a list, or `null` when the list is empty. */
export function worstSeverityOf(violations: readonly Violation[]): RuleSeverity | null {
  for (const severity of RULE_SEVERITIES) {
    if (violations.some((violation) => violation.severity === severity)) {
      return severity;
    }
  }

  return null;
}

/* -------------------------------------------------------------------------- */
/* The score.                                                                  */
/* -------------------------------------------------------------------------- */

/**
 * The model's health, from 0 to 100.
 *
 * Pure and determinate: the same list always gives the same number, the order
 * of the list never changes it, and the list is never written to. Seven
 * criticals score 44; nothing at all scores 100.
 */
export function computeHealthScore(violations: readonly Violation[]): number {
  return explainHealthScore(violations).score;
}

/**
 * The score with its working shown.
 *
 * A number a person is asked to act on has to be one they can check, so this
 * hands back the counts, the raw penalty and how much of it the floor absorbed
 * — which is the difference between "twelve things wrong" and "sixty things
 * wrong", both of which score zero.
 */
export function explainHealthScore(violations: readonly Violation[]): HealthScore {
  const counts = countBySeverity(violations);

  let penalty = 0;

  for (const severity of RULE_SEVERITIES) {
    penalty += counts[severity] * SEVERITY_PENALTY[severity];
  }

  const score = Math.max(HEALTH_SCORE_MIN, HEALTH_SCORE_MAX - penalty);

  return {
    score,
    penalty,
    clampedPenalty: Math.max(0, penalty - HEALTH_SCORE_MAX),
    counts,
    total: violations.length,
    worstSeverity: worstSeverityOf(violations),
  };
}

/* -------------------------------------------------------------------------- */
/* The two lists a report screen needs.                                        */
/* -------------------------------------------------------------------------- */

/**
 * The violations of each level, with that level's own score.
 *
 * Levels come back in the order they first appear in the list, which for a run
 * of the rules is the order the model stacks them in. The findings about the
 * whole building — every `building`-scoped rule — land in one group with a
 * `null` level, and that group is always last: it is not a floor, and putting
 * it between two floors makes a report read as if it were one.
 *
 * Each group carries its own score, so a report can say which floor is dragging
 * the model down without the caller adding anything up.
 */
export function groupViolationsByLevel(
  violations: readonly Violation[],
): readonly LevelViolationGroup[] {
  const byLevel = new Map<string, Violation[]>();
  const order: (LevelId | null)[] = [];
  const BUILDING_KEY = '';

  for (const violation of violations) {
    const key = violation.levelId ?? BUILDING_KEY;
    const bucket = byLevel.get(key);

    if (bucket === undefined) {
      byLevel.set(key, [violation]);
      order.push(violation.levelId);
    } else {
      bucket.push(violation);
    }
  }

  const asGroup = (levelId: LevelId | null): LevelViolationGroup => {
    const found = byLevel.get(levelId ?? BUILDING_KEY) ?? [];

    return {
      levelId,
      violations: found,
      counts: countBySeverity(found),
      score: computeHealthScore(found),
    };
  };

  return [
    ...order.filter((levelId): levelId is LevelId => levelId !== null).map(asGroup),
    ...order.filter((levelId) => levelId === null).map(() => asGroup(null)),
  ];
}

/**
 * The same violations, worst first.
 *
 * Stable: two violations of one severity keep the order they came in, which is
 * the order the rules are registered in and then the order the model lists the
 * entities. That is what stops a report reshuffling itself between two runs
 * that found exactly the same things.
 *
 * The input is not touched; the sorted list is a new array.
 */
export function sortBySeverity(violations: readonly Violation[]): Violation[] {
  const rankOf = (severity: RuleSeverity): number => RULE_SEVERITIES.indexOf(severity);

  // Decorated with the input position, so the tie-break is explicit rather
  // than a promise about how the engine's sort happens to behave.
  return violations
    .map((violation, index) => ({ violation, index }))
    .sort((first, second) => {
      const bySeverity = rankOf(first.violation.severity) - rankOf(second.violation.severity);

      return bySeverity === 0 ? first.index - second.index : bySeverity;
    })
    .map((entry) => entry.violation);
}
