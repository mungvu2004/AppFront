// @vitest-environment node
/**
 * Lần mở đầu (`./firstOpen`): gieo `rendered` + chủ đề tối + cờ đúng một lần; có cờ thì
 * thôi; bộ nhớ ném lỗi thì không sập. Chủ đề của trang giữ ở khoá riêng, nên khung nhúng
 * của app chính ghim `studio` vào `viewer-preferences` cũng không làm mất nó. Kho Pascal và
 * `localStorage` ở đây là bản giả (vitest không nạp được `@pascal-app/viewer` thật khi gói
 * chưa dựng), nên bài kiểm gọi thẳng `./applyFirstOpenLook`.
 */
import { describe, expect, it, vi } from 'vitest';

import {
  applyFirstOpenLook,
  EDITOR_THEME_KEY,
  FIRST_OPEN_FLAG,
  FIRST_OPEN_THEME,
  type FirstOpenStore,
} from '../applyFirstOpenLook';

type Listener = Parameters<FirstOpenStore['subscribe']>[0];

const fakeStore = (hydrated = true, sceneTheme = 'studio') => {
  let theme = sceneTheme;
  const listeners: Listener[] = [];
  const setSceneTheme = vi.fn((id: string) => {
    const previous = { ...look, sceneTheme: theme };
    theme = id;
    listeners.forEach((listener) => listener({ ...look, sceneTheme: theme }, previous));
  });
  const look = { setRenderContext: vi.fn(), setShading: vi.fn(), setSceneTheme };
  let onHydrated: (() => void) | undefined;
  const store = {
    getState: () => ({ ...look, sceneTheme: theme }),
    subscribe: (listener: Listener) => listeners.push(listener),
    persist: { hasHydrated: () => hydrated, onFinishHydration: (fn: () => void) => (onHydrated = fn) },
  };
  return { look, store, hydrate: () => onHydrated?.(), theme: () => theme };
};

const fakeStorage = () => {
  const map = new Map<string, string>();
  return {
    getItem: (key: string) => map.get(key) ?? null,
    setItem: (key: string, value: string) => void map.set(key, value),
  } as unknown as Storage;
};

describe('applyFirstOpenLook', () => {
  it('lần đầu: rendered trong editor + chủ đề tối + đặt cờ; lần sau không gieo lại shading', () => {
    const storage = fakeStorage();
    const first = fakeStore();
    applyFirstOpenLook(first.store, () => storage);
    expect(first.look.setRenderContext).toHaveBeenCalledWith('editor');
    expect(first.look.setShading).toHaveBeenCalledWith('rendered');
    expect(first.look.setSceneTheme).toHaveBeenCalledWith(FIRST_OPEN_THEME);
    expect(storage.getItem(FIRST_OPEN_FLAG)).not.toBeNull();

    const second = fakeStore();
    applyFirstOpenLook(second.store, () => storage);
    expect(second.look.setShading).not.toHaveBeenCalled();
  });

  it('app chính ghim studio vào kho chung: trang editor vẫn mở lại đúng chủ đề người dùng chọn', () => {
    const storage = fakeStorage();
    const first = fakeStore();
    applyFirstOpenLook(first.store, () => storage);
    first.store.getState().setSceneTheme('twilight');
    expect(storage.getItem(EDITOR_THEME_KEY)).toBe('twilight');

    // Lần sau: `viewer-preferences` đã bị khung nhúng đè về `studio`.
    const second = fakeStore(true, 'studio');
    applyFirstOpenLook(second.store, () => storage);
    expect(second.theme()).toBe('twilight');
  });

  it('máy đã có cờ nhưng chưa có khoá chủ đề: để nguyên chủ đề đang có', () => {
    const storage = fakeStorage();
    storage.setItem(FIRST_OPEN_FLAG, '1');
    const { look, store } = fakeStore(true, 'studio');
    applyFirstOpenLook(store, () => storage);
    expect(look.setSceneTheme).not.toHaveBeenCalled();
  });

  it('kho chưa nạp xong: chờ onFinishHydration rồi mới gieo', () => {
    const { look, store, hydrate } = fakeStore(false);
    applyFirstOpenLook(store, fakeStorage);
    expect(look.setShading).not.toHaveBeenCalled();
    hydrate();
    expect(look.setShading).toHaveBeenCalledWith('rendered');
  });

  it('bộ nhớ ném lỗi: không sập, không gieo', () => {
    const { look, store } = fakeStore();
    expect(() =>
      applyFirstOpenLook(store, () => {
        throw new Error('SecurityError');
      }),
    ).not.toThrow();
    expect(look.setShading).not.toHaveBeenCalled();
  });

  it('localStorage ném lỗi lúc tạo kho (zustand không gắn persist): không sập lúc nạp trang', () => {
    const { look, store } = fakeStore();
    const withoutPersist = { getState: store.getState, subscribe: store.subscribe };
    expect(() => applyFirstOpenLook(withoutPersist, fakeStorage)).not.toThrow();
    expect(look.setShading).not.toHaveBeenCalled();
  });
});
