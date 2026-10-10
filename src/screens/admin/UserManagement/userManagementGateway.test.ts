/**
 * BUG-081 — nhãn ma trận quyền viết hoa chữ đầu khi đứng làm nhãn (A6), nhưng câu cho
 * trình đọc màn hình chèn chúng giữa câu nên vẫn viết thường ở đó.
 */
import { describe, expect, it } from 'vitest';

import { buildPermissionMatrix, permissionCellSrLabel } from './userManagementGateway';

const capitalized = (label: string): boolean => label === label.charAt(0).toLocaleUpperCase('vi') + label.slice(1);

describe('ma trận quyền (BUG-081)', () => {
  const matrix = buildPermissionMatrix();

  it('nhãn hàng và tiêu đề cột vai viết hoa chữ đầu', () => {
    expect(matrix.rows.map((row) => row.label).filter((label) => !capitalized(label))).toEqual([]);
    expect(matrix.columns.map((column) => column.label)).toEqual(['Quản trị', 'Kỹ sư', 'Người xem']);
    expect(matrix.rows.find((row) => row.key === 'qc.approve')?.label).toBe('Duyệt QC');
  });

  it('câu đọc màn hình giữ dạng thường giữa câu', () => {
    expect(permissionCellSrLabel('admin', 'Duyệt QC', true)).toBe('quản trị: được phép duyệt QC');
    expect(permissionCellSrLabel('viewer', 'Tải bản vẽ', false)).toBe('người xem: không được phép tải bản vẽ');
  });
});
