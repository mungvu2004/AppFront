/**
 * Bài kiểm đầu tiên của AppFront chạy trên **gói Pascal thật**.
 *
 * Mọi bài kiểm Pascal trước đây (`src/lib/pascal/__tests__`) chỉ đối chiếu hình dạng dữ
 * liệu với kiểu AppFront tự khai. Tệp này nhập `@pascal-app/*` thật từ
 * `vendor/pascal/packages/*` và nạp cảnh vào chính store của Pascal, nên nó bắt được lớp
 * khuyết tật mà bài kiểm hình dạng không thấy: lược đồ đổi, store dọn node đi, registry
 * không có loại node cần dùng.
 *
 * Không dựng 3D ở đây — jsdom không có WebGL. Việc dựng hình đo bằng tay trong trình
 * duyệt, ghi ở `docs/pascal/IMPLEMENTATION_STATUS.md` §4.9.
 */

import { emitter } from '@pascal-app/core';
import { useViewer } from '@pascal-app/viewer';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import {
  createSampleBuilding,
  SAMPLE_AXIS_COUNT,
  SAMPLE_DOOR_COUNT,
  SAMPLE_FURNITURE_COUNT,
  SAMPLE_LEVEL_COUNT,
  SAMPLE_ROOM_COUNT,
  SAMPLE_WALL_COUNT,
  SAMPLE_WINDOW_COUNT,
} from '@/domain/spatial/__fixtures__/sampleBuilding';
import { toPascalScene } from '@/lib/pascal/toPascal';

import {
  clearPascalScene,
  frameEntityInPascal,
  highlightPascalNodes,
  loadPascalPlugins,
  loadSceneIntoPascal,
} from '../pascalScene';

/**
 * Site + building + tầng + tường + ô mở + phòng + **sàn** + đồ đạc + trục (`structural-grid`, S9).
 *
 * `SAMPLE_ROOM_COUNT` đếm HAI lần, và đó không phải lỗi gõ: một phòng ra hai
 * node — `zone` là khối không gian, `slab` là mặt sàn nhìn thấy được. Bỏ `slab`
 * thì nhìn xuống chỉ thấy nền trời.
 */
const EXPECTED_NODE_COUNT =
  2 +
  SAMPLE_LEVEL_COUNT +
  SAMPLE_WALL_COUNT +
  SAMPLE_DOOR_COUNT +
  SAMPLE_WINDOW_COUNT +
  SAMPLE_ROOM_COUNT * 2 +
  SAMPLE_FURNITURE_COUNT +
  SAMPLE_AXIS_COUNT;

describe('nạp cảnh AppFront vào Pascal thật', () => {
  beforeEach(() => {
    clearPascalScene();
  });

  it('registry nhận bộ loại node dựng sẵn, và nhận được nhiều lần', async () => {
    await expect(loadPascalPlugins()).resolves.toBeUndefined();
    await expect(loadPascalPlugins()).resolves.toBeUndefined();
  });

  it('store giữ đủ mọi node, không dọn đi cái nào', async () => {
    const { scene } = toPascalScene(createSampleBuilding());

    const result = await loadSceneIntoPascal(scene);

    expect(result.droppedIds).toEqual([]);
    expect(result.nodeCount).toBe(EXPECTED_NODE_COUNT);
    expect(result.nodeCount).toBe(Object.keys(scene.nodes).length);
  });

  it('dấu xác minh của A5 sống qua store của Pascal', async () => {
    const { scene } = toPascalScene(createSampleBuilding());
    const zoneId = Object.values(scene.nodes).find((node) => node.type === 'zone')?.id;

    await loadSceneIntoPascal(scene);

    const { default: useScene } = await import('@pascal-app/core/store');
    // Khoá của `nodes` là kiểu mẫu (`zone_${string}`…), nên tra bằng một
    // `string` thường không hợp lệ; duyệt giá trị là cách đọc đúng kiểu.
    const zone = Object.values(useScene.getState().nodes).find((node) => node.id === zoneId);

    expect(zone).toBeDefined();
    expect((zone as { metadata?: { appfront?: { reviewed?: boolean } } }).metadata?.appfront).toBeDefined();
  });

  it('dọn cảnh thì store về rỗng', async () => {
    const { scene } = toPascalScene(createSampleBuilding());
    await loadSceneIntoPascal(scene);

    clearPascalScene();

    const { default: useScene } = await import('@pascal-app/core/store');
    expect(Object.keys(useScene.getState().nodes)).toHaveLength(0);
  });
});

describe('tô sáng và khuôn camera theo mã AppFront', () => {
  beforeEach(() => {
    clearPascalScene();
    highlightPascalNodes([]);
  });

  it('tô sáng qua externalSelectedIds của viewer, không đụng vùng chọn sửa', () => {
    highlightPascalNodes(['wall_a', 'wall_b']);

    expect(useViewer.getState().externalSelectedIds).toEqual(['wall_a', 'wall_b']);
    expect(useViewer.getState().selection.selectedIds).toEqual([]);
  });

  it('khuôn camera vào node mang mã ấy, và để yên khi không có node nào', async () => {
    const { scene } = toPascalScene(createSampleBuilding());
    await loadSceneIntoPascal(scene);
    const wallNodeId = Object.keys(scene.nodes).find((id) => id.startsWith('wall_')) ?? '';
    const focused = vi.fn();
    emitter.on('camera-controls:focus', focused);

    expect(frameEntityInPascal(wallNodeId.slice('wall_'.length))).toBe(true);
    expect(focused).toHaveBeenCalledWith({ nodeId: wallNodeId });

    focused.mockClear();
    expect(frameEntityInPascal('khong-co-ma-nay')).toBe(false);
    expect(focused).not.toHaveBeenCalled();
    emitter.off('camera-controls:focus', focused);
  });
});
