import { expect, test } from '@playwright/test';
import type { Page, Route } from '@playwright/test';

import { enableFlags } from './fixtures/flags';
import { ROUTE_PATTERNS } from './fixtures/routes';

/**
 * Màn `PascalViewer` — mắt xích DUY NHẤT của cả đợt tích hợp Pascal chưa được
 * chứng minh bằng trình duyệt thật: đăng nhập → vào route sau cờ → màn dựng
 * ra một cảnh 3D thật, không lệch CSP.
 *
 * ## Bài này chứng minh gì
 *
 * 1. Cờ `scene.pascal-viewer` **tắt** (mặc định, `lib/telemetry/flags.ts:159`)
 *    thì màn nói "chưa bật" chứ không hiện khung Pascal nào — cổng của A11.
 * 2. Cờ **bật** thì hộp `[data-testid="pascal-canvas"]` xuất hiện và màn nói
 *    "đã dựng xong".
 * 3. Bên trong hộp ấy có một `<canvas>` THẬT — không phải hộp trống — với
 *    kích thước thật (`width`/`height` > 0). Đây là bằng chứng quan trọng
 *    nhất của cả tệp: 33 bài kiểm đơn vị của màn này (ba tệp cạnh
 *    `PascalViewer.tsx`; đặc tả cũ ghi 41) chạy trên jsdom, KHÔNG có WebGL, nên
 *    không bài nào trong số đó từng thấy một khung hình thật.
 * 4. Suốt lượt đăng nhập + dựng cảnh, không một request nào rời khỏi máy —
 *    đặc biệt không có `editor.pascal.app` (CDN mặc định của Pascal) hay
 *    `cdn.jsdelivr.net`. Hai vi phạm CSP này đã đóng ở commit `d14e380`
 *    (`vite.config.ts` ép `NEXT_PUBLIC_ASSETS_CDN_URL` về `/pascal` rỗng tại
 *    build time); bài này là hàng rào giữ chúng đóng.
 * 5. `Esc` đóng ĐÚNG MỘT lớp: bảng phím tắt trước, khung Pascal sau — lời hứa
 *    A12 "Esc đóng lớp trên cùng" giữa hai phạm vi phím (`dialog` › `canvas`),
 *    kể cả khi gói còn đang nạp; `E` và nút "mở khung xem" mở lại.
 * 6. Hộp chỉ chứa khung dựng — 0 nút/tab/hộp thoại/ô nhập: hàng rào H-1 của
 *    nhóm V11 (trình soạn thảo Pascal chưa được gắn ở đâu).
 * 7. Cờ tắt: không một request nào tới `/assets/pascal/` (A-2).
 * 8. `PASCAL-01` dựng lại được bằng `page.route` chặn đúng tệp gói (404 và
 *    nền SPA `text/html`), và "thử lại"/`R` nạp lại THẬT khi gói trở lại.
 * 9. Khung dựng chiếm quá nửa cửa sổ 1440×900.
 *
 * Bốn bài cuối tái hiện lỗi `B-V10-01…04` (`docs/notes/e2e/fragments/W08.md`).
 *
 * ## Bài này KHÔNG chứng minh được gì
 *
 * - **Không kiểm chất lượng hình** — không so khớp ảnh, không biết tường có
 *   đúng vị trí, vật liệu có đúng màu, hay đồ đạc có đúng chỗ. Canvas có
 *   điểm ảnh không phải là canvas có điểm ảnh ĐÚNG.
 * - **Không kiểm hiệu năng.** `lib/telemetry/flags.ts:163` ghi Pascal tốn
 *   "khoảng 1,6 lần CPU luồng chính" so với màn cũ — con số đó không được đo
 *   lại ở đây, và không hạn chờ nào trong bài này là một phép đo nhịp khung.
 * - **Không đi qua `PASCAL-02`/`PASCAL-03`, `empty`, `partial`.** `PASCAL-02`
 *   đến từ `onFatal` ở gốc React thứ hai; `PASCAL-03` cần máy không GPU; bộ mẫu
 *   của màn luôn đầy và không node nào bị dọn. Cả bốn thuộc tầng đơn vị
 *   (`usePascalViewer.test.tsx`, `PascalViewer.test.tsx`).
 * - **Không khẳng định con số nào** trong bảng `tầng · tường · ô mở · phòng`
 *   (`questions.md` Q4 = B: bộ mẫu của màn khác bộ A14, gộp là việc riêng).
 * - **Không kiểm CSP.** Máy chủ dev không gửi header CSP và chính sách thật
 *   nằm ở BE (`AppBack/deploy/nginx/snippets/security_headers.conf:6`), không
 *   trong repo này (Q5 = B). Vi phạm `script-src eval` duy nhất (zod 4 dò
 *   `new Function`) đã gỡ ở mã: `defaultLoadMount` bật `jitless` trước khi thêm
 *   thẻ script (B-V10-05); bài đơn vị giữ nó ở `usePascalViewer.test.tsx`.
 *
 * ## Vách ngăn
 *
 * `pnpm e2e` tự dựng `public/assets/pascal` trước khi chạy, trừ khi đặt
 * `E2E_SKIP_PASCAL=1` (`scripts/run-playwright.mjs:107-133`). Thiếu
 * `pascal-mount.js` thì mọi bài "cờ bật" rơi `PASCAL-01` — tín hiệu đúng, không
 * phải bài kiểm sai.
 */

