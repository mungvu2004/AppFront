/**
 * Phase 3: project setup, upload and pipeline (E2E-TEST-PLAN.md v2, §4 Phase 3), Track A, admin,
 * CP-2 → CP-3 → CP-4 → CP-5. SCR-08 → SCR-15.
 *
 * ORDER EXCEPTION (plan §4 Phase 3 + §5): the matrix deliberately interleaves screens instead of
 * finishing one screen before the next: SCR-10 upload (CP-4) → SCR-12 pipeline IMMEDIATELY → back to
 * SCR-10 (blocked / rejected) → SCR-11 → SCR-13 → SCR-15. The fake ML finishes in seconds, and the
 * processing screen does NOT open the SSE stream for a run that is already final when it loads
 * (`useProcessingScreen.ts`, chain.fullstack.ts step 6), so any detour between upload `complete`
 * and `/pipeline` would lose the SSE evidence. The describes below follow that order.
 *
 * Contracts verified in source (c4978eb4):
 * - Settings: "Ghi chú"/units → `PUT /api/projects/:id/settings` `{baseVersion, body}` only
 *   (`projectSettingsGateway.ts` `writeUnits`); name/code/address → `PATCH /api/projects/:id` with
 *   only those keys (`toWireBody`). Autosave 800 ms (`createAutosave`). Toast "Đã lưu cài đặt dự án.".
 *   Labels: address input is "Địa chỉ" (`GeneralTab.tsx`); unit options are
 *   "Milimét (mm)" / "Mét (m)" (`useProjectSettings.ts` LENGTH_UNIT_OPTIONS; capitalised by BUG-099, A6).
 * - Floors: `POST /api/projects/:id/floors` → `FloorSchema` (`id`, `name`, `heightMm`, `elevationMm`);
 *   field edits → `PATCH /api/projects/:id/floors/:fid/spatial` (→ `FloorSchema`); reorder →
 *   `PATCH /api/floors/reorder` `{floorIds}`. Row `<tr aria-label="{name}, cao độ …">`; section band
 *   `role=button` named `"{name} · {height}"` (`bandLabel`, useFloorManager.ts) — NOT `"{name}, cao…"`
 *   as the plan row says (that is the `<tr>` label).
 * - Upload: init `POST …/floors/:fid/drawings/uploads` → `ProgressSchema`, whose `id` IS the uploadId
 *   (`uploadTask.ts`: `const uploadId = init.result.data.id`), then `…/uploads/:uid/chunks`,
 *   `…/uploads/:uid/complete`. SSE `/api/streams/projects/:id/uploads/:uid/progress`.
 */
import { existsSync, writeFileSync } from 'node:fs';

import { expect, test, type BrowserContext, type Locator, type Page } from '@playwright/test';

import { ROUTES } from '../../e2e/fixtures/routes';
import { waitForApi, watchApi, watchSse, type ApiEntry, type SseWatch } from '../../e2e/fullstack/apiWatch';
import { PIPELINE_TIMEOUT_MS, readBaseUrl } from '../../e2e/fullstack/env';
import { signInAdmin } from './support/auth';
import { captureEvidence } from './support/evidence';
import { readState, requireState, updateState } from './support/state';

test.describe.configure({ mode: 'serial' });

const VIEWPORT = { width: 1440, height: 900 } as const;
/** `useShortcut` "Mod" = Meta on macOS, Control elsewhere. */
const MOD = process.platform === 'darwin' ? 'Meta' : 'Control';
/** Same pattern the chain uses to pull an error code out of the failure screen. */
const ERROR_CODE_PATTERN = /\b[A-Z][A-Z0-9_]{2,}\b/u;
/** `useProjectSettings.ts` SAVED_TOAST_MESSAGE. */
const SETTINGS_SAVED_TOAST = 'Đã lưu cài đặt dự án.';
/** `FloorManager.tsx` / `floorManagerGateway.ts` FLOOR_MANAGER_UNSUPPORTED_NOTICES.hideFloorFrom3d. */
const SESSION_ONLY_HEADING = 'Những thay đổi chỉ sống trong phiên làm việc này';
const HIDE_3D_NOTICE =
  'Ẩn tầng khỏi mô hình 3d chỉ có hiệu lực trong phiên làm việc này; hệ thống chưa có chỗ lưu lựa chọn đó nên nó mất sau khi tải lại trang.';
/** `useInputQualityGate.ts` COPY. */
const QUALITY_ACK_LABEL = 'Tôi đã đọc cảnh báo và vẫn muốn xử lý bản vẽ này';
/** `InputQualityGateFooter.tsx` CONTINUE_BLOCKED_ACKNOWLEDGEMENT. */
const QUALITY_ACK_BLOCKED = 'Đánh dấu ô xác nhận bên trên rồi thử lại.';

type Json = Record<string, unknown>;

/* ---- phase-local helpers ---- */

