/**
 * W3b — đồ đạc giữ màu (khe), mẫu, độ cao và độ nâng sửa trong Pascal; đọc lại ra đúng
 * cảnh ấy, và cảnh không ai đụng thì không có lệnh nào.
 */

import { describe, expect, it } from 'vitest';

import { SpatialGraphDocumentSchema } from '@/api/schemas/spatialGraph';
import { normalizeSpatial } from '@/domain/spatial/normalize';
import type { Furniture, SpatialGraph } from '@/domain/spatial/types';

import { fixtureF1 } from '../__fixtures__';
import { createPascalEditCommand } from '../fromPascal';
import { toPascalScene } from '../toPascal';
import { adoptableRoomOf } from '../toSpatial';
import type { PascalItemNode, PascalNode, PascalScene } from '../types';

const graph: SpatialGraph = SpatialGraphDocumentSchema.parse(fixtureF1({ ext: true }).doc).graph;
const sceneOf = (of: SpatialGraph): PascalScene => toPascalScene(of).scene;
const items = (of: PascalScene): PascalItemNode[] =>
  Object.values(of.nodes).filter((node): node is PascalItemNode => node.type === 'item');

// Món đồ thật có mô hình catalog (có khe phong cách để sơn đè).
const item = graph.furniture.find(
  (candidate) => Object.keys((sceneOf(graph).nodes[`item_${candidate.id}`] as PascalItemNode | undefined)?.slots ?? {}).length > 0,
) as Furniture;
const nodeId = `item_${item.id}`;
const GLASS = 'library:preset-glass';

const edit = (of: PascalScene, id: string, patch: (node: PascalItemNode) => Partial<PascalItemNode>): PascalScene => {
  const node = of.nodes[id] as PascalItemNode;

  return { ...of, nodes: { ...of.nodes, [id]: { ...node, ...patch(node) } as PascalNode } };
};

const commit = (of: SpatialGraph, scene: PascalScene, ...ids: string[]) =>
  createPascalEditCommand({
    graph: normalizeSpatial(of),
    scene,
    commit: { origin: 'local', changedNodeIds: ids },
    actorId: 'U-1',
  });

const afterOf = (result: ReturnType<typeof commit>): Furniture => {
  if (!result.ok) throw new Error(result.error.reasons.join(' '));
  expect(result.data.changes).toHaveLength(1);

  return result.data.changes[0]?.after as Furniture;
};

const withItem = (next: Furniture): SpatialGraph => ({
  ...graph,
  furniture: graph.furniture.map((candidate) => (candidate.id === next.id ? next : candidate)),
});

/** Lưu xong nạp lại: cảnh mới đọc ngược ra không có lệnh. */
const expectStable = (saved: Furniture): PascalScene => {
  const reloaded = sceneOf(withItem(saved));
  const again = commit(withItem(saved), reloaded, nodeId);

  expect(again.ok ? 'ok' : again.error.code).toBe('PASCAL_NO_CHANGE');

  return reloaded;
};

describe('W3b — đồ đạc giữ khe, mẫu, độ cao', () => {
  it('cảnh không đụng tới: không có lệnh', () => {
    const result = commit(graph, sceneOf(graph), ...items(sceneOf(graph)).map((node) => node.id));

    expect(result.ok ? 'ok' : result.error.code).toBe('PASCAL_NO_CHANGE');
  });

  it('sơn một khe: chỉ khe khác phong cách vào `slots`, nạp lại giữ màu', () => {
    const key = Object.keys((sceneOf(graph).nodes[nodeId] as PascalItemNode).slots ?? {})[0] as string;
    const after = afterOf(commit(graph, edit(sceneOf(graph), nodeId, (node) => ({ slots: { ...node.slots, [key]: GLASS } })), nodeId));

    expect(after.slots).toEqual({ [key]: GLASS });
    expect((expectStable(after).nodes[nodeId] as PascalItemNode).slots?.[key]).toBe(GLASS);
  });

  it('màu tự pha (scene.materials) chưa lưu được: không có lệnh', () => {
    const key = Object.keys((sceneOf(graph).nodes[nodeId] as PascalItemNode).slots ?? {})[0] as string;
    const result = commit(
      graph,
      edit(sceneOf(graph), nodeId, (node) => ({ slots: { ...node.slots, [key]: 'scene:mat_user_pink' } })),
      nodeId,
    );

    expect(result.ok ? 'ok' : result.error.code).toBe('PASCAL_NO_CHANGE');
  });

  it('thay mẫu `/items/…`: ghi `model`, nạp lại dùng đúng mẫu ấy; src lạ thì không lưu', () => {
    const model = { id: 'dining-chair', src: '/items/dining-chair/model.glb' };
    const after = afterOf(
      commit(graph, edit(sceneOf(graph), nodeId, (node) => ({ asset: { ...node.asset, ...model } })), nodeId),
    );

    expect(after.model).toEqual(model);
    expect((expectStable(after).nodes[nodeId] as PascalItemNode).asset).toMatchObject(model);

    const odd = commit(
      graph,
      edit(sceneOf(graph), nodeId, (node) => ({ asset: { ...node.asset, id: 'x', src: 'https://evil/x.glb' } })),
      nodeId,
    );

    expect(odd.ok ? 'ok' : odd.error.code).toBe('PASCAL_NO_CHANGE');
  });

  it('kéo cao (scale y) → `heightMm`, nâng (position y) → `liftMm`; nạp lại ổn định', () => {
    const node = sceneOf(graph).nodes[nodeId] as PascalItemNode;
    const after = afterOf(
      commit(
        graph,
        edit(sceneOf(graph), nodeId, (current) => ({
          scale: [1, 1.5, 1],
          position: [current.position[0], current.position[1] + 0.3, current.position[2]],
        })),
        nodeId,
      ),
    );

    expect(after.heightMm).toBe(Math.round(node.asset.dimensions[1] * 1.5 * 1000));
    expect(after.liftMm).toBe(Math.round((node.position[1] + 0.3) * 1000));
    expectStable(after);
  });

  it('xoay riêng một món bày biện sinh ra cũng nhận nuôi, mang `variant`/`heightMm` của nó', () => {
    const scene = sceneOf(graph);
    const dress = items(scene).find((node) => adoptableRoomOf(node) !== null) as PascalItemNode;
    const result = commit(
      graph,
      edit(scene, dress.id, (node) => ({ rotation: [0, node.rotation[1] + Math.PI / 2, 0] })),
      dress.id,
    );

    if (!result.ok) throw new Error(result.error.reasons.join(' '));

    const fields = dress.metadata?.appfront?.fields ?? {};
    const adopted = result.data.changes.map((change) => change.after as Furniture);
    const same = adopted.find((candidate) => candidate.centre.x === Math.round(dress.position[0] * 1000));

    expect(adopted.every((candidate) => candidate.id.startsWith('F-'))).toBe(true);
    expect(same?.variant).toBe(fields['variant']);
    expect(same?.heightMm).toBe(fields['heightMm']);
  });
});
