import { describe, expect, it, vi } from 'vitest';

import { createTestQueryClient } from '@/lib/testing/render';

import {
  createDimensionOcrMutation,
  createMockDimensionOcrReviewGateway,
} from './dimensionOcrReviewGateway';

describe('ghi Dimension khi chưa có đồ thị', () => {
  it('không gửi đồ thị mẫu: persistDimensionLayer không được gọi, kết quả supported false, không rollback', async () => {
    const base = createMockDimensionOcrReviewGateway();
    const persist = vi.fn(base.persistDimensionLayer);
    const rollback = vi.fn();
    const options = createDimensionOcrMutation(createTestQueryClient(), {
      gateway: { ...base, graph: { ...base.graph, read: () => null }, persistDimensionLayer: persist },
      applyOptimistic: vi.fn(),
      rollback,
      affectedKeys: () => [],
      afterSuccess: vi.fn(),
    });

    const result = await options.mutationFn?.({ dimensionId: 'x', projectId: 'p', floorId: 'f' });

    expect(persist).not.toHaveBeenCalled();
    expect(result).toMatchObject({ supported: false });
    expect(rollback).not.toHaveBeenCalled();
  });
});
