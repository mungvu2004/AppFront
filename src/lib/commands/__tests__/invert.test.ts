import { describe, expect, it } from 'vitest';

import { applyPatch } from '@/domain/spatial/applyPatch';
import { normalizeSpatial } from '@/domain/spatial/normalize';
import type { Level, Opening, Room, SpatialGraph, Wall } from '@/domain/spatial/types';
import { changeForAdd, changeForRemove, changeForUpdate, createCommand } from '@/lib/commands/createCommand';
import { commandToPatches, invertCommand, toggleUndoDescription, UNDO_DESCRIPTION_PREFIX } from '@/lib/commands/invert';
import type { Command } from '@/lib/commands/types';

const LEVEL_ID = 'L-000001AAAA' as const;
const WALL_ID = 'W-000001AAAA' as const;
const OPENING_ID = 'D-000001AAAA' as const;
const ROOM_ID = 'R-000001AAAA' as const;

const levelFixture: Level = {
  id: LEVEL_ID,
  name: 'Tầng 1',
  order: 0,
  elevationMm: 0,
  heightMm: 3400,
  areaM2: 248.6,
  confidence: 0.95,
  source: 'human',
  reviewed: true,
};

const wallFixture: Wall = {
  id: WALL_ID,
  levelId: LEVEL_ID,
  centreline: { start: { x: 0, y: 0 }, end: { x: 4800, y: 0 } },
  thicknessMm: 220,
  heightMm: 3400,
  kind: 'loadBearing',
  openingIds: [OPENING_ID],
  confidence: 0.92,
  source: 'ai',
  reviewed: false,
};

const openingFixture: Opening = {
  id: OPENING_ID,
  wallId: WALL_ID,
  kind: 'door',
  offsetMm: 1200,
  widthMm: 900,
  heightMm: 2100,
  sillHeightMm: 0,
  swing: 'left',
  confidence: 0.88,
  source: 'ai',
  reviewed: false,
};

const roomFixture: Room = {
  id: ROOM_ID,
  levelId: LEVEL_ID,
  name: 'Phòng khách',
  usage: 'livingRoom',
  outline: [
    { x: 0, y: 0 },
    { x: 4800, y: 0 },
    { x: 4800, y: 3600 },
    { x: 0, y: 3600 },
  ],
  areaM2: 17.28,
  wallIds: [WALL_ID],
  confidence: 0.9,
  source: 'ai',
  reviewed: false,
};

const buildUpdateWallCommand = (): Command =>
  createCommand({
    type: 'wall.resize',
    actorId: 'user-01',
    description: 'Đổi bề dày tường sang 110 mm',
    changes: [changeForUpdate('wall', wallFixture, { ...wallFixture, thicknessMm: 110 })],
    id: 'C-000001AAAA',
    timestamp: '2026-08-14T09:00:00+07:00',
  });

const buildMultiChangeCommand = (): Command =>
  createCommand({
    type: 'opening.remove',
    actorId: 'user-01',
    description: 'Xoá cửa đi khỏi tường',
    changes: [
      changeForUpdate('wall', wallFixture, { ...wallFixture, openingIds: [] }),
      changeForRemove('opening', openingFixture),
    ],
    id: 'C-000002AAAA',
    timestamp: '2026-08-14T09:05:00+07:00',
  });