const escapeRegExp = (text: string): string => text.replace(/[.*+?^${}()|[\]\\]/gu, '\\$&');
const pathOf = (page: Page): string => new URL(page.url()).pathname;

function asRecord(value: unknown, what: string): Json {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    throw new Error(`${what}: body is not a JSON object: ${JSON.stringify(value)}`);
  }
  return value as Json;
}

function stringField(body: unknown, key: string, what: string): string {
  const value = asRecord(body, what)[key];
  if (typeof value !== 'string' || value === '') throw new Error(`${what}: no string "${key}" in ${JSON.stringify(body)}`);
  return value;
}

function numberField(body: unknown, key: string, what: string): number {
  const value = asRecord(body, what)[key];
  if (typeof value !== 'number') throw new Error(`${what}: no number "${key}" in ${JSON.stringify(body)}`);
  return value;
}

/** A metre value as `NumericField` shows it (`formatNumber`, vi-VN: "." groups, "," decimals) → mm. */
function metresTextToMm(text: string, what: string): number {
  const metres = Number(text.trim().replace(/\./gu, '').replace(',', '.'));
  if (text.trim() === '' || !Number.isFinite(metres)) throw new Error(`${what}: unreadable metre value "${text}"`);
  return Math.round(metres * 1000);
}

/** The env drawing (README precondition, `render_plan(7)` PNG). FAILS clearly when unset or wrong. */
function drawingPng(): string {
  const value = process.env.E2E_DRAWING_PNG?.trim();
  if (value === undefined || value === '') throw new Error('E2E_DRAWING_PNG is not set (CP-4 needs a .png drawing; see e2e/fullstack/README.md).');
  if (!value.toLowerCase().endsWith('.png') || !existsSync(value)) {
    throw new Error(`E2E_DRAWING_PNG is not an existing .png file: ${value}`);
  }
  return value;
}

const writesSince = (log: readonly ApiEntry[], mark: number): string[] =>
  log.slice(mark).filter((entry) => entry.method !== 'GET').map((entry) => `${entry.method} ${entry.path} ${String(entry.status)}`);

const countSince = (log: readonly ApiEntry[], mark: number, method: string, path: RegExp): number =>
  log.slice(mark).filter((entry) => entry.method === method && path.test(entry.path)).length;

/** Floor rows of the FloorManager table: `<tr aria-label="{name}, cao độ …">` (header row excluded). */
const floorRows = (page: Page): Locator => page.getByRole('row', { name: /, cao độ /u });
const floorRow = (page: Page, name: string): Locator =>
  page.getByRole('row', { name: new RegExp(`^${escapeRegExp(name)}, cao độ `, 'u') });

async function floorRowNames(page: Page): Promise<string[]> {
  const labels = await floorRows(page).evaluateAll((rows) => rows.map((row) => row.getAttribute('aria-label') ?? ''));
  return labels.map((label) => label.replace(/, cao độ .*$/su, ''));
}

/* ---- shared context: the flow continues from one screen to the next ---- */

let context: BrowserContext;
let page: Page;
let api: ApiEntry[];
let sse: SseWatch;
let projectId = '';

test.beforeAll(async ({ browser }) => {
  projectId = requireState((s) => s.project.projectId, 'project.projectId', 'Phase 2');
  // Clipboard permission only so the failure path can read what "Sao chép mã lỗi" copied.
  context = await browser.newContext({
    baseURL: readBaseUrl(),
    viewport: VIEWPORT,
    permissions: ['clipboard-read', 'clipboard-write'],
  });
  page = await context.newPage();
  // Listen before the first navigation (chain step 0).
  sse = await watchSse(page);
  api = watchApi(page);
  await signInAdmin(page);
});

test.afterAll(async () => {
  await context?.close();
});

/* ========================================================================== */
/* SCR-08 Project Settings                                                    */
/* ========================================================================== */

