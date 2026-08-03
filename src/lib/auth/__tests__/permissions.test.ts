import { describe, expect, it } from 'vitest';

import { AUTH_ROLES, can, permissionCapabilities, permissionMatrix } from '../permissions';

describe('src/lib/auth/permissions', () => {
  it('prints the 3 x 8 matrix and matches the brief', () => {
    const rows = permissionCapabilities.map(({ key }) => ({
      admin: permissionMatrix[key]['Quản trị'],
      capability: key,
      engineer: permissionMatrix[key]['Kỹ sư'],
      viewer: permissionMatrix[key]['Người xem'],
    }));

    console.table(rows);

    expect(rows).toHaveLength(8);
    expect(AUTH_ROLES).toEqual(['Quản trị', 'Kỹ sư', 'Người xem']);
    expect(permissionCapabilities.every(({ key }) => permissionMatrix[key]['Quản trị'])).toBe(true);
    expect(permissionCapabilities.every(({ key }) => !permissionMatrix[key]['Người xem'])).toBe(true);
    expect(permissionMatrix['library.manage']['Kỹ sư']).toBe(false);
    expect(permissionMatrix['user.manage']['Kỹ sư']).toBe(false);
    expect(can('create', 'project', { roles: ['Quản trị'] })).toBe(true);
    expect(can('manage', 'user', { roles: ['Kỹ sư'] })).toBe(false);
    expect(can('export', 'model', { roles: ['Người xem'] })).toBe(false);
  });
});
