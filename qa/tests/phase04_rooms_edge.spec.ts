/**
 * Phase 4 — SCR-20 "Duyệt tên phòng" (RoomLabelReview), EDGE layer, REAL stack: nine sequential user flows
 * (QA-04c P5, `flow-plan.md` "phase04_rooms_edge.spec.ts"). One `test()` per flow, one `test.step('[<row id>] …')` per
 * catalog row, in the planned order. `H` rows use a hard `expect` (the flow cannot go on without them), `S` rows
 * `expect.soft`; every step captures `E04_<row id>_<slug>.png`. ⚑ steps assert the CORRECT behaviour and stay red while the
 * app is wrong. Fold (old tests kept untouched, listed in `bao-cao-P5.md`): the five "E04 · SCR-20 …" tests of
 * `phase04_qc_layers_edge.spec.ts` and the matching rows of `phase04_qc_layers.spec.ts` M4 are walked again here.
 *
 * Source (FE, this branch = master 6c662bcb): RRV src/screens/qc/RoomLabelReview/RoomLabelReview.tsx · URR …/useRoomLabelReview.ts ·
 * RRG …/roomLabelReviewGateway.ts · RLP …/RoomLabelLeftPanel.tsx · RLL …/RoomLabelList.tsx · RIN …/RoomLabelInspector.tsx ·
 * RIF …/RoomLabelInspectorFields.tsx · RNF …/RoomLabelNameField.tsx · RAD …/RoomLabelActionDialogs.tsx · RNP …/RoomLabelNormalizePreview.tsx ·
 * RCV …/RoomLabelCanvas.tsx · RCG …/roomLabelCanvasGeometry.ts · RFC src/lib/commands/business/roomFloorCommands.ts ·
 * UFL src/hooks/useFloorLayer.ts · AUS src/hooks/useAutosave.ts · SLS src/lib/autosave/spatialLayerSave.ts ·
 * FSB/FSC src/screens/qc/WallLayerReview/FloorLayerSave{Banner,Confirm}.tsx · FLR src/screens/qc/shared/floorLayerReadFailure.ts.
 *
 * ## Users and data
 * The shared admin (one login per flow session; `signedInApi` once per file worker for the fixtures). Every flow creates its
 * OWN project (`qa-<runId>-20-…`, `createProject`), writes the floor layer through the real #35 (`layerSeed.writeLayer`, seeds in
 * `support/p04/P5.ts`) and deletes the project in `finally`. FL-20-08 uploads the env drawing ONCE as this file's pool admin
 * (`poolUser(admin, 'admin', 'p04-rooms')`, own `drawings_init` bucket). Mocks: none in this file (see the mocked/ui files).
 * No fixed waits: debounce and toast windows are driven with `page.clock` (`advance`), "nothing was sent" is checked after a
 * same-origin round trip (`settle`), and a held response is released by the test.
 *
 * ## Request budget per full run
 * - `POST /api/auth/login` (120 / 60 s per IP): 1 `signedInApi` per file worker + 1 per flow session (9) + 1 pool-admin API
 *   (FL-20-08) + 1 pool-admin session + 1 anonymous context (0).
 * - `POST /api/projects` 10, `DELETE` 10 (no rate limit); `PUT …/spatial/layer` ≈ 40 (no rate limit).
 * - `POST …/drawings/uploads` (`drawings_init` 60 / 600 s per user): 1 (pool admin `p04-rooms`).
 * - `POST /api/auth/refresh`: ~1 per page load (≈ 80 loads, spread over several minutes).
 */
import type { APIRequestContext } from '@playwright/test';
import { expect, test } from '@playwright/test';

import { describeConfidence } from '../../src/lib/format/semantic';
import { formatLength } from '../../src/lib/format/measure';
import { ROUTES } from '../../e2e/fixtures/routes';
import { TOUR_APPEAR_TIMEOUT_MS, dismissTour } from '../../e2e/fixtures/tour';
import { navigateThenWaitForApi, waitForApi } from '../../e2e/fullstack/apiWatch';
import { readBaseUrl } from '../../e2e/fullstack/env';
import { signedInApi } from './support/api';
import { readAdminCredentials } from './support/auth';
import { attachJson, captureEvidence } from './support/evidence';
import { qcLayer, writeLayer, type LayerApi } from './support/layerSeed';
import { holdFirst } from './support/p03/P4';
import { recordAnnouncements } from './support/p03/P5';
import {
  DESKTOP,
  LONG_NAME,
  NAMES,
  ROOM,
  SAVED_AT,
  SAVING,
  SUGGESTIONS,
  advance,
  areaTextOf,
  canvasButton,
  canvasGroup,
  closeSession,
  codesOf,
  countSince,
  drawRooms,
  filterToggle,
  flush,
  floorRe,
  gapsClosed,
  gapsLoop,
  gapsUnclosed,
  halo,
  inspector,
  layerPath,
  layerPutsSince,
  layerRe,
  measureLong,
  measureMany,
  measureTwo,
  mergeLoop,
  mergeNoWall,
  mergeOversized,
  mergeSeparate,
  mergeThree,
  nameField,
  openRooms,
  openSelectOf,
  openSession,
  openUsage,
  optionName,
  optionNamed,
  optionOf,
  rect,
  rooms1,
  rooms3,
  roomsAB,
  roomsBep,
  roomsNormalize,
  roomList,
  roomOptions,
  saveChip,
  seedFloor,
  selectRoom,
  sentRooms,
  settle,
  shotPaused,
  splitLoops,
  toastOf,
  toastRegion,
  uniq,
  waitForLayerPut,
  writeElsewhere,
  writesSince,
  arrayOf,
  type Session,
} from './support/p04/P5';
import { createPipelineDrawingProject, createProject, deleteSeededProject, envDrawingPng, poolUser } from './support/phase03Seed';

type Floor = { id: string; name: string };

let admin: APIRequestContext;
let layerApi: LayerApi;

test.beforeAll(async () => {
  const { email, password } = readAdminCredentials();
  admin = await signedInApi(email, password);
  layerApi = { request: admin, headers: {} };
});

test.afterAll(async () => {
  await admin.dispose();
});

const creds = (): { email: string; password: string } => readAdminCredentials();

/** Project with `floorNames`, cleaned by the caller's `finally`. */
async function newProject(slug: string, floorNames: readonly string[] = ['Tầng 1']) {
  const project = await createProject(admin, slug, floorNames);
  const floors = project.floors.map((floor) => ({ id: floor.id, name: floor.name }));
  return { projectId: project.projectId, floors, first: floors[0] as { id: string; name: string } };
}

async function cleanup(projectId: string | undefined, s: Session | undefined): Promise<void> {
  await closeSession(s);
  if (projectId !== undefined) {
    const failed = await deleteSeededProject(admin, projectId);
    if (failed !== null) test.info().annotations.push({ type: 'cleanup', description: failed });
  }
}

/* ================================================================= FL-20-01 */

