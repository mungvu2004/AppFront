import { describe, expect, it } from 'vitest';

import { MOCK_MODEL_VERSIONS } from '@/api/__mocks__/adminMlClient';
import type { ModelVersion } from '@/api/schemas/adminMl';

import { betterVersionNote, metricComparabilityNote } from './useModelRegistry';

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

  it('bản gốc (seed) có điểm cao vẫn không được gợi ý (U25)', () => {
    const active = make('dang-dung', 0.252);
    const seed = { ...make('goc', 0.995), label: 'Gốc', creatorId: 'system:pipeline' };
    expect(betterVersionNote(active, [active, seed])).toBeNull();
  });
});

describe('metricComparabilityNote (U55)', () => {
  it('không rõ bộ dữ liệu hoặc khác bộ → nói không so thẳng được', () => {
    // Bản tải lên không mang bộ dữ liệu: không biết chấm trên tập nào.
    const unknownSet = (id: string, value: number): ModelVersion => {
      const copy = { ...make(id, value) };
      delete copy.datasetVersionId;
      return copy;
    };
    const active = unknownSet('dang-dung', 0.955);
    expect(metricComparabilityNote(active, [active, unknownSet('khac', 0.982)])).toContain('không so thẳng');
    const onA = { ...make('a', 0.955), datasetVersionId: 'ds-a' };
    expect(metricComparabilityNote(onA, [onA, { ...make('b', 0.982), datasetVersionId: 'ds-b' }])).not.toBeNull();
  });

  it('cùng một bộ dữ liệu, hoặc không có bản nào khác để so → không nhắc', () => {
    const onA = { ...make('a', 0.955), datasetVersionId: 'ds-a' };
    expect(metricComparabilityNote(onA, [onA, { ...make('b', 0.982), datasetVersionId: 'ds-a' }])).toBeNull();
    expect(metricComparabilityNote(onA, [onA, make('cho', 0.99, 'pending')])).toBeNull();
  });
});
