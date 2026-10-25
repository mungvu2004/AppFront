/**
 * QA-03d P6 helpers — SCR-10 upload branches (`phase03_upload_{mocked_edge,roles_edge,ui}.spec.ts`). Real stack only;
 * the route holds / fakes live in the specs. Copy and selectors are read from the FE source at c16f2428:
 *   FU  src/screens/upload/FloorUploadScreen/FloorUploadScreen.tsx   FUC …/FloorUploadCard.tsx   FUT …/FloorUploadTray.tsx
 *   FUF …/FloorUploadFooter.tsx   FUD …/FloorUploadDropZone.tsx   UFU …/useFloorUploadScreen.ts   FUG …/floorUploadGateway.ts
 *   UT  src/lib/upload/uploadTask.ts   AN src/lib/input/announcer.ts   DB src/lib/offline/db.ts   I18N src/i18n/vi.json errors.*
 */
import { expect, test, type APIRequestContext, type Browser, type BrowserContext, type Locator, type Page, type Request, type Route } from '@playwright/test';

import { ROUTES } from '../../../../e2e/fixtures/routes';
import { watchApi, type ApiEntry } from '../../../../e2e/fullstack/apiWatch';
import { readBaseUrl } from '../../../../e2e/fullstack/env';
import { signedInApi } from '../api';
import { readAdminCredentials } from '../auth';
import {
  createProject,
  deleteSeededProject,
  poolUser,
  signInPoolUser,
  type PoolUser,
  type SeededFloorRow,
  type SeededProject,
} from '../phase03Seed';

export const DESKTOP = { width: 1440, height: 900 } as const;

/* ---- copy (each cites its source) ---- */
export const UP = {
  dropzone: 'floor-upload-dropzone', // FUD:30
  fileInput: 'floor-upload-file-input', // FUD:33
  blockNotice: 'floor-upload-block-notice', // FUF
  counter: 'floor-upload-counter-number', // FUF
  tray: 'Tệp chưa gán tầng', // UFU COPY.trayTitle
  assign: 'Gán cho tầng khác', // FUC:39, FUT
  pickPage: 'Chọn trang', // FUC:40
  submit: 'Bắt đầu xử lý', // UFU COPY.submit
  blockedTitle: 'Không thể bắt đầu xử lý', // UFU COPY.blockedTitle
  waiting: 'Chờ xử lý', // UFU STATUS_LABELS
  uploading: 'Đang tải lên',
  attached: 'Đã gắn kèm',
  error: 'Lỗi',
  noDrawing: 'Chưa có bản vẽ', // UFU NO_DRAWING_LABEL
  autoMatch: 'Ghép tự động từ tên tệp — kiểm tra lại', // UFU COPY.autoMatch
  empty: 'Chưa có tầng nào có bản vẽ.', // UFU COPY.empty
  offline: 'Đang làm việc ngoại tuyến', // UFU COPY.offline
  awaitNetwork: 'Đang ngoại tuyến: tệp sẽ tự tải lên khi có mạng trở lại; nếu tải lại trang thì cần chọn lại tệp', // UFU AWAIT_NETWORK_SENTENCE
  readOnly: 'Vai hiện tại chỉ được xem danh sách tệp, không tải lên và không sửa.', // UFU COPY.readOnly
  loadError: 'Không tải được danh sách tầng', // FU LOAD_ERROR_TITLE
  retry: 'Thử lại', // FU RETRY_LABEL, FUC LABEL_RETRY
  cancel: 'Huỷ', // FUC LABEL_CANCEL
  dismiss: 'Đóng', // FUC LABEL_DISMISS
  undo: 'Hoàn tác', // Toast.tsx
  noFloorsTitle: 'Dự án chưa có tầng nào', // FU NO_FLOORS_TITLE
  addFloors: 'Thêm tầng', // FU ADD_FLOORS_LABEL
  notFoundTitle: 'Không tìm thấy dự án này', // ProjectSpatialGate PROJECT_NOT_FOUND_TITLE
  notFoundSentence: 'Dự án có thể đã bị xoá, đường dẫn chưa đúng, hoặc bạn chưa được thêm vào dự án.',
  backToProjects: 'Về danh sách dự án',
  breadcrumbProjects: 'Dự án', // FU BREADCRUMB_PROJECTS
} as const;

