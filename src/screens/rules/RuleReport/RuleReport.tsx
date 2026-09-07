/**
 * The spatial-rule report: what the rule run found, and what is left to do.
 *
 * The rendering half of invariant D's split. Every value below arrived in
 * {@link RuleReportViewProps} — this file runs no rule, counts nothing, formats
 * no number and knows no route. `useRuleReport` did all of it, which is why
 * `local/no-data-layer-in-view` has nothing to catch and why every one of the
 * seven states can be rendered from a literal object.
 *
 * ## The three things this screen refuses to do
 *
 * **It does not shout.** A rule report is read by somebody who has just been
 * told their drawing is wrong, and the temptation is to dramatise that: a red
 * banner across the head, a red block per group, an alarm glyph in the summary.
 * None of it is here. Red appears in one place only — the severity badge on a
 * row, a dot and two words, roughly 88×20 px — and the four summary figures
 * carry no colour at all. The largest violation-coloured region on the screen is
 * one badge, which is the point.
 *
 * **It does not offer what does not exist.** `capabilities.canAutoFix` and
 * `canDismiss` are `false` because the repository has neither an auto-fix nor a
 * dismissed state — `Violation` carries a sentence for a person to read and
 * nothing a machine can apply. So there is no "sửa tự động" button and no "bỏ
 * qua" button: not disabled, not a placeholder, not a comment promising one.
 * They are absent exactly as the forbidden state makes editing absent, and the
 * layout leaves their place free so switching a capability on later adds a
 * button and moves nothing.
 *
 * **It does not celebrate.** The clean state is one sentence, the number of
 * rules that ran, a muted badge and a link onwards. No emoji, no full-width
 * green, no animation. And the badge says the *run* found nothing — invariant A5
 * reserves the verified green for a reviewer's own mark, so a machine result
 * never wears it.
 *
 * ## The seven states (A11 / R-63)
 *
 * `empty` · `loading` · `partial` · `error` · `done` (success) · `forbidden`,
 * all read off `props.status`, plus `isCompact` for the collapsed shell. The
 * partial state is the interesting one: a rule group that could not run is a
 * *missing input*, not a failure, so it reads as one attention line per group
 * with a link to the screen that supplies what is missing — never as an error.
 *
 * ## Two things a reader may expect and not find
 *
 * - **No progress bar.** Nothing in the rule engine reports progress part-way
 *   through a run; `evaluated` exists only once the run is over. `progress` is
 *   therefore `null` in this release and the loading state is skeleton rows. A
 *   bar counting invented rules would be a lie drawn at 60 fps.
 * - **The breadcrumb does not link.** The props carry no project id and no
 *   navigation callback beyond `onViewRow`, and invariant R-65 forbids writing a
 *   path into a screen. A crumb wired to nothing would be a dead control, so the
 *   trail is rendered as text that says where you are.
 */

import { AlertCircle, ClipboardCheck } from 'lucide-react';
import { useState } from 'react';

import { EmptyState } from '@/components/feedback/EmptyState';
import { InlineAlert } from '@/components/feedback/InlineAlert';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Table } from '@/components/ui/Table';
import { formatNumber } from '@/lib/format/number';
import { cn } from '@/lib/utils';

import {
  ROW_COLUMNS,
  RuleReportGroupList,
  RuleReportPassedList,
  RuleReportResolvedGroup,
} from './RuleReportGroups';
import { FOCUS_RING } from './RuleReportLabels';
import { RuleReportFilterBar, RuleReportSummaryStrip } from './RuleReportSummary';
import type { RuleReportViewProps } from './types';

/** How wide the preview column is when there is a preview to put in it. */
const PREVIEW_WIDTH = 'w-[344px]';

/** Where you are. Text, because the view was given nothing to navigate with. */
function RuleReportTrail() {
  return (
    <nav aria-label="đường dẫn trang" className="text-sm text-text-secondary">
      <ol className="flex items-center gap-2">
        <li>Dự án</li>
        <li aria-hidden="true">›</li>
        <li aria-current="page" className="text-text-primary">
          Kiểm tra luật không gian
        </li>
      </ol>
    </nav>
  );
}

interface SkippedNoticeProps {
  readonly skipped: RuleReportViewProps['skipped'];
}

