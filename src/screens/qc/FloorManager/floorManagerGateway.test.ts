/**
 * FE3D-FIX-003 W4b — cổng THẬT lưu cờ ẩn 3D (PATCH #34) và lớp của tầng nhân bản (PUT #35).
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';

import type { ApiClient } from '@/api/client';
import { toFloorWirePayload } from '@/api/contracts';
import { FloorLayerWriteSchema } from '@/api/schemas/spatialLayer';
import { useStore } from '@/store';

import {
  createFloorManagerGateway,
  createFloorManagerSampleGraph,
  FLOOR_MANAGER_SAVE_FAILED_NOTICES,
  FLOOR_MANAGER_SAMPLE_GROUND_ID,
} from './floorManagerGateway';

const PROJECT_ID = 'P-0000000001';
const GROUND = String(FLOOR_MANAGER_SAMPLE_GROUND_ID);
const failure = { ok: false, error: { kind: 'http', status: 422, requestId: 'R', retryable: false, raw: null } };

function gatewayWith(spatial: Partial<ApiClient['spatial']>) {
  const api = { spatial } as unknown as ApiClient;

  return createFloorManagerGateway({ api, graph: { read: createFloorManagerSampleGraph } });
}

beforeEach(() => {
  // Hành động công khai: `setSpatial` không có revision → `floorMeta` rỗng.
  useStore.getState().setSpatial(null, null);
});

describe('persistHiddenIn3d', () => {
  it.each([true, false])('PATCH #34 mang đúng { hiddenIn3d: %s }', async (isHidden) => {
    const patchFloor = vi.fn().mockResolvedValue({ ok: true, data: {} });
    const gateway = gatewayWith({ patchFloor });

    await expect(gateway.persistHiddenIn3d({ projectId: PROJECT_ID, floorId: GROUND, isHidden })).resolves.toEqual({
      supported: true,
      value: undefined,
    });
    expect(gateway.supports.hideFloorFrom3d).toBe(true);
    expect(patchFloor).toHaveBeenCalledWith({ body: { hiddenIn3d: isHidden }, floorId: GROUND, projectId: PROJECT_ID });
    // Lớp dây không lọc mất khoá (BE FloorPatchIn: StrictBool, alias hiddenIn3d).
    expect(toFloorWirePayload({ hiddenIn3d: isHidden })).toStrictEqual({ hiddenIn3d: isHidden });
  });

  it('máy chủ từ chối → nói câu lưu hỏng, không phải câu "chưa có đường"', async () => {
    const gateway = gatewayWith({ patchFloor: vi.fn().mockResolvedValue(failure) });
    const result = await gateway.persistHiddenIn3d({ projectId: PROJECT_ID, floorId: GROUND, isHidden: true });

    expect(result).toMatchObject({ supported: false, notice: FLOOR_MANAGER_SAVE_FAILED_NOTICES.hideFloorFrom3d });
  });
});

describe('persistFloorContents', () => {
  it('PUT #35 lớp của tầng với base 0 cho tầng mới, thân qua schema chặt, nhớ revision mới', async () => {
    const writeLayer = vi.fn().mockResolvedValue({ ok: true, data: { layer: {}, revision: 1 } });
    const gateway = gatewayWith({ writeLayer });

    await expect(gateway.persistFloorContents({ projectId: PROJECT_ID, floorId: GROUND })).resolves.toEqual({
      supported: true,
      value: undefined,
    });

    const input = writeLayer.mock.calls[0]?.[0] as { baseVersion: number; body: unknown; floorId: string };

    expect(input.floorId).toBe(GROUND);
    expect(input.baseVersion).toBe(0);
    expect(FloorLayerWriteSchema.safeParse({ baseVersion: input.baseVersion, body: input.body }).success).toBe(true);
    expect((input.body as { layer: { walls: unknown[] } }).layer.walls.length).toBeGreaterThan(0);
    expect(useStore.getState().floorMeta[GROUND]).toEqual({ revision: 1 });
  });

  it('base là revision kho đang biết', async () => {
    useStore.getState().updateFloorMeta(GROUND, { revision: 4 });
    const writeLayer = vi.fn().mockResolvedValue({ ok: true, data: { layer: {}, revision: 5 } });

    await gatewayWith({ writeLayer }).persistFloorContents({ projectId: PROJECT_ID, floorId: GROUND });

    expect(writeLayer.mock.calls[0]?.[0]).toMatchObject({ baseVersion: 4 });
  });

  it('tầng không có trong đồ thị → không gửi gì', async () => {
    const writeLayer = vi.fn();
    const result = await gatewayWith({ writeLayer }).persistFloorContents({ projectId: PROJECT_ID, floorId: 'L-NOPE' });

    expect(result.supported).toBe(true);
    expect(writeLayer).not.toHaveBeenCalled();
  });

  it('máy chủ từ chối → câu lưu hỏng, revision không đổi', async () => {
    const result = await gatewayWith({ writeLayer: vi.fn().mockResolvedValue(failure) }).persistFloorContents({
      projectId: PROJECT_ID,
      floorId: GROUND,
    });

    expect(result).toMatchObject({ supported: false, notice: FLOOR_MANAGER_SAVE_FAILED_NOTICES.persistFloorContents });
    expect(useStore.getState().floorMeta[GROUND]).toBeUndefined();
  });
});