test('SCR-20 · FL-20-01 · list and canvas selection, keyboard in the listbox, canvas buttons', async ({ browser }) => {
  test.setTimeout(180_000);
  const seed = rooms3();
  const { projectId, first } = await newProject('20-01');
  let s: Session | undefined;
  try {
    await seedFloor(layerApi, projectId, first.id, seed);
    const sess = await openSession(browser, creds());
    s = sess;
    const { page } = sess;
    const ids = [seed.rooms.unnamed as string, seed.rooms.ai as string, seed.rooms.reviewed as string];
    const codes = codesOf(ids);
    const [codeUnnamed, codeAi, codeReviewed] = ids.map((id) => codes.get(id) as string) as [string, string, string];
    const options = roomOptions(page);

    await test.step('[20-A-002] list rows carry code, name, area and status in the option name', async () => {
      await openRooms(page, projectId, first.id);
      await expect(roomList(page)).toBeVisible();
      await expect(options).toHaveCount(3);
      const square = rect(0, 0, 4000, 4000);
      await expect(optionOf(page, codeUnnamed)).toHaveAccessibleName(optionName(codeUnnamed, NAMES.unnamed, square, ROOM.statusUnnamed));
      await expect(optionOf(page, codeAi)).toHaveAccessibleName(optionName(codeAi, NAMES.ai, square, ROOM.statusSuggested));
      await expect(optionOf(page, codeReviewed)).toHaveAccessibleName(optionName(codeReviewed, NAMES.reviewed, square, ROOM.statusConfirmed));
      await captureEvidence(page, 'E04_20-A-002_list-rows.png');
    });

    await test.step('[20-A-003] an unnamed room shows the placeholder "Chưa đặt tên"', async () => {
      await expect.soft(optionOf(page, codeUnnamed)).toContainText(ROOM.unnamedWord);
      await expect.soft(optionOf(page, codeUnnamed)).not.toContainText(NAMES.ai);
      await captureEvidence(page, 'E04_20-A-003_placeholder.png');
    });

    await test.step('[20-E-013] the status dot is aria-hidden; the status is in the option name', async () => {
      for (const code of [codeUnnamed, codeAi, codeReviewed]) {
        await expect.soft(optionOf(page, code).locator('span[aria-hidden="true"]')).toHaveCount(1); // RLL:100
      }
      await expect.soft(optionOf(page, codeAi)).toHaveAccessibleName(new RegExp(`${ROOM.statusSuggested}$`, 'u'));
      await captureEvidence(page, 'E04_20-E-013_status-dot.png');
    });

    await test.step('[20-E-002] each option is its own Tab stop (tabIndex 0, no roving) with aria-selected', async () => {
      for (let i = 0; i < 3; i += 1) {
        await expect.soft(options.nth(i)).toHaveAttribute('tabindex', '0');
        await expect.soft(options.nth(i)).toHaveAttribute('aria-selected', 'false');
      }
      await options.nth(0).focus();
      for (let i = 1; i < 3; i += 1) {
        await page.keyboard.press('Tab');
        await expect.soft(options.nth(i)).toBeFocused();
      }
      await captureEvidence(page, 'E04_20-E-002_tab-stops.png');
    });

    await test.step('[20-A-005] ArrowDown / ArrowUp move focus between options; no selection change', async () => {
      await options.nth(0).focus();
      await page.keyboard.press('ArrowDown');
      await expect.soft(options.nth(1)).toBeFocused();
      await page.keyboard.press('ArrowDown');
      await expect.soft(options.nth(2)).toBeFocused();
      await page.keyboard.press('ArrowUp');
      await expect.soft(options.nth(1)).toBeFocused();
      for (let i = 0; i < 3; i += 1) await expect.soft(options.nth(i)).toHaveAttribute('aria-selected', 'false');
      await captureEvidence(page, 'E04_20-A-005_arrow-focus.png');
    });

    await test.step('[20-A-006] Enter / Space on a focused option selects it', async () => {
      await options.nth(1).focus();
      await page.keyboard.press('Enter');
      await expect.soft(options.nth(1)).toHaveAttribute('aria-selected', 'true');
      await options.nth(2).focus();
      await page.keyboard.press('Space');
      await expect.soft(options.nth(2)).toHaveAttribute('aria-selected', 'true');
      await expect.soft(options.nth(1)).toHaveAttribute('aria-selected', 'false');
      await captureEvidence(page, 'E04_20-A-006_enter-space.png');
    });

    await test.step('[20-A-007] ArrowUp on the first / ArrowDown on the last option keeps focus', async () => {
      await options.nth(0).focus();
      await page.keyboard.press('ArrowUp');
      await expect.soft(options.nth(0)).toBeFocused();
      await options.nth(2).focus();
      await page.keyboard.press('ArrowDown');
      await expect.soft(options.nth(2)).toBeFocused();
      await captureEvidence(page, 'E04_20-A-007_arrow-bounds.png');
    });

    await test.step('[20-E-003] Home / End are not handled in the listbox', async () => {
      await options.nth(1).focus();
      await page.keyboard.press('Home');
      await expect.soft(options.nth(1)).toBeFocused();
      await page.keyboard.press('End');
      await expect.soft(options.nth(1)).toBeFocused();
      await captureEvidence(page, 'E04_20-E-003_home-end.png');
    });

    await test.step('[20-A-008] hovering an option puts a halo on that room on the canvas; leaving removes it', async () => {
      await openRooms(page, projectId, first.id); // a fresh load: nothing selected, so the halo can only come from the hover
      await expect(halo(page)).toHaveCount(0);
      await optionOf(page, codeAi).hover();
      await expect.soft(halo(page)).toHaveCount(1);
      await captureEvidence(page, 'E04_20-A-008_hover-halo.png');
      await page.getByRole('heading', { name: ROOM.screen, exact: true, level: 2 }).hover();
      await expect.soft(halo(page)).toHaveCount(0);
    });

    await test.step('[20-A-009] a click on a canvas room selects it (aria-pressed) and the list follows', async () => {
      const button = canvasButton(page, NAMES.ai);
      const pan = canvasGroup(page).locator('> div').first();
      const before = await pan.evaluate((el) => el.style.transform);
      await button.click();
      await expect.soft(button).toHaveAttribute('aria-pressed', 'true');
      await expect.soft(optionOf(page, codeAi)).toHaveAttribute('aria-selected', 'true');
      await attachJson('E04_20-A-009_pan.json', { transformBefore: before, transformAfter: await pan.evaluate((el) => el.style.transform) });
      await captureEvidence(page, 'E04_20-A-009_canvas-select.png');
    });

    await test.step('[20-E-006] canvas room buttons are Tab-reachable, named, aria-pressed; focus shows the ring and the halo', async () => {
      await canvasButton(page, codeUnnamed).focus(); // an unnamed room is labelled by its code (RCV:291-320)
      await page.keyboard.press('Tab');
      await expect.soft(canvasButton(page, NAMES.ai)).toBeFocused();
      await page.keyboard.press('Tab');
      const last = canvasButton(page, NAMES.reviewed);
      await expect.soft(last).toBeFocused();
      await expect.soft(last).toHaveAttribute('aria-pressed', 'false');
      expect.soft(await last.evaluate((el) => getComputedStyle(el).boxShadow), 'focus-visible ring on the canvas button').not.toBe('none');
      await expect.soft(halo(page)).toHaveCount(1);
      await captureEvidence(page, 'E04_20-E-006_canvas-focus.png');
    });

    await test.step('[20-B-007] the inspector with nothing selected prompts to choose a room', async () => {
      await openRooms(page, projectId, first.id);
      await expect.soft(page.getByText(ROOM.inspectorEmpty, { exact: true })).toBeVisible();
      await expect.soft(page.getByRole('button', { name: ROOM.approve, exact: true })).toHaveCount(0);
      await captureEvidence(page, 'E04_20-B-007_inspector-empty.png');
    });

    await test.step('[20-C-015] room codes are unique across the floor', async () => {
      const labels = await options.evaluateAll((els) => els.map((el) => el.getAttribute('aria-label') ?? ''));
      const shown = labels.map((label) => label.split(' · ')[0] ?? '');
      expect.soft(new Set(shown).size, `codes ${shown.join(', ')}`).toBe(3);
      expect.soft(shown.sort()).toEqual([codeUnnamed, codeAi, codeReviewed].sort());
      await captureEvidence(page, 'E04_20-C-015_codes-unique.png');
    });

    await test.step('[20-E-001] landmark and headings: region, h2, h3 "Phòng", h3 "Vòng tường hở", h4 "Nhắc công năng"', async () => {
      await selectRoom(page, codeAi);
      await expect.soft(page.getByRole('region', { name: ROOM.screen, exact: true })).toBeVisible();
      await expect.soft(page.getByRole('heading', { name: ROOM.screen, exact: true, level: 2 })).toBeVisible();
      await expect.soft(page.getByRole('heading', { name: ROOM.inspector, exact: true, level: 3 })).toBeVisible();
      await expect.soft(page.getByRole('heading', { name: ROOM.gapsTitle, exact: true, level: 3 })).toBeVisible();
      await expect.soft(page.getByRole('heading', { name: ROOM.notices, exact: true, level: 4 })).toBeVisible();
      await captureEvidence(page, 'E04_20-E-001_landmarks.png');
    });

    await test.step('[20-E-005] the canvas has a section, a group and an svg; group and svg share the name "Mặt bằng duyệt tên phòng"', async () => {
      await expect.soft(page.getByRole('region', { name: ROOM.canvasSection, exact: true })).toHaveCount(1);
      await expect.soft(canvasGroup(page)).toHaveCount(1);
      await expect.soft(page.getByRole('img', { name: ROOM.canvas, exact: true })).toHaveCount(1);
      await captureEvidence(page, 'E04_20-E-005_canvas-names.png');
    });
  } finally {
    await cleanup(projectId, s);
  }
});

/* ================================================================= FL-20-02 */

test('SCR-20 · FL-20-02 · rename: blur, Enter, suggestions, undo toast, save, reload, leave guard', async ({ browser }) => {
  test.setTimeout(240_000);
  const seed = rooms1();
  const { projectId, first } = await newProject('20-02');
  let s: Session | undefined;
  try {
    await seedFloor(layerApi, projectId, first.id, seed);
    const sess = await openSession(browser, creds());
    s = sess;
    const { page } = sess;
    const roomId = seed.rooms.one as string;
    const code = codesOf([roomId]).get(roomId) as string;
    const field = nameField(page);
    const putsOf = (mark: number) => layerPutsSince(s as Session, projectId, first.id, mark);
    const renamedTo = (name: string) => (rooms: Record<string, unknown>[]) => rooms.some((room) => room.id === roomId && room.name === name);
    const toastRename = (from: string, to: string): RegExp => new RegExp(`Đổi tên phòng #\\S+ từ "${from}" thành "${to}", diện tích [\\d.,]+ m²\\.`, 'u');
    const announced = await recordAnnouncements(page); // the only save feedback of SCR-20 is the screen-reader live region
    await page.clock.install(); // before goto: the 800 ms debounce and the 8 s toast window are driven by the test

    await test.step('[20-E-010] the name input: label "Tên phòng", hint linked by aria-describedby, error linked and aria-invalid', async () => {
      await openRooms(page, projectId, first.id);
      await selectRoom(page, code);
      await expect(field).toHaveValue(NAMES.one);
      const hint = page.getByText(ROOM.nameHint, { exact: true });
      await expect.soft(hint).toBeVisible();
      const hintId = await hint.getAttribute('id');
      expect.soft(hintId, 'hint has an id').toBeTruthy();
      await expect.soft(field).toHaveAttribute('aria-describedby', new RegExp(`(^|\\s)${hintId ?? '-'}(\\s|$)`, 'u'));
      await field.fill('   ');
      await field.press('Enter');
      const error = page.getByText(ROOM.nameEmpty, { exact: true });
      await expect.soft(error).toBeVisible();
      await expect.soft(field).toHaveAttribute('aria-invalid', 'true');
      await expect.soft(field).toHaveAttribute('aria-describedby', new RegExp(`(^|\\s)${(await error.getAttribute('id')) ?? '-'}(\\s|$)`, 'u'));
      await captureEvidence(page, 'E04_20-E-010_name-input-a11y.png');
      await field.press('Escape');
    });

    await test.step('[20-A-011] blur commits the rename without Enter', async () => {
      const put = waitForLayerPut(page, projectId, first.id, renamedTo('qa tên blur'), [200]);
      await field.fill('qa tên blur');
      await page.getByRole('heading', { name: ROOM.inspector, exact: true, level: 3 }).click(); // blur
      expect.soft((await put).response.status(), 'PUT #35 after blur').toBe(200);
      await expect.soft(toastOf(page, toastRename(NAMES.one, 'qa tên blur'))).toBeVisible();
      await captureEvidence(page, 'E04_20-A-011_blur-commit.png');
    });

    await test.step('[20-A-012] Enter then blur commits once', async () => {
      const mark = sess.reqs.length;
      const put = waitForLayerPut(page, projectId, first.id, renamedTo('qa tên enter'), [200]);
      await field.fill('qa tên enter');
      await field.press('Enter');
      await page.getByRole('heading', { name: ROOM.inspector, exact: true, level: 3 }).click(); // blur after Enter
      await put;
      await flush(page);
      expect.soft(putsOf(mark).filter((p) => p.rooms.some((r) => r.name === 'qa tên enter')), 'one PUT for Enter + blur').toHaveLength(1);
      await expect.soft(toastOf(page, toastRename('qa tên blur', 'qa tên enter'))).toHaveCount(1);
      await captureEvidence(page, 'E04_20-A-012_enter-then-blur.png');
    });

    await test.step('[20-C-005] Enter with an unchanged name does nothing: no toast, no PUT', async () => {
      const mark = sess.reqs.length;
      const toastsBefore = await toastRegion(page).getByRole('status').count();
      await field.focus();
      await field.press('Enter');
      await flush(page);
      expect.soft(putsOf(mark), 'no PUT').toHaveLength(0);
      expect.soft(await toastRegion(page).getByRole('status').count(), 'no new toast').toBe(toastsBefore);
      await captureEvidence(page, 'E04_20-C-005_unchanged-enter.png');
    });

    await test.step('[20-A-013] blank / spaces + Enter is refused locally: message, old name back, no PUT', async () => {
      const mark = sess.reqs.length;
      await field.fill('   ');
      await field.press('Enter');
      await expect.soft(page.getByText(ROOM.nameEmpty, { exact: true })).toBeVisible();
      await expect.soft(field).toHaveValue('qa tên enter');
      await flush(page);
      expect.soft(putsOf(mark), 'no PUT').toHaveLength(0);
      await captureEvidence(page, 'E04_20-A-013_blank-refused.png');
    });

    await test.step('[20-A-014] Esc drops the draft', async () => {
      const mark = sess.reqs.length;
      await field.fill('qa nháp bỏ');
      await field.press('Escape');
      await expect.soft(field).toHaveValue('qa tên enter');
      await expect.soft(page.getByText(ROOM.nameEmpty, { exact: true })).toHaveCount(0);
      await flush(page);
      expect.soft(putsOf(mark), 'no PUT').toHaveLength(0);
      await captureEvidence(page, 'E04_20-A-014_escape-drops.png');
    });

    await test.step('[20-A-016] the suggestion chips list the eight canonical names', async () => {
      const chips = page.getByRole('group', { name: ROOM.suggestions, exact: true }).getByRole('button');
      await expect.soft(chips).toHaveText([...SUGGESTIONS]);
      await captureEvidence(page, 'E04_20-A-016_chips.png');
    });

    await test.step('[20-A-015] a chip fills the draft only (highlighted, input focused); Enter then saves it', async () => {
      const mark = sess.reqs.length;
      const chip = page.getByRole('group', { name: ROOM.suggestions, exact: true }).getByRole('button', { name: 'Phòng ngủ', exact: true });
      await chip.click();
      await expect.soft(field).toHaveValue('Phòng ngủ');
      await expect.soft(field).toBeFocused();
      await expect.soft(chip).toHaveClass(/bg-accent-wash/u);
      await flush(page);
      expect.soft(putsOf(mark), 'the chip alone writes nothing').toHaveLength(0);
      await captureEvidence(page, 'E04_20-A-015_chip-fills.png');
      const put = waitForLayerPut(page, projectId, first.id, renamedTo('Phòng ngủ'), [200]);
      await field.press('Enter');
      await put;
    });

    await test.step('[20-E-011] the chips group is named "Gợi ý tên phòng"', async () => {
      await expect.soft(page.getByRole('group', { name: ROOM.suggestions, exact: true })).toHaveCount(1);
      await captureEvidence(page, 'E04_20-E-011_chips-group.png');
    });

    await test.step('[20-A-019] the toast "Hoàn tác" after a rename restores the name and saves it', async () => {
      // Notifications of one type inside 5 s fold into ONE toast whose "Hoàn tác" undoes all of them (notificationBus.ts
      // DEFAULT_GROUP_WINDOW_MS); let the window of the earlier renames pass so this rename has its own toast.
      await advance(page, 6_000);
      const put = waitForLayerPut(page, projectId, first.id, renamedTo('qa tên mới'), [200]);
      await field.fill('qa tên mới');
      await field.press('Enter');
      await put;
      const toast = toastOf(page, toastRename('Phòng ngủ', 'qa tên mới'));
      await expect(toast).toBeVisible();
      const back = waitForLayerPut(page, projectId, first.id, renamedTo('Phòng ngủ'), [200]);
      await toast.getByRole('button', { name: ROOM.undo, exact: true }).click();
      const restored = await back.then(() => true, () => false);
      await attachJson('E04_20-A-019_state.json', {
        savedUndo: restored,
        field: await field.inputValue(),
        options: await roomOptions(page).evaluateAll((els) => els.map((el) => el.getAttribute('aria-label'))),
      });
      expect.soft(restored, 'the undo PUT with the old name').toBe(true);
      await expect.soft(field).toHaveValue('Phòng ngủ');
      await captureEvidence(page, 'E04_20-A-019_undo-toast.png');
    });

    await test.step('[20-B-015] save feedback after an edit: "Đang lưu…" while the PUT is in flight, then "Đã lưu lúc HH:MM"', async () => {
      // SCR-20 draws no indicator: `useSaveIndicator(autosave)` (URR:596) only feeds the screen-reader live region, and it
      // speaks "saved" / "failed" / "offline" but keeps "dirty" and "saving" silent (useSaveIndicator.ts:104-135).
      const hold = await holdFirst(page, (url, method) => method === 'PUT' && url.pathname === layerPath(projectId, first.id));
      try {
        await field.fill('qa đang lưu');
        await field.press('Enter');
        await hold.seen;
        const sawSaving = (await announced()).includes(SAVING) || (await saveChip(page, SAVING).count()) > 0;
        expect.soft(sawSaving, '"Đang lưu…" is shown or announced while the PUT is in flight (it never is on this screen)').toBe(true);
        await captureEvidence(page, 'E04_20-B-015_saving.png');
      } finally {
        await hold.release();
      }
      await expect.poll(async () => (await announced()).some((text) => SAVED_AT.test(text.trim())), { message: '"Đã lưu lúc HH:MM" announced' }).toBe(true);
      await attachJson('E04_20-B-015_announced.json', { announced: await announced() });
      await captureEvidence(page, 'E04_20-B-015_saved.png');
    });

    await test.step('[20-A-021] Ctrl+S flushes the pending save now (before the 800 ms debounce)', async () => {
      const mark = sess.reqs.length;
      const put = waitForLayerPut(page, projectId, first.id, renamedTo('qa ctrl s'), [200]);
      const t0 = Date.now();
      await field.fill('qa ctrl s');
      await field.press('Enter');
      await page.getByRole('heading', { name: ROOM.inspector, exact: true, level: 3 }).click(); // focus out of the field
      await page.keyboard.press('Control+s');
      expect.soft((await put).response.status(), 'PUT #35 right after Ctrl+S').toBe(200);
      const elapsed = Date.now() - t0;
      await attachJson('E04_20-A-021_elapsed.json', { elapsedMs: elapsed, debounceMs: 800, putsSince: putsOf(mark).length });
      expect.soft(elapsed, 'the PUT left before the 800 ms debounce could fire').toBeLessThan(800);
      await captureEvidence(page, 'E04_20-A-021_ctrl-s.png');
    });

    await test.step('[20-G-004] quick successive edits (rename + usage) coalesce into one PUT after the 800 ms debounce', async () => {
      await page.clock.pauseAt(await page.evaluate(() => Date.now() + 100));
      const mark = sess.reqs.length;
      await field.fill('qa gộp một lần');
      await field.press('Enter');
      await page.clock.runFor(100);
      const listbox = await openUsage(page);
      await page.clock.runFor(300); // let the popup animation finish; the debounce (800 ms) is still pending
      await listbox.getByRole('option', { name: 'Bếp', exact: true }).click();
      await page.clock.runFor(100);
      expect.soft(putsOf(mark), 'still debouncing').toHaveLength(0);
      await page.clock.runFor(1_200);
      await settle(page);
      const sent = putsOf(mark);
      expect.soft(sent, 'one PUT for both edits').toHaveLength(1);
      const room = sent[0]?.rooms.find((r) => r.id === roomId);
      expect.soft(room?.name).toBe('qa gộp một lần');
      expect.soft(room?.usage).toBe('kitchen');
      await shotPaused(page, 'E04_20-G-004_coalesced.png');
      await page.clock.resume();
      await expect
        .poll(async () => (await announced()).some((text) => SAVED_AT.test(text.trim())), { message: '"Đã lưu lúc HH:MM" announced' })
        .toBe(true); // no visible chip on SCR-20: the save feedback is the live region
    });

    await test.step('[20-A-050] reload after a rename keeps the server value', async () => {
      await openRooms(page, projectId, first.id);
      await selectRoom(page, code);
      await expect.soft(field).toHaveValue('qa gộp một lần');
      await captureEvidence(page, 'E04_20-A-050_reload-keeps.png');
    });

    await test.step('[20-A-051] leaving with an unsaved change raises the beforeunload guard', async () => {
      const dialogs: string[] = [];
      page.once('dialog', (dialog) => {
        dialogs.push(dialog.type());
        void dialog.dismiss(); // stay on the page
      });
      try {
        await page.clock.pauseAt(await page.evaluate(() => Date.now() + 100));
        await field.fill('qa chưa lưu');
        await field.press('Enter'); // dirty, the debounce is held
        await settle(page);
        await page.goto('about:blank').catch(() => undefined);
        expect.soft(dialogs, 'a beforeunload dialog while the floor is unsaved').toContain('beforeunload');
        await shotPaused(page, 'E04_20-A-051_beforeunload.png');
      } finally {
        await page.clock.resume().catch(() => undefined);
      }
    });
  } finally {
    await cleanup(projectId, s);
  }
});