/**
 * The partial state, as one line per rule group that could not run.
 *
 * `attention`, never `violation`: nothing is wrong with the drawing here, the
 * report simply has less to say than usual, and the way out is a link to the
 * screen that supplies the missing input. The path is a value from the hook, so
 * no route string is written down.
 */
function SkippedNotice({ skipped }: SkippedNoticeProps) {
  return (
    <ul className="flex flex-col gap-2">
      {skipped.map((item) => (
        <li key={item.group} className="flex flex-wrap items-center gap-3">
          <div className="min-w-0 flex-1">
            <InlineAlert level="attention" message={item.reason} />
          </div>
          <a
            href={item.remedyPath}
            className={cn('rounded text-sm text-accent underline', FOCUS_RING)}
          >
            {item.remedyLabel}
          </a>
        </li>
      ))}
    </ul>
  );
}

interface DonePanelProps {
  readonly evaluated: number;
  readonly onConfirmResolved: () => void;
}

/**
 * The clean run.
 *
 * The rule count is printed from `summary.evaluated`, never written down: the
 * registry enables 23 of its 25 rules today and both figures are the registry's
 * business, not this file's. The badge is neutral and speaks about the run.
 */
function DonePanel({ evaluated, onConfirmResolved }: DonePanelProps) {
  return (
    <section className="flex flex-col items-start gap-3 rounded border border-border-default bg-bg-surface p-4">
      <p className="text-sm text-text-primary">Không phát hiện vi phạm nào.</p>
      <p className="text-sm text-text-secondary">
        {formatNumber(evaluated, { fractionDigits: 0 })} luật đã chạy trên bản vẽ này và không luật
        nào bắt được lỗi.
      </p>
      <Badge variant="neutral" noDot>
        lượt chạy này không có vi phạm
      </Badge>
      <Button variant="secondary" onClick={onConfirmResolved}>
        Sang bước xuất bản
      </Button>
    </section>
  );
}

interface RuleReportBodyProps {
  readonly props: RuleReportViewProps;
  readonly isResolvedOpen: boolean;
  readonly onToggleResolved: () => void;
}

