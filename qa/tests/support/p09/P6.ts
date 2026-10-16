/** P6 helpers for phase09_qc_b_edge.spec.ts (QC screens SCR-16..21, engineer / anon / admin). */
import { expect, type APIRequestContext, type Locator, type Page } from '@playwright/test';

import { dismissTour } from '../../../../e2e/fixtures/tour';
import { createQcProject, deleteProject, writeDimensions, type LayerApi, type SeededFloor } from '../layerSeed';
import { dimsFixture } from '../p04/P3';

/** Admin API context already carries its Bearer in extraHTTPHeaders, so no extra headers (layerSeed LayerApi). */
export const layerApiFrom = (admin: APIRequestContext): LayerApi => ({ request: admin, headers: {} });

export async function seedQc(admin: APIRequestContext, slug: string): Promise<SeededFloor> {
  const [floor] = await createQcProject(layerApiFrom(admin), slug);
  if (floor === undefined) throw new Error('createQcProject returned no floor');
  return floor;
}

/**
 * Three unreviewed AI dimension strings (#M-001..#M-003) along the qcLayer outer walls 0, 1 and 2 (4 m each), written
 * through #35 `body.dimensions` (BUG-577): 9Q-C-006 edits #M-001, 9Q-C-007 approves #M-002 by keyboard.
 */
export async function seedQcDims(admin: APIRequestContext, floor: SeededFloor): Promise<void> {
  await writeDimensions(layerApiFrom(admin), floor.projectId, floor.floorId, (levelId, wallIds) =>
    dimsFixture(
      levelId,
      [
        { n: 1, valueMm: 4030, confidence: 0.9, line: [0, -400, 4000, -400], walls: [0] },
        { n: 2, valueMm: 4000, confidence: 0.9, line: [4000, -400, 8000, -400], walls: [1] },
        { n: 3, valueMm: 4000, confidence: 0.9, line: [0, 6400, 4000, 6400], walls: [2] },
      ],
      wallIds,
    ),
  );
}

export const dropProject = (admin: APIRequestContext, projectId: string): Promise<string | null> =>
  deleteProject(layerApiFrom(admin), projectId);

export const layerRe = (floor: SeededFloor): RegExp =>
  new RegExp(`^/api/projects/${floor.projectId}/floors/${floor.floorId}/spatial/layer$`, 'u');

/** Register BEFORE the action: next PUT of the floor layer. */
export const waitLayerPut = (page: Page, floor: SeededFloor) =>
  page.waitForResponse(
    (r) => r.request().method() === 'PUT' && layerRe(floor).test(new URL(r.url()).pathname),
    { timeout: 20_000 },
  );

/** goto + wait for GET layer 200 + screen region + tour dismissed: the sure anchor before asserting absence. */
export async function openLayerScreen(page: Page, url: string, floor: SeededFloor, region: string | RegExp | null): Promise<void> {
  const [read] = await Promise.all([
    page.waitForResponse((r) => r.request().method() === 'GET' && layerRe(floor).test(new URL(r.url()).pathname)),
    page.goto(url, { waitUntil: 'commit' }),
  ]);
  expect(read.status(), 'GET spatial/layer').toBe(200);
  if (region !== null) await expect(page.getByRole('region', { name: region }).first()).toBeVisible({ timeout: 15_000 });
  await dismissTour(page);
}

export async function codeOfOption(option: Locator): Promise<string> {
  const code = ((await option.getAttribute('aria-label')) ?? '').split(' — ')[0]?.trim() ?? '';
  if (code === '') throw new Error('option has no "<code> — <status>" aria-label');
  return code;
}

export async function pressSpaceOn(control: Locator): Promise<void> {
  await control.focus();
  await control.page().keyboard.press('Space');
}

/** Custom Select (components/ui/Select.tsx): the open listbox is the trigger's aria-controls. */
export async function openSelect(page: Page, trigger: Locator): Promise<Locator> {
  await trigger.click();
  await expect(trigger).toHaveAttribute('aria-expanded', 'true');
  const id = await trigger.getAttribute('aria-controls');
  if (id === null || id === '') throw new Error('select trigger has no aria-controls once open');
  return page.locator(`[id="${id}"]`);
}

export const statusBarUndo = (page: Page): Locator =>
  page.getByRole('status', { name: 'Thanh trạng thái', exact: true }).getByRole('button', { name: 'Hoàn tác', exact: true });
