/**
 * QA-11 P6 helpers: project destructive edges (`phase11_project_edge.spec.ts`, flows FL-11P-01/02/06).
 * Copy read from the FE source (worktree = master 5fcaf502):
 *   DZ  src/screens/project/ProjectSettings/DangerZoneTab.tsx   PS  …/ProjectSettings.tsx
 *   PD  src/screens/dashboard/ProjectDashboard/ProjectDashboard.tsx   PCT …/ProjectCardTile.tsx   PMG …/projectMenuGroups.ts
 */
import { expect, type Locator, type Page } from '@playwright/test';

import { typeHeight } from '../numeric-field';

export const DANGER = {
  tablist: 'Nhóm cài đặt', // PS tablist
  tab: 'Vùng nguy hiểm',
  allFloors: 'Xoá mọi tầng', // DZ:61-70
  allFloorsDialog: 'Xoá mọi tầng của dự án?',
  project: 'Xoá dự án', // DZ:99-108
  projectDialog: 'Xoá dự án này?',
  typedLabel: 'Gõ lại tên dự án để xác nhận', // PS:166
  keep: 'Để nguyên', // PS:177
  emptyTitle: 'Chưa có tầng nào', // DZ:72-75
  emptyText: 'Dự án chưa có tầng nào, nên ở đây chưa có gì để xoá ngoài chính dự án.',
} as const;

export const DASH = {
  heading: 'Chọn dự án để làm tiếp',
  menu: 'Tuỳ chọn', // CM:102
  deleteItem: 'Xoá', // PMG:25
  deleteDialog: 'Xoá dự án?', // PD:287
  confirm: 'Xoá dự án', // PD:311
  keep: 'Để nguyên',
  undo: 'Hoàn tác',
  wizard: 'Tạo dự án mới', // CPM:243-245
} as const;

export const UNDO_WINDOW_MS = 8000; // lib/mutations/undoTicket.ts:18

/** One /api request the page sent (method, path, body, Idempotency-Key) plus the status once answered. */
export interface Sent {
  readonly method: string;
  readonly path: string;
  readonly body: string | null;
  readonly key: string;
  status: number | null;
}

/** Records every non-GET /api request of `page`; read it only after a milestone (response / hidden dialog). */
export function recordWrites(page: Page): Sent[] {
  const log: Sent[] = [];
  const byRequest = new Map<unknown, Sent>();
  page.on('request', (request) => {
    const { pathname } = new URL(request.url());
    if (!pathname.startsWith('/api/') || request.method() === 'GET') return;
    const entry: Sent = { method: request.method(), path: pathname, body: request.postData(), key: request.headers()['idempotency-key'] ?? '', status: null };
    log.push(entry);
    byRequest.set(request, entry);
  });
  page.on('response', (response) => {
    const entry = byRequest.get(response.request());
    if (entry !== undefined) entry.status = response.status();
  });
  return log;
}

export const deletesOf = (log: readonly Sent[], pathRe: RegExp): Sent[] => log.filter((e) => e.method === 'DELETE' && pathRe.test(e.path));

export const isDeleteProject = (id: string) => (response: { request(): { method(): string }; url(): string }): boolean =>
  response.request().method() === 'DELETE' && new URL(response.url()).pathname === `/api/projects/${id}`;

/** Two animation frames: the settle point after an action that must send nothing (no request to wait for). */
export const settle = (page: Page): Promise<void> =>
  page.evaluate(() => new Promise<void>((resolve) => requestAnimationFrame(() => requestAnimationFrame(() => resolve()))));

export const dangerTab = (page: Page): Locator => page.getByRole('navigation', { name: 'Mục trong trang', exact: true }).getByRole('link', { name: DANGER.tab });

/** Swaps the case of every letter (a name that differs from `name` only by case). */
export const swapCase = (text: string): string => [...text].map((c) => (c === c.toLowerCase() ? c.toUpperCase() : c.toLowerCase())).join('');

export const dashProjectCard = (page: Page, name: string): Locator =>
  page.getByRole('list', { name: 'Danh sách dự án' }).getByRole('listitem', { name, exact: true });

export async function openCardDelete(page: Page, name: string): Promise<Locator> {
  await page.getByRole('button', { name: `Tuỳ chọn cho ${name}`, exact: true }).click(); // PCT:108
  await page.getByRole('menu', { name: DASH.menu, exact: true }).getByRole('menuitem', { name: DASH.deleteItem, exact: true }).click();
  const dialog = page.getByRole('dialog', { name: DASH.deleteDialog, exact: true });
  await expect(dialog).toBeVisible();
  return dialog;
}

/** "Dự án mới" wizard (copied from phase02_dashboard_edge `openWizard/toStep2/applyHeight`): creates `name`, returns its id. */
export async function createViaWizard(page: Page, name: string): Promise<string> {
  await page.getByRole('button', { name: /^Tạo dự án\s*N$/u }).click();
  const dialog = page.getByRole('dialog', { name: DASH.wizard, exact: true });
  await expect(dialog).toBeVisible();
  const next = dialog.getByRole('button', { name: /^Tiếp: /u });
  await dialog.getByLabel('Tên dự án').fill(name);
  await next.click();
  await expect(dialog.locator('[aria-current="step"]').filter({ hasText: 'Tầng' })).toBeVisible();
  await typeHeight(dialog.getByLabel('Chiều cao áp cho mọi tầng'), '3');
  const apply = dialog.getByRole('button', { name: 'Áp cho mọi tầng', exact: true });
  await expect(apply).toBeEnabled();
  await apply.click();
  await next.click();
  await expect(dialog.locator('[aria-current="step"]').filter({ hasText: 'Xem lại' })).toBeVisible();
  const created = page.waitForResponse((r) => r.request().method() === 'POST' && new URL(r.url()).pathname === '/api/projects');
  await dialog.getByRole('button', { name: 'Tạo dự án', exact: true }).click();
  const response = await created;
  expect([200, 201]).toContain(response.status());
  const body = (await response.json()) as { id?: unknown };
  expect(typeof body.id).toBe('string');
  await expect(dialog).toHaveCount(0);
  return String(body.id);
}
