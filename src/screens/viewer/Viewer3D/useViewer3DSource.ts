import { useEffect, useMemo } from 'react';

import { resolveUseMockApi } from '@/api/appClient';
import type { NormalizedSpatial } from '@/domain/spatial/normalize';
import { useStore } from '@/store';
import {
  createViewerShellFixtureGateway,
  createViewerShellGateway,
  shouldUseViewerFixture,
  VIEWER_FIXTURE_SPATIAL,
  type ViewerShellGateway,
} from '@/screens/viewer/ViewerShell';

/* Vị ngữ sống ở `ViewerShell/viewerShellGateway.ts` — xem chú thích tại đó về
 * cổng kích thước gói. Tái xuất giữ nguyên đường nhập cho nơi gọi cũ. */
export { shouldUseViewerFixture };

export function useViewer3DSource(
  props: {
    readonly gateway?: ViewerShellGateway;
    readonly spatial?: NormalizedSpatial | null;
  },
  storeSpatial: NormalizedSpatial | null,
  useMock: boolean = resolveUseMockApi(),
): { readonly spatial: NormalizedSpatial | null; readonly gateway: ViewerShellGateway } {
  /*
   * B-V8-04: đi màn đối chiếu → `/3d` để lại `activeFloorId` của tầng cũ, và đường lưu
   * của panel thuộc tính sẽ ghi lớp của tầng ấy trong khi màn báo "Đã lưu" (A7).
   * ponytail: xoá tầng đang xem khi gắn; gỡ khi N1 (đích lưu theo `levelId` của đối tượng).
   */
  useEffect(() => {
    useStore.getState().setActiveFloor(null);
  }, []);

  const usesFixture = shouldUseViewerFixture({
    hasInjectedSpatial: props.spatial !== undefined,
    storeSpatial,
    useMock,
  });

  const spatial: NormalizedSpatial | null = usesFixture
    ? VIEWER_FIXTURE_SPATIAL
    : (props.spatial ?? storeSpatial);

  const gateway = useMemo((): ViewerShellGateway => {
    if (props.gateway !== undefined) {
      return props.gateway;
    }

    return usesFixture
      ? createViewerShellFixtureGateway(VIEWER_FIXTURE_SPATIAL)
      : createViewerShellGateway(() => useStore.getState().spatial);
  }, [props.gateway, usesFixture]);

  return { spatial, gateway };
}
