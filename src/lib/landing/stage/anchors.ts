/**
 * The 3D points DOM labels hang from, and the projection that puts them on screen.
 *
 * Labels are DOM (CONTRACT), so each frame the screen asks the stage where an
 * anchor is in CSS pixels. The stage owns the house-level anchors — rooms, the
 * stair, the two compliance checks, the review gap; ink owns the rest. Points
 * on the upper storey are stored without its lift and get it added on read, so
 * a label follows the cutaway.
 */

import { Vector3, type Camera } from 'three';

import { facingVector, planPoint, roomCentre } from '@/lib/three/present';

import type { LandingHouse } from '../types';

export interface StageAnchor {
  readonly point: Vector3;
  readonly upper: boolean;
}

/** Room labels float at eye height over the room's centre. */
export const LABEL_HEIGHT_M = 1.2;
/** The compliance checks' targets: the bathroom door, and the stair. */
export const BATH_DOOR_OPENING = 'D5';

const MM = 1000;

export function houseAnchors(house: LandingHouse): Map<string, StageAnchor> {
  const { plan, stair } = house;
  const levels = [...plan.levels].sort((a, b) => a.elevationMm - b.elevationMm);
  const upperId = levels[1]?.id;
  const elevation = (levelId: string): number => (plan.levels.find((l) => l.id === levelId)?.elevationMm ?? 0) / MM;
  const anchors = new Map<string, StageAnchor>();

  for (const room of plan.rooms) {
    const c = roomCentre(room);
    anchors.set(`room:${room.id}`, {
      point: new Vector3(c.x, elevation(room.levelId) + LABEL_HEIGHT_M, c.z),
      upper: room.levelId === upperId,
    });
  }

  // The flight's middle riser: half the risers along the climb, half the rise up.
  const dir = facingVector(stair.climbs);
  const foot = planPoint(stair.startMm);
  const half = stair.risers / 2;
  const mid = new Vector3(
    foot.x + (dir.x * half * stair.treadMm) / MM,
    elevation(stair.levelId) + (half * stair.riserMm) / MM,
    foot.z + (dir.z * half * stair.treadMm) / MM,
  );
  const stairUpper = stair.levelId === upperId;
  anchors.set('check:C7', { point: mid, upper: stairUpper });
  anchors.set('stair', { point: mid.clone().setY(mid.y + LABEL_HEIGHT_M), upper: stairUpper });

  const along = (wallId: string, t: number, heightM: number): StageAnchor | null => {
    const wall = plan.walls.find((w) => w.id === wallId);
    if (wall === undefined) {
      return null;
    }
    const a = planPoint(wall.start);
    const b = planPoint(wall.end);
    return {
      point: new Vector3(a.x + (b.x - a.x) * t, elevation(wall.levelId) + heightM, a.z + (b.z - a.z) * t),
      upper: wall.levelId === upperId,
    };
  };

  const door = plan.openings.find((o) => o.id === BATH_DOOR_OPENING);
  const doorAnchor =
    door === undefined ? null : along(door.wallId, door.relativePosition, (door.sillHeightMm + door.heightMm / 2) / MM);
  if (doorAnchor !== null) {
    anchors.set('check:C4', doorAnchor);
  }
  const gap = along(house.reviewGap.wallId, (house.reviewGap.from + house.reviewGap.to) / 2, 0);
  if (gap !== null) {
    anchors.set('gap', gap);
  }

  return anchors;
}

export interface Projected {
  readonly x: number;
  readonly y: number;
  readonly visible: boolean;
}

const scratch = new Vector3();

/** `world` in CSS pixels of a `width` × `height` viewport. */
export function projectPoint(world: Vector3, camera: Camera, width: number, height: number): Projected {
  scratch.copy(world).applyMatrix4(camera.matrixWorldInverse);
  const inFront = scratch.z < 0;
  scratch.copy(world).project(camera);
  const x = ((scratch.x + 1) / 2) * width;
  const y = ((1 - scratch.y) / 2) * height;
  return { x, y, visible: inFront && x >= 0 && x <= width && y >= 0 && y <= height };
}
