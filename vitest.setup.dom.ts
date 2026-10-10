/**
 * Phần chuẩn bị CHỈ dành cho test chạy trong DOM.
 *
 * File này tách khỏi `vitest.setup.ts` để test thuần — `src/domain/**`, và mọi
 * module trong `src/lib` không chạm DOM — không phải trả giá cho nó. Số đo trên
 * `src/domain` (1.148 bài, 36 file) trước khi tách:
 *
 *     tests 2,09 s  ·  environment 34,15 s  ·  setup 26,20 s
 *
 * Tức **60 giây dựng jsdom và nạp React để chạy 2 giây phép kiểm**. Ba thứ dưới
 * đây — bộ so khớp của `jest-dom`, trần `waitFor` của testing-library, và bản vá
 * `window.scrollTo` — đều vô nghĩa với một hàm hình học thuần.
 *
 * `vitest.setup.ts` nạp file này bằng `import()` có điều kiện, nên với môi
 * trường `node` nó không được nạp chút nào.
 *
 * ## Vì sao phần store nằm trong `beforeAll` chứ không ở tầng module
 *
 * Lượt tách trên chỉ cứu `src/domain`; 335 tệp jsdom còn lại vẫn trả ~1,0–1,1 s
 * setup mỗi tệp, và phần lớn hoá đơn đó là hai dòng `import` KHÔNG liên quan gì
 * tới một tệp không render: `@/lib/testing/render` (kéo `@tanstack/react-query`,
 * `i18next` và 207 KB `src/i18n/vi.json`) và `@/store` (kéo mười slice cùng cả
 * `src/domain`). Một bài kiểm `src/api` hay `src/lib/upload` trả đủ giá ấy để
 * không dùng một dòng nào.
 *
 * Nên việc nối hai thứ đó lại dời xuống `beforeAll` và chỉ chạy khi tệp đang
 * chạy ĐÃ nạp bộ dựng — dấu hiệu là `HARNESS_LOADED_FLAG` mà `render.tsx` đặt
 * lúc module nó được tính. `beforeAll` chạy sau khi tệp test được collect (mọi
 * `import` tĩnh của nó đã xong) và trước bài đầu tiên, nên dấu hiệu đã đúng và
 * `await import(...)` chỉ là một lượt tra bộ nhớ đệm — không phải một lượt nạp
 * thứ hai. Tệp không render thì không chạm tới cả hai.
 */

import '@testing-library/jest-dom/vitest';

import { createRequire } from 'node:module';
import { dirname } from 'node:path';

import { configure } from '@testing-library/react';

/**
 * Trần của `waitFor`/`findBy*`: 10 s thay cho 1 s mặc định.
 *
 * Hai thứ ăn vào một giây ấy khi cả bộ chạy song song: nhịp render của cả màn
 * chậm ×4–5, và chunk `lazy(() => import(...))` được biên dịch lần đầu NGAY
 * TRONG bài (luồng chính của vitest biên dịch hộ mọi worker, nên nó xếp hàng).
 * Đo 2026-10-09: hộp thoại lazy của `FloorLayerSaveBanner` không kịp hiện trong
 * 5 s dù bài kéo dài 10 s. Các tệp đã tự vá bằng trần riêng (3 s, 5 s) — chính
 * những trần ấy là chỗ đỏ tiếp theo. `waitFor` trả về ngay khi điều kiện đúng,
 * nên bài xanh không chậm thêm; chỉ bài đỏ thật báo muộn hơn, và vẫn trước trần
 * 30 s của cả bài (`vitest.config.ts`), để lỗi là "Unable to find…" có nghĩa
 * chứ không phải "Test timed out".
 *
 * Nó ở tầng module, không trong `beforeAll` như phần store: 16 tệp dùng
 * `waitFor`/`findBy*` của testing-library mà KHÔNG qua `renderWithProviders`,
 * nên gắn trần này sau dấu hiệu của bộ dựng là đẩy đúng 16 tệp ấy về trần 1 s.
 */
configure({ asyncUtilTimeout: 10_000 });

