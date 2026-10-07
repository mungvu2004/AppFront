import { act, renderHook } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import type { LevelId } from '@/domain/spatial/types';
import { VIEWER_FIXTURE_SPATIAL } from '@/screens/viewer/ViewerShell';
import { useStore } from '@/store';

import { shouldUseViewerFixture, useViewer3DSource } from './useViewer3DSource';

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

describe('useViewer3DSource — tầng đang xem (B-V8-41)', () => {
  it('gắn thì KHÔNG đụng `activeFloorId` — đích lưu nay theo tầng có thứ bị đổi, không theo tầng đang xem', () => {
    act(() => {
      useStore.getState().setActiveFloor('L-OLDFLOOR01' as LevelId);
    });

    renderHook(() => useViewer3DSource({}, null, true));

    expect(useStore.getState().activeFloorId).toBe('L-OLDFLOOR01');
  });
});
