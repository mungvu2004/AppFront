import { describe, expect, it } from 'vitest';

import { MOCK_MODEL_VERSIONS } from '@/api/__mocks__/adminMlClient';
import type { ModelVersion } from '@/api/schemas/adminMl';

import { betterVersionNote } from './useModelRegistry';

const base = MOCK_MODEL_VERSIONS.find((version) => version.family === 'openingAndFurnitureDetection' && version.metrics !== undefined);
if (base === undefined) throw new Error('mock thiếu bản nhận diện có số đo');
const metricKey = Object.keys(base.metrics ?? {})[0] ?? 'map50';

const make = (id: string, value: number, evaluationStatus: ModelVersion['evaluationStatus'] = 'completed'): ModelVersion => ({
  ...base,
  id,
  label: id,
  evaluationStatus,
  metrics: { ...base.metrics, [metricKey]: value },
});

describe('betterVersionNote (G2-20)', () => {
  it('có bản đã đánh giá cao hơn hẳn → nêu tên bản đó', () => {
    const active = make('dang-dung', 0.223);
    expect(betterVersionNote(active, [active, make('tot', 0.995), make('vua', 0.5)])).toContain('tot');
  });

  it('chênh nhỏ hoặc bản chưa đánh giá → không nhắc', () => {
    const active = make('dang-dung', 0.6);
    expect(betterVersionNote(active, [active, make('nho', 0.62), make('cho', 0.99, 'pending')])).toBeNull();
  });
});
