/**
 * Phase 6 — EDGE CASES, Track A (admin): SCR-28 Rule Report, SCR-29 Rule Settings, SCR-30 Export Panel,
 * SCR-31 Spatial JSON Viewer, SCR-32 Version History. Gaps left by `phase06_rules_export_versions.spec.ts` (serial, own
 * pipeline project since QA-06); inventory in `qa/coverage/phase06.md` (FE stamp 9d4d2792).
 * The two `diff tabs` tests (SCR-32) cover `src/components/ui/Tabs.tsx` @ 9d4d2792 (`h-11 sm:h-9`, keyboard handler);
 * the 508f6e65..9d4d2792 `src/i18n/vi.json` change touches no block these five screens render (project.settings,
 * scaleCalibration, explodedView), so it adds no test.
 *
 * Every expected result cites the FE source of `F:/App/AppFront` @ 508f6e65 (line numbers of the five screens and PSG
 * re-mapped to the QA-06 integration 5e2d939b) or, written `BE:`, AppBack. Short names:
 *   RR   src/screens/rules/RuleReport/      (RRV RuleReport.tsx, RRC RuleReport.container.tsx, RRS RuleReportSummary.tsx,
 *        RRG RuleReportGroups.tsx, RRL RuleReportLabels.tsx, URR useRuleReport.ts)
 *   RS   src/screens/rules/RuleSettings/    (RSV RuleSettings.tsx, RSC RuleSettings.container.tsx, RSG RuleSettingsGroups.tsx,
 *        RSR RuleSettingsRow.tsx, RSD RuleSettingsReloadDialog.tsx, URS useRuleSettings.ts, RSW ruleSettingsGateway.ts)
 *   EP   src/screens/export/ExportPanel/    (EPV ExportPanel.tsx, EPF ExportPanelFormats.tsx, EPO ExportPanelOptions.tsx,
 *        EPP ExportPanelPreflight.tsx, EPT ExportPanelFooter.tsx, UEP useExportPanel.ts, EPG exportPanelGateway.ts)
 *   SJ   src/screens/export/SpatialJsonViewer/ (SJV SpatialJsonViewer.tsx, SJT SpatialJsonTree.tsx, SJD SpatialJsonDetail.tsx,
 *        SJC SpatialJsonViewer.container.tsx, USJ useSpatialJsonViewer.ts, SJM spatialJsonModel.ts)
 *   VH   src/screens/export/VersionHistory/ (VHV VersionHistory.tsx, VHC VersionHistory.container.tsx, VHL VersionList.tsx,
 *        VHD VersionLabelDialog.tsx, VHX VersionCompare.tsx, UVH useVersionHistory.ts, VHG versionHistoryGateway.ts,
 *        VHM versionHistoryModel.ts, VHP versionHistoryCompare.ts)
 *   PSG  src/components/feedback/ProjectSpatialGate.tsx   NF src/hooks/useNumericField.ts   GLB src/lib/export/exportGlb.ts
 *   TABS src/components/ui/Tabs.tsx (@ 9d4d2792)
 *   I18N src/i18n/vi.json (`errors.*`)
 *
 * ## Non-serial
 * Every test opens its OWN browser context from the stored admin session (`ADMIN_STORAGE_STATE_FILE`, checked by
 * `ensureAdminSession`; a dead session costs one UI sign-in), takes a fixture token with `layerApiOf` and creates its OWN
 * project through the real API (`POST /api/projects`, name `qa-<runId>-e06-…`) that it deletes in `finally`:
 * - bare: one or two empty floors (no layer);
 * - qc: `createQcProject` (support/layerSeed.ts) — walls, a door, a window, rooms "Bếp" / "PHONG NGU 2", one table;
 * - pipeline: one floor + the env drawing (`E2E_DRAWING_PNG`) uploaded through #5/#6/#7, so the real fake-ML pipeline
 *   writes the "before" and "after" versions (BE:apps/worker/pipeline_persist/service.py:181-201). Autosave never makes a
 *   version; only the pipeline and a restore do (BE:apps/api/versions/router.py:62-82).
 * Nothing reads the Phase 2/3/4 checkpoints: the shared CP-5/CP-6 work floor is never touched.
 *
 * ## Mocks — "[mocked response]" in the title (3 of 36)
 * - `GET /api/projects/:p/rule-config` 500 on SCR-28 — unpairable: 5xx is not producible on the shared stack.
 * - `GET /api/projects/:p/rule-config` 500 on SCR-29 — unpairable: same.
 * - `GET /api/projects/:p/versions?floorId=` 500 on SCR-32 — unpairable: same.
 * Each needs its "unpairable" row in `coverage/phase06-be.md` (BE agent).
 *
 * ## Writes on the real stack (own `qa-<runId>-e06-…` projects only)
 * Projects created/deleted; layers written by API (#35); rule-config written by the screen and by API (N22); versions
 * labelled / restored on own pipeline floors (N19/N20); six pipeline runs of the fake ML. Exports are browser
 * downloads saved under the test output dir. No mail, no account, registry or feature-flag change.
 *
 * ## Real-backend budget per run (BE defaults; QA stack override `qa-limits.override.yml`)
 * - `POST /api/auth/login` (120 / 60 s per IP on the QA stack): 0 when the stored session is alive; 1 UI sign-in when
 *   it is dead. No failed login.
 * - `POST /api/auth/refresh` (300 / 60 s): 2 per test (session check + fixture token) + 1 per page load ≈ 4–7 per test,
 *   ≈ 200 for the 36 tests spread over several minutes.
 * - `POST /api/projects`: 35 (all but the unknown-project test), each deleted in `finally`; no rate limit
 *   (BE:apps/api/projects/router.py:54).
 * - `POST …/drawings/uploads` init (#5, `drawings_init` 60 / 600 s per user, BE:apps/api/drawings/router.py:39-46):
 *   6 (one per pipeline test) — with phase 3 spending ≤ 34 in the same window this stays under 60.
 * - `PUT …/spatial/layer`, `PUT …/rule-config`, `POST …/versions/:v/restore`, `PATCH …/label`: a handful per test, no
 *   rate limit (no `rate_limit(` in BE spatial_write/, rules/, versions/ routers).
 */
import { existsSync, readFileSync } from 'node:fs';

import { expect, test } from '@playwright/test';
import type { Browser, BrowserContext, Download, Locator, Page, Route } from '@playwright/test';

import { ROUTES } from '../../e2e/fixtures/routes';
import { TOUR_APPEAR_TIMEOUT_MS, dismissTour } from '../../e2e/fixtures/tour';
import { navigateThenWaitForApi, waitForApi, watchApi } from '../../e2e/fullstack/apiWatch';
import type { ApiEntry } from '../../e2e/fullstack/apiWatch';
import { AUTOSAVE_TIMEOUT_MS, PIPELINE_TIMEOUT_MS, readBaseUrl } from '../../e2e/fullstack/env';
import { ensureAdminSession } from './support/auth';
import { TEST_DATA_PREFIX, attachJson, captureEvidence } from './support/evidence';
import { createQcProject, deleteProject, layerApiOf, qcLayer, writeLayer } from './support/layerSeed';
import type { LayerApi } from './support/layerSeed';
import { typeHeight } from './support/numeric-field';
import { ADMIN_STORAGE_STATE_FILE } from './support/state';

/* ---------------------------------------------------------------- constants (each cites its source) */

const DESKTOP = { width: 1440, height: 900 } as const;
/** SJC:62 and VHC:67 `NARROW_QUERY = '(width < 1024px)'`. */
const NARROW = { width: 768, height: 1024 } as const;
const PHONE = { width: 375, height: 812 } as const;
type Viewport = { readonly width: number; readonly height: number };

/** A "nothing was sent" claim waits past autosave (800 ms, A7 / URS:493) plus a round trip. */
const QUIET_MS = 2_500;
/** react-query retries a failed read once (src/lib/query/cachePolicy.ts:79-82) before the error state paints. */
const ERROR_PAINT_TIMEOUT_MS = 30_000;
const PIPELINE_TEST_TIMEOUT_MS = PIPELINE_TIMEOUT_MS + 120_000;
const REFRESH_API = '/api/auth/refresh';
const PROJECTS_API = '/api/projects';
const FLOOR_HEIGHT_MM = 3_000;
/** BE:apps/api/drawings/settings.py:131 UPLOAD_CHUNK_BYTES (support/drawingSeed.ts CHUNK_BYTES): one chunk. */
const CHUNK_BYTES = 5 * 1024 * 1024;

/* Shared gate (PSG). */
const GATE = {
  notFoundTitle: 'Không tìm thấy dự án này', // PSG:37
  notFoundDescription: 'Dự án có thể đã bị xoá, đường dẫn chưa đúng, hoặc bạn chưa được thêm vào dự án.', // PSG:38-39
  backToProjects: 'Về danh sách dự án', // PSG:40,57
} as const;
const GENERIC_UNKNOWN = 'Hệ thống đã ghi nhận và sẽ kiểm tra. Hãy thử lại sau ít phút.'; // I18N errors.unknown.description
const DASHBOARD_TITLE = 'Dự án của tôi'; // support/auth.ts DASHBOARD_TITLE (ProjectDashboard.tsx h1)
const TOAST_UNDO = 'Hoàn tác'; // components/feedback/Toast.tsx:149

/* SCR-28 copy. */
const RR = {
  heading: 'Kiểm tra luật không gian', // RRV:287
  rerun: 'Chạy kiểm tra lại', // RRV:305
  settingsLink: 'Cài đặt bộ luật', // RRV:298
  confirm: 'Xác nhận đã xử lý', // RRV:358
  doneText: 'Không phát hiện vi phạm nào.', // RRV:141
  doneCount: /^\d[\d.]* luật đã chạy trên bản vẽ này và không luật nào bắt được lỗi\.$/u, // RRV:143-144
  doneBadge: 'Lượt chạy này không có vi phạm', // RRV:147
  toExport: 'Sang bước xuất bản', // RRV:150
  errorTitle: 'Không chạy được lượt kiểm tra', // RRV:183
  configFailed: 'Không tải được cấu hình bộ luật của dự án.', // URR:137,706
  retry: 'Thử lại', // RRV:188
  noPassed: 'Chưa có luật nào chạy xong mà không ra lỗi.', // RRV:211
  noMatch: 'Không có mục nào khớp bộ lọc đang đặt. Nới bộ lọc để xem thêm.', // RRV:230
  levelFilter: 'Lọc theo mức độ', // RRS:157
  groupSelect: 'Nhóm luật', // RRS:166
  view: 'Xem', // RRG:141
  columns: ['Mức độ', 'Mô tả', 'Tầng', 'Mã đối tượng'], // RRG:244-247
} as const;
/** RRL:74-80 GROUP_LABELS (also the Settings group labels, registry.ts RULE_GROUP_LABELS:84-90). */
const GROUP_LABELS = ['Hình học', 'Lưu thông', 'Diện tích', 'Ghi chú', 'Cao độ tầng'] as const;

/* SCR-29 copy. */
const RS = {
  heading: 'Cài đặt bộ luật không gian', // RSV:267
  enabledCount: /^(\d+)\/(\d+) luật đang bật$/u, // RSV:270
  loadErrorTitle: 'Không tải được cài đặt bộ luật', // RSV:282
  restoreDefaults: 'Khôi phục mặc định', // RSV:328
  nav: 'Mục cài đặt bộ luật', // RSV:136
  generalNav: 'Ngưỡng chung', // RSV:87, RSG:122
  generalHash: '#rule-settings-general-thresholds', // RSV:66 sectionIdOf + RSV:57 GENERAL_SECTION_ID
  generalField: 'Góc lệch tối đa còn coi là hai đường song song', // domain/rules/thresholdSpecs.ts:100
  disableAll:
    'Mọi luật đều đang tắt: lượt kiểm tra sẽ không soi gì nữa và mô hình báo sạch lỗi dù chưa được kiểm lần nào.', // URS:245-246
  conflict:
    'Bộ luật vừa được đổi ở nơi khác nên thay đổi của bạn chưa được lưu. Tải lại để xem bản mới nhất.', // RSW:299-300
  reload: 'Tải lại', // RSV:186
  reloadTitle: 'Tải lại bộ luật?', // RSD:20
  reloadLater: 'Để sau', // RSD:28
  reloadConfirm: 'Bỏ thay đổi và tải lại', // RSD:31
  groupDescriptionOff: /^\d+ luật, 0 đang bật\.$/u, // URS:780
} as const;
/** domain/rules/registry.ts:446-449 (WALL-THICKNESS, severity warning) and :480-481 (WALL-LENGTH). */
const WALL_THICKNESS = { code: 'WALL-THICKNESS', name: 'Bề dày tường nằm trong khoảng dựng được' } as const;
const WALL_LENGTH = { code: 'WALL-LENGTH', name: 'Tường đủ dài để dựng' } as const;
/** domain/rules/thresholdSpecs.ts:130-140 — key, label, 30..200 mm; default 60 (registry.ts:391). */
const MIN_THICKNESS = { key: 'wall.minThicknessMm', label: 'Bề dày tường tối thiểu', valid: '45' } as const;
/** src/lib/format/sentence.ts:6-8 `lowerFirst`, as RSR:146 / RSG:67 build the switch names. */
const lowerFirst = (text: string): string => text.charAt(0).toLocaleLowerCase('vi') + text.slice(1);
const ruleSwitchName = (sentence: string): string => `Bật hoặc tắt luật: ${lowerFirst(sentence)}`; // RSR:146
const groupSwitchName = (label: string): string => `Bật hoặc tắt cả nhóm: ${lowerFirst(label)}`; // RSG:67
const severityName = (sentence: string): string => `Mức độ của luật: ${sentence}`; // RSR:70

