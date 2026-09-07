/**
 * The list itself: rules that failed, rules that passed, and what was resolved.
 *
 * ## The collapsible group is built here, on purpose
 *
 * There is no shared accordion in `src/components`, and the spec forbids adding
 * one. So {@link RuleReportSection} is a `<button aria-expanded>` over a body
 * the button owns by `aria-controls` — the plainest shape that a keyboard
 * reaches with Tab and operates with Enter or Space for free, because it is a
 * real button and not a div wearing a click handler (invariant A12).
 *
 * A `<details>` element would have been shorter and is what the survey
 * suggested; it is not used because its open state would then live in the DOM,
 * while `expandedRuleCodes` says the state lives in the hook. Two owners of one
 * boolean is the bug that makes a group snap shut when a filter changes.
 *
 * ## Resolved rows do not disappear
 *
 * `resolvedRows` are rendered, in their own group at the foot of the list. The
 * group collapses; the rows are never filtered out of it. Somebody who has
 * fixed eleven things should be able to see eleven things — a list that empties
 * as you work erases the only evidence of the work.
 *
 * ## Where the red is
 *
 * One `Badge` per row, and nowhere else. `SEVERITY_BADGE` is the whole colour
 * policy and it puts red on `critical` alone. A badge is a dot plus two or three
 * words: about 88×20 px, and the largest violation-coloured area anywhere on
 * this screen. There is no red band, no red block, and no red anywhere in the
 * summary strip, the group headers, or the footer.
 *
 * ## The selection pulse
 *
 * A newly selected row rings three times and then holds still. Three beats at
 * `slow` is 1020 ms — the beats are counted in `animationIterationCount`, which
 * is a count and not a duration, and the duration itself comes from
 * `cssDurationMs`, so invariant R-71 has no raw number to catch. It never
 * repeats: a row that blinks forever is noise, and this one stops with the ring
 * still drawn, which is what "selected" looks like afterwards. Under reduced
 * motion `cssDurationMs` returns `0ms` and the ring simply appears.
 */

import { ChevronDown, ChevronRight } from 'lucide-react';
import { useId, type ReactNode } from 'react';

import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Table } from '@/components/ui/Table';
import { useReducedMotion } from '@/hooks/useReducedMotion';
import { formatNumber } from '@/lib/format/number';
import { cssDurationMs } from '@/lib/motion';
import { cn } from '@/lib/utils';

import { FOCUS_RING, GROUP_LABELS, SEVERITY_BADGE, SEVERITY_LABELS } from './RuleReportLabels';
import type { PassedRule, RuleReportGroup, RuleReportRow } from './types';

/** How many times a freshly selected row rings before it holds still. */
const SELECTION_PULSE_BEATS = 3;

/** The five columns of the row table — the loading skeleton stands in for these. */
export const ROW_COLUMNS = 5;

/** A count, as a person reads it. The view prints; it never formats by hand (A15). */
function count(value: number): string {
  return formatNumber(value, { fractionDigits: 0 });
}

export interface RuleReportSectionProps {
  readonly title: string;
  /** The short line beside the title — how many rows are inside. */
  readonly summary: string;
  readonly isOpen: boolean;
  readonly onToggle: () => void;
  readonly children: ReactNode;
}

/** One collapsible group: a real button, and the body it controls. */
export function RuleReportSection({
  title,
  summary,
  isOpen,
  onToggle,
  children,
}: RuleReportSectionProps) {
  const bodyId = useId();
  const Chevron = isOpen ? ChevronDown : ChevronRight;

  return (
    <section className="flex flex-col rounded border border-border-default bg-bg-surface">
      <h3 className="m-0">
        <button
          type="button"
          aria-expanded={isOpen}
          aria-controls={bodyId}
          onClick={onToggle}
          className={cn(
            'flex w-full items-center justify-between gap-3 rounded px-3 py-2 text-left',
            'transition-colors duration-standard hover:bg-bg-hover',
            FOCUS_RING,
          )}
        >
          <span className="flex min-w-0 items-center gap-2">
            <Chevron aria-hidden="true" className="h-4 w-4 shrink-0 text-text-muted" />
            <span className="truncate text-sm font-medium text-text-primary">{title}</span>
          </span>
          <span className="shrink-0 text-xs text-text-secondary">{summary}</span>
        </button>
      </h3>

      <div id={bodyId} className={cn('px-3', isOpen && 'pb-3')}>
        {isOpen ? children : null}
      </div>
    </section>
  );
}

