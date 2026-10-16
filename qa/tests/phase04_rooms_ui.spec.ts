/**
 * Phase 4 — SCR-20 "Duyệt tên phòng", dedicated UI-verification case (skill `qa-verify-ui`): ONE flow, `FL-20-U1`, with one
 * step per catalog row of the F block (+ `20-E-016` focus rings). Every step is one screen state at 1920 / 1440 / 1024 / 768
 * (`support/ui-verify.ts` `verifyUi`: it re-opens the state per width, measures horizontal scroll, controls pushed off-screen,
 * broken images, clipped text, overlaps and small targets, shoots `U04_<row id>_<slug>_<width>.png` and writes
 * `U04_<row id>_<slug>.json` for the qa-review-ui reviewer). Pair: A4 reads (FL-A4-02) and versioning (FL-A4-04).
 *
 * One project of its own (`qa-<runId>-20-u1-…`), seven layered floors written through the real #35 (`support/p04/P5.ts` seeds
 * and `layerSeed.qcLayer`) + one floor created and deleted for the read-failure state; the viewer is the shared pool viewer
 * (`poolUser(admin, 'viewer', 'p04-rooms')`, a REAL member in a second context, no mocked session); `+W2` is a real second writer
 * (`writeElsewhere`). The only faked response is `20-F-013` (N16 re-read 500) — the title says so.
 *
 * Budget: `POST /api/auth/login` 1 `signedInApi` + 2 sessions (admin, viewer); `POST /api/projects` 1; `PUT …/spatial/layer`
 * ≈ 7 (seeds) + 4 (the 409 state, once per width) + 4 second-writer writes; `DELETE /api/floors/:id` 1; one invitation only if the
 * pool slot is empty. No upload.
 */
import type { APIRequestContext, Page, Route } from '@playwright/test';
import { expect, test } from '@playwright/test';

import { signedInApi } from './support/api';
import { readAdminCredentials } from './support/auth';
import { captureEvidence } from './support/evidence';
import { qcLayer, writeLayer, type LayerApi } from './support/layerSeed';
import { fulfillError } from './support/p03/P2';
import {
  LONG_NAME,
  ROOM,
  canvasButton,
  closeSession,
  codesOf,
  filterToggle,
  gapsLoop,
  layerRe,
  measureLong,
  nameField,
  openRooms,
  openSession,
  roomOptions,
  roomsAB,
  roomsBep,
  seedFloor,
  selectRoom,
  splitLoops,
  waitForLayerPut,
  writeElsewhere,
  arrayOf,
  type Session,
} from './support/p04/P5';
import { addProjectMember, createProject, deleteSeededProject, poolUser } from './support/phase03Seed';
import { verifyUi } from './support/ui-verify';

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

/** BUG-347: an action in `open` that cannot happen (control off-screen) fails fast; navigation keeps its own timeout. */
const OPEN_ACTION_TIMEOUT_MS = 10_000;
/** Web is desktop + tablet only (memory desktop-tablet-only): no 375 and no 2560. */
const DESKTOP_TABLET = [
  { width: 1920, height: 1080 },
  { width: 1440, height: 900 },
  { width: 1024, height: 768 },
  { width: 768, height: 1024 },
] as const;

