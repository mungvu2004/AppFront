import { describe, expect, it } from 'vitest';

import type { HttpClient, HttpError, HttpRequestOptions, Result } from '@/lib/http';

import { createMockApiClient, MOCK_PROJECT_SUMMARIES } from '../__mocks__/client';
import { createApiClient } from '../client';
import { ENDPOINTS } from '../endpoints';
import { UserSchema } from '../schemas';
import { ProjectSettingsSchema, UpdateProjectSettingsSchema } from '../schemas/projectSettings';
import { ProjectSummarySchema } from '../schemas/projectSummaries';

const PROJECT_ID = 'prj_01HZX3K9M2Q4R6T8V0W1Y3A5C7';
const OTHER_ID = 'prj_01HZX3K9M2Q4R6T8V0W1Y3A5C8';
const USER_ID = 'usr_01HZX3K9M2Q4R6T8V0W1Y3A5C1';

const summaryWire = (id: string, overrides: Record<string, unknown> = {}): Record<string, unknown> => ({
  areaM2: 120.5,
  defaultFloorId: 'L-01',
  floorCount: 2,
  id,
  members: [{ id: USER_ID, name: 'Admin' }],
  name: 'Nhà phố',
  status: 'qc',
  updatedAt: '2026-09-03T08:00:00.000Z',
  wallsReviewedCount: 3,
  wallsTotalCount: 10,
  ...overrides,
});

const userWire = { email: 'a@example.com', id: USER_ID, name: 'An', role: 'viewer' };

const settingsBody = {
  buildingType: 'residential',
  confidenceThreshold: 0.8,
  defaultScaleMmPerPx: 1,
  lengthUnit: 'mm',
  snapToleranceMm: 20,
} as const;

interface Call {
  method: string;
  options: HttpRequestOptions<unknown> | undefined;
  path: string;
}

const createFake = (reply: (call: Call) => Result<unknown, HttpError>): { calls: Call[]; http: HttpClient } => {
  const calls: Call[] = [];
  const handle =
    (method: string) =>
    async <T, B = undefined>(path: string, options?: HttpRequestOptions<B>): Promise<Result<T, HttpError>> => {
      const call = { method, options, path };

      calls.push(call);

      const result = reply(call);

      return result.ok ? { data: result.data as T, ok: true } : result;
    };

  return {
    calls,
    http: {
      delete: handle('DELETE'),
      events: { emit: () => undefined, on: () => () => undefined },
      get: handle('GET'),
      getRecentRequests: () => [],
      patch: handle('PATCH'),
      post: handle('POST'),
      put: handle('PUT'),
    },
  };
};

const ok = (data: unknown): Result<unknown, HttpError> => ({ data, ok: true });

describe('projectSummaries.list (N1)', () => {
  it('sends cursor and limit as query, and returns nextCursor with droppedCount 0', async () => {
    const wire = { items: [summaryWire(PROJECT_ID)], nextCursor: 'c2' };

    expect(ProjectSummarySchema.safeParse(wire.items[0]).success).toBe(true);

    const { calls, http } = createFake(() => ok(wire));
    const result = await createApiClient(http).projectSummaries.list({ cursor: 'c1', limit: 500 });

    expect(calls[0]?.path).toBe(ENDPOINTS.projectSummaries.list);
    expect(calls[0]?.options?.query).toEqual({ cursor: 'c1', limit: 500 });
    expect(result).toMatchObject({ data: { droppedCount: 0, nextCursor: 'c2' }, ok: true });
    expect(result.ok && result.data.items.map((item) => item.id)).toEqual([PROJECT_ID]);
  });

  it('omits absent query keys and a nextCursor that is not on the wire', async () => {
    const { calls, http } = createFake(() => ok({ items: [] }));
    const result = await createApiClient(http).projectSummaries.list();

    expect(calls[0]?.options?.query).toEqual({});
    expect(result).toStrictEqual({ data: { droppedCount: 0, items: [] }, ok: true });
  });

  it('drops a broken row and counts it', async () => {
    const good = Array.from({ length: 9 }, () => summaryWire(PROJECT_ID));
    const { http } = createFake(() => ok({ items: [...good, summaryWire(OTHER_ID, { name: 'x' })] }));
    const result = await createApiClient(http).projectSummaries.list();

    expect(result.ok && result.data.droppedCount).toBe(1);
    expect(result.ok && result.data.items).toHaveLength(9);
  });

  it('returns the error when more than 20% of rows are broken', async () => {
    const items = [summaryWire(PROJECT_ID), summaryWire(OTHER_ID, { name: 'x' }), summaryWire(OTHER_ID, { name: 'y' })];
    const { http } = createFake(() => ok({ items }));

    expect((await createApiClient(http).projectSummaries.list()).ok).toBe(false);
  });

  it('returns a malformed envelope as an error and passes transport errors through', async () => {
    const malformed = createFake(() => ok({ rows: [] }));
    const transport: HttpError = {
      code: 'CURSOR_INVALID',
      kind: 'http',
      raw: {},
      requestId: 'r',
      retryable: false,
      status: 422,
    };
    const failing = createFake(() => ({ error: transport, ok: false }));

    expect((await createApiClient(malformed.http).projectSummaries.list()).ok).toBe(false);
    expect(await createApiClient(failing.http).projectSummaries.list()).toStrictEqual({ error: transport, ok: false });
  });
});

