import { afterEach, describe, expect, it, vi } from 'vitest';

import { parseTelemetryEvent } from '@/lib/telemetry/events';

import { backendOf, isWebGpuBackend, reportBackend, reportDeviceLost } from '../backend';
import { DEFAULT_REALISM_FLAGS, realismFlagsFrom, useRealism } from '../store';
import { emitRealism, setRealismTrack } from '../telemetry';

const webgpu = { backend: { isWebGPUBackend: true } };
const webgl = { backend: { isWebGLBackend: true } };

afterEach(() => {
  setRealismTrack(null);
  useRealism.setState({ backend: 'unknown' });
});

describe('realism store', () => {
  it('mặc định đúng CONTRACT', () => {
    const s = useRealism.getState();
    expect([s.backend, s.tier, s.tierMode]).toEqual(['unknown', 'medium', 'auto']);
    expect(s.flags).toEqual(DEFAULT_REALISM_FLAGS);
  });

  it('cờ thiếu = bật, cờ false = tắt', () => {
    expect(realismFlagsFrom({ 'viewer.realism-traa': false })).toEqual({ ...DEFAULT_REALISM_FLAGS, traa: false });
  });
});

describe('realism backend', () => {
  it('đọc backend thật của renderer', () => {
    expect(backendOf(webgpu)).toBe('webgpu');
    expect(backendOf(webgl)).toBe('webgl');
    expect(backendOf({})).toBe('unknown');
    expect(backendOf(null)).toBe('unknown');
    expect(isWebGpuBackend(webgl)).toBe(false);
  });

  it('ghi store + gửi viewer.backend một lần mỗi lần đổi', () => {
    const track = vi.fn();
    setRealismTrack(track);
    reportBackend(webgl);
    reportBackend(webgl);
    reportBackend({});
    expect(useRealism.getState().backend).toBe('webgl');
    expect(track).toHaveBeenCalledTimes(1);
    expect(parseTelemetryEvent(track.mock.calls[0]?.[0])).toEqual({ name: 'viewer.backend', backend: 'webgl' });
  });

  it('mất thiết bị → viewer.device_lost hợp lệ', () => {
    const track = vi.fn();
    setRealismTrack(track);
    reportDeviceLost({ reason: 'destroyed' });
    reportDeviceLost(undefined);
    expect(track.mock.calls.map((c) => parseTelemetryEvent(c[0]))).toEqual([
      { name: 'viewer.device_lost', reason: 'destroyed' },
      { name: 'viewer.device_lost', reason: 'unknown' },
    ]);
  });
});

describe('realism telemetry', () => {
  it('sender ném lỗi không làm hỏng trang', () => {
    setRealismTrack(() => {
      throw new Error('x');
    });
    expect(() => emitRealism({ name: 'viewer.backend', backend: 'webgpu' })).not.toThrow();
  });

  it('frame_p95 + tier_change qua schema', () => {
    expect(parseTelemetryEvent({ name: 'viewer.frame_p95', p50Ms: 8.4, p95Ms: 16.6, frameCount: 3600, backend: 'webgpu', tier: 'high' })).toMatchObject({ p95Ms: 17 });
    expect(parseTelemetryEvent({ name: 'viewer.tier_change', from: 'high', to: 'low', auto: true })).not.toBeNull();
  });
});