/** Whatever belongs between the filters and the footer, for the current state. */
function RuleReportBody({ props, isResolvedOpen, onToggleResolved }: RuleReportBodyProps) {
  const { status, filters, groups, passedRules, resolvedRows, summary } = props;

  if (status === 'empty') {
    return (
      <EmptyState
        icon={<ClipboardCheck aria-hidden="true" />}
        title="Chưa chạy kiểm tra luật"
        description="Bản vẽ này chưa được đối chiếu với bộ luật không gian. Chạy một lượt để biết những gì cần sửa trước khi xuất bản."
        action={{ label: 'Chạy kiểm tra', onClick: props.onRerun, variant: 'primary' }}
      />
    );
  }

  if (status === 'error') {
    return (
      <EmptyState
        icon={<AlertCircle aria-hidden="true" />}
        title="Không chạy được lượt kiểm tra"
        description={
          props.errorMessage ??
          'Lượt kiểm tra dừng giữa chừng và chưa có kết quả nào để hiển thị. Thử chạy lại sau ít phút.'
        }
        action={{ label: 'Thử lại', onClick: props.onRerun, variant: 'secondary' }}
      />
    );
  }

  if (status === 'loading') {
    return (
      <Table.Root>
        <Table.Body>
          <Table.Skeleton columns={ROW_COLUMNS} />
        </Table.Body>
      </Table.Root>
    );
  }

  if (status === 'done') {
    return <DonePanel evaluated={summary.evaluated} onConfirmResolved={props.onConfirmResolved} />;
  }

  if (filters.level === 'passed') {
    return passedRules.length > 0 ? (
      <RuleReportPassedList passedRules={passedRules} />
    ) : (
      <p className="text-sm text-text-secondary">Chưa có luật nào chạy xong mà không ra lỗi.</p>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      {groups.length > 0 ? (
        <RuleReportGroupList
          groups={groups}
          expandedRuleCodes={props.expandedRuleCodes}
          selectedRowKey={props.selectedRowKey}
          isCompact={props.isCompact}
          onToggleGroup={props.onToggleGroup}
          onSelectRow={props.onSelectRow}
          onViewRow={props.onViewRow}
        />
      ) : (
        <p className="text-sm text-text-secondary">
          {props.isFiltered
            ? 'Không có mục nào khớp bộ lọc đang đặt. Nới bộ lọc để xem thêm.'
            : 'Không còn mục nào đang mở trong danh sách này.'}
        </p>
      )}

      {resolvedRows.length > 0 ? (
        <RuleReportResolvedGroup
          rows={resolvedRows}
          isOpen={isResolvedOpen}
          isCompact={props.isCompact}
          selectedRowKey={props.selectedRowKey}
          onToggle={onToggleResolved}
          onSelectRow={props.onSelectRow}
          onViewRow={props.onViewRow}
        />
      ) : null}
    </div>
  );
}

/**
 * The rule report, as a function of its props.
 *
 * Rendered directly by tests and stories, one call per state, which is what
 * makes invariant A11 checkable without a store and without a network.
 */
export function RuleReport(props: RuleReportViewProps) {
  const { status, summary, capabilities, lastRunLabel, skipped } = props;

  // Local disclosure only. Which rule groups are open belongs to the hook, in
  // `expandedRuleCodes`; the resolved group is not a rule and has no code, so
  // its one boolean lives here. Nothing about loading or failure is kept in the
  // view — invariant R-64 is about those, and both arrive in `status`.
  const [isResolvedOpen, setResolvedOpen] = useState(false);

  const isRunning = status === 'loading';
  const hasResults = status !== 'empty' && status !== 'error';
  const canFilter = hasResults && status !== 'loading' && status !== 'done';

  // The footer offers the one edit this screen has. A reader without edit rights
  // — the forbidden state — gets the report and no way to act on it, and the
  // button is removed rather than disabled, the same way the two missing
  // capabilities are removed.
  const canConfirm = capabilities.canEdit && status !== 'forbidden' && status !== 'empty';

  return (
    <div className="flex h-full flex-col overflow-y-auto bg-bg-app">
      <div className="mx-auto flex w-full max-w-[1080px] flex-col gap-6 p-6">
        <RuleReportTrail />

        <header className="flex flex-wrap items-end justify-between gap-4">
          <h2 className="text-base font-semibold text-text-primary">Kiểm tra luật không gian</h2>

          <div className="flex items-center gap-3">
            {lastRunLabel === null ? null : (
              <p className="text-sm text-text-secondary">{lastRunLabel}</p>
            )}
            <Button variant="secondary" loading={isRunning} onClick={props.onRerun}>
              Chạy kiểm tra lại
            </Button>
          </div>
        </header>

        {hasResults ? <RuleReportSummaryStrip summary={summary} /> : null}

        {skipped.length > 0 ? <SkippedNotice skipped={skipped} /> : null}

        {canFilter ? (
          <RuleReportFilterBar
            filters={props.filters}
            groups={props.groups}
            resolvedRows={props.resolvedRows}
            onFilterChange={props.onFilterChange}
          />
        ) : null}

        {/*
          One column normally, two when there is a preview to show. The list is
          `flex-1` either way, so turning `canPreview3d` on adds the aside and
          re-lays out nothing. `previewRef` is called only where the canvas is
          actually mounted — an empty 344px column is worse than no column.
        */}
        <div className="flex items-start gap-4">
          <div className="min-w-0 flex-1">
            <RuleReportBody
              props={props}
              isResolvedOpen={isResolvedOpen}
              onToggleResolved={() => {
                setResolvedOpen((open) => !open);
              }}
            />
          </div>

          {capabilities.canPreview3d && !props.isCompact ? (
            <aside
              aria-label="Xem trước mô hình"
              className={cn('shrink-0 rounded border border-border-default', PREVIEW_WIDTH)}
            >
              <canvas ref={props.previewRef} className="h-[240px] w-full rounded bg-canvas-3d" />
            </aside>
          ) : null}
        </div>

        {canConfirm ? (
          <footer className="flex items-center justify-end gap-3 border-t border-border-default pt-4">
            <Button
              variant="primary"
              disabled={summary.violations > 0}
              onClick={props.onConfirmResolved}
            >
              Xác nhận đã xử lý
            </Button>
          </footer>
        ) : null}
      </div>
    </div>
  );
}
