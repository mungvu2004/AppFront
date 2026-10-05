/**
 * Cổng mật khẩu / phiên / vùng nguy hiểm: N13 phân loại lỗi, hai năng lực v2 tắt,
 * và không còn bộ nhớ giả. Client giả tiêm tường minh.
 */

import { readFileSync } from 'node:fs';

import { describe, expect, it, vi } from 'vitest';

import type { ApiClient } from '@/api/client';
import { createMockApiClient } from '@/api/__mocks__/client';
import type { HttpError } from '@/lib/http';

import { createAccountAuthGateway } from './accountAuthGateway';

vi.mock('@/lib/auth', () => ({
  getSession: () => ({ user: { id: 'user-1', email: 'an@congty.vn' } }),
}));

const INPUT = { currentPassword: 'cu-12345', newPassword: 'moi-12345' };

function wireError(status: number, code?: string, retryAfterSeconds?: number): HttpError {
  return {
    kind: 'http',
    raw: undefined,
    requestId: 'req-1',
    retryable: false,
    status,
    ...(code !== undefined ? { code } : {}),
    ...(retryAfterSeconds !== undefined ? { retryAfterSeconds } : {}),
  };
}

function clientFailing(error: HttpError): ApiClient {
  return {
    ...createMockApiClient(),
    me: {
      ...createMockApiClient().me,
      changePassword: () => Promise.resolve({ ok: false, error }),
    },
  };
}

describe('changePassword (N13)', () => {
  it('thành công trả ok', async () => {
    const changePassword = vi.fn(() => Promise.resolve({ ok: true as const, data: undefined }));
    const client: ApiClient = {
      ...createMockApiClient(),
      me: { ...createMockApiClient().me, changePassword },
    };

    const result = await createAccountAuthGateway({ apiClient: client }).changePassword(INPUT);

    expect(result).toEqual({ ok: true, data: undefined });
    expect(changePassword).toHaveBeenCalledWith({ body: INPUT });
  });

  it('CURRENT_PASSWORD_INCORRECT thành wrong-current-password', async () => {
    const gateway = createAccountAuthGateway({
      apiClient: clientFailing(wireError(422, 'CURRENT_PASSWORD_INCORRECT')),
    });

    expect(await gateway.changePassword(INPUT)).toEqual({
      ok: false,
      error: { reason: 'wrong-current-password' },
    });
  });

  it('RATE_LIMITED kèm retryAfterSeconds 9 thành rate-limited, 9', async () => {
    const gateway = createAccountAuthGateway({
      apiClient: clientFailing(wireError(429, 'RATE_LIMITED', 9)),
    });

    expect(await gateway.changePassword(INPUT)).toEqual({
      ok: false,
      error: { reason: 'rate-limited', retryAfterSeconds: 9 },
    });
  });

  it('429 không mã thành rate-limited, không có số giây', async () => {
    const gateway = createAccountAuthGateway({ apiClient: clientFailing(wireError(429)) });

    expect(await gateway.changePassword(INPUT)).toEqual({
      ok: false,
      error: { reason: 'rate-limited' },
    });
  });

  it('mã lạ và 5xx thành unavailable', async () => {
    expect(
      await createAccountAuthGateway({
        apiClient: clientFailing(wireError(422, 'MA_LA')),
      }).changePassword(INPUT),
    ).toEqual({ ok: false, error: { reason: 'unavailable' } });
    expect(
      await createAccountAuthGateway({ apiClient: clientFailing(wireError(503)) }).changePassword(
        INPUT,
      ),
    ).toEqual({ ok: false, error: { reason: 'unavailable' } });
  });
});

describe('nạp lười client hỏng', () => {
  it('changePassword ném thì thành unavailable, không ném trôi', async () => {
    const client: ApiClient = {
      ...createMockApiClient(),
      me: {
        ...createMockApiClient().me,
        changePassword: () => Promise.reject(new Error('mất chunk')),
      },
    };

    expect(await createAccountAuthGateway({ apiClient: client }).changePassword(INPUT)).toEqual({
      ok: false,
      error: { reason: 'unavailable' },
    });
  });
});

describe('năng lực v2', () => {
  it('capabilities: phiên và xoá tài khoản đều false', () => {
    expect(createAccountAuthGateway({ apiClient: createMockApiClient() }).capabilities).toEqual({
      sessions: false,
      deleteAccount: false,
    });
  });

  it('ba hàm v2 trả unavailable, không bộ nhớ', async () => {
    const gateway = createAccountAuthGateway({ apiClient: createMockApiClient() });

    expect(await gateway.listSessions()).toEqual({ ok: false, error: 'unavailable' });
    expect(await gateway.revokeSession({ sessionId: 's' })).toEqual({
      ok: false,
      error: 'unavailable',
    });
    expect(await gateway.deleteAccount({ confirmEmail: 'an@congty.vn' })).toEqual({
      ok: false,
      error: 'unavailable',
    });
  });

  it('readIdentity đọc thư từ phiên, isManagedExternally false', async () => {
    const result = await createAccountAuthGateway({
      apiClient: createMockApiClient(),
    }).readIdentity();

    expect(result).toEqual({
      ok: true,
      data: { email: 'an@congty.vn', isManagedExternally: false },
    });
  });
});

describe('nguồn file', () => {
  it('không còn mật khẩu giả hay bộ nhớ phiên', () => {
    const source = readFileSync(
      'src/screens/account/AccountSettings/accountAuthGateway.ts',
      'utf8',
    );

    expect(source).not.toContain('matkhau123');
    // Ghép chuỗi để chính file test không khớp lệnh git grep của nghiệm thu.
    expect(source).not.toContain('STAND_IN_' + 'CURRENT_PASSWORD');
    expect(source).not.toContain('stored' + 'Sessions');
  });
});
