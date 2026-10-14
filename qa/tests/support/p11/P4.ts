/**
 * QA-11 pack P4 helpers (SCR-21 thickness standardization, SCR-25 measurement delete). Own pool slot via `p11Slot`.
 */
import type { APIRequestContext, Browser, Page } from '@playwright/test';
import { expect } from '@playwright/test';

import { signedInApi } from '../api';
import { readAdminCredentials } from '../auth';
import { deleteSeededProject } from '../drawingSeed';
import { writeLayer, type LayerApi } from '../layerSeed';
import { addProjectMember, createProject, poolUser, type PoolRole, type SeededProject } from '../phase03Seed';
import { closeSession, openPool, type Session } from '../p03/P6';
import { p11Slot } from './common';

export interface P4Run {
  readonly session: Session;
  readonly project: SeededProject;
  readonly api: APIRequestContext;
  readonly layerApi: LayerApi;
}

/**
 * Like `withMemberProject` (P10) but the pool user comes from this file's own slot (`p11Slot(slot)`), not `shared`
 * // dup-of: withMemberProject (P10) with slot parameter.
 */
export async function withSlotMember(
  browser: Browser,
  role: PoolRole,
  slot: string,
  slug: string,
  floors: number,
  body: (run: P4Run) => Promise<void>,
): Promise<void> {
  const admin = readAdminCredentials();
  const api = await signedInApi(admin.email, admin.password);
  let session: Session | undefined;
  let projectId: string | undefined;
  try {
    const user = await poolUser(api, role, p11Slot(slot));
    const project = await createProject(api, slug, floors);
    projectId = project.projectId;
    await addProjectMember(api, projectId, user.email);
    session = await openPool(browser, user);
    await body({ session, project, api, layerApi: { request: api, headers: {} } });
  } finally {
    await closeSession(session);
    const cleanup = projectId === undefined ? null : await deleteSeededProject(api, projectId);
    await api.dispose();
    expect(cleanup, 'cleanup').toBeNull();
  }
}

type Json = Record<string, unknown>;
let counter = 0;
const wid = (): string => `W-${(Date.now().toString(36) + String(counter++) + Math.random().toString(36).slice(2, 8)).toUpperCase().padEnd(12, 'X')}`;

export interface ThickSeed {
  readonly ids: readonly string[];
  readonly reviewedId: string;
}

/** Floor layer for SCR-21: two 200 mm partitions + one 220 mm wall (one group) and one HUMAN-reviewed 200 mm wall. */
export async function seedThicknessLayer(layerApi: LayerApi, projectId: string, floorId: string): Promise<ThickSeed> {
  const ids = [wid(), wid(), wid()];
  const reviewedId = wid();
  const wall = (id: string, y: number, thicknessMm: number, reviewed: boolean) => (levelId: string): Json => ({
    ...(reviewed ? { confidence: 1, reviewed: true, source: 'human' } : { confidence: 0.9, reviewed: false, source: 'ai' }),
    centreline: { start: { x: 0, y }, end: { x: 4000, y } },
    heightMm: 3000,
    id,
    kind: reviewed ? 'loadBearing' : 'partition',
    levelId,
    openingIds: [],
    thicknessMm,
  });
  await writeLayer(layerApi, projectId, floorId, (levelId) => ({
    furniture: [],
    openings: [],
    rooms: [],
    walls: [wall(ids[0] as string, 0, 200, false), wall(ids[1] as string, 3000, 200, false), wall(ids[2] as string, 6000, 220, false), wall(reviewedId, 9000, 200, true)].map((w) => w(levelId)),
  }));
  return { ids, reviewedId };
}

/** #17 record (BE apps/api/measurements/schemas.py MeasurementRecordIn; id `^MS-[0-9]{4,15}$`). */
export async function seedMeasurement(api: APIRequestContext, projectId: string, name: string, id?: string): Promise<string> {
  const useId = id ?? `MS-${String(1000 + Math.floor(Math.random() * 8999))}`;
  const created = await api.post(`/api/projects/${projectId}/measurements`, {
    data: { id: useId, name, mode: 'pointToPoint', points: [{ x: 0, y: 0 }, { x: 4000, y: 0 }], rawValueMm: 4000 },
  });
  expect(created.status(), `setup: POST measurements: ${(await created.text()).slice(0, 200)}`).toBe(201);
  return useId;
}

/** Non-GET `/api/*` requests the page sends (for "nothing written" claims). */
export function writeLog(page: Page): { method: string; path: string }[] {
  const log: { method: string; path: string }[] = [];
  page.on('request', (request) => {
    if (request.method() !== 'GET') log.push({ method: request.method(), path: new URL(request.url()).pathname });
  });
  return log;
}
