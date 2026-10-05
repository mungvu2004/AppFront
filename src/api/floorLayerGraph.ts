import { denormalizeSpatial, normalizeSpatial, type NormalizedSpatial } from '@/domain/spatial/normalize';
import type { Building, Level, SpatialGraph } from '@/domain/spatial/types';
import type { Project as StoreProject } from '@/types/project';

import type { ApiClient, Project as ApiProject, SpatialApi } from './client';
import type { FloorLayerDocument } from './schemas/spatialLayer';

/**
 * Đường nạp thật của màn QC: N16 (`GET …/floors/{floorId}/spatial/layer`) →
 * `NormalizedSpatial` mà kho `spatial` giữ — B-V6-01.
 *
 * Trước tệp này, cổng mặc định của màn QC đọc lại chính cái kho
 * (`read: () => useStore.getState().spatial`): kho rỗng thì `null` mãi, nên màn
 * treo skeleton vĩnh viễn và không có đường nào đưa dữ liệu vào.
 */

/**
 * Toà nhà của một đồ thị MỘT tầng.
 *
 * N16 nói về một tầng và không mang `building` — thứ ấy ở N15. `SpatialGraph`
 * thì bắt buộc có, nên đây là chỗ đứng chứ không phải dữ liệu: không màn QC nào
 * đọc toà nhà. Nguồn `human` + đã duyệt vì nó không phải đầu ra của AI (A5).
 */
export const FLOOR_LAYER_BUILDING: Building = Object.freeze({
  confidence: 1,
  datumElevationMm: 0,
  name: '',
  reviewed: true,
  source: 'human',
});

/** Tài liệu tầng N16 thành đồ thị một tầng. */
export const floorLayerToGraph = (document: FloorLayerDocument): SpatialGraph => ({
  axes: document.axes,
  building: FLOOR_LAYER_BUILDING,
  dimensions: document.dimensions,
  furniture: document.layer.furniture,
  levels: [document.level],
  notes: [],
  openings: document.layer.openings,
  rooms: document.layer.rooms,
  walls: document.layer.walls,
});

/** Đồ thị kho kèm `revision` N16 của từng tầng đã đọc — base lượt ghi đầu. */
export interface FloorLayerGraphRead {
  readonly floorRevisions: Readonly<Record<string, number>>;
  readonly graph: NormalizedSpatial;
}

export interface ReadFloorLayerGraphInput {
  readonly floorId: string;
  readonly projectId: string;
  readonly signal?: AbortSignal | undefined;
}

/**
 * Đọc lớp một tầng và trả về dạng kho. Lỗi thì NÉM — đó là cách `useQuery` của
 * màn đi vào trạng thái `error` của A11, thay vì `loading` mãi.
 */
export async function readFloorLayerRead(
  spatialApi: Pick<SpatialApi, 'readLayer'>,
  { floorId, projectId, signal }: ReadFloorLayerGraphInput,
): Promise<FloorLayerGraphRead> {
  const result = await spatialApi.readLayer(
    signal === undefined ? { floorId, projectId } : { floorId, projectId, signal },
  );

  if (!result.ok) {
    throw result.error;
  }

  return {
    floorRevisions: { [floorId]: result.data.revision },
    graph: normalizeSpatial(floorLayerToGraph(result.data)),
  };
}

/** Như {@link readFloorLayerRead}, chỉ lấy đồ thị. */
export async function readFloorLayerGraph(
  spatialApi: Pick<SpatialApi, 'readLayer'>,
  input: ReadFloorLayerGraphInput,
): Promise<NormalizedSpatial> {
  return (await readFloorLayerRead(spatialApi, input)).graph;
}

export interface ReadProjectLayerGraphInput {
  readonly floorIds: readonly string[];
  readonly projectId: string;
  readonly signal?: AbortSignal | undefined;
}

/**
 * Đồ thị của MỌI tầng trong dự án — thứ màn quản lý tầng vẽ (cao độ, số tường,
 * số phòng, diện tích theo tầng). Không có endpoint cả dự án, nên đọc N16 của
 * từng tầng rồi ghép. Một tầng hỏng thì cả lượt NÉM (A11 `error`), không vẽ nửa
 * dự án như thể đó là tất cả.
 *
 * ponytail: một lượt N16 cho mỗi tầng (trần `PROJECT_LIMITS.floorCountMax`); có
 * endpoint cả dự án thì thay đúng hàm này.
 */
