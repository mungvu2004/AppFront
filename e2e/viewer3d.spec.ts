import { expect, test } from '@playwright/test';
import type { Page } from '@playwright/test';

import { ROUTE_PATTERNS } from '../src/routes/paths';

/**
 * Màn `Viewer3D`, thao tác thật bằng chuột và bàn phím — KHÔNG phải nghiệm thu
 * khả dụng.
 *
 * ## Bài này thay cho cái gì, và nó KHÔNG chứng minh được cái gì
 *
 * Đặc tả có một mục nghiệm thu viết cho NGƯỜI THẬT:
 * "đưa một người chưa từng dùng CAD ngồi trước màn, không hướng dẫn gì → họ
 * phải quay, thu phóng và tìm được một phòng; ghi lại họ mất bao lâu"
 * (`docs/notes/viewer3d/usability-script.md`).
 *
 * **Một bài Playwright không thay được mục ấy.** Bài này không biết người dùng
 * có ĐOÁN RA phải làm gì không, không thấy họ kéo nhầm hướng ba lần, không nghe
 * họ buột miệng "ơ sao nó không xoay", và con số mili-giây dưới đây là tốc độ
 * của một cái máy chứ không phải thời gian một người lạ mò ra cách làm. Nó chỉ
 * chứng minh đúng một chuyện, và đó là chuyện đáng chứng minh bằng máy:
 *
 * > Ba việc ấy **làm được bằng những gì nhìn thấy trên màn**, không cần biết
 * > trước một phím tắt nào — và làm xong trong bao lâu.
 *
 * Kịch bản người thật vẫn phải chạy. Bài này không thay nó, và
 * `usability-script.md` nói thẳng: không agent nào được tự chạy kịch bản ấy rồi
 * báo số như thể một người thật đã ngồi thử.
 *
 * ## KHÔNG kiểm được gì — bốn khoảng trống đã đo, không phải đoán
 *
 * Việc thứ ba của đặc tả là **tìm một phòng**. Bài này KHÔNG kiểm việc đó, và
 * mục nghiệm thu ấy tới giờ **chưa được chứng minh**, chứ không phải đã đạt.
 * Bốn lý do, cả bốn đều đã dựng lại được trên `pnpm dev`:
 *
 * 1. **`store.spatial` là `null` và không cửa nào bơm được.** Vỏ 3D lấy "4 tầng
 *    · 14 phòng · 248,60 m²" từ `createViewerShellFixtureGateway` — cổng bộ mẫu
 *    MẶC ĐỊNH của `useViewerShell` — chứ không từ kho. Đồ thị không gian trong
 *    kho vẫn rỗng, nên không có phòng nào tồn tại để chọn.
 * 2. **Bảy màn QC đọc vòng tròn.** Mọi chỗ gọi `setSpatial` (`WallLayerReview`,
 *    `RoomLabelReview`, `FloorManager`, …) đều nạp từ một cổng mà bản thật của
 *    nó là `read: () => useStore.getState().spatial` — tức đọc lại chính cái kho
 *    đang rỗng. `FloorManager` có đường không vòng tròn (`api.floors.list`)
 *    nhưng vẫn lấy `graph` từ kho, nên nó hiện "0 tầng".
 * 3. **`VITE_USE_MOCK_API=true` là cửa thật, và nó KHÔNG lấp được chỗ này.** Đã
 *    bật và xác nhận `resolveUseMockApi() === true`, không còn lượt `/api/**`
 *    nào 404 — nhưng lý do 2 nằm ở phía sau nó, nên kho vẫn rỗng.
 * 4. **Vai của phiên là `[]`, nên `canEdit` là `false`.**
 *    `viewer3dScene.ts` chỉ gắn `createPointerPicker` khi `canSelect`
 *    (= `canEdit`), nên bấm vào khung nhìn không chọn được gì. Và cả vỏ 3D
 *    không vẽ tên phòng ở BẤT KỲ đâu ngoài `selection.title` của panel phải —
 *    thứ chỉ xuất hiện sau khi đã chọn được. Nên kể cả khi có dữ liệu, một
 *    người ở vai Người xem vẫn không có đường nào đi tới một phòng cụ thể.
 *
 * Thay cho việc ấy, {@link stepChooseStorey} kiểm một việc HẸP HƠN và có thật:
 * chọn một tầng từ ray tầng. Đó là một việc khác, không phải "tìm một phòng",
 * và tên bài viết đúng như vậy để không ai đọc nhầm.
 *
 * ## Bốn khoảng trống ấy giờ còn lại những gì (Q2)
 *
 * Mục trên là bản ghi của lần đo TRƯỚC Q2 và được giữ nguyên chữ để đọc lại
 * được. Sau Q2, ba trong bốn lý do đã đổi, và {@link findOneRoom} là bài chứng
 * minh phần đã đổi:
 *
 * - **Lý do 1 — ĐÃ LẤP.** `Viewer3DContainer` chốt đồ thị một lần rồi tiêm cùng
 *   giá trị ấy vào cả vỏ lẫn hook qua hai chỗ tiêm sẵn có (`gateway`,
 *   `spatial`), nên hai bên không còn nhìn hai nguồn khác nhau. Và mã của bộ
 *   mẫu vỏ đã được sửa cho hợp lệ theo `domain/spatial/ids.ts`, nên
 *   `toBuildFloorInput` dựng được hình thật: **cảnh 3D ở dev đã có khối nhà bốn
 *   tầng**, canvas 960×415 chứ không còn 300×150.
 * - **Lý do 2 — KHÔNG đổi.** Bảy màn QC vẫn đọc vòng tròn.
 * - **Lý do 3 — ĐÃ LẤP (R1).** Đoạn dưới đây là bản ghi lúc Q2 và được giữ
 *   nguyên chữ: *"Vai vẫn là `[]` … nên `viewer3dScene.ts` vẫn KHÔNG gắn
 *   `createPointerPicker` và bấm chuột vào khung nhìn vẫn không chọn được
 *   gì"*. Điều ấy nay không còn đúng, và hai bài cuối file là bằng chứng.
 *   Hai chỗ đứt, cả hai đã sửa và cả hai đều đo được bằng trình duyệt thật:
 *   **(a)** không nơi nào trong `src` gọi `configureAuth()`, nên
 *   `bootstrapSession()` — cửa DUY NHẤT đặt `roles` vào phiên — không chạy nổi
 *   sau lượt đăng nhập; **(b)** ngay cả khi vai đã đúng, khối `sr-only` phủ kín
 *   khung nhìn của `Viewer3D.tsx` nằm SAU `<canvas>` trong DOM nên nuốt sạch cú
 *   bấm — `document.elementFromPoint` giữa khung trả về khối ấy chứ không trả
 *   về canvas. `pointer-events-none` gỡ nửa sau.
 *   Bài "tìm một phòng" ngay dưới vẫn đi đường khác — ô tìm — nên nó vẫn không
 *   phải là bằng chứng của việc bấm-để-chọn; bằng chứng ấy nằm ở bài R1.
 * - **Lý do 4 — đã lấp.** Tên phòng đọc được ở ô tìm, và tên phòng vừa chọn
 *   hiện ra ở panel thanh tra bên phải — thứ bài dưới đây khẳng định, vì nó nằm
 *   NGOÀI ô tìm và do đó không phải là ô tìm tự đọc lại chính mình. Mã bộ mẫu
 *   nay hợp lệ nên đại số `selectSingle`/`isSelectable` của S-10 chạy được với
 *   dữ liệu ấy; bài này vẫn không đi qua nhánh bấm-trong-cảnh, xem lý do 3.
 *
 * Còn một việc nữa bài này KHÔNG kiểm được: **camera có bay tới đúng phòng
 * không**. `CameraDirector.frameObjects` chạy trên cây lưới bên trong `<canvas>`,
 * và không có gì trong DOM nói ra điểm ngắm của camera — nhãn thu phóng chỉ đọc
 * khoảng cách. Việc ấy được chứng minh ở tầng đơn vị
 * (`viewer3dScene.test.ts` — "R-07: khuôn camera vào một phòng có thật").
 *
 * ## Điểm mù của việc "quay"
 *
 * Kéo chuột trong khung nhìn CÓ quay camera (`useViewerShell` gọi
 * `director.controller.rotate`), nhưng **không có gì trong DOM nói ra góc nhìn
 * đã đổi**: nhãn thu phóng chỉ đọc khoảng cách nên nó đứng yên khi quay, ViewCube
 * chỉ đổi theo góc nhìn sẵn, và `<canvas>` chưa bao giờ dựng cảnh vì lý do 1 ở
 * trên. Nên bước kéo chuột dưới đây **được ĐO nhưng không được khẳng định** —
 * gọi nó là "đạt" sẽ là bịa. Bằng chứng thật của "góc nhìn đã đổi" đến từ ô
 * "Góc nhìn sẵn": đổi sang "Trên xuống" thì ViewCube chuyển `aria-pressed` sang
 * đúng ô ấy, và đó là một khẳng định quan sát được.
 */

