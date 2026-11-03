/**
 * Lỗi quy chuẩn ngay trong lớp đang duyệt (P03). View thuần: dữ liệu từ `useLayerRuleIssues`.
 *
 * - Đang chỉ một lỗi: dải nói lỗi gì và cách sửa, nút "Xong" thôi chỉ.
 * - Lỗi vừa chỉ đã hết: dải xanh "Đã xử lý".
 * - Danh sách gấp "Lỗi quy chuẩn ở lớp này (n)": bấm một dòng là chỉ lỗi đó trên bản vẽ.
 * - Bản gọn (`QcRuleIssuesBadge` + `QcRuleIssueFocus`): nút "⚠ n" mở danh sách trong popover, dải đang chỉ đứng riêng.
 */

import { AlertTriangle, ChevronDown, ChevronRight, MapPin } from 'lucide-react';
import { useRef, useState } from 'react';

import { InlineAlert } from '@/components/feedback/InlineAlert';
import { Popover } from '@/components/overlay/Popover';
import { cn } from '@/lib/utils';

import type { LayerRuleIssue } from './useLayerRuleIssues';

export interface QcRuleIssuesProps {
  readonly issues: readonly LayerRuleIssue[];
  readonly focused: LayerRuleIssue | null;
  readonly focusResolved: boolean;
  readonly onFocus: (key: string) => void;
  readonly onClearFocus: () => void;
  /** Nhãn dải gấp; `n` là số lỗi. Vắng = "Lỗi quy chuẩn ở lớp này (n)". */
  readonly titleOf?: (count: number) => string;
}

const SEVERITY_DOT: Readonly<Record<LayerRuleIssue['severity'], string>> = {
  critical: 'bg-state-violation',
  warning: 'bg-state-attention',
  suggestion: 'bg-text-muted',
};

const titleText = (count: number, titleOf: QcRuleIssuesProps['titleOf']): string =>
  titleOf === undefined ? `Lỗi quy chuẩn ở lớp này (${count})` : titleOf(count);

/** Dải "Đang sửa: …" khi đang chỉ một lỗi, hoặc dải xanh "Đã xử lý" khi lỗi vừa chỉ đã hết. */
export function QcRuleIssueFocus({ focused, focusResolved, onClearFocus }: Pick<QcRuleIssuesProps, 'focused' | 'focusResolved' | 'onClearFocus'>) {
  if (focused !== null) {
    return (
      <InlineAlert
        action={{ label: 'Xong', onClick: onClearFocus, variant: 'secondary' }}
        className="px-3 py-2 [&_p]:leading-snug"
        data-testid="qc-rule-issue-focus"
        level={focused.severity === 'critical' ? 'violation' : 'attention'}
        message={`${focused.message} Cách sửa: ${focused.suggestion}`}
        title={`Đang sửa: ${focused.ruleName}`}
      />
    );
  }
  if (!focusResolved) return null;
  return (
    <InlineAlert
      className="px-3 py-2"
      data-testid="qc-rule-issue-resolved"
      level="verified"
      message="Lỗi quy chuẩn bạn mở đã hết sau lần sửa vừa rồi."
      onDismiss={onClearFocus}
      title="Đã xử lý"
    />
  );
}

function IssueList({ issues, focused, onFocus, className }: Pick<QcRuleIssuesProps, 'issues' | 'focused' | 'onFocus'> & { readonly className: string }) {
  return (
    <ul className={className}>
      {issues.map((issue) => (
        <li key={issue.key}>
          <button
            aria-current={focused?.key === issue.key ? 'true' : undefined}
            className={cn(
              'flex w-full items-start gap-2 px-3 py-1.5 text-left text-sm text-text-secondary hover:bg-bg-hover',
              focused?.key === issue.key && 'bg-bg-sunken text-text-primary',
            )}
            onClick={() => onFocus(issue.key)}
            title={issue.message}
            type="button"
          >
            <span aria-hidden className={cn('mt-1.5 size-2 shrink-0 rounded-full', SEVERITY_DOT[issue.severity])} />
            <span className="min-w-0 flex-1">
              <span className="block text-text-primary">{issue.ruleName}</span>
              <span className="line-clamp-2 text-xs">{issue.message}</span>
            </span>
            {issue.at === null ? null : <MapPin aria-label="Có chỗ trên bản vẽ" className="mt-0.5 size-4 shrink-0" />}
          </button>
        </li>
      ))}
    </ul>
  );
}

