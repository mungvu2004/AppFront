/**
 * Bảng so sánh ba dòng (độ chính xác · công việc QC · thời gian) của hộp thoại
 * chốt nhánh CAD/AI. File anh em tách khỏi `CadBranchConfirmDialog.tsx` (mục D).
 *
 * Dùng `<tr>` thô thay `Table.Row`: `Table.Row` đặt tiêu điểm bằng state
 * (`focused && 'ring-2'`) chứ không phải CSS `focus-visible:`, phá hỏng
 * `expectAccessible` (R-72) — quyết định đã chốt của coordinator. Bảng này
 * không có hàng chọn được nên không mất gì.
 */
import { Table } from '@/components/ui/Table';

import { CAD_BRANCH_CONFIRM_TEXT } from './cadBranchConfirmText';
import type { CadBranchComparisonCell } from './types';

const TEXT = CAD_BRANCH_CONFIRM_TEXT.phase1;

export interface CadBranchCompareTableProps {
  readonly rows: readonly CadBranchComparisonCell[];
}

export function CadBranchCompareTable({ rows }: CadBranchCompareTableProps) {
  return (
    // `shrink-0`: `Table.Root` scrolls (`overflow-auto`), so as a flex item of the dialog body its
    // min-height is 0 and the body squeezed it to a header and half a row (BUG-269). Text cells wrap
    // so both columns fit the 279 px body at 375 px instead of scrolling sideways; row labels stay one line.
    <Table.Root className="shrink-0">
      <Table.Header>
        <tr>
          <Table.Head aria-label="Tiêu chí so sánh" />
          <Table.Head className="whitespace-normal">{TEXT.buttons.primary}</Table.Head>
          <Table.Head className="whitespace-normal">{TEXT.buttons.secondary}</Table.Head>
        </tr>
      </Table.Header>
      <Table.Body>
        {rows.map((row) => (
          <tr key={row.rowId} className="border-b border-border-default-50 last:border-0">
            <Table.Cell className="font-medium text-text-secondary whitespace-nowrap">
              {row.rowLabel}
            </Table.Cell>
            <Table.Cell className="whitespace-normal align-top py-2">{row.cadValueLabel}</Table.Cell>
            <Table.Cell className="whitespace-normal align-top py-2">{row.aiValueLabel}</Table.Cell>
          </tr>
        ))}
      </Table.Body>
    </Table.Root>
  );
}
