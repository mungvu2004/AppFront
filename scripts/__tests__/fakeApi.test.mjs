// @vitest-environment node
/**
 * Máy chủ giả của e2e trang 3D (`e2e/fixtures/fakeApi.ts`) nói ĐÚNG hợp đồng:
 * mọi thân nó trả về qua được schema zod thật mà ứng dụng dùng để đọc. Đặt ở
 * đây vì `vitest.config.ts` loại `e2e/**`.
 */
import { describe, expect, it } from 'vitest';

import { createFakeBackend } from '../../e2e/fixtures/fakeApi.ts';
import { ProjectSchema, FloorSchema } from '../../src/api/schemas/index.ts';
import { ApiErrorBodySchema, VersionConflictBodySchema } from '../../src/api/schemas/errors.ts';
import { SpatialGraphDocumentSchema } from '../../src/api/schemas/spatialGraph.ts';
import { FloorLayerDocumentSchema, FloorLayerWriteResultSchema } from '../../src/api/schemas/spatialLayer.ts';
import { defaultParseRefreshResponse } from '../../src/lib/auth/refresh.ts';

const HUMAN = { confidence: 1, reviewed: true, source: 'human' };
const AI = { confidence: 0.82, reviewed: false, source: 'ai' };
const level = (index) => ({
  ...HUMAN,
  elevationMm: index * 3000,
  heightMm: 3000,
  id: `L-LEVEL0${index}`,
  name: `Tầng ${index}`,
  order: index,
  scaleMillimetresPerPixel: 10,
});
const wall = (index, levelId) => ({
  ...AI,
  centreline: { end: { x: 4000, y: 0 }, start: { x: 0, y: 0 } },
  heightMm: 3000,
  id: `W-WALL00${index}`,
  kind: 'partition',
  levelId,
  openingIds: [],
  thicknessMm: 200,
});
const opening = {
  ...AI,
  heightMm: 2100,
  id: 'D-DOOR000',
  kind: 'door',
  offsetMm: 500,
  sillHeightMm: 0,
  swing: 'left',
  wallId: 'W-WALL001',
  widthMm: 900,
};
const graphDoc = {
  floorRevisions: [
    { floorId: 'L-LEVEL00', revision: 0 },
    { floorId: 'L-LEVEL01', revision: 3 },
  ],
  graph: {
    axes: [],
    building: { ...HUMAN, datumElevationMm: 0, name: 'Nhà thử' },
    dimensions: [],
    furniture: [],
    levels: [level(0), level(1)],
    notes: [],
    openings: [opening],
    rooms: [],
    walls: [wall(0, 'L-LEVEL00'), wall(1, 'L-LEVEL01')],
  },
};

const PROJECT = '/api/projects/P-FAKE';
const LAYER1 = `${PROJECT}/floors/L-LEVEL01/spatial/layer`;
const backend = () => createFakeBackend({ projectId: 'P-FAKE', graphDoc, layers: { 'L-LEVEL00': { scaleStatus: 'unresolved' } } });
const ok = (response) => {
  expect(response.status).toBe(200);
  return response.body;
};

describe('createFakeBackend', () => {
  it('mọi thân đọc qua schema thật', async () => {
    const api = backend();

    const refresh = await defaultParseRefreshResponse(new Response(JSON.stringify(ok(api.handle('POST', '/api/auth/refresh')))), Date.now());
    expect(refresh.roles).toEqual(['engineer']);
    expect(refresh.user?.id).toBe('U-FAKEENGINEER');
    // Làm mới lặp lại được (bộ hẹn giờ của phiên gọi nhiều lần).
    expect(api.handle('POST', '/api/auth/refresh').status).toBe(200);

    expect(ProjectSchema.parse(ok(api.handle('GET', PROJECT))).floors).toHaveLength(2);
    expect(SpatialGraphDocumentSchema.parse(ok(api.handle('GET', `${PROJECT}/spatial`))).graph.walls).toHaveLength(2);
    expect(ok(api.handle('GET', `${PROJECT}/floors`)).map((floor) => FloorSchema.parse(floor).id)).toEqual(['L-LEVEL00', 'L-LEVEL01']);

    const doc1 = FloorLayerDocumentSchema.parse(ok(api.handle('GET', LAYER1)));
    expect(doc1.revision).toBe(3);
    expect(doc1.layer.openings.map((item) => item.id)).toEqual(['D-DOOR000']);
    expect(FloorLayerDocumentSchema.parse(ok(api.handle('GET', `${PROJECT}/floors/L-LEVEL00/spatial/layer`))).scaleStatus).toBe('unresolved');
    expect(api.unexpected).toEqual([]);
  });

  it('PUT đúng base: lưu, tăng revision, N15 và N16 thấy lớp mới', () => {
    const api = backend();
    const layer = { furniture: [], openings: [], rooms: [], walls: [{ ...wall(1, 'L-LEVEL01'), thicknessMm: 250 }] };

    const result = FloorLayerWriteResultSchema.parse(ok(api.handle('PUT', LAYER1, { baseVersion: 3, body: { layer } })));
    expect(result.revision).toBe(4);
    expect(api.puts).toHaveLength(1);

    const graph = SpatialGraphDocumentSchema.parse(ok(api.handle('GET', `${PROJECT}/spatial`)));
    expect(graph.floorRevisions.find((row) => row.floorId === 'L-LEVEL01')?.revision).toBe(4);
    expect(graph.graph.walls.map((item) => item.thicknessMm)).toEqual([200, 250]);
    expect(graph.graph.openings).toEqual([]);
    expect(FloorLayerDocumentSchema.parse(ok(api.handle('GET', LAYER1))).revision).toBe(4);
  });

  it('PUT sai: thân lạ 422, base vượt 422, base cũ 409 — thân lỗi đúng schema', () => {
    const api = backend();
    const layer = { furniture: [], openings: [], rooms: [], walls: [] };

    const strange = api.handle('PUT', LAYER1, { baseVersion: 3, body: { layer: { ...layer, extra: [] } } });
    expect(strange.status).toBe(422);
    ApiErrorBodySchema.parse(strange.body);

    const ahead = api.handle('PUT', LAYER1, { baseVersion: 9, body: { layer } });
    expect(ahead.status).toBe(422);
    expect(ApiErrorBodySchema.parse(ahead.body).field).toBe('baseVersion');

    const stale = api.handle('PUT', LAYER1, { baseVersion: 2, body: { layer } });
    expect(stale.status).toBe(409);
    expect(VersionConflictBodySchema.parse(stale.body).currentVersion).toBe(3);
  });

  it('lượt gọi ngoài danh sách: 404 và ghi vào unexpected', () => {
    const api = backend();

    const response = api.handle('GET', '/api/khong-co-route');
    expect(response.status).toBe(404);
    ApiErrorBodySchema.parse(response.body);
    api.handle('GET', '/api/projects/P-KHAC/spatial');
    api.handle('PUT', `${PROJECT}/floors/L-KHONGCO/spatial/layer`, {});
    expect(api.unexpected).toEqual(['GET /api/khong-co-route', 'GET /api/projects/P-KHAC/spatial', 'PUT /api/projects/P-FAKE/floors/L-KHONGCO/spatial/layer']);
  });
});
