/**
 * NO-357: lượt mở phiên hỏng ngay ở bước cấu hình không được để phiên kẹt `unknown`
 * mà không ai biết. Kiểm qua đường thật — `startAppSession()` rồi đọc tầng phiên —
 * với đúng một chỗ giả: lượt nạp `src/api` ném, như khi mất mạng giữa lúc tải chunk.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import type * as AppClientModuleNamespace from '@/api/appClient';

import type * as AuthModuleNamespace from '@/lib/auth';

import { __resetAuthForTests, bootstrapSession, configureAuth, getSession } from '@/lib/auth';
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

// Đếm lượt cấu hình và lượt gia hạn mà `sessionSetup` thật gọi (hành vi giữ nguyên).
vi.mock('@/lib/auth', async (importOriginal) => {
  const actual = await importOriginal<typeof AuthModuleNamespace>();

  return {
    ...actual,
    bootstrapSession: vi.fn(actual.bootstrapSession),
    configureAuth: vi.fn(actual.configureAuth),
  };
});

beforeEach(() => {
  vi.mocked(configureAuth).mockClear();
  vi.mocked(bootstrapSession).mockClear();
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
    expect(configureAuth).toHaveBeenCalledTimes(1);
    expect(bootstrapSession).toHaveBeenCalledTimes(1);

    await expect(retryAppSession()).resolves.toBe(true);

    // Gia hạn thật thêm một lượt (không trả lượt khởi động đã nhớ), và không cấu hình lại.
    expect(bootstrapSession).toHaveBeenCalledTimes(2);
    expect(configureAuth).toHaveBeenCalledTimes(1);
    expect(getSession().status).toBe('authenticated');
  });
});
