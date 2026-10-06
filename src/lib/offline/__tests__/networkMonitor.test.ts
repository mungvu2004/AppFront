import { describe, expect, it } from 'vitest';

import { createNetworkMonitor, type CreateNetworkMonitorOptions } from '../networkMonitor';

/** Lượt ping chưa bao giờ trả lời — máy chủ còn bận, `HEAD /` chưa về. */
const pendingPing = (): Promise<boolean> => new Promise<boolean>(() => undefined);

describe('createNetworkMonitor — trạng thái trước lượt ping đầu (NO-390)', () => {
  it('máy đang nối mạng chưa ping xong thì không báo mất mạng', () => {
    const monitor = createNetworkMonitor({ navigatorObject: { onLine: true }, ping: pendingPing });

    expect(monitor.getStatus()).toMatchObject({ browserOnline: true, online: true, pingOnline: true });
  });

  it('trình duyệt báo ngoại tuyến thì mất mạng ngay, không chờ ping', () => {
    const monitor = createNetworkMonitor({ navigatorObject: { onLine: false }, ping: pendingPing });

    expect(monitor.getStatus().online).toBe(false);
  });

  it('lượt ping đầu trả lời "không" thì chuyển sang mất mạng', async () => {
    const monitor = createNetworkMonitor({
      navigatorObject: { onLine: true },
      ping: async () => false,
    });

    const status = await monitor.checkNow();

    expect(status).toMatchObject({ online: false, pingOnline: false });
  });
});

describe('createNetworkMonitor — vòng đời', () => {
  it('bật một lần, nghe sự kiện trình duyệt, báo cho người đăng ký, tắt sạch', async () => {
    const handlers = new Map<string, () => void>();
    const navigatorObject = { onLine: true };
    let intervals = 0;
    const windowObject = {
      addEventListener: (type: string, handler: () => void) => handlers.set(type, handler),
      removeEventListener: (type: string) => handlers.delete(type),
      setInterval: () => {
        intervals += 1;
        return intervals;
      },
      clearInterval: () => undefined,
      setTimeout: () => 1,
      clearTimeout: () => undefined,
    } as unknown as NonNullable<CreateNetworkMonitorOptions['windowObject']>;
    const monitor = createNetworkMonitor({ navigatorObject, ping: async () => true, windowObject });
    const seen: boolean[] = [];
    const unsubscribe = monitor.subscribe((status) => seen.push(status.online));

    monitor.start();
    monitor.start();
    await monitor.checkNow();

    navigatorObject.onLine = false;
    handlers.get('offline')?.();

    unsubscribe();
    handlers.get('online')?.();
    monitor.stop();
    monitor.stop();

    expect(intervals).toBe(1);
    expect(seen.at(-1)).toBe(false);
    expect(handlers.size).toBe(0);
  });
});
