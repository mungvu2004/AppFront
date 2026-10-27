import { describe, expect, it } from 'vitest';

import {
  MISSING_SCALE_MESSAGE,
  PROVISIONAL_MEASURE_TEXT,
  isMeasuredScaleImplausible,
  isScaleMissing,
  measureTextOf,
  provisionalScaleNoticeOf,
  SCALE_STATE_VIEWS,
  scaleFloorsMessageOf,
  scaleStateOf,
  thicknessLockTextOf,
} from '../provisionalScale';

describe('provisionalScale', () => {
  it('marks a measure from a scale that needs checking as approximate', () => {
    expect(measureTextOf('12,5 m', 'unresolved')).toBe('≈ 12,5 m (tạm)');
    expect(measureTextOf('12,5 m', 'unresolved', 'pipeline')).toBe('≈ 12,5 m (tạm)');
    expect(PROVISIONAL_MEASURE_TEXT).toBe('Chưa có — tỷ lệ tạm');
  });

  it('hides the measure when the floor has no scale', () => {
    expect(measureTextOf('12,5 m', 'unresolved', 'project_default')).toBe('Chưa có');
  });

  it('keeps the measure when the scale is settled', () => {
    expect(measureTextOf('12,5 m', undefined)).toBe('12,5 m');
    expect(measureTextOf('12,5 m', undefined, 'project_default')).toBe('12,5 m');
  });

  it('raises an attention notice only for a provisional scale', () => {
    expect(provisionalScaleNoticeOf('unresolved')).toEqual({
      level: 'attention',
      message: 'Tỷ lệ tạm — số đo chưa tin được, hãy hiệu chỉnh tỷ lệ.',
    });
    expect(provisionalScaleNoticeOf(undefined)).toBeNull();
  });

  it('turns red only when the server could not measure the floor (UX-R1 K12)', () => {
    expect(isScaleMissing('project_default')).toBe(true);
    expect(isScaleMissing('pipeline')).toBe(false);
    expect(isScaleMissing(undefined)).toBe(false);
    expect(provisionalScaleNoticeOf('unresolved', 'project_default')).toEqual({
      level: 'violation',
      message: MISSING_SCALE_MESSAGE,
    });
    expect(provisionalScaleNoticeOf('unresolved', 'pipeline')?.level).toBe('attention');
    expect(provisionalScaleNoticeOf(undefined, 'project_default')).toBeNull();
  });

  it('locks thickness changes when the scale is missing or walls are implausibly thin (K09)', () => {
    expect(thicknessLockTextOf([16, 7, 15.4])).toBe('Tường đo ra 7–16 mm vì chưa có tỷ lệ. Đặt tỷ lệ trước.');
    expect(thicknessLockTextOf([220, 200], 'project_default')).toBe(
      'Tường đo ra 200–220 mm vì chưa có tỷ lệ. Đặt tỷ lệ trước.',
    );
    expect(thicknessLockTextOf([], 'project_default')).toBe('Độ dày tường đang sai vì chưa có tỷ lệ. Đặt tỷ lệ trước.');
    expect(thicknessLockTextOf([20, 200, 220], 'pipeline')).toBeNull();
    expect(thicknessLockTextOf([])).toBeNull();
  });

  it('treats a measured scale as missing when walls are < 50 mm or the plan frame is < 3 m (Codex P1)', () => {
    expect(isMeasuredScaleImplausible([16, 7, 15.4], 9000)).toBe(true);
    expect(isMeasuredScaleImplausible([200, 220], 2500)).toBe(true);
    expect(isMeasuredScaleImplausible([200, 220], 9000)).toBe(false);
    expect(isMeasuredScaleImplausible([], undefined)).toBe(false);
  });

  it('names every bad floor in the 3D banner, missing ones first (K44)', () => {
    expect(scaleFloorsMessageOf([], [])).toBeNull();
    expect(scaleFloorsMessageOf(['ch-01', 'ch-02', 'ch-04', 'ch-05', 'ch-06', 'ch-08'], ['ch-03'])).toBe(
      '6 tầng không đo được tỷ lệ, kích thước 3D sai: ch-01, ch-02, ch-04, ch-05, ch-06, ch-08. ' +
        '1 tầng chưa hiệu chỉnh tỷ lệ, kích thước 3D có thể sai: ch-03.',
    );
  });

  it('one source for the three scale states: name, colour, action (UX-R2 K50)', () => {
    expect(scaleStateOf(undefined, undefined)).toBe('confirmed');
    expect(scaleStateOf('unresolved', 'project_default')).toBe('missing');
    expect(scaleStateOf('unresolved', 'pipeline')).toBe('check');
    expect(scaleStateOf('unresolved', undefined)).toBe('check');
    expect(SCALE_STATE_VIEWS.missing).toEqual({ name: 'Chưa có tỷ lệ', statusCode: 'violation', action: 'Đặt tỷ lệ' });
    expect(SCALE_STATE_VIEWS.check).toEqual({ name: 'Tỷ lệ cần kiểm', statusCode: 'attention', action: 'Xác nhận tỷ lệ' });
    expect(SCALE_STATE_VIEWS.confirmed.statusCode).toBe('verified');
    expect(MISSING_SCALE_MESSAGE.startsWith(SCALE_STATE_VIEWS.missing.name)).toBe(true);
  });
});
