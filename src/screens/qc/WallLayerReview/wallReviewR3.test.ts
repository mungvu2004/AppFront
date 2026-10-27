import { describe, expect, it } from 'vitest';

import type { Wall } from '@/domain/spatial/types';

import { WALL_LAYER_FIXTURE_WALLS } from './wallLayerReviewFixture';
import {
  buildUnapproveWallCommand,
  confidenceTextOf,
  isStandardThickness,
  wallLengthNumberOf,
  wallStatusCode,
  WALL_UNAPPROVE_COMMAND_TYPE,
} from './wallLayerReviewGateway';
import { sortByReviewQueue } from './wallReviewQueue';

const first = (): Wall => {
  const wall = WALL_LAYER_FIXTURE_WALLS[0];
  if (wall === undefined) throw new Error('fixture rỗng');
  return wall;
};

describe('R-7: độ dày so trong dung sai, không so bằng đúng', () => {
  it('116 mm (bội 23,13 mm của chuẩn 110) không bị ⚠', () => {
    expect(isStandardThickness(116)).toBe(true);
    const wall: Wall = { ...first(), thicknessMm: 116, reviewed: false, confidence: 1 };
    expect(wallStatusCode(wall)).not.toBe('attention');
  });

  it('260 mm lệch quá 30 mm khỏi mọi băng vẫn ⚠', () => {
    expect(isStandardThickness(260)).toBe(false);
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

describe('K16: một quy tắc chiều dài cho danh sách và thanh tra', () => {
  it('tỷ lệ thật: số mm nguyên; tỷ lệ máy đo chưa xác nhận: "≈"; không đo được tỷ lệ: không có số', () => {
    expect(wallLengthNumberOf(5757.4)).toBe('5.757');
    expect(wallLengthNumberOf(5757.4, 'unresolved', 'pipeline')).toBe('≈5.757');
    expect(wallLengthNumberOf(5757.4, 'unresolved')).toBe('≈5.757');
    expect(wallLengthNumberOf(5757.4, 'unresolved', 'project_default')).toBeNull();
  });

  it('độ tin cậy nói bằng chữ', () => {
    expect(confidenceTextOf(0.5)).toBe('Máy chưa chắc');
    expect(confidenceTextOf(0.95)).toBe('Máy chắc chắn');
  });
});

describe('K15: máy chưa chắc lên đầu nhóm', () => {
  it('trong cùng nhóm, tường chưa duyệt dưới ngưỡng đứng trước; nhóm vẫn giữ thứ tự', () => {
    const sure: Wall = { ...first(), id: 'W-sure', thicknessMm: 220, reviewed: false, confidence: 0.95 };
    const unsure: Wall = { ...first(), id: 'W-unsure', thicknessMm: 220, reviewed: false, confidence: 0.5 };
    const odd: Wall = { ...first(), id: 'W-odd', thicknessMm: 260, reviewed: false, confidence: 0.95 };
    const done: Wall = { ...first(), id: 'W-done', thicknessMm: 220, reviewed: true, confidence: 0.4 };

    expect(sortByReviewQueue([done, sure, unsure, odd]).map((wall) => wall.id)).toEqual(['W-odd', 'W-unsure', 'W-sure', 'W-done']);
  });
});
