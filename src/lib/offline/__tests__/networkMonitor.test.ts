import { describe, expect, it } from 'vitest';

import { createNetworkMonitor } from '../networkMonitor';

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
