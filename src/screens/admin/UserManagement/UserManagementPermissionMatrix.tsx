/**
 * Khối tham chiếu quyền của `/admin/users` — Đ-1, Đ-2 trong `contract-decisions.md`.
 *
 * **Ba cột, không phải bốn.** `matrix.columns` đến sẵn từ `AUTH_ROLES` qua tầng dữ liệu;
 * component này chỉ lặp qua nó chứ không gõ tay tên vai, và không có nhánh nào cho phép
 * một cột thứ tư xuất hiện — thêm một cột nghĩa là sửa kiểu `PermissionMatrixModel`, việc
 * đó không thuộc về đây.
 *
 * **Không gõ tay bảng true/false.** Mỗi `cell.allowed` đọc thẳng từ `permissionMatrix` của
 * tầng auth (Đ-2); file này chỉ vẽ, không tính.
 *
 * **Đơn sắc.** Dấu tích/gạch dùng `--text-secondary`, không có màu trạng thái nào ở đây —
 * đúng yêu cầu "vai không bao giờ được truyền đạt chỉ bằng màu".
 *
 * **Một dấu tích không phải văn bản.** Ký hiệu hình học nằm trong `aria-hidden`; tên cho
 * trình đọc màn hình là `cell.srLabel` trong một `sr-only` ngay cạnh nó — cùng cách
 * `HistoryPanel.rows.tsx` gắn `sr-only` cạnh một icon-only control.
 *
 * ## Vì sao đây KHÔNG phải một `<table>` (lớp gộp T9 sửa)
 *
 * Trạng thái 6 của Đ-7 hiện **chỉ** ma trận quyền, và bộ kiểm chốt điều đó bằng
 * `queryByRole('table')` phải rỗng — “không danh sách người nào trong DOM”. Bản đầu dựng
 * khối này bằng `<table>` nên chính nó làm bài ấy đỏ. Danh sách người dùng
 * (`UserManagementTable`) giữ nguyên `<table>` thật; khối tham chiếu này chuyển sang một
 * danh sách xếp cột bằng flex. Không mất gì cho trình đọc màn hình: `srLabel` của Đ-2 đã tự
 * mang đủ cả vai lẫn việc (“quản trị: được phép tải bản vẽ”), nên ô không cần quan hệ
 * hàng/cột của một bảng để đọc được. Dải tiêu đề cột chỉ còn là trang trí → `aria-hidden`.
 */

import type { UserManagementPermissionMatrixProps } from './types';

const MARK_CLASS = 'text-text-secondary';
const CELL_CLASS = 'w-[72px] shrink-0 text-center';
const ALLOWED_MARK = '✓';
const DENIED_MARK = '–';

export function UserManagementPermissionMatrix({
  captionLabel,
  matrix,
}: UserManagementPermissionMatrixProps) {
  return (
    <div className="w-full text-[13px]">
      <p className="mb-2 font-medium text-text-secondary">{captionLabel}</p>

      <div
        aria-hidden="true"
        className="flex items-center border-b border-border-default pb-2"
      >
        <span className="min-w-0 flex-1" />

        {matrix.columns.map((column) => (
          <span className={`${CELL_CLASS} font-medium text-text-secondary`} key={column.role}>
            {column.label}
          </span>
        ))}
      </div>

      <ul className="flex flex-col">
        {matrix.rows.map((row) => (
          <li
            className="flex items-center border-b border-border-default py-2 last:border-b-0"
            key={row.key}
          >
            <span className="min-w-0 flex-1 text-text-primary">{row.label}</span>

            {row.cells.map((cell) => (
              <span className={CELL_CLASS} key={cell.role}>
                <span className="sr-only">{cell.srLabel}</span>
                <span aria-hidden="true" className={MARK_CLASS}>
                  {cell.allowed ? ALLOWED_MARK : DENIED_MARK}
                </span>
              </span>
            ))}
          </li>
        ))}
      </ul>
    </div>
  );
}