/* SCR-30 copy. */
const EP = {
  formats: 'Định dạng xuất', // EPF:144
  options: 'Tuỳ chọn', // EPO:232
  scope: 'Phạm vi', // EPO:69
  preflight: 'Kiểm tra trước khi xuất', // EPP:26
  history: 'Tệp đã xuất', // EPV:123
  historyCaption: 'Chỉ trong phiên làm việc này, sẽ mất khi tải lại trang.', // EPV:129
  redownload: 'Tải lại', // EPV:163
  exportButton: 'Xuất', // EPT:69
  share: 'Chia sẻ', // EPV:251 (only when SHARE_LINKS_SUPPORTED, src/lib/export/shareLink.ts:354 = false)
  confidence: 'Gồm độ tin cậy từng đối tượng', // EPO:190
  noFloor: 'Chưa chọn tầng nào để xuất.', // EPG:312
  unapproved: (name: string): string => `Còn 1 tầng chưa duyệt: ${name}.`, // EPG:315-317 (BUG-443 capitalised)
  unreviewed: /Còn \d[\d.]* đối tượng chưa duyệt\./u, // EPG:337 (the row also holds "Sửa")
  notApprovedBadge: 'Chưa duyệt', // EPO:83
  notApprovedCaption: 'Tầng chưa duyệt vẫn xuất được, nhưng cần chú ý trước khi gửi đi.', // EPO:88
  /** EPP:62 visible "Sửa" + sr-only ": <row label>" (BUG-442): the accessible name is "Sửa: Còn …". */
  fix: /^Sửa/u,
  pdfBlocked: 'Chưa tải về được: dự án chưa có bộ dựng tệp PDF, mới đếm được số trang.', // EPF:34-35
  imageBlocked:
    'Chưa tải về được: ảnh cần một khung nhìn ba chiều đang mở, màn này chưa gắn với khung nhìn nào.', // EPF:38-39
  pdfNotice: 'Hồ sơ PDF mới đếm được số trang: dự án chưa có bộ dựng tệp PDF nên chưa tải về được.', // UEP:175-176
  imageNotice: 'Ảnh cần một khung nhìn 3D đang mở; màn này chưa được gắn với khung nhìn nào nên chưa chụp được.', // UEP:179-180
  pdfOptions: ['Gồm mặt bằng các tầng', 'Gồm bảng danh sách phòng', 'Gồm danh sách vi phạm', 'Gồm ảnh dựng 3D'], // EPO:144-165
  pageCount: /\d[\d.]* trang/u, // UEP:515
  imageView: 'Góc nhìn hiện tại:', // EPO:179
  imageWidth: 'Chiều rộng xuất:', // EPO:182 (BUG-467: own line, capitalised)
  /** GLB:133-138 `YYYY-MM-DD_HH-mm-ss`. */
  stamp: '\\d{4}-\\d{2}-\\d{2}_\\d{2}-\\d{2}-\\d{2}',
} as const;

/* SCR-31 copy. */
const SJ = {
  tree: 'Cấu trúc dữ liệu không gian', // SJT:60
  search: 'Tìm theo khoá hoặc giá trị', // SJV:104
  previous: 'Kết quả trước', // SJV:122
  next: 'Kết quả sau', // SJV:128
  viewMode: 'Cách hiện cấu trúc', // SJV:149
  copy: 'Sao chép nhánh đang chọn', // SJV:157
  download: 'Tải xuống .json', // SJV:241 (only with onDownload, SJV:234; the route passes none, SJC:229)
  tabs: 'Cách xem nội dung', // SJD:136
  emptyTitle: 'Chưa có dữ liệu không gian', // SJV:48
  emptyDescription:
    'Bản vẽ này chưa được xử lý xong, nên chưa có tường, phòng hay đối tượng nào để xem. Xử lý bản vẽ của tầng rồi quay lại đây.', // SJV:49-50 (BUG-454)
  validity: /^(Hợp lệ theo hợp đồng Spatial JSON — 0 lỗi\.|\d[\d.]* lỗi nghiêm trọng · \d[\d.]* cảnh báo\.)$/u, // SJM:268-270
  noSelection: 'Chọn một nút ở cây bên trái để xem chi tiết của nó.', // SJD:80
  entityCode: 'Mã đối tượng', // SJD:110
  entityNote: /^Việc tô sáng đối tượng này trong mô hình ba chiều nằm ở trình xem 3D\./u, // SJD:120
  /** SJM:238-250 for a floor without a layer: one level, nothing else. */
  emptyCounts: '1 tầng · 0 tường · 0 ô mở · 0 phòng · 0 đồ đạc · 0 trục · 0 kích thước',
  room: 'PHONG NGU 2', // support/layerSeed.ts qcLayer room name (doc comment :113)
} as const;

/* SCR-32 copy. */
const VH = {
  list: 'Danh sách phiên bản', // VHL:137
  checkbox: (label: string): string => `Chọn phiên bản ${label} để so sánh`, // VHL:84
  current: 'Hiện tại', // VHL:94
  floorSelect: 'Tầng', // UVH:604
  narrowSelect: 'phiên bản', // VHV:111
  emptyTitle: (floor: string): string => `${floor} chưa có phiên bản nào`, // UVH:606 (capitalizeFirst)
  emptyDescription: 'Phiên bản được lưu khi AI ghi kết quả và khi phục hồi một bản cũ.', // VHV:72
  listErrorTitle: 'Không tải được lịch sử phiên bản', // VHV:93
  listErrorReason: 'Máy chủ chưa trả được lịch sử phiên bản của tầng này', // VHG:57
  restore: 'Phục hồi phiên bản này', // VHV:186
  tag: 'Gắn nhãn phiên bản này', // VHV:173
  restoreCaption:
    'Phục hồi không xoá gì: trạng thái hiện tại được giữ lại thành một phiên bản riêng, và bản phục hồi được thêm lên đầu danh sách', // VHM:473-474
  undoCleared: 'Lịch sử hoàn tác (Ctrl+Z) của mọi tầng sẽ được xoá.', // VHM:477
  restoreTitle: (label: string, floor: string): string => `Phục hồi phiên bản ${label} của ${floor}?`, // VHM:539
  restoreConfirm: 'Phục hồi', // VHM:541
  restoreCancel: 'Để nguyên', // VHM:542
  restoredToast: (label: string, floor: string): string =>
    `Đã phục hồi phiên bản ${label} của ${floor}; hoàn tác được trong 8 giây`, // UVH:443 + undoTicket.ts:18 (8000 ms) + datetime.ts:48,252-254
  undoneToast: 'Đã hoàn tác lượt phục hồi', // UVH:390
  noPair: 'Chưa chọn đủ hai phiên bản để so sánh', // VHP:44
  conflictTitle: 'Tầng vừa đổi ở nơi khác', // VHG:86
  conflictMessage: /đã sửa tầng này sau lúc bạn mở trang, nên lượt phục hồi chưa được ghi\. Tải lại để xem bản mới nhất\.$/u, // VHG:92
  conflictDismiss: 'Tải lại', // VHG:94
  labelDialog: (label: string): string => `Gắn nhãn phiên bản ${label}`, // VHD:37
  labelField: 'Nhãn', // VHD:41
  labelHint: 'Để trống rồi bấm Gắn nhãn là gỡ nhãn.', // VHD:42
  labelMax: 60, // VHD:14
  labelCancel: 'Huỷ', // VHD:49
  labeledToast: 'Đã gắn nhãn', // UVH:470 (previous label = '' when unset, UVH:534)
} as const;

/* SCR-32 diff tabs (VHX:205-213 renders TABS Tabs.Root/List/Tab). */
const DIFF_TABS = {
  list: 'Cách xem khác biệt', // VHX:52,206
  changes: 'Thay đổi', // VHP:27 (COMPARE_TABS order: changes, json, visual)
  json: 'JSON', // VHP:28
  visual: 'Trực quan', // VHP:29
  /** TABS:133-134 `h-11 sm:h-9`: 44 px below Tailwind `sm`, 36 px from it. */
  heightBelowSm: 44,
  heightFromSm: 36,
} as const;
/** Tailwind 3.4.6 default `sm` = `@media (min-width: 640px)` (tailwind.config.ts sets no `theme.screens`). */
const BELOW_SM = { width: 639, height: 900 } as const;
const AT_SM = { width: 640, height: 900 } as const;

/* ---------------------------------------------------------------- small helpers */

type Json = Record<string, unknown>;

const asRecord = (value: unknown, what: string): Json => {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) throw new Error(`${what}: not a JSON object`);
  return value as Json;
};

const uniq = (): string => `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;
const escapeRegExp = (text: string): string => text.replace(/[.*+?^${}()|[\]\\]/gu, '\\$&');
const pathOf = (page: Page): string => new URL(page.url()).pathname;
const quiet = (page: Page): Promise<void> => page.waitForTimeout(QUIET_MS);
/** GLB:124-130 `toFileSlug` for an ASCII project name. */
const fileSlug = (name: string): string => name.toLowerCase().replace(/[^a-z0-9]+/gu, '-').replace(/^-+|-+$/gu, '');

const ruleConfigRe = (projectId: string): RegExp => new RegExp(`^/api/projects/${escapeRegExp(projectId)}/rule-config$`, 'u');
const spatialRe = (projectId: string): RegExp => new RegExp(`^/api/projects/${escapeRegExp(projectId)}/spatial$`, 'u');
const versionsRe = (projectId: string): RegExp => new RegExp(`^/api/projects/${escapeRegExp(projectId)}/versions$`, 'u');
const restoreRe = (projectId: string): RegExp =>
  new RegExp(`^/api/projects/${escapeRegExp(projectId)}/versions/[^/]+/restore$`, 'u');
const labelRe = (projectId: string): RegExp => new RegExp(`^/api/projects/${escapeRegExp(projectId)}/versions/[^/]+/label$`, 'u');

/** Writes the page sent since `mark`, minus session/telemetry chatter. */
const writesSince = (log: readonly ApiEntry[], mark: number): string[] =>
  log
    .slice(mark)
    .filter((entry) => entry.method !== 'GET' && entry.path !== REFRESH_API && !entry.path.startsWith('/api/telemetry'))
    .map((entry) => `${entry.method} ${entry.path} ${String(entry.status)}`);

/** A count-up number (`useCountUp`) once settled; vi grouping "." removed. */
async function settledInt(locator: Locator): Promise<number> {
  return Number((await settledText(locator)).replace(/\./gu, ''));
}

/** The toast (role=status, Toast.tsx:120) carrying exactly `message`. */
const toast = (page: Page, message: string | RegExp): Locator => page.getByRole('status').filter({ hasText: message });

/**
 * `components/ui/Checkbox.tsx:40-75`: the `<input>` is `sr-only` under a drawn box inside its `<label>`, so the box
 * intercepts a click on the input; a person clicks the label — so does this.
 */
async function setBox(box: Locator, checked: boolean): Promise<void> {
  if ((await box.isChecked()) !== checked) await box.locator('xpath=ancestor::label[1]').click();
  await expect(box).toBeChecked({ checked });
}

/** Text of `locator` once two reads 400 ms apart agree (count-up, `useCountUp`). */
async function settledText(locator: Locator): Promise<string> {
  let last = '';
  await expect
    .poll(
      async () => {
        const now = (await locator.innerText()).trim();
        const same = now === last && now !== '';
        last = now;
        return same;
      },
      { message: 'text never settled', intervals: [400] },
    )
    .toBe(true);
  return last;
}

/* ---------------------------------------------------------------- admin context + API fixtures */

interface FloorRef {
  readonly id: string;
  readonly name: string;
}

interface ProjectRef {
  readonly id: string;
  readonly name: string;
  readonly floors: readonly FloorRef[];
}

interface Admin {
  readonly context: BrowserContext;
  readonly page: Page;
  readonly api: ApiEntry[];
  /** Fixture calls with this context's own access token (never logged). */
  readonly fx: LayerApi;
  /** Project ids this test owns; deleted when the context closes. */
  readonly cleanup: string[];
}

async function openAdmin(browser: Browser, viewport: Viewport): Promise<Admin> {
  const context = await browser.newContext({
    baseURL: readBaseUrl(),
    viewport,
    ...(existsSync(ADMIN_STORAGE_STATE_FILE) ? { storageState: ADMIN_STORAGE_STATE_FILE } : {}),
  });
  try {
    // One refresh checks the stored session (a 401 is answered by one UI sign-in); a second one hands this test its
    // own access token for the fixture calls (support/layerSeed.ts layerApiOf). Sequential: the cookie rotates.
    await ensureAdminSession(context, ADMIN_STORAGE_STATE_FILE);
    const fx = await layerApiOf(context);
    const page = await context.newPage();
    return { context, page, api: watchApi(page), fx, cleanup: [] };
  } catch (error) {
    await context.close();
    throw error;
  }
}

async function closeAdmin(admin: Admin): Promise<void> {
  const failures: string[] = [];
  for (const id of admin.cleanup) {
    const failed = await deleteProject(admin.fx, id);
    if (failed !== null) failures.push(failed);
  }
  if (failures.length > 0) test.info().annotations.push({ type: 'cleanup', description: failures.join('; ') });
  await admin.context.storageState({ path: ADMIN_STORAGE_STATE_FILE }).catch(() => undefined);
  await admin.context.close().catch(() => undefined);
}

async function withAdmin(browser: Browser, body: (admin: Admin) => Promise<void>, viewport: Viewport = DESKTOP): Promise<void> {
  const admin = await openAdmin(browser, viewport);
  try {
    await body(admin);
  } finally {
    await closeAdmin(admin);
  }
}

/** Name and floors of a project as `GET /api/projects/:id` returns them (floors in creation order of `names`). */
async function readProject(admin: Admin, id: string, names: readonly string[]): Promise<ProjectRef> {
  const read = await admin.fx.request.get(`${PROJECTS_API}/${id}`, { headers: admin.fx.headers });
  expect(read.status(), `setup: GET ${PROJECTS_API}/${id}`).toBe(200);
  const body = asRecord(await read.json(), 'GET /api/projects/:id');
  const rows = Array.isArray(body.floors) ? body.floors.map((row) => asRecord(row, 'floor')) : [];
  const floors = names.map((name) => {
    const row = rows.find((item) => item.name === name);
    if (row === undefined || typeof row.id !== 'string') throw new Error(`setup: floor "${name}" not found`);
    return { id: row.id, name };
  });
  if (typeof body.name !== 'string') throw new Error('setup: project without a name');
  return { id, name: body.name, floors };
}

/** Project with empty floors (no layer) through the real API (BE:apps/api/projects/router.py:54-63). */
async function bareProject(admin: Admin, slug: string, floorNames: readonly string[] = ['Tầng 1']): Promise<ProjectRef> {
  const name = `${TEST_DATA_PREFIX}e06-${slug}-${uniq()}`;
  expect(name.length, `fixture name "${name}" fits NAME_MAX 80`).toBeLessThanOrEqual(80);
  const created = await admin.fx.request.post(PROJECTS_API, {
    headers: admin.fx.headers,
    data: {
      name,
      floors: floorNames.map((floor, order) => ({ name: floor, order, elevationMm: order * FLOOR_HEIGHT_MM, heightMm: FLOOR_HEIGHT_MM })),
    },
  });
  expect(created.status(), `setup: POST ${PROJECTS_API} "${name}"`).toBe(201);
  const id = asRecord(await created.json(), 'POST /api/projects').id;
  if (typeof id !== 'string') throw new Error('setup: POST /api/projects without id');
  admin.cleanup.push(id);
  return readProject(admin, id, floorNames);
}

/** `createQcProject` (support/layerSeed.ts): one floor "Tầng 1" with the QC layer. */
async function qcProject(admin: Admin, slug: string): Promise<ProjectRef> {
  const [floor] = await createQcProject(admin.fx, `e06-${slug}`);
  if (floor === undefined) throw new Error('setup: createQcProject returned no floor');
  admin.cleanup.push(floor.projectId);
  return readProject(admin, floor.projectId, [floor.floorName]);
}

const firstFloor = (project: ProjectRef): FloorRef => {
  const floor = project.floors[0];
  if (floor === undefined) throw new Error('fixture project has no floor');
  return floor;
};

interface VersionRow {
  readonly id: string;
  readonly sequence: number;
  readonly label: string;
}

/** N17 items of a floor, newest first (BE:apps/api/versions/router.py:37-45, `sequence` desc). */
async function readVersions(admin: Admin, projectId: string, floorId: string): Promise<VersionRow[]> {
  const res = await admin.fx.request.get(`${PROJECTS_API}/${projectId}/versions?floorId=${encodeURIComponent(floorId)}`, {
    headers: admin.fx.headers,
  });
  expect(res.status(), 'setup: GET versions (N17)').toBe(200);
  const items = asRecord(await res.json(), 'N17').items;
  if (!Array.isArray(items)) throw new Error('N17: no items');
  return items
    .map((item) => asRecord(item, 'N17 item'))
    .map((item) => ({ id: String(item.id), sequence: Number(item.sequence), label: `v${String(item.sequence)}` })) // VHM:204
    .sort((a, b) => b.sequence - a.sequence);
}

/**
 * Bare one-floor project + the env drawing through #5 init → #6 chunk 0 → #7 complete (body: support/drawingSeed.ts,
 * FE src/lib/upload/uploadTask.ts). Waits until the real pipeline has written its two versions ("before" + "after",
 * BE:apps/worker/pipeline_persist/service.py:181-201). Returns the project and its versions, newest first.
 */
async function pipelineProject(admin: Admin, slug: string): Promise<{ project: ProjectRef; versions: VersionRow[] }> {
  const pngPath = process.env.E2E_DRAWING_PNG;
  if (pngPath === undefined || pngPath === '') throw new Error('E2E_DRAWING_PNG is not set (qa.config.json env.vars)');
  const png = readFileSync(pngPath);
  expect(png.length, 'fixture drawing fits one upload chunk').toBeLessThanOrEqual(CHUNK_BYTES);
  const project = await bareProject(admin, slug);
  const floor = firstFloor(project);
  const { request, headers } = admin.fx;
  const init = await request.post(`${PROJECTS_API}/${project.id}/floors/${floor.id}/drawings/uploads`, {
    headers,
    data: { fileName: `${project.name}.png`, floorId: floor.id, mimeType: 'image/png', projectId: project.id, sizeBytes: png.length },
  });
  expect(init.status(), `setup: upload init (#5): ${(await init.text()).slice(0, 200)}`).toBe(200);
  const uploadId = String(asRecord(await init.json(), 'init').id);
  const base = `${PROJECTS_API}/${project.id}/drawings/uploads/${uploadId}`;
  const chunk = await request.post(`${base}/chunks`, { headers, data: { chunk: png.toString('base64'), chunkIndex: 0 } });
  expect(chunk.status(), 'setup: upload chunk 0 (#6)').toBe(200);
  const done = await request.post(`${base}/complete`, { headers, data: { uploadId } });
  expect(done.status(), `setup: upload complete (#7): ${(await done.text()).slice(0, 200)}`).toBe(200);
  let versions: VersionRow[] = [];
  await expect
    .poll(
      async () => {
        versions = await readVersions(admin, project.id, floor.id);
        return versions.length;
      },
      { message: 'setup: the pipeline wrote its "before" and "after" versions (N17 ≥ 2)', timeout: PIPELINE_TIMEOUT_MS, intervals: [2_000] },
    )
    .toBeGreaterThanOrEqual(2);
  return { project, versions };
}

