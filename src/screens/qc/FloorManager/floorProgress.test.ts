import { describe, expect, it } from 'vitest';

import type { FloorAlignment, FloorAlignmentReport } from '@/domain/axes/alignFloors';
import type { Wall } from '@/domain/spatial/types';

import { THICKNESS_FIXTURE_LEVELS, THICKNESS_FIXTURE_WALLS } from '../ThicknessStandardization/thicknessFixture';
import { thicknessGraphOf } from '../ThicknessStandardization/thicknessStandardizationGateway';

import { FLOOR_MANAGER_FIXTURE_ROWS } from './floorManagerFixture';
import { elevationSignedText, floorStepOf, heightDraftFromMm, heightMmText, nextTaskOf } from './floorProgress';
import { draftToMillimetres, floorScaleMissingOf, hasNoSharedAxes } from './useFloorManager';

describe('cao độ và chiều cao kiểu bản vẽ (S-19 bản Z)', () => {
  it('cao độ có dấu, 3 chữ số; chiều cao mm tách nghìn', () => {
    expect(elevationSignedText(0)).toBe('±0.000');
    expect(elevationSignedText(3000)).toBe('+3.000');
    expect(elevationSignedText(-3000)).toBe('−3.000');
    expect(elevationSignedText(500)).toBe('+0.500');
    expect(heightMmText(3600)).toBe('3.600');
  });
});

describe('ô chiều cao nhập mm, nháp của hook tính bằng mét', () => {
  it('3600 mm đi vòng qua nháp mét rồi đọc lại đúng 3600 mm', () => {
    for (const mm of [3000, 3600, 2850, 12500]) {
      expect(draftToMillimetres(heightDraftFromMm(mm))).toBe(mm);
    }
    expect(heightDraftFromMm(undefined)).toBe('');
  });
});

describe('tầng máy không đo được tỷ lệ (UX-R1 K06/K12)', () => {
  const drawn = FLOOR_MANAGER_FIXTURE_ROWS.filter((row) => row.hasDrawing);
  const [first, second, third] = drawn;
  const rows = drawn.map((row) => ({ ...row, isScaleMissing: row !== first }));

  it('nhãn đỏ "Chưa có tỷ lệ", diện tích "Chưa có"', () => {
    const step = floorStepOf({ ...third!, isScaleMissing: true, scaleState: 'missing' });

    expect(step.label).toBe('Chưa có tỷ lệ');
    expect(step.tone).toBe('violation');
    expect(step.summaryText).not.toContain('m²');
    expect(step.summaryText).toContain('Chưa có');
  });

  it('UX-R2: tỷ lệ cần kiểm là chip vàng, diện tích ghi "≈ … (tạm)"', () => {
    const step = floorStepOf({ ...third!, scaleState: 'check', areaText: '67,73 m²' });

    expect(step.label).toBe('Tỷ lệ cần kiểm');
    expect(step.tone).toBe('attention');
    expect(step.summaryText).toContain('≈ 67,73 m² (tạm)');
  });

  it('tỷ lệ đã xác nhận: in diện tích thật', () => {
    expect(floorStepOf({ ...third!, areaText: '67,73 m²' }).summaryText).toContain(', 67,73 m²');
  });

  it('Việc tiếp đòi đặt tỷ lệ tầng sai đầu tiên trước khi duyệt tường', () => {
    const task = nextTaskOf(rows);

    expect(task?.kind).toBe('scale');
    expect(task?.floorId).toBe(second!.id);
    expect(task?.actionLabel).toBe(`Đặt tỷ lệ ${second!.name} (còn 2 tầng)`);
  });

  it('đủ tỷ lệ thì quay về duyệt tường', () => {
    expect(nextTaskOf(drawn)?.kind).toBe('review');
  });
});

describe('cảnh báo các tầng không có trục chung (UX-R1 K19)', () => {
  const floor = (levelId: string, isBase: boolean, axisCount: number, matchedAxisCount: number): FloorAlignment =>
    ({ levelId, isBase, axisCount, matchedAxisCount }) as unknown as FloorAlignment;
  const report = (floors: readonly FloorAlignment[]): FloorAlignmentReport => ({ baseLevelId: null, floors, issues: [] });

  it('mọi tầng khớp dưới 2 trục với tầng chuẩn thì cảnh báo', () => {
    expect(hasNoSharedAxes(report([floor('a', true, 6, 6), floor('b', false, 5, 0), floor('c', false, 4, 1)]))).toBe(true);
  });

  it('K09: đa số tầng không khớp thì vẫn cảnh báo dù một tầng khớp tình cờ', () => {
    expect(
      hasNoSharedAxes(report([floor('a', true, 6, 6), floor('b', false, 5, 0), floor('c', false, 4, 3), floor('d', false, 4, 0)])),
    ).toBe(true);
  });

  it('nửa số tầng khớp đủ trục, hoặc chưa tầng nào có trục, thì không', () => {
    expect(hasNoSharedAxes(report([floor('a', true, 6, 6), floor('b', false, 5, 0), floor('c', false, 4, 3)]))).toBe(false);
    expect(hasNoSharedAxes(report([floor('a', true, 6, 6), floor('b', false, 0, 0)]))).toBe(false);
  });
});

describe('[K12] tầng cần đặt tỷ lệ trước — cùng luật với thanh bước', () => {
  const level = THICKNESS_FIXTURE_LEVELS[0]!;
  const ownWalls = THICKNESS_FIXTURE_WALLS.filter((wall) => wall.levelId === level.id);
  const plausible = thicknessGraphOf(ownWalls, [level]);
  /* Khung tường 2,5 m (< 3 m): máy đo được nhưng ra hình vô lý. */
  const tiny = thicknessGraphOf(
    ownWalls.map((wall, index): Wall => ({ ...wall, centreline: { start: { x: 0, y: index * 100 }, end: { x: 2500, y: index * 100 } } })),
    [level],
  );

  it('máy đo ra hình vô lý cũng là "Chưa có tỷ lệ", không chỉ khi không đo được', () => {
    expect(floorScaleMissingOf(tiny, level, { revision: 0, scaleStatus: 'unresolved', scaleSource: 'pipeline' })).toBe(true);
    expect(floorScaleMissingOf(plausible, level, { revision: 0, scaleStatus: 'unresolved', scaleSource: 'project_default' })).toBe(true);
  });

  it('máy đo được, hình hợp lý, hoặc kho chưa biết tỷ lệ thì không', () => {
    expect(floorScaleMissingOf(plausible, level, { revision: 0, scaleStatus: 'unresolved', scaleSource: 'pipeline' })).toBe(false);
    expect(floorScaleMissingOf(tiny, level, { revision: 0 })).toBe(false);
    expect(floorScaleMissingOf(tiny, level, undefined)).toBe(false);
  });
});
