/**
 * 23-C-007 / BUG-648 — tuỳ chọn editor Pascal (bước lưới…) còn nguyên sau tải lại.
 *
 * Kho `useEditor` dùng `persist` với `skipHydration`: `<Editor>` gọi
 * `persist.rehydrate()` trong hiệu ứng của nó, mà hiệu ứng của cha chạy SAU
 * hiệu ứng của con. `persist` ghi kho xuống `localStorage` ở MỌI `setState`,
 * kể cả trước lượt nạp lại — nên một lượt ghi lúc gắn (con của editor, khung
 * AppFront) đè tuỳ chọn đã lưu bằng giá trị mặc định trước khi kịp đọc nó.
 */

import { beforeEach, describe, expect, it } from 'vitest';

import { useEditor } from '@pascal-app/editor';

const KEY = 'pascal-editor-ui-preferences';

describe('[23-C-007 · BUG-648] tuỳ chọn editor sống qua tải lại', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('một lượt ghi trước rehydrate không đè bước lưới đã lưu', async () => {
    localStorage.setItem(KEY, JSON.stringify({ state: { gridSnapStep: 0.25 }, version: 0 }));

    // Như một hiệu ứng con chạy lúc gắn, trước hiệu ứng rehydrate của `<Editor>`.
    useEditor.getState().setPhase('structure');
    await useEditor.persist.rehydrate();

    expect(useEditor.getState().gridSnapStep).toBe(0.25);
  });

  it('sau khi đã nạp, đổi bước lưới thì ghi xuống ngay', async () => {
    await useEditor.persist.rehydrate();
    useEditor.getState().setGridSnapStep(0.1);

    expect(JSON.parse(localStorage.getItem(KEY) ?? '{}').state?.gridSnapStep).toBe(0.1);
  });
});