/** N22 through the API (BE:apps/api/rules/router.py:29-37): `{baseVersion, body: {overrides}}`. */
async function putRuleConfig(admin: Admin, projectId: string, baseVersion: number, overrides: Json): Promise<number> {
  const res = await admin.fx.request.put(`${PROJECTS_API}/${projectId}/rule-config`, {
    headers: admin.fx.headers,
    data: { baseVersion, body: { overrides } },
  });
  return res.status();
}

/** A JSON 500 for one GET path (the rest falls through). */
function failGet(matcher: RegExp, counter: { served: number }): (route: Route) => Promise<void> {
  return async (route) => {
    if (route.request().method() !== 'GET' || !matcher.test(new URL(route.request().url()).pathname)) {
      await route.fallback();
      return;
    }
    counter.served += 1;
    await route.fulfill({ status: 500, contentType: 'application/json', body: JSON.stringify({ detail: 'qa-e06 mocked 500' }) });
  };
}

/* ---- screen helpers ---- */

/** Opens a project route with a fresh document load and waits for its N15 read (200) — PSG via useProjectSpatial. */
async function openProjectRoute(page: Page, url: string, projectId: string): Promise<void> {
  await navigateThenWaitForApi(page, () => page.goto(url, { waitUntil: 'commit' }), 'GET', spatialRe(projectId), [200]);
}

const levelFilter = (page: Page): Locator => page.getByRole('radiogroup', { name: RR.levelFilter, exact: true });
/** RRG:90-108 the group toggle is a button inside an `<h3>`. */
const groupExpanders = (page: Page): Locator => page.getByRole('heading', { level: 3 }).getByRole('button');
const summaryValue = (page: Page, label: string): Locator =>
  page
    .locator('dl > div')
    .filter({ has: page.locator('dt').filter({ hasText: new RegExp(`^${label}$`, 'u') }) })
    .locator('dd'); // RRS:55-62,80-85

async function openRules(page: Page, projectId: string): Promise<void> {
  await openProjectRoute(page, ROUTES.project.rules(projectId), projectId);
  await expect(page.getByRole('heading', { name: RR.heading, level: 2 })).toBeVisible();
  await expect(page.getByRole('button', { name: RR.rerun, exact: true })).toBeEnabled();
}

async function openSettings(page: Page, projectId: string): Promise<void> {
  await navigateThenWaitForApi(
    page,
    () => page.goto(ROUTES.project.ruleSettings(projectId), { waitUntil: 'commit' }),
    'GET',
    ruleConfigRe(projectId),
    [200],
  );
  await expect(page.getByRole('heading', { name: RS.heading, level: 2 })).toBeVisible();
  await expect(page.getByRole('switch', { name: ruleSwitchName(WALL_THICKNESS.name), exact: true })).toBeEnabled();
}

async function openExport(page: Page, projectId: string): Promise<void> {
  await openProjectRoute(page, ROUTES.project.export(projectId), projectId);
  await expect(page.getByRole('radiogroup', { name: EP.formats, exact: true })).toBeVisible();
  await dismissTour(page, { waitMs: TOUR_APPEAR_TIMEOUT_MS }); // G6: the tour backdrop swallows the first click
}

const formatRadio = (page: Page, extension: string): Locator =>
  page
    .getByRole('radiogroup', { name: EP.formats, exact: true })
    .getByRole('radio', { name: new RegExp(`^${escapeRegExp(extension)}`, 'u') }); // EPF:89,106 name starts with the extension

async function selectFormat(page: Page, extension: string): Promise<Locator> {
  const radio = formatRadio(page, extension);
  await radio.click();
  await expect(radio).toHaveAttribute('aria-checked', 'true');
  return radio;
}

async function expandOptions(page: Page): Promise<void> {
  const toggle = page.getByRole('button', { name: EP.options, exact: true });
  if ((await toggle.getAttribute('aria-expanded')) !== 'true') await toggle.click();
  await expect(toggle).toHaveAttribute('aria-expanded', 'true'); // EPO:225
}

async function openData(page: Page, projectId: string): Promise<void> {
  await openProjectRoute(page, ROUTES.project.data(projectId), projectId);
  await expect(page.getByRole('textbox', { name: SJ.search, exact: true })).toBeVisible();
}

const versionList = (page: Page): Locator => page.getByRole('navigation', { name: VH.list, exact: true });
const versionRow = (page: Page, label: string): Locator =>
  versionList(page).getByRole('listitem').filter({ has: page.getByRole('checkbox', { name: VH.checkbox(label), exact: true }) });

const diffTab = (page: Page, label: string): Locator =>
  page.getByRole('tablist', { name: DIFF_TABS.list, exact: true }).getByRole('tab', { name: label, exact: true });
/** Rounded rendered heights of the three diff tabs, in DOM order. */
const diffTabHeights = (page: Page): Promise<number[]> =>
  page
    .getByRole('tablist', { name: DIFF_TABS.list, exact: true })
    .getByRole('tab')
    .evaluateAll((els) => els.map((el) => Math.round(el.getBoundingClientRect().height)));

/** `/versions` with a fresh document; waits for N17 200 of `floorId` (VHC:206 picks the only floor). */
async function openVersions(page: Page, projectId: string, floorId: string, query = ''): Promise<void> {
  const listed = page.waitForResponse(
    (response) =>
      response.request().method() === 'GET' &&
      versionsRe(projectId).test(new URL(response.url()).pathname) &&
      new URL(response.url()).searchParams.get('floorId') === floorId &&
      response.status() === 200,
  );
  await page.goto(`${ROUTES.project.versions(projectId)}${query}`);
  await listed;
}

/* ================================================================= all five routes */

test.describe('E06 project gate', () => {
  test('E06 · SCR-28…32 unknown project id → "Không tìm thấy dự án này" on all five routes; "Về danh sách dự án" → dashboard', async ({ browser }) => {
    await withAdmin(browser, async ({ page, api }) => {
      // Not a `prj_<ULID>`: BE answers 404 `project` (BE:apps/api/projects/access.py:28-33; phase05 edge).
      const projectId = `prj_qa-e06-${uniq()}`;
      const mark = api.length;
      const routes: readonly (readonly [string, string])[] = [
        ['rules', ROUTES.project.rules(projectId)], // RRC:232-240
        ['rulesettings', ROUTES.project.ruleSettings(projectId)], // RSC:157-170
        ['export', ROUTES.project.export(projectId)], // EP ExportPanel.container.tsx:220-229
        ['data', ROUTES.project.data(projectId)], // SJC:227-231
        ['versions', ROUTES.project.versions(projectId)], // VHC:246-252
      ];
      let alert: Locator | null = null;
      for (const [slug, url] of routes) {
        await page.goto(url);
        alert = page.getByRole('alert').filter({ hasText: GATE.notFoundTitle }); // PSG:48-61,74-76
        await expect(alert).toBeVisible();
        await expect(alert).toContainText(GATE.notFoundDescription);
        await captureEvidence(page, `E06_unknown_project_${slug}.png`);
      }
      if (alert === null) throw new Error('no route visited');
      await alert.getByRole('button', { name: GATE.backToProjects, exact: true }).click();
      await expect.poll(() => pathOf(page)).toBe(ROUTES.dashboard);
      await expect(page.getByRole('heading', { level: 1, name: DASHBOARD_TITLE, exact: true })).toBeVisible();
      expect(writesSince(api, mark), 'an unknown project writes nothing').toEqual([]);
      await attachJson('E06_unknown_project.json', { projectId, landedOn: pathOf(page), writes: writesSince(api, mark) });
    });
  });
});

/* ================================================================= SCR-28 Rule Report */

