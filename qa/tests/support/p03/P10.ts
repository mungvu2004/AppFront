/**
 * QA-03d P10 helpers — SCR-13 pipeline graph and SCR-15 CAD branch confirm (`phase03_graph_cad_{edge,ui}.spec.ts`).
 * Real stack only; the route holds / fakes live in the specs. Copy is read from the FE source at c16f2428:
 *   PG  src/screens/pipeline/PipelineGraph/PipelineGraph.tsx   PGO …/PipelineGraphOverview.tsx   PGT …/pipelineGraphText.ts
 *   UPG …/usePipelineGraph.ts   PGG …/pipelineGraphGateway.ts
 *   CB  src/screens/pipeline/CadBranchConfirm/CadBranchConfirm.tsx   CBD …/CadBranchConfirmDialog.tsx
 *   UCB …/useCadBranchConfirm.ts   CBT …/cadBranchConfirmText.ts   CIO …/CadImportOptions.tsx   CLM …/CadLayerMappingPanel.tsx
 *   CLP …/CadLayerPreviewCanvas.tsx   CFA …/CadFloorAvailability.tsx   CCT …/CadBranchCompareTable.tsx
 *   PSGATE src/components/feedback/ProjectSpatialGate.tsx   MODAL src/components/overlay/Modal.tsx   I18N src/i18n/vi.json errors.*
 *
 * Sessions (parallel-safe under `--workers 4`): the phase admin signs in per flow (1 API login for the seed + 1 browser
 * login through the context's own cookie jar, P5 `openFlow`), never the stored admin session file (its refresh cookie
 * rotates). Non-admins are pool users `engineer:shared` / `viewer:shared`, only ever added to a project of this flow.
 */
import { randomInt } from 'node:crypto';

import { type APIRequestContext, type Browser, type Locator, type Page } from '@playwright/test';

import { signedInApi } from '../api';
import { readAdminCredentials } from '../auth';
import {
  addProjectMember,
  createProject,
  deleteSeededProject,
  poolUser,
  type PoolRole,
  type PoolUser,
  type SeededFloorRow,
  type SeededProject,
} from '../phase03Seed';
import { DESKTOP, closeFlow, openFlow, type Flow } from './P5';
import { closeSession, openPool, type Session } from './P6';

/* ---- copy (each cites its source) ---- */
export const GRAPH = {
  title: 'Bản vẽ được xử lý theo đường nào', // S-12 PageHead h1 (breadcrumb + diagram group keep "Sơ đồ xử lý")
  crumb: 'Sơ đồ xử lý', // breadcrumb + diagram group name (unchanged)
  lead: 'Hồ sơ này đi qua nhánh nào, và vì sao hệ thống chọn nhánh đó cho từng tầng.', // PGT leadLine
  emptyTitle: 'Chưa có lượt xử lý nào để kể lại', // PGT emptyTitle
  reasonNoReport: 'Chưa có lượt xử lý nào, nên chưa biết hồ sơ đi nhánh nào.', // PGT reasonNoReport
  forbiddenLine: 'Chế độ chi tiết kỹ thuật chỉ mở cho vai quản trị, nên phần đó và nút đổi nhánh không hiện ở đây.', // PGT
  detail: 'Chi tiết kỹ thuật', // PGT detailDisclosureLabel
  switch: 'Đổi sang nhánh ảnh quét', // PGT switchLabel
  activeBadge: 'đang dùng', // PGT activeBadge
  comparisonCaption: 'So sánh hai nhánh', // PGT
  evidenceCaption: 'Dẫn chứng theo tầng', // PGT
  retry: 'Thử lại', // PGT retryLabel
  breadcrumbProjects: 'Dự án', // PG BREADCRUMB_PROJECTS
  /** PGT PIPELINE_OVERVIEW_BLOCKS (label, caption), in order. */
  blocks: [
    ['Tệp đầu vào', 'Bản vẽ kiến trúc của hồ sơ'],
    ['Nhánh tệp CAD', 'Đường hình học đọc thẳng từ tệp'],
    ['Nhánh ảnh quét', 'Sáu bước nhận dạng chạy trên ảnh'],
    ['Dữ liệu không gian đa tầng', 'Hai nhánh hợp lại ở một tệp duy nhất'],
    ['Dựng mô hình 3D', 'Mặt bằng và khối nhà dựng từ tệp đó'],
  ] as const,
  /** PGT:9-14 technical names that the overview must never show. */
  technical: ['SegFormer', 'YOLOv8m', 'PaddleOCR', 'Zhang-Suen', 'Douglas-Peucker', 'distanceTransform', 'Spatial JSON'] as const,
} as const;