/**
 * Chu kỳ hỏi lại của `waitFor`/`findBy*`: 50 ms → 5 ms, đặt MỘT chỗ.
 *
 * `@testing-library/dom@10` chôn `interval = 50` trong phần phá cấu trúc tham
 * số của `waitFor` (`dist/wait-for.js:19`) và KHÔNG đưa nó ra `configure()` —
 * chỉ `asyncUtilTimeout` có mặt ở đó. Hệ quả đo được 2026-10-10: `waitFor` chờ
 * một điều kiện KHÔNG phải DOM (`expect(mock).toHaveBeenCalled()`, một ô trong
 * store) không có `MutationObserver` nào đánh thức, nên nó ngủ trọn một nhịp —
 * probe đo **68 ms** cho một điều kiện đúng ngay sau một macrotask, trong khi
 * `findByText` của cùng probe (có mutation thật) chỉ mất 19 ms. Trên cả bộ:
 * 1.829 lượt gọi, 130 s CPU, p50 = 50,2 ms = đúng con số bị chôn.
 *
 * Vá bằng cách ghi lại `exports.waitFor` của chính module CJS ấy, không phải
 * `vi.mock`: `findBy*` không gọi bản xuất ở biên gói mà gọi
 * `(0, _waitFor.waitFor)(…)` từ `dist/query-helpers.js:86` — một lượt tra thuộc
 * tính trên đúng object `exports` này lúc gọi. Ghi một thuộc tính nên che được
 * cả `waitFor` lẫn toàn bộ `findBy*` bằng một dòng; `vi.mock` ở biên gói chỉ
 * che được cái thứ nhất.
 *
 * `interval` do nơi gọi truyền vào vẫn thắng (`...options` đặt sau), và
 * `timeout` không bị chạm. Rẻ hơn mà không đổi ý nghĩa: `waitFor` vẫn trả về
 * ngay lần đầu điều kiện đúng — chỉ là nó hỏi lại sớm hơn.
 */
const WAIT_FOR_INTERVAL_MS = 5;
{
  const requireFrom = createRequire(import.meta.url);
  // `@testing-library/dom` là phụ thuộc của `react`, không nằm ở gốc
  // `node_modules` (pnpm không hoisting), nên giải đường từ chỗ `react` ở.
  const waitForModule = requireFrom(
    requireFrom.resolve('@testing-library/dom/dist/wait-for.js', {
      paths: [dirname(requireFrom.resolve('@testing-library/react'))],
    }),
  ) as { waitFor: (callback: unknown, options?: Record<string, unknown>) => unknown };

  const original = waitForModule.waitFor;
  waitForModule.waitFor = (callback, options) =>
    original(callback, { interval: WAIT_FOR_INTERVAL_MS, ...options });
}

/**
 * `window.scrollTo`, which jsdom declares and does not implement.
 *
 * `framer-motion` measures a row's real height before collapsing it to zero —
 * it has to, because `height: auto` cannot be interpolated — and that
 * measurement saves and restores the scroll position through `window.scrollTo`.
 * Left alone, every disappearing row prints a `Not implemented: window.scrollTo`
 * stack, and a suite that is green but noisy is a suite whose next real warning
 * nobody reads.
 *
 * It lives here rather than in one test file because any test that collapses a
 * motion element hits it — `SessionsSection.test.tsx` was only the first.
 */
window.scrollTo = () => undefined;

/**
 * Dấu hiệu `src/lib/testing/render.tsx` đặt lên `globalThis` lúc được nạp.
 *
 * Chuỗi được viết lại ở đây thay vì `import` từ đó, vì `import` chính là thứ
 * khối này tồn tại để tránh. `render.tsx` khai cùng tên ngay cạnh lời giải thích.
 */
const HARNESS_LOADED_FLAG = '__appfrontTestHarnessLoaded';

/**
 * Hand the test harness the application store, once per tệp có render.
 *
 * `src/lib/**` may not import `src/store/**` — mục 0.4 — so `renderWithProviders`
 * takes the store rather than reaching for it. This is the one place that
 * knows both, and it runs before any test, which is what keeps a screen test
 * down to a single line.
 *
 * The snapshot is taken here, before the first test, so "initial state" still
 * means the state the application boots with rather than whatever the first
 * test happened to leave behind — `src/store/__tests__/harnessReset.test.tsx`
 * đọc đúng hai giá trị khởi động ấy lúc collect và khẳng định chúng khớp. Undo
 * history is cleared alongside it.
 */
beforeAll(async () => {
  if ((globalThis as Record<string, unknown>)[HARNESS_LOADED_FLAG] !== true) {
    return;
  }

  const [{ configureTestProviders, createStoreReset }, { useStore }] = await Promise.all([
    import('@/lib/testing/render'),
    import('@/store'),
  ]);

  configureTestProviders({ resetStore: createStoreReset(useStore) });
});
