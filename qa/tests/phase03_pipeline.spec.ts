/**
 * Phase 3: project setup, upload and pipeline (E2E-TEST-PLAN.md v2, §4 Phase 3), Track A, admin,
 * CP-2 → CP-3 → CP-4 → CP-5. SCR-08 → SCR-15.
 *
 * ORDER EXCEPTION (plan §4 Phase 3 + §5): the matrix deliberately interleaves screens instead of
 * finishing one screen before the next: SCR-10 upload (CP-4) → SCR-12 pipeline IMMEDIATELY → back to
 * SCR-10 (blocked / rejected) → SCR-11 → SCR-13 → SCR-15. "[BUG-285] … Duyệt lớp tường" closes the file (BUG-315):
 * it fails while BUG-285 is open, and a failure in this serial file skips every later test. The fake ML finishes in seconds, and the
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
import { signedInApi } from './support/api';
import { readAdminCredentials, signInAdmin } from './support/auth';
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
/** FloorManager.tsx:77 UNSUPPORTED_NOTICES_TITLE — the InlineAlert `<h4>` title of the one role="status" strip (FIX-1424, BUG-287). */
const SESSION_NOTICES_TITLE = 'Một số thay đổi chưa được lưu';
/**
 * floorManagerGateway.ts:212 FLOOR_MANAGER_UNSUPPORTED_NOTICES.hideFloorFrom3d (FIX-1424, BUG-287). Joined into the same
 * `<p>` as the floor-contents sentence (FloorManager.tsx:143-151), so it is matched as a substring, never `exact: true`.
 */
const HIDE_3D_NOTICE = 'Tầng đang ẩn khỏi mô hình 3D sẽ hiện lại sau khi tải lại trang.';
/** floorManagerGateway.ts:210-211 — the floor-contents sentence of the same strip (always listed: persistFloorContents unsupported). */
const CONTENTS_NOTICE =
  'Tường, phòng và nội thất đi theo khi nhân bản hay xoá tầng chưa được lưu; tải lại trang sẽ mất phần thay đổi đó.';
/** FloorTable.tsx captions (BUG-289). */
const CAPTION_AUTO = 'Cao độ tính tự động từ chiều cao các tầng dưới.';
const CAPTION_MANUAL = 'Cao độ đang nhập tay; ô ghi "Ghi đè" khác cao độ tính từ các tầng dưới.';
/** floorManagerGateway.ts:596 CHANGE_ELEVATION_TOAST_DESCRIPTION; FloorTableRow.tsx OVERRIDDEN_LABEL. */
const ELEVATION_TOAST = 'Đã đổi cao độ tầng.';
const OVERRIDDEN_LABEL = 'Ghi đè';
/** useInputQualityGate.ts COPY. */
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

/**
 * Request listener (not a response listener): counts what the page SENDS to /api/ while it runs, even a request that never
 * gets an answer. `stop()` detaches it and returns `METHOD path` of every request matching `keep`.
 */
