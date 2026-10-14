/**
 * QA-06b P3 helpers for SCR-29 Rule Settings (`phase06_rulesettings_{edge,mocked_edge,ui}.spec.ts`). Owned by P3 only;
 * shared seeds stay in `../phase03Seed.ts` / `../api.ts` / `../evidence.ts` (reused, not edited).
 *
 * Sessions: one browser context per person (`openSession`, one `POST /api/auth/login` through the context's own jar),
 * a response log (`watchApi`) and the list of rule-config PUT bodies the page sent (`Session.sent`, in send order).
 * Fixtures go through the admin API (`signedInApi`, one more login); projects are run-unique `qa-<runId>-29-…`
 * (`createProject`) and deleted in `finally` (`deleteSeededProject`).
 *
 * Source short names (FE `src/screens/rules/RuleSettings/`, master d50bb248): RSV RuleSettings.tsx · RSC …container.tsx ·
 * RSG RuleSettingsGroups.tsx · RSP RuleSettingsPresets.tsx · RSD RuleSettingsReloadDialog.tsx · RSR RuleSettingsRow.tsx ·
 * RSW ruleSettingsGateway.ts · URS useRuleSettings.ts; CFG `src/domain/rules/config.ts`; AUT `src/lib/autosave/createAutosave.ts`;
 * NF `src/hooks/useNumericField.ts`; PSG `src/components/feedback/ProjectSpatialGate.tsx`.
 */
import { randomUUID } from 'node:crypto';

import { expect, test, type APIRequestContext, type Browser, type BrowserContext, type Locator, type Page } from '@playwright/test';

import { ROUTES } from '../../../../e2e/fixtures/routes';
import {
  navigateThenWaitForApi,
  waitForApiWhere,
  watchApi,
  type ApiEntry,
  type ApiResult,
} from '../../../../e2e/fullstack/apiWatch';
import { AUTOSAVE_TIMEOUT_MS, readBaseUrl } from '../../../../e2e/fullstack/env';
import { signedInApi } from '../api';
import { readAdminCredentials } from '../auth';
import { captureEvidence } from '../evidence';
import { createProject, deleteSeededProject, type SeededProject } from '../phase03Seed';

export { typeHeight as typeNum } from '../numeric-field';

export type Json = Record<string, unknown>;
export type Viewport = { readonly width: number; readonly height: number };
export const DESKTOP: Viewport = { width: 1440, height: 900 };
export const NOID = (): string => randomUUID();

export const asRecord = (value: unknown, what: string): Json => {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) throw new Error(`${what}: not a JSON object`);
  return value as Json;
};
export const escapeRegExp = (text: string): string => text.replace(/[.*+?^${}()|[\]\\]/gu, '\\$&');

/* ---------------------------------------------------------------------------------------------- copy (each cites its source) */

export const TOTAL_RULES = 25; // registry: 25 rules
export const DEFAULT_ON = 23; // 25 − ROOM-HAS-DOOR − ROOM-MIN-AREA (superseded, off by default)

