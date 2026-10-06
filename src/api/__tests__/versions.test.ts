import { describe, expect, it, vi } from 'vitest';

import type { HttpClient, HttpError, Result } from '@/lib/http';

import { createApiClient } from '../client';
import { ENDPOINTS } from '../endpoints';
import { createMockApiClient } from '../__mocks__/client';
import { FloorVersionSnapshotSchema, FloorVersionSummarySchema } from '../schemas/versions';

const ok = <T>(data: T): Result<T, HttpError> => ({ ok: true, data });

const SUMMARY = {
  createdAt: '2026-09-08T08:50:00.000Z',
  creatorId: 'system:pipeline',
  creatorName: 'hệ thống AI',
  floorRevision: 5,
  hasSnapshot: true,
  id: 'ver_01J9ZV8Q3M7X5B2N4K6P8R0T3C',
  label: 'Bản gửi chủ đầu tư',
  sequence: 3,
};

/** Một HttpClient ghi lại lượt gọi; mỗi phương thức trả `reply`. */
function recordingHttp(reply: unknown) {
  const calls: { method: string; path: string; options: unknown }[] = [];
  const make =
    (method: string) =>
    async <T,>(path: string, options?: unknown): Promise<Result<T, HttpError>> => {
      calls.push({ method, options, path });

      return ok(reply) as Result<T, HttpError>;
    };
  const http: HttpClient = {
    delete: make('DELETE'),
    events: { emit: () => undefined, on: () => () => undefined },
    get: make('GET'),
    getRecentRequests: () => [],
    patch: make('PATCH'),
    post: make('POST'),
    put: make('PUT'),
  };

  return { calls, http };
}

describe('ApiClient.versions — N17–N20', () => {
  it('list: GET, floorId/cursor/limit đi qua query, giải mã từng mục; mục hỏng bị bỏ', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    // Một mục hỏng trên sáu (dưới ngưỡng 20 % của `safeParseList`).
    const good = [1, 2, 3, 4, 5].map((sequence) => ({ ...SUMMARY, sequence }));
    const { calls, http } = recordingHttp({ items: [...good, { id: 'hong' }], nextCursor: 'c-2' });
    const result = await createApiClient(http).versions.list({
      cursor: 'c-1',
      floorId: 'L-LEVEL000001',
      limit: 50,
      projectId: 'project-1',
    });

    expect(calls[0]).toEqual({
      method: 'GET',
      options: { query: { cursor: 'c-1', floorId: 'L-LEVEL000001', limit: 50 } },
      path: ENDPOINTS.versions.list('project-1'),
    });
    expect(result).toEqual({
      data: { items: good.map((item) => FloorVersionSummarySchema.parse(item)), nextCursor: 'c-2' },
      ok: true,
    });
    warn.mockRestore();
  });

  it('list: phong bì sai → lỗi hợp đồng', async () => {
    const { http } = recordingHttp({ items: 'khong-phai-mang' });
    const result = await createApiClient(http).versions.list({ floorId: 'L-LEVEL000001', projectId: 'project-1' });

    expect(result.ok).toBe(false);
  });

  it('snapshot: GET kèm query floorId, giải mã FloorVersionSnapshotSchema', async () => {
    const body = { dimensions: [], layer: { furniture: [], openings: [], rooms: [], walls: [] }, versionId: SUMMARY.id };
    const { calls, http } = recordingHttp(body);
    const result = await createApiClient(http).versions.snapshot({
      floorId: 'L-LEVEL000001',
      projectId: 'project-1',
      versionId: SUMMARY.id,
    });

    expect(calls[0]?.path).toBe(ENDPOINTS.versions.snapshot('project-1', SUMMARY.id));
    expect(calls[0]?.options).toEqual({ query: { floorId: 'L-LEVEL000001' } });
    expect(result).toEqual({ data: FloorVersionSnapshotSchema.parse(body), ok: true });
  });

  it('restore: POST {baseVersion, body:{floorId}}', async () => {
    const { calls, http } = recordingHttp(SUMMARY);
    const result = await createApiClient(http).versions.restore({
      baseVersion: 5,
      floorId: 'L-LEVEL000001',
      idempotencyKey: 'k-1',
      projectId: 'project-1',
      versionId: SUMMARY.id,
    });

    expect(calls[0]).toEqual({
      method: 'POST',
      options: { body: { baseVersion: 5, body: { floorId: 'L-LEVEL000001' } }, idempotencyKey: 'k-1' },
      path: ENDPOINTS.versions.restore('project-1', SUMMARY.id),
    });
    expect(result.ok && result.data.floorRevision).toBe(5);
  });

  it('label: PATCH {label}', async () => {
    const { calls, http } = recordingHttp(SUMMARY);

    await createApiClient(http).versions.label({ label: '', projectId: 'project-1', versionId: SUMMARY.id });

    expect(calls[0]).toEqual({
      method: 'PATCH',
      options: { body: { label: '' } },
      path: ENDPOINTS.versions.label('project-1', SUMMARY.id),
    });
  });
});

describe('mock versions — đúng schema', () => {
  it('list, snapshot, restore, label đều qua schema', async () => {
    const client = createMockApiClient();
    const floors = await client.floors.list({ projectId: 'project-1' });
    const floorId = floors.ok ? (floors.data[0]?.id ?? '') : '';
    const page = await client.versions.list({ floorId, limit: 2, projectId: 'project-1' });

    expect(page.ok).toBe(true);
    if (!page.ok) return;

    page.data.items.forEach((item) => FloorVersionSummarySchema.parse(item));
    expect(page.data.nextCursor).toBe('2');

    const [newest, older] = page.data.items;
    const snapshot = await client.versions.snapshot({ floorId, projectId: 'project-1', versionId: older?.id ?? '' });

    expect(snapshot.ok && FloorVersionSnapshotSchema.parse(snapshot.data).versionId).toBe(older?.id);

    const restored = await client.versions.restore({ baseVersion: 0, floorId, projectId: 'project-1', versionId: older?.id ?? '' });

    expect(restored.ok && FloorVersionSummarySchema.parse(restored.data).sequence).toBe((newest?.sequence ?? 0) + 1);

    const stale = await client.versions.restore({ baseVersion: 0, floorId, projectId: 'project-1', versionId: older?.id ?? '' });

    expect(stale.ok).toBe(false);

    const labelled = await client.versions.label({ label: 'Mốc duyệt', projectId: 'project-1', versionId: older?.id ?? '' });

    expect(labelled.ok && FloorVersionSummarySchema.parse(labelled.data).label).toBe('Mốc duyệt');

    const cleared = await client.versions.label({ label: '', projectId: 'project-1', versionId: older?.id ?? '' });

    expect(cleared.ok && 'label' in cleared.data).toBe(false);
  });
});
