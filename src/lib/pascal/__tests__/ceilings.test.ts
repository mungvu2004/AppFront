import { describe, expect, it } from 'vitest';

import { SpatialGraphDocumentSchema } from '@/api/schemas/spatialGraph';
import { normalizeSpatial } from '@/domain/spatial/normalize';

import { fixtureF1 } from '../__fixtures__';
import { createPascalEditCommand } from '../fromPascal';
import { toPascalId } from '../ids';
import {
  ceilingNodesOf,
  interiorPointOf,
  isGeneratedLightId,
  LIGHT_DISTANCE_M,
  LIGHT_MESH_SCALE,
  LIGHT_NODE_SCALE,
} from '../sceneDressing';
import { SCENE_STYLES, sceneStyleOf } from '../sceneStyles';
import { toPascalScene } from '../toPascal';
import { toSpatialGraph } from '../toSpatial';
import type { PascalCeilingNode, PascalItemNode, PascalNode, PascalPoint2, PascalScene } from '../types';

const graph = SpatialGraphDocumentSchema.parse(fixtureF1({ ext: true }).doc).graph;
const { scene, skipped } = toPascalScene(graph);
const nodes = Object.values(scene.nodes);
const ceilings = nodes.filter((node): node is PascalCeilingNode => node.type === 'ceiling');
const lights = nodes.filter((node): node is PascalItemNode => node.type === 'item' && isGeneratedLightId(node.id));

/** Chẵn-lẻ: điểm nằm hẳn trong đa giác. */
const isInside = ([x, y]: PascalPoint2, polygon: readonly PascalPoint2[]): boolean =>
  polygon.reduce((inside, [x1, y1], i) => {
    const [x2, y2] = polygon[(i + 1) % polygon.length]!;
    return y1 <= y === y2 <= y || x >= x1 + ((y - y1) * (x2 - x1)) / (y2 - y1) ? inside : !inside;
  }, false);

/** Cảnh như trước T16: bỏ trần, đèn và id trần trong `children` của tầng. */
const withoutCeilings = (source: PascalScene): PascalScene => {
  const generated = new Set([...ceilings, ...lights].map((node) => node.id));
  const kept: Record<string, PascalNode> = {};

  for (const node of Object.values(source.nodes)) {
    if (generated.has(node.id)) continue;
    kept[node.id] =
      node.type === 'level' ? { ...node, children: node.children.filter((id) => !generated.has(id)) } : node;
  }

  return { ...source, nodes: kept };
};