test.describe('SCR-08 Project Settings', () => {
  const settingsPath = (): RegExp => new RegExp(`^/api/projects/${projectId}/settings$`, 'u');
  const projectPath = (): RegExp => new RegExp(`^/api/projects/${projectId}$`, 'u');

  test('SCR-08 tablist "Nhóm cài đặt": Chung / Đơn vị đo / Thành viên / Vùng nguy hiểm', async () => {
    await page.goto(ROUTES.project.settings(projectId));
    const tablist = page.getByRole('tablist', { name: 'Nhóm cài đặt', exact: true });
    await expect(tablist).toBeVisible();

    for (const label of ['Chung', 'Đơn vị đo', 'Thành viên', 'Vùng nguy hiểm']) {
      const tab = tablist.getByRole('tab', { name: label, exact: true });
      await tab.click();
      await expect(tab).toHaveAttribute('aria-selected', 'true');
      await expect(page.getByRole('tabpanel', { name: label, exact: true })).toBeVisible();
    }
    await expect(page.getByRole('textbox', { name: 'Tên dự án', exact: true })).toHaveCount(0);
    await captureEvidence(page, '08_settings_tabs.png');

    await tablist.getByRole('tab', { name: 'Chung', exact: true }).click();
    await expect(page.getByRole('textbox', { name: 'Tên dự án', exact: true })).toBeVisible();
  });

  test('SCR-08 "Ghi chú" edit → only PUT /projects/:id/settings (baseVersion) + toast', async () => {
    const notes = page.getByRole('textbox', { name: 'Ghi chú', exact: true });
    const value = `e2e ghi chú ${String(Date.now())}`;
    const mark = api.length;
    const put = waitForApi(page, 'PUT', settingsPath(), [200]);

    await notes.fill(value);
    const { response } = await put;
    const sent = asRecord(response.request().postDataJSON() as unknown, 'PUT settings request');
    expect(typeof sent.baseVersion, 'PUT settings carries baseVersion').toBe('number');
    expect(asRecord(sent.body, 'PUT settings body').notes).toBe(value);
    await expect(page.getByText(SETTINGS_SAVED_TOAST, { exact: true }).first()).toBeVisible();
    expect(countSince(api, mark, 'PATCH', projectPath()), 'notes must not PATCH /projects/:id').toBe(0);
    await captureEvidence(page, '08_settings_notes_put.png');
  });

  test('SCR-08 "Địa chỉ" edit → PATCH /projects/:id (name/code/address only)', async () => {
    // GeneralTab.tsx label "Địa chỉ" (A6, BUG-099).
    const address = page.getByRole('textbox', { name: 'Địa chỉ', exact: true });
    const value = `e2e địa chỉ ${String(Date.now())}`;
    const patch = waitForApi(page, 'PATCH', projectPath(), [200]);

    await address.fill(value);
    const { response } = await patch;
    const sent = asRecord(response.request().postDataJSON() as unknown, 'PATCH project request');
    expect(Object.keys(sent).filter((key) => !['name', 'code', 'address'].includes(key)), 'PATCH body keys').toEqual([]);
    expect(sent.address).toBe(value);
    await captureEvidence(page, '08_settings_address_patch.png');
  });

  test('SCR-08 "Đơn vị chiều dài" → "Mét (m)" then back to "Milimét (mm)" → PUT settings ×2', async () => {
    await page.getByRole('tablist', { name: 'Nhóm cài đặt', exact: true }).getByRole('tab', { name: 'Đơn vị đo', exact: true }).click();
    const unit = page.getByRole('combobox', { name: 'Đơn vị chiều dài', exact: true });
    await expect(unit).toContainText('Milimét (mm)');

    for (const [label, wire] of [
      ['Mét (m)', 'm'],
      ['Milimét (mm)', 'mm'],
    ] as const) {
      const put = waitForApi(page, 'PUT', settingsPath(), [200]);
      await unit.click();
      await page.getByRole('option', { name: label, exact: true }).click();
      const { response } = await put;
      const body = asRecord(asRecord(response.request().postDataJSON() as unknown, 'PUT settings request').body, 'PUT settings body');
      expect(body.lengthUnit, `PUT settings lengthUnit after "${label}"`).toBe(wire);
      await expect(unit).toContainText(label);
    }
    await captureEvidence(page, '08_settings_units.png');
  });
});

/* ========================================================================== */
/* SCR-09 Floor Manager                                                       */
/* ========================================================================== */

