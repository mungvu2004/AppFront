import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { SAMPLE_BUILDING, sampleLevelId } from '@/domain/spatial/__fixtures__/sampleBuilding';
import { isIdOfKind } from '@/domain/spatial/ids';
import { normalizeSpatial, type NormalizedSpatial } from '@/domain/spatial/normalize';
import { useStore } from '@/store';
import { createAxisGridManagerGateway } from '@/screens/qc/AxisGridManager/axisGridManagerGateway';
import {
  createDimensionOcrReviewGateway,
  levelOfGraph as dimensionLevelOfGraph,
} from '@/screens/qc/DimensionOcrReview/dimensionOcrReviewGateway';
import { createFloorManagerGateway } from '@/screens/qc/FloorManager/floorManagerGateway';
import {
  createObjectLayerReviewGateway,
  levelOfGraph as objectLevelOfGraph,
  objectsOf,
} from '@/screens/qc/ObjectLayerReview/objectLayerReviewGateway';
import { createRoomLabelReviewGateway } from '@/screens/qc/RoomLabelReview/roomLabelReviewGateway';
import { createThicknessStandardizationGateway } from '@/screens/qc/ThicknessStandardization/thicknessStandardizationGateway';
import { createWallLayerReviewGateway } from '@/screens/qc/WallLayerReview/wallLayerReviewGateway';

import { __resetMockLayerState, createMockApiClient } from '../__mocks__/client';
import type { ApiClient } from '../client';
import {
  floorLayerToGraph,
  readFloorLayerGraph,
  readFloorLayerRead,
  readProjectLayerGraph,
  readProjectLayerRead,
  readProjectSpatial,
  rolesOf,
  type SpatialReader,
} from '../floorLayerGraph';

/**
 * B-V6-01 — đường nạp thật của màn QC. Trước bản sửa, cổng mặc định của bốn màn
 * đọc lại chính kho (`graph.read()`), nên kho rỗng thì `null` mãi và màn treo
 * skeleton; không lượt gọi mạng nào xảy ra.
 */

const PROJECT_ID = 'project-1';
const SAMPLE_FLOOR = sampleLevelId(1);
const READER: SpatialReader = { roles: ['engineer'], userId: null };

beforeEach(() => {
  __resetMockLayerState();
});

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

/** Cổng QC trả `FloorLayerGraphRead`, cổng trục/kích thước vẫn trả đồ thị trần. */
const graphOf = (read: unknown): NormalizedSpatial | null =>
  read !== null && typeof read === 'object' && 'graph' in read
    ? (read as { graph: NormalizedSpatial }).graph
    : (read as NormalizedSpatial | null);

describe.each(GATEWAYS)('cổng thật của màn %s', (_name, readOf) => {
  it('kho rỗng thì đọc N16 của đúng tầng trong URL', async () => {
    const apiClient = createMockApiClient();
    const readLayer = vi.spyOn(apiClient.spatial, 'readLayer');

    const graph = graphOf(await readOf(apiClient)({ floorId: SAMPLE_FLOOR, projectId: PROJECT_ID }));

    expect(readLayer).toHaveBeenCalledWith({ floorId: SAMPLE_FLOOR, projectId: PROJECT_ID });
    expect(graph?.byKind.level).toEqual([SAMPLE_FLOOR]);
  });

  it('kho đã có thì giữ kho — không đè thay đổi chưa lưu bằng bản máy chủ', async () => {
    const apiClient = createMockApiClient();
    const readLayer = vi.spyOn(apiClient.spatial, 'readLayer');
    const inStore = normalizeSpatial(SAMPLE_BUILDING);

    useStore.getState().setSpatial(inStore, null);
    const graph = graphOf(await readOf(apiClient)({ floorId: SAMPLE_FLOOR, projectId: PROJECT_ID }));

    expect(readLayer).not.toHaveBeenCalled();
    expect(graph).toBe(useStore.getState().spatial);
  });
});

