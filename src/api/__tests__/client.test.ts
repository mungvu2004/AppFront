import { describe, expect, it, vi } from 'vitest';

import type { HttpClient, HttpError, Result } from '@/lib/http';
import { parseFeatureFlagPayload } from '@/lib/telemetry/flags';
import { createApiClient } from '../client';
import { FloorSchema, ProgressSchema } from '../schemas';
import { API_BASE_PATH, ENDPOINTS } from '../endpoints';
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

const sampleSpatialLayer = {
  furniture: [
    {
      boundingBox: { max: { x: 550, y: 550 }, min: { x: 450, y: 450 } },
      centre: { x: 500, y: 500 },
      confidence: 1,
      id: 'F-1',
      kind: 'chair',
      levelId: 'L-1',
      reviewed: true,
      rotationDeg: 0,
      source: 'human',
    },
  ],
  openings: [
    {
      confidence: 1,
      heightMm: 2100,
      id: 'D-1',
      kind: 'door',
      offsetMm: 100,
      reviewed: true,
      sillHeightMm: 0,
      source: 'human',
      swing: 'left',
      wallId: 'W-1',
      widthMm: 900,
    },
  ],
  rooms: [
    {
      areaM2: 12.5,
      confidence: 1,
      id: 'R-1',
      levelId: 'L-1',
      name: 'Phòng khách',
      outline: [
        { x: 0, y: 0 },
        { x: 3500, y: 0 },
        { x: 3500, y: 3500 },
        { x: 0, y: 3500 },
      ],
      reviewed: true,
      source: 'human',
      usage: 'livingRoom',
      wallIds: ['W-1'],
    },
  ],
  walls: [
    {
      centreline: { end: { x: 4000, y: 0 }, start: { x: 0, y: 0 } },
      confidence: 1,
      heightMm: 2800,
      id: 'W-1',
      kind: 'loadBearing',
      levelId: 'L-1',
      openingIds: ['D-1'],
      reviewed: true,
      source: 'human',
      thicknessMm: 220,
    },
  ],
} as const;