/* ================================================================= FL-20-03 */

test('SCR-20 · FL-20-03 · name rules, unnamed approve, same usage, Ctrl+Z, PUT revisions', async ({ browser }) => {
  test.setTimeout(240_000);
  const seed = roomsAB();
  const { projectId, first } = await newProject('20-03');
  let s: Session | undefined;
  try {
    await seedFloor(layerApi, projectId, first.id, seed);
    const sess = await openSession(browser, creds());
    s = sess;
    const { page } = sess;
    const [idA, idB, idBlank] = [seed.rooms.a as string, seed.rooms.b as string, seed.rooms.blank as string];
    const codes = codesOf([idA, idB, idBlank]);
    const [codeA, codeB, codeBlank] = [idA, idB, idBlank].map((id) => codes.get(id) as string) as [string, string, string];
    const field = nameField(page);
    const putsOf = (mark: number) => layerPutsSince(s as Session, projectId, first.id, mark);
    const rename = async (value: string): Promise<void> => {
      await field.fill(value);
      await field.press('Enter');
    };

    await test.step('[20-C-001] renaming B to "a" (case-insensitive clash with "A") is refused: toast, no PUT', async () => {
      await openRooms(page, projectId, first.id);
      await selectRoom(page, codeB);
      const mark = sess.reqs.length;
      await rename('a');
      await expect.soft(toastOf(page, new RegExp(`đã có phòng ${codeA.replace('#', '#')} mang tên "A"`, 'u'))).toBeVisible();
      await flush(page);
      expect.soft(putsOf(mark), 'a refused rename writes nothing').toHaveLength(0);
      await captureEvidence(page, 'E04_20-C-001_name-clash.png');
    });

    await test.step('[20-C-002] a name over 60 characters is refused with its length', async () => {
      const mark = sess.reqs.length;
      await rename('a'.repeat(61) + 'b'); // 62 chars, no clash
      await expect.soft(toastOf(page, 'Tên phòng dài 62 ký tự, quá mức 60 ký tự mà nhãn trên mặt bằng chứa được.')).toBeVisible();
      await flush(page);
      expect.soft(putsOf(mark)).toHaveLength(0);
      await captureEvidence(page, 'E04_20-C-002_too-long.png');
    });

    await test.step('[20-C-003] a name with an invisible control character (U+202E) is refused', async () => {
      const mark = sess.reqs.length;
      await rename('qa‮phòng');
      await expect.soft(toastOf(page, 'Tên phòng chứa ký tự không hiển thị được.')).toBeVisible();
      await flush(page);
      expect.soft(putsOf(mark)).toHaveLength(0);
      await captureEvidence(page, 'E04_20-C-003_control-char.png');
    });

    await test.step('[20-C-004] a name typed in NFD is stored and listed in NFC', async () => {
      const nfd = 'Phòng ngủ ba'.normalize('NFD');
      const nfc = 'Phòng ngủ ba'.normalize('NFC');
      expect(nfd).not.toBe(nfc);
      const put = waitForLayerPut(page, projectId, first.id, (rooms) => rooms.some((r) => r.id === idB && r.name === nfc), [200]);
      await rename(nfd);
      const sent = (await put).response.request().postDataJSON() as { body: { layer: { rooms: { id: string; name: string }[] } } };
      const sentName = sent.body.layer.rooms.find((r) => r.id === idB)?.name ?? '';
      expect.soft(sentName === nfc, 'the PUT carries NFC').toBe(true);
      await expect.soft(optionOf(page, codeB)).toHaveAccessibleName(new RegExp(` · ${nfc} · `, 'u'));
      await captureEvidence(page, 'E04_20-C-004_nfd-to-nfc.png');
    });

    await test.step('[20-C-006] a whitespace-only name counts as unnamed: "Cần chú ý", filter count 1', async () => {
      const square = rect(10000, 0, 14000, 4000);
      await expect.soft(optionOf(page, codeBlank)).toHaveAccessibleName(optionName(codeBlank, NAMES.unnamed, square, ROOM.statusUnnamed));
      await expect.soft(filterToggle(page)).toContainText('1');
      await captureEvidence(page, 'E04_20-C-006_whitespace-unnamed.png');
    });

    await test.step('[20-C-007] ⚑ approving an unnamed room: it must leave "Cần chú ý" (or be refused with a reason)', async () => {
      await selectRoom(page, codeBlank);
      const approve = page.getByRole('button', { name: ROOM.approve, exact: true });
      const put = waitForLayerPut(page, projectId, first.id, (rooms) => rooms.some((r) => r.id === idBlank && r.reviewed === true), [200, 422]);
      await approve.click();
      const answer = await put.catch(() => null);
      const refused = answer === null || answer.response.status() !== 200;
      const stillAttention = (await optionOf(page, codeBlank).getAttribute('aria-label'))?.endsWith(ROOM.statusUnnamed) ?? false;
      expect.soft(refused || !stillAttention, 'an approved room with no name still reads "Cần chú ý", approve stays enabled and gives no feedback').toBe(true);
      await captureEvidence(page, 'E04_20-C-007_approve-unnamed.png');
    });

    await test.step('[20-C-008] picking the same usage again sends no command (or says nothing changes)', async () => {
      await selectRoom(page, codeA);
      const mark = sess.reqs.length;
      const listbox = await openUsage(page);
      await listbox.getByRole('option', { name: 'Phòng ngủ', exact: true }).click(); // the seeded usage is bedroom
      await flush(page);
      expect.soft(putsOf(mark), 'same usage writes nothing').toHaveLength(0);
      await captureEvidence(page, 'E04_20-C-008_same-usage.png');
    });

    await test.step('[20-A-020] ⚑ Ctrl+Z on SCR-20 agrees with the screen history (the toast "Hoàn tác" of that rename is consumed)', async () => {
      const put = waitForLayerPut(page, projectId, first.id, (rooms) => rooms.some((r) => r.id === idA && r.name === 'qa đổi để hoàn tác'), [200]);
      await rename('qa đổi để hoàn tác');
      await put;
      const toast = toastOf(page, /thành "qa đổi để hoàn tác"/u);
      await expect(toast).toBeVisible();
      await page.getByRole('heading', { name: ROOM.inspector, exact: true, level: 3 }).click(); // focus out of the field
      const back = waitForLayerPut(page, projectId, first.id, (rooms) => rooms.some((r) => r.id === idA && r.name === 'A'), [200]);
      await page.keyboard.press('Control+z');
      await back.catch(() => undefined);
      await expect.soft(optionOf(page, codeA)).toHaveAccessibleName(new RegExp(` · A · `, 'u'));
      await expect.soft(toast, 'the rename was undone: its "Hoàn tác" ticket must be gone').toHaveCount(0);
      await captureEvidence(page, 'E04_20-A-020_ctrl-z.png');
    });

    await test.step('[20-G-003] each edit PUTs {baseVersion, body.layer}; the next edit uses the revision the answer carried', async () => {
      const mark = sess.reqs.length;
      const first200 = waitForLayerPut(page, projectId, first.id, (rooms) => rooms.some((r) => r.id === idA && r.name === 'qa phiên bản một'), [200]);
      await rename('qa phiên bản một');
      const one = await first200;
      const second200 = waitForLayerPut(page, projectId, first.id, (rooms) => rooms.some((r) => r.id === idA && r.name === 'qa phiên bản hai'), [200]);
      await rename('qa phiên bản hai');
      const two = await second200;
      const bases = putsOf(mark).map((p) => p.baseVersion);
      expect.soft(one.response.status()).toBe(200);
      expect.soft(two.response.status()).toBe(200);
      const [b1, b2] = [bases[bases.length - 2], bases[bases.length - 1]];
      expect.soft(b2, `baseVersions ${bases.join(', ')}`).toBe((b1 ?? -2) + 1);
      await attachJson('E04_20-G-003_base-versions.json', { baseVersions: bases });
      await captureEvidence(page, 'E04_20-G-003_revisions.png');
    });
  } finally {
    await cleanup(projectId, s);
  }
});


