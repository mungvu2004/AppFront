import { describe, expect, it } from 'vitest';

import { foldForSearch } from '../fold';

describe('foldForSearch', () => {
  it('bỏ dấu thanh và dấu mũ, về chữ thường', () => {
    expect(foldForSearch('Phòng ngủ 1')).toBe('phong ngu 1');
    expect(foldForSearch('Hoàn tác')).toBe('hoan tac');
    expect(foldForSearch('Tường chịu lực')).toBe('tuong chiu luc');
  });

  it('xử `đ` và `Đ` — hai chữ mà NFD không tách được', () => {
    expect(foldForSearch('Đà Nẵng')).toBe('da nang');
    expect(foldForSearch('đường')).toBe('duong');
    expect(foldForSearch('ĐƯỜNG')).toBe('duong');
  });

  it('là dạng của CẢ HAI phía phép so — gõ vội vẫn khớp', () => {
    const haystack = foldForSearch('Phòng ngủ lớn');
    const needle = foldForSearch('ngu lon');

    expect(haystack.includes(needle)).toBe(true);
  });

  it('không đụng tới chữ và số vốn đã không dấu', () => {
    expect(foldForSearch('Level 04')).toBe('level 04');
    expect(foldForSearch('W-000014')).toBe('w-000014');
  });

  it('chuỗi rỗng cho chuỗi rỗng, không ném', () => {
    expect(foldForSearch('')).toBe('');
  });

  it('giữ nguyên khoảng trắng — việc cắt từ là của nơi gọi', () => {
    expect(foldForSearch('  Phòng  ngủ  ')).toBe('  phong  ngu  ');
  });
});
