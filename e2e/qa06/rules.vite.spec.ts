/**
 * QA phase 06 DEBT — SCR-28V violation sheet on Vite + mocked API (qa-phase v4: a step red twice on the stack moves here).
 *
 * Real sequence replayed from the p06-rf attachments (E06r_28V-03_*.json, E06r_28V-04_*.json):
 * - FL-28V-03 (BUG-728): after a quick fix the report re-runs, appends the resolved row at the END of its group and
 *   RENUMBERS the display codes (`#F-002` -> `#F-001`), so the next row's message text changes while the sheet is
 *   advancing. The sheet is identified by `data-entity-id` (entity ids are stable), never by title text.
 * - FL-28V-04 (BUG-729): last row fixed = no banner; a row with a next one = banner + "Giữ lại màn này"; toast undo
 *   restores exactly that fix and clears the sheet's "Đã sửa xong" line; the first fix (never undone) stays
 *   "Đã xử lý"; Ctrl+Z restores once; a resolved row offers no second action; the "Hoàn tác" button dies at 8 s.
 * - 28V-F-005 (BUG-726): the error state (InlineAlert inside the panel) at 1920/1440/1024/768. The only path to it
 *   is a domain refusal; the recipe is the real race of 28V-B-004: the object leaves the drawing in the same
 *   instant the action is fired, so `createDeleteFurnitureCommand` refuses with its own sentence.
 *
 * Seed: the A14 sample building (21 FURNITURE-CLASH suggestions, the only suggestion-level rule, so its group is the
 * last of the report). Mock PUTs are in-process: waits are on the DOM / store, never on the network.
 * Run: `E2E_PORT=<own port> pnpm exec playwright test e2e/qa06/rules.vite.spec.ts` against
 * `VITE_USE_MOCK_API=true pnpm exec vite --host 127.0.0.1 --port $E2E_PORT`.
 */
import { expect, test } from '@playwright/test';
import type { Locator, Page } from '@playwright/test';

import { ROUTES } from '../fixtures/routes';
import { seedSpatial } from '../fixtures/seedSpatial';

const PROJECT_ID = 'project-1';
const RULES_URL = ROUTES.project.rules(PROJECT_ID);
const FIRST_PAINT_TIMEOUT_MS = 15_000;
const SCREEN_HEADING = 'Kiểm tra luật không gian'; // RuleReport.tsx
const CLASH_RULE = 'Đồ đạc không chồng lên tường hay lên nhau'; // domain/rules/geometry FURNITURE-CLASH name
const DELETE_ACTION = 'Xoá đối tượng này'; // useViolationDetail actions
const ADVANCE_BANNER = 'Sắp chuyển sang vi phạm kế tiếp.'; // ViolationDetail notices
const KEEP_BUTTON = 'Giữ lại màn này'; // ViolationDetail notices
const FIXED_LINE = /^Đã sửa xong; luật .+ chạy lại và không còn báo lỗi trên đối tượng này\.$/u; // resolvedMessageOf
const FIXED_TEXT = 'Đã sửa xong';
const UNDO = 'Hoàn tác'; // components/feedback/Toast.tsx
const NOT_FOUND = /^Không tìm thấy đồ đạc .+ trong bản vẽ\.$/u; // openingCommands.ts validateDeleteFurniture
const SHEET = 'Chi tiết vi phạm';
const GROUP_WINDOW_MS = 5_100; // notificationBus.ts DEFAULT_GROUP_WINDOW_MS 5000: one toast per fix
const UNDO_WINDOW_MS = 8_100; // undoTicket.ts UNDO_WINDOW_MS 8000

/* ------------------------------------------------------------------ locators */

