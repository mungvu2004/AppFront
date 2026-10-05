import { act, renderHook } from '@testing-library/react';
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';

import { RETRY_SCHEDULE_MS } from '@/lib/autosave/retrySchedule';
import { resolveConflict } from '@/lib/versioning/conflict';
import { queryKeys } from '@/lib/query/queryKeys';
import { installFakeClock, type FakeClock } from '@/lib/testing/fakeClock';
import viMessages from '@/i18n/vi.json';

import { createProjectSettingsGateway } from './projectSettingsGateway';
import { SETTINGS_SENTENCES } from './settingsErrors';
import {
  PROJECT_ID,
  createFakeServer,
  createHookWrapper,
  httpError,
  installMatchMedia,
  settingsFromBody,
  timeoutError,
  versionConflict,
  type FakeServer,
} from './settingsTestKit';
import { useProjectSettings, type UseProjectSettingsOptions } from './useProjectSettings';

// Cấm gọi `resolveConflict` (mảng `remoteChanges` rỗng sẽ ghi đè im lặng): bài kiểm dựa vào lời cấm này.
vi.mock('@/lib/versioning/conflict', async (importOriginal) => ({
  ...(await importOriginal<Record<string, unknown>>()),
  resolveConflict: vi.fn(),
}));

const AUTOSAVE_DEBOUNCE_MS = 800;
const RETRY_FIRST_MS = RETRY_SCHEDULE_MS[0];
/** Dài hơn cả lịch thử lại 5/15/45 giây: một lượt gửi lén nào cũng lộ ra trong khoảng này. */
const LONG_WAIT_MS = RETRY_SCHEDULE_MS.reduce((total, delay) => total + delay, 0) * 2;

beforeAll(() => {
  installMatchMedia();
});