test.describe('SCR-09 Floor Manager', () => {
  const spatialPath = (floorId: string): RegExp =>
    new RegExp(`^/api/projects/${projectId}/floors/${floorId}/spatial$`, 'u');
  const reorderPath = /^\/api\/floors\/reorder$/u;
  const work = (): { id: string; name: string } => ({
    id: requireState((s) => s.floors.workFloorId, 'floors.workFloorId', 'Phase 3 SCR-09 "Thêm tầng"'),
    name: requireState((s) => s.floors.workFloorName, 'floors.workFloorName', 'Phase 3 SCR-09 "Thêm tầng"'),
  });
  const scratch = (): { id: string; name: string } => ({
    id: requireState((s) => s.floors.scratchFloorId, 'floors.scratchFloorId', 'Phase 3 SCR-09 "Thêm tầng"'),
    name: requireState((s) => s.floors.scratchFloorName, 'floors.scratchFloorName', 'Phase 3 SCR-09 "Thêm tầng"'),
  });

  test('SCR-09 "Thêm tầng" ×2 → POST /projects/:id/floors ×2; capture {work}/{scratch} (CP-3)', async () => {
    await page.goto(ROUTES.project.floors(projectId));
    const add = page.getByRole('button', { name: 'Thêm tầng', exact: true });
    await expect(add).toBeVisible();
    await expect(floorRows(page).first()).toBeVisible();

    const created: { id: string; name: string }[] = [];
    for (const what of ['work', 'scratch']) {
      const post = waitForApi(page, 'POST', new RegExp(`^/api/projects/${projectId}/floors$`, 'u'), [200, 201]);
      await add.click();
      const { json } = await post;
      created.push({ id: stringField(json, 'id', `POST floors (${what})`), name: stringField(json, 'name', `POST floors (${what})`) });
    }
    const [workFloor, scratchFloor] = created;
    if (workFloor === undefined || scratchFloor === undefined) throw new Error('two floors were not created');
    updateState((draft) => {
      draft.floors.workFloorId = workFloor.id;
      draft.floors.workFloorName = workFloor.name;
      draft.floors.scratchFloorId = scratchFloor.id;
      draft.floors.scratchFloorName = scratchFloor.name;
    });

    await expect(floorRows(page)).toHaveCount(6);
    for (const floor of created) {
      await expect(floorRow(page, floor.name).getByText('Chưa có bản vẽ', { exact: true })).toBeVisible();
    }
    await captureEvidence(page, '09_floors_added.png');
  });

  test('SCR-09 "Tên tầng {scratch}" rename + Enter → PATCH spatial; rename again + Escape reverts', async () => {
    const old = scratch();
    const renamed = `${old.name} e2e`;
    const patch = waitForApi(page, 'PATCH', spatialPath(old.id), [200]);

    const nameInput = page.getByRole('textbox', { name: `Tên tầng ${old.name}`, exact: true });
    await nameInput.fill(renamed);
    await nameInput.press('Enter');
    const { json } = await patch;
    expect(stringField(json, 'name', 'PATCH spatial (rename)')).toBe(renamed);
    // {scratch} now carries the new name: later phases resolve it from state.
    updateState((draft) => {
      draft.floors.scratchFloorName = renamed;
    });

    const renamedInput = page.getByRole('textbox', { name: `Tên tầng ${renamed}`, exact: true });
    await expect(renamedInput).toHaveValue(renamed);
    const mark = api.length;
    await renamedInput.fill(`${renamed} tạm`);
    await renamedInput.press('Escape');
    await expect(renamedInput).toHaveValue(renamed);
    await expect(renamedInput).not.toBeFocused();
    expect(countSince(api, mark, 'PATCH', spatialPath(old.id)), 'Escape must not PATCH').toBe(0);
    await captureEvidence(page, '09_floor_rename.png');
  });

  test('SCR-09 "Chiều cao tầng {work}" (NumericField commits on change) → PATCH spatial', async () => {
    const floor = work();
    const height = page.getByRole('textbox', { name: `Chiều cao tầng ${floor.name}`, exact: true });
    const beforeMm = metresTextToMm(await height.inputValue(), `Chiều cao tầng ${floor.name}`);
    const patch = waitForApi(page, 'PATCH', spatialPath(floor.id), [200]);

    // ArrowUp = +1 (useNumericField), blur commits.
    await height.focus();
    await height.press('ArrowUp');
    await height.blur();
    const { json } = await patch;
    expect(numberField(json, 'heightMm', 'PATCH spatial (height)')).toBe(beforeMm + 1000);
    await captureEvidence(page, '09_floor_height.png');
  });

  test('SCR-09 middle row <tr> Alt+ArrowUp → PATCH /api/floors/reorder; Mod+Z restores', async () => {
    const before = await floorRowNames(page);
    expect(before).toHaveLength(6);
    const middleIndex = 2;
    const middleName = before[middleIndex];
    const aboveName = before[middleIndex - 1];
    if (middleName === undefined || aboveName === undefined) throw new Error(`unexpected rows: ${before.join(' | ')}`);

    const first = waitForApi(page, 'PATCH', reorderPath, [200]);
    await floorRow(page, middleName).focus();
    await page.keyboard.press('Alt+ArrowUp');
    const { response } = await first;
    const floorIds = asRecord(response.request().postDataJSON() as unknown, 'PATCH reorder request').floorIds;
    expect(Array.isArray(floorIds) ? floorIds.length : -1, 'reorder body floorIds').toBe(6);
    const swapped = [...before];
    swapped[middleIndex - 1] = middleName;
    swapped[middleIndex] = aboveName;
    await expect.poll(() => floorRowNames(page)).toEqual(swapped);
    await captureEvidence(page, '09_floor_reorder.png');

    // Focus a row (not an input: canvas-scope Mod+Z is inert in inputs), then undo.
    const undo = waitForApi(page, 'PATCH', reorderPath, [200]);
    await floorRow(page, middleName).focus();
    await page.keyboard.press(`${MOD}+z`);
    await undo;
    await expect.poll(() => floorRowNames(page)).toEqual(before);
  });

  test('SCR-09 "Thu gọn lát cắt" / "Hiện lát cắt"; band "{work} · …" selects the row', async () => {
    const floor = work();
    const section = page.getByRole('region', { name: 'Lát cắt các tầng theo đúng tỷ lệ chiều cao', exact: true });
    await expect(section).toBeVisible();
    await page.getByRole('button', { name: 'Thu gọn lát cắt', exact: true }).click();
    await expect(section).toHaveCount(0);
    await page.getByRole('button', { name: 'Hiện lát cắt', exact: true }).click();
    await expect(section).toBeVisible();

    // `bandLabel` = "{name} · {height}" (the plan's "{work}, cao" is the <tr> label, not the band).
    await section.getByRole('button', { name: new RegExp(`^${escapeRegExp(floor.name)} · `, 'u') }).click();
    await expect(floorRow(page, floor.name)).toHaveAttribute('aria-selected', 'true');
    await expect(page.getByRole('button', { name: 'Nhân bản tầng', exact: true })).toBeVisible();
    await captureEvidence(page, '09_floor_section.png');
  });

  test('SCR-09 "Tự động tính cao độ" off → "Cao độ tầng {work}" appears; elevation edit → PATCH', async () => {
    const floor = work();
    const top = scratch();
    const auto = page.getByRole('switch', { name: 'Tự động tính cao độ', exact: true });
    await expect(auto).toHaveAttribute('aria-checked', 'true');
    await auto.click();
    await expect(auto).toHaveAttribute('aria-checked', 'false');
    await expect(page.getByRole('textbox', { name: `Cao độ tầng ${floor.name}`, exact: true })).toBeVisible();

    // {work} sits between two floors that touch it, so `validateChangeLevelElevation`
    // (roomFloorCommands.ts) refuses ANY new elevation for it. The only valid elevation edit is on
    // the TOP floor ({scratch}) moved up: assert it is the top row, then raise it by 1 m.
    const names = await floorRowNames(page);
    expect(names.at(-1), 'top floor must be {scratch}').toBe(top.name);
    const elevation = page.getByRole('textbox', { name: `Cao độ tầng ${top.name}`, exact: true });
    const beforeMm = metresTextToMm(await elevation.inputValue(), `Cao độ tầng ${top.name}`);
    const patch = waitForApi(page, 'PATCH', spatialPath(top.id), [200]);
    await elevation.focus();
    await elevation.press('ArrowUp');
    await elevation.blur();
    const { json } = await patch;
    expect(numberField(json, 'elevationMm', 'PATCH spatial (elevation)')).toBe(beforeMm + 1000);
    await captureEvidence(page, '09_floor_elevation.png');

    await auto.click();
    await expect(auto).toHaveAttribute('aria-checked', 'true');
  });

  test('SCR-09 "Thao tác khác cho tầng {scratch}" → "Ẩn khỏi mô hình 3D": session-only notice, no write', async () => {
    const floor = scratch();
    const mark = api.length;
    const more = page.getByRole('button', { name: `Thao tác khác cho tầng ${floor.name}`, exact: true });

    await more.click();
    await page.getByRole('menuitem', { name: 'Ẩn khỏi mô hình 3D', exact: true }).click();
    await expect(page.getByRole('heading', { name: SESSION_ONLY_HEADING, exact: true })).toBeVisible();
    await expect(page.getByText(HIDE_3D_NOTICE, { exact: true })).toBeVisible();
    await more.click();
    const show = page.getByRole('menuitem', { name: 'Hiện trong mô hình 3D', exact: true });
    await expect(show).toBeVisible();
    await captureEvidence(page, '09_floor_hide3d_session.png');

    await show.click();
    expect(writesSince(api, mark), 'hide/show in 3D sends no write (hideFloorFrom3d unsupported)').toEqual([]);
  });
});

