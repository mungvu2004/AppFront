import { useMemo } from 'react';

import { resolveUseMockApi } from '@/api/appClient';
import type { NormalizedSpatial } from '@/domain/spatial/normalize';
import { useStore } from '@/store';
import {
  createViewerShellFixtureGateway,
  createViewerShellGateway,
  VIEWER_FIXTURE_SPATIAL,
  type ViewerShellGateway,
} from '@/screens/viewer/ViewerShell';

/* Nhà mẫu chỉ sống ở chế độ mock: nối BE thật thì kho rỗng là kho rỗng. */
export function shouldUseViewerFixture(input: {
  readonly hasInjectedSpatial: boolean;
  readonly storeSpatial: NormalizedSpatial | null;
  readonly useMock: boolean;
}): boolean {
  return input.useMock && !input.hasInjectedSpatial && input.storeSpatial === null;
}

export function useViewer3DSource(
  props: {
    readonly gateway?: ViewerShellGateway;
    readonly spatial?: NormalizedSpatial | null;
  },
  storeSpatial: NormalizedSpatial | null,
  useMock: boolean = resolveUseMockApi(),
): { readonly spatial: NormalizedSpatial | null; readonly gateway: ViewerShellGateway } {
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
