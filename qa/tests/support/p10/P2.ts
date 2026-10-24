/** Helpers for the P2 pack of QA-10 (phase10_notfound_mocked_edge, phase10_shortcuts_edge). */
import { expect, type Page, type Request, type Route } from '@playwright/test';

/** `GET /api/projects` only (any query); other methods fall through to the real backend. */
export const PROJECTS_LIST_URL = /\/api\/projects(\?.*)?$/u;

export const NOT_FOUND_PATH = '/khong-ton-tai';
// src/screens/system/NotFound/useNotFound.ts:88-91,96-100
export const NF_TITLE = 'Không tìm thấy trang này';
export const NF_OFFLINE_TITLE = 'Chưa kết nối được máy chủ';
export const NF_OFFLINE_TEXT = 'Đường truyền đang gián đoạn, nên chưa xác nhận được trang này còn hay không.';
export const NF_RECENT = 'Có thể bạn đang tìm';
export const NF_DASHBOARD = 'Về danh sách dự án';
export const NF_BACK = 'Quay lại trang trước';

/** One project in the wire shape of `ProjectSchema` (src/api/schemas/index.ts:219). */
export function wireProject(id: string, name: string, updatedAt: string): Record<string, unknown> {
  return { id, name, status: 'draft', floors: [], members: [], createdAt: '2026-01-01T00:00:00.000Z', updatedAt };
}

/** Routes `GET /api/projects` through `handler`; `served()` counts the requests it took. */
export async function routeProjects(
  page: Page,
  handler: (route: Route) => Promise<void>,
): Promise<{ readonly served: () => number; readonly stop: () => Promise<void> }> {
  let served = 0;
  const wrapped = async (route: Route): Promise<void> => {
    if (route.request().method() !== 'GET') return route.fallback();
    served += 1;
    return handler(route);
  };
  await page.route(PROJECTS_LIST_URL, wrapped);
  return { served: () => served, stop: () => page.unroute(PROJECTS_LIST_URL, wrapped) };
}

/** Every `/api/` request as `METHOD pathname`. */
export function recordApiRequests(page: Page): { readonly sent: string[]; readonly stop: () => void } {
  const sent: string[] = [];
  const onRequest = (request: Request): void => {
    const { pathname } = new URL(request.url());
    if (pathname.startsWith('/api/')) sent.push(`${request.method()} ${pathname}`);
  };
  page.on('request', onRequest);
  return { sent, stop: () => page.off('request', onRequest) };
}

/** One painted frame: a synchronous key handler has run by then. */
export async function nextFrame(page: Page): Promise<void> {
  await page.evaluate(() => new Promise<void>((resolve) => requestAnimationFrame(() => resolve())));
}

/** Opens NotFound and waits for its unconditional h1 (the milestone for absence checks). */
export async function openNotFound(page: Page, title: string = NF_TITLE): Promise<void> {
  await page.goto(NOT_FOUND_PATH);
  await expect(page.getByRole('heading', { name: title, exact: true, level: 1 })).toBeVisible();
}
