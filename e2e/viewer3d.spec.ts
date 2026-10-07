import { expect, test } from '@playwright/test';
import type { Page } from '@playwright/test';

import { ROUTE_PATTERNS } from '../src/routes/paths';

import { EMAIL_BY_ROLE, submitSignInForm } from './fixtures/session';
import { TOUR_APPEAR_TIMEOUT_MS, dismissTour } from './fixtures/tour';

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
 *    nhưng vẫn lấy `graph` từ kho, nên kho rỗng thì nó treo khung xương (bảng chỉ
 *    có hàng tiêu đề) — không phải "0 tầng" như bản trước ghi (đo: B-V7-13, W05).
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
const VIEWER_PATH = ROUTE_PATTERNS.projectViewer.replace(':projectId', PROJECT_ID);

/** Bao nhiêu nấc cuộn cho một lượt "lại gần một chỗ". */
const ZOOM_NOTCHES = 5;

/** Một nấc cuộn của chuột, theo đơn vị `wheel` của trình duyệt. */
const WHEEL_DELTA_PX = 120;

/** Kéo chuột thành bấy nhiêu bước, để `pointermove` sinh ra delta thật. */
const DRAG_STEPS = 12;

/** Nhãn nút mở ô tìm — cùng chữ `ObjectSearch.tsx` vẽ ra. */
const SEARCH_TRIGGER_LABEL = 'tìm phòng';

/** Nhãn ô chữ của ô tìm. */
const SEARCH_INPUT_LABEL = 'Tìm phòng theo tên hoặc mã';

/**
 * Chuỗi người dùng gõ — KHÔNG DẤU, cố ý.
 *
 * Nếu ô tìm chỉ khớp chuỗi thô thì "phong ngu 4" không bao giờ ra "Phòng ngủ 4",
 * và bài này đỏ. Đó là điều đáng kiểm: người dùng đặc tả nhắm tới gõ không dấu.
 */
const ROOM_QUERY = 'phong ngu 4';

/** Phòng phải tìm ra. Nó ở TẦNG 03 — không phải tầng dưới cùng (S-10). */
const ROOM_NAME = 'Phòng ngủ 4';

/**
 * Nhãn người đọc của chính phòng ấy (`displayLabelIn` trên mã máy `R-000011FIXTURE0`),
 * để ô tìm và tiêu đề thanh tra ("phòng R-011") nói ra cả hai. Mã máy không còn chứa
 * chuỗi `R-011`, nên khớp được ở đâu là nhờ nhãn chứ không nhờ hàng "mã đối tượng"
 * (B-V8-45).
 */
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

/**
 * Đăng nhập qua biểu mẫu rồi đi tiếp tới màn 3D, chạy trên BỘ MẪU (`VITE_USE_MOCK_API=true`).
 *
 * Bài này KHÔNG tự đặt phiên vào trang và KHÔNG phủ dây `/api/auth/*` thật: bộ mẫu
 * trả lời đăng nhập và gia hạn ngay trong trình duyệt, nên không lượt nào ra mạng
 * (bài khẳng định điều đó bằng `page.on('request')`). Vai theo địa chỉ đăng nhập.
 *
 * `?next=` là đường quay lại mà chính màn đăng nhập khai (`safeDestination`),
 * nên sau lượt đăng nhập trình duyệt tự sang màn 3D — không `goto` lần hai,
 * tức phiên vừa mở không bị một lượt tải trang xoá mất.
 */
async function signInThenOpenViewer(
  page: Page,
  roles: readonly string[] = SIGNED_IN_ROLES,
): Promise<void> {
  const authRequests: string[] = [];
  page.on('request', (request) => {
    const { pathname } = new URL(request.url());
    if (/\/auth\/(login|refresh)$/.test(pathname)) authRequests.push(pathname);
  });

  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto(`${ROUTE_PATTERNS.login}?next=${encodeURIComponent(VIEWER_PATH)}`);

  // Bộ mẫu suy vai theo địa chỉ (`roleOfEmail`): `viewer@` cho vai chỉ-xem, còn lại là kỹ sư.
  await submitSignInForm(page, roles.includes('viewer') ? EMAIL_BY_ROLE.viewer : EMAIL_BY_ROLE.engineer);

  await waitForViewerReady(page);
  expect(authRequests).toEqual([]);

  await settleViewer(page);
}

