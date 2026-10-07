import { describe, expect, it } from 'vitest';

import type { ApiResult } from '@/api/client';

import {
  createProjectSettingsGateway,
  type ProjectSettingsGateway,
  type ProjectSettingsSnapshot,
} from './projectSettingsGateway';
import {
  ADMIN_USER,
  ENGINEER_USER,
  NEWCOMER_USER,
  PROJECT_ID,
  createFakeServer,
  httpError,
  networkError,
  timeoutError,
  versionConflict,
  wireSettings,
  type FakeServer,
} from './settingsTestKit';

async function setup(options: Parameters<typeof createFakeServer>[0] = {}) {
  const server = await createFakeServer(options);
  const gateway = createProjectSettingsGateway(server.client);
  const read = await gateway.read({ projectId: PROJECT_ID });

  if (!read.ok) {
    throw new Error('đọc ban đầu phải thành công');
  }

  return { server, gateway, base: read.data };
}

function expectOk<T>(result: ApiResult<T>): T {
  if (!result.ok) {
    throw new Error('kết quả phải thành công');
  }

  return result.data;
}

describe('read', () => {
  it('đọc #24 và N5 song song, ánh xạ trường và đặt mặc định cho phần vắng', async () => {
    const server = await createFakeServer({ settings: wireSettings({ defaultScaleMmPerPx: 2.5, revision: 9 }) });
    const gateway = createProjectSettingsGateway(server.client);

    const pending = gateway.read({ projectId: PROJECT_ID });

    // Cả hai đã được gọi trước khi một trong hai trả lời: song song, không nối đuôi.
    expect(server.projectsRead).toHaveBeenCalledTimes(1);
    expect(server.settingsRead).toHaveBeenCalledTimes(1);

    const snapshot = expectOk(await pending);

    expect(snapshot).toMatchObject({
      projectId: PROJECT_ID,
      code: 'DA-01',
      scaleMmPerPx: 2.5,
      notes: '',
      areaUnit: 'm2',
      settingsRevision: 9,
      snapToleranceMm: 20,
    });
    expect(snapshot.members.map((member) => member.id)).toEqual([ADMIN_USER.id, ENGINEER_USER.id]);
  });

  it('chuyển nguyên lỗi của #24 hoặc của N5', async () => {
    const server = await createFakeServer();
    const gateway = createProjectSettingsGateway(server.client);

    server.settingsRead.mockResolvedValueOnce({ ok: false, error: httpError(403, 'FORBIDDEN') });
    const settingsFailed = await gateway.read({ projectId: PROJECT_ID });

    expect(settingsFailed.ok).toBe(false);

    server.projectsRead.mockResolvedValueOnce({ ok: false, error: httpError(404, 'NOT_FOUND') });
    const projectFailed = await gateway.read({ projectId: PROJECT_ID });

    expect(projectFailed.ok).toBe(false);
  });
});

