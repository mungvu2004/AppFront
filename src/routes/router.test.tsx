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
import { createMemoryRouter, RouterProvider } from 'react-router-dom';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { useStore } from '@/store';

import { PUBLIC_ROUTE_PATTERNS, ROUTE_PATTERNS, ROUTES } from './paths';
import { routes, UndoShortcuts } from './router';

/**
 * Trần chờ cho lượt tải chunk `LazyGlobalShortcutHelp` dưới tải cao.
 *
 * Con số cũ là 5 000 — **đúng bằng hạn mặc định của cả bài kiểm**, nên hai trần
 * hết hạn cùng lúc và bài không bao giờ có cơ hội chờ đủ. Đo ngày 2026-09-28
 * trên bộ toàn bài: **đỏ 3 / 5 lượt** khi chạy cả bộ, **đạt 4/4 mọi lượt** khi
 * chạy riêng tệp này (2,70 s). Lỗi luôn là `Unable to find role="dialog"`, tức
 * `findByRole` tiêu hết trần của chính nó — lượt tải chunk chậm hơn 5 giây dưới
 * tải, đúng như khối chú thích đầu tệp đã lường trước.
 *
 * Nâng trần chờ **không** nới cổng chất lượng nào: mọi khẳng định giữ nguyên
 * từng dòng, chỉ chỗ đợi rộng ra. Cùng cách xử lý đã dùng ở
 * `screens/export/ShareDialog/ShareDialog.test.tsx:144`, và cùng lý do: phạm vi
 * một tệp, không đụng `vitest.config.ts` — tệp ấy là cổng chung.
 */
const ASYNC_TIMEOUT_MS = 15_000;

vi.setConfig({ testTimeout: 20_000 });

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
    expect(screen.getByText('Hoàn tác thao tác gần nhất')).toBeInTheDocument();
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

describe('[router] vỏ chờ lúc chunk màn còn trên đường (B-G-04)', () => {
  it('nói "Đang tải màn hình" bằng tiếng Việt, không còn chữ "Loading..."', () => {
    /* `/login` là route công khai nên `SessionGate` cho qua ngay, và thứ đầu tiên
       vẽ ra là đúng fallback của `suspended` — chunk màn chưa kịp về. */
    const memoryRouter = createMemoryRouter(routes, { initialEntries: [ROUTES.login] });

    render(<RouterProvider router={memoryRouter} />);

    expect(screen.getByRole('status', { name: 'Đang tải màn hình' })).toHaveAttribute(
      'aria-busy',
      'true',
    );
    expect(screen.queryByText('Loading...')).not.toBeInTheDocument();
  });
});

describe('[router] đường vào của đăng nhập, lời mời và đặt lại mật khẩu (F-09a)', () => {
  const childPaths = (routes[0]?.children ?? []).map((child) => child.path);

  it('có route nhận lời mời và đặt lại mật khẩu', () => {
    expect(childPaths).toContain(ROUTE_PATTERNS.invitationAccept);
    expect(childPaths).toContain(ROUTE_PATTERNS.passwordReset);
    expect(ROUTES.invitationAccept).toBe('/login/invitation');
    expect(ROUTES.passwordReset).toBe('/login/reset-password');
  });

  it('không còn route /billing', () => {
    expect(childPaths).not.toContain('/billing');
    expect('billing' in ROUTE_PATTERNS).toBe(false);
    expect('billing' in ROUTES).toBe(false);
  });

  it('hai đường mới nằm trong bảng đường công khai, nên người chưa đăng nhập không bị đá về /login', () => {
    expect(PUBLIC_ROUTE_PATTERNS).toContain(`${ROUTE_PATTERNS.invitationAccept}/*`);
    expect(PUBLIC_ROUTE_PATTERNS).toContain(`${ROUTE_PATTERNS.passwordReset}/*`);
  });
});
