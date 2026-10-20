// @vitest-environment node
/**
 * Lần mở đầu (`./firstOpen`): gieo `rendered` + chủ đề tối + cờ đúng một lần; có cờ thì
 * thôi; bộ nhớ ném lỗi thì không sập. Kho Pascal và `localStorage` ở đây là bản giả
 * (vitest không nạp được `@pascal-app/viewer` thật khi gói chưa dựng), nên bài kiểm gọi
 * thẳng `./applyFirstOpenLook`.
 */
import { describe, expect, it, vi } from 'vitest';

import { applyFirstOpenLook, FIRST_OPEN_FLAG, FIRST_OPEN_THEME } from '../applyFirstOpenLook';

const fakeStore = (hydrated = true) => {
  const look = { setRenderContext: vi.fn(), setShading: vi.fn(), setSceneTheme: vi.fn() };
  let onHydrated: (() => void) | undefined;
  const store = {
    getState: () => look,
    persist: { hasHydrated: () => hydrated, onFinishHydration: (fn: () => void) => (onHydrated = fn) },
  };
  return { look, store, hydrate: () => onHydrated?.() };
};

const fakeStorage = () => {
  const map = new Map<string, string>();
  return {
    getItem: (key: string) => map.get(key) ?? null,
    setItem: (key: string, value: string) => void map.set(key, value),
  } as unknown as Storage;
};

describe('applyFirstOpenLook', () => {
  it('lần đầu: rendered trong editor + chủ đề tối + đặt cờ; lần sau không làm gì', () => {
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
    expect(second.look.setSceneTheme).not.toHaveBeenCalled();
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
});