interface RowActionsProps {
  readonly row: RuleReportRow;
  readonly onViewRow: (rowKey: string) => void;
}

/**
 * What a row offers.
 *
 * "Xem" is the only action, and that is the honest state of the repository:
 * there is no auto-fix and no dismiss behind `canAutoFix` / `canDismiss`, so
 * neither is drawn — not greyed out, not as a placeholder. The cell they would
 * occupy is this one, so switching a capability on later adds a button here and
 * moves nothing.
 */
function RowActions({ row, onViewRow }: RowActionsProps) {
  return (
    <Button
      variant="ghost"
      size="sm"
      onClick={() => {
        onViewRow(row.key);
      }}
    >
      Xem
    </Button>
  );
}

interface RowContentProps {
  readonly row: RuleReportRow;
  readonly onSelectRow: (rowKey: string) => void;
}

/**
 * The sentence, as a control.
 *
 * Selecting a row has to be reachable by keyboard, and a `<tr onClick>` is not —
 * so the sentence itself is the button. Its accessible name is the message,
 * which is the best name the row has. The message is printed exactly as it
 * arrived: never shortened, never re-punctuated, never re-formatted.
 */
function RowMessage({ row, onSelectRow }: RowContentProps) {
  return (
    <button
      type="button"
      onClick={() => {
        onSelectRow(row.key);
      }}
      className={cn('rounded text-left text-sm text-text-primary', FOCUS_RING)}
    >
      {row.message}
    </button>
  );
}

/** The object code, in a tag `expectVietnamese` reads as code rather than as prose. */
function EntityCode({ entityId }: { readonly entityId: string }) {
  return <code className="font-mono text-xs text-text-secondary">{entityId}</code>;
}

/** The floor a finding sits on, or a dash where the rule looked at the whole building. */
function LevelText({ levelLabel }: { readonly levelLabel: string | null }) {
  return <span className="text-sm text-text-secondary">{levelLabel ?? '—'}</span>;
}

export interface RuleReportRowsProps {
  readonly rows: readonly RuleReportRow[];
  readonly selectedRowKey: string | null;
  readonly isCompact: boolean;
  readonly onSelectRow: (rowKey: string) => void;
  readonly onViewRow: (rowKey: string) => void;
}

/** The rows of one group — a 40px table normally, a stack of cards when compact. */
export function RuleReportRows({
  rows,
  selectedRowKey,
  isCompact,
  onSelectRow,
  onViewRow,
}: RuleReportRowsProps) {
  const reducedMotion = useReducedMotion();

  const pulseOf = (isSelected: boolean) =>
    isSelected
      ? {
          animationDuration: cssDurationMs('slow', { reducedMotion }),
          animationIterationCount: SELECTION_PULSE_BEATS,
        }
      : undefined;

  if (isCompact) {
    return (
      <ul className="flex flex-col gap-2">
        {rows.map((row) => {
          const isSelected = row.key === selectedRowKey;

          return (
            <li
              key={row.key}
              style={pulseOf(isSelected)}
              className={cn(
                'flex flex-col gap-2 rounded border border-border-default p-2',
                isSelected && 'animate-pulse ring-2 ring-inset ring-accent',
              )}
            >
              <div className="flex items-center justify-between gap-2">
                <Badge variant={SEVERITY_BADGE[row.severity]}>{SEVERITY_LABELS[row.severity]}</Badge>
                <EntityCode entityId={row.entityId} />
              </div>
              <RowMessage row={row} onSelectRow={onSelectRow} />
              <div className="flex items-center justify-between gap-2">
                <LevelText levelLabel={row.levelLabel} />
                <RowActions row={row} onViewRow={onViewRow} />
              </div>
            </li>
          );
        })}
      </ul>
    );
  }

  return (
    <Table.Root>
      <Table.Header>
        <tr>
          <Table.Head>mức độ</Table.Head>
          <Table.Head>mô tả</Table.Head>
          <Table.Head>tầng</Table.Head>
          <Table.Head>mã đối tượng</Table.Head>
          <Table.Head>
            <span className="sr-only">hành động</span>
          </Table.Head>
        </tr>
      </Table.Header>
      <Table.Body>
        {rows.map((row) => {
          const isSelected = row.key === selectedRowKey;

          return (
            <Table.Row
              key={row.key}
              selected={isSelected}
              style={pulseOf(isSelected)}
              className={cn(isSelected && 'animate-pulse ring-2 ring-inset ring-accent')}
            >
              <Table.Cell>
                <Badge variant={SEVERITY_BADGE[row.severity]}>{SEVERITY_LABELS[row.severity]}</Badge>
              </Table.Cell>
              <Table.Cell>
                <RowMessage row={row} onSelectRow={onSelectRow} />
              </Table.Cell>
              <Table.Cell>
                <LevelText levelLabel={row.levelLabel} />
              </Table.Cell>
              <Table.Cell>
                <EntityCode entityId={row.entityId} />
              </Table.Cell>
              <Table.Cell>
                <RowActions row={row} onViewRow={onViewRow} />
              </Table.Cell>
            </Table.Row>
          );
        })}
      </Table.Body>
    </Table.Root>
  );
}

