import { beforeEach, describe, expect, it, vi } from 'vitest';

import { __resetFragmentTokenForTests, consumeFragmentToken } from './fragmentToken';

/** A window-shaped stub whose `replaceState` really drops the hash, as a browser does. */
function makeTarget(options: { hash: string; pathname?: string; state?: unknown; search?: string }) {
  const location = {
    hash: options.hash,
    pathname: options.pathname ?? '/login/reset-password',
    search: options.search ?? '',
  };
  const history = {
    state: options.state ?? null,
    replaceState: vi.fn((_state: unknown, _unused: string, url?: string | URL | null) => {
      // The URL handed over carries no fragment, so the hash is gone afterwards.
      expect(String(url)).not.toContain('#');
      location.hash = '';
    }),
  };

  return { location, history } as unknown as Pick<Window, 'history' | 'location'> & {
    history: { replaceState: ReturnType<typeof vi.fn>; state: unknown };
    location: { hash: string };
  };
}

beforeEach(() => {
  __resetFragmentTokenForTests();
});

describe('consumeFragmentToken', () => {
  it('reads the token, strips the fragment once and keeps the router history.state', () => {
    const state = { key: 'k1', idx: 1, usr: null };
    const target = makeTarget({ hash: '#token=abc', state, search: '?x=1' });

    expect(consumeFragmentToken(target)).toBe('abc');
    expect(target.history.replaceState).toHaveBeenCalledTimes(1);
    expect(target.history.replaceState).toHaveBeenCalledWith(state, '', '/login/reset-password?x=1');
    expect(target.location.hash).toBe('');
  });

  it('returns the same token for the same history entry without touching the URL again', () => {
    const state = { key: 'k1' };
    const first = makeTarget({ hash: '#token=abc', state });

    expect(consumeFragmentToken(first)).toBe('abc');

    // StrictMode runs the initialiser twice: the second pass sees a clean URL.
    const second = makeTarget({ hash: '', state });

    expect(consumeFragmentToken(second)).toBe('abc');
    expect(second.history.replaceState).not.toHaveBeenCalled();
  });

  it('prefers a fresh #token= over the remembered one on the same pathname', () => {
    expect(consumeFragmentToken(makeTarget({ hash: '#token=abc' }))).toBe('abc');
    expect(consumeFragmentToken(makeTarget({ hash: '#token=def' }))).toBe('def');
    expect(consumeFragmentToken(makeTarget({ hash: '' }))).toBe('def');
  });

  it('returns null for another history entry that has no fragment', () => {
    expect(consumeFragmentToken(makeTarget({ hash: '#token=abc', state: { key: 'k1' } }))).toBe('abc');
    expect(consumeFragmentToken(makeTarget({ hash: '', state: { key: 'k2' } }))).toBeNull();
  });

  it('returns null and does not touch the URL when there is nothing to read', () => {
    const target = makeTarget({ hash: '' });

    expect(consumeFragmentToken(target)).toBeNull();
    expect(target.history.replaceState).not.toHaveBeenCalled();
  });

  it('strips a fragment that carries no token, and returns null', () => {
    const target = makeTarget({ hash: '#other=1' });

    expect(consumeFragmentToken(target)).toBeNull();
    expect(target.history.replaceState).toHaveBeenCalledTimes(1);
  });
});
