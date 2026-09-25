/**
 * Người sau không được thấy dữ liệu của người trước, và vẫn được giữ cái máy
 * của mình như đã bày.
 *
 * Hai nửa của cùng một bài: xoá đúng thứ phải xoá, và **không** xoá thứ không
 * thuộc về ai — `zoom` với `theme` ở đây đại diện cho 14 khoá của ba slice
 * `view`/`ui`/`tool`.
 */

import { beforeEach, describe, expect, it } from 'vitest';

import { useStore } from '../index';
import { resetUserScopedState } from '../resetUserScopedState';
import { createToolSlice } from '../toolSlice';
import { createUiSlice } from '../uiSlice';
import { createViewSlice } from '../viewSlice';

/** Khoá dữ liệu (không phải hành động) của một slice, đọc từ chính nó. */
const dataKeysOf = (slice: object): string[] =>
  Object.entries(slice)
    .filter(([, value]) => typeof value !== 'function')
    .map(([key]) => key);

/** Ba slice "thuộc về cái máy", dựng từ chính ba factory của chúng. */
const machineScopedKeys = (): string[] => {
  const noop = () => undefined;
  const build = <T>(create: (set: never, get: never, api: never) => T): T =>
    create(noop as never, noop as never, noop as never);

  return [
    ...dataKeysOf(build(createViewSlice) as object),
    ...dataKeysOf(build(createUiSlice) as object),
    ...dataKeysOf(build(createToolSlice) as object),
  ];
};

const SAMPLE_PROJECT = {
  id: 'p1',
  name: 'Dự án của người trước',
} as unknown as NonNullable<ReturnType<typeof useStore.getState>['project']>;

beforeEach(() => {
  useStore.setState(useStore.getInitialState(), true);
  useStore.temporal.getState().clear();
});

describe('resetUserScopedState — danh sách GIỮ', () => {
  /**
   * Giá trị của thiết kế "danh sách GIỮ" nằm ở chỗ nó phải khớp **đủ** ba
   * slice, không thừa không thiếu. Đối chiếu tay một lần là đủ cho hôm nay và
   * vô dụng cho lần ai đó thêm một khoá vào `uiSlice`; ca này dựng danh sách từ
   * chính ba factory nên nó tự đi theo.
   */
  it('giữ nguyên MỌI khoá của ba slice view/ui/tool, không chỉ vài khoá đại diện', () => {
    const keys = machineScopedKeys();
    expect(keys).toHaveLength(14);

    const store = useStore.getState() as unknown as Record<string, unknown>;
    const before = Object.fromEntries(keys.map((key) => [key, store[key]]));

    useStore.getState().setProject(SAMPLE_PROJECT);
    resetUserScopedState();

    const after = useStore.getState() as unknown as Record<string, unknown>;
    keys.forEach((key) => {
      expect(after[key]).toEqual(before[key]);
    });
  });
});

describe('resetUserScopedState', () => {
  it('đưa dữ liệu theo người về giá trị ban đầu', () => {
    const store = useStore.getState();
    store.setProject(SAMPLE_PROJECT);
    store.setUserRoles(['engineer']);
    store.setSelection(['W-1', 'W-2']);

    resetUserScopedState();

    expect(useStore.getState().project).toBeNull();
    expect(useStore.getState().userRoles).toEqual([]);
    expect(useStore.getState().selectedIds).toEqual([]);
  });

  it('giữ nguyên cách người ta bày cái máy của mình', () => {
    useStore.getState().setZoom(2.5);
    useStore.getState().setTheme('dark');
    useStore.getState().setActiveTool('drawWall');

    resetUserScopedState();

    expect(useStore.getState().zoom).toBe(2.5);
    expect(useStore.getState().theme).toBe('dark');
    expect(useStore.getState().activeTool).toBe('drawWall');
  });

  it('không đè một hàm nào của store', () => {
    const before = useStore.getState().setProject;

    resetUserScopedState();

    expect(useStore.getState().setProject).toBe(before);
  });

  it('xoá luôn lịch sử hoàn tác, để người mới không lùi về bản vẽ người cũ', () => {
    useStore.setState({ spatial: { walls: [] } as never });
    useStore.setState({ spatial: { walls: [1] } as never });

    resetUserScopedState();

    expect(useStore.temporal.getState().pastStates).toEqual([]);
    expect(useStore.temporal.getState().futureStates).toEqual([]);
  });
});