describe('useProjectSettings, lưu hai phần', () => {
  let clock: FakeClock;

  beforeEach(() => {
    clock = installFakeClock();
    vi.mocked(resolveConflict).mockClear();
  });

  afterEach(() => {
    clock.restore();
  });

  async function tick(durationMs: number): Promise<void> {
    await act(async () => {
      await clock.advance(durationMs);
    });
  }

  async function mount(server: FakeServer, extra: Partial<UseProjectSettingsOptions> = {}) {
    const { queryClient, wrapper } = createHookWrapper();
    const gateway = createProjectSettingsGateway(server.client);
    const onToast = vi.fn();
    const online = { value: true };
    const hook = renderHook(
      () =>
        useProjectSettings({
          gateway,
          projectId: PROJECT_ID,
          roles: ['admin'],
          now: clock.epochMs,
          isOnline: () => online.value,
          onToast,
          ...extra,
        }),
      { wrapper },
    );

    await tick(0);

    return { ...hook, queryClient, gateway, onToast, online };
  }

  it('thân N6 đi cùng baseVersion, không areaUnit, không notes rỗng', async () => {
    const server = await createFakeServer();
    const { result } = await mount(server);

    act(() => {
      result.current.setScaleMmPerPx(2.5);
    });
    await tick(AUTOSAVE_DEBOUNCE_MS);

    expect(server.projectsUpdate).not.toHaveBeenCalled();
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
  });

  it('lưu xong phần chung thì vô hiệu hoá thẻ dự án, danh sách và chi tiết qua bảng vô hiệu hoá', async () => {
    const server = await createFakeServer();
    const { result, queryClient } = await mount(server);
    const invalidate = vi.spyOn(queryClient, 'invalidateQueries');

    act(() => {
      result.current.setName('Tên mới');
    });
    await tick(AUTOSAVE_DEBOUNCE_MS);

    const keys = invalidate.mock.calls.map((call) => call[0]?.queryKey);

    expect(keys).toContainEqual(queryKeys.project.summaries());
    expect(keys).toContainEqual(queryKeys.project.list());
    expect(keys).toContainEqual(queryKeys.project.detail(PROJECT_ID));
  });

  it('#26 hỏng, N6 xong: nói phần nào đã lưu, phần đơn vị vào saved, không vé hoàn tác', async () => {
    const server = await createFakeServer();
    const { result, onToast } = await mount(server);

    server.projectsUpdate.mockResolvedValueOnce({ ok: false, error: httpError(403, 'FORBIDDEN') });

    act(() => {
      result.current.setName('Tên mới');
      result.current.setSnapToleranceMm(40);
    });
    await tick(AUTOSAVE_DEBOUNCE_MS);

    expect(result.current.saveFailureMessage).toBe('Đã lưu đơn vị đo, chưa lưu thông tin chung.');
    expect(result.current.state).toBe('partial');
    expect(onToast).not.toHaveBeenCalled();

    // Phần đơn vị đã vào `saved`: lượt kế tiếp chỉ mang phần chung.
    act(() => {
      result.current.setName('Tên mới nữa');
    });
    await tick(AUTOSAVE_DEBOUNCE_MS);

    expect(server.settingsReplace).toHaveBeenCalledTimes(1);
    expect(server.projectsUpdate).toHaveBeenCalledTimes(2);
    expect(server.projectsUpdate.mock.calls[1]?.[0].body).toStrictEqual({ name: 'Tên mới nữa' });
  });

  it('cả hai phần xong thì đúng một vé hoàn tác và không còn câu lỗi', async () => {
    const server = await createFakeServer();
    const { result, onToast } = await mount(server);

    act(() => {
      result.current.setName('Tên mới');
      result.current.setSnapToleranceMm(40);
    });
    await tick(AUTOSAVE_DEBOUNCE_MS);

    expect(onToast).toHaveBeenCalledTimes(1);
    expect(onToast.mock.calls[0]?.[0]).toMatchObject({ message: viMessages.project.settings.savedToast });
    expect(result.current.saveFailureMessage).toBeNull();
  });

  describe('409', () => {
    it('hiện dải tải lại bằng câu riêng, không gọi resolveConflict, không gửi lại sau cả lịch thử lại', async () => {
      const server = await createFakeServer();
      const { result } = await mount(server);

      server.settingsReplace.mockResolvedValueOnce({ ok: false, error: versionConflict() });

      act(() => {
        result.current.setSnapToleranceMm(40);
      });
      await tick(AUTOSAVE_DEBOUNCE_MS);

      expect(result.current.conflictMessage).toBe(viMessages.project.settings.load.conflictMessage);
      expect(result.current.saveState).toBe('error');

      await tick(LONG_WAIT_MS);

      expect(server.settingsReplace).toHaveBeenCalledTimes(1);
      expect(resolveConflict).not.toHaveBeenCalled();
    });

    it('#26 hết giờ + N6 409: lượt hẹn chỉ gửi #26, xong vẫn failed và không "đã lưu"', async () => {
      const server = await createFakeServer();
      const { result, onToast } = await mount(server);

      server.projectsUpdate.mockResolvedValueOnce({ ok: false, error: timeoutError() });
      server.settingsReplace.mockResolvedValueOnce({ ok: false, error: versionConflict() });

      act(() => {
        result.current.setName('Tên mới');
        result.current.setSnapToleranceMm(40);
      });
      await tick(AUTOSAVE_DEBOUNCE_MS);

      expect(server.projectsUpdate).toHaveBeenCalledTimes(1);
      expect(server.settingsReplace).toHaveBeenCalledTimes(1);
      // Lỗi tạm đứng trước: engine hẹn lại, chưa `failed`.
      expect(result.current.saveState).toBe('pending');

      await tick(RETRY_FIRST_MS);

      expect(server.projectsUpdate).toHaveBeenCalledTimes(2);
      expect(server.settingsReplace).toHaveBeenCalledTimes(1);
      expect(result.current.saveState).toBe('error');
      expect(result.current.saveFailureMessage).toBe('Đã lưu thông tin chung, chưa lưu đơn vị đo.');
      expect(onToast).not.toHaveBeenCalled();

      await tick(LONG_WAIT_MS);

      expect(server.projectsUpdate).toHaveBeenCalledTimes(2);
      expect(server.settingsReplace).toHaveBeenCalledTimes(1);
    });

    it('sửa lại phần đã bị từ chối thì được gửi lại', async () => {
      const server = await createFakeServer();
      const { result } = await mount(server);

      server.settingsReplace.mockResolvedValueOnce({ ok: false, error: versionConflict() });

      act(() => {
        result.current.setSnapToleranceMm(40);
      });
      await tick(AUTOSAVE_DEBOUNCE_MS);
      act(() => {
        result.current.setSnapToleranceMm(41);
      });
      await tick(AUTOSAVE_DEBOUNCE_MS);

      expect(server.settingsReplace).toHaveBeenCalledTimes(2);
    });

    it('sửa phần khác thì phần bị từ chối vẫn không gửi, và lượt đó vẫn là failed', async () => {
      const server = await createFakeServer();
      const { result } = await mount(server);

      server.settingsReplace.mockResolvedValueOnce({ ok: false, error: versionConflict() });

      act(() => {
        result.current.setSnapToleranceMm(40);
      });
      await tick(AUTOSAVE_DEBOUNCE_MS);
      act(() => {
        result.current.setName('Tên mới');
      });
      await tick(AUTOSAVE_DEBOUNCE_MS);

      expect(server.projectsUpdate).toHaveBeenCalledTimes(1);
      expect(server.settingsReplace).toHaveBeenCalledTimes(1);
      expect(result.current.saveState).toBe('error');
    });
  });

  describe('422 và 428', () => {
    it('422 body.snapToleranceMm đặt lỗi đúng ô, và sửa ô đó thì lỗi hết', async () => {
      const server = await createFakeServer();
      const { result } = await mount(server);

      server.settingsReplace.mockResolvedValueOnce({
        ok: false,
        error: httpError(422, 'VALIDATION', { field: 'body.snapToleranceMm' }),
      });

      act(() => {
        result.current.setSnapToleranceMm(40);
      });
      await tick(AUTOSAVE_DEBOUNCE_MS);

      expect(result.current.problems.snapToleranceMm).toBe(SETTINGS_SENTENCES.fieldRejected);
      expect(result.current.problems.scaleMmPerPx).toBeNull();
      expect(result.current.saveState).toBe('error');

      act(() => {
        result.current.setSnapToleranceMm(41);
      });

      expect(result.current.problems.snapToleranceMm).toBeNull();
    });

    it('422 body.defaultScaleMmPerPx trỏ về ô tỉ lệ', async () => {
      const server = await createFakeServer();
      const { result } = await mount(server);

      server.settingsReplace.mockResolvedValueOnce({
        ok: false,
        error: httpError(422, 'VALIDATION', { field: 'body.defaultScaleMmPerPx' }),
      });

      act(() => {
        result.current.setScaleMmPerPx(3);
      });
      await tick(AUTOSAVE_DEBOUNCE_MS);

      expect(result.current.problems.scaleMmPerPx).toBe(SETTINGS_SENTENCES.fieldRejected);
    });

    it('428 dùng câu dự phòng của màn và không thử lại', async () => {
      const server = await createFakeServer();
      const { result } = await mount(server);

      server.settingsReplace.mockResolvedValueOnce({ ok: false, error: httpError(428, 'PRECONDITION_REQUIRED') });

      act(() => {
        result.current.setSnapToleranceMm(40);
      });
      await tick(AUTOSAVE_DEBOUNCE_MS);

      expect(result.current.saveFailureMessage).toBe('Chưa lưu được đơn vị đo.');
      expect(result.current.problems.snapToleranceMm).toBeNull();

      await tick(LONG_WAIT_MS);

      expect(server.settingsReplace).toHaveBeenCalledTimes(1);
    });
  });

  it('số máy chủ làm tròn vào saved và vào nháp chưa đổi, không sinh lượt lưu thứ hai', async () => {
    const server = await createFakeServer();
    const { result } = await mount(server);

    server.settingsReplace.mockImplementationOnce(async ({ baseVersion, body }) => ({
      ok: true,
      data: settingsFromBody(body, baseVersion + 1, { defaultScaleMmPerPx: 2.56 }),
    }));

    act(() => {
      result.current.setScaleMmPerPx(2.5555);
    });
    await tick(AUTOSAVE_DEBOUNCE_MS);

    expect(result.current.scaleMmPerPx).toBe(2.56);

    await tick(LONG_WAIT_MS);

    expect(server.settingsReplace).toHaveBeenCalledTimes(1);
  });

  it('nháp sửa tiếp trong lúc gửi thì giữ nguyên sửa đó và gửi ở lượt sau', async () => {
    const server = await createFakeServer();
    const { result } = await mount(server);
    let release: () => void = () => undefined;

    server.settingsReplace.mockImplementationOnce(
      async ({ baseVersion, body }) =>
        new Promise((resolve) => {
          release = () => {
            resolve({ ok: true, data: settingsFromBody(body, baseVersion + 1, { defaultScaleMmPerPx: 2.56 }) });
          };
        }),
    );

    act(() => {
      result.current.setScaleMmPerPx(2.5555);
    });
    await tick(AUTOSAVE_DEBOUNCE_MS);
    act(() => {
      result.current.setScaleMmPerPx(4);
    });
    await act(async () => {
      release();
      await clock.flushMicrotasks();
    });

    expect(result.current.scaleMmPerPx).toBe(4);

    await tick(AUTOSAVE_DEBOUNCE_MS);

    expect(server.settingsReplace).toHaveBeenCalledTimes(2);
    expect(server.settingsReplace.mock.calls[1]?.[0]).toMatchObject({ baseVersion: 4 });
    expect(server.settingsReplace.mock.calls[1]?.[0].body.defaultScaleMmPerPx).toBe(4);
  });

  it('N6 hết giờ rồi sửa tiếp: lượt sau gửi lại thân cũ trước, rồi mới gửi thân mới', async () => {
    const server = await createFakeServer();
    const { result } = await mount(server);

    server.settingsReplace.mockResolvedValueOnce({ ok: false, error: timeoutError() });

    act(() => {
      result.current.setSnapToleranceMm(40);
    });
    await tick(AUTOSAVE_DEBOUNCE_MS);
    act(() => {
      result.current.setScaleMmPerPx(2);
    });
    await tick(RETRY_FIRST_MS);

    const calls = server.settingsReplace.mock.calls.map(([input]) => input);

    expect(calls).toHaveLength(3);
    expect(calls[1]).toStrictEqual(calls[0]);
    expect(calls[2]?.baseVersion).toBe(4);
    expect(calls[2]?.body).toMatchObject({ snapToleranceMm: 40, defaultScaleMmPerPx: 2 });
    expect(result.current.saveState).toBe('saved');
  });

  describe('ô lỗi cục bộ', () => {
    it('mã đã lưu mà nháp rỗng: lỗi ô "chưa xoá trống được" và không gửi gì', async () => {
      const server = await createFakeServer();
      const { result } = await mount(server);

      act(() => {
        result.current.setCode('');
        result.current.setAddress('');
      });
      await tick(AUTOSAVE_DEBOUNCE_MS);

      expect(result.current.problems.code).toBe(viMessages.project.settings.problems.emptyBlocked);
      expect(server.projectsUpdate).not.toHaveBeenCalled();
    });

    it('dung sai bắt điểm phải là số nguyên', async () => {
      const server = await createFakeServer();
      const { result } = await mount(server);

      act(() => {
        result.current.setSnapToleranceMm(20.5);
      });
      await tick(AUTOSAVE_DEBOUNCE_MS);

      expect(result.current.problems.snapToleranceMm).toBe(viMessages.project.settings.problems.snapNotInteger);
      expect(server.settingsReplace).not.toHaveBeenCalled();
    });
  });

  describe('tải lại', () => {
    it('có nháp chưa lưu thì hỏi trước; giữ lại thì không đọc lại', async () => {
      const server = await createFakeServer();
      const { result } = await mount(server);
      const readsBefore = server.settingsRead.mock.calls.length;

      act(() => {
        result.current.setName('Tên mới');
      });
      act(() => {
        result.current.reloadSettings();
      });

      expect(result.current.isReloadDialogOpen).toBe(true);

      act(() => {
        result.current.cancelReload();
      });

      expect(result.current.isReloadDialogOpen).toBe(false);
      expect(result.current.name).toBe('Tên mới');
      expect(server.settingsRead.mock.calls.length).toBe(readsBefore);
    });

    it('xác nhận thì đọc lại và bỏ nháp', async () => {
      const server = await createFakeServer();
      const { result } = await mount(server);
      const original = result.current.name;
      const readsBefore = server.settingsRead.mock.calls.length;

      act(() => {
        result.current.setName('Tên mới');
      });
      act(() => {
        result.current.reloadSettings();
      });
      await act(async () => {
        result.current.confirmReload();
        await clock.flushMicrotasks();
      });
      await tick(AUTOSAVE_DEBOUNCE_MS);

      expect(server.settingsRead.mock.calls.length).toBe(readsBefore + 1);
      expect(result.current.isReloadDialogOpen).toBe(false);
      expect(result.current.name).toBe(original);
      expect(server.projectsUpdate).not.toHaveBeenCalled();
    });

    it('không có nháp thì tải lại ngay, không hỏi', async () => {
      const server = await createFakeServer();
      const { result } = await mount(server);
      const readsBefore = server.settingsRead.mock.calls.length;

      await act(async () => {
        result.current.reloadSettings();
        await clock.flushMicrotasks();
      });

      expect(result.current.isReloadDialogOpen).toBe(false);
      expect(server.settingsRead.mock.calls.length).toBe(readsBefore + 1);
    });

    it('sau 409, tải lại xoá dải xung đột và cho gửi lại', async () => {
      const server = await createFakeServer();
      const { result } = await mount(server);

      server.settingsReplace.mockResolvedValueOnce({ ok: false, error: versionConflict() });

      act(() => {
        result.current.setSnapToleranceMm(40);
      });
      await tick(AUTOSAVE_DEBOUNCE_MS);
      act(() => {
        result.current.reloadSettings();
      });
      await act(async () => {
        result.current.confirmReload();
        await clock.flushMicrotasks();
      });

      expect(result.current.conflictMessage).toBeNull();
      expect(result.current.saveFailureMessage).toBeNull();
      expect(result.current.saveState).toBe('saved');
    });
  });

  describe('tháo màn (R13)', () => {
    it('tháo khi còn nháp dở thì đúng một lượt gửi', async () => {
      const server = await createFakeServer();
      const { result, unmount } = await mount(server);

      act(() => {
        result.current.setName('Tên mới');
      });
      await tick(100);
      unmount();
      await tick(0);

      expect(server.projectsUpdate).toHaveBeenCalledTimes(1);
      expect(server.projectsUpdate.mock.calls[0]?.[0].body).toStrictEqual({ name: 'Tên mới' });

      await tick(LONG_WAIT_MS);

      expect(server.projectsUpdate).toHaveBeenCalledTimes(1);
    });

    it('đã lưu xong thì tháo không gửi gì', async () => {
      const server = await createFakeServer();
      const { result, unmount } = await mount(server);

      act(() => {
        result.current.setName('Tên mới');
      });
      await tick(AUTOSAVE_DEBOUNCE_MS);
      unmount();
      await tick(LONG_WAIT_MS);

      expect(server.projectsUpdate).toHaveBeenCalledTimes(1);
    });

    it('sửa lúc lượt trước đang gửi rồi tháo: lượt sau mang sửa đó, baseVersion = revision lượt trước', async () => {
      const server = await createFakeServer();
      const { result, unmount } = await mount(server);
      let release: () => void = () => undefined;

      server.settingsReplace.mockImplementationOnce(
        async ({ baseVersion, body }) =>
          new Promise((resolve) => {
            release = () => {
              resolve({ ok: true, data: settingsFromBody(body, baseVersion + 1) });
            };
          }),
      );

      act(() => {
        result.current.setSnapToleranceMm(30);
      });
      await tick(AUTOSAVE_DEBOUNCE_MS);
      act(() => {
        result.current.setScaleMmPerPx(2);
      });
      unmount();

      await act(async () => {
        release();
        await clock.flushMicrotasks();
      });
      await tick(0);

      const calls = server.settingsReplace.mock.calls.map(([input]) => input);

      expect(calls).toHaveLength(2);
      expect(calls[1]?.baseVersion).toBe(4);
      expect(calls[1]?.body).toMatchObject({ snapToleranceMm: 30, defaultScaleMmPerPx: 2 });

      await tick(LONG_WAIT_MS);

      expect(server.settingsReplace).toHaveBeenCalledTimes(2);
    });

    it('tháo lúc offline: lượt hẹn vẫn gửi khi có mạng, đúng một lần', async () => {
      const server = await createFakeServer();
      const { result, unmount, online } = await mount(server);

      online.value = false;
      act(() => {
        result.current.setName('Tên mới');
      });
      await tick(AUTOSAVE_DEBOUNCE_MS);

      expect(server.projectsUpdate).not.toHaveBeenCalled();

      unmount();
      online.value = true;
      await tick(RETRY_FIRST_MS);

      expect(server.projectsUpdate).toHaveBeenCalledTimes(1);
      expect(server.projectsUpdate.mock.calls[0]?.[0].body).toStrictEqual({ name: 'Tên mới' });

      await tick(LONG_WAIT_MS);

      expect(server.projectsUpdate).toHaveBeenCalledTimes(1);
    });

    it('lượt xả hỏng vì mạng thì thử lại theo lịch, lần sau xong thì thôi', async () => {
      const server = await createFakeServer();
      const { result, unmount } = await mount(server);

      server.projectsUpdate.mockResolvedValueOnce({ ok: false, error: timeoutError() });

      act(() => {
        result.current.setName('Tên mới');
      });
      unmount();
      await tick(0);

      expect(server.projectsUpdate).toHaveBeenCalledTimes(1);

      await tick(RETRY_FIRST_MS);

      expect(server.projectsUpdate).toHaveBeenCalledTimes(2);

      await tick(LONG_WAIT_MS);

      expect(server.projectsUpdate).toHaveBeenCalledTimes(2);
    });

    it('lượt xả hỏng vĩnh viễn thì bỏ bản chờ, không gửi lại', async () => {
      const server = await createFakeServer();
      const { result, unmount } = await mount(server);

      server.projectsUpdate.mockResolvedValueOnce({ ok: false, error: httpError(403, 'FORBIDDEN') });

      act(() => {
        result.current.setName('Tên mới');
      });
      unmount();
      await tick(LONG_WAIT_MS);

      expect(server.projectsUpdate).toHaveBeenCalledTimes(1);
    });
  });
});
