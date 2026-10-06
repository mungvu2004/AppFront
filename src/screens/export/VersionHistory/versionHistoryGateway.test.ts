import { describe, expect, it, vi } from 'vitest';

import { createApiClient } from '@/api/client';
import { FloorVersionSummarySchema } from '@/api/schemas/versions';
import * as Conflict from '@/lib/versioning/conflict';

import {
  createVersionsServerFake,
  WIRE_FLOOR_ID,
  WIRE_PROJECT_ID,
  WIRE_VERSION_IDS,
  wireError,
  wireSummaries,
  type VersionsServerFake,
} from './versionHistoryFixtures';
import { UNDO_WINDOW_MS } from '@/lib/mutations/undoTicket';
import { FAKE_CLOCK_START } from '@/lib/testing/fakeClock';

import {
  CONFLICT_TITLE,
  createVersionHistoryGateway,
  UNDO_EXPIRED_NOTICE,
  UNDO_USED_NOTICE,
  VERSION_PAGE_LIMIT,
} from './versionHistoryGateway';

function gatewayOn(server: VersionsServerFake) {
  return createVersionHistoryGateway({
    apiClient: createApiClient(server.http),
    floorId: WIRE_FLOOR_ID,
    projectId: WIRE_PROJECT_ID,
  });
}

const callsTo = (server: VersionsServerFake, method: string, suffix: string) =>
  server.calls.filter((call) => call.method === method && call.path.endsWith(suffix));

describe('N17 — listVersionPage', () => {
  it('gửi floorId, limit 50; trang sau dùng nextCursor', async () => {
    const server = createVersionsServerFake();

    server.override('GET list', ({ query }) =>
      query.cursor === undefined
        ? { data: { items: wireSummaries().slice(0, 2), nextCursor: 'c-2' }, ok: true }
        : { data: { items: wireSummaries().slice(2) }, ok: true },
    );
    const gateway = gatewayOn(server);

    const first = await gateway.listVersionPage({});
    const second = await gateway.listVersionPage({ cursor: first.nextCursor ?? '' });

    expect(server.calls[0]?.query).toEqual({ floorId: WIRE_FLOOR_ID, limit: VERSION_PAGE_LIMIT });
    expect(VERSION_PAGE_LIMIT).toBe(50);
    expect(server.calls[1]?.query).toEqual({ cursor: 'c-2', floorId: WIRE_FLOOR_ID, limit: 50 });
    expect(first.items.map((item) => item.sequence)).toEqual([3, 2]);
    expect(second.items.map((item) => item.sequence)).toEqual([1]);
    expect(second.nextCursor).toBeUndefined();
  });

  it('CURSOR_INVALID → đọc lại trang đầu đúng một lần', async () => {
    const server = createVersionsServerFake();

    server.override('GET list', ({ query }) =>
      query.cursor === undefined
        ? { data: { items: wireSummaries() }, ok: true }
        : { error: wireError(422, 'CURSOR_INVALID'), ok: false },
    );

    const page = await gatewayOn(server).listVersionPage({ cursor: 'het-han' });

    expect(server.calls).toHaveLength(2);
    expect(server.calls[1]?.query.cursor).toBeUndefined();
    expect(page.items).toHaveLength(3);
  });

  it('lỗi khác ném AppError giữ code; listVersions giữ chữ ký cũ', async () => {
    const server = createVersionsServerFake();
    const gateway = gatewayOn(server);

    expect((await gateway.listVersions(WIRE_FLOOR_ID)).every((entry) => entry.kind === 'metadataOnly')).toBe(true);

    server.override('GET list', () => ({ error: wireError(404, 'NOT_FOUND', { resource: 'floor' }), ok: false }));
    await expect(gateway.listVersionPage({})).rejects.toMatchObject({ code: 'NOT_FOUND', params: { resource: 'floor' } });
  });
});

describe('N18 — readSnapshot', () => {
  it('nạp nội dung qua bộ đổi §1.3', async () => {
    const read = await gatewayOn(createVersionsServerFake()).readSnapshot(WIRE_VERSION_IDS.v2);

    expect(read.kind).toBe('snapshot');
    expect(read.kind === 'snapshot' ? read.snapshot.wall['W-WALL000001'] : null).toMatchObject({ thickness_mm: 200 });
  });

  it.each(['VERSION_SNAPSHOT_PURGED', 'VERSION_FLOOR_MISMATCH'])('%s → purged, không ném', async (code) => {
    const server = createVersionsServerFake();

    server.override('GET snapshot', () => ({ error: wireError(422, code), ok: false }));

    await expect(gatewayOn(server).readSnapshot(WIRE_VERSION_IDS.v2)).resolves.toEqual({ kind: 'purged' });
  });

  it('diff đọc hai bản và so; bản hết nội dung thì ném', async () => {
    const server = createVersionsServerFake();
    const gateway = gatewayOn(server);
    const diff = await gateway.diff(WIRE_VERSION_IDS.v2, WIRE_VERSION_IDS.v3);

    expect(diff.changed.some((entry) => entry.field === 'thickness_mm')).toBe(true);

    server.override('GET snapshot', () => ({ error: wireError(422, 'VERSION_SNAPSHOT_PURGED'), ok: false }));
    await expect(gateway.diff(WIRE_VERSION_IDS.v2, WIRE_VERSION_IDS.v3)).rejects.toThrow();
  });
});