/** Tiền tố của mọi dòng thời gian, để lọc log lúc chạy. */
const LOG_PREFIX = '[viewer3d]';

/** Dự án nào cũng được: vỏ đọc bộ mẫu, không đọc mã dự án. */
const PROJECT_ID = 'P-01';

/** Đường dẫn thật của màn, dựng từ hằng của `src/routes/paths.ts`. */
const VIEWER_PATH = ROUTE_PATTERNS.projectViewer.replace(':id', PROJECT_ID);

/** Bao nhiêu nấc cuộn cho một lượt "lại gần một chỗ". */
const ZOOM_NOTCHES = 5;

/** Một nấc cuộn của chuột, theo đơn vị `wheel` của trình duyệt. */
const WHEEL_DELTA_PX = 120;

/** Kéo chuột thành bấy nhiêu bước, để `pointermove` sinh ra delta thật. */
const DRAG_STEPS = 12;

/** Nhãn nút mở ô tìm — cùng chữ `ObjectSearch.tsx` vẽ ra. */
const SEARCH_TRIGGER_LABEL = 'tìm phòng';

/** Nhãn ô chữ của ô tìm. */
const SEARCH_INPUT_LABEL = 'tìm phòng theo tên hoặc mã';

/**
 * Chuỗi người dùng gõ — KHÔNG DẤU, cố ý.
 *
 * Nếu ô tìm chỉ khớp chuỗi thô thì "phong ngu 4" không bao giờ ra "Phòng ngủ 4",
 * và bài này đỏ. Đó là điều đáng kiểm: người dùng đặc tả nhắm tới gõ không dấu.
 */
