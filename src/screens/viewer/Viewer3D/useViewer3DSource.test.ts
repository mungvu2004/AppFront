import { describe, expect, it } from 'vitest';

import { VIEWER_FIXTURE_SPATIAL } from '@/screens/viewer/ViewerShell';

import { shouldUseViewerFixture } from './useViewer3DSource';

describe('shouldUseViewerFixture', () => {
  it('mock + kho rỗng + không tiêm → true', () => {
    expect(shouldUseViewerFixture({ hasInjectedSpatial: false, storeSpatial: null, useMock: true })).toBe(true);
  });
  it('không mock + kho rỗng + không tiêm → false', () => {
    expect(shouldUseViewerFixture({ hasInjectedSpatial: false, storeSpatial: null, useMock: false })).toBe(false);
  });
  it('có tiêm → false', () => {
    expect(shouldUseViewerFixture({ hasInjectedSpatial: true, storeSpatial: null, useMock: true })).toBe(false);
  });
  it('kho có đồ thị → false', () => {
    expect(
      shouldUseViewerFixture({ hasInjectedSpatial: false, storeSpatial: VIEWER_FIXTURE_SPATIAL, useMock: true }),
    ).toBe(false);
  });
});
