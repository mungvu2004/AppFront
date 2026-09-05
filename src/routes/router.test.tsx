/**
 * Ba phím vỏ mới của `UndoShortcuts` — `?`, `Ctrl+F` (gián tiếp, xem
 * `ObjectSearch.test.tsx`) và Escape — kiểm bằng CÚ GÕ PHÍM THẬT, cùng khuôn
 * `PropertyInspector.test.tsx` dùng cho Ctrl+Z: `fireEvent.keyDown(document.body, …)`
 * nổi bọt lên đúng một listener mà `shortcutRegistry` gắn trên `window`, không
 * gọi thẳng handler nào.
 *
 * `UndoShortcuts` không nhận `registry` tuỳ chọn (đúng component vỏ bọc cả ba
 * mươi route thật dùng, không phải bản dựng lại), nên bài kiểm này dùng chung
 * `appShortcutRegistry` — giống `PropertyInspector.test.tsx` — và dọn `openDialog`
 * sau mỗi bài để không rò rỉ sang bài kế tiếp.
 *
 * Hai điều làm bảng phím tắt không hiện NGAY sau lượt gõ:
 *
 * 1. `LazyGlobalShortcutHelp` tải muộn (mục "Bảng phím tắt tải muộn" ở đầu
 *    `router.tsx`) nên lần mở ĐẦU TIÊN phải qua `Suspense` — `screen.findByRole`
 *    thay vì `getByRole`. Trần chờ đặt cao hơn mặc định (1000 ms): bộ toàn bài
 *    kiểm chạy song song hàng trăm tệp, và lượt tải chunk có thể chậm hơn hẳn
 *    lúc chạy một mình.
 * 2. Đóng đi qua `AnimatePresence`: state đổi ngay (đo được tức thì ở
 *    `GlobalShortcutHelp.test.tsx` qua spy `onClose`), nhưng nút DOM chỉ biến
 *    mất sau khi hoạt cảnh thoát chạy xong — không mock `matchMedia` ở đây nên
 *    `prefersReducedMotion` là `false` (`reducedMotion.ts:13`) và hoạt cảnh
 *    chạy thật, nên mọi khẳng định "đã đóng" phải qua `waitFor`.
 */

import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';

import { useStore } from '@/store';

import { UndoShortcuts } from './router';

/** Trần chờ rộng rãi cho lượt tải chunk `LazyGlobalShortcutHelp` dưới tải cao. */
const ASYNC_TIMEOUT_MS = 5000;

afterEach(() => {
  cleanup();
  useStore.getState().closeDialog();
});

const pressHelp = (): void => {
  fireEvent.keyDown(document.body, { key: '?', shiftKey: true });
};

const pressEscape = (): void => {
  fireEvent.keyDown(document.body, { key: 'Escape' });
};

const findHelpDialog = (): Promise<HTMLElement> =>
  screen.findByRole('dialog', { name: 'Phím tắt' }, { timeout: ASYNC_TIMEOUT_MS });

describe('[UndoShortcuts] phím ?', () => {
  it('mở bảng phím tắt, đọc từ chính registry đang chạy', async () => {
    render(
      <UndoShortcuts>
        <div>nội dung màn</div>
      </UndoShortcuts>,
    );

    expect(screen.queryByRole('dialog', { name: 'Phím tắt' })).not.toBeInTheDocument();

    pressHelp();

    expect(await findHelpDialog()).toBeInTheDocument();
    expect(screen.getByText('hoàn tác thao tác gần nhất')).toBeInTheDocument();
  });

  it('gõ ? lần hai trong lúc bảng đang mở thì đóng lại', async () => {
    render(
      <UndoShortcuts>
        <div>nội dung màn</div>
      </UndoShortcuts>,
    );

    pressHelp();
    await findHelpDialog();

    pressHelp();

    await waitFor(
      () => {
        expect(screen.queryByRole('dialog', { name: 'Phím tắt' })).not.toBeInTheDocument();
      },
      { timeout: ASYNC_TIMEOUT_MS },
    );
  });
});

describe('[UndoShortcuts] Escape ở tầng vỏ', () => {
  it('đóng bảng phím tắt trước, không chạm uiSlice.openDialog', async () => {
    useStore.getState().showDialog('createProject');

    render(
      <UndoShortcuts>
        <div>nội dung màn</div>
      </UndoShortcuts>,
    );

    pressHelp();
    await findHelpDialog();

    pressEscape();

    await waitFor(
      () => {
        expect(screen.queryByRole('dialog', { name: 'Phím tắt' })).not.toBeInTheDocument();
      },
      { timeout: ASYNC_TIMEOUT_MS },
    );
    // Bảng tự đóng bằng binding phạm vi 'dialog' của chính nó — SCOPE_PRIORITY
    // không để Escape rơi xuống 'global', nên closeTopLayer/closeDialog() không
    // chạy và 'openDialog' giữ nguyên giá trị đã đặt trước đó.
    expect(useStore.getState().openDialog).toBe('createProject');
  });

  it('gọi uiSlice.closeDialog() khi không lớp nào bên trên nhận Escape', () => {
    useStore.getState().showDialog('createProject');

    render(
      <UndoShortcuts>
        <div>nội dung màn</div>
      </UndoShortcuts>,
    );

    expect(useStore.getState().openDialog).toBe('createProject');

    pressEscape();

    expect(useStore.getState().openDialog).toBeNull();
  });
});
