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

  it('BE trả `field: "emails.<i>"` → câu nêu đích danh email thứ i đã gửi; không khớp thì câu cũ', () => {
    const sent = ['a@x.vn', 'nguoi@x.vn'];
    const withField = (code: string, field: string) => ({ ...appError(code), params: { field } });

    expect(failureSentence(withField('USER_INVITE_PENDING', 'emails.1'), sent)).toBe(
      'nguoi@x.vn đã có lời mời đang chờ — gửi lại thư ở dòng của họ.',
    );
    expect(failureSentence(withField('USER_EMAIL_TAKEN', 'emails.0'), sent)).toBe(
      USER_MANAGEMENT_TEXT.emailTakenFor('a@x.vn'),
    );
    expect(failureSentence(withField('USER_INVITE_PENDING', 'emails'), sent)).toBe(USER_MANAGEMENT_TEXT.invitePending);
    expect(failureSentence(withField('USER_INVITE_PENDING', 'emails.5'), sent)).toBe(
      USER_MANAGEMENT_TEXT.invitePending,
    );
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
