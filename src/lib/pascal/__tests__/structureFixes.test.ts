/**
 * FE3D-FIX-004 C3 — sửa hình dựng lúc đổi sang Pascal, chỉ cho hiển thị: thang dò nhầm ẩn đi
 * (V5), phòng `other` đoán công năng theo tên để bày đồ (V2), đầu tường gần nhau dồn một điểm
 * (V6), dãy tủ bếp chữ L thành hai nhánh (V1). Mọi thứ đều không ghi ngược về bản vẽ.
 */

import { describe, expect, it } from 'vitest';

import { createSampleBuilding } from '@/domain/spatial/__fixtures__/sampleBuilding';
import { normalizeSpatial } from '@/domain/spatial/normalize';
import type { Furniture, Room, SpatialGraph, Wall, WallId } from '@/domain/spatial/types';

import { createPascalEditCommand } from '../fromPascal';
import { furnishingUsageOf, isPlausibleStair, weldWallEnds } from '../structureFixes';
import { toPascalScene } from '../toPascal';
import { toSpatialGraph } from '../toSpatial';
import type { PascalItemNode, PascalNode } from '../types';

const boxOf = (cx: number, cy: number, w: number, d: number): Furniture['boundingBox'] => ({
  min: { x: cx - w / 2, y: cy - d / 2 },
  max: { x: cx + w / 2, y: cy + d / 2 },
});

const fieldsOf = (node: PascalNode | undefined) => node?.metadata?.appfront?.fields ?? {};

/** Lượt lưu khai `changedNodeIds` (Pascal khai cả cảnh ở lượt nạp đầu) → các thay đổi. */
const changesOf = (graph: SpatialGraph, changedNodeIds: readonly string[]) => {
  const { scene } = toPascalScene(graph);
  const result = createPascalEditCommand({
    graph: normalizeSpatial(graph),
    scene,
    commit: { origin: 'local', changedNodeIds },
    actorId: 'U-1',
  });
  return result.ok ? result.data.changes : [];
};

describe('V5 — thang quá nhỏ là ký hiệu dò nhầm', () => {
  it('ngưỡng: cạnh ngắn ≥ 0,6 m và cạnh dài ≥ 1,5 m', () => {
    expect(isPlausibleStair({ boundingBox: boxOf(0, 0, 250, 840) })).toBe(false);
    expect(isPlausibleStair({ boundingBox: boxOf(0, 0, 300, 660) })).toBe(false);
    expect(isPlausibleStair({ boundingBox: boxOf(0, 0, 900, 1400) })).toBe(false);
    expect(isPlausibleStair({ boundingBox: boxOf(0, 0, 900, 3000) })).toBe(true);
  });

  it('thang nhỏ vẫn có node (ẩn), thang thật hiện; lượt lưu không đổi gì', () => {
    const graph = createSampleBuilding();
    const [first, second] = graph.furniture;
    if (first === undefined || second === undefined) throw new Error('mẫu chuẩn phải có đồ đạc');
    const tiny: Furniture = { ...first, kind: 'stair', boundingBox: boxOf(first.centre.x, first.centre.y, 250, 840) };
    const real: Furniture = { ...second, kind: 'stair', boundingBox: boxOf(second.centre.x, second.centre.y, 1000, 3000) };
    graph.furniture = [tiny, real, ...graph.furniture.slice(2)];

    const { scene } = toPascalScene(graph);
    const tinyNode = scene.nodes[`stair_${tiny.id}`];
    expect(tinyNode?.type).toBe('stair');
    expect((tinyNode as { visible?: boolean } | undefined)?.visible).toBe(false);
    expect((scene.nodes[`stair_${real.id}`] as { visible?: boolean } | undefined)?.visible).toBeUndefined();

    // Đi về: thang nhỏ vẫn là món đồ cũ, không bị đọc thành xoá; khai đổi cả hai cũng không sinh lệnh.
    const back = toSpatialGraph(scene).graph.furniture.find((f) => f.id === tiny.id);
    expect(back?.kind).toBe('stair');
    expect(back?.boundingBox).toEqual(tiny.boundingBox);
    expect(changesOf(graph, [`stair_${tiny.id}`, `sseg_${tiny.id}`, `stair_${real.id}`])).toEqual([]);
  });
});

