import { describe, expect, it } from 'vitest';

import { elevationSignedText, heightDraftFromMm, heightMmText } from './floorProgress';
import { draftToMillimetres } from './useFloorManager';

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
