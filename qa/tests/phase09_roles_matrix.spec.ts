/**
 * Phase 9: Role matrix (E2E-TEST-PLAN.md v2, §4 Phase 9). **Track B only (mock).**
 *
 * Prerequisite (started by the user, never by this file; see scripts/run-playwright.mjs):
 *   VITE_USE_MOCK_API=true pnpm exec vite --host 127.0.0.1 --port 5173 --strictPort
 * Target: `MOCK_BASE_URL` (`E2E_MOCK_BASE_URL`, default http://127.0.0.1:5173).
 *
 * Roles come from the email (`signInAs`, e2e/fixtures/session.ts → `roleOfEmail`,
 * src/api/__mocks__/client.ts). The mock session is a module variable, so every row signs in
 * again with its destination (`?next=`) and never `goto`s a second time (session.ts docblock).
 * One fresh browser context per role (G4: no logout in the product shell).
 *
 * No runtime-session.json is read or written. Ids are mock fixture ids only (constants below).
 * Every forbidden/read-only string below was checked in src/ (file named next to each const).
 */
import { expect, test, type Browser, type BrowserContext, type Page } from '@playwright/test';

import { ROUTES } from '../../e2e/fixtures/routes';
import { seedSpatial } from '../../e2e/fixtures/seedSpatial';
import { signInAs } from '../../e2e/fixtures/session';
import { dismissTour } from '../../e2e/fixtures/tour';
import { MOCK_BASE_URL } from './support/auth';
import { captureEvidence } from './support/evidence';

test.describe.configure({ mode: 'serial' });
test.use({ baseURL: MOCK_BASE_URL });

const VIEWPORT = { width: 1440, height: 900 } as const;

/** First paint of a lazy route on a cold Vite server; same value as e2e/v12b/firstPaint.ts. */
const FIRST_PAINT_TIMEOUT_MS = 15_000;

/* ---- Mock fixture ids (never invented) ---------------------------------------------------- */

/** `buildProject().id`, src/api/__mocks__/client.ts; members admin@/engineer@/viewer@example.com. */
const PROJECT_ID = 'project-1';
/** Mock floor `L1` (client.ts `makeFloor`, `makeMeasuredFloors`); used by e2e/cross/viewer-role.spec.ts. */
const FLOOR_L1 = 'L1';
/** Mock floor `L2` (client.ts `makeMeasuredFloors`); scale forbidden copy only shows here (e2e/v4v5/scale.spec.ts). */
const FLOOR_L2 = 'L2';
/** A14 sample level with a layer (e2e/v6/wall-layer-review.spec.ts, object-layer-review.spec.ts, v7/thickness). */
const A14_FLOOR = 'L-LEVEL000001';
/** 12 walls on A14_FLOOR (e2e/v6/wall-layer-review.spec.ts `A14_WALLS_ON_FLOOR`). */
const A14_WALLS_ON_FLOOR = 12;
/** Dashboard card from the mock summaries (e2e/v2v3/dashboard.spec.ts `SUNRISE`). */
const SUNRISE = 'Chung cư Sunrise Block B';

/* ---- Copy, verified in source --------------------------------------------------------------- */

/** ProjectDashboard.tsx:223 */
const DASHBOARD_VIEWER_LINE = 'Vai người xem: chỉ có thể mở dự án, không tạo hoặc xoá được.';
/** ProjectSettings.tsx:93 */
const SETTINGS_READ_ONLY = 'Vai hiện tại chỉ xem được cài đặt, không sửa và không xoá.';
/** FloorManager.tsx:67 (InlineAlert title → h4) */
const FLOORS_FORBIDDEN_TITLE = 'Không có quyền sửa tầng';
/** FloorTable.tsx:68 */
const ADD_FLOOR = 'Thêm tầng';
/** useFloorUploadScreen.ts:108 */
const UPLOAD_READ_ONLY = 'Vai hiện tại chỉ được xem danh sách tệp, không tải lên và không sửa.';
/** useFloorUploadScreen.ts COPY.selectFile; FloorUploadDropZone.tsx test ids */
const UPLOAD_SELECT_FILE = 'Chọn tệp';
const UPLOAD_DROPZONE_TEST_ID = 'floor-upload-dropzone';
const UPLOAD_INPUT_TEST_ID = 'floor-upload-file-input';
/** useWallLayerReview.ts:207 (rendered by WallLayerInspector.tsx:196 once a wall is selected) */
const WALLS_VIEWER_NOTICE =
  'Bạn đang xem với vai người xem, nên không duyệt hay sửa được đoạn tường nào. Nhờ người có quyền sửa dự án duyệt giúp.';