const sheet = (page: Page): Locator => page.getByRole('complementary', { name: SHEET, exact: true });
const sheetTitle = (page: Page): Locator => sheet(page).getByRole('heading', { level: 2 });
const allHeaders = (page: Page): Locator => page.getByRole('heading', { level: 3 }).getByRole('button');
const resolvedHeader = (page: Page): Locator => allHeaders(page).filter({ hasText: /^\s*Đã xử lý/u });
const groupHeaders = (page: Page): Locator => allHeaders(page).filter({ hasNotText: /^\s*Đã xử lý/u });
const resolvedSection = (page: Page): Locator => page.locator('section').filter({ has: resolvedHeader(page) });
const undoButtons = (page: Page): Locator => page.getByRole('button', { name: UNDO, exact: true });
/** Rows of a group section: table rows (>= 1024) or cards; a resolved row is appended to its group AND listed under "Đã xử lý". */
const rowsOf = (section: Locator): Locator => section.locator('tbody tr, ul > li').filter({ has: section.page().locator('button[data-row-key]') });
/** Row key `<ruleCode>:<entityId>` (useRuleReport buildRows). */
const entityOf = (key: string): string => key.slice(key.indexOf(':') + 1);

/* ------------------------------------------------------------------ helpers */

async function openSeeded(page: Page): Promise<void> {
  await page.goto(RULES_URL);
  await expect(page.getByRole('heading', { name: SCREEN_HEADING })).toBeVisible({ timeout: FIRST_PAINT_TIMEOUT_MS });
  await seedSpatial(page, { projectId: PROJECT_ID });
  await expect(groupHeaders(page).filter({ hasText: CLASH_RULE })).toBeVisible();
}

/** Expands the clash group (idempotent) and returns its section. */
async function expandClash(page: Page): Promise<Locator> {
  const expander = groupHeaders(page).filter({ hasText: CLASH_RULE }).first();
  if ((await expander.getAttribute('aria-expanded')) !== 'true') await expander.click();
  await expect(expander).toHaveAttribute('aria-expanded', 'true');
  return expander.locator('xpath=ancestor::section[1]');
}

/** Keys listed under "Đã xử lý" (empty when the section is absent). */
async function resolvedKeys(page: Page): Promise<string[]> {
  if ((await resolvedHeader(page).count()) === 0) return [];
  return (await resolvedSection(page).locator('button[data-row-key]').evaluateAll((els) => els.map((el) => el.getAttribute('data-row-key') ?? ''))).filter(Boolean);
}

/** Rows of the clash group that are still open (not appended as resolved). */
async function openClashRows(page: Page): Promise<{ section: Locator; keys: string[] }> {
  const section = await expandClash(page);
  const resolved = new Set(await resolvedKeys(page));
  const keys = (await rowsOf(section).locator('button[data-row-key]').evaluateAll((els) => els.map((el) => el.getAttribute('data-row-key') ?? ''))).filter((key) => key !== '' && !resolved.has(key));
  return { section, keys };
}

async function openRow(page: Page, key: string): Promise<void> {
  await page.locator(`button[data-row-key="${key}"]`).first().click();
  await expect(sheet(page)).toBeVisible();
  await expect(sheet(page)).toHaveAttribute('data-entity-id', entityOf(key));
}

/** Starts watching the body for `text` (a transient line); the reader says whether it ever appeared. */
async function watchText(page: Page, text: string): Promise<() => Promise<boolean>> {
  await page.evaluate((needle) => {
    const w = window as unknown as { __qa06w?: Record<string, boolean> };
    const seen = (w.__qa06w ??= {});
    seen[needle] = (document.body.textContent ?? '').includes(needle);
    new MutationObserver(() => {
      if ((document.body.textContent ?? '').includes(needle)) seen[needle] = true;
    }).observe(document.body, { characterData: true, childList: true, subtree: true });
  }, text);
  return () => page.evaluate((needle) => (window as unknown as { __qa06w?: Record<string, boolean> }).__qa06w?.[needle] === true, text);
}

