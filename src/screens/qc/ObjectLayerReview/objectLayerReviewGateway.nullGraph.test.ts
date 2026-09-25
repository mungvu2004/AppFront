import { describe, expect, it, vi } from 'vitest';

import { createTestQueryClient } from '@/lib/testing/render';

import {
  createObjectLayerMutation,
  createMockObjectLayerReviewGateway,
} from './objectLayerReviewGateway';

describe('ghi Object khi chưa có đồ thị', () => {
  it('không gửi đồ thị mẫu: persistObjectLayer không được gọi, kết quả supported false, không rollback', async () => {
    const base = createMockObjectLayerReviewGateway();
    const persist = vi.fn(base.persistObjectLayer);
    const rollback = vi.fn();
    const options = createObjectLayerMutation(createTestQueryClient(), {
      gateway: { ...base, graph: { ...base.graph, read: () => null }, persistObjectLayer: persist },
      applyOptimistic: vi.fn(),
      rollback,
      affectedKeys: () => [],
      afterSuccess: vi.fn(),
    });

    const result = await options.mutationFn?.({ objectId: 'x', projectId: 'p', floorId: 'f' });

    expect(persist).not.toHaveBeenCalled();
    expect(result).toMatchObject({ supported: false });
    expect(rollback).not.toHaveBeenCalled();
  });
});
