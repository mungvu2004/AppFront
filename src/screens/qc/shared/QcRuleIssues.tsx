/**
 * Lỗi quy chuẩn ngay trong lớp đang duyệt (P03). View thuần: dữ liệu từ `useLayerRuleIssues`.
 *
 * - Đang chỉ một lỗi: dải nói lỗi gì và cách sửa, nút "Xong" thôi chỉ.
 * - Lỗi vừa chỉ đã hết: dải xanh "Đã xử lý".
 * - Danh sách gấp "Lỗi quy chuẩn ở lớp này (n)": bấm một dòng là chỉ lỗi đó trên bản vẽ.
 */

import { ChevronDown, ChevronRight, MapPin } from 'lucide-react';
import { useState } from 'react';

import { InlineAlert } from '@/components/feedback/InlineAlert';
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

export function QcRuleIssues({ issues, focused, focusResolved, onFocus, onClearFocus, titleOf }: QcRuleIssuesProps) {
  const [open, setOpen] = useState(false);

  return (
    <div className="flex flex-col gap-2" data-testid="qc-rule-issues">
      {focused === null ? null : (
        <InlineAlert
          action={{ label: 'Xong', onClick: onClearFocus, variant: 'secondary' }}
          className="px-3 py-2 [&_p]:leading-snug"
          data-testid="qc-rule-issue-focus"
          level={focused.severity === 'critical' ? 'violation' : 'attention'}
          message={`${focused.message} Cách sửa: ${focused.suggestion}`}
          title={`Đang sửa: ${focused.ruleName}`}
        />
      )}
      {focused === null && focusResolved ? (
        <InlineAlert
          className="px-3 py-2"
          data-testid="qc-rule-issue-resolved"
          level="verified"
          message="Lỗi quy chuẩn bạn mở đã hết sau lần sửa vừa rồi."
          onDismiss={onClearFocus}
          title="Đã xử lý"
        />
      ) : null}
      {issues.length === 0 ? null : (
        <div className="rounded-md border border-border-default bg-bg-surface">
          <button
            aria-expanded={open}
            className="flex w-full items-center gap-1.5 px-3 py-2 text-left text-sm font-medium text-text-primary"
            onClick={() => setOpen((value) => !value)}
            type="button"
          >
            {open ? <ChevronDown aria-hidden className="size-4" /> : <ChevronRight aria-hidden className="size-4" />}
            {titleOf === undefined ? `Lỗi quy chuẩn ở lớp này (${issues.length})` : titleOf(issues.length)}
          </button>
          {open ? (
            <ul className="max-h-64 overflow-y-auto border-t border-border-default py-1">
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
          ) : null}
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