/** WallLayerInspector.tsx:48-49 */
const WALL_APPROVE = 'Duyệt đoạn này';
const WALL_THICKNESS = 'Độ dày tường';
/** ScaleCalibration.tsx:75 */
const SCALE_FORBIDDEN_TITLE = 'Bạn không có quyền hiệu chỉnh tỷ lệ';
/** ObjectLayerReview.tsx:65, ObjectLayerToolRail.tsx RAIL_ARIA_LABEL + "Chọn nhóm … (phím …)" buttons */
const OBJECTS_REGION = 'Lớp đối tượng';
const OBJECTS_RAIL = 'Công cụ lớp đối tượng';
/** RoomLabelReview.tsx:88 */
const ROOMS_FORBIDDEN_TITLE = 'Không có quyền sửa lớp phòng';
/** ThicknessStandardization.tsx:111 */
const THICKNESS_FORBIDDEN_TITLE = 'Không có quyền sửa độ dày tường';
/** ExportPanel.tsx:199, :236; ExportPanelFooter.tsx:69 */
const EXPORT_FORBIDDEN_TITLE = 'Không có quyền xuất bản vẽ';
const EXPORT_HEADING = 'Xuất bản vẽ';
const EXPORT_BUTTON = 'Xuất';
/** versionHistoryModel.ts:463 RESTORE_FORBIDDEN_REASON; VersionHistory.tsx:160,173; VersionList.tsx */
const VERSIONS_READ_ONLY = 'Vai trò của bạn trên dự án này chỉ đọc được lịch sử, nên nút phục hồi không hiện';
const VERSION_RESTORE = 'Phục hồi phiên bản này';
const VERSION_LABEL = 'Gắn nhãn phiên bản này';
const VERSION_LIST = 'Danh sách phiên bản';
/** useMeasurementTool.ts:202; MeasurementTool.tsx; ViewerToolRail.tsx; ViewerViewport.tsx (labels as e2e/v9/measure.spec.ts) */
const MEASURE_PIN_BLOCKED =
  'Bạn chỉ có quyền xem dự án này, nên chưa ghim được phép đo. vẫn đo và đọc số bình thường.';
const MEASURE_PIN = 'Ghim phép đo (phím Enter)';
const MEASURE_TOOL = 'đo (M)';
const VIEWER_RAIL = 'Công cụ khung nhìn';
const VIEWER_VIEWPORT = 'Khung nhìn mô hình';
/** Status bar of the viewer fixture (e2e/v9/v9.ts FIXTURE_STATUS). */
const VIEWER_FIXTURE_STATUS = '4 tầng · 14 phòng · 248,60 m²';
/** SpatialJsonViewer.tsx:44 and its search box label */
const JSON_FORBIDDEN_TITLE = 'Không có quyền xem dữ liệu';
const JSON_SEARCH = 'Tìm theo khoá hoặc giá trị';
/** RuleReport.tsx (h1 "Kiểm tra luật không gian", :302 rerun, :355 confirm) */
const RULES_HEADING = 'Kiểm tra luật không gian';
const RULES_RERUN = 'Chạy kiểm tra lại';
const RULES_CONFIRM = 'Xác nhận đã xử lý';
/** ruleSettingsGateway.ts:97 RULE_SETTINGS_READ_ONLY_REASON; RuleSettings.tsx; RuleSettingsRow.tsx */
const RULE_SETTINGS_HEADING = 'Cài đặt bộ luật không gian';
const RULE_SETTINGS_READ_ONLY = 'Chỉ quản trị viên đổi được bộ luật; bạn đang xem ở quyền chỉ đọc.';
const OPENING_RULE_SWITCH = /^Bật hoặc tắt luật: lỗ mở nằm trọn/u;
/** TrainingJobs.tsx:37-38, ModelRegistry.tsx:38-39 (EmptyState title → h3) */
const ADMIN_FORBIDDEN_TITLE = 'Không có quyền truy cập';
const TRAINING_FORBIDDEN_BODY = 'Chỉ quản trị viên hệ thống xem được trang huấn luyện.';
const REGISTRY_FORBIDDEN_BODY = 'Chỉ quản trị viên hệ thống xem được model AI.';
/** useUserManagement.ts:141; UserManagement.tsx */
const USERS_FORBIDDEN =
  'Vai của bạn chưa quản lý được người dùng nên danh sách tài khoản không hiện; bảng dưới đây cho biết mỗi vai làm được những việc gì';
const USERS_MATRIX = 'Ma trận quyền theo vai trò';
const USERS_INVITE = 'Mời người dùng';
/** pipelineGraphText.ts:212 */
const PIPELINE_GRAPH_FORBIDDEN_LINE =
  'Chế độ chi tiết kỹ thuật chỉ mở cho vai quản trị, nên phần đó và nút đổi nhánh không hiện ở đây.';
