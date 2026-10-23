/**
 * QA-06b pack P2 helpers: the rule-report screen (SCR-28) plus the shared pipeline project of `phase06_pipeline.spec.ts`.
 * Owned by P2 only. `ruleLayer` / `createRuleProject` / `openRules` come from P1's `./rules` (S4 review). Still copied here
 * (`dup-of: rules.ts`): settledInt, summaryValue, levelFilter, rerunButton, groupExpanders, sheetOf, findingRows, spatialRe, ruleConfigRe, escapeRegExp, pathOf.
 *
 * Budget: none of these helpers logs in; `seedMainPipeline` costs 1 `drawings_init` (60 / 600 s per user), 1 project, one
 * #35 layer PUT, 1 DELETE (`deleteSeededProject`). `createRuleProject` costs 1 project + 1 #35 PUT per layered floor.
 */
import { expect, type APIRequestContext, type Locator, type Page, type Route } from '@playwright/test';

import { type ApiEntry } from '../../../../e2e/fullstack/apiWatch';
import { createPipelineProject, type SeededDrawing } from '../drawingSeed';
import { qcLayer, writeLayer, type LayerApi } from '../layerSeed';
import { createRuleProject, openRules, type Admin, type RuleProjectOpts } from './rules';

export type Json = Record<string, unknown>;

export const VIEWPORT = { width: 1440, height: 900 } as const;
/** react-query / HTTP ladder retry a failed read before the error state paints (cachePolicy.ts:74-82). */
export const ERROR_PAINT_TIMEOUT_MS = 30_000;
const REFRESH_API = '/api/auth/refresh';

export const asRecord = (value: unknown, what: string): Json => {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) throw new Error(`${what}: not a JSON object`);
  return value as Json;
};
export const escapeRegExp = (text: string): string => text.replace(/[.*+?^${}()|[\]\\]/gu, '\\$&');
export const pathOf = (page: Page): string => new URL(page.url()).pathname;
export const ruleConfigRe = (projectId: string): RegExp => new RegExp(`^/api/projects/${escapeRegExp(projectId)}/rule-config$`, 'u');
export const spatialRe = (projectId: string): RegExp => new RegExp(`^/api/projects/${escapeRegExp(projectId)}/spatial$`, 'u');
export const layerRe = (projectId: string): RegExp => new RegExp(`^/api/projects/${escapeRegExp(projectId)}/floors/[^/]+/spatial/layer$`, 'u');

/** Requests the page sent since `mark`, minus session / telemetry chatter. */
export const requestsSince = (log: readonly ApiEntry[], mark: number): ApiEntry[] =>
  log.slice(mark).filter((entry) => entry.path !== REFRESH_API && !entry.path.startsWith('/api/telemetry'));

/* ---- SCR-28 copy (each from RuleReport*.tsx / ViolationDetail*.tsx / ProjectSpatialGate.tsx) ---- */
export const RR = {
  heading: 'Quy chuẩn',
  trail: 'Đường dẫn trang',
  rerun: 'Chạy kiểm tra lại',
  settingsLink: 'Cài đặt bộ luật',
  confirm: 'Xác nhận đã xử lý',
  doneText: 'Không phát hiện vi phạm nào.',
  errorTitle: 'Không chạy được lượt kiểm tra',
  configFailed: 'Không tải được cấu hình bộ luật của dự án.',
  retry: 'Thử lại',
  noMatch: 'Không có mục nào khớp bộ lọc đang đặt. Nới bộ lọc để xem thêm.',
  levelFilter: 'Lọc theo mức độ',
  view: 'Xem',
  columns: ['Mức độ', 'Mô tả', 'Tầng', 'Mã đối tượng'],
  sheet: 'Chi tiết vi phạm',
  sheetClose: 'Đóng tấm trượt chi tiết vi phạm',
  deleteAction: 'Xoá đối tượng này',
  resolved: 'Đã xử lý',
  refreshFailed: 'Không tải lại được mô hình.',
  addFloorLink: 'Thêm tầng cho mô hình',
  backToProjects: 'Về danh sách dự án',
  noAutoFix: 'Chưa có cách sửa tự động nào cho vi phạm này. Phần căn cứ ở trên đủ để sửa tay trên Bản vẽ.',
  unnamedRoom: 'Có phòng chưa đặt tên nên chưa lưu được tầng này. Đặt tên cho phòng đó rồi lưu lại.',
  saveUnknown: 'Không lưu được thay đổi của tầng này.',
  offline: 'Ngoại tuyến — sẽ lưu khi có mạng',
} as const;
/** Rule names (domain/rules registry + function group) the seeded R1 layer fires. */
export const RULE_NAME = {
  furnitureClash: 'Đồ đạc không chồng lên tường hay lên nhau',
  wallLength: 'Tường đủ dài để dựng',
} as const;

/* ---- SCR-28 locators ---- */
export const levelFilter = (page: Page): Locator => page.getByRole('radiogroup', { name: RR.levelFilter, exact: true });
export const rerunButton = (page: Page): Locator => page.getByRole('button', { name: RR.rerun, exact: true });
/** RuleReportGroups: the group toggle is a button inside an `<h3>`. */
export const groupExpanders = (page: Page): Locator => page.getByRole('heading', { level: 2 }).getByRole('button');
export const summaryValue = (page: Page, label: string): Locator =>
  page
    .locator('dl > div')
    .filter({ has: page.locator('dt').filter({ hasText: new RegExp(`^${label}$`, 'u') }) })
    .locator('dd');
