import { describe, expect, it, vi } from 'vitest';

import { DrawingSchema, FloorSchema } from '@/api/schemas';
import { decode, safeParseList } from '@/api/schemas/decode';

const validDrawing = {
  heightMm: 20_000,
  id: 'drawing-1',
  name: 'floor plan 1',
  uploadedAt: '2026-08-03T08:00:00.000Z',
  uploaderId: 'user-1',
  url: 'https://example.com/drawing-1.png',
  widthMm: 30_000,
};

const createFloor = (id: string) => ({
  drawings: [validDrawing],
  elevationMm: 0,
  heightMm: 3_600,
  id,
  name: `floor ${id}`,
  order: 1,
});

describe('decode', () => {
  it('trả lỗi có tên trường khi phản hồi thiếu trường bắt buộc', () => {
    const result = decode(DrawingSchema, { ...validDrawing, name: undefined }, 'drawing');

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.params.message).toContain("Trường 'drawing.name' là bắt buộc.");
    }
  });

  it('từ chối số thực cho trường độ dài milimét', () => {
    const result = decode(FloorSchema, { ...createFloor('1'), heightMm: 3_600.5 }, 'floor');

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.params.message).toContain("Trường 'floor.heightMm' cần số nguyên");
    }
  });
});

describe('safeParseList', () => {
  it('loại phần tử hỏng và vẫn trả danh sách khi tỷ lệ hỏng không quá 20%', () => {
    const input = Array.from({ length: 10 }, (_value, index) =>
      index === 2 ? { ...createFloor(String(index)), elevationMm: '0' } : createFloor(String(index)),
    );
    const warn = vi.fn();

    const result = safeParseList(FloorSchema, input, 'floors', { warn });

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.data).toHaveLength(9);
    }
    expect(warn).toHaveBeenCalledTimes(1);
    expect(warn).toHaveBeenCalledWith(
      expect.objectContaining({
        index: 2,
        message: "Trường 'floors[2].elevationMm' cần số, nhận được chuỗi.",
      }),
    );
  });

  it('trả lỗi khi danh sách có hơn 20% phần tử hỏng', () => {
    const input = Array.from({ length: 10 }, (_value, index) =>
      index < 3 ? { ...createFloor(String(index)), elevationMm: '0' } : createFloor(String(index)),
    );

    const result = safeParseList(FloorSchema, input, 'floors', { warn: vi.fn() });

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.params.message).toContain("3/10 phần tử từ 'floors' hỏng");
    }
  });
});
