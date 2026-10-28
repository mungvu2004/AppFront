import { describe, expect, it } from 'vitest';

import type { Wall } from '@/domain/spatial/types';

import { WALL_LAYER_FIXTURE_WALLS } from './wallLayerReviewFixture';
import { rowExtraOf, sortByReviewQueue, type WallReviewReason } from './wallReviewQueue';

const base = (): Wall => {
  const wall = WALL_LAYER_FIXTURE_WALLS[0];
  if (wall === undefined) throw new Error('fixture rỗng');
  return { ...wall, reviewed: false, confidence: 1, thicknessMm: 110 };
};
const wall = (id: string, patch: Partial<Wall> = {}): Wall => ({ ...base(), id, ...patch }) as Wall;

describe('Bố cục L23: hàng đợi Tường chia theo lý do máy nghi', () => {
  const walls = [wall('w-a'), wall('w-b'), wall('w-c', { reviewed: true }), wall('w-d'), wall('w-e')];
  const reasons: Readonly<Record<string, WallReviewReason>> = { 'w-b': 'dangling', 'w-d': 'uncertain', 'w-e': 'short', 'w-c': 'short' };
  const reasonOf = (item: Wall): WallReviewReason | null => reasons[item.id] ?? null;

  it('chưa duyệt xếp theo thứ tự lý do (chưa chắc → ngắn → không nối), đoạn không lý do sau, đã duyệt cuối', () => {
    expect(sortByReviewQueue(walls, undefined, undefined, reasonOf).map((item) => item.id)).toEqual(['w-d', 'w-e', 'w-b', 'w-a', 'w-c']);
  });

  it('không truyền lý do: giữ thứ tự hàng đợi cũ (bố cục cũ không đổi)', () => {
    expect(sortByReviewQueue(walls).map((item) => item.id)).toEqual(['w-a', 'w-b', 'w-d', 'w-e', 'w-c']);
  });

  it('hàng mang lý do khi có, không mang khoá reason khi không chia theo lý do', () => {
    expect(rowExtraOf(walls[1]!, null, undefined, undefined, 'dangling').reason).toBe('dangling');
    expect('reason' in rowExtraOf(walls[1]!, null)).toBe(false);
  });
});
