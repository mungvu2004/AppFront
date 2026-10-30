import { describe, expect, it } from 'vitest';
import type { z } from 'zod';

import { AddProjectMemberSchema } from '../../schemas/members';

/** N3 — thân thêm thành viên (HOP-DONG-MOI §2). Response là `UserSchema` cũ, không thử ở đây. */

function issuePaths(schema: z.ZodTypeAny, input: unknown): (string | number)[][] {
  const result = schema.safeParse(input);
  return result.success ? [] : result.error.issues.map((issue) => issue.path);
}

describe('AddProjectMemberSchema', () => {
  // Trường tuỳ chọn duy nhất là `role` (U24).
  const body = { email: 'chi.tran@congty.vn' };

  it('nhận mẫu đầy đủ (cũng là tối thiểu: một trường bắt buộc)', () => {
    expect(AddProjectMemberSchema.parse(body)).toStrictEqual(body);
  });

  it('từ chối thiếu khoá bắt buộc email', () => {
    expect(issuePaths(AddProjectMemberSchema, {})).toStrictEqual([['email']]);
  });

  it('U24: nhận vai dự án engineer/viewer, từ chối admin', () => {
    expect(AddProjectMemberSchema.parse({ ...body, role: 'viewer' })).toStrictEqual({ ...body, role: 'viewer' });
    expect(issuePaths(AddProjectMemberSchema, { ...body, role: 'admin' })).toStrictEqual([['role']]);
  });

  it('từ chối khoá lạ', () => {
    expect(issuePaths(AddProjectMemberSchema, { ...body, isOwner: true })).toStrictEqual([[]]);
  });

  it('từ chối địa chỉ sai dạng', () => {
    expect(issuePaths(AddProjectMemberSchema, { email: 'chi.tran' })).toStrictEqual([['email']]);
  });

  it('ô trống báo "chưa nhập" (too_small) trước "sai dạng"', () => {
    const result = AddProjectMemberSchema.safeParse({ email: '' });
    expect(result.success).toBe(false);
    expect(result.error?.issues.map((issue) => issue.code)).toStrictEqual([
      'too_small',
      'invalid_string',
    ]);
  });

  it('từ chối địa chỉ dài quá 254 ký tự, cùng trần với EmailSchema (BUG-010)', () => {
    const at254 = `${'a'.repeat(64)}@${'b'.repeat(186)}.vn`;

    expect(AddProjectMemberSchema.safeParse({ email: at254 }).success).toBe(true);
    expect(issuePaths(AddProjectMemberSchema, { email: `a${at254}` })).toStrictEqual([['email']]);
  });
});