test.describe('E06 SCR-28 Rule Report', () => {
  test('E06 · SCR-28 floor without a layer → done: "Không phát hiện vi phạm nào.", no filter bar; "Sang bước xuất bản" and "Xác nhận đã xử lý" → /export', async ({ browser }) => {
    await withAdmin(browser, async (admin) => {
      const { page } = admin;
      const project = await bareProject(admin, 'rules-done');
      await openRules(page, project.id);
      // URR:593 no violation → 'done'; RRV:203-205,138-153 DonePanel; RRV:271 canFilter false in 'done'.
      await expect(page.getByText(RR.doneText, { exact: true })).toBeVisible();
      await expect(page.getByText(RR.doneCount)).toBeVisible();
      await expect(page.getByText(RR.doneBadge, { exact: true })).toBeVisible();
      await expect(levelFilter(page)).toHaveCount(0);
      expect(await settledInt(summaryValue(page, 'Vi phạm')), 'Vi phạm').toBe(0);
      // RRV:351-360 footer button enabled when violations = 0.
      await expect(page.getByRole('button', { name: RR.confirm, exact: true })).toBeEnabled();
      await captureEvidence(page, 'E06_rules_done.png');

      await page.getByRole('button', { name: RR.toExport, exact: true }).click(); // URR:668-674
      await expect.poll(() => pathOf(page)).toBe(ROUTES.project.export(project.id));
      await page.goBack();
      await expect(page.getByRole('heading', { name: RR.heading, level: 2 })).toBeVisible();
      await page.getByRole('button', { name: RR.confirm, exact: true }).click(); // RRV:356 onConfirmResolved
      await expect.poll(() => pathOf(page)).toBe(ROUTES.project.export(project.id));
      await expect(page.getByRole('radiogroup', { name: EP.formats, exact: true })).toBeVisible();
      await captureEvidence(page, 'E06_rules_done_to_export.png');
    });
  });

  test('E06 · SCR-28 level filter "Đạt" lists exactly the passed rules; "Cảnh báo" keeps no critical group', async ({ browser }) => {
    await withAdmin(browser, async (admin) => {
      const { page } = admin;
      const project = await qcProject(admin, 'rules-passed');
      await openRules(page, project.id);
      await expect(levelFilter(page)).toBeVisible(); // RRV:315 ready/partial
      const passed = await settledInt(summaryValue(page, 'Đạt'));

      const passedRadio = levelFilter(page).getByRole('radio', { name: 'Đạt', exact: true }); // RRL:95-100
      await passedRadio.click();
      await expect(passedRadio).toHaveAttribute('aria-checked', 'true');
      // RRV:207-213: the passed list replaces the groups; RRG:344-355 one <li> per rule: name + group label.
      await expect(groupExpanders(page)).toHaveCount(0);
      const passedItems = page.getByRole('listitem').filter({ hasText: new RegExp(`(${GROUP_LABELS.join('|')})$`, 'u') });
      if (passed === 0) await expect(page.getByText(RR.noPassed, { exact: true })).toBeVisible();
      else await expect(passedItems).toHaveCount(passed); // URR:539-560 = ranRuleCodes − failed = summary.passed (URR:480)
      await captureEvidence(page, 'E06_rules_filter_passed.png');

      const warningRadio = levelFilter(page).getByRole('radio', { name: 'Cảnh báo', exact: true });
      await warningRadio.click();
      await expect(warningRadio).toHaveAttribute('aria-checked', 'true');
      // URR:515-521 'warning' drops critical rows; RRG:319 a group summary starts with its severity label.
      const summaries = await groupExpanders(page).allInnerTexts();
      expect(summaries.filter((text) => text.includes('Nghiêm trọng ·')), 'critical groups under "Cảnh báo"').toEqual([]);
      if (summaries.length === 0) await expect(page.getByText(RR.noMatch, { exact: true })).toBeVisible();
      await captureEvidence(page, 'E06_rules_filter_warning.png');
      await attachJson('E06_rules_filter_warning.json', { passed, warningGroupSummaries: summaries });
    });
  });

  test('E06 · SCR-28 filters with no match → "Không có mục nào khớp bộ lọc đang đặt. Nới bộ lọc để xem thêm."', async ({ browser }) => {
    await withAdmin(browser, async (admin) => {
      const { page } = admin;
      const project = await qcProject(admin, 'rules-nomatch');
      await openRules(page, project.id);
      const violation = levelFilter(page).getByRole('radio', { name: 'Vi phạm', exact: true });
      await violation.click();
      await expect(violation).toHaveAttribute('aria-checked', 'true');
      // "Cao độ tầng" only holds LEVEL-ELEVATION (registry.ts:667-669); one level cannot break "tăng dần".
      const group = page.getByRole('combobox', { name: RR.groupSelect, exact: true });
      await group.click();
      await page.getByRole('option', { name: 'Cao độ tầng', exact: true }).click();
      await expect(group).toContainText('Cao độ tầng');
      // RRV:227-232 isFiltered (URR:701-704) → the filter sentence, not "Không còn mục nào…".
      await expect(page.getByText(RR.noMatch, { exact: true })).toBeVisible();
      await expect(groupExpanders(page)).toHaveCount(0);
      await captureEvidence(page, 'E06_rules_filter_no_match.png');
    });
  });

  test('E06 · SCR-28 group expander by keyboard: Enter opens the table (Mức độ / Mô tả / Tầng / Mã đối tượng), Enter closes it', async ({ browser }) => {
    await withAdmin(browser, async (admin) => {
      const { page } = admin;
      const project = await qcProject(admin, 'rules-keys');
      await openRules(page, project.id);
      const expander = groupExpanders(page).first();
      await expect(expander).toHaveAttribute('aria-expanded', 'false'); // URR:397 nothing expanded at first
      const section = page.locator('section').filter({ has: expander });
      await expander.focus();
      await page.keyboard.press('Enter');
      await expect(expander).toHaveAttribute('aria-expanded', 'true'); // RRG:93,112
      for (const name of RR.columns) {
        await expect(section.getByRole('columnheader', { name, exact: true })).toBeVisible(); // RRG:244-247
      }
      await expect(section.getByRole('button', { name: RR.view, exact: true }).first()).toBeVisible();
      await captureEvidence(page, 'E06_rules_group_keyboard_open.png');
      await page.keyboard.press('Enter');
      await expect(expander).toHaveAttribute('aria-expanded', 'false');
      await expect(section.getByRole('columnheader')).toHaveCount(0); // RRG:112 body not rendered when closed
      await captureEvidence(page, 'E06_rules_group_keyboard_closed.png');
    });
  });

  test('E06 · SCR-28 "Chạy kiểm tra lại" runs in the browser (no request); "Xem" → /3d and Back returns to the report', async ({ browser }) => {
    await withAdmin(browser, async (admin) => {
      const { page, api } = admin;
      const project = await qcProject(admin, 'rules-rerun');
      await openRules(page, project.id);
      const mark = api.length;
      await page.getByRole('button', { name: RR.rerun, exact: true }).click(); // URR:640-655 query.refetch → runRules
      await expect(page.getByRole('button', { name: RR.rerun, exact: true })).toBeEnabled();
      await quiet(page);
      const sent = api
        .slice(mark)
        .filter((entry) => entry.path !== REFRESH_API && !entry.path.startsWith('/api/telemetry'))
        .filter((entry) => entry.method !== 'GET' || spatialRe(project.id).test(entry.path))
        .map((entry) => `${entry.method} ${entry.path}`);
      expect(sent, 'a re-run neither writes nor re-reads the model').toEqual([]);
      // Observed (run-25-author): one GET rule-config right after the click. URR:640-655 does not refetch the config;
      // react-query's focus refetch of the stale config query (the click focuses the page) is the likely source — recorded,
      // not asserted.
      const configReads = api.slice(mark).filter((entry) => entry.method === 'GET' && entry.path.endsWith('/rule-config')).length;
      await captureEvidence(page, 'E06_rules_rerun_local.png', {
        caption: `writes / N15 reads after "Chạy kiểm tra lại": ${JSON.stringify(sent)}; rule-config GETs: ${String(configReads)}`,
      });

      const expander = groupExpanders(page).first();
      await expander.click();
      await expect(expander).toHaveAttribute('aria-expanded', 'true');
      await page.locator('section').filter({ has: expander }).getByRole('button', { name: RR.view, exact: true }).first().click();
      await expect.poll(() => pathOf(page)).toBe(ROUTES.project.viewer(project.id)); // URR:632-638
      await page.goBack();
      await expect.poll(() => pathOf(page)).toBe(ROUTES.project.rules(project.id));
      await expect(page.getByRole('heading', { name: RR.heading, level: 2 })).toBeVisible();
      await expect(levelFilter(page)).toBeVisible();
      await captureEvidence(page, 'E06_rules_view_back.png');
      await attachJson('E06_rules_rerun_local.json', { writesOrModelReadsAfterRerun: sent, ruleConfigGetsAfterRerun: configReads, backTo: pathOf(page) });
    });
  });

  test('E06 · SCR-28 a rule switched off through rule-config (N22) drops "Tổng số kiểm tra" by one after reload', async ({ browser }) => {
    await withAdmin(browser, async (admin) => {
      const { page } = admin;
      const project = await qcProject(admin, 'rules-config');
      await openRules(page, project.id);
      const before = await settledInt(summaryValue(page, 'Tổng số kiểm tra'));
      // BE:apps/api/rules/catalog.py:19-25 knows the code; revision 0 on a fresh project (rules/schemas.py:61-62).
      expect(await putRuleConfig(admin, project.id, 0, { [WALL_LENGTH.code]: { enabled: false } }), 'N22 PUT').toBe(200);
      await openRules(page, project.id);
      // URR:380-389 the registry follows the config; URR:478-479 evaluated = rules that ran.
      const after = await settledInt(summaryValue(page, 'Tổng số kiểm tra'));
      expect(after, 'Tổng số kiểm tra after switching WALL-LENGTH off').toBe(before - 1);
      await captureEvidence(page, 'E06_rules_config_applied.png', { caption: `Tổng số kiểm tra ${String(before)} → ${String(after)}` });
      await attachJson('E06_rules_config_applied.json', { before, after, disabled: WALL_LENGTH.code });
    });
  });

  test('E06 · SCR-28 [mocked response] GET rule-config 500 → "Không chạy được lượt kiểm tra" + "Không tải được cấu hình bộ luật của dự án."; "Thử lại" recovers', async ({ browser }) => {
    await withAdmin(browser, async (admin) => {
      const { page } = admin;
      const project = await qcProject(admin, 'rules-500');
      const counter = { served: 0 };
      const handler = failGet(ruleConfigRe(project.id), counter);
      await page.route('**/api/projects/**', handler);
      await openProjectRoute(page, ROUTES.project.rules(project.id), project.id);
      // URR:577-579 configQuery.isLoadingError → 'error'; RRV:179-191; URR:706 errorMessage.
      await expect(page.getByText(RR.errorTitle, { exact: true })).toBeVisible({ timeout: ERROR_PAINT_TIMEOUT_MS });
      await expect(page.getByText(RR.configFailed, { exact: true })).toBeVisible();
      await expect(levelFilter(page)).toHaveCount(0);
      await captureEvidence(page, 'E06_rules_config_500.png');

      await page.unroute('**/api/projects/**', handler);
      const reread = waitForApi(page, 'GET', ruleConfigRe(project.id), [200]);
      await page.getByRole('button', { name: RR.retry, exact: true }).click(); // URR:643-645 refetch the config
      await reread;
      await expect(page.getByText(RR.errorTitle, { exact: true })).toHaveCount(0);
      await expect(levelFilter(page).or(page.getByText(RR.doneText, { exact: true })).first()).toBeVisible();
      await captureEvidence(page, 'E06_rules_config_500_retry.png');
      await attachJson('E06_rules_config_500.json', { mockedConfigResponses: counter.served, status: 500, afterRetry: 200 });
    });
  });
});

/* ================================================================= SCR-29 Rule Settings */