/** Dự án nào cũng được: màn đọc bộ mẫu cố định, không đọc mã dự án. */
const PROJECT_ID = 'P-01';

/** Đường dẫn thật của màn, dựng từ hằng của `src/routes/paths.ts`. */
const PASCAL_VIEWER_PATH = ROUTE_PATTERNS.projectViewerPascal.replace(':projectId', PROJECT_ID);

/** Cờ của màn này — `scene.pascal-viewer`, `lib/telemetry/flags.ts:157-165`, mặc định TẮT. */
const PASCAL_FLAG_KEY = 'scene.pascal-viewer';

/** Nhãn ba điều khiển của biểu mẫu đăng nhập — cùng chữ `src/i18n/vi.json` (`auth.fields`, `auth.actions`) giữ. */
const EMAIL_LABEL = 'thư điện tử';
const PASSWORD_LABEL = 'mật khẩu';
const SIGN_IN_LABEL = 'đăng nhập';
const SIGN_IN_EMAIL = 'engineer@example.com';
const SIGN_IN_PASSWORD = 'matkhau-du-dai';

/** Tên khung ngoài cùng của màn — `<section aria-label="mô hình 3d">`, `PascalViewer.tsx:25`. */
const SCREEN_REGION_NAME = 'mô hình 3d';

/** Khung nhìn của mọi bài — cùng cỡ các số đo trong tệp này. */
const VIEWPORT = { width: 1440, height: 900 } as const;

/** Chú thích trạng thái `success` — `PASCAL_VIEWER_CAPTIONS.success`, `pascalViewerTypes.ts:94`. */
const SUCCESS_CAPTION = 'đã dựng xong toàn bộ bản vẽ.';
const LOADING_CAPTION = 'đang nạp khung dựng hình…';
const COLLAPSED_HEADING = 'khung xem đang thu gọn';
const ERROR_HEADING = 'không nạp được khung dựng hình';

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
 * Đăng nhập qua biểu mẫu thật rồi để `?next=` tự đưa sang màn Pascal — cùng
 * đường `e2e/viewer3d.spec.ts` (`signInThenOpenViewer`) đã mở, chỉ đổi đích.
 * Route nằm sau `SessionBootstrap` (`docs/pascal/05-dung-man-pascal.md` mục 2:
 * "Cần đăng nhập"), nên không có bước này thì mọi `goto` đều rơi về `/login`.
 */
async function signInThenOpenPascalViewer(page: Page): Promise<void> {
  await page.setViewportSize(VIEWPORT);
  await page.goto(`${ROUTE_PATTERNS.login}?next=${encodeURIComponent(PASCAL_VIEWER_PATH)}`);

  await page.getByLabel(EMAIL_LABEL).fill(SIGN_IN_EMAIL);
  await page.getByLabel(PASSWORD_LABEL, { exact: true }).fill(SIGN_IN_PASSWORD);
  await page.getByRole('button', { name: SIGN_IN_LABEL, exact: true }).click();

  /* Có mặt ở CẢ BẢY trạng thái — `Frame` bọc mọi nhánh (`PascalViewer.tsx:22-34`) —
     nên đây là điểm chờ đúng bất kể cờ đang bật hay tắt. */
  await expect(page.getByRole('region', { name: SCREEN_REGION_NAME })).toBeVisible();
}

