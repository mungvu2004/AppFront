import { expect, test } from '@playwright/test';
import type { Page } from '@playwright/test';

import type { DEV_PUBLIC_ROUTE_PATTERNS } from '../src/routes/paths';

import { ROUTE_PATTERNS, UNKNOWN_PATH } from './fixtures/routes';

/**
 * Chặng 1 — lưới chống màn trắng (`docs/notes/e2e/plan.md` mục 6).
 *
 * Mỗi màn có route một bài: mở đúng đường, một mốc neo RIÊNG của màn ấy hiện ra,
 * 0 `pageerror`, 0 `console.error` chưa được giải thích.
 *
 * **Lưới này là lưới an toàn cho tương lai, không phải chặng đi vá lỗ.** Đo
 * 2026-10-02: 35/35 màn tải được, 0 `pageerror`. Nó tồn tại để bắt ngày một màn
 * bắt đầu trắng, nổ, hay rơi vào NotFound.
 *
 * ## Vì sao mốc riêng, không một khẳng định chung
 *
 * Đã đo hai khẳng định chung và cả hai không đủ: "≥1 nút" đỏ ở 7 màn vốn khoẻ
 * (0 nút lúc tải), còn "thân trang có chữ" xanh cả khi màn nổ — 53 container bọc
 * `ScreenErrorBoundary`, nên màn nổ vẫn vẽ chữ dự phòng. Một khoá có trong
 * `paths.ts` mà chưa gắn router cũng rơi vào NotFound và vẫn "có chữ". Mốc riêng
 * bắt được cả ba.
 *
 * ## Bảng là `Record` trên mọi khoá sản phẩm
 *
 * Thêm một route sản phẩm mà quên thêm dòng thì `pnpm typecheck` đỏ — `e2e/` nằm
 * trong `tsconfig.json`. Đường dẫn sinh từ `ROUTE_PATTERNS`, không chép tay.
 *
 * ## `known` — màn mở được nhưng NỘI DUNG đang hỏng
 *
 * Mốc của những dòng ấy neo vào VỎ màn, không neo vào câu báo hỏng, để bài không
 * đóng đinh khiếm khuyết thành hành vi mong muốn. `known` đi vào tên bài, nên một
 * bài xanh không đọc thành "màn chạy được".
 */

type DevPattern = (typeof DEV_PUBLIC_ROUTE_PATTERNS)[number];
type RouteKey = keyof typeof ROUTE_PATTERNS;
type ProductRouteKey = {
  [K in RouteKey]: (typeof ROUTE_PATTERNS)[K] extends DevPattern ? never : K;
}[RouteKey];

type Anchor =
  | {
      readonly role:
        | 'heading'
        | 'region'
        | 'navigation'
        | 'main'
        | 'button'
        | 'list'
        | 'tree'
        | 'status';
      readonly name: string;
    }
  | { readonly text: string }
  | { readonly label: string };

interface Row {
  readonly anchor: Anchor;
  /** Màn mở được nhưng nội dung đang hỏng — vào tên bài. */
  readonly known?: string;
  /** Mặc định `L1`. */
  readonly floorId?: string;
  readonly viewport?: { readonly width: number; readonly height: number };
  /** Một lỗi console được phép, kèm lý do. Lỗi ấy PHẢI xuất hiện — nó là ca tự kiểm của bộ thu. */
  readonly expectedConsole?: { readonly match: RegExp; readonly why: string };
}

const PROJECT_ID = 'project-1';

/** Lần tải đầu của một route bắt Vite dịch nguội; tiền lệ `app.visual.spec.ts`. */
const FIRST_PAINT_TIMEOUT_MS = 15_000;

const QC_SKELETON = 'nội dung treo skeleton — màn QC đọc vòng tròn từ kho rỗng (plan.md 1.4)';