/** Clicks "Giữ lại màn này" the instant it appears (the banner lives for the `slow` motion duration only). */
async function armKeep(page: Page): Promise<{ kept: () => Promise<boolean>; disarm: () => Promise<void> }> {
  await page.evaluate((label) => {
    const w = window as unknown as { __qa06keep?: { kept: boolean; observer: MutationObserver } };
    const state = { kept: false, observer: new MutationObserver(() => undefined) };
    state.observer = new MutationObserver(() => {
      const button = Array.from(document.querySelectorAll('button')).find((item) => (item.textContent ?? '').includes(label));
      if (button !== undefined) {
        state.kept = true;
        button.click();
      }
    });
    state.observer.observe(document.body, { childList: true, subtree: true });
    w.__qa06keep = state;
  }, KEEP_BUTTON);
  return {
    kept: () => page.evaluate(() => (window as unknown as { __qa06keep?: { kept: boolean } }).__qa06keep?.kept === true),
    disarm: () => page.evaluate(() => (window as unknown as { __qa06keep?: { observer: MutationObserver } }).__qa06keep?.observer.disconnect()),
  };
}

/** Furniture ids in the store graph (dev-only `/src/...` import, like `seedSpatial`). */
const furnitureIds = (page: Page): Promise<string[]> =>
  page.evaluate(async () => {
    const load = (path: string): Promise<unknown> => import(/* @vite-ignore */ path);
    const store = (await load('/src/store/index.ts')) as { useStore: { getState: () => { spatial: { byKind: { furniture: readonly string[] } } | null } } };
    return [...(store.useStore.getState().spatial?.byKind.furniture ?? [])];
  });

/** Quick fix on the open sheet; waits until the entity has left the store graph. */
async function quickFix(page: Page, entityId: string): Promise<void> {
  await sheet(page).getByRole('button', { name: DELETE_ACTION, exact: true }).click();
  await expect.poll(async () => (await furnitureIds(page)).includes(entityId), 'entity gone from the graph').toBe(false);
}

/* ------------------------------------------------------------------ tests */