export const GATE = {
  notFoundTitle: 'Không tìm thấy dự án này', // PSGATE PROJECT_NOT_FOUND_TITLE
  notFoundSentence: 'Dự án có thể đã bị xoá, đường dẫn chưa đúng, hoặc bạn chưa được thêm vào dự án.',
  backToProjects: 'Về danh sách dự án',
} as const;

export const CAD = {
  dialog: 'Phát hiện tệp CAD', // CBT PHASE_1_DIALOG_STATES.normal.title
  description: 'Hồ sơ này có tệp bản vẽ gốc từ AutoCAD hoặc các phần mềm thiết kế khác.', // CBT (first sentence)
  useCad: 'Dùng đường từ CAD', // CBT PRIMARY_BUTTON_LABEL
  useAi: 'Tiếp tục duyệt tường', // CBT SECONDARY_BUTTON_LABEL
  dismiss: 'Huỷ', // CBT DISMISS_BUTTON_LABEL
  closeIcon: 'Đóng hộp thoại', // MODAL header IconButton
  remember: 'Ghi nhớ lựa chọn cho dự án này', // CBT REMEMBER_CHOICE_LABEL
  compareHeaderName: 'Tiêu chí so sánh', // CCT:31
  /** UCB COMPARISON_ROWS (the rendered rows; CBT COMPARISON_TABLE is dead copy). */
  compareRows: [
    ['Độ chính xác', 'Đúng theo đường nét của bản vẽ gốc', 'Suy ra từ ảnh, cần người duyệt lại'],
    ['Công việc kiểm tra', 'Gán vai trò cho từng lớp một lần', 'Soát lại tường, phòng và ô mở sau khi máy dựng'],
    ['Thời gian', 'Nhập hình học xong ngay sau khi gán lớp', 'Chờ máy chạy hết các bước xử lý'],
  ] as const,
  floorCaption: 'Các tầng có sẵn tệp CAD sẽ dùng nhánh CAD; các tầng chỉ có ảnh sẽ chạy qua nhận dạng AI.', // CBT
  floorHeaders: ['Tầng', 'Trạng thái CAD'] as const, // CBT
  hasCad: 'Có tệp CAD', // CBT CAD_STATUS_AVAILABLE
  imageOnly: 'Chỉ có ảnh', // CBT CAD_STATUS_IMAGE_ONLY
  screenRegion: 'Màn phát hiện tệp CAD', // CB SCREEN_ARIA_LABEL
  noticeRegion: 'Trạng thái của màn phát hiện tệp CAD', // CB NOTICE_REGION_ARIA_LABEL
  stageTwo: 'Ánh xạ lớp và xem trước hình học', // CB STAGE_TWO_ARIA_LABEL
  summaryStatus: 'Tóm tắt số lớp đã ánh xạ', // CB SUMMARY_ARIA_LABEL
  loading: 'Đang đọc tệp CAD', // CB LOADING_ARIA_LABEL
  emptyTitle: 'Chưa có lớp nào để ánh xạ', // CB EMPTY_TITLE
  errorTitle: 'Không thể đọc tệp CAD', // CB ERROR_TITLE
  forbiddenTitle: 'Không có quyền xử lý CAD', // CB FORBIDDEN_TITLE
  handoffTitle: 'Chuyển sang nhánh nhận dạng ảnh', // CB AI_HANDOFF_TITLE
  aiNotice: 'Nếu bạn chọn nhánh AI, sẽ cần hiệu chỉnh tỷ lệ sau khi nhập hình học.', // CBT AI_BRANCH_NOTICE
  retry: 'Đọc lại tệp', // CB RETRY_LABEL
  collapse: 'Thu gọn bảng lớp', // CB
  expand: 'Mở bảng lớp', // CB
  inspectionMissing:
    'Bản này chưa đọc được lớp của tệp CAD, nên chưa ánh xạ và nhập được hình học. Hãy chọn "Tiếp tục duyệt tường".', // UCB:112-113
  forbiddenNotice:
    'Bạn không có quyền chỉnh sửa lớp của dự án này, nên không chốt được nhánh xử lý. Liên hệ quản trị viên để được cấp quyền.', // UCB:118-119
  importUnsupported: 'Bản này chưa nhập được hình học từ tệp CAD. Hãy chọn "Tiếp tục duyệt tường".', // UCB:116
  importButton: 'Nhập hình học', // CBT IMPORT_BUTTON_LABEL
  importReasonId: 'cad-import-disabled-reason', // CB IMPORT_REASON_ID
  summaryZero: 'Đã ánh xạ 0/0 lớp · 0 đối tượng sẽ được nhập', // UCB:490-491 + CB SUMMARY_SEPARATOR
  panelTitle: 'Ánh xạ lớp từ tệp CAD', // CBT PHASE_2_PANEL_TITLE
  panelHeaders: ['Tên lớp', 'Số thực thể', 'Màu gốc', 'Vai trò'] as const, // CBT
  noData: 'Không có dữ liệu', // Table.tsx TableEmpty
  previewEmpty: 'Chưa có hình để xem trước', // cadBranchConfirmText.ts:237 PREVIEW_EMPTY_TEXT (QA-03e BUG-564)
  options: 'Tuỳ chọn nhập', // CBT ADVANCED_OPTIONS_LABEL
  unitLabel: 'Đơn vị bản vẽ', // CBT
  originLabel: 'Gốc toạ độ', // CBT
  units: ['Mi-li-mét (mm)', 'Xen-ti-mét (cm)', 'Mét (m)', 'Inch (in)'] as const, // UCB UNIT_LABELS
  origins: ['Giữ gốc toạ độ của tệp CAD', 'Đặt gốc ở giao trục A1'] as const, // UCB ORIGIN_LABELS
  detectedHint: 'Gợi ý đọc được từ tệp', // CBT DETECTED_UNIT_HINT_LABEL
  errorCodePrefix: 'Mã lỗi: ', // CB ERROR_CODE_PREFIX
} as const;

