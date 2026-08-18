import { afterEach, describe, expect, it, vi } from 'vitest';

import { getPlatformBeacon, getPlatformFetch, requirePlatformFetch } from '../platform';

describe('http/platform.ts', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it('binds fetch to the global, so it survives being passed around', async () => {
    // The real failure this guards: `const f = globalThis.fetch; f(url)` throws
    // `Illegal invocation` in a browser, because `fetch` is a method and loses
    // its receiver. Calling the result detached is the whole point of the test.
    const response = new Response(null, { status: 204 });
    const stub = vi.fn(function boundCheck(this: unknown) {
      expect(this === undefined || this === globalThis).toBe(true);

      return Promise.resolve(response);
    });
    vi.stubGlobal('fetch', stub);

    const platformFetch = getPlatformFetch();
    expect(platformFetch).not.toBeNull();

    const detached = platformFetch as typeof fetch;
    await expect(detached('/ping')).resolves.toBe(response);
    expect(stub).toHaveBeenCalledWith('/ping');
  });

  it('answers null where the environment has no fetch', () => {
    vi.stubGlobal('fetch', undefined);

    expect(getPlatformFetch()).toBeNull();
  });

  it('refuses to continue without a fetch, using the caller message', () => {
    vi.stubGlobal('fetch', undefined);

    expect(() => requirePlatformFetch('auth needs a transport.')).toThrow('auth needs a transport.');
  });

  it('hands back the transport when one exists', () => {
    const stub = vi.fn();
    vi.stubGlobal('fetch', stub);

    expect(typeof requirePlatformFetch('unused')).toBe('function');
  });

  it('binds the beacon to navigator', () => {
    const sendBeacon = vi.fn(function boundCheck(this: unknown) {
      expect(this).toBe(globalThis.navigator);

      return true;
    });
    vi.stubGlobal('navigator', { sendBeacon });

    const beacon = getPlatformBeacon();
    expect(beacon).not.toBeNull();

    expect((beacon as (url: string, body: BodyInit) => boolean)('/t', 'payload')).toBe(true);
    expect(sendBeacon).toHaveBeenCalledWith('/t', 'payload');
  });

  it('answers null where the browser has no beacon', () => {
    vi.stubGlobal('navigator', {});

    expect(getPlatformBeacon()).toBeNull();
  });
});
