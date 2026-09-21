import { describe, expect, it } from 'vitest';
import type { z } from 'zod';

import {
  ACCOUNT_LANGUAGES,
  AVATAR_MIME_TYPES,
  ChangePasswordSchema,
  MeSchema,
  UpdateMeSchema,
  UploadAvatarSchema,
} from '../../schemas/me';

/** N11–N14 — hồ sơ của người đang đăng nhập (HOP-DONG-MOI §3). */

function issuePaths(schema: z.ZodTypeAny, input: unknown): (string | number)[][] {
  const result = schema.safeParse(input);
  return result.success ? [] : result.error.issues.map((issue) => issue.path);
}

/** Bản sao của `source` thiếu đúng một khoá. */
function without(source: object, key: string): Record<string, unknown> {
  return Object.fromEntries(Object.entries(source).filter(([name]) => name !== key));
}

/** Bỏ riêng từng khoá bắt buộc thì hỏng đúng ở khoá đó. */
function itRequiresKeys(schema: z.ZodTypeAny, sample: object, keys: string[]): void {
  it.each(keys)('từ chối thiếu khoá bắt buộc %s', (key) => {
    expect(issuePaths(schema, without(sample, key))).toStrictEqual([[key]]);
  });
}

function accepts(schema: z.ZodTypeAny, input: unknown): boolean {
  return schema.safeParse(input).success;
}

describe('hằng — khớp HOP-DONG-MOI §3', () => {
  it('ACCOUNT_LANGUAGES', () => {
    expect([...ACCOUNT_LANGUAGES]).toStrictEqual(['vi', 'en']);
  });

  it('AVATAR_MIME_TYPES', () => {
    expect([...AVATAR_MIME_TYPES]).toStrictEqual(['image/png', 'image/jpeg']);
  });
});

describe('MeSchema', () => {
  const fullMe = {
    avatarUrl: 'https://cdn.appfront.vn/avatars/an.png',
    email: 'an.pham@congty.vn',
    fullName: 'Phạm An',
    jobTitle: 'Kỹ sư kết cấu',
    language: 'vi',
    phone: '+84 912 345 678',
  };
  const minimalMe = { email: 'an.pham@congty.vn', fullName: 'Phạm An', language: 'en' };

  it('nhận mẫu đầy đủ', () => {
    expect(MeSchema.parse(fullMe)).toStrictEqual(fullMe);
  });

  it('nhận mẫu tối thiểu, không có avatarUrl, jobTitle, phone', () => {
    expect(MeSchema.parse(minimalMe)).toStrictEqual(minimalMe);
  });

  it('bỏ hẳn khoá tuỳ chọn mang undefined khỏi đầu ra', () => {
    expect(
      MeSchema.parse({
        ...minimalMe,
        avatarUrl: undefined,
        jobTitle: undefined,
        phone: undefined,
      }),
    ).toStrictEqual(minimalMe);
  });

  itRequiresKeys(MeSchema, fullMe, ['email', 'fullName', 'language']);

  it('từ chối khoá lạ theme', () => {
    expect(issuePaths(MeSchema, { ...fullMe, theme: 'dark' })).toStrictEqual([[]]);
  });

  it.each(['avatarUrl', 'jobTitle', 'phone'])('từ chối null ở %s', (key) => {
    expect(issuePaths(MeSchema, { ...fullMe, [key]: null })).toStrictEqual([[key]]);
  });

  it.each([
    ['email sai dạng', { email: 'an.pham' }, 'email'],
    ['fullName rỗng', { fullName: '' }, 'fullName'],
    ['fullName 121 ký tự', { fullName: 'a'.repeat(121) }, 'fullName'],
    ['jobTitle rỗng', { jobTitle: '' }, 'jobTitle'],
    ['jobTitle 121 ký tự', { jobTitle: 'a'.repeat(121) }, 'jobTitle'],
    ['phone rỗng', { phone: '' }, 'phone'],
    ['phone 33 ký tự', { phone: '1'.repeat(33) }, 'phone'],
    ['ngôn ngữ ngoài tập', { language: 'fr' }, 'language'],
    ['avatarUrl không phải URL', { avatarUrl: 'data-avatar' }, 'avatarUrl'],
  ])('từ chối %s', (_label, patch, key) => {
    expect(issuePaths(MeSchema, { ...fullMe, ...patch })).toStrictEqual([[key]]);
  });

  it.each([
    ['còn dấu cách đầu', ' Phạm An'],
    ['còn dấu cách cuối', 'Phạm An '],
  ])('nhận fullName %s, đầu ra giữ nguyên chuỗi', (_label, fullName) => {
    expect(MeSchema.parse({ ...fullMe, fullName })).toStrictEqual({ ...fullMe, fullName });
  });

  /*
   * BE lưu `nfc(strip)` (`B1-04.md:70`): `strip()` của Python không cắt U+FEFF,
   * còn `trim()` của JS thì cắt. Nên đây là tên một BE đúng đặc tả vẫn trả
   * được — một refine `name === name.trim()` sẽ từ chối nó, và vì N11 là
   * object đơn, cả màn tài khoản hỏng theo. Đừng thêm lại refine ấy.
   */
  it('nhận fullName kết thúc bằng U+FEFF, đầu ra giữ nguyên chuỗi', () => {
    const fullName = 'Nam﻿';
    expect(MeSchema.parse({ ...fullMe, fullName })).toStrictEqual({ ...fullMe, fullName });
  });

  it('nhận biên trên: fullName 120, jobTitle 120, phone 32', () => {
    expect(
      accepts(MeSchema, {
        ...fullMe,
        fullName: 'a'.repeat(120),
        jobTitle: 'a'.repeat(120),
        phone: '1'.repeat(32),
      }),
    ).toBe(true);
  });
});