/**
 * Chờ khung nhìn thật sự sẵn sàng cho một cú bấm.
 *
 * Hai tiền đề mà các bài dưới đây vẫn ngầm dựa vào mà không nói ra, và cả hai
 * đều biểu hiện giống hệt nhau: `locator.click` hết 30 giây với
 * `subtree intercepts pointer events`.
 *
 * 1. **Mô hình còn đang dựng.** `Viewer3D` phủ kín khung bằng một lớp
 *    `role="status"` — "Đang dựng mô hình N tầng" — cho tới khi dựng xong. Lớp
 *    ấy nuốt mọi cú bấm vào ViewCube và vào khung nhìn.
 * 2. **Lớp hướng dẫn đang mở.** Mục 4.10 chuyển e2e sang bộ mẫu, nên mỗi lượt
 *    chạy là một NGƯỜI DÙNG LẦN ĐẦU — và người dùng lần đầu thì đúng là phải
 *    thấy `EditorTour`. Sản phẩm không sai; bài kiểm mới là chỗ thiếu một bước.
 *    Lớp phủ của tour là `pointer-events-auto`, nên nó che danh sách bên dưới.
 *
 * Tour được đóng bằng đúng nút "Bỏ qua hướng dẫn" mà `EditorTour` bày ra cho người dùng,
 * KHÔNG tắt bằng cờ hay biến môi trường: tắt bằng cờ là đi kiểm một sản phẩm
 * khác với sản phẩm người dùng nhận.
 *
 * ## Hàm này chữa được gì, và KHÔNG chữa được gì
 *
 * Chữa được: lớp "đang dựng mô hình" — đo trước/sau, P2 đổi từ bị lớp ấy chặn
 * sang qua được nó.
 *
 * KHÔNG chữa được, và đừng tưởng là nó chữa:
 * - ~~**P2** giờ bị chặn bởi con trỏ của NGƯỜI CỘNG TÁC GIẢ~~ — **chẩn đoán này
 *   SAI, và cái sai của nó là chỗ đáng đọc nhất đoạn văn này.** Thứ chặn không
 *   phải con trỏ và không phải người cộng tác giả: `PresenceOverlay` lọc
 *   `!person.isSelf` nên ở chế độ mock KHÔNG con trỏ nào được vẽ. Thứ chặn là
 *   **thanh hiện diện của CHÍNH BẠN** — `visibleCollaborators` luôn chứa
 *   `isSelf`, nên nút ảnh đại diện 36 × 36 ở `right-4 top-4` luôn được dựng, và
 *   nó rơi trọn vào ô ViewCube 72 × 72 ở `right-2 top-2`, tại `Z_INDEX.panel`
 *   (20) so với z tự động của ViewCube.
 *
 *   Hệ quả của cái sai: P2 bị xếp vào nợ "chờ thẩm định lại dưới máy chủ không
 *   mock", trong khi bỏ mock đi thì nó vẫn đỏ y nguyên — bạn vẫn là một người
 *   trong danh sách hiện diện. Đây là lỗi SẢN PHẨM, mọi người dùng đều gặp, và
 *   nó đã được chữa ở `Viewer3DOverlays.tsx` (thanh hiện diện xuống dưới cụm
 *   ViewCube + bản đồ nhỏ) cộng với việc khung 280 px của thanh ấy thôi nuốt
 *   chuột ở chỗ nó không vẽ gì.
 * - ~~**Q2** vẫn bị lớp phủ của tour, vì tour hiện ra SAU khi hàm này chờ xong~~
 *   — đúng triệu chứng, nhưng **thiếu mất cơ chế**, và thiếu cơ chế thì không
 *   sửa được. Đo ngày 2026-09-29, hai việc:
 *
 *   1. `settleViewer` chờ **20 giây** mà KHÔNG lần nào thấy nút "bỏ qua". Lý
 *      do nằm ở `useEditorTour.ts:480-483`: một bước chỉ sống khi nó có phím
 *      THẬT *hoặc* neo THẬT. Trên màn 3D, bốn bước kia bám phím
 *      `wallLayerReview.*` và bước còn lại bám neo `[aria-label="Chế độ xem"]`
 *      — lúc màn vừa mở thì không cái nào có, nên `steps.length === 0`, trạng
 *      thái về `empty`, và lớp phủ **không được dựng**. Không có gì để bấm.
 *   2. Mở ô tìm lên thì phím tắt và neo của lớp ấy vào sổ, một bước **sống
 *      lại**, và lớp phủ hiện ngay trên chính cái danh sách vừa mở.
 *
 *   Nên thứ tự đúng là: mở ô tìm TRƯỚC, đóng hướng dẫn SAU, rồi mới gõ —
 *   `findOneRoom` nay làm đúng thế.
 *
 *   Việc thứ ba, thuần lỗi của bài kiểm: hai lượt chờ trong `settleViewer` DÙNG
 *   CHUNG một trần 20 000 ms, cộng lại 40 giây trong một bài có trần 30 giây.
 *   Khi lượt dựng mô hình chạy lâu, bài chết ngay trong `settleViewer` và báo
 *   "Target page… has been closed" — một câu không nói được nó đang chờ gì.
 *   Nay tách làm hai ngân sách: 20 000 cho mô hình, 6 000 cho hướng dẫn.
 *
 * Gốc rễ chung — đúng cho Q2, **không** đúng cho P2: mục 4.10 bật bộ mẫu cho
 * e2e, biến mỗi lượt thành "người dùng lần đầu". Bộ spec này viết cho máy chủ
 * KHÔNG mock và chưa được thẩm định lại dưới chế độ ấy — nợ của một prompt
 * riêng. Vá từng lớp một là đuổi theo một danh sách chưa biết dài bao nhiêu.
 *
 * Bài học từ P2: "cả hai đều là chuyện của chế độ mock" là một lời giải thích
 * gộp, và nó đã che mất một lỗi sản phẩm thật trong hai ngày. Trước khi xếp một
 * bài đỏ vào chung một nợ, hãy đo xem nó có ĐỎ VÌ CÙNG LÝ DO không.
 *
 * Bài học từ Q2: một ghi chú nói ĐÚNG triệu chứng ("tour hiện ra sau") mà không
 * nói cơ chế thì đọc như đã hiểu rồi, và nó chặn người sau đi tìm. Cơ chế thật
 * — bước hướng dẫn sống lại khi neo của nó xuất hiện — mất một lượt chạy có in
 * số ra mới thấy, và nó chỉ ra luôn chỗ phải chèn lượt đóng thứ hai.
 */
