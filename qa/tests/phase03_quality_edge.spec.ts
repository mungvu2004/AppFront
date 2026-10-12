/**
 * Phase 3 — SCR-11 input quality gate, sequential flows (QA-03d P7; plan `flow-plan.md` "phase03_quality_edge.spec.ts").
 * One `test()` per flow, one `test.step('[<row id>] …')` per catalog row, in the user's order. `H` rows use hard
 * `expect`, `S` rows `expect.soft`; `ev` rows capture `E03_<row id>_<slug>.png`.
 *
 * Source @ c16f2428 (abbreviations): IQ InputQualityGate.tsx · IQF …Footer.tsx · IQR …ReportPanel.tsx · IQP …ImagePanel.tsx
 * · IQO …ImageOverlays.tsx · IQW inputQualityWriteErrors.ts · IQG inputQualityGateway.ts · UIQ useInputQualityGate.ts
 * (all under src/screens/upload/InputQualityGate/) · ZC src/components/canvas/ZoomCluster.tsx · UZC src/hooks/useZoomCluster.ts
 * · NF src/hooks/useNumericField.ts · RTY src/lib/http/retry.ts · I18N src/i18n/vi.json `errors.*`.
 *
 * Data: every project is own and run-unique (`qa-<runId>-11-…`), owned by the pool admin of slot `p7-quality` (own
 * `drawings_init` bucket) and deleted in `finally`. Role users: the shared pool engineer / viewer only as MEMBERS of these
 * own projects; FL-11-06 lowers and restores the global role of its OWN slot `p7-role`. No shared file is written (no admin
 * storage state). Safe beside other spec files under `--workers 4`.
 *
 * Mocks — only in the two `[mocked response]` flows (FL-11-08, FL-11-09); everything else is the real stack.
 *
 * Request budget per full file run (QA stack limits, `qa-limits.override.yml`):
 * - `POST /api/auth/login` (120 / 60 s per IP): 3 per flow (main admin API, owner API, browser) + 1 per extra role
 *   session ≈ 30.
 * - `POST /api/users/invitations` (30 / 3600 s per admin): 0 when the pool file holds `admin:p7-quality`,
 *   `engineer:shared`, `engineer:p7-role`, `viewer:shared`; at most 4 on the very first run.
 * - `POST …/drawings/uploads` (drawings_init, 300 / 600 s per user on the QA stack): 22 for `admin:p7-quality`
 *   (FL-11-01 1, 02 2, 03 13, 05 2, 06 1, 07 1, 08 1, 09 2 — FL-11-04 none) → 22 fake-ML runs.
 * - `POST /api/projects`: 10, each deleted. `POST …/members`: 3. `PATCH /api/users/:id/role`: 2 (lower, restore).
 * - Real writes on own drawings: straighten 200 ×2 (FL-11-01, FL-11-09), corners 200 ×1 + 422 ×1 (FL-11-02), refused
 *   straighten 422 (FL-11-07) / 403 (FL-11-06); one #35 layer PUT (FL-11-07).
 */
import { expect, test, type APIRequestContext, type Browser, type Locator, type Page, type Request, type Route } from '@playwright/test';

import { ROUTES } from '../../e2e/fixtures/routes';
import { signedInApi } from './support/api';
import { attachJson, captureEvidence } from './support/evidence';
import { qcLayer, writeLayer } from './support/layerSeed';
import {
  addProjectMember,
  createPipelineDrawingProject,
  createProject,
  deleteSeededProject,
  framelessPng,
  poolUser,
  removeProjectMember,
  type PoolUser,
} from './support/phase03Seed';
import {
  announced,
  CLEAN,
  envPng,
  floorOf,
  mainAdminApi,
  openSession,
  P7_ROLE_SLOT,
  P7_SLOT,
  planPng,
  qualityPath,
  readQuality,
  seedQualityProject,
  skewedEnvPng,
  viAngle,
  viResolution,
  viScore,
  type QualityProject,
  type Session,
} from './support/p03/P7';

/* ---------------------------------------------------------------- copy (each cites its source) */

const BREADCRUMB_NAV = 'Đường dẫn trang'; // Breadcrumb.tsx:19
const CURRENT_CRUMB = 'Kiểm tra chất lượng đầu vào'; // IQ:55
const IMAGE_PANEL = 'Khung xem bản vẽ'; // IQP:65
const REPORT = 'Báo cáo chất lượng'; // IQR:281
const FOOTER = 'Hành động tiếp theo'; // IQF:48
const CONTINUE = 'Tiếp tục xử lý'; // UIQ COPY.primary
const SECONDARY = 'Tải bản vẽ khác'; // UIQ COPY.secondary
const ACK = 'Tôi đã đọc cảnh báo và vẫn muốn xử lý bản vẽ này'; // UIQ COPY.acknowledgement
const ACK_NOTE = 'Đánh dấu ô xác nhận bên trên rồi thử lại.'; // IQF:33
const STRAIGHTEN = 'Tự động nắn'; // UIQ COPY.straightenAction
const PICK = 'Chọn góc thủ công'; // UIQ COPY.pickCornersAction
const SEND = 'Gửi bốn góc đã chọn'; // UIQ COPY.sendCornersAction
const CONFIRM_STRAIGHTEN = 'Nắn thẳng'; // UIQ COPY.straightenConfirmLabel
const CONFIRM_CORNERS = 'Cắt và nắn'; // UIQ COPY.cornersConfirmLabel
const CANCEL = 'Huỷ'; // UIQ COPY.confirmCancel
const CLOSE_DIALOG = 'Đóng hộp thoại'; // Modal.tsx:171
const STRAIGHTEN_BODY = 'Máy chủ sẽ thay ảnh gốc bằng ảnh đã nắn và xử lý lại tầng này; việc này không hoàn tác được.'; // UIQ
const CORNERS_BODY = 'Máy chủ sẽ cắt, nắn lại bản vẽ theo bốn góc và xử lý lại tầng này; việc này không hoàn tác được.'; // UIQ
const CORNER_GROUP = 'Bốn góc bản vẽ, kéo để chỉnh khung'; // IQO:33
const CORNER_HINT = 'Kéo bằng chuột, hoặc dùng phím mũi tên khi tay nắm đang được chọn.'; // IQP:66
const REGION_GROUP = 'Vùng có vấn đề trên bản vẽ'; // IQO:32
const ZOOM_GROUP = 'Cụm thu phóng'; // ZC:74
const ZOOMED_FRAME = 'Bản vẽ đang phóng, cuộn để xem phần còn lại'; // IQP:71
const COMPARISON = 'Tỉ lệ lộ ảnh sau khi nắn'; // IQP:67
const COMPARISON_HINT = 'Phần bên trái đường chia là ảnh đã nắn, bên phải là ảnh gốc.'; // IQP:68
const STRAIGHTENED = 'Đã nắn thẳng bản vẽ'; // UIQ COPY.straightenedAnnouncement
const CORNERS_SENT = 'Đã gửi bốn góc khung bản vẽ'; // UIQ COPY.cornersAnnouncement
const PASS = 'Bản vẽ đạt yêu cầu.'; // UIQ passNotice
const NO_DRAWING_TITLE = 'Chưa có bản vẽ để kiểm tra'; // IQ:62
const NO_DRAWING_NOTICE = 'Dự án chưa có bản vẽ nào được tải lên, nên chưa có gì để đo.'; // UIQ COPY.noDrawingNotice
const NO_DRAWING_ACTION = 'Tải bản vẽ lên'; // IQ:63
const NO_DRAWING_REASON = 'Chưa có bản vẽ nào để xử lý; hãy tải bản vẽ lên trước.'; // UIQ COPY.continueNoDrawing
const READING_REASON = 'Đang đọc kết quả kiểm tra; chờ xong rồi tiếp tục.'; // UIQ COPY.continueWaitingReading
const LOAD_ERROR = 'Không đọc được kết quả kiểm tra chất lượng'; // IQ:58
const RETRY = 'Thử lại'; // IQ:59
const WRITE_ERROR = 'Chưa xử lý được bản vẽ'; // IQ:64
const NOT_FOUND_TITLE = 'Không tìm thấy dự án này'; // ProjectSpatialGate.tsx:36
const NOT_FOUND_SENTENCE = 'Dự án có thể đã bị xoá, đường dẫn chưa đúng, hoặc bạn chưa được thêm vào dự án.'; // PSGATE:37-38
const BACK_TO_PROJECTS = 'Về danh sách dự án'; // PSGATE:39
const RES_RECOMMENDATION = 'Nên dùng ảnh có cạnh ngắn từ 2.000 px trở lên.'; // UIQ recommendations.resolution
const SKEW_RECOMMENDATION = 'Bấm "Tự động nắn" để hệ thống xoay ảnh về phương ngang.'; // UIQ recommendations.skew
const CONTRAST_RECOMMENDATION = 'Quét lại với nền sáng đều hơn để nét mảnh không rụng khỏi ảnh.'; // UIQ
const NOISE_RECOMMENDATION = 'Quét lại ở chế độ ảnh nét và không nén mạnh để bớt đốm giả.'; // UIQ
const SENTENCE = {
  drawingChanged: 'Bản vẽ của tầng vừa đổi, kết quả đo đã được đọc lại; hãy xem rồi thử lại.', // IQW:19
  layerReviewed: 'Tầng này đã có tỉ lệ hoặc hình học do người chỉnh, nên không nắn hay cắt lại bản vẽ được nữa.', // IQW:20
  invalidCorners: 'Bốn góc chưa tạo thành một khung hợp lệ; hãy chọn lại.', // IQW:22
  imageTooLarge: 'Ảnh bản vẽ lớn hơn mức xử lý được; hãy tải bản vẽ nhỏ hơn.', // IQW:23
  pdfUnreadable: 'Không đọc được trang PDF của bản vẽ; hãy tải lại tệp.', // IQW:24
  fileCorrupt: 'Tệp bản vẽ bị hỏng; hãy tải lại tệp.', // IQW:25
  queueFull: 'Hàng xử lý đang đầy; hãy thử lại sau ít phút.', // IQW:26
  uncertain: 'Chưa chắc máy chủ đã nhận thao tác; kết quả đo đang được đọc lại.', // IQW:27
  unknown: 'Hệ thống đã ghi nhận và sẽ kiểm tra. Hãy thử lại sau ít phút.', // I18N errors.unknown
  forbidden: 'Tài khoản của bạn chưa có quyền xem hoặc thay đổi nội dung này. Liên hệ quản trị dự án.', // I18N errors.forbidden
  network: 'Không liên lạc được với máy chủ. Kiểm tra mạng rồi thử lại.', // I18N errors.network
  notFound: 'Nội dung này có thể đã bị xoá, hoặc đường dẫn chưa đúng.', // I18N errors.notFound
} as const;

/** 8° measured: poor skew (≥ 5°, domain/quality/thresholds.ts) → SKEW_DETECTED + acknowledgement. */
const SKEW = 8;
const QUIET_MS = 1_500;
const SETUP_TIMEOUT_MS = 330_000;

/* ---------------------------------------------------------------- flow harness */

interface Flow {
  readonly admin: APIRequestContext;
  /** Pool admin `p7-quality`: owner of every project of the flow. */
  readonly owner: PoolUser;
  readonly ownerApi: APIRequestContext;
  readonly projects: string[];
  readonly sessions: Session[];
  readonly cleanups: (() => Promise<unknown>)[];
}

async function flow(body: (f: Flow) => Promise<void>): Promise<void> {
  const admin = await mainAdminApi();
  const projects: string[] = [];
  const sessions: Session[] = [];
  const cleanups: (() => Promise<unknown>)[] = [];
  let ownerApi: APIRequestContext | undefined;
  try {
    const owner = await poolUser(admin, 'admin', P7_SLOT);
    ownerApi = await signedInApi(owner.email, owner.password);
    await body({ admin, owner, ownerApi, projects, sessions, cleanups });
  } finally {
    for (const cleanup of cleanups) await cleanup().catch(() => undefined);
    for (const s of sessions) await s.context.close().catch(() => undefined);
    for (const id of projects) if (ownerApi !== undefined) await deleteSeededProject(ownerApi, id);
    await ownerApi?.dispose();
    await admin.dispose();
  }
}

async function seed(f: Flow, slug: string, floors: Parameters<typeof seedQualityProject>[2]): Promise<QualityProject> {
  const project = await seedQualityProject(f.ownerApi, slug, floors);
  f.projects.push(project.projectId);
  return project;
}

async function session(f: Flow, browser: Browser, user: PoolUser = f.owner): Promise<Session> {
  const s = await openSession(browser, user);
  f.sessions.push(s);
  return s;
}

const floorId = (project: QualityProject, name: string): string => {
  const id = project.floors.find((floor) => floor.name === name)?.id;
  if (id === undefined) throw new Error(`${project.name}: no floor ${name}`);
  return id;
};

/* ---------------------------------------------------------------- screen helpers */

const pathOf = (page: Page): string => new URL(page.url()).pathname;
const quiet = (page: Page): Promise<void> => page.waitForTimeout(QUIET_MS);
const report = (page: Page): Locator => page.getByRole('region', { name: REPORT, exact: true });
const imagePanel = (page: Page): Locator => page.getByRole('region', { name: IMAGE_PANEL, exact: true });
const content = (page: Page): Locator => page.getByTestId('quality-image-content'); // IQP:142
const row = (page: Page, name: string): Locator =>
  report(page).getByRole('row').filter({ has: page.getByRole('cell', { name, exact: true }) });
