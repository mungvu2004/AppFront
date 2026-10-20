import { describe, expect, it } from 'vitest';

import type { Furniture, FurnitureKind, FurnitureVariant } from '@/domain/spatial/types';
import { degrees, millimetres } from '@/domain/units/types';

import { SCENE_STYLES, type SceneStyle } from '../sceneStyles';
import { modelFolderOf, roleOf } from '../sceneVariety';

type Item = Parameters<typeof modelFolderOf>[0];

const item = (
  id: string,
  kind: FurnitureKind,
  wMm: number,
  dMm: number,
  extra: { roomId?: string; variant?: FurnitureVariant; heightMm?: number } = {},
): Item => ({
  id: `F-${id}`,
  kind,
  boundingBox: { min: { x: millimetres(0), y: millimetres(0) }, max: { x: millimetres(wMm), y: millimetres(dMm) } },
  rotationDeg: degrees(0),
  ...(extra.roomId === undefined ? {} : { roomId: extra.roomId as NonNullable<Furniture['roomId']> }),
  ...(extra.variant === undefined ? {} : { variant: extra.variant }),
  ...(extra.heightMm === undefined ? {} : { heightMm: millimetres(extra.heightMm) }),
});

const AM_AP = SCENE_STYLES['am-ap'];
const withPrefer = (prefer: SceneStyle['prefer']): SceneStyle => ({ ...AM_AP, prefer });

describe('sceneVariety (J7)', () => {
  it('tất định: chạy hai lần, đảo thứ tự → cùng kết quả', () => {
    const items = [
      item('A1', 'other', 600, 600, { roomId: 'R-1' }),
      item('A2', 'other', 700, 800, { roomId: 'R-1' }),
      item('A3', 'other', 2000, 1500, { roomId: 'R-1', heightMm: 20 }),
      item('A4', 'chair', 450, 450, { roomId: 'R-2' }),
      item('A5', 'table', 1400, 700, { roomId: 'R-2' }),
    ];
    for (const style of Object.values(SCENE_STYLES)) {
      const once = new Map(items.map((f) => [f.id, modelFolderOf(f, style)]));
      const again = new Map([...items].reverse().map((f) => [f.id, modelFolderOf(f, style)]));
      expect(again).toEqual(once);
    }
  });

  it('cùng phòng + cùng vai trò → cùng mô hình', () => {
    const style = withPrefer({ diningChair: ['dining-chair', 'stool', 'office-chair'] });
    const chairs = ['C1', 'C2', 'C3', 'C4'].map((id) => item(id, 'chair', 500, 520, { roomId: 'R-9' }));
    expect(new Set(chairs.map((f) => modelFolderOf(f, style))).size).toBe(1);
  });

  it('ghế 0,45 × 0,45 trong phòng ngủ không thành sofa', () => {
    const chair = item('B1', 'chair', 450, 450, { roomId: 'R-bed' });
    expect(roleOf(chair)).toBe('diningChair');
    for (const style of Object.values(SCENE_STYLES)) expect(modelFolderOf(chair, style)).not.toBe('sofa');
  });

  it('lọc fill ≥ 0,6: ưu tiên không vừa hộp thì bỏ', () => {
    // Thảm dài 3 × 0,8 m: thảm tròn 1,99 × 1,99 có fill ≈ 0,4 → không được chọn.
    const runner = item('R1', 'other', 3000, 800, { heightMm: 20 });
    expect(roleOf(runner)).toBe('rug');
    expect(modelFolderOf(runner, withPrefer({ rug: ['round-carpet'] }))).toBe('rectangular-carpet');
    // Thảm vuông 2 × 2: ưu tiên tròn vừa → chọn.
    expect(modelFolderOf(item('R2', 'other', 2000, 2000, { heightMm: 20 }), withPrefer({ roundRug: ['round-carpet'] }))).toBe(
      'round-carpet',
    );
  });

  it('không ưu tiên: giữ mô hình mặc định nếu nó vừa', () => {
    expect(modelFolderOf(item('D1', 'chair', 450, 450), withPrefer({}))).toBe('dining-chair');
  });

  it("variant 'wc' → toilet; stair → null", () => {
    expect(modelFolderOf(item('W1', 'sanitaryFixture', 400, 700, { variant: 'wc' }), AM_AP)).toBe('toilet');
    expect(modelFolderOf(item('S1', 'stair', 1000, 3000), AM_AP)).toBeNull();
  });

  it('variant: phong cách chỉ đổi khi có mô hình cùng vai trò vừa hộp', () => {
    // fill so dáng (tỉ lệ cạnh), không so cỡ: hộp 0,7 × 0,8 vừa cả cây nhỏ (0,4 × 0,38).
    const plant = item('P1', 'other', 700, 800, { variant: 'plant' });
    expect(modelFolderOf(plant, withPrefer({}))).toBe('indoor-plant');
    expect(modelFolderOf(plant, withPrefer({ plant: ['small-indoor-plant'] }))).toBe('small-indoor-plant');
    // Hộp dẹt 0,4 × 1,2: cây nhỏ fill ≈ 0,35 → giữ mô hình của variant.
    const slim = item('P2', 'other', 400, 1200, { variant: 'plant' });
    expect(modelFolderOf(slim, withPrefer({ plant: ['small-indoor-plant'] }))).toBe('indoor-plant');
  });
});