async function settleViewer(page: Page): Promise<void> {
  const building = page.getByRole('status').filter({ hasText: 'Đang dựng mô hình' });
  await expect(building).toHaveCount(0, { timeout: VIEWER_READY_TIMEOUT_MS });

  await dismissTour(page, { waitMs: TOUR_APPEAR_TIMEOUT_MS });
}

/** Tải route + dựng mô hình bộ mẫu tốn bao lâu là cùng. */
const VIEWER_READY_TIMEOUT_MS = 20_000;

/**
 * Chờ màn TỰ NÓI rằng cảnh đã tới trạng thái cuối — câu `sr-only` của
 * `Viewer3D.tsx`: "Mô hình 3D đã dựng xong." chỉ có ở `success`/`collapsed`
 * (tức mọi tầng đã dựng, `useViewer3D.ts`), còn vai Người xem thì `forbidden`
 * được xét TRƯỚC `loading` nên lớp "Đang dựng" không bao giờ hiện và câu chờ
 * được là câu của nhánh `forbidden`.
 *
 * KHÔNG dùng "Mô hình đã dựng xong." của thanh trạng thái: câu ấy của vỏ chỉ
 * biết dữ liệu dự án đã tải, không biết cảnh đã dựng.
 *
 * Thay cho `toBeVisible()` trần trên khung nhìn: lượt chờ ấy dùng hạn mặc định
 * 5 s cho một route tải muộn, và đỏ khi nhiều bài cùng giành Vite (đo
 * 2026-10-02: ba bài song song đỏ cả ba ở đúng dòng ấy). Một lượt chờ, một ngân
 * sách — tải route và dựng mô hình nằm chung trong `VIEWER_READY_TIMEOUT_MS`.
 */
