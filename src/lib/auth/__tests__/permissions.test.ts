import { describe, expect, it } from 'vitest';

import { AUTH_ROLES, can, permissionCapabilities, permissionMatrix } from '../permissions';

describe('src/lib/auth/permissions', () => {
  it('prints the 3 x 8 matrix and matches the brief', () => {
    const rows = permissionCapabilities.map(({ key }) => ({
      admin: permissionMatrix[key].admin,
      capability: key,
      engineer: permissionMatrix[key].engineer,
      viewer: permissionMatrix[key].viewer,
    }));

    console.table(rows);

    expect(rows).toHaveLength(8);
    expect(AUTH_ROLES).toEqual(['admin', 'engineer', 'viewer']);
    expect(permissionCapabilities.every(({ key }) => permissionMatrix[key].admin)).toBe(true);
    expect(permissionCapabilities.every(({ key }) => !permissionMatrix[key].viewer)).toBe(true);
    expect(permissionMatrix['library.manage'].engineer).toBe(false);
    expect(permissionMatrix['user.manage'].engineer).toBe(false);
    expect(can('create', 'project', { roles: ['admin'] })).toBe(true);
    expect(can('manage', 'user', { roles: ['engineer'] })).toBe(false);
    expect(can('export', 'model', { roles: ['viewer'] })).toBe(false);
  });
});
