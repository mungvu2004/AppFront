/**
 * QA-11 P9 helpers: project settings destructive dialogs (SCR-08), version restore (SCR-32), rule reset (SCR-29),
 * dashboard delete (SCR-05), NotFound (SCR-39). Real stack; mocks only in `phase11_project_mocked_edge.spec.ts`.
 * Copy sources (FE master 5fcaf502): PS src/screens/project/ProjectSettings/ProjectSettings.tsx,
 *   UPS .../useProjectSettings.ts, UPM .../useProjectMembers.ts, DZ .../DangerZoneTab.tsx, MRD .../MemberRemoveDialog.tsx,
 *   VHM src/screens/export/VersionHistory/versionHistoryModel.ts, VHV .../VersionHistory.tsx.
 */
import { expect, type Browser, type Locator, type Page } from '@playwright/test';
import type { APIRequestContext } from '@playwright/test';

import { ROUTES } from '../../../../e2e/fixtures/routes';
import { signedInApi } from '../api';
import { readAdminCredentials } from '../auth';
import { TEST_DATA_PREFIX } from '../evidence';
import { createPipelineProject, deleteSeededProject } from '../drawingSeed';
import { writeLayer, qcLayer } from '../layerSeed';
import { envDrawingPng } from '../phase03Seed';
import { DESKTOP, closeFlow, openFlow, type Flow } from '../p03/P5';

export const esc = (text: string): string => text.replace(/[.*+?^${}()|[\]\\]/gu, '\\$&');

/** PS:156,169 + UPS:546-559 dialog titles / confirm labels. */
export const DANGER = {
  tablist: 'Nhóm cài đặt', // PS tabs (phase11_teardown.spec.ts:451)
  tab: 'Vùng nguy hiểm', // UPS:536
  floorsTitle: 'Xoá mọi tầng của dự án?', // UPS:546
  floorsConfirm: 'Xoá mọi tầng', // UPS:558
  projectTitle: 'Xoá dự án này?', // UPS:547
  projectConfirm: 'Xoá dự án', // UPS:559
  keep: 'Để nguyên', // PS:177
  input: 'Gõ lại tên dự án để xác nhận', // PS:168
  emptyTitle: 'Chưa có tầng nào', // DZ:72
  emptyText: 'Dự án chưa có tầng nào, nên ở đây chưa có gì để xoá ngoài chính dự án.', // DZ:73
  unknown500: 'Hệ thống đã ghi nhận và sẽ kiểm tra. Hãy thử lại sau ít phút.', // vi.json errors.unknown.description
  forbidden403: 'Tài khoản của bạn chưa có quyền xem hoặc thay đổi nội dung này. Liên hệ quản trị dự án.', // vi.json errors.forbidden.description
  lastEditor: 'Không gỡ được: dự án cần ít nhất một người sửa được cài đặt.', // UPM:35
  membersTab: 'Thành viên', // UPS:533
} as const;

export const VH = {
  restore: 'Phục hồi phiên bản này', // VHV:189
  restoreConfirm: 'Phục hồi', // VHM:541
  restoreCancel: 'Để nguyên', // VHM:542
  discardConfirm: 'Bỏ thay đổi và tiếp tục', // VHM:526
  discardCancel: 'Huỷ', // VHM:527
  failTitle: 'Chưa phục hồi được', // VHM:406
  failText: 'Máy chủ chưa nhận lượt phục hồi. Thử lại sau ít phút.', // VHM:412
  conflictTitle: 'Tầng vừa đổi ở nơi khác', // VHG:86
  conflictDismiss: 'Tải lại', // VHG:94
} as const;

export const RS = {
  heading: 'Cài đặt bộ luật không gian', // RSV:267
  restoreDefaults: 'Khôi phục mặc định', // RS:328
} as const;

export const NOT_FOUND_TITLE = 'Không tìm thấy trang này'; // NF:98 (phase10_system_routes.spec.ts:30)
export const NOT_FOUND_PATH = '/khong-ton-tai';

