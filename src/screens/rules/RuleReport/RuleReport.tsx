/**
 * The spatial-rule report (S-31): what the rule run found, and what is left to do.
 *
 * The rendering half of invariant D's split. Every value below arrived in
 * {@link RuleReportViewProps} — this file runs no rule and knows no route.
 * `useRuleReport` did all of it, which is why every one of the seven states can
 * be rendered from a literal object.
 *
 * ## Three questions (HOP-DONG-V6 §1)
 *
 * 1. **What is this for** — `PageHead`: eyebrow "Bước 5 · Quy chuẩn", H1 "Kiểm tra
 *    quy chuẩn".
 * 2. **Where it stands** — the status line: one badge carrying the worst finding
 *    with its real count, one sentence with the rest, and when the run happened.
 * 3. **How to go on** — `FlowGate` in the step bar: "Không còn vi phạm nghiêm
 *    trọng" + "Đã xem cảnh báo". Not met: a secondary "Xem vi phạm kế" (opens the
 *    next critical finding) or "Xem cảnh báo". Met: the one primary "Sang Xuất".
 *
 * ## The three things this screen refuses to do
 *
 * **It does not shout.** Red appears as a severity badge on a row and a dot on a
 * group, never as a band or block. The summary figures are clickable filters,
 * tinted only when above zero.
 *
 * **It does not offer what does not exist.** `capabilities.canAutoFix` and
 * `canDismiss` are `false` because the repository has neither an auto-fix nor a
 * dismissed state. So there is no "sửa tự động" and no "bỏ qua" button: not
 * disabled, not a placeholder.
 *
 * **It does not celebrate.** The clean state is one sentence and a neutral badge.
 * Invariant A5 reserves the verified green for a reviewer's own mark, so a
 * machine result never wears it.
 *
 * ## Two things a reader may expect and not find
 *
 * - **No progress bar.** Nothing in the rule engine reports progress part-way
 *   through a run, so `progress` is `null` and the loading state is skeleton rows.
 * - **The breadcrumb does not link** beyond what the container wires.
 */

import { AlertCircle, ArrowRight, ClipboardCheck } from 'lucide-react';
import { useState } from 'react';

import { EmptyState } from '@/components/feedback/EmptyState';
import { InlineAlert } from '@/components/feedback/InlineAlert';
import { Breadcrumb } from '@/components/shell/Breadcrumb';
import { FlowGate } from '@/components/shell/FlowGate';
import { PageHead } from '@/components/shell/PageHead';
import { Section } from '@/components/shell/Section';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { getButtonStyles } from '@/components/ui/buttonVariants';
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
import type { RuleReportFilters, RuleReportGroup, RuleReportLevelFilter, RuleReportViewProps } from './types';

/** How wide the preview column is when there is a preview to put in it. */
const PREVIEW_WIDTH = 'w-[344px]';

/** A count, as a person reads it (A15). */
const count = (value: number): string => formatNumber(value, { fractionDigits: 0 });

interface SkippedNoticeProps {
  readonly skipped: RuleReportViewProps['skipped'];
}

/**
 * The partial state, as one line per rule group that could not run.
 *
 * `attention`, never `violation`: nothing is wrong with the drawing here, the
 * report simply has less to say than usual, and the way out is a link.
 */
function SkippedNotice({ skipped }: SkippedNoticeProps) {
  return (
    <ul className="flex flex-col gap-2">
      {skipped.map((item) => (
        <li key={item.group} className="flex flex-wrap items-center gap-3">
          <div className="min-w-0 flex-1">
            <InlineAlert level="attention" message={item.reason} />
          </div>
          <a href={item.remedyPath} className={cn('rounded-sm text-sm text-accent underline', FOCUS_RING)}>
            {item.remedyLabel}
          </a>
        </li>
      ))}
    </ul>
  );
}

/**
 * The clean run: one sentence and the rule count, printed from `summary.evaluated`.
 * The way on is the gate in the step bar, so there is no second button here.
 */
function DonePanel({ evaluated }: { readonly evaluated: number }) {
  return (
    <div className="flex flex-col gap-1">
      <p className="text-body text-text-primary">Không phát hiện vi phạm nào.</p>
      <p className="text-body-sm text-text-secondary">
        {count(evaluated)} luật đã chạy trên bản vẽ này và không luật nào bắt được lỗi.
      </p>
    </div>
  );
}

interface RuleReportBodyProps {
  readonly props: RuleReportViewProps;
  readonly isResolvedOpen: boolean;
  readonly onToggleResolved: () => void;
}