describe('N19 — restore', () => {
  it('gửi baseVersion = revision truyền vào (không phải sequence); 201 và 200 cho cùng kết quả', async () => {
    const server = createVersionsServerFake(7);
    const created = await gatewayOn(server).restore(WIRE_VERSION_IDS.v2, 7);

    expect(callsTo(server, 'POST', '/restore')[0]?.body).toEqual({ baseVersion: 7, body: { floorId: WIRE_FLOOR_ID } });
    expect(created).toMatchObject({ kind: 'restored', floorRevision: 8, restoredVersionId: WIRE_VERSION_IDS.v4, unchanged: false });
    expect(created.undoTicket?.getStatus()).toBe('active');

    // Lặp C09b: 200 cùng thân — tầng HTTP không phân biệt 200/201, cổng cũng không.
    const replay = createVersionsServerFake(7);
    const body = {
      createdAt: '2026-09-08T09:00:00.000Z',
      creatorId: 'system:pipeline',
      creatorName: 'hệ thống AI',
      floorRevision: 8,
      hasSnapshot: true,
      id: WIRE_VERSION_IDS.v4,
      sequence: 4,
    };

    expect(FloorVersionSummarySchema.parse(body).floorRevision).toBe(8);
    replay.override('POST restore', () => ({ data: body, ok: true }));
    const again = await gatewayOn(replay).restore(WIRE_VERSION_IDS.v2, 7);

    expect({ ...again, undoTicket: undefined }).toEqual({ ...created, undoTicket: undefined });
  });

  it('floorRevision bằng baseVersion → unchanged, không phiếu hoàn tác', async () => {
    const server = createVersionsServerFake(5);

    server.override('POST restore', () => ({ data: { ...wireSummaries()[0], id: WIRE_VERSION_IDS.v4, sequence: 4 }, ok: true }));

    const outcome = await gatewayOn(server).restore(WIRE_VERSION_IDS.v3, 5);

    expect(outcome).toMatchObject({ kind: 'restored', unchanged: true, floorRevision: 5 });
    expect(outcome.undoTicket).toBeUndefined();
  });

  it('409 và 422 field:"baseVersion" → conflict có changedByName; resolveConflict không được gọi', async () => {
    const spy = vi.spyOn(Conflict, 'resolveConflict');
    const server = createVersionsServerFake(5);

    server.override('POST restore', () => ({
      error: wireError(409, 'VERSION_CONFLICT', {
        currentVersion: 6,
        remoteChanges: [
          {
            changedAt: '2026-09-08T09:00:00.000Z',
            changedBy: 'usr_01J9ZQK7X4N2M8P6R3T5V7W9Y1',
            changedByName: 'Trần Minh',
            entityId: 'W-WALL000001',
            entityType: 'wall',
            field: 'thickness_mm',
            value: 240,
          },
        ],
      }),
      ok: false,
    }));
    const conflict = await gatewayOn(server).restore(WIRE_VERSION_IDS.v2, 5);

    expect(conflict.kind).toBe('conflict');
    // Tiêu đề cố định (prompt 4.3); tên người nằm trong câu thân.
    expect(conflict.conflict?.actorName).toBe(CONFLICT_TITLE);
    expect(CONFLICT_TITLE).toBe('Tầng vừa đổi ở nơi khác');
    expect(conflict.conflict?.message).toContain('Trần Minh');

    server.override('POST restore', () => ({ error: wireError(422, 'VALIDATION', { field: 'baseVersion' }), ok: false }));
    const ahead = await gatewayOn(server).restore(WIRE_VERSION_IDS.v2, 9);

    expect(ahead.kind).toBe('conflict');
    expect(ahead.conflict?.actorName).toBe(CONFLICT_TITLE);
    expect(ahead.conflict?.message.startsWith('Người khác đã sửa tầng này')).toBe(true);
    expect(spy).not.toHaveBeenCalled();
    spy.mockRestore();
  });

  it.each([
    ['VERSION_SNAPSHOT_PURGED', 422, {}],
    ['VERSION_FLOOR_MISMATCH', 422, { field: 'body.floorId' }],
    ['VALIDATION', 422, {}],
    ['REVIEW_BY_AI_FORBIDDEN', 422, {}],
    ['LAYER_INTEGRITY_BROKEN', 422, {}],
    ['FORBIDDEN', 403, {}],
  ] as const)('N19 %s → ném AppError giữ code', async (code, status, extra) => {
    const server = createVersionsServerFake(5);

    server.override('POST restore', () => ({ error: wireError(status, code, extra), ok: false }));

    await expect(gatewayOn(server).restore(WIRE_VERSION_IDS.v2, 5)).rejects.toMatchObject({ code });
  });

  it('N20 field:"label" → ném AppError giữ code', async () => {
    const server = createVersionsServerFake();

    server.override('PATCH label', () => ({ error: wireError(422, 'VALIDATION', { field: 'label' }), ok: false }));

    await expect(gatewayOn(server).tagVersion?.(WIRE_VERSION_IDS.v2, 'x')).rejects.toMatchObject({
      code: 'VALIDATION',
      params: { field: 'label' },
    });
  });
});