/* ================================================================= FL-20-04 */

test('SCR-20 · FL-20-04 · "Chuẩn hoá tên": preview, close, canonical names, apply and undo, nothing to change', async ({ browser }) => {
  test.setTimeout(240_000);
  const seed = roomsNormalize();
  const bep = roomsBep();
  const { projectId, floors } = await newProject('20-04', ['Tầng 1', 'Tầng 2']);
  const [f1, f2] = floors as [Floor, Floor];
  let s: Session | undefined;
  try {
    await seedFloor(layerApi, projectId, f1.id, seed);
    await seedFloor(layerApi, projectId, f2.id, bep);
    const sess = await openSession(browser, creds());
    s = sess;
    const { page } = sess;
    const idOf = (name: string): string => seed.rooms[name] as string;
    const normalizeButton = page.getByRole('button', { name: ROOM.normalize, exact: true });
    const dialog = page.getByRole('dialog', { name: ROOM.normalizeDialog, exact: true });
    const rows = dialog.locator('tbody tr');
    const putsOf = (mark: number) => layerPutsSince(sess, projectId, f1.id, mark);

    await test.step('[20-A-022] "Chuẩn hoá tên" with names to change opens the preview: sentence, caption, three columns, "Huỷ" + "Áp dụng"', async () => {
      await openRooms(page, projectId, f1.id);
      await normalizeButton.click();
      await expect(dialog).toBeVisible();
      await expect(dialog.getByText('Bấm "Áp dụng" để đổi 2 tên phòng như bảng dưới.', { exact: true })).toBeVisible();
      await expect.soft(dialog.locator('caption')).toHaveText(ROOM.normalizeCaption);
      await expect.soft(dialog.getByRole('columnheader')).toHaveText([...ROOM.normalizeColumns]);
      await expect.soft(dialog.getByRole('button', { name: ROOM.cancel, exact: true })).toBeVisible();
      await expect.soft(dialog.getByRole('button', { name: ROOM.apply, exact: true })).toBeVisible();
      await captureEvidence(page, 'E04_20-A-022_preview.png');
    });

    await test.step('[20-E-009] the preview table has a <caption> and column headers with scope="col"', async () => {
      await expect.soft(dialog.locator('table > caption')).toHaveCount(1);
      await expect.soft(dialog.locator('th[scope="col"]')).toHaveCount(3);
      await captureEvidence(page, 'E04_20-E-009_table-semantics.png');
    });

    await test.step('[20-A-025] the preview closes by Esc and by the X "Đóng hộp thoại"; nothing is written', async () => {
      const mark = sess.reqs.length;
      await page.keyboard.press('Escape');
      await expect.soft(dialog).toHaveCount(0);
      await normalizeButton.click();
      await expect(dialog).toBeVisible();
      await dialog.getByRole('button', { name: ROOM.closeX, exact: true }).click();
      await expect.soft(dialog).toHaveCount(0);
      await flush(page);
      expect.soft(writesSince(sess, mark), 'closing writes nothing').toEqual([]);
      await captureEvidence(page, 'E04_20-A-025_closed.png');
      await normalizeButton.click();
      await expect(dialog).toBeVisible();
    });

    await test.step('[20-C-009] ⚑ canonical names: "PHONG NGU 2" → "Phòng ngủ 2" (BUG-409 sentence case)', async () => {
      const row = rows.filter({ hasText: 'PHONG NGU 2' });
      await expect.soft(row).toHaveCount(1);
      await expect.soft(row.locator('td').nth(1)).toHaveText('PHONG NGU 2');
      await expect.soft(row.locator('td').nth(2)).toHaveText('Phòng ngủ 2');
      await captureEvidence(page, 'E04_20-C-009_phong-ngu-2.png');
    });

    await test.step('[20-C-010] canonical names: "bep" → "Bếp"; "Bếp 2" and "Kho" are not listed', async () => {
      const row = rows.filter({ has: page.getByRole('cell', { name: 'bep', exact: true }) });
      await expect.soft(row.locator('td').nth(2)).toHaveText('Bếp');
      await expect.soft(dialog.getByRole('cell', { name: 'Bếp 2', exact: true })).toHaveCount(0);
      await expect.soft(dialog.getByRole('cell', { name: 'Kho', exact: true })).toHaveCount(0);
      await captureEvidence(page, 'E04_20-C-010_bep.png');
    });

    await test.step('[20-C-011] two rooms that would get the same canonical name: the second ("PHONG NGU") is skipped', async () => {
      await expect.soft(rows, 'two rows, not three').toHaveCount(2);
      await expect.soft(dialog.getByRole('cell', { name: 'PHONG NGU', exact: true })).toHaveCount(0);
      await captureEvidence(page, 'E04_20-C-011_duplicate-skipped.png');
    });

    await test.step('[20-A-026] "Áp dụng" renames every row in one command: one toast, one PUT with the canonical names', async () => {
      const mark = sess.reqs.length;
      const put = waitForLayerPut(page, projectId, f1.id, (rooms) => rooms.some((r) => r.id === idOf('bep') && r.name === 'Bếp'), [200]);
      await dialog.getByRole('button', { name: ROOM.apply, exact: true }).click();
      const sent = sentRooms(await put);
      const nameOf = (id: string): unknown => sent.find((r) => r.id === id)?.name;
      expect.soft(nameOf(idOf('PHONG NGU 2'))).toBe('Phòng ngủ 2');
      expect.soft(nameOf(idOf('bep'))).toBe('Bếp');
      for (const unchanged of ['Bếp 2', 'Kho', 'PHONG NGU', 'Phòng ngủ']) expect.soft(nameOf(idOf(unchanged)), `"${unchanged}" untouched`).toBe(unchanged);
      await expect.soft(toastOf(page, 'Chuẩn hoá tên 2 phòng.')).toBeVisible();
      await expect.soft(dialog).toHaveCount(0);
      await flush(page);
      expect.soft(putsOf(mark), 'one PUT').toHaveLength(1);
      await captureEvidence(page, 'E04_20-A-026_applied.png');
    });

    await test.step('[20-A-027] one "Hoàn tác" undoes the whole normalisation in one step', async () => {
      const back = waitForLayerPut(page, projectId, f1.id, (rooms) => rooms.some((r) => r.id === idOf('bep') && r.name === 'bep'), [200]);
      await toastOf(page, 'Chuẩn hoá tên 2 phòng.').getByRole('button', { name: ROOM.undo, exact: true }).click();
      const sent = sentRooms(await back);
      expect.soft(sent.find((r) => r.id === idOf('PHONG NGU 2'))?.name).toBe('PHONG NGU 2');
      expect.soft(sent.find((r) => r.id === idOf('bep'))?.name).toBe('bep');
      const codes = codesOf(Object.values(seed.rooms));
      await expect.soft(optionOf(page, codes.get(idOf('PHONG NGU 2')) as string)).toHaveAccessibleName(/ · PHONG NGU 2 · /u);
      await expect.soft(optionOf(page, codes.get(idOf('bep')) as string)).toHaveAccessibleName(/ · bep · /u);
      await captureEvidence(page, 'E04_20-A-027_undone.png');
    });

    await test.step('[20-A-023] nothing to change: the message and only "Đóng" (no "Huỷ", no "Áp dụng")', async () => {
      await openRooms(page, projectId, f2.id);
      await normalizeButton.click();
      await expect(dialog).toBeVisible();
      await expect.soft(dialog.getByText(ROOM.normalizeNothing, { exact: true })).toBeVisible();
      await expect.soft(dialog.getByRole('button', { name: ROOM.close, exact: true })).toHaveCount(1);
      await expect.soft(dialog.getByRole('button', { name: ROOM.cancel, exact: true })).toHaveCount(0);
      await expect.soft(dialog.getByRole('button', { name: ROOM.apply, exact: true })).toHaveCount(0);
      await captureEvidence(page, 'E04_20-A-023_nothing-to-change.png');
    });
  } finally {
    await cleanup(projectId, s);
  }
});

/* ================================================================= FL-20-05 */

