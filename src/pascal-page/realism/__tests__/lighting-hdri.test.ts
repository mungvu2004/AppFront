import { DataTexture, FileLoader, FloatType, RGBAFormat, Scene } from 'three';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import {
  initializeGpuRenderer,
  prewarmWebGpuDevice,
} from '../../../../vendor/pascal/packages/viewer/src/lib/renderer-capability';
import { useRealism } from '../store';

// HDRLoader giả: trả ảnh float 4×2 đồng bộ (không cần mạng/giải mã RGBE).
vi.mock('three/addons/loaders/HDRLoader.js', () => ({
  HDRLoader: class {
    setDataType() {
      return this;
    }
    load(_url: string, onLoad: (t: DataTexture) => void) {
      onLoad(new DataTexture(new Float32Array(4 * 2 * 4).fill(1), 4, 2, RGBAFormat, FloatType));
    }
  },
}));

const { installHdri, prefetchHdri } = await import('../lighting-hdri');

const flush = () => new Promise((resolve) => setTimeout(resolve, 0));

describe('installHdri: một nút môi trường từ lượt vẽ đầu', () => {
  const fetchMock = vi.spyOn(FileLoader.prototype, 'loadAsync').mockImplementation(async () => new ArrayBuffer(8));

  beforeEach(() => {
    URL.createObjectURL ??= () => 'blob:x';
    URL.revokeObjectURL ??= () => {};
    useRealism.setState({ backend: 'webgpu' });
  });
  afterEach(() => {
    vi.unstubAllGlobals();
    useRealism.setState({ backend: 'unknown' });
  });

  it('đặt PMREMNode quanh trời gradient ngay, HDRI về chỉ đổi value cùng nút; dọn trả nút cũ', async () => {
    const scene = new Scene();
    const gradient = new DataTexture(new Float32Array(4), 1, 1, RGBAFormat, FloatType);
    scene.environment = gradient;

    const dispose = installHdri(scene, 'light', 'studio');
    const node = scene.environmentNode as unknown as { value: unknown; isPMREMNode?: boolean };
    expect(node).toBeTruthy();
    expect(node.value).toBe(gradient);

    await flush();
    await flush();
    expect(scene.environmentNode).toBe(node); // cùng danh tính → khoá cache vật liệu giữ nguyên
    expect(node.value).not.toBe(gradient);
    expect(scene.environment).toBe(gradient); // không đụng `scene.environment` nữa

    dispose();
    expect(scene.environmentNode).toBeUndefined(); // giá trị ban đầu của Scene
  });

  it('chủ đề tối / ?hdri=off: không đụng cảnh; tải byte một lần cho cả prefetch lẫn cài', async () => {
    const scene = new Scene();
    installHdri(scene, 'dark')();
    expect(scene.environmentNode).toBeUndefined(); // giá trị ban đầu của Scene

    vi.stubGlobal('navigator', { gpu: {} });
    fetchMock.mockClear();
    prefetchHdri('sunset-only-once', 'light');
    prefetchHdri('sunset-only-once', 'light');
    prefetchHdri('sunset-only-once', 'dark');
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
});

describe('prewarmWebGpuDevice', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('lượt xin device kế tiếp cùng powerPreference nhận lại device xin sớm (không xin adapter lần 2)', async () => {
    const device = { destroy: vi.fn() };
    const requestAdapter = vi.fn(async () => ({ requestDevice: async () => device }));
    const gpu = { requestAdapter };
    vi.stubGlobal('navigator', { gpu });

    prewarmWebGpuDevice('high-performance');
    const createRenderer = vi.fn(() => ({ init: async () => undefined }));
    const result = await initializeGpuRenderer({ createRenderer, gpu, powerPreference: 'high-performance', probeCanvas: null });

    expect(result.status).toBe('ready');
    expect(requestAdapter).toHaveBeenCalledTimes(1);
    expect(createRenderer).toHaveBeenCalledWith({ device });
    expect(device.destroy).not.toHaveBeenCalled();
  });

  it('khác powerPreference: trả device xin sớm, xin device mới', async () => {
    const early = { destroy: vi.fn() };
    const fresh = { destroy: vi.fn() };
    const requestDevice = vi.fn().mockResolvedValueOnce(early).mockResolvedValueOnce(fresh);
    const gpu = { requestAdapter: vi.fn(async () => ({ requestDevice })) };
    vi.stubGlobal('navigator', { gpu });

    prewarmWebGpuDevice('high-performance');
    const createRenderer = vi.fn(() => ({ init: async () => undefined }));
    await initializeGpuRenderer({ createRenderer, gpu, powerPreference: 'low-power', probeCanvas: null });
    await flush();

    expect(createRenderer).toHaveBeenCalledWith({ device: fresh });
    expect(early.destroy).toHaveBeenCalled();
  });
});
