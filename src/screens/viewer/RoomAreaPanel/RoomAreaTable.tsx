/**
 * Màn S-33 "diện tích phòng" — chế độ BẢNG TOÀN TRANG (`RoomAreaTable`).
 *
 * VIEW THUẦN: nhận hết qua {@link RoomAreaTableProps} (`roomAreaTypes.ts`, hợp
 * đồng đã chốt của T7), không `@/api`, không `@/store`, không `@/domain`,
 * không `@/lib/http` (R-60) — `local/no-data-layer-in-view` chặn cả bốn.
 * Không tính hình học, không cộng/làm tròn một con số nào: mọi chuỗi tới đây
 * đã xong ở hook của màn (A15). Không tạo `RoomAreaPanel.tsx` — worker khác
 * đang viết nó song song.
 *
 * ## Chín cột, đúng đặc tả
 *
 * tầng · tên phòng · loại · diện tích m² · chu vi m · chiều cao thông thuỷ m ·
 * số cửa · số cửa sổ · trạng thái. Đơn vị (m², m) đặt ở TIÊU ĐỀ CỘT — mỗi ô dữ
 * liệu chỉ mang con số đã định dạng, đúng interface `RoomAreaRow`.
 *
 * ## Vì sao hàng dữ liệu là `<tr>` thật, không phải `Table.Row`
 *
 * Xem docstring `RoomAreaTable.Row.tsx`: `Table.Row` trượt `expectAccessible`
 * (viền tiêu điểm do prop `focused` điều khiển, không phải bàn phím thật).
 * Quyết định PQ-2 của điều phối viên: hàng tương tác tự dựng trong thư mục
 * màn; khung không tương tác (tiêu đề cột, ô) vẫn dùng `Table.Head`/`Table.Cell`
 * của thư viện dùng chung.
 *
 * ## Bảy trạng thái (A11) — nơi từng trạng thái được vẽ
 *
 * | `state`     | vẽ ở đâu                                                            |
 * |-------------|-----------------------------------------------------------------------|
 * | `loading`   | `Table.Skeleton` (thân) + một dòng `Skeleton` (ô tổng)                |
 * | `empty`     | `EmptyState` mang hành động "kiểm tra khe hở tường" → `onCheckWallGaps` |
 * | `error`     | `Table.Error` mang `errorMessage` + nút thử lại → `onRetry`           |
 * | `collapsed` | thân ẩn, chỉ còn một dòng thông báo cộng hàng tổng ghim đáy           |
 * | `forbidden` | thân hiện đủ NHƯNG ô tên phòng là chữ tĩnh — không sửa được (`canRename`) |
 * | `ready`     | mặc định — nhóm theo `groups`, mỗi nhóm một dòng tổng phụ + các hàng  |
 * | `partial`   | mặc định như `ready`; phòng chưa đặt tên tự hiện `row.isUnnamed`      |
 *
 * Không nhánh nào trả `null` cho cả bảng: đầu bảng và khung `Table.Root` luôn
 * được vẽ, nên màn trắng — thất bại duy nhất A11 tồn tại để chặn — không có
 * chỗ xảy ra.
 *
 * ## Vì sao không có nút đổi chế độ ở đây
 *
 * `mode`/`onModeChange` nằm trong props chung vì `RoomAreaPanelProps` VÀ
 * `RoomAreaTableProps` cùng kế thừa `RoomAreaCommonProps` — nhưng docstring của
 * chính kiểu đó ghi rõ "Hai chế độ hiển thị, đổi bằng nút ở đầu **panel**"
 * (`roomAreaTypes.ts:36`). Nút đổi chế độ là việc của panel, không phải của
 * bảng toàn trang này; dựng thêm một nút thứ hai ở đây là trùng chức năng mà
 * không nơi nào yêu cầu.
 *
 * ## Vì sao hover 3D chỉ dừng ở `onRoomHover`, không tự nâng nền phòng
 *
 * `ViewerSceneHandle` (`viewer3dTypes.ts:276`) có đúng sáu phương thức:
 * `update`, `status`, `frameRate`, `frameEntities`, `preview`, `dispose` —
 * không phương thức nào nhận một khung nhìn 3D để "nâng nền phòng 5%→10%" khi
 * trỏ vào một dòng, và `preview` chỉ nhận hình học, không nhận trạng thái
 * hover. Phần 3D chưa nối được (không phải lỗi ở đây) — bảng chỉ phơi
 * `onRoomHover`/`hoveredRoomId` như một props thật, để container nối tiếp khi
 * phía 3D có API, mà không phải sửa file này (R-73). Xem PQ-8.
 */

