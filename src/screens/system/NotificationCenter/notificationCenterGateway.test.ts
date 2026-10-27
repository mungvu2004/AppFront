import { describe, expect, it, vi } from 'vitest';

import type { ApiClient } from '@/api/client';

import { createNotificationCenterGateway, OLDER_PAGE_SIZE } from './notificationCenterGateway';

describe('notificationCenterGateway.listPage (PERF-03 P11b)', () => {
  it('trang đầu cũng gửi limit — không tải cả hộp thư chỉ để vẽ chuông', async () => {
    const listPage = vi.fn(async () => ({ ok: true as const, data: { items: [] } }));
    const client = { notifications: { listPage } } as unknown as ApiClient;
    const gateway = createNotificationCenterGateway(client, () => 0);

    await gateway.listPage?.(undefined);
    await gateway.listPage?.('c-1');

    expect(listPage).toHaveBeenNthCalledWith(1, { limit: OLDER_PAGE_SIZE });
    expect(listPage).toHaveBeenNthCalledWith(2, { cursor: 'c-1', limit: OLDER_PAGE_SIZE });
  });
});