function recordRequests(target: Page, keep: (method: string, path: string) => boolean): { stop: () => string[] } {
  const sent: string[] = [];
  const onRequest = (request: { method: () => string; url: () => string }): void => {
    const path = new URL(request.url()).pathname;
    if (path.startsWith('/api/') && keep(request.method(), path)) sent.push(`${request.method()} ${path}`);
  };
  target.on('request', onRequest);
  return {
    stop: () => {
      target.off('request', onRequest);
      return sent;
    },
  };
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
      // An editor sees "Chưa có bản vẽ" once per row: only the attention badge (FloorTableRow.tsx:314-317);
      // the count text next to it is no longer drawn (BUG-250, FIX-1284). Exactly one match (BUG-278 strict mode).
      const noDrawing = floorRow(page, floor.name).getByText('Chưa có bản vẽ', { exact: true });
      await expect(noDrawing).toHaveCount(1);
      await expect(noDrawing).toBeVisible();
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
    const undone = await undo;
    await expect.poll(() => floorRowNames(page)).toEqual(before);

    await test.step('[09-A-017] Mod+Z sends PATCH /floors/reorder with the restored order (not just a local revert)', async () => {
      const sentIds = Array.isArray(floorIds) ? floorIds.map(String) : [];
      const restored = [...sentIds];
      [restored[middleIndex - 1], restored[middleIndex]] = [sentIds[middleIndex] ?? '', sentIds[middleIndex - 1] ?? ''];
      const undoIds = asRecord(undone.response.request().postDataJSON() as unknown, 'PATCH reorder (undo) request').floorIds;
      expect.soft(undoIds, 'undo PATCH floorIds = the order before Alt+ArrowUp').toEqual(restored);
    });
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
    const workElevation = page.getByRole('textbox', { name: `Cao độ tầng ${floor.name}`, exact: true });
    // The switch starts OFF (useFloorManager.ts:516). On → elevations are read-only text; off → the inputs
    // (FloorTableRow.tsx:278-291).
    await expect(auto).toHaveAttribute('aria-checked', 'false');
    await test.step('[09-A-013] toggle ON → text elevations + auto caption; OFF → inputs + manual caption; no request', async () => {
      const sent = recordRequests(page, (_method, path) => path.includes(projectId) || path.startsWith('/api/floors'));
      await auto.click();
      await expect(auto).toHaveAttribute('aria-checked', 'true');
      await expect(workElevation).toHaveCount(0);
      await expect.soft(page.getByText(CAPTION_AUTO, { exact: true })).toBeVisible();
      await captureEvidence(page, 'M03_09-A-013_auto_on_caption.png');
      await auto.click();
      await expect(auto).toHaveAttribute('aria-checked', 'false');
      await expect(workElevation).toBeVisible();
      await expect.soft(page.getByText(CAPTION_MANUAL, { exact: true })).toBeVisible();
      await page.waitForTimeout(500);
      expect.soft(sent.stop(), 'the switch is view state: no request either way').toEqual([]);
    });

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

    // Plan row says the {work} row; the elevation that can move is the top floor {scratch} (see above), so "Ghi đè" is there.
    await test.step('[09-A-011] after the elevation PATCH: toast "Đã đổi cao độ tầng." and "Ghi đè" on the edited row', async () => {
      await expect.soft(page.getByRole('status').filter({ hasText: ELEVATION_TOAST }).first()).toBeVisible();
      await expect.soft(floorRow(page, top.name).getByText(OVERRIDDEN_LABEL, { exact: true })).toBeVisible();
      await captureEvidence(page, 'M03_09-A-011_elevation_toast_override.png');
    });
  });

  test('SCR-09 "Thao tác khác cho tầng {scratch}" → "Ẩn khỏi mô hình 3D": session-only notice, no write', async () => {
    const floor = scratch();
    const mark = api.length;
    const more = page.getByRole('button', { name: `Thao tác khác cho tầng ${floor.name}`, exact: true });

    // useFloorManager.ts:1655-1664: the hide-in-3D sentence is listed only while a floor is hidden (BUG-287).
    await expect(page.getByText(HIDE_3D_NOTICE, { exact: false })).toHaveCount(0);
    const strip = page.getByRole('status').filter({ has: page.getByRole('heading', { name: SESSION_NOTICES_TITLE, exact: true }) });
    await test.step('[09-B-012] before hide: role=status "Một số thay đổi chưa được lưu" with the floor-contents sentence', async () => {
      await expect.soft(strip).toHaveCount(1);
      await expect.soft(strip).toContainText(CONTENTS_NOTICE);
      await captureEvidence(page, 'M03_09-B-012_session_strip_before_hide.png');
    });
    await more.click();
    await page.getByRole('menuitem', { name: 'Ẩn khỏi mô hình 3D', exact: true }).click();
    // The same sentence also goes to the live region (useFloorManager.ts:1092-1098 → announce), so the inline strip is
    // found by its title, not by the sentence.
    const notices = page
      .getByRole('status')
      .filter({ has: page.getByRole('heading', { name: SESSION_NOTICES_TITLE, exact: true }) });
    await expect(notices).toHaveCount(1);
    await expect(notices).toContainText(HIDE_3D_NOTICE);
    await more.click();
    const show = page.getByRole('menuitem', { name: 'Hiện trong mô hình 3D', exact: true });
    await expect(show).toBeVisible();
    await captureEvidence(page, '09_floor_hide3d_session.png');

    await show.click();
    expect(writesSince(api, mark), 'hide/show in 3D sends no write (hideFloorFrom3d unsupported)').toEqual([]);

    await test.step('[09-B-013] "Hiện trong mô hình 3D" → the hide sentence leaves the strip (it was there while hidden)', async () => {
      await expect.soft(strip).not.toContainText(HIDE_3D_NOTICE);
      await expect.soft(strip).toContainText(CONTENTS_NOTICE);
      await captureEvidence(page, 'M03_09-B-013_session_strip_after_show.png');
    });
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
    // Scoped to the tray: an attached floor card has its own "Gán cho tầng khác" picker (BUG-301, strict mode).
    await page.getByRole('region', { name: 'Tệp chưa gán tầng', exact: true }).getByRole('combobox', { name: 'Gán cho tầng khác' }).click();
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

    await test.step('[12-B-003] CP-2 has 6 floors and 1 drawing → exactly "Đã xong 1/1 tầng"', async () => {
      await expect.soft(page.getByText(/^Đã xong 1\/1 tầng/u)).toBeVisible();
      await captureEvidence(page, 'M03_12-B-003_done_one_of_one.png');
    });

    await test.step('[12-C-008] completed → every step progressbar aria-valuenow 100', async () => {
      const values = await page.getByRole('progressbar').evaluateAll((bars) =>
        bars.map((bar) => `${bar.getAttribute('aria-label') ?? '?'}=${bar.getAttribute('aria-valuenow') ?? '?'}`),
      );
      expect.soft(values.length, 'six step progressbars (ProcessingStepList)').toBeGreaterThanOrEqual(6);
      expect.soft(values.filter((value) => !value.endsWith('=100')), 'bars not at 100').toEqual([]);
    });

    await test.step('[12-B-042] after the completed frame the FE closes the stream: no reconnect within 3 s', async () => {
      const opened = (): number => sse.requestUrls.filter((url) => url.includes(stream)).length;
      const before = opened();
      await page.waitForTimeout(3_000);
      expect.soft(opened(), `no new request to ${stream} after "completed"`).toBe(before);
    });
  });

  test('SCR-12 tabs "Xem trước" / "Nhật ký"; "Khoá cuộn tự động"; "Mở chi tiết bước …"', async () => {
    const tabs = page.getByRole('tablist', { name: 'Xem trước hoặc nhật ký', exact: true });
    await tabs.getByRole('tab', { name: 'Xem trước', exact: true }).click();
    await expect(tabs.getByRole('tab', { name: 'Xem trước', exact: true })).toHaveAttribute('aria-selected', 'true');
    await test.step('[12-B-020] "Xem trước" → img alt "Bản vẽ đang được xử lý — {floor}" (N7 sourceImageUrl)', async () => {
      const workName = requireState((s) => s.floors.workFloorName, 'floors.workFloorName', 'Phase 3 SCR-09');
      // useProcessingScreen.ts:149 previewAltPrefix.
      await expect.soft(page.getByRole('img', { name: `Bản vẽ đang được xử lý — ${workName}`, exact: true })).toBeVisible();
      await captureEvidence(page, 'M03_12-B-020_preview_image.png');
    });
    await tabs.getByRole('tab', { name: 'Nhật ký', exact: true }).click();
    await expect(page.getByRole('log')).toBeVisible();
    await test.step('[12-E-003] role=log has aria-live="polite" and tabIndex 0', async () => {
      await expect.soft(page.getByRole('log')).toHaveAttribute('aria-live', 'polite');
      await expect.soft(page.getByRole('log')).toHaveAttribute('tabindex', '0');
    });

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

    await test.step('[12-E-004] icon buttons "Khoá cuộn tự động" (aria-pressed) + "Sao chép nhật ký"; copy → toast "Đã chép nhật ký"', async () => {
      await expect.soft(lock).toHaveAttribute('aria-pressed', /^(true|false)$/u);
      const copy = page.getByRole('button', { name: 'Sao chép nhật ký', exact: true });
      await expect.soft(copy).toBeVisible();
      await copy.click();
      // useProcessingScreen.ts:153 logCopied → NotificationHost toast (role=status).
      await expect.soft(page.locator('[role="status"]:not([data-announcer])').filter({ hasText: 'Đã chép nhật ký' }).first()).toBeVisible();
      await captureEvidence(page, 'M03_12-E-004_log_copied.png');
    });
  });

  test('SCR-12 "Huỷ xử lý" is not rendered (cancel unsupported, G7)', async () => {
    await expect(page.getByRole('navigation', { name: 'Xử lý' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Huỷ xử lý', exact: true })).toHaveCount(0);
    await captureEvidence(page, '12_pipeline_no_cancel.png');
  });
  // "Duyệt lớp tường" is the LAST test of this file (bottom), not here: it fails while BUG-285 is open, and in this serial
  // file a failure skips every later test (BUG-315: run-20 lost 8 cases of SCR-10/11/13/15 to it).
});

/* ========================================================================== */
/* SCR-09 Floor Manager — after CP-5 (direct load). After the SCR-12 group, not */
/* between its tests: "tabs" reads the screen the CP-5 test left open.          */
/* ========================================================================== */

test.describe('SCR-09 Floor Manager (after CP-5)', () => {
  test('SCR-09 · FL-M-09-04 after CP-5 → /floors {work} row shows drawings, counts, QC % (direct load)', async () => {
    requireState((s) => s.checkpoints.pipelineComplete, 'checkpoints.pipelineComplete', 'Phase 3 SCR-12 (CP-5)');
    const workName = requireState((s) => s.floors.workFloorName, 'floors.workFloorName', 'Phase 3 SCR-09');
    const row = floorRow(page, workName);

    await test.step('[09-B-004] {work} row: "1 bản vẽ", wall/room counts, area m², QC % bar (verified badge at 100 %)', async () => {
      await page.goto(ROUTES.project.floors(projectId));
      await expect(row).toBeVisible();
      await expect(row).toContainText('1 bản vẽ'); // FloorTableRow.tsx drawingCountText (Floor.drawings)
      await expect.soft(row).toContainText('m²'); // formatArea
      await expect.soft(row).toContainText(/\d+\s*%/u); // formatPercent
      await captureEvidence(page, 'M03_09-B-004_floor_with_drawing.png');
    });

    await test.step('[09-B-005] direct load (no violations in store): QC must not read a verified "100 %" (suspected misleading)', async () => {
      const text = await row.innerText();
      await captureEvidence(page, 'M03_09-B-005_qc_direct_load.png', { caption: `row text: ${text.replace(/\s+/gu, ' ')}` });
      // useFloorManager.ts:1520-1522: health score of ZERO violations = 100 %, read straight after a direct load.
      expect.soft(text, 'QC % without QC data reads as verified 100 % (suspected)').not.toMatch(/100\s*%/u);
    });
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
    // BUG-359: the previous test left the page scrolled to the footer's block notice, and `toBeVisible` does not mean "in the
    // viewport" — run-23's shot showed the cards + notice again. Bring the tray's rejection into the frame first.
    await rejection.scrollIntoViewIfNeeded();
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
    // textContent, not innerText: `toHaveText` matches the row's textContent, and innerText puts tabs / newlines between the
    // cells ("Tầng 4\t2 phát hiện…" vs "Tầng 42 phát hiện…"), so the same row never matched (BUG-363, run-23).
    const before = (await current.count()) > 0 ? await current.first().textContent() : null;
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

    const sent = recordRequests(page, (method) => method === 'POST');
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

    await test.step('[11-A-020] Esc in corner mode → handles gone, "Chọn góc thủ công" back, 0 POST', async () => {
      await expect.soft(page.getByRole('button', { name: 'Góc trên bên trái', exact: true })).toHaveCount(0);
      await expect.soft(pick).toBeVisible();
      await page.waitForTimeout(500);
      expect.soft(sent.stop(), 'corner mode sends nothing until applied').toEqual([]);
    });
  });

  test('SCR-11 "Tự động nắn" → "Huỷ" closes "Nắn thẳng bản vẽ tầng …"; no POST', async () => {
    const straighten = page.getByRole('button', { name: 'Tự động nắn', exact: true });
    test.skip((await straighten.count()) === 0, 'data: no finding offers "Tự động nắn" for this drawing');
    const mark = api.length;

    const sent = recordRequests(page, (method, path) => method === 'POST' && path.endsWith('/straighten'));
    await straighten.click();
    const dialog = page.getByRole('dialog', { name: /^Nắn thẳng bản vẽ tầng /u });
    await expect(dialog).toBeVisible();
    await dialog.getByRole('button', { name: 'Huỷ', exact: true }).click();
    await expect(dialog).toHaveCount(0);
    await test.step('[11-A-025] "Huỷ" → dialog closes, 0 POST …/straighten (request listener)', async () => {
      await page.waitForTimeout(500);
      expect.soft(sent.stop(), 'no straighten request was sent').toEqual([]);
    });
    expect(countSince(api, mark, 'POST', /\/quality\/straighten$/u), 'cancel sends no straighten POST').toBe(0);
    await captureEvidence(page, '11_quality_straighten_cancel.png');
  });

  test('SCR-11 "Tiếp tục xử lý" (acknowledgement checkbox only when present) → /pipeline', async () => {
    const proceed = page.getByRole('button', { name: 'Tiếp tục xử lý', exact: true });
    await expect(proceed).toBeVisible();
    await expect(proceed).not.toHaveAttribute('aria-disabled', 'true');
    const ack = page.getByRole('checkbox', { name: QUALITY_ACK_LABEL, exact: true });
    const sent = recordRequests(page, (method) => method === 'POST' || method === 'PUT');

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
    await test.step('[11-A-030] "Tiếp tục xử lý" → /projects/:id/pipeline with 0 POST/PUT (navigation only)', async () => {
      expect.soft(sent.stop(), 'continuing only navigates').toEqual([]);
    });
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
    await test.step('[13-B-001] empty story description + overview "Sơ đồ xử lý" drawn at opacity 0.4', async () => {
      // pipelineGraphText.ts:209 emptyDescription; PipelineGraph.tsx:60,163 EMPTY_DIAGRAM_OPACITY on the overview wrapper.
      await expect.soft(page.getByText('Khi một bản vẽ được đưa vào xử lý, sơ đồ và nhánh đã chọn sẽ hiện ở đây.', { exact: true })).toBeVisible();
      const overview = page.getByRole('group', { name: 'Sơ đồ xử lý', exact: true }).or(page.getByRole('list', { name: 'Sơ đồ xử lý', exact: true }));
      const opacity = await overview.first().evaluate((el) => {
        let value = 1;
        for (let node: Element | null = el; node !== null; node = node.parentElement) value *= Number(getComputedStyle(node).opacity);
        return Math.round(value * 100) / 100;
      });
      await captureEvidence(page, 'M03_13-B-001_graph_empty_overview.png', { caption: `effective opacity of "Sơ đồ xử lý": ${String(opacity)}` });
      expect.soft(opacity, 'overview drawn at 0.4 while there is no run').toBeCloseTo(0.4, 2);
    });
  });
});

test.describe('SCR-15 CAD Branch Confirm', () => {
  test('SCR-15 load; "Huỷ" in "Phát hiện tệp CAD" → "Chưa có lớp nào để ánh xạ" (F-07)', async () => {
    const workId = requireState((s) => s.floors.workFloorId, 'floors.workFloorId', 'Phase 3 SCR-09');

    await page.goto(ROUTES.project.cadConfirm(projectId, workId));
    const dialog = page.getByRole('dialog', { name: 'Phát hiện tệp CAD', exact: true });
    await expect(dialog).toBeVisible();
    await dialog.getByRole('button', { name: 'Huỷ', exact: true }).click();
    await expect(dialog).toHaveCount(0);
    await expect(page.getByText('Chưa có lớp nào để ánh xạ', { exact: true }).first()).toBeVisible();
    await captureEvidence(page, '15_cad_empty.png');
    await test.step('[15-A-002] after "Huỷ": hand-off alert "Chuyển sang nhánh nhận dạng ảnh" + AI note, "Dùng đường từ CAD" / "Vẫn dùng AI"', async () => {
      // CadBranchConfirm.tsx:92 AI_HANDOFF_TITLE, cadBranchConfirmText.ts:84,87,164.
      const handoff = page.getByRole('alert').filter({ hasText: 'Chuyển sang nhánh nhận dạng ảnh' });
      await expect.soft(handoff).toBeVisible();
      await expect.soft(handoff).toContainText('Nếu bạn chọn nhánh AI, sẽ cần hiệu chỉnh tỷ lệ sau khi nhập hình học.');
      await expect.soft(page.getByRole('button', { name: 'Dùng đường từ CAD', exact: true })).toBeVisible();
      await expect.soft(page.getByRole('button', { name: 'Vẫn dùng AI', exact: true })).toBeVisible();
      await captureEvidence(page, 'M03_15-A-002_cad_handoff.png');
    });
  });
});

/* ========================================================================== */
/* SCR-12 "Duyệt lớp tường" — last on purpose (BUG-315)                       */
/* ========================================================================== */

test.describe('SCR-12 Processing summary', () => {
  // [BUG-285] asserts the bug log's "Mong đợi". Since FIX-1380 the processing screen derives "Báo cáo tổng kết" from N16
  // spatial/layer once a floor's run is done (useProcessingScreen.ts:733-745, :1208-1276) and shows the block — with
  // "Duyệt lớp tường" / "Hiệu chỉnh tỷ lệ" — even when N16 fails, so this should pass (coverage F10/P9). Kept last in
  // this serial file so a regression skips nothing; CP-5 is read back from the API here, not from the CP-5 test's screen.
  test('[BUG-285] SCR-12 finished run (CP-5 from the API) → "Duyệt lớp tường" → /projects/:id/floors/{workId}/layers/walls', async () => {
    requireState((s) => s.checkpoints.pipelineComplete, 'checkpoints.pipelineComplete', 'Phase 3 SCR-12 (CP-5)');
    const uploadId = requireState((s) => s.checkpoints.uploadId, 'checkpoints.uploadId', 'Phase 3 SCR-10 upload');
    const workId = requireState((s) => s.floors.workFloorId, 'floors.workFloorId', 'Phase 3 SCR-09');

    // CP-5 from the API (BE drawings/router.py progress, one real login): the CP-4 upload's run is final.
    const { email, password } = readAdminCredentials();
    const admin = await signedInApi(email, password);
    try {
      const res = await admin.get(`/api/projects/${projectId}/drawings/uploads/${uploadId}/progress`);
      expect(res.status(), 'GET drawings/uploads/:uid/progress').toBe(200);
      expect(asRecord(await res.json(), 'GET progress').status, 'CP-5: the CP-4 upload run is completed').toBe('completed');
    } finally {
      await admin.dispose();
    }

    await page.goto(ROUTES.project.pipeline(projectId));
    await expect(page.getByRole('navigation', { name: 'Xử lý' })).toBeVisible();
    await expect(page.getByText(/^Đã xong ([1-9]\d*)\/\1 tầng/u)).toBeVisible();
    // Shot BEFORE the bug check, so a failing run still documents the finished screen.
    await captureEvidence(page, '12_pipeline_done_for_walls.png');

    const browseWalls = page.getByRole('button', { name: 'Duyệt lớp tường', exact: true });
    await expect(browseWalls, 'BUG-285: a finished run offers "Duyệt lớp tường" (ProcessingSummary)').toBeVisible();
    await browseWalls.click();
    await expect.poll(() => pathOf(page)).toBe(ROUTES.project.walls(projectId, workId));
    await captureEvidence(page, '12_pipeline_to_walls.png');
  });
});
