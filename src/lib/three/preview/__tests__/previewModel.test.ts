/**
 * `narrowFloorInput` — cắt một tầng xuống đúng phần đang được xem trước.
 *
 * Dữ liệu là bộ mẫu chuẩn của A14 (`createCleanBuildingScenario`), đi qua đúng
 * `toBuildFloorInput` mà mô hình thật đi qua — không phải một `BuildFloorInput`
 * bịa tại chỗ, vì cái đáng kiểm ở đây là hành vi trên hình dạng dữ liệu THẬT.
 */

import { describe, expect, it } from 'vitest';

import { normalizeSpatial } from '@/domain/spatial/normalize';
import { toBuildFloorInput } from '@/domain/spatial/toBuildFloorInput';
import type { EntityId, LevelId } from '@/domain/spatial/types';
import { createCleanBuildingScenario } from '@/lib/testing/fixtures';
import type { BuildFloorInput } from '@/lib/three/build/floor';

import { narrowFloorInput } from '../previewModel';

/** Chỗ đặt ô mở thứ hai trên cùng một bức tường, tính theo chiều dài tường. */
const SIBLING_POSITION = 0.25;

/** Tầng đầu tiên của bộ mẫu, đã thành đầu vào của R-01. */
function firstLevel(): BuildFloorInput {
  const spatial = normalizeSpatial(createCleanBuildingScenario().graph);

  for (const id of spatial.byKind.level) {
    const input = toBuildFloorInput(spatial, id as LevelId);

    if (input !== null && input.walls.length > 0) {
      return input;
    }
  }

  throw new Error('bộ mẫu chuẩn phải có ít nhất một tầng có tường');
}

describe('narrowFloorInput', () => {
  it('giữ đúng bức tường được nêu, và không một bức nào khác', () => {
    const level = firstLevel();
    const wall = level.walls[0];

    if (wall === undefined) {
      throw new Error('tầng phải có tường');
    }

    const narrowed = narrowFloorInput(level, [wall.id]);

    expect(level.walls.length).toBeGreaterThan(1);
    expect(narrowed.walls).toStrictEqual([wall]);
    expect(narrowed.rooms).toStrictEqual([]);
    expect(narrowed.level).toBe(level.level);
  });

  it('kéo theo MỌI ô mở của bức tường được giữ, không chỉ ô mở được nêu', () => {
    const level = firstLevel();
    const opening = (level.openings ?? [])[0];

    if (opening === undefined) {
      throw new Error('bộ mẫu phải có ít nhất một ô mở');
    }

    // Bộ mẫu chuẩn đặt nhiều nhất một ô mở trên mỗi tường, nên bức tường hai ô
    // mở được dựng từ chính ô mở thật ấy — cùng tường chủ, dịch sang một chỗ
    // khác — thay vì bịa ra một hình dạng dữ liệu không có thật.
    const sibling = {
      ...opening,
      id: `${String(opening.id)}-B` as typeof opening.id,
      relativePosition: SIBLING_POSITION,
    };
    const twoOnOneWall: BuildFloorInput = {
      ...level,
      openings: [...(level.openings ?? []), sibling],
    };

    const narrowed = narrowFloorInput(twoOnOneWall, [opening.id]);
    const kept = narrowed.openings ?? [];

    // Một bức tường được dựng KÈM lỗ đã khoét sẵn: bỏ bớt ô mở của nó là vẽ lại
    // một bức tường bịt kín ngay lúc người dùng động vào thanh trượt.
    expect(narrowed.walls).toHaveLength(1);
    expect(kept).toHaveLength(2);
    expect(kept.map((one) => one.id)).toStrictEqual([opening.id, sibling.id]);
  });

  it('xem trước một ô mở kéo theo bức tường chủ của nó', () => {
    const level = firstLevel();
    const opening = (level.openings ?? [])[0];

    if (opening === undefined) {
      throw new Error('bộ mẫu phải có ít nhất một ô mở');
    }

    const narrowed = narrowFloorInput(level, [opening.id]);

    expect(narrowed.walls).toHaveLength(1);
    expect(String(narrowed.walls[0]?.id)).toBe(String(opening.wallId));
    expect(narrowed.openings?.some((kept) => kept.id === opening.id)).toBe(true);
  });

  it('giữ phòng được nêu, và giữ nguyên độ dày bản sàn nếu tầng có nói', () => {
    const level = firstLevel();
    const room = level.rooms[0];

    if (room === undefined) {
      throw new Error('tầng phải có phòng');
    }

    const withThickness: BuildFloorInput = { ...level, slabThicknessMm: level.level.heightMm };
    const narrowed = narrowFloorInput(withThickness, [room.id]);

    expect(narrowed.rooms).toStrictEqual([room]);
    expect(narrowed.walls).toStrictEqual([]);
    expect(narrowed.slabThicknessMm).toBe(withThickness.slabThicknessMm);
  });

  it('mã không thuộc tầng này cho một tầng rỗng, không phải một lỗi', () => {
    const level = firstLevel();
    const narrowed = narrowFloorInput(level, ['W-khong-co-that' as EntityId]);

    expect(narrowed.walls).toStrictEqual([]);
    expect(narrowed.rooms).toStrictEqual([]);
    expect(narrowed.openings).toStrictEqual([]);
    expect(narrowed.slabThicknessMm).toBeUndefined();
  });
});
