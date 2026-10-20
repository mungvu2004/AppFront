/**
 * Cửa đi, cửa sổ, ô trống sang Pascal (T11): mỗi swing của AppFront ra đúng bộ
 * trường Pascal đọc để dựng cánh — khai đủ, không dựa vào mặc định lược đồ.
 */

import { describe, expect, it } from 'vitest';

import { SpatialGraphDocumentSchema } from '@/api/schemas/spatialGraph';
import type { SwingDirection } from '@/domain/spatial/types';

import { fixtureF2 } from '../__fixtures__';
import { toPascalId } from '../ids';
import { toPascalScene } from '../toPascal';

const graph = SpatialGraphDocumentSchema.parse(fixtureF2().doc).graph;
const { nodes } = toPascalScene(graph).scene;

const pick = (node: unknown, keys: readonly string[]) =>
  Object.fromEntries(keys.map((key) => [key, (node as Record<string, unknown>)[key]]));

const DOOR_KEYS = ['openingKind', 'doorType', 'leafCount', 'hingesSide', 'swingAngle', 'swingDirection', 'operationState'];
const WINDOW_KEYS = ['openingKind', 'windowType', 'casementStyle', 'hingesSide'];

const hinged = { openingKind: 'door', doorType: 'hinged', leafCount: 1, hingesSide: 'left', swingAngle: 1.22, swingDirection: 'inward', operationState: 0 };
const DOOR: Record<SwingDirection, object> = {
  left: hinged,
  right: { ...hinged, hingesSide: 'right' },
  double: { ...hinged, leafCount: 2 },
  sliding: { ...hinged, doorType: 'sliding', swingAngle: 0, operationState: 0.5 },
  fixed: { ...hinged, openingKind: 'opening', swingAngle: 0 },
};
const fixedWindow = { openingKind: 'window', windowType: 'fixed', casementStyle: 'single', hingesSide: 'left' };
const WINDOW: Record<SwingDirection, object> = {
  left: { ...fixedWindow, windowType: 'casement' },
  right: { ...fixedWindow, windowType: 'casement', hingesSide: 'right' },
  double: { ...fixedWindow, windowType: 'casement', casementStyle: 'french' },
  sliding: { ...fixedWindow, windowType: 'sliding' },
  fixed: fixedWindow,
};

describe('ô mở → Pascal (T11)', () => {
  it('F2 phủ đủ 5 swing cho cả cửa đi và cửa sổ', () => {
    for (const kind of ['door', 'window'] as const) {
      const swings = new Set(graph.openings.filter((o) => o.kind === kind).map((o) => o.swing));
      expect(swings, kind).toEqual(new Set(['left', 'right', 'double', 'sliding', 'fixed']));
    }
  });

  it.each(graph.openings.map((o) => [o.kind, o.swing, o] as const))('%s %s → đúng bộ trường', (kind, swing, opening) => {
    const node = nodes[toPascalId(kind, opening.id)];
    expect(node?.type).toBe(kind);
    expect(pick(node, kind === 'door' ? DOOR_KEYS : WINDOW_KEYS)).toEqual(kind === 'door' ? DOOR[swing] : WINDOW[swing]);
  });
});
