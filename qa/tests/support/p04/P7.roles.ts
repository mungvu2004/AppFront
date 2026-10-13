/**
 * QA-04c P7 (roles half): helpers for `phase04_roles_edge.spec.ts` only. Seeds come from `../layerSeed.ts` (qcLayer,
 * createQcProject, writeLayer) and `../drawingSeed.ts` (createPipelineDrawingProject); real pool members come from
 * `../phase03Seed.ts` (poolUser + addProjectMember). No import from the other packs' P<n>.ts files.
 *
 * - {@link openRolesEnv}: the MAIN admin (`adminApi`, only to fill / read the pool and to change a role) and the FILE's pool
 *   admin `owner` (slot `p04-roles`, its own `drawings_init` bucket) that owns every project of a test and deletes it.
 * - Builders `objects1Wall`, `roomsViewer`, `viewer2119` (small variants of `qcLayer`), `q1Project`, `framedFloor`, `realFloor`.
 * - {@link memberFlow}: a REAL member (viewer / engineer pool user + N3 member + one browser login) with the request log.
 * - {@link setRole}: #41 `PATCH /api/users/:id/role` (admin-only), for the demotion flow.
 */
import { randomUUID } from 'node:crypto';

import type { APIRequestContext, Browser, Locator, Page } from '@playwright/test';

import { navigateThenWaitForApi } from '../../../../e2e/fullstack/apiWatch';
import { createPipelineDrawingProject, deleteSeededProject, type SeededDrawing } from '../drawingSeed';
import { createQcProject, layerPathOf, qcLayer, writeLayer, type LayerApi, type SeededFloor } from '../layerSeed';
import { addProjectMember, envDrawingPng, poolUser, type PoolRole, type PoolUser } from '../phase03Seed';
import { adminApi, poolApi } from '../p03/P11';
import { framedPng } from '../p03/P12';
import { openFlow, type Flow } from '../p03/P5';

export { writesSince } from '../p03/P5';
export type { Flow } from '../p03/P5';

type Json = Record<string, unknown>;
type Pt = readonly [number, number];

/** Slot of the file's pool users: owner admin, shared viewer, shared engineer (never role-changed). */
export const SLOT = 'p04-roles';
/** Slot of the engineer that FL-R-08 demotes (#41) and restores. */
export const DEMOTE_SLOT = 'p04-demote';

export const escapeRegExp = (text: string): string => text.replace(/[.*+?^${}()|[\]\\]/gu, '\\$&');

/* ---- environment ----------------------------------------------------------------------------- */

export interface RolesEnv {
  /** Main admin API client: pool fill / read and #41 only. */
  readonly main: APIRequestContext;
  readonly owner: APIRequestContext;
  readonly ownerUser: PoolUser;
  /** `owner` as a {@link LayerApi} (its Bearer is already on the client). */
  readonly layerApi: LayerApi;
  readonly projects: string[];
}

export async function openRolesEnv(): Promise<RolesEnv> {
  const main = await adminApi();
  try {
    const ownerUser = await poolUser(main, 'admin', SLOT);
    const owner = await poolApi(ownerUser);
    return { main, owner, ownerUser, layerApi: { request: owner, headers: {} }, projects: [] };
  } catch (error) {
    await main.dispose();
    throw error;
  }
}

/** Deletes every project of the test (200 / 404 fine) and disposes both clients; never throws. */
export async function closeRolesEnv(env: RolesEnv | undefined): Promise<void> {
  if (env === undefined) return;
  for (const id of env.projects) await deleteSeededProject(env.owner, id);
  await env.owner.dispose().catch(() => undefined);
  await env.main.dispose().catch(() => undefined);
}

/* ---- layer builders -------------------------------------------------------------------------- */

const sid = (letter: 'W' | 'D' | 'R' | 'F'): string => `${letter}-${randomUUID().replace(/-/gu, '').toUpperCase().slice(0, 20)}`;
const ai = (): Json => ({ confidence: 0.9, reviewed: false, source: 'ai' });

const wallOf = (levelId: string, from: Pt, to: Pt, extra: Json = {}): Json => ({
  ...ai(),
  centreline: { start: { x: from[0], y: from[1] }, end: { x: to[0], y: to[1] } },
  heightMm: 3_000,
  id: sid('W'),
  kind: 'partition',
  levelId,
  openingIds: [],
  thicknessMm: 220,
  ...extra,
});

const layerOf = (walls: Json[]): Json => ({ walls, openings: [], rooms: [], furniture: [] });

export interface RoleProject {
  readonly projectId: string;
  readonly floors: readonly SeededFloor[];
}

async function build(
  env: RolesEnv,
  slug: string,
  names: readonly string[],
  layered: number,
  extra: ReadonlyArray<readonly [number, (levelId: string) => Json]>,
): Promise<RoleProject> {
  // No leak window: createQcProject deletes its project itself when it fails after the POST (layerSeed.ts:217-220), and the id is
  // registered here before any further write of this builder.
  const floors = await createQcProject(env.layerApi, slug, names, layered);
  const first = floors[0];
  if (first === undefined) throw new Error('seed: no floor');
  env.projects.push(first.projectId);
  for (const [index, builder] of extra) {
    const floor = floors[index];
    if (floor === undefined) throw new Error(`seed: no floor #${String(index)}`);
    await writeLayer(env.layerApi, floor.projectId, floor.floorId, builder);
  }
  return { projectId: first.projectId, floors };
}