test.describe('E06 SCR-29 Rule Settings', () => {
  test('E06 · SCR-29 switch a rule off, then "Hoàn tác" in its toast → a second PUT puts it back on', async ({ browser }) => {
    await withAdmin(browser, async (admin) => {
      const { page } = admin;
      const project = await bareProject(admin, 'settings-undo');
      await openSettings(page, project.id);
      const ruleSwitch = page.getByRole('switch', { name: ruleSwitchName(WALL_THICKNESS.name), exact: true });
      await expect(ruleSwitch).toHaveAttribute('aria-checked', 'true'); // enabled by default (registry.ts:446-452)

      const off = waitForApi(page, 'PUT', ruleConfigRe(project.id), [200], AUTOSAVE_TIMEOUT_MS);
      await ruleSwitch.click();
      await expect(ruleSwitch).toHaveAttribute('aria-checked', 'false');
      const offSent = asRecord((await off).response.request().postDataJSON(), 'PUT rule-config (off)');
      const offOverrides = asRecord(asRecord(offSent.body, 'body').overrides, 'overrides');
      expect(asRecord(offOverrides[WALL_THICKNESS.code], WALL_THICKNESS.code).enabled).toBe(false); // RSW:167-185
      const offRevision = asRecord((await off).json, 'PUT answer').revision;

      // URS:945-951 label + "." → RSC:175-181 appNotificationBus toast with the undo ticket.
      const offToast = toast(page, `Tắt luật ${WALL_THICKNESS.name}.`);
      await expect(offToast).toBeVisible();
      await captureEvidence(page, 'E06_rulesettings_toggle_toast.png');

      const back = waitForApi(page, 'PUT', ruleConfigRe(project.id), [200], AUTOSAVE_TIMEOUT_MS);
      await offToast.getByRole('button', { name: TOAST_UNDO, exact: true }).click(); // URS:687-702 undo → notifyChange
      await expect(ruleSwitch).toHaveAttribute('aria-checked', 'true');
      const backSent = asRecord((await back).response.request().postDataJSON(), 'PUT rule-config (undo)');
      expect(backSent.baseVersion, 'undo PUT builds on the first answer').toBe(offRevision);
      expect(asRecord(asRecord(backSent.body, 'body').overrides, 'overrides')[WALL_THICKNESS.code], 'override gone again').toBeUndefined();
      await captureEvidence(page, 'E06_rulesettings_toggle_undone.png');
      await attachJson('E06_rulesettings_toggle_undone.json', { off: offSent, undo: backSent });
    });
  });

  test('E06 · SCR-29 threshold "Bề dày tường tối thiểu": 250 / 10 refused ("Giá trị không quá 200 mm." / "…nhỏ hơn 30 mm."), no PUT; Esc restores; 45 is saved', async ({ browser }) => {
    await withAdmin(browser, async (admin) => {
      const { page, api } = admin;
      const project = await bareProject(admin, 'settings-threshold');
      await openSettings(page, project.id);
      const field = page.getByRole('textbox', { name: MIN_THICKNESS.label, exact: true }); // RSR:89-107 aria-label
      const before = await field.inputValue();
      const mark = api.length;

      await typeHeight(field, '250');
      await expect(page.getByRole('alert').filter({ hasText: 'Giá trị không quá 200 mm.' })).toBeVisible(); // NF:69-73, Input.tsx:117
      await typeHeight(field, '10');
      await expect(page.getByRole('alert').filter({ hasText: 'Giá trị không nhỏ hơn 30 mm.' })).toBeVisible(); // NF:72
      await quiet(page);
      expect(writesSince(api, mark), 'a refused value is never committed (NF:82-95)').toEqual([]);
      await captureEvidence(page, 'E06_rulesettings_threshold_refused.png');

      await field.focus();
      await page.keyboard.press('Escape'); // NF:144-148 back to the last committed value, refusal cleared
      await expect(field).toHaveValue(before);
      await expect(page.getByRole('alert').filter({ hasText: 'Giá trị không nhỏ hơn 30 mm.' })).toHaveCount(0);

      const put = waitForApi(page, 'PUT', ruleConfigRe(project.id), [200], AUTOSAVE_TIMEOUT_MS);
      await typeHeight(field, MIN_THICKNESS.valid);
      const sent = asRecord((await put).response.request().postDataJSON(), 'PUT rule-config (threshold)');
      const override = asRecord(asRecord(asRecord(sent.body, 'body').overrides, 'overrides')[WALL_THICKNESS.code], WALL_THICKNESS.code);
      expect(asRecord(override.thresholds, 'thresholds')[MIN_THICKNESS.key]).toBe(Number(MIN_THICKNESS.valid)); // URS:979-1016
      await expect(toast(page, `Đổi ngưỡng ${MIN_THICKNESS.label}.`)).toBeVisible(); // URS:1013-1015
      await captureEvidence(page, 'E06_rulesettings_threshold_saved.png');
      await attachJson('E06_rulesettings_threshold.json', { before, refused: ['250', '10'], saved: sent });
    });
  });

  test('E06 · SCR-29 "Mức độ của luật: …" → "Gợi ý" sends severity "suggestion"; toast "Đổi mức của luật …."', async ({ browser }) => {
    await withAdmin(browser, async (admin) => {
      const { page } = admin;
      const project = await bareProject(admin, 'settings-severity');
      await openSettings(page, project.id);
      const severity = page.getByRole('combobox', { name: severityName(WALL_THICKNESS.name), exact: true }); // RSR:62-79
      await expect(severity).toContainText('Cảnh báo'); // registry.ts:449 severity warning, RSR:26-30
      const put = waitForApi(page, 'PUT', ruleConfigRe(project.id), [200], AUTOSAVE_TIMEOUT_MS);
      await severity.click();
      await page.getByRole('option', { name: 'Gợi ý', exact: true }).click();
      await expect(severity).toContainText('Gợi ý');
      const sent = asRecord((await put).response.request().postDataJSON(), 'PUT rule-config (severity)');
      const override = asRecord(asRecord(asRecord(sent.body, 'body').overrides, 'overrides')[WALL_THICKNESS.code], WALL_THICKNESS.code);
      expect(override.severity).toBe('suggestion'); // URS:963-970, RSW:175
      await expect(toast(page, `Đổi mức của luật ${WALL_THICKNESS.name}.`)).toBeVisible();
      await captureEvidence(page, 'E06_rulesettings_severity.png');
      await attachJson('E06_rulesettings_severity.json', { sent });
    });
  });

  test('E06 · SCR-29 group switches: "Hình học" off → its rules off + "N luật, 0 đang bật."; all groups off → "Mọi luật đều đang tắt…"; "Khôi phục mặc định" undoes it', async ({ browser }) => {
    await withAdmin(browser, async (admin) => {
      const { page } = admin;
      const project = await bareProject(admin, 'settings-groups');
      await openSettings(page, project.id);
      const header = page.getByText(RS.enabledCount);
      const total = Number(RS.enabledCount.exec(await settledText(header))?.[2] ?? 'NaN');

      const geometry = page.getByRole('region', { name: GROUP_LABELS[0], exact: true }); // RSG:53-58 aria-labelledby h3
      await page.getByRole('switch', { name: groupSwitchName(GROUP_LABELS[0]), exact: true }).click(); // RSG:66-73
      await expect(geometry.getByRole('switch', { name: /^Bật hoặc tắt luật: /u, checked: true })).toHaveCount(0);
      await expect(geometry.getByText(RS.groupDescriptionOff)).toBeVisible(); // URS:780
      await expect(toast(page, `Tắt nhóm ${lowerFirst(GROUP_LABELS[0])}.`)).toBeVisible(); // URS:954-960
      await captureEvidence(page, 'E06_rulesettings_group_off.png');

      for (const label of GROUP_LABELS.slice(1)) {
        const groupSwitch = page.getByRole('switch', { name: groupSwitchName(label), exact: true });
        if ((await groupSwitch.count()) === 0) continue; // URS:766-771 a group without rules is not rendered
        await groupSwitch.click();
        await expect(groupSwitch).toHaveAttribute('aria-checked', 'false');
      }
      const lastOff = waitForApi(page, 'PUT', ruleConfigRe(project.id), [200], AUTOSAVE_TIMEOUT_MS);
      await expect(page.getByText(RS.disableAll, { exact: true })).toBeVisible(); // URS:907, RSV:190-192
      await expect.poll(async () => (await header.innerText()).trim()).toBe(`0/${String(total)} luật đang bật`); // RSV:270
      await lastOff;
      await captureEvidence(page, 'E06_rulesettings_all_off.png');

      const reset = waitForApi(page, 'PUT', ruleConfigRe(project.id), [200], AUTOSAVE_TIMEOUT_MS);
      await page.getByRole('button', { name: RS.restoreDefaults, exact: true }).click(); // URS:1076-1079
      const resetSent = asRecord((await reset).response.request().postDataJSON(), 'PUT rule-config (reset)');
      expect(asRecord(resetSent.body, 'body').overrides, 'defaults = no override').toEqual({});
      await expect(page.getByText(RS.disableAll, { exact: true })).toHaveCount(0);
      await expect(page.getByRole('button', { name: RS.restoreDefaults, exact: true })).toHaveCount(0); // RSV:257
      await captureEvidence(page, 'E06_rulesettings_groups_reset.png');
      await attachJson('E06_rulesettings_groups.json', { totalRules: total, reset: resetSent });
    });
  });

  test('E06 · SCR-29 rule-config changed elsewhere → PUT 409 → "Bộ luật vừa được đổi ở nơi khác…"; "Tải lại" asks ("Để sau" / "Bỏ thay đổi và tải lại") and shows the server state', async ({ browser }) => {
    await withAdmin(browser, async (admin) => {
      const { page } = admin;
      const project = await bareProject(admin, 'settings-conflict');
      await openSettings(page, project.id); // revision 0 in the store
      // Another writer: N22 at base 0 → revision 1 (BE:apps/api/rules/service.py:99-146).
      expect(await putRuleConfig(admin, project.id, 0, { [WALL_LENGTH.code]: { enabled: false } }), 'N22 PUT (other writer)').toBe(200);

      const rejected = waitForApi(page, 'PUT', ruleConfigRe(project.id), [409], AUTOSAVE_TIMEOUT_MS);
      await page.getByRole('switch', { name: ruleSwitchName(WALL_THICKNESS.name), exact: true }).click();
      const conflict = await rejected;
      expect(asRecord(conflict.json, '409').code).toBe('VERSION_CONFLICT');
      await expect(page.getByText(RS.conflict, { exact: true })).toBeVisible(); // URS:578-581, RSW:316-327, RSV:182-188
      await captureEvidence(page, 'E06_rulesettings_conflict.png');

      await page.getByRole('button', { name: RS.reload, exact: true }).click(); // URS:645-652 unsaved edits → ask first
      const dialog = page.getByRole('dialog').filter({ hasText: RS.reloadTitle });
      await expect(dialog).toBeVisible();
      await dialog.getByRole('button', { name: RS.reloadLater, exact: true }).click(); // URS:659-661
      await expect(dialog).toHaveCount(0);
      await expect(page.getByText(RS.conflict, { exact: true })).toBeVisible();

      await page.getByRole('button', { name: RS.reload, exact: true }).click();
      await expect(dialog).toBeVisible();
      await captureEvidence(page, 'E06_rulesettings_reload_dialog.png');
      const reread = waitForApi(page, 'GET', ruleConfigRe(project.id), [200]);
      await dialog.getByRole('button', { name: RS.reloadConfirm, exact: true }).click(); // URS:654-657 → reload → hydrate
      await reread;
      await expect(page.getByRole('switch', { name: ruleSwitchName(WALL_LENGTH.name), exact: true })).toHaveAttribute('aria-checked', 'false');
      await expect(page.getByRole('switch', { name: ruleSwitchName(WALL_THICKNESS.name), exact: true })).toHaveAttribute('aria-checked', 'true');
      await expect(page.getByText(RS.conflict, { exact: true })).toHaveCount(0); // URS:639 setSaveProblem(null)
      await captureEvidence(page, 'E06_rulesettings_reloaded.png');
      await attachJson('E06_rulesettings_conflict.json', { rejected: conflict.json });
    });
  });

  test('E06 · SCR-29 nav "Ngưỡng chung" → aria-current, #rule-settings-general-thresholds, the general-threshold card', async ({ browser }) => {
    await withAdmin(browser, async (admin) => {
      const { page } = admin;
      const project = await bareProject(admin, 'settings-nav');
      await openSettings(page, project.id);
      const nav = page.getByRole('navigation', { name: RS.nav, exact: true });
      await expect(nav.getByRole('link', { name: GROUP_LABELS[0], exact: true })).toHaveAttribute('aria-current', 'true'); // RSV:248-250 first group
      const general = nav.getByRole('link', { name: RS.generalNav, exact: true });
      await general.click(); // RSV:140-146
      await expect(general).toHaveAttribute('aria-current', 'true');
      await expect.poll(() => new URL(page.url()).hash).toBe(RS.generalHash);
      const card = page.getByRole('region', { name: RS.generalNav, exact: true }); // RSG:114-127
      await expect(card).toBeInViewport();
      await expect(card.getByRole('textbox', { name: RS.generalField, exact: true })).toBeVisible(); // RSG:133-150
      await captureEvidence(page, 'E06_rulesettings_nav_general.png', { caption: `hash ${new URL(page.url()).hash}` });
      await attachJson('E06_rulesettings_nav_general.json', { url: `${pathOf(page)}${new URL(page.url()).hash}` });
    });
  });

  test('E06 · SCR-29 Back right after a toggle (inside the 800 ms window) still saves — unmount flush; reopened, the rule is off', async ({ browser }) => {
    await withAdmin(browser, async (admin) => {
      const { page } = admin;
      const project = await bareProject(admin, 'settings-flush');
      await openRules(page, project.id);
      await page.getByRole('link', { name: RR.settingsLink, exact: true }).click(); // RRC:154-163 SPA navigation
      await expect.poll(() => pathOf(page)).toBe(ROUTES.project.ruleSettings(project.id));
      const ruleSwitch = page.getByRole('switch', { name: ruleSwitchName(WALL_THICKNESS.name), exact: true });
      await expect(ruleSwitch).toBeEnabled();

      const put = waitForApi(page, 'PUT', ruleConfigRe(project.id), [200], AUTOSAVE_TIMEOUT_MS);
      await ruleSwitch.click();
      await page.goBack(); // URS:592-619 unmount while pending → flush.pending + saveNow
      const { response } = await put;
      await expect.poll(() => pathOf(page)).toBe(ROUTES.project.rules(project.id));
      await openSettings(page, project.id);
      await expect(ruleSwitch).toHaveAttribute('aria-checked', 'false');
      await captureEvidence(page, 'E06_rulesettings_flush_on_back.png');
      await attachJson('E06_rulesettings_flush_on_back.json', { sent: response.request().postDataJSON() });
    });
  });

  test('E06 · SCR-29 [mocked response] GET rule-config 500 → "Không tải được cài đặt bộ luật" + generic description; reload recovers', async ({ browser }) => {
    await withAdmin(browser, async (admin) => {
      const { page } = admin;
      const project = await bareProject(admin, 'settings-500');
      const counter = { served: 0 };
      const handler = failGet(ruleConfigRe(project.id), counter);
      await page.route('**/api/projects/**', handler);
      await openProjectRoute(page, ROUTES.project.ruleSettings(project.id), project.id);
      // URS:857-859 'error'; URS:888-894 describeError(500 → unknown); RSV:279-288.
      await expect(page.getByText(RS.loadErrorTitle, { exact: true })).toBeVisible({ timeout: ERROR_PAINT_TIMEOUT_MS });
      await expect(page.getByText(GENERIC_UNKNOWN, { exact: true })).toBeVisible();
      await expect(page.getByRole('switch')).toHaveCount(0);
      await captureEvidence(page, 'E06_rulesettings_500.png');

      await page.unroute('**/api/projects/**', handler);
      await openSettings(page, project.id);
      await expect(page.getByText(RS.loadErrorTitle, { exact: true })).toHaveCount(0);
      await attachJson('E06_rulesettings_500.json', { mockedConfigResponses: counter.served, status: 500 });
    });
  });
});

/* ================================================================= SCR-30 Export Panel */

async function downloadVia(page: Page, click: () => Promise<void>): Promise<Download> {
  const event = page.waitForEvent('download');
  await click();
  return event;
}