/**
 * Mở thẳng màn, không qua biểu mẫu đăng nhập.
 *
 * Đo 2026-10-03: `goto` thẳng vào route hạ cánh đúng màn — bộ mẫu cấp vai
 * `engineer` khi chưa ai đăng nhập (`MOCK_FALLBACK_ROLES`, xem docblock
 * `e2e/fixtures/session.ts`). Chỉ bài "cờ bật" giữ lượt đăng nhập, vì việc 4 của
 * nó nói về CẢ chuỗi đăng nhập + dựng cảnh.
 */
async function openPascalViewer(page: Page): Promise<void> {
  await page.setViewportSize(VIEWPORT);
  await page.goto(PASCAL_VIEWER_PATH);
  await expect(page.getByRole('region', { name: SCREEN_REGION_NAME })).toBeVisible({
    timeout: COLD_ROUTE_TIMEOUT_MS,
  });
}

/**
 * Lượt tải ĐẦU của một máy chủ dev vừa khởi: Vite dịch route lười của màn (và
 * cả chuỗi nhập của nó) theo yêu cầu. Đo 2026-10-03, `--repeat-each=2`: bài đầu
 * tiên của một worker đỏ ở hạn 5 s mặc định trong khi mọi lượt sau hiện ngay.
 * Bài "cờ bật" cũ không gặp vì nó đi qua biểu mẫu đăng nhập trước — lượt ấy
 * làm ấm máy chủ. Hạn này chỉ áp cho điểm chờ đầu tiên, không cho khẳng định nào.
 */
const COLD_ROUTE_TIMEOUT_MS = 30_000;

/** Đúng tệp gói vách ngăn — `MOUNT_URL`/`mountUrl`, `usePascalViewer.ts`. Có `*` cuối để khớp cả `?v=` và `?attempt=` (B-V10-41). */
const PASCAL_BUNDLE_GLOB = '**/assets/pascal/pascal-mount.js*';

/**
 * Giữ request gói vách ngăn lại cho tới khi bài thả.
 *
 * Đây là cách DUY NHẤT đứng yên được ở trạng thái `loading`: không giữ thì gói
 * về trong vài trăm mili giây và màn sang `success` trước khi bài kịp bấm gì —
 * bài sẽ xanh hay đỏ tuỳ máy nhanh chậm.
 */
async function holdPascalBundle(page: Page): Promise<() => void> {
  let release: () => void = () => undefined;
  const gate = new Promise<void>((resolve) => {
    release = resolve;
  });

  await page.route(PASCAL_BUNDLE_GLOB, async (route) => {
    await gate;
    await route.continue();
  });

  return release;
}

/** Bốn nhánh "không nạp được" tái hiện bằng mạng, không xoá tệp nào của repo. */
const BROKEN_BUNDLE = {
  /** Tệp chưa dựng (`pnpm pascal` chưa chạy) trên một máy chủ trả 404 thật. */
  notFound: { status: 404, body: '' },
  /**
   * Máy chủ dev rơi về `index.html` cho mọi đường dẫn lạ — mã 200, kiểu
   * `text/html`. Đây là thứ một máy dev thiếu tệp THẬT SỰ trả về.
   */
  spaFallback: { status: 200, contentType: 'text/html', body: '<html></html>' },
} as const;

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
 * Lượt gọi tài sản nào KHÔNG nhận về tài sản.
 *
 * Vì sao phép kiểm này không đo mã trạng thái, dù mã trạng thái là thứ ai cũng
 * nghĩ tới đầu tiên: **máy chủ dev trả 200 cho tệp không tồn tại.** Nó rơi về
 * `index.html` cho mọi đường dẫn không khớp, nên một tệp `.ktx2` thiếu về tới
 * trình duyệt dưới dạng một trang HTML mã 200, và Pascal nuốt lỗi phân tích
 * trong bộ nạp texture của nó. Đo ngày 2026-09-29: bốn lượt gọi
 * `woodplank_48_*_512.ktx2` đi qua đúng như thế — mặt sàn ra không vân, cảnh
 * vẫn dựng, bài vẫn xanh, và một cổng theo mã trạng thái **cũng vẫn xanh**.
 *
 * Nên dấu hiệu đúng là **kiểu nội dung**: một tài sản trả về `text/html` là một
 * tệp thiếu đang mặc áo trang chủ. Bản kê vật liệu của Pascal trỏ tới 249 tệp
 * `.ktx2` mà repo chỉ commit 62, nên đây là một lỗ có **187** chỗ rơi.
 */