describe('V2 — phòng `other` đoán công năng theo tên (chỉ để bày đồ)', () => {
  it.each([
    ['OH/RP', 'livingRoom'],
    ['OH+K', 'livingRoom'],
    ['Olohuone', 'livingRoom'],
    ['Phòng khách', 'livingRoom'],
    ['RT', 'livingRoom'],
    ['K', 'kitchen'],
    ['Keittiö', 'kitchen'],
    ['Bếp', 'kitchen'],
    ['MH1', 'bedroom'],
    ['Phòng ngủ 2', 'bedroom'],
    ['PN', 'bedroom'],
    ['KHH', 'other'],
    ['TK', 'other'],
  ] as const)('%s → %s', (name, usage) => {
    expect(furnishingUsageOf({ usage: 'other', name, areaM2: 10 })).toBe(usage);
  });

  it('`H` chỉ là phòng ngủ khi ≥ 7 m²; công năng đã lưu không bị đè', () => {
    expect(furnishingUsageOf({ usage: 'other', name: 'H', areaM2: 9 })).toBe('bedroom');
    expect(furnishingUsageOf({ usage: 'other', name: 'H', areaM2: 5 })).toBe('other');
    expect(furnishingUsageOf({ usage: 'bathroom', name: 'MH', areaM2: 9 })).toBe('bathroom');
  });

  it('phòng "OH/RP" công năng other có bộ sofa; zone và lượt về vẫn giữ other', () => {
    const graph = createSampleBuilding();
    const index = 5;
    const room = graph.rooms[index];
    if (room === undefined) throw new Error('mẫu chuẩn phải có phòng');
    const named: Room = { ...room, name: 'OH/RP', usage: 'other' };
    graph.rooms = graph.rooms.map((r, i) => (i === index ? named : r));

    const { scene } = toPascalScene(graph);
    const sofa = Object.values(scene.nodes).find(
      (n) => n.type === 'item' && n.id.startsWith('item_DRESS-sofa') && fieldsOf(n)['roomId'] === room.id,
    );
    expect(sofa).toBeDefined();
    expect(fieldsOf(scene.nodes[`zone_${room.id}`])['usage']).toBe('other');
    expect(fieldsOf(scene.nodes[`slab_${room.id}`])['usage']).toBe('other');
    expect(toSpatialGraph(scene).graph.rooms.find((r) => r.id === room.id)?.usage).toBe('other');
    expect(changesOf(graph, [`zone_${room.id}`, `slab_${room.id}`])).toEqual([]);
  });
});