const ROOM_QUERY = 'phong ngu 4';

/** Phòng phải tìm ra. Nó ở TẦNG 03 — không phải tầng dưới cùng (S-10). */
const ROOM_NAME = 'Phòng ngủ 4';

/** Mã của chính phòng ấy, để panel thanh tra nói ra cả hai. */
const ROOM_ID = 'R-011';

/* -------------------------------------------------------------------------- */
/* Phiên: vai thật, qua đúng cửa đăng nhập của sản phẩm.                       */
/* -------------------------------------------------------------------------- */

/**
 * Vai mà máy chủ giả cấp cho lượt đăng nhập của bài này.
 *
 * `engineer` là vai `permissionMatrix` bật `layer.edit`, và `layer.edit` CHÍNH
 * LÀ thứ `useViewer3D` hỏi để tính `canEdit`. Không có nó thì
 * `viewer3dScene.ts` không gắn `createPointerPicker` và cú bấm dưới đây rơi vào
 * hư không — đúng lỗi bài này sinh ra để chặn.
 */
const SIGNED_IN_ROLES = ['engineer'] as const;

/** Bao lâu thì token hết hạn. Đủ dài để không lượt gia hạn nào chen vào giữa bài. */
const SESSION_TTL_SECONDS = 3600;

/** Địa chỉ và mật khẩu gõ vào biểu mẫu — máy chủ giả nhận mọi thứ, nên chỉ cần hợp lệ về hình dạng. */
const SIGN_IN_EMAIL = 'engineer@example.com';
const SIGN_IN_PASSWORD = 'matkhau-du-dai';

/** Nhãn ba điều khiển của biểu mẫu đăng nhập — cùng chữ `src/i18n/vi.json` giữ. */
const EMAIL_LABEL = 'Thư điện tử';
const PASSWORD_LABEL = 'Mật khẩu';
const SIGN_IN_LABEL = 'Đăng nhập';

