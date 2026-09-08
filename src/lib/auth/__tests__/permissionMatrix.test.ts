import { describe, expect, it } from 'vitest';

import { AUTH_ROLES, can, permissionCapabilities, permissionMatrix } from '../permissions';

/**
 * Hai khoá quyền của màn quản trị người dùng — `qc.approve` và `ruleset.edit`.
 *
 * File riêng chứ không nối vào `./permissions.test.ts`: bài kiểm ở đó in cả bảng
 * ra `console.table` và khẳng định những bất biến của cả ma trận, còn đây là hai
 * dòng cụ thể cộng lý do chính sách của chúng. Trộn lại thì lần sau ai đọc cũng
 * phải đọc cả hai việc để hiểu một việc.
 */
describe('src/lib/auth/permissions — qc.approve và ruleset.edit', () => {
  it('cho kỹ sư duyệt QC, vì các màn qc đã gate theo đúng vai ấy', () => {
    expect(permissionMatrix['qc.approve']).toEqual({ admin: true, engineer: true, viewer: false });
    expect(can('approve', 'qc', { roles: ['admin'] })).toBe(true);
    expect(can('approve', 'qc', { roles: ['engineer'] })).toBe(true);
    expect(can('approve', 'qc', { roles: ['viewer'] })).toBe(false);
  });

  it('giữ bộ luật là việc của quản trị, kể cả với kỹ sư', () => {
    expect(permissionMatrix['ruleset.edit']).toEqual({ admin: true, engineer: false, viewer: false });
    expect(can('edit', 'ruleset', { roles: ['admin'] })).toBe(true);
    expect(can('edit', 'ruleset', { roles: ['engineer'] })).toBe(false);
    expect(can('edit', 'ruleset', { roles: ['viewer'] })).toBe(false);
  });

  it('vẫn đúng ba vai — thêm vai thứ tư là một thay đổi khác, có PR riêng', () => {
    expect([...AUTH_ROLES]).toEqual(['admin', 'engineer', 'viewer']);
    Object.values(permissionMatrix).forEach((row) => {
      expect(Object.keys(row).sort()).toEqual(['admin', 'engineer', 'viewer']);
    });
  });

  it('hai khoá mới có mặt trong permissionCapabilities, nên màn dựng được cả bảy dòng ma trận', () => {
    const keys = permissionCapabilities.map(({ key }) => key);

    expect(keys).toContain('qc.approve');
    expect(keys).toContain('ruleset.edit');
    expect(new Set(keys).size).toBe(keys.length);
    expect(keys.every((key) => key in permissionMatrix)).toBe(true);
  });

  it('không đụng tám khoá cũ — từng chữ một', () => {
    expect(permissionMatrix['floor.upload']).toEqual({ admin: true, engineer: true, viewer: false });
    expect(permissionMatrix['layer.edit']).toEqual({ admin: true, engineer: true, viewer: false });
    expect(permissionMatrix['library.manage']).toEqual({ admin: true, engineer: false, viewer: false });
    expect(permissionMatrix['model.export']).toEqual({ admin: true, engineer: true, viewer: false });
    expect(permissionMatrix['project.create']).toEqual({ admin: true, engineer: true, viewer: false });
    expect(permissionMatrix['project.settings.edit']).toEqual({
      admin: true,
      engineer: true,
      viewer: false,
    });
    expect(permissionMatrix['share.create']).toEqual({ admin: true, engineer: true, viewer: false });
    expect(permissionMatrix['user.manage']).toEqual({ admin: true, engineer: false, viewer: false });
  });

  it('một tài nguyên hoặc hành động không có trong ma trận vẫn là "không", không phải "có"', () => {
    expect(can('approve', 'ruleset', { roles: ['admin'] })).toBe(false);
    expect(can('edit', 'qc', { roles: ['admin'] })).toBe(false);
    expect(can('approve', 'qc', {})).toBe(false);
  });
});