/* ========================================================================== */
/* SCR-10 Floor Upload — attach (CP-4). Next: SCR-12 IMMEDIATELY (see header). */
/* ========================================================================== */

test.describe('SCR-10 Floor Upload (CP-4)', () => {
  test('SCR-10 setInputFiles(drawing.png) + "Gán cho tầng khác" = {work} → init → chunks → complete (CP-4)', async () => {
    const file = drawingPng();
    const workId = requireState((s) => s.floors.workFloorId, 'floors.workFloorId', 'Phase 3 SCR-09');
    const workName = requireState((s) => s.floors.workFloorName, 'floors.workFloorName', 'Phase 3 SCR-09');

    await page.goto(ROUTES.project.upload(projectId));
    await expect(page.getByTestId('floor-upload-dropzone')).toBeVisible();
    const init = waitForApi(
      page,
      'POST',
      new RegExp(`^/api/projects/${projectId}/floors/${workId}/drawings/uploads$`, 'u'),
      [200, 201],
    );
    const chunk = waitForApi(page, 'POST', new RegExp(`^/api/projects/${projectId}/drawings/uploads/[^/]+/chunks$`, 'u'), [200, 201, 204]);
    const complete = waitForApi(page, 'POST', new RegExp(`^/api/projects/${projectId}/drawings/uploads/[^/]+/complete$`, 'u'), [200]);

    await page.getByTestId('floor-upload-file-input').setInputFiles(file);
    // The file name names no floor → tray "Tệp chưa gán tầng"; assign it to {work} (chain step 5).
    await page.getByRole('combobox', { name: 'Gán cho tầng khác' }).click();
    await page.getByRole('option', { name: workName, exact: true }).click();

    const uploadId = stringField((await init).json, 'id', 'POST drawings/uploads (init)');
    const chunkPath = new URL((await chunk).response.url()).pathname;
    const completePath = new URL((await complete).response.url()).pathname;
    expect(chunkPath).toContain(`/drawings/uploads/${uploadId}/chunks`);
    expect(completePath).toContain(`/drawings/uploads/${uploadId}/complete`);
    updateState((draft) => {
      draft.checkpoints.uploadId = uploadId;
    });

    await expect(page.locator(`[data-floor-id="${workId}"]`).getByText('Đã gắn kèm', { exact: true })).toBeVisible();
    await captureEvidence(page, '10_upload_attached.png');
  });
});