test.describe('E06 SCR-30 Export Panel', () => {
  test('E06 · SCR-30 .json without "Gồm độ tin cậy từng đối tượng" has no "confidence"; "Tải lại" downloads it again; a reload empties "Tệp đã xuất"', async ({ browser }, testInfo) => {
    await withAdmin(browser, async (admin) => {
      const { page } = admin;
      const project = await qcProject(admin, 'export-json');
      await openExport(page, project.id);
      await selectFormat(page, '.json');
      await expandOptions(page);
      const confidence = page.getByRole('checkbox', { name: EP.confidence, exact: true });
      await expect(confidence).toBeChecked(); // UEP:236 default true
      await setBox(confidence, false);

      const exportButton = page.getByRole('button', { name: EP.exportButton, exact: true });
      const plain = await downloadVia(page, () => exportButton.click());
      const plainName = plain.suggestedFilename();
      // EPG:883-885 `<slug>_<GLB stamp>.json`.
      expect(plainName).toMatch(new RegExp(`^${escapeRegExp(fileSlug(project.name))}_${EP.stamp}\\.json$`, 'u'));
      const plainPath = testInfo.outputPath(`plain-${plainName}`);
      await plain.saveAs(plainPath);
      const plainText = readFileSync(plainPath, 'utf8');
      const plainJson = asRecord(JSON.parse(plainText), 'exported json');
      expect(Array.isArray(plainJson.walls) && plainJson.walls.length > 0, 'walls exported').toBe(true);
      expect(plainText.includes('"confidence"'), 'no confidence key (EPG:404-412,425-436)').toBe(false);

      const history = page.getByRole('region', { name: EP.history, exact: true });
      await expect(history).toContainText(plainName);
      await expect(history.getByText(EP.historyCaption, { exact: true })).toBeVisible(); // EPV:128-130 canPersistHistory false
      await captureEvidence(page, 'E06_export_json_no_confidence.png');

      const again = await downloadVia(page, () => history.getByRole('button', { name: EP.redownload, exact: true }).first().click()); // UEP:690-699
      expect(again.suggestedFilename()).toBe(plainName);

      await setBox(confidence, true);
      const full = await downloadVia(page, () => exportButton.click());
      const fullPath = testInfo.outputPath(`full-${full.suggestedFilename()}`);
      await full.saveAs(fullPath);
      expect(readFileSync(fullPath, 'utf8').includes('"confidence"'), 'confidence kept when checked').toBe(true);

      await openExport(page, project.id); // a new document: the gateway (and its session history) is new
      await expect(page.getByRole('region', { name: EP.history, exact: true })).toHaveCount(0); // EPV:117-119 no files → null
      await captureEvidence(page, 'E06_export_history_after_reload.png');
      await attachJson('E06_export_json_no_confidence.json', {
        withoutConfidence: plainName,
        redownloaded: again.suggestedFilename(),
        withConfidence: full.suggestedFilename(),
      });
    });
  });

  test('E06 · SCR-30 .glb with every floor unchecked in "Phạm vi" → "Chưa chọn tầng nào để xuất."; "Xuất" does nothing', async ({ browser }) => {
    await withAdmin(browser, async (admin) => {
      const { page, api } = admin;
      const project = await qcProject(admin, 'export-nofloor');
      await openExport(page, project.id);
      await selectFormat(page, '.glb');
      const floorBox = page.getByRole('region', { name: EP.scope, exact: true }).getByRole('checkbox', { name: firstFloor(project).name, exact: true });
      await setBox(floorBox, false);
      await expect(page.getByRole('region', { name: EP.preflight, exact: true })).toContainText(EP.noFloor); // EPG:310-313

      let downloads = 0;
      page.on('download', () => {
        downloads += 1;
      });
      const mark = api.length;
      await page.getByRole('button', { name: EP.exportButton, exact: true }).click(); // UEP:672-674 returns early
      await quiet(page);
      expect(downloads, 'no download without a floor').toBe(0);
      await expect(page.getByRole('progressbar')).toHaveCount(0); // EPT:31-58 no run
      expect(writesSince(api, mark)).toEqual([]);
      await captureEvidence(page, 'E06_export_glb_no_floor.png', { caption: `downloads after "Xuất": ${String(downloads)}` });
      await attachJson('E06_export_glb_no_floor.json', { downloads, writes: writesSince(api, mark) });
    });
  });

  test('E06 · SCR-30 .glb export downloads <slug>_T<n>_<timestamp>.glb and lists it under "Tệp đã xuất"', async ({ browser }, testInfo) => {
    await withAdmin(browser, async (admin) => {
      const { page } = admin;
      const project = await qcProject(admin, 'export-glb');
      await openExport(page, project.id);
      await selectFormat(page, '.glb');
      const glb = await downloadVia(page, () => page.getByRole('button', { name: EP.exportButton, exact: true }).click());
      const name = glb.suggestedFilename();
      // GLB:140-145,153-161 `<slug>_T<order>_<stamp>.glb`.
      expect(name).toMatch(new RegExp(`^${escapeRegExp(fileSlug(project.name))}_T\\d+(-T\\d+)?_${EP.stamp}\\.glb$`, 'u'));
      const path = testInfo.outputPath(name);
      await glb.saveAs(path);
      expect(readFileSync(path).subarray(0, 4).toString('latin1'), 'binary glTF magic').toBe('glTF');
      const history = page.getByRole('region', { name: EP.history, exact: true });
      await expect(history).toContainText(name);
      await expect(page.getByRole('progressbar')).toHaveCount(0); // EPT:31 progress gone after the run
      await captureEvidence(page, 'E06_export_glb_done.png');
      await attachJson('E06_export_glb_done.json', { fileName: name });
    });
  });

  test('E06 · SCR-30 .png / .pdf cannot be delivered: blocked captions, notices, no "Xuất"; their options; Space on ".json" brings "Xuất" back; no "Chia sẻ"', async ({ browser }) => {
    await withAdmin(browser, async (admin) => {
      const { page } = admin;
      const project = await qcProject(admin, 'export-blocked');
      await openExport(page, project.id);
      await expect(page.getByRole('button', { name: EP.share, exact: true })).toHaveCount(0); // EPV:249, UEP:719
      await expandOptions(page);

      const png = await selectFormat(page, '.png');
      await expect(png).toContainText(EP.imageBlocked); // EPF:47-57,124
      await expect(page.getByText(EP.imageNotice, { exact: true })).toBeVisible(); // UEP:588-590, EPV:256
      await expect(page.getByRole('button', { name: EP.exportButton, exact: true })).toHaveCount(0); // EPT:64
      await expect(page.getByText(EP.imageView)).toBeVisible(); // EPO:175-185
      await expect(page.getByText(EP.imageWidth)).toBeVisible();
      await captureEvidence(page, 'E06_export_png_blocked.png');

      const pdf = await selectFormat(page, '.pdf');
      await expect(pdf).toContainText(EP.pageCount); // UEP:515
      await expect(page.getByText(EP.pdfNotice, { exact: true })).toBeVisible(); // UEP:584-586
      for (const label of EP.pdfOptions) await expect(page.getByRole('checkbox', { name: label, exact: true })).toBeVisible();
      await expect(page.getByRole('button', { name: EP.exportButton, exact: true })).toHaveCount(0);
      await captureEvidence(page, 'E06_export_pdf_options.png');

      const json = formatRadio(page, '.json');
      await json.focus();
      await page.keyboard.press('Space'); // EPF:87-93 a <button role=radio>: Space clicks it
      await expect(json).toHaveAttribute('aria-checked', 'true');
      await expect(page.getByRole('button', { name: EP.exportButton, exact: true })).toBeVisible();
      await expect(page.getByText(EP.pdfNotice, { exact: true })).toHaveCount(0);
      await captureEvidence(page, 'E06_export_keyboard_json.png');
    });
  });

  test('E06 · SCR-30 preflight on an unreviewed floor: "Còn 1 tầng chưa duyệt: …" → "Sửa" opens the floors; "Còn N đối tượng chưa duyệt." → that floor\'s objects; scope badge "Chưa duyệt"', async ({ browser }) => {
    await withAdmin(browser, async (admin) => {
      const { page } = admin;
      const project = await qcProject(admin, 'export-preflight');
      const floor = firstFloor(project);
      await openExport(page, project.id);
      const scope = page.getByRole('region', { name: EP.scope, exact: true });
      await expect(scope.getByText(EP.notApprovedBadge, { exact: true })).toBeVisible(); // EPO:82-84 AI layer not reviewed
      await expect(scope.getByText(EP.notApprovedCaption, { exact: true })).toBeVisible();
      const preflight = page.getByRole('region', { name: EP.preflight, exact: true });
      const approval = preflight.getByRole('listitem').filter({ hasText: EP.unapproved(floor.name) });
      const unreviewed = preflight.getByRole('listitem').filter({ hasText: EP.unreviewed });
      await expect(approval).toBeVisible();
      await expect(unreviewed).toBeVisible();
      const rows = await preflight.getByRole('listitem').allInnerTexts();
      await captureEvidence(page, 'E06_export_preflight.png');

      await approval.getByRole('link', { name: EP.fix }).click(); // EPP:43-63 → UEP:702-711 → navigate
      await expect.poll(() => pathOf(page)).toBe(ROUTES.project.floors(project.id)); // EPG:319
      await openExport(page, project.id);
      await page
        .getByRole('region', { name: EP.preflight, exact: true })
        .getByRole('listitem')
        .filter({ hasText: EP.unreviewed })
        .getByRole('link', { name: EP.fix })
        .click();
      await expect.poll(() => pathOf(page)).toBe(ROUTES.project.objects(project.id, floor.id)); // EPG:338-341
      // BUG-469: the shot shows the destination screen, not its lazy-route skeleton ("Đang tải màn hình...").
      await expect(page.getByRole('region', { name: 'Lớp đối tượng', exact: true })).toBeVisible();
      await dismissTour(page, { waitMs: TOUR_APPEAR_TIMEOUT_MS });
      await captureEvidence(page, 'E06_export_preflight_to_objects.png');
      await attachJson('E06_export_preflight.json', { rows, objectsPath: pathOf(page) });
    });
  });
});

/* ================================================================= SCR-31 Spatial JSON Viewer */