describe('trần + đèn (T16)', () => {
  it('F1-ext: mỗi phòng trong nhà một trần con của tầng, theo đỉnh tầng, mặt vữa; sân decking không trần', () => {
    const indoor = graph.rooms.filter((room) => room.finish !== 'decking');

    expect(graph.rooms).toHaveLength(9);
    expect(indoor).toHaveLength(8);
    expect(ceilings).toHaveLength(8);
    expect(skipped).toEqual([]);

    for (const room of graph.rooms.filter((r) => r.finish === 'decking')) {
      expect(scene.nodes[toPascalId('ceiling', room.id)]).toBeUndefined();
      expect(scene.nodes[toPascalId('item', `LIGHT-${room.id}`)]).toBeUndefined();
    }

    for (const room of indoor) {
      const ceiling = scene.nodes[toPascalId('ceiling', room.id)] as PascalCeilingNode;
      const level = scene.nodes[ceiling.parentId ?? ''];

      expect(level?.type).toBe('level');
      expect(level !== undefined && 'children' in level ? level.children : []).toContain(ceiling.id);
      expect(ceiling.polygon).toHaveLength(room.outline.length);
      expect(ceiling).not.toHaveProperty('height');
      expect(ceiling).toMatchObject({ holes: [], holeMetadata: [], autoFromWalls: false });
      expect(ceiling.slots).toEqual({ surface: 'scene:mat_appfront_plaster' });
    }
  });

  it('F1-ext: một đèn âm trần bật sẵn dưới mỗi trần, mô hình thật', () => {
    expect(lights).toHaveLength(8);

    for (const light of lights) {
      const ceiling = scene.nodes[light.parentId ?? ''] as PascalCeilingNode;

      expect(ceiling.type).toBe('ceiling');
      expect(ceiling.children).toEqual([light.id]);
      expect(light.position[1]).toBe(0);
      // Vỏ đèn thu còn 1% để không hiện cung trắng; ánh sáng (độ sáng/tầm bên dưới) giữ nguyên.
      expect(light.scale).toEqual(LIGHT_NODE_SCALE);
      expect(LIGHT_NODE_SCALE).toEqual([0.01, 0.01, 0.01]);
      expect(isInside([light.position[0], light.position[2]], ceiling.polygon), light.id).toBe(true);
      expect(light.asset).toMatchObject({
        src: '/items/recessed-light/model.glb',
        attachTo: 'ceiling',
        recessed: true,
        // C1: đèn là nguồn sáng, không phải món — lưới GLB co thêm để không hiện.
        scale: LIGHT_MESH_SCALE,
      });

      const { controls, effects } = light.asset.interactive as {
        controls: { kind: string; default?: unknown }[];
        effects: { kind: string }[];
      };

      expect(controls.find((control) => control.kind === 'toggle')?.default).toBe(true);
      expect(effects[0]).toMatchObject({
        kind: 'light',
        color: sceneStyleOf(undefined).lampColour,
        intensityRange: [0, sceneStyleOf(undefined).lampIntensity],
        distance: LIGHT_DISTANCE_M,
      });
    }
  });

  it('màu + cường độ đèn theo phong cách, trần vẫn vữa', () => {
    const room = graph.rooms.find((r) => r.finish !== 'decking')!;
    const style = SCENE_STYLES['hien-dai-sang'];
    const [ceiling, light] = ceilingNodesOf(room, 'level_L-AAAA000001', style)!;
    const [effect] = (light.asset.interactive as { effects: object[] }).effects;

    expect(effect).toMatchObject({ color: style.lampColour, intensityRange: [0, style.lampIntensity] });
    expect(ceiling.slots).toEqual({ surface: 'scene:mat_appfront_plaster' });
  });

  it('đèn luôn trong phòng: trọng tâm nằm ngoài chữ L thì lấy giữa đoạn trong dài nhất', () => {
    const square: PascalPoint2[] = [[0, 0], [4, 0], [4, 2], [0, 2]];
    const thinL: PascalPoint2[] = [[0, 0], [10, 0], [10, 1], [1, 1], [1, 10], [0, 10]];

    expect(interiorPointOf(square)).toEqual([2, 1]);
    expect(isInside(interiorPointOf(thinL), thinL)).toBe(true);
    expect(isInside(interiorPointOf([...thinL].reverse()), thinL)).toBe(true);
  });

  it('lượt về: đồ thị đọc ngược y hệt khi chưa có trần/đèn', () => {
    const before = toSpatialGraph(withoutCeilings(scene));
    const after = toSpatialGraph(scene);

    expect(after.graph).toEqual(before.graph);
    expect(after.skipped).toEqual(before.skipped);
    expect(after.graph.furniture).toHaveLength(graph.furniture.length);
  });

  it('xoá chỉ một đèn sinh ra: chỉ phòng của nó đổi (`dressingOff`), không có đồ đạc nào', () => {
    const light = lights[0]!;
    const ceiling = scene.nodes[light.parentId ?? ''] as PascalCeilingNode;
    const normalized = normalizeSpatial(graph);
    const deleted: Record<string, PascalNode> = { ...scene.nodes };
    delete deleted[light.id];

    const result = createPascalEditCommand({
      graph: normalized,
      scene: { ...scene, nodes: deleted },
      commit: { origin: 'local', changedNodeIds: [light.id, ceiling.id] },
      actorId: 'U-1',
    });

    expect(result.ok ? result.data.changes.map((change) => change.kind) : result.error.code).toEqual(['room']);
  });
});