/**
 * Đăng nhập THẬT rồi đi tiếp tới màn 3D, với hai lượt gọi mạng do bài kiểm trả lời.
 *
 * Bài này KHÔNG tự đặt phiên vào trang. Nó chạy đúng chuỗi của sản phẩm —
 * `POST /auth/login` → `bootstrapSession()` → `POST /auth/refresh` →
 * `setAuthenticatedSession({ roles })` → `useSession().roles` — và chỉ thay hai
 * chuyến đi ngoài cùng, vì máy dựng của dev không có máy chủ nào sau lưng.
 * Chặn ở tầng trình duyệt (`page.route`) chứ không ở tầng ứng dụng: mọi mắt
 * xích trong `src` vẫn là mắt xích thật, kể cả `configureAuth()` và bộ phân
 * tích thân trả lời của `src/lib/auth/refresh.ts`.
 *
 * `?next=` là đường quay lại mà chính màn đăng nhập khai (`safeDestination`),
 * nên sau lượt đăng nhập trình duyệt tự sang màn 3D — không `goto` lần hai,
 * tức phiên vừa mở không bị một lượt tải trang xoá mất.
 */
async function signInThenOpenViewer(
  page: Page,
  roles: readonly string[] = SIGNED_IN_ROLES,
): Promise<void> {
  await page.route('**/auth/login', async (route) => {
    await route.fulfill({ body: '{}', contentType: 'application/json', status: 200 });
  });

  await page.route('**/auth/refresh', async (route) => {
    await route.fulfill({
      body: JSON.stringify({
        accessToken: 'e2e-access-token',
        expiresIn: SESSION_TTL_SECONDS,
        roles,
        user: {
          email: SIGN_IN_EMAIL,
          id: 'user-2',
          name: 'Engineer',
          roles,
        },
      }),
      contentType: 'application/json',
      status: 200,
    });
  });

  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto(`${ROUTE_PATTERNS.login}?next=${encodeURIComponent(VIEWER_PATH)}`);

  await page.getByLabel(EMAIL_LABEL).fill(SIGN_IN_EMAIL);
  await page.getByLabel(PASSWORD_LABEL, { exact: true }).fill(SIGN_IN_PASSWORD);
  await page.getByRole('button', { name: SIGN_IN_LABEL, exact: true }).click();

  await expect(page.getByRole('main', { name: 'Khung nhìn mô hình' })).toBeVisible();
}

/** Mỗi bước kéo đi ngang bấy nhiêu pixel. */
const DRAG_STEP_X_PX = 15;

/** …và xuống bấy nhiêu, để cú kéo đổi cả phương vị lẫn góc chúc. */
const DRAG_STEP_Y_PX = 3;

/** In một mốc thời gian theo dạng người đọc được. */
function logDuration(label: string, elapsedMs: number): void {
  /* Con số này LÀ kết quả của bài, không phải log gỡ lỗi. */
  console.log(`${LOG_PREFIX} ${label}: ${elapsedMs} ms`);
}

/** Chạy một việc, in thời gian nó tốn, trả lại số mili-giây ấy. */
async function timed(label: string, work: () => Promise<void>): Promise<number> {
  const startedAt = Date.now();
  await work();
  const elapsedMs = Date.now() - startedAt;
  logDuration(label, elapsedMs);

  return elapsedMs;
}

/** Mở màn và chờ tới lúc nó thật sự dựng xong. */
async function openViewer(page: Page): Promise<void> {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto(VIEWER_PATH);
  await expect(page.getByRole('main', { name: 'Khung nhìn mô hình' })).toBeVisible();
}

/** Nhãn mức thu phóng, đọc từ chính nút của cụm thu phóng. */
function zoomLabel(page: Page) {
  return page.getByRole('button', { name: /^Mức thu phóng/u });
}

/**
 * "175,5%" → 175.5.
 *
 * Dấu thập phân là dấu PHẨY (A15), nên phép đọc ngược phải biết điều đó; đây là
 * bài kiểm chứ không phải view, và `src/lib/format` không chạy được ở phía
 * Playwright.
 */
function percentOf(label: string): number {
  return Number(label.replace('%', '').replace(',', '.'));
}

/* -------------------------------------------------------------------------- */
/* Ba việc.                                                                    */
/* -------------------------------------------------------------------------- */

/**
 * Việc 1 — quay.
 *
 * Hai nửa, và chỉ nửa sau là bằng chứng. Xem "Điểm mù của việc quay" ở đầu file.
 */
