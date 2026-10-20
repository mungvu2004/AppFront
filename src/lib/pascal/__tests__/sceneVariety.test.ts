import { describe, expect, it } from 'vitest';

import { FURNITURE_VARIANTS } from '@/domain/spatial/types';
import type { Furniture, FurnitureKind, FurnitureVariant, RoomUsage } from '@/domain/spatial/types';
import { degrees, millimetres } from '@/domain/units/types';

import { SCENE_STYLES, type SceneStyle } from '../sceneStyles';
import { modelFolderOf, roleOf } from '../sceneVariety';
import { VARIANT_MODEL } from '../furnitureCatalog';

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

  it('bàn 900 × 600: bàn làm việc ở phòng ngủ/kho/khác/không rõ phòng, bàn ăn ở bếp/phòng khách', () => {
    const table = item('T1', 'table', 900, 600);
    for (const usage of [undefined, 'bedroom', 'utility', 'other'] as const) expect(roleOf(table, usage)).toBe('desk');
    for (const usage of ['kitchen', 'livingRoom'] as const) expect(roleOf(table, usage)).toBe('diningTable');
    expect(modelFolderOf(table, withPrefer({}), 'kitchen')).toBe('dining-table');
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

  // Kỳ vọng chép từ `furnitureModelOf` (toPascal.ts @31c7c66f, đang được U09 sửa nên không
  // import): chỉ `null` khi loại 'stair' và không có mô hình variant.
  const todayHasModel = (f: Item): boolean => (f.variant !== undefined && VARIANT_MODEL[f.variant] != null) || f.kind !== 'stair';

  it('không bao giờ null ở chỗ furnitureModelOf hôm nay có mô hình', () => {
    // Hộp điển hình cho từng loại; mọi variant (kể cả sconce/bench/vase không có mô hình).
    const typical: Readonly<Record<FurnitureKind, readonly (readonly [number, number, number?])[]>> = {
      bed: [[900, 2000], [1600, 2000]],
      wardrobe: [[600, 1200], [350, 900], [500, 1000, 800]],
      chair: [[450, 450], [800, 800], [900, 2100]],
      table: [[450, 450], [1200, 600, 400], [800, 1400], [1000, 2000]],
      kitchenCabinet: [[650, 700], [600, 2400]],
      sanitaryFixture: [[400, 700], [750, 1700], [900, 900], [500, 600]],
      other: [[2000, 1500, 20], [2000, 2000, 20], [900, 2100], [400, 400], [800, 900]],
      stair: [[1000, 3000]],
    };
    const usages: readonly (RoomUsage | undefined)[] = ['livingRoom', 'bedroom', 'kitchen', 'bathroom', undefined];
    const cases: Item[] = [];
    for (const [kind, boxes] of Object.entries(typical) as [FurnitureKind, (typeof typical)[FurnitureKind]][]) {
      for (const [w, d, h] of boxes) cases.push(item(`${kind}${w}x${d}`, kind, w, d, h === undefined ? {} : { heightMm: h }));
    }
    for (const variant of FURNITURE_VARIANTS) cases.push(item(`v-${variant}`, 'other', 600, 600, { variant }));
    for (const usage of usages) {
      for (const f of cases) {
        if (!todayHasModel(f)) continue;
        for (const style of Object.values(SCENE_STYLES)) {
          expect(modelFolderOf(f, style, usage), `${style.id} ${usage ?? '-'} ${f.id}`).not.toBeNull();
        }
      }
    }
  });

  it('variant không có mô hình đi đường hình hộp như hôm nay', () => {
    // sconce/vase → bbox loại 'other' nhỏ → cây nhỏ; bench 0,4 × 1,2 → cây (toPascal.ts hôm nay).
    expect(modelFolderOf(item('V1', 'other', 300, 200, { variant: 'sconce' }), AM_AP, 'bedroom')).toBe('small-indoor-plant');
    expect(modelFolderOf(item('V2', 'other', 300, 300, { variant: 'vase' }), AM_AP, 'livingRoom')).toBe('small-indoor-plant');
    expect(modelFolderOf(item('V3', 'other', 400, 1200, { variant: 'bench' }), withPrefer({}), 'bedroom')).toBe('indoor-plant');
  });

  it('sofa và bàn trà chỉ ở phòng khách', () => {
    const long = item('L1', 'chair', 900, 2100, { roomId: 'R-1' });
    const low = item('L2', 'table', 1200, 600, { roomId: 'R-1', heightMm: 400 });
    const longOther = item('L3', 'other', 900, 2100, { roomId: 'R-1' });
    expect(modelFolderOf(long, AM_AP, 'livingRoom')).toBe('sofa');
    expect(modelFolderOf(low, AM_AP, 'livingRoom')).toBe('coffee-table');
    expect(modelFolderOf(longOther, AM_AP, 'livingRoom')).toBe('sofa');
    for (const usage of ['bedroom', 'kitchen', undefined] as const) {
      for (const style of Object.values(SCENE_STYLES)) {
        expect(modelFolderOf(long, style, usage)).not.toBe('sofa');
        expect(modelFolderOf(longOther, style, usage)).not.toBe('sofa');
        expect(modelFolderOf(low, style, usage)).not.toBe('coffee-table');
      }
    }
  });

  it('tủ bếp không bao giờ là khối hộp trơn kitchen-counter: dãy ngắn = tủ có tay nắm, dãy dài = bếp có chậu', () => {
    const short = item('K1', 'kitchenCabinet', 1200, 600, { roomId: 'R-K' });
    const long = item('K2', 'kitchenCabinet', 2400, 600, { roomId: 'R-K' });
    for (const style of Object.values(SCENE_STYLES)) {
      for (const usage of ['kitchen', 'utility', undefined] as const) {
        expect(modelFolderOf(short, style, usage)).toBe('kitchen-cabinet');
        expect(modelFolderOf(long, style, usage)).toBe('kitchen');
      }
    }
    expect(modelFolderOf(item('K3', 'other', 600, 600, { variant: 'sink' }), AM_AP, 'kitchen')).toBe('kitchen');
    expect(modelFolderOf(item('K4', 'other', 600, 1200, { variant: 'baseRun' }), AM_AP, 'kitchen')).toBe('kitchen-cabinet');
  });
});
