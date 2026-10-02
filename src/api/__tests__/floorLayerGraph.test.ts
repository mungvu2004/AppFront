import { afterEach, describe, expect, it, vi } from 'vitest';

import { SAMPLE_BUILDING, sampleLevelId } from '@/domain/spatial/__fixtures__/sampleBuilding';
import { isIdOfKind } from '@/domain/spatial/ids';
import { normalizeSpatial } from '@/domain/spatial/normalize';
import { useStore } from '@/store';
import { createAxisGridManagerGateway } from '@/screens/qc/AxisGridManager/axisGridManagerGateway';
import { createDimensionOcrReviewGateway } from '@/screens/qc/DimensionOcrReview/dimensionOcrReviewGateway';
import { createFloorManagerGateway } from '@/screens/qc/FloorManager/floorManagerGateway';
import { createObjectLayerReviewGateway } from '@/screens/qc/ObjectLayerReview/objectLayerReviewGateway';
import { createRoomLabelReviewGateway } from '@/screens/qc/RoomLabelReview/roomLabelReviewGateway';
import { createThicknessStandardizationGateway } from '@/screens/qc/ThicknessStandardization/thicknessStandardizationGateway';
import { createWallLayerReviewGateway } from '@/screens/qc/WallLayerReview/wallLayerReviewGateway';

import { createMockApiClient } from '../__mocks__/client';
import type { ApiClient } from '../client';
import { floorLayerToGraph, readFloorLayerGraph, readProjectLayerGraph } from '../floorLayerGraph';

/**
 * B-V6-01 — đường nạp thật của màn QC. Trước bản sửa, cổng mặc định của bốn màn
 * đọc lại chính kho (`graph.read()`), nên kho rỗng thì `null` mãi và màn treo
 * skeleton; không lượt gọi mạng nào xảy ra.
 */

const PROJECT_ID = 'project-1';
const SAMPLE_FLOOR = sampleLevelId(1);

afterEach(() => {
  useStore.getState().setSpatial(null, null);
});

describe('readFloorLayerGraph', () => {
  it('đưa phần của đúng một tầng bộ mẫu A14 vào dạng kho, kèm tầng ấy', async () => {
    const graph = await readFloorLayerGraph(createMockApiClient().spatial, {
      floorId: SAMPLE_FLOOR,
      projectId: PROJECT_ID,
    });

    const wallsOnFloor = SAMPLE_BUILDING.walls.filter((wall) => wall.levelId === SAMPLE_FLOOR);

    expect(graph.byKind.level).toEqual([SAMPLE_FLOOR]);
    expect(graph.byKind.wall).toEqual(wallsOnFloor.map((wall) => wall.id));
    expect(wallsOnFloor.length).toBeGreaterThan(0);
  });

  it('tầng chưa có tài liệu nhận lớp rỗng thật — không phải `null`, không treo', async () => {
    const graph = await readFloorLayerGraph(createMockApiClient().spatial, { floorId: 'L1', projectId: PROJECT_ID });

    // Mã `Level` hợp lệ, khác mã tầng API — như BE (B-V5-01: `L1` trần bị
    // `isEntityOfKind`/`applyPatch` từ chối, nên không lệnh nào vá được tầng ấy).
    expect(graph.byKind.level).toHaveLength(1);
    expect(graph.byKind.level[0]).not.toBe('L1');
    expect(isIdOfKind('level', graph.byKind.level[0] ?? '')).toBe(true);
    expect(graph.byKind.wall).toEqual([]);
  });

  it('lượt đọc hỏng thì NÉM, để màn vào `error` của A11 thay vì `loading` mãi', async () => {
    const error = { kind: 'network', raw: undefined, requestId: 'req-1', retryable: true } as const;
    const readLayer = vi.fn<ApiClient['spatial']['readLayer']>().mockResolvedValue({ error, ok: false });

    await expect(readFloorLayerGraph({ readLayer }, { floorId: SAMPLE_FLOOR, projectId: PROJECT_ID })).rejects.toBe(
      error,
    );
  });

  it('chuyển tài liệu N16 thành đồ thị một tầng, không bịa ghi chú', () => {
    const level = SAMPLE_BUILDING.levels[0]!;
    const graph = floorLayerToGraph({
      axes: [],
      dimensions: [],
      layer: { furniture: [], openings: [], rooms: [], walls: [] },
      level,
      revision: 0,
    });

    expect(graph.levels).toEqual([level]);
    expect(graph.notes).toEqual([]);
    expect(normalizeSpatial(graph).byKind.level).toEqual([level.id]);
  });
});

const GATEWAYS = [
  ['tường', (apiClient: ApiClient) => createWallLayerReviewGateway({ apiClient }).readWallLayer],
  ['đối tượng', (apiClient: ApiClient) => createObjectLayerReviewGateway({ apiClient }).readObjectLayer],
  ['kích thước', (apiClient: ApiClient) => createDimensionOcrReviewGateway({ apiClient }).readDimensionLayer],
  ['trục', (apiClient: ApiClient) => createAxisGridManagerGateway({ apiClient }).readAxisLayer],
  ['phòng', (apiClient: ApiClient) => createRoomLabelReviewGateway({ apiClient }).readRoomLayer],
  ['độ dày', (apiClient: ApiClient) => createThicknessStandardizationGateway({ apiClient }).readThicknessLayer],
] as const;