describe('update', () => {
  it('gửi N6 trọn thân = ảnh chụp cộng bản vá, kèm baseVersion, không areaUnit, không notes rỗng', async () => {
    const { server, gateway, base } = await setup();

    const result = await gateway.update({ projectId: PROJECT_ID, base, patch: { scaleMmPerPx: 2.5 } });

    expect(server.projectsUpdate).not.toHaveBeenCalled();
    expect(server.settingsReplace).toHaveBeenCalledTimes(1);
    expect(server.settingsReplace.mock.calls[0]?.[0]).toStrictEqual({
      projectId: PROJECT_ID,
      baseVersion: 3,
      body: {
        buildingType: 'residential',
        confidenceThreshold: 0.8,
        defaultScaleMmPerPx: 2.5,
        lengthUnit: 'mm',
        snapToleranceMm: 20,
      },
    });
    expect(result.failures).toEqual([]);
    expect(result.snapshot.scaleMmPerPx).toBe(2.5);
    expect(result.snapshot.settingsRevision).toBe(4);
  });

  it('có ghi chú thì gửi; xoá trống ghi chú thì khoá notes vắng', async () => {
    const { server, gateway, base } = await setup({ settings: wireSettings({ notes: 'Cũ' }) });
    const withNotes: ProjectSettingsSnapshot = { ...base, notes: 'Cũ' };

    await gateway.update({ projectId: PROJECT_ID, base: withNotes, patch: { snapToleranceMm: 30 } });
    expect(server.settingsReplace.mock.calls[0]?.[0].body.notes).toBe('Cũ');

    await gateway.update({ projectId: PROJECT_ID, base: withNotes, patch: { notes: '' } });
    expect(server.settingsReplace.mock.calls[1]?.[0].body).not.toHaveProperty('notes');
  });

  it('chỉ đổi trường chung thì chỉ gọi #26, bỏ chuỗi rỗng', async () => {
    const { server, gateway, base } = await setup();

    const result = await gateway.update({
      projectId: PROJECT_ID,
      base,
      patch: { name: 'Tên mới', address: '' },
    });

    expect(server.settingsReplace).not.toHaveBeenCalled();
    expect(server.projectsUpdate.mock.calls[0]?.[0]).toStrictEqual({
      projectId: PROJECT_ID,
      body: { name: 'Tên mới' },
    });
    expect(result.snapshot.name).toBe('Tên mới');
  });

  it('#26 hỏng, N6 xong: trả failures của phần chung và ảnh chụp có phần đơn vị', async () => {
    const { server, gateway, base } = await setup();
    const error = httpError(403, 'FORBIDDEN');

    server.projectsUpdate.mockResolvedValueOnce({ ok: false, error });

    const result = await gateway.update({
      projectId: PROJECT_ID,
      base,
      patch: { name: 'Tên mới', snapToleranceMm: 40 },
    });

    expect(result.failures).toEqual([{ part: 'general', error }]);
    expect(result.snapshot.name).toBe(base.name);
    expect(result.snapshot.snapToleranceMm).toBe(40);
    expect(result.snapshot.settingsRevision).toBe(4);
  });

  it('baseVersion là số lớn hơn giữa base.settingsRevision và revision vừa nhận', async () => {
    const { server, gateway, base } = await setup();

    await gateway.update({ projectId: PROJECT_ID, base, patch: { snapToleranceMm: 30 } });
    // Lượt xả R13 mang `base` cũ (revision 3) nhưng gateway đã nhận revision 4.
    await gateway.update({ projectId: PROJECT_ID, base, patch: { snapToleranceMm: 31 } });

    expect(server.settingsReplace.mock.calls.map(([input]) => input.baseVersion)).toEqual([3, 4]);

    // Ngược lại: `base` mới hơn thì lấy `base`.
    await gateway.update({
      projectId: PROJECT_ID,
      base: { ...base, settingsRevision: 20 },
      patch: { snapToleranceMm: 32 },
    });

    expect(server.settingsReplace.mock.calls[2]?.[0].baseVersion).toBe(20);
  });

  it('đọc lại N5 mang revision mới không nâng baseVersion của N6 (tránh ghi đè im lặng)', async () => {
    const { server, gateway, base } = await setup();

    server.settingsRead.mockResolvedValueOnce({ ok: true, data: wireSettings({ confidenceThreshold: 0.5, revision: 4 }) });
    await gateway.read({ projectId: PROJECT_ID });
    await gateway.update({ projectId: PROJECT_ID, base, patch: { snapToleranceMm: 30 } });

    expect(server.settingsReplace.mock.calls[0]?.[0].baseVersion).toBe(3);
  });

  it('409 của N6 thành failures của phần đơn vị, giữ nguyên lỗi', async () => {
    const { server, gateway, base } = await setup();
    const error = versionConflict();

    server.settingsReplace.mockResolvedValueOnce({ ok: false, error });

    const result = await gateway.update({ projectId: PROJECT_ID, base, patch: { snapToleranceMm: 30 } });

    expect(result.failures).toEqual([{ part: 'units', error }]);
    expect(result.snapshot).toBe(base);
  });

  describe('N6 mất giữa đường', () => {
    it.each([
      ['mạng', networkError],
      ['timeout', timeoutError],
    ])('hỏng vì %s thì lượt sau gửi lại đúng thân cũ trước, rồi mới gửi thân mới', async (_name, makeError) => {
      const { server, gateway, base } = await setup();

      server.settingsReplace.mockResolvedValueOnce({ ok: false, error: makeError() });

      const first = await gateway.update({ projectId: PROJECT_ID, base, patch: { snapToleranceMm: 30 } });

      expect(first.failures).toHaveLength(1);

      await gateway.update({ projectId: PROJECT_ID, base, patch: { snapToleranceMm: 30, scaleMmPerPx: 2 } });

      const calls = server.settingsReplace.mock.calls.map(([input]) => input);

      expect(calls).toHaveLength(3);
      expect(calls[1]).toStrictEqual(calls[0]);
      expect(calls[2]?.baseVersion).toBe(4);
      expect(calls[2]?.body.defaultScaleMmPerPx).toBe(2);
    });

    it('thân mới trùng thân đã giữ thì chỉ một lượt gửi lại', async () => {
      const { server, gateway, base } = await setup();

      server.settingsReplace.mockResolvedValueOnce({ ok: false, error: timeoutError() });
      await gateway.update({ projectId: PROJECT_ID, base, patch: { snapToleranceMm: 30 } });

      const second = await gateway.update({ projectId: PROJECT_ID, base, patch: { snapToleranceMm: 30 } });

      expect(server.settingsReplace).toHaveBeenCalledTimes(2);
      expect(second.failures).toEqual([]);
      expect(second.snapshot.settingsRevision).toBe(4);
    });

    it('gửi lại bị 409 thì bỏ bản giữ, lượt sau chỉ gửi thân mới', async () => {
      const { server, gateway, base } = await setup();

      server.settingsReplace.mockResolvedValueOnce({ ok: false, error: networkError() });
      await gateway.update({ projectId: PROJECT_ID, base, patch: { snapToleranceMm: 30 } });

      server.settingsReplace.mockResolvedValueOnce({ ok: false, error: versionConflict() });
      const replay = await gateway.update({ projectId: PROJECT_ID, base, patch: { snapToleranceMm: 31 } });

      expect(replay.failures).toHaveLength(1);
      expect(server.settingsReplace).toHaveBeenCalledTimes(2);

      await gateway.update({ projectId: PROJECT_ID, base, patch: { snapToleranceMm: 31 } });

      expect(server.settingsReplace).toHaveBeenCalledTimes(3);
    });

    it('gửi lại vẫn mất mạng thì giữ bản cũ, không gửi thân mới', async () => {
      const { server, gateway, base } = await setup();

      server.settingsReplace.mockResolvedValueOnce({ ok: false, error: networkError() });
      await gateway.update({ projectId: PROJECT_ID, base, patch: { snapToleranceMm: 30 } });
      server.settingsReplace.mockResolvedValueOnce({ ok: false, error: networkError() });
      await gateway.update({ projectId: PROJECT_ID, base, patch: { snapToleranceMm: 31 } });

      expect(server.settingsReplace).toHaveBeenCalledTimes(2);

      await gateway.update({ projectId: PROJECT_ID, base, patch: { snapToleranceMm: 31 } });

      const calls = server.settingsReplace.mock.calls.map(([input]) => input.body.snapToleranceMm);

      expect(calls).toEqual([30, 30, 30, 31]);
    });

    it('bản giữ thuộc về gateway của lượt gắn màn: gateway mới không gửi lại', async () => {
      const { server, gateway, base } = await setup();

      server.settingsReplace.mockResolvedValueOnce({ ok: false, error: networkError() });
      await gateway.update({ projectId: PROJECT_ID, base, patch: { snapToleranceMm: 30 } });

      const next: ProjectSettingsGateway = createProjectSettingsGateway(server.client);
      await next.update({ projectId: PROJECT_ID, base, patch: { snapToleranceMm: 31 } });

      expect(server.settingsReplace).toHaveBeenCalledTimes(2);
      expect(server.settingsReplace.mock.calls[1]?.[0].body.snapToleranceMm).toBe(31);
    });
  });
});

