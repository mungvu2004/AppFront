import { describe, expect, it } from 'vitest';

import { displayStatusCode } from './WallLayerList';

// V-06: tam giác chỉ khi thật cần — tường AI chưa duyệt, tin cậy đủ, độ dày chuẩn → chấm trung tính.
describe('displayStatusCode', () => {
  const base = { isLowConfidence: false, isNonStandardThickness: false } as const;

  it('hạ attention không lý do xuống neutral', () => {
    expect(displayStatusCode({ ...base, statusCode: 'attention' })).toBe('neutral');
  });

  it('giữ attention khi tin cậy thấp hoặc độ dày ngoài chuẩn', () => {
    expect(displayStatusCode({ ...base, statusCode: 'attention', isLowConfidence: true })).toBe('attention');
    expect(displayStatusCode({ ...base, statusCode: 'attention', isNonStandardThickness: true })).toBe('attention');
  });

  it('không đụng verified / violation', () => {
    expect(displayStatusCode({ ...base, statusCode: 'verified' })).toBe('verified');
    expect(displayStatusCode({ ...base, statusCode: 'violation' })).toBe('violation');
  });
});