describe('invertCommand', () => {
  it('swaps snapshots and reverses change order', () => {
    const command = buildMultiChangeCommand();
    const inverted = invertCommand(command);

    expect(inverted.changes).toHaveLength(2);
    expect(inverted.changes[0]).toEqual({
      kind: 'opening',
      id: OPENING_ID,
      before: null,
      after: openingFixture,
    });
    expect(inverted.changes[1]).toEqual({
      kind: 'wall',
      id: WALL_ID,
      before: { ...wallFixture, openingIds: [] },
      after: wallFixture,
    });
    expect(inverted.id).toBe(command.id);
    expect(inverted.type).toBe(command.type);
    expect(inverted.scope).toEqual(command.scope);
    expect(inverted.description).toBe(`${UNDO_DESCRIPTION_PREFIX}Xoá cửa đi khỏi tường`);
  });

  it('is an involution: inverting twice returns the original command', () => {
    const commands = [
      buildUpdateWallCommand(),
      buildMultiChangeCommand(),
      createCommand({
        type: 'room.add',
        actorId: 'user-02',
        description: 'Thêm phòng khách',
        changes: [changeForAdd('room', roomFixture)],
        id: 'C-000003AAAA',
        timestamp: '2026-08-14T09:10:00+07:00',
      }),
      createCommand({
        type: 'room.remove',
        actorId: 'user-02',
        description: 'Xoá phòng khách',
        changes: [changeForRemove('room', roomFixture)],
        id: 'C-000004AAAA',
        timestamp: '2026-08-14T09:15:00+07:00',
      }),
    ];

    for (const command of commands) {
      expect(invertCommand(invertCommand(command))).toEqual(command);
    }
  });

  it('toggles the undo prefix instead of stacking it', () => {
    expect(toggleUndoDescription('Đổi bề dày tường')).toBe('Hoàn tác: Đổi bề dày tường');
    expect(toggleUndoDescription('Hoàn tác: Đổi bề dày tường')).toBe('Đổi bề dày tường');
  });
});

describe('command serialization', () => {
  it('survives a JSON round trip without losing information', () => {
    for (const command of [buildUpdateWallCommand(), buildMultiChangeCommand()]) {
      const restored = JSON.parse(JSON.stringify(command)) as Command;

      expect(restored).toEqual(command);
      expect(invertCommand(restored)).toEqual(invertCommand(command));
    }
  });

  it('contains only plain data, never functions', () => {
    const command = buildMultiChangeCommand();
    const visit = (value: unknown): void => {
      expect(typeof value).not.toBe('function');

      if (value !== null && typeof value === 'object') {
        Object.values(value).forEach(visit);
      }
    };

    visit(command);
  });
});

describe('commandToPatches', () => {
  it('applies and then undoes a command without leaving a trace on the graph', () => {
    const graph: SpatialGraph = {
      building: {
        name: 'Nhà phố mẫu',
        datumElevationMm: 0,
        grossFloorAreaM2: 248.6,
        confidence: 1,
        source: 'human',
        reviewed: true,
      },
      levels: [levelFixture],
      walls: [wallFixture],
      openings: [openingFixture],
      furniture: [],
      rooms: [],
      axes: [],
      dimensions: [],
      notes: [],
    };
    const normalized = normalizeSpatial(graph);
    const command = buildMultiChangeCommand();

    const afterApply = applyPatch(normalized, commandToPatches(command));

    expect(afterApply.byId[OPENING_ID]).toBeUndefined();
    expect(afterApply.byId[WALL_ID]).toEqual({ ...wallFixture, openingIds: [] });

    const afterUndo = applyPatch(afterApply, commandToPatches(invertCommand(command)));

    expect(afterUndo).toEqual(normalized);
  });
});

describe('createCommand', () => {
  it('derives the scope from the snapshots', () => {
    const command = buildMultiChangeCommand();

    expect(command.scope).toEqual({
      entityIds: [WALL_ID, OPENING_ID],
      levelIds: [LEVEL_ID],
      kinds: ['wall', 'opening'],
    });
  });

  it('rejects a change with no snapshot at all', () => {
    expect(() =>
      createCommand({
        type: 'wall.noop',
        actorId: 'user-01',
        description: 'Lệnh hỏng',
        changes: [{ kind: 'wall', id: WALL_ID, before: null, after: null }],
      }),
    ).toThrow(/cannot be inverted/);
  });

  it('rejects an update whose snapshots belong to different entities', () => {
    expect(() =>
      changeForUpdate('wall', wallFixture, { ...wallFixture, id: 'W-000002AAAA' }),
    ).toThrow(/across ids/);
  });

  it('generates id and timestamp when they are omitted', () => {
    const command = createCommand({
      type: 'room.add',
      actorId: 'user-02',
      description: 'Thêm phòng khách',
      changes: [changeForAdd('room', roomFixture)],
    });

    expect(command.id).toMatch(/^C-/);
    expect(Number.isNaN(Date.parse(command.timestamp))).toBe(false);
  });
});
