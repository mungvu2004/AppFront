import { Vector3 } from 'three';
import { describe, expect, it } from 'vitest';

import type { ViewerSceneFrame } from '@/screens/viewer/ViewerShell/viewerShellTypes';

import { stageViewpoint } from './measurementToolSceneStage';

const EXTENT = { centre: new Vector3(10, 5, -4), sizeM: new Vector3(40, 10, 20) };

function frameOf(overrides: Partial<ViewerSceneFrame>): ViewerSceneFrame {
  return {
    azimuthRad: Math.PI / 4,
    polarRad: Math.PI / 3,
    distanceM: 1,
    isOrthographic: false,
    visibleStoreyIds: [],
    separation: 0,
    sectionPlane: null,
    selectedEntityIds: [],
    hoveredEntityId: null,
    isolatedEntityIds: null,
    hiddenEntityIds: [],
    reducedMotion: false,
    ...overrides,
  };
}

describe('stageViewpoint (BUG-650)', () => {
  it('aims at the box centre plus the controller pan offset', () => {
    const view = stageViewpoint(frameOf({ zoom: 1, panOffsetM: [3, 0, -2] }), EXTENT, 1.6);
    expect(view.target.toArray()).toEqual([13, 5, -6]);
  });

  it('frames the real box outside the model, ignoring a shell distance that sits inside it', () => {
    const view = stageViewpoint(frameOf({ zoom: 1, distanceM: 1 }), EXTENT, 1.6);
    const radius = EXTENT.sizeM.length() / 2;
    expect(view.distanceM).toBeGreaterThan(radius);
  });

  it('a narrower canvas frames from further away, and zoom 2 halves the distance', () => {
    const wide = stageViewpoint(frameOf({ zoom: 1 }), EXTENT, 2);
    const narrow = stageViewpoint(frameOf({ zoom: 1 }), EXTENT, 0.75);
    const zoomed = stageViewpoint(frameOf({ zoom: 2 }), EXTENT, 2);
    expect(narrow.distanceM).toBeGreaterThan(wide.distanceM);
    expect(zoomed.distanceM).toBeCloseTo(wide.distanceM / 2);
  });

  it('falls back to the shell distance and box centre when the frame carries neither', () => {
    const view = stageViewpoint(frameOf({ distanceM: 42 }), EXTENT, 1.6);
    expect(view.distanceM).toBe(42);
    expect(view.target.toArray()).toEqual([10, 5, -4]);
  });
});
