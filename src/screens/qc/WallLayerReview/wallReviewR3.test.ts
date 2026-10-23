import { describe, expect, it } from 'vitest';

import type { Wall } from '@/domain/spatial/types';

import { WALL_LAYER_FIXTURE_WALLS } from './wallLayerReviewFixture';
import {
  buildUnapproveWallCommand,
  isStandardThickness,
  wallStatusCode,
  WALL_UNAPPROVE_COMMAND_TYPE,
} from './wallLayerReviewGateway';

const first = (): Wall => {
  const wall = WALL_LAYER_FIXTURE_WALLS[0];
  if (wall === undefined) throw new Error('fixture rỗng');
  return wall;
};

describe('R-7: độ dày so trong dung sai, không so bằng đúng', () => {
  it('116 mm (bội 23,13 mm của chuẩn 110) không bị ⚠', () => {
    expect(isStandardThickness(116)).toBe(true);
    const wall: Wall = { ...first(), thicknessMm: 116, reviewed: false };
    expect(wallStatusCode(wall)).not.toBe('attention');
  });

  it('185 mm lệch quá 30 mm khỏi mọi băng vẫn ⚠', () => {
    expect(isStandardThickness(185)).toBe(false);
  });
});

describe('S2-5: bỏ duyệt', () => {
  it('lệnh bỏ duyệt hạ reviewed về false, giữ nguyên phần còn lại', () => {
    const before: Wall = { ...first(), reviewed: true, source: 'human' };
    const command = buildUnapproveWallCommand(before, 'nguoi-duyet');
    const after = command.changes[0]?.after as Wall;

    expect(command.type).toBe(WALL_UNAPPROVE_COMMAND_TYPE);
    expect(after.reviewed).toBe(false);
    expect(after.thicknessMm).toBe(before.thicknessMm);
    expect(command.description).toContain('Bỏ duyệt');
  });
});
