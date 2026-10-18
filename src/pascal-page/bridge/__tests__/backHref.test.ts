import { beforeEach, describe, expect, it } from 'vitest';

import { isSafeReturnPath, LAST_APP_PATH_KEY, rememberAppPath, resolveBackHref } from '../backHref';

describe('resolveBackHref', () => {
  beforeEach(() => window.sessionStorage.clear());

  it('không có nguồn: về Quản lý tầng', () => {
    expect(resolveBackHref('p1', '?project=p1')).toBe('/projects/p1/floors');
  });

  it('?returnTo= nội bộ thắng, giữ cả query (dòng vi phạm đang xem)', () => {
    rememberAppPath('/projects/p1/floors/L1/layers/walls');
    expect(resolveBackHref('p1', '?project=p1&returnTo=%2Fprojects%2Fp1%2Frules%3Frow%3Dv3')).toBe(
      '/projects/p1/rules?row=v3',
    );
  });

  it('đường cuối của app trong sessionStorage: về màn Tường, hoặc danh sách dự án', () => {
    rememberAppPath('/projects/p1/floors/L1/layers/walls');
    expect(resolveBackHref('p1', '')).toBe('/projects/p1/floors/L1/layers/walls');

    rememberAppPath('/');
    expect(resolveBackHref('p1', '')).toBe('/');
  });

  it('bỏ đường 3D, đường ngoài, và đường của dự án khác', () => {
    rememberAppPath('/projects/p1/rules');
    rememberAppPath('/projects/p1/3d?view=exploded');
    rememberAppPath('/editor3d.html?project=p1');
    expect(window.sessionStorage.getItem(LAST_APP_PATH_KEY)).toBe('/projects/p1/rules');

    expect(resolveBackHref('p1', '?returnTo=https%3A%2F%2Fevil.test')).toBe('/projects/p1/rules');
    expect(resolveBackHref('p1', '?returnTo=%2F%2Fevil.test')).toBe('/projects/p1/rules');
    expect(resolveBackHref('p2', '')).toBe('/projects/p2/floors');
  });

  it('isSafeReturnPath', () => {
    expect(isSafeReturnPath('/projects/p1/3d')).toBe(false);
    expect(isSafeReturnPath('/projects/p1/3d/measure')).toBe(false);
    expect(isSafeReturnPath('/projects/p1/3dx')).toBe(true);
    expect(isSafeReturnPath('/\\evil.test')).toBe(false);
    expect(isSafeReturnPath(null)).toBe(false);
  });
});