/** useModelLibrary.ts:103; ModelLibraryToolbar.tsx "tìm model"; mock model "bàn ăn sáu chỗ" (client.ts) */
const LIBRARY_READ_ONLY = 'Vai trò của bạn chỉ xem được thư viện, nên mọi hành động sửa danh mục không hiện';
const LIBRARY_SEARCH = 'tìm model';
const LIBRARY_SAMPLE_MODEL = 'bàn ăn sáu chỗ';
/** useProjectSettings.ts:494 */
const SETTINGS_DANGER_TAB = 'Vùng nguy hiểm';

/* ---- Phase-local helpers ---------------------------------------------------------------------- */

function note(type: string, description: string): void {
  test.info().annotations.push({ type, description });
}

async function newRolePage(browser: Browser): Promise<[BrowserContext, Page]> {
  const context = await browser.newContext({ baseURL: MOCK_BASE_URL, viewport: VIEWPORT });
  return [context, await context.newPage()];
}

/** Copied from e2e/v9/measure.spec.ts `clickSceneCentre` (never import a spec). */
async function clickSceneCentre(page: Page): Promise<void> {
  await expect(page.getByLabel(VIEWER_VIEWPORT)).toHaveAttribute('aria-busy', 'false', {
    timeout: FIRST_PAINT_TIMEOUT_MS,
  });
  const box = await page.locator('canvas').first().boundingBox();
  if (box === null) throw new Error('canvas has no bounding box: the 3D scene is not mounted');
  await page.mouse.click(box.x + box.width / 2, box.y + box.height / 2);
}

/* ---- Environment probe ------------------------------------------------------------------------ */

test.beforeAll(async () => {
  try {
    const response = await fetch(MOCK_BASE_URL);
    if (!response.ok) throw new Error(`HTTP ${String(response.status)}`);
  } catch (error) {
    throw new Error(
      `Track B mock dev server not reachable at ${MOCK_BASE_URL} (${String(error)}). Start it first: ` +
        '`VITE_USE_MOCK_API=true pnpm exec vite --host 127.0.0.1 --port 5173 --strictPort` ' +
        '(or set E2E_MOCK_BASE_URL).',
    );
  }
});

/* ============================================================================================ */
/* Role V (viewer@example.com)                                                                   */
/* ============================================================================================ */

