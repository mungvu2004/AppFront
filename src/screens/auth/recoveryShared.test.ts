import { describe, expect, it } from 'vitest';

import { auth as AUTH_MESSAGES } from '@/i18n/vi.json';

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