describe('hoàn tác và nhãn', () => {
  it('hoàn tác chọn bản sequence liền dưới bản "sau", baseVersion = floorRevision của phản hồi N19', async () => {
    const server = createVersionsServerFake(5);
    const gateway = gatewayOn(server);
    const restored = await gateway.restore(WIRE_VERSION_IDS.v2, 5);
    const ticket = restored.undoTicket;

    expect(ticket).toBeDefined();
    if (ticket === undefined) return;

    const reverted = await gateway.revertRestore(ticket);
    const posts = callsTo(server, 'POST', '/restore');

    expect(posts[1]?.path).toContain(WIRE_VERSION_IDS.v3);
    expect(posts[1]?.body).toEqual({ baseVersion: 6, body: { floorId: WIRE_FLOOR_ID } });
    expect(reverted).toMatchObject({ kind: 'restored', floorRevision: 7 });
    expect(ticket.getStatus()).toBe('used');
  });

  it('không tìm thấy đích → không gửi N19, trả conflict; undoRestore cũ ném', async () => {
    const server = createVersionsServerFake(5);
    const gateway = gatewayOn(server);
    const restored = await gateway.restore(WIRE_VERSION_IDS.v2, 5);

    server.override('GET list', () => ({ data: { items: [] }, ok: true }));

    const ticket = restored.undoTicket;

    if (ticket === undefined) throw new Error('thiếu phiếu');

    await expect(gateway.undoRestore(ticket)).rejects.toThrow();
    expect(callsTo(server, 'POST', '/restore')).toHaveLength(1);
  });

  it('phiếu hết hạn → không gửi N19, câu "Đã hết thời gian hoàn tác", không đổ cho người khác', async () => {
    let offset = 0;
    const server = createVersionsServerFake(5);
    const gateway = createVersionHistoryGateway({
      apiClient: createApiClient(server.http),
      floorId: WIRE_FLOOR_ID,
      now: () => new Date(FAKE_CLOCK_START.getTime() + offset),
      projectId: WIRE_PROJECT_ID,
    });
    const ticket = (await gateway.restore(WIRE_VERSION_IDS.v2, 5)).undoTicket;

    if (ticket === undefined) throw new Error('thiếu phiếu');

    offset = UNDO_WINDOW_MS + 1;
    const outcome = await gateway.revertRestore(ticket);

    expect(outcome).toEqual({ kind: 'conflict', conflict: UNDO_EXPIRED_NOTICE });
    expect(UNDO_EXPIRED_NOTICE.actorName).toBe('Đã hết thời gian hoàn tác');
    expect(callsTo(server, 'POST', '/restore')).toHaveLength(1);
  });

  it('bấm "Hoàn tác" hai lần → lượt hai không gửi N19, câu "đã được hoàn tác", không "hết thời gian"', async () => {
    const server = createVersionsServerFake(5);
    const gateway = gatewayOn(server);
    const ticket = (await gateway.restore(WIRE_VERSION_IDS.v2, 5)).undoTicket;

    if (ticket === undefined) throw new Error('thiếu phiếu');

    const [first, second] = await Promise.all([gateway.revertRestore(ticket), gateway.revertRestore(ticket)]);

    expect(first).toMatchObject({ kind: 'restored' });
    expect(second).toEqual({ kind: 'conflict', conflict: UNDO_USED_NOTICE });
    expect(callsTo(server, 'POST', '/restore')).toHaveLength(2);
  });

  it('undoRestore cũ: chạy hoàn tác rồi trả trang đầu', async () => {
    const server = createVersionsServerFake(5);
    const gateway = gatewayOn(server);
    const ticket = (await gateway.restore(WIRE_VERSION_IDS.v2, 5)).undoTicket;

    if (ticket === undefined) throw new Error('thiếu phiếu');

    const entries = await gateway.undoRestore(ticket);

    expect(entries[0]?.version.sequence).toBe(5);
  });

  it('N20 gửi nhãn; "" là gỡ nhãn', async () => {
    const server = createVersionsServerFake();
    const gateway = gatewayOn(server);

    await gateway.tagVersion?.(WIRE_VERSION_IDS.v2, '');

    expect(callsTo(server, 'PATCH', '/label')[0]?.body).toEqual({ label: '' });
  });

  it('readFloorLayer trả lớp và revision của N16', async () => {
    const read = await gatewayOn(createVersionsServerFake(9)).readFloorLayer();

    expect(read.revision).toBe(9);
    expect(read.layer.walls).toHaveLength(2);
  });
});
