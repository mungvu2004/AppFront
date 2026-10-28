import { describe, expect, it } from 'vitest';

import { byRoomReason } from './roomReviewReasons';

describe('Bố cục L23: thứ tự phòng theo lý do', () => {
  it('chưa có tên trước, máy đề xuất sau, đã duyệt cuối; giữ thứ tự trong mỗi nhóm', () => {
    const rows = [
      { id: 'a', status: 'suggested' as const },
      { id: 'b', status: 'confirmed' as const },
      { id: 'c', status: 'unnamed' as const },
      { id: 'd', status: 'suggested' as const },
      { id: 'e', status: 'unnamed' as const },
    ];
    expect(byRoomReason(rows).map((row) => row.id)).toEqual(['c', 'e', 'a', 'd', 'b']);
  });
});