describe('UpdateMeSchema', () => {
  const fullUpdate = {
    fullName: 'Phạm Minh An',
    jobTitle: 'Chủ trì kết cấu',
    language: 'en',
    phone: '0912345678',
  };

  it('nhận mẫu đầy đủ', () => {
    expect(UpdateMeSchema.parse(fullUpdate)).toStrictEqual(fullUpdate);
  });

  it.each([
    ['fullName', { fullName: 'Phạm An' }],
    ['jobTitle', { jobTitle: 'Kỹ sư' }],
    ['language', { language: 'vi' }],
    ['phone', { phone: '0912345678' }],
  ])('nhận mẫu tối thiểu chỉ có %s', (_key, body) => {
    expect(UpdateMeSchema.parse(body)).toStrictEqual(body);
  });

  it.each([
    ['jobTitle', { jobTitle: '' }],
    ['phone', { phone: '' }],
  ])('nhận %s là chuỗi rỗng', (_key, body) => {
    expect(UpdateMeSchema.parse(body)).toStrictEqual(body);
  });

  it('trim fullName trên đầu ra', () => {
    expect(UpdateMeSchema.parse({ fullName: '  Phạm An ' })).toStrictEqual({ fullName: 'Phạm An' });
  });

  it('từ chối khoá lạ email', () => {
    expect(issuePaths(UpdateMeSchema, { ...fullUpdate, email: 'a@b.vn' })).toStrictEqual([[]]);
  });

  it.each(['fullName', 'jobTitle', 'language', 'phone'])('từ chối null ở %s', (key) => {
    expect(issuePaths(UpdateMeSchema, { ...fullUpdate, [key]: null })).toStrictEqual([[key]]);
  });

  it.each([
    ['fullName toàn dấu cách', { fullName: '   ' }, 'fullName'],
    ['fullName 121 ký tự', { fullName: 'a'.repeat(121) }, 'fullName'],
    ['jobTitle 121 ký tự', { jobTitle: 'a'.repeat(121) }, 'jobTitle'],
    ['phone 33 ký tự', { phone: '1'.repeat(33) }, 'phone'],
    ['ngôn ngữ ngoài tập', { language: 'fr' }, 'language'],
  ])('từ chối %s', (_label, patch, key) => {
    expect(issuePaths(UpdateMeSchema, { ...fullUpdate, ...patch })).toStrictEqual([[key]]);
  });

  it('nhận biên trên: fullName 120, jobTitle 120, phone 32', () => {
    expect(
      accepts(UpdateMeSchema, {
        fullName: 'a'.repeat(120),
        jobTitle: 'a'.repeat(120),
        phone: '1'.repeat(32),
      }),
    ).toBe(true);
  });

  describe('refine: ≥ 1 khoá có giá trị', () => {
    it.each([
      ['thân rỗng', {}],
      ['một khoá mang undefined', { fullName: undefined }],
      [
        'cả bốn khoá mang undefined',
        { fullName: undefined, jobTitle: undefined, language: undefined, phone: undefined },
      ],
    ])('%s → path []', (_label, body) => {
      expect(issuePaths(UpdateMeSchema, body)).toStrictEqual([[]]);
    });
  });
});

