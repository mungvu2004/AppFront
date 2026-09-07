/**
 * The two bands that sit above the list: four numbers, then the filters.
 *
 * Both are here rather than in `RuleReport.tsx` because the frame crossed
 * invariant R-22's 400-line ceiling, and these two pieces are the ones nothing
 * else reaches into. Neither holds state; both are functions of the same props
 * the screen was handed.
 *
 * ## Why the four numbers carry no colour
 *
 * A summary strip is the most tempting place on this screen to put a red tile,
 * and the spec forbids exactly that: no coloured cards, no border, no fill, no
 * warning glyph. The reason is that a count is not a verdict — "7" is only
 * alarming next to a rule, and the rule is in the row. Colour on this band would
 * shout before the reader has read anything, and it would shout on every load,
 * including the loads where the number is 0. So the band is four numbers in
 * mono, four lower-case words under them, and nothing else.
 *
 * The numbers run up rather than appearing, through `useCountUp` — the React
 * face of the shared engine, which formats every frame through `formatNumber`.
 * Rendering `text` and never `value` is what guarantees no frame shows a
 * malformed number, and it is why invariant A15 has nothing to catch here.
 *
 * ## Why the level filter's options are derived and the group filter's are not
 *
 * The five rule groups are a closed union in the domain, so the group filter
 * lists all five always — a fixed control that does not change shape as results
 * arrive. Levels are not closed: a project has whatever floors it has, and the
 * only place the view is told their names is `row.levelLabel`. So that list is
 * read off the rows. It is a `useMemo` over props, not a computation about the
 * building — the view still knows nothing it was not handed.
 */

import { useMemo } from 'react';

import { SegmentedControl } from '@/components/ui/SegmentedControl';
import { Select } from '@/components/ui/Select';
import { useCountUp } from '@/hooks/useCountUp';

import { ANY_OPTION, GROUP_LABELS, GROUP_ORDER, LEVEL_FILTER_OPTIONS } from './RuleReportLabels';
import type {
  RuleReportFilters,
  RuleReportGroup,
  RuleReportLevelFilter,
  RuleReportRow,
  RuleReportSummary as RuleReportSummaryModel,
} from './types';

/** One of the four figures: the number over the word that says what it counts. */
interface SummaryStatProps {
  readonly value: number;
  readonly label: string;
}

function SummaryStat({ value, label }: SummaryStatProps) {
  const { text } = useCountUp(value, { format: { fractionDigits: 0 } });

  return (
    <div className="flex flex-col-reverse gap-1">
      <dt className="text-sm text-text-secondary">{label}</dt>
      <dd className="font-mono text-3xl tabular-nums text-text-primary">{text}</dd>
    </div>
  );
}

export interface RuleReportSummaryStripProps {
  readonly summary: RuleReportSummaryModel;
}

/**
 * The four figures, in the order the contract fixes them.
 *
 * `cảnh báo` holds warnings and suggestions together, deliberately: a suggestion
 * is never counted as a violation, so the alarming number is the one that has
 * actually earned it. Each row still shows its own severity in words.
 */
export function RuleReportSummaryStrip({ summary }: RuleReportSummaryStripProps) {
  return (
    <dl className="grid grid-cols-2 gap-6 sm:grid-cols-4">
      <SummaryStat value={summary.evaluated} label="tổng số kiểm tra" />
      <SummaryStat value={summary.passed} label="đạt" />
      <SummaryStat value={summary.warnings} label="cảnh báo" />
      <SummaryStat value={summary.violations} label="vi phạm" />
    </dl>
  );
}

/** A floor the results actually mention, as the level filter offers it. */
interface LevelOption {
  readonly value: string;
  readonly label: string;
}

/**
 * The floors named by the rows on screen, each once, in the order first seen.
 *
 * Rows filed under a building-wide rule carry `levelId: null` and are left out —
 * there is no floor to offer for them.
 */
function levelOptionsOf(
  groups: readonly RuleReportGroup[],
  resolvedRows: readonly RuleReportRow[],
): readonly LevelOption[] {
  const seen = new Map<string, string>();

  const remember = (row: RuleReportRow): void => {
    if (row.levelId !== null && row.levelLabel !== null && !seen.has(row.levelId)) {
      seen.set(row.levelId, row.levelLabel);
    }
  };

  for (const group of groups) {
    for (const row of group.rows) {
      remember(row);
    }
  }

  for (const row of resolvedRows) {
    remember(row);
  }

  return [...seen].map(([value, label]) => ({ value, label }));
}

export interface RuleReportFilterBarProps {
  readonly filters: RuleReportFilters;
  readonly groups: readonly RuleReportGroup[];
  readonly resolvedRows: readonly RuleReportRow[];
  readonly onFilterChange: (next: RuleReportFilters) => void;
}

/**
 * The segmented control and the two selects.
 *
 * Every `Select` on this screen passes `label`. That is not a style preference:
 * `Select.Trigger` carries `role="combobox"`, which is not a role that takes its
 * name from the text inside it, so a select without `label` has no accessible
 * name at all and `expectAccessible` refuses it. The label is visible rather
 * than `sr-only` because a filter bar with two unlabelled dropdowns is a puzzle
 * for everybody, not only for a screen reader.
 */
export function RuleReportFilterBar({
  filters,
  groups,
  resolvedRows,
  onFilterChange,
}: RuleReportFilterBarProps) {
  const levelOptions = useMemo(
    () => levelOptionsOf(groups, resolvedRows),
    [groups, resolvedRows],
  );

  return (
    <div className="flex flex-wrap items-end gap-4">
      <SegmentedControl
        aria-label="lọc theo mức độ"
        options={LEVEL_FILTER_OPTIONS.map((option) => ({ ...option }))}
        value={filters.level}
        onChange={(value: RuleReportLevelFilter) => {
          onFilterChange({ ...filters, level: value });
        }}
      />

      <Select
        label="nhóm luật"
        className="w-[200px]"
        value={filters.group}
        options={[
          { label: 'tất cả nhóm luật', value: ANY_OPTION },
          ...GROUP_ORDER.map((group) => ({ label: GROUP_LABELS[group], value: group })),
        ]}
        onChange={(value) => {
          onFilterChange({ ...filters, group: value as RuleReportFilters['group'] });
        }}
      />

      <Select
        label="tầng"
        className="w-[200px]"
        value={filters.levelId}
        options={[
          { label: 'tất cả các tầng', value: ANY_OPTION },
          ...levelOptions.map((option) => ({ label: option.label, value: option.value })),
        ]}
        onChange={(value) => {
          onFilterChange({ ...filters, levelId: value as RuleReportFilters['levelId'] });
        }}
      />
    </div>
  );
}
