/**
 * Bảng nhóm bên trái của màn "Chuẩn hoá độ dày tường" (2.2 của brief T7): một
 * dòng cho mỗi số đo khác nhau, kèm nhóm chuẩn hoá đề xuất và ô đồng ý.
 *
 * VIEW THUẦN — nhận đúng `ThicknessGroupTableProps` (T4 khai), không chạm
 * store/hook/mạng. Ô đồng ý luôn hiển thị đúng `row.accepted` do hook cấp —
 * CẤM TUYỆT ĐỐI không tự đặt `checked` khác giá trị đó (không tích sẵn toàn
 * bộ; mọi hàng khởi tạo bỏ trống là việc của hook, view chỉ vẽ lại đúng nó).
 *
 * ## Layout animation khi hàng đổi chỗ
 *
 * `Table.Row` nhận `layoutId` thì tự bọc bằng `motion.tr` với
 * `transition={{ duration: durationSeconds('standard') }}` (260 ms) — hằng số
 * đã nằm sẵn trong `Table.tsx`, không viết lại ở đây (R-71). Khoá layout dùng
 * `measuredMm` vì đó là khoá duy nhất của một dòng nhóm.
 *
 * ## Vì sao `tabIndex={undefined}` trên mọi `Table.Row`
 *
 * Bẫy R-72 (`docs/notes/thickness/ui.md` mục 1): `Table.Row` luôn mang
 * `tabindex="-1"` mặc định cộng `outline-none`, và chỉ vẽ vòng tiêu điểm khi
 * prop `focused` được đặt tay — nếu không, `expectAccessible` báo lỗi
 * `focus-ring` cho MỌI hàng vì `[tabindex]` khớp bộ chọn "phần tử nhận được
 * tiêu điểm". Bảng này không có hàng nào cần tự nhận tiêu điểm (ô `Checkbox`
 * bên trong mới là điều khiển thật, đã có vòng tiêu điểm riêng của nó) — xoá
 * hẳn thuộc tính `tabindex` khỏi `<tr>` là đúng ngữ nghĩa (hàng không phải một
 * điều khiển), không phải một cách né luật.
 */

import { Checkbox } from '@/components/ui/Checkbox';
import { Table } from '@/components/ui/Table';
import { cn } from '@/lib/utils';

import { THICKNESS_GROUP_LABELS, type ThicknessGroup, type ThicknessGroupTableProps } from './thicknessTypes';

const HEADER_MEASURED = 'Độ dày đo được';
const HEADER_WALL_COUNT = 'Số tường';
const HEADER_SUGGESTED_GROUP = 'Nhóm chuẩn đề xuất';
const HEADER_ACCEPTED = 'Đồng ý';
const EMPTY_MESSAGE = 'Chưa có nhóm nào để chuẩn hoá.';

function acceptCheckboxLabel(measuredMm: number, wallCount: number, suggestedGroup: ThicknessGroup): string {
  return `Đồng ý chuẩn hoá ${wallCount} tường ${measuredMm} mm về ${THICKNESS_GROUP_LABELS[suggestedGroup]}`;
}

export function ThicknessGroupTable({ rows, hoveredGroup, onHoverGroup, onToggleAccepted }: ThicknessGroupTableProps) {
  return (
    <Table.Root>
      <Table.Header>
        <Table.Row tabIndex={undefined}>
          <Table.Head>{HEADER_MEASURED}</Table.Head>
          <Table.Head>{HEADER_WALL_COUNT}</Table.Head>
          <Table.Head>{HEADER_SUGGESTED_GROUP}</Table.Head>
          <Table.Head>{HEADER_ACCEPTED}</Table.Head>
        </Table.Row>
      </Table.Header>
      <Table.Body>
        {rows.length === 0 ? (
          <Table.Empty colSpan={4} message={EMPTY_MESSAGE} />
        ) : (
          rows.map((row) => (
            <Table.Row
              className={cn(row.suggestedGroup === hoveredGroup && 'bg-bg-hover')}
              key={row.measuredMm}
              layoutId={`thickness-group-${row.measuredMm}`}
              onMouseEnter={() => onHoverGroup(row.suggestedGroup)}
              onMouseLeave={() => onHoverGroup(null)}
              tabIndex={undefined}
            >
              <Table.Cell className="font-mono tabular-nums">{row.measuredMm} mm</Table.Cell>
              <Table.Cell className="font-mono tabular-nums">{row.wallCount}</Table.Cell>
              <Table.Cell>{THICKNESS_GROUP_LABELS[row.suggestedGroup]}</Table.Cell>
              <Table.Cell>
                <Checkbox
                  aria-label={acceptCheckboxLabel(row.measuredMm, row.wallCount, row.suggestedGroup)}
                  checked={row.accepted}
                  onChange={(accepted) => onToggleAccepted(row.measuredMm, accepted)}
                />
              </Table.Cell>
            </Table.Row>
          ))
        )}
      </Table.Body>
    </Table.Root>
  );
}