async function waitForViewerReady(page: Page): Promise<void> {
  const built = page.getByText('Mô hình 3D đã dựng xong.', { exact: true });
  const viewerRole = page.getByText(
    'Bạn đang xem ở vai người xem nên không sửa được hình học trên mô hình 3D.',
    { exact: true },
  );
  await expect(built.or(viewerRole)).toBeAttached({ timeout: VIEWER_READY_TIMEOUT_MS });
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
  await waitForViewerReady(page);
  await settleViewer(page);
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
 * Lăn chuột VÀO trong khung nhìn, rồi khẳng định mức thu phóng ĐÃ LỚN HƠN. Nhãn
 * ấy do `useViewerShell` định dạng sẵn (A15), nên nó là đầu ra thật của camera
 * chứ không phải một chuỗi màn hình tự bịa.
 *
 * Hai điều đo được ngày 2026-10-05 (NO-208), vì sao bài này đỏ 4/5 lượt khi chạy
 * cùng bài khác:
 * - Camera mở đầu bằng một đoạn chạy về khuôn hình chuẩn, nhãn tự leo lên mức
 *   chuẩn không cần lăn chuột. Bài cũ đọc `before` giữa đoạn chạy ấy: xanh vì sai
 *   lý do khi đoạn chạy còn dở, đỏ khi nó đã xong. Nay chờ nhãn yên rồi mới đo.
 * - Sau bước "quay" (preset "Trên xuống", camera phẳng) cú lăn chuột từng không
 *   đổi nhãn vì `onViewportWheel` chỉ biết `dolly`; nay gọi `zoom` cho góc nhìn phẳng.
 *   Bài "ba việc" vẫn chạy bước này TRƯỚC bước quay (xem chú thích trong bài); thu
 *   phóng ở góc phẳng có bài riêng "thu phóng được ở góc …" ở dưới.
 */
async function stepZoom(page: Page): Promise<void> {
  const viewport = page.getByRole('main', { name: 'Khung nhìn mô hình' });
  const box = await viewport.boundingBox();

  expect(box).not.toBeNull();

  const label = zoomLabel(page);
  const read = async (): Promise<number> => percentOf((await label.innerText()).trim());

  /* Yên = hai lần đọc liên tiếp, cách nhau ZOOM_SETTLE_MS, bằng nhau. */
  let before = await read();
  await expect
    .poll(
      async () => {
        const previous = before;
        before = await read();

        return before === previous;
      },
      { intervals: [ZOOM_SETTLE_MS] },
    )
    .toBe(true);

  await page.mouse.move(box!.x + box!.width / 2, box!.y + box!.height / 2);

  for (let notch = 0; notch < ZOOM_NOTCHES; notch += 1) {
    await page.mouse.wheel(0, -WHEEL_DELTA_PX);
  }

  await expect.poll(read).toBeGreaterThan(before);
}

/** Khoảng đọc lại nhãn thu phóng để biết camera đã yên. */
const ZOOM_SETTLE_MS = 400;

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

  /*
   * Đóng lớp hướng dẫn LẦN NỮA, và đây không phải vá bừa — đo được nó hiện ra
   * ĐÚNG LÚC này.
   *
   * Một bước hướng dẫn chỉ sống khi nó có phím THẬT *hoặc* neo THẬT
   * (`useEditorTour.ts:480-483`); không bước nào sống thì `steps.length === 0`,
   * trạng thái về `empty`, và lớp phủ KHÔNG dựng — nên `settleViewer` chờ đủ
   * 20 giây vẫn không thấy nút "bỏ qua" nào để bấm. Mở ô tìm lên thì phím tắt
   * và neo của màn ấy vào sổ, một bước sống lại, và lớp phủ hiện ngay trên cái
   * danh sách vừa mở — nuốt đúng cú bấm tiếp theo.
   *
   * Nên thứ tự ở đây là cố ý: mở ô tìm TRƯỚC, đóng hướng dẫn SAU, rồi mới gõ.
   */
  await dismissTour(page, { waitMs: TOUR_APPEAR_TIMEOUT_MS });

  await box.fill(ROOM_QUERY);

  const match = page.getByRole('option', { name: new RegExp(ROOM_NAME, 'u') });
  await expect(match).toHaveCount(1);
  // Dòng kết quả in nhãn người đọc, không in mã máy của bộ mẫu (B-V8-45).
  await expect(match).toContainText(ROOM_ID);
  await expect(match).not.toContainText('FIXTURE');

  await match.click();

  /* Bằng chứng nằm NGOÀI ô tìm: panel thanh tra của vỏ đọc kho chọn dùng chung,
     nên tên phòng hiện ở đó nghĩa là phòng ĐÃ ĐƯỢC CHỌN THẬT — không phải ô tìm
     đọc lại chính danh sách của nó. */
  const inspector = page.getByRole('complementary', { name: 'Thanh tra đối tượng' });

  await expect(inspector).toContainText(ROOM_NAME);
  await expect(inspector).toContainText(`phòng ${ROOM_ID}`);
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

  /* Thu phóng TRƯỚC khi quay. `stepRotate` để màn ở "Trên xuống", và ở góc ấy
     thu phóng từng không làm gì (B-V8-01, ba bài ngay dưới). Thứ tự cũ (quay
     rồi mới thu phóng) chỉ xanh khi `before` được đọc lúc camera còn đang bay
     340 ms; máy bận thì đọc sau khi đáp, ra 100 và đỏ (đo 2026-10-02: một lượt
     đỏ trong hai). */
  const zoomMs = await timed('thu phóng', () => stepZoom(page));
  const rotateMs = await timed('quay', () => stepRotate(page));
  const storeyMs = await timed('chọn tầng', () => stepChooseStorey(page));

  logDuration('tổng ba việc', rotateMs + zoomMs + storeyMs);
});

