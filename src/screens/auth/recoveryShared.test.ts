import { describe, expect, it } from 'vitest';

import { auth as AUTH_MESSAGES, errors as ERROR_MESSAGES } from '@/i18n/vi.json';

import { noticeFor, type AuthFailure } from './AuthScreen/useAuthScreen';
import { noticeForRecovery, type RecoveryFailure } from './recoveryShared';

/** Thân một dải không được lặp lại tiêu đề của chính nó (BUG-021) — so không phân biệt hoa thường. */
const repeatsTitle = (title: string, body: string): boolean =>
  body.toLocaleLowerCase('vi').includes(title.replace(/\.$/u, '').toLocaleLowerCase('vi'));

describe('a strip never says its title twice (BUG-021)', () => {
  it.each(Object.entries(AUTH_MESSAGES.errors).filter(([, value]) => typeof value === 'object'))(
    'auth.errors.%s: the description does not repeat the title',
    (_key, value) => {
      const { title, description } = value as { title: string; description: string };

      expect(repeatsTitle(title, description)).toBe(false);
    },
  );

  // Đọc chữ từ vi.json thì câu cũ cũng qua: khẳng định chính câu chữ (BUG-091).
  it('auth.errors.invalidCredentials names both fields, not the old "Chữ bạn…" sentence', () => {
    const { description } = AUTH_MESSAGES.errors.invalidCredentials;

    expect(description).toContain('thư điện tử');
    expect(description).toContain('mật khẩu');
    expect(description).not.toContain('Chữ bạn');
  });

  // `describeError` dựng mọi dải "khác" của /login và nhóm khôi phục từ khối này (BUG-021).
  it.each(Object.entries(ERROR_MESSAGES))('errors.%s: the description does not repeat the title', (_key, value) => {
    expect(repeatsTitle(value.title, value.description)).toBe(false);
  });

  const signInFailures: ReadonlyArray<[string, AuthFailure]> = [
    ['403', { kind: 'transport', cause: { status: 403, code: 'FORBIDDEN' } }],
    ['500', { kind: 'transport', cause: { status: 500, code: 'INTERNAL' } }],
    ['network', { kind: 'transport', cause: new TypeError('Failed to fetch') }],
  ];

  it('/login 403 reads as errors.forbidden, title once', () => {
    const notice = noticeFor({ kind: 'transport', cause: { status: 403, code: 'FORBIDDEN' } });

    expect(notice?.title).toBe(ERROR_MESSAGES.forbidden.title);
    expect(notice?.message).toBe(ERROR_MESSAGES.forbidden.description);
  });

  it.each(signInFailures)('/login strip for %s', (_name, failure) => {
    const notice = noticeFor(failure);

    expect(notice).not.toBeNull();
    if (notice?.title !== undefined) {
      expect(repeatsTitle(notice.title, notice.message)).toBe(false);
    }
  });

  const failures: ReadonlyArray<[string, RecoveryFailure]> = [
    ['429', { kind: 'rateLimited', seconds: 60 }],
    ['ORIGIN_MISMATCH', { kind: 'originMismatch' }],
    ['500', { kind: 'other', cause: { status: 500, code: 'INTERNAL' } }],
    ['network', { kind: 'other', cause: new TypeError('Failed to fetch') }],
    ['timeout', { kind: 'other', cause: new Error('Request timed out') }],
  ];

  it.each(failures)('recovery strip for %s', (_name, failure) => {
    const notice = noticeForRecovery(failure);

    expect(notice).not.toBeNull();
    if (notice?.title !== undefined) {
      expect(repeatsTitle(notice.title, notice.message)).toBe(false);
    }
  });
});
