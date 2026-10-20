/**
 * Ghim quy ước xoay của đồ đạc (K1): `boundingBox` là khung **riêng, chưa
 * xoay** của món đồ, tâm ở `centre`; `rotationDeg` xoay khung đó quanh tâm.
 *
 * Một băng ghế 2000 × 600 xoay 90° sang Pascal phải giữ kích thước riêng
 * [2.0, h, 0.6] và góc yaw −π/2, rồi về lại đúng khung cũ và đúng 90° — không
 * được đổi thành khung 600 × 2000 bao quanh nó.
 */

import { describe, expect, it } from 'vitest';

import { createSampleBuilding } from '@/domain/spatial/__fixtures__/sampleBuilding';
import type { Furniture } from '@/domain/spatial/types';
import { degrees } from '@/domain/units/types';

import { toPascalScene } from '../toPascal';
import { toSpatialGraph } from '../toSpatial';

describe('quy ước xoay đồ đạc — khung riêng, chưa xoay', () => {
  const graph = createSampleBuilding();
  const first = graph.furniture[0] as Furniture;
  const bench: Furniture = {
    ...first,
    centre: { x: 3000, y: 2000 },
    boundingBox: { min: { x: 2000, y: 1700 }, max: { x: 4000, y: 2300 } },
    rotationDeg: degrees(90),
  };
  const turned = { ...graph, furniture: [bench, ...graph.furniture.slice(1)] };

  it('sang Pascal: kích thước riêng [rộng, cao, sâu] và yaw −π/2', () => {
    const { scene } = toPascalScene(turned);
    const node = Object.values(scene.nodes).find(
      (candidate) => candidate.type === 'item' && candidate.position[0] === 3 && candidate.position[2] === 2,
    );

    if (node?.type !== 'item') throw new Error('phải có node item của băng ghế');
    expect(node.asset.dimensions[0]).toBeCloseTo(2.0);
    expect(node.asset.dimensions[2]).toBeCloseTo(0.6);
    expect(node.rotation[1]).toBeCloseTo(-Math.PI / 2);
  });

  it('về lại: đúng khung cũ và rotationDeg 90', () => {
    const back = toSpatialGraph(toPascalScene(turned).scene).graph;
    const returned = back.furniture.find((item) => item.id === bench.id);

    expect(returned?.boundingBox).toEqual(bench.boundingBox);
    expect(returned?.centre).toEqual(bench.centre);
    expect(returned?.rotationDeg).toBe(90);
  });
});