/** I18N `errors.<kind>.description`. */
export const ERR = {
  network: 'Không liên lạc được với máy chủ. Kiểm tra mạng rồi thử lại.',
  timeout: 'Máy chủ phản hồi quá lâu. Bạn có thể thử lại sau vài giây.',
  unauthenticated: 'Phiên làm việc đã hết hạn. Tải lại để tiếp tục.',
  forbidden: 'Tài khoản của bạn chưa có quyền xem hoặc thay đổi nội dung này. Liên hệ quản trị dự án.',
  validation: 'Kiểm tra lại các trường được đánh dấu rồi thử lại.',
  rateLimited: 'Hệ thống đang bận. Đợi một lát rồi thử lại.',
  unknown: 'Hệ thống đã ghi nhận và sẽ kiểm tra. Hãy thử lại sau ít phút.',
} as const;

/* ---- paths ---- */
const esc = (text: string): string => text.replace(/[.*+?^${}()|[\]\\]/gu, '\\$&');
export const projectReadPath = (projectId: string): string => `/api/projects/${projectId}`;
export const initRe = (projectId: string): RegExp => new RegExp(`^/api/projects/${esc(projectId)}/floors/[^/]+/drawings/uploads$`, 'u');
export const chunkRe = /^\/api\/projects\/[^/]+\/drawings\/uploads\/[^/]+\/chunks$/u;
export const completeRe = /^\/api\/projects\/[^/]+\/drawings\/uploads\/[^/]+\/complete$/u;
export const pathname = (request: Request): string => new URL(request.url()).pathname;

/* ---- sessions ---- */
export interface Session {
  readonly context: BrowserContext;
  readonly page: Page;
  readonly api: ApiEntry[];
}

/**
 * Admin API (1 login): pool lookups only. P6 never uses the stored admin browser session: its refresh cookie rotates, so
 * parallel spec files (`--workers 4`) writing it back would race. Caller disposes.
 */
export async function adminApi(): Promise<APIRequestContext> {
  const { email, password } = readAdminCredentials();
  return signedInApi(email, password);
}

/** Browser session of a pool user (1 login through the context's own cookie jar). */
export async function openPool(browser: Browser, user: PoolUser, viewport: { width: number; height: number } = DESKTOP): Promise<Session> {
  const context = await browser.newContext({ baseURL: readBaseUrl(), viewport });
  try {
    await signInPoolUser(context, user);
    const page = await context.newPage();
    return { context, page, api: watchApi(page) };
  } catch (error) {
    await context.close();
    throw error;
  }
}

export async function closeSession(session: Session | undefined): Promise<void> {
  if (session === undefined) return;
  await session.context.close().catch(() => undefined);
}

/** Own pool slot of P6: one admin and one engineer (own `drawings_init` buckets; 1 invitation each, first use only). */
export const P6_SLOT = 'p06';

export interface OwnerRun {
  readonly session: Session;
  readonly project: SeededProject;
  /** The owner's Bearer API (1 login) — fixture writes as the project owner. */
  readonly ownerApi: APIRequestContext;
  /** The phase admin's API (1 login) — pool lookups. */
  readonly admin: APIRequestContext;
  readonly owner: PoolUser;
}

/**
 * Fresh pool admin (slot {@link P6_SLOT}) owns a new project with `floors` and has a browser session on it; the project
 * is deleted and both APIs disposed in `finally`. Budget: 3 logins (admin API, owner API, browser), 1 POST /api/projects.
 */
export async function withPoolOwner(
  browser: Browser,
  slug: string,
  floors: number | readonly string[],
  body: (run: OwnerRun) => Promise<void>,
  viewport: { width: number; height: number } = DESKTOP,
): Promise<void> {
  const admin = await adminApi();
  let ownerApi: APIRequestContext | undefined;
  let session: Session | undefined;
  let projectId: string | undefined;
  try {
    const owner = await poolUser(admin, 'admin', P6_SLOT);
    ownerApi = await signedInApi(owner.email, owner.password);
    const project = await createProject(ownerApi, slug, floors);
    projectId = project.projectId;
    session = await openPool(browser, owner, viewport);
    await body({ session, project, ownerApi, admin, owner });
  } finally {
    await closeSession(session);
    if (ownerApi !== undefined && projectId !== undefined) await deleteSeededProject(ownerApi, projectId);
    await ownerApi?.dispose();
    await admin.dispose();
  }
}

