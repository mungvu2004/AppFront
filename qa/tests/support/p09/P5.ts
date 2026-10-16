/** P5 helpers (phase 09 QC viewer read-only screens). Own file; nothing else imports it. */
import { expect } from '@playwright/test';
import type { APIRequestContext, Locator, Page } from '@playwright/test';

import { dismissTour } from '../../../../e2e/fixtures/tour';
import { createQcProject, deleteProject, type LayerApi, type SeededFloor } from '../layerSeed';
import type { PoolUser } from '../phase03Seed';
import { asMember } from './roles';

/** Admin request context already carries Origin + Bearer (signedInApi), so fixture headers are empty. */
export const layerApiFrom = (admin: APIRequestContext): LayerApi => ({ request: admin, headers: {} });

export interface QcFixture {
  readonly floor: SeededFloor;
  readonly cleanup: () => Promise<void>;
}

/** Own QC project (walls/door/window/rooms/table on the first floor) with `viewer` as member; cleanup removes both. */
export async function seedQcForViewer(admin: APIRequestContext, viewer: PoolUser, slug: string): Promise<QcFixture> {
  const api = layerApiFrom(admin);
  const [floor] = await createQcProject(api, slug);
  if (floor === undefined) throw new Error('setup: QC project has no floor');
  try {
    await asMember(admin, floor.projectId, viewer);
  } catch (error) {
    await deleteProject(api, floor.projectId);
    throw error;
  }
  return {
    floor,
    // deleting the project drops its memberships with it
    cleanup: async () => {
      await deleteProject(api, floor.projectId);
    },
  };
}

/** Opens a layer screen, waits for its region (the sure anchor) and the tour dismissal. */
export async function openScreen(page: Page, url: string, anchor: Locator): Promise<void> {
  await page.goto(url);
  await expect(anchor).toBeVisible({ timeout: 15_000 });
  await dismissTour(page, { waitMs: 3_000 });
}

/** Presses keys one by one (writes are asserted by the caller through recordWrites). */
export async function pressAll(page: Page, keys: readonly string[]): Promise<void> {
  for (const key of keys) await page.keyboard.press(key);
}

/** Network quiet = every autosave debounce had its chance (no fixed wait). */
export const settle = (page: Page): Promise<void> => page.waitForLoadState('networkidle');
