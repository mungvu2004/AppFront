import { describe, expect, it, vi } from 'vitest';

import type { HttpClient, HttpError, Result } from '@/lib/http';

import { createApiClient } from '../client';
import { ENDPOINTS } from '../endpoints';
import { createMockApiClient } from '../__mocks__/client';
import { ApiErrorBodySchema } from '../schemas/errors';
import { MeSchema } from '../schemas/me';

/** N11–N14: bốn phương thức của `client.me`, thân dây dựng bằng literal (không lấy đầu ra schema làm thân giả). */

const ok = <T>(data: T): Result<T, HttpError> => ({ ok: true, data });

const meWire = {
  avatarUrl: 'https://cdn.example.test/avatars/01J0AVATAR0000000000000001.png',
  email: 'an.pham@congty.vn',
  fullName: 'Phạm An',
  jobTitle: 'Kỹ sư kết cấu',
  language: 'vi',
  phone: '0912 345 678',
};

interface Call {
  readonly body: unknown;
  readonly method: string;
  readonly options: Record<string, unknown>;
  readonly path: string;
}

function createHttpMock(responses: Record<string, unknown> = {}): {
  calls: Call[];
  http: HttpClient;
} {
  const calls: Call[] = [];
  const record =
    (method: string) =>
    (path: string, options: Record<string, unknown> = {}): Result<never, HttpError> => {
      calls.push({ body: options['body'], method, options, path });

      return ok(responses[`${method} ${path}`] as never);
    };

  // HttpClient có nhiều thành viên không liên quan tới bài này; dựng đủ kiểu thì dài gấp ba mà không
  // kiểm thêm gì. Cùng tiền lệ với các file test API khác (users, library, …).
  const http = {
    delete: vi.fn(record('DELETE')),
    events: { emit: () => undefined, on: () => () => undefined },
    get: vi.fn(record('GET')),
    getRecentRequests: () => [],
    patch: vi.fn(record('PATCH')),
    post: vi.fn(record('POST')),
    put: vi.fn(record('PUT')),
  } as unknown as HttpClient;

  return { calls, http };
}

describe('fixture thân dây', () => {
  it('meWire là thân MeSchema hợp lệ', () => {
    expect(MeSchema.safeParse(meWire).success).toBe(true);
  });
});

describe('client.me — đúng method và đường', () => {
  it('readProfile là GET /me và giải MeSchema', async () => {
    const { calls, http } = createHttpMock({ [`GET ${ENDPOINTS.me.profile}`]: meWire });

    const result = await createApiClient(http).me.readProfile();

    expect(calls.map((call) => `${call.method} ${call.path}`)).toEqual(['GET /me']);
    expect(result).toEqual({ ok: true, data: meWire });
  });

  it('readProfile từ chối khoá lạ bằng lỗi giải mã (schema strict)', async () => {
    const { http } = createHttpMock({
      [`GET ${ENDPOINTS.me.profile}`]: { ...meWire, role: 'admin' },
    });

    const result = await createApiClient(http).me.readProfile();

    expect(!result.ok && result.error).toMatchObject({
      code: 'CONTRACT_VALIDATION',
      kind: 'validation',
    });
  });

  it('updateProfile là PATCH /me, giữ nguyên "" trong thân (lệnh xoá)', async () => {
    const { calls, http } = createHttpMock({
      [`PATCH ${ENDPOINTS.me.profile}`]: { ...meWire, phone: undefined },
    });
    const body = { jobTitle: '', phone: '' };

    await createApiClient(http).me.updateProfile({ body });

    expect(calls).toHaveLength(1);
    expect(calls[0]?.method).toBe('PATCH');
    expect(calls[0]?.path).toBe('/me');
    expect(calls[0]?.body).toStrictEqual({ jobTitle: '', phone: '' });
  });

  it('changePassword là POST /me/password và trả void khi 204', async () => {
    const { calls, http } = createHttpMock();
    const body = { currentPassword: 'cu-12345', newPassword: 'moi-12345' };

    const result = await createApiClient(http).me.changePassword({ body });

    expect(calls.map((call) => `${call.method} ${call.path}`)).toEqual(['POST /me/password']);
    expect(calls[0]?.body).toStrictEqual(body);
    expect(result).toEqual({ ok: true, data: undefined });
  });

  it('replaceAvatar là PUT /me/avatar với timeoutMode "file", và giải MeSchema', async () => {
    const { calls, http } = createHttpMock({ [`PUT ${ENDPOINTS.me.avatar}`]: meWire });
    const body = { contentBase64: 'iVBORw0KGgo=', mimeType: 'image/png' } as const;

    const result = await createApiClient(http).me.replaceAvatar({ body });

    expect(calls.map((call) => `${call.method} ${call.path}`)).toEqual(['PUT /me/avatar']);
    expect(calls[0]?.body).toStrictEqual(body);
    expect(calls[0]?.options['timeoutMode']).toBe('file');
    expect(result).toEqual({ ok: true, data: meWire });
  });

  it('lỗi của transport đi qua nguyên vẹn', async () => {
    const error: HttpError = {
      kind: 'http',
      raw: undefined,
      requestId: 'req-1',
      retryable: false,
      status: 422,
    };
    const http = {
      get: vi.fn(() => ({ ok: false, error })),
      put: vi.fn(() => ({ ok: false, error })),
    } as unknown as HttpClient;

    const client = createApiClient(http);

    expect(await client.me.readProfile()).toEqual({ ok: false, error });
    expect(
      await client.me.replaceAvatar({ body: { contentBase64: 'AA==', mimeType: 'image/jpeg' } }),
    ).toEqual({
      ok: false,
      error,
    });
  });
});

describe('mock client.me — có trạng thái, trả MeSchema hợp lệ', () => {
  it('đọc, sửa rồi đọc lại thấy ngay; "" xoá khoá; ảnh là URL tuyệt đối', async () => {
    const client = createMockApiClient();
    const first = await client.me.readProfile();

    expect(first.ok && MeSchema.safeParse(first.data).success).toBe(true);

    await client.me.updateProfile({
      body: { fullName: 'Lê Minh', jobTitle: 'Kiến trúc sư', phone: '0901' },
    });
    await client.me.updateProfile({ body: { phone: '' } });
    const avatar = await client.me.replaceAvatar({
      body: { contentBase64: 'AA==', mimeType: 'image/png' },
    });
    const again = await client.me.readProfile();

    expect(avatar.ok && avatar.data.avatarUrl?.startsWith('https://')).toBe(true);
    expect(again.ok && again.data.fullName).toBe('Lê Minh');
    expect(again.ok && again.data.jobTitle).toBe('Kiến trúc sư');
    expect(again.ok && 'phone' in again.data).toBe(false);
    expect(
      (
        await client.me.changePassword({
          body: { currentPassword: 'a', newPassword: 'b-12345678' },
        })
      ).ok,
    ).toBe(true);
  });
});

describe('thân lỗi của N12–N14 hợp lệ với ApiErrorBodySchema', () => {
  it.each([
    { code: 'VALIDATION', field: 'fullName', requestId: 'req-1' },
    { code: 'CURRENT_PASSWORD_INCORRECT', field: 'currentPassword', requestId: 'req-2' },
    { code: 'AVATAR_DIMENSIONS_EXCEEDED', requestId: 'req-3' },
  ])('$code', (body) => {
    expect(ApiErrorBodySchema.safeParse(body).success).toBe(true);
  });
});
