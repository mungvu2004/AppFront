import type { Result } from '@/lib/http';
import type { FeatureFlagKey } from '@/lib/telemetry/flags';
import { MOCK_SPATIAL_PROJECT } from '../../mocks/spatial';
import type {
  ApiClient,
  Drawing,
  Floor,
  FloorWriteBody,
  Progress,
  Project,
  ProjectWriteBody,
  Version,
} from '../client';

const ok = <T>(data: T): Result<T, never> => ({ ok: true, data });
const clone = <T>(value: T): T => structuredClone(value);

const makeDrawing = (id: string): Drawing => ({
  heightMm: 2200,
  id,
  name: `Drawing ${id}`,
  scale: 1,
  uploadedAt: '2026-08-03T08:00:00.000Z',
  uploaderId: 'user-1',
  url: `https://example.com/${id}.png`,
  widthMm: 1200,
});

const makeProgress = (overrides: Partial<Progress> = {}): Progress => ({
  id: 'upload-1',
  progressPercent: 50,
  startedAt: '2026-08-03T08:20:00.000Z',
  status: 'running',
  step: 'Upload drawing',
  ...overrides,
});

/**
 * One heavy feature switched on for the mock group, the rest off.
 *
 * Typed against the whole key union rather than left partial, so a flag added
 * to the table stops this file from compiling instead of quietly never being
 * exercised by anything that runs against the mock.
 */
const MOCK_SERVER_FEATURE_FLAGS: Readonly<Record<FeatureFlagKey, boolean>> = {
  'scene.instanced-walls': true,
  'scene.soft-shadows': false,
  'rules.parallel-run': false,
  'export.pdf-vector': false,
  'qc.live-collaboration': false,
};

const makeVersion = (): Version => ({
  createdAt: '2026-08-03T08:00:00.000Z',
  creatorId: 'user-1',
  id: 'version-1',
  note: 'Mock snapshot',
  projectId: 'project-1',
  sequence: 1,
});

const makeFloor = (levelId: string, name: string, elevationM: number, heightM: number, order: number): Floor => ({
  ...(levelId === 'L1' ? { areaM2: 248.6 } : {}),
  drawings: levelId === 'L1' ? [makeDrawing('L1-drawing-1')] : [],
  elevationMm: Math.round(elevationM * 1000),
  heightMm: Math.round(heightM * 1000),
  id: levelId,
  name,
  order,
});

const makeFallbackFloor = (floorId: string): Floor => ({
  drawings: [],
  elevationMm: 0,
  heightMm: 3900,
  id: floorId,
  name: floorId,
  order: 0,
});

const buildProject = (): Project => {
  const floors = MOCK_SPATIAL_PROJECT.levels.map((level, index) =>
    makeFloor(level.level_id, level.name, level.elevation_m, level.height_m, index),
  );

  return {
    address: '12 Vo Van Tan, District 3',
    createdAt: '2026-08-03T08:00:00.000Z',
    currentVersion: makeVersion(),
    floors,
    id: 'project-1',
    members: [
      { email: 'admin@example.com', id: 'user-1', name: 'Admin', role: 'admin' },
      { email: 'engineer@example.com', id: 'user-2', name: 'Engineer', role: 'engineer' },
    ],
    name: 'Sample project',
    progress: makeProgress({ id: 'ai-1', progressPercent: 100, status: 'completed' }),
    status: 'approved',
    updatedAt: '2026-08-03T08:30:00.000Z',
  };
};

const uploadKey = (projectId: string, uploadId: string): string => `${projectId}::${uploadId}`;

const applyProjectBody = (project: Project, body: Partial<ProjectWriteBody>): Project => ({
  ...project,
  ...(body.address !== undefined ? { address: body.address } : {}),
  ...(body.code !== undefined ? { code: body.code } : {}),
  ...(body.currentVersion !== undefined ? { currentVersion: body.currentVersion } : {}),
  ...(body.floors !== undefined ? { floors: body.floors } : {}),
  ...(body.members !== undefined ? { members: body.members } : {}),
  ...(body.name !== undefined ? { name: body.name } : {}),
  ...(body.progress !== undefined ? { progress: body.progress } : {}),
  ...(body.status !== undefined ? { status: body.status } : {}),
});

const applyFloorBody = (floor: Floor, body: Partial<FloorWriteBody>): Floor => ({
  ...floor,
  ...(body.areaM2 !== undefined ? { areaM2: body.areaM2 } : {}),
  ...(body.drawings !== undefined ? { drawings: body.drawings } : {}),
  ...(body.elevationMm !== undefined ? { elevationMm: body.elevationMm } : {}),
  ...(body.heightMm !== undefined ? { heightMm: body.heightMm } : {}),
  ...(body.name !== undefined ? { name: body.name } : {}),
  ...(body.order !== undefined ? { order: body.order } : {}),
});

