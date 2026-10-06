import { describe, expect, it } from 'vitest';

import { createApiClient } from '@/api/client';
import { diffVersions } from '@/lib/versioning/diff';

import { createVersionsServerFake } from './versionHistoryFixtures';

import { toVersionSnapshot, vertexIdOf, type VersionSnapshotSource } from './versionSnapshotAdapter';

/** Thân N18 dây (literal), giải mã bằng client thật để có kiểu miền. */
const WIRE_SNAPSHOT = {
  dimensions: [
    {
      confidence: 1,
      id: 'M-DIMEN00001',
      kind: 'linear',
      levelId: 'L-LEVEL000001',
      line: { end: { x: 4000, y: 0 }, start: { x: 0, y: 0 } },
      referenceIds: ['W-WALL000001'],
      reviewed: true,
      source: 'human',
      valueMm: 4000,
    },
  ],
  layer: {
    furniture: [
      {
        boundingBox: { max: { x: 550, y: 550 }, min: { x: 450, y: 450 } },
        centre: { x: 500, y: 500 },
        confidence: 1,
        id: 'F-FURNI00001',
        kind: 'chair',
        levelId: 'L-LEVEL000001',
        reviewed: true,
        rotationDeg: 90,
        source: 'human',
      },
    ],
    openings: [
      {
        confidence: 1,
        heightMm: 2100,
        id: 'D-DOOR000001',
        kind: 'door',
        offsetMm: 100,
        reviewed: true,
        sillHeightMm: 0,
        source: 'human',
        swing: 'left',
        wallId: 'W-WALL000001',
        widthMm: 900,
      },
      {
        confidence: 1,
        heightMm: 1200,
        id: 'D-WIND000001',
        kind: 'window',
        offsetMm: 2000,
        reviewed: true,
        sillHeightMm: 900,
        source: 'human',
        swing: 'fixed',
        wallId: 'W-WALL000001',
        widthMm: 1200,
      },
    ],
    rooms: [
      {
        areaM2: 12.5,
        confidence: 1,
        id: 'R-ROOM000001',
        levelId: 'L-LEVEL000001',
        name: 'Phòng khách',
        outline: [
          { x: 0, y: 0 },
          { x: 3500, y: 0 },
          { x: 3500, y: 3500 },
        ],
        reviewed: true,
        source: 'human',
        usage: 'livingRoom',
        wallIds: ['W-WALL000001'],
      },
    ],
    walls: [
      {
        centreline: { end: { x: 4000, y: 0 }, start: { x: 0, y: 0 } },
        confidence: 1,
        heightMm: 2800,
        id: 'W-WALL000001',
        kind: 'loadBearing',
        levelId: 'L-LEVEL000001',
        openingIds: ['D-DOOR000001', 'D-WIND000001'],
        reviewed: true,
        source: 'human',
        thicknessMm: 220,
      },
    ],
  },
  versionId: 'ver_01J9ZV8Q3M7X5B2N4K6P8R0T3C',
};

async function decodeSnapshot(wire: unknown): Promise<VersionSnapshotSource> {
  const server = createVersionsServerFake();

  server.override('GET snapshot', () => ({ data: wire, ok: true }));

  const result = await createApiClient(server.http).versions.snapshot({
    floorId: 'L-LEVEL000001',
    projectId: 'project-1',
    versionId: WIRE_SNAPSHOT.versionId,
  });

  if (!result.ok) {
    throw new Error('fixture: thân N18 không giải mã được');
  }

  return result.data;
}

describe('toVersionSnapshot — bảng tên HOP-DONG-MOI §1.3', () => {
  it('mỗi loại thực thể mang đúng khoá của bảng', async () => {
    const snapshot = toVersionSnapshot(await decodeSnapshot(WIRE_SNAPSHOT));

    expect(snapshot.wall['W-WALL000001']).toEqual({ thickness_mm: 220, height_mm: 2800, kind: 'loadBearing' });
    expect(snapshot.vertex[vertexIdOf('W-WALL000001', 'start')]).toEqual({ x: 0, y: 0 });
    expect(snapshot.vertex['V-W-WALL000001-end']).toEqual({ x: 4000, y: 0 });
    expect(snapshot.door['D-DOOR000001']).toEqual({
      width_mm: 900,
      height_mm: 2100,
      sill_height_mm: 0,
      offset_mm: 100,
      swing: 'left',
      wall_id: 'W-WALL000001',
    });
    expect(Object.keys(snapshot.window)).toEqual(['D-WIND000001']);
    expect(snapshot.room['R-ROOM000001']).toEqual({
      name: 'Phòng khách',
      usage: 'livingRoom',
      outline: WIRE_SNAPSHOT.layer.rooms[0]?.outline,
    });
    expect(snapshot.furniture['F-FURNI00001']).toEqual({ kind: 'chair', centre: { x: 500, y: 500 }, rotation_deg: 90 });
    expect(snapshot.dimension['M-DIMEN00001']).toEqual({ value_mm: 4000, reference_ids: ['W-WALL000001'] });
  });

  it('trường miền vắng thì khoá vắng (không `undefined`)', async () => {
    const snapshot = toVersionSnapshot(await decodeSnapshot(WIRE_SNAPSHOT));

    expect('room_id' in (snapshot.furniture['F-FURNI00001'] ?? {})).toBe(false);
    expect('override_value_mm' in (snapshot.dimension['M-DIMEN00001'] ?? {})).toBe(false);
  });

  it('đổi độ dày một tường → diffVersions ra đúng một `changed` `thickness_mm`', async () => {
    const before = toVersionSnapshot(await decodeSnapshot(WIRE_SNAPSHOT));
    const thicker = structuredClone(WIRE_SNAPSHOT);

    thicker.layer.walls[0] = { ...thicker.layer.walls[0], thicknessMm: 300 } as (typeof thicker.layer.walls)[number];

    const diff = diffVersions(before, toVersionSnapshot(await decodeSnapshot(thicker)));

    expect(diff.added).toEqual([]);
    expect(diff.removed).toEqual([]);
    expect(diff.changed).toHaveLength(1);
    expect(diff.changed[0]).toMatchObject({ entityId: 'W-WALL000001', entityType: 'wall', field: 'thickness_mm', newValue: 300 });
  });
});
