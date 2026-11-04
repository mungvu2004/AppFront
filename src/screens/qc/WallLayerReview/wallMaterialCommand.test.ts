/** Lệnh chọn vật liệu: kính ghi `paint` hai mặt, thường bỏ khoá `paint`, hoàn tác trả về bản trước. */

import { describe, expect, it } from 'vitest';

import type { Wall } from '@/domain/spatial/types';
import { GLASS_WALL_PAINT } from '@/domain/walls/glass';

import { buildChangeWallMaterialCommand, WALL_CHANGE_MATERIAL_COMMAND_TYPE } from './wallLayerReviewGateway';

const plain = { id: 'W-WALL0000001', kind: 'envelope', heightMm: 3300, source: 'detected', reviewed: false } as unknown as Wall;
const glass = { ...plain, paint: GLASS_WALL_PAINT } as Wall;

describe('buildChangeWallMaterialCommand', () => {
  it('thường sang kính: chỉ thêm paint, không đổi kind', () => {
    const command = buildChangeWallMaterialCommand(plain, true, 'U-1');
    const change = command?.changes[0];
    expect(command?.type).toBe(WALL_CHANGE_MATERIAL_COMMAND_TYPE);
    expect(change?.before).toEqual(plain);
    expect(change?.after).toEqual({ ...plain, paint: GLASS_WALL_PAINT });
  });

  it('kính sang thường: bỏ khoá paint', () => {
    const after = buildChangeWallMaterialCommand(glass, false, 'U-1')?.changes[0]?.after as Wall;
    expect('paint' in after).toBe(false);
    expect(after).toEqual(plain);
  });

  it('không có gì đổi thì không có lệnh', () => {
    expect(buildChangeWallMaterialCommand(plain, false, 'U-1')).toBeNull();
    expect(buildChangeWallMaterialCommand(glass, true, 'U-1')).toBeNull();
  });
});