export const RS = {
  heading: 'Cài đặt bộ luật không gian', // RSV:267
  enabledCount: /^(\d+)\/(\d+) luật đang bật$/u, // RSV:270
  nav: 'Mục cài đặt bộ luật', // RSV:136
  collapsedSelect: 'Mục cài đặt', // RSV:123
  generalNav: 'Ngưỡng chung', // RSV:87, RSG:122
  generalHash: '#rule-settings-general-thresholds', // RSV:66 sectionIdOf + RSV:57
  generalField: 'Góc lệch tối đa còn coi là hai đường song song', // thresholdSpecs.ts:100
  generalJoint: 'Khoảng hở tối đa còn coi là hai tường đã nối vào nhau', // thresholdSpecs.ts:119
  disableAll: 'Mọi luật đều đang tắt: lượt kiểm tra sẽ không soi gì nữa và mô hình báo sạch lỗi dù chưa được kiểm lần nào.', // URS:245-246
  partial: 'Đang tải thêm dữ liệu bộ luật…', // RSV:194-196
  readOnly: 'Chỉ quản trị viên đổi được bộ luật; bạn đang xem ở quyền chỉ đọc.', // RSW:97-98
  conflict: 'Bộ luật vừa được đổi ở nơi khác nên thay đổi của bạn chưa được lưu. Tải lại để xem bản mới nhất.', // RSW:299-300
  reload: 'Tải lại', // RSV:186
  reloadTitle: 'Tải lại bộ luật?', // RSD:20
  reloadBody: 'Tải lại sẽ bỏ thay đổi chưa lưu của bạn và hiện bản bộ luật mới nhất trên máy chủ.', // RSD:22-24
  reloadLater: 'Để sau', // RSD:28
  reloadConfirm: 'Bỏ thay đổi và tải lại', // RSD:31
  restoreDefaults: 'Khôi phục mặc định', // RSV:328
  stickyNote: 'Cấu hình đã khác mặc định.', // RSV:325
  presets: 'Bộ luật sẵn', // RSP:57
  undo: 'Hoàn tác', // Toast.tsx:149
  toastRegion: 'Thông báo', // Toast.tsx:203
  loadErrorTitle: 'Không tải được cài đặt bộ luật', // RSV:282
  retry: 'Thử lại', // RSV:288
  forbiddenTitle: 'Không có quyền xem cài đặt bộ luật', // RSV:300
  forbiddenBody: 'Chỉ người có quyền quản trị dự án mới xem được mục này.', // RSV:303
  generic: 'Hệ thống đã ghi nhận và sẽ kiểm tra. Hãy thử lại sau ít phút.', // I18N errors.unknown.description
  notFoundTitle: 'Không tìm thấy dự án này', // PSG:37
  notFoundBody: 'Dự án có thể đã bị xoá, đường dẫn chưa đúng, hoặc bạn chưa được thêm vào dự án.', // PSG:38-39
  backToProjects: 'Về danh sách dự án', // PSG:40
  dashboardTitle: 'Dự án của tôi', // support/auth.ts DASHBOARD_TITLE
  // autosave indicator (i18n autosave.* / common.saved_at)
  idle: 'Chưa có thay đổi',
  dirty: 'Có thay đổi chờ đồng bộ',
  saving: 'Đang lưu…',
  failed: 'Lưu thất bại. Hệ thống sẽ thử lưu lại ở lần chỉnh sửa tới.',
  offline: 'Ngoại tuyến — sẽ lưu khi có mạng',
  savedAt: /^Đã lưu lúc .+$/u,
  terminal: /^(Chưa có thay đổi|Đã lưu .+|Lưu thất bại.+|Ngoại tuyến.+)$/u,
} as const;

/** Rule names = `Rule.name` (registry.ts / function/index.ts / geometry/index.ts). */
export const WALL_THICKNESS = { code: 'WALL-THICKNESS', name: 'Bề dày tường nằm trong khoảng dựng được' } as const;
export const WALL_LENGTH = { code: 'WALL-LENGTH', name: 'Tường đủ dài để dựng' } as const;
export const WALL_OVERLAP = { code: 'WALL-OVERLAP', name: 'Không có hai tường chồng lên nhau' } as const;
export const DOOR_WIDTH = { code: 'DOOR-WIDTH', name: 'Cửa đi đủ rộng để lọt người' } as const;
export const ROOM_UNNAMED = { code: 'ROOM-UNNAMED', name: 'Phòng đã được đặt tên' } as const;
export const ROOM_HAS_DOOR = { code: 'ROOM-HAS-DOOR', name: 'Phòng có lối vào' } as const; // superseded by ROOM-NO-DOOR
export const ROOM_NO_DOOR = { code: 'ROOM-NO-DOOR', name: 'Phòng nào cũng có lối vào' } as const;
export const ROOM_MIN_AREA = { code: 'ROOM-MIN-AREA', name: 'Phòng đủ diện tích cho công năng của nó' } as const; // superseded
export const ROOM_AREA_BELOW = { code: 'ROOM-AREA-BELOW-MINIMUM', name: 'Phòng đủ diện tích cho công năng' } as const;
export const LEVEL_ELEVATION = { code: 'LEVEL-ELEVATION', name: 'Cao độ các tầng tăng dần từ dưới lên' } as const;