describe('V6 — đầu tường gần nhau dồn một điểm', () => {
  /** Cung tròn bán kính 3 m, 8 đoạn, mỗi khớp hở/lệch vài mm như bản dò AI. */
  const curveOf = (base: Wall): Wall[] =>
    Array.from({ length: 8 }, (_unused, i) => {
      const at = (k: number, jitter: number) => ({
        x: 100000 + 3000 * Math.cos((k * Math.PI) / 16) + jitter,
        y: 100000 + 3000 * Math.sin((k * Math.PI) / 16) - jitter,
      });
      return {
        ...base,
        id: `W-CURVE${i}0` as WallId,
        openingIds: [],
        thicknessMm: 150,
        centreline: { start: at(i, i === 0 ? 0 : 7), end: at(i + 1, i === 7 ? 0 : -9) },
      };
    });

  it('mọi khớp của chuỗi đoạn ngắn dùng chung một điểm; hai đầu chuỗi không đổi', () => {
    const base = createSampleBuilding().walls[0];
    if (base === undefined) throw new Error('mẫu chuẩn phải có tường');
    const curve = curveOf(base);
    const welded = weldWallEnds(curve);
    const wallOf = (w: Wall) => welded.get(w.id) ?? w;

    for (let i = 0; i < curve.length - 1; i++) {
      expect(wallOf(curve[i]!).centreline.end).toEqual(wallOf(curve[i + 1]!).centreline.start);
    }
    expect(wallOf(curve[0]!).centreline.start).toEqual(curve[0]!.centreline.start);
    expect(wallOf(curve[7]!).centreline.end).toEqual(curve[7]!.centreline.end);
    // Đã dồn rồi thì dồn lại không đổi gì nữa.
    expect(weldWallEnds(curve.map(wallOf)).size).toBe(0);
    // Khác tầng, hoặc xa quá nửa bề dày, thì không dồn.
    expect(weldWallEnds([curve[0]!, { ...curve[1]!, levelId: 'L-OTHER0010' as Wall['levelId'] }]).size).toBe(0);
    expect(weldWallEnds([curve[0]!, { ...curve[1]!, thicknessMm: 10 }]).size).toBe(0);
  });

  it('node tường mang trục đã dồn + trục gốc; tường không ai chạm không sinh lệnh khi lưu', () => {
    const graph = createSampleBuilding();
    const base = graph.walls[0];
    if (base === undefined) throw new Error('mẫu chuẩn phải có tường');
    const curve = curveOf(base);
    graph.walls = [...graph.walls, ...curve];

    const { scene } = toPascalScene(graph);
    const nodeOf = (w: Wall) => scene.nodes[`wall_${w.id}`];
    for (let i = 0; i < curve.length - 1; i++) {
      const a = nodeOf(curve[i]!);
      const b = nodeOf(curve[i + 1]!);
      if (a?.type !== 'wall' || b?.type !== 'wall') throw new Error('thiếu tường');
      expect(a.end).toEqual(b.start);
    }
    expect(fieldsOf(nodeOf(curve[1]!))['weldedFrom']).toEqual(curve[1]!.centreline);
    // Tường mẫu chuẩn đã khít: không bức nào bị dồn.
    expect(graph.walls.slice(0, -curve.length).filter((w) => fieldsOf(scene.nodes[`wall_${w.id}`])['weldedFrom'] !== undefined)).toEqual([]);

    // Lượt lưu chỉ so node Pascal khai đã đổi: đổi một món đồ không kéo theo tường nào.
    const item = graph.furniture[0];
    if (item === undefined) throw new Error('mẫu chuẩn phải có đồ đạc');
    expect(changesOf(graph, [`item_${item.id}`])).toEqual([]);
  });
});

describe('V6 — lượt về trả trục gốc cho tường đã dồn', () => {
  const curveOf = (base: Wall): Wall[] =>
    Array.from({ length: 4 }, (_unused, i) => {
      const at = (k: number, jitter: number) => ({
        x: 100000 + 3000 * Math.cos((k * Math.PI) / 8) + jitter,
        y: 100000 + 3000 * Math.sin((k * Math.PI) / 8) - jitter,
      });
      return {
        ...base,
        id: `W-CURVRT${i}0000` as WallId,
        openingIds: [],
        thicknessMm: 150,
        centreline: { start: at(i, i === 0 ? 0 : 7), end: at(i + 1, i === 3 ? 0 : -9) },
      };
    });

  it('toPascal → toSpatial trả trục gốc; người dùng dời đầu tường (> 1 mm) thì lưu toạ độ mới', () => {
    const graph = createSampleBuilding();
    const base = graph.walls[0];
    if (base === undefined) throw new Error('mẫu chuẩn phải có tường');
    const curve = curveOf(base);
    graph.walls = [...graph.walls, ...curve];

    const { scene } = toPascalScene(graph);
    expect(curve.every((w) => fieldsOf(scene.nodes[`wall_${w.id}`])['weldedFrom'] !== undefined)).toBe(true);
    const back = toSpatialGraph(scene).graph.walls;
    for (const wall of curve) {
      expect(back.find((w) => w.id === wall.id)?.centreline).toEqual(wall.centreline);
    }

    const id = `wall_${curve[1]!.id}`;
    const node = scene.nodes[id];
    if (node?.type !== 'wall') throw new Error('thiếu tường');
    const moved = { ...scene, nodes: { ...scene.nodes, [id]: { ...node, end: [node.end[0] + 0.05, node.end[1]] as const } } };
    const saved = toSpatialGraph(moved).graph.walls.find((w) => w.id === curve[1]!.id);
    expect(saved?.centreline.start).toEqual(curve[1]!.centreline.start);
    expect(saved?.centreline.end.x).toBe(Math.round((node.end[0] + 0.05) * 1000));
  });
});