describe('ChangePasswordSchema', () => {
  // Không có trường tuỳ chọn nào, nên ca "null ở trường tuỳ chọn" không áp dụng.
  const body = { currentPassword: 'cu', newPassword: 'mat-khau-moi' };

  it('nhận mẫu đầy đủ (cũng là tối thiểu), mật khẩu hiện tại 2 ký tự', () => {
    expect(ChangePasswordSchema.parse(body)).toStrictEqual(body);
  });

  itRequiresKeys(ChangePasswordSchema, body, ['currentPassword', 'newPassword']);

  it('từ chối khoá lạ', () => {
    expect(issuePaths(ChangePasswordSchema, { ...body, confirmPassword: 'x' })).toStrictEqual([[]]);
  });

  it.each([
    ['mật khẩu hiện tại rỗng', { currentPassword: '' }, 'currentPassword'],
    ['mật khẩu mới 7 ký tự', { newPassword: '1234567' }, 'newPassword'],
  ])('từ chối %s', (_label, patch, key) => {
    expect(issuePaths(ChangePasswordSchema, { ...body, ...patch })).toStrictEqual([[key]]);
  });

  it('nhận mật khẩu mới đúng 8 ký tự', () => {
    expect(accepts(ChangePasswordSchema, { ...body, newPassword: '12345678' })).toBe(true);
  });
});

describe('UploadAvatarSchema', () => {
  // Không có trường tuỳ chọn nào, nên ca "null ở trường tuỳ chọn" không áp dụng.
  const body = { contentBase64: 'iVBORw0KGgo=', mimeType: 'image/png' };

  it('nhận mẫu đầy đủ (cũng là tối thiểu)', () => {
    expect(UploadAvatarSchema.parse(body)).toStrictEqual(body);
  });

  it('nhận image/jpeg', () => {
    expect(accepts(UploadAvatarSchema, { ...body, mimeType: 'image/jpeg' })).toBe(true);
  });

  itRequiresKeys(UploadAvatarSchema, body, ['contentBase64', 'mimeType']);

  it('từ chối khoá lạ dataUrl', () => {
    expect(
      issuePaths(UploadAvatarSchema, { ...body, dataUrl: 'data:image/png;base64,iVBOR' }),
    ).toStrictEqual([[]]);
  });

  it.each(['image/gif', 'image/webp', 'image/svg+xml'])('từ chối mimeType %s', (mimeType) => {
    expect(issuePaths(UploadAvatarSchema, { ...body, mimeType })).toStrictEqual([['mimeType']]);
  });

  describe('contentBase64 ≤ 699052 ký tự (.max — dòng bảng A của HOP-DONG-MOI §0.2)', () => {
    it('699052 ký tự đạt', () => {
      expect(accepts(UploadAvatarSchema, { ...body, contentBase64: 'A'.repeat(699_052) })).toBe(
        true,
      );
    });

    it('699053 ký tự → path contentBase64', () => {
      expect(
        issuePaths(UploadAvatarSchema, { ...body, contentBase64: 'A'.repeat(699_053) }),
      ).toStrictEqual([['contentBase64']]);
    });
  });
});