/** I18N `errors.notFound.description` (P6 `ERR` has the other kinds). */
export const NOT_FOUND_SENTENCE = 'Nội dung này có thể đã bị xoá, hoặc đường dẫn chưa đúng.';

/* ---- ids ---- */
const CROCKFORD = '0123456789ABCDEFGHJKMNPQRSTVWXYZ';

/** A well-formed ULID body (BE packages/core/ids.py `_ULID_RE`) that no row has: `01` + 24 random Crockford chars. */
export const ulid = (): string => `01${Array.from({ length: 24 }, () => CROCKFORD[randomInt(32)] ?? '0').join('')}`;
/** `prj_<ULID>` of no project: passes the BE id check, then 404 `project` from the DB read. */
export const unknownProjectId = (): string => `prj_${ulid()}`;
/** A floor id of the same prefix as `floor` that no floor has (15-A-015: never checked by SCR-15). */
export const bogusFloorId = (prefix = 'flr'): string => `${prefix}_${ulid()}`;

export const pathOf = (page: Page): string => new URL(page.url()).pathname;
export const esc = (text: string): string => text.replace(/[.*+?^${}()|[\]\\]/gu, '\\$&');
export const projectRe = (id: string): RegExp => new RegExp(`^/api/projects/${esc(id)}$`, 'u');
export const floorsRe = (id: string): RegExp => new RegExp(`^/api/projects/${esc(id)}/floors$`, 'u');

/* ---- sessions ---- */
export function floorAt(project: SeededProject, index: number): SeededFloorRow {
  const floor = project.floors[index];
  if (floor === undefined) throw new Error(`setup: ${project.name} has no floor #${String(index)}`);
  return floor;
}

export interface AdminRun {
  readonly flow: Flow;
  readonly project: SeededProject;
  readonly api: APIRequestContext;
}

/**
 * Phase admin owns a new project with `floors` (S0 / S1(n)) and has a browser session (P5 `openFlow`: page, response
 * log, request log). Budget: 2 logins, 1 `POST /api/projects`; the project is deleted in `finally`.
 */