async function stepRotate(page: Page): Promise<void> {
  const viewport = page.getByRole('main', { name: 'Khung nhìn mô hình' });
  const box = await viewport.boundingBox();

  expect(box).not.toBeNull();

  /* Nửa đầu: kéo chuột thật trong khung nhìn. ĐO, không khẳng định. */
  const centreX = box!.x + box!.width / 2;
  const centreY = box!.y + box!.height / 2;

  await page.mouse.move(centreX, centreY);
  await page.mouse.down();

  for (let step = 1; step <= DRAG_STEPS; step += 1) {
    await page.mouse.move(centreX + step * DRAG_STEP_X_PX, centreY + step * DRAG_STEP_Y_PX);
  }

  await page.mouse.up();

  /* Nửa sau: đổi góc nhìn bằng ô "Góc nhìn sẵn" — điều khiển NHÌN THẤY được. */
  const presetSelect = page.getByRole('combobox', { name: 'Góc nhìn sẵn' });
  const cube = page.getByRole('group', { name: 'Khối định hướng' });

  await expect(cube.getByRole('button', { name: 'Phối cảnh' })).toHaveAttribute(
    'aria-pressed',
    'true',
  );

  await presetSelect.click();
  await page.getByRole('option', { name: 'Trên xuống' }).click();

  await expect(presetSelect).toHaveText('Trên xuống');
  await expect(cube.getByRole('button', { name: 'Trên xuống' })).toHaveAttribute(
    'aria-pressed',
    'true',
  );
  await expect(cube.getByRole('button', { name: 'Phối cảnh' })).toHaveAttribute(
    'aria-pressed',
    'false',
  );
}

/**
 * Việc 2 — thu phóng.
 *
 * Lăn chuột trong khung nhìn, rồi khẳng định mức thu phóng ĐÃ LỚN HƠN. Nhãn ấy
 * do `useViewerShell` định dạng sẵn (A15), nên nó là đầu ra thật của camera chứ
 * không phải một chuỗi màn hình tự bịa.
 */
async function stepZoom(page: Page): Promise<void> {
  const viewport = page.getByRole('main', { name: 'Khung nhìn mô hình' });
  const box = await viewport.boundingBox();

  expect(box).not.toBeNull();

  const label = zoomLabel(page);
  const before = percentOf((await label.innerText()).trim());

  await page.mouse.move(box!.x + box!.width / 2, box!.y + box!.height / 2);

  for (let notch = 0; notch < ZOOM_NOTCHES; notch += 1) {
    await page.mouse.wheel(0, -WHEEL_DELTA_PX);
  }

  await expect
    .poll(async () => percentOf((await label.innerText()).trim()))
    .toBeGreaterThan(before);
}

/**
 * Việc 3 — chọn một tầng từ ray tầng.
 *
 * **Đây KHÔNG phải "tìm một phòng".** Xem mục "KHÔNG kiểm được gì" ở đầu file:
 * không có phòng nào tồn tại trong DOM của màn này ở môi trường dev, nên việc
 * thứ ba của đặc tả chưa kiểm được. Việc dưới đây là thứ HẸP HƠN mà một người
 * lạ làm được chỉ bằng thứ nhìn thấy: đi tới một tầng cụ thể trên ray trái, và
 * màn nói lại rằng nó đã tới đúng tầng ấy.
 */
async function stepChooseStorey(page: Page): Promise<void> {
  const groundStorey = page.getByRole('option', { name: /^Tầng trệt, cao độ/u });
  const roofStorey = page.getByRole('option', { name: /^Tầng mái, cao độ/u });

  await expect(groundStorey).toHaveAttribute('aria-selected', 'false');

  await groundStorey.click();

  await expect(groundStorey).toHaveAttribute('aria-selected', 'true');
  /* Chọn MỘT tầng, không phải bật tất: tầng khác phải vẫn không được chọn. */
  await expect(roofStorey).toHaveAttribute('aria-selected', 'false');
}

/**
 * Việc thứ ba của đặc tả — **tìm một phòng**, không dùng phím tắt nào.
 *
 * Bốn thao tác, cả bốn bằng thứ nhìn thấy trên màn: bấm nút mở ô tìm, gõ tên
 * phòng KHÔNG DẤU (người dùng đặc tả nhắm tới ngồi trước một bàn phím không cài
 * bộ gõ tiếng Việt), bấm dòng kết quả, rồi đọc tên phòng ở panel bên phải.
 *
 * `click()` thường ở cả hai cú bấm — cấm `force: true`, vì `force` bỏ qua đúng
 * phép kiểm che khuất bắt được lỗi "nút nằm dưới một lớp khác".
 */
