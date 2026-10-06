/**
 * NO-357: lượt mở phiên hỏng ngay ở bước cấu hình không được để phiên kẹt `unknown`
 * mà không ai biết. Kiểm qua đường thật — `startAppSession()` rồi đọc tầng phiên —
 * với đúng một chỗ giả: lượt nạp `src/api` ném, như khi mất mạng giữa lúc tải chunk.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import type * as AppClientModuleNamespace from '@/api/appClient';

import { __resetAuthForTests, getSession } from '@/lib/auth';
import { __resetLastKnownUserForTests } from '@/lib/auth/bootstrap';

import { __resetAppSessionForTests, retryAppSession, startAppSession } from './sessionSetup';

/** Bật lên thì lượt nạp `src/api` trong `configureAppSession` hỏng. */
let appClientBroken = false;

vi.mock('@/api/appClient', async (importOriginal) => {
  const actual = await importOriginal<typeof AppClientModuleNamespace>();

  return {
    ...actual,
    resolveApiBaseUrl: (): string => {
      if (appClientBroken) {
        throw new Error('không nạp được tầng API');
      }

      return actual.resolveApiBaseUrl();
    },
  };
});

beforeEach(() => {
  appClientBroken = false;
  __resetAppSessionForTests();
  __resetLastKnownUserForTests();
  __resetAuthForTests();
  // Phiên mở bằng bộ mẫu, không cần máy chủ nào.
  vi.stubEnv('VITE_USE_MOCK_API', 'true');
});

afterEach(() => {
  vi.unstubAllEnvs();
});

describe('startAppSession — cấu hình hỏng (NO-357)', () => {
  it('đưa phiên sang trạng thái kết thúc có câu báo, không kẹt unknown im lặng', async () => {
    appClientBroken = true;

    await expect(startAppSession()).rejects.toThrow();

    expect(getSession()).toMatchObject({ status: 'unknown', serverUnreachable: true });
  });

  it('thử lại sau lượt cấu hình hỏng thì cấu hình lại và mở được phiên', async () => {
    appClientBroken = true;
    await expect(startAppSession()).rejects.toThrow();

    appClientBroken = false;

    await expect(retryAppSession()).resolves.toBe(true);
    expect(getSession()).toMatchObject({ status: 'authenticated', serverUnreachable: false });
  });

  it('thử lại khi phiên đã cấu hình thì chỉ gia hạn, không cấu hình lại', async () => {
    await expect(startAppSession()).resolves.toBe(true);

    await expect(retryAppSession()).resolves.toBe(true);
    expect(getSession().status).toBe('authenticated');
  });
});
