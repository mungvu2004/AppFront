import { expect, test } from '@playwright/test';
import type { Page } from '@playwright/test';

import { ROUTE_PATTERNS } from '../src/routes/paths';

/**
 * Màn `PascalViewer` — mắt xích DUY NHẤT của cả đợt tích hợp Pascal chưa được
 * chứng minh bằng trình duyệt thật: đăng nhập → vào route sau cờ → màn dựng
 * ra một cảnh 3D thật, không lệch CSP.
 *
 * ## Bài này chứng minh gì
 *
 * 1. Cờ `scene.pascal-viewer` **tắt** (mặc định, `lib/telemetry/flags.ts:159`)
 *    thì màn nói "chưa bật" chứ không hiện khung Pascal nào — cổng của A11.
 * 2. Cờ **bật** thì hộp `[data-testid="pascal-canvas"]` xuất hiện.
 * 3. Bên trong hộp ấy có một `<canvas>` THẬT — không phải hộp trống — với
 *    kích thước thật (`width`/`height` > 0). Đây là bằng chứng quan trọng
 *    nhất của cả tệp: 41 bài kiểm đơn vị của màn này (`docs/pascal/05-dung-man-pascal.md`
 *    mục 7) chạy trên jsdom, KHÔNG có WebGL, nên không bài nào trong số đó
 *    từng thấy một khung hình thật — bài này là bài ĐẦU TIÊN thấy.
 * 4. Suốt lượt đăng nhập + dựng cảnh, không một request nào rời khỏi máy —
 *    đặc biệt không có `editor.pascal.app` (CDN mặc định của Pascal) hay
 *    `cdn.jsdelivr.net`. Hai vi phạm CSP này đã đóng ở commit `d14e380`
 *    (`vite.config.ts` ép `NEXT_PUBLIC_ASSETS_CDN_URL` về `/pascal` rỗng tại
 *    build time); bài này là hàng rào giữ chúng đóng.
 * 5. `Esc` thu khung xem lại — lời hứa A12 "Esc đóng lớp trên cùng": khung
 *    Pascal là lớp trên cùng của màn này, và tắt nó không phá phần còn lại
 *    của màn (`<section aria-label="mô hình 3d">` vẫn còn).
 *
 * ## Bài này KHÔNG chứng minh được gì
 *
 * - **Không kiểm chất lượng hình** — không so khớp ảnh, không biết tường có
 *   đúng vị trí, vật liệu có đúng màu, hay đồ đạc có đúng chỗ. Canvas có
 *   điểm ảnh không phải là canvas có điểm ảnh ĐÚNG.
 * - **Không kiểm hiệu năng.** `lib/telemetry/flags.ts:163` ghi Pascal tốn
 *   "khoảng 1,6 lần CPU luồng chính" so với màn cũ — con số đó không được đo
 *   lại ở đây, và không hạn chờ nào trong bài này là một phép đo nhịp khung.
 * - **Không đi qua hai trạng thái lỗi** `PASCAL-01`/`PASCAL-02`
 *   (`pascalViewerTypes.ts:39-43`): tạo ra chúng cần một gói vách ngăn cố ý
 *   hỏng hoặc một `onFatal` giả — việc của bài kiểm đơn vị
 *   (`usePascalViewer.test.tsx`), không phải của trình duyệt thật.
 * - **Không phân biệt `success` với `partial`.** Cả hai đều dựng hộp canvas;
 *   bài này không đọc bảng `<dl>` số đo hay danh sách "chưa chuyển sang được"
 *   để biết đang ở nhánh nào — chỉ cần MỘT trong hai để có bằng chứng "dựng
 *   được cảnh thật".
 * - **Không kiểm `empty`/`error`/`R`/`E`.** Bảy trạng thái của A11 có bảy
 *   nguyên nhân (`docs/pascal/05-dung-man-pascal.md` mục 5); bài này chỉ đi
 *   qua ba — `forbidden`, `success`/`partial`, `collapsed` — vì ba nguyên
 *   nhân còn lại (dữ liệu rỗng thật, gói vách ngăn hỏng thật) không dựng lại
 *   được chỉ bằng thao tác trình duyệt trên bộ mẫu.
 *
 * ## Vách ngăn phải được dựng TRƯỚC khi chạy bài này
 *
 * `scripts/run-playwright.mjs` khởi máy chủ bằng `pnpm exec vite` THẲNG,
 * KHÔNG qua script `dev` (`package.json:7`, `"dev": "pnpm pascal && vite"`) —
 * tức nó không tự chạy `pnpm pascal`. Nếu `public/assets/pascal/pascal-mount.js`
 * chưa tồn tại (phải tự chạy `pnpm pascal`, `pnpm dev` hoặc `pnpm build` ít
 * nhất một lần trước — cả ba thư mục kết quả đều gitignore, xem
 * `docs/pascal/05-dung-man-pascal.md` mục 3), bài "Việc 2+3+4" dưới đây rơi
 * vào trạng thái `error` (`PASCAL-01`) chứ không phải `success`/`partial`, và
 * sẽ đỏ ở đúng chỗ hộp canvas không xuất hiện — đó là tín hiệu đúng, không
 * phải bài kiểm sai.
 */