/**
 * Mức thu phóng sau khi camera đã ĐÁP: hai lần đọc cách nhau 400 ms trùng nhau.
 * 400 > 340 ms của một lượt bay (`presets.ts`), nên trùng nhau là đã đứng yên.
 */
async function settledZoomPercent(page: Page): Promise<number> {
  let last = Number.NaN;
  await expect
    .poll(
      async () => {
        const now = percentOf((await zoomLabel(page).innerText()).trim());
        const settled = now === last;
        last = now;
        return settled;
      },
      { intervals: [400] },
    )
    .toBe(true);

  return last;
}

for (const face of ['Trục đo', 'Trên xuống', 'Mặt cắt'] as const) {
  /*
   * B-V8-01 (đã sửa): ở ba góc này cả cuộn chuột lẫn nút "Phóng to" từng để
   * nhãn đứng ở 100%, vì `onViewportWheel` (`useViewerShell.ts`) chỉ biết `dolly`
   * mà `FlatCameraMode` (`lib/three/camera/modes.ts`) chỉ có `zoom`. Nay là bài
   * chặn hồi quy; bài đơn vị cùng lỗi là `[VS-15]` của `ViewerShell.test.tsx`.
   */
  test(`thu phóng được ở góc "${face}" — bằng cuộn chuột và bằng nút`, async ({ page }) => {
    await openViewer(page);

    const cube = page.getByRole('group', { name: 'Khối định hướng' });
    await cube.getByRole('button', { name: face, exact: true }).click();
    await expect(cube.getByRole('button', { name: face, exact: true })).toHaveAttribute(
      'aria-pressed',
      'true',
    );

    const beforeWheel = await settledZoomPercent(page);
    const box = await page.getByRole('main', { name: 'Khung nhìn mô hình' }).boundingBox();
    expect(box).not.toBeNull();
    await page.mouse.move(box!.x + box!.width / 2, box!.y + box!.height / 2);
    for (let notch = 0; notch < ZOOM_NOTCHES; notch += 1) {
      await page.mouse.wheel(0, -WHEEL_DELTA_PX);
    }
    await expect
      .poll(async () => percentOf((await zoomLabel(page).innerText()).trim()))
      .toBeGreaterThan(beforeWheel);

    const beforeButton = await settledZoomPercent(page);
    await page
      .getByRole('group', { name: 'Cụm thu phóng' })
      .getByRole('button', { name: 'Phóng to', exact: true })
      .click();
    await expect
      .poll(async () => percentOf((await zoomLabel(page).innerText()).trim()))
      .toBeGreaterThan(beforeButton);
  });
}

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

  /* Lưới 2 (Chặng 1): Escape bỏ chọn, và panel thanh tra thôi nói về phòng ấy.
     Bài đơn vị chỉ có `fireEvent`; đây là đường đi qua sổ phím tắt thật. */
  await page.keyboard.press('Escape');
  await expect(page.getByRole('complementary', { name: 'Thanh tra đối tượng' })).not.toContainText(
    ROOM_ID,
  );
});

