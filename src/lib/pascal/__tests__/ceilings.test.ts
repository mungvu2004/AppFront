import { describe, expect, it } from 'vitest';

import { SpatialGraphDocumentSchema } from '@/api/schemas/spatialGraph';
import { normalizeSpatial } from '@/domain/spatial/normalize';

import { fixtureF1 } from '../__fixtures__';
import { createPascalEditCommand } from '../fromPascal';
import { toPascalId } from '../ids';
import { isGeneratedLightId, LIGHT_COLOR, LIGHT_DISTANCE_M, LIGHT_INTENSITY_MAX } from '../sceneDressing';
import { toPascalScene } from '../toPascal';
import { toSpatialGraph } from '../toSpatial';
import type { PascalCeilingNode, PascalItemNode, PascalNode, PascalScene } from '../types';

const graph = SpatialGraphDocumentSchema.parse(fixtureF1({ ext: true }).doc).graph;
const { scene, skipped } = toPascalScene(graph);
const nodes = Object.values(scene.nodes);
const ceilings = nodes.filter((node): node is PascalCeilingNode => node.type === 'ceiling');
const lights = nodes.filter((node): node is PascalItemNode => node.type === 'item' && isGeneratedLightId(node.id));

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
  it('F1-ext: mỗi phòng một trần con của tầng, theo đỉnh tầng, mặt vữa', () => {
    expect(graph.rooms).toHaveLength(9);
    expect(ceilings).toHaveLength(9);
    expect(skipped).toEqual([]);

    for (const room of graph.rooms) {
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
    expect(lights).toHaveLength(9);

    for (const light of lights) {
      const ceiling = scene.nodes[light.parentId ?? ''] as PascalCeilingNode;
      const xs = ceiling.polygon.map((point) => point[0]);

      expect(ceiling.type).toBe('ceiling');
      expect(ceiling.children).toEqual([light.id]);
      expect(light.position[1]).toBe(0);
      expect(light.position[0]).toBeGreaterThanOrEqual(Math.min(...xs));
      expect(light.position[0]).toBeLessThanOrEqual(Math.max(...xs));
      expect(light.asset).toMatchObject({
        src: '/items/recessed-light/model.glb',
        attachTo: 'ceiling',
        recessed: true,
        scale: [1, 1, 1],
      });

      const { controls, effects } = light.asset.interactive as {
        controls: { kind: string; default?: unknown }[];
        effects: { kind: string }[];
      };

      expect(controls.find((control) => control.kind === 'toggle')?.default).toBe(true);
      expect(effects[0]).toMatchObject({
        kind: 'light',
        color: LIGHT_COLOR,
        intensityRange: [0, LIGHT_INTENSITY_MAX],
        distance: LIGHT_DISTANCE_M,
      });
    }
  });

  it('lượt về: đồ thị đọc ngược y hệt khi chưa có trần/đèn', () => {
    const before = toSpatialGraph(withoutCeilings(scene));
    const after = toSpatialGraph(scene);

    expect(after.graph).toEqual(before.graph);
    expect(after.skipped).toEqual(before.skipped);
    expect(after.graph.furniture).toHaveLength(graph.furniture.length);
  });

  it('sửa hoặc xoá chỉ một đèn/trần sinh ra: không có lệnh nào cho bản vẽ', () => {
    const light = lights[0]!;
    const ceiling = scene.nodes[light.parentId ?? ''] as PascalCeilingNode;
    const normalized = normalizeSpatial(graph);
    const moved: PascalScene = {
      ...scene,
      nodes: { ...scene.nodes, [light.id]: { ...light, position: [0, 0, 0] } },
    };
    const deleted: Record<string, PascalNode> = { ...scene.nodes };
    delete deleted[light.id];

    for (const [edited, changedNodeIds] of [
      [moved, [light.id]],
      [{ ...scene, nodes: deleted }, [light.id, ceiling.id]],
    ] as const) {
      const result = createPascalEditCommand({
        graph: normalized,
        scene: edited,
        commit: { origin: 'local', changedNodeIds },
        actorId: 'U-1',
      });

      expect(result.ok ? null : result.error.code).toBe('PASCAL_NO_CHANGE');
    }
  });
});