async function findOneRoom(page: Page): Promise<void> {
  /* Không một `page.keyboard.press` nào trong hàm này: phím `/` mở được ô tìm,
     nhưng người quản lý toà nhà không biết phím ấy tồn tại. */
  await page.getByRole('button', { name: SEARCH_TRIGGER_LABEL }).click();

  const box = page.getByRole('combobox', { name: SEARCH_INPUT_LABEL });
  await expect(box).toBeVisible();

  await box.fill(ROOM_QUERY);

  const match = page.getByRole('option', { name: new RegExp(ROOM_NAME, 'u') });
  await expect(match).toHaveCount(1);

  await match.click();

  /* Bằng chứng nằm NGOÀI ô tìm: panel thanh tra của vỏ đọc kho chọn dùng chung,
     nên tên phòng hiện ở đó nghĩa là phòng ĐÃ ĐƯỢC CHỌN THẬT — không phải ô tìm
     đọc lại chính danh sách của nó. */
  const inspector = page.getByRole('complementary', { name: 'Thanh tra đối tượng' });

  await expect(inspector).toContainText(ROOM_NAME);
  await expect(inspector).toContainText(ROOM_ID);
}

/* -------------------------------------------------------------------------- */
/* Bài.                                                                        */
/* -------------------------------------------------------------------------- */

test('mở được màn 3D và màn không trắng', async ({ page }) => {
  await openViewer(page);

  /* A11: khung nhìn và thanh trạng thái luôn được vẽ, không nhánh nào trả null. */
  await expect(page.getByRole('main', { name: 'Khung nhìn mô hình' })).toBeVisible();
  await expect(page.getByLabel('Thanh trạng thái')).toBeVisible();

  /* Thanh trạng thái mang số THẬT, không phải "0 tầng · 0 phòng". */
  await expect(page.getByLabel('Thanh trạng thái')).toContainText(
    /[1-9]\d* tầng · [1-9]\d* phòng · [\d.,]+ m²/u,
  );

  /* Và bốn tầng có mặt trên ray, tức màn có thứ để thao tác. */
  await expect(page.getByRole('option', { name: /cao độ/u })).toHaveCount(4);
});

test('ba việc chỉ bằng thứ nhìn thấy trên màn: quay, thu phóng, chọn tầng', async ({ page }) => {
  await openViewer(page);

  const rotateMs = await timed('quay', () => stepRotate(page));
  const zoomMs = await timed('thu phóng', () => stepZoom(page));
  const storeyMs = await timed('chọn tầng', () => stepChooseStorey(page));

  logDuration('tổng ba việc', rotateMs + zoomMs + storeyMs);
});

test('ViewCube bấm được bằng chuột, bản đồ nhỏ không đè lên nó (P2)', async ({ page }) => {
  await openViewer(page);

  /* Bấm THẬT bằng `click()` thường — cấm `force: true`. `force` bỏ qua đúng
     phép kiểm che khuất Playwright dùng để bắt lỗi này
     (`subtree intercepts pointer events`); dùng nó là tự bịt mắt mình trước
     một cú bấm không tới nơi. */
  const cube = page.getByRole('group', { name: 'Khối định hướng' });
  const axonometricFace = cube.getByRole('button', { name: 'Trục đo' });

  await expect(axonometricFace).toHaveAttribute('aria-pressed', 'false');

  await axonometricFace.click();

  /* Góc nhìn đổi thật: mặt vừa bấm chuyển `aria-pressed`, mặt cũ nhả ra. */
  await expect(axonometricFace).toHaveAttribute('aria-pressed', 'true');
  await expect(cube.getByRole('button', { name: 'Phối cảnh' })).toHaveAttribute(
    'aria-pressed',
    'false',
  );
});

test('Esc đóng lớp trên cùng (A12)', async ({ page }) => {
  await openViewer(page);

  const presetSelect = page.getByRole('combobox', { name: 'Góc nhìn sẵn' });

  await expect(presetSelect).toHaveAttribute('aria-expanded', 'false');

  await presetSelect.click();

  await expect(presetSelect).toHaveAttribute('aria-expanded', 'true');
  await expect(page.getByRole('option', { name: 'Trục đo' })).toBeVisible();

  await page.keyboard.press('Escape');

  /* Lớp trên cùng đóng, và nó là lớp DUY NHẤT đóng: màn vẫn còn nguyên. */
  await expect(presetSelect).toHaveAttribute('aria-expanded', 'false');
  await expect(page.getByRole('option', { name: 'Trục đo' })).toHaveCount(0);
  await expect(page.getByRole('main', { name: 'Khung nhìn mô hình' })).toBeVisible();
});