/** A metric line (IQR MetricRow `<li>`), found by its exact label. */
const metric = (page: Page, label: string): Locator => report(page).locator('li').filter({ has: page.getByText(label, { exact: true }) });
/** A finding (IQR FindingListItem `<li>`), found by its exact title. */
const finding = (page: Page, title: string): Locator => report(page).locator('li').filter({ has: page.getByText(title, { exact: true }) });
const button = (scope: Page | Locator, name: string): Locator => scope.getByRole('button', { name, exact: true });
const regions = (page: Page): Locator => page.getByRole('group', { name: REGION_GROUP, exact: true }).getByRole('button');
const region = (page: Page, title: string): Locator => page.getByRole('button', { name: `Vùng ảnh có vấn đề: ${title}`, exact: true });
const highlighted = (page: Page): Locator => page.locator('[aria-label^="Vùng ảnh có vấn đề:"].border-2');
const handle = (page: Page, name: string): Locator => page.getByRole('group', { name: CORNER_GROUP, exact: true }).getByRole('button', { name, exact: true });
const ackBox = (page: Page): Locator => page.getByRole('checkbox', { name: ACK, exact: true });
/** Ticks / unticks the acknowledgement through its label (the input is `sr-only` under a drawn box, Checkbox.tsx). */
async function setAck(page: Page, on: boolean): Promise<void> {
  if ((await ackBox(page).isChecked()) !== on) await page.locator('label').filter({ hasText: ACK }).click();
  await expect(ackBox(page)).toBeChecked({ checked: on });
}
const alertWith = (page: Page, text: string): Locator => page.getByRole('alert').filter({ hasText: text });
const writeBand = (page: Page): Locator => alertWith(page, WRITE_ERROR);
const dialog = (page: Page, name: string | RegExp): Locator => page.getByRole('dialog', { name });
const continueBtn = (page: Page): Locator => button(page, CONTINUE);
const isActive = (page: Page, name: string): Promise<void> => expect(row(page, name)).toHaveAttribute('aria-current', 'true');
const altOf = (floor: string): string => `Bản vẽ tầng ${floor}, đang xem để kiểm tra chất lượng đầu vào`; // UIQ altText
const remaining = (page: Page): Locator => report(page).locator('.sr-only[role="status"]'); // IQR:307

async function openQuality(page: Page, projectId: string): Promise<void> {
  await page.goto(ROUTES.project.quality(projectId));
  await expect(report(page)).toBeVisible({ timeout: 45_000 });
}

const qualityGets = (s: Session): number => s.log.filter((e) => e.method === 'GET' && e.path.endsWith('/quality')).length;
const projectGets = (s: Session, projectId: string): number => s.log.filter((e) => e.method === 'GET' && e.path === `/api/projects/${projectId}`).length;
const pct = async (locator: Locator, prop: 'left' | 'top' | 'width' | 'height'): Promise<number> =>
  parseFloat(await locator.evaluate((el, p) => (el as HTMLElement).style[p], prop));

/** Requests of a kind made by the page (sent, not answered), for "exactly one / none" claims. */
function countRequests(page: Page, method: string, pathEnd: string): { readonly list: Request[] } {
  const list: Request[] = [];
  page.on('request', (r) => {
    if (r.method() === method && new URL(r.url()).pathname.endsWith(pathEnd)) list.push(r);
  });
  return { list };
}

/** Focuses the next element (Tab) until `match` holds; returns the number of presses, or -1. */
async function tabTo(page: Page, match: (el: { label: string; tag: string }) => boolean, max = 40): Promise<number> {
  for (let i = 1; i <= max; i += 1) {
    await page.keyboard.press('Tab');
    const el = await page.evaluate(() => {
      const a = document.activeElement as HTMLElement | null;
      return { label: (a?.getAttribute('aria-label') ?? a?.innerText ?? '').trim(), tag: a?.tagName ?? '' };
    });
    if (match(el)) return i;
  }
  return -1;
}

/** Drags `from` to the point at ratios of the image content box (may be outside 0..1). */
async function dragTo(page: Page, from: Locator, xRatio: number, yRatio: number): Promise<void> {
  const start = await from.boundingBox();
  const box = await content(page).boundingBox();
  if (start === null || box === null) throw new Error('drag: no box');
  await page.mouse.move(start.x + start.width / 2, start.y + start.height / 2);
  await page.mouse.down();
  await page.mouse.move(box.x + box.width * xRatio, box.y + box.height * yRatio, { steps: 8 });
  await page.mouse.up();
}

const errorBody = (status: number, code: string, extra: Record<string, unknown> = {}): Parameters<Route['fulfill']>[0] => ({
  status,
  contentType: 'application/json',
  body: JSON.stringify({ code, requestId: 'qa-p7-mock', ...extra }),
});

/* ================================================================= flows */

