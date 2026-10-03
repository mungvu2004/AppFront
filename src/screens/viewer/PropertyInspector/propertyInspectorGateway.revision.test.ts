import { describe, expect, it, vi } from 'vitest';

import { createMockApiClient } from '@/api/__mocks__/client';
import { SAMPLE_BUILDING, sampleLevelId } from '@/domain/spatial/__fixtures__/sampleBuilding';
import { normalizeSpatial } from '@/domain/spatial/normalize';

import { createPropertyInspectorGateway } from './propertyInspectorGateway';

/**
 * B-G-07 — #35 là `PUT` có version. Lượt lưu phải mang `baseVersion` đúng: lượt
 * đầu lấy `revision` từ N16, lượt sau lấy `revision` mà chính lượt ghi trước trả về.
 */
describe('createPropertyInspectorGateway — baseVersion của lượt lưu', () => {
  it('lượt đầu đọc revision từ N16, lượt sau dùng revision vừa ghi', async () => {
    const apiClient = createMockApiClient();
    const writeLayer = vi.spyOn(apiClient.spatial, 'writeLayer');
    const readLayer = vi.spyOn(apiClient.spatial, 'readLayer');
    const graph = normalizeSpatial(SAMPLE_BUILDING);
    const gateway = createPropertyInspectorGateway({
      apiClient,
      graph: { read: () => graph },
      target: () => ({ floorId: sampleLevelId(0), projectId: 'project-1' }),
    });

    const first = await gateway.persistProperties(graph);
    const second = await gateway.persistProperties(graph);

    expect(first.ok && second.ok).toBe(true);
    expect(readLayer).toHaveBeenCalledTimes(1);
    expect(writeLayer.mock.calls.map(([input]) => input.baseVersion)).toEqual([0, 1]);
  });

  it('không đọc được revision thì nói ra, không gửi một lượt ghi mù', async () => {
    const apiClient = createMockApiClient();
    const error = { kind: 'network', raw: undefined, requestId: 'req-1', retryable: true } as const;
    vi.spyOn(apiClient.spatial, 'readLayer').mockResolvedValue({ error, ok: false });
    const writeLayer = vi.spyOn(apiClient.spatial, 'writeLayer');
    const graph = normalizeSpatial(SAMPLE_BUILDING);
    const gateway = createPropertyInspectorGateway({
      apiClient,
      graph: { read: () => graph },
      target: () => ({ floorId: sampleLevelId(0), projectId: 'project-1' }),
    });

    const result = await gateway.persistProperties(graph);

    expect(result.ok).toBe(false);
    expect(writeLayer).not.toHaveBeenCalled();
  });
});