describe('addMember', () => {
  const addAs = async (_server: FakeServer, gateway: ProjectSettingsGateway, email: string) =>
    gateway.addMember({ projectId: PROJECT_ID, email });

  it('đọc lại #24 trước N3 và gửi email đã trim, chữ thường', async () => {
    const { server, gateway } = await setup();
    const readsBefore = server.projectsRead.mock.calls.length;

    const outcome = expectOk(await addAs(server, gateway, '  NewComer@Example.COM '));

    expect(server.projectsRead.mock.calls.length).toBe(readsBefore + 1);
    expect(server.membersAdd.mock.calls[0]?.[0]).toMatchObject({
      projectId: PROJECT_ID,
      email: 'newcomer@example.com',
    });
    expect(server.projectsRead.mock.invocationCallOrder.at(-1)).toBeLessThan(
      server.membersAdd.mock.invocationCallOrder[0] ?? 0,
    );
    expect(outcome).toMatchObject({ alreadyMember: false, member: { id: NEWCOMER_USER.id } });
  });

  it('email khác hoa thường của thành viên có sẵn: alreadyMember, không gửi N3', async () => {
    const { server, gateway } = await setup();

    const outcome = expectOk(await addAs(server, gateway, ' ENGINEER@example.com'));

    expect(outcome).toMatchObject({ alreadyMember: true, member: { id: ENGINEER_USER.id } });
    expect(server.membersAdd).not.toHaveBeenCalled();
  });

  it('N3 trả người có trong #24 vừa đọc thì cũng alreadyMember', async () => {
    const { server, gateway } = await setup();

    server.membersAdd.mockResolvedValueOnce({ ok: true, data: ADMIN_USER });

    const outcome = expectOk(await addAs(server, gateway, 'someone@example.com'));

    expect(outcome.alreadyMember).toBe(true);
  });

  it('chuyển nguyên lỗi của N3', async () => {
    const { server, gateway } = await setup();
    const error = httpError(422, 'MEMBER_USER_UNAVAILABLE');

    server.membersAdd.mockResolvedValueOnce({ ok: false, error });

    const result = await addAs(server, gateway, 'ghost@example.com');

    expect(result).toEqual({ ok: false, error });
  });

  describe('khoá idempotency theo R3', () => {
    const keyOf = (server: FakeServer, call: number): string | undefined =>
      server.membersAdd.mock.calls[call]?.[0].idempotencyKey;

    it('mỗi thân một khoá: lượt đầu có khoá dạng UUID', async () => {
      const { server, gateway } = await setup();

      await addAs(server, gateway, 'a@example.com');

      expect(keyOf(server, 0)).toMatch(/^[0-9a-f-]{36}$/u);
    });

    it.each([
      ['mạng', networkError()],
      ['timeout', timeoutError()],
      ['5xx', httpError(503, 'DEPENDENCY_UNAVAILABLE')],
    ])('gửi lại cùng email sau lỗi %s thì giữ khoá', async (_name, error) => {
      const { server, gateway } = await setup();

      server.membersAdd.mockResolvedValueOnce({ ok: false, error });
      await addAs(server, gateway, 'a@example.com');
      await addAs(server, gateway, ' A@example.com ');

      expect(keyOf(server, 1)).toBe(keyOf(server, 0));
    });

    it('email khác thì khoá mới', async () => {
      const { server, gateway } = await setup();

      server.membersAdd.mockResolvedValueOnce({ ok: false, error: timeoutError() });
      await addAs(server, gateway, 'a@example.com');
      await addAs(server, gateway, 'b@example.com');

      expect(keyOf(server, 1)).not.toBe(keyOf(server, 0));
    });

    it('sau thành công thì khoá mới', async () => {
      const { server, gateway } = await setup();

      await addAs(server, gateway, 'a@example.com');
      await addAs(server, gateway, 'a@example.com');

      expect(keyOf(server, 1)).not.toBe(keyOf(server, 0));
    });

    it('sau 4xx thì khoá mới', async () => {
      const { server, gateway } = await setup();

      server.membersAdd.mockResolvedValueOnce({ ok: false, error: httpError(422, 'MEMBER_USER_UNAVAILABLE') });
      await addAs(server, gateway, 'a@example.com');
      await addAs(server, gateway, 'a@example.com');

      expect(keyOf(server, 1)).not.toBe(keyOf(server, 0));
    });
  });
});

describe('removeMember và deleteProject', () => {
  it('gỡ thành viên gọi N4 với mã dự án và mã người', async () => {
    const { server, gateway } = await setup();

    const removed = expectOk(await gateway.removeMember({ projectId: PROJECT_ID, userId: 'usr_x' }));

    expect(server.membersRemove.mock.calls[0]?.[0]).toMatchObject({ projectId: PROJECT_ID, userId: 'usr_x' });
    expect(removed.id).toBe('usr_x');
  });

  it('chuyển nguyên lỗi của N4', async () => {
    const { server, gateway } = await setup();
    const error = httpError(422, 'MEMBER_LAST_EDITOR');

    server.membersRemove.mockResolvedValueOnce({ ok: false, error });

    expect(await gateway.removeMember({ projectId: PROJECT_ID, userId: 'usr_x' })).toEqual({ ok: false, error });
  });

  it('xoá dự án trả void khi thành công', async () => {
    const { gateway } = await setup();

    expect(await gateway.deleteProject({ projectId: PROJECT_ID })).toEqual({ ok: true, data: undefined });
  });
});
