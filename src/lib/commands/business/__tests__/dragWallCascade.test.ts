/**
 * Quyết định 3A: kéo một góc thì tường nối đi theo, và chúng mất dấu xác minh.
 *
 * Người dùng chốt điều này ngày 2026-09-18. Nó **chưa từng được thi công** cho
 * tới 2026-09-28 — `docs/pascal/04-doi-chieu-tung-tinh-nang.md` §C1 và §C2 ghi
 * lại phát hiện ấy: mọi tài liệu nhắc 3A như một hành vi đang chạy, còn mã thì
 * chỉ kéo MỘT tường và giữ nguyên siêu dữ liệu duyệt.
 *
 * Tệp này là hàng rào của cả hai nửa. Nửa sau quan trọng hơn và dễ mất hơn:
 * một tường bị hệ thống dời mà vẫn đeo dấu xanh là dấu ấy **nói dối** — A5 nói
 * dấu xanh chỉ đánh dấu việc người duyệt, không đánh dấu việc máy.
 */

import { describe, expect, it } from 'vitest';

import { millimetres } from '@/domain/units/types';
import { normalizeSpatial } from '@/domain/spatial/normalize';
import type { Level, SpatialGraph, Wall } from '@/domain/spatial/types';

import type { Command } from '../../types';
import type { CommandResult } from '../shared';
import { createDragWallEndCommand } from '../wallCommands';

/** Lệnh đã được nhận; ném kèm lý do nếu nó bị từ chối. */
const expectCommand = (result: CommandResult): Command => {
  if (!result.ok) {
    throw new Error(`Lệnh bị từ chối: ${result.error.reasons.join(' ')}`);
  }

  return result.data;
};

const LEVEL: Level = {
  id: 'L-LEVEL000000',
  name: 'Tầng trệt',
  order: 0,
  elevationMm: millimetres(0),
  heightMm: millimetres(3600),
  confidence: 1,
  source: 'human',
  reviewed: true,
};

/** Hai tường gặp nhau đúng ở một góc: đầu `end` của A trùng đầu `start` của B. */
const wallAt = (
  id: Wall['id'],
  start: { x: number; y: number },
  end: { x: number; y: number },
  reviewed: boolean,
): Wall => ({
  id,
  levelId: LEVEL.id,
  kind: 'partition',
  centreline: { start, end },
  thicknessMm: millimetres(220),
  heightMm: millimetres(3600),
  openingIds: [],
  confidence: 1,
  source: reviewed ? 'human' : 'ai',
  reviewed,
});

const graphWith = (walls: readonly Wall[]): SpatialGraph => ({
  building: {
    name: 'Nhà thử',
    datumElevationMm: millimetres(0),
    confidence: 1,
    source: 'human',
    reviewed: true,
  },
  levels: [LEVEL],
  walls: [...walls],
  openings: [],
  rooms: [],
  furniture: [],
  axes: [],
  dimensions: [],
  notes: [],
});

const contextFor = (walls: readonly Wall[]) => ({
  graph: normalizeSpatial(graphWith(walls)),
  actorId: 'U-1',
  now: () => 0,
});

/** Góc chữ L: A đi ngang tới (4000,0), B đi lên từ đúng điểm đó. */
const CORNER = [
  wallAt('W-WALL0000001', { x: 0, y: 0 }, { x: 4000, y: 0 }, true),
  wallAt('W-WALL0000002', { x: 4000, y: 0 }, { x: 4000, y: 3000 }, true),
] as const;

describe('[3A] kéo góc tường thì tường nối đi theo', () => {
  it('tường chung góc được dời theo, trong CÙNG một lệnh', () => {
    const command = expectCommand(
      createDragWallEndCommand(
      { wallId: 'W-WALL0000001', end: 'end', to: { x: 4500, y: 500 } },
      contextFor(CORNER),
      ),
    );

    const wallChanges = command.changes.filter((change) => change.kind === 'wall');
    expect(wallChanges).toHaveLength(2);

    const moved = wallChanges.find((change) => change.id === 'W-WALL0000002');
    expect(moved).toBeDefined();
    expect(moved?.after).toMatchObject({
      centreline: { start: { x: 4500, y: 500 }, end: { x: 4000, y: 3000 } },
    });
  });

  it('một lệnh nghĩa là MỘT bước hoàn tác, không phải hai', () => {
    const command = expectCommand(
      createDragWallEndCommand(
      { wallId: 'W-WALL0000001', end: 'end', to: { x: 4500, y: 500 } },
      contextFor(CORNER),
      ),
    );

    // Cả hai tường nằm trong `changes` của cùng một `Command`; `invertCommand`
    // vì thế trả lại cả hai cùng lúc.
    expect(new Set(command.changes.map((change) => change.id)).size).toBe(2);
  });

  it('nhãn lệnh nói ra là có tường đi theo, và nói bằng tiếng Việt', () => {
    const command = expectCommand(
      createDragWallEndCommand(
      { wallId: 'W-WALL0000001', end: 'end', to: { x: 4500, y: 500 } },
      contextFor(CORNER),
      ),
    );
    expect(command.description).toMatch(/tường nối đi theo và mất dấu xác minh/);
  });
});

describe('[3A · A5] tường đi theo MẤT dấu xác minh', () => {
  it('tường bị dời theo có `reviewed` về false và `source` về `ai`', () => {
    const command = expectCommand(
      createDragWallEndCommand(
      { wallId: 'W-WALL0000001', end: 'end', to: { x: 4500, y: 500 } },
      contextFor(CORNER),
      ),
    );

    const moved = command.changes.find((change) => change.id === 'W-WALL0000002');
    expect(moved?.after).toMatchObject({ reviewed: false, source: 'ai' });
  });

  it('tường người dùng KÉO TRỰC TIẾP thì giữ nguyên siêu dữ liệu duyệt', () => {
    const command = expectCommand(
      createDragWallEndCommand(
      { wallId: 'W-WALL0000001', end: 'end', to: { x: 4500, y: 500 } },
      contextFor(CORNER),
      ),
    );

    // Luật ở đầu `shared.ts` giữ nguyên cho lượt sửa trực tiếp: chỉ tường ĐI
    // THEO mới mất dấu, vì không ai soát vị trí mới của nó.
    const dragged = command.changes.find((change) => change.id === 'W-WALL0000001');
    expect(dragged?.after).toMatchObject({ reviewed: true, source: 'human' });
  });
});

describe('[3A] chỗ KHÔNG được kéo theo', () => {
  it('tường rời, không chung góc, thì đứng yên', () => {
    const lonely = [
      CORNER[0],
      wallAt('W-WALL0000003', { x: 9000, y: 9000 }, { x: 9000, y: 12000 }, true),
    ];

    const command = expectCommand(
      createDragWallEndCommand(
      { wallId: 'W-WALL0000001', end: 'end', to: { x: 4500, y: 500 } },
      contextFor(lonely),
      ),
    );
    expect(command.changes.filter((change) => change.kind === 'wall')).toHaveLength(1);
  });

  it('kéo đầu KHÔNG có ai hàn vào thì cũng chỉ một tường đổi', () => {
    const command = expectCommand(
      createDragWallEndCommand(
      { wallId: 'W-WALL0000001', end: 'start', to: { x: -500, y: -500 } },
      contextFor(CORNER),
      ),
    );
    expect(command.changes.filter((change) => change.kind === 'wall')).toHaveLength(1);
  });
});