test.describe('Role V (viewer)', () => {
  let context: BrowserContext;
  let page: Page;

  test.beforeAll(async ({ browser }) => {
    [context, page] = await newRolePage(browser);
  });

  test.afterAll(async () => {
    await context.close();
  });

  test.describe('SCR-05 Dashboard', () => {
    test('SCR-05 [V] "Dự án mới" hidden; card menu "Xoá" disabled; viewer line', async () => {
      await signInAs(page, 'viewer', ROUTES.dashboard);
      await expect(page.getByText(DASHBOARD_VIEWER_LINE, { exact: true })).toBeVisible({
        timeout: FIRST_PAINT_TIMEOUT_MS,
      });
      await expect(page.getByRole('button', { name: 'Dự án mới' })).toHaveCount(0);

      // Opening the card menu is safe; "Xoá" is asserted disabled, not clicked.
      await page.getByRole('button', { name: `Tuỳ chọn cho ${SUNRISE}`, exact: true }).click();
      const remove = page.getByRole('menu').getByRole('menuitem', { name: 'Xoá' });
      await expect(remove).toBeDisabled();
      await expect(remove).toHaveAttribute('aria-disabled', 'true');
      await captureEvidence(page, 'R-V_05.png');
      await page.keyboard.press('Escape');
    });
  });

  test.describe('SCR-08 Project Settings', () => {
    test('SCR-08 [V] edit controls: read-only line, no textbox, no "Vùng nguy hiểm"', async () => {
      await signInAs(page, 'viewer', ROUTES.project.settings(PROJECT_ID));
      await expect(page.getByText(SETTINGS_READ_ONLY, { exact: true })).toBeVisible({ timeout: FIRST_PAINT_TIMEOUT_MS });
      await expect(page.getByRole('tab')).toHaveCount(3);
      await expect(page.getByRole('tab', { name: SETTINGS_DANGER_TAB })).toHaveCount(0);
      // Read-only `Input` renders text instead of an input (e2e/v2v3/project-settings.spec.ts).
      await expect(page.getByRole('textbox')).toHaveCount(0);
      await captureEvidence(page, 'R-V_08.png');
    });
  });

  test.describe('SCR-09 Floor Manager', () => {
    test('SCR-09 [V] edit controls: "Không có quyền sửa tầng", no "Thêm tầng"', async () => {
      await signInAs(page, 'viewer', ROUTES.project.floors(PROJECT_ID));
      await expect(page.getByRole('heading', { name: FLOORS_FORBIDDEN_TITLE, exact: true })).toBeVisible({
        timeout: FIRST_PAINT_TIMEOUT_MS,
      });
      await expect(page.getByRole('button', { name: ADD_FLOOR, exact: true })).toHaveCount(0);
      await captureEvidence(page, 'R-V_09.png');
    });
  });

  test.describe('SCR-10 Floor Upload', () => {
    test('SCR-10 [V] edit controls: read-only line, no dropzone / file input', async () => {
      await signInAs(page, 'viewer', ROUTES.project.upload(PROJECT_ID));
      await expect(page.getByText(UPLOAD_READ_ONLY, { exact: true })).toBeVisible({ timeout: FIRST_PAINT_TIMEOUT_MS });
      await expect(page.getByRole('heading', { name: 'Tầng 1' })).toBeVisible();
      await expect(page.getByTestId(UPLOAD_INPUT_TEST_ID)).toHaveCount(0);
      await expect(page.getByTestId(UPLOAD_DROPZONE_TEST_ID)).toHaveCount(0);
      await captureEvidence(page, 'R-V_10.png');
    });
  });

  test.describe('SCR-16 Wall Layer Review', () => {
    test('SCR-16 [V] edit controls: selected wall shows the viewer notice, no approve button', async () => {
      await signInAs(page, 'viewer', ROUTES.project.walls(PROJECT_ID, A14_FLOOR));
      const list = page.getByRole('listbox', { name: 'Danh sách đoạn tường' });
      await expect(list.getByRole('option')).toHaveCount(A14_WALLS_ON_FLOOR, { timeout: FIRST_PAINT_TIMEOUT_MS });
      await dismissTour(page);

      // Selection is read-only; the notice lives in the inspector, which needs a selected wall.
      await list.getByRole('option').first().click();
      await expect(page.getByText(WALLS_VIEWER_NOTICE, { exact: true })).toBeVisible();
      await expect(page.getByRole('button', { name: WALL_APPROVE })).toHaveCount(0);
      await expect(page.getByRole('radiogroup', { name: WALL_THICKNESS })).toHaveCount(0);
      await captureEvidence(page, 'R-V_16.png');
    });
  });

  test.describe('SCR-14 Scale Calibration', () => {
    test('SCR-14 [V] edit controls: "Bạn không có quyền hiệu chỉnh tỷ lệ", no "Áp dụng tỷ lệ"', async () => {
      // Floor L2: on L1 the "Nắn ảnh thất bại…" error precedes `forbidden` (e2e/cross/viewer-role.spec.ts note).
      await signInAs(page, 'viewer', ROUTES.project.scale(PROJECT_ID, FLOOR_L2));
      await expect(page.getByRole('heading', { name: SCALE_FORBIDDEN_TITLE, exact: true })).toBeVisible({
        timeout: FIRST_PAINT_TIMEOUT_MS,
      });
      await expect(page.getByRole('img', { name: 'Bản vẽ đã nắn của Tầng 2' })).toBeVisible();
      await expect(page.getByRole('button', { name: 'Áp dụng tỷ lệ' })).toHaveCount(0);
      await captureEvidence(page, 'R-V_14.png');
    });
  });

  test.describe('SCR-17 Object Layer Review', () => {
    test('SCR-17 [V] edit controls: tool rail has no "Chọn nhóm…" tools', async () => {
      note(
        'source',
        'Plan says "tools disabled"; source hides them (ObjectLayerToolRail.tsx `!isViewerRole &&`) and drops the canvas edit callbacks.',
      );
      await signInAs(page, 'viewer', ROUTES.project.objects(PROJECT_ID, A14_FLOOR));
      await expect(page.getByRole('region', { name: OBJECTS_REGION, exact: true })).toBeVisible({
        timeout: FIRST_PAINT_TIMEOUT_MS,
      });
      // Store loaded: the counter has a non-zero denominator (e2e/v6/object-layer-review.spec.ts).
      await expect(
        page.getByRole('status', { name: 'Thanh trạng thái' }).getByText(/^\d+\/[1-9]\d* đối tượng đã duyệt$/u),
      ).toBeVisible({ timeout: FIRST_PAINT_TIMEOUT_MS });
      const rail = page.getByRole('toolbar', { name: OBJECTS_RAIL });
      await expect(rail).toHaveCount(1);
      await expect(rail.getByRole('button')).toHaveCount(0);
      await captureEvidence(page, 'R-V_17.png');
    });
  });

  test.describe('SCR-20 Room Label Review', () => {
    test('SCR-20 [V] edit controls: "Không có quyền sửa lớp phòng"', async () => {
      await signInAs(page, 'viewer', ROUTES.project.rooms(PROJECT_ID, FLOOR_L1));
      await expect(page.getByRole('heading', { name: ROOMS_FORBIDDEN_TITLE, exact: true })).toBeVisible({
        timeout: FIRST_PAINT_TIMEOUT_MS,
      });
      await captureEvidence(page, 'R-V_20.png');
    });
  });

  test.describe('SCR-21 Thickness Standardization', () => {
    test('SCR-21 [V] edit controls: "Không có quyền sửa độ dày tường"', async () => {
      await signInAs(page, 'viewer', ROUTES.project.thickness(PROJECT_ID, A14_FLOOR));
      await expect(page.getByRole('heading', { name: THICKNESS_FORBIDDEN_TITLE, exact: true })).toBeVisible({
        timeout: FIRST_PAINT_TIMEOUT_MS,
      });
      await captureEvidence(page, 'R-V_21.png');
    });
  });

  test.describe('SCR-30 Export', () => {
    test('SCR-30 [V] "Xuất": "Không có quyền xuất bản vẽ", no "Xuất"', async () => {
      await signInAs(page, 'viewer', ROUTES.project.export(PROJECT_ID));
      await expect(page.getByRole('heading', { name: EXPORT_FORBIDDEN_TITLE, exact: true })).toBeVisible({
        timeout: FIRST_PAINT_TIMEOUT_MS,
      });
      await expect(page.getByRole('button', { name: EXPORT_BUTTON, exact: true })).toHaveCount(0);
      await captureEvidence(page, 'R-V_30.png');
    });
  });

  test.describe('SCR-32 Version History', () => {
    test('SCR-32 [V] restore and label absent; read-only history reason', async () => {
      await signInAs(page, 'viewer', ROUTES.project.versions(PROJECT_ID));
      await expect(page.getByRole('navigation', { name: VERSION_LIST })).toBeVisible({ timeout: FIRST_PAINT_TIMEOUT_MS });
      await expect(page.getByText(VERSIONS_READ_ONLY, { exact: true })).toBeVisible();
      await expect(page.getByRole('button', { name: VERSION_RESTORE })).toHaveCount(0);
      await expect(page.getByRole('button', { name: VERSION_LABEL })).toHaveCount(0);
      await captureEvidence(page, 'R-V_32.png');
    });
  });

  test.describe('SCR-25 Measure (gap)', () => {
    test('SCR-25 [V] gap: measuring works, pinning is blocked in the FE', async () => {
      note(
        'gap',
        'F-12 says Measure has no FE can(). Source today: useMeasurementTool.ts:787 `canPin = shell.state !== "forbidden"` ' +
          'shows PIN_BLOCKED_CAPTION and disables the pin button. BE 403 cannot be observed in Track B (in-process mock).',
      );
      await signInAs(page, 'viewer', ROUTES.project.measure(PROJECT_ID));
      await expect(page.getByText(VIEWER_FIXTURE_STATUS, { exact: true })).toBeVisible({
        timeout: FIRST_PAINT_TIMEOUT_MS,
      });
      await expect(page.getByRole('alert').filter({ hasText: MEASURE_PIN_BLOCKED })).toHaveCount(1);

      await page.keyboard.press('m');
      await expect(page.getByRole('toolbar', { name: VIEWER_RAIL }).getByRole('button', { name: MEASURE_TOOL })).toHaveAttribute(
        'aria-pressed',
        'true',
      );
      // A draft measurement (local, no write) makes the pin button render: it must be disabled.
      await clickSceneCentre(page);
      await expect(page.getByRole('button', { name: MEASURE_PIN })).toBeDisabled();
      await captureEvidence(page, 'R-V_25_gap.png');
    });
  });

  test.describe('SCR-31 Spatial JSON (gap)', () => {
    test('SCR-31 [V] gap: JSON viewer loads for a viewer (ungated)', async () => {
      note('gap', 'SpatialJsonViewer.container.tsx:140 `canView = roles.length > 0`: any role reads the JSON (F-12).');
      await signInAs(page, 'viewer', ROUTES.project.data(PROJECT_ID));
      await expect(page.getByLabel(JSON_SEARCH)).toBeVisible({ timeout: FIRST_PAINT_TIMEOUT_MS });
      // Server floor names in the preview prove the data loaded (e2e/v12a/data.spec.ts).
      await expect(page.getByText(/"name": "Tầng hầm"/u)).toBeVisible({ timeout: FIRST_PAINT_TIMEOUT_MS });
      await expect(page.getByText(JSON_FORBIDDEN_TITLE, { exact: true })).toHaveCount(0);
      await captureEvidence(page, 'R-V_31_gap.png');
    });
  });

  test.describe('SCR-28 Rule Report (gap)', () => {
    test('SCR-28 [V] gap: rules report is ungated, viewer gets rerun + confirm controls', async () => {
      note(
        'gap',
        'F-03: RuleReport `canEdit` defaults to true (useRuleReport.ts:367) and the route passes nothing, so a viewer ' +
          'never reaches `forbidden` and sees "Chạy kiểm tra lại" and the "Xác nhận đã xử lý" footer.',
      );
      await signInAs(page, 'viewer', ROUTES.project.rules(PROJECT_ID));
      await expect(page.getByRole('heading', { name: RULES_HEADING })).toBeVisible({ timeout: FIRST_PAINT_TIMEOUT_MS });
      await expect(page.getByRole('button', { name: RULES_RERUN })).toBeVisible({ timeout: FIRST_PAINT_TIMEOUT_MS });
      await expect(page.getByRole('button', { name: RULES_CONFIRM })).toHaveCount(1);
      await captureEvidence(page, 'R-V_28_gap.png');
    });
  });

  test.describe('SCR-29 Rule Settings', () => {
    test('SCR-29 [V] load: read-only reason, rule switch disabled', async () => {
      await signInAs(page, 'viewer', ROUTES.project.ruleSettings(PROJECT_ID));
      await expect(page.getByRole('heading', { name: RULE_SETTINGS_HEADING })).toBeVisible({
        timeout: FIRST_PAINT_TIMEOUT_MS,
      });
      await expect(page.getByText(RULE_SETTINGS_READ_ONLY, { exact: true })).toBeVisible();
      await expect(page.getByRole('switch', { name: OPENING_RULE_SWITCH })).toBeDisabled();
      await captureEvidence(page, 'R-V_29.png');
    });
  });

  test.describe('SCR-35 Training Jobs', () => {
    test('SCR-35 [V] load: "Không có quyền truy cập"', async () => {
      await signInAs(page, 'viewer', ROUTES.adminTrainingJobs);
      await expect(page.getByRole('heading', { name: ADMIN_FORBIDDEN_TITLE, exact: true })).toBeVisible({
        timeout: FIRST_PAINT_TIMEOUT_MS,
      });
      await expect(page.getByText(TRAINING_FORBIDDEN_BODY, { exact: true })).toBeVisible();
      await captureEvidence(page, 'R-V_35.png');
    });
  });

  test.describe('SCR-36 Model Registry', () => {
    test('SCR-36 [V] load: "Không có quyền truy cập"', async () => {
      await signInAs(page, 'viewer', ROUTES.adminTrainingModels);
      await expect(page.getByRole('heading', { name: ADMIN_FORBIDDEN_TITLE, exact: true })).toBeVisible({
        timeout: FIRST_PAINT_TIMEOUT_MS,
      });
      await expect(page.getByText(REGISTRY_FORBIDDEN_BODY, { exact: true })).toBeVisible();
      await captureEvidence(page, 'R-V_36.png');
    });
  });

  test.describe('SCR-37 User Management', () => {
    test('SCR-37 [V] load: permission matrix only, no user rows', async () => {
      await signInAs(page, 'viewer', ROUTES.adminUsers);
      await expect(page.getByRole('alert').filter({ hasText: USERS_FORBIDDEN })).toBeVisible({
        timeout: FIRST_PAINT_TIMEOUT_MS,
      });
      await expect(page.getByText(USERS_MATRIX)).toBeVisible();
      await expect(page.getByRole('row')).toHaveCount(0);
      await expect(page.getByRole('button', { name: USERS_INVITE })).toHaveCount(0);
      await captureEvidence(page, 'R-V_37.png');
    });
  });
});

