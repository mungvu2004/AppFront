import { describe, expect, it } from 'vitest';

import { parseTelemetryEvent } from '@/lib/telemetry/events';

import { FRAME_BUDGET_MS, autoTier, initialTier, lowerTier, onDeviceLost, percentile, tierSsgi, useDeviceEpoch } from './tiers';
import { useRealism } from './store';

describe('tiers', () => {
  it('autoTier: hạ một mức sau 5 giây liền vượt ngân sách, không tự nâng', () => {
    const slow = FRAME_BUDGET_MS + 1;
    expect(autoTier('medium', [slow, slow, slow, slow])).toBe('medium');
    expect(autoTier('medium', [slow, slow, slow, 10, slow])).toBe('medium');
    expect(autoTier('medium', [slow, slow, slow, slow, slow])).toBe('low');
    expect(autoTier('high', [slow, slow, slow, slow, slow])).toBe('medium');
    expect(autoTier('low', [slow, slow, slow, slow, slow])).toBe('low');
    expect(autoTier('low', [1, 1, 1, 1, 1])).toBe('low');
    expect(lowerTier('low')).toBe('low');
  });

  it('initialTier: WebGL / GPU tích hợp / fallback → low; còn lại medium', () => {
    expect(initialTier('webgl', undefined)).toBe('low');
    expect(initialTier('webgpu', { vendor: 'intel', architecture: 'gen-12lp' })).toBe('low');
    expect(initialTier('webgpu', { vendor: 'nvidia', architecture: 'lovelace', isFallbackAdapter: true })).toBe('low');
    expect(initialTier('webgpu', { vendor: 'nvidia', architecture: 'lovelace' })).toBe('medium');
    expect(initialTier('webgpu', undefined)).toBe('medium');
  });

  it('tierSsgi: tier là nguồn cuối; medium giữ SSGI_PARAMS (đã ghép renderLook)', () => {
    const base = { sliceCount: 2, stepCount: 8, radius: 2 };
    expect(tierSsgi('medium', base)).toBe(base);
    expect(tierSsgi('high', base)).toEqual({ sliceCount: 3, stepCount: 16, radius: 2 });
  });

  it('percentile', () => {
    expect(percentile([], 95)).toBe(0);
    expect(percentile([5, 1, 3, 2, 4], 50)).toBe(3);
    expect(percentile(Array.from({ length: 100 }, (_, i) => i + 1), 95)).toBe(96);
  });

  it('onDeviceLost: low + dựng lại canvas; bỏ qua lý do destroyed', () => {
    useRealism.setState({ tier: 'medium' });
    onDeviceLost({ reason: 'destroyed' });
    expect(useDeviceEpoch.getState().epoch).toBe(0);
    onDeviceLost({ reason: 'unknown' });
    expect(useRealism.getState().tier).toBe('low');
    expect(useDeviceEpoch.getState().epoch).toBe(1);
  });

  it('sự kiện frame_p95 / tier_change hợp schema', () => {
    expect(parseTelemetryEvent({ name: 'viewer.tier_change', from: 'medium', to: 'low', auto: true })).toBeTruthy();
    expect(
      parseTelemetryEvent({ name: 'viewer.frame_p95', p50Ms: 7, p95Ms: 21, frameCount: 3600, backend: 'webgpu', tier: 'medium' }),
    ).toBeTruthy();
  });
});
