/**
 * Khối "Kiểm tra trước khi xuất" — CHỈ để thông tin.
 *
 * Ba dòng từ `preflight`, mỗi dòng một chấm trạng thái (`tone`) và một liên
 * kết đi sửa khi có `fixHref`. Không dòng nào vô hiệu hoá nút "Xuất" — cấm
 * tuyệt đối của đặc tả gốc.
 */

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
    <section
      aria-label="kiểm tra trước khi xuất"
      className="flex flex-col gap-2 rounded-lg border border-border-default bg-bg-surface p-4"
    >
      <h3 className="text-sm font-medium text-text-secondary">kiểm tra trước khi xuất</h3>
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
                onClick={() => {
                  onFollowFix(row.id);
                }}
                className={cn(
                  'shrink-0 whitespace-nowrap font-medium text-accent no-underline hover:underline',
                  FOCUS_RING,
                )}
              >
                sửa
              </a>
            )}
          </li>
        ))}
      </ul>
    </section>
  );
}
