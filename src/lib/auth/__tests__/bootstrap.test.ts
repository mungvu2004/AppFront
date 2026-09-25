import { describe, expect, it } from 'vitest';

import {
  RETRY_MAX_DELAY_MS,
  RETRY_MIN_DELAY_MS,
  resolveAuthUrl,
  resolveRetryDelayMs,
  resolveServerOffsetMs,
} from '../bootstrap';

describe('src/lib/auth/bootstrap', () => {
  describe('resolveAuthUrl', () => {
    it('keeps the /api prefix the base carries', () => {
      expect(resolveAuthUrl('https://may-chu.vn/api', '/auth/refresh')).toBe(
        'https://may-chu.vn/api/auth/refresh',
      );
      expect(resolveAuthUrl('https://may-chu.vn/api/', '/auth/logout')).toBe(
        'https://may-chu.vn/api/auth/logout',
      );
    });

    it('joins onto a base that carries no prefix', () => {
      expect(resolveAuthUrl('https://may-chu.vn', '/auth/refresh')).toBe(
        'https://may-chu.vn/auth/refresh',
      );
    });

    it('does not double a prefix the path already carries', () => {
      expect(resolveAuthUrl('https://may-chu.vn/api', '/api/auth/refresh')).toBe(
        'https://may-chu.vn/api/auth/refresh',
      );
      expect(resolveAuthUrl('https://may-chu.vn/api', '/api')).toBe('https://may-chu.vn/api');
    });

    it('accepts a path without a leading slash', () => {
      expect(resolveAuthUrl('https://may-chu.vn/api', 'auth/refresh')).toBe(
        'https://may-chu.vn/api/auth/refresh',
      );
    });

    it('returns an absolute path untouched', () => {
      expect(resolveAuthUrl('https://may-chu.vn/api', 'https://khac.vn/auth/refresh')).toBe(
        'https://khac.vn/auth/refresh',
      );
    });
  });

  describe('resolveRetryDelayMs', () => {
    it('obeys Retry-After in seconds', () => {
      expect(resolveRetryDelayMs('5', 1)).toBe(5_000);
      expect(resolveRetryDelayMs('10', 4)).toBe(10_000);
    });

    it('backs off 1, 2, 4 seconds when Retry-After is absent', () => {
      expect(resolveRetryDelayMs(null, 1)).toBe(1_000);
      expect(resolveRetryDelayMs(null, 2)).toBe(2_000);
      expect(resolveRetryDelayMs(null, 3)).toBe(4_000);
      expect(resolveRetryDelayMs(null, 4)).toBe(8_000);
    });

    it('clamps both ends of the ladder', () => {
      expect(resolveRetryDelayMs(null, 99)).toBe(RETRY_MAX_DELAY_MS);
      expect(resolveRetryDelayMs('600', 1)).toBe(RETRY_MAX_DELAY_MS);
      expect(resolveRetryDelayMs('0', 1)).toBe(RETRY_MIN_DELAY_MS);
      expect(resolveRetryDelayMs(null, 0)).toBe(RETRY_MIN_DELAY_MS);
    });

    it('falls back to the ladder when Retry-After is not a number', () => {
      expect(resolveRetryDelayMs('Wed, 21 Oct 2026 07:28:00 GMT', 2)).toBe(2_000);
    });
  });

  describe('resolveServerOffsetMs', () => {
    it('measures how far ahead this machine runs', () => {
      const now = Date.parse('2026-08-03T00:09:00.000Z');

      expect(resolveServerOffsetMs('Sun, 03 Aug 2026 00:00:00 GMT', now)).toBe(-540_000);
    });

    it('reads zero when the Date header is missing or unreadable', () => {
      expect(resolveServerOffsetMs(null, 1_000)).toBe(0);
      expect(resolveServerOffsetMs('hôm nào đó', 1_000)).toBe(0);
    });
  });
});