/** Q1: one floor with `qcLayer`. */
export const q1Project = (env: RolesEnv, slug: string): Promise<RoleProject> => build(env, slug, ['Tầng 1'], 1, []);

/** Q2: Q1 plus an empty floor (no layer, no drawing). */
export const q2Project = (env: RolesEnv, slug: string): Promise<RoleProject> => build(env, slug, ['Tầng 1', 'Tầng trống'], 1, []);

/** QX:objects-1wall — floor 0 = Q1 (door, window, table); floor 1 = ONE wall and no object (SCR-17 "Thêm thủ công"). */
export const objects1Wall = (env: RolesEnv, slug: string): Promise<RoleProject> =>
  build(env, slug, ['Tầng 1', 'Tầng 1 tường'], 1, [[1, (levelId) => layerOf([wallOf(levelId, [0, 0], [4000, 0])])]]);

/**
 * QX:rooms-viewer — floor 0 = Q1 (rooms "Bếp" + "PHONG NGU 2"); floor 1 = empty (no wall, no room);
 * floor 2 = a 6 x 4 m wall loop open by a 57 mm gap at the north-east corner (weld gap <= 80 mm, domain/rooms/graph.ts:63).
 */
export const roomsViewer = (env: RolesEnv, slug: string): Promise<RoleProject> =>
  build(env, slug, ['Tầng 1', 'Tầng trống', 'Tầng vòng hở'], 1, [
    [
      2,
      (levelId) =>
        layerOf([
          wallOf(levelId, [0, 4000], [6000, 4000]),
          wallOf(levelId, [0, 0], [0, 4000]),
          wallOf(levelId, [0, 0], [5960, 0]),
          wallOf(levelId, [6000, 40], [6000, 4000]),
        ]),
    ],
  ]);

/**
 * QX:viewer-21-19 — floor 0 = thickness mix (two 200 mm walls within the 30 mm tolerance of the 220 group, a 150 mm and a
 * 330 mm wall); floor 1 = empty; floor 2 = Q1 (the load-bearing rectangle SCR-19 derives axes from).
 */
export const viewer2119 = (env: RolesEnv, slug: string): Promise<RoleProject> =>
  build(env, slug, ['Tầng độ dày', 'Tầng trống', 'Tầng chữ nhật'], 1, [
    [
      0,
      (levelId) =>
        layerOf([
          wallOf(levelId, [0, 0], [4000, 0], { thicknessMm: 200 }),
          wallOf(levelId, [0, 3000], [4000, 3000], { thicknessMm: 200 }),
          wallOf(levelId, [0, 6000], [4000, 6000], { thicknessMm: 150 }),
          wallOf(levelId, [4000, 0], [4000, 6000], { thicknessMm: 330, kind: 'loadBearing' }),
        ]),
    ],
    [2, qcLayer],
  ]);

/* ---- drawing floors (real upload + fake-ML run, as the file's pool admin) -------------------------- */

/** DF: framed drawing (`frame.isFound`): SCR-14 / SCR-22 reach `forbidden` for a viewer (C4 Notes). */
export async function framedFloor(env: RolesEnv, slug: string): Promise<SeededDrawing> {
  const seeded = await createPipelineDrawingProject(env.owner, slug, framedPng());
  env.projects.push(seeded.projectId);
  return seeded;
}

/** D1: the env drawing after the run: warped (FRAME_NOT_FOUND), provisional scale, AI layer. */
export async function realFloor(env: RolesEnv, slug: string): Promise<SeededDrawing> {
  const seeded = await createPipelineDrawingProject(env.owner, slug, envDrawingPng());
  env.projects.push(seeded.projectId);
  return seeded;
}

/* ---- real members ---------------------------------------------------------------------------- */

export interface Member {
  readonly flow: Flow;
  readonly user: PoolUser;
}

/** Pool user of `role`/`slot` + N3 member of each project + one browser login (no mocked session). */
export async function memberFlow(
  browser: Browser,
  env: RolesEnv,
  projectIds: readonly string[],
  role: Exclude<PoolRole, 'admin'>,
  slot: string = SLOT,
): Promise<Member> {
  const user = await poolUser(env.main, role, slot);
  for (const id of projectIds) await addProjectMember(env.owner, id, user.email);
  const flow = await openFlow(browser, user);
  return { flow, user };
}

/** #41 `PATCH /api/users/:id/role` by the main admin; returns the HTTP status (200 also when the role is unchanged). */
export async function setRole(env: RolesEnv, user: PoolUser, role: PoolRole): Promise<number> {
  const res = await env.main.patch(`/api/users/${user.id}/role`, { data: { role, userId: user.id } });
  return res.status();
}

/* ---- screens --------------------------------------------------------------------------------- */

const layerRe = (projectId: string, floorId: string): RegExp => new RegExp(`^${escapeRegExp(layerPathOf(projectId, floorId))}$`, 'u');

/** Loads `url` as a fresh document and waits for the floor's N16 read (200). */
export async function openLayerScreen(page: Page, url: string, projectId: string, floorId: string): Promise<void> {
  await navigateThenWaitForApi(page, () => page.goto(url, { waitUntil: 'commit' }), 'GET', layerRe(projectId, floorId), [200]);
}

export const region = (page: Page, name: string): Locator => page.getByRole('region', { name, exact: true });
