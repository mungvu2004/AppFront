import { describe, expect, it, vi } from 'vitest';
import {
  holdTabSession,
  isUploadDrawingCommand,
  readLiveTabSessions,
  TAB_SESSION_ID,
  type TabLocks,
} from '../markerCommands';

/** Web Locks giả: giữ khoá là ghi tên vào `held`, khoá không bao giờ nhả. */
const createFakeLocks = (): TabLocks & { readonly held: Set<string> } => {
  const held = new Set<string>();

  return {
    held,
    request: vi.fn(async (name: string, _options: { mode: 'shared' }, callback: () => Promise<unknown>) => {
      held.add(name);
      return callback();
    }),
    query: async () => ({ held: [...held].map((name) => ({ name })) }),
  };
};

describe('isUploadDrawingCommand', () => {
  it('nhận đúng lệnh có kind uploadDrawing', () => {
    expect(isUploadDrawingCommand({ kind: 'uploadDrawing' })).toBe(true);
    expect(isUploadDrawingCommand({ kind: 'renameRoom' })).toBe(false);
    expect(isUploadDrawingCommand(null)).toBe(false);
    expect(isUploadDrawingCommand('uploadDrawing')).toBe(false);
  });
});

describe('holdTabSession', () => {
  it('xin khoá chung một lần cho mỗi phiên; xong khi khoá được cấp', async () => {
    const locks = createFakeLocks();

    await holdTabSession('tab-a', locks);
    await holdTabSession('tab-a', locks);
    await holdTabSession('tab-b', locks);

    expect(locks.request).toHaveBeenCalledTimes(2);
    expect(locks.request).toHaveBeenCalledWith('offline-tab-session:tab-a', { mode: 'shared' }, expect.any(Function));
  });

  it('không có Web Locks hay xin khoá hỏng: vẫn xong, không treo lượt ghi', async () => {
    const failing: TabLocks = {
      request: async () => {
        throw new Error('SecurityError');
      },
      query: async () => ({}),
    };

    await expect(holdTabSession('tab-a', null)).resolves.toBeUndefined();
    await expect(holdTabSession('tab-a', failing)).resolves.toBeUndefined();
  });
});

describe('readLiveTabSessions', () => {
  it('phiên giữ khoá và phiên của chính tab là sống; phiên đã nhả khoá và lệnh không mã phiên là mồ côi', async () => {
    const locks = createFakeLocks();

    await holdTabSession('tab-a', locks);

    const isAlive = await readLiveTabSessions(TAB_SESSION_ID, locks);

    expect(isAlive('tab-a')).toBe(true);
    expect(isAlive(TAB_SESSION_ID)).toBe(true);
    expect(isAlive('tab-da-dong')).toBe(false);
    expect(isAlive(undefined)).toBe(false);
  });

  it('không có Web Locks hay query hỏng: mọi phiên có mã đều coi là sống', async () => {
    const failing: TabLocks = {
      request: async () => undefined,
      query: async () => {
        throw new Error('InvalidStateError');
      },
    };

    for (const locks of [null, failing]) {
      const isAlive = await readLiveTabSessions('tab-b', locks);

      expect(isAlive('tab-a')).toBe(true);
      expect(isAlive(undefined)).toBe(false);
    }
  });

  it('snapshot không có held hay khoá không tên: chỉ phiên của chính tab sống', async () => {
    for (const snapshot of [{}, { held: [{}] }]) {
      const isAlive = await readLiveTabSessions('tab-b', { request: async () => undefined, query: async () => snapshot });

      expect(isAlive('tab-b')).toBe(true);
      expect(isAlive('tab-a')).toBe(false);
    }
  });
});