export async function withAdminProject(
  browser: Browser,
  slug: string,
  floors: number,
  body: (run: AdminRun) => Promise<void>,
  options: { readonly viewport?: { width: number; height: number }; readonly reducedMotion?: boolean } = {},
): Promise<void> {
  const admin = readAdminCredentials();
  const api = await signedInApi(admin.email, admin.password);
  let flow: Flow | undefined;
  let projectId: string | undefined;
  try {
    const project = await createProject(api, slug, floors);
    projectId = project.projectId;
    flow = await openFlow(browser, admin, { viewport: options.viewport ?? DESKTOP, ...options });
    await body({ flow, project, api });
  } finally {
    if (flow !== undefined) await closeFlow(flow);
    if (projectId !== undefined) await deleteSeededProject(api, projectId);
    await api.dispose();
  }
}

export interface MemberRun {
  readonly session: Session;
  readonly project: SeededProject;
  readonly user: PoolUser;
}

/**
 * Admin owns a new project with `floors`; pool `role:shared` is added to it (no project role exists: the global role
 * applies) and has a browser session. Budget: 2 logins (admin API, pool browser), 1 project, 1 member add.
 */
export async function withMemberProject(
  browser: Browser,
  role: PoolRole,
  slug: string,
  floors: number,
  body: (run: MemberRun) => Promise<void>,
): Promise<void> {
  const admin = readAdminCredentials();
  const api = await signedInApi(admin.email, admin.password);
  let session: Session | undefined;
  let projectId: string | undefined;
  try {
    const user = await poolUser(api, role);
    const project = await createProject(api, slug, floors);
    projectId = project.projectId;
    await addProjectMember(api, projectId, user.email);
    session = await openPool(browser, user);
    await body({ session, project, user });
  } finally {
    await closeSession(session);
    if (projectId !== undefined) await deleteSeededProject(api, projectId);
    await api.dispose();
  }
}

/* ---- SCR-15 locators ---- */
export const cadDialog = (page: Page): Locator => page.getByRole('dialog', { name: CAD.dialog, exact: true });
/** CB CadBranchHandoff: `section.animate-panel-rise` with the attention alert and the two choices. */
export const handoff = (page: Page): Locator => page.locator('section.animate-panel-rise');
export const handoffAlert = (page: Page): Locator => page.getByRole('alert').filter({ hasText: CAD.handoffTitle });
export const notice = (page: Page): Locator => page.locator(`section[aria-label="${CAD.noticeRegion}"]`);
export const stageTwo = (page: Page): Locator => page.getByRole('region', { name: CAD.stageTwo, exact: true });
/** CLP root: the canvas box (`bg-canvas-2d`). */
export const previewBox = (page: Page): Locator => stageTwo(page).locator('div.bg-canvas-2d');
/** CLM section (aria-labelledby its h2). */
export const mappingPanel = (page: Page): Locator => page.getByRole('region', { name: CAD.panelTitle, exact: true });
export const optionsDetails = (page: Page): Locator => page.locator('details').filter({ hasText: CAD.options });
export const optionsSummary = (page: Page): Locator => page.locator('summary', { hasText: CAD.options });
/** CB CadMappingSummaryBar: the `footer` holding "Nhập hình học". */
export const summaryBar = (page: Page): Locator =>
  page.locator('footer').filter({ has: page.getByRole('button', { name: CAD.importButton, exact: true }) });

/** Texts of every cell of `table`'s rows (`thead` or `tbody`), trimmed, whitespace collapsed. */
export const cellTexts = (rows: Locator): Promise<string[][]> =>
  rows.evaluateAll((trs) =>
    trs.map((tr) => [...tr.querySelectorAll('th,td')].map((c) => (c.textContent ?? '').replace(/\s+/gu, ' ').trim())),
  );

/** Name used for a focused scroll container (Chrome makes a scrollable box focusable when it holds no focusable child). */
export const SCROLL_CONTAINER = 'SCROLL-CONTAINER';

/**
 * Accessible-ish name of the focused element: aria-label, else its rendered text (`innerText` skips the Button's
 * `invisible` width copy of the label); {@link SCROLL_CONTAINER} for a scrollable box; `BODY` / `null`.
 */
export const focusedName = (page: Page): Promise<string | null> =>
  page.evaluate((scroll) => {
    const el = document.activeElement;
    if (el === null) return null;
    if (el === document.body) return 'BODY';
    if (el.classList.contains('overflow-y-auto') || el.classList.contains('overflow-auto')) return scroll;
    return (el.getAttribute('aria-label') ?? (el as HTMLElement).innerText).replace(/\s+/gu, ' ').trim();
  }, SCROLL_CONTAINER);