describe('members (N3, N4)', () => {
  it('add posts the email with idempotencyKey as a transport option', async () => {
    expect(UserSchema.safeParse(userWire).success).toBe(true);

    const { calls, http } = createFake(() => ok(userWire));
    const result = await createApiClient(http).members.add({
      email: 'a@example.com',
      idempotencyKey: 'key-1',
      projectId: PROJECT_ID,
    });

    expect(calls[0]).toMatchObject({
      method: 'POST',
      options: { body: { email: 'a@example.com' }, idempotencyKey: 'key-1' },
      path: ENDPOINTS.members.add(PROJECT_ID),
    });
    expect(result).toMatchObject({ data: { id: USER_ID, role: 'viewer' }, ok: true });
  });

  it('remove deletes the member path', async () => {
    const { calls, http } = createFake(() => ok(userWire));
    const result = await createApiClient(http).members.remove({ projectId: PROJECT_ID, userId: USER_ID });

    expect(calls[0]).toMatchObject({ method: 'DELETE', path: `/projects/${PROJECT_ID}/members/${USER_ID}` });
    expect(result.ok).toBe(true);
  });
});

describe('projectSettings (N5, N6)', () => {
  it('read decodes the settings and keeps notes absent', async () => {
    const wire = { ...settingsBody, revision: 0 };

    expect(ProjectSettingsSchema.safeParse(wire).success).toBe(true);

    const { calls, http } = createFake(() => ok(wire));
    const result = await createApiClient(http).projectSettings.read({ projectId: PROJECT_ID });

    expect(calls[0]).toMatchObject({ method: 'GET', path: `/projects/${PROJECT_ID}/settings` });
    expect(result).toStrictEqual({ data: wire, ok: true });
  });

  it('replace is a full-body PUT of { baseVersion, body }', async () => {
    const sent = { baseVersion: 4, body: settingsBody };

    expect(UpdateProjectSettingsSchema.safeParse(sent).success).toBe(true);

    const { calls, http } = createFake(() => ok({ ...settingsBody, revision: 5 }));
    const result = await createApiClient(http).projectSettings.replace({ ...sent, projectId: PROJECT_ID });

    expect(calls[0]).toMatchObject({ method: 'PUT', options: { body: sent }, path: `/projects/${PROJECT_ID}/settings` });
    expect(result).toMatchObject({ data: { revision: 5 }, ok: true });
  });
});

describe('mock client', () => {
  it('serves all three statuses, a zero-floor project, and no dropped rows', async () => {
    const list = await createMockApiClient().projectSummaries.list();

    expect(list.ok && [...new Set(list.data.items.map((item) => item.status))].sort()).toEqual(['done', 'processing', 'qc']);
    expect(list.ok && list.data.items.some((item) => item.floorCount === 0)).toBe(true);
    expect(list.ok && list.data.droppedCount).toBe(0);
  });

  it('reflects #26 rename and #27 delete in the next summaries read', async () => {
    const client = createMockApiClient();

    await client.projects.update({ body: { name: 'Tên mới' }, projectId: PROJECT_ID });
    const renamed = await client.projectSummaries.list();

    expect(renamed.ok && renamed.data.items.find((item) => item.id === PROJECT_ID)?.name).toBe('Tên mới');

    await client.projects.delete({ projectId: PROJECT_ID });
    const after = await client.projectSummaries.list();

    expect(after.ok && after.data.items.some((item) => item.id === PROJECT_ID)).toBe(false);
    expect(after.ok && after.data.items).toHaveLength(MOCK_PROJECT_SUMMARIES.length - 1);
    // another client starts from the pristine list
    const fresh = await createMockApiClient().projectSummaries.list();

    expect(fresh.ok && fresh.data.items).toHaveLength(MOCK_PROJECT_SUMMARIES.length);
  });

  it('answers 409 VERSION_CONFLICT on a wrong baseVersion and bumps revision on a right one', async () => {
    const client = createMockApiClient();
    const read = await client.projectSettings.read({ projectId: PROJECT_ID });
    const revision = read.ok ? read.data.revision : -1;
    const stale = await client.projectSettings.replace({
      baseVersion: revision + 1,
      body: settingsBody,
      projectId: PROJECT_ID,
    });
    const fresh = await client.projectSettings.replace({
      baseVersion: revision,
      body: { ...settingsBody, notes: 'ghi chu' },
      projectId: PROJECT_ID,
    });
    const reread = await client.projectSettings.read({ projectId: PROJECT_ID });

    expect(!stale.ok && stale.error).toMatchObject({ code: 'VERSION_CONFLICT', status: 409 });
    expect(fresh.ok && fresh.data.revision).toBe(revision + 1);
    expect(reread.ok && reread.data).toMatchObject({ notes: 'ghi chu', revision: revision + 1 });
  });

  it('adds a known email and rejects an unknown one with 422 MEMBER_USER_UNAVAILABLE', async () => {
    const client = createMockApiClient();
    const added = await client.members.add({ email: ' Newcomer@Example.com ', projectId: PROJECT_ID });
    const unknown = await client.members.add({ email: 'nobody@example.com', projectId: PROJECT_ID });
    const removed = await client.members.remove({ projectId: PROJECT_ID, userId: USER_ID });

    expect(added.ok && added.data.email).toBe('newcomer@example.com');
    expect(!unknown.ok && unknown.error).toMatchObject({ code: 'MEMBER_USER_UNAVAILABLE', status: 422 });
    expect(added.ok && added.data.id).toMatch(/^usr_[0-9A-HJKMNP-TV-Z]{26}$/);
    expect(removed.ok && removed.data.id).toBe(USER_ID);
    expect(removed.ok && removed.data.name).not.toBe(PROJECT_ID);
  });
});