export const sheetOf = (page: Page): Locator => page.getByRole('complementary', { name: RR.sheet });
/** A table row (>= 1024) or a card (below). */
export const findingRows = (section: Locator): Locator => section.getByRole('row').or(section.getByRole('listitem'));

/** A count-up number once two reads 400 ms apart agree; vi grouping "." removed (`useCountUp`). */
export async function settledInt(locator: Locator): Promise<number> {
  let last = '';
  await expect
    .poll(
      async () => {
        const now = (await locator.innerText()).trim();
        const same = now === last && now !== '';
        last = now;
        return same;
      },
      { message: 'count-up never settled', intervals: [400] },
    )
    .toBe(true);
  return Number(last.replace(/\./gu, ''));
}

export { openRules };

/**
 * Expands the group whose header contains `ruleName`, or the first collapsed one (index fixed BEFORE the click, so the
 * locator cannot drift to the next collapsed group); returns its `<section>`.
 */
export async function expandGroup(page: Page, ruleName?: string): Promise<Locator> {
  let expander: Locator;
  if (ruleName === undefined) {
    const states = await groupExpanders(page).evaluateAll((els) => els.map((el) => el.getAttribute('aria-expanded')));
    const index = states.indexOf('false');
    expect(index, 'a collapsed rule group').toBeGreaterThanOrEqual(0);
    expander = groupExpanders(page).nth(index);
  } else {
    expander = groupExpanders(page).filter({ hasText: ruleName }).first();
  }
  await expect(expander).toBeVisible();
  if ((await expander.getAttribute('aria-expanded')) !== 'true') await expander.click();
  await expect(expander).toHaveAttribute('aria-expanded', 'true');
  return expander.locator('xpath=ancestor::section[1]');
}

/** A row of `section` that has a floor (the sheet needs one: RuleReport.container `activeFloorId ?? row.levelId`). */
export function rowWithFloor(page: Page, section: Locator): Locator {
  return findingRows(section)
    .filter({ has: page.getByRole('button', { name: RR.view, exact: true }) })
    .filter({ hasNot: page.getByText('—', { exact: true }) });
}

/** Clicks the message of the `index`-th row with a floor and waits for the sheet. */
export async function openSheetOnRow(page: Page, section: Locator, index = 0): Promise<Locator> {
  await rowWithFloor(page, section).nth(index).getByRole('button').first().click();
  const sheet = sheetOf(page);
  await expect(sheet).toBeVisible();
  await expect(sheet.getByRole('heading', { level: 2 })).toBeVisible();
  // the panel slides in (framer-motion): wait until two consecutive x readings agree before anything is measured
  let last = Number.NaN;
  await expect
    .poll(async () => {
      const x = (await sheet.boundingBox())?.x ?? Number.NaN;
      const settled = x === last;
      last = x;
      return settled;
    })
    .toBe(true);
  return sheet;
}

/** Opens `/rules`, the group of `ruleName`, and the sheet on its first row with a floor. */
export async function openRuleSheet(page: Page, projectId: string, ruleName: string, index = 0): Promise<Locator> {
  await openRules(page, projectId);
  const section = await expandGroup(page, ruleName);
  return openSheetOnRow(page, section, index);
}

/** A JSON 500 for one GET path (other requests fall through). `counter.served` counts the answers given. */
export function failGet(matcher: RegExp, counter: { served: number }): (route: Route) => Promise<void> {
  return async (route) => {
    if (route.request().method() !== 'GET' || !matcher.test(new URL(route.request().url()).pathname)) {
      await route.fallback();
      return;
    }
    counter.served += 1;
    await route.fulfill({ status: 500, contentType: 'application/json', body: JSON.stringify({ detail: 'qa-06b mocked 500' }) });
  };
}

/** A promise a route handler awaits: `release()` lets every held request through. */
export function makeGate(): { readonly open: Promise<void>; readonly release: () => void } {
  let release: () => void = () => undefined;
  const open = new Promise<void>((resolve) => {
    release = resolve;
  });
  return { open, release };
}

/* ---- seeds ---- */

/**
 * Thin adapter over P1's `rules.ts` createRuleProject (which wants an `Admin`): returns the project and its floors.
 * rules.ts pushes the project id to `cleanup` right after the POST, so a failing layer write does not leak the project
 * as long as the caller deletes `cleanup`.
 */
export async function createRuleProjectFor(
  api: LayerApi,
  slug: string,
  opts: RuleProjectOpts = {},
  cleanup: string[] = [],
): Promise<{ projectId: string; floors: { id: string; name: string }[] }> {
  const project = await createRuleProject({ fx: api, cleanup } as unknown as Admin, slug, opts);
  return { projectId: project.id, floors: project.floors.map((floor) => ({ id: floor.id, name: floor.name })) };
}

/**
 * The shared pipeline project of `phase06_pipeline.spec.ts` (flows-C5 Seeds `MP`): the fake-ML run with its "before" +
 * "after" versions, then ONE qcLayer write so no row is "Hiện tại" and v2 is restorable. Needs `E2E_DRAWING_PNG`.
 */
export async function seedMainPipeline(fixtureApi: APIRequestContext, png: Buffer): Promise<SeededDrawing> {
  const seeded = await createPipelineProject(fixtureApi, 'm06', png);
  await writeLayer({ request: fixtureApi, headers: {} }, seeded.projectId, seeded.floorId, qcLayer);
  return seeded;
}