/** Ids of `project`'s floors in order. */
export const floorIds = (project: SeededProject): string[] => project.floors.map((f) => f.id);

/** Floor `index` of `project` (throws when missing, so steps never act on `undefined`). */
export function floorAt(project: SeededProject, index: number): SeededFloorRow {
  const floor = project.floors[index];
  if (floor === undefined) throw new Error(`setup: ${project.name} has no floor #${String(index)}`);
  return floor;
}

/* ---- request log ---- */
export interface Sent {
  readonly method: string;
  readonly path: string;
  readonly at: number;
  readonly request: Request;
}

/** Every `/api/*` request the page sends (mocked or real), with its send time. */
export function logRequests(page: Page): Sent[] {
  const log: Sent[] = [];
  page.on('request', (request) => {
    const path = pathname(request);
    if (path.startsWith('/api/')) log.push({ method: request.method(), path, at: Date.now(), request });
  });
  return log;
}

export const sentSince = (log: readonly Sent[], mark: number, method: string, re: RegExp): Sent[] =>
  log.slice(mark).filter((s) => s.method === method && re.test(s.path));

/** `chunkIndex` of a #6 body `{ chunk, chunkIndex }` (read from the text: a 5 MiB body is not parsed whole). */
export function chunkIndexOf(request: Request): number | null {
  const found = /"chunkIndex"\s*:\s*(\d+)/u.exec(request.postData() ?? '');
  return found === null ? null : Number(found[1]);
}

/* ---- screen ---- */
export const card = (page: Page, floorId: string): Locator => page.locator(`[data-floor-id="${floorId}"]`);
export const tray = (page: Page): Locator => page.getByRole('region', { name: UP.tray, exact: true });
export const trayItem = (page: Page, fileName: string): Locator => tray(page).getByRole('listitem').filter({ hasText: fileName });
export const badge = (scope: Locator, label: string): Locator => scope.getByText(label, { exact: true });

/** Goto `/projects/:id/upload` and wait for every card of `floorIds`. */
export async function openUpload(page: Page, projectId: string, floorIds: readonly string[]): Promise<void> {
  await page.goto(ROUTES.project.upload(projectId));
  for (const id of floorIds) await expect(card(page, id)).toBeVisible();
}

/** Tray item "Gán cho tầng khác" → `floorName` (FUT Select; options are `role="option"`). */
export async function assignFromTray(page: Page, fileName: string, floorName: string): Promise<void> {
  await trayItem(page, fileName).getByRole('combobox', { name: UP.assign }).click();
  await page.getByRole('option', { name: floorName, exact: true }).click();
}

/** Card "Gán cho tầng khác" → `floorName` (FUC Select). */
export async function reassignCard(page: Page, floorId: string, floorName: string): Promise<void> {
  await card(page, floorId).getByRole('combobox', { name: UP.assign }).click();
  await page.getByRole('option', { name: floorName, exact: true }).click();
}

/**
 * Clicks `target`; when another element takes the pointer (run-33-P6: the sticky footer, FUF `sticky bottom-0 z-20`,
 * covers the open menu of the last card), records a `ui-overlap` annotation and activates it from the keyboard instead,
 * so the flow goes on and the overlap is reported.
 */
export async function activate(target: Locator, what: string): Promise<void> {
  const reachable = await target.click({ trial: true, timeout: 3_000 }).then(() => true, () => false);
  if (reachable) {
    await target.click();
    return;
  }
  test.info().annotations.push({ type: 'ui-overlap', description: `${what}: covered, not clickable (keyboard used)` });
  await target.focus();
  await target.press('Enter');
}

/** Opens "Tuỳ chọn của tầng {floor}" (FUC CardMenu); its items are plain buttons inside the card. */
export async function openCardMenu(page: Page, floorId: string, floorName: string): Promise<Locator> {
  const scope = card(page, floorId);
  const toggle = scope.getByRole('button', { name: `Tuỳ chọn của tầng ${floorName}`, exact: true });
  if ((await toggle.getAttribute('aria-expanded')) !== 'true') await activate(toggle, `menu of ${floorName}`);
  return scope;
}

