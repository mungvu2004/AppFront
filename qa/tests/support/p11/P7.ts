/**
 * QA-11 P7 helpers (SCR-08/05/32/29/39/38 project edge, role + deleted-URL flows). Copy cites the FE source at master 5fcaf502:
 *   PS  src/screens/project/ProjectSettings/ProjectSettings.tsx   UPS …/useProjectSettings.ts   NF src/screens/system/NotFound/
 *   NFT …/useNotFound.ts (NOT_FOUND_TEXT)   NFS …/notFoundScenarios.ts   PD src/screens/dashboard/ProjectDashboard/
 */
import { expect, type APIRequestContext, type Browser, type BrowserContext, type Page, type Request } from '@playwright/test';

import { readBaseUrl } from '../../../../e2e/fullstack/env';
import { createPipelineProject } from '../drawingSeed';
import { writeLayer, qcLayer } from '../layerSeed';
import { addProjectMember, envDrawingPng, createProject, deleteSeededProject, poolUser, signInPoolUser, type PoolRole, type PoolUser, type SeededProject } from '../phase03Seed';
import { signedInApi } from '../api';
import { readAdminCredentials } from '../auth';
import { esc } from '../p03/P10';
import { DESKTOP } from './common';

export const P7_TEXT = {
  dangerTab: 'Vùng nguy hiểm', // UPS:532-537 TAB_LABELS.danger
  membersTab: 'Thành viên', // UPS:535 TAB_LABELS.members ("Gỡ" lives here, MembersTab.tsx:69)
  readOnlyLine: 'Vai hiện tại chỉ xem được cài đặt, không sửa và không xoá.', // PS:84
  backToProjects: 'Về danh sách dự án', // PS BACK_TO_PROJECTS_LABEL; NFT dashboardLabel
  retry: 'Thử lại', // PS:61-64
  settingsTitle: 'Cài đặt dự án', // PS h1
  notFoundTitle: 'Không tìm thấy trang này', // NFS TITLE_BY_REASON.missing (NF:98)
  notFoundDescription: 'Trang bạn tìm đã bị xoá hoặc đã chuyển đi nơi khác.', // NF:103
  gateTitle: 'Không tìm thấy dự án này', // PSGATE PROJECT_NOT_FOUND_TITLE (P10 GATE)
  back: 'Quay lại', // NFT backLabel
  recentHeading: 'Dự án gần đây', // NFT recentHeading
  deleteForbidden: 'Bạn không có quyền xoá dự án này.', // UPD:234
  deleteTitle: 'Xoá dự án?', // PD:287
  deleteConfirm: 'Xoá dự án', // PD:311
  cardMenu: 'Tuỳ chọn', // ContextMenu.tsx:102
  restoreDefaults: 'Khôi phục mặc định', // RuleSettings.tsx:328
  viewerHistoryReason: 'Vai trò của bạn trên dự án này chỉ đọc được lịch sử, nên nút phục hồi không hiện', // VHM:493-494
  forbiddenPath: '/khong-co-quyen', // ACC
} as const;

export const projectPath = (id: string): string => `/api/projects/${id}`;
export const projectRe = (id: string): RegExp => new RegExp(`^/api/projects/${esc(id)}$`, "u");

export interface PoolMemberRun {
  readonly api: APIRequestContext;
  readonly user: PoolUser;
  readonly project: SeededProject;
  /** First floor id of a `'pipeline'` seed (two versions after the CP-6 layer write); '' otherwise. */
  readonly floorId: string;
  readonly context: BrowserContext;
  readonly page: Page;
  /** Every non-GET request the page sent (method, path), in order. */
  readonly writes: { method: string; path: string }[];
}

/**
 * Admin API + own project + pool `role` user of `slot` added as member + a fresh browser context signed in as that user.
 * `finally`: context closed, project deleted (drops membership). `afterMember` runs the body with the live handles.
 */
export async function withPoolMember(
  browser: Browser,
  role: PoolRole,
  slot: string,
  slug: string,
  floors: number | 'pipeline',
  body: (run: PoolMemberRun) => Promise<void>,
): Promise<void> {
  const admin = readAdminCredentials();
  const api = await signedInApi(admin.email, admin.password);
  let context: BrowserContext | undefined;
  let projectId: string | undefined;
  try {
    const user = await poolUser(api, role, slot);
    let floorId = '';
    let project: SeededProject;
    if (floors === 'pipeline') {
      // versions come only from the pipeline run (BE pipeline_persist/service.py:184,193) + a restore; the run also notifies the uploader (ai_completed)
      const seeded = await createPipelineProject(api, slug, envDrawingPng());
      projectId = seeded.projectId;
      floorId = seeded.floorId;
      await writeLayer({ request: api, headers: {} }, seeded.projectId, seeded.floorId, qcLayer);
      project = { projectId: seeded.projectId, name: '', floors: [] };
    } else {
      project = await createProject(api, slug, floors);
      projectId = project.projectId;
    }
    await addProjectMember(api, projectId, user.email);
    context = await browser.newContext({ baseURL: readBaseUrl(), viewport: DESKTOP });
    await signInPoolUser(context, user);
    const page = await context.newPage();
    const writes: { method: string; path: string }[] = [];
    page.on('request', (request: Request) => {
      const url = new URL(request.url());
      if (url.pathname.startsWith('/api/') && request.method() !== 'GET') writes.push({ method: request.method(), path: url.pathname });
    });
    await body({ api, user, project, floorId, context, page, writes });
  } finally {
    if (context !== undefined) await context.close().catch(() => undefined);
    const cleanup = projectId === undefined ? null : await deleteSeededProject(api, projectId);
    await api.dispose();
    expect(cleanup, 'cleanup: own project deleted').toBeNull();
  }
}

/** Direct API call as `user` (own login) — payload-free DELETE; returns status + body code. */
export async function deleteAs(user: PoolUser, path: string): Promise<{ status: number; code: string | null }> {
  const asUser = await signedInApi(user.email, user.password);
  try {
    const res = await asUser.delete(path);
    const body = (await res.json().catch(() => null)) as { code?: unknown } | null;
    return { status: res.status(), code: typeof body?.code === 'string' ? body.code : null };
  } finally {
    await asUser.dispose();
  }
}

/** Reads GET `path` with `api`; returns status + body code. */
export async function getStatus(api: APIRequestContext, path: string): Promise<{ status: number; code: string | null }> {
  const res = await api.get(path);
  const body = (await res.json().catch(() => null)) as { code?: unknown } | null;
  return { status: res.status(), code: typeof body?.code === 'string' ? body.code : null };
}

/**
 * Not-found surface of `kind`: 'gate' = project route (ProjectSpatialGate PROJECT_NOT_FOUND_TITLE, exit button
 * BACK_TO_PROJECTS_LABEL as a Button, gate:57); 'page' = unknown path (NotFound h2 TITLE_BY_REASON.missing, NF:98,89,91).
 */
export async function expectMissingState(page: Page, label: string, kind: 'gate' | 'page'): Promise<void> {
  const title = kind === 'gate' ? P7_TEXT.gateTitle : P7_TEXT.notFoundTitle;
  await expect.soft(page.getByText(title, { exact: true }), `${label}: not-found title`).toBeVisible();
  await expect.soft(page.getByRole('button', { name: P7_TEXT.backToProjects, exact: true }), `${label}: exit`).toBeVisible();
  expect.soft(new URL(page.url()).pathname, `${label}: not /khong-co-quyen`).not.toBe(P7_TEXT.forbiddenPath);
}
