/** UX-47 — sau lượt mời, bộ lọc nào che hàng vừa mời thì màn bỏ lọc để nhảy tới hàng ấy. */
import { describe, expect, it } from 'vitest';

import { FILTER_ALL } from './types';
import { inviteHiddenByFilters } from './useUserManagement';

const INVITE = { emails: ['ux-sua2-r4@congty.vn'], role: 'engineer' } as const;
const NO_FILTER = { search: '', roleFilter: FILTER_ALL, statusFilter: FILTER_ALL } as const;

describe('inviteHiddenByFilters (UX-47)', () => {
  it('không lọc gì: hàng mới đã thấy, không bỏ lọc', () => {
    expect(inviteHiddenByFilters(INVITE, NO_FILTER)).toBe(false);
  });

  it('lọc "Chờ chấp nhận" hoặc đúng vai đã mời: vẫn thấy', () => {
    expect(inviteHiddenByFilters(INVITE, { ...NO_FILTER, statusFilter: 'pending' })).toBe(false);
    expect(inviteHiddenByFilters(INVITE, { ...NO_FILTER, roleFilter: 'engineer' })).toBe(false);
  });

  it('lọc trạng thái khác, vai khác, hoặc ô tìm không khớp: che hàng mới', () => {
    expect(inviteHiddenByFilters(INVITE, { ...NO_FILTER, statusFilter: 'active' })).toBe(true);
    expect(inviteHiddenByFilters(INVITE, { ...NO_FILTER, roleFilter: 'admin' })).toBe(true);
    expect(inviteHiddenByFilters(INVITE, { ...NO_FILTER, search: 'nguyen' })).toBe(true);
  });

  it('ô tìm khớp một phần địa chỉ đã mời: vẫn thấy', () => {
    expect(inviteHiddenByFilters(INVITE, { ...NO_FILTER, search: 'UX-SUA2' })).toBe(false);
  });
});
