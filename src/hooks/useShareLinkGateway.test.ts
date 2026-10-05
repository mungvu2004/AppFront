/**
 * F-06 — liên kết chia sẻ là v2 (BE-BIND #47–#49): máy chủ v1 không mount ba đường,
 * gọi nhầm nhận 404. Hook trả `null` trước khi dựng client, nên không màn nào cầm
 * được một cổng để gọi tới đó; cổng dựng tay cũng tự khai `supported: false`.
 */
import { renderHook } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import type * as AuthModule from '@/lib/auth';
import { createHttpClient } from '@/lib/http';

import { createAuthShareLinkGateway, useShareLinkGateway } from './useShareLinkGateway';

/**
 * `createAuthHttpClient` thay bằng bản dựng được client thật: không có nó, auth chưa
 * cấu hình trong vitest làm hook trả `null` qua nhánh `catch` — bài sẽ xanh cả khi bỏ
 * nhánh chặn của F-06.
 */
const authClientFactory = vi.hoisted(() => ({ calls: 0 }));

vi.mock('@/lib/auth', async (importOriginal) => {
  const actual = await importOriginal<typeof AuthModule>();
  const { createHttpClient: createPlainClient } = await import('@/lib/http');
  return {
    ...actual,
    createAuthHttpClient: (options: { readonly baseUrl: string }) => {
      authClientFactory.calls += 1;
      return createPlainClient(options);
    },
  };
});

describe('useShareLinkGateway — liên kết chia sẻ tắt ở v1', () => {
  it('trả null trước khi dựng client: không màn nào nhận được cổng để gọi share-links', () => {
    const { result } = renderHook(() => useShareLinkGateway());

    expect(result.current).toBeNull();
    expect(authClientFactory.calls).toBe(0);
  });

  it('cổng dựng trên client có phiên vẫn khai `supported: false`', () => {
    const gateway = createAuthShareLinkGateway(createHttpClient({ baseUrl: 'http://localhost' }));

    expect(gateway.supported).toBe(false);
  });
});
