import { describe, expect, it, vi } from 'vitest';

import { createMockApiClient } from '@/api/__mocks__/client';
import { SAMPLE_BUILDING, sampleLevelId, sampleWallId } from '@/domain/spatial/__fixtures__/sampleBuilding';
import { applySinglePatch } from '@/domain/spatial/applyPatch';
import { normalizeSpatial, type NormalizedSpatial } from '@/domain/spatial/normalize';
import { isTransientWireError } from '@/lib/errors/wireError';

import { createPropertyInspectorGateway } from './propertyInspectorGateway';

/** Tường `index` của bộ mẫu nằm ở tầng `index % 4`. */
const thicken = (graph: NormalizedSpatial, index: number, thicknessMm = 330): NormalizedSpatial =>
  applySinglePatch(graph, { changes: { thicknessMm }, id: sampleWallId(index), kind: 'wall', op: 'update' });

/**
 * B-V8-41 — lượt lưu gửi mọi tầng có thứ bị đổi so với mốc (lượt lưu trước, hoặc hai
 * đầu lịch sử hoàn tác), mỗi tầng một PUT; B-G-07 — mỗi PUT mang `baseVersion` đúng.
 */
describe('createPropertyInspectorGateway — đích và baseVersion của lượt lưu', () => {
  const base = normalizeSpatial(SAMPLE_BUILDING);

  const setup = (historyEnds: () => readonly NormalizedSpatial[]) => {
    const apiClient = createMockApiClient();
    const writeLayer = vi.spyOn(apiClient.spatial, 'writeLayer');
    const readLayer = vi.spyOn(apiClient.spatial, 'readLayer');
    const gateway = createPropertyInspectorGateway({
      apiClient,
      graph: { read: () => base },
      historyEnds,
      target: () => ({ projectId: 'project-1' }),
    });
    const floors = (): string[] => writeLayer.mock.calls.map(([input]) => input.floorId);

    return { floors, gateway, readLayer, writeLayer };
  };

  it('sửa ở tầng 2 thì đúng một PUT, vào tầng 2', async () => {
    const { floors, gateway } = setup(() => [base]);

    const result = await gateway.persistProperties(thicken(base, 2));

    expect(result).toEqual({ data: [sampleLevelId(2)], ok: true });
    expect(floors()).toEqual([sampleLevelId(2)]);
  });

  it('sửa ở hai tầng thì hai PUT', async () => {
    const { floors, gateway } = setup(() => [base]);

    await gateway.persistProperties(thicken(thicken(base, 1), 3));

    expect([...floors()].sort()).toEqual([sampleLevelId(1), sampleLevelId(3)]);
  });

  it('gọi lại với cùng đồ thị thì không PUT nào nữa', async () => {
    const { gateway, writeLayer } = setup(() => [base]);
    const edited = thicken(base, 2);

    await gateway.persistProperties(edited);
    await gateway.persistProperties(edited);

    expect(writeLayer).toHaveBeenCalledTimes(1);
  });

  it('sửa hai lần cùng một tầng: lượt đầu đọc revision từ N16, lượt sau dùng revision vừa ghi', async () => {
    const { gateway, readLayer, writeLayer } = setup(() => [base]);
    const first = thicken(base, 2);

    await gateway.persistProperties(first);
    await gateway.persistProperties(thicken(first, 2, 440));

    expect(readLayer).toHaveBeenCalledTimes(1);
    expect(writeLayer.mock.calls.map(([input]) => input.baseVersion)).toEqual([0, 1]);
  });

  it('không đọc được revision thì nói ra, không gửi một lượt ghi mù', async () => {
    const { gateway, readLayer, writeLayer } = setup(() => [base]);
    const error = { kind: 'network', raw: undefined, requestId: 'req-1', retryable: true } as const;
    readLayer.mockResolvedValue({ error, ok: false });

    const result = await gateway.persistProperties(thicken(base, 2));

    expect(result.ok).toBe(false);
    expect(writeLayer).not.toHaveBeenCalled();
  });

  it('409 của máy chủ: kết quả mang HttpError gốc, nên tự lưu không thử lại (B-V8-61)', async () => {
    const { gateway, writeLayer } = setup(() => [base]);
    const conflict = { kind: 'http', raw: undefined, requestId: 'req-2', retryable: false, status: 409 } as const;
    writeLayer.mockResolvedValue({ error: conflict, ok: false });

    const result = await gateway.persistProperties(thicken(base, 2));

    expect(result.ok ? null : result.cause).toBe(conflict);
    expect(isTransientWireError(result)).toBe(false);
  });

  it('hoàn tác về giữa lịch sử: mốc là hai đầu [G0, G2], hiện tại G1 — gửi cả L2 lẫn L3', async () => {
    const g1 = thicken(base, 2);
    const g2 = thicken(g1, 3);
    const { floors, gateway } = setup(() => [base, g2]);

    await gateway.persistProperties(g1);

    expect([...floors()].sort()).toEqual([sampleLevelId(2), sampleLevelId(3)]);
  });
});
