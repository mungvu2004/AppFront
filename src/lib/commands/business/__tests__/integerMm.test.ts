/**
 * Dây ghi (`FloorLayerWriteSchema`) đòi mm nguyên. Trên tường xiên, chân vuông góc của nhát cắt và vị
 * trí ô mở ra số lẻ; trước khi `buildCommand` làm tròn, autosave bị zod chặn ngay ở client.
 */

import { describe, expect, it } from 'vitest';

import { OpeningSchema, WallSchema } from '@/api/schemas/spatial';
import { normalizeSpatial } from '@/domain/spatial/normalize';
import type { Opening, SpatialGraph, Wall } from '@/domain/spatial/types';
import type { Command } from '@/lib/commands/types';

import { createMoveOpeningCommand } from '../openingCommands';
import type { CommandContext, CommandResult } from '../shared';
import { createSplitWallCommand } from '../wallCommands';

const LEVEL = 'L-LVL001AAAA' as const;
const SLANT = 'W-SLANT01AAA' as const;
const PIECE = 'W-SPLIT01AAA' as const;
const DOOR = 'D-DOOR01AAAA' as const;
const DETECTED = { confidence: 0.9, source: 'ai', reviewed: false } as const;

/* Dài √(3000² + 2000²) = 3605,551 mm — phần lẻ ≥ 0,5 nên làm tròn thường sẽ đẩy ô mở lòi ra đầu tường. */
const slant: Wall = {
  ...DETECTED,
  id: SLANT,
  levelId: LEVEL,
  centreline: { start: { x: 0, y: 0 }, end: { x: 3000, y: 2000 } },
  thicknessMm: 220,
  heightMm: 3400,
  kind: 'partition',
  openingIds: [DOOR],
};
const door: Opening = {
  ...DETECTED,
  id: DOOR,
  wallId: SLANT,
  kind: 'door',
  offsetMm: 2400,
  widthMm: 900,
  heightMm: 2200,
  sillHeightMm: 0,
  swing: 'left',
};
const graph: SpatialGraph = {
  building: { confidence: 1, source: 'human', reviewed: true, name: 'Tường xiên', datumElevationMm: 0 },
  levels: [{ confidence: 1, source: 'human', reviewed: true, id: LEVEL, name: 'Tầng 1', order: 0, elevationMm: 0, heightMm: 3600 }],
  walls: [slant],
  openings: [door],
  furniture: [],
  rooms: [],
  axes: [],
  dimensions: [],
  notes: [],
};
const context: CommandContext = { graph: normalizeSpatial(graph), actorId: 'U-QC-01' };
const lengthMm = Math.hypot(3000, 2000);

const expectCommand = (result: CommandResult): Command => {
  if (!result.ok) {
    throw new Error(result.error.reasons.join(' '));
  }

  return result.data;
};

/** Mọi snapshot `after` đều qua được schema dây (mm nguyên, đoạn dài > 0, ô mở offset ≥ 0). */
const expectWireValid = (command: Command): void => {
  for (const change of command.changes) {
    if (change.kind === 'wall' && change.after !== null) {
      expect(WallSchema.safeParse(change.after).success).toBe(true);
    }

    if (change.kind === 'opening' && change.after !== null) {
      expect(OpeningSchema.safeParse(change.after).success).toBe(true);
    }
  }
};

describe('lệnh trên tường xiên ra mm nguyên', () => {
  it('tách đoạn: điểm cắt nguyên, hai mảnh dùng chung đúng một điểm, ô mở nguyên và vẫn trong tường', () => {
    const command = expectCommand(
      createSplitWallCommand({ wallId: SLANT, at: { x: 1000.3, y: 700.6 }, secondWallId: PIECE }, context),
    );
    const first = command.changes.find((change) => change.id === SLANT)?.after as Wall;
    const second = command.changes.find((change) => change.id === PIECE)?.after as Wall;

    expect(Number.isInteger(first.centreline.end.x) && Number.isInteger(first.centreline.end.y)).toBe(true);
    expect(second.centreline.start).toEqual(first.centreline.end);
    expectWireValid(command);

    const moved = command.changes.find((change) => change.id === DOOR)?.after as Opening;
    const host = moved.wallId === SLANT ? first : second;
    const hostLength = Math.hypot(
      host.centreline.end.x - host.centreline.start.x,
      host.centreline.end.y - host.centreline.start.y,
    );

    expect(Number.isInteger(moved.offsetMm)).toBe(true);
    expect(moved.offsetMm + moved.widthMm).toBeLessThanOrEqual(hostLength);
  });

  it('dời ô mở: offset lẻ ra nguyên', () => {
    const command = expectCommand(createMoveOpeningCommand({ openingId: DOOR, offsetMm: 1234.56 }, context));

    expect((command.changes[0]?.after as Opening).offsetMm).toBe(1235);
    expectWireValid(command);
  });

  it('dời ô mở sát đầu tường: không làm tròn lên quá đầu tường', () => {
    const command = expectCommand(createMoveOpeningCommand({ openingId: DOOR, offsetMm: lengthMm - 900 }, context));
    const moved = command.changes[0]?.after as Opening;

    expect(moved.offsetMm).toBe(2705);
    expect(moved.offsetMm + moved.widthMm).toBeLessThanOrEqual(lengthMm);
  });
});
