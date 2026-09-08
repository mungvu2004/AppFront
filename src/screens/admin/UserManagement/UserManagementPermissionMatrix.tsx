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
 * trình đọc màn hình là `cell.srLabel`, gắn bằng `aria-label` ngay trên `<td>` — cùng cách
 * `HistoryPanel.rows.tsx` gắn `sr-only` cạnh một icon-only control.
 */

import type { UserManagementPermissionMatrixProps } from './types';

const MARK_CLASS = 'text-text-secondary';

export function UserManagementPermissionMatrix({
  captionLabel,
  matrix,
}: UserManagementPermissionMatrixProps) {
  return (
    <table className="w-full border-collapse text-[13px]">
      <caption className="mb-2 text-left font-medium text-text-secondary">{captionLabel}</caption>

      <thead>
        <tr className="border-b border-border-default">
          <th scope="col">
            <span className="sr-only">việc</span>
          </th>

          {matrix.columns.map((column) => (
            <th className="p-2 text-center font-medium text-text-secondary" key={column.role} scope="col">
              {column.label}
            </th>
          ))}
        </tr>
      </thead>

      <tbody>
        {matrix.rows.map((row) => (
          <tr className="border-b border-border-default last:border-b-0" key={row.key}>
            <th className="p-2 text-left font-normal text-text-primary" scope="row">
              {row.label}
            </th>

            {row.cells.map((cell) => (
              <td aria-label={cell.srLabel} className="p-2 text-center" key={cell.role}>
                <span aria-hidden="true" className={MARK_CLASS}>
                  {cell.allowed ? '✓' : '–'}
                </span>
              </td>
            ))}
          </tr>
        ))}
      </tbody>
    </table>
  );
}