/** RULE_GROUP_LABELS (registry.ts:84-90) in screen order, with the section id suffix (RSV:57,66). */
export const GROUPS = [
  { id: 'geometry', label: 'Hình học' },
  { id: 'circulation', label: 'Lưu thông' },
  { id: 'area', label: 'Diện tích' },
  { id: 'annotation', label: 'Ghi chú' },
  { id: 'levels', label: 'Cao độ tầng' },
] as const;

/** thresholdSpecs.ts:130-140 (30..200 mm, default 60) — the threshold most steps edit. */
export const MIN_THICKNESS = { key: 'wall.minThicknessMm', label: 'Bề dày tường tối thiểu', valid: '45', dflt: '60' } as const;

/** src/lib/format/sentence.ts `lowerFirst`, as RSR:146 / RSG:67 build the switch names. */
export const lowerFirst = (text: string): string => text.charAt(0).toLocaleLowerCase('vi') + text.slice(1);
export const ruleSwitchName = (sentence: string): string => `Bật hoặc tắt luật: ${lowerFirst(sentence)}`; // RSR:146
export const groupSwitchName = (label: string): string => `Bật hoặc tắt cả nhóm: ${lowerFirst(label)}`; // RSG:67
export const severityName = (sentence: string): string => `Mức độ của luật: ${sentence}`; // RSR:70

/* ---------------------------------------------------------------------------------------------- locators */

export const ruleSwitch = (page: Page, sentence: string): Locator =>
  page.getByRole('switch', { name: ruleSwitchName(sentence), exact: true });
export const groupSwitch = (page: Page, label: string): Locator =>
  page.getByRole('switch', { name: groupSwitchName(label), exact: true });
export const severityCombo = (page: Page, sentence: string): Locator =>
  page.getByRole('combobox', { name: severityName(sentence), exact: true });
export const numberField = (page: Page, label: string): Locator => page.getByRole('textbox', { name: label, exact: true });
export const groupCard = (page: Page, label: string): Locator => page.getByRole('region', { name: label, exact: true });
export const allRuleSwitches = (page: Page): Locator => page.getByRole('switch', { name: /^Bật hoặc tắt luật: /u });
export const heading = (page: Page): Locator => page.getByRole('heading', { name: RS.heading, level: 2 });
/** The autosave indicator in the screen header (SaveIndicator.tsx role=status). */
export const indicator = (page: Page): Locator =>
  page.locator('header', { has: page.getByRole('heading', { name: RS.heading, level: 2 }) }).getByRole('status');
export const toastRegion = (page: Page): Locator => page.getByRole('region', { name: RS.toastRegion, exact: true });
/** The toast (role=status inside the "Thông báo" region) whose text contains `message`. */
export const toast = (page: Page, message: string | RegExp): Locator =>
  toastRegion(page).getByRole('status').filter({ hasText: message });
export const stickyFooter = (page: Page): Locator => page.locator('footer').filter({ hasText: RS.stickyNote });
export const dialogReload = (page: Page): Locator => page.getByRole('dialog').filter({ hasText: RS.reloadTitle });
export const ruleConfigRe = (projectId: string): RegExp => new RegExp(`^/api/projects/${escapeRegExp(projectId)}/rule-config$`, 'u');
export const spatialRe = (projectId: string): RegExp => new RegExp(`^/api/projects/${escapeRegExp(projectId)}/spatial$`, 'u');

/** Screenshot named by the plan: `E06s_<row id>_<slug>.png` (`U06s_…` in the ui file). */
export async function shot(page: Page, id: string, slug: string, prefix: 'E06s' | 'U06s' = 'E06s'): Promise<void> {
  await captureEvidence(page, `${prefix}_${id}_${slug}.png`);
}

/** Bounding box of a visible locator (throws when it has none). */
export async function boxOf(locator: Locator): Promise<{ x: number; y: number; width: number; height: number }> {
  const box = await locator.boundingBox();
  if (box === null) throw new Error('boxOf: the element has no box (not rendered)');
  return box;
}

/** Two animation frames (a real "the page painted" mark, not a timed wait). */
export const frames = (page: Page, n = 2): Promise<void> =>
  page.evaluate(
    (count) =>
      new Promise<void>((resolve) => {
        let seen = 0;
        const step = (): void => {
          seen += 1;
          if (seen >= count) resolve();
          else requestAnimationFrame(step);
        };
        requestAnimationFrame(step);
      }),
    n,
  );

