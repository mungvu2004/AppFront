/**
 * Tìm kiếm và chip của thư viện đồ đạc Pascal chạy trên catalog THẬT (QA-05c E1-B26:
 * 23F-A-010, 23F-A-015, 23F-A-016, 23F-A-031). Bài `bun:test` của vendor chỉ dùng chín mẫu
 * tự dựng, nên không thấy được lỗi do dữ liệu: tên tiếng Anh, chip sofa rỗng, "bàn" khớp "urban".
 */

import { describe, expect, it } from 'vitest';

import {
  filterFurnitureItems,
  furnitureGroupCounts,
} from '../../../../vendor/pascal/packages/editor/src/components/ui/item-catalog/catalog-filter';
import { CATALOG_ITEMS } from '../../../../vendor/pascal/packages/editor/src/components/ui/item-catalog/catalog-items';

const namesFor = (search: string, group: Parameters<typeof filterFurnitureItems>[1] = {}): string[] =>
  filterFurnitureItems(CATALOG_ITEMS, { ...group, search }).map((item) => item.name);

describe('thư viện đồ đạc Pascal — tìm theo tiếng Việt', () => {
  it('23F-A-031: tên thẻ là tiếng Việt', () => {
    const names = CATALOG_ITEMS.map((item) => item.name);

    expect(names).toContain('Ghế ăn');
    expect(names).toContain('Bàn ăn');
    expect(names).not.toContain('Dining Chair');
  });

  it('23F-A-010: chip "Ghế sofa" có mẫu Sofa', () => {
    expect(furnitureGroupCounts(CATALOG_ITEMS).sofa).toBeGreaterThan(0);
    expect(namesFor('', { group: 'sofa' })).toContain('Ghế sofa');
  });

  it('23F-A-015: "ghế" và "ghe" ra các ghế', () => {
    expect(namesFor('ghế')).toContain('Ghế văn phòng');
    expect(namesFor('ghe')).toEqual(namesFor('ghế'));
  });

  it('23F-A-016: "bàn" ra bàn, không ra "Parking Spot"/"Scooter" (tag "urban")', () => {
    const tables = namesFor('bàn');

    expect(tables).toContain('Bàn ăn');
    expect(tables).not.toContain('Chỗ đỗ xe');
    expect(tables).not.toContain('Xe trượt scooter');
    expect(namesFor('ban')).not.toContain('Chỗ đỗ xe');
  });

  it('từ khoá tiếng Anh trong tag vẫn tìm được ("chair")', () => {
    expect(namesFor('chair')).toContain('Ghế ăn');
  });
});