/* ============================================================================================ */
/* Role E (engineer@example.com)                                                                 */
/* ============================================================================================ */

test.describe('Role E (engineer)', () => {
  let context: BrowserContext;
  let page: Page;

  test.beforeAll(async ({ browser }) => {
    [context, page] = await newRolePage(browser);
  });

  test.afterAll(async () => {
    await context.close();
  });

  test.describe('SCR-29 Rule Settings', () => {
    test('SCR-29 [E] edit controls: "Chỉ quản trị viên đổi được bộ luật…", switch disabled', async () => {
      await signInAs(page, 'engineer', ROUTES.project.ruleSettings(PROJECT_ID));
      await expect(page.getByRole('heading', { name: RULE_SETTINGS_HEADING })).toBeVisible({
        timeout: FIRST_PAINT_TIMEOUT_MS,
      });
      await expect(page.getByText(RULE_SETTINGS_READ_ONLY, { exact: true })).toBeVisible();
      await expect(page.getByRole('switch', { name: OPENING_RULE_SWITCH })).toBeDisabled();
      await captureEvidence(page, 'R-E_29.png');
    });
  });

  test.describe('SCR-37 User Management', () => {
    test('SCR-37 [E] edit controls: "Vai của bạn chưa quản lý được người dùng…", no rows', async () => {
      await signInAs(page, 'engineer', ROUTES.adminUsers);
      await expect(page.getByRole('alert').filter({ hasText: USERS_FORBIDDEN })).toBeVisible({
        timeout: FIRST_PAINT_TIMEOUT_MS,
      });
      await expect(page.getByRole('row')).toHaveCount(0);
      await expect(page.getByRole('button', { name: USERS_INVITE })).toHaveCount(0);
      await captureEvidence(page, 'R-E_37.png');
    });
  });

  test.describe('SCR-13 Pipeline Graph', () => {
    test('SCR-13 [E] load: technical-detail forbidden line', async () => {
      await signInAs(page, 'engineer', ROUTES.project.pipelineGraph(PROJECT_ID));
      await expect(page.getByText(PIPELINE_GRAPH_FORBIDDEN_LINE, { exact: true })).toBeVisible({
        timeout: FIRST_PAINT_TIMEOUT_MS,
      });
      await captureEvidence(page, 'R-E_13.png');
    });
  });

  test.describe('SCR-34 Model Library', () => {
    test('SCR-34 [E] load: library read-only for engineer', async () => {
      note(
        'source',
        'Plan says "Library forbidden (library.manage)". Source: ModelLibrary is not blocked; non-admins get the ' +
          'read-only banner (useModelLibrary.ts:103) and the table still renders (e2e/v12b/admin-models.spec.ts MD-F).',
      );
      await signInAs(page, 'engineer', ROUTES.adminModels);
      await expect(page.getByRole('textbox', { name: LIBRARY_SEARCH })).toBeVisible({ timeout: FIRST_PAINT_TIMEOUT_MS });
      await expect(page.getByRole('button', { name: LIBRARY_SAMPLE_MODEL })).toBeVisible();
      await expect(page.getByText(LIBRARY_READ_ONLY)).toHaveCount(1);
      await captureEvidence(page, 'R-E_34.png');
    });
  });

  test.describe('SCR-35 Training Jobs', () => {
    test('SCR-35 [E] load: "Không có quyền truy cập"', async () => {
      await signInAs(page, 'engineer', ROUTES.adminTrainingJobs);
      await expect(page.getByRole('heading', { name: ADMIN_FORBIDDEN_TITLE, exact: true })).toBeVisible({
        timeout: FIRST_PAINT_TIMEOUT_MS,
      });
      await expect(page.getByText(TRAINING_FORBIDDEN_BODY, { exact: true })).toBeVisible();
      await captureEvidence(page, 'R-E_35.png');
    });
  });

  test.describe('SCR-36 Model Registry', () => {
    test('SCR-36 [E] load: "Không có quyền truy cập"', async () => {
      await signInAs(page, 'engineer', ROUTES.adminTrainingModels);
      await expect(page.getByRole('heading', { name: ADMIN_FORBIDDEN_TITLE, exact: true })).toBeVisible({
        timeout: FIRST_PAINT_TIMEOUT_MS,
      });
      await expect(page.getByText(REGISTRY_FORBIDDEN_BODY, { exact: true })).toBeVisible();
      await captureEvidence(page, 'R-E_36.png');
    });
  });

  test.describe('SCR-08 Project Settings', () => {
    test('SCR-08 [E] tab "Vùng nguy hiểm" absent', async () => {
      await signInAs(page, 'engineer', ROUTES.project.settings(PROJECT_ID));
      await expect(page.getByRole('tab')).toHaveText(['Chung', 'Đơn vị đo', 'Thành viên'], {
        timeout: FIRST_PAINT_TIMEOUT_MS,
      });
      await expect(page.getByRole('tab', { name: SETTINGS_DANGER_TAB })).toHaveCount(0);
      await captureEvidence(page, 'R-E_08.png');
    });
  });

  test.describe('SCR-09 Floor Manager', () => {
    test('SCR-09 [E] edit controls present and enabled ("Thêm tầng")', async () => {
      await signInAs(page, 'engineer', ROUTES.project.floors(PROJECT_ID));
      const addFloor = page.getByRole('button', { name: ADD_FLOOR, exact: true });
      await expect(addFloor).toBeVisible({ timeout: FIRST_PAINT_TIMEOUT_MS });
      await expect(addFloor).toBeEnabled();
      await expect(page.getByRole('heading', { name: FLOORS_FORBIDDEN_TITLE, exact: true })).toHaveCount(0);
      await captureEvidence(page, 'R-E_09_can_edit.png');
    });
  });

  test.describe('SCR-10 Floor Upload', () => {
    test('SCR-10 [E] upload controls present and enabled (dropzone, "Chọn tệp", file input)', async () => {
      await signInAs(page, 'engineer', ROUTES.project.upload(PROJECT_ID));
      const dropzone = page.getByTestId(UPLOAD_DROPZONE_TEST_ID);
      await expect(dropzone).toBeVisible({ timeout: FIRST_PAINT_TIMEOUT_MS });
      await expect(dropzone.getByRole('button', { name: UPLOAD_SELECT_FILE, exact: true })).toBeEnabled();
      await expect(page.getByTestId(UPLOAD_INPUT_TEST_ID)).toBeEnabled();
      await expect(page.getByText(UPLOAD_READ_ONLY, { exact: true })).toHaveCount(0);
      await captureEvidence(page, 'R-E_10_can_edit.png');
    });
  });

  test.describe('SCR-16 Wall Layer Review', () => {
    test('SCR-16 [E] edit controls present and enabled (approve, thickness)', async () => {
      await signInAs(page, 'engineer', ROUTES.project.walls(PROJECT_ID, A14_FLOOR));
      const list = page.getByRole('listbox', { name: 'Danh sách đoạn tường' });
      await expect(list.getByRole('option')).toHaveCount(A14_WALLS_ON_FLOOR, { timeout: FIRST_PAINT_TIMEOUT_MS });
      await dismissTour(page);

      // Selecting a wall is not a write; no approve/thickness click is made.
      await list.getByRole('option').first().click();
      await expect(page.getByRole('button', { name: WALL_APPROVE })).toBeEnabled();
      // Editable thickness is a SegmentedControl radiogroup; the viewer copy is role="group" (WallLayerInspector.tsx).
      await expect(page.getByRole('radiogroup', { name: WALL_THICKNESS })).toBeVisible();
      await expect(page.getByText(WALLS_VIEWER_NOTICE, { exact: true })).toHaveCount(0);
      await captureEvidence(page, 'R-E_16_can_edit.png');
    });
  });

  test.describe('SCR-30 Export', () => {
    test('SCR-30 [E] "Xuất" present and enabled', async () => {
      note(
        'setup',
        'Mock project-1 has no approved floor geometry, so the A14 sample is seeded after the gate loads ' +
          '(seedSpatial, same as e2e/v12a/export.spec.ts). "Xuất" is not clicked (export is opt-in).',
      );
      await signInAs(page, 'engineer', ROUTES.project.export(PROJECT_ID));
      await expect(page.getByRole('heading', { name: EXPORT_HEADING, exact: true })).toBeVisible({
        timeout: FIRST_PAINT_TIMEOUT_MS,
      });
      await seedSpatial(page, { projectId: PROJECT_ID });
      const exportButton = page.getByRole('button', { name: EXPORT_BUTTON, exact: true });
      await expect(exportButton).toBeVisible();
      await dismissTour(page);
      await expect(exportButton).toBeEnabled();
      await expect(page.getByRole('heading', { name: EXPORT_FORBIDDEN_TITLE, exact: true })).toHaveCount(0);
      await captureEvidence(page, 'R-E_30_can_edit.png');
    });
  });
});

/* ============================================================================================ */
/* Role A (admin@example.com): F-11 stale per-project role                                       */
/* ============================================================================================ */

test.describe('Role A (admin)', () => {
  test.describe('SCR-34 Model Library', () => {
    test('SCR-34 [A] F-11: admin joins a project as V, returns to /admin/models (R-A_34_stale_role.png)', () => {
      // Source confirms the mechanism: `userRoles` is only ever set by hydrateProject (projectHydration.ts)
      // and never cleared; ModelLibrary.container.tsx:131 prefers it over session.roles.
      test.fixme(
        true,
        'UNKNOWN — NEED VERIFICATION: F-11 cannot be staged in Track B. In the mock, admin@example.com is an ' +
          '`admin` member of the only project (client.ts buildProject), so no project yields a viewer role for the ' +
          'admin; and any goto/reload drops both the mock session (module variable) and the store, while no in-app ' +
          'link reaches /admin/models (F-10). Needs a Track A admin who is a viewer member of a project.',
      );
    });
  });
});