/** Waits until the indicator is in a resting state (idle / saved / failed / offline), i.e. no save is pending or running. */
export async function settled(page: Page): Promise<void> {
  await expect(indicator(page)).toHaveText(RS.terminal);
}

/* ---------------------------------------------------------------------------------------------- sessions */

export interface Credentials {
  readonly email: string;
  readonly password: string;
}

export interface PutSent {
  readonly baseVersion: unknown;
  readonly body: Json;
  readonly overrides: Json;
  readonly topKeys: string[];
}

export interface Session {
  readonly context: BrowserContext;
  readonly page: Page;
  /** Every `/api/` response of the page, in arrival order. */
  readonly log: ApiEntry[];
  /** Every `PUT …/rule-config` request the page sent, in send order (index = mark). */
  readonly sent: PutSent[];
}

const parsePut = (raw: unknown): PutSent => {
  const top = typeof raw === 'object' && raw !== null && !Array.isArray(raw) ? (raw as Json) : {};
  const body = typeof top.body === 'object' && top.body !== null && !Array.isArray(top.body) ? (top.body as Json) : {};
  const overrides = typeof body.overrides === 'object' && body.overrides !== null ? (body.overrides as Json) : {};
  return { baseVersion: top.baseVersion, body, overrides, topKeys: Object.keys(top).sort() };
};

/** JSON body of a request, `null` when it has none or it is not JSON. */
export function jsonOf(request: { postDataJSON: () => unknown }): unknown {
  try {
    return request.postDataJSON();
  } catch {
    return null;
  }
}

const isRuleConfigPut = (method: string, url: string): boolean =>
  method === 'PUT' && /\/api\/projects\/[^/]+\/rule-config$/u.test(new URL(url).pathname);

// dup-of: p03/P5.ts openFlow (login through the context's own cookie jar, page + response log), plus the PUT list.
export async function openSession(browser: Browser, who: Credentials, viewport: Viewport = DESKTOP): Promise<Session> {
  const context = await browser.newContext({ baseURL: readBaseUrl(), viewport });
  try {
    const res = await context.request.post('/api/auth/login', {
      data: { email: who.email, password: who.password, rememberMe: false },
      headers: { Origin: readBaseUrl() },
    });
    expect(res.status(), 'setup: POST /api/auth/login (session)').toBe(204);
    const page = await context.newPage();
    const sent: PutSent[] = [];
    page.on('request', (request) => {
      if (isRuleConfigPut(request.method(), request.url())) sent.push(parsePut(jsonOf(request)));
    });
    return { context, page, log: watchApi(page), sent };
  } catch (error) {
    await context.close();
    throw error;
  }
}

export async function closeSession(session: Session): Promise<void> {
  await session.context.close().catch(() => undefined);
}

export const adminCreds = (): Credentials => readAdminCredentials();

export interface ApiCtx {
  readonly browser: Browser;
  /** Admin API client (Bearer). */
  readonly api: APIRequestContext;
  /** Project ids this flow owns; deleted in `finally`. */
  readonly ids: string[];
}

export interface Ctx extends ApiCtx, Session {}

/** Admin API only (the flow opens its own sessions). */
export async function withApi(browser: Browser, body: (ctx: ApiCtx) => Promise<void>): Promise<void> {
  const { email, password } = adminCreds();
  const api = await signedInApi(email, password);
  const ids: string[] = [];
  try {
    await body({ browser, api, ids });
  } finally {
    await dropProjects(api, ids);
    await api.dispose();
  }
}

/** Admin API + an admin browser session at `viewport`. */
export async function withAdmin(browser: Browser, body: (ctx: Ctx) => Promise<void>, viewport: Viewport = DESKTOP): Promise<void> {
  await withApi(browser, async (base) => {
    const session = await openSession(browser, adminCreds(), viewport);
    try {
      await body({ ...base, ...session });
    } finally {
      await closeSession(session);
    }
  });
}

/** Own run-unique project with one floor and no layer ("B1"), registered for cleanup. */
export async function ownProject(ctx: Pick<ApiCtx, 'api' | 'ids'>, slug: string): Promise<SeededProject> {
  const project = await createProject(ctx.api, slug, 1);
  ctx.ids.push(project.projectId);
  return project;
}

