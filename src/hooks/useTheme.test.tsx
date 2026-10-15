/**
 * Q2 (user decision 2026-10-15), catalog-C2 33R-C-001: "Theo hệ thống" được lưu cùng chế độ chủ đề
 * (`app-theme-mode` = 'system'), `<html>` theo `prefers-color-scheme` kể cả khi hệ điều hành đổi
 * lúc trang đang mở; 'light'/'dark' đã lưu giữ nguyên.
 */

import { act, cleanup, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { useStore } from '../store';
import { useTheme } from './useTheme';

const KEY = 'app-theme-mode';
const QUERY = '(prefers-color-scheme: dark)';

type Listener = () => void;

/** `matchMedia` điều khiển được: `setDark(true)` đổi `matches` rồi báo mọi bên đang nghe. */
function stubOs(initialDark: boolean): { setDark: (dark: boolean) => void } {
  let dark = initialDark;
  const listeners = new Set<Listener>();

  vi.stubGlobal('matchMedia', (query: string) => ({
    get matches() {
      return query === QUERY ? dark : false;
    },
    media: query,
    addEventListener: (_type: string, fn: Listener) => listeners.add(fn),
    removeEventListener: (_type: string, fn: Listener) => listeners.delete(fn),
    addListener: () => undefined,
    removeListener: () => undefined,
    dispatchEvent: () => false,
  }));

  return {
    setDark: (next) => {
      dark = next;
      act(() => listeners.forEach((fn) => fn()));
    },
  };
}

const isDark = (): boolean => document.documentElement.classList.contains('dark');

beforeEach(() => {
  window.localStorage.clear();
  document.documentElement.classList.remove('dark');
  useStore.getState().setThemeChoice('light', false);
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  window.localStorage.clear();
  document.documentElement.classList.remove('dark');
});

describe('[33R-C-001] "Theo hệ thống" được lưu và theo hệ điều hành', () => {
  it('chọn system rồi tải lại: khoá lưu là "system", lựa chọn vẫn là system (không phải giá trị đã giải)', () => {
    stubOs(true);
    const first = renderHook(() => useTheme());

    act(() => useStore.getState().setThemeChoice('system', true));
    expect(window.localStorage.getItem(KEY)).toBe('system');

    // "Tải lại": bỏ cây cũ, store về mặc định, đọc lại từ localStorage.
    first.unmount();
    useStore.getState().setThemeChoice('light', false);
    renderHook(() => useTheme());

    expect(useStore.getState().themeChoice).toBe('system');
    expect(window.localStorage.getItem(KEY)).toBe('system');
  });

  it('system + hệ điều hành tối: <html> mang lớp dark; sáng thì không', () => {
    stubOs(true);
    window.localStorage.setItem(KEY, 'system');
    const { unmount } = renderHook(() => useTheme());

    expect(isDark()).toBe(true);
    expect(useStore.getState().theme).toBe('dark');

    unmount();
    document.documentElement.classList.add('dark');
    stubOs(false);
    renderHook(() => useTheme());

    expect(isDark()).toBe(false);
    expect(window.localStorage.getItem(KEY)).toBe('system');
  });

  it('hệ điều hành đổi lúc trang đang mở: <html> đổi theo, khoá vẫn là "system"', () => {
    const os = stubOs(false);
    window.localStorage.setItem(KEY, 'system');
    renderHook(() => useTheme());
    expect(isDark()).toBe(false);

    os.setDark(true);
    expect(isDark()).toBe(true);
    expect(window.localStorage.getItem(KEY)).toBe('system');

    os.setDark(false);
    expect(isDark()).toBe(false);
  });

  it('light/dark đã lưu giữ nguyên, hệ điều hành đổi không ảnh hưởng', () => {
    const os = stubOs(true);
    window.localStorage.setItem(KEY, 'light');
    const first = renderHook(() => useTheme());
    expect(isDark()).toBe(false);
    expect(window.localStorage.getItem(KEY)).toBe('light');
    os.setDark(false);
    os.setDark(true);
    expect(isDark()).toBe(false);

    first.unmount();
    window.localStorage.setItem(KEY, 'dark');
    stubOs(false);
    renderHook(() => useTheme());
    expect(isDark()).toBe(true);
    expect(window.localStorage.getItem(KEY)).toBe('dark');
  });
});
