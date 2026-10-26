/** @vitest-environment node */
import { describe, expect, it } from 'vitest';

import { unsavedEditsNotice } from './versionHistoryModel';

describe('unsavedEditsNotice (HOP-DONG-MOI §5: hiện tại ⇔ khớp revision)', () => {
  it('không hàng nào "Hiện tại" → câu nêu bản mới nhất và hệ quả của việc phục hồi nó', () => {
    const notice = unsavedEditsNotice([
      { label: 'v2', isCurrent: false },
      { label: 'v1', isCurrent: false },
    ]);

    expect(notice).toBe(
      'Tầng đã sửa sau v2, phần sửa này chưa lưu thành phiên bản. Phục hồi về v2 sẽ bỏ phần sửa ấy.',
    );
  });

  it('có hàng "Hiện tại" hoặc chưa có hàng nào → không có câu', () => {
    expect(
      unsavedEditsNotice([
        { label: 'v2', isCurrent: true },
        { label: 'v1', isCurrent: false },
      ]),
    ).toBeNull();
    expect(unsavedEditsNotice([])).toBeNull();
  });
});