/** Dự án nào cũng được: màn đọc bộ mẫu cố định, không đọc mã dự án. */
const PROJECT_ID = 'P-01';

/** Đường dẫn thật của màn, dựng từ hằng của `src/routes/paths.ts`. */
const PASCAL_VIEWER_PATH = ROUTE_PATTERNS.projectViewerPascal.replace(':projectId', PROJECT_ID);

/** Khoá `localStorage` giữ cờ tính năng — `FEATURE_FLAG_STORAGE_KEY`, `lib/telemetry/flags.ts:487`. */
const FEATURE_FLAG_STORAGE_KEY = 'appfront-feature-flags';

/** Cờ của màn này — `scene.pascal-viewer`, `lib/telemetry/flags.ts:157-165`, mặc định TẮT. */
const PASCAL_FLAG_KEY = 'scene.pascal-viewer';

/** Nhãn ba điều khiển của biểu mẫu đăng nhập — cùng chữ `src/i18n/vi.json` (`auth.fields`, `auth.actions`) giữ. */
const EMAIL_LABEL = 'Thư điện tử';
const PASSWORD_LABEL = 'Mật khẩu';
const SIGN_IN_LABEL = 'Đăng nhập';
const SIGN_IN_EMAIL = 'engineer@example.com';
const SIGN_IN_PASSWORD = 'matkhau-du-dai';

/** Tên khung ngoài cùng của màn — `<section aria-label="mô hình 3d">`, `PascalViewer.tsx:25`. */
const SCREEN_REGION_NAME = 'mô hình 3d';

/**
 * Pascal nặng ~1,5 MB gzip (`lib/telemetry/flags.ts:161`) và dựng cả trăm vật
 * liệu KTX2 (`docs/pascal/05-dung-man-pascal.md` mục 3: 293 tệp) — cho nó thời
 * gian rộng rãi thay vì hạn mặc định của Playwright.
 */
const PASCAL_RENDER_TIMEOUT_MS = 60_000;

/**
 * Sàn của kích thước ảnh PNG chụp canvas, byte.
 *
 * Không phải một con số tuỳ ý: nó phân biệt "có hình học" với "một màu trơn".
 * PNG nén theo hàng, nên một canvas đúng một màu — đúng thứ hiện ra khi cả cây
 * node bị bỏ trong im lặng — xuống cỡ vài trăm byte tới 2 KiB dù to bao nhiêu.
 * Số đo thật in ra ngay trong bài kiểm, nên lần sau ai sửa cũng thấy khoảng dư.
 * Đo 2026-09-29 trên Chromium, bộ mẫu chuẩn A14: **33 440 byte** khi chạy một
 * mình, **208 492 byte** khi chạy cả bộ song song (góc camera và thời điểm chụp
 * khác nhau). Sàn 8 000 nằm dưới cả hai từ 4,2 tới 26 lần — rộng có chủ đích,
 * vì nó chỉ cần phân biệt "có hình học" với "một màu trơn".
 *
 * **Phải CHỜ chứ không chụp một phát.** Cùng ngày, cùng máy, chạy 6 worker song
 * song: lượt chụp đơn ra **2 801 byte** — `onReadyChange` đã báo xong nhưng
 * khung hình thật chưa kịp lên, và bài đỏ vì một khoảnh khắc chứ không vì cảnh
 * rỗng. `expect.poll` chờ tới khi có hình, nên nó đo "cuối cùng CÓ hình học"
 * thay vì "đúng mili giây này có hình học".
 */
const PASCAL_FRAME_MIN_PNG_BYTES = 8_000;

/** Cho hai bài chạm tới cảnh thật đủ giờ: đăng nhập + dựng cảnh có thể vượt 30 s mặc định. */
const HEAVY_TEST_TIMEOUT_MS = 90_000;

