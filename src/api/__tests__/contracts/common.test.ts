import { describe, expect, it } from 'vitest';
import { z } from 'zod';

import {
  CursorEnvelopeSchema,
  CursorPageSchema,
  VersionedWriteSchema,
  isoInstantSchema,
} from '../../schemas/common';

/**
 * Bốn mảnh dùng chung của hợp đồng mới.
 *
 * Hai trong bốn là **hàm generic**, nên chúng được kiểm qua một thể hiện cụ
 * thể: `CursorPageSchema(z.string())` và `VersionedWriteSchema(z.object({…}))`.
 * Kiểm một hàm generic mà không cho nó một `TItem` thật thì chỉ kiểm được cái
 * vỏ.
 */

describe('isoInstantSchema', () => {
  it('nhận UTC Z với đúng ba chữ số mili giây', () => {
    expect(isoInstantSchema.parse('2026-09-17T05:09:00.123Z')).toBe('2026-09-17T05:09:00.123Z');
  });

  it('từ chối chuỗi thiếu mili giây', () => {
    expect(isoInstantSchema.safeParse('2026-09-17T05:09:00Z').success).toBe(false);
  });

  it('từ chối sáu chữ số mili giây — bản Pydantic mặc định', () => {
    expect(isoInstantSchema.safeParse('2026-09-17T05:09:00.123456Z').success).toBe(false);
  });

  it('từ chối lệch múi giờ, kể cả khi đúng ba chữ số', () => {
    expect(isoInstantSchema.safeParse('2026-09-17T05:09:00.123+07:00').success).toBe(false);
  });

  it('từ chối chuỗi không phải ngày giờ', () => {
    expect(isoInstantSchema.safeParse('hôm qua').success).toBe(false);
  });

  it('từ chối số — kiểu sai là kiểu sai', () => {
    expect(isoInstantSchema.safeParse(1_758_085_740_123).success).toBe(false);
  });
});

describe('CursorPageSchema', () => {
  const pageSchema = CursorPageSchema(z.string().min(1));

  it('nhận trang đầy đủ và trả đúng hai khoá', () => {
    expect(pageSchema.parse({ items: ['a', 'b'], nextCursor: 'eyJpZCI6MX0' })).toStrictEqual({
      items: ['a', 'b'],
      nextCursor: 'eyJpZCI6MX0',
    });
  });

  it('nhận trang cuối và BỎ HẲN khoá nextCursor, không đặt undefined', () => {
    expect(pageSchema.parse({ items: [] })).toStrictEqual({ items: [] });
  });

  it('từ chối khoá lạ', () => {
    expect(pageSchema.safeParse({ items: [], total: 0 }).success).toBe(false);
  });

  it('từ chối null ở nextCursor — vắng trường, không null', () => {
    expect(pageSchema.safeParse({ items: [], nextCursor: null }).success).toBe(false);
  });

  it('từ chối con trỏ rỗng: hết trang là vắng khoá, không phải chuỗi rỗng', () => {
    expect(pageSchema.safeParse({ items: [], nextCursor: '' }).success).toBe(false);
  });

  it('áp schema của mục cho từng phần tử', () => {
    expect(pageSchema.safeParse({ items: [''] }).success).toBe(false);
  });
});

describe('CursorEnvelopeSchema', () => {
  it('nhận mọi mục mà không nhìn vào trong — safeParseList mới là chỗ nhìn', () => {
    expect(
      CursorEnvelopeSchema.parse({ items: [{ hỏng: true }, 7], nextCursor: 'c2' }),
    ).toStrictEqual({ items: [{ hỏng: true }, 7], nextCursor: 'c2' });
  });

  it('nhận phong bì tối thiểu', () => {
    expect(CursorEnvelopeSchema.parse({ items: [] })).toStrictEqual({ items: [] });
  });

  it('từ chối khoá lạ', () => {
    expect(CursorEnvelopeSchema.safeParse({ items: [], cursor: 'c2' }).success).toBe(false);
  });

  it('từ chối null ở nextCursor', () => {
    expect(CursorEnvelopeSchema.safeParse({ items: [], nextCursor: null }).success).toBe(false);
  });

  it('vẫn đòi items là một mảng', () => {
    expect(CursorEnvelopeSchema.safeParse({ items: 'a' }).success).toBe(false);
  });
});

describe('VersionedWriteSchema', () => {
  const writeSchema = VersionedWriteSchema(z.object({ floorId: z.string().min(1) }).strict());

  it('nhận thân ghi có version', () => {
    expect(writeSchema.parse({ baseVersion: 0, body: { floorId: 'L-LEVEL00' } })).toStrictEqual({
      baseVersion: 0,
      body: { floorId: 'L-LEVEL00' },
    });
  });

  it('từ chối baseVersion âm', () => {
    expect(writeSchema.safeParse({ baseVersion: -1, body: { floorId: 'L-LEVEL00' } }).success).toBe(
      false,
    );
  });

  it('từ chối baseVersion thập phân', () => {
    expect(writeSchema.safeParse({ baseVersion: 1.5, body: { floorId: 'L-LEVEL00' } }).success).toBe(
      false,
    );
  });

  it('từ chối thiếu baseVersion — máy chủ trả 428, nên biên giới cũng chặn', () => {
    expect(writeSchema.safeParse({ body: { floorId: 'L-LEVEL00' } }).success).toBe(false);
  });

  it('từ chối khoá lạ ở thân ngoài', () => {
    expect(
      writeSchema.safeParse({ baseVersion: 0, body: { floorId: 'L-LEVEL00' }, force: true }).success,
    ).toBe(false);
  });

  it('từ chối khoá lạ trong body lồng', () => {
    expect(
      writeSchema.safeParse({ baseVersion: 0, body: { floorId: 'L-LEVEL00', extra: 1 } }).success,
    ).toBe(false);
  });
});

describe('Refine', () => {
  it('không áp dụng — không schema nào trong common.ts có refine', () => {
    expect(true).toBe(true);
  });
});