test('SCR-20 · FL-20-U1 · [mocked response] room states incl. viewer, 409 banner, inline read error', async ({ browser }) => {
  test.setTimeout(900_000);
  const names = ['Tầng 1', 'Tầng 2', 'Tầng 3', 'Tầng 4', 'Tầng 5', 'Tầng 6', 'Tầng 7', 'Tầng 8'];
  const project = await createProject(admin, '20-u1', names);
  type Floor = { id: string; name: string };
  const [fQ1, fUnnamed, fSplit, fGaps, fLong, fBep, fEmpty, fGone] = [...project.floors] as unknown as [Floor, Floor, Floor, Floor, Floor, Floor, Floor, Floor];
  let s: Session | undefined;
  let viewerSession: Session | undefined;
  try {
    const unnamed = roomsAB();
    const split = splitLoops();
    const gaps = gapsLoop();
    const long = measureLong();
    const bep = roomsBep();
    await writeLayer(layerApi, project.projectId, fQ1.id, qcLayer);
    await seedFloor(layerApi, project.projectId, fUnnamed.id, unnamed);
    await seedFloor(layerApi, project.projectId, fSplit.id, split);
    await seedFloor(layerApi, project.projectId, fGaps.id, gaps);
    await seedFloor(layerApi, project.projectId, fLong.id, long);
    await seedFloor(layerApi, project.projectId, fBep.id, bep);
    const removed = await admin.delete(`/api/floors/${fGone.id}`);
    expect(removed.status(), 'setup: DELETE /api/floors/:id (the floor of the read-failure state)').toBe(200);
    const viewer = await poolUser(admin, 'viewer', 'p04-rooms');
    await addProjectMember(admin, project.projectId, viewer.email);

    const { email, password } = readAdminCredentials();
    const sess = await openSession(browser, { email, password });
    s = sess;
    viewerSession = await openSession(browser, { email: viewer.email, password: viewer.password });
    const { page } = sess;
    const viewerPage = viewerSession.page;
    for (const p of [page, viewerPage]) {
      p.setDefaultTimeout(OPEN_ACTION_TIMEOUT_MS);
    }
    const pid = project.projectId;
    const codeFirst = (seed: { rooms: Readonly<Record<string, string>> }, key: string): string =>
      codesOf(Object.values(seed.rooms)).get(seed.rooms[key] as string) as string;
    /** One state at four widths; `page` writes nothing here except in the 409 state. */
    const state = (id: string, slug: string, who: Page, open: (p: Page) => Promise<void>): Promise<unknown> =>
      verifyUi(who, `U04_${id}_${slug}`, open, DESKTOP_TABLET, {});

    await test.step('[20-F-001] room selected → inspector "Phòng"', async () => {
      await state('20-F-001', 'room-selected', page, async (p) => {
        await openRooms(p, pid, fQ1.id);
        await roomOptions(p).first().click();
        await expect(p.getByRole('button', { name: ROOM.approve, exact: true })).toBeVisible();
      });
    });

    await test.step('[20-F-002] "Chuẩn hoá tên" → the preview dialog (not applied)', async () => {
      await state('20-F-002', 'normalize-preview', page, async (p) => {
        await openRooms(p, pid, fQ1.id);
        await p.getByRole('button', { name: ROOM.normalize, exact: true }).click();
        await expect(p.getByRole('dialog', { name: ROOM.normalizeDialog, exact: true })).toBeVisible();
      });
    });

    await test.step('[20-F-015] "Chuẩn hoá tên" with nothing to change → button disabled + inline note, no dialog (RoomLabelLeftPanel.tsx:57,152)', async () => {
      await state('20-F-015', 'normalize-nothing', page, async (p) => {
        await openRooms(p, pid, fBep.id);
        await expect(p.getByRole('button', { name: ROOM.normalize, exact: true })).toBeDisabled();
        await expect(p.getByText('Mọi tên phòng đã đúng kiểu câu, chưa có gì để chuẩn hoá.', { exact: true })).toBeVisible();
      });
    });

    await test.step('[20-F-003] "Gộp phòng" → the dialog "Gộp hai phòng" (not confirmed)', async () => {
      await state('20-F-003', 'merge-dialog', page, async (p) => {
        await openRooms(p, pid, fQ1.id);
        await roomOptions(p).first().click();
        await p.getByRole('button', { name: ROOM.merge, exact: true }).click();
        await expect(p.getByRole('dialog', { name: ROOM.mergeDialog, exact: true })).toBeVisible();
      });
    });

    await test.step('[20-F-007] a room over a dividing wall → the split dialog (not confirmed)', async () => {
      await state('20-F-007', 'split-dialog', page, async (p) => {
        await openRooms(p, pid, fSplit.id);
        await selectRoom(p, codeFirst(split, 's'));
        await p.getByRole('button', { name: ROOM.split, exact: true }).click();
        await expect(p.getByRole('dialog', { name: ROOM.splitDialog, exact: true })).toBeVisible();
      });
    });

    await test.step('[20-F-005] the "Chưa đặt tên" filter on with unnamed rooms', async () => {
      await state('20-F-005', 'filter-on', page, async (p) => {
        await openRooms(p, pid, fUnnamed.id);
        await filterToggle(p).click();
        await expect(filterToggle(p)).toHaveAttribute('aria-pressed', 'true');
        await expect(roomOptions(p)).toHaveCount(1);
      });
    });

    await test.step('[20-F-006] the filter on with every room named → the empty notice and the toggle', async () => {
      await state('20-F-006', 'filter-empty', page, async (p) => {
        await openRooms(p, pid, fBep.id);
        await filterToggle(p).click();
        await expect(p.getByText(ROOM.emptyFiltered, { exact: true })).toBeVisible();
        await expect(filterToggle(p)).toBeVisible();
      });
    });

    await test.step('[20-F-014] a 60-character name in the list, the inspector and the canvas label', async () => {
      await state('20-F-014', 'long-name', page, async (p) => {
        await openRooms(p, pid, fLong.id);
        await selectRoom(p, codeFirst(long, 'long'));
        await expect(nameField(p)).toHaveValue(LONG_NAME);
        await expect(canvasButton(p, LONG_NAME)).toHaveCount(1);
      });
    });

    await test.step('[20-F-011] the gaps list with "Xem tại lớp tường"', async () => {
      await state('20-F-011', 'gaps-list', page, async (p) => {
        await openRooms(p, pid, fGaps.id);
        await expect(p.getByRole('region', { name: ROOM.gapsTitle, exact: true }).getByRole('button', { name: ROOM.toWalls, exact: true })).toBeVisible();
      });
    });

    await test.step('[20-F-004] a floor with no room → the empty state', async () => {
      await state('20-F-004', 'no-room', page, async (p) => {
        await openRooms(p, pid, fEmpty.id);
        await expect(p.getByRole('heading', { name: ROOM.emptyTitle })).toBeVisible();
      });
    });

    await test.step('[20-F-012] an unknown floor → the read-failure screen "Không mở được tầng này"', async () => {
      await state('20-F-012', 'read-failure', page, async (p) => {
        await p.goto(`/projects/${pid}/floors/${fGone.id}/layers/rooms`);
        await expect(p.getByText(ROOM.floorMissingTitle, { exact: true })).toBeVisible({ timeout: 30_000 });
      });
    });

    await test.step('[20-E-016] focus rings: an option, a chip and a canvas button show a ring on keyboard focus', async () => {
      await state('20-E-016', 'focus-rings', page, async (p) => {
        await openRooms(p, pid, fQ1.id);
        await roomOptions(p).first().click();
        await roomOptions(p).first().focus();
        await p.keyboard.press('ArrowDown'); // keyboard focus → :focus-visible
        await expect(roomOptions(p).nth(1)).toBeFocused();
      });
      await openRooms(page, pid, fQ1.id);
      await roomOptions(page).first().click();
      const ring = (loc: ReturnType<Page['locator']>): Promise<string> => loc.evaluate((el) => getComputedStyle(el).boxShadow);
      await roomOptions(page).first().focus();
      await page.keyboard.press('ArrowDown');
      expect.soft(await ring(roomOptions(page).nth(1)), 'option ring').not.toBe('none');
      const chip = page.getByRole('group', { name: ROOM.suggestions, exact: true }).getByRole('button').first();
      await nameField(page).focus();
      await page.keyboard.press('Tab');
      await expect.soft(chip).toBeFocused();
      expect.soft(await ring(chip), 'chip ring').not.toBe('none');
      await canvasButton(page, 'Bếp').focus();
      await page.keyboard.press('Shift+Tab');
      await page.keyboard.press('Tab');
      await expect.soft(canvasButton(page, 'Bếp')).toBeFocused();
      expect.soft(await ring(canvasButton(page, 'Bếp')), 'canvas button ring').not.toBe('none');
      await captureEvidence(page, 'E04_20-E-016_focus-rings.png');
    });

    await test.step('[20-F-010] the viewer sees the forbidden notice, the read-only inspector and the disabled canvas', async () => {
      await state('20-F-010', 'viewer-forbidden', viewerPage, async (p) => {
        await openRooms(p, pid, fQ1.id);
        await expect(p.getByText(ROOM.viewerTitle, { exact: true })).toBeVisible();
        await roomOptions(p).first().click();
        await expect(p.getByText(ROOM.viewerCanvas, { exact: true })).toHaveCount(1);
      });
    });

    await test.step('[20-F-008] the save-block banner after a 409 and the confirm dialog "Bỏ thay đổi chưa lưu của tầng này?"', async () => {
      await state('20-F-008', 'conflict-banner', page, async (p) => {
        await openRooms(p, pid, fQ1.id);
        await roomOptions(p).filter({ hasText: 'PHONG NGU 2' }).click();
        await writeElsewhere(layerApi, pid, fQ1.id, (layer) => ({
          ...layer,
          rooms: arrayOf(layer.rooms, 'rooms').map((room, i) => (i === 0 ? { ...room, name: `${String(room.name)} (nơi khác)` } : room)),
        }));
        const conflict = waitForLayerPut(p, pid, fQ1.id, undefined, [409]);
        await nameField(p).fill(`qa u1 ${Date.now().toString(36)}`);
        await nameField(p).press('Enter');
        await conflict;
        const banner = p.getByRole('alert').filter({ hasText: ROOM.conflict });
        await expect(banner).toBeVisible();
        await banner.getByRole('button', { name: ROOM.reload, exact: true }).click();
        await expect(p.getByRole('dialog', { name: ROOM.confirmTitle, exact: true })).toBeVisible();
      });
    });

    await test.step('[20-F-013] [mocked response] the re-read fails after data → the inline alert "Không đọc được lớp phòng"', async () => {
      let reads = 0;
      const matcher = (url: URL): boolean => layerRe(pid, fBep.id).test(url.pathname);
      const handler = async (route: Route): Promise<void> => {
        if (route.request().method() !== 'GET') return route.fallback();
        reads += 1;
        return reads === 1 ? route.fallback() : fulfillError(route, 500, 'INTERNAL');
      };
      await page.route(matcher, handler);
      await state('20-F-013', 'inline-read-error', page, async (p) => {
        reads = 0;
        await openRooms(p, pid, fBep.id);
        await p.getByRole('button', { name: ROOM.checkGaps, exact: true }).click();
        await expect(p.getByText(ROOM.readErrorTitle, { exact: true })).toBeVisible({ timeout: 60_000 });
      });
      await page.unroute(matcher, handler).catch(() => undefined);
    });
  } finally {
    await closeSession(viewerSession);
    await closeSession(s);
    const failed = await deleteSeededProject(admin, project.projectId);
    if (failed !== null) test.info().annotations.push({ type: 'cleanup', description: failed });
  }
});
