import { describe, expect, it } from 'vitest';

import { sentenceCaseNote } from './versionHistoryModel';

describe('sentenceCaseNote (A6, aesthetic 2.6 #1)', () => {
  it('upper-cases only the first letter of a server note', () => {
    expect(sentenceCaseNote('phục hồi nội dung của phiên bản v3')).toBe('Phục hồi nội dung của phiên bản v3');
    expect(sentenceCaseNote('đã gắn nhãn v5')).toBe('Đã gắn nhãn v5');
    expect(sentenceCaseNote('Đã đúng')).toBe('Đã đúng');
    expect(sentenceCaseNote('')).toBe('');
  });
});