/** Chỗ DUY NHẤT của AppFront được phép gắn `keydown`. */
const SHORTCUT_REGISTRY_PATH = 'lib/input/shortcutRegistry';

/**
 * Ghi lại MỌI lượt gắn `key*` lên `window`/`document`, kèm chỗ gọi.
 *
 * Vì sao cần một cổng chứ không phải một lượt đo: kế hoạch bản 2 (Bước 7, mục
 * 8) đòi một "cổng phím" tắt hẳn phần nghe phím của Pascal, vì A12 nói **Esc
 * đóng lớp trên cùng** là lời hứa không tính năng nào được lấy mất — hai sổ
 * phím cùng nghe thì lời hứa ấy vỡ theo cách rất khó dựng lại.
 *
 * Đo ngày 2026-09-30 trên cảnh thật: **4 listener, cả 4 của
 * `shortcutRegistry.ts:202`, 0 của Pascal.** Không phải may: gói `viewer` chỉ
 * nghe phím sau `walkthroughMode`, mà mặc định của nó là `false`
 * (`viewer/src/store/use-viewer.ts:543`) và không nơi nào gọi
 * `setWalkthroughMode`; `GlbWalkthroughController` thì không được mount ở đâu
 * cả. Còn hàng loạt listener **pha capture** trong gói `nodes` nằm ở công cụ
 * sửa — màn chỉ-xem không dựng công cụ nào.
 *
 * Nên cổng phím CHƯA cần viết. Cổng này là thứ giữ cho câu ấy còn đúng: ngày
 * nào một công cụ của Pascal được mount, bài này đỏ và nói ra chỗ gắn.
 */
async function trackKeyListeners(page: Page): Promise<void> {
  await page.addInitScript(() => {
    const store: string[] = [];
    (window as unknown as { __keyListeners: string[] }).__keyListeners = store;

    for (const target of [window, document] as EventTarget[]) {
      const original = target.addEventListener.bind(target);

      target.addEventListener = ((type: string, fn: unknown, opts: unknown) => {
        if (type.startsWith('key')) {
          const frames = String(new Error().stack).split(String.fromCharCode(10));
          store.push(frames[2]?.trim() ?? 'không rõ chỗ gọi');
        }

        return original(type, fn as EventListener, opts as boolean);
      }) as typeof target.addEventListener;
    }
  });
}

/** Chỗ gọi của mọi lượt gắn phím đã ghi được. */
async function readKeyListeners(page: Page): Promise<readonly string[]> {
  return page.evaluate(
    () => (window as unknown as { __keyListeners?: string[] }).__keyListeners ?? [],
  );
}