export async function dropProjects(api: APIRequestContext, ids: readonly string[]): Promise<void> {
  const failures: string[] = [];
  for (const id of ids) {
    const failed = await deleteSeededProject(api, id);
    if (failed !== null) failures.push(failed);
  }
  if (failures.length > 0) test.info().annotations.push({ type: 'cleanup', description: failures.join('; ') });
}

/* ---------------------------------------------------------------------------------------------- N21 / N22 through the API ("+X") */

/** N21 revision of a project's rule config (0 before the first save). */
export async function readRevision(api: APIRequestContext, projectId: string): Promise<number> {
  const res = await api.get(`/api/projects/${projectId}/rule-config`);
  expect(res.status(), 'setup: GET rule-config (N21)').toBe(200);
  return Number(asRecord(await res.json(), 'N21').revision);
}

/** N22 `{baseVersion, body:{overrides}}` (BE:apps/api/rules/router.py:29-37); returns status + new revision. */
export async function putRuleConfig(
  api: APIRequestContext,
  projectId: string,
  baseVersion: number,
  overrides: Json,
): Promise<{ status: number; revision: number }> {
  const res = await api.put(`/api/projects/${projectId}/rule-config`, { data: { baseVersion, body: { overrides } } });
  const revision = res.ok() ? Number(asRecord(await res.json(), 'N22').revision) : Number.NaN;
  return { status: res.status(), revision };
}

/** "+X": another writer sets `overrides` on top of the revision the server holds now; returns the new revision. */
export async function writeElsewhere(api: APIRequestContext, projectId: string, overrides: Json): Promise<number> {
  const base = await readRevision(api, projectId);
  const done = await putRuleConfig(api, projectId, base, overrides);
  expect(done.status, 'setup: N22 PUT by another writer').toBe(200);
  return done.revision;
}

/* ---------------------------------------------------------------------------------------------- screen */

/** Opens the settings route with a fresh document load, waits for its N21 (200) and for a switch to be drawn. */
export async function openSettings(page: Page, projectId: string): Promise<ApiResult> {
  const got = await navigateThenWaitForApi(
    page,
    () => page.goto(ROUTES.project.ruleSettings(projectId), { waitUntil: 'commit' }),
    'GET',
    ruleConfigRe(projectId),
    [200],
  );
  await expect(heading(page)).toBeVisible();
  await expect(ruleSwitch(page, WALL_THICKNESS.name)).toBeVisible();
  return got;
}

/** The next `PUT …/rule-config` answered with one of `statuses`, optionally filtered by its request body. */
export function waitRulePut(
  page: Page,
  projectId: string,
  pick?: (sent: PutSent) => boolean,
  statuses: readonly number[] = [200],
  timeout: number = AUTOSAVE_TIMEOUT_MS,
): Promise<ApiResult> {
  const path = ruleConfigRe(projectId);
  return waitForApiWhere(
    page,
    (response) =>
      response.request().method() === 'PUT' &&
      path.test(new URL(response.url()).pathname) &&
      statuses.includes(response.status()) &&
      (pick === undefined || pick(parsePut(jsonOf(response.request())))),
    timeout,
    `PUT rule-config ${statuses.join('/')}`,
  );
}

/** Request body of an awaited PUT. */
export const putOf = (result: ApiResult): PutSent => parsePut(jsonOf(result.response.request()));
/** `revision` of an awaited 200 PUT answer. */
export const revisionOf = (result: ApiResult): number => Number(asRecord(result.json, 'PUT answer').revision);
/** The override object of one rule code in a PUT body, `undefined` when absent. */
export const overrideOf = (sent: PutSent, code: string): Json | undefined => {
  const value = sent.overrides[code];
  return typeof value === 'object' && value !== null ? (value as Json) : undefined;
};

/** `overrides[code].thresholds[key]` of a PUT body, `undefined` when absent. */
export const thresholdOf = (sent: PutSent, code: string, key: string): unknown => {
  const thresholds = overrideOf(sent, code)?.thresholds;
  return typeof thresholds === 'object' && thresholds !== null ? (thresholds as Json)[key] : undefined;
};

