/**
 * QA-11 P5 helpers (floors UI + mocked edge): one engineer pool user in the spec file's own slot, member of projects the
 * main admin API creates (never touches shared state: projects are deleted in `finally`, sessions are fresh contexts).
 */
import { randomUUID } from 'node:crypto';

import { expect, type APIRequestContext, type Browser, type Locator, type Page } from '@playwright/test';

import { readAdminCredentials } from '../auth';
import { signedInApi } from '../api';
import { writeLayer } from '../layerSeed';
import { addProjectMember, createProject, deleteSeededProject, poolUser, type PoolUser, type SeededProject } from '../phase03Seed';
import { openSession, type Session } from '../p03/P7';
import { p11Slot } from './common';

type Json = Record<string, unknown>;

export interface EngineerCtx {
  readonly admin: APIRequestContext;
  readonly engineer: PoolUser;
  /** Creates an own project (admin), adds the engineer as a member, deletes it in `finally`. */
  readonly project: (slug: string, floors: number) => Promise<SeededProject>;
  /** Fresh signed-in browser context of the engineer (closed in `finally`). */
  readonly session: () => Promise<Session>;
}

/** Runs `body` with an engineer of pool slot `p11-<fileSlug>`; cleans projects and sessions. */
export async function withEngineer(browser: Browser, fileSlug: string, body: (ctx: EngineerCtx) => Promise<void>): Promise<void> {
  const creds = readAdminCredentials();
  const admin = await signedInApi(creds.email, creds.password);
  const projects: string[] = [];
  const sessions: Session[] = [];
  try {
    const engineer = await poolUser(admin, 'engineer', p11Slot(fileSlug));
    await body({
      admin,
      engineer,
      project: async (slug, floors) => {
        const created = await createProject(admin, slug, floors);
        projects.push(created.projectId);
        await addProjectMember(admin, created.projectId, engineer.email);
        return created;
      },
      session: async () => {
        const s = await openSession(browser, engineer);
        sessions.push(s);
        return s;
      },
    });
  } finally {
    for (const s of sessions) await s.context.close();
    for (const id of projects) await deleteSeededProject(admin, id);
    await admin.dispose();
  }
}

/** True when the two boxes overlap. */
export const intersects = (a: Box, b: Box): boolean =>
  a !== null && b !== null && a.x < b.x + b.width && b.x < a.x + a.width && a.y < b.y + b.height && b.y < a.y + a.height;
export type Box = { x: number; y: number; width: number; height: number } | null;

/** Page-level horizontal overflow in px (0 = none). */
export const overflowX = (page: Page): Promise<number> =>
  page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);

/** Every `/api/` write (method != GET) the page sends, recorded from now on; read after a certain landmark. */
export function recordWrites(page: Page): () => string[] {
  const seen: string[] = [];
  page.on('request', (r) => {
    const url = new URL(r.url());
    if (r.method() !== 'GET' && url.pathname.startsWith('/api/') && url.pathname !== '/api/auth/refresh' && !url.pathname.startsWith('/api/telemetry'))
      seen.push(`${r.method()} ${url.pathname}`);
  });
  return () => [...seen];
}

const wid = (): string => `W-${randomUUID().replace(/-/gu, '').toUpperCase().slice(0, 20)}`;

/**
 * Thickness fixture layer (copy of phase04 `wireWall`): two AI 200 mm walls (one group within tolerance of 220 mm), one AI 150 mm wall
 * (outside the 30 mm tolerance -> "không đổi được") and one human-reviewed 200 mm wall (-> re-apply warning). #35 write of the floor.
 */
export async function seedThicknessLayer(api: APIRequestContext, projectId: string, floorId: string): Promise<void> {
  const wall = (y: number, thicknessMm: number, reviewed: boolean): Json => ({
    ...(reviewed ? { confidence: 1, reviewed: true, source: 'human' } : { confidence: 0.9, reviewed: false, source: 'ai' }),
    centreline: { start: { x: 0, y }, end: { x: 4000, y } },
    heightMm: 3000,
    id: wid(),
    kind: 'partition',
    levelId: '',
    openingIds: [],
    thicknessMm,
  });
  await writeLayer({ request: api, headers: {} }, projectId, floorId, (levelId) => ({
    furniture: [],
    openings: [],
    rooms: [],
    walls: [wall(0, 200, false), wall(1500, 200, false), wall(3000, 150, false), wall(4500, 200, true)].map((w) => ({ ...w, levelId })),
  }));
}

/** #17 measurement records (BE measurements/schemas.py: id `MS-dddd`). Returns ids in order. */
export async function seedMeasurements(api: APIRequestContext, projectId: string, names: readonly string[]): Promise<string[]> {
  const ids: string[] = [];
  for (const [i, name] of names.entries()) {
    const id = `MS-${String(1000 + Math.floor(Math.random() * 8000) + i)}`;
    const res = await api.post(`/api/projects/${projectId}/measurements`, {
      data: { id, name, mode: 'pointToPoint', points: [{ x: 0, y: 0 }, { x: 4000, y: 0 }], rawValueMm: 4000 },
    });
    expect(res.status(), `setup: POST measurements: ${(await res.text()).slice(0, 200)}`).toBe(201);
    ids.push(id);
  }
  return ids;
}

export const toastWith = (page: Page, text: string): Locator => page.getByRole('status').filter({ hasText: text });