/** Card menu "Xoá bản vẽ {file}" (local only, toast with "Hoàn tác"). */
export async function removeViaMenu(page: Page, floorId: string, floorName: string, fileName: string): Promise<void> {
  const scope = await openCardMenu(page, floorId, floorName);
  await activate(scope.getByRole('button', { name: `Xoá bản vẽ ${fileName}`, exact: true }), `"Xoá bản vẽ ${fileName}" on ${floorName}`);
  await expect(scope.getByText(fileName)).toHaveCount(0);
}

/** Card menu item names while it is open (then closed again with Escape). */
export async function cardMenuItems(page: Page, floorId: string, floorName: string): Promise<string[]> {
  const scope = await openCardMenu(page, floorId, floorName);
  const names = await scope
    .locator('div.absolute button')
    .evaluateAll((buttons) => buttons.map((b) => (b.textContent ?? '').replace(/\s+/gu, ' ').trim()));
  await scope.getByRole('button', { name: `Tuỳ chọn của tầng ${floorName}`, exact: true }).press('Escape');
  return names;
}

/* ---- files (Playwright setInputFiles payloads) ---- */
export interface FilePayload {
  readonly name: string;
  readonly mimeType: string;
  readonly buffer: Buffer;
}
export const pngFile = (name: string, bytes: Buffer): FilePayload => ({ name, mimeType: 'image/png', buffer: bytes });
/** `bytes` padded with zeros after IEND to `size` (a real PNG head; > 10 MiB = 3 chunks of 5 MiB, UT chunk.ts:46). */
export const paddedPng = (name: string, bytes: Buffer, size: number): FilePayload =>
  pngFile(name, Buffer.concat([bytes, Buffer.alloc(Math.max(0, size - bytes.length))]));
/** Client-side 3-page PDF: `/Count 3` is all `readPdfPageCount` reads (validate.ts:306-335); never uploaded. */
export const threePagePdf = (name: string): FilePayload => ({
  name,
  mimeType: 'application/pdf',
  buffer: Buffer.from('%PDF-1.4\n1 0 obj << /Type /Pages /Count 3 >> endobj\n%%EOF\n', 'utf8'),
});
export const textFile = (name: string): FilePayload => ({ name, mimeType: 'text/plain', buffer: Buffer.from('khong phai ban ve\n', 'utf8') });
/** `.dwg` (ACCEPTED, not offered by the picker): the BE refuses it at init with 422 CAD_NOT_SUPPORTED. */
export const dwgFile = (name: string): FilePayload => ({ name, mimeType: 'application/acad', buffer: Buffer.from('AC1032 qa dwg stub\n', 'utf8') });

/** Picks `files` through the hidden input (FUD `floor-upload-file-input`). */
export async function pickFiles(page: Page, files: readonly FilePayload[]): Promise<void> {
  await page.getByTestId(UP.fileInput).setInputFiles(files.map((f) => ({ name: f.name, mimeType: f.mimeType, buffer: f.buffer })));
}

/**
 * Fires `type` (dragenter / dragleave / drop) on `target` with a DataTransfer that holds `files` (small payloads only:
 * the bytes travel through `evaluate`). FU listens on its outer div, so any element inside it works.
 */
export async function fireDrag(target: Locator, type: 'dragenter' | 'dragleave' | 'drop', files: readonly FilePayload[] = []): Promise<void> {
  const page = target.page();
  const dataTransfer = await page.evaluateHandle(
    (list) => {
      const dt = new DataTransfer();
      for (const f of list) dt.items.add(new File([new Uint8Array(f.bytes)], f.name, { type: f.mimeType }));
      return dt;
    },
    files.map((f) => ({ name: f.name, mimeType: f.mimeType, bytes: [...f.buffer] })),
  );
  await target.dispatchEvent(type, { dataTransfer });
  await dataTransfer.dispose();
}

/* ---- request holds and fakes ---- */
export interface Hold {
  /** Requests held so far (live array). */
  readonly held: Request[];
  /** Resolves once `n` requests are held. */
  readonly seen: (n?: number) => Promise<void>;
  /** Lets every held request (and later ones) go on (`continue`) or fails them (`abort`), then unroutes. */
  readonly release: (mode?: 'continue' | 'abort') => Promise<void>;
}

/**
 * Holds every request that `match`es (up to `limit`) until `release()` — a delay, not a faked answer. Requests the
 * page aborts meanwhile (cancel, navigation) are simply dropped at release.
 */