/** In-app navigation without a reload (history + popstate; the data router listens). dup-of: p03/P9.ts spaNavigate. */
export async function spaNavigate(page: Page, path: string): Promise<void> {
  await page.evaluate((to) => {
    window.history.pushState(null, '', to);
    window.dispatchEvent(new PopStateEvent('popstate', { state: null }));
  }, path);
}

/** `GET …/rule-config` responses of the page since `mark` (index into `Session.log`). */
export const getsSince = (log: readonly ApiEntry[], mark: number, projectId: string): number =>
  log.slice(mark).filter((entry) => entry.method === 'GET' && ruleConfigRe(projectId).test(entry.path)).length;

/**
 * Sure marker for "no PUT since `mark`": one deliberate write (switch `ROOM-UNNAMED`, group "Ghi chú"), awaited; returns the PUT
 * bodies that were sent between `mark` and that write, i.e. the strays. A stray change made less than 800 ms before the
 * deliberate click is MERGED into the deliberate PUT by the debounce (createAutosave.ts armTimers), not sent first: callers that
 * need that case also read the deliberate body (`session.sent[last]`). The deliberate write leaves `ROOM-UNNAMED` off: use it only where later steps
 * do not depend on that rule.
 */
export async function strayPuts(session: Session, projectId: string, mark: number): Promise<PutSent[]> {
  const { page } = session;
  const put = waitRulePut(page, projectId);
  await ruleSwitch(page, ROOM_UNNAMED.name).click();
  await put;
  return session.sent.slice(mark, -1);
}

/* ---------------------------------------------------------------------------------------------- in-page recorder */

declare global {
  interface Window {
    __qaIndicator?: string[];
    __qaPartial?: string[];
    __qaAnnounced?: string[];
  }
}

/**
 * Call BEFORE the first `goto`. Records, from page start: the distinct consecutive texts of the screen's save indicator
 * (`__qaIndicator`), every moment the "Đang tải thêm dữ liệu bộ luật…" line was on screen with the indicator text at that
 * moment (`__qaPartial`), and the distinct texts the app announcer wrote (`__qaAnnounced`, `[data-announcer]`).
 * A transient state (800 ms "pending", a short "Đang lưu…") cannot be caught by a poll, a MutationObserver can.
 */
export async function recordUi(page: Page): Promise<void> {
  await page.addInitScript(() => {
    const w = window;
    w.__qaIndicator = [];
    w.__qaPartial = [];
    w.__qaAnnounced = [];
    const scan = (): void => {
      const text = document.querySelector('header:has(h2) [role="status"]')?.textContent?.trim() ?? '';
      const seen = w.__qaIndicator ?? [];
      if (text !== '' && seen[seen.length - 1] !== text) seen.push(text);
      for (const p of document.querySelectorAll('p')) {
        if (p.textContent === 'Đang tải thêm dữ liệu bộ luật…') {
          w.__qaPartial?.push(text);
          break;
        }
      }
      for (const node of document.querySelectorAll('[data-announcer]')) {
        const said = node.textContent?.replace(/ /gu, ' ').trim() ?? '';
        if (said !== '' && !(w.__qaAnnounced ?? []).includes(said)) w.__qaAnnounced?.push(said);
      }
    };
    new MutationObserver(scan).observe(document, { subtree: true, childList: true, characterData: true });
  });
}

export async function recorded(page: Page): Promise<{ indicator: string[]; partial: string[]; announced: string[] }> {
  return page.evaluate(() => ({
    indicator: [...(window.__qaIndicator ?? [])],
    partial: [...(window.__qaPartial ?? [])],
    announced: [...(window.__qaAnnounced ?? [])],
  }));
}

/** Forgets what the recorder has seen so far (a step wants only its own sequence). */
export async function clearRecorded(page: Page): Promise<void> {
  await page.evaluate(() => {
    for (const list of [window.__qaIndicator, window.__qaPartial, window.__qaAnnounced]) if (list) list.length = 0;
  });
}

/** True when `texts` contains `wanted` in this order (not necessarily adjacent). */
export function inOrder(texts: readonly string[], wanted: readonly (string | RegExp)[]): boolean {
  let from = 0;
  for (const want of wanted) {
    const at = texts.findIndex((text, index) => index >= from && (typeof want === 'string' ? text === want : want.test(text)));
    if (at < 0) return false;
    from = at + 1;
  }
  return true;
}
