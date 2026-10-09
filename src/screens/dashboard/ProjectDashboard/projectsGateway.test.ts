import { describe, expect, it, vi } from 'vitest';

import type { ApiResult, ProjectSummaryList } from '@/api/client';
import { ProjectSummarySchema, type ProjectSummary } from '@/api/schemas/projectSummaries';
import { createApiClient } from '@/api/client';
import type { HttpClient, HttpError } from '@/lib/http';

import { createProjectsGateway, planVariantOf } from './projectsGateway';

const ID_A = `prj_${'0'.repeat(25)}A`;
const ID_B = `prj_${'0'.repeat(25)}B`;
const USER_ID = `usr_${'0'.repeat(25)}A`;

/** Wire body, then decoded by the real schema — the client hands the gateway decoded rows. */
function summary(id: string, name: string, updatedAt: string, members: { id: string; name: string }[] = []): ProjectSummary {
  return ProjectSummarySchema.parse({
    areaM2: 120.5,
    defaultFloorId: 'floor-1',
    floorCount: 2,
    id,
    members,
    name,
    status: 'processing',
    updatedAt,
    wallsReviewedCount: 0,
    wallsTotalCount: 10,
  });
}

function page(items: ProjectSummary[], nextCursor?: string, droppedCount = 0): ApiResult<ProjectSummaryList> {
  return { ok: true, data: { items, droppedCount, ...(nextCursor !== undefined ? { nextCursor } : {}) } };
}

function httpError(status: number, code: string): HttpError {
  return { kind: 'http', status, code, requestId: 'req-1', retryable: false, raw: {} };
}

function clientWith(list: ReturnType<typeof vi.fn>, projects: Partial<Record<'update' | 'delete', ReturnType<typeof vi.fn>>> = {}) {
  return {
    projectSummaries: { list },
    projects: {
      create: vi.fn(),
      list: vi.fn(),
      read: vi.fn(),
      update: projects.update ?? vi.fn(),
      delete: projects.delete ?? vi.fn(),
    },
  };
}

describe('createProjectsGateway.listSummaries', () => {
  it('reads every cursor page and sorts newest first', async () => {
    const older = summary(ID_A, 'Công trình cũ', '2026-01-01T00:00:00.000Z');
    const newer = summary(ID_B, 'Công trình mới', '2026-02-01T00:00:00.000Z');
    const list = vi.fn().mockResolvedValueOnce(page([older], 'c1')).mockResolvedValueOnce(page([newer]));

    const result = await createProjectsGateway(clientWith(list)).listSummaries();

    expect(result.projects.map((project) => project.id)).toEqual([ID_B, ID_A]);
    expect(result.projects[0]?.updatedAtMs).toBe(Date.parse('2026-02-01T00:00:00.000Z'));
    expect(list).toHaveBeenNthCalledWith(1, { limit: 500 });
    expect(list).toHaveBeenNthCalledWith(2, { limit: 500, cursor: 'c1' });
  });

  it('adds droppedCount across pages', async () => {
    const list = vi
      .fn()
      .mockResolvedValueOnce(page([summary(ID_A, 'Công trình A', '2026-01-01T00:00:00.000Z')], 'c1', 1))
      .mockResolvedValueOnce(page([], undefined, 2));

    const result = await createProjectsGateway(clientWith(list)).listSummaries();

    expect(result.droppedCount).toBe(3);
    expect(result.projects).toHaveLength(1);
  });

  it('starts over once on CURSOR_INVALID, then throws the original error', async () => {
    const invalid = httpError(422, 'CURSOR_INVALID');
    const first = vi
      .fn()
      .mockResolvedValueOnce(page([summary(ID_A, 'Công trình A', '2026-01-01T00:00:00.000Z')], 'c1'))
      .mockResolvedValueOnce({ ok: false, error: invalid })
      .mockResolvedValueOnce(page([summary(ID_A, 'Công trình A', '2026-01-01T00:00:00.000Z')]));
    await expect(createProjectsGateway(clientWith(first)).listSummaries()).resolves.toMatchObject({
      projects: [{ id: ID_A }],
    });
    expect(first).toHaveBeenCalledTimes(3);

    const always = vi.fn().mockResolvedValue({ ok: false, error: invalid });
    await expect(createProjectsGateway(clientWith(always)).listSummaries()).rejects.toBe(invalid);
    expect(always).toHaveBeenCalledTimes(2);
  });

  it('throws other errors untouched, without a second read', async () => {
    const down = httpError(503, 'DEPENDENCY_UNAVAILABLE');
    const list = vi.fn().mockResolvedValue({ ok: false, error: down });

    await expect(createProjectsGateway(clientWith(list)).listSummaries()).rejects.toBe(down);
    expect(list).toHaveBeenCalledTimes(1);
  });

  it('passes the abort signal through', async () => {
    const list = vi.fn().mockResolvedValue(page([]));
    const { signal } = new AbortController();

    await createProjectsGateway(clientWith(list)).listSummaries(signal);

    expect(list).toHaveBeenCalledWith({ limit: 500, signal });
  });

  it('builds initials and omits defaultFloorId for a project with no floor', async () => {
    const withFloor = summary(ID_A, 'Tòa nhà HQ', '2026-01-01T00:00:00.000Z', [{ id: USER_ID, name: 'Phạm An' }]);
    const noFloor = ProjectSummarySchema.parse({
      areaM2: 0,
      floorCount: 0,
      id: ID_B,
      members: [],
      name: 'Dự án trống',
      status: 'processing',
      updatedAt: '2025-01-01T00:00:00.000Z',
      wallsReviewedCount: 0,
      wallsTotalCount: 0,
    });
    const list = vi.fn().mockResolvedValue(page([withFloor, noFloor]));

    const { projects } = await createProjectsGateway(clientWith(list)).listSummaries();

    expect(projects[0]?.members).toEqual([{ id: USER_ID, initials: 'PA' }]);
    expect(projects[0]?.defaultFloorId).toBe('floor-1');
    expect(projects[1]).not.toHaveProperty('defaultFloorId');
  });
});