describe('lượt đọc mang revision (F-04x-1 bước 2)', () => {
  it('readFloorLayerRead trả revision N16 của tầng, cùng đồ thị với readFloorLayerGraph', async () => {
    const apiClient = createMockApiClient();
    const read = await readFloorLayerRead(apiClient.spatial, { floorId: SAMPLE_FLOOR, projectId: PROJECT_ID });

    expect(read.floorRevisions).toEqual({ [SAMPLE_FLOOR]: expect.any(Number) });
    expect(read.graph.byKind.level).toEqual([SAMPLE_FLOOR]);
  });

  it('readProjectLayerRead trả revision của mọi tầng; readProjectLayerGraph giữ chữ ký cũ', async () => {
    const floorIds = SAMPLE_BUILDING.levels.map((level) => level.id);
    const api = createMockApiClient().spatial;
    const read = await readProjectLayerRead(api, { floorIds, projectId: PROJECT_ID });
    const graph = await readProjectLayerGraph(api, { floorIds, projectId: PROJECT_ID });

    expect(Object.keys(read.floorRevisions)).toEqual(floorIds);
    expect(read.graph.byKind.level).toEqual(graph.byKind.level);
  });

  it('readProjectSpatial mang floorRevisions của mọi tầng (N15)', async () => {
    const result = await readProjectSpatial(createMockApiClient(), { projectId: PROJECT_ID }, READER);

    expect(result.document.floorRevisions).toHaveLength(result.document.graph.levels.length);
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

/*
 * F-04x-1: bốn cổng QC không còn tự lưu (`persist*` và bộ lưu cũ đã gỡ —
 * lượt đọc N16 ngay trước PUT để lấy base là đúng lỗi ghi đè lặng). Lượt lưu đi qua
 * `useFloorLayerAutosave`; cổng chỉ lộ client cho nó và giữ cờ `supports`. Hành vi
 * PUT/base nay kiểm ở `spatialLayerSave.test.ts`, `useAutosave.test.ts` và test màn.
 */
const SAVE_PORTS = [
  ['tường', (apiClient: ApiClient) => {
    const gateway = createWallLayerReviewGateway({ apiClient });

    return { apiClient: gateway.apiClient, persists: gateway.supports.persistWallLayer };
  }],
  ['đối tượng', (apiClient: ApiClient) => {
    const gateway = createObjectLayerReviewGateway({ apiClient });

    return { apiClient: gateway.apiClient, persists: gateway.supports.persistObjectLayer };
  }],
  ['phòng', (apiClient: ApiClient) => {
    const gateway = createRoomLabelReviewGateway({ apiClient });

    return { apiClient: gateway.apiClient, persists: gateway.supports.persistRoomLabels };
  }],
  ['độ dày', (apiClient: ApiClient) => {
    const gateway = createThicknessStandardizationGateway({ apiClient });

    return { apiClient: gateway.apiClient, persists: gateway.supports.persistThicknessStandardization };
  }],
] as const;

describe.each(SAVE_PORTS)('cổng thật của màn %s giao lượt lưu cho bộ lưu lớp chung (F-04x-1)', (_name, portOf) => {
  it('lộ đúng client cho `useFloorLayerAutosave`, giữ cờ lưu, không tự PUT', () => {
    const apiClient = createMockApiClient();
    const writeLayer = vi.spyOn(apiClient.spatial, 'writeLayer');
    const port = portOf(apiClient);

    expect(port.apiClient).toBe(apiClient);
    expect(port.persists).toBe(true);
    expect(writeLayer).not.toHaveBeenCalled();
  });
});

/*
 * F-04x-2: `readProjectSpatial` đọc #24 + N15 thay N16 từng tầng, và trả `document` N15 cùng
 * `roles` thay `graph`/`levels`/`versionId` (versionId nay do kho băm từ `floorMeta`). Hai bài
 * cũ đổi theo hợp đồng mới, không phải cho khớp lỗi.
 */
describe('readProjectSpatial — #24 + N15 (F-04x-2)', () => {
  it('đọc dự án rồi N15 một lượt: dự án dạng kho (không email), đồ thị đủ tầng, không gọi N16', async () => {
    const api = createMockApiClient();
    const readLayer = vi.spyOn(api.spatial, 'readLayer');
    const readGraph = vi.spyOn(api.spatial, 'readGraph');
    const projectResult = await api.projects.read({ projectId: PROJECT_ID });
    const project = projectResult.ok ? projectResult.data : null;

    const loaded = await readProjectSpatial(api, { projectId: PROJECT_ID }, READER);

    expect(project).not.toBeNull();
    expect(loaded.project.id).toBe(PROJECT_ID);
    expect(loaded.project.name).toBe(project?.name);
    expect(loaded.project.members.map((member) => member.id)).toEqual(project?.members.map((member) => member.id));
    expect(JSON.stringify(loaded.project)).not.toContain('@');
    expect(loaded.document.graph.levels).toHaveLength(project?.floors.length ?? -1);
    expect(readGraph).toHaveBeenCalledTimes(1);
    expect(readLayer).not.toHaveBeenCalled();
  });

  it('`projects.read` hỏng thì NÉM, và không đọc N15', async () => {
    const error = { kind: 'network', raw: undefined, requestId: 'req-2', retryable: true } as const;
    const api = createMockApiClient();
    const readGraph = vi.spyOn(api.spatial, 'readGraph');

    vi.spyOn(api.projects, 'read').mockResolvedValue({ error, ok: false });

    await expect(readProjectSpatial(api, { projectId: PROJECT_ID }, READER)).rejects.toBe(error);
    expect(readGraph).not.toHaveBeenCalled();
  });

  it('N15 hỏng thì NÉM', async () => {
    const error = { kind: 'network', raw: undefined, requestId: 'req-3', retryable: true } as const;
    const api = createMockApiClient();

    vi.spyOn(api.spatial, 'readGraph').mockResolvedValue({ error, ok: false });

    await expect(readProjectSpatial(api, { projectId: PROJECT_ID }, READER)).rejects.toBe(error);
  });

  it('roles: vai của người đọc trong `members`; không phải thành viên thì vai của phiên', async () => {
    const api = createMockApiClient();
    const projectResult = await api.projects.read({ projectId: PROJECT_ID });

    if (!projectResult.ok || projectResult.data.members[0] === undefined) {
      throw new Error('mock projects.read phải trả dự án có thành viên');
    }

    const member = projectResult.data.members[0];

    expect(rolesOf(projectResult.data, { roles: ['viewer'], userId: member.id })).toEqual([member.role]);
    expect(rolesOf(projectResult.data, { roles: ['viewer'], userId: 'người-lạ' })).toEqual(['viewer']);
    expect(rolesOf(projectResult.data, { roles: ['engineer'], userId: null })).toEqual(['engineer']);
  });
});

describe('levelOfGraph của hai màn QC — kho cả dự án (B-V12-01)', () => {
  const whole = normalizeSpatial(SAMPLE_BUILDING);
  const second = sampleLevelId(2);

  it.each([
    ['Lớp đối tượng', objectLevelOfGraph],
    ['kích thước OCR', dimensionLevelOfGraph],
  ])('%s: có `levelId` của URL thì ra đúng tầng ấy, không phải tầng đầu', (_name, levelOfGraph) => {
    expect(levelOfGraph(whole, second)?.id).toBe(second);
  });

  it('lớp đối tượng: URL không có `levelId` thì ra tầng đầu; mã không có trong đồ thị thì `null` (B-V6-40)', () => {
    expect(objectLevelOfGraph(whole)?.id).toBe(whole.byKind.level[0]);
    expect(objectLevelOfGraph(whole, 'L1')).toBeNull();
    expect(objectLevelOfGraph(whole, 'L-LEVEL000099')).toBeNull();
    expect(objectLevelOfGraph(null, second)).toBeNull();
  });

  it('lớp đối tượng: tầng đầu của bộ mẫu có đúng 10 đối tượng khi không có bảng mẫu (B-V6-40)', () => {
    const first = objectLevelOfGraph(whole, sampleLevelId(0));

    expect(objectsOf(whole, first, [])).toHaveLength(10);
  });

  // B-V6-70 (mở): màn kích thước vẫn rơi về tầng đầu khi mã tầng không có trong đồ thị.
  it('kích thước OCR: không có `levelId` (hoặc mã không có trong đồ thị) thì ra tầng đầu', () => {
    expect(dimensionLevelOfGraph(whole)?.id).toBe(whole.byKind.level[0]);
    expect(dimensionLevelOfGraph(whole, 'L1')?.id).toBe(whole.byKind.level[0]);
    expect(dimensionLevelOfGraph(null, second)).toBeNull();
  });
});