export interface RuleReportGroupListProps {
  readonly groups: readonly RuleReportGroup[];
  readonly expandedRuleCodes: readonly string[];
  readonly selectedRowKey: string | null;
  readonly isCompact: boolean;
  readonly onToggleGroup: (ruleCode: string) => void;
  readonly onSelectRow: (rowKey: string) => void;
  readonly onViewRow: (rowKey: string) => void;
}

/** Every failing rule, one collapsible group each. */
export function RuleReportGroupList({
  groups,
  expandedRuleCodes,
  selectedRowKey,
  isCompact,
  onToggleGroup,
  onSelectRow,
  onViewRow,
}: RuleReportGroupListProps) {
  return (
    <div className="flex flex-col gap-2">
      {groups.map((group) => {
        const isOpen = expandedRuleCodes.includes(group.ruleCode);
        const resolvedNote =
          group.resolvedCount > 0 ? ` · ${count(group.resolvedCount)} đã xử lý` : '';

        return (
          <RuleReportSection
            key={group.ruleCode}
            title={`${group.ruleName} · ${GROUP_LABELS[group.group]}`}
            summary={`${SEVERITY_LABELS[group.severity]} · ${count(group.openCount)} mục chưa xử lý${resolvedNote}`}
            isOpen={isOpen}
            onToggle={() => {
              onToggleGroup(group.ruleCode);
            }}
          >
            <RuleReportRows
              rows={group.rows}
              selectedRowKey={selectedRowKey}
              isCompact={isCompact}
              onSelectRow={onSelectRow}
              onViewRow={onViewRow}
            />
          </RuleReportSection>
        );
      })}
    </div>
  );
}

export interface RuleReportPassedListProps {
  readonly passedRules: readonly PassedRule[];
}

/** The "Đạt" segment: rules that ran and found nothing, by name. */
export function RuleReportPassedList({ passedRules }: RuleReportPassedListProps) {
  return (
    <ul className="flex flex-col divide-y divide-border-default rounded border border-border-default bg-bg-surface">
      {passedRules.map((rule) => (
        <li key={rule.ruleCode} className="flex items-center justify-between gap-3 px-3 py-2">
          <span className="text-sm text-text-primary">{rule.ruleName}</span>
          <span className="text-xs text-text-secondary">{GROUP_LABELS[rule.group]}</span>
        </li>
      ))}
    </ul>
  );
}

export interface RuleReportResolvedGroupProps {
  readonly rows: readonly RuleReportRow[];
  readonly isOpen: boolean;
  readonly isCompact: boolean;
  readonly selectedRowKey: string | null;
  readonly onToggle: () => void;
  readonly onSelectRow: (rowKey: string) => void;
  readonly onViewRow: (rowKey: string) => void;
}

/** Everything already dealt with, kept where its owner can still see it. */
export function RuleReportResolvedGroup({
  rows,
  isOpen,
  isCompact,
  selectedRowKey,
  onToggle,
  onSelectRow,
  onViewRow,
}: RuleReportResolvedGroupProps) {
  return (
    <RuleReportSection
      title="Đã xử lý"
      summary={`${count(rows.length)} mục`}
      isOpen={isOpen}
      onToggle={onToggle}
    >
      <RuleReportRows
        rows={rows}
        selectedRowKey={selectedRowKey}
        isCompact={isCompact}
        onSelectRow={onSelectRow}
        onViewRow={onViewRow}
      />
    </RuleReportSection>
  );
}