export const createMockApiClient = (): ApiClient => {
  let project = buildProject();
  let floors = clone(project.floors);
  const uploads = new Map<string, Progress>();

  return {
    drawings: {
      complete: async ({ body, projectId }) => {
        const completed = makeProgress({ id: body.uploadId, progressPercent: 100, status: 'completed' });
        uploads.set(uploadKey(projectId, body.uploadId), completed);
        return ok(completed);
      },
      initUpload: async ({ body }) => {
        const progress = makeProgress({ id: `${body.projectId}-${body.floorId}`, step: 'Initialize upload' });
        uploads.set(uploadKey(body.projectId, body.floorId), progress);
        return ok(progress);
      },
      progress: async ({ projectId, uploadId }) =>
        ok(uploads.get(uploadKey(projectId, uploadId)) ?? makeProgress({ id: uploadId, progressPercent: 0 })),
      sendChunk: async ({ body, projectId, uploadId }) => {
        const key = uploadKey(projectId, uploadId);
        const current = uploads.get(key) ?? makeProgress({ id: uploadId, progressPercent: 0 });
        const next = clone(current);
        next.step = 'Send chunk';
        next.progressPercent = Math.min(99, next.progressPercent + 25 + body.chunkIndex);
        uploads.set(key, next);
        return ok(next);
      },
    },
    featureFlags: {
      read: async () => ok({ flags: { ...MOCK_SERVER_FEATURE_FLAGS } }),
    },
    floors: {
      create: async ({ body }) => {
        const next: Floor = {
          ...(body.areaM2 !== undefined ? { areaM2: body.areaM2 } : {}),
          drawings: body.drawings ?? [],
          elevationMm: body.elevationMm,
          heightMm: body.heightMm,
          id: `floor-${floors.length + 1}`,
          name: body.name,
          order: body.order,
        };
        floors = [...floors, next];
        project = { ...project, floors: clone(floors) };
        return ok(next);
      },
      delete: async ({ floorId }) => {
        const removed = floors.find((item) => item.id === floorId) ?? makeFallbackFloor(floorId);
        floors = floors.filter((item) => item.id !== floorId);
        project = { ...project, floors: clone(floors) };
        return ok(clone(removed));
      },
      list: async () => ok(clone(floors)),
      reorder: async ({ body }) => {
        const ordered = body.floorIds
          .map((floorId) => floors.find((item) => item.id === floorId))
          .filter((item): item is Floor => item !== undefined);
        if (ordered.length > 0) {
          floors = ordered;
          project = { ...project, floors: clone(floors) };
        }
        return ok(clone(floors));
      },
    },
    projects: {
      create: async ({ body }) => {
        project = applyProjectBody(
          {
            ...buildProject(),
            floors: clone(floors),
          },
          body,
        );
        project = {
          ...project,
          createdAt: '2026-08-03T08:35:00.000Z',
          id: `project-${body.name.replace(/\s+/g, '-').toLowerCase()}`,
          floors: clone(floors),
          updatedAt: '2026-08-03T08:35:00.000Z',
        };
        return ok(clone(project));
      },
      delete: async ({ projectId }) => {
        const removed = clone(project);
        project = buildProject();
        floors = clone(project.floors);
        return ok({ ...removed, id: projectId });
      },
      list: async () => ok([clone(project)]),
      read: async ({ projectId }) => ok({ ...clone(project), id: projectId }),
      update: async ({ body, projectId }) => {
        project = {
          ...applyProjectBody(project, body),
          id: projectId,
          floors: clone(floors),
          updatedAt: '2026-08-03T08:40:00.000Z',
        };
        return ok(clone(project));
      },
    },
    spatial: {
      patchFloor: async ({ body, floorId }) => {
        const current = floors.find((item) => item.id === floorId) ?? makeFallbackFloor(floorId);
        const next = applyFloorBody({ ...current, id: floorId }, body);
        floors = floors.map((item) => (item.id === floorId ? next : item));
        project = { ...project, floors: clone(floors) };
        return ok(next);
      },
      readFloor: async ({ floorId }) => ok(clone(floors.find((item) => item.id === floorId) ?? makeFallbackFloor(floorId))),
      readVersion: async ({ projectId, versionId }) => ok({ ...makeVersion(), projectId, id: versionId }),
    },
  };
};

export const mockApiClient = createMockApiClient();
export const createApiClientMock = createMockApiClient;

