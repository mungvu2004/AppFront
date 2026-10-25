/**
 * QA-09 P2 helpers (shell flows FL-9P-05..08, X1). Owned by P2 only; shared pieces stay in `./roles.ts`.
 * Copy cites FE source: PD src/screens/dashboard/ProjectDashboard/ProjectDashboard.tsx · PCT …/ProjectCardTile.tsx ·
 * PMG …/projectMenuGroups.ts · CPM src/screens/project/CreateProjectModal/CreateProjectModal.tsx · PS …/ProjectSettings.
 */
import { expect, type APIRequestContext, type Locator, type Page } from '@playwright/test';

import { typeHeight } from '../numeric-field';

export const SETTINGS_READ_ONLY = 'Vai hiện tại chỉ xem được cài đặt, không sửa và không xoá.'; // ProjectSettings.tsx:93
export const VIEWER_LINE = 'Vai người xem: chỉ có thể mở dự án, không tạo hoặc xoá được.'; // PD:223
export const LIBRARY_READ_ONLY = 'Vai trò của bạn chỉ xem được thư viện'; // useModelLibrary.ts:103 (prefix)
export const FORBIDDEN_TITLE = 'Không có quyền truy cập'; // TrainingJobs.tsx:37 / ModelRegistry.tsx:38
export const SAVED_AT = /^Đã lưu lúc \d{1,2}:\d{2}$/u; // vi.json common.saved_at

export interface SeenResponse {
  readonly method: string;
  readonly path: string;
  readonly status: number;
}

/** Every `/api/` response of the page, in order; read it only after a sure anchor. */
export function recordResponses(page: Page): { seen: SeenResponse[] } {
  const rec = { seen: [] as SeenResponse[] };
  page.on('response', (res) => {
    const { pathname } = new URL(res.url());
    if (pathname.startsWith('/api/')) rec.seen.push({ method: res.request().method(), path: pathname, status: res.status() });
  });
  return rec;
}

export const projectCard = (page: Page, name: string): Locator =>
  page.getByRole('list', { name: 'Danh sách dự án', exact: true }).getByRole('listitem', { name, exact: true }); // PD:151

/** Card "..." menu (PCT:97-107); menu label is "Tuỳ chọn…". */
export async function openCardMenu(page: Page, name: string): Promise<Locator> {
  await page.getByRole('button', { name: `Tuỳ chọn cho ${name}`, exact: true }).click();
  const menu = page.getByRole('menu');
  await expect(menu).toBeVisible();
  return menu;
}

export const menuItem = (menu: Locator, label: string): Locator => menu.getByRole('menuitem', { name: label, exact: true });

/** Wizard "Tạo dự án mới": name → step 2 (3 m stack) → step 3 → "Tạo dự án"; returns the new project's id from POST 201. */
export async function createViaWizard(page: Page, name: string): Promise<string> {
  const dialog = page.getByRole('dialog', { name: 'Tạo dự án mới', exact: true }); // CPM:243
  await expect(dialog).toBeVisible();
  await dialog.getByLabel('Tên dự án').fill(name);
  await dialog.getByRole('button', { name: /^Tiếp: /u }).click();
  await expect(dialog.locator('[aria-current="step"]').filter({ hasText: 'Tầng' })).toBeVisible();
  await typeHeight(dialog.getByLabel('Chiều cao áp cho mọi tầng'), '3');
  await dialog.getByRole('button', { name: 'Áp cho mọi tầng', exact: true }).click();
  await dialog.getByRole('button', { name: /^Tiếp: /u }).click();
  await expect(dialog.locator('[aria-current="step"]').filter({ hasText: 'Xem lại' })).toBeVisible();
  const created = page.waitForResponse((r) => r.request().method() === 'POST' && new URL(r.url()).pathname === '/api/projects');
  await dialog.getByRole('button', { name: 'Tạo dự án', exact: true }).click();
  const res = await created;
  expect(res.status(), 'POST /api/projects').toBe(201);
  return String(((await res.json()) as { id: unknown }).id);
}

/** In-app navigation without a document load (history + popstate; same as support/p03/P9 spaNavigate). */
export async function spaGo(page: Page, path: string): Promise<void> {
  await page.evaluate((to) => {
    window.history.pushState(null, '', to);
    window.dispatchEvent(new PopStateEvent('popstate', { state: null }));
  }, path);
}

/** BE error `code` of a response body (`{code, …}`; apps/api error envelope). */
export async function codeOf(res: { json: () => Promise<unknown> }): Promise<unknown> {
  return ((await res.json()) as { code?: unknown }).code;
}

/** Cleanup: delete a project as admin; a failure is reported, never thrown (cleanup must not mask the test result). */
export async function deleteProject(admin: APIRequestContext, projectId: string): Promise<string | null> {
  const res = await admin.delete(`/api/projects/${projectId}`);
  return res.status() === 200 || res.status() === 204 || res.status() === 404 ? null : `DELETE ${projectId} → ${String(res.status())}`;
}
