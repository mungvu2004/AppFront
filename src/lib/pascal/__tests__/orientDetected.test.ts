/** @vitest-environment node */
/**
 * Số lấy từ ui-review/open-plan-20261101/spatial.json (mặt bằng mở: bàn ăn, quầy bar, sofa).
 */

import { describe, expect, it } from 'vitest';

import type { Furniture, FurnitureId, LevelId, Wall, WallId } from '@/domain/spatial/types';
import { degrees, millimetres } from '@/domain/units/types';

import { orientDetectedFurniture } from '../orientDetected';

const LEVEL = 'L-1' as LevelId;

const item = (id: string, kind: Furniture['kind'], x: number, y: number, w: number, d: number, extra: Partial<Furniture> = {}): Furniture => ({
  id: `F-${id}` as FurnitureId,
  levelId: LEVEL,
  kind,
  centre: { x, y },
  boundingBox: { min: { x: x - w / 2, y: y - d / 2 }, max: { x: x + w / 2, y: y + d / 2 } },
  rotationDeg: degrees(0),
  confidence: 1,
  source: 'ai',
  reviewed: false,
  ...extra,
} as Furniture);

const wall = (id: string, x0: number, y0: number, x1: number, y1: number): Wall =>
  ({
    id: `W-${id}` as WallId,
    levelId: LEVEL,
    centreline: { start: { x: x0, y: y0 }, end: { x: x1, y: y1 } },
    thicknessMm: millimetres(150),
    heightMm: millimetres(3000),
    kind: 'envelope',
    openingIds: [],
    confidence: 1,
    source: 'ai',
    reviewed: false,
  }) as Wall;

const WALLS = [
  wall('left', 960, 2362, 960, 6247),
  wall('top', 960, 2362, 6615, 2362),
  wall('bottom', 2978, 10508, 6615, 10508),
  wall('right', 6615, 2362, 6615, 10508),
];

const FURNITURE = [
  item('table', 'table', 5355, 5251, 855, 1515),
  item('chairTop', 'chair', 5355, 4366, 438, 288),
  item('chairRight', 'chair', 5921, 4976, 280, 431),
  item('chairLeft', 'chair', 4793, 4975, 287, 421),
  item('chairBottom', 'chair', 5365, 6129, 418, 281),
  item('bar', 'kitchenCabinet', 2454, 5148, 2809, 1963),
  item('stool', 'chair', 3603, 4563, 322, 423),
  item('armchair', 'chair', 4903, 7336, 853, 827),
  item('sofa', 'chair', 4260, 8703, 662, 1878, { variant: 'sofa' }),
  item('coffee', 'table', 5277, 8690, 577, 1073),
  item('loveseat', 'chair', 5302, 10030, 1372, 706),
];

const byId = (list: readonly Furniture[]) => new Map(list.map((f) => [f.id.slice(2), f]));

describe('orientDetectedFurniture', () => {
  const out = byId(orientDetectedFurniture(FURNITURE, WALLS));
  const deg = (id: string) => out.get(id)?.rotationDeg;

  it('ghế bàn ăn quay vào bàn (quy ước +y riêng = mặt trước)', () => {
    expect(deg('chairTop')).toBe(0);
    expect(deg('chairBottom')).toBe(180);
    expect(deg('chairRight')).toBe(90);
    expect(deg('chairLeft')).toBe(270);
  });

  it('ghế quầy quay vào quầy, sofa và ghế bành quay vào bàn trà, ghế đôi lưng tựa tường dưới', () => {
    expect(deg('stool')).toBe(90);
    expect(deg('sofa')).toBe(270);
    expect(deg('armchair')).toBe(0);
    expect(deg('loveseat')).toBe(180);
  });

  it('quay 90° đổi chỗ hai cạnh hộp riêng quanh tâm; 0°/180° giữ hộp', () => {
    expect(out.get('chairRight')?.boundingBox).toEqual({ min: { x: 5921 - 215.5, y: 4976 - 140 }, max: { x: 5921 + 215.5, y: 4976 + 140 } });
    expect(out.get('chairBottom')?.boundingBox).toEqual(FURNITURE[4]?.boundingBox);
  });

  it('giữ thứ tự, id; không đụng bàn, tủ bếp', () => {
    const list = orientDetectedFurniture(FURNITURE, WALLS);
    expect(list.map((f) => f.id)).toEqual(FURNITURE.map((f) => f.id));
    expect(list[0]).toBe(FURNITURE[0]);
    expect(list[5]).toBe(FURNITURE[5]);
  });

  it('giường lưng tựa tường gần nhất, đầu giường vào tường', () => {
    const [bed] = orientDetectedFurniture([item('bed', 'bed', 960 + 75 + 50 + 1000, 4000, 2000, 1600)], WALLS);
    expect(bed?.rotationDeg).toBe(270);
  });

  it('món đã duyệt, đã xoay, hoặc của người vẽ thì để nguyên', () => {
    const reviewed = item('r', 'chair', 5921, 4976, 280, 431, { reviewed: true });
    const rotated = item('t', 'chair', 5921, 4976, 280, 431, { rotationDeg: degrees(45) });
    const manual = item('m', 'chair', 5921, 4976, 280, 431, { source: 'human' });
    const list = orientDetectedFurniture([FURNITURE[0] as Furniture, reviewed, rotated, manual], WALLS);
    expect(list[1]).toBe(reviewed);
    expect(list[2]).toBe(rotated);
    expect(list[3]).toBe(manual);
  });
});
