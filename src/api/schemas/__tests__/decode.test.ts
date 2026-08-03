import { describe, expect, it, vi } from 'vitest';

import { BanVeSchema, TangSchema } from '@/api/schemas';
import { decode, safeParseList } from '@/api/schemas/decode';

const validBanVe = {
  chieuCao: 20_000,
  chieuRong: 30_000,
  id: 'ban-ve-1',
  nguoiTaiLenId: 'nguoi-dung-1',
  taiLenLuc: '2026-08-03T08:00:00.000Z',
  ten: 'mặt bằng tầng 1',
  url: 'https://example.com/ban-ve-1.png',
};

const createTang = (id: string) => ({
  banVe: [validBanVe],
  caoDo: 0,
  chieuCao: 3_600,
  id,
  ten: `tầng ${id}`,
  thuTu: 1,
});

describe('decode', () => {
  it('trả lỗi có tên trường khi phản hồi thiếu trường bắt buộc', () => {
    const result = decode(BanVeSchema, { ...validBanVe, ten: undefined }, 'banVe');

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.params.message).toContain("Trường 'banVe.ten' là bắt buộc.");
    }
  });

  it('từ chối số thực cho trường độ dài milimét', () => {
    const result = decode(TangSchema, { ...createTang('1'), chieuCao: 3_600.5 }, 'tang');

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.params.message).toContain("Trường 'tang.chieuCao' cần số nguyên");
    }
  });
});

describe('safeParseList', () => {
  it('loại phần tử hỏng và vẫn trả danh sách khi tỷ lệ hỏng không quá 20%', () => {
    const input = Array.from({ length: 10 }, (_value, index) =>
      index === 2 ? { ...createTang(String(index)), caoDo: '0' } : createTang(String(index)),
    );
    const warn = vi.fn();

    const result = safeParseList(TangSchema, input, 'tang', { warn });

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.data).toHaveLength(9);
    }
    expect(warn).toHaveBeenCalledTimes(1);
    expect(warn).toHaveBeenCalledWith(
      expect.objectContaining({
        index: 2,
        message: "Trường 'tang[2].caoDo' cần số, nhận được chuỗi.",
      }),
    );
  });

  it('trả lỗi khi danh sách có hơn 20% phần tử hỏng', () => {
    const input = Array.from({ length: 10 }, (_value, index) =>
      index < 3 ? { ...createTang(String(index)), caoDo: '0' } : createTang(String(index)),
    );

    const result = safeParseList(TangSchema, input, 'tang', { warn: vi.fn() });

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.params.message).toContain("3/10 phần tử từ 'tang' hỏng");
    }
  });
});
