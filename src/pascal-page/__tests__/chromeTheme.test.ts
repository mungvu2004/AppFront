/**
 * Áo trang 3D theo sáng/tối của AppFront (`../chromeTheme`): cùng khoá `app-theme-mode` với
 * `useTheme`, lớp `dark` trên `<html>`, theo tab khác (storage) và hệ điều hành ('system').
 */
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { APP_THEME_KEY, isChromeDark, syncChromeTheme } from '../chromeTheme';

describe('isChromeDark', () => {
  it.each([
    ['dark', false, true],
    ['light', true, false],
    ['system', true, true],
    ['system', false, false],
    [null, true, false],
    ['rác', true, false],
  ] as const)('%s, OS tối=%s → %s', (stored, os, dark) => {
    expect(isChromeDark(stored, os)).toBe(dark);
  });

  it('cùng khoá với useTheme của app', () => {
    const src = readFileSync(resolve(process.cwd(), 'src/hooks/useTheme.ts'), 'utf8');
    expect(src).toContain(`const THEME_KEY = '${APP_THEME_KEY}';`);
  });
});

describe('syncChromeTheme', () => {
  let osDark = false;
  const listeners = new Set<() => void>();
  let stop: () => void = () => undefined;

  beforeEach(() => {
    localStorage.clear();
    document.documentElement.classList.remove('dark');
    osDark = false;
    listeners.clear();
    vi.stubGlobal('matchMedia', () => ({
      get matches() {
        return osDark;
      },
      addEventListener: (_: string, fn: () => void) => listeners.add(fn),
      removeEventListener: (_: string, fn: () => void) => listeners.delete(fn),
    }));
  });
  afterEach(() => {
    stop();
    vi.unstubAllGlobals();
  });

  const isDark = () => document.documentElement.classList.contains('dark');

  it('áp ngay theo khoá đã lưu', () => {
    localStorage.setItem(APP_THEME_KEY, 'dark');
    stop = syncChromeTheme();
    expect(isDark()).toBe(true);
  });

  it('đổi ở tab app khác (storage) → đổi theo; khoá khác thì bỏ qua', () => {
    stop = syncChromeTheme();
    expect(isDark()).toBe(false);
    localStorage.setItem(APP_THEME_KEY, 'dark');
    window.dispatchEvent(new StorageEvent('storage', { key: 'khac' }));
    expect(isDark()).toBe(false);
    window.dispatchEvent(new StorageEvent('storage', { key: APP_THEME_KEY }));
    expect(isDark()).toBe(true);
  });

  it("'system' theo hệ điều hành, đổi tức thì; gỡ thì thôi theo dõi", () => {
    localStorage.setItem(APP_THEME_KEY, 'system');
    stop = syncChromeTheme();
    expect(isDark()).toBe(false);
    osDark = true;
    listeners.forEach((fn) => fn());
    expect(isDark()).toBe(true);
    stop();
    expect(listeners.size).toBe(0);
  });
});
