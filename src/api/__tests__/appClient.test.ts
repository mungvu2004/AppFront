import { afterEach, describe, expect, it, vi } from 'vitest';

import { API_BASE_PATH } from '../endpoints';
import { createAppApiClient, resolveApiBaseUrl, resolveUseMockApi } from '../appClient';

afterEach(() => {
  vi.unstubAllEnvs();
});

describe('resolveUseMockApi', () => {
  it('is fail-closed: only the literal true or "true" turns it on', () => {
    expect(resolveUseMockApi(true)).toBe(true);
    expect(resolveUseMockApi('true')).toBe(true);
    expect(resolveUseMockApi('false')).toBe(false);
    expect(resolveUseMockApi('1')).toBe(false);
    expect(resolveUseMockApi('yes')).toBe(false);
    expect(resolveUseMockApi(undefined)).toBe(false);
    expect(resolveUseMockApi(null)).toBe(false);
  });

  it('reads VITE_USE_MOCK_API from the environment when no value is given', () => {
    vi.stubEnv('VITE_USE_MOCK_API', 'true');
    expect(resolveUseMockApi()).toBe(true);

    vi.stubEnv('VITE_USE_MOCK_API', 'false');
    expect(resolveUseMockApi()).toBe(false);
  });
});

describe('resolveApiBaseUrl', () => {
  it('uses VITE_API_BASE_URL when it is set', () => {
    vi.stubEnv('VITE_API_BASE_URL', 'https://api.vidu.vn');
    expect(resolveApiBaseUrl()).toBe('https://api.vidu.vn');
  });

  it('falls back to the page origin plus the default API path otherwise', () => {
    vi.stubEnv('VITE_API_BASE_URL', '');
    expect(resolveApiBaseUrl()).toBe(
      new URL(API_BASE_PATH, globalThis.location?.origin ?? globalThis.origin).toString(),
    );
  });
});

describe('createAppApiClient', () => {
  it('answers auth.signIn from the mock fixture when VITE_USE_MOCK_API is on', async () => {
    vi.stubEnv('VITE_USE_MOCK_API', 'true');

    const client = createAppApiClient();
    const result = await client.auth.signIn({ body: { email: 'a@b.vn', password: 'anything', rememberMe: false } });

    expect(result).toEqual({ ok: true, data: undefined });
  });

  it('builds a real HTTP-backed client when the flag is off', () => {
    vi.stubEnv('VITE_USE_MOCK_API', 'false');
    vi.stubEnv('VITE_API_BASE_URL', 'https://api.vidu.vn');

    expect(() => createAppApiClient()).not.toThrow();
  });
});
