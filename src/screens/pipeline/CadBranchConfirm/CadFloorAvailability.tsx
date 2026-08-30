/**
 * Bảng nhỏ liệt kê tầng nào có CAD, tầng nào chỉ có ảnh (kết quả T-03). File
 * anh em tách khỏi `CadBranchConfirmDialog.tsx` (mục D).
 *
 * `Badge` không dùng biến thể `verified` ở đây — A5: xanh "đã xác minh" chỉ
 * đánh dấu việc người duyệt, và đây là kết quả đọc tệp, không phải một bước
 * duyệt. Tầng có CAD dùng `neutral`, tầng chỉ có ảnh dùng `attention` (sẽ chạy
 * qua nhánh nhận dạng AI).
 */
import { Badge } from '@/components/ui/Badge';
import { Table } from '@/components/ui/Table';

import { CAD_BRANCH_CONFIRM_TEXT } from './cadBranchConfirmText';
import type { CadFloorAvailability as CadFloorAvailabilityEntry } from './types';

const TEXT = CAD_BRANCH_CONFIRM_TEXT.phase1;

export interface CadFloorAvailabilityTableProps {
  readonly floors: readonly CadFloorAvailabilityEntry[];
}

export function CadFloorAvailabilityTable({ floors }: CadFloorAvailabilityTableProps) {
  return (
    <div>
      <p className="text-[13px] text-text-secondary mb-2">{TEXT.floorTableCaption}</p>
      <Table.Root>
        <Table.Header>
          <tr>
            <Table.Head>{TEXT.floorColumnLabel}</Table.Head>
            <Table.Head>{TEXT.cadStatusColumnLabel}</Table.Head>
          </tr>
        </Table.Header>
        <Table.Body>
          {floors.map((floor) => (
            <tr key={floor.floorId} className="border-b border-border-default/50 last:border-0">
              <Table.Cell>{floor.floorName}</Table.Cell>
              <Table.Cell>
                <Badge variant={floor.hasCadFile ? 'neutral' : 'attention'}>
                  {floor.hasCadFile ? TEXT.cadStatusAvailable : TEXT.cadStatusImageOnly}
                </Badge>
              </Table.Cell>
            </tr>
          ))}
        </Table.Body>
      </Table.Root>
    </div>
  );
}