const ROWS = {
  login: { anchor: { role: 'button', name: 'Đăng nhập' } },
  onboarding: { anchor: { role: 'button', name: 'Tạo dự án' } },
  accessDenied: { anchor: { role: 'heading', name: 'bạn chưa có quyền truy cập' } },
  notFound: { anchor: { role: 'heading', name: 'không tìm thấy trang này' } },
  mobileViewer: {
    anchor: { role: 'region', name: 'xem mô hình 3D trên điện thoại' },
    viewport: { width: 390, height: 844 },
  },
  notifications: {
    anchor: { role: 'heading', name: 'Thông báo' },
    expectedConsole: {
      match: /\/api\/streams\/notifications/u,
      why: 'bộ mẫu dev không có luồng SSE thông báo — 404',
    },
  },
  dashboard: { anchor: { role: 'heading', name: 'Dự án của tôi' } },
  projectSettings: { anchor: { role: 'heading', name: 'cài đặt dự án' } },
  account: { anchor: { role: 'heading', name: 'cài đặt tài khoản' } },
  billing: { anchor: { role: 'heading', name: 'Thanh toán' } },
  adminUsers: { anchor: { text: 'ma trận quyền theo vai trò' } },
  adminModels: { anchor: { label: 'tìm model' } },
  projectUpload: { anchor: { role: 'navigation', name: 'Tải lên bản vẽ' } },
  projectQuality: { anchor: { role: 'region', name: 'Báo cáo chất lượng' } },
  projectPipeline: {
    anchor: { role: 'navigation', name: 'Xử lý' },
    known: 'danh sách lượt xử lý luôn rỗng — route không truyền floorUploads (plan.md V4)',
  },
  projectPipelineGraph: { anchor: { role: 'heading', name: 'Sơ đồ xử lý' } },
  projectScale: { anchor: { role: 'heading', name: 'Hiệu chỉnh tỷ lệ' } },
  projectCadConfirm: { anchor: { role: 'heading', name: 'Phát hiện tệp CAD' } },
  projectWalls: { anchor: { role: 'region', name: 'Duyệt lớp tường' }, known: QC_SKELETON },
  projectObjects: { anchor: { role: 'region', name: 'lớp đối tượng' }, known: QC_SKELETON },
  projectDimensions: { anchor: { role: 'region', name: 'đọc kích thước OCR' }, known: QC_SKELETON },
  projectGrids: {
    anchor: { role: 'heading', name: 'quản lý trục và gốc toạ độ' },
    known: QC_SKELETON,
  },
  projectRooms: { anchor: { role: 'heading', name: 'duyệt tên phòng' } },
  projectFloors: { anchor: { role: 'heading', name: 'quản lý tầng' }, known: QC_SKELETON },
  projectThickness: { anchor: { role: 'heading', name: 'chuẩn hoá độ dày tường' } },
  projectOverlay: { anchor: { role: 'region', name: 'Màn đối chiếu bản vẽ' } },
  projectViewer: { anchor: { role: 'main', name: 'Khung nhìn mô hình' } },
  projectExploded: { anchor: { role: 'main', name: 'Khung nhìn mô hình' } },
  projectMeasure: { anchor: { role: 'main', name: 'Khung nhìn mô hình' } },
  projectViewerPascal: { anchor: { text: 'màn xem 3D mới chưa bật cho tài khoản này.' } },
  projectRules: { anchor: { role: 'heading', name: 'Kiểm tra luật không gian' } },
  projectRuleSettings: { anchor: { role: 'heading', name: 'cài đặt bộ luật không gian' } },
  projectExport: {
    anchor: { role: 'heading', name: 'chưa có gì được duyệt để xuất' },
    known: 'chưa có gì được duyệt — kho rỗng',
  },
  projectData: { anchor: { label: 'Tìm theo khoá hoặc giá trị' } },
  projectVersions: { anchor: { role: 'navigation', name: 'Danh sách phiên bản' } },
} as const satisfies Record<ProductRouteKey, Row>;

function pathFor(key: ProductRouteKey, row: Row): string {
  const pattern: string = ROUTE_PATTERNS[key];
  if (pattern === '*') return UNKNOWN_PATH;
  return pattern.replace(':projectId', PROJECT_ID).replace(':floorId', row.floorId ?? 'L1');
}

function locate(page: Page, anchor: Anchor) {
  if ('role' in anchor) return page.getByRole(anchor.role, { name: anchor.name, exact: true });
  if ('text' in anchor) return page.getByText(anchor.text, { exact: true });
  return page.getByLabel(anchor.label, { exact: true });
}

for (const [key, row] of Object.entries(ROWS) as [ProductRouteKey, Row][]) {
  const title =
    row.known === undefined
      ? `màn ${key} mở được, không trắng, không lỗi`
      : `màn ${key} mở được (đã biết: ${row.known})`;

  test(title, async ({ page }) => {
    const consoleErrors: string[] = [];
    const pageErrors: string[] = [];
    page.on('console', (message) => {
      /* Không lọc gì cho mọi màn: lỗi `/favicon.ico` 404 từng phải lọc ở đây đã được
         chữa ở gốc — `index.html` có thẻ icon (B-G-03). */
      if (message.type() !== 'error') return;
      consoleErrors.push(`${message.text()} @ ${message.location().url}`);
    });
    page.on('pageerror', (error) => pageErrors.push(error.message));

    await page.setViewportSize(row.viewport ?? { width: 1440, height: 900 });
    await page.goto(pathFor(key, row));

    await expect(locate(page, row.anchor).first()).toBeVisible({ timeout: FIRST_PAINT_TIMEOUT_MS });

    const expected = row.expectedConsole;
    if (expected !== undefined) {
      await expect
        .poll(() => consoleErrors.some((line) => expected.match.test(line)), {
          message: `chờ lỗi đã biết (${expected.why}) — không thấy nghĩa là bộ thu console hỏng`,
        })
        .toBe(true);
    }

    expect(pageErrors).toEqual([]);
    expect(
      consoleErrors.filter((line) => expected === undefined || !expected.match.test(line)),
    ).toEqual([]);
  });
}

/*
 * Lưới 2 — lớp không có route. Phần trên màn 3D nằm ở `viewer3d.spec.ts` (dùng
 * lại `openViewer`); ở đây là lớp duy nhất mở từ bảng điều khiển. Đơn vị có 0
 * bài `Escape` cho hộp thoại này (plan.md V3 mục 2).
 */
test('hộp thoại tạo dự án mở từ nút "Dự án mới", Escape đóng nó và chỉ nó (A12)', async ({
  page,
}) => {
  await page.goto(ROUTE_PATTERNS.dashboard);
  await page.getByRole('button', { name: 'Dự án mới' }).click({ timeout: FIRST_PAINT_TIMEOUT_MS });

  const dialog = page.getByRole('dialog');
  await expect(dialog).toHaveCount(1);

  await page.keyboard.press('Escape');

  await expect(dialog).toHaveCount(0);
  expect(new URL(page.url()).pathname).toBe(ROUTE_PATTERNS.dashboard);
  await expect(page.getByRole('heading', { name: 'Dự án của tôi', exact: true })).toBeVisible();
});
