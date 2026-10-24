import { describe, expect, it } from 'vitest';

import { SpatialGraphDocumentSchema } from '@/api/schemas/spatialGraph';
import { degrees, millimetres } from '@/domain/units/types';

import { houseModelSpatial } from '../__fixtures__/houseModelSpatial';
import { SCENE_STYLES } from '../sceneStyles';
import { modelFolderOf } from '../sceneVariety';
import { toPascalScene } from '../toPascal';

const hob = (heightMm?: number): Parameters<typeof modelFolderOf>[0] => ({
  id: 'F-HOB' as Parameters<typeof modelFolderOf>[0]['id'],
  kind: 'kitchenCabinet' as const,
  variant: 'hob' as const,
  boundingBox: { min: { x: millimetres(0), y: millimetres(0) }, max: { x: millimetres(600), y: millimetres(500) } },
  rotationDeg: degrees(0),
  ...(heightMm === undefined ? {} : { heightMm: millimetres(heightMm) }),
});

describe('mặt bếp mỏng', () => {
  it('hob < 300 mm → hob-sf; hob cao hoặc không có heightMm → stove', () => {
    const style = SCENE_STYLES['am-ap'];
    expect(modelFolderOf(hob(20), style, 'kitchen')).toBe('hob-sf');
    expect(modelFolderOf(hob(850), style, 'kitchen')).toBe('stove');
    expect(modelFolderOf(hob(), style, 'kitchen')).toBe('stove');
  });

  it('F1: bếp 20 mm (F-KITCHEN-HOB) là hob-sf nằm trên mặt đá tủ bếp, giữ cao thật của mẫu', () => {
    const { scene } = toPascalScene(SpatialGraphDocumentSchema.parse(houseModelSpatial({ ext: true })).graph);
    const items = Object.values(scene.nodes).filter((n) => n.type === 'item');
    const node = items.find((n) => n.asset.src === '/items/hob-sf/model.glb');
    const counter = items.find((n) => n.asset.src === '/items/kitchen-cabinet/model.glb');
    // Tủ dưới cao 900 mm, mặt đá ở 0,9/1,09 của mẫu.
    expect(node?.position[1]).toBeCloseTo((0.9 * 0.9) / 1.09, 3);
    expect(node?.asset.scale?.[1]).toBeGreaterThan(0.5);
    expect(counter?.position[1]).toBe(0);
  });

  it('F1: dãy tủ có chậu 20 mm (F-KITCHEN-SINK) dựng thành dãy bếp có chậu, các dãy khác vẫn tủ thường', () => {
    const { scene } = toPascalScene(SpatialGraphDocumentSchema.parse(houseModelSpatial({ ext: true })).graph);
    const srcs = Object.values(scene.nodes).flatMap((n) => (n.type === 'item' ? [n.asset.src] : []));
    // Dãy tủ chân L chứa tâm chậu + chính món chậu mỏng (khuất trong tủ) đều là `kitchen`.
    expect(srcs.filter((s) => s === '/items/kitchen/model.glb')).toHaveLength(2);
    expect(srcs.filter((s) => s === '/items/kitchen-cabinet/model.glb').length).toBeGreaterThan(0);
  });
});
