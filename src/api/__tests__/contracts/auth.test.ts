import { describe, expect, it } from 'vitest';
import type { z } from 'zod';

import {
  AcceptInvitationSchema,
  PasswordResetConfirmSchema,
  PasswordResetRequestSchema,
} from '../../schemas/auth';

/**
 * N8–N10 — quên mật khẩu và nhận lời mời (HOP-DONG-MOI §3).
 *
 * Ba schema chỉ có trường bắt buộc, nên ca "null ở trường tuỳ chọn" không áp
 * dụng cho schema nào trong file này.
 */

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

/** Một token 60 ký tự — giữa hai biên 1 và 512. */
const TOKEN = 'tK9_x2'.repeat(10);

describe('PasswordResetRequestSchema', () => {
  const body = { email: 'an.pham@congty.vn' };

  it('nhận mẫu đầy đủ (cũng là tối thiểu: một trường bắt buộc)', () => {
    expect(PasswordResetRequestSchema.parse(body)).toStrictEqual(body);
  });

  itRequiresKeys(PasswordResetRequestSchema, body, ['email']);

  it('từ chối khoá lạ', () => {
    expect(
      issuePaths(PasswordResetRequestSchema, { ...body, redirectUrl: 'https://x.vn' }),
    ).toStrictEqual([[]]);
  });

  it('từ chối địa chỉ sai dạng', () => {
    expect(issuePaths(PasswordResetRequestSchema, { email: 'an.pham' })).toStrictEqual([['email']]);
  });

  it('ô trống báo "chưa nhập" (too_small) trước "sai dạng"', () => {
    const result = PasswordResetRequestSchema.safeParse({ email: '' });
    expect(result.error?.issues.map((issue) => [issue.code, issue.path])).toStrictEqual([
      ['too_small', ['email']],
      ['invalid_string', ['email']],
    ]);
  });
});

describe('PasswordResetConfirmSchema', () => {
  const body = { newPassword: 'mat-khau-moi', token: TOKEN };

  it('nhận mẫu đầy đủ (cũng là tối thiểu: hai trường bắt buộc)', () => {
    expect(PasswordResetConfirmSchema.parse(body)).toStrictEqual(body);
  });

  itRequiresKeys(PasswordResetConfirmSchema, body, ['newPassword', 'token']);

  it('từ chối khoá lạ', () => {
    expect(issuePaths(PasswordResetConfirmSchema, { ...body, email: 'a@b.vn' })).toStrictEqual([
      [],
    ]);
  });

  it.each([
    ['token rỗng', { token: '' }, 'token'],
    ['token 513 ký tự', { token: 'a'.repeat(513) }, 'token'],
    ['mật khẩu 7 ký tự', { newPassword: '1234567' }, 'newPassword'],
  ])('từ chối %s', (_label, patch, key) => {
    expect(issuePaths(PasswordResetConfirmSchema, { ...body, ...patch })).toStrictEqual([[key]]);
  });

  it('mật khẩu rỗng báo "chưa nhập" (min 1) trước "quá ngắn" (min 8)', () => {
    const result = PasswordResetConfirmSchema.safeParse({ ...body, newPassword: '' });
    expect(
      result.error?.issues.map((issue) => [
        issue.code,
        issue.path,
        issue.code === 'too_small' ? issue.minimum : null,
      ]),
    ).toStrictEqual([
      ['too_small', ['newPassword'], 1],
      ['too_small', ['newPassword'], 8],
    ]);
  });

  it('nhận token đúng 512 ký tự và mật khẩu đúng 8 ký tự', () => {
    expect(
      accepts(PasswordResetConfirmSchema, { newPassword: '12345678', token: 'a'.repeat(512) }),
    ).toBe(true);
  });
});

describe('AcceptInvitationSchema', () => {
  const body = { fullName: 'Trần Chi', password: 'mat-khau-moi', token: TOKEN };

  it('nhận mẫu đầy đủ (cũng là tối thiểu: ba trường bắt buộc)', () => {
    expect(AcceptInvitationSchema.parse(body)).toStrictEqual(body);
  });

  itRequiresKeys(AcceptInvitationSchema, body, ['fullName', 'password', 'token']);

  it('từ chối khoá lạ', () => {
    expect(issuePaths(AcceptInvitationSchema, { ...body, role: 'admin' })).toStrictEqual([[]]);
  });

  it('trim fullName trên đầu ra', () => {
    expect(AcceptInvitationSchema.parse({ ...body, fullName: '  Trần Chi  ' })).toStrictEqual(body);
  });

  it('đo độ dài fullName sau khi trim: 120 ký tự kẹp giữa hai dấu cách vẫn đạt', () => {
    expect(accepts(AcceptInvitationSchema, { ...body, fullName: ` ${'a'.repeat(120)} ` })).toBe(
      true,
    );
  });

  it.each([
    ['fullName toàn dấu cách', { fullName: '   ' }, 'fullName'],
    ['fullName 121 ký tự', { fullName: 'a'.repeat(121) }, 'fullName'],
    ['token rỗng', { token: '' }, 'token'],
    ['token 513 ký tự', { token: 'a'.repeat(513) }, 'token'],
    ['mật khẩu 7 ký tự', { password: '1234567' }, 'password'],
  ])('từ chối %s', (_label, patch, key) => {
    expect(issuePaths(AcceptInvitationSchema, { ...body, ...patch })).toStrictEqual([[key]]);
  });
});