/** The list part of the results frame, for the current state. */
function RuleReportBody({ props, isResolvedOpen, onToggleResolved }: RuleReportBodyProps) {
  const { status, filters, groups, passedRules, resolvedRows, summary } = props;

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
    return <DonePanel evaluated={summary.evaluated} />;
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

/** Open critical rows in list order — the targets of "Xem vi phạm kế". */
function openCriticalKeys(groups: readonly RuleReportGroup[]): readonly string[] {
  return groups.flatMap((group) =>
    group.rows.filter((row) => !row.resolved && row.severity === 'critical').map((row) => row.key),
  );
}

/** Status line: the worst finding as a badge with its real count, then the rest in one sentence. */
function RuleReportStatus({ props }: { readonly props: RuleReportViewProps }) {
  const { status, summary, lastRunLabel } = props;
  if (status === 'error') return null;

  const badge =
    status === 'empty' ? (
      <Badge variant="neutral">Chưa có mô hình</Badge>
    ) : status === 'loading' ? (
      <Badge variant="neutral">Đang kiểm tra</Badge>
    ) : summary.violations > 0 ? (
      <Badge variant="violation">{`${count(summary.violations)} luật vi phạm nghiêm trọng`}</Badge>
    ) : summary.warnings > 0 ? (
      <Badge variant="attention">{`${count(summary.warnings)} luật cảnh báo`}</Badge>
    ) : (
      <Badge variant="neutral">Không có vi phạm</Badge>
    );

  const rest =
    status === 'empty' || status === 'loading'
      ? null
      : summary.violations > 0
        ? `${count(summary.warnings)} cảnh báo, ${count(summary.suggestions)} gợi ý.`
        : `${count(summary.passed)}/${count(summary.evaluated)} luật đạt.`;

  return (
    <>
      {badge}
      {rest === null ? null : <span className="tabular-nums">{rest}</span>}
      {lastRunLabel === null || status === 'empty' ? null : (
        <span className="text-[13px] text-text-muted">{lastRunLabel}</span>
      )}
    </>
  );
}

/**
 * The rule report, as a function of its props.
 *
 * Rendered directly by tests and stories, one call per state, which is what
 * makes invariant A11 checkable without a store and without a network.
 */
export function RuleReport(props: RuleReportViewProps) {
  const { status, summary, capabilities, skipped, filters } = props;

  // Starts open: "Mục đã xử lý phải còn nhìn thấy" — a group that starts shut hides
  // exactly the rows the ban is about. The reader can still collapse it.
  const [isResolvedOpen, setResolvedOpen] = useState(true);
  // "Đã xem cảnh báo" — the reader opened the warnings filter at least once in this view.
  const [hasSeenWarnings, setSeenWarnings] = useState(false);

  const isRunning = status === 'loading';
  const hasResults = status !== 'empty' && status !== 'error';
  const canFilter = hasResults && !isRunning && status !== 'done';
  // Người xem (không `canEdit`) không chạy lại và không giữ cổng — gỡ, không tắt (9V-C-030).
  const canAct = capabilities.canEdit && status !== 'forbidden';

  const onFilterChange = (next: RuleReportFilters): void => {
    if (next.level === 'warning') setSeenWarnings(true);
    props.onFilterChange(next);
  };

  const noCritical = summary.violations === 0;
  const warningsSeen = summary.warnings === 0 || hasSeenWarnings || filters.level === 'warning';
  const criticalKeys = openCriticalKeys(props.groups);

  const showNextViolation = (): void => {
    const at = props.selectedRowKey === null ? -1 : criticalKeys.indexOf(props.selectedRowKey);
    const next = criticalKeys[(at + 1) % Math.max(criticalKeys.length, 1)];
    if (next !== undefined) {
      props.onSelectRow(next);
      return;
    }
    // Bộ lọc đang giấu mọi hàng nghiêm trọng: mở lại bộ lọc về đúng mức ấy.
    onFilterChange({ level: 'violation', group: 'all', levelId: 'all' });
  };

  // `empty` = chưa có mô hình: cổng dẫn về bước Xử lý thay vì hai điều kiện không ai làm được.
  const processLink =
    props.processPath === undefined ? null : (
      <a href={props.processPath} className={getButtonStyles({ variant: 'secondary', size: 'sm' })}>
        Mở bước Xử lý
      </a>
    );

  const gateButton =
    status === 'empty' ? processLink : !hasResults || isRunning ? null : !noCritical ? (
      <Button size="sm" variant="secondary" onClick={showNextViolation}>
        Xem vi phạm kế
      </Button>
    ) : !warningsSeen ? (
      <Button size="sm" variant="secondary" onClick={() => onFilterChange({ ...filters, level: 'warning' })}>
        Xem cảnh báo
      </Button>
    ) : (
      <Button size="sm" variant="primary" iconAfter={<ArrowRight aria-hidden="true" size={16} />} onClick={props.onConfirmResolved}>
        Sang Xuất
      </Button>
    );

  return (
    <div className="flex h-full flex-col overflow-y-auto bg-bg-app">
      {canAct ? (
        <FlowGate
          conditions={
            status === 'empty'
              ? [{ label: 'Có mô hình để kiểm tra', done: false }]
              : [
                  { label: 'Không còn vi phạm nghiêm trọng', done: hasResults && !isRunning && noCritical },
                  { label: 'Đã xem cảnh báo', done: hasResults && !isRunning && warningsSeen },
                ]
          }
          done={summary.passed}
          total={hasResults && !isRunning ? summary.evaluated : 0}
          progressLabel="Luật đạt"
        >
          {gateButton}
        </FlowGate>
      ) : null}

      <div className="mx-auto flex w-full max-w-[1344px] flex-col gap-6 px-4 pb-6 pt-6 xl:px-8">
        {props.breadcrumb === undefined ? null : <Breadcrumb items={props.breadcrumb} />}
        <PageHead
          className="mb-0"
          eyebrow="Bước 5 · Quy chuẩn"
          title="Kiểm tra quy chuẩn"
          status={<RuleReportStatus props={props} />}
          next={
            <>
              {props.settingsPath === undefined ? null : (
                <a href={props.settingsPath} className={getButtonStyles({ variant: 'ghost', size: 'md' })}>
                  Cài đặt bộ luật
                </a>
              )}
              {/* `empty` = chưa có mô hình: một lượt chạy chỉ rơi vào `error` (B-V12-02).
                  `error` có sẵn "Thử lại" trong thân — hai nút chạy lại là thừa (BUG-465). */}
              {status === 'empty' || status === 'error' || !canAct ? null : (
                <Button variant="secondary" loading={isRunning} onClick={props.onRerun}>
                  Chạy kiểm tra lại
                </Button>
              )}
            </>
          }
        />

        {skipped.length > 0 ? <SkippedNotice skipped={skipped} /> : null}

        {status === 'empty' ? (
          // `empty` chỉ xảy ra khi kho chưa có mô hình, nên không có nút chạy (B-V12-02).
          <EmptyState
            icon={<ClipboardCheck aria-hidden="true" />}
            title="Chưa có mô hình để kiểm tra luật"
            description="Bản vẽ này chưa được xử lý xong, nên chưa có mô hình không gian nào để đối chiếu với bộ luật. Chạy pipeline cho tầng rồi quay lại đây."
          />
        ) : status === 'error' ? (
          <EmptyState
            icon={<AlertCircle aria-hidden="true" />}
            title="Không chạy được lượt kiểm tra"
            description={
              props.errorMessage ??
              'Lượt kiểm tra dừng giữa chừng và chưa có kết quả nào để hiển thị. Thử chạy lại sau ít phút.'
            }
            action={{ label: 'Thử lại', onClick: props.onRerun, variant: 'secondary' }}
          />
        ) : (
          <div className="flex items-start gap-4">
            <Section title="Kết quả kiểm tra" className="min-w-0 flex-1">
              <div className="flex flex-col gap-5">
                <div className="flex flex-col gap-2">
                  <RuleReportSummaryStrip
                    summary={summary}
                    {...(canFilter
                      ? { activeLevel: filters.level, onFilterLevel: (level: RuleReportLevelFilter) => onFilterChange({ ...filters, level }) }
                      : {})}
                  />
                  {/* G5-30: ô số đếm LUẬT, danh sách đếm ĐỐI TƯỢNG — nói ra để hai số không vênh nhau. */}
                  {status !== 'done' ? (
                    <p className="text-[13px] text-text-secondary">
                      Các số trên đếm theo luật, bấm một số để lọc. Danh sách liệt kê từng đối tượng, nên một luật có thể có nhiều mục.
                    </p>
                  ) : null}
                </div>

                {canFilter ? (
                  <RuleReportFilterBar
                    filters={filters}
                    groups={props.groups}
                    resolvedRows={props.resolvedRows}
                    onFilterChange={onFilterChange}
                  />
                ) : null}

                <RuleReportBody
                  props={props}
                  isResolvedOpen={isResolvedOpen}
                  onToggleResolved={() => {
                    setResolvedOpen((open) => !open);
                  }}
                />
              </div>
            </Section>

            {/* `previewRef` is called only where the canvas is actually mounted. */}
            {capabilities.canPreview3d && !props.isCompact ? (
              <aside
                aria-label="Xem trước mô hình"
                className={cn('shrink-0 overflow-hidden rounded-xl bg-bg-surface shadow-panel', PREVIEW_WIDTH)}
              >
                <canvas ref={props.previewRef} className="h-[240px] w-full bg-canvas-3d" />
              </aside>
            ) : null}
          </div>
        )}
      </div>
    </div>
  );
}