import { Download, Inbox } from 'lucide-react';

import { EmptyState } from '@/components/feedback/EmptyState';
import { Skeleton } from '@/components/feedback/Skeleton';
import { IconButton } from '@/components/ui/IconButton';
import { Table } from '@/components/ui/Table';
import { cn } from '@/lib/utils';

import { RoomAreaTableRow } from './RoomAreaTable.Row';
import type { RoomAreaSort, RoomAreaTableProps } from './roomAreaTypes';

/** Chín cột, nguyên văn đặc tả. */
const COLUMN_COUNT = 9;

const EXPORT_ARIA_LABEL = 'xuất bảng diện tích phòng';

const EMPTY_TITLE = 'chưa dò ra phòng nào';
const EMPTY_DESCRIPTION = 'kiểm tra khe hở tường rồi dò lại để bảng có dữ liệu.';
const EMPTY_ACTION_LABEL = 'kiểm tra khe hở tường';

const FORBIDDEN_NOTICE = 'bảng chỉ xem — không có quyền sửa tên phòng.';
const COLLAPSED_NOTICE = 'danh sách phòng đang thu gọn, chỉ còn tổng diện tích.';

const HEADER_LEVEL = 'tầng';
const HEADER_NAME = 'tên phòng';
const HEADER_USAGE = 'loại';
const HEADER_AREA = 'diện tích';
const HEADER_AREA_UNIT = 'm²';
/*
 * "chu vi" là một cụm tiếng Việt KHÔNG DẤU trọn vẹn, và `expectVietnamese` từ
 * chối cả cụm như thế (`expectVietnamese.ts:649,671`) — không phải vì nó sai,
 * mà vì một nhãn toàn ASCII là chỗ tiếng Anh lọt vào mà không ai thấy. Thêm
 * "phòng" trả lại dấu cho cụm và nói đúng thứ cột đang đo.
 */
const HEADER_PERIMETER = 'chu vi phòng';
const HEADER_PERIMETER_UNIT = 'm';
const HEADER_CLEAR_HEIGHT = 'chiều cao thông thuỷ';
const HEADER_CLEAR_HEIGHT_UNIT = 'm';
const HEADER_DOOR_COUNT = 'số cửa';
const HEADER_WINDOW_COUNT = 'số cửa sổ';
const HEADER_STATUS = 'trạng thái';

const UNIT_LABEL_CLASS_NAME = 'font-normal text-text-muted';

/** Header đơn vị đặt CẠNH nhãn cột, không nhét vào từng ô (A15). */
function ColumnUnit({ children }: { children: string }) {
  return <span className={UNIT_LABEL_CLASS_NAME}> ({children})</span>;
}

