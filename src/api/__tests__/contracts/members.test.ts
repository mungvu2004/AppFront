import { describe, expect, it } from 'vitest';
import type { z } from 'zod';

import { AddProjectMemberSchema } from '../../schemas/members';

/** N3 — thân thêm thành viên (HOP-DONG-MOI §2). Response là `UserSchema` cũ, không thử ở đây. */

function issuePaths(schema: z.ZodTypeAny, input: unknown): (string | number)[][] {
  const result = schema.safeParse(input);
  return result.success ? [] : result.error.issues.map((issue) => issue.path);
}

describe('AddProjectMemberSchema', () => {
  // Không có trường tuỳ chọn nào, nên ca "null ở trường tuỳ chọn" không áp dụng.
  const body = { email: 'chi.tran@congty.vn' };

  it('nhận mẫu đầy đủ (cũng là tối thiểu: một trường bắt buộc)', () => {
    expect(AddProjectMemberSchema.parse(body)).toStrictEqual(body);
  });

  it('từ chối thiếu khoá bắt buộc email', () => {
    expect(issuePaths(AddProjectMemberSchema, {})).toStrictEqual([['email']]);
  });

  it('từ chối khoá lạ role', () => {
    expect(issuePaths(AddProjectMemberSchema, { ...body, role: 'viewer' })).toStrictEqual([[]]);
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
});