describe('createProjectsGateway on the real createApiClient', () => {
  const wireRow = (id: string, over: Record<string, unknown> = {}): Record<string, unknown> => ({
    areaM2: 1,
    defaultFloorId: 'L-01',
    floorCount: 1,
    id,
    members: [],
    name: 'Công trình',
    status: 'qc',
    updatedAt: '2026-01-01T00:00:00.000Z',
    wallsReviewedCount: 0,
    wallsTotalCount: 1,
    ...over,
  });
  const httpReturning = (items: unknown[]): HttpClient =>
    ({
      get: async () => ({ ok: true, data: { items } }),
    }) as unknown as HttpClient;

  it('counts 1 broken row in 10 as droppedCount 1', async () => {
    const items = Array.from({ length: 9 }, (_, i) => wireRow(`prj_${'0'.repeat(24)}${String(i).padStart(2, '0')}`));
    items.push(wireRow(ID_B, { name: 'x' }));

    const result = await createProjectsGateway(createApiClient(httpReturning(items))).listSummaries();

    expect(result.droppedCount).toBe(1);
    expect(result.projects).toHaveLength(9);
  });

  it('throws when 2 of 3 rows are broken', async () => {
    const items = [wireRow(ID_A), wireRow(ID_B, { name: 'x' }), wireRow(ID_B, { name: 'y' })];

    await expect(createProjectsGateway(createApiClient(httpReturning(items))).listSummaries()).rejects.toBeDefined();
  });
});

describe('createProjectsGateway rename / remove', () => {
  it('rename sends only the name to #26 and throws the original error', async () => {
    const update = vi.fn().mockResolvedValueOnce({ ok: true, data: {} });
    const gateway = createProjectsGateway(clientWith(vi.fn(), { update }));

    await gateway.rename(ID_A, 'Tên mới');
    expect(update).toHaveBeenCalledWith({ projectId: ID_A, body: { name: 'Tên mới' } });

    const refused = httpError(403, 'FORBIDDEN');
    update.mockResolvedValueOnce({ ok: false, error: refused });
    await expect(gateway.rename(ID_A, 'Tên khác')).rejects.toBe(refused);
  });

  it('remove calls #27 and throws the original error', async () => {
    const del = vi.fn().mockResolvedValueOnce({ ok: true, data: {} });
    const gateway = createProjectsGateway(clientWith(vi.fn(), { delete: del }));

    await gateway.remove(ID_A);
    expect(del).toHaveBeenCalledWith({ projectId: ID_A });

    const gone = httpError(404, 'NOT_FOUND');
    del.mockResolvedValueOnce({ ok: false, error: gone });
    await expect(gateway.remove(ID_A)).rejects.toBe(gone);
  });
});

// `initialsOf` sống ở `@/lib/format/initials` — test của nó ở `lib/format/__tests__/initials.test.ts`.
describe('planVariantOf', () => {
  it('is deterministic and stays within the four outlines', () => {
    expect(planVariantOf(ID_A)).toBe(planVariantOf(ID_A));
    for (const id of [ID_A, ID_B, USER_ID, 'x']) expect([0, 1, 2, 3]).toContain(planVariantOf(id));
  });
});