export function RoomAreaTable(props: RoomAreaTableProps) {
  const {
    state,
    groups,
    totals,
    sort,
    onSortChange,
    hoveredRoomId,
    onRoomHover,
    onRoomActivate,
    onRoomRename,
    flashedRoomId,
    errorMessage,
    onRetry,
    onCheckWallGaps,
    onOpenExport,
  } = props;

  const canRename = state !== 'forbidden';
  const showGroups = state === 'ready' || state === 'partial' || state === 'forbidden';

  const sortDirectionOf = (column: RoomAreaSort): 'asc' | null => (sort === column ? 'asc' : null);

  return (
    <div aria-label="bảng diện tích phòng" className="flex h-full w-full flex-col gap-2 p-2" role="region">
      <div className="flex shrink-0 items-center justify-between gap-2">
        <p className={cn('text-[13px] text-state-attention-text', state !== 'forbidden' && 'invisible')}>
          {FORBIDDEN_NOTICE}
        </p>
        <IconButton aria-label={EXPORT_ARIA_LABEL} icon={<Download size={18} />} onClick={onOpenExport} />
      </div>

      <div className="min-h-0 flex-1">
        <Table.Root>
          <Table.Header>
            <tr>
              <Table.Head>{HEADER_LEVEL}</Table.Head>
              <Table.Head
                onSort={() => onSortChange('name')}
                sortDirection={sortDirectionOf('name')}
                sortable
              >
                {HEADER_NAME}
              </Table.Head>
              <Table.Head
                onSort={() => onSortChange('usage')}
                sortDirection={sortDirectionOf('usage')}
                sortable
              >
                {HEADER_USAGE}
              </Table.Head>
              <Table.Head
                onSort={() => onSortChange('area')}
                sortDirection={sortDirectionOf('area')}
                sortable
              >
                {HEADER_AREA}
                <ColumnUnit>{HEADER_AREA_UNIT}</ColumnUnit>
              </Table.Head>
              <Table.Head>
                {HEADER_PERIMETER}
                <ColumnUnit>{HEADER_PERIMETER_UNIT}</ColumnUnit>
              </Table.Head>
              <Table.Head>
                {HEADER_CLEAR_HEIGHT}
                <ColumnUnit>{HEADER_CLEAR_HEIGHT_UNIT}</ColumnUnit>
              </Table.Head>
              <Table.Head>{HEADER_DOOR_COUNT}</Table.Head>
              <Table.Head>{HEADER_WINDOW_COUNT}</Table.Head>
              <Table.Head>{HEADER_STATUS}</Table.Head>
            </tr>
          </Table.Header>

          {state === 'loading' && (
            <tbody>
              <Table.Skeleton columns={COLUMN_COUNT} />
            </tbody>
          )}

          {state === 'empty' && (
            <tbody>
              <tr>
                <Table.Cell className="p-0" colSpan={COLUMN_COUNT}>
                  <EmptyState
                    action={{ label: EMPTY_ACTION_LABEL, onClick: onCheckWallGaps }}
                    description={EMPTY_DESCRIPTION}
                    icon={<Inbox />}
                    title={EMPTY_TITLE}
                  />
                </Table.Cell>
              </tr>
            </tbody>
          )}

          {state === 'error' && (
            <tbody>
              <Table.Error colSpan={COLUMN_COUNT} message={errorMessage} onRetry={onRetry} />
            </tbody>
          )}

          {state === 'collapsed' && (
            <tbody>
              <tr>
                <Table.Cell className="h-16 text-center text-text-muted" colSpan={COLUMN_COUNT}>
                  {COLLAPSED_NOTICE}
                </Table.Cell>
              </tr>
            </tbody>
          )}

          {showGroups &&
            groups.map((group) => (
              <tbody key={group.key}>
                <tr className="bg-bg-sunken/60">
                  <Table.Cell
                    className="h-8 text-[13px] font-medium text-text-secondary"
                    colSpan={COLUMN_COUNT}
                  >
                    {group.label} — {group.countText} · {group.subtotalText} {totals.unitLabel}
                  </Table.Cell>
                </tr>
                {group.rows.map((row) => (
                  <RoomAreaTableRow
                    key={row.id}
                    canRename={canRename}
                    isFlashed={flashedRoomId === row.id}
                    isHovered={hoveredRoomId === row.id}
                    onActivate={onRoomActivate}
                    onHover={onRoomHover}
                    onRename={onRoomRename}
                    row={row}
                  />
                ))}
              </tbody>
            ))}

          {state === 'loading' ? (
            <tfoot className="sticky bottom-0 z-10 bg-bg-sunken">
              <tr className="h-10 border-t border-border-default">
                <Table.Cell colSpan={COLUMN_COUNT}>
                  <Skeleton preset="table-row" />
                </Table.Cell>
              </tr>
            </tfoot>
          ) : state === 'empty' || state === 'error' ? null : (
            <tfoot className="sticky bottom-0 z-10 bg-bg-sunken">
              <tr className="h-10 border-t border-border-default font-semibold text-text-primary">
                <Table.Cell colSpan={3}>{totals.caption}</Table.Cell>
                <Table.Cell className="text-right tabular-nums">
                  {totals.totalText}
                  <span className="ml-1 font-normal text-text-secondary">{totals.unitLabel}</span>
                </Table.Cell>
                <Table.Cell colSpan={5} />
              </tr>
            </tfoot>
          )}
        </Table.Root>
      </div>
    </div>
  );
}