test.describe('E06 SCR-31 Spatial JSON Viewer', () => {
  test('E06 · SCR-31 floor without a layer → "Chưa có dữ liệu không gian", no validity line, counts all 0; copy is inert, no "Tải xuống .json"', async ({ browser }) => {
    await withAdmin(browser, async (admin) => {
      const { page, api } = admin;
      const project = await bareProject(admin, 'data-empty');
      await openData(page, project.id);
      // USJ:161-167 entityCount 0 → 'empty'; SJV:201-208.
      await expect(page.getByText(SJ.emptyTitle, { exact: true })).toBeVisible();
      await expect(page.getByText(SJ.emptyDescription, { exact: true })).toBeVisible();
      await expect(page.getByText(SJ.validity)).toHaveCount(0); // SJV:164 no validity line when empty
      await expect(page.getByText(SJ.emptyCounts, { exact: true })).toBeVisible(); // SJM:238-250
      await expect(page.getByRole('button', { name: SJ.download, exact: true })).toHaveCount(0); // SJV:234, SJC:229
      const mark = api.length;
      await page.getByRole('button', { name: SJ.copy, exact: true }).click(); // USJ:258-264 no onCopy → no-op
      await quiet(page);
      expect(writesSince(api, mark)).toEqual([]);
      await expect(page.getByText(SJ.emptyTitle, { exact: true })).toBeVisible();
      await captureEvidence(page, 'E06_data_empty.png');
    });
  });

  test('E06 · SCR-31 search a seeded room → "1 / N", its row shown; "Kết quả sau" selects it; no match → "0 / 0" and stepping does nothing', async ({ browser }) => {
    await withAdmin(browser, async (admin) => {
      const { page } = admin;
      const project = await qcProject(admin, 'data-search');
      await openData(page, project.id);
      const tree = page.getByRole('tree', { name: SJ.tree, exact: true });
      await expect(tree.getByRole('treeitem').first()).toBeVisible();
      const validity = (await page.getByText(SJ.validity).innerText()).trim(); // SJV:165-168
      const counts = (await page.getByText(/^\d+ tầng · /u).innerText()).trim(); // SJV:232

      const search = page.getByRole('textbox', { name: SJ.search, exact: true });
      await search.fill(SJ.room);
      const label = page.getByText(/^\d[\d.]* \/ [\d.]+$/u); // USJ:176-187, SJV:114-118
      await expect(label).toHaveText(/^1 \/ [1-9][\d.]*$/u);
      // USJ:128-142 matches open their ancestors; SJT:74 a match row is flashed.
      const match = tree.getByRole('treeitem').filter({ hasText: new RegExp(escapeRegExp(SJ.room), 'iu') }).first();
      await expect(match).toBeVisible();
      await page.getByRole('button', { name: SJ.next, exact: true }).click(); // USJ:217-238 selects the next match
      const selected = tree.getByRole('treeitem', { selected: true });
      await expect(selected).toHaveCount(1);
      await expect(selected).toContainText(new RegExp(escapeRegExp(SJ.room), 'iu'));
      await captureEvidence(page, 'E06_data_search_match.png');

      await search.fill('qa-khong-co-khoa-nay');
      await expect(label).toHaveText('0 / 0'); // USJ:182-184
      await page.getByRole('button', { name: SJ.previous, exact: true }).click();
      await page.getByRole('button', { name: SJ.next, exact: true }).click();
      await expect(label).toHaveText('0 / 0');
      await captureEvidence(page, 'E06_data_search_no_match.png');
      await attachJson('E06_data_search.json', { validity, counts, query: SJ.room });
    });
  });

  test('E06 · SCR-31 tree keyboard: ArrowRight opens "walls", ArrowLeft closes, Enter selects walls[0]; "Xem trước" shows "Mã đối tượng" (none selected → "Chọn một nút…")', async ({ browser }) => {
    await withAdmin(browser, async (admin) => {
      const { page } = admin;
      const project = await qcProject(admin, 'data-keys');
      await openData(page, project.id);
      const tabs = page.getByRole('tablist', { name: SJ.tabs, exact: true });
      const previewTab = tabs.getByRole('tab', { name: 'Xem trước', exact: true }); // SJD:40-43
      await previewTab.click();
      await expect(previewTab).toHaveAttribute('aria-selected', 'true');
      await expect(page.getByText(SJ.noSelection, { exact: true })).toBeVisible(); // SJD:75-84
      await captureEvidence(page, 'E06_data_preview_none.png');

      const tree = page.getByRole('tree', { name: SJ.tree, exact: true });
      // SJM:149-158 top-level keys at depth 0 → aria-level 1 (SJT:68).
      const walls = tree.locator('[role="treeitem"][aria-level="1"]').filter({ has: page.locator('code', { hasText: /^walls$/u }) });
      await expect(walls).toHaveAttribute('aria-expanded', 'false');
      await walls.focus();
      await page.keyboard.press('ArrowRight'); // SJT:91-95
      await expect(walls).toHaveAttribute('aria-expanded', 'true');
      await page.keyboard.press('ArrowLeft'); // SJT:97-100
      await expect(walls).toHaveAttribute('aria-expanded', 'false');
      await page.keyboard.press('ArrowRight');
      // SJM:97-99 walls[0] is the row right after "walls" (its label "0"; a scalar "…: 0" elsewhere must not match).
      const firstWall = walls.locator('xpath=following-sibling::*[@role="treeitem"][1]');
      await expect(firstWall).toHaveAttribute('aria-level', '2');
      await firstWall.focus();
      await page.keyboard.press('Enter'); // SJT:81-85
      await expect(firstWall).toHaveAttribute('aria-selected', 'true');
      await expect(page.getByText(SJ.entityCode, { exact: true })).toBeVisible(); // SJD:108-115 entity (SJM:74-80 `id`)
      await expect(page.getByText(SJ.entityNote)).toBeVisible(); // SJD:118-123
      await captureEvidence(page, 'E06_data_keyboard_preview.png');
    });
  });

  test('E06 · SCR-31 "Thô" pins the JSON tab ("Xem trước" does not take); back on "Cây" it does', async ({ browser }) => {
    await withAdmin(browser, async (admin) => {
      const { page } = admin;
      const project = await qcProject(admin, 'data-raw');
      await openData(page, project.id);
      const modes = page.getByRole('radiogroup', { name: SJ.viewMode, exact: true }); // SJV:148-153
      const tabs = page.getByRole('tablist', { name: SJ.tabs, exact: true });
      const jsonTab = tabs.getByRole('tab', { name: 'JSON', exact: true });
      const previewTab = tabs.getByRole('tab', { name: 'Xem trước', exact: true });
      // BUG-469: select walls[0] first, so the final shot proves the NODE preview, not the empty "Chọn một nút…".
      const walls = page
        .getByRole('tree', { name: SJ.tree, exact: true })
        .locator('[role="treeitem"][aria-level="1"]')
        .filter({ has: page.locator('code', { hasText: /^walls$/u }) });
      await walls.focus();
      await page.keyboard.press('ArrowRight'); // SJT:91-95
      const firstWall = walls.locator('xpath=following-sibling::*[@role="treeitem"][1]');
      await expect(firstWall).toHaveAttribute('aria-level', '2');
      await firstWall.focus();
      await page.keyboard.press('Enter'); // SJT:81-85
      await expect(firstWall).toHaveAttribute('aria-selected', 'true');
      await modes.getByRole('radio', { name: 'Thô', exact: true }).click();
      await previewTab.click();
      // SJV:222 activeTabId = raw ? 'json' : model.activeTabId.
      await expect(jsonTab).toHaveAttribute('aria-selected', 'true');
      await expect(previewTab).toHaveAttribute('aria-selected', 'false');
      await captureEvidence(page, 'E06_data_raw_locks_json.png');
      const tree = modes.getByRole('radio', { name: 'Cây', exact: true });
      await tree.click();
      await expect(tree).toHaveAttribute('aria-checked', 'true');
      await expect(previewTab).toHaveAttribute('aria-selected', 'true'); // the click above was kept in activeTabId
      await expect(page.getByText(SJ.entityCode, { exact: true })).toBeVisible(); // SJD:108-115 walls[0] preview
      await captureEvidence(page, 'E06_data_tree_preview.png');
    });
  });

  test('E06 · SCR-31 narrow window (768 px, < 1024) → no detail pane, the tree fills the width; 375 px keeps search and tree', async ({ browser }) => {
    await withAdmin(
      browser,
      async (admin) => {
        const { page } = admin;
        const project = await qcProject(admin, 'data-narrow');
        await openData(page, project.id);
        await expect(page.getByRole('tree', { name: SJ.tree, exact: true })).toBeVisible();
        await expect(page.getByRole('tablist', { name: SJ.tabs, exact: true })).toHaveCount(0); // SJV:220-227
        await captureEvidence(page, 'E06_data_narrow_768.png');
        await page.setViewportSize(PHONE);
        await expect(page.getByRole('tree', { name: SJ.tree, exact: true })).toBeVisible();
        await expect(page.getByRole('textbox', { name: SJ.search, exact: true })).toBeInViewport();
        await expect(page.getByRole('tablist', { name: SJ.tabs, exact: true })).toHaveCount(0);
        const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
        await captureEvidence(page, 'E06_data_narrow_375.png', { caption: `horizontal overflow ${String(overflow)} px` });
        await attachJson('E06_data_narrow.json', { horizontalOverflowPx: overflow });
      },
      NARROW,
    );
  });
});

/* ================================================================= SCR-32 Version History */