test.describe('E03 SCR-11 input quality gate — flows (QA-03d P7)', () => {
  test('SCR-11 · FL-11-01 · engineer reviews a skewed drawing, acknowledges, straightens it and leaves', async ({ browser }) => {
    test.setTimeout(SETUP_TIMEOUT_MS + 240_000);
    await flow(async (f) => {
      const engineer = await poolUser(f.admin, 'engineer');
      const project = await seed(f, '11-fl01', [{ name: 'Tầng 1', png: await skewedEnvPng(browser, SKEW) }]);
      await addProjectMember(f.ownerApi, project.projectId, engineer.email);
      const fid = floorOf(await readQuality(f.ownerApi, project.projectId, project.floors[0]!.id), project.floors[0]!.id);
      const m = fid.measurement;
      const s = await session(f, browser, engineer);
      const { page } = s;
      const straightenPosts = countRequests(page, 'POST', '/quality/straighten');

      await test.step('[11-A-002] breadcrumb "Dự án" › project name › "Kiểm tra chất lượng đầu vào"', async () => {
        await openQuality(page, project.projectId);
        const nav = page.getByRole('navigation', { name: BREADCRUMB_NAV });
        await expect(button(nav, 'Dự án')).toBeVisible();
        await expect(nav.getByText(project.name, { exact: true })).toBeVisible(); // BUG-362 project level
        await expect(nav.locator('[aria-current="page"]')).toHaveText(CURRENT_CRUMB);
        await captureEvidence(page, 'E03_11-A-002_breadcrumb.png');
      });

      await test.step('[11-E-001] sections "Khung xem bản vẽ", "Báo cáo chất lượng", footer "Hành động tiếp theo"', async () => {
        await expect.soft(imagePanel(page)).toBeVisible();
        await expect.soft(report(page)).toBeVisible();
        await expect.soft(page.locator(`footer[aria-label="${FOOTER}"]`)).toBeVisible();
        await captureEvidence(page, 'E03_11-E-001_landmarks.png');
      });

      await test.step('[11-C-016] metric values in vi-VN (dot grouping, two-decimal scores, angle)', async () => {
        await expect.soft(metric(page, 'Độ phân giải')).toContainText(viResolution(m.widthPx, m.heightPx));
        await expect.soft(metric(page, 'Độ nghiêng')).toContainText(viAngle(m.skewDeg));
        await expect.soft(metric(page, 'Độ tương phản')).toContainText(viScore(m.contrastScore));
        await expect.soft(metric(page, 'Nhiễu')).toContainText(viScore(m.noiseScore));
        expect.soft(Math.abs(Math.abs(m.skewDeg) - SKEW), `measured skew ${String(m.skewDeg)} ≈ ${String(SKEW)}°`).toBeLessThan(0.6);
        await captureEvidence(page, 'E03_11-C-016_number_formats.png', { caption: `#30 measurement ${JSON.stringify(m)}` });
      });

      await test.step('[11-C-018] finding "Ảnh bị nghiêng" with its consequence and "Tự động nắn"', async () => {
        const card = finding(page, 'Ảnh bị nghiêng');
        await expect(card).toContainText(`Ảnh bị nghiêng ${viAngle(m.skewDeg)}. Ở góc này`);
        await expect(card).toContainText('Hệ thống có thể tự nắn.');
        await expect(button(card, STRAIGHTEN)).toBeVisible();
        await captureEvidence(page, 'E03_11-C-018_skew_finding.png');
      });

      await test.step('[11-E-013] sr-only status "N phát hiện còn lại"; visual count aria-hidden', async () => {
        const n = fid.findings.length;
        await expect.soft(remaining(page)).toHaveText(`${String(n)} phát hiện còn lại`);
        await expect.soft(report(page).locator('span[aria-hidden="true"]').filter({ hasText: 'phát hiện còn lại' })).toHaveText(`${String(n)} phát hiện còn lại`);
      });

      await test.step('[11-B-015] measured floor: no forecast line at all (BUG-355)', async () => {
        await expect.soft(report(page)).not.toContainText('Dự kiến độ tin cậy');
        await expect.soft(report(page)).not.toContainText('Chưa dự kiến được độ tin cậy');
        await captureEvidence(page, 'E03_11-B-015_no_forecast.png');
      });

      await test.step('[11-C-024] region "Vùng ảnh có vấn đề: ảnh bị nghiêng" placed at the finding ratios', async () => {
        const skewFinding = fid.findings.find((x) => x.code === 'SKEW_DETECTED');
        expect(skewFinding, '#30 lists SKEW_DETECTED').toBeDefined();
        const r = skewFinding!.region;
        const button11 = region(page, 'ảnh bị nghiêng');
        await expect.soft(button11).toBeAttached();
        const got = { left: await pct(button11, 'left'), top: await pct(button11, 'top'), width: await pct(button11, 'width'), height: await pct(button11, 'height') };
        const want = { left: r.xRatio * 100, top: r.yRatio * 100, width: r.widthRatio * 100, height: r.heightRatio * 100 };
        for (const k of ['left', 'top', 'width', 'height'] as const) expect.soft(got[k], `region ${k}`).toBeCloseTo(want[k], 2);
        await captureEvidence(page, 'E03_11-C-024_region_position.png', { caption: `style ${JSON.stringify(got)} · #30 ${JSON.stringify(want)}` });
        // The regions lie ON the drawing: an opaque tint (--state-attention-tint #fcf6e6) hides it (RESOLUTION_TOO_LOW = whole image).
        const tint = await regions(page).evaluateAll((els) => els.map((el) => getComputedStyle(el).backgroundColor));
        expect.soft(tint.filter((c) => !/rgba\(.*,\s*0?\.\d+\)|transparent|rgba\(0, 0, 0, 0\)/u.test(c)), `region fills let the drawing show through: ${JSON.stringify(tint)}`).toEqual([]);
      });

      await test.step('[11-C-025] skew line through the centre at the measured angle', async () => {
        const line = imagePanel(page).locator('svg[preserveAspectRatio="none"] line'); // IQO:219-234 (icons have their own lines)
        const rad = (m.skewDeg * Math.PI) / 180;
        const want = { x1: (0.5 - Math.cos(rad) * 0.4) * 100, y1: (0.5 - Math.sin(rad) * 0.4) * 100, x2: (0.5 + Math.cos(rad) * 0.4) * 100, y2: (0.5 + Math.sin(rad) * 0.4) * 100 };
        const got: Record<string, number> = {};
        for (const k of ['x1', 'y1', 'x2', 'y2'] as const) {
          got[k] = parseFloat((await line.getAttribute(k)) ?? 'NaN');
          expect.soft(got[k], `skew line ${k}`).toBeCloseTo(want[k], 2);
        }
        await captureEvidence(page, 'E03_11-C-025_skew_line.png', { caption: `line ${JSON.stringify(got)}` });
        // BE estimate_skew: +d° = the drawing turned counter-clockwise (preprocess/geometry.py SkewEstimate), so its walls
        // RISE to the right; with y down the overlay must end higher than it starts. Source draws 0.5 ± sin → mirrored.
        expect.soft(Math.sign((got.y1 ?? 0) - (got.y2 ?? 0)), 'skew line leans the same way as the drawing').toBe(Math.sign(m.skewDeg));
      });

      await test.step('[11-A-013] hover linked metric "Độ nghiêng" → its region; unlinked rows have no tabindex', async () => {
        const linked = metric(page, 'Độ nghiêng').locator('div').first();
        await expect.soft(linked).toHaveAttribute('tabindex', '0');
        await linked.hover();
        await expect.soft(highlighted(page)).toHaveCount(1);
        await expect.soft(highlighted(page)).toHaveAttribute('aria-label', 'Vùng ảnh có vấn đề: ảnh bị nghiêng');
        const border = await linked.evaluate((el) => getComputedStyle(el).borderTopColor);
        expect.soft(border, 'hovered linked row gets border-accent').not.toBe('rgba(0, 0, 0, 0)');
        await captureEvidence(page, 'E03_11-A-013_metric_hover.png');
        for (const label of ['Độ tương phản', 'Nhiễu']) {
          await expect.soft(metric(page, label).locator('[tabindex]'), `${label} has no tabindex`).toHaveCount(0);
        }
        await page.mouse.move(2, 2);
      });

      await test.step('[11-A-012] hover / focus a finding card lights its region, the others dim (fold Q16)', async () => {
        const card = finding(page, 'Ảnh bị nghiêng').locator('div[tabindex="0"]').first();
        await card.hover();
        await expect.soft(highlighted(page)).toHaveCount(1);
        const opacities = await regions(page).evaluateAll((els) => els.map((el) => [el.getAttribute('aria-label'), (el as HTMLElement).style.opacity]));
        const dimmed = opacities.filter(([label, o]) => label !== 'Vùng ảnh có vấn đề: ảnh bị nghiêng' && Number(o) < 1);
        expect.soft(dimmed.length, `other regions dimmed: ${JSON.stringify(opacities)}`).toBe(opacities.length - 1);
        await captureEvidence(page, 'E03_11-A-012_finding_hover.png');
        await page.mouse.move(2, 2);
        await expect.soft(highlighted(page)).toHaveCount(0);
        await card.focus();
        await expect.soft(highlighted(page)).toHaveCount(1);
        await card.blur();
      });

      await test.step('[11-A-014] hovering the region "ảnh bị nghiêng" itself → border-2', async () => {
        // A real mouse at the region centre: whatever region is on top there is the one the user hovers.
        const box = await region(page, 'ảnh bị nghiêng').boundingBox();
        expect(box).not.toBeNull();
        await page.mouse.move(box!.x + box!.width / 2, box!.y + box!.height / 2);
        await expect.soft(highlighted(page), 'the skew region (not one stacked above it) lights up').toHaveAttribute('aria-label', 'Vùng ảnh có vấn đề: ảnh bị nghiêng');
        await captureEvidence(page, 'E03_11-A-014_region_hover.png');
        await page.mouse.move(2, 2);
      });

      await test.step('[11-E-016] Tab onto the region button → focus highlights it', async () => {
        await button(page.getByRole('navigation', { name: BREADCRUMB_NAV }), 'Dự án').focus();
        const presses = await tabTo(page, (el) => el.label === 'Vùng ảnh có vấn đề: ảnh bị nghiêng');
        expect.soft(presses, 'the region is in the Tab order').toBeGreaterThan(0);
        await expect.soft(region(page, 'ảnh bị nghiêng')).toHaveClass(/border-2/u);
        await captureEvidence(page, 'E03_11-E-016_region_focus.png');
      });

      await test.step('[11-E-002] Tab order breadcrumb → regions → linked metrics → cards → quick fix → rows → checkbox → footer', async () => {
        await button(page.getByRole('navigation', { name: BREADCRUMB_NAV }), 'Dự án').focus();
        const visited: { kind: string; label: string; ring: boolean }[] = [];
        const describe = async (): Promise<{ kind: string; label: string; ring: boolean }> =>
          page.evaluate(() => {
            const a = document.activeElement as HTMLElement;
            const label = (a.getAttribute('aria-label') ?? a.innerText ?? '').trim().replace(/\s+/gu, ' ').slice(0, 60);
            const st = getComputedStyle(a);
            const ring = (st.outlineStyle !== 'none' && st.outlineWidth !== '0px') || st.boxShadow !== 'none';
            const kind = label.startsWith('Vùng ảnh có vấn đề') ? 'region'
              : a.closest('[aria-label="Cụm thu phóng"]') ? 'zoom'
              : a.tagName === 'TR' ? 'row'
              : (a as HTMLInputElement).type === 'checkbox' ? 'checkbox'
              : a.dataset.qualityAction !== undefined ? 'quickfix'
              : a.closest('li')?.querySelector('p.font-medium') && a.getAttribute('tabindex') === '0' ? 'card'
              : a.closest('li') && a.getAttribute('tabindex') === '0' ? 'metric'
              : label;
            return { kind, label, ring };
          });
        visited.push(await describe());
        for (let i = 0; i < 40 && visited[visited.length - 1]?.label !== CONTINUE; i += 1) {
          await page.keyboard.press('Tab');
          visited.push(await describe());
        }
        const firsts: string[] = [];
        for (const v of visited) if (v.kind !== 'zoom' && !firsts.includes(v.kind)) firsts.push(v.kind);
        expect.soft(firsts, `Tab order ${JSON.stringify(visited.map((v) => v.kind))}`).toEqual(['Dự án', 'region', 'metric', 'card', 'quickfix', 'row', 'checkbox', SECONDARY, CONTINUE]);
        // QA-03e (BUG-539, FIX-2242): regions render largest → smallest so the small one sits on top
        // (InputQualityGateImageOverlays.tsx:140-148); DOM order is Tab order, so Tab meets them large → small.
        const tabRegions = visited.filter((v) => v.kind === 'region').map((v) => v.label);
        const byArea = await regions(page).evaluateAll((els) =>
          els
            .map((el) => ({ label: el.getAttribute('aria-label') ?? '', area: parseFloat((el as HTMLElement).style.width) * parseFloat((el as HTMLElement).style.height) }))
            .sort((a, b) => b.area - a.area)
            .map((r) => r.label),
        );
        expect.soft(tabRegions, 'regions reached by Tab largest → smallest').toEqual(byArea);
        const noRing = visited.filter((v) => !v.ring).map((v) => v.label);
        expect.soft(noRing, 'focus ring visible on every stop').toEqual([]);
        await attachJson('E03_11-E-002_tab_order.json', { visited });
        await captureEvidence(page, 'E03_11-E-002_tab_order.png', { caption: `last stop: ${visited[visited.length - 1]?.label ?? ''}` });
      });

      await test.step('[11-E-017] zoom cluster accessible names', async () => {
        const zoom = page.getByRole('group', { name: ZOOM_GROUP, exact: true });
        await expect.soft(zoom).toBeVisible();
        for (const name of ['Thu nhỏ', 'Phóng to', 'Mức thu phóng 100%, bấm để về 100%', 'Vừa khung nhìn']) await expect.soft(button(zoom, name)).toBeVisible();
      });

      const zoomTo = async (level: number): Promise<void> => {
        await button(page, `Mức thu phóng ${String(await zoomLevel())}%, bấm để về 100%`).click();
        for (let z = 100; z < level; z += 10) await button(page, 'Phóng to').click();
      };
      const zoomLevel = async (): Promise<number> => parseFloat(await content(page).evaluate((el) => (el as HTMLElement).style.width));

      await test.step('[11-A-015] "Phóng to" / "Thu nhỏ" step 10 %; level button and "Vừa khung nhìn" reset to 100 %', async () => {
        await button(page, 'Phóng to').click();
        expect(await zoomLevel()).toBe(110);
        await expect(page.getByRole('group', { name: ZOOMED_FRAME, exact: true })).toBeVisible();
        await expect(button(page, 'Mức thu phóng 110%, bấm để về 100%')).toBeVisible();
        await captureEvidence(page, 'E03_11-A-015_zoom_110.png');
        await button(page, 'Thu nhỏ').click();
        expect(await zoomLevel()).toBe(100);
        await expect(page.getByRole('group', { name: ZOOMED_FRAME, exact: true })).toHaveCount(0);
        await button(page, 'Phóng to').click();
        await button(page, 'Phóng to').click();
        await button(page, 'Mức thu phóng 120%, bấm để về 100%').click();
        expect(await zoomLevel()).toBe(100);
        await button(page, 'Phóng to').click();
        await button(page, 'Vừa khung nhìn').click();
        expect(await zoomLevel(), '"Vừa khung nhìn" = 100 % (IQP onFitToScreen = resetZoom)').toBe(100);
      });

      await test.step('[11-A-016] zoom bounds 400 % / 10 %', async () => {
        for (let i = 0; i < 31; i += 1) await button(page, 'Phóng to').click();
        expect.soft(await zoomLevel()).toBe(400);
        await captureEvidence(page, 'E03_11-A-016_zoom_400.png');
        for (let i = 0; i < 40; i += 1) await button(page, 'Thu nhỏ').click();
        expect.soft(await zoomLevel()).toBe(10);
        await captureEvidence(page, 'E03_11-A-016_zoom_10.png');
        await button(page, 'Mức thu phóng 10%, bấm để về 100%').click();
      });

      await test.step('[11-E-007] at 200 % ArrowRight inside the zoomed frame scrolls it (QA-03e BUG-540: InputQualityGateImagePanel.tsx:87 stopPropagation)', async () => {
        await zoomTo(200);
        const frame = page.getByRole('group', { name: ZOOMED_FRAME, exact: true });
        await frame.focus();
        const before = await frame.evaluate((el) => el.scrollLeft);
        await page.keyboard.press('ArrowRight');
        await page.waitForTimeout(300);
        const after = await frame.evaluate((el) => el.scrollLeft);
        await captureEvidence(page, 'E03_11-E-007_zoomed_arrow.png', { caption: `scrollLeft ${String(before)} → ${String(after)}` });
        expect.soft(after, 'ArrowRight scrolls the zoomed frame (A12)').toBeGreaterThan(before);
        await button(page, 'Mức thu phóng 200%, bấm để về 100%').click();
      });

      await test.step('[11-C-036] blocked note visible on load, before any click', async () => {
        await expect.soft(page.getByText(ACK_NOTE, { exact: true })).toBeVisible();
        await captureEvidence(page, 'E03_11-C-036_ack_note.png');
      });

      await test.step('[11-E-014] "Tiếp tục xử lý" stays focusable, described by the note', async () => {
        await expect.soft(continueBtn(page)).not.toHaveAttribute('aria-disabled', 'true');
        await expect.soft(continueBtn(page)).toHaveAccessibleDescription(ACK_NOTE);
        await continueBtn(page).focus();
        await expect.soft(continueBtn(page)).toBeFocused();
      });

      await test.step('[11-A-032] continue without the box stays; check then uncheck → note back, still blocked', async () => {
        await continueBtn(page).click();
        await quiet(page);
        expect.soft(pathOf(page)).toBe(ROUTES.project.quality(project.projectId));
        await setAck(page, true);
        await setAck(page, false);
        await expect.soft(page.getByText(ACK_NOTE, { exact: true })).toBeVisible();
        await continueBtn(page).click();
        await quiet(page);
        expect.soft(pathOf(page)).toBe(ROUTES.project.quality(project.projectId));
        await captureEvidence(page, 'E03_11-A-032_unchecked_blocked.png');
      });

      await test.step('[11-A-031] check the acknowledgement → "Tiếp tục xử lý" → /pipeline; Back → quality', async () => {
        await setAck(page, true);
        await expect(page.getByText(ACK_NOTE, { exact: true })).toHaveCount(0);
        await continueBtn(page).click();
        await expect.poll(() => pathOf(page)).toBe(ROUTES.project.pipeline(project.projectId));
        await captureEvidence(page, 'E03_11-A-031_continue_pipeline.png');
        await page.goBack();
        await expect.poll(() => pathOf(page)).toBe(ROUTES.project.quality(project.projectId));
        await expect(report(page)).toBeVisible({ timeout: 45_000 });
      });

      const straightenDialog = dialog(page, `Nắn thẳng bản vẽ tầng ${project.floors[0]!.name}?`);

      await test.step('[11-E-009] straighten dialog: aria-modal, labelled, focus inside and trapped; "Huỷ" → focus back on opener', async () => {
        await button(page, STRAIGHTEN).click();
        await expect.soft(straightenDialog).toBeVisible();
        await expect.soft(straightenDialog).toHaveAttribute('aria-modal', 'true');
        await expect.soft(straightenDialog).toContainText(STRAIGHTEN_BODY);
        const inside = async (): Promise<boolean> => straightenDialog.evaluate((d) => d.contains(document.activeElement));
        expect.soft(await inside(), 'focus moved inside the dialog').toBe(true);
        for (let i = 0; i < 5; i += 1) {
          await page.keyboard.press('Tab');
          expect.soft(await inside(), `Tab ${String(i + 1)} stays inside`).toBe(true);
        }
        await captureEvidence(page, 'E03_11-E-009_straighten_dialog.png');
        await button(straightenDialog, CANCEL).click();
        await expect.soft(straightenDialog).toHaveCount(0);
        await expect.soft(page.locator('[data-quality-action="straighten"]')).toBeFocused();
      });

      await test.step('[11-A-026] Esc and "Đóng hộp thoại" close the dialog; no POST', async () => {
        await button(page, STRAIGHTEN).click();
        await expect.soft(straightenDialog).toBeVisible();
        await page.keyboard.press('Escape');
        await expect.soft(straightenDialog).toHaveCount(0);
        await button(page, STRAIGHTEN).click();
        await button(straightenDialog, CLOSE_DIALOG).click();
        await expect.soft(straightenDialog).toHaveCount(0);
        await quiet(page);
        expect.soft(straightenPosts.list.length, 'POST …/straighten sent').toBe(0);
      });

      let post: Request | undefined;
      await test.step('[11-A-028] double click "Nắn thẳng" → exactly one POST', async () => {
        await button(page, STRAIGHTEN).click();
        const answered = page.waitForResponse((r) => r.request().method() === 'POST' && r.url().endsWith('/quality/straighten'), { timeout: 120_000 });
        await button(straightenDialog, CONFIRM_STRAIGHTEN).dblclick();
        const response = await answered;
        post = response.request();
        await quiet(page);
        expect(straightenPosts.list.length, 'POST …/straighten after a double click').toBe(1);
        expect(response.status(), 'straighten answer').toBe(200);
      });

      await test.step('[11-A-027] POST has Idempotency-Key, 200; dialog closes, skew gone, announced, comparison field', async () => {
        expect(post?.headers()['idempotency-key'] ?? '', 'Idempotency-Key header').not.toBe('');
        await expect(straightenDialog).toHaveCount(0);
        await expect(finding(page, 'Ảnh bị nghiêng')).toHaveCount(0, { timeout: 30_000 });
        await expect(page.getByRole('textbox', { name: COMPARISON })).toBeVisible();
        await expect.poll(() => announced(page)).toContain(STRAIGHTENED);
        await captureEvidence(page, 'E03_11-A-027_straightened.png', { caption: `POST …/straighten 200, Idempotency-Key present` });
      });

      await test.step('[11-D-002] the 200 came from the project engineer; footer buttons present for the engineer', async () => {
        expect.soft(s.log.filter((e) => e.method === 'POST' && e.path.endsWith('/quality/straighten')).map((e) => e.status)).toEqual([200]);
        await expect.soft(continueBtn(page)).toBeVisible();
        await expect.soft(button(page, SECONDARY)).toBeVisible();
      });

      const field = page.getByRole('textbox', { name: COMPARISON });
      const divider = content(page).locator('div.w-px'); // IQP:504-509
      const commit = async (text: string): Promise<void> => {
        await field.fill(text);
        await field.blur();
      };

      await test.step('[11-A-038] comparison field: typed value, ArrowUp +1, Shift+ArrowUp +10 move the divider', async () => {
        await commit('30');
        expect.soft(await pct(divider, 'left')).toBeCloseTo(30, 5);
        await field.focus();
        await page.keyboard.press('ArrowUp');
        await field.blur();
        expect.soft(await pct(divider, 'left')).toBeCloseTo(31, 5);
        await field.focus();
        await page.keyboard.press('Shift+ArrowUp');
        await field.blur();
        expect.soft(await pct(divider, 'left')).toBeCloseTo(41, 5);
        await expect.soft(page.getByText(COMPARISON_HINT, { exact: true })).toBeVisible();
        await captureEvidence(page, 'E03_11-A-038_comparison_divider.png');
      });

      await test.step('[11-C-034] 120 → "Giá trị không quá 100 %."; -5 → "Giá trị không nhỏ hơn 0 %."; divider unchanged', async () => {
        await commit('120');
        await expect.soft(page.getByText('Giá trị không quá 100 %.', { exact: true })).toBeVisible();
        expect.soft(await pct(divider, 'left')).toBeCloseTo(41, 5);
        await captureEvidence(page, 'E03_11-C-034_comparison_over.png');
        await commit('-5');
        await expect.soft(page.getByText('Giá trị không nhỏ hơn 0 %.', { exact: true })).toBeVisible();
        expect.soft(await pct(divider, 'left')).toBeCloseTo(41, 5);
      });

      await test.step('[11-C-035] "37,5" → 37.5 %; empty → 0 %', async () => {
        await commit('37,5');
        expect.soft(await pct(divider, 'left')).toBeCloseTo(37.5, 5);
        await commit('');
        expect.soft(await pct(divider, 'left')).toBeCloseTo(0, 5);
        await captureEvidence(page, 'E03_11-C-035_comparison_decimal_empty.png');
      });

      await test.step('[11-A-037] reload → new assessment (no skew), acknowledgement reset, no comparison field', async () => {
        await page.reload();
        await expect(report(page)).toBeVisible({ timeout: 45_000 });
        await expect(finding(page, 'Ảnh bị nghiêng')).toHaveCount(0);
        await expect(page.getByRole('textbox', { name: COMPARISON })).toHaveCount(0);
        if ((await ackBox(page).count()) > 0) await expect(ackBox(page)).not.toBeChecked();
        await captureEvidence(page, 'E03_11-A-037_reload_after_straighten.png');
      });

      await test.step('[11-A-033] footer "Tải bản vẽ khác" → /upload; Back → quality (fold)', async () => {
        await button(page, SECONDARY).click();
        await expect.poll(() => pathOf(page)).toBe(ROUTES.project.upload(project.projectId));
        await expect(page.getByTestId('floor-upload-dropzone')).toBeVisible();
        await captureEvidence(page, 'E03_11-A-033_upload_another.png');
        await page.goBack();
        await expect.poll(() => pathOf(page)).toBe(ROUTES.project.quality(project.projectId));
        await expect(report(page)).toBeVisible({ timeout: 45_000 });
      });

      await test.step('[11-A-003] breadcrumb "Dự án" → "/" (fold)', async () => {
        await button(page.getByRole('navigation', { name: BREADCRUMB_NAV }), 'Dự án').click();
        await expect.poll(() => pathOf(page)).toBe(ROUTES.dashboard);
        await captureEvidence(page, 'E03_11-A-003_breadcrumb_home.png');
      });
    });
  });

  test('SCR-11 · FL-11-02 · admin picks four corners on a frameless drawing and moves between floors', async ({ browser }) => {
    test.setTimeout(SETUP_TIMEOUT_MS + 240_000);
    await flow(async (f) => {
      const project = await seed(f, '11-fl02', [
        { name: 'Tầng 1', png: null },
        { name: 'Tầng 2', png: await framelessPng(browser) },
        { name: 'Tầng 3', png: envPng() },
      ]);
      const s = await session(f, browser);
      const { page } = s;
      const cornerPosts = countRequests(page, 'POST', '/quality/corners');
      const pickBtn = (): Locator => page.locator('[data-quality-action="corners"]');
      const corners = page.getByRole('group', { name: CORNER_GROUP, exact: true });

      await test.step('[11-A-004] one GET …/quality; Tầng 2 (first floor with a drawing) is shown and aria-current', async () => {
        await openQuality(page, project.projectId);
        await isActive(page, 'Tầng 2');
        await quiet(page);
        expect(qualityGets(s), 'GET …/quality on load').toBe(1);
        await expect(page.getByRole('img', { name: altOf('Tầng 2') })).toBeVisible();
        await captureEvidence(page, 'E03_11-A-004_first_drawn_floor.png');
      });

      await test.step('[11-C-019] finding "Không tìm thấy khung bản vẽ" + "Chọn góc thủ công"', async () => {
        await expect(finding(page, 'Không tìm thấy khung bản vẽ')).toContainText('Bạn có thể tự chọn 4 góc.');
        await expect(pickBtn()).toHaveAccessibleName(PICK);
        await captureEvidence(page, 'E03_11-C-019_frame_finding.png');
      });

      let pickingZoom = '';
      await test.step('[11-A-017] zoom 150 %, then corner mode: 4 handles at 10/90 %, hint, "Gửi bốn góc đã chọn"', async () => {
        for (let i = 0; i < 5; i += 1) await button(page, 'Phóng to').click();
        await pickBtn().click();
        await expect(corners).toBeVisible();
        await expect(corners.getByRole('button')).toHaveCount(4);
        const at = await corners.getByRole('button').evaluateAll((els) => els.map((el) => `${(el as HTMLElement).style.left},${(el as HTMLElement).style.top}`));
        expect(at).toEqual(['10%,10%', '90%,10%', '90%,90%', '10%,90%']);
        await expect(page.getByText(CORNER_HINT, { exact: true })).toBeVisible();
        await expect(pickBtn()).toHaveAccessibleName(SEND);
        pickingZoom = await content(page).evaluate((el) => (el as HTMLElement).style.width);
        await captureEvidence(page, 'E03_11-A-017_corner_mode.png');
      });

      await test.step('[11-E-008] handle names; 44 px hit area around a 10 px dot', async () => {
        for (const name of ['Góc trên bên trái', 'Góc trên bên phải', 'Góc dưới bên phải', 'Góc dưới bên trái']) await expect.soft(handle(page, name)).toBeVisible();
        const box = await handle(page, 'Góc trên bên trái').boundingBox();
        const dot = await handle(page, 'Góc trên bên trái').locator('span').boundingBox();
        expect.soft([Math.round(box?.width ?? 0), Math.round(box?.height ?? 0)]).toEqual([44, 44]);
        expect.soft([Math.round(dot?.width ?? 0), Math.round(dot?.height ?? 0)]).toEqual([10, 10]);
        await captureEvidence(page, 'E03_11-E-008_handles.png');
      });

      await test.step('[11-C-031] ArrowUp ×11 on "Góc trên bên trái" → top 0 % and stays', async () => {
        await handle(page, 'Góc trên bên trái').focus();
        for (let i = 0; i < 11; i += 1) await page.keyboard.press('ArrowUp');
        expect.soft(await pct(handle(page, 'Góc trên bên trái'), 'top')).toBeLessThan(1e-6);
        await captureEvidence(page, 'E03_11-C-031_corner_clamp_key.png');
      });

      await test.step('[11-A-019] mouse drag moves the handle; outside the frame it clamps to 0/100 %', async () => {
        const br = handle(page, 'Góc dưới bên phải');
        await dragTo(page, br, 0.6, 0.7);
        const moved = page.getByRole('group', { name: CORNER_GROUP, exact: true }).getByRole('button').nth(2);
        expect.soft(await pct(moved, 'left')).toBeCloseTo(60, 0);
        expect.soft(await pct(moved, 'top')).toBeCloseTo(70, 0);
        await dragTo(page, moved, 1.3, 1.3);
        expect.soft(await pct(moved, 'left')).toBe(100);
        expect.soft(await pct(moved, 'top')).toBe(100);
        await captureEvidence(page, 'E03_11-A-019_corner_drag.png');
      });

      await test.step('[11-C-032] dragging "Góc trên bên trái" past x = 50 % renames it "Góc trên bên phải"', async () => {
        const tl = corners.getByRole('button').nth(0);
        await dragTo(page, tl, 0.6, 0.05);
        await expect.soft(tl).toHaveAccessibleName('Góc trên bên phải');
        await captureEvidence(page, 'E03_11-C-032_corner_rename.png');
      });

      const cornersDialog = dialog(page, 'Cắt và nắn bản vẽ tầng Tầng 2 theo bốn góc?');
      await test.step('[11-A-021] "Gửi bốn góc đã chọn" → corners confirm dialog', async () => {
        await pickBtn().click();
        await expect(cornersDialog).toBeVisible();
        await expect(cornersDialog).toContainText(CORNERS_BODY);
        await expect(button(cornersDialog, CANCEL)).toBeVisible();
        await expect(button(cornersDialog, CONFIRM_CORNERS)).toBeVisible();
        await captureEvidence(page, 'E03_11-A-021_corners_dialog.png');
      });

      await test.step('[11-A-022] "Huỷ" → dialog closes, handles stay, no POST', async () => {
        await button(cornersDialog, CANCEL).click();
        await expect.soft(cornersDialog).toHaveCount(0);
        await expect.soft(corners).toBeVisible();
        await quiet(page);
        expect.soft(cornerPosts.list.length).toBe(0);
        await captureEvidence(page, 'E03_11-A-022_corners_cancel.png');
      });

      await test.step('[11-E-010] Esc closes only the dialog; the next Esc exits corner mode', async () => {
        await pickBtn().click();
        await expect.soft(cornersDialog).toBeVisible();
        await page.keyboard.press('Escape');
        await expect.soft(cornersDialog).toHaveCount(0);
        await expect.soft(corners).toBeVisible();
        await captureEvidence(page, 'E03_11-E-010_esc_dialog_only.png');
        await page.keyboard.press('Escape');
        await expect.soft(corners).toHaveCount(0);
        await expect.soft(pickBtn()).toHaveAccessibleName(PICK);
      });

      await test.step('[11-A-018] zoom cluster absent and 100 % while picking; back at 150 % after (BUG-292)', async () => {
        expect.soft(pickingZoom, 'image width while picking').toBe('100%');
        expect.soft(await content(page).evaluate((el) => (el as HTMLElement).style.width)).toBe('150%');
        await expect.soft(button(page, 'Mức thu phóng 150%, bấm để về 100%')).toBeVisible();
        await pickBtn().click();
        await expect.soft(page.getByRole('group', { name: ZOOM_GROUP, exact: true })).toHaveCount(0);
        await captureEvidence(page, 'E03_11-A-018_zoom_hidden_picking.png');
        await page.keyboard.press('Escape');
      });

      await test.step('[11-A-036] corner mode, nudge, reload → no handles, fresh report', async () => {
        await pickBtn().click();
        await handle(page, 'Góc dưới bên trái').focus();
        await page.keyboard.press('ArrowDown');
        await page.reload();
        await expect(report(page)).toBeVisible({ timeout: 45_000 });
        await expect(corners).toHaveCount(0);
        await expect(pickBtn()).toHaveAccessibleName(PICK);
        await isActive(page, 'Tầng 2');
        await captureEvidence(page, 'E03_11-A-036_reload_drops_corners.png');
      });

      await test.step('[11-B-022] top-left dragged right of top-right → 422 → "Bốn góc chưa tạo thành …"; corner mode stays', async () => {
        await pickBtn().click();
        await dragTo(page, handle(page, 'Góc trên bên trái'), 0.95, 0.1);
        await pickBtn().click();
        const answered = page.waitForResponse((r) => r.request().method() === 'POST' && r.url().endsWith('/quality/corners'), { timeout: 60_000 });
        await button(cornersDialog, CONFIRM_CORNERS).click();
        expect((await answered).status(), 'corners answer').toBe(422);
        await expect(writeBand(page)).toContainText(SENTENCE.invalidCorners);
        await expect(corners).toBeVisible();
        await captureEvidence(page, 'E03_11-B-022_corners_invalid.png');
      });

      await test.step('[11-A-005] blank area, ArrowRight → Tầng 3: aria-current, new GET, announcement', async () => {
        const before = qualityGets(s);
        await page.evaluate(() => {
          const w = window as unknown as { __qaSkeleton: boolean };
          w.__qaSkeleton = false;
          new MutationObserver(() => {
            if (document.querySelector('[role="presentation"] .animate-pulse') !== null) w.__qaSkeleton = true;
          }).observe(document.body, { subtree: true, childList: true });
        });
        await report(page).getByText('Các tầng đã đo', { exact: true }).click();
        await page.keyboard.press('ArrowRight');
        await isActive(page, 'Tầng 3');
        await expect.poll(() => qualityGets(s)).toBeGreaterThan(before);
        expect(s.log.some((e) => e.path === qualityPath(project.projectId, floorId(project, 'Tầng 3')))).toBe(true);
        await expect.poll(() => announced(page)).toContain('Đang xem bản vẽ tầng Tầng 3');
        await captureEvidence(page, 'E03_11-A-005_arrow_next_floor.png');
      });

      await test.step('[11-A-010] after the switch: no handles, no write-error band', async () => {
        await expect.soft(corners).toHaveCount(0);
        await expect.soft(writeBand(page)).toHaveCount(0);
        await captureEvidence(page, 'E03_11-A-010_switch_clears.png');
      });

      await test.step('[11-B-016] the body showed the skeleton during that first switch', async () => {
        expect.soft(await page.evaluate(() => (window as unknown as { __qaSkeleton: boolean }).__qaSkeleton)).toBe(true);
        await captureEvidence(page, 'E03_11-B-016_switch_report.png', { caption: 'MutationObserver saw [role=presentation] .animate-pulse during the switch' });
      });

      await test.step('[11-A-006] ArrowLeft → Tầng 2 again; label "Chọn góc thủ công"', async () => {
        await page.keyboard.press('ArrowLeft');
        await isActive(page, 'Tầng 2');
        await expect(pickBtn()).toHaveAccessibleName(PICK);
        await captureEvidence(page, 'E03_11-A-006_arrow_previous_floor.png');
      });

      await test.step('[11-A-007] ArrowLeft on the first / ArrowRight on the last: nothing', async () => {
        const gets = qualityGets(s);
        const said = (await announced(page)).length;
        await page.keyboard.press('ArrowLeft');
        await quiet(page);
        await expect.soft(row(page, 'Tầng 2')).toHaveAttribute('aria-current', 'true');
        expect.soft(qualityGets(s)).toBe(gets);
        expect.soft((await announced(page)).length).toBe(said);
        await page.keyboard.press('ArrowRight');
        await expect.soft(row(page, 'Tầng 3')).toHaveAttribute('aria-current', 'true');
        await expect(report(page)).toBeVisible();
        const said2 = (await announced(page)).length;
        const gets2 = qualityGets(s);
        await page.keyboard.press('ArrowRight');
        await quiet(page);
        await expect.soft(row(page, 'Tầng 3')).toHaveAttribute('aria-current', 'true');
        expect.soft(qualityGets(s)).toBe(gets2);
        expect.soft((await announced(page)).length).toBe(said2);
      });

      await test.step('[11-A-008] click row Tầng 2 → aria-current, report and image switch (fold Q3)', async () => {
        await row(page, 'Tầng 2').click();
        await isActive(page, 'Tầng 2');
        await expect(page.getByRole('img', { name: altOf('Tầng 2') })).toBeVisible();
        await expect(row(page, 'Tầng 3')).not.toHaveAttribute('aria-current', 'true');
        await captureEvidence(page, 'E03_11-A-008_row_click.png');
      });

      await test.step('[11-A-009] click the active row again → no request, no announcement', async () => {
        const gets = qualityGets(s);
        const said = (await announced(page)).length;
        await row(page, 'Tầng 2').click();
        await quiet(page);
        expect.soft(qualityGets(s)).toBe(gets);
        expect.soft((await announced(page)).length).toBe(said);
      });

      await test.step('[11-E-003] row Tầng 3 focused, Enter → selected', async () => {
        await row(page, 'Tầng 3').focus();
        await page.keyboard.press('Enter');
        await expect.soft(row(page, 'Tầng 3')).toHaveAttribute('aria-current', 'true');
        await captureEvidence(page, 'E03_11-E-003_row_enter.png');
      });

      await test.step('[11-E-004] focus stays on the selected row (suspected: falls to body)', async () => {
        await expect(report(page)).toBeVisible();
        const focused = await page.evaluate(() => ({ tag: document.activeElement?.tagName ?? '', current: document.activeElement?.getAttribute('aria-current') ?? null }));
        expect.soft(focused, 'focus after the Enter switch').toEqual({ tag: 'TR', current: 'true' });
      });

      await test.step('[11-E-006] corner mode, focused handle, ArrowRight → nudge only, floor unchanged (QA-03e BUG-540: InputQualityGateImageOverlays.tsx:298)', async () => {
        await row(page, 'Tầng 2').click();
        await isActive(page, 'Tầng 2');
        await pickBtn().click();
        const tl = handle(page, 'Góc trên bên trái');
        await tl.focus();
        await page.keyboard.press('ArrowRight');
        await quiet(page);
        await captureEvidence(page, 'E03_11-E-006_handle_arrow.png');
        await expect.soft(row(page, 'Tầng 2'), 'floor unchanged').toHaveAttribute('aria-current', 'true');
        await expect.soft(corners, 'draft kept').toBeVisible();
        if ((await row(page, 'Tầng 2').getAttribute('aria-current')) !== 'true') await row(page, 'Tầng 2').click();
        await isActive(page, 'Tầng 2');
        if ((await corners.count()) === 0) await pickBtn().click();
      });

      await test.step('[11-A-023] "Cắt và nắn" → POST corners (Idempotency-Key, 4 ratios) 200; mode exits; frame finding gone; comparison', async () => {
        await expect(corners).toBeVisible();
        await pickBtn().click();
        const answered = page.waitForResponse((r) => r.request().method() === 'POST' && r.url().endsWith('/quality/corners'), { timeout: 120_000 });
        await button(cornersDialog, CONFIRM_CORNERS).click();
        const response = await answered;
        expect(response.status(), 'corners answer').toBe(200);
        const req = response.request();
        expect(req.headers()['idempotency-key'] ?? '').not.toBe('');
        const body = req.postDataJSON() as { corners: { xRatio: number; yRatio: number }[] };
        expect(body.corners).toHaveLength(4);
        for (const c of body.corners) expect(c.xRatio >= 0 && c.xRatio <= 1 && c.yRatio >= 0 && c.yRatio <= 1).toBe(true);
        await expect(corners).toHaveCount(0);
        await expect(finding(page, 'Không tìm thấy khung bản vẽ')).toHaveCount(0, { timeout: 30_000 });
        await expect(page.getByRole('textbox', { name: COMPARISON })).toBeVisible();
        await captureEvidence(page, 'E03_11-A-023_corners_applied.png', { caption: `POST …/corners 200 body ${JSON.stringify(body)}` });
      });

      await test.step('[11-E-005] typing in the comparison field: ArrowLeft/Right move the caret, floor stays', async () => {
        const field = page.getByRole('textbox', { name: COMPARISON });
        await field.fill('45');
        await page.keyboard.press('ArrowLeft');
        const caret = await field.evaluate((el) => (el as HTMLInputElement).selectionStart);
        expect.soft(caret).toBe(1);
        await page.keyboard.press('ArrowRight');
        await quiet(page);
        await expect.soft(row(page, 'Tầng 2')).toHaveAttribute('aria-current', 'true');
        await captureEvidence(page, 'E03_11-E-005_field_arrows.png');
      });

      await test.step('[11-E-012] announcements along the flow', async () => {
        const said = await announced(page);
        await attachJson('E03_11-E-012_announcements.json', { said });
        for (const text of ['Đang xem bản vẽ tầng Tầng 3', CORNERS_SENT, SENTENCE.invalidCorners]) expect.soft(said, text).toContain(text);
      });
    });
  });

  test('SCR-11 · FL-11-03 · admin walks 13 crafted floors and reads every metric level', async ({ browser }) => {
    test.setTimeout(SETUP_TIMEOUT_MS + 240_000);
    await flow(async (f) => {
      // Exact sizes are frameless: a found frame makes the pipeline crop the page to it (see P7.ts CLEAN), so a framed
      // 2000 px canvas would be measured ≈ 1772. Those floors add a FRAME_NOT_FOUND (attention) finding, nothing else.
      const sized = (width: number, height: number): Promise<Buffer> => planPng(browser, { width, height, frame: false });
      const pngs: Buffer[] = [
        await planPng(browser, CLEAN),
        await sized(1500, 1500),
        await sized(1000, 1000),
        await sized(2000, 2400),
        await sized(1999, 2400),
        await sized(1200, 1600),
        await sized(1199, 1600),
        await skewedEnvPng(browser, 2),
        await skewedEnvPng(browser, -SKEW),
        await planPng(browser, { ...CLEAN, ink: 85, paper: 235 }),
        await planPng(browser, { ...CLEAN, ink: 120, paper: 200 }),
        await planPng(browser, { ...CLEAN, boxes: 20, dots: 10 }),
        await planPng(browser, { ...CLEAN, boxes: 20, dots: 40 }),
      ];
      const project = await seed(f, '11-fl03', pngs.map((png, i) => ({ name: `Tầng ${String(i + 1)}`, png })));
      const body = await readQuality(f.ownerApi, project.projectId, floorId(project, 'Tầng 1'));
      await attachJson('E03_11-fl03_measurements.json', { floors: body.floors.map((x) => ({ name: x.floorName, measurement: x.measurement, codes: (x.findings as { code: string }[]).map((y) => y.code) })) });
      const s = await session(f, browser);
      const { page } = s;
      const badge = (label: string): Locator => metric(page, label);
      const go = async (name: string): Promise<void> => {
        await page.keyboard.press('ArrowRight');
        await isActive(page, name);
      };

      await test.step('[11-C-001] Tầng 1: four "Tốt", no recommendation line', async () => {
        await openQuality(page, project.projectId);
        await isActive(page, 'Tầng 1');
        for (const label of ['Độ phân giải', 'Độ nghiêng', 'Độ tương phản', 'Nhiễu']) {
          await expect(badge(label)).toContainText('Tốt');
          await expect(badge(label).locator('p')).toHaveCount(0);
        }
        await captureEvidence(page, 'E03_11-C-001_all_good.png');
      });

      await test.step('[11-B-011] pass notice instead of the findings list', async () => {
        const mm = floorOf(body, floorId(project, 'Tầng 1')).measurement;
        await expect.soft(report(page)).toContainText(`${PASS} Độ phân giải ${viResolution(mm.widthPx, mm.heightPx)}, độ nghiêng ${viAngle(mm.skewDeg)}.`);
        await expect.soft(report(page).getByText('Phát hiện', { exact: true })).toHaveCount(0);
        await captureEvidence(page, 'E03_11-B-011_pass_notice.png');
      });

      await test.step('[11-C-029] clean active floor → no acknowledgement although other rows are "Kém"', async () => {
        await expect.soft(ackBox(page)).toHaveCount(0);
        await expect.soft(row(page, 'Tầng 3')).toContainText('Kém');
        await captureEvidence(page, 'E03_11-C-029_gate_active_floor_only.png');
      });

      await test.step('[11-C-026] table: "Không có phát hiện" / "N phát hiện cần chú ý" + worst-of-four badge', async () => {
        await expect.soft(row(page, 'Tầng 1')).toContainText('Không có phát hiện');
        for (const x of body.floors.slice(1)) {
          const n = (x.findings as unknown[]).length;
          await expect.soft(row(page, String(x.floorName))).toContainText(`${String(n)} phát hiện cần chú ý`);
        }
        await expect.soft(row(page, 'Tầng 3')).toContainText('Kém');
        await captureEvidence(page, 'E03_11-C-026_floor_table.png', { fullPage: true });
      });

      await report(page).getByText('Các tầng đã đo', { exact: true }).click();

      await test.step('[11-C-002] Tầng 2 (1500²): "Cần chú ý" + recommendation', async () => {
        await go('Tầng 2');
        await expect.soft(badge('Độ phân giải')).toContainText('Cần chú ý');
        await expect.soft(badge('Độ phân giải')).toContainText(RES_RECOMMENDATION);
        await captureEvidence(page, 'E03_11-C-002_resolution_attention.png');
      });

      await test.step('[11-C-003] Tầng 3 (1000²): "Kém" + recommendation; checkbox', async () => {
        await go('Tầng 3');
        await expect(badge('Độ phân giải')).toContainText('Kém');
        await expect(badge('Độ phân giải')).toContainText(RES_RECOMMENDATION);
        await expect(ackBox(page)).toBeVisible();
        await captureEvidence(page, 'E03_11-C-003_resolution_poor.png');
      });

      await test.step('[11-C-017] "Độ phân giải thấp" copy; no quick-fix button', async () => {
        const card = finding(page, 'Độ phân giải thấp');
        await expect.soft(card).toContainText('Độ phân giải thấp — 1.000 × 1.000 px. Cạnh ngắn chỉ 1.000 px, nên');
        await expect.soft(card).toContainText(RES_RECOMMENDATION);
        await expect.soft(card.getByRole('button')).toHaveCount(0);
        await captureEvidence(page, 'E03_11-C-017_resolution_copy.png');
      });

      await test.step('[11-C-023] attention dot vs poor dot; region borders by severity', async () => {
        await expect.soft(finding(page, 'Không tìm thấy khung bản vẽ').locator('span.rounded-full').first()).toHaveClass(/bg-state-attention/u);
        await expect.soft(finding(page, 'Độ phân giải thấp').locator('span.rounded-full').first()).toHaveClass(/bg-state-violation/u);
        await expect.soft(region(page, 'không tìm thấy khung bản vẽ')).toHaveClass(/border-state-attention/u);
        await expect.soft(region(page, 'độ phân giải thấp')).toHaveClass(/border-state-violation/u);
        await captureEvidence(page, 'E03_11-C-023_severity_colours.png');
      });

      await test.step('[11-C-004] 2000 → "Tốt"; 1999 → "Cần chú ý"', async () => {
        await go('Tầng 4');
        await expect.soft(badge('Độ phân giải')).toContainText('Tốt');
        await go('Tầng 5');
        await expect.soft(badge('Độ phân giải')).toContainText('Cần chú ý');
        await captureEvidence(page, 'E03_11-C-004_resolution_2000_1999.png');
      });

      await test.step('[11-C-005] 1200 → "Cần chú ý"; 1199 → "Kém"', async () => {
        await go('Tầng 6');
        await expect.soft(badge('Độ phân giải')).toContainText('Cần chú ý');
        await go('Tầng 7');
        await expect.soft(badge('Độ phân giải')).toContainText('Kém');
        await captureEvidence(page, 'E03_11-C-005_resolution_1200_1199.png');
      });

      await test.step('[11-C-006] Tầng 8 (2°): "Cần chú ý" + straighten recommendation; no checkbox', async () => {
        await go('Tầng 8');
        await expect.soft(badge('Độ nghiêng')).toContainText('Cần chú ý');
        await expect.soft(badge('Độ nghiêng')).toContainText(SKEW_RECOMMENDATION);
        await expect.soft(ackBox(page)).toHaveCount(0);
        await captureEvidence(page, 'E03_11-C-006_skew_attention.png');
      });

      await test.step('[11-C-008] Tầng 9 (−8°): "Kém", signed value and line caption', async () => {
        await go('Tầng 9');
        const skew = floorOf(body, floorId(project, 'Tầng 9')).measurement.skewDeg;
        expect.soft(skew, 'measured negative').toBeLessThan(-5);
        await expect.soft(badge('Độ nghiêng')).toContainText('Kém');
        await expect.soft(badge('Độ nghiêng')).toContainText(viAngle(skew));
        await expect.soft(imagePanel(page)).toContainText(`Độ nghiêng đo được so với phương ngang: ${viAngle(skew)}`);
        await captureEvidence(page, 'E03_11-C-008_negative_skew.png');
      });

      await test.step('[11-C-010] Tầng 10: contrast "Cần chú ý" + recommendation', async () => {
        await go('Tầng 10');
        await expect.soft(badge('Độ tương phản')).toContainText('Cần chú ý');
        await expect.soft(badge('Độ tương phản')).toContainText(CONTRAST_RECOMMENDATION);
        await captureEvidence(page, 'E03_11-C-010_contrast_attention.png');
      });

      await test.step('[11-C-011] Tầng 11: contrast "Kém"; checkbox', async () => {
        await go('Tầng 11');
        await expect.soft(badge('Độ tương phản')).toContainText('Kém');
        await expect.soft(badge('Độ tương phản')).toContainText(CONTRAST_RECOMMENDATION);
        await expect.soft(ackBox(page)).toBeVisible();
        await captureEvidence(page, 'E03_11-C-011_contrast_poor.png');
      });

      await test.step('[11-C-020] "Độ tương phản thấp" copy; no button', async () => {
        const score = floorOf(body, floorId(project, 'Tầng 11')).measurement.contrastScore;
        const card = finding(page, 'Độ tương phản thấp');
        await expect.soft(card).toContainText(`Độ tương phản thấp — ${viScore(score)}. Ở mức này nét mảnh nhất`);
        await expect.soft(card).toContainText('Nên quét lại với nền sáng đều hơn.');
        await expect.soft(card.getByRole('button')).toHaveCount(0);
        await captureEvidence(page, 'E03_11-C-020_contrast_copy.png');
      });

      await test.step('[11-C-013] Tầng 12: noise "Cần chú ý" + recommendation', async () => {
        await go('Tầng 12');
        await expect.soft(badge('Nhiễu')).toContainText('Cần chú ý');
        await expect.soft(badge('Nhiễu')).toContainText(NOISE_RECOMMENDATION);
        await captureEvidence(page, 'E03_11-C-013_noise_attention.png');
      });

      await test.step('[11-C-014] Tầng 13: noise "Kém"; checkbox', async () => {
        await go('Tầng 13');
        await expect.soft(badge('Nhiễu')).toContainText('Kém');
        await expect.soft(ackBox(page)).toBeVisible();
        await captureEvidence(page, 'E03_11-C-014_noise_poor.png');
      });

      await test.step('[11-C-021] "Nhiễu cao" copy; no button', async () => {
        const score = floorOf(body, floorId(project, 'Tầng 13')).measurement.noiseScore;
        const card = finding(page, 'Nhiễu cao');
        await expect.soft(card).toContainText(`Nhiễu cao — ${viScore(score)}. Ở mức này đốm nhiễu`);
        await expect.soft(card).toContainText('không nén mạnh.');
        await expect.soft(card.getByRole('button')).toHaveCount(0);
        await captureEvidence(page, 'E03_11-C-021_noise_copy.png');
      });

      await test.step('[11-B-017] 12 presses reach the 13th row; 13 rows; no horizontal scroll', async () => {
        await isActive(page, 'Tầng 13');
        await expect(report(page).getByRole('row')).toHaveCount(14); // header + 13
        const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
        expect(overflow).toBeLessThanOrEqual(0);
        await captureEvidence(page, 'E03_11-B-017_thirteen_floors.png', { fullPage: true });
      });

      await test.step('[11-C-028] acknowledgement on Tầng 3 still holds on Tầng 9; continue → /pipeline; Back', async () => {
        await row(page, 'Tầng 3').click();
        await isActive(page, 'Tầng 3');
        await setAck(page, true);
        await row(page, 'Tầng 9').click();
        await isActive(page, 'Tầng 9');
        await expect(ackBox(page)).toBeChecked();
        await captureEvidence(page, 'E03_11-C-028_ack_screen_wide.png');
        await continueBtn(page).click();
        await expect.poll(() => pathOf(page)).toBe(ROUTES.project.pipeline(project.projectId));
        await page.goBack();
        await expect(report(page)).toBeVisible({ timeout: 45_000 });
      });

      await test.step('[11-C-027] Tầng 8 (attention only): no checkbox; continue → /pipeline', async () => {
        await row(page, 'Tầng 8').click();
        await isActive(page, 'Tầng 8');
        await expect(ackBox(page)).toHaveCount(0);
        await captureEvidence(page, 'E03_11-C-027_attention_only.png');
        await continueBtn(page).click();
        await expect.poll(() => pathOf(page)).toBe(ROUTES.project.pipeline(project.projectId));
      });
    });
  });

  test('SCR-11 · FL-11-04 · unknown project, then a project with no floors and no drawing', async ({ browser }) => {
    test.setTimeout(120_000);
    await flow(async (f) => {
      const s = await session(f, browser);
      const { page } = s;
      const unknown = `prj_qa-p7-${Date.now().toString(36)}`;

      await test.step('[11-B-007] unknown project → not-found alert, no "Tiếp tục xử lý" (fold)', async () => {
        await page.goto(ROUTES.project.quality(unknown));
        const alert = alertWith(page, NOT_FOUND_TITLE);
        await expect(alert).toContainText(NOT_FOUND_SENTENCE, { timeout: 45_000 });
        await expect(button(alert, BACK_TO_PROJECTS)).toBeVisible();
        await expect(continueBtn(page)).toHaveCount(0);
        await captureEvidence(page, 'E03_11-B-007_unknown_project.png');
      });

      await test.step('[11-A-035] "Về danh sách dự án" → "/" (fold)', async () => {
        await button(alertWith(page, NOT_FOUND_TITLE), BACK_TO_PROJECTS).click();
        await expect.poll(() => pathOf(page)).toBe(ROUTES.dashboard);
        await captureEvidence(page, 'E03_11-A-035_back_to_projects.png');
      });

      const project = await createProject(f.ownerApi, '11-fl04', 0);
      f.projects.push(project.projectId);

      await test.step('[11-B-009] zero floors → "Chưa có bản vẽ để kiểm tra"; no GET …/quality', async () => {
        const before = qualityGets(s);
        await page.goto(ROUTES.project.quality(project.projectId));
        await expect(page.getByText(NO_DRAWING_TITLE, { exact: true })).toBeVisible({ timeout: 45_000 });
        await quiet(page);
        expect(qualityGets(s)).toBe(before);
        await captureEvidence(page, 'E03_11-B-009_zero_floors.png');
      });

      await test.step('[11-B-008] 2 floors added via API, reload → empty state + notice (fold)', async () => {
        for (const order of [0, 1]) {
          const res = await f.ownerApi.post(`/api/projects/${project.projectId}/floors`, {
            data: { id: `L-QAP7${Date.now().toString(36).toUpperCase()}${String(order)}`, name: `Tầng ${String(order + 1)}`, order, elevationMm: order * 3_000, heightMm: 3_000 },
          });
          expect(res.status(), `POST floors ${String(order)}: ${(await res.text()).slice(0, 200)}`).toBe(201);
        }
        await page.reload();
        await expect(page.getByText(NO_DRAWING_TITLE, { exact: true })).toBeVisible({ timeout: 45_000 });
        await expect(page.getByText(NO_DRAWING_NOTICE, { exact: true })).toBeVisible();
        await captureEvidence(page, 'E03_11-B-008_floors_no_drawing.png');
      });

      await test.step('[11-E-015] "Tiếp tục xử lý" aria-disabled with its reason; a forced click stays (fold)', async () => {
        await expect.soft(continueBtn(page)).toHaveAttribute('aria-disabled', 'true');
        await expect.soft(continueBtn(page)).toHaveAccessibleDescription(NO_DRAWING_REASON);
        await continueBtn(page).click({ force: true });
        await quiet(page);
        expect.soft(pathOf(page)).toBe(ROUTES.project.quality(project.projectId));
        await captureEvidence(page, 'E03_11-E-015_continue_aria_disabled.png');
      });

      await test.step('[11-A-034] "Tải bản vẽ lên" → /upload (fold)', async () => {
        await button(page, NO_DRAWING_ACTION).click();
        await expect.poll(() => pathOf(page)).toBe(ROUTES.project.upload(project.projectId));
        await captureEvidence(page, 'E03_11-A-034_upload_from_empty.png');
      });
    });
  });

  test('SCR-11 · FL-11-05 · viewer member opens the gate (read only)', async ({ browser }) => {
    test.setTimeout(SETUP_TIMEOUT_MS + 120_000);
    await flow(async (f) => {
      const viewer = await poolUser(f.admin, 'viewer');
      const project = await seed(f, '11-fl05', [
        { name: 'Tầng 1', png: await skewedEnvPng(browser, SKEW) },
        { name: 'Tầng 2', png: await planPng(browser, CLEAN) },
      ]);
      const empty = await createProject(f.ownerApi, '11-fl05-empty', 1);
      f.projects.push(empty.projectId);
      await addProjectMember(f.ownerApi, project.projectId, viewer.email);
      await addProjectMember(f.ownerApi, empty.projectId, viewer.email);
      const s = await session(f, browser, viewer);
      const { page } = s;

      await test.step('[11-D-003] findings listed, no "Tự động nắn" / "Chọn góc thủ công"', async () => {
        await openQuality(page, project.projectId);
        await isActive(page, 'Tầng 1');
        await expect(finding(page, 'Ảnh bị nghiêng')).toBeVisible();
        await expect(button(page, STRAIGHTEN)).toHaveCount(0);
        await expect(button(page, PICK)).toHaveCount(0);
        await captureEvidence(page, 'E03_11-D-003_viewer_no_quick_fix.png');
      });

      await test.step('[11-D-004] no footer buttons and no read-only notice', async () => {
        await expect.soft(continueBtn(page)).toHaveCount(0);
        await expect.soft(button(page, SECONDARY)).toHaveCount(0);
        await expect.soft(page.locator('main, body').first()).not.toContainText(/chỉ (được )?xem/iu);
        await captureEvidence(page, 'E03_11-D-004_viewer_no_footer.png', { fullPage: true });
      });

      await test.step('[11-D-005] acknowledgement checkbox still shown with no button to use it', async () => {
        await expect.soft(ackBox(page)).toBeVisible();
        await captureEvidence(page, 'E03_11-D-005_viewer_checkbox.png', { fullPage: true });
      });

      await test.step('[11-D-007] clean Tầng 2 → pass notice for the viewer (QA-03e BUG-541: useInputQualityGate.ts:931 passNotice from the verdict)', async () => {
        await row(page, 'Tầng 2').click();
        await isActive(page, 'Tầng 2');
        await captureEvidence(page, 'E03_11-D-007_viewer_clean_floor.png');
        await expect.soft(report(page), 'pass notice for the viewer (useInputQualityGate passNotice no longer tied to forbidden)').toContainText(PASS);
      });

      await test.step('[11-D-006] no-drawing project → empty state only, no "Tải bản vẽ lên", no footer', async () => {
        await page.goto(ROUTES.project.quality(empty.projectId));
        await expect(page.getByText(NO_DRAWING_TITLE, { exact: true })).toBeVisible({ timeout: 45_000 });
        await expect(button(page, NO_DRAWING_ACTION)).toHaveCount(0);
        await expect(continueBtn(page)).toHaveCount(0);
        await expect(button(page, SECONDARY)).toHaveCount(0);
        await captureEvidence(page, 'E03_11-D-006_viewer_no_drawing.png');
      });
    });
  });

  test('SCR-11 · FL-11-06 · engineer whose role drops to viewer tries to straighten, then loses access', async ({ browser }) => {
    // Plan: "global engineer added as project viewer". Memberships carry no role on this backend (BE project_members:
    // the global role applies), so the per-project mismatch is made the only way the stack allows: the session opened
    // as engineer (session.roles), then an admin lowers the global role (#41 PATCH /api/users/:id/role, own pool slot)
    // and puts it back in `finally`.
    test.setTimeout(SETUP_TIMEOUT_MS + 120_000);
    await flow(async (f) => {
      const engineer = await poolUser(f.admin, 'engineer', P7_ROLE_SLOT);
      const setRole = async (role: 'engineer' | 'viewer'): Promise<number> =>
        (await f.admin.patch(`/api/users/${engineer.id}/role`, { data: { userId: engineer.id, role } })).status();
      f.cleanups.push(() => setRole('engineer'));
      const project = await seed(f, '11-fl06', [{ name: 'Tầng 1', png: await skewedEnvPng(browser, SKEW) }]);
      await addProjectMember(f.ownerApi, project.projectId, engineer.email);
      const s = await session(f, browser, engineer);
      const { page } = s;

      await test.step('[11-D-008] "Tự động nắn" shown from session.roles → "Nắn thẳng" → 403 band', async () => {
        await openQuality(page, project.projectId);
        await expect(button(page, STRAIGHTEN)).toBeVisible();
        expect(await setRole('viewer'), 'PATCH role → viewer').toBe(200);
        await button(page, STRAIGHTEN).click();
        const answered = page.waitForResponse((r) => r.request().method() === 'POST' && r.url().endsWith('/quality/straighten') && r.status() !== 401, { timeout: 60_000 });
        await button(dialog(page, /^Nắn thẳng bản vẽ tầng /u), CONFIRM_STRAIGHTEN).click();
        expect((await answered).status(), 'straighten after the role drop').toBe(403);
        await expect(writeBand(page)).toBeVisible();
        await expect.soft(writeBand(page)).toContainText(SENTENCE.forbidden);
        await captureEvidence(page, 'E03_11-D-008_role_mismatch_403.png', { caption: s.log.filter((e) => e.method === 'POST').map((e) => `${e.method} ${e.path} ${String(e.status)}`) });
      });

      await test.step('[11-D-009] owner removes the member, reload → not found', async () => {
        expect(await removeProjectMember(f.ownerApi, project.projectId, engineer.id)).toBeNull();
        await page.reload();
        const alert = alertWith(page, NOT_FOUND_TITLE);
        await expect(alert).toBeVisible({ timeout: 45_000 });
        await expect(button(alert, BACK_TO_PROJECTS)).toBeVisible();
        await captureEvidence(page, 'E03_11-D-009_removed_member.png');
      });
    });
  });

  test('SCR-11 · FL-11-07 · reviewed floor cannot be straightened again', async ({ browser }) => {
    test.setTimeout(SETUP_TIMEOUT_MS + 120_000);
    await flow(async (f) => {
      const seeded = await createPipelineDrawingProject(f.ownerApi, '11-fl07', await skewedEnvPng(browser, SKEW));
      f.projects.push(seeded.projectId);
      // One human-marked wall (BE spatial_read/documents.py `_HUMAN_GEOMETRY_PATH`) → QUALITY_LAYER_REVIEWED (quality/service.py:114-120).
      await writeLayer({ request: f.ownerApi, headers: {} }, seeded.projectId, seeded.floorId, (levelId) => {
        const layer = qcLayer(levelId) as { walls: Record<string, unknown>[] };
        layer.walls[0] = { ...layer.walls[0], source: 'human', reviewed: true };
        return layer;
      });
      const s = await session(f, browser);
      const { page } = s;

      await test.step('[11-B-021] "Nắn thẳng" → 422 QUALITY_LAYER_REVIEWED sentence; no reread GET', async () => {
        await openQuality(page, seeded.projectId);
        await button(page, STRAIGHTEN).click();
        const answered = page.waitForResponse((r) => r.request().method() === 'POST' && r.url().endsWith('/quality/straighten'), { timeout: 60_000 });
        await button(dialog(page, /^Nắn thẳng bản vẽ tầng /u), CONFIRM_STRAIGHTEN).click();
        const response = await answered;
        expect(response.status()).toBe(422);
        expect(((await response.json()) as { code?: string }).code).toBe('QUALITY_LAYER_REVIEWED');
        const gets = qualityGets(s);
        await expect(writeBand(page)).toContainText(SENTENCE.layerReviewed);
        await quiet(page);
        expect(qualityGets(s), 'no reread after QUALITY_LAYER_REVIEWED').toBe(gets);
        await captureEvidence(page, 'E03_11-B-021_layer_reviewed.png');
      });
    });
  });

  test('SCR-11 · FL-11-08 · [mocked response] read failures, odd report bodies and boundaries', async ({ browser }) => {
    test.setTimeout(SETUP_TIMEOUT_MS + 180_000);
    await flow(async (f) => {
      const project = await seed(f, '11-fl08', [{ name: 'Tầng 1', png: envPng() }]);
      const fid = project.floors[0]!.id;
      const real = await readQuality(f.ownerApi, project.projectId, fid);
      const realFloor = floorOf(real, fid);
      const s = await session(f, browser);
      const { page } = s;
      const isQuality = (url: URL): boolean => url.pathname.startsWith(`/api/projects/${project.projectId}/floors/`) && url.pathname.endsWith('/quality');
      const isProject = (url: URL): boolean => url.pathname === `/api/projects/${project.projectId}`;
      /** Serves `build(requested floor id)` as the #30 body for every GET of this project's quality. */
      const serveBody = async (build: (requested: string) => Record<string, unknown>): Promise<void> => {
        await page.unrouteAll({ behavior: 'ignoreErrors' });
        await page.route(isQuality, async (route) => {
          if (route.request().method() !== 'GET') return route.fallback();
          const requested = new URL(route.request().url()).pathname.split('/').at(-2) ?? fid;
          await route.fulfill({ json: build(requested) });
        });
      };
      const synthetic = (id: string, name: string, measurement: Record<string, number>, extra: Record<string, unknown> = {}): Record<string, unknown> => ({
        floorId: id,
        floorName: name,
        sourceUrl: realFloor.sourceUrl,
        isMeasured: true,
        findings: [],
        measurement: { widthPx: 2000, heightPx: 2000, skewDeg: 0, contrastScore: 1, noiseScore: 0, ...measurement },
        frame: { isFound: true },
        ...extra,
      });

      await test.step('[11-B-001] delayed #30: skeleton; "Tiếp tục xử lý" aria-disabled with the reading reason', async () => {
        await page.route(isQuality, async (route) => {
          await new Promise((resolve) => setTimeout(resolve, 3_000));
          await route.fallback();
        });
        await page.goto(ROUTES.project.quality(project.projectId));
        await expect(page.locator('[role="presentation"] .animate-pulse')).toBeVisible();
        expect.soft(await page.locator('.animate-pulse').count(), 'sweep + 4 skeleton rows').toBeGreaterThanOrEqual(5);
        await expect.soft(continueBtn(page)).toHaveAttribute('aria-disabled', 'true');
        await expect.soft(continueBtn(page)).toHaveAccessibleDescription(READING_REASON);
        await captureEvidence(page, 'E03_11-B-001_loading.png');
        await expect(report(page)).toBeVisible({ timeout: 30_000 });
        await page.unrouteAll({ behavior: 'ignoreErrors' });
      });

      await test.step('[11-B-002] #24 500 → load error + sentence (+ "Thử lại"?); no footer buttons', async () => {
        await page.route(isProject, (route) => route.fulfill(errorBody(500, 'INTERNAL')));
        await page.goto(ROUTES.project.quality(project.projectId));
        const alert = alertWith(page, LOAD_ERROR);
        await expect(alert).toBeVisible({ timeout: 45_000 });
        await expect.soft(alert).toContainText(SENTENCE.unknown);
        await expect(continueBtn(page)).toHaveCount(0);
        await expect(page.locator(`footer[aria-label="${FOOTER}"]`).getByRole('button')).toHaveCount(0); // the alert carries its own way out
        await captureEvidence(page, 'E03_11-B-002_project_read_500.png');
        // run-33 had only "Tải bản vẽ khác" here; QA-03e BUG-509 makes a GET 5xx retryable (src/lib/http/client.ts:490-491,
        // toAppError recovery "thử lại"), so useInputQualityGate canRetryLoad offers "Thử lại".
        await expect.soft(button(alert, RETRY), '#24 500: the alert offers "Thử lại"').toBeVisible();
        await page.unrouteAll({ behavior: 'ignoreErrors' });
      });

      await test.step('[11-B-003] "Thử lại" (offered for a lost #24) → a second GET /projects/:id, report renders', async () => {
        await page.route(isProject, (route) => route.abort());
        await page.goto(ROUTES.project.quality(project.projectId));
        const alert = alertWith(page, LOAD_ERROR);
        await expect(button(alert, RETRY)).toBeVisible({ timeout: 45_000 });
        await page.unrouteAll({ behavior: 'ignoreErrors' });
        const before = projectGets(s, project.projectId);
        await button(alert, RETRY).click();
        await expect(report(page)).toBeVisible({ timeout: 30_000 });
        expect(projectGets(s, project.projectId)).toBeGreaterThan(before);
        await captureEvidence(page, 'E03_11-B-003_project_retry.png');
      });

      await test.step('[11-B-004] #30 5xx → same title, no footer; "Thử lại" → one new #30, no new #24 (fold Q14)', async () => {
        await page.route(isQuality, (route) => (route.request().method() === 'GET' ? route.fulfill(errorBody(500, 'INTERNAL')) : route.fallback()));
        await page.goto(ROUTES.project.quality(project.projectId));
        const alert = alertWith(page, LOAD_ERROR);
        await expect(alert).toBeVisible({ timeout: 45_000 });
        await expect(continueBtn(page)).toHaveCount(0);
        await captureEvidence(page, 'E03_11-B-004_quality_read_500.png');
        await expect.soft(button(alert, RETRY), '#30 500: the alert offers "Thử lại"').toBeVisible();
        await page.unrouteAll({ behavior: 'ignoreErrors' });
        // The retry path, through the read error that does offer "Thử lại" (network).
        await page.route(isQuality, (route) => route.abort());
        await page.goto(ROUTES.project.quality(project.projectId));
        await expect(button(alert, RETRY)).toBeVisible({ timeout: 45_000 });
        await page.unrouteAll({ behavior: 'ignoreErrors' });
        const gets = qualityGets(s);
        const projects = projectGets(s, project.projectId);
        await button(alert, RETRY).click();
        await expect(report(page)).toBeVisible({ timeout: 30_000 });
        expect(qualityGets(s)).toBe(gets + 1);
        expect(projectGets(s, project.projectId)).toBe(projects);
      });

      await test.step('[11-B-005] #30 aborted → network sentence + "Thử lại"', async () => {
        await page.route(isQuality, (route) => route.abort());
        await page.goto(ROUTES.project.quality(project.projectId));
        const alert = alertWith(page, LOAD_ERROR);
        await expect.soft(alert).toContainText(SENTENCE.network, { timeout: 45_000 });
        await expect.soft(button(alert, RETRY)).toBeVisible();
        await captureEvidence(page, 'E03_11-B-005_quality_offline.png');
        await page.unrouteAll({ behavior: 'ignoreErrors' });
      });

      await test.step('[11-B-018] drawing file aborted → broken img with its alt, no error notice', async () => {
        await page.route((url) => url.pathname.includes('/uploads/') && url.pathname.endsWith('.png') && !url.pathname.startsWith('/api/'), (route) => route.abort());
        await page.goto(ROUTES.project.quality(project.projectId));
        await expect(report(page)).toBeVisible({ timeout: 45_000 });
        const img = page.getByRole('img', { name: altOf('Tầng 1') });
        await expect.soft(img).toBeAttached();
        await expect.poll(() => img.evaluate((el) => (el as HTMLImageElement).complete && (el as HTMLImageElement).naturalWidth === 0)).toBe(true);
        await expect.soft(page.getByRole('alert')).toHaveCount(0);
        await captureEvidence(page, 'E03_11-B-018_image_load_failure.png');
        await page.unrouteAll({ behavior: 'ignoreErrors' });
      });

      const walk = async (stepLabel: string, label: string, cases: readonly (readonly [string, number, string])[], key: string, shot: string): Promise<void> => {
        await serveBody((requested) => ({
          projectId: project.projectId,
          floorId: requested,
          floors: cases.map(([id, value], i) => synthetic(i === 0 ? fid : `L-QAP7${id}`, `Mức ${String(value).replace('.', ',')}`, { [key]: value })),
        }));
        await page.goto(ROUTES.project.quality(project.projectId));
        await expect(report(page)).toBeVisible({ timeout: 45_000 });
        await report(page).getByText('Các tầng đã đo', { exact: true }).click();
        const seen: string[] = [];
        for (const [i, [, value, want]] of cases.entries()) {
          if (i > 0) await page.keyboard.press('ArrowRight');
          await expect(row(page, `Mức ${String(value).replace('.', ',')}`)).toHaveAttribute('aria-current', 'true');
          await expect.soft(metric(page, label), `${stepLabel} ${String(value)}`).toContainText(want);
          seen.push(`${String(value)} → ${(await metric(page, label).innerText()).replace(/\s+/gu, ' ')}`);
        }
        await captureEvidence(page, shot, { caption: seen });
      };

      await test.step('[11-C-009] skew 0.5 "Tốt", 0.51 / 4.99 "Cần chú ý", 5 "Kém"', async () => {
        await walk('skew', 'Độ nghiêng', [['S1', 0.5, 'Tốt'], ['S2', 0.51, 'Cần chú ý'], ['S3', 4.99, 'Cần chú ý'], ['S4', 5, 'Kém']], 'skewDeg', 'E03_11-C-009_skew_boundaries.png');
      });

      await test.step('[11-C-012] contrast 0.75 "Tốt", 0.749 / 0.45 "Cần chú ý", 0.449 "Kém"', async () => {
        await walk('contrast', 'Độ tương phản', [['C1', 0.75, 'Tốt'], ['C2', 0.749, 'Cần chú ý'], ['C3', 0.45, 'Cần chú ý'], ['C4', 0.449, 'Kém']], 'contrastScore', 'E03_11-C-012_contrast_boundaries.png');
      });

      await test.step('[11-C-015] noise 0.2 "Tốt", 0.201 / 0.4 "Cần chú ý", 0.401 "Kém"', async () => {
        await walk('noise', 'Nhiễu', [['N1', 0.2, 'Tốt'], ['N2', 0.201, 'Cần chú ý'], ['N3', 0.4, 'Cần chú ý'], ['N4', 0.401, 'Kém']], 'noiseScore', 'E03_11-C-015_noise_boundaries.png');
      });

      await test.step('[11-B-012] second floor unmeasured → partial notice; row "Chưa đo" + "chưa đo"', async () => {
        await serveBody((requested) => ({
          projectId: project.projectId,
          floorId: requested,
          floors: [real.floors[0], { floorId: 'L-QAP7PENDING', floorName: 'Tầng 2', sourceUrl: realFloor.sourceUrl, isMeasured: false, findings: [] }],
        }));
        await openQuality(page, project.projectId);
        await expect.soft(report(page)).toContainText('Mới có 1/2 tầng đo xong. Còn chờ: Tầng 2.');
        await expect.soft(row(page, 'Tầng 2')).toContainText('Chưa đo');
        await expect.soft(row(page, 'Tầng 2')).toContainText('chưa đo');
        await captureEvidence(page, 'E03_11-B-012_partial_other_floor.png');
      });

      await test.step('[11-B-013] active floor unmeasured → partial lines + "Chưa dự kiến…", no metrics (fold Q18)', async () => {
        const { measurement: _m, ...rest } = realFloor;
        await serveBody(() => ({ ...real, floors: [{ ...rest, isMeasured: false, findings: [] }] }));
        await openQuality(page, project.projectId);
        await expect.soft(report(page)).toContainText('Mới có 0/1 tầng đo xong. Bản vẽ tầng Tầng 1 chưa chạy đủ bốn phép kiểm nên chưa có mức để nói. Còn chờ: Tầng 1.');
        await expect.soft(report(page)).toContainText('Chưa dự kiến được độ tin cậy vì bản vẽ chưa đo xong.');
        await expect.soft(metric(page, 'Độ phân giải')).toHaveCount(0);
        await captureEvidence(page, 'E03_11-B-013_partial_active_floor.png');
      });

      await test.step('[11-B-014] expectedConfidence 0,82 → forecast line', async () => {
        await serveBody(() => ({ ...real, floors: [{ ...realFloor, expectedConfidence: 0.82 }] }));
        await openQuality(page, project.projectId);
        await expect.soft(report(page)).toContainText('Dự kiến độ tin cậy trung bình 0,82 — AI đề xuất'); // semantic.ts 0.7 ≤ 0.82 < 0.9
        await captureEvidence(page, 'E03_11-B-014_forecast.png');
      });

      await test.step('[11-C-022] measured floor without measurement → copy without numbers', async () => {
        const { measurement: _m, ...rest } = realFloor;
        const add = (code: string, n: number): Record<string, unknown> => ({ id: `qa-p7-${code}`, code, severity: 'attention', region: { xRatio: 0.1 * n, yRatio: 0.1, widthRatio: 0.1, heightRatio: 0.1 } });
        await serveBody(() => ({ ...real, floors: [{ ...rest, findings: [...realFloor.findings, add('SKEW_DETECTED', 1), add('LOW_CONTRAST', 2), add('HIGH_NOISE', 3)] }] }));
        await openQuality(page, project.projectId);
        await expect.soft(finding(page, 'Độ phân giải thấp')).toContainText('Độ phân giải thấp. Ở mức này, tường ngăn mỏng nhất');
        await expect.soft(finding(page, 'Ảnh bị nghiêng')).toContainText('Ảnh bị nghiêng. Ở góc này');
        await expect.soft(finding(page, 'Độ tương phản thấp')).toContainText('Độ tương phản thấp. Ở mức này');
        await expect.soft(finding(page, 'Nhiễu cao')).toContainText('Nhiễu cao. Ở mức này');
        await captureEvidence(page, 'E03_11-C-022_copy_without_measurement.png', { fullPage: true });
      });

      await test.step('[11-B-030] finding code "FOO" → fallback copy', async () => {
        const foo = { id: 'qa-p7-foo', code: 'FOO', severity: 'attention', region: { xRatio: 0.2, yRatio: 0.2, widthRatio: 0.2, heightRatio: 0.2 } };
        await serveBody(() => ({ ...real, floors: [{ ...realFloor, findings: [...realFloor.findings, foo] }] }));
        await openQuality(page, project.projectId);
        const card = finding(page, 'Phát hiện chưa có mô tả');
        await expect.soft(card).toContainText('Hệ thống báo mã FOO nhưng chưa có câu giải thích cho mã này.');
        await captureEvidence(page, 'E03_11-B-030_unknown_code.png');
      });

      await test.step('[11-B-006] #30 404 floor → not-found sentence with "Tải bản vẽ khác" (no "Thử lại") → /upload', async () => {
        await page.unrouteAll({ behavior: 'ignoreErrors' });
        await page.route(isQuality, (route) => route.fulfill(errorBody(404, 'NOT_FOUND', { resource: 'floor' })));
        await page.goto(ROUTES.project.quality(project.projectId));
        const alert = alertWith(page, LOAD_ERROR);
        await expect(alert).toContainText(SENTENCE.notFound, { timeout: 45_000 });
        await expect(button(alert, RETRY)).toHaveCount(0);
        await captureEvidence(page, 'E03_11-B-006_quality_404_floor.png');
        await button(alert, SECONDARY).click();
        await expect.poll(() => pathOf(page)).toBe(ROUTES.project.upload(project.projectId));
        await page.unrouteAll({ behavior: 'ignoreErrors' });
      });
    });
  });

  test('SCR-11 · FL-11-09 · [mocked response] write in flight and every write error', async ({ browser }) => {
    test.setTimeout(SETUP_TIMEOUT_MS + 240_000);
    await flow(async (f) => {
      const project = await seed(f, '11-fl09', [
        { name: 'Tầng 1', png: await skewedEnvPng(browser, SKEW) },
        { name: 'Tầng 2', png: envPng() },
      ]);
      const t1 = floorOf(await readQuality(f.ownerApi, project.projectId, floorId(project, 'Tầng 1')), floorId(project, 'Tầng 1'));
      const s = await session(f, browser);
      const { page } = s;
      await page.emulateMedia({ reducedMotion: 'reduce' });
      const keys: { what: string; key: string }[] = [];
      let answer: (route: Route) => Promise<void> = (route) => route.fallback();
      let label = '';
      await page.route(
        (url) => url.pathname.endsWith('/quality/straighten') || url.pathname.endsWith('/quality/corners'),
        async (route) => {
          keys.push({ what: `${new URL(route.request().url()).pathname.split('/').at(-1) ?? ''} ${label}`, key: route.request().headers()['idempotency-key'] ?? '' });
          await answer(route);
        },
      );
      const strDialog = dialog(page, 'Nắn thẳng bản vẽ tầng Tầng 1?');
      const straightenWith = async (what: string, reply: (route: Route) => Promise<void>): Promise<void> => {
        label = what;
        answer = reply;
        await button(page, STRAIGHTEN).click();
        await button(strDialog, CONFIRM_STRAIGHTEN).click();
      };
      const fulfil = (status: number, code: string) => (route: Route): Promise<void> => route.fulfill(errorBody(status, code));

      let release: () => void = () => undefined;
      let rotation = '';
      let duration = '';
      await test.step('[11-B-019] held write: buttons disabled, Esc/"Huỷ" ignored, "— đã xử lý" line, count −1, rotation −skew', async () => {
        await openQuality(page, project.projectId);
        const n = t1.findings.length;
        await expect(remaining(page)).toHaveText(`${String(n)} phát hiện còn lại`);
        const gate = new Promise<void>((resolve) => (release = resolve));
        await straightenWith('held→409', async (route) => {
          await gate;
          await route.fulfill(errorBody(409, 'QUALITY_DRAWING_CHANGED'));
        });
        await expect(button(strDialog, CONFIRM_STRAIGHTEN)).toBeDisabled();
        await expect(button(strDialog, CANCEL)).toBeDisabled();
        await page.keyboard.press('Escape');
        await expect(strDialog).toBeVisible();
        await expect(report(page).getByText('Ảnh bị nghiêng — đã xử lý', { exact: true })).toBeVisible();
        await expect(remaining(page)).toHaveText(`${String(n - 1)} phát hiện còn lại`);
        const wrap = content(page).locator('div.origin-center').first();
        rotation = await wrap.evaluate((el) => (el as HTMLElement).style.transform);
        duration = await wrap.evaluate((el) => (el as HTMLElement).style.transitionDuration);
        expect(rotation).toBe(`rotate(${String(-t1.measurement.skewDeg)}deg)`);
        await captureEvidence(page, 'E03_11-B-019_write_in_flight.png', { caption: `transform ${rotation}, transition ${duration}` });
      });

      await test.step('[11-C-033] during that write "Không tìm thấy khung bản vẽ" stays a full card with its button', async () => {
        await expect.soft(button(finding(page, 'Không tìm thấy khung bản vẽ'), PICK)).toBeAttached();
        await captureEvidence(page, 'E03_11-C-033_other_finding_full.png');
      });

      await test.step('[11-A-011] ArrowRight and a row click do nothing while the POST is held', async () => {
        await page.keyboard.press('ArrowRight');
        await row(page, 'Tầng 2').dispatchEvent('click');
        await quiet(page);
        await expect.soft(row(page, 'Tầng 1')).toHaveAttribute('aria-current', 'true');
      });

      await test.step('[11-B-020] released with 409 QUALITY_DRAWING_CHANGED → band + a new GET …/quality', async () => {
        const gets = qualityGets(s);
        release();
        await expect(writeBand(page)).toContainText(SENTENCE.drawingChanged);
        await expect.poll(() => qualityGets(s)).toBeGreaterThan(gets);
        await captureEvidence(page, 'E03_11-B-020_drawing_changed.png');
      });

      await test.step('[11-E-018] reduced motion: rotation without transition; static skeleton', async () => {
        expect.soft(['0ms', '0s'], `straighten transition under reduced motion: ${duration}`).toContain(duration);
        await page.route((url) => url.pathname.endsWith('/quality'), async (route) => {
          await new Promise((resolve) => setTimeout(resolve, 2_000));
          await route.fallback();
        }, { times: 1 });
        await page.reload();
        const pulse = page.locator('[role="presentation"] .animate-pulse');
        await expect(pulse).toBeVisible();
        expect.soft(await pulse.evaluate((el) => getComputedStyle(el).animationName)).toBe('none');
        await captureEvidence(page, 'E03_11-E-018_reduced_motion_skeleton.png');
        await expect(report(page)).toBeVisible({ timeout: 30_000 });
      });

      await test.step('[11-B-023] 422 IMAGE_TOO_LARGE sentence', async () => {
        await straightenWith('422 IMAGE_TOO_LARGE', fulfil(422, 'IMAGE_TOO_LARGE'));
        await expect.soft(writeBand(page)).toContainText(SENTENCE.imageTooLarge);
        await captureEvidence(page, 'E03_11-B-023_image_too_large.png');
      });

      await test.step('[11-B-029] the "— đã xử lý" line is back to the full card with "Tự động nắn"', async () => {
        await expect.soft(report(page).getByText('Ảnh bị nghiêng — đã xử lý', { exact: true })).toHaveCount(0);
        await expect.soft(button(finding(page, 'Ảnh bị nghiêng'), STRAIGHTEN)).toBeVisible();
        await captureEvidence(page, 'E03_11-B-029_rollback.png');
      });

      await test.step('[11-E-011] focus back on the failed quick fix; not stolen once the user moved (fold Q15)', async () => {
        await expect.soft(page.locator('[data-quality-action="straighten"]')).toBeFocused();
        await captureEvidence(page, 'E03_11-E-011_focus_back.png');
      });

      await test.step('[11-B-025] 422 FILE_CORRUPT sentence', async () => {
        await straightenWith('422 FILE_CORRUPT', fulfil(422, 'FILE_CORRUPT'));
        await expect.soft(writeBand(page)).toContainText(SENTENCE.fileCorrupt);
        await captureEvidence(page, 'E03_11-B-025_file_corrupt.png');
      });

      await test.step('[11-B-026] 503 DEPENDENCY_UNAVAILABLE (every retry) sentence', async () => {
        await straightenWith('503', fulfil(503, 'DEPENDENCY_UNAVAILABLE'));
        await expect.soft(writeBand(page)).toContainText(SENTENCE.queueFull, { timeout: 30_000 });
        await captureEvidence(page, 'E03_11-B-026_queue_full.png');
      });

      await test.step('[11-B-028] 500 → errors.unknown sentence', async () => {
        await straightenWith('500', fulfil(500, 'INTERNAL'));
        await expect.soft(writeBand(page)).toContainText(SENTENCE.unknown);
        await captureEvidence(page, 'E03_11-B-028_unknown_error.png');
      });

      await test.step('[11-B-027] abort → "uncertain" + reread; quick fix hidden until the reread ends; focus not stolen', async () => {
        let releaseRead: () => void = () => undefined;
        const readGate = new Promise<void>((resolve) => (releaseRead = resolve));
        await page.route((url) => url.pathname.endsWith('/quality'), async (route) => {
          await readGate;
          await route.fallback();
        }, { times: 1 });
        await straightenWith('abort', (route) => route.abort());
        await expect.soft(writeBand(page)).toContainText(SENTENCE.uncertain, { timeout: 30_000 });
        await expect.soft(button(page, STRAIGHTEN)).toHaveCount(0);
        await captureEvidence(page, 'E03_11-B-027_uncertain_reread.png');
        // The user acts while the reread runs: the focus must stay where they put it (IQ:80-110).
        await report(page).getByText('Các tầng đã đo', { exact: true }).click();
        releaseRead();
        await expect.soft(button(page, STRAIGHTEN)).toBeVisible({ timeout: 30_000 });
        await quiet(page);
        await expect.soft(page.locator('[data-quality-action="straighten"]'), 'focus not stolen after the user acted').not.toBeFocused();
      });

      await test.step('[11-B-024] real straighten 200; corners → 422 PDF_UNREADABLE sentence', async () => {
        label = 'real';
        answer = (route) => route.fallback();
        const done = page.waitForResponse((r) => r.request().method() === 'POST' && r.url().endsWith('/quality/straighten'), { timeout: 120_000 });
        await button(page, STRAIGHTEN).click();
        await button(strDialog, CONFIRM_STRAIGHTEN).click();
        expect((await done).status()).toBe(200);
        await expect(page.getByRole('textbox', { name: COMPARISON })).toBeVisible();
        label = 'corners 422';
        answer = (route) => route.fulfill(errorBody(422, 'PDF_UNREADABLE'));
        await button(page, PICK).click();
        await button(page, SEND).click();
        await button(dialog(page, 'Cắt và nắn bản vẽ tầng Tầng 1 theo bốn góc?'), CONFIRM_CORNERS).click();
        await expect(writeBand(page)).toContainText(SENTENCE.pdfUnreadable);
        await captureEvidence(page, 'E03_11-B-024_pdf_unreadable.png');
      });

      await test.step('[11-A-029] Idempotency-Keys: same key across 503/500/abort retries; new after a 4xx; corners own key', async () => {
        await attachJson('E03_11-A-029_idempotency_keys.json', { keys });
        const of = (prefix: string): string[] => keys.filter((k) => k.what === prefix).map((k) => k.key);
        const [k409] = of('straighten held→409');
        const [k413] = of('straighten 422 IMAGE_TOO_LARGE');
        const [kCorrupt] = of('straighten 422 FILE_CORRUPT');
        const transient = [...of('straighten 503'), ...of('straighten 500'), ...of('straighten abort'), ...of('straighten real')];
        expect.soft(new Set([k409, k413, kCorrupt]).size, 'a new key after each 4xx').toBe(3);
        expect.soft(transient.length, '503 / abort retried by the http layer (RTY)').toBeGreaterThan(4);
        expect.soft(new Set(transient).size, `one key across 5xx / network retries: ${JSON.stringify(transient)}`).toBe(1);
        expect.soft(transient[0], 'not a key spent on a 4xx').not.toBe(kCorrupt);
        const [kCorners] = of('corners corners 422');
        expect.soft([k409, k413, kCorrupt, ...transient], 'corners key is its own').not.toContain(kCorners);
      });
    });
  });
});
