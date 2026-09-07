/**
 * Copy and colour tables the rule report reads, and nothing else.
 *
 * Three tables live here rather than in the view files because all three are
 * read from more than one of them, and because each one exists to stop a
 * different mistake:
 *
 * - {@link SEVERITY_LABELS} is a **mirror** of `RULE_SEVERITY_LABELS` in
 *   `src/domain/rules/registry.ts`, copied word for word. Invariant R-60 forbids
 *   a view importing `src/domain` at all, so the three words cannot be reached
 *   from here; writing them down is the only way to print them, and writing any
 *   *other* three words is what the spec forbids. If the domain ever renames a
 *   severity, this table is the one place to follow it.
 * - {@link SEVERITY_BADGE} maps a severity onto a `Badge` variant. It is the
 *   whole of the screen's colour policy: red belongs to `critical` alone, and
 *   only inside a badge, which is a chip with a dot roughly 88×20 px. There is
 *   no other red on this screen — no banner, no block, no alert light.
 * - {@link GROUP_LABELS} mirrors `RULE_GROUP_LABELS` for the same reason as the
 *   severities, and feeds the group filter.
 *
 * Nothing here computes. The four filter options are a constant because the
 * contract fixes them at four, and `RuleReportLevelFilter` is what makes a fifth
 * one a type error rather than a design drift.
 */

import type { PassedRule, RuleReportLevelFilter, RuleReportRow } from './types';

/**
 * The severity and group unions, read back off the props rather than imported.
 *
 * Both live in `src/domain/rules/registry.ts`, and a `import type` from there
 * would be legal — invariant R-60 erases type positions. It is still not done:
 * the contract says the view's whole world is `RuleReportViewProps`, and taking
 * the two unions from the row and the rule that carry them keeps that literally
 * true, with no line in this folder naming `@/domain` at all.
 */
type RuleSeverity = RuleReportRow['severity'];
type RuleGroup = PassedRule['group'];

/** The variants `Badge` accepts. Spelled out so this file needs no value import. */
export type BadgeVariant = 'verified' | 'attention' | 'violation' | 'neutral';

/**
 * What the interface calls each severity — the three words, and only these three.
 *
 * Mirror of `RULE_SEVERITY_LABELS` (`src/domain/rules/registry.ts:63-67`).
 */
export const SEVERITY_LABELS: Readonly<Record<RuleSeverity, string>> = {
  critical: 'nghiêm trọng',
  warning: 'cảnh báo',
  suggestion: 'gợi ý',
};

/**
 * The one place red is allowed on this screen.
 *
 * `critical` gets `violation`, which is the red chip. `warning` gets the amber
 * one. `suggestion` gets `neutral` on purpose: a suggestion is not a warning,
 * and giving it the amber chip would put a second attention colour on a row
 * that is only offering advice. Its real severity still reads, in words, from
 * {@link SEVERITY_LABELS} inside the chip.
 */
export const SEVERITY_BADGE: Readonly<Record<RuleSeverity, BadgeVariant>> = {
  critical: 'violation',
  warning: 'attention',
  suggestion: 'neutral',
};

/**
 * What the interface calls each rule group.
 *
 * Mirror of `RULE_GROUP_LABELS` (`src/domain/rules/registry.ts:82-88`).
 */
export const GROUP_LABELS: Readonly<Record<RuleGroup, string>> = {
  geometry: 'hình học',
  circulation: 'lưu thông',
  area: 'diện tích',
  annotation: 'ghi chú',
  levels: 'cao độ tầng',
};

/** The order the group filter lists its options in. */
export const GROUP_ORDER: readonly RuleGroup[] = [
  'geometry',
  'circulation',
  'area',
  'annotation',
  'levels',
];

/** The value both `Select`s use for "no narrowing at all". */
export const ANY_OPTION = 'all';

/** The four segments, fixed by the contract. A fifth one would not type-check. */
export const LEVEL_FILTER_OPTIONS: readonly { label: string; value: RuleReportLevelFilter }[] = [
  { label: 'Tất cả', value: 'all' },
  { label: 'Vi phạm', value: 'violation' },
  { label: 'Cảnh báo', value: 'warning' },
  { label: 'Đạt', value: 'passed' },
];

/**
 * The focus ring every control this screen builds by hand wears.
 *
 * Invariant A12 asks for 2px at 2px offset, and `expectAccessible` refuses a
 * ring that has one without the other — so the pair travels together, as one
 * string, instead of being retyped at each call site where half of it could go
 * missing.
 */
export const FOCUS_RING =
  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-bg-app';