describe.each(GATEWAYS)('cổng thật của màn %s', (_name, readOf) => {
  it('kho rỗng thì đọc N16 của đúng tầng trong URL', async () => {
    const apiClient = createMockApiClient();
    const readLayer = vi.spyOn(apiClient.spatial, 'readLayer');

    const graph = await readOf(apiClient)({ floorId: SAMPLE_FLOOR, projectId: PROJECT_ID });

    expect(readLayer).toHaveBeenCalledWith({ floorId: SAMPLE_FLOOR, projectId: PROJECT_ID });
    expect(graph?.byKind.level).toEqual([SAMPLE_FLOOR]);
  });

  it('kho đã có thì giữ kho — không đè thay đổi chưa lưu bằng bản máy chủ', async () => {
    const apiClient = createMockApiClient();
    const readLayer = vi.spyOn(apiClient.spatial, 'readLayer');
    const inStore = normalizeSpatial(SAMPLE_BUILDING);

    useStore.getState().setSpatial(inStore, null);
    const graph = await readOf(apiClient)({ floorId: SAMPLE_FLOOR, projectId: PROJECT_ID });

    expect(readLayer).not.toHaveBeenCalled();
    expect(graph).toBe(useStore.getState().spatial);
  });
});

describe('readProjectLayerGraph — màn quản lý tầng (B-V6-01 phần V7)', () => {
  it('ghép N16 của mọi tầng thành một đồ thị: đủ tầng, tường của tầng nào ở tầng ấy', async () => {
    const floorIds = SAMPLE_BUILDING.levels.map((level) => level.id);
    const graph = await readProjectLayerGraph(createMockApiClient().spatial, { floorIds, projectId: PROJECT_ID });

    expect(graph.byKind.level).toEqual(floorIds);
    expect(graph.byKind.wall).toHaveLength(SAMPLE_BUILDING.walls.length);
  });

  it('một tầng hỏng thì cả lượt NÉM — không vẽ nửa dự án như thể đó là tất cả', async () => {
    const error = { kind: 'network', raw: undefined, requestId: 'req-1', retryable: true } as const;
    const apiClient = createMockApiClient();
    const readLayer = vi
      .spyOn(apiClient.spatial, 'readLayer')
      .mockImplementation(async (input) =>
        input.floorId === 'L2' ? { error, ok: false } : createMockApiClient().spatial.readLayer(input),
      );

    await expect(
      readProjectLayerGraph(apiClient.spatial, { floorIds: ['L1', 'L2'], projectId: PROJECT_ID }),
    ).rejects.toBe(error);
    expect(readLayer).toHaveBeenCalledTimes(2);
  });

  it('cổng thật của màn tầng: kho rỗng thì đọc danh sách tầng rồi N16 của từng tầng', async () => {
    const apiClient = createMockApiClient();
    const readLayer = vi.spyOn(apiClient.spatial, 'readLayer');

    const { floors, graph } = await createFloorManagerGateway({ api: apiClient }).readFloorList({
      projectId: PROJECT_ID,
    });

    expect(floors.length).toBeGreaterThan(0);
    expect(readLayer).toHaveBeenCalledTimes(floors.length);
    /* Một Level cho mỗi tầng. KHÔNG so mã với `floor.id`: trên BE hai mã trùng nhau
       (`level_out`, id = floor.id), nhưng bộ mẫu ánh xạ mã tầng `L1` thành một
       `LevelId` hợp lệ (`levelIdOfFloor`, `__mocks__/client.ts`) — B-V9-08. */
    expect(graph?.byKind.level).toHaveLength(floors.length);
    expect(readLayer.mock.calls.map(([input]) => input.floorId)).toEqual(
      floors.map((floor) => floor.id),
    );
  });

  it('cổng thật của màn tầng: kho đã có thì giữ kho', async () => {
    const apiClient = createMockApiClient();
    const readLayer = vi.spyOn(apiClient.spatial, 'readLayer');

    useStore.getState().setSpatial(normalizeSpatial(SAMPLE_BUILDING), null);
    const { graph } = await createFloorManagerGateway({ api: apiClient }).readFloorList({ projectId: PROJECT_ID });

    expect(readLayer).not.toHaveBeenCalled();
    expect(graph).toBe(useStore.getState().spatial);
  });
});

const PERSISTS = [
  ['tường', (apiClient: ApiClient) => createWallLayerReviewGateway({ apiClient }).persistWallLayer],
  ['đối tượng', (apiClient: ApiClient) => createObjectLayerReviewGateway({ apiClient }).persistObjectLayer],
  ['phòng', (apiClient: ApiClient) => createRoomLabelReviewGateway({ apiClient }).persistRoomLabels],
  ['độ dày', (apiClient: ApiClient) => createThicknessStandardizationGateway({ apiClient }).persistThicknessStandardization],
] as const;

describe.each(PERSISTS)('cổng thật của màn %s lưu qua #35 (B-V6-03)', (_name, persistOf) => {
  it('PUT lớp của đúng tầng trong URL, baseVersion lấy từ N16', async () => {
    const apiClient = createMockApiClient();
    const writeLayer = vi.spyOn(apiClient.spatial, 'writeLayer');
    const graph = normalizeSpatial(SAMPLE_BUILDING);

    const result = await persistOf(apiClient)({ floorId: SAMPLE_FLOOR, graph, projectId: PROJECT_ID });

    expect(result.supported).toBe(true);
    expect(writeLayer).toHaveBeenCalledTimes(1);
    expect(writeLayer.mock.calls[0]?.[0]).toMatchObject({ baseVersion: 0, floorId: SAMPLE_FLOOR, projectId: PROJECT_ID });
    expect(writeLayer.mock.calls[0]?.[0].body.walls.every((wall) => wall.levelId === SAMPLE_FLOOR)).toBe(true);
  });
});
