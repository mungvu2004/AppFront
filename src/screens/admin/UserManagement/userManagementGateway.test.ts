/**
 * BUG-081 — nhãn ma trận quyền viết hoa chữ đầu khi đứng làm nhãn (A6), nhưng câu cho
 * trình đọc màn hình chèn chúng giữa câu nên vẫn viết thường ở đó.
 */
import { describe, expect, it, vi } from 'vitest';

import type { UsersApi } from '@/api/client';
import type { NotificationBus } from '@/lib/mutations/notificationBus';

import { buildPermissionMatrix, createUserManagementGateway, permissionCellSrLabel } from './userManagementGateway';

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

describe('[11U-A-101] lượt ghi gửi Idempotency-Key (FL-11U-01)', () => {
  it('disable, enable, changeRole, remove đều bật idempotent', async () => {
    const user = { email: 'a@x.vn', id: 'u1', lastActiveAt: null, name: 'A', projectCount: 0, role: 'viewer', status: 'active' };
    const ok = vi.fn(() => Promise.resolve({ ok: true, data: user }));
    const usersApi = { disable: ok, enable: ok, changeRole: ok, remove: ok } as unknown as UsersApi;
    const gateway = createUserManagementGateway({
      usersApi,
      roles: ['admin'],
      notifications: { publish: vi.fn() } as unknown as NotificationBus,
    });

    await gateway.disableUser('u1');
    await gateway.enableUser('u1');
    await gateway.changeRole({ role: 'viewer', userId: 'u1' });
    await gateway.removeUser({ confirmEmail: 'a@x.vn', userId: 'u1' });

    expect(ok.mock.calls.map((call) => (call as unknown[])[0])).toEqual([
      expect.objectContaining({ idempotent: true }),
      expect.objectContaining({ idempotent: true }),
      expect.objectContaining({ idempotent: true }),
      expect.objectContaining({ idempotent: true }),
    ]);
  });
});
