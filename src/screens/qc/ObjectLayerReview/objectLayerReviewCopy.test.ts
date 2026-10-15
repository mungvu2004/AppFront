import { describe, expect, it } from 'vitest';

import { OBJECT_CANVAS_TEXT } from './objectLayerSymbols';
import { filteredCountLabel, OBJECT_LAYER_TEXT } from './objectLayerReviewGateway';

describe('chữ của màn Lớp đối tượng (17-C-019, 17-C-001, 17-D-007)', () => {
  it('chỉ báo đang lọc nói "1 / 3 đối tượng"', () => {
    expect(filteredCountLabel(1, 3)).toBe('1 / 3 đối tượng');
  });

  it('đổi sang đúng loại hiện tại có câu lý do', () => {
    expect(OBJECT_LAYER_TEXT.subtypeSame).toBe('Đối tượng đã ở đúng loại đó nên không có gì thay đổi.');
  });

  it('câu chế độ xem không hứa phóng to', () => {
    expect(OBJECT_CANVAS_TEXT.readOnlyNotice).not.toContain('phóng to');
  });
});