/**
 * Bật cờ TRƯỚC KHI trang chạy dòng mã nào.
 *
 * `useFeatureFlag` đọc `localStorage` ngay ở lượt vẽ đầu tiên
 * (`ensureInitialised` → `loadOverridesFromStorage`, `lib/telemetry/flags.ts:672-679`),
 * nên đặt cờ sau `page.goto` là muộn — `addInitScript` chạy trước mọi script
 * của trang, kể cả ở những lượt điều hướng phía sau trong cùng một `page`.
 */
async function enablePascalFlag(page: Page): Promise<void> {
  await page.addInitScript(
    ({ storageKey, flagKey }) => {
      window.localStorage.setItem(storageKey, JSON.stringify({ [flagKey]: true }));
    },
    { storageKey: FEATURE_FLAG_STORAGE_KEY, flagKey: PASCAL_FLAG_KEY },
  );
}

/**
 * Đăng nhập qua biểu mẫu thật rồi để `?next=` tự đưa sang màn Pascal — cùng
 * đường `e2e/viewer3d.spec.ts` (`signInThenOpenViewer`) đã mở, chỉ đổi đích.
 * Route nằm sau `SessionBootstrap` (`docs/pascal/05-dung-man-pascal.md` mục 2:
 * "Cần đăng nhập"), nên không có bước này thì mọi `goto` đều rơi về `/login`.
 */
async function signInThenOpenPascalViewer(page: Page): Promise<void> {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto(`${ROUTE_PATTERNS.login}?next=${encodeURIComponent(PASCAL_VIEWER_PATH)}`);

  await page.getByLabel(EMAIL_LABEL).fill(SIGN_IN_EMAIL);
  await page.getByLabel(PASSWORD_LABEL, { exact: true }).fill(SIGN_IN_PASSWORD);
  await page.getByRole('button', { name: SIGN_IN_LABEL, exact: true }).click();

  /* Có mặt ở CẢ BẢY trạng thái — `Frame` bọc mọi nhánh (`PascalViewer.tsx:22-34`) —
     nên đây là điểm chờ đúng bất kể cờ đang bật hay tắt. */
  await expect(page.getByRole('region', { name: SCREEN_REGION_NAME })).toBeVisible();
}

/** Hai host coi là "trong máy": `baseURL` của `playwright.config.ts` là `127.0.0.1`. */
const LOCAL_HOSTS = new Set(['localhost', '127.0.0.1']);

/** Hai vi phạm CSP đã đóng ở `d14e380` — xem docblock đầu tệp. */
const FORBIDDEN_HOST_SUBSTRINGS = ['editor.pascal.app', 'cdn.jsdelivr.net'];

/** Mọi request của trang, thu từ trước lượt điều hướng đầu tiên. */
function trackRequestUrls(page: Page): readonly string[] {
  const urls: string[] = [];
  page.on('request', (request) => {
    urls.push(request.url());
  });

  return urls;
}

/**
 * Không request nào rời máy. Bỏ qua `data:`/`blob:` — `new URL` không phân
 * tích được các lược đồ ấy thành host, và chúng vốn không phải lượt ra mạng.
 */
function findOffMachineRequests(urls: readonly string[]): readonly string[] {
  return urls.filter((url) => {
    if (FORBIDDEN_HOST_SUBSTRINGS.some((needle) => url.includes(needle))) {
      return true;
    }

    try {
      const { hostname } = new URL(url);

      return hostname !== '' && !LOCAL_HOSTS.has(hostname);
    } catch {
      return false;
    }
  });
}

/* -------------------------------------------------------------------------- */
/* Bài.                                                                        */
/* -------------------------------------------------------------------------- */

test('cờ tắt: màn nói "chưa bật" chứ không dựng gì (forbidden, A11)', async ({ page }) => {
  // Không gọi enablePascalFlag: localStorage rỗng, cờ ở giá trị mặc định `false`.
  await signInThenOpenPascalViewer(page);

  await expect(
    page.getByRole('heading', { name: 'chưa bật cho tài khoản này', exact: true }),
  ).toBeVisible();
  await expect(page.getByRole('status')).toContainText('chưa bật');

  /* Bảng "cái gì gây trạng thái nào" (mục 5) nói forbidden KHÔNG chạy WebGL —
     hộp canvas không được phép có mặt. */
  await expect(page.getByTestId('pascal-canvas')).toHaveCount(0);
});