test.describe('SCR-28V [mocked response] violation sheet (phase 06 debt)', () => {
  test('SCR-28 · FL-28V-03 · [mocked response] quick fix with a next row: the sheet advances to the entity that was next at click time', async ({ page }) => {
    await openSeeded(page);
    const { keys } = await openClashRows(page);
    expect(keys.length, 'clash rows').toBeGreaterThanOrEqual(3);
    const [firstKey, nextKey] = keys as [string, string, ...string[]];
    const firstEntity = entityOf(firstKey);
    const nextEntity = entityOf(nextKey);
    const panel = sheet(page);

    await test.step('[28V-B-001] the sheet opens on the first clash row', async () => {
      await openRow(page, firstKey);
      await expect(panel.getByRole('button', { name: DELETE_ACTION, exact: true })).toBeVisible();
      await expect(resolvedHeader(page), 'nothing resolved yet (28-C-013)').toHaveCount(0);
    });

    const seenFixed = await watchText(page, FIXED_TEXT);
    const seenBanner = await watchText(page, ADVANCE_BANNER);
    const seenKeep = await watchText(page, KEEP_BUTTON);

    await test.step('[28V-A-014] "Xoá đối tượng này": toast "Hoàn tác", the resolved line (transient: the sheet moves on after the slow motion duration)', async () => {
      await quickFix(page, firstEntity);
      await expect(undoButtons(page).first()).toBeVisible();
      await expect.poll(seenFixed, `"${FIXED_TEXT}" shown on the fixed row`).toBe(true);
    });

    await test.step('[28V-C-003] the report re-ran: the fixed row is appended to its group as resolved', async () => {
      await expect(resolvedHeader(page)).toContainText('1 mục');
      expect(await resolvedKeys(page)).toEqual([firstKey]);
    });

    await test.step('[28V-A-016] the banner shows, then the sheet is on the entity that was next (its display code renumbered)', async () => {
      await expect.poll(seenBanner, `banner "${ADVANCE_BANNER}"`).toBe(true);
      await expect.poll(seenKeep, `button "${KEEP_BUTTON}"`).toBe(true);
      await expect(panel, 'the sheet did not unmount after the save (F9)').toBeVisible();
      await expect(panel).toHaveAttribute('data-entity-id', nextEntity);
      // The title is the next row's CURRENT message (the report renumbers `#F-nnn` after a deletion), not the text
      // recorded before the fix — that text can even equal the resolved row's frozen message.
      const nextRowNow = page.locator(`button[data-row-key="${nextKey}"]`).first(); // RowMessage: the button text IS the message
      await expect(sheetTitle(page)).toHaveText((await nextRowNow.innerText()).trim());
      await expect(panel.getByRole('button', { name: DELETE_ACTION, exact: true }), 'live entity: the action is offered').toBeVisible();
    });

    await test.step('[28V-C-004] the next violation carries no "Đã sửa xong…" line', async () => {
      await expect(panel.getByText(FIXED_LINE)).toHaveCount(0);
    });
  });

  test('SCR-28 · FL-28V-04 · [mocked response] undo, double fix and the 8 s window', async ({ page }) => {
    await page.clock.install(); // time keeps flowing; only the toast windows are jumped
    await openSeeded(page);
    const panel = sheet(page);
    const { keys: startKeys } = await openClashRows(page);
    expect(startKeys.length, 'clash rows').toBeGreaterThanOrEqual(3);
    expect((await groupHeaders(page).allInnerTexts()).at(-1), 'the clash group is the last of the report (hasNext = false on its last row)').toContain(CLASH_RULE);
    const seenBanner = await watchText(page, ADVANCE_BANNER);
    let fixNo = 0;
    const fix = async (entityId: string): Promise<void> => {
      fixNo += 1;
      if (fixNo > 1) await page.clock.fastForward(GROUP_WINDOW_MS); // one toast per fix (5 s grouping window)
      await quickFix(page, entityId);
    };

    const lastKey = startKeys.at(-1) ?? '';
    await test.step('[28V-A-018] fix the LAST row: no banner, the sheet stays', async () => {
      await openRow(page, lastKey);
      await fix(entityOf(lastKey));
      await expect(panel.getByText(FIXED_LINE)).toBeVisible();
      await expect(panel).toHaveAttribute('data-entity-id', entityOf(lastKey));
      expect(await seenBanner(), 'banner').toBe(false);
    });

    const keep = await armKeep(page);
    const firstKey = startKeys[0] ?? '';
    const firstEntity = entityOf(firstKey);
    let afterFix = 0;
    await test.step('[28V-A-017] fix a row that has a next one: banner, "Giữ lại màn này" keeps the sheet', async () => {
      await openRow(page, firstKey);
      await fix(firstEntity);
      await expect.poll(keep.kept, `"${KEEP_BUTTON}" clicked`).toBe(true);
      await keep.disarm();
      expect(await seenBanner(), 'banner').toBe(true);
      await expect(panel.getByText(ADVANCE_BANNER)).toHaveCount(0);
      await expect(panel).toHaveAttribute('data-entity-id', firstEntity);
      await expect(panel.getByText(FIXED_LINE)).toBeVisible();
      afterFix = (await furnitureIds(page)).length;
    });

    await test.step('[28V-A-023] "Hoàn tác" in the newest toast brings that table back; the sheet drops its "Đã sửa xong" line', async () => {
      await undoButtons(page).first().click(); // NotificationHost: newest toast first
      await expect.poll(async () => (await furnitureIds(page)).length, 'exactly one table restored').toBe(afterFix + 1);
      await expect.poll(async () => (await furnitureIds(page)).includes(firstEntity)).toBe(true);
      await expect(panel.getByRole('button', { name: DELETE_ACTION, exact: true })).toBeVisible();
      // BUG-729 (p06-rf undo-after.json: sheetHasFixedLine true while the action was offered again)
      await expect(panel.getByText(FIXED_LINE)).toHaveCount(0);
    });

    await test.step('[28V-C-005] the report lists the undone row as open again; only the first fix stays "Đã xử lý"', async () => {
      // The undo invalidates the report query (applyUndo -> rerunRules); the rows follow on the refetch, so poll.
      await expect.poll(async () => (await openClashRows(page)).keys, { message: 'undone row back among the open rows' }).toContain(firstKey);
      expect((await openClashRows(page)).keys.length).toBe(startKeys.length - 1);
      await expect.poll(() => resolvedKeys(page), { message: 'the first fix was never undone' }).toEqual([lastKey]);
    });

    await test.step('[28V-C-006] fix again, then Ctrl+Z restores the table exactly once', async () => {
      await openRow(page, firstKey);
      const before = (await furnitureIds(page)).length;
      await fix(firstEntity);
      expect((await furnitureIds(page)).length).toBe(before - 1);
      await page.locator('body').press('Control+Z');
      await expect.poll(async () => (await furnitureIds(page)).length).toBe(before);
      await page.clock.fastForward(1_000);
      expect((await furnitureIds(page)).length, 'still exactly one restore').toBe(before);
    });

    await test.step('[28V-B-004] a resolved row reopened offers no second action and no "Không tìm thấy"', async () => {
      await page.locator(`button[data-row-key="${lastKey}"]`).first().click();
      await expect(panel).toHaveAttribute('data-entity-id', entityOf(lastKey));
      await expect(panel.getByRole('button', { name: DELETE_ACTION, exact: true })).toHaveCount(0);
      await expect(panel.getByText(NOT_FOUND)).toHaveCount(0);
    });

    await test.step('[28V-A-024] after 8 s the toast "Hoàn tác" is gone', async () => {
      await page.clock.fastForward(UNDO_WINDOW_MS);
      await expect(undoButtons(page)).toHaveCount(0);
    });
  });

  test('SCR-28 · FL-28-U1c · [mocked response] [28V-F-005] error state: InlineAlert inside the panel at 1920/1440/1024/768', async ({ page }) => {
    for (const viewport of [
      { width: 1920, height: 1080 },
      { width: 1440, height: 900 },
      { width: 1024, height: 768 },
      { width: 768, height: 1024 },
    ]) {
      await test.step(`[28V-F-005] ${String(viewport.width)}: a refused command shows its sentence inside the panel`, async () => {
        await page.setViewportSize(viewport);
        await openSeeded(page);
        const { keys } = await openClashRows(page);
        const key = keys[0] ?? '';
        await openRow(page, key);
        const panel = sheet(page);
        // The real race of 28V-B-004: the object leaves the drawing in the same instant the action fires, so the
        // command is built on a graph without it and the domain refuses (F6 would hide the action one render later).
        await page.evaluate(
          async ([entityId, projectId, label]) => {
            const load = (path: string): Promise<unknown> => import(/* @vite-ignore */ path);
            const store = (await load('/src/store/index.ts')) as {
              useStore: { getState: () => { setSpatial: (spatial: unknown, versionId: null, source: { projectId: string; floorRevisions: Record<string, number> }) => void } };
            };
            const fixture = (await load('/src/domain/spatial/__fixtures__/sampleBuilding.ts')) as {
              createSampleBuilding: () => { levels: readonly { id: string }[]; furniture: readonly { id: string }[] };
            };
            const normalize = (await load('/src/domain/spatial/normalize.ts')) as { normalizeSpatial: (graph: unknown) => unknown };
            const graph = fixture.createSampleBuilding();
            const without = { ...graph, furniture: graph.furniture.filter((item) => item.id !== entityId) };
            const floorRevisions = Object.fromEntries(graph.levels.map((level) => [level.id, 1]));
            const aside = document.querySelector('aside[aria-label="Chi tiết vi phạm"]');
            const button = Array.from(aside?.querySelectorAll('button') ?? []).find((item) => (item.textContent ?? '').trim() === label);
            if (button === undefined) throw new Error('no action button on the sheet');
            button.click();
            store.useStore.getState().setSpatial(normalize.normalizeSpatial(without), null, { floorRevisions, projectId });
          },
          [entityOf(key), PROJECT_ID, DELETE_ACTION] as const,
        );
        const alert = panel.getByRole('alert').filter({ hasText: NOT_FOUND });
        await expect(alert, 'InlineAlert inside the panel').toBeVisible();
        const box = await alert.boundingBox();
        const panelBox = await panel.boundingBox();
        expect(box !== null && panelBox !== null && box.x >= panelBox.x && box.x + box.width <= panelBox.x + panelBox.width + 1, 'alert within the panel width').toBe(true);
        await test.info().attach(`28V-F-005_error_${String(viewport.width)}.png`, { body: await panel.screenshot(), contentType: 'image/png' });
      });
    }
  });
});