export async function readProjectLayerRead(
  spatialApi: Pick<SpatialApi, 'readLayer'>,
  { floorIds, projectId, signal }: ReadProjectLayerGraphInput,
): Promise<FloorLayerGraphRead> {
  const documents = await Promise.all(
    floorIds.map(async (floorId) => {
      const result = await spatialApi.readLayer(
        signal === undefined ? { floorId, projectId } : { floorId, projectId, signal },
      );

      if (!result.ok) {
        throw result.error;
      }

      return result.data;
    }),
  );
  const graphs = documents.map(floorLayerToGraph);

  const graph = normalizeSpatial({
    axes: graphs.flatMap((graph) => graph.axes),
    building: FLOOR_LAYER_BUILDING,
    dimensions: graphs.flatMap((graph) => graph.dimensions),
    furniture: graphs.flatMap((graph) => graph.furniture),
    levels: graphs.flatMap((graph) => graph.levels),
    notes: [],
    openings: graphs.flatMap((graph) => graph.openings),
    rooms: graphs.flatMap((graph) => graph.rooms),
    walls: graphs.flatMap((one) => one.walls),
  });

  return {
    floorRevisions: Object.fromEntries(floorIds.map((floorId, index) => [floorId, documents[index]?.revision ?? 0])),
    graph,
  };
}

/** Như {@link readProjectLayerRead}, chỉ lấy đồ thị. */
export async function readProjectLayerGraph(
  spatialApi: Pick<SpatialApi, 'readLayer'>,
  input: ReadProjectLayerGraphInput,
): Promise<NormalizedSpatial> {
  return (await readProjectLayerRead(spatialApi, input)).graph;
}

export interface ReadProjectSpatialInput {
  readonly projectId: string;
  readonly signal?: AbortSignal | undefined;
}

/** Thứ cổng nạp kho dự án ghi vào kho, theo đúng hình của từng lát. */
export interface ProjectSpatial {
  readonly floorRevisions: Readonly<Record<string, number>>;
  readonly graph: NormalizedSpatial;
  readonly levels: readonly Level[];
  readonly project: StoreProject;
  readonly versionId: string | null;
}

/** Dự án N3 thành hình `projectSlice` giữ — kho không mang email thành viên. */
const toStoreProject = (project: ApiProject): StoreProject => ({
  created_at: project.createdAt,
  id: project.id,
  members: project.members.map((member) => ({
    ...(member.avatarUrl !== undefined ? { avatar_url: member.avatarUrl } : {}),
    id: member.id,
    name: member.name,
    role: member.role,
  })),
  name: project.name,
  updated_at: project.updatedAt,
});

/**
 * Đường nạp kho của một dự án (B-V12-01): N3 cho dự án và danh sách tầng, rồi
 * N16 của từng tầng qua {@link readProjectLayerGraph}. Dự án 0 tầng ra đồ thị
 * rỗng thật — không `null`, vì `null` là "chưa nạp" và cổng sẽ nạp lại mãi.
 * Lỗi thì NÉM, như mọi hàm đọc của tệp này.
 *
 * ponytail: hai lượt gọi (N3 + N16×tầng). N15 chưa thay được: nó không trả tên
 * và thành viên, và FE chưa có hàm client lẫn mock cho nó.
 */
export async function readProjectSpatial(
  api: Pick<ApiClient, 'projects' | 'spatial'>,
  { projectId, signal }: ReadProjectSpatialInput,
): Promise<ProjectSpatial> {
  const result = await api.projects.read(signal === undefined ? { projectId } : { projectId, signal });

  if (!result.ok) {
    throw result.error;
  }

  const { floorRevisions, graph } = await readProjectLayerRead(api.spatial, {
    floorIds: result.data.floors.map((floor) => floor.id),
    projectId,
    signal,
  });

  return {
    floorRevisions,
    graph,
    levels: denormalizeSpatial(graph).levels,
    project: toStoreProject(result.data),
    versionId: result.data.currentVersion?.id ?? null,
  };
}
