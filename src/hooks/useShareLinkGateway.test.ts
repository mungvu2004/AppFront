/**
 * F-06 — liên kết chia sẻ là v2 (BE-BIND #47–#49): máy chủ v1 không mount ba đường,
 * gọi nhầm nhận 404. Hook trả `null` trước khi dựng client, nên không màn nào cầm
 * được một cổng để gọi tới đó; cổng dựng tay cũng tự khai `supported: false`.
 */
import { renderHook } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { createHttpClient } from '@/lib/http';

import { createAuthShareLinkGateway, useShareLinkGateway } from './useShareLinkGateway';

describe('useShareLinkGateway — liên kết chia sẻ tắt ở v1', () => {
  it('trả null: không màn nào nhận được cổng để gọi share-links', () => {
    const { result } = renderHook(() => useShareLinkGateway());

    expect(result.current).toBeNull();
  });

  it('cổng dựng trên client có phiên vẫn khai `supported: false`', () => {
    const gateway = createAuthShareLinkGateway(createHttpClient({ baseUrl: 'http://localhost' }));

    expect(gateway.supported).toBe(false);
  });
});
