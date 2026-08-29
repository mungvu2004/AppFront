import { describe, expect, it } from 'vitest';

import { millimetresPerPixel } from '../../units/scale';
import { applyPatch, readEntity, type SpatialPatch } from '../applyPatch';
import { createSampleBuilding, sampleLevelId, sampleWallId } from '../__fixtures__/sampleBuilding';
import { normalizeSpatial } from '../normalize';

// L0-3: applying a drawing scale to a Level, and the immutability that lets
// zundo's temporal store undo it by simply restoring an earlier snapshot.

const LEVEL_ID = sampleLevelId(0);
const OTHER_WALL_ID = sampleWallId(0);

const updateLevelScale = (levelId: typeof LEVEL_ID, ratio: number): SpatialPatch => ({
  op: 'update',
  kind: 'level',
  id: levelId,
  changes: { scaleMillimetresPerPixel: millimetresPerPixel(ratio) },
});

describe('applyPatch — scaleMillimetresPerPixel trên Level', () => {
  it('cập nhật tỷ lệ của tầng mà không đụng tới thực thể hay bảng khác', () => {
    const normalized = normalizeSpatial(createSampleBuilding());

    const next = applyPatch(normalized, [updateLevelScale(LEVEL_ID, 12)]);
    const level = readEntity(next, 'level', LEVEL_ID);

    expect(level?.scaleMillimetresPerPixel).toBe(12);
    // Level is never placed on a level itself, so nothing moves between level
    // buckets: byKind and byLevel keep their exact previous references.
    expect(next.byKind).toBe(normalized.byKind);
    expect(next.byLevel).toBe(normalized.byLevel);
    // A wall untouched by the patch keeps its exact previous reference too.
    expect(readEntity(next, 'wall', OTHER_WALL_ID)).toBe(readEntity(normalized, 'wall', OTHER_WALL_ID));
  });

  it('áp hai lần liên tiếp cho ra giá trị cuối đúng, còn bản ghi trước vẫn nguyên (đường dữ liệu hoàn tác)', () => {
    const base = normalizeSpatial(createSampleBuilding());

    const afterFirst = applyPatch(base, [updateLevelScale(LEVEL_ID, 12)]);
    const afterSecond = applyPatch(afterFirst, [updateLevelScale(LEVEL_ID, 24)]);

    expect(readEntity(afterSecond, 'level', LEVEL_ID)?.scaleMillimetresPerPixel).toBe(24);
    // zundo's undo step works by handing back an earlier snapshot; that
    // snapshot must not have been mutated by the later patch.
    expect(readEntity(afterFirst, 'level', LEVEL_ID)?.scaleMillimetresPerPixel).toBe(12);
    expect(afterFirst).not.toBe(afterSecond);
  });

  it('tầng chưa hiệu chỉnh, không có trường tỷ lệ, vẫn là một Level hợp lệ', () => {
    const normalized = normalizeSpatial(createSampleBuilding());
    const level = readEntity(normalized, 'level', LEVEL_ID);

    expect(level).not.toBeNull();
    expect(level?.scaleMillimetresPerPixel).toBeUndefined();
  });
});