/*
 * Lưới 2 (Chặng 1) — lớp không có route của màn 3D: mở bằng nút nhìn thấy được,
 * `Escape` đóng đúng lớp ấy (A12), đường dẫn không đổi, khung nhìn còn nguyên.
 */
for (const label of ['Diện tích phòng', 'Lịch sử thao tác', 'Thư viện đồ đạc', 'Ai đang xem']) {
  test(`lớp "${label}" mở được bằng nút, Escape đóng nó và chỉ nó (A12)`, async ({ page }) => {
    await openViewer(page);
    const before = page.url();
    const toggle = page.getByRole('button', { name: label, exact: true });

    await toggle.click();
    /* Cú bấm đầu trên màn này có thể gọi lớp hướng dẫn lên — xem `findOneRoom`. */
    await dismissTour(page, { waitMs: TOUR_APPEAR_TIMEOUT_MS });
    await expect(toggle).toHaveAttribute('aria-expanded', 'true');

    await page.keyboard.press('Escape');

    await expect(toggle).toHaveAttribute('aria-expanded', 'false');
    expect(page.url()).toBe(before);
    await expect(page.getByRole('main', { name: 'Khung nhìn mô hình' })).toBeVisible();
  });
}

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
    await expect(inspector).toContainText('Mã đối tượng');
  });
});

/**
 * NO-208 — **khung 280 px của thanh hiện diện không nuốt chuột ở chỗ nó không vẽ gì.**
 *
 * Nút ảnh đại diện chỉ ~36 px nép mép phải, nhưng khung chứa nó rộng 280 px và
 * nằm dưới ViewCube + bản đồ nhỏ — giữa mô hình. Một khung `pointer-events-auto`
 * ở đó là vùng chết vô hình. Điểm đo: tâm hộp của khung (lấy từ DOM), ngay
 * dưới dòng `top-[216px]` — không có gì được vẽ ở đó, nên thứ nhận chuột phải là
 * khung nhìn 3D (`canvas`).
 */
test('thanh hiện diện không nuốt chuột của mô hình ở vùng khung rỗng (NO-208)', async ({ page }) => {
  await openViewer(page);

  const box = await page.getByRole('main', { name: 'Khung nhìn mô hình' }).boundingBox();
  expect(box).not.toBeNull();

  /* Lấy hộp của khung từ DOM rồi mới đo: khung đổi chỗ thì điểm dò đi theo. */
  const frame = await page.locator('div.pointer-events-none.absolute[class*="w-[280px]"]').boundingBox();
  expect(frame).not.toBeNull();

  const x = frame!.x + frame!.width / 2;
  const y = frame!.y + frame!.height / 2;
  expect(x).toBeGreaterThan(box!.x);
  expect(y).toBeGreaterThan(box!.y);
  const hit = await page.evaluate(
    ([px, py]) => document.elementFromPoint(px ?? 0, py ?? 0)?.tagName ?? null,
    [x, y],
  );

  expect(hit).toBe('CANVAS');
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