function trackBadAssetResponses(page: Page): readonly string[] {
  const bad: string[] = [];
  const isAsset = (url: string): boolean => {
    const path = new URL(url).pathname;

    return path.startsWith('/pascal/') || path.startsWith('/basis/') || path.startsWith('/assets/');
  };

  page.on('requestfailed', (request) => {
    if (isAsset(request.url())) {
      bad.push(`hỏng ${new URL(request.url()).pathname} — ${request.failure()?.errorText ?? '?'}`);
    }
  });
  page.on('response', (response) => {
    if (!isAsset(response.url())) return;

    const path = new URL(response.url()).pathname;
    const status = response.status();

    if (status < 200 || status >= 300) {
      bad.push(`${String(status)} ${path}`);

      return;
    }

    const type = response.headers()['content-type'] ?? '';

    // `.js` và `.css` của vách ngăn ĐÚNG là mã; chỉ tài sản nhị phân mới không
    // bao giờ được là HTML.
    if (type.includes('text/html') && !path.endsWith('.js') && !path.endsWith('.css')) {
      bad.push(`${path} trả về text/html — tệp không tồn tại`);
    }
  });

  return bad;
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
  // Không bật cờ: localStorage rỗng, cờ ở giá trị mặc định `false`.
  const requestUrls = trackRequestUrls(page);

  await openPascalViewer(page);

  await expect(
    page.getByRole('heading', { name: 'chưa bật cho tài khoản này', exact: true }),
  ).toBeVisible();
  await expect(page.getByRole('status')).toContainText('chưa bật');

  /* Bảng "cái gì gây trạng thái nào" (mục 5) nói forbidden KHÔNG chạy WebGL —
     hộp canvas không được phép có mặt. */
  await expect(page.getByTestId('pascal-canvas')).toHaveCount(0);

  /* A-2 — và không một byte nào của gói nặng (~1,5 MB gzip, `flags.ts:161`) rời
     máy chủ. Đơn vị chỉ chứng minh điều này trên bộ nạp giả. Chờ mạng LẮNG
     (trạng thái dương) rồi mới đếm, để "không có request" không phải "chưa kịp có". */
  await page.waitForLoadState('networkidle');
  expect(requestUrls.filter((url) => url.includes('/assets/pascal/'))).toEqual([]);

  /* B-V10-03 — bộ đổi dữ liệu cũng không chạy: cờ tắt thì đổi bản vẽ sang cảnh
     Pascal là việc không ai dùng. `/src/lib/pascal/` là đường của máy chủ DEV
     (bản dựng băm tên chunk) — `pnpm e2e` luôn chạy trên dev. */
  expect(requestUrls.filter((url) => url.includes('/src/lib/pascal/'))).toEqual([]);
});

test('cờ bật: hộp Pascal dựng ra một cảnh thật, không request nào rời máy (việc 2+3+4)', async ({
  page,
}) => {
  test.setTimeout(HEAVY_TEST_TIMEOUT_MS);

  // Đăng ký TRƯỚC lượt goto đầu tiên để không bỏ lỡ request nào của cả chuỗi.
  const requestUrls = trackRequestUrls(page);
  const badResponses = trackBadAssetResponses(page);

  await trackKeyListeners(page);

  await enableFlags(page, [PASCAL_FLAG_KEY]);
  await signInThenOpenPascalViewer(page);

  /* Việc 2 — hộp Pascal có mặt. */
  const canvasBox = page.getByTestId('pascal-canvas');
  await expect(canvasBox).toBeVisible({ timeout: PASCAL_RENDER_TIMEOUT_MS });

  /* Việc 3 — cảnh dựng ra hình THẬT. Hộp có cả ở `loading`
     (`PascalViewer.tsx:146`), nên chờ chú thích `success` — lúc `ready` đã lên
     `true` qua `onReadyChange` thật của gói Pascal. Bằng chứng cụ thể: một
     <canvas> thật, kích thước thật (>0) cả ở khung nhìn (bounding box) lẫn ở
     vùng đệm vẽ (width/height của chính nó). */
  await expect(page.getByRole('status')).toHaveText(SUCCESS_CAPTION, {
    timeout: PASCAL_RENDER_TIMEOUT_MS,
  });
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

  /* B-V10-41 — gói vách ngăn mang tên cố định mà `/assets/` gửi `immutable`: URL nạp
     phải mang mã băm nội dung (`vite.config.ts`), không thì bản cũ nằm lì sau triển khai. */
  expect(requestUrls).toContainEqual(expect.stringMatching(/\/assets\/pascal\/pascal-mount\.js\?v=[0-9a-f]{8}$/u));

  /* H-1 (V11) — hàng rào: hộp chỉ chứa khung dựng, KHÔNG chứa điều khiển nào của
     trình soạn thảo Pascal. Hôm nay AppFront chỉ dựng gói `viewer`
     (`PascalFrame.tsx`), không nơi nào nhập `@pascal-app/editor`; ngày ai đó gắn
     `Editor` vào hộp này, sidebar/hộp thoại tiếng Anh của fork (nợ A6,
     `docs/pascal/00-quyet-dinh.md`) hiện ra mà chưa có kế hoạch kiểm — đỏ ở đây
     là tín hiệu viết lại mục V11 của `docs/notes/e2e/plan.md`. Chỉ đếm bốn lớp
     vai tương tác; cố ý KHÔNG đếm `[role]` trần (một `role="img"` cho canvas
     không phải editor). Chạy SAU khi khung hình có hình học: trước đó hộp còn trống, xanh giả. */
  await expect(canvasBox.getByRole('button')).toHaveCount(0);
  await expect(canvasBox.getByRole('tab')).toHaveCount(0);
  await expect(canvasBox.getByRole('tablist')).toHaveCount(0);
  await expect(canvasBox.getByRole('dialog')).toHaveCount(0);
  await expect(canvasBox.getByRole('alertdialog')).toHaveCount(0);
  await expect(canvasBox.locator('input, select, textarea, a[href]')).toHaveCount(0);


  /* Việc 3c — KHÔNG node nào bị store Pascal dọn đi. Nó dọn node mồ côi và
     node không với tới được từ gốc, trong im lặng; màn hình nay nói ra điều đó
     thành một dòng "phần mô hình". Dòng ấy vắng mặt nghĩa là cả cảnh — kể cả
     mỗi tấm sàn của mỗi phòng — sống trọn vào store. */
  await expect(page.getByText('phần mô hình')).toHaveCount(0);

  /* Việc 3d — KHÔNG ai ngoài sổ phím tắt của AppFront được nghe phím (A12). */
  const keyListeners = await readKeyListeners(page);

  console.log(`[đo] listener phím: ${String(keyListeners.length)}`);
  expect(keyListeners.filter((origin) => !origin.includes(SHORTCUT_REGISTRY_PATH))).toEqual([]);

  /* Việc 4 — suốt đăng nhập + dựng cảnh, không lượt nào rời máy. Đặc biệt
     không `editor.pascal.app` (CDN mặc định của Pascal) hay `cdn.jsdelivr.net`. */
  expect(findOffMachineRequests(requestUrls)).toEqual([]);

  /* Việc 5 — và không lượt nào HỎNG. Tự host thì thiếu tệp là lỗi của mình, và
     nó không làm gì đổ: cảnh vẫn dựng, chỉ mất vân bề mặt. Xem
     {@link trackBadAssetResponses}. */
  expect(badResponses).toEqual([]);
});