test('SCR-20 · FL-20-05 · merge and split', async ({ browser }) => {
  test.setTimeout(420_000);
  const loop = mergeLoop();
  const separate = mergeSeparate();
  const three = mergeThree();
  const noWall = mergeNoWall();
  const oversized = mergeOversized();
  const split = splitLoops();
  const { projectId, floors } = await newProject('20-05', ['Tầng 1', 'Tầng 2', 'Tầng 3', 'Tầng 4', 'Tầng 5', 'Tầng 6']);
  const [f1, f2, f3, f4, f5, f6] = floors as [Floor, Floor, Floor, Floor, Floor, Floor];
  let s: Session | undefined;
  try {
    for (const [floor, seed] of [[f1, loop], [f2, separate], [f3, three], [f4, noWall], [f5, oversized], [f6, split]] as const) {
      await seedFloor(layerApi, projectId, floor.id, seed);
    }
    const sess = await openSession(browser, creds());
    s = sess;
    const { page } = sess;
    const code = (seed: { rooms: Readonly<Record<string, string>> }, key: string): string =>
      codesOf(Object.values(seed.rooms)).get(seed.rooms[key] as string) as string;
    const mergeButton = page.getByRole('button', { name: ROOM.merge, exact: true });
    const mergeDialog = page.getByRole('dialog', { name: ROOM.mergeDialog, exact: true });
    const mergeSelect = mergeDialog.getByRole('combobox', { name: ROOM.mergeSelect, exact: true });
    const confirmMerge = mergeDialog.getByRole('button', { name: ROOM.mergeDialog, exact: true });
    const splitButton = page.getByRole('button', { name: ROOM.split, exact: true });
    const splitDialog = page.getByRole('dialog', { name: ROOM.splitDialog, exact: true });
    const putsOf = (floorId: string, mark: number) => layerPutsSince(sess, projectId, floorId, mark);

    await test.step('[20-A-028] "Gộp phòng" opens the dialog: question, "Phòng sẽ gộp vào" with the placeholder, confirm disabled', async () => {
      await openRooms(page, projectId, f1.id);
      await selectRoom(page, code(loop, 'target'));
      await mergeButton.click();
      await expect(mergeDialog).toBeVisible();
      await expect.soft(
        mergeDialog.getByText(`Phòng ${code(loop, 'target')} và phòng được chọn sẽ thành một phòng. Ranh giữa hai phòng biến mất và một trong hai mã phòng không còn nữa.`, { exact: true }),
      ).toBeVisible();
      await expect.soft(mergeSelect).toContainText(ROOM.mergePlaceholder);
      await expect.soft(confirmMerge).toBeDisabled();
      await captureEvidence(page, 'E04_20-A-028_merge-dialog.png');
    });

    await test.step('[20-E-007] dialogs: role=dialog aria-modal, labelled, focus trapped, Esc closes, X "Đóng hộp thoại" closes', async () => {
      await expect.soft(mergeDialog).toHaveAttribute('aria-modal', 'true');
      await expect.soft(mergeDialog).toHaveAttribute('aria-labelledby', /\S/u);
      for (let i = 0; i < 6; i += 1) {
        await page.keyboard.press('Tab');
        expect.soft(await mergeDialog.evaluate((el) => el.contains(document.activeElement)), `Tab ${String(i + 1)} stays inside the dialog`).toBe(true);
      }
      await page.keyboard.press('Escape');
      await expect.soft(mergeDialog).toHaveCount(0);
      await mergeButton.click();
      await mergeDialog.getByRole('button', { name: ROOM.closeX, exact: true }).click();
      await expect.soft(mergeDialog).toHaveCount(0);
      await captureEvidence(page, 'E04_20-E-007_dialog-a11y.png');
    });

    await test.step('[20-E-008] the dialog title and its confirm button share the name "Gộp hai phòng" (two nodes)', async () => {
      await mergeButton.click();
      await expect(mergeDialog).toBeVisible();
      await expect.soft(mergeDialog.getByRole('heading', { name: ROOM.mergeDialog, exact: true })).toHaveCount(1);
      await expect.soft(confirmMerge).toHaveCount(1);
      await captureEvidence(page, 'E04_20-E-008_shared-name.png');
      await page.keyboard.press('Escape');
    });

    await test.step('[20-A-035] reopening the merge dialog does not preselect the last candidate', async () => {
      await openRooms(page, projectId, f3.id);
      await selectRoom(page, code(three, 'a'));
      await mergeButton.click();
      const listbox = await openSelectOf(page, mergeSelect);
      await listbox.getByRole('option').first().click();
      await expect.soft(confirmMerge).toBeEnabled();
      await mergeDialog.getByRole('button', { name: ROOM.cancel, exact: true }).click();
      await mergeButton.click();
      await expect.soft(mergeSelect).toContainText(ROOM.mergePlaceholder);
      await expect.soft(confirmMerge).toBeDisabled();
      await captureEvidence(page, 'E04_20-A-035_reopen-clean.png');
    });

    await test.step('[20-C-012] ⚑ the merge candidate label of an unnamed room is readable (not "{code} · ")', async () => {
      const listbox = await openSelectOf(page, mergeSelect);
      const labels = (await listbox.getByRole('option').allInnerTexts()).map((text) => text.trim());
      const blank = labels.find((label) => label.startsWith(code(three, 'blank')));
      expect.soft(blank, `candidates ${labels.join(' | ')}`).toBeDefined();
      expect.soft(blank === undefined || blank.replace(code(three, 'blank'), '').replace('·', '').trim() !== '', 'an unnamed candidate reads "{code} ·" with nothing after the dot').toBe(true);
      await captureEvidence(page, 'E04_20-C-012_unnamed-candidate.png');
      await page.keyboard.press('Escape');
      await page.keyboard.press('Escape');
    });

    await test.step('[20-A-031] merging two rooms inside one wall loop: toast, PUT, the absorbed room is gone', async () => {
      await openRooms(page, projectId, f1.id);
      await selectRoom(page, code(loop, 'target'));
      const mark = sess.reqs.length;
      await mergeButton.click();
      const listbox = await openSelectOf(page, mergeSelect);
      await listbox.getByRole('option', { name: new RegExp(`${code(loop, 'absorbed')} · qa gộp con`, 'u') }).click();
      const put = waitForLayerPut(page, projectId, f1.id, (rooms) => rooms.length === 1, [200]);
      await confirmMerge.click();
      const merged = sentRooms(await put);
      expect.soft(merged[0]?.id).toBe(loop.rooms.target);
      await expect
        .soft(toastOf(page, /Gộp phòng "qa gộp con" #\S+ 14,82 m² vào phòng "qa gộp mẹ" #\S+ 14,82 m²; phòng sau khi gộp rộng 29,64 m²/u))
        .toBeVisible();
      await expect.soft(roomOptions(page)).toHaveCount(1);
      await flush(page); // marker: anything pending is sent and logged
      expect.soft(putsOf(f1.id, mark), 'one PUT carried the merge').toHaveLength(1);
      await captureEvidence(page, 'E04_20-A-031_merged.png');
    });

    await test.step('[20-C-013] merge re-homes furniture: the toast ends ", kèm 1 đồ đạc đổi phòng." and the table now belongs to the kept room', async () => {
      await expect.soft(toastOf(page, /, kèm 1 đồ đạc đổi phòng\./u)).toBeVisible();
      const last = putsOf(f1.id, 0).pop();
      const furniture = last === undefined ? [] : (last.layer.furniture as { roomId?: string }[]);
      expect.soft(furniture.map((item) => item.roomId)).toEqual([loop.rooms.target]);
      await captureEvidence(page, 'E04_20-C-013_furniture-rehomed.png');
    });

    const refusal = async (floorId: string, seed: { rooms: Readonly<Record<string, string>> }, from: string, to: string, text: string, shot: string): Promise<void> => {
      await openRooms(page, projectId, floorId);
      await selectRoom(page, code(seed, from));
      const mark = sess.reqs.length;
      await mergeButton.click();
      const listbox = await openSelectOf(page, mergeSelect);
      await listbox.getByRole('option', { name: new RegExp(`^${code(seed, to)} · `, 'u') }).click();
      await confirmMerge.click();
      await expect.soft(toastOf(page, text)).toBeVisible();
      await flush(page);
      expect.soft(putsOf(floorId, mark), 'a refused merge writes nothing').toHaveLength(0);
      await captureEvidence(page, shot);
    };

    await test.step('[20-A-032] merge across a dividing wall is refused with the way out; no PUT', async () => {
      await refusal(
        f2.id,
        separate,
        'p',
        'q',
        'Chưa gộp được: giữa hai phòng vẫn còn một đoạn tường ngăn. Sang lớp tường xoá đoạn tường đó rồi quay lại đây gộp.',
        'E04_20-A-032_across-wall.png',
      );
    });

    await test.step('[20-A-033] merge on a floor with no wall is refused', async () => {
      await refusal(
        f4.id,
        noWall,
        'a',
        'b',
        'Chưa đọc được đồ thị tường của tầng này. Sang lớp tường kiểm tra các đoạn tường lỗi rồi quay lại.',
        'E04_20-A-033_no-wall.png',
      );
    });

    await test.step('[20-A-034] merge refused when the detected region cannot hold both rooms', async () => {
      await refusal(
        f5.id,
        oversized,
        'a',
        'b',
        'Chưa gộp được: vùng dò lại được không nuốt trọn hai phòng đang chọn. Kiểm tra lại ranh tường quanh hai phòng ở lớp tường rồi quay lại.',
        'E04_20-A-034_area-mismatch.png',
      );
    });

    await test.step('[20-A-030] a single room has no candidate: "Không còn phòng nào khác…", Esc closes, no PUT', async () => {
      await openRooms(page, projectId, f1.id); // the merged floor now holds one room
      await roomOptions(page).first().click();
      const mark = sess.reqs.length;
      await mergeButton.click();
      await expect(mergeDialog).toBeVisible();
      await expect.soft(mergeDialog.getByText(ROOM.mergeEmpty, { exact: true })).toBeVisible();
      await captureEvidence(page, 'E04_20-A-030_single-room.png');
      await page.keyboard.press('Escape');
      await expect.soft(mergeDialog).toHaveCount(0);
      await flush(page);
      expect.soft(putsOf(f1.id, mark)).toHaveLength(0);
    });

    await test.step('[20-A-036] a room over a dividing wall offers "Tách phòng" and splits it', async () => {
      await openRooms(page, projectId, f6.id);
      await selectRoom(page, code(split, 's'));
      await expect(splitButton).toBeVisible();
      await splitButton.click();
      await expect(splitDialog).toBeVisible();
      await expect.soft(
        splitDialog.getByText(`Phòng ${code(split, 's')} sẽ cắt làm hai tại điểm đã chọn trên ranh phòng, và một mã phòng mới được sinh ra.`, { exact: true }),
      ).toBeVisible();
      const put = waitForLayerPut(page, projectId, f6.id, (rooms) => rooms.length === 3, [200]);
      await splitDialog.getByRole('button', { name: ROOM.split, exact: true }).click();
      await put;
      await expect
        .soft(toastOf(page, /^Tách phòng "qa tách S" #\S+ [\d.,]+ m² thành [\d.,]+ m² và phòng mới "qa tách S \(phần 2\)" #\S+ [\d.,]+ m²/u))
        .toBeVisible();
      await expect.soft(roomOptions(page)).toHaveCount(3);
      await captureEvidence(page, 'E04_20-A-036_split.png');
    });

    await test.step('[20-C-014] split names the new room "{name} (phần 2)" and moves the furniture inside it', async () => {
      await expect.soft(toastOf(page, /, kèm 1 đồ đạc sang phòng mới\./u)).toBeVisible();
      const last = putsOf(f6.id, 0).pop();
      const created = (last?.rooms ?? []).find((room) => room.name === 'qa tách S (phần 2)');
      expect.soft(created, 'the new room').toBeDefined();
      const furniture = last === undefined ? [] : (last.layer.furniture as { roomId?: string }[]);
      expect.soft(furniture.map((item) => item.roomId)).toEqual([created?.id]);
      await captureEvidence(page, 'E04_20-C-014_split-name-furniture.png');
    });

    await test.step('[20-A-037] the split dialog closes by "Huỷ" and by Esc: no PUT', async () => {
      await selectRoom(page, code(split, 'u'));
      const mark = sess.reqs.length;
      await splitButton.click();
      await expect(splitDialog).toBeVisible();
      await splitDialog.getByRole('button', { name: ROOM.cancel, exact: true }).click();
      await expect.soft(splitDialog).toHaveCount(0);
      await splitButton.click();
      await expect(splitDialog).toBeVisible();
      await page.keyboard.press('Escape');
      await expect.soft(splitDialog).toHaveCount(0);
      await flush(page);
      expect.soft(putsOf(f6.id, mark)).toHaveLength(0);
      await captureEvidence(page, 'E04_20-A-037_split-cancel.png');
    });

    await test.step('[20-A-038] ⚑ with no split point the hint must be one the user can follow (a click on the outline picks the cut)', async () => {
      await selectRoom(page, code(split, 's')); // already split: its outline is one part, no dividing wall is left inside it
      await expect.soft(page.getByText(ROOM.splitHint, { exact: true })).toBeVisible();
      // On the outline, as the hint says, not the centre: the room button covers exactly the room's bounding box
      // (RoomLabelCanvas.tsx:20-32,302-317), so 2 px inside its left edge is on the boundary wall.
      const room = canvasButton(page, 'qa tách S');
      const box = await room.boundingBox();
      if (box === null) throw new Error('room "qa tách S" is not drawn');
      await room.click({ position: { x: 2, y: box.height / 2 } });
      await expect.soft(splitButton, 'following the hint ("bấm lên ranh phòng") offers "Tách phòng"').toBeVisible();
      await captureEvidence(page, 'E04_20-A-038_split-hint.png');
    });
  } finally {
    await cleanup(projectId, s);
  }
});

/* ================================================================= FL-20-06 */

test('SCR-20 · FL-20-06 · "Chưa đặt tên" filter, open-loop gaps, rule notices', async ({ browser }) => {
  test.setTimeout(300_000);
  const gaps = gapsLoop();
  const closed = gapsClosed();
  const unclosed = gapsUnclosed();
  const { projectId, floors } = await newProject('20-06', ['Tầng 1', 'Tầng 2', 'Tầng 3', 'Tầng 4']);
  const [f1, f2, f3, f4] = floors as [Floor, Floor, Floor, Floor];
  let s: Session | undefined;
  try {
    await seedFloor(layerApi, projectId, f1.id, gaps);
    await seedFloor(layerApi, projectId, f2.id, closed);
    await seedFloor(layerApi, projectId, f3.id, unclosed);
    await writeLayer(layerApi, projectId, f4.id, qcLayer); // Q1: "Bếp" + "PHONG NGU 2" in a wall rectangle
    const sess = await openSession(browser, creds());
    s = sess;
    const { page } = sess;
    const idNamed = gaps.rooms.named as string;
    const idBlank = gaps.rooms.blank as string;
    const codes = codesOf([idNamed, idBlank]);
    const codeNamed = codes.get(idNamed) as string;
    const codeBlank = codes.get(idBlank) as string;
    const field = nameField(page);
    const emptyNotice = page.getByText(ROOM.emptyFiltered, { exact: true });
    const gapsSection = page.getByRole('region', { name: ROOM.gapsTitle, exact: true });

    await test.step('[20-A-039] the "Chưa đặt tên" filter narrows the list to the unnamed rooms (aria-pressed, count)', async () => {
      await openRooms(page, projectId, f1.id);
      await expect(roomOptions(page)).toHaveCount(2);
      await expect.soft(filterToggle(page)).toHaveAttribute('aria-pressed', 'false');
      await filterToggle(page).click();
      await expect.soft(filterToggle(page)).toHaveAttribute('aria-pressed', 'true');
      await expect.soft(roomOptions(page)).toHaveCount(1);
      await expect.soft(optionOf(page, codeBlank)).toBeVisible();
      await expect.soft(filterToggle(page)).toContainText('1');
      await captureEvidence(page, 'E04_20-A-039_filter-on.png');
    });

    await test.step('[20-E-004] the filter is a toggle button with aria-pressed and the unnamed count', async () => {
      await expect.soft(page.getByRole('button', { name: /^Chưa đặt tên\s*1$/u })).toHaveAttribute('aria-pressed', 'true');
      await captureEvidence(page, 'E04_20-E-004_toggle-semantics.png');
    });

    await test.step('[20-A-041] filter on: naming the selected unnamed room drops it from the list and from the inspector', async () => {
      await selectRoom(page, codeBlank);
      const put = waitForLayerPut(page, projectId, f1.id, (rooms) => rooms.some((r) => r.id === idBlank && r.name === 'qa đã có tên'), [200]);
      await field.fill('qa đã có tên');
      await field.press('Enter');
      await put;
      await expect.soft(roomOptions(page)).toHaveCount(0);
      await expect.soft(page.getByText(ROOM.inspectorEmpty, { exact: true })).toBeVisible();
      await captureEvidence(page, 'E04_20-A-041_named-drops.png');
    });

    await test.step('[20-A-040] ⚑ BUG-321 filter on with every room named: the notice AND the toggle stay', async () => {
      await expect.soft(emptyNotice).toBeVisible();
      await expect.soft(filterToggle(page), 'the toggle the notice tells the user to switch off').toBeVisible();
      await expect.soft(filterToggle(page)).toHaveAttribute('aria-pressed', 'true');
      await captureEvidence(page, 'E04_20-A-040_filter-empty.png');
    });

    await test.step('[20-E-014] the empty-list notice is a role=status paragraph', async () => {
      await expect.soft(page.locator('p[role="status"]').filter({ hasText: ROOM.emptyFiltered })).toHaveCount(1);
      await captureEvidence(page, 'E04_20-E-014_notice-status.png');
    });

    await test.step('[20-A-042] "Kiểm tra lại vòng hở" re-reads the layer (one GET N16) and writes nothing', async () => {
      const mark = sess.reqs.length;
      const reread = waitForApi(page, 'GET', layerRe(projectId, f1.id), [200]);
      await page.getByRole('button', { name: ROOM.checkGaps, exact: true }).click();
      await reread;
      await flush(page);
      expect.soft(countSince(sess, mark, 'GET', layerPath(projectId, f1.id)), 'one N16 read').toBe(1);
      expect.soft(writesSince(sess, mark), 'no write').toEqual([]);
      await captureEvidence(page, 'E04_20-A-042_recheck.png');
    });

    await test.step('[20-A-043] an open wall loop lists its gap: length, "Tường liên quan" + the two wall ids, "Xem tại lớp tường" → walls', async () => {
      await filterToggle(page).click(); // filter off
      await expect(gapsSection).toBeVisible();
      await expect.soft(gapsSection.getByText(formatLength(50), { exact: true })).toBeVisible();
      await expect.soft(gapsSection.getByText(ROOM.gapWalls, { exact: true })).toBeVisible();
      const shown = (await gapsSection.locator('code').allInnerTexts()).map((text) => text.trim()).sort();
      expect.soft(shown).toEqual([gaps.walls.right as string, gaps.walls.top as string].sort());
      await captureEvidence(page, 'E04_20-A-043_gap-row.png');
      await gapsSection.getByRole('button', { name: ROOM.toWalls, exact: true }).click();
      await expect.soft(page).toHaveURL(new RegExp(`${ROUTES.project.walls(projectId, f1.id).replace(/[.*+?^${}()|[\]\\]/gu, '\\$&')}$`, 'u'));
    });

    await test.step('[20-A-044] no hole but an unclosed room: the sentence names how many rooms are unclosed (BUG-407)', async () => {
      await openRooms(page, projectId, f3.id);
      await expect.soft(gapsSection.getByText(/^Các đầu tường đều đã nối, nhưng 1 phòng chưa kín vì có cạnh không có tường chạy dọc — chọn phòng để xem nhắc công năng\.$/u)).toBeVisible();
      await captureEvidence(page, 'E04_20-A-044_unclosed-rooms.png');
    });

    await test.step('[20-A-045] no hole and no unclosed room: "Chưa thấy vòng tường hở nào ở tầng này."', async () => {
      await openRooms(page, projectId, f2.id);
      await expect.soft(gapsSection.getByText(ROOM.gapsEmpty, { exact: true })).toBeVisible();
      await captureEvidence(page, 'E04_20-A-045_no-gap.png');
    });

    await test.step('[20-A-046] ⚑ rule notices on the selected room: rule name, message, suggestion, "Xem luật không gian" → /rules (BUG-408 copy)', async () => {
      await openRooms(page, projectId, f4.id);
      await roomOptions(page).filter({ hasText: 'Bếp' }).first().click();
      const notices = page.getByRole('region', { name: ROOM.notices, exact: true });
      await expect(notices).toBeVisible();
      const items = notices.locator('li');
      expect.soft(await items.count(), 'at least one notice').toBeGreaterThan(0);
      await expect.soft(notices.getByRole('link', { name: ROOM.noticeLink, exact: true }).first()).toHaveAttribute('href', ROUTES.project.rules(projectId));
      for (let i = 0; i < (await items.count()); i += 1) {
        const parts = await items.nth(i).locator('span, p').allInnerTexts();
        const [ruleName = '', message = '', suggestion = ''] = parts.map((text) => text.trim());
        expect.soft(ruleName, 'rule title is not an internal code').not.toMatch(/^[A-Z0-9]+(-[A-Z0-9]+)+$/u);
        expect.soft(message.charAt(0), `message starts with a capital: "${message}"`).toBe(message.charAt(0).toLocaleUpperCase('vi'));
        expect.soft(message, 'no "0 tường bao" nonsense').not.toContain('0 tường bao');
        expect.soft(`${message} ${suggestion}`, 'no shoelace formula').not.toMatch(/×|x1/u);
      }
      await captureEvidence(page, 'E04_20-A-046_rule-notices.png');
    });

    await test.step('[20-C-016] notices only remind: "Duyệt phòng này" still saves while "Nhắc công năng" shows', async () => {
      const put = waitForLayerPut(page, projectId, f4.id, (rooms) => rooms.some((r) => r.name === 'Bếp' && r.reviewed === true), [200]);
      await page.getByRole('button', { name: ROOM.approve, exact: true }).click();
      expect.soft((await put).response.status()).toBe(200);
      await expect.soft(page.getByRole('region', { name: ROOM.notices, exact: true })).toBeVisible();
      await captureEvidence(page, 'E04_20-C-016_approve-with-notices.png');
    });

    await test.step('[20-E-012] sections are named "Ảnh cắt gốc", "Nhắc công năng", "Vòng tường hở"', async () => {
      for (const name of [ROOM.crop, ROOM.notices, ROOM.gapsTitle]) {
        await expect.soft(page.getByRole('region', { name, exact: true }), name).toHaveCount(1);
      }
      await captureEvidence(page, 'E04_20-E-012_section-names.png');
    });
  } finally {
    await cleanup(projectId, s);
  }
});

/* ================================================================= FL-20-07 */

test('SCR-20 · FL-20-07 · measures, summary, confidence, OCR hint, many rooms, long names, empty floor', async ({ browser }) => {
  test.setTimeout(300_000);
  const two = measureTwo();
  const many = measureMany();
  const long = measureLong();
  const { projectId, floors } = await newProject('20-07', ['Tầng 1', 'Tầng 2', 'Tầng 3', 'Tầng 4']);
  const [f1, f2, f3, f4] = floors as [Floor, Floor, Floor, Floor];
  let s: Session | undefined;
  try {
    await seedFloor(layerApi, projectId, f1.id, two);
    await seedFloor(layerApi, projectId, f2.id, many);
    await seedFloor(layerApi, projectId, f3.id, long);
    const sess = await openSession(browser, creds());
    s = sess;
    const { page } = sess;
    const codeOf = (seed: { rooms: Readonly<Record<string, string>> }, key: string): string => codesOf(Object.values(seed.rooms)).get(seed.rooms[key] as string) as string;
    const panel = inspector(page);

    await test.step('[20-B-008] measure rows: "Diện tích" + caption, "Chu vi phòng", "Chiều cao thông thuỷ" has no measure', async () => {
      await openRooms(page, projectId, f1.id);
      await selectRoom(page, codeOf(two, 'ai'));
      await expect(panel.getByText(ROOM.area, { exact: true })).toBeVisible();
      await expect.soft(panel.getByText(areaTextOf(rect(0, 0, 4000, 4000)), { exact: true })).toBeVisible();
      await expect.soft(panel.getByText(ROOM.areaCaption, { exact: true })).toBeVisible();
      await expect.soft(panel.getByText(ROOM.perimeter, { exact: true })).toBeVisible();
      await expect.soft(panel.getByText(formatLength(16_000), { exact: true })).toBeVisible();
      await expect.soft(panel.getByText(ROOM.clearHeight, { exact: true })).toBeVisible();
      await expect.soft(panel.getByText(ROOM.clearHeightMissing, { exact: true })).toBeVisible();
      await captureEvidence(page, 'E04_20-B-008_measure-rows.png');
    });

    await test.step('[20-B-010] summary line: "Tổng diện tích sàn {area} · {n} phòng"', async () => {
      await expect.soft(page.locator('p').filter({ hasText: /^Tổng diện tích sàn/u })).toHaveText(`Tổng diện tích sàn ${areaTextOf(rect(0, 0, 8000, 4000))} · 2 phòng`);
      await captureEvidence(page, 'E04_20-B-010_summary.png');
    });

    await test.step('[20-B-011] confidence block: "Độ tin cậy", the meter and its label (AI 0,6)', async () => {
      await expect.soft(panel.getByText(ROOM.confidence, { exact: true })).toBeVisible();
      await expect.soft(panel.getByRole('meter')).toHaveAttribute('aria-valuenow', '60');
      await expect.soft(panel.getByText(describeConfidence(0.6).label, { exact: true })).toBeVisible();
      await captureEvidence(page, 'E04_20-B-011_confidence.png');
    });

    await test.step('[20-B-013] an AI-named room with no drawing explains why there is no crop', async () => {
      await expect.soft(panel.getByText(ROOM.cropOcr, { exact: true })).toBeVisible();
      await captureEvidence(page, 'E04_20-B-013_ocr-hint.png');
    });

    await test.step('[20-B-014] a human-named room has no crop and says so', async () => {
      await selectRoom(page, codeOf(two, 'human'));
      await expect.soft(panel.getByText(ROOM.cropHuman, { exact: true })).toBeVisible();
      await captureEvidence(page, 'E04_20-B-014_human-no-crop.png');
    });

    await test.step('[20-B-004] no drawing on the floor: no background image in the canvas', async () => {
      await expect.soft(canvasGroup(page).locator('img')).toHaveCount(0);
      await expect.soft(canvasGroup(page)).toBeVisible();
      await captureEvidence(page, 'E04_20-B-004_no-background.png');
    });

    await test.step('[20-B-017] thirty rooms: the list box is a scroll container, every row is reachable and every canvas room fits the frame', async () => {
      await openRooms(page, projectId, f2.id);
      await expect(roomOptions(page)).toHaveCount(30);
      const box = roomList(page).locator('xpath=..'); // RLP:146 `overflow-y-auto`
      const metrics = await box.evaluate((el) => ({ client: el.clientHeight, scroll: el.scrollHeight, overflowY: getComputedStyle(el).overflowY }));
      await attachJson('E04_20-B-017_metrics.json', metrics);
      expect.soft(metrics.overflowY, 'the list box is a scroll container').toBe('auto');
      await roomOptions(page).last().scrollIntoViewIfNeeded();
      await expect.soft(roomOptions(page).last(), 'the last row can be reached').toBeInViewport();
      await roomOptions(page).first().scrollIntoViewIfNeeded();
      const frame = (await canvasGroup(page).boundingBox()) ?? { x: 0, y: 0, width: 0, height: 0 };
      const outside = await canvasGroup(page)
        .getByRole('button')
        .evaluateAll((buttons, f) => buttons.filter((b) => {
          const r = b.getBoundingClientRect();
          return r.left < f.x - 2 || r.top < f.y - 2 || r.right > f.x + f.width + 2 || r.bottom > f.y + f.height + 2;
        }).length, frame);
      expect.soft(outside, 'canvas rooms outside the frame').toBe(0);
      await captureEvidence(page, 'E04_20-B-017_many-rooms.png');
    });

    await test.step('[20-B-018] a 60-character name truncates in the list and shows whole in the name field', async () => {
      await openRooms(page, projectId, f3.id);
      const code = codeOf(long, 'long');
      const nameSpan = optionOf(page, code).locator('span').nth(1);
      const metrics = await nameSpan.evaluate((el) => ({ client: el.clientWidth, scroll: el.scrollWidth }));
      expect.soft(metrics.scroll, `list name ${JSON.stringify(metrics)} is cut`).toBeGreaterThan(metrics.client);
      await selectRoom(page, code);
      await expect.soft(nameField(page)).toHaveValue(LONG_NAME);
      await captureEvidence(page, 'E04_20-B-018_long-name.png');
    });

    await test.step('[20-E-015] reduced motion: the canvas pan transition is off', async () => {
      const pan = canvasGroup(page).locator('> div').first();
      const normal = await pan.evaluate((el) => getComputedStyle(el).transitionDuration);
      await page.emulateMedia({ reducedMotion: 'reduce' });
      await openRooms(page, projectId, f3.id);
      const reduced = await canvasGroup(page).locator('> div').first().evaluate((el) => getComputedStyle(el).transitionDuration);
      expect.soft(Number.parseFloat(normal), `default ${normal}`).toBeGreaterThan(0);
      expect.soft(Number.parseFloat(reduced), `reduced ${reduced}`).toBe(0);
      await attachJson('E04_20-E-015_durations.json', { normal, reduced });
      await captureEvidence(page, 'E04_20-E-015_reduced-motion.png');
      await page.emulateMedia({ reducedMotion: 'no-preference' });
    });

    await test.step('[20-B-003] a floor with no room: the canvas says "Chưa dò được phòng nào trên bản vẽ này."', async () => {
      await openRooms(page, projectId, f4.id);
      await expect.soft(page.getByText(ROOM.canvasEmpty, { exact: true })).toBeVisible();
      await captureEvidence(page, 'E04_20-B-003_canvas-empty.png');
    });

    await test.step('[20-B-002] a floor with no room: EmptyState, the notice and "Kiểm tra lại vòng hở"', async () => {
      await expect.soft(page.getByRole('heading', { name: ROOM.emptyTitle })).toBeVisible();
      await expect.soft(page.getByText(ROOM.emptyNotice, { exact: true })).toBeVisible();
      await expect.soft(page.getByRole('button', { name: ROOM.checkGaps, exact: true })).toBeVisible();
      await captureEvidence(page, 'E04_20-B-002_empty-state.png');
    });
  } finally {
    await cleanup(projectId, s);
  }
});

/* ================================================================= FL-20-08 */

test('SCR-20 · FL-20-08 · drawing floor: background, crop, provisional measures, scale-screen cache', async ({ browser }) => {
  test.setTimeout(420_000);
  const seed = drawRooms();
  let owner: APIRequestContext | undefined;
  let projectId: string | undefined;
  let s: Session | undefined;
  try {
    const pool = await poolUser(admin, 'admin', 'p04-rooms');
    owner = await signedInApi(pool.email, pool.password);
    const drawn = await createPipelineDrawingProject(owner, '20-08', envDrawingPng());
    projectId = drawn.projectId;
    const floorId = drawn.floorId;
    await seedFloor({ request: owner, headers: {} }, projectId, floorId, seed); // AI rooms over the finished run (scale stays provisional)
    const sess = await openSession(browser, { email: pool.email, password: pool.password });
    s = sess;
    const { page } = sess;
    const codes = codesOf([seed.rooms.ai as string, seed.rooms.two as string]);
    const codeAi = codes.get(seed.rooms.ai as string) as string;
    const panel = inspector(page);
    const background = canvasGroup(page).locator('img');
    const floorRead = (): { url?: string; widthMm?: number; heightMm?: number } | undefined => {
      const entry = sess.log.filter((e) => e.method === 'GET' && floorRe(projectId as string, floorId).test(e.path)).pop();
      const drawings = (entry?.json as { drawings?: { url?: string; widthMm?: number; heightMm?: number }[] } | undefined)?.drawings;
      return drawings?.[0];
    };

    await test.step('[20-B-005] a drawing floor shows the original drawing as the named background image', async () => {
      await openRooms(page, projectId as string, floorId);
      await expect(background).toBeVisible();
      await expect.soft(background).toHaveAttribute('alt', `Bản vẽ gốc của ${drawn.floorName}, dùng làm nền để đối chiếu lớp phòng.`);
      await expect.poll(() => background.evaluate((img: HTMLImageElement) => img.complete && img.naturalWidth > 0)).toBe(true);
      await captureEvidence(page, 'E04_20-B-005_background.png');
    });

    await test.step('[20-B-006] ⚑ the background is sized by the drawing (#33 widthMm / heightMm), not stretched to the rooms\' box', async () => {
      const drawing = floorRead();
      const box = (await background.boundingBox()) ?? { width: 0, height: 0 };
      await attachJson('E04_20-B-006_sizes.json', { drawing: drawing ?? null, imageBox: box });
      expect.soft(drawing?.widthMm !== undefined && drawing.heightMm !== undefined, 'UNKNOWN — NEED VERIFICATION: #33 carries no widthMm / heightMm for the drawing').toBe(true);
      if (drawing?.widthMm !== undefined && drawing.heightMm !== undefined && box.height > 0) {
        const wanted = drawing.widthMm / drawing.heightMm;
        expect.soft(Math.abs(box.width / box.height - wanted) / wanted, `image ratio ${(box.width / box.height).toFixed(2)} vs drawing ${wanted.toFixed(2)}`).toBeLessThan(0.03);
      }
      await captureEvidence(page, 'E04_20-B-006_background-size.png');
    });

    await test.step('[20-B-009] provisional scale: the row area, the inspector area / perimeter and the total read "Chưa có — tỉ lệ tạm"', async () => {
      await expect.soft(optionOf(page, codeAi)).toHaveAccessibleName(new RegExp(` · ${ROOM.provisional} · `, 'u'));
      await expect.soft(page.locator('p').filter({ hasText: /^Tổng diện tích sàn/u })).toHaveText(`Tổng diện tích sàn ${ROOM.provisional} · 2 phòng`);
      await selectRoom(page, codeAi);
      await expect.soft(panel.getByText(ROOM.provisional, { exact: true })).toHaveCount(2); // area + perimeter
      await captureEvidence(page, 'E04_20-B-009_provisional-measures.png');
    });

    await test.step('[20-B-012] an AI-named room with a drawing shows the crop image', async () => {
      await expect.soft(panel.getByRole('img', { name: `Ảnh cắt tên phòng ${codeAi} trên bản vẽ gốc.`, exact: true })).toBeVisible();
      await captureEvidence(page, 'E04_20-B-012_crop.png');
    });

    await test.step('[20-G-002] #33 drawings[0].url is the background image', async () => {
      const url = floorRead()?.url;
      expect.soft(url, 'UNKNOWN — NEED VERIFICATION: #33 drawings[0].url').toBeTruthy();
      await expect.soft(background).toHaveAttribute('src', url ?? '');
      await captureEvidence(page, 'E04_20-G-002_background-url.png');
    });

    await test.step('[20-A-047] the provisional-scale banner leads to the scale screen', async () => {
      await expect.soft(page.getByText(ROOM.provisionalBanner, { exact: true })).toBeVisible();
      await captureEvidence(page, 'E04_20-A-047_banner.png');
      await page.getByRole('button', { name: ROOM.toScale, exact: true }).click();
      await expect.soft(page).toHaveURL(new RegExp(`${ROUTES.project.scale(projectId as string, floorId).replace(/[.*+?^${}()|[\]\\]/gu, '\\$&')}$`, 'u'));
    });

    await test.step('[20-G-025] ⚑ Back from the scale screen keeps the background image (the drawing cache is shared with SCR-14)', async () => {
      await expect(page.getByRole('region', { name: 'Màn hiệu chỉnh tỷ lệ', exact: true })).toBeVisible();
      await page.goBack();
      await expect(page.getByRole('region', { name: ROOM.screen, exact: true })).toBeVisible();
      await expect.soft(page.getByRole('listbox', { name: ROOM.list, exact: true })).toBeVisible();
      await expect.soft(canvasGroup(page).locator('img'), 'the background survived the round trip').toHaveCount(1);
      await captureEvidence(page, 'E04_20-G-025_back-from-scale.png');
    });
  } finally {
    await closeSession(s);
    if (projectId !== undefined && owner !== undefined) {
      const failed = await deleteSeededProject(owner, projectId);
      if (failed !== null) test.info().annotations.push({ type: 'cleanup', description: failed });
    }
    await owner?.dispose();
  }
});

/* ================================================================= FL-20-09 */

test('SCR-20 · FL-20-09 · entries, load requests, 409 and reload, floor deleted, unknown ids, anonymous', async ({ browser }) => {
  test.setTimeout(420_000);
  const second = rooms1();
  const { projectId, floors } = await newProject('20-09', ['Tầng 1', 'Tầng 2']);
  const [f1, f2] = floors as [Floor, Floor];
  let s: Session | undefined;
  try {
    await writeLayer(layerApi, projectId, f1.id, qcLayer); // Q2: Q1 on floor 1 ...
    await seedFloor(layerApi, projectId, f2.id, second); // ... and a room to rename on floor 2
    const sess = await openSession(browser, creds());
    s = sess;
    const { page } = sess;
    const field = nameField(page);
    const conflictBanner = page.getByRole('alert').filter({ hasText: ROOM.conflict });
    const confirm = page.getByRole('dialog', { name: ROOM.confirmTitle, exact: true });
    await page.clock.install();

    await test.step('[20-A-048] entry from SCR-16: "Cây lớp" → "Phòng" opens the rooms of the same floor', async () => {
      await navigateThenWaitForApi(page, () => page.goto(ROUTES.project.walls(projectId, f1.id), { waitUntil: 'commit' }), 'GET', layerRe(projectId, f1.id), [200]);
      await expect(page.getByRole('region', { name: 'Duyệt lớp tường', exact: true })).toBeVisible();
      await dismissTour(page, { waitMs: TOUR_APPEAR_TIMEOUT_MS });
      await page.getByRole('treeitem', { name: 'Phòng', exact: true }).click();
      await expect.soft(page).toHaveURL(new RegExp(`${ROUTES.project.rooms(projectId, f1.id).replace(/[.*+?^${}()|[\]\\]/gu, '\\$&')}$`, 'u'));
      await expect(page.getByRole('region', { name: ROOM.screen, exact: true })).toBeVisible();
      await captureEvidence(page, 'E04_20-A-048_from-walls.png');
    });

    await test.step('[20-A-049] entry from SCR-28: the skipped-rules remedy "Mở màn nhãn phòng" opens the rooms of the first level', async () => {
      await page.goto(ROUTES.project.rules(projectId));
      await expect(page.getByRole('button', { name: 'Chạy kiểm tra lại', exact: true })).toBeVisible({ timeout: 30_000 });
      const remedy = page.getByRole('button', { name: 'Mở màn nhãn phòng', exact: true }).or(page.getByRole('link', { name: 'Mở màn nhãn phòng', exact: true }));
      // useRuleReport.ts:311-350 lists a skipped group only for a rule that did not run, and a level-scope rule always runs on
      // every level of the model, so with real data the remedy is shown only for a model with no level (then its label is
      // "Thêm tầng cho mô hình"). UNKNOWN — NEED VERIFICATION: no real data makes the report skip a group on a model WITH levels.
      const shown = (await remedy.count()) > 0;
      test.info().annotations.push({ type: 'UNKNOWN — NEED VERIFICATION', description: '20-A-049: the rules report of a project with floors skips no rule group, so "Mở màn nhãn phòng" is not shown' });
      await captureEvidence(page, 'E04_20-A-049_remedy.png');
      if (shown) {
        await remedy.first().click();
        await expect.soft(page).toHaveURL(new RegExp(`/projects/${projectId}/floors/[^/]+/layers/rooms$`, 'u'));
      }
    });

    await test.step('[20-G-001] the load reads N16 and #33 and nothing else on the floor', async () => {
      const mark = sess.reqs.length;
      await openRooms(page, projectId, f1.id);
      await expect(roomOptions(page)).toHaveCount(2);
      const floorCalls = sess.reqs
        .slice(mark)
        .filter((r) => r.path.startsWith(`/api/projects/${projectId}/floors/${f1.id}`) || r.path.startsWith(`/api/floors/${f1.id}`))
        .map((r) => `${r.method} ${r.path.replace(`/api/projects/${projectId}`, '').replace(f1.id, '{f}')}`);
      expect.soft(floorCalls.sort()).toEqual(['GET /floors/{f}/spatial', 'GET /floors/{f}/spatial/layer']);
      expect.soft(writesSince(sess, mark), 'opening writes nothing').toEqual([]);
      await captureEvidence(page, 'E04_20-G-001_load-requests.png');
    });

    await test.step('[20-G-006] another session wrote first: the next save answers 409 and the screen offers "Tải lại"', async () => {
      await writeElsewhere(layerApi, projectId, f1.id, (layer) => ({
        ...layer,
        rooms: arrayOf(layer.rooms, 'rooms').map((room, i) => (i === 0 ? { ...room, name: `${String(room.name)} (nơi khác)` } : room)),
      }));
      await optionNamed(page, 'Bếp').click();
      await page.clock.pauseAt(await page.evaluate(() => Date.now() + 100)); // keeps the rename toast alive until [20-B-016]
      const conflict = waitForLayerPut(page, projectId, f1.id, undefined, [409]);
      await field.fill('Bếp mới');
      await field.press('Enter');
      await page.clock.runFor(1_000);
      await conflict;
      await expect.soft(conflictBanner).toBeVisible();
      await expect.soft(conflictBanner.getByRole('button', { name: ROOM.reload, exact: true })).toBeVisible();
      await shotPaused(page, 'E04_20-G-006_conflict-banner.png');
    });

    await test.step('[20-G-007] "Tải lại" with unsaved edits asks first: title, sentence, "Tải lại và bỏ thay đổi" / "Huỷ"', async () => {
      await conflictBanner.getByRole('button', { name: ROOM.reload, exact: true }).click();
      await expect(confirm).toBeVisible();
      await expect.soft(confirm.getByText(ROOM.confirmBody, { exact: true })).toBeVisible();
      await expect.soft(confirm.getByRole('button', { name: ROOM.confirmReload, exact: true })).toBeVisible();
      await expect.soft(confirm.getByRole('button', { name: ROOM.cancel, exact: true })).toBeVisible();
      await shotPaused(page, 'E04_20-G-007_confirm.png');
    });

    await test.step('[20-G-008] confirming reloads (GET N16), replaces the store and says so in a toast', async () => {
      const reread = waitForApi(page, 'GET', layerRe(projectId, f1.id), [200]);
      await confirm.getByRole('button', { name: ROOM.confirmReload, exact: true }).click();
      await reread;
      await expect.soft(toastOf(page, ROOM.reloadedToast)).toBeVisible();
      await expect.soft(conflictBanner).toHaveCount(0);
      await expect.soft(optionNamed(page, 'Bếp (nơi khác)')).toBeVisible();
      await shotPaused(page, 'E04_20-G-008_reloaded.png');
    });

    await test.step('[20-B-016] the undo history is cleared by the reload: the earlier toast\'s "Hoàn tác" does nothing', async () => {
      const mark = sess.reqs.length;
      const old = toastOf(page, /thành "Bếp mới"/u);
      await expect.soft(old).toBeVisible();
      await old.getByRole('button', { name: ROOM.undo, exact: true }).click();
      await page.clock.resume();
      await flush(page);
      await expect.soft(optionNamed(page, 'Bếp (nơi khác)')).toBeVisible();
      await expect.soft(optionNamed(page, 'Bếp mới')).toHaveCount(0);
      expect.soft(layerPutsSince(sess, projectId, f1.id, mark), 'a stale undo writes nothing').toHaveLength(0);
      await captureEvidence(page, 'E04_20-B-016_undo-cleared.png');
    });

    await test.step('[20-G-021] the floor is deleted while the screen is open: the next save is blocked with the generic text', async () => {
      await openRooms(page, projectId, f2.id);
      await roomOptions(page).first().click();
      const removed = await admin.delete(`/api/floors/${f2.id}`);
      expect(removed.status(), 'setup: DELETE /api/floors/:id (admin)').toBe(200);
      const refused = waitForLayerPut(page, projectId, f2.id, undefined, [404]);
      await field.fill('qa tầng đã xoá');
      await field.press('Enter');
      await refused;
      await expect.soft(page.getByRole('alert').filter({ hasText: ROOM.saveFailedGeneric })).toBeVisible();
      await captureEvidence(page, 'E04_20-G-021_floor-deleted.png');
    });

    await test.step('[20-G-013] N16 404 for an unknown project: "Không tìm thấy dự án này" + "Về danh sách dự án" → /', async () => {
      await page.goto(ROUTES.project.rooms(`prj_qa-p5-${uniq()}`, f1.id));
      await expect(page.getByText(ROOM.projectMissing, { exact: true })).toBeVisible({ timeout: 30_000 });
      await captureEvidence(page, 'E04_20-G-013_unknown-project.png');
      await page.getByRole('button', { name: ROOM.toDashboard, exact: true }).click();
      await expect.soft(page).toHaveURL(new RegExp(`${ROUTES.dashboard.replace(/[.*+?^${}()|[\]\\]/gu, '\\$&')}$`, 'u'));
    });

    await test.step('[20-G-014] N16 404 for an unknown floor: "Không mở được tầng này" / text / "Về quản lý tầng"', async () => {
      await page.goto(ROUTES.project.rooms(projectId, f2.id)); // the deleted floor
      await expect(page.getByText(ROOM.floorMissingTitle, { exact: true })).toBeVisible({ timeout: 30_000 });
      await expect.soft(page.getByText(ROOM.floorMissingText, { exact: true })).toBeVisible();
      await captureEvidence(page, 'E04_20-G-014_unknown-floor.png');
      await page.getByRole('button', { name: ROOM.toFloors, exact: true }).click();
      await expect.soft(page).toHaveURL(new RegExp(`${ROUTES.project.floors(projectId).replace(/[.*+?^${}()|[\]\\]/gu, '\\$&')}$`, 'u'));
    });

    await test.step('[20-A-052] an anonymous deep link goes to the login with the path to come back to', async () => {
      const anonymous = await browser.newContext({ baseURL: readBaseUrl(), viewport: DESKTOP });
      try {
        const tab = await anonymous.newPage();
        await tab.goto(ROUTES.project.rooms(projectId, f1.id));
        await expect.soft(tab).toHaveURL(new RegExp(`${ROUTES.login}\\?next=`, 'u'));
        expect.soft(new URL(tab.url()).searchParams.get('next')).toBe(ROUTES.project.rooms(projectId, f1.id));
        await captureEvidence(tab, 'E04_20-A-052_anonymous.png');
      } finally {
        await anonymous.close();
      }
    });
  } finally {
    await cleanup(projectId, s);
  }
});
