/**
 * Khối "Kiểm tra trước khi xuất" — CHỈ để thông tin.
 *
 * Ba dòng từ `preflight`, mỗi dòng một chấm trạng thái (`tone`) và một liên
 * kết đi sửa khi có `fixHref`. Không dòng nào vô hiệu hoá nút "Xuất" — cấm
 * tuyệt đối của đặc tả gốc.
 */

import { Section } from '@/components/shell/Section';
import { cn } from '@/lib/utils';

import { FOCUS_RING } from './ExportPanelFormats';
import type { PreflightRow } from './types';

export interface ExportPanelPreflightProps {
  readonly rows: readonly PreflightRow[];
  readonly onFollowFix: (rowId: PreflightRow['id']) => void;
}

export function ExportPanelPreflight({ rows, onFollowFix }: ExportPanelPreflightProps) {
  if (rows.length === 0) {
    return null;
  }

  return (
    // Chỉ để thông tin, không chặn: còn vi phạm vẫn xuất được, mỗi dòng có lối đi sửa.
    <Section aria-label="Kiểm tra trước khi xuất" title="Kiểm tra trước khi xuất">
      <ul className="flex flex-col gap-2">
        {rows.map((row) => (
          <li key={row.id} className="flex items-start justify-between gap-3 text-sm">
            <span className="flex min-w-0 items-start gap-2">
              <span
                aria-hidden="true"
                className={cn(
                  'mt-1.5 h-2 w-2 shrink-0 rounded-full',
                  row.tone === 'ok' ? 'bg-state-verified' : 'bg-state-attention',
                )}
              />
              <span className="text-text-secondary">{row.label}</span>
            </span>
            {row.fixHref !== null && (
              <a
                href={row.fixHref}
                onClick={(event) => {
                  // Bấm trái thường đi qua router: để thẻ `<a>` tự đi thì cả trang nạp
                  // lại và kho mất sạch (B-V12-06). Phím bổ trợ / chuột giữa = tab khác.
                  if (event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) {
                    return;
                  }

                  event.preventDefault();
                  onFollowFix(row.id);
                }}
                // Vùng chạm 44 px dưới `sm`, 24 px từ `sm` (WCAG 2.5.8) — cùng khuôn Breadcrumb (BUG-442).
                className={cn(
                  'inline-flex min-h-11 min-w-11 shrink-0 items-center justify-center whitespace-nowrap font-medium text-accent no-underline hover:underline fine:min-h-6 fine:min-w-0',
                  FOCUS_RING,
                )}
              >
                Sửa<span className="sr-only">: {row.label}</span>
              </a>
            )}
          </li>
        ))}
      </ul>
    </Section>
  );
}