const samplePropertyTemplateDraft = {
  fields: { heightMm: 2800, kind: 'loadBearing', thicknessMm: 220 },
  name: 'Tường 220 chịu lực',
  objectKind: 'wall',
} as const;

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
      [`POST ${ENDPOINTS.floors.create('project-1')}`]: sampleFloor,
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
      body: { elevationMm: 0, heightMm: 3900, id: 'L-0000000001', name: 'Floor 1', order: 1 },
      idempotencyKey: 'key-floor-create',
      projectId: 'project-1',
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
    expect(http.post).toHaveBeenCalledWith(ENDPOINTS.floors.create('project-1'), expect.objectContaining({ idempotencyKey: 'key-floor-create' }));
    expect(http.patch).toHaveBeenCalledWith(ENDPOINTS.floors.reorder, expect.objectContaining({ idempotencyKey: 'key-floor-reorder' }));
    expect(http.delete).toHaveBeenCalledWith(ENDPOINTS.floors.delete('floor-1'), expect.objectContaining({ idempotencyKey: 'key-floor-delete' }));
    expect(http.post).toHaveBeenCalledWith(ENDPOINTS.drawings.initUpload('project-1', 'floor-1'), expect.objectContaining({ idempotencyKey: 'key-drawing-init' }));
    expect(http.post).toHaveBeenCalledWith(ENDPOINTS.drawings.chunk('project-1', 'upload-1'), expect.objectContaining({ idempotencyKey: 'key-drawing-chunk' }));
    expect(http.post).toHaveBeenCalledWith(ENDPOINTS.drawings.complete('project-1', 'upload-1'), expect.objectContaining({ idempotencyKey: 'key-drawing-complete' }));
    expect(http.patch).toHaveBeenCalledWith(ENDPOINTS.spatial.floor('project-1', 'floor-1'), expect.objectContaining({ idempotencyKey: 'key-spatial-patch' }));
  });

  it('nests floor create/list under the project and keeps delete/reorder flat', async () => {
    const wireFloor = { drawings: [], elevationMm: 0, heightMm: 3900, id: 'L-0000000001', name: 'Tầng 1', order: 0 };
    const wireProgress = { id: 'u-1', progressPercent: 0, status: 'pending', step: 'upload' };
    expect(FloorSchema.parse(wireFloor).id).toBe('L-0000000001');
    expect(ProgressSchema.parse(wireProgress).id).toBe('u-1');
    const http = createHttpMock({
      'POST /projects/p/floors': wireFloor,
      'GET /projects/p/floors': [wireFloor],
      'DELETE /floors/L-0000000001': wireFloor,
      'PATCH /floors/reorder': [wireFloor],
      'POST /projects/p/floors/L-0000000001/drawings/uploads': wireProgress,
    });
    const client = createApiClient(http);

    await client.floors.create({
      body: { elevationMm: 0, heightMm: 3900, id: 'L-0000000001', name: 'Tầng 1', order: 0 },
      projectId: 'p',
    });
    await client.floors.list({ projectId: 'p' });
    await client.floors.delete({ floorId: 'L-0000000001' });
    await client.floors.reorder({ body: { floorIds: ['L-0000000001'] } });

    const createCall = vi.mocked(http.post).mock.calls[0];
    expect(createCall?.[0]).toBe('/projects/p/floors');
    const createBody = (createCall?.[1] as { body: Record<string, unknown> }).body;
    expect(createBody.id).toBe('L-0000000001');
    expect('projectId' in createBody).toBe(false);
    expect(vi.mocked(http.get).mock.calls[0]?.[0]).toBe('/projects/p/floors');
    expect(vi.mocked(http.delete).mock.calls[0]?.[0]).toBe('/floors/L-0000000001');
    expect(vi.mocked(http.patch).mock.calls[0]?.[0]).toBe('/floors/reorder');
  });

  it('reads every page of N7 latestUploads, following nextCursor', async () => {
    const first = 'upl_01J8Z3K4Q5R6S7T8V9W0XYZAB1';
    const second = 'upl_01J8Z3K4Q5R6S7T8V9W0XYZAB2';
    const http = createHttpMock({
      [`GET ${ENDPOINTS.drawings.latestUploads('project-1')}`]: {
        items: [
          { floorId: 'L1', floorName: 'Tầng 1', uploadId: first },
        ],
        nextCursor: 'trang-2',
      },
      [`GET ${ENDPOINTS.drawings.latestUploads('project-1', 'trang-2')}`]: {
        items: [{ floorId: 'L2', floorName: 'Tầng 2', uploadId: second }],
      },
    });
    const result = await createApiClient(http).drawings.latestUploads({ projectId: 'project-1' });

    expect(result).toEqual({
      ok: true,
      data: [
        { floorId: 'L1', floorName: 'Tầng 1', uploadId: first },
        { floorId: 'L2', floorName: 'Tầng 2', uploadId: second },
      ],
    });
    expect(ENDPOINTS.drawings.latestUploads('project-1', 'a b')).toBe(
      '/projects/project-1/drawings/uploads/latest?cursor=a%20b',
    );
  });

  it('mock N7 lists the floor that already has a drawing, with a completed upload', async () => {
    const client = createMockApiClient();
    const latest = await client.drawings.latestUploads({ projectId: 'project-1' });

    expect(latest.ok && latest.data.map((upload) => upload.floorId)).toEqual(['L1']);

    const uploadId = latest.ok ? (latest.data[0]?.uploadId ?? '') : '';
    const progress = await client.drawings.progress({ projectId: 'project-1', uploadId });

    expect(progress.ok && progress.data.status).toBe('completed');
  });

  it('sends pageIndex on initUpload only when given', async () => {
    const wireProgress = { id: 'u-1', progressPercent: 0, status: 'pending', step: 'upload' };
    const http = createHttpMock({
      'POST /projects/p/floors/L-0000000001/drawings/uploads': wireProgress,
    });
    const client = createApiClient(http);
    const base = { fileName: 'a.pdf', floorId: 'L-0000000001', mimeType: 'application/pdf', projectId: 'p', sizeBytes: 1 };

    await client.drawings.initUpload({ body: { ...base, pageIndex: 3 } });
    await client.drawings.initUpload({ body: base });

    const bodies = vi.mocked(http.post).mock.calls.map((c) => (c[1] as { body: Record<string, unknown> }).body);
    expect(bodies[0]?.pageIndex).toBe(3);
    expect('pageIndex' in (bodies[1] ?? {})).toBe(false);
  });

  it('decodes response data with the matching schema', async () => {
    const http = createHttpMock({
      [`GET ${ENDPOINTS.floors.list('project-1')}`]: [sampleFloor],
      [`GET ${ENDPOINTS.drawings.progress('project-1', 'upload-1')}`]: sampleProgress,
      [`GET ${ENDPOINTS.spatial.version('project-1', 'version-1')}`]: sampleVersion,
    });
    const client = createApiClient(http);

    const floorsResult = await client.floors.list({ projectId: 'project-1' });
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

  it('exposes telemetry as a path already prefixed with API_BASE_PATH, for callers that bypass createHttpClient', () => {
    expect(ENDPOINTS.telemetry).toBe(`${API_BASE_PATH}/telemetry`);
  });

  it('mock client returns sample data with the same signature', async () => {
    const client = createMockApiClient();

    const projectsResult = await client.projects.list();
    const floorsResult = await client.floors.list({ projectId: 'project-1' });
    const spatialResult = await client.spatial.readFloor({
      floorId: 'floor-1',
      projectId: 'project-1',
    });

    expect(projectsResult.ok).toBe(true);
    expect(floorsResult.ok).toBe(true);
    expect(spatialResult.ok).toBe(true);
  });

  describe('spatial layer (U4 gap #4)', () => {
    it('exposes a path distinct from spatial.floor, since Floor carries no walls/openings/rooms/furniture', () => {
      expect(ENDPOINTS.spatial.layer('project-1', 'floor-1')).toBe(
        `${ENDPOINTS.spatial.floor('project-1', 'floor-1')}/layer`,
      );
    });

    it('writeLayer PUTs {baseVersion, body: {layer}} — the only verb BE #35 has on this path (B-G-07)', async () => {
      const saved = { layer: sampleSpatialLayer, revision: 8 };
      const http = createHttpMock({
        [`PUT ${ENDPOINTS.spatial.layer('project-1', 'floor-1')}`]: saved,
      });
      const client = createApiClient(http);

      const result = await client.spatial.writeLayer({
        baseVersion: 7,
        body: { layer: sampleSpatialLayer },
        floorId: 'floor-1',
        idempotencyKey: 'key-spatial-layer',
        projectId: 'project-1',
      });

      expect(http.patch).not.toHaveBeenCalled();
      expect(http.put).toHaveBeenCalledWith(
        ENDPOINTS.spatial.layer('project-1', 'floor-1'),
        expect.objectContaining({
          body: { baseVersion: 7, body: { layer: sampleSpatialLayer } },
          idempotencyKey: 'key-spatial-layer',
        }),
      );
      expect(result).toEqual({ data: saved, ok: true });
    });

    it('readLayer GETs N16 on the same path and decodes the floor document', async () => {
      const document = {
        axes: [],
        dimensions: [],
        layer: sampleSpatialLayer,
        level: {
          confidence: 1,
          elevationMm: 0,
          heightMm: 3000,
          id: 'L-LEVEL000001',
          name: 'Tầng 2',
          order: 1,
          reviewed: true,
          source: 'human',
        },
        revision: 3,
      };
      const http = createHttpMock({ [`GET ${ENDPOINTS.spatial.layer('project-1', 'L-LEVEL000001')}`]: document });

      const result = await createApiClient(http).spatial.readLayer({ floorId: 'L-LEVEL000001', projectId: 'project-1' });

      expect(result).toEqual({ data: document, ok: true });
    });

    it('readGraph GETs N15 and decodes the graph document', async () => {
      const wire = await createMockApiClient().spatial.readGraph({ projectId: 'project-1' });
      const document = wire.ok ? wire.data : null;
      const http = createHttpMock({ [`GET ${ENDPOINTS.spatial.graph('project-1')}`]: document });

      const result = await createApiClient(http).spatial.readGraph({ projectId: 'project-1' });

      expect(ENDPOINTS.spatial.graph('project-1')).toBe('/projects/project-1/spatial');
      expect(vi.mocked(http.get).mock.calls[0]?.[0]).toBe(ENDPOINTS.spatial.graph('project-1'));
      expect(result).toEqual({ data: document, ok: true });
    });

    it('readGraph turns an unknown key into a contract error', async () => {
      const wire = await createMockApiClient().spatial.readGraph({ projectId: 'project-1' });
      const http = createHttpMock({
        [`GET ${ENDPOINTS.spatial.graph('project-1')}`]: { ...(wire.ok ? wire.data : {}), scaleStatus: 'unresolved' },
      });

      const result = await createApiClient(http).spatial.readGraph({ projectId: 'project-1' });

      expect(!result.ok && result.error.code).toBe('CONTRACT_VALIDATION');
    });

    it('mock client bumps the revision on every write and serves the written layer back on read', async () => {
      const client = createMockApiClient();
      const before = await client.spatial.readLayer({ floorId: 'floor-1', projectId: 'project-1' });

      const result = await client.spatial.writeLayer({
        baseVersion: before.ok ? before.data.revision : -1,
        body: { layer: sampleSpatialLayer },
        floorId: 'floor-1',
        projectId: 'project-1',
      });
      const after = await client.spatial.readLayer({ floorId: 'floor-1', projectId: 'project-1' });

      expect(before.ok && before.data.revision).toBe(0);
      expect(result).toEqual({ data: { layer: sampleSpatialLayer, revision: 1 }, ok: true });
      expect(after.ok && after.data.layer).toEqual(sampleSpatialLayer);
      expect(after.ok && after.data.revision).toBe(1);
    });
  });

  describe('property templates (U4 gap #5)', () => {
    it('exposes create and list on the same project-scoped path', () => {
      expect(ENDPOINTS.propertyTemplates.create('project-1')).toBe(ENDPOINTS.propertyTemplates.list('project-1'));
      expect(ENDPOINTS.propertyTemplates.list('project-1')).toBe('/projects/project-1/property-templates');
    });

    it('create POSTs the draft with an idempotency key and hands the response straight back', async () => {
      const http = createHttpMock({
        [`POST ${ENDPOINTS.propertyTemplates.create('project-1')}`]: {
          ...samplePropertyTemplateDraft,
          createdAt: '2026-08-03T08:00:00.000Z',
          id: 'template-1',
          projectId: 'project-1',
          scope: 'project',
        },
      });
      const client = createApiClient(http);

      const result = await client.propertyTemplates.create({
        body: samplePropertyTemplateDraft,
        idempotencyKey: 'key-template-create',
        projectId: 'project-1',
      });

      expect(http.post).toHaveBeenCalledWith(
        ENDPOINTS.propertyTemplates.create('project-1'),
        expect.objectContaining({ body: samplePropertyTemplateDraft, idempotencyKey: 'key-template-create' }),
      );
      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.data.id).toBe('template-1');
        expect(result.data.scope).toBe('project');
      }
    });

    it('mock client creates a template and lists it back, scoped to its project', async () => {
      const client = createMockApiClient();

      const created = await client.propertyTemplates.create({
        body: samplePropertyTemplateDraft,
        projectId: 'project-1',
      });

      expect(created.ok).toBe(true);
      if (!created.ok) {
        return;
      }
      expect(created.data).toMatchObject({
        fields: samplePropertyTemplateDraft.fields,
        name: samplePropertyTemplateDraft.name,
        objectKind: 'wall',
        projectId: 'project-1',
        scope: 'project',
      });
      expect(created.data.id).toEqual(expect.any(String));
      expect(created.data.createdAt).toEqual(expect.any(String));

      const listedForOwner = await client.propertyTemplates.list({ projectId: 'project-1' });
      const listedForOtherProject = await client.propertyTemplates.list({ projectId: 'project-2' });

      expect(listedForOwner.ok).toBe(true);
      if (listedForOwner.ok) {
        expect(listedForOwner.data).toContainEqual(created.data);
      }
      expect(listedForOtherProject.ok).toBe(true);
      if (listedForOtherProject.ok) {
        expect(listedForOtherProject.data).toEqual([]);
      }
    });
  });
  describe('auth group on its own transport (BE-00 W10)', () => {
    it('sends auth.signIn through authHttp, never through the token-bearing client', async () => {
      const tokenHttp = createHttpMock({ [`POST ${ENDPOINTS.auth.login}`]: undefined });
      const plainHttp = createHttpMock({ [`POST ${ENDPOINTS.auth.login}`]: undefined });

      const result = await createApiClient(tokenHttp, { authHttp: plainHttp }).auth.signIn({
        body: { email: 'a@b.vn', password: 'sai-mat-khau', rememberMe: false },
      });

      expect(result).toEqual({ ok: true, data: undefined });
      expect(plainHttp.post).toHaveBeenCalledWith(ENDPOINTS.auth.login, expect.anything());
      expect(tokenHttp.post).not.toHaveBeenCalled();
    });

    it('keeps every other group on the main client even when authHttp is given', async () => {
      const tokenHttp = createHttpMock({ [`GET ${ENDPOINTS.projects.list}`]: [sampleProject] });
      const plainHttp = createHttpMock();

      await createApiClient(tokenHttp, { authHttp: plainHttp }).projects.list();

      expect(tokenHttp.get).toHaveBeenCalledWith(ENDPOINTS.projects.list, undefined);
      expect(plainHttp.get).not.toHaveBeenCalled();
    });
  });

  describe('R3 write pipeline (BE-00 §7)', () => {
    it('forwards idempotent and timeoutMode to the transport on post and delete', async () => {
      const http = createHttpMock({
        [`POST ${ENDPOINTS.projects.create}`]: sampleProject,
        [`DELETE ${ENDPOINTS.projects.delete('project-1')}`]: sampleProject,
      });
      const client = createApiClient(http);

      await client.projects.create({
        body: { name: 'New project' },
        idempotencyKey: 'key-create',
        idempotent: true,
        timeoutMode: 'file',
      });
      await client.projects.delete({
        idempotencyKey: 'key-delete',
        idempotent: true,
        projectId: 'project-1',
        timeoutMode: 'file',
      });

      expect(http.post).toHaveBeenCalledWith(ENDPOINTS.projects.create, {
        body: { name: 'New project' },
        idempotencyKey: 'key-create',
        idempotent: true,
        timeoutMode: 'file',
      });
      expect(http.delete).toHaveBeenCalledWith(ENDPOINTS.projects.delete('project-1'), {
        idempotencyKey: 'key-delete',
        idempotent: true,
        timeoutMode: 'file',
      });
    });

    it('leaves both keys absent — not undefined — when the caller omits them', async () => {
      const http = createHttpMock({ [`POST ${ENDPOINTS.projects.create}`]: sampleProject });

      await createApiClient(http).projects.create({
        body: { name: 'New project' },
        idempotencyKey: 'key-create',
      });

      expect(http.post).toHaveBeenCalledWith(ENDPOINTS.projects.create, {
        body: { name: 'New project' },
        idempotencyKey: 'key-create',
      });
      const [, sentOptions] = vi.mocked(http.post).mock.calls[0] ?? [];
      expect(sentOptions).toStrictEqual({ body: { name: 'New project' }, idempotencyKey: 'key-create' });
      expect(Object.keys(sentOptions ?? {})).not.toContain('idempotent');
      expect(Object.keys(sentOptions ?? {})).not.toContain('timeoutMode');
    });

    it('sends timeoutMode file on the four slow drawing writes and not on the three fast calls', async () => {
      const http = createHttpMock({
        [`GET ${ENDPOINTS.drawings.progress('project-1', 'upload-1')}`]: sampleProgress,
        [`POST ${ENDPOINTS.drawings.initUpload('project-1', 'floor-1')}`]: sampleProgress,
        [`POST ${ENDPOINTS.drawings.chunk('project-1', 'upload-1')}`]: sampleProgress,
        [`POST ${ENDPOINTS.drawings.complete('project-1', 'upload-1')}`]: sampleProgress,
      });
      const client = createApiClient(http);
      const corners = [
        { xRatio: 0.1, yRatio: 0.1 },
        { xRatio: 0.9, yRatio: 0.1 },
        { xRatio: 0.9, yRatio: 0.9 },
        { xRatio: 0.1, yRatio: 0.9 },
      ] as const;

      await client.drawings.sendChunk({
        body: { chunk: 'chunk-1', chunkIndex: 0 },
        projectId: 'project-1',
        uploadId: 'upload-1',
      });
      await client.drawings.complete({ body: { uploadId: 'upload-1' }, projectId: 'project-1' });
      await client.quality.setCorners({
        body: { corners: [...corners] },
        floorId: 'floor-1',
        idempotencyKey: 'key-corners',
        projectId: 'project-1',
      });
      await client.quality.straighten({ floorId: 'floor-1', idempotencyKey: 'key-straighten', projectId: 'project-1' });

      const sentOptions = (path: string): Record<string, unknown> | undefined =>
        vi.mocked(http.post).mock.calls.find(([sentPath]) => sentPath === path)?.[1] as
          | Record<string, unknown>
          | undefined;

      expect(sentOptions(ENDPOINTS.drawings.chunk('project-1', 'upload-1'))?.timeoutMode).toBe('file');
      expect(sentOptions(ENDPOINTS.drawings.complete('project-1', 'upload-1'))?.timeoutMode).toBe('file');
      expect(sentOptions(ENDPOINTS.quality.corners('project-1', 'floor-1'))?.timeoutMode).toBe('file');
      expect(sentOptions(ENDPOINTS.quality.straighten('project-1', 'floor-1'))?.timeoutMode).toBe('file');
      expect(sentOptions(ENDPOINTS.quality.corners('project-1', 'floor-1'))?.idempotencyKey).toBe('key-corners');

      await client.drawings.initUpload({
        body: { fileName: 'a.png', floorId: 'floor-1', mimeType: 'image/png', projectId: 'project-1', sizeBytes: 1 },
      });
      await client.drawings.progress({ projectId: 'project-1', uploadId: 'upload-1' });
      await client.quality.assess({ floorId: 'floor-1', projectId: 'project-1' });

      expect(Object.keys(sentOptions(ENDPOINTS.drawings.initUpload('project-1', 'floor-1')) ?? {})).not.toContain(
        'timeoutMode',
      );
      expect(http.get).toHaveBeenCalledWith(ENDPOINTS.drawings.progress('project-1', 'upload-1'), undefined);
      expect(http.get).toHaveBeenCalledWith(ENDPOINTS.quality.assess('project-1', 'floor-1'), undefined);
    });
  });
});

