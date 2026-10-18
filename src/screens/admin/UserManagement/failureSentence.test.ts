import { describe, expect, it } from 'vitest';

import { failureSentence, USER_MANAGEMENT_TEXT } from './useUserManagement';

const appError = (code: string) => ({
  kind: 'validation',
  code,
  messageKey: 'errors.validation.description',
  params: {},
  requestId: '',
  retryable: false,
  severity: 'error',
  recovery: 'none',
});

describe('failureSentence (G2-8, B5)', () => {
  it('mời trùng người đang chờ → câu chỉ sang "Gửi lại lời mời"', () => {
    expect(failureSentence(appError('USER_INVITE_PENDING'))).toBe(USER_MANAGEMENT_TEXT.invitePending);
  });

  it('hạ vai/tắt người sửa cuối → câu riêng', () => {
    expect(failureSentence(appError('MEMBER_LAST_EDITOR'))).toBe(USER_MANAGEMENT_TEXT.lastEditor);
  });

  it('mã khác → câu chung, không rỗng', () => {
    const sentence = failureSentence(appError('SOMETHING_ELSE'));
    expect(sentence).not.toBe(USER_MANAGEMENT_TEXT.lastEditor);
    expect(sentence.length).toBeGreaterThan(0);
  });
});
