import { readdirSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';

import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { create } from 'zustand';

import {
  fittedAsset,
  SWAP_GROUPS,
  swapCandidates,
  type SwapAsset,
  type SwapCatalogItem,
  SwapModelCard,
  type SwapModelStores,
} from '../SwapModelCard';

const read = (path: string) => readFileSync(resolve(process.cwd(), path), 'utf8');

const entry = (id: string, name: string, dimensions: [number, number, number], extra: Partial<SwapCatalogItem> = {}) => ({
  id,
  name,
  thumbnail: `/items/${id}/thumbnail.webp`,
  src: `/items/${id}/model.glb`,
  dimensions,
  offset: [0, 0, 0] as [number, number, number],
  rotation: [0, 0, 0] as [number, number, number],
  scale: [1, 1, 1] as [number, number, number],
  ...extra,
});

const CATALOG: SwapCatalogItem[] = [
  entry('sofa', 'Ghế sofa', [2.06, 0.74, 1.01]),
  entry('livingroom-chair', 'Ghế bành', [1.1, 0.75, 1.07], { offset: [0, 0.0001, 0.0053] }),
  entry('lounge-chair', 'Ghế thư giãn', [0.68, 1.03, 1.26]),
  entry('double-bed', 'Giường đôi', [1.52, 0.71, 2]),
  entry('single-bed', 'Giường đơn', [1.08, 0.6, 2.14]),
  entry('television', 'Ti vi', [1.62, 1.07, 0.38]),
];

/** Món đồ AppFront sinh ra (toPascal): id `appfront-<kind>`, mẫu `/items/<thư mục>/…`. */
const sofaAsset: SwapAsset = {
  id: 'appfront-sofa',
  category: 'sofa',
  name: 'Sofa',
  thumbnail: '/items/sofa/thumbnail.webp',
  src: '/items/sofa/model.glb',
  dimensions: [2.2, 0.8, 0.95],
  offset: [0, 0.01, 0.04],
  rotation: [0, 0, 0],
  scale: [1.07, 1.07, 1.07],
};

describe('swapCandidates', () => {
  it('cùng nhóm với mẫu đang dùng (tìm theo thư mục của src), giữ thứ tự nhóm', () => {
    expect(swapCandidates(sofaAsset, CATALOG).map((c) => c.id)).toEqual(['sofa', 'livingroom-chair', 'lounge-chair']);
    expect(swapCandidates({ ...sofaAsset, id: 'single-bed', src: '/items/single-bed/model.glb' }, CATALOG).map((c) => c.id)).toEqual([
      'double-bed',
      'single-bed',
    ]);
  });

  it('không có nhóm hoặc nhóm chỉ còn một mẫu cục bộ → []', () => {
    expect(swapCandidates({ ...sofaAsset, src: '/items/television/model.glb' }, CATALOG)).toEqual([]);
    expect(swapCandidates({ ...sofaAsset, src: 'asset://appfront/stair' }, CATALOG)).toEqual([]);
    expect(swapCandidates(sofaAsset, CATALOG.filter((c) => c.id === 'sofa'))).toEqual([]);
  });

  it('mọi id trong SWAP_GROUPS có trong catalog-items.tsx của vendor và có thư mục mẫu cục bộ', () => {
    const catalog = read('vendor/pascal/packages/editor/src/components/ui/item-catalog/catalog-items.tsx');
    const local = new Set(readdirSync(resolve(process.cwd(), 'vendor/pascal/assets/items')));
    for (const id of SWAP_GROUPS.flat()) {
      expect(catalog, id).toContain(`id: '${id}',`);
      const src = new RegExp(`id: '${id}',[\\s\\S]*?src:\\s*'[^']*/items/(?:system|users/[^/]+)/([^/]+)/model\\.glb'`).exec(catalog)?.[1];
      expect(local.has(src ?? ''), `${id} → ${src}`).toBe(true);
    }
  });
});

describe('fittedAsset', () => {
  it('giữ hộp ngang/sâu, cao theo catalog, id/src/ảnh của mẫu mới — lượt về thấy asset.id khác appfront-sofa', () => {
    const fitted = fittedAsset(sofaAsset, CATALOG[3]!); // giường đôi 1.52 × 2: lệch 1.447/0.475 > 1.8 → chặn
    const swapped = fittedAsset({ ...sofaAsset, dimensions: [1.6, 0.8, 1.9] }, CATALOG[3]!);

    expect(swapped).toMatchObject({ id: 'double-bed', category: 'sofa', name: 'Giường đôi', src: '/items/double-bed/model.glb' });
    expect(swapped.thumbnail).toBe('/items/double-bed/thumbnail.webp');
    expect(swapped.dimensions?.[0]).toBeCloseTo(1.6);
    expect(swapped.dimensions?.[1]).toBeCloseTo(0.71);
    expect(swapped.dimensions?.[2]).toBeCloseTo(1.9);
    expect(swapped.scale?.[0]).toBeCloseTo(1.6 / 1.52);
    expect(swapped.scale?.[1]).toBe(1);
    expect(swapped.scale?.[2]).toBeCloseTo(1.9 / 2);
    // Lệch quá MAX_STRETCH: trục dài bị chặn, mẫu nhỏ hơn hộp chứ không bị kéo méo.
    expect(fitted.scale?.[0]).toBeCloseTo((0.95 / 2) * 1.8);
    expect(fitted.scale?.[2]).toBeCloseTo(0.95 / 2);
  });

  it('nhân offset theo tỉ lệ và scale riêng của catalog; bỏ surface của mẫu cũ', () => {
    const fitted = fittedAsset({ ...sofaAsset, surface: { height: 0.4 } }, entry('palm', 'Cọ', [0.5, 4.5, 0.5], { offset: [0.1, 0.08, 0.2], scale: [0.37, 0.37, 0.37] }));
    expect(fitted.surface).toBeUndefined();
    expect(fitted.offset?.[1]).toBeCloseTo(0.08);
    expect(fitted.scale?.[1]).toBeCloseTo(0.37);
    expect((fitted.scale?.[0] ?? 0) / 0.37).toBeCloseTo((fitted.offset?.[0] ?? 0) / 0.1);
  });
});

interface Node {
  id: string;
  type: string;
  asset?: SwapAsset;
}

const storesWith = (nodes: Record<string, Node>, selectedIds: string[]) => {
  const scene = create<{ nodes: Record<string, Node>; updateNode(id: string, data: object): void }>()((set) => ({
    nodes,
    // eslint-disable-next-line local/no-direct-set -- store giả của Pascal (vendor), không phải store AppFront.
    updateNode: (id, data) => set((s) => ({ nodes: { ...s.nodes, [id]: { ...s.nodes[id]!, ...data } } })),
  }));
  const viewer = create<{ selection: { selectedIds: string[] } }>()(() => ({ selection: { selectedIds } }));
  return { scene, viewer, stores: { useScene: scene, useViewer: viewer } as unknown as SwapModelStores };
};

const NODES: Record<string, Node> = {
  item_a: { id: 'item_a', type: 'item', asset: sofaAsset },
  item_b: { id: 'item_b', type: 'item', asset: { ...sofaAsset, src: '/items/double-bed/model.glb' } },
  wall_a: { id: 'wall_a', type: 'wall' },
};

describe('SwapModelCard', () => {
  it('một item được chọn: liệt kê mẫu cùng nhóm (mẫu đang dùng được đánh dấu), bấm → updateNode với asset đã khớp', () => {
    const { scene, stores } = storesWith(NODES, ['item_a']);
    render(<SwapModelCard catalog={CATALOG} readOnly={false} stores={stores} />);

    const list = screen.getByRole('list', { name: 'Mẫu cùng loại' });
    expect([...list.querySelectorAll('button')].map((b) => b.textContent)).toEqual(['Ghế sofa', 'Ghế bành', 'Ghế thư giãn']);
    expect(screen.getByRole('button', { pressed: true }).textContent).toBe('Ghế sofa');
    expect(list.querySelector('img')?.getAttribute('src')).toBe('/pascal/items/sofa/thumbnail.webp');

    fireEvent.click(screen.getByRole('button', { name: 'Ghế bành' }));
    expect(scene.getState().nodes.item_a!.asset).toEqual(fittedAsset(sofaAsset, CATALOG[1]!));
    // Thẻ đọc lại node mới: mẫu đang dùng giờ là ghế bành.
    expect(screen.getByRole('button', { pressed: true }).textContent).toBe('Ghế bành');
  });

  it.each([
    ['không chọn gì', []],
    ['chọn hai item', ['item_a', 'item_b']],
    ['chọn một tường', ['wall_a']],
  ])('ẩn khi %s', (_label, ids) => {
    const { stores } = storesWith(NODES, ids);
    const { container } = render(<SwapModelCard catalog={CATALOG} readOnly={false} stores={stores} />);
    expect(container.innerHTML).toBe('');
  });

  it('ẩn ở chế độ chỉ đọc', () => {
    const { stores } = storesWith(NODES, ['item_a']);
    const { container } = render(<SwapModelCard catalog={CATALOG} readOnly stores={stores} />);
    expect(container.innerHTML).toBe('');
  });

  it('main.tsx gắn thẻ vào khe thanh trái với catalog và store thật', () => {
    expect(read('src/pascal-page/main.tsx')).toContain(
      '<SwapModelCard catalog={CATALOG_ITEMS} readOnly={readOnly} stores={{ useScene, useViewer }} />',
    );
  });
});