test('Esc đóng bảng phím tắt trước, rồi mới thu khung xem; E mở lại (A12, việc 5)', async ({
  page,
}) => {
  test.setTimeout(HEAVY_TEST_TIMEOUT_MS);

  await enableFlags(page, [PASCAL_FLAG_KEY]);
  await openPascalViewer(page);

  const canvasBox = page.getByTestId('pascal-canvas');
  await expect(page.getByRole('status')).toHaveText(SUCCESS_CAPTION, {
    timeout: PASCAL_RENDER_TIMEOUT_MS,
  });

  /* B-4 — hai lớp, hai phạm vi phím: bảng phím tắt (`dialog`) nằm trên khung
     Pascal (`canvas`). Esc phải đóng ĐÚNG MỘT lớp — lớp trên cùng. */
  await page.keyboard.press('?');
  const shortcutHelp = page.getByRole('dialog', { name: 'Phím tắt' });
  await expect(shortcutHelp).toBeVisible();
  /* "Hiện" chưa đủ: Esc của bảng (phạm vi `dialog`) đăng ký trong effect, còn bẫy
     focus bật một khung hình SAU đó (`GlobalShortcutHelp.tsx:97-127`). Focus đã
     vào trong bảng ⇒ phím đóng đã đăng ký. Bấm sớm hơn thì Esc rơi xuống `canvas`
     và thu khung Pascal — bài đỏ vì nhịp chứ không vì lỗi. */
  await expect
    .poll(() => page.evaluate(() => document.activeElement?.closest('[role="dialog"]') !== null))
    .toBe(true);

  await page.keyboard.press('Escape');
  await expect(shortcutHelp).toHaveCount(0);
  await expect(canvasBox).toBeVisible();

  /* Esc lần hai — lớp trên cùng giờ là khung Pascal: hộp canvas biến mất, màn
     nói đang thu gọn (`usePascalViewer.ts:301-310`, `PASCAL_VIEWER_CAPTIONS.collapsed`). */
  await page.keyboard.press('Escape');
  await expect(canvasBox).toHaveCount(0);
  await expect(page.getByRole('heading', { name: COLLAPSED_HEADING, exact: true })).toBeVisible();
  await expect(page.getByRole('status')).toContainText('thu gọn');

  /* Và đó là lớp DUY NHẤT đóng — phần còn lại của màn vẫn còn nguyên. */
  await expect(page.getByRole('region', { name: SCREEN_REGION_NAME })).toBeVisible();

  /* `E` qua sổ phím thật gắn vào `window` thật — đơn vị (`usePascalViewer.test.tsx`)
     chỉ phát sự kiện tay. Gõ chữ thường như người dùng gõ; sổ khai `'E'`. */
  await page.keyboard.press('e');
  await expect(canvasBox).toBeVisible();
  await expect(page.getByRole('status')).toHaveText(SUCCESS_CAPTION, {
    timeout: PASCAL_RENDER_TIMEOUT_MS,
  });
});

