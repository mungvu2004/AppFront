/**
 * QA-11 P2 helpers — SCR-11 input quality gate (straighten / corners dialogs). Copy cites the FE source:
 * UIQ src/screens/upload/InputQualityGate/useInputQualityGate.ts, IQD …/InputQualityGateConfirmDialog.tsx, IQE …/inputQualityWriteErrors.ts,
 * IQ …/InputQualityGate.tsx. Phase-03 selectors are re-used from `support/p03/P7.ts` (same screen).
 * Every project is own (owner = pool admin of this file's slot) and deleted by `flow()` in its `finally`.
 */
import { expect, type APIRequestContext, type Browser, type Locator, type Page, type Request } from '@playwright/test';

import { ROUTES } from '../../../../e2e/fixtures/routes';
import { signedInApi } from '../api';
import { deleteSeededProject, poolUser, type PoolRole, type PoolUser } from '../phase03Seed';
import { mainAdminApi, openSession, type Session } from '../p03/P7';
import { p11Slot } from './common';

export const SLOT = p11Slot('floors-b');
export const FLIP_SLOT = p11Slot('floors-b-flip');

export const COPY = {
  straighten: 'Tự động nắn', // UIQ COPY.straightenAction
  confirmStraighten: 'Nắn thẳng', // UIQ COPY.straightenConfirmLabel
  confirmCorners: 'Cắt và nắn', // UIQ COPY.cornersConfirmLabel
  cancel: 'Huỷ', // UIQ COPY.confirmCancel
  straightenBody: 'Máy chủ sẽ thay ảnh gốc bằng ảnh đã nắn và xử lý lại tầng này; việc này không hoàn tác được.',
  cornersBody: 'Máy chủ sẽ cắt, nắn lại bản vẽ theo bốn góc và xử lý lại tầng này; việc này không hoàn tác được.',
  straightened: 'Đã nắn thẳng bản vẽ', // UIQ straightenedAnnouncement
  invalidCorners: 'Bốn góc chưa tạo thành một khung hợp lệ; hãy chọn lại.', // IQE:25
  layerReviewed: 'Tầng này đã có tỉ lệ hoặc hình học do người chỉnh, nên không nắn hay cắt lại bản vẽ được nữa.', // IQE:23-24
  forbidden: 'Tài khoản của bạn chưa có quyền xem hoặc thay đổi nội dung này. Liên hệ quản trị dự án.', // i18n errors.forbidden
  report: 'Báo cáo chất lượng', // IQR:281
  cornerGroup: 'Bốn góc bản vẽ, kéo để chỉnh khung', // IQO:33
  writeError: 'Chưa xử lý được bản vẽ', // IQ:64
  undo: 'Hoàn tác',
} as const;

export interface Flow {
  readonly admin: APIRequestContext;
  readonly owner: PoolUser;
  readonly ownerApi: APIRequestContext;
  readonly projects: string[];
  readonly sessions: Session[];
  readonly cleanups: (() => Promise<unknown>)[];
}

/** Pool-admin owner of own projects + cleanups (role restores run first and are `expect`ed, not swallowed). */
export async function flow(body: (f: Flow) => Promise<void>): Promise<void> {
  const admin = await mainAdminApi();
  const projects: string[] = [];
  const sessions: Session[] = [];
  const cleanups: (() => Promise<unknown>)[] = [];
  let ownerApi: APIRequestContext | undefined;
  try {
    const owner = await poolUser(admin, 'admin', SLOT);
    ownerApi = await signedInApi(owner.email, owner.password);
    await body({ admin, owner, ownerApi, projects, sessions, cleanups });
  } finally {
    for (const cleanup of cleanups) await cleanup();
    for (const s of sessions) await s.context.close().catch(() => undefined);
    for (const id of projects) if (ownerApi !== undefined) expect(await deleteSeededProject(ownerApi, id), 'cleanup project').toBeNull();
    await ownerApi?.dispose();
    await admin.dispose();
  }
}

export async function session(f: Flow, browser: Browser, user: PoolUser = f.owner): Promise<Session> {
  const s = await openSession(browser, user);
  f.sessions.push(s);
  return s;
}

export const pool = (f: Flow, role: PoolRole, slot: string): Promise<PoolUser> => poolUser(f.admin, role, slot);

export const report = (page: Page): Locator => page.getByRole('region', { name: COPY.report, exact: true });
export const button = (scope: Page | Locator, name: string): Locator => scope.getByRole('button', { name, exact: true });
export const row = (page: Page, name: string): Locator => report(page).getByRole('row').filter({ has: page.getByRole('cell', { name, exact: true }) });
export const finding = (page: Page, title: string): Locator => report(page).locator('li').filter({ has: page.getByText(title, { exact: true }) });
export const straightenBtn = (page: Page): Locator => page.locator('[data-quality-action="straighten"]'); // UIQ/IQF data attribute (phase03 11-E-009)
export const cornersBtn = (page: Page): Locator => page.locator('[data-quality-action="corners"]');
export const straightenDialog = (page: Page): Locator => page.getByRole('dialog', { name: /^Nắn thẳng bản vẽ tầng /u });
export const cornersDialog = (page: Page): Locator => page.getByRole('dialog', { name: /^Cắt và nắn bản vẽ tầng .* theo bốn góc$/u });
export const writeBand = (page: Page): Locator => page.getByRole('alert').filter({ hasText: COPY.writeError });
export const handle = (page: Page, name: string): Locator => page.getByRole('group', { name: COPY.cornerGroup, exact: true }).getByRole('button', { name, exact: true });

export async function openQuality(page: Page, projectId: string): Promise<void> {
  await page.goto(ROUTES.project.quality(projectId));
  await expect(report(page)).toBeVisible({ timeout: 45_000 });
}

/** Records every non-GET `/api/` request the page sends ("METHOD pathname"); read only after a sure milestone. */
export function recordWrites(page: Page): { readonly list: Request[] } {
  const list: Request[] = [];
  page.on('request', (r) => {
    if (r.method() !== 'GET' && new URL(r.url()).pathname.startsWith('/api/')) list.push(r);
  });
  return { list };
}

export const qualityPosts = (writes: { readonly list: Request[] }, tail: string): Request[] =>
  writes.list.filter((r) => r.method() === 'POST' && new URL(r.url()).pathname.endsWith(tail));

export const inside = (dialog: Locator): Promise<boolean> => dialog.evaluate((d) => d.contains(document.activeElement));

/** Drags `from` to ratios of the image content box (may be outside 0..1). */
export async function dragTo(page: Page, from: Locator, xRatio: number, yRatio: number): Promise<void> {
  const start = await from.boundingBox();
  const box = await page.getByTestId('quality-image-content').boundingBox(); // IQP:142
  if (start === null || box === null) throw new Error('drag: no box');
  await page.mouse.move(start.x + start.width / 2, start.y + start.height / 2);
  await page.mouse.down();
  await page.mouse.move(box.x + box.width * xRatio, box.y + box.height * yRatio, { steps: 8 });
  await page.mouse.up();
}
