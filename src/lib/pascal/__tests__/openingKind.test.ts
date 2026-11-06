/**
 * Đổi loại ô mở trên trang 3D: cửa đi ↔ cửa sổ giữ id AppFront, tâm, rộng; lượt về ra đúng ô mở cũ
 * với `kind`/cao/bệ mới, nguồn `human`.
 */
import { describe, expect, it } from 'vitest';

import { SpatialGraphDocumentSchema } from '@/api/schemas/spatialGraph';

import { fixtureF2 } from '../__fixtures__';
import { toPascalId } from '../ids';
import { isOpeningNode, switchOpeningKind, type PascalOpeningNode } from '../openingKind';
import { toPascalScene } from '../toPascal';
import { toSpatialGraph } from '../toSpatial';
import type { PascalNode, PascalScene } from '../types';

const graph = SpatialGraphDocumentSchema.parse(fixtureF2().doc).graph;
const scene = toPascalScene(graph).scene;
const door = graph.openings.find((o) => o.kind === 'door')!;
const doorNode = scene.nodes[toPascalId('door', door.id)] as PascalOpeningNode;

/** Thay node cũ bằng node mới trong cảnh, kể cả danh sách con của tường. */
const replaced = (from: PascalOpeningNode, to: PascalOpeningNode): PascalScene => {
  const nodes: Record<string, PascalNode> = { ...scene.nodes };
  delete nodes[from.id];
  nodes[to.id] = to as PascalNode;
  const wall = nodes[from.wallId] as PascalNode & { children: string[] };
  nodes[from.wallId] = { ...wall, children: wall.children.map((id) => (id === from.id ? to.id : id)) } as PascalNode;
  return { ...scene, nodes } as PascalScene;
};

describe('đổi loại ô mở', () => {
  it('cửa đi → cửa sổ: id mới cùng thân, giữ tâm/rộng/tường, bệ 900 cao 1400', () => {
    const win = switchOpeningKind(doorNode, 'window');
    expect(win.type).toBe('window');
    expect(win.id).toBe(toPascalId('window', door.id));
    expect(win.parentId).toBe(doorNode.parentId);
    expect(win.wallId).toBe(doorNode.wallId);
    expect(win.width).toBe(doorNode.width);
    expect(win.position[0]).toBe(doorNode.position[0]);
    expect(win.position[1]).toBeCloseTo(0.9 + 1.4 / 2);
    expect(win.metadata?.appfront?.source).toBe('human');
  });

  it('lượt về: cùng ô mở, đổi kind, cao, bệ', () => {
    const out = toSpatialGraph(replaced(doorNode, switchOpeningKind(doorNode, 'window'))).graph;
    const back = out.openings.find((o) => o.id === door.id);
    expect(back).toMatchObject({ kind: 'window', heightMm: 1400, sillHeightMm: 900, widthMm: door.widthMm, offsetMm: door.offsetMm, wallId: door.wallId });
    expect(out.openings).toHaveLength(graph.openings.length);
  });

  it('cửa sổ → cửa đi về bệ 0 cao 2100; cùng loại thì giữ nguyên', () => {
    const win = switchOpeningKind(doorNode, 'window');
    const again = switchOpeningKind(win, 'door');
    expect(again.type).toBe('door');
    expect(again.id).toBe(doorNode.id);
    expect(again.position[1]).toBeCloseTo(2.1 / 2);
    expect(switchOpeningKind(win, 'window')).toBe(win);
  });

  it('chỉ nhận cửa và cửa sổ', () => {
    expect(isOpeningNode(doorNode)).toBe(true);
    expect(isOpeningNode({ type: 'wall' })).toBe(false);
    expect(isOpeningNode(undefined)).toBe(false);
  });
});