test('cờ bật: hộp Pascal dựng ra một cảnh thật, không request nào rời máy (việc 2+3+4)', async ({
  page,
}) => {
  test.setTimeout(HEAVY_TEST_TIMEOUT_MS);

  // Đăng ký TRƯỚC lượt goto đầu tiên để không bỏ lỡ request nào của cả chuỗi.
  const requestUrls = trackRequestUrls(page);

  await enablePascalFlag(page);
  await signInThenOpenPascalViewer(page);

  /* Việc 2 — hộp Pascal có mặt. */
  const canvasBox = page.getByTestId('pascal-canvas');
  await expect(canvasBox).toBeVisible({ timeout: PASCAL_RENDER_TIMEOUT_MS });

  /* Việc 3 — cảnh dựng ra hình THẬT. `data-testid="pascal-canvas"` chỉ render ở
     nhánh success/partial (`PascalViewer.tsx:112-160`), tức `ready` đã lên
     `true` qua `onReadyChange` thật của gói Pascal — không phải một hộp trống
     đang chờ. Bằng chứng cụ thể: một <canvas> thật, kích thước thật (>0) cả ở
     khung nhìn (bounding box) lẫn ở vùng đệm vẽ (width/height của chính nó). */
  const canvasEl = canvasBox.locator('canvas');
  await expect(canvasEl).toHaveCount(1, { timeout: PASCAL_RENDER_TIMEOUT_MS });

  const box = await canvasEl.boundingBox();
  expect(box).not.toBeNull();
  expect(box!.width).toBeGreaterThan(0);
  expect(box!.height).toBeGreaterThan(0);

  const drawBuffer = await canvasEl.evaluate((element) => {
    const canvas = element as HTMLCanvasElement;

    return { width: canvas.width, height: canvas.height };
  });
  expect(drawBuffer.width).toBeGreaterThan(0);
  expect(drawBuffer.height).toBeGreaterThan(0);

  /* Việc 3b — trên khung hình có HÌNH HỌC, không phải một mảng trời trơn.
     Một canvas một màu nén PNG xuống cỡ vài trăm byte đến 2 KiB, vì PNG đi
     theo hàng và mọi hàng giống nhau. Cảnh thật có tường, sàn, đồ đạc và bóng
     đổ nên nó không nén được như thế. Ngưỡng dưới đặt dưới số đo thật khá xa
     (đo 2026-09-29, xem dòng log ngay dưới) để nó không đỏ vì một lượt đổi
     màu nền hay một góc camera khác. */
  await expect
    .poll(async () => (await canvasEl.screenshot()).length, {
      timeout: PASCAL_RENDER_TIMEOUT_MS,
      message: 'khung hình Pascal vẫn nén xuống như một mảng màu trơn',
    })
    .toBeGreaterThan(PASCAL_FRAME_MIN_PNG_BYTES);

  console.log(`[đo] ảnh canvas Pascal: ${(await canvasEl.screenshot()).length} byte PNG`);

  /* Việc 3c — KHÔNG node nào bị store Pascal dọn đi. Nó dọn node mồ côi và
     node không với tới được từ gốc, trong im lặng; màn hình nay nói ra điều đó
     thành một dòng "phần mô hình". Dòng ấy vắng mặt nghĩa là cả cảnh — kể cả
     mỗi tấm sàn của mỗi phòng — sống trọn vào store. */
  await expect(page.getByText('phần mô hình')).toHaveCount(0);

  /* Việc 4 — suốt đăng nhập + dựng cảnh, không lượt nào rời máy. Đặc biệt
     không `editor.pascal.app` (CDN mặc định của Pascal) hay `cdn.jsdelivr.net`. */
  expect(findOffMachineRequests(requestUrls)).toEqual([]);
});

test('Esc thu khung xem lại, phần còn lại của màn vẫn nguyên (A12, việc 5)', async ({ page }) => {
  test.setTimeout(HEAVY_TEST_TIMEOUT_MS);

  await enablePascalFlag(page);
  await signInThenOpenPascalViewer(page);

  const canvasBox = page.getByTestId('pascal-canvas');
  await expect(canvasBox).toBeVisible({ timeout: PASCAL_RENDER_TIMEOUT_MS });

  await page.keyboard.press('Escape');

  /* Lớp trên cùng — khung Pascal — đóng: hộp canvas biến mất, màn nói đang
     thu gọn (`usePascalViewer.ts:188-197`, `PASCAL_VIEWER_CAPTIONS.collapsed`). */
  await expect(canvasBox).toHaveCount(0);
  await expect(
    page.getByRole('heading', { name: 'khung xem đang thu gọn', exact: true }),
  ).toBeVisible();
  await expect(page.getByRole('status')).toContainText('thu gọn');

  /* Và đó là lớp DUY NHẤT đóng — phần còn lại của màn vẫn còn nguyên. */
  await expect(page.getByRole('region', { name: SCREEN_REGION_NAME })).toBeVisible();
});
