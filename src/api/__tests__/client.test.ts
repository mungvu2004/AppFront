import { describe, expect, it, vi } from 'vitest';

import type { HttpClient, HttpError, Result } from '@/lib/http';
import { parseFeatureFlagPayload } from '@/lib/telemetry/flags';
import { createApiClient } from '../client';
import { ENDPOINTS } from '../endpoints';
import { createMockApiClient } from '../__mocks__/client';

const ok = <T>(data: T): Result<T, HttpError> => ({ ok: true, data });

const createHttpMock = (responses: Record<string, unknown> = {}): HttpClient => {
  const get = vi.fn((path: string) => ok(responses[`GET ${path}`] as never)) as unknown as HttpClient['get'];
  const post = vi.fn((path: string) => ok(responses[`POST ${path}`] as never)) as unknown as HttpClient['post'];
  const patch = vi.fn((path: string) => ok(responses[`PATCH ${path}`] as never)) as unknown as HttpClient['patch'];
  const del = vi.fn((path: string) => ok(responses[`DELETE ${path}`] as never)) as unknown as HttpClient['delete'];
  const put = vi.fn((path: string) => ok(responses[`PUT ${path}`] as never)) as unknown as HttpClient['put'];

  return {
    delete: del,
    events: {
      emit: () => undefined,
      on: () => () => undefined,
    },
    get,
    getRecentRequests: () => [],
    patch,
    post,
    put,
  };
};

const sampleDrawing = {
  heightMm: 2200,
  id: 'drawing-1',
  name: 'Floor drawing 1',
  scale: 1,
  uploadedAt: '2026-08-03T08:00:00.000Z',
  uploaderId: 'user-1',
  url: 'https://example.com/drawing-1.png',
  widthMm: 1200,
};

const sampleFloor = {
  areaM2: 248.6,
  drawings: [sampleDrawing],
  elevationMm: 0,
  heightMm: 3900,
  id: 'floor-1',
  name: 'Floor 1',
  order: 1,
};

const sampleProject = {
  createdAt: '2026-08-03T08:00:00.000Z',
  floors: [sampleFloor],
  id: 'project-1',
  members: [{ email: 'admin@example.com', id: 'user-1', name: 'Admin', role: 'admin' }],
  name: 'Sample project',
  status: 'approved',
  updatedAt: '2026-08-03T08:30:00.000Z',
};

const sampleProgress = {
  id: 'upload-1',
  progressPercent: 50,
  startedAt: '2026-08-03T08:20:00.000Z',
  status: 'running',
  step: 'Upload drawing',
};

const sampleVersion = {
  createdAt: '2026-08-03T08:00:00.000Z',
  creatorId: 'user-1',
  id: 'version-1',
  projectId: 'project-1',
  sequence: 1,
};