describe('ruleConfig (N21, N22 — F-10)', () => {
  const wireConfig = {
    overrides: { GENERAL: { thresholds: { 'general.jointToleranceMm': 25 } }, 'WALL-THICKNESS': { enabled: false } },
    revision: 4,
  };

  it('read GETs /projects/{id}/rule-config and decodes ProjectRuleConfigSchema', async () => {
    const http = createHttpMock({ [`GET ${ENDPOINTS.ruleConfig.read('project-1')}`]: wireConfig });

    const result = await createApiClient(http).ruleConfig.read({ projectId: 'project-1' });

    expect(ENDPOINTS.ruleConfig.read('project-1')).toBe('/projects/project-1/rule-config');
    expect(http.get).toHaveBeenCalledWith('/projects/project-1/rule-config', undefined);
    expect(result).toEqual({ data: wireConfig, ok: true });
  });

  it('replace PUTs {baseVersion, body: {overrides}} on the same path', async () => {
    const http = createHttpMock({ [`PUT ${ENDPOINTS.ruleConfig.replace('project-1')}`]: { ...wireConfig, revision: 5 } });

    const result = await createApiClient(http).ruleConfig.replace({
      baseVersion: 4,
      body: { overrides: wireConfig.overrides },
      projectId: 'project-1',
    });

    expect(http.put).toHaveBeenCalledWith(
      '/projects/project-1/rule-config',
      expect.objectContaining({ body: { baseVersion: 4, body: { overrides: wireConfig.overrides } } }),
    );
    expect(result).toEqual({ data: { ...wireConfig, revision: 5 }, ok: true });
  });
});