test('tìm được một phòng chỉ bằng thứ nhìn thấy trên màn (Q2)', async ({ page }) => {
  await openViewer(page);

  await timed('tìm một phòng', () => findOneRoom(page));
});

/**
 * R1 — **bấm chuột vào khung nhìn 3D và chọn được một đối tượng.**
 *
 * Đây là việc mà bốn lượt trước KHÔNG chứng minh được, và lý do luôn là một:
 * vai của phiên rỗng nên `canEdit` sai nên `viewer3dScene.ts` không gắn
 * `createPointerPicker`. Bài này đi qua cửa đăng nhập thật để vai chảy tới màn,
 * rồi bấm — `click()` thường, không `force: true`.
 *
 * Bằng chứng nằm ở panel thanh tra bên phải, tức NGOÀI khung nhìn: nó dựng từ
 * kho chọn dùng chung, nên tên và mã hiện ở đó nghĩa là cú bấm đã chạy trọn
 * đường `tia → entityId → selectionSlice → viewmodel`. Trước cú bấm panel nói
 * "Chưa chọn đối tượng"; sau cú bấm câu ấy phải biến mất, và chỗ nó vừa đứng
 * phải là một đối tượng có mã đọc được.
 *
 * Bấm hơi chếch khỏi tâm: tâm khung nhìn là chỗ trục tách tầng đi qua, nên một
 * điểm lệch xuống dưới rơi vào thân khối nhà chứ không vào khe giữa hai tầng.
 */
test('bấm chuột trong khung nhìn chọn được một đối tượng (R1)', async ({ page }) => {
  await signInThenOpenViewer(page);

  const viewport = page.getByRole('main', { name: 'Khung nhìn mô hình' });
  const inspector = page.getByRole('complementary', { name: 'Thanh tra đối tượng' });

  /* Vai đã chảy tới màn: vai Người xem thì panel dựng dải "Chỉ xem" thay vì để
     chọn — không thấy dải ấy nghĩa là quyền đã đúng. */
  await expect(inspector).not.toContainText('Chỉ xem');
  await expect(inspector).toContainText('Chưa chọn đối tượng');

  const box = await viewport.boundingBox();
  expect(box).not.toBeNull();

  await timed('bấm để chọn', async () => {
    await page.mouse.click(box!.x + box!.width / 2, box!.y + box!.height * 0.62);

    /* Panel đổi hẳn nội dung: không còn câu "chưa chọn", và có một mã đối
       tượng thật của đồ thị không gian. */
    await expect(inspector).not.toContainText('Chưa chọn đối tượng');
    await expect(inspector).toContainText(/(phòng|tường) [A-Z]-[A-Z0-9]+/u);
    await expect(inspector).toContainText('mã đối tượng');
  });
});

/**
 * Nửa còn lại của cùng một mắt xích: **vai chỉ-xem thì cú bấm ấy KHÔNG chọn gì.**
 *
 * Bài trên chứng minh vai chảy tới màn; bài này chứng minh nó chảy tới đúng chỗ
 * và mang đúng nghĩa. Cùng một cú bấm, cùng một toạ độ, chỉ khác vai mà máy chủ
 * trả về — `can('edit', 'layer')` sai cho `viewer`, nên `canEdit` sai,
 * `viewer3dScene.ts` không gắn bộ bắt tia, và panel vẫn nói "Chưa chọn đối
 * tượng". Không có bài này thì "vai đã chảy" chỉ là một câu nói: một màn cho ai
 * cũng chọn được cũng sẽ làm bài trên xanh.
 */
test('vai chỉ-xem: cùng cú bấm ấy không chọn được gì (A11 · nhánh không có quyền)', async ({
  page,
}) => {
  await signInThenOpenViewer(page, ['viewer']);

  const viewport = page.getByRole('main', { name: 'Khung nhìn mô hình' });
  const inspector = page.getByRole('complementary', { name: 'Thanh tra đối tượng' });

  await expect(inspector).toContainText('Chỉ xem');

  const box = await viewport.boundingBox();
  expect(box).not.toBeNull();

  await page.mouse.click(box!.x + box!.width / 2, box!.y + box!.height * 0.62);

  await expect(inspector).toContainText('Chưa chọn đối tượng');
});