/**
 * Bản gọn cho thanh công cụ của cột việc: nút "⚠ n" mở danh sách lỗi trong popover (Esc đóng).
 * Dải lỗi đang chỉ không nằm ở đây — màn đặt `QcRuleIssueFocus` ngay trên danh sách.
 */
export function QcRuleIssuesBadge({ issues, focused, onFocus, titleOf }: Pick<QcRuleIssuesProps, 'issues' | 'focused' | 'onFocus' | 'titleOf'>) {
  const [open, setOpen] = useState(false);
  const anchorRef = useRef<HTMLButtonElement>(null);
  if (issues.length === 0) return null;
  const title = titleText(issues.length, titleOf);
  return (
    <>
      <button
        ref={anchorRef}
        aria-expanded={open}
        aria-haspopup="dialog"
        aria-label={title}
        className="flex h-8 shrink-0 items-center gap-1 rounded-md px-2 text-body-sm font-medium tabular-nums text-state-attention-text transition-colors duration-120 hover:bg-bg-hover focus-visible:outline-solid focus-visible:outline-2 focus-visible:outline-accent"
        data-testid="qc-rule-issues"
        onClick={() => setOpen((value) => !value)}
        title={title}
        type="button"
      >
        <AlertTriangle aria-hidden="true" className="h-4 w-4" />
        {issues.length}
      </button>
      <Popover anchorRef={anchorRef} aria-label={title} isOpen={open} onClose={() => setOpen(false)} width={320}>
        <IssueList
          className="max-h-80 overflow-y-auto py-1"
          focused={focused}
          issues={issues}
          onFocus={(key) => {
            onFocus(key);
            setOpen(false);
          }}
        />
      </Popover>
    </>
  );
}

export function QcRuleIssues({ issues, focused, focusResolved, onFocus, onClearFocus, titleOf }: QcRuleIssuesProps) {
  const [open, setOpen] = useState(false);

  return (
    <div className="flex flex-col gap-2" data-testid="qc-rule-issues">
      <QcRuleIssueFocus focused={focused} focusResolved={focusResolved} onClearFocus={onClearFocus} />
      {issues.length === 0 ? null : (
        <div className="rounded-md border border-border-default bg-bg-surface">
          <button
            aria-expanded={open}
            className="flex w-full items-center gap-1.5 px-3 py-2 text-left text-sm font-medium text-text-primary"
            onClick={() => setOpen((value) => !value)}
            type="button"
          >
            {open ? <ChevronDown aria-hidden className="size-4" /> : <ChevronRight aria-hidden className="size-4" />}
            {titleText(issues.length, titleOf)}
          </button>
          {open ? <IssueList className="max-h-64 overflow-y-auto border-t border-border-default py-1" focused={focused} issues={issues} onFocus={onFocus} /> : null}
        </div>
      )}
    </div>
  );
}

/**
 * Dấu đỏ ở chỗ lỗi, vẽ trong `<svg>` của bản vẽ. `x`/`y`/`radius` ở cùng hệ toạ độ với
 * các hình khác của lớp (màn tự đổi mm → toạ độ bản vẽ). Vòng ngoài to để thấy được cả
 * khe hở vài centimet ở mức phóng nhỏ.
 */
export function QcRuleIssueMarker({ x, y, radius }: { readonly x: number; readonly y: number; readonly radius: number }) {
  return (
    <g data-testid="qc-rule-issue-marker" pointerEvents="none">
      <circle className="fill-state-violation stroke-state-violation" fillOpacity={0.15} cx={x} cy={y} r={radius} strokeWidth={radius / 8} />
      <circle className="fill-state-violation" cx={x} cy={y} r={radius / 5} />
    </g>
  );
}