describe('V1 — dãy tủ bếp chữ L cho bằng một hộp bao', () => {
  /** Phòng 0 của mẫu chuẩn, dãy tủ 2,2 × 2,6 m ở góc (min x, min y). */
  const sampleWithLRun = () => {
    const graph = createSampleBuilding();
    const first = graph.furniture[0];
    const room = graph.rooms.find((r) => r.id === first?.roomId);
    if (first === undefined || room === undefined) throw new Error('mẫu chuẩn phải có đồ trong phòng');
    const minX = Math.min(...room.outline.map((p) => p.x));
    const minY = Math.min(...room.outline.map((p) => p.y));
    const run: Furniture = {
      ...first,
      kind: 'kitchenCabinet',
      variant: 'baseRun',
      rotationDeg: 0,
      centre: { x: minX + 1100, y: minY + 1300 },
      boundingBox: { min: { x: minX, y: minY }, max: { x: minX + 2200, y: minY + 2600 } },
    };
    graph.furniture = [run, ...graph.furniture.slice(1)];
    return { graph, run, minX, minY };
  };

  it('node thật dựng theo nhánh dài sát tường, tâm node giữ nguyên; nhánh kia là đồ sinh ra', () => {
    const { graph, run, minX, minY } = sampleWithLRun();
    const { scene } = toPascalScene(graph);
    const node = scene.nodes[`item_${run.id}`] as PascalItemNode | undefined;
    const leg = scene.nodes[`item_DRESS-runLeg-${run.id}`] as PascalItemNode | undefined;
    if (node?.type !== 'item' || leg?.type !== 'item') throw new Error('thiếu hai nhánh');

    // Nhánh dài: dọc tường x = minX, trọn 2,6 m; mô hình dời bằng asset.offset.
    expect(node.position[0]).toBeCloseTo(run.centre.x / 1000, 6);
    expect(node.position[2]).toBeCloseTo(run.centre.y / 1000, 6);
    expect(node.asset.dimensions[0]).toBeCloseTo(0.6, 6);
    expect(node.asset.dimensions[2]).toBeCloseTo(2.6, 6);
    expect(node.position[0] + (node.asset.offset?.[0] ?? 0)).toBeCloseTo((minX + 300) / 1000, 2);
    expect(fieldsOf(node)['boundingBox']).toEqual(run.boundingBox);

    // Nhánh phụ: dọc tường y = minY, phần còn lại của 2,2 m sau góc, mặt quay vào phòng (+y).
    expect(leg.position[0]).toBeCloseTo((minX + 600 + 800) / 1000, 6);
    expect(leg.position[2]).toBeCloseTo((minY + 300) / 1000, 6);
    expect(leg.asset.dimensions[0]).toBeCloseTo(1.6, 6);
    expect(leg.asset.dimensions[2]).toBeCloseTo(0.6, 6);
    expect(leg.metadata?.['generated']).toBe('dressing');
    expect(fieldsOf(leg)['roomId']).toBeUndefined();
  });

  it('lượt về: món đồ y nguyên, nhánh phụ không thành đồ đạc; dãy thẳng không bị tách', () => {
    const { graph, run } = sampleWithLRun();
    const { scene } = toPascalScene(graph);
    const back = toSpatialGraph(scene).graph.furniture;
    const again = back.find((f) => f.id === run.id);
    expect(again?.centre).toEqual(run.centre);
    expect(again?.boundingBox).toEqual(run.boundingBox);
    expect(back).toHaveLength(graph.furniture.length);
    expect(changesOf(graph, [`item_${run.id}`, `item_DRESS-runLeg-${run.id}`])).toEqual([]);

    const straight: Furniture = { ...run, boundingBox: { min: run.boundingBox.min, max: { x: run.boundingBox.min.x + 2200, y: run.boundingBox.min.y + 600 } }, centre: { x: run.boundingBox.min.x + 1100, y: run.boundingBox.min.y + 300 } };
    const flat = toPascalScene({ ...graph, furniture: [straight, ...graph.furniture.slice(1)] }).scene;
    expect(flat.nodes[`item_DRESS-runLeg-${run.id}`]).toBeUndefined();
  });
});
