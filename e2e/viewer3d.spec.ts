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
