/** @vitest-environment node */
import { describe, expect, it } from 'vitest';

import { createSampleBuilding } from '@/domain/spatial/__fixtures__/sampleBuilding';
import { entitiesOfKind } from '@/lib/commands/business/shared';
import { normalizeSpatial } from '@/domain/spatial/normalize';

import { floorDoneSummaryOf } from './floorDoneModel';

describe('floorDoneSummaryOf', () => {
  it('mỗi lớp một câu đếm từ đồ thị của tầng, diện tích là tổng diện tích phòng', () => {
    const graph = normalizeSpatial(createSampleBuilding());
    const level = entitiesOfKind(graph, 'level')[0]!;
    const rooms = entitiesOfKind(graph, 'room').filter((room) => room.levelId === level.id);
    const summary = floorDoneSummaryOf(graph, level.id);

    expect(summary.walls).toMatch(/^\d+ đoạn, tổng dài [\d.,]+ m\.$/u);
    expect(summary.rooms.startsWith(`${rooms.length} phòng`)).toBe(true);
    expect(summary.area).toMatch(/ m²$/u);
  });

  it('tầng không có gì: không bịa số', () => {
    const graph = normalizeSpatial(createSampleBuilding());
    const summary = floorDoneSummaryOf(graph, 'L-khong-co');

    expect(summary.walls).toMatch(/^0 đoạn, tổng dài 0([.,]0)? m.$/u);
    expect(summary.objects).toBe('Tầng không có cửa hay nội thất.');
    expect(summary.rooms).toBe('0 phòng.');
  });
});
