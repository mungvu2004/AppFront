/**
 * QA-03d P10 helpers — SCR-13 pipeline graph (`phase03_graph_cad_{edge,ui}.spec.ts`).
 * Real stack only; the route holds / fakes live in the specs. Copy is read from the FE source at c16f2428:
 *   PG  src/screens/pipeline/PipelineGraph/PipelineGraph.tsx   PGO …/PipelineGraphOverview.tsx   PGT …/pipelineGraphText.ts
 *   UPG …/usePipelineGraph.ts   PGG …/pipelineGraphGateway.ts
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