test('Esc thu khung ngay cả khi gói còn đang nạp, và lượt nạp dở không phá lượt mở lại (B-3)', async ({
  page,
}) => {
  test.setTimeout(HEAVY_TEST_TIMEOUT_MS);

  await enableFlags(page, [PASCAL_FLAG_KEY]);
  const release = await holdPascalBundle(page);
  await openPascalViewer(page);

  const canvasBox = page.getByTestId('pascal-canvas');
  await expect(page.getByRole('status')).toHaveText(LOADING_CAPTION);
  await expect(canvasBox).toBeVisible();

  await page.keyboard.press('Escape');
  await expect(canvasBox).toHaveCount(0);
  await expect(page.getByRole('heading', { name: COLLAPSED_HEADING, exact: true })).toBeVisible();

  /* Mở lại bằng nút chuột song song với phím `E`. Tên truy cập ĐÚNG MỘT LẦN dù
     `textContent` lặp đôi (bản sao `aria-hidden` giữ bề rộng, `Button.tsx:74`). */
  await page.getByRole('button', { name: 'mở khung xem', exact: true }).click();
  await expect(canvasBox).toBeVisible();
  await expect(page.getByRole('status')).toHaveText(LOADING_CAPTION);

  /* Lượt nạp bị thu giữa chừng vẫn đang treo; thả nó ra thì lượt mở lại phải
     dùng được chính lượt nạp ấy và dựng xong. */
  release();
  await expect(page.getByRole('status')).toHaveText(SUCCESS_CAPTION, {
    timeout: PASCAL_RENDER_TIMEOUT_MS,
  });
});

test('khung dựng chiếm phần lớn cửa sổ, không phải một dải 190 px (B-V10-02)', async ({
  page,
}) => {
  await enableFlags(page, [PASCAL_FLAG_KEY]);
  // Giữ gói lại: bố cục của hộp đã chốt từ lúc `loading`, không cần chờ WebGL.
  await holdPascalBundle(page);
  await openPascalViewer(page);

  const canvasBox = page.getByTestId('pascal-canvas');
  await expect(canvasBox).toBeVisible();

  /* Đo 2026-10-03 trước khi sửa: cả trang cao 384 px (`min-h-[24rem]` của khung)
     trong cửa sổ 900 px, hộp dựng còn 192 px. "Quá nửa cửa sổ" không bám con số
     px nào của bố cục — nó chỉ nói khung 3D là thứ chính của màn. */
  await expect
    .poll(async () => (await canvasBox.boundingBox())?.height ?? 0)
    .toBeGreaterThan(VIEWPORT.height / 2);

  // Gói vẫn đang bị giữ; gỡ để lượt treo không làm hỏng lúc dọn trang.
  await page.unrouteAll({ behavior: 'ignoreErrors' });
});