describe('api client', () => {
  it('uses the centralized endpoint map for project reads', async () => {
    const http = createHttpMock({
      [`GET ${ENDPOINTS.projects.list}`]: [sampleProject],
      [`GET ${ENDPOINTS.projects.read('project-1')}`]: sampleProject,
    });
    const client = createApiClient(http);

    const listResult = await client.projects.list();
    const readResult = await client.projects.read({ projectId: 'project-1' });

    expect(listResult.ok).toBe(true);
    if (listResult.ok) {
      expect(listResult.data).toHaveLength(1);
      expect(listResult.data[0]?.status).toBe('approved');
    }
    expect(readResult.ok).toBe(true);
    expect(http.get).toHaveBeenCalledWith(ENDPOINTS.projects.list, undefined);
    expect(http.get).toHaveBeenCalledWith(ENDPOINTS.projects.read('project-1'), undefined);
  });

  it('passes Idempotency-Key to every write call when provided', async () => {
    const http = createHttpMock({
      [`POST ${ENDPOINTS.projects.create}`]: sampleProject,
      [`PATCH ${ENDPOINTS.projects.update('project-1')}`]: sampleProject,
      [`DELETE ${ENDPOINTS.projects.delete('project-1')}`]: sampleProject,
      [`POST ${ENDPOINTS.floors.create}`]: sampleFloor,
      [`PATCH ${ENDPOINTS.floors.reorder}`]: [sampleFloor],
      [`DELETE ${ENDPOINTS.floors.delete('floor-1')}`]: sampleFloor,
      [`POST ${ENDPOINTS.drawings.initUpload('project-1', 'floor-1')}`]: sampleProgress,
      [`POST ${ENDPOINTS.drawings.chunk('project-1', 'upload-1')}`]: sampleProgress,
      [`POST ${ENDPOINTS.drawings.complete('project-1', 'upload-1')}`]: sampleProgress,
      [`PATCH ${ENDPOINTS.spatial.floor('project-1', 'floor-1')}`]: sampleFloor,
    });
    const client = createApiClient(http);

    await client.projects.create({
      body: { name: 'New project' },
      idempotencyKey: 'key-project-create',
    });
    await client.projects.update({
      body: { name: 'Updated project' },
      idempotencyKey: 'key-project-update',
      projectId: 'project-1',
    });
    await client.projects.delete({
      idempotencyKey: 'key-project-delete',
      projectId: 'project-1',
    });
    await client.floors.create({
      body: { elevationMm: 0, heightMm: 3900, name: 'Floor 1', order: 1 },
      idempotencyKey: 'key-floor-create',
    });
    await client.floors.reorder({
      body: { floorIds: ['floor-1'] },
      idempotencyKey: 'key-floor-reorder',
    });
    await client.floors.delete({
      floorId: 'floor-1',
      idempotencyKey: 'key-floor-delete',
    });
    await client.drawings.initUpload({
      body: {
        fileName: 'drawing.png',
        floorId: 'floor-1',
        mimeType: 'image/png',
        projectId: 'project-1',
        sizeBytes: 128,
      },
      idempotencyKey: 'key-drawing-init',
    });
    await client.drawings.sendChunk({
      body: { chunk: 'chunk-1', chunkIndex: 0 },
      idempotencyKey: 'key-drawing-chunk',
      projectId: 'project-1',
      uploadId: 'upload-1',
    });
    await client.drawings.complete({
      body: { uploadId: 'upload-1' },
      idempotencyKey: 'key-drawing-complete',
      projectId: 'project-1',
    });
    await client.spatial.patchFloor({
      body: { name: 'Floor 1 updated' },
      floorId: 'floor-1',
      idempotencyKey: 'key-spatial-patch',
      projectId: 'project-1',
    });

    expect(http.post).toHaveBeenCalledWith(ENDPOINTS.projects.create, expect.objectContaining({ idempotencyKey: 'key-project-create' }));
    expect(http.patch).toHaveBeenCalledWith(ENDPOINTS.projects.update('project-1'), expect.objectContaining({ idempotencyKey: 'key-project-update' }));
    expect(http.delete).toHaveBeenCalledWith(ENDPOINTS.projects.delete('project-1'), expect.objectContaining({ idempotencyKey: 'key-project-delete' }));
    expect(http.post).toHaveBeenCalledWith(ENDPOINTS.floors.create, expect.objectContaining({ idempotencyKey: 'key-floor-create' }));
    expect(http.patch).toHaveBeenCalledWith(ENDPOINTS.floors.reorder, expect.objectContaining({ idempotencyKey: 'key-floor-reorder' }));
    expect(http.delete).toHaveBeenCalledWith(ENDPOINTS.floors.delete('floor-1'), expect.objectContaining({ idempotencyKey: 'key-floor-delete' }));
    expect(http.post).toHaveBeenCalledWith(ENDPOINTS.drawings.initUpload('project-1', 'floor-1'), expect.objectContaining({ idempotencyKey: 'key-drawing-init' }));
    expect(http.post).toHaveBeenCalledWith(ENDPOINTS.drawings.chunk('project-1', 'upload-1'), expect.objectContaining({ idempotencyKey: 'key-drawing-chunk' }));
    expect(http.post).toHaveBeenCalledWith(ENDPOINTS.drawings.complete('project-1', 'upload-1'), expect.objectContaining({ idempotencyKey: 'key-drawing-complete' }));
    expect(http.patch).toHaveBeenCalledWith(ENDPOINTS.spatial.floor('project-1', 'floor-1'), expect.objectContaining({ idempotencyKey: 'key-spatial-patch' }));
  });

  it('decodes response data with the matching schema', async () => {
    const http = createHttpMock({
      [`GET ${ENDPOINTS.floors.list}`]: [sampleFloor],
      [`GET ${ENDPOINTS.drawings.progress('project-1', 'upload-1')}`]: sampleProgress,
      [`GET ${ENDPOINTS.spatial.version('project-1', 'version-1')}`]: sampleVersion,
    });
    const client = createApiClient(http);

    const floorsResult = await client.floors.list();
    const progressResult = await client.drawings.progress({
      projectId: 'project-1',
      uploadId: 'upload-1',
    });
    const versionResult = await client.spatial.readVersion({
      projectId: 'project-1',
      versionId: 'version-1',
    });

    expect(floorsResult.ok).toBe(true);
    if (floorsResult.ok) {
      expect(floorsResult.data[0]?.heightMm).toBe(3900);
    }
    expect(progressResult.ok).toBe(true);
    if (progressResult.ok) {
      expect(progressResult.data.status).toBe('running');
    }
    expect(versionResult.ok).toBe(true);
    if (versionResult.ok) {
      expect(versionResult.data.projectId).toBe('project-1');
    }
  });

  it('hands the feature-flag body over undecoded, so one bad flag cannot lose the rest', async () => {
    const payload = { flags: { 'scene.soft-shadows': true, 'scene.ray-tracing': true, 'rules.parallel-run': 'yes' } };
    const http = createHttpMock({ [`GET ${ENDPOINTS.featureFlags.read}`]: payload });
    const client = createApiClient(http);

    const result = await client.featureFlags.read();

    expect(http.get).toHaveBeenCalledWith(ENDPOINTS.featureFlags.read, undefined);
    expect(result.ok).toBe(true);
    if (result.ok) {
      // Untouched: `parseFeatureFlagPayload` is the one that judges each entry.
      expect(result.data).toEqual(payload);
    }
  });

  it('reads feature flags through the parser the store uses', async () => {
    const client = createMockApiClient();

    const parsed = parseFeatureFlagPayload(await client.featureFlags.read());

    expect(parsed.readable).toBe(true);
    expect(parsed.values['scene.instanced-walls']).toBe(true);
    expect(parsed.values['scene.soft-shadows']).toBe(false);
  });

  it('mock client returns sample data with the same signature', async () => {
    const client = createMockApiClient();

    const projectsResult = await client.projects.list();
    const floorsResult = await client.floors.list();
    const spatialResult = await client.spatial.readFloor({
      floorId: 'floor-1',
      projectId: 'project-1',
    });

    expect(projectsResult.ok).toBe(true);
    expect(floorsResult.ok).toBe(true);
    expect(spatialResult.ok).toBe(true);
  });
});
