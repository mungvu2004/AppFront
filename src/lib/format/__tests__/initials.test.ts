import { describe, expect, it } from 'vitest';

import { initialsOf } from '../initials';

describe('initialsOf', () => {
  it('lấy chữ đầu của từ đầu và từ cuối, một từ thì hai chữ đầu', () => {
    expect(initialsOf('Nguyễn Văn Bình')).toBe('NB');
    expect(initialsOf('  Hà  ')).toBe('HÀ');
  });

  it('tên trống thì rơi về phần trước @ của email (BUG-031, QA-01 nợ #8)', () => {
    expect(initialsOf('', 'thuha@example.com')).toBe('TH');
    expect(initialsOf('   ', 'mai@x.vn')).toBe('MA');
    expect(initialsOf('', '')).toBe('');
  });
});