export async function holdRequests(page: Page, match: (request: Request) => boolean, limit = Number.POSITIVE_INFINITY): Promise<Hold> {
  const held: Request[] = [];
  const waiters: { n: number; resolve: () => void }[] = [];
  let open: (mode: 'continue' | 'abort') => void = () => undefined;
  const gate = new Promise<'continue' | 'abort'>((resolve) => (open = resolve));
  let released = false;
  const handler = async (route: Route): Promise<void> => {
    const request = route.request();
    if (released || held.length >= limit || !match(request)) {
      await route.fallback();
      return;
    }
    held.push(request);
    for (const w of waiters.filter((x) => held.length >= x.n)) w.resolve();
    const mode = await gate;
    await (mode === 'continue' ? route.continue() : route.abort()).catch(() => undefined);
  };
  await page.route('**/api/**', handler);
  return {
    held,
    seen: (n = 1) =>
      held.length >= n ? Promise.resolve() : new Promise<void>((resolve) => waiters.push({ n, resolve })),
    release: async (mode = 'continue') => {
      released = true;
      open(mode);
      await page.unroute('**/api/**', handler).catch(() => undefined);
    },
  };
}

/** `route.fulfill` JSON helper for the fakes. */
export const fulfillJson = (route: Route, status: number, body: unknown, headers: Record<string, string> = {}): Promise<void> =>
  route.fulfill({ status, contentType: 'application/json', headers, body: JSON.stringify(body) });

/* ---- live-region recorder (counts every write, unlike a de-duplicating one) ---- */

/** Install before `goto`: every text the app announcer writes (AN `[data-announcer]`), in order, NBSP stripped. */
export async function recordAllAnnouncements(page: Page): Promise<() => Promise<string[]>> {
  await page.addInitScript(() => {
    const log: string[] = [];
    (window as unknown as { __qaAllAnnounced: string[] }).__qaAllAnnounced = log;
    new MutationObserver((mutations) => {
      for (const m of mutations) {
        const node = m.target instanceof Element ? m.target : m.target.parentElement;
        const region = node?.closest('[data-announcer]');
        if (region && m.type === 'childList') {
          const text = (region.textContent ?? '').replace(/ /gu, '').trim();
          if (text !== '') log.push(text);
        }
      }
    }).observe(document, { subtree: true, childList: true });
  });
  return () => page.evaluate(() => (window as unknown as { __qaAllAnnounced?: string[] }).__qaAllAnnounced ?? []);
}

/** Every value the `role="progressbar"` aria-label took (FUC ProgressRail), in order; install before `goto`. */
export async function recordProgressLabels(page: Page): Promise<() => Promise<string[]>> {
  await page.addInitScript(() => {
    const log: string[] = [];
    (window as unknown as { __qaProgress: string[] }).__qaProgress = log;
    const read = (): void => {
      for (const el of document.querySelectorAll('[role="progressbar"]')) {
        const label = el.getAttribute('aria-label') ?? '';
        if (label !== '' && log[log.length - 1] !== label) log.push(label);
      }
    };
    new MutationObserver(read).observe(document, { subtree: true, childList: true, attributes: true, attributeFilter: ['aria-label'] });
  });
  return () => page.evaluate(() => (window as unknown as { __qaProgress?: string[] }).__qaProgress ?? []);
}

/* ---- offline queue (DB `digitwin-offline` / `pendingCommands`) ---- */

/** Labels of the queued commands (`"Tải bản vẽ {file} khi có mạng"`, FUG enqueueOffline); [] when the DB is absent. */
export async function pendingCommandLabels(page: Page): Promise<string[]> {
  return page.evaluate(
    () =>
      new Promise<string[]>((resolve) => {
        const open = indexedDB.open('digitwin-offline');
        open.onerror = () => resolve([]);
        open.onupgradeneeded = () => {
          open.transaction?.abort();
          resolve([]);
        };
        open.onsuccess = () => {
          const db = open.result;
          if (!db.objectStoreNames.contains('pendingCommands')) {
            db.close();
            resolve([]);
            return;
          }
          const all = db.transaction('pendingCommands', 'readonly').objectStore('pendingCommands').getAll();
          all.onsuccess = () => {
            db.close();
            resolve((all.result as { command?: { label?: unknown } }[]).map((row) => String(row.command?.label ?? '')));
          };
          all.onerror = () => {
            db.close();
            resolve([]);
          };
        };
      }),
  );
}