export const projectApiRe = (id: string): RegExp => new RegExp(`^/api/projects/${esc(id)}$`, 'u');
export const floorApiRe = /^\/api\/floors\/[^/]+$/u;
export const memberApiRe = (id: string): RegExp => new RegExp(`^/api/projects/${esc(id)}/members/[^/]+$`, 'u');
export const restoreApiRe = (id: string): RegExp => new RegExp(`^/api/projects/${esc(id)}/versions/[^/]+/restore$`, 'u');
export const ruleConfigApiRe = (id: string): RegExp => new RegExp(`^/api/projects/${esc(id)}/rule-config$`, 'u');

/** Opens SCR-08 on `tab` (tab clicked by name; the tablist is `Nhóm cài đặt`). */
export async function openSettingsTab(page: Page, projectId: string, tab: string): Promise<void> {
  await page.goto(ROUTES.project.settings(projectId));
  const tabButton = page.getByRole('navigation', { name: 'Mục trong trang', exact: true }).getByRole('link', { name: new RegExp(`^${tab}`, 'u') });
  // <1024 px: the strip becomes a Select (ProjectSettings.tsx:112, role=combobox labelled by the same group name).
  const picker = page.getByRole('combobox', { name: DANGER.tablist });
  await expect(tabButton.or(picker)).toBeVisible();
  if (await picker.isVisible()) {
    await picker.click();
    await page.getByRole('option', { name: tab, exact: true }).click();
    await expect(picker).toContainText(tab);
    return;
  }
  await tabButton.click();
  await expect(tabButton).toHaveAttribute('aria-current', 'true');
}

export const dialogOf = (page: Page, title: string): Locator => page.getByRole('dialog', { name: title, exact: true });

/** Non-GET api requests the page sent; read AFTER a certain milestone. */
export function recordWrites(page: Page): { readonly all: string[] } {
  const all: string[] = [];
  page.on('request', (request) => {
    const url = new URL(request.url());
    if (request.method() !== 'GET' && url.pathname.startsWith('/api/') && url.pathname !== '/api/auth/refresh' && !url.pathname.startsWith('/api/telemetry')) {
      all.push(`${request.method()} ${url.pathname}`);
    }
  });
  return { all };
}

export interface VersionsRun {
  readonly flow: Flow;
  readonly api: APIRequestContext;
  readonly projectId: string;
  readonly floorId: string;
  readonly floorName: string;
}

/**
 * Admin-owned pipeline project (two real versions: "before" + "after", BE pipeline_persist/service.py:181-201), then one
 * layer write (CP-6) so the AI version is restorable, and a fresh admin browser session. Project deleted in `finally`.
 * dup-of: phase06_rules_export_versions_edge.spec.ts pipelineProject (local to that file).
 */
export async function withVersionsProject(
  browser: Browser,
  slug: string,
  body: (run: VersionsRun) => Promise<void>,
): Promise<void> {
  const admin = readAdminCredentials();
  const api = await signedInApi(admin.email, admin.password);
  let flow: Flow | undefined;
  let projectId: string | undefined;
  try {
    const seeded = await createPipelineProject(api, slug, envDrawingPng());
    projectId = seeded.projectId;
    await writeLayer({ request: api, headers: {} }, seeded.projectId, seeded.floorId, qcLayer);
    flow = await openFlow(browser, admin, { viewport: DESKTOP });
    await body({ flow, api, projectId, floorId: seeded.floorId, floorName: seeded.floorName });
  } finally {
    if (flow !== undefined) await closeFlow(flow);
    if (projectId !== undefined) expect(await deleteSeededProject(api, projectId), 'cleanup: project deleted').toBeNull();
    await api.dispose();
  }
}

/** Slug that makes  names ~80 characters (NAME_MAX 80; prefix + slug + '-' + 12-13 chars of stamp). */
export function longSlug(): string {
  return 'W'.repeat(Math.max(1, 80 - TEST_DATA_PREFIX.length - 14));
}