test.describe('E06 SCR-32 Version History', () => {
  test('E06 · SCR-32 floor without versions → "Tầng 1 chưa có phiên bản nào" + "Phiên bản được lưu khi AI…"; "Tầng" select still there', async ({ browser }) => {
    await withAdmin(browser, async (admin) => {
      const { page } = admin;
      const project = await bareProject(admin, 'versions-empty');
      const floor = firstFloor(project);
      await openVersions(page, project.id, floor.id);
      await expect(page.getByText(VH.emptyTitle(floor.name), { exact: true })).toBeVisible(); // UVH:489,603, VHV:67-74
      await expect(page.getByText(VH.emptyDescription, { exact: true })).toBeVisible();
      await expect(page.getByRole('combobox', { name: VH.floorSelect, exact: true })).toContainText(floor.name); // VHV:42-55
      await expect(page.getByRole('button', { name: VH.restore, exact: true })).toHaveCount(0);
      await captureEvidence(page, 'E06_versions_empty.png');
    });
  });

  test('E06 · SCR-32 ?floorId= opens the second floor and keeps it on reload; "Tầng" switches back to the first', async ({ browser }) => {
    await withAdmin(browser, async (admin) => {
      const { page, api } = admin;
      const project = await bareProject(admin, 'versions-deeplink', ['Tầng 1', 'Tầng 2']);
      const [first, second] = project.floors;
      if (first === undefined || second === undefined) throw new Error('two floors expected');
      await openVersions(page, project.id, second.id, `?floorId=${encodeURIComponent(second.id)}`); // VHC:206
      const floorSelect = page.getByRole('combobox', { name: VH.floorSelect, exact: true });
      await expect(floorSelect).toContainText(second.name);
      await expect(page.getByText(VH.emptyTitle(second.name), { exact: true })).toBeVisible();
      await captureEvidence(page, 'E06_versions_deeplink.png');

      const reloaded = page.waitForResponse(
        (r) => versionsRe(project.id).test(new URL(r.url()).pathname) && new URL(r.url()).searchParams.get('floorId') === second.id,
      );
      await page.reload();
      await reloaded;
      await expect(floorSelect).toContainText(second.name);

      await floorSelect.click();
      await page.getByRole('option', { name: first.name, exact: true }).click(); // VHC:206 picked first
      await expect(page.getByText(VH.emptyTitle(first.name), { exact: true })).toBeVisible();
      await captureEvidence(page, 'E06_versions_floor_switched.png');
      const listedFloors = api
        .filter((entry) => entry.method === 'GET' && versionsRe(project.id).test(entry.path))
        .map((entry) => new URLSearchParams(entry.search).get('floorId'));
      expect(listedFloors).toContain(first.id);
      await attachJson('E06_versions_deeplink.json', { query: `?floorId=${second.id}`, n17FloorIds: listedFloors });
    });
  });

  test('E06 · SCR-32 narrow window (768 px) → version Select "phiên bản" replaces the list', async ({ browser }) => {
    await withAdmin(
      browser,
      async (admin) => {
        const { page } = admin;
        const project = await bareProject(admin, 'versions-narrow');
        const floor = firstFloor(project);
        await openVersions(page, project.id, floor.id);
        // UVH:490 isNarrow → 'collapsed' (before the empty check); VHV:116-124 Select instead of VersionList.
        await expect(page.getByRole('combobox', { name: VH.narrowSelect, exact: true })).toBeVisible();
        await expect(versionList(page)).toHaveCount(0);
        await expect(page.getByText(VH.restoreCaption, { exact: true })).toBeVisible(); // VHV:148
        await captureEvidence(page, 'E06_versions_narrow.png');
      },
      NARROW,
    );
  });

  test('E06 · SCR-32 diff tabs at the Tailwind sm edge: 639 px → "Thay đổi" / "JSON" / "Trực quan" 44 px tall, 640 px → 36 px', async ({ browser }) => {
    test.setTimeout(PIPELINE_TEST_TIMEOUT_MS);
    await withAdmin(
      browser,
      async (admin) => {
        const { page } = admin;
        const { project, versions } = await pipelineProject(admin, 'versions-tabs-sm');
        const floor = firstFloor(project);
        await openVersions(page, project.id, floor.id);
        // VHC:67 (width < 1024px) → narrow at both widths: the "phiên bản" Select, compare below (VHV:116-141).
        await expect(page.getByRole('combobox', { name: VH.narrowSelect, exact: true })).toBeVisible();
        await expect(page.getByRole('tablist', { name: DIFF_TABS.list, exact: true }).getByRole('tab')).toHaveCount(3); // VHX:207
        await expect(diffTab(page, DIFF_TABS.changes)).toHaveAttribute('aria-selected', 'true');
        const below = DIFF_TABS.heightBelowSm;
        await expect.poll(() => diffTabHeights(page), { message: 'TABS:134 h-11 below sm' }).toEqual([below, below, below]);
        const at639 = await diffTabHeights(page);
        await captureEvidence(page, 'E06_versions_tabs_639.png');

        await page.setViewportSize(AT_SM);
        const from = DIFF_TABS.heightFromSm;
        await expect.poll(() => diffTabHeights(page), { message: 'TABS:134 sm:h-9 from 640 px' }).toEqual([from, from, from]);
        await expect(diffTab(page, DIFF_TABS.changes)).toHaveAttribute('aria-selected', 'true'); // resize keeps the tab
        await captureEvidence(page, 'E06_versions_tabs_640.png');
        await attachJson('E06_versions_tabs_sm.json', {
          versions: versions.map((v) => v.label),
          heightsAt639: at639,
          heightsAt640: await diffTabHeights(page),
        });
      },
      BELOW_SM,
    );
  });

  test('E06 · SCR-32 diff tabs by keyboard (375 px): roving tabindex; ArrowLeft wraps to "Trực quan", Home / End, ArrowRight wraps back; Tab enters the active panel; no request', async ({ browser }) => {
    test.setTimeout(PIPELINE_TEST_TIMEOUT_MS);
    await withAdmin(
      browser,
      async (admin) => {
        const { page, api } = admin;
        const { project } = await pipelineProject(admin, 'versions-tabs-keys');
        const floor = firstFloor(project);
        await openVersions(page, project.id, floor.id);
        const changes = diffTab(page, DIFF_TABS.changes);
        const json = diffTab(page, DIFF_TABS.json);
        const visual = diffTab(page, DIFF_TABS.visual);
        const panel = (label: string): Locator => page.getByRole('tabpanel', { name: label, exact: true }); // VHX:229-235
        await expect(changes).toHaveAttribute('aria-selected', 'true');
        // TABS:129 roving tabindex: only the active tab is in the Tab order.
        await expect(changes).toHaveAttribute('tabindex', '0');
        await expect(json).toHaveAttribute('tabindex', '-1');
        await expect(visual).toHaveAttribute('tabindex', '-1');
        const mark = api.length;

        await changes.focus();
        await page.keyboard.press('ArrowLeft'); // TABS:105 (index - 1 + n) % n → last
        await expect(visual).toHaveAttribute('aria-selected', 'true');
        await expect(visual).toBeFocused(); // TABS:114-115
        await expect(panel(DIFF_TABS.visual)).toBeVisible();
        await expect(panel(DIFF_TABS.changes)).toBeHidden(); // VHX:235 hidden when not active
        await captureEvidence(page, 'E06_versions_tabs_wrap_left.png');

        await page.keyboard.press('Home'); // TABS:106
        await expect(changes).toHaveAttribute('aria-selected', 'true');
        await expect(changes).toBeFocused();
        await page.keyboard.press('End'); // TABS:107
        await expect(visual).toHaveAttribute('aria-selected', 'true');
        await expect(visual).toBeFocused();
        await page.keyboard.press('ArrowRight'); // TABS:104 (index + 1) % n → first
        await expect(changes).toHaveAttribute('aria-selected', 'true');
        await expect(changes).toBeFocused();
        await expect(panel(DIFF_TABS.changes)).toBeVisible();

        await page.keyboard.press('Tab'); // inactive tabs are -1 (TABS:129); the visible panel is tabIndex 0 (VHX:234)
        await expect(panel(DIFF_TABS.changes)).toBeFocused();
        await changes.scrollIntoViewIfNeeded(); // focus scrolled the panel; bring the tabs + panel ring into the shot
        await captureEvidence(page, 'E06_versions_tabs_tab_into_panel.png');

        await quiet(page);
        const writes = writesSince(api, mark);
        expect(writes, 'switching diff tabs is local (UVH:504 setTab: setActiveTab)').toEqual([]);
        await attachJson('E06_versions_tabs_keyboard.json', {
          keys: ['ArrowLeft', 'Home', 'End', 'ArrowRight', 'Tab'],
          selectedAfter: ['Trực quan', 'Thay đổi', 'Trực quan', 'Thay đổi'],
          focusedAfterTab: 'tabpanel "Thay đổi"',
          writesSinceFirstKey: writes,
        });
      },
      PHONE,
    );
  });

  test('E06 · SCR-32 [mocked response] GET versions 500 → "Không tải được lịch sử phiên bản" + "Máy chủ chưa trả được…"; "Tầng" kept', async ({ browser }) => {
    await withAdmin(browser, async (admin) => {
      const { page } = admin;
      const project = await bareProject(admin, 'versions-500');
      const counter = { served: 0 };
      const handler = failGet(versionsRe(project.id), counter);
      await page.route('**/api/projects/**', handler);
      await openProjectRoute(page, ROUTES.project.versions(project.id), project.id);
      // UVH:480-487 not forbidden → 'error'; VHV:87-100 InlineAlert inside withFloorSelect.
      await expect(page.getByText(VH.listErrorTitle, { exact: true })).toBeVisible({ timeout: ERROR_PAINT_TIMEOUT_MS });
      await expect(page.getByText(VH.listErrorReason, { exact: true })).toBeVisible();
      await expect(page.getByRole('combobox', { name: VH.floorSelect, exact: true })).toBeVisible();
      await captureEvidence(page, 'E06_versions_500.png');
      await page.unroute('**/api/projects/**', handler);
      await attachJson('E06_versions_500.json', { mockedListResponses: counter.served, status: 500 });
    });
  });

  test('E06 · SCR-32 pipeline floor: newest version is "Hiện tại" → no "Phục hồi phiên bản này"; unticking it → "Chưa chọn đủ hai phiên bản để so sánh", restore disabled, no label button', async ({ browser }) => {
    test.setTimeout(PIPELINE_TEST_TIMEOUT_MS);
    await withAdmin(browser, async (admin) => {
      const { page } = admin;
      const { project, versions } = await pipelineProject(admin, 'versions-pair');
      const floor = firstFloor(project);
      const [newest, older] = versions;
      if (newest === undefined || older === undefined) throw new Error('two versions expected');
      await openVersions(page, project.id, floor.id);
      await expect(versionRow(page, newest.label)).toContainText(VH.current); // VHM:216 floorRevision = current
      const checked = versionList(page).getByRole('checkbox', { checked: true });
      await expect(checked).toHaveCount(2); // VHP:85-96 default pair = two newest full versions
      await expect(page.getByRole('button', { name: VH.restore, exact: true })).toHaveCount(0); // VHV:176 right is current
      await expect(page.getByRole('button', { name: VH.tag, exact: true })).toBeVisible();
      // BUG-469: the action bar sits under the diff; bring it into the shot (only "Gắn nhãn…", no "Phục hồi…").
      await page.getByRole('button', { name: VH.tag, exact: true }).scrollIntoViewIfNeeded();
      await captureEvidence(page, 'E06_versions_current_no_restore.png', {
        caption: `${newest.label} "${VH.current}"; "${VH.restore}": 0`,
      });

      await setBox(versionRow(page, newest.label).getByRole('checkbox'), false); // VHP:120-135
      await expect(checked).toHaveCount(1);
      await expect(page.getByText(VH.noPair, { exact: true })).toBeVisible(); // VHP:51-62, VHX:173-178
      await expect(page.getByRole('button', { name: VH.restore, exact: true })).toBeDisabled(); // VHV:176-188
      await expect(page.getByRole('button', { name: VH.tag, exact: true })).toHaveCount(0); // VHV:171
      await captureEvidence(page, 'E06_versions_single_pick.png');
      await setBox(versionRow(page, newest.label).getByRole('checkbox'), true);
      await expect(checked).toHaveCount(2);
      await attachJson('E06_versions_pair.json', { versions: versions.map((v) => v.label) });
    });
  });

  test('E06 · SCR-32 label dialog: 60-character cap; "Huỷ" and Esc send nothing; Enter tags → toast "Đã gắn nhãn" whose "Hoàn tác" clears the label', async ({ browser }) => {
    test.setTimeout(PIPELINE_TEST_TIMEOUT_MS);
    await withAdmin(browser, async (admin) => {
      const { page, api } = admin;
      const { project, versions } = await pipelineProject(admin, 'versions-label');
      const floor = firstFloor(project);
      const newest = versions[0];
      if (newest === undefined) throw new Error('a version expected');
      await openVersions(page, project.id, floor.id);
      await expect(versionList(page).getByRole('checkbox', { checked: true })).toHaveCount(2);
      const tagButton = page.getByRole('button', { name: VH.tag, exact: true });
      const dialog = page.getByRole('dialog').filter({ hasText: VH.labelDialog(newest.label) }); // VHD:37 right = newest
      const mark = api.length;

      await tagButton.click();
      await expect(dialog).toBeVisible();
      await expect(dialog.getByText(VH.labelHint, { exact: true })).toBeVisible();
      const field = dialog.getByRole('textbox', { name: VH.labelField, exact: true });
      await field.pressSequentially('x'.repeat(VH.labelMax + 10));
      expect((await field.inputValue()).length, 'maxLength (VHD:14,44)').toBe(VH.labelMax);
      // BUG-469: the tag button click scrolled the list away; the row being labelled goes back into the shot.
      await versionRow(page, newest.label).scrollIntoViewIfNeeded();
      await captureEvidence(page, 'E06_versions_label_max.png', {
        caption: `"${VH.labelField}": ${String(VH.labelMax + 10)} typed, ${String(VH.labelMax)} kept`,
      });
      await dialog.getByRole('button', { name: VH.labelCancel, exact: true }).click(); // VHD:48-50
      await expect(dialog).toHaveCount(0);
      await tagButton.click();
      await expect(dialog).toBeVisible();
      await page.keyboard.press('Escape'); // Modal onClose (VHD:35)
      await expect(dialog).toHaveCount(0);
      expect(writesSince(api, mark), 'cancelled dialogs send nothing').toEqual([]);

      const label = `${TEST_DATA_PREFIX}nhan`;
      await tagButton.click();
      await dialog.getByRole('textbox', { name: VH.labelField, exact: true }).fill(label);
      const tagged = waitForApi(page, 'PATCH', labelRe(project.id), [200]);
      await page.keyboard.press('Enter'); // VHD:27-32 form submit
      const taggedSent = asRecord((await tagged).response.request().postDataJSON(), 'PATCH label');
      expect(taggedSent.label).toBe(label);
      await expect(versionRow(page, newest.label)).toContainText(label); // VHL:95
      const labeledToast = toast(page, VH.labeledToast);
      await expect(labeledToast).toBeVisible(); // UVH:454-470
      await versionRow(page, newest.label).scrollIntoViewIfNeeded(); // BUG-469: row + its new label in the shot
      await captureEvidence(page, 'E06_versions_labeled_toast.png');

      const cleared = waitForApi(page, 'PATCH', labelRe(project.id), [200]);
      await labeledToast.getByRole('button', { name: TOAST_UNDO, exact: true }).click(); // UVH:464-468 → sendLabel(previous '')
      const clearedSent = asRecord((await cleared).response.request().postDataJSON(), 'PATCH label (undo)');
      expect(clearedSent.label, 'undo sends the previous (empty) label').toBe('');
      await expect(versionRow(page, newest.label)).not.toContainText(label);
      await versionRow(page, newest.label).scrollIntoViewIfNeeded(); // BUG-469: the row, label gone
      await captureEvidence(page, 'E06_versions_label_undone.png');
      await attachJson('E06_versions_label.json', { tagged: taggedSent, undo: clearedSent });
    });
  });

  test('E06 · SCR-32 restore on an own floor: "Để nguyên" and Esc send nothing; "Phục hồi" → POST 201 + toast "Đã phục hồi phiên bản vN…"; its "Hoàn tác" → "Đã hoàn tác lượt phục hồi"', async ({ browser }) => {
    test.setTimeout(PIPELINE_TEST_TIMEOUT_MS);
    await withAdmin(browser, async (admin) => {
      const { page, api } = admin;
      const { project, versions } = await pipelineProject(admin, 'versions-restore');
      const floor = firstFloor(project);
      const target = versions[0];
      if (target === undefined) throw new Error('a version expected');
      // CP-6 on our own floor: one layer write moves floorRevision on, so the AI version is no longer "Hiện tại".
      await writeLayer(admin.fx, project.id, floor.id, qcLayer);
      await openVersions(page, project.id, floor.id);
      await expect(versionRow(page, target.label)).not.toContainText(VH.current);
      await expect(page.getByText(VH.restoreCaption, { exact: true })).toBeVisible(); // VHV:148
      const restoreButton = page.getByRole('button', { name: VH.restore, exact: true });
      const dialog = page.getByRole('dialog').filter({ hasText: VH.restoreTitle(target.label, floor.name) }); // VHM:532-544
      const mark = api.length;

      await restoreButton.click();
      await expect(dialog).toBeVisible();
      await expect(dialog).toContainText(`${VH.restoreCaption}. ${VH.undoCleared}`); // VHM:540
      await captureEvidence(page, 'E06_versions_restore_dialog.png');
      await dialog.getByRole('button', { name: VH.restoreCancel, exact: true }).click(); // UVH:522-530
      await expect(dialog).toHaveCount(0);
      await restoreButton.click();
      await expect(dialog).toBeVisible();
      await page.keyboard.press('Escape'); // VHV:192 Modal onClose = cancelRestore
      await expect(dialog).toHaveCount(0);
      expect(writesSince(api, mark), '"Để nguyên" / Esc restore nothing').toEqual([]);

      await restoreButton.click();
      const restored = waitForApi(page, 'POST', restoreRe(project.id), [201]); // BE:apps/api/versions/router.py:62-82
      await dialog.getByRole('button', { name: VH.restoreConfirm, exact: true }).click();
      const { response } = await restored;
      expect(new URL(response.url()).pathname).toBe(`/api/projects/${project.id}/versions/${target.id}/restore`);
      const restoredToast = toast(page, VH.restoredToast(target.label, floor.name)); // UVH:437-445
      await expect(restoredToast).toBeVisible();
      await restoredToast.hover(); // Toast.tsx:131-132 hover pauses the 8 s undo window
      await captureEvidence(page, 'E06_versions_restored_toast.png');

      const undone = waitForApi(page, 'POST', restoreRe(project.id), [200, 201]);
      await restoredToast.getByRole('button', { name: TOAST_UNDO, exact: true }).click(); // UVH:356-406 revertRestore
      const undo = await undone;
      await expect(toast(page, VH.undoneToast)).toBeVisible(); // UVH:389-390
      await captureEvidence(page, 'E06_versions_restore_undone.png');
      await attachJson('E06_versions_restore.json', {
        restoredVersion: target.label,
        restorePath: new URL(response.url()).pathname,
        undoPath: new URL(undo.response.url()).pathname,
        undoStatus: undo.response.status(),
      });
    });
  });

  test('E06 · SCR-32 the floor changed after the page opened → restore 409 → "Tầng vừa đổi ở nơi khác" + "…đã sửa tầng này sau lúc bạn mở trang…"; "Tải lại" dismisses it', async ({ browser }) => {
    test.setTimeout(PIPELINE_TEST_TIMEOUT_MS);
    await withAdmin(browser, async (admin) => {
      const { page } = admin;
      const { project, versions } = await pipelineProject(admin, 'versions-conflict');
      const floor = firstFloor(project);
      const target = versions[0];
      if (target === undefined) throw new Error('a version expected');
      await writeLayer(admin.fx, project.id, floor.id, qcLayer); // CP-6: target restorable
      await openVersions(page, project.id, floor.id);
      await expect(page.getByRole('button', { name: VH.restore, exact: true })).toBeEnabled();
      // Another writer after the page read the floor revision (UVH:418 base = floorMeta revision).
      await writeLayer(admin.fx, project.id, floor.id, qcLayer);

      await page.getByRole('button', { name: VH.restore, exact: true }).click();
      const rejected = waitForApi(page, 'POST', restoreRe(project.id), [409]);
      await page.getByRole('dialog').getByRole('button', { name: VH.restoreConfirm, exact: true }).click();
      const conflict = await rejected;
      expect(asRecord(conflict.json, '409').code).toBe('VERSION_CONFLICT'); // VHG:118-131
      const banner = page.getByText(VH.conflictTitle, { exact: true }); // VHV:107-114 InlineAlert title
      await expect(banner).toBeVisible();
      await expect(page.getByText(VH.conflictMessage)).toBeVisible();
      await expect(toast(page, /^Đã phục hồi phiên bản/u)).toHaveCount(0);
      await banner.scrollIntoViewIfNeeded(); // BUG-469: the restore click scrolled to the action bar, under the diff
      await captureEvidence(page, 'E06_versions_restore_conflict.png');

      const layerReread = waitForApi(page, 'GET', new RegExp(`^/api/projects/${escapeRegExp(project.id)}/floors/${escapeRegExp(floor.id)}/spatial/layer$`, 'u'), [200]);
      await page.getByRole('button', { name: VH.conflictDismiss, exact: true }).click(); // UVH:537-545 → reloadFloor
      await layerReread;
      await expect(banner).toHaveCount(0);
      // BUG-469: two layer writes moved floorRevision past every version, so NO row is "Hiện tại" (VHM:216); the shot
      // shows the reloaded list for that claim.
      await expect(versionList(page).getByText(VH.current, { exact: true })).toHaveCount(0);
      await versionRow(page, target.label).scrollIntoViewIfNeeded();
      await captureEvidence(page, 'E06_versions_conflict_reloaded.png', {
        caption: `"${VH.conflictTitle}" gone; floor written after every version: no "${VH.current}" row`,
      });
      await attachJson('E06_versions_restore_conflict.json', { rejected: conflict.json });
    });
  });
});
