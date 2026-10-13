/** @vitest-environment node */
import { describe, expect, it } from 'vitest';

import { formatClockTime } from '@/lib/format/datetime';

import { saveLabelOf } from './pascalViewerTypes';

describe('saveLabelOf (#24)', () => {
  it('đã lưu thì kèm giờ', () => {
    const at = Date.UTC(2026, 9, 13, 7, 5);

    expect(saveLabelOf('saved', at)).toBe(`Đã lưu lúc ${formatClockTime(at)}`);
    expect(formatClockTime(at)).toMatch(/^\d{2}:\d{2}$/);
  });

  it('chưa có giờ hoặc trạng thái khác thì giữ câu cũ', () => {
    expect(saveLabelOf('saved', null)).toBe('Đã lưu');
    expect(saveLabelOf('saving', 1)).toBe('Đang lưu…');
    expect(saveLabelOf(null, null)).toBeNull();
  });
});