for (const [variant, response, retryBy] of [
  ['404', BROKEN_BUNDLE.notFound, 'nút'],
  ['text/html', BROKEN_BUNDLE.spaFallback, 'phím R'],
] as const) {
  test(`gói vách ngăn hỏng (${variant}) thì báo PASCAL-01, và thử lại bằng ${retryBy} dựng được khi gói trở lại (B-5, B-V10-01)`, async ({
    page,
  }) => {
    test.setTimeout(HEAVY_TEST_TIMEOUT_MS);

    await enableFlags(page, [PASCAL_FLAG_KEY]);
    const breakBundle = async (route: Route): Promise<void> => {
      await route.fulfill(response);
    };
    await page.route(PASCAL_BUNDLE_GLOB, breakBundle);
    await openPascalViewer(page);

    await expect(page.getByRole('heading', { name: ERROR_HEADING, exact: true })).toBeVisible();
    await expect(page.getByRole('status')).toHaveText('không nạp được khung dựng hình.');
    await expect(page.getByText('kèm mã PASCAL-01.')).toBeVisible();
    await expect(page.getByTestId('pascal-canvas')).toHaveCount(0);

    /* Gói trở lại (người trực dựng lại, mạng thông lại). "thử lại" là lối thoát
       DUY NHẤT trên màn, nên nó phải nạp lại THẬT chứ không trả lại lỗi cũ. */
    await page.unroute(PASCAL_BUNDLE_GLOB, breakBundle);

    if (retryBy === 'nút') {
      await page.getByRole('button', { name: 'thử lại', exact: true }).click();
    } else {
      await page.keyboard.press('r');
    }

    await expect(page.getByRole('status')).toHaveText(SUCCESS_CAPTION, {
      timeout: PASCAL_RENDER_TIMEOUT_MS,
    });
    await expect(page.getByTestId('pascal-canvas').locator('canvas')).toHaveCount(1);
  });
}

test('bộ đổi dữ liệu nạp hỏng thì báo PASCAL-01, và thử lại không kẹt khung xương (B-V10-04)', async ({
  page,
}) => {
  test.setTimeout(HEAVY_TEST_TIMEOUT_MS);

  await enableFlags(page, [PASCAL_FLAG_KEY]);
  /* `toPascal` nạp muộn bằng `import()` (`usePascalViewer.ts:219`). Đường
     `/src/lib/pascal/` là đường của máy chủ DEV — `pnpm e2e` luôn chạy trên dev. */
  const breakAdapter = async (route: Route): Promise<void> => {
    await route.abort();
  };
  await page.route('**/src/lib/pascal/toPascal.ts*', breakAdapter);
  await openPascalViewer(page);

  await expect(page.getByRole('heading', { name: ERROR_HEADING, exact: true })).toBeVisible();
  await page.unroute('**/src/lib/pascal/toPascal.ts*', breakAdapter);

  /* Ghi MỌI chú thích trạng thái từ đây — không đọc một lần. Sau "thử lại", lượt
     `import()` có thể về thành công hoặc trả lại lỗi cũ: Chrome giữ lỗi module
     theo URL hay không là việc của trình duyệt (đo 2026-10-03: một lượt dựng
     xong, hai lượt lỗi lại). Lỗi B-V10-04 là chuyện khác hẳn: màn sang "đang
     nạp" rồi ĐỨNG ĐÓ mãi. Nhật ký phân biệt được cả ba, còn một lần đọc chú thích
     ngay sau cú bấm thì có thể đọc trúng chữ lỗi CŨ và xanh giả. */
  await page.evaluate(() => {
    const log: string[] = [];
    (window as unknown as { __statusLog: string[] }).__statusLog = log;
    new MutationObserver(() => {
      const caption = document.querySelector('[role="status"]')?.textContent ?? '';
      if (log.at(-1) !== caption) log.push(caption);
    }).observe(document.body, { childList: true, subtree: true, characterData: true });
  });
  await page.getByRole('button', { name: 'thử lại', exact: true }).click();

  const statusLog = (): Promise<string[]> =>
    page.evaluate(() => (window as unknown as { __statusLog: string[] }).__statusLog);

  await expect
    .poll(
      async () => {
        const log = await statusLog();
        const loadingAt = log.indexOf(LOADING_CAPTION);

        return loadingAt >= 0 && log.length > loadingAt + 1;
      },
      { timeout: PASCAL_RENDER_TIMEOUT_MS, message: 'màn kẹt "đang nạp" sau khi thử lại' },
    )
    .toBe(true);

  /* Rời "đang nạp" thì phải tới một trạng thái có đường đi tiếp: cảnh, hoặc lỗi
     kèm nút thử lại. */
  const settled = (await statusLog()).at(-1);
  expect([SUCCESS_CAPTION, 'không nạp được khung dựng hình.']).toContain(settled);
  if (settled !== SUCCESS_CAPTION) {
    await expect(page.getByRole('button', { name: 'thử lại', exact: true })).toBeVisible();
  }
});