/* ========================================================================== */
/* SCR-12 Processing — right after CP-4                                       */
/* ========================================================================== */

test.describe('SCR-12 Processing', () => {
  test('SCR-12 load /pipeline (commit) → SSE progress → "Đã xong N/N tầng" (CP-5)', async () => {
    test.setTimeout(PIPELINE_TIMEOUT_MS + 60_000);
    const uploadId = requireState((s) => s.checkpoints.uploadId, 'checkpoints.uploadId', 'Phase 3 SCR-10 upload');
    const mark = api.length;

    await page.goto(ROUTES.project.pipeline(projectId), { waitUntil: 'commit' });
    // Priming read (diagnosis only): a final run at load means the screen never opens the stream.
    const priming = waitForApi(page, 'GET', /\/drawings\/uploads\/[^/]+\/progress$/u, [200]).catch(() => null);
    await expect(page.getByRole('navigation', { name: 'Xử lý' })).toBeVisible();

    const done = page.getByText(/^Đã xong ([1-9]\d*)\/\1 tầng/u);
    const failure = page.getByRole('button', { name: 'Sao chép mã lỗi' });
    await expect(done.or(failure).first()).toBeVisible({ timeout: PIPELINE_TIMEOUT_MS });

    if (await failure.first().isVisible()) {
      await failure.first().click();
      const copied = await page.evaluate(() => navigator.clipboard.readText()).catch(() => '');
      const fromPage = (await page.locator('body').innerText()).match(ERROR_CODE_PATTERN)?.[0];
      await captureEvidence(page, '12_pipeline_complete.png');
      throw new Error(`pipeline failed; copied error code: ${copied.trim() || fromPage || '(unreadable)'}`);
    }

    updateState((draft) => {
      draft.checkpoints.pipelineComplete = true;
    });

    const stream = `/api/streams/projects/${projectId}/uploads/${uploadId}/progress`;
    if (!sse.requestUrls.some((url) => url.includes(stream))) {
      const primed = await priming;
      const status = primed === null ? null : asRecord(primed.json, 'GET progress (priming)').status;
      throw new Error(
        status === 'completed'
          ? `pipeline finished before the screen opened ${stream}; the screen does not open SSE for a final run`
          : `no request to ${stream} (priming status: ${String(status)})`,
      );
    }
    // Wire status values equal ProgressSchema's enum (src/api/schemas/index.ts wireProgressStatusSchema).
    await expect
      .poll(
        () =>
          sse.messages.filter((message) => {
            if (!message.url.includes(stream)) return false;
            try {
              const data = JSON.parse(message.data) as unknown;
              return typeof data === 'object' && data !== null && (data as Json).status === 'completed';
            } catch {
              return false;
            }
          }).length,
        { message: `no SSE "completed" event on ${stream}` },
      )
      .toBeGreaterThan(0);
    expect(api.slice(mark).some((entry) => entry.status < 400), 'at least one real /api/ response').toBe(true);
    await captureEvidence(page, '12_pipeline_complete.png');
  });

  test('SCR-12 tabs "Xem trước" / "Nhật ký"; "Khoá cuộn tự động"; "Mở chi tiết bước …"', async () => {
    const tabs = page.getByRole('tablist', { name: 'Xem trước hoặc nhật ký', exact: true });
    await tabs.getByRole('tab', { name: 'Xem trước', exact: true }).click();
    await expect(tabs.getByRole('tab', { name: 'Xem trước', exact: true })).toHaveAttribute('aria-selected', 'true');
    await tabs.getByRole('tab', { name: 'Nhật ký', exact: true }).click();
    await expect(page.getByRole('log')).toBeVisible();

    const lock = page.getByRole('button', { name: 'Khoá cuộn tự động', exact: true });
    await expect(lock).toHaveAttribute('aria-pressed', 'false');
    await lock.click();
    await expect(lock).toHaveAttribute('aria-pressed', 'true');

    // A step only offers the button when it has detail lines (`ProcessingStepList.tsx` hasDetail).
    const openDetail = page.getByRole('button', { name: /^Mở chi tiết bước /u });
    if ((await openDetail.count()) > 0) {
      const button = openDetail.first();
      await button.click();
      const detailId = await button.getAttribute('aria-controls');
      await expect(button).toHaveAttribute('aria-expanded', 'true');
      if (detailId !== null) await expect(page.locator(`[id="${detailId}"]`)).toBeVisible();
    } else {
      test.info().annotations.push({ type: 'data', description: 'no step has detail lines: no "Mở chi tiết bước …" button rendered' });
    }
    await captureEvidence(page, '12_pipeline_log.png');

    await lock.click();
    await expect(lock).toHaveAttribute('aria-pressed', 'false');
  });

  test('SCR-12 "Huỷ xử lý" is not rendered (cancel unsupported, G7)', async () => {
    await expect(page.getByRole('navigation', { name: 'Xử lý' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Huỷ xử lý', exact: true })).toHaveCount(0);
    await captureEvidence(page, '12_pipeline_no_cancel.png');
  });

  test('SCR-12 "Duyệt lớp tường" → /projects/:id/floors/{workId}/layers/walls', async () => {
    requireState((s) => s.checkpoints.pipelineComplete, 'checkpoints.pipelineComplete', 'Phase 3 SCR-12 (CP-5)');
    const workId = requireState((s) => s.floors.workFloorId, 'floors.workFloorId', 'Phase 3 SCR-09');

    await page.getByRole('button', { name: 'Duyệt lớp tường', exact: true }).click();
    await expect.poll(() => pathOf(page)).toBe(ROUTES.project.walls(projectId, workId));
    await captureEvidence(page, '12_pipeline_to_walls.png');
  });
});

/* ========================================================================== */
/* SCR-10 Floor Upload — after CP-5                                           */
/* ========================================================================== */

test.describe('SCR-10 Floor Upload (after CP-5)', () => {
  test('SCR-10 "Bắt đầu xử lý" → floor-upload-block-notice lists the file-less floors', async () => {
    requireState((s) => s.checkpoints.pipelineComplete, 'checkpoints.pipelineComplete', 'Phase 3 SCR-12 (CP-5)');
    const { workFloorName, scratchFloorName } = readState().floors;
    if (workFloorName === null || scratchFloorName === null) throw new Error('floors.{work,scratch}FloorName missing (Phase 3 SCR-09)');

    await page.goto(ROUTES.project.upload(projectId));
    await expect(page.getByTestId('floor-upload-dropzone')).toBeVisible();
    await page.getByRole('button', { name: 'Bắt đầu xử lý', exact: true }).click();

    const notice = page.getByTestId('floor-upload-block-notice');
    await expect(notice).toBeVisible();
    await expect(notice).toContainText('Không thể bắt đầu xử lý');
    await expect(notice).toContainText(`${scratchFloorName} chưa có bản vẽ.`);
    await expect(notice).not.toContainText(`${workFloorName} chưa có bản vẽ.`);
    await captureEvidence(page, '10_upload_blocked.png');
  });

  test('SCR-10 setInputFiles(.txt) → rejection on the attachment + "Đóng"', async ({}, testInfo) => {
    const txt = testInfo.outputPath('khong-phai-ban-ve.txt');
    writeFileSync(txt, 'not a drawing\n', 'utf8');
    const mark = api.length;

    await page.getByTestId('floor-upload-file-input').setInputFiles(txt);
    const tray = page.getByRole('region', { name: 'Tệp chưa gán tầng', exact: true });
    const rejection = tray.getByText(/^Định dạng .+ chưa nhận được\./u);
    await expect(rejection).toBeVisible();
    await captureEvidence(page, '10_upload_rejected.png');

    await tray.getByRole('button', { name: 'Đóng', exact: true }).click();
    await expect(rejection).toHaveCount(0);
    expect(countSince(api, mark, 'POST', /\/drawings\/uploads$/u), 'a rejected file never inits an upload').toBe(0);
  });
});

/* ========================================================================== */
/* SCR-11 Input Quality Gate — read-only + cancel (destructive "Nắn thẳng" is Phase 11) */
/* ========================================================================== */

test.describe('SCR-11 Input Quality Gate', () => {
  const report = (): Locator => page.getByRole('region', { name: 'Báo cáo chất lượng', exact: true });

  test('SCR-11 load; ArrowRight / ArrowLeft → "Báo cáo chất lượng" + "Phát hiện"', async () => {
    await page.goto(ROUTES.project.quality(projectId));
    await expect(report()).toBeVisible();
    const findings = report().getByRole('heading', { name: 'Phát hiện', exact: true });
    // A drawing with no finding shows the pass notice instead of the "Phát hiện" list (ReportPanel).
    const pass = report().getByText(/^Bản vẽ đạt yêu cầu\./u);
    await expect(findings.or(pass).first()).toBeVisible();
    if (!(await findings.isVisible())) {
      test.info().annotations.push({ type: 'data', description: 'pass notice shown: no "Phát hiện" list for this drawing' });
    }

    const current = report().locator('[aria-current="true"]');
    const before = (await current.count()) > 0 ? await current.first().innerText() : null;
    // Focus is on the document after load (not an input), so the canvas-scope floor keys fire.
    await page.keyboard.press('ArrowRight');
    await page.keyboard.press('ArrowLeft');
    await expect(report()).toBeVisible();
    if (before !== null) await expect(current.first()).toHaveText(before);
    await captureEvidence(page, '11_quality_report.png');
  });

  test('SCR-11 "Chọn góc thủ công", arrow keys on "Góc trên bên trái" (1%/press), Esc exits', async () => {
    const pick = page.getByRole('button', { name: 'Chọn góc thủ công', exact: true });
    test.skip((await pick.count()) === 0, 'data: no finding offers "Chọn góc thủ công" for this drawing');

    await pick.click();
    const group = page.getByRole('group', { name: 'Bốn góc bản vẽ, kéo để chỉnh khung', exact: true });
    await expect(group).toBeVisible();
    const handle = group.getByRole('button', { name: 'Góc trên bên trái', exact: true });
    const topOf = async (): Promise<number> => Number.parseFloat(await handle.evaluate((el) => (el as HTMLElement).style.top));
    const before = await topOf();

    // ArrowDown/ArrowUp, not Left/Right: those are also the screen's floor-switch shortcuts.
    await handle.focus();
    await handle.press('ArrowDown');
    await expect.poll(topOf).toBeCloseTo(before + 1, 3);
    await captureEvidence(page, '11_quality_corners.png');
    await handle.press('ArrowUp');
    await expect.poll(topOf).toBeCloseTo(before, 3);

    await page.keyboard.press('Escape');
    await expect(group).toHaveCount(0);
  });

  test('SCR-11 "Tự động nắn" → "Huỷ" closes "Nắn thẳng bản vẽ tầng …"; no POST', async () => {
    const straighten = page.getByRole('button', { name: 'Tự động nắn', exact: true });
    test.skip((await straighten.count()) === 0, 'data: no finding offers "Tự động nắn" for this drawing');
    const mark = api.length;

    await straighten.click();
    const dialog = page.getByRole('dialog', { name: /^Nắn thẳng bản vẽ tầng /u });
    await expect(dialog).toBeVisible();
    await dialog.getByRole('button', { name: 'Huỷ', exact: true }).click();
    await expect(dialog).toHaveCount(0);
    expect(countSince(api, mark, 'POST', /\/quality\/straighten$/u), 'cancel sends no straighten POST').toBe(0);
    await captureEvidence(page, '11_quality_straighten_cancel.png');
  });

  test('SCR-11 "Tiếp tục xử lý" (acknowledgement checkbox only when present) → /pipeline', async () => {
    const proceed = page.getByRole('button', { name: 'Tiếp tục xử lý', exact: true });
    await expect(proceed).toBeVisible();
    await expect(proceed).not.toHaveAttribute('aria-disabled', 'true');
    const ack = page.getByRole('checkbox', { name: QUALITY_ACK_LABEL, exact: true });

    if ((await ack.count()) > 0) {
      await proceed.click();
      await expect(page.getByText(QUALITY_ACK_BLOCKED, { exact: true })).toBeVisible();
      expect(pathOf(page)).toBe(ROUTES.project.quality(projectId));
      await ack.check();
    } else {
      test.info().annotations.push({ type: 'data', description: 'no "poor" metric: acknowledgement checkbox absent' });
    }
    await proceed.click();
    await expect.poll(() => pathOf(page)).toBe(ROUTES.project.pipeline(projectId));
    await captureEvidence(page, '11_quality_continue.png');
  });
});

/* ========================================================================== */
/* SCR-13 Pipeline Graph / SCR-15 CAD Branch Confirm — dead routes (F-06, F-07) */
/* ========================================================================== */

test.describe('SCR-13 Pipeline Graph', () => {
  test('SCR-13 load → "Chưa có lượt xử lý nào để kể lại" (F-06)', async () => {
    await page.goto(ROUTES.project.pipelineGraph(projectId));
    await expect(page.getByText('Chưa có lượt xử lý nào để kể lại', { exact: true })).toBeVisible();
    await captureEvidence(page, '13_graph_empty.png');
  });
});

test.describe('SCR-15 CAD Branch Confirm', () => {
  test('SCR-15 load; "Huỷ" in "Phát hiện tệp CAD" → "Tệp CAD không có lớp được đặt tên" (F-07)', async () => {
    const workId = requireState((s) => s.floors.workFloorId, 'floors.workFloorId', 'Phase 3 SCR-09');

    await page.goto(ROUTES.project.cadConfirm(projectId, workId));
    const dialog = page.getByRole('dialog', { name: 'Phát hiện tệp CAD', exact: true });
    await expect(dialog).toBeVisible();
    await dialog.getByRole('button', { name: 'Huỷ', exact: true }).click();
    await expect(dialog).toHaveCount(0);
    await expect(page.getByText('Tệp CAD không có lớp được đặt tên', { exact: true }).first()).toBeVisible();
    await captureEvidence(page, '15_cad_empty.png');
  });
});
