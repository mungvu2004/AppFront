// @vitest-environment jsdom
/**
 * 23-C-007 / BUG-648 — tuỳ chọn editor Pascal (bước lưới, độ rộng thanh bên) còn
 * nguyên sau tải lại.
 *
 * Kho `useEditor` và `useSidebarStore` dùng `persist` với `skipHydration`: `<Editor>`
 * gọi `persist.rehydrate()` trong hiệu ứng của nó, mà hiệu ứng của cha chạy SAU hiệu
 * ứng của con. `persist` ghi kho xuống `localStorage` ở MỌI `setState`, kể cả trước
 * lượt nạp lại — nên một lượt ghi lúc gắn đè tuỳ chọn đã lưu bằng giá trị mặc định.
 * Lớp bọc `useEditorPreferencesPersistence` (không sửa `vendor/pascal`) chặn các lượt
 * ghi đó tới khi kho đã nạp.
 *
 * Vitest không nạp được `@pascal-app/editor` thật (gói trỏ `exports` vào `dist/*.js`,
 * chưa dựng), nên hai kho dưới đây chép đúng tuỳ chọn `persist` của upstream
 * (`store/use-editor.tsx`, `components/ui/primitives/sidebar.tsx`): cùng tên khoá,
 * cùng `skipHydration`. Hai kho dựng bằng đúng bản zustand của gói vendor editor
 * (5.x, khác bản 4.x ở gốc app) để nâng zustand vendor thì test này cũng chạy theo
 * (RV3 #10). Test chỉ dùng `getState`/`persist`, không gọi kho như hook, nên bản React
 * riêng của vendor không chen vào.
 */

import { renderHook } from '@testing-library/react';
import { create } from '../../../vendor/pascal/packages/editor/node_modules/zustand/esm/index.mjs';
import { persist } from '../../../vendor/pascal/packages/editor/node_modules/zustand/esm/middleware.mjs';
import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';

const EDITOR_KEY = 'pascal-editor-ui-preferences';
const SIDEBAR_KEY = 'sidebar-preferences';

const stores = vi.hoisted(() => ({}) as Record<string, unknown>);
vi.mock('@pascal-app/editor', () => stores);

interface EditorState {
  phase: string;
  gridSnapStep: number;
  setPhase: (phase: string) => void;
  setGridSnapStep: (step: number) => void;
}
const useEditor = create<EditorState>()(
  persist(
    (write) => ({
      phase: 'site',
      gridSnapStep: 0.5,
      setPhase: (phase) => write({ phase }),
      setGridSnapStep: (gridSnapStep) => write({ gridSnapStep }),
    }),
    {
      name: EDITOR_KEY,
      partialize: (s) => ({ phase: s.phase, gridSnapStep: s.gridSnapStep }),
      skipHydration: true,
    },
  ),
);

interface SidebarState {
  width: number;
  isCollapsed: boolean;
  isDragging: boolean;
  setIsDragging: (isDragging: boolean) => void;
}
const useSidebarStore = create<SidebarState>()(
  persist(
    (write) => ({
      width: 288,
      isCollapsed: false,
      isDragging: false,
      setIsDragging: (isDragging) => write({ isDragging }),
    }),
    {
      name: SIDEBAR_KEY,
      partialize: (s) => ({ width: s.width, isCollapsed: s.isCollapsed }),
      skipHydration: true,
    },
  ),
);

Object.assign(stores, { useEditor, useSidebarStore });

const saved = (key: string) =>
  JSON.parse(localStorage.getItem(key) ?? '{}').state as Record<string, unknown> | undefined;

describe('[23-C-007 · BUG-648] tuỳ chọn editor sống qua tải lại', () => {
  beforeAll(async () => {
    const { useEditorPreferencesPersistence } = await import(
      '@/pascal-page/upstream/lib/editor-preferences'
    );
    renderHook(() => useEditorPreferencesPersistence());
  });

  beforeEach(() => {
    localStorage.clear();
  });

  it('một lượt ghi trước rehydrate không đè bước lưới đã lưu', async () => {
    localStorage.setItem(EDITOR_KEY, JSON.stringify({ state: { gridSnapStep: 0.25 }, version: 0 }));

    // Như một hiệu ứng con chạy lúc gắn, trước hiệu ứng rehydrate của `<Editor>`.
    useEditor.getState().setPhase('structure');
    expect(saved(EDITOR_KEY)?.gridSnapStep).toBe(0.25);

    await useEditor.persist.rehydrate();
    expect(useEditor.getState().gridSnapStep).toBe(0.25);
  });

  it('một lượt ghi trước rehydrate không đè độ rộng thanh bên đã lưu', async () => {
    localStorage.setItem(
      SIDEBAR_KEY,
      JSON.stringify({ state: { width: 400, isCollapsed: false }, version: 0 }),
    );

    useSidebarStore.getState().setIsDragging(true);
    await useSidebarStore.persist.rehydrate();

    expect(useSidebarStore.getState().width).toBe(400);
  });

  it('sau khi đã nạp, đổi bước lưới thì ghi xuống ngay', async () => {
    await useEditor.persist.rehydrate();
    useEditor.getState().setGridSnapStep(0.1);

    expect(saved(EDITOR_KEY)?.gridSnapStep).toBe(0.1);
  });

  it('localStorage hỏng (chế độ riêng tư) không làm vỡ editor', () => {
    const original = Storage.prototype.setItem;
    Storage.prototype.setItem = () => {
      throw new Error('QuotaExceededError');
    };
    try {
      expect(() => useEditor.getState().setGridSnapStep(0.5)).not.toThrow();
    } finally {
      Storage.prototype.setItem = original;
    }
  });
});
