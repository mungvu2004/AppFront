/**
 * Phase 03 shared seeds (QA-03d agent 0) — for the 17 phase-03 spec authors. Real API only; no mocks here.
 *
 * Usage (import everything from this file; the drawingSeed helpers are re-exported):
 *   const admin = await signedInApi(adminEmail, adminPassword);          // support/api.ts, 1 login
 *   const p = await createProject(admin, '08-a-001', 3);                 // own project, 3 floors (0 = no floor)
 *   const d = await createDrawingProject(admin, '10-x', envDrawingPng());  // + drawing on floor 1, run starts (live)
 *   await uploadDrawing(admin, p.projectId, p.floors[1].id, png, 'b.png'); // another floor of an existing project
 *   const done = await createPipelineDrawingProject(admin, '12-a', envDrawingPng()); // finished run (~fake ML)
 *   const bad = await createFailedRunProject(admin, '12-b-053', 'FILE_CORRUPT');      // or 'IMAGE_TOO_LARGE'
 *   const out = await waitForRunOutcome(admin, d.projectId, d.uploadId); // { status: 'completed' | 'failed', error }
 *   const codes = await waitForQualityFindings(admin, d.projectId, d.floorId); // e.g. ['FRAME_NOT_FOUND']
 *   framelessPng(browser) / rotatedPng(browser, path, SKEW_DEG) / corruptPng() / oversizePng(): crafted drawings
 *   try { ... } finally { await deleteSeededProject(admin, p.projectId); }  // 200/404 ok, never throws
 *   Measured 2026-10-12 (QA-03d smoke): the fake-ML run ends ~0.5 s after #7; crafted PNGs fail at step preprocess.
 *
 * Non-admin users (pool, reused across files and runs; NEVER invite in a spec yourself):
 *   const viewer = await poolUser(admin, 'viewer');               // 1 GET /api/users; invites only on first use
 *   const eng = await poolUser(admin, 'engineer', 'upload_flows'); // own slot = own drawings_init bucket
 *   await addProjectMember(admin, p.projectId, viewer.email);     // membership has no role: global role applies
 *   const vApi = await signedInApi(viewer.email, viewer.password);  // 1 login (LOGIN_IP_LIMIT 120 / 60 s)
 *   await signInPoolUser(context, viewer); await page.goto(`/projects/${p.projectId}/upload`); // browser session
 *   Deleting the project drops the membership; removeProjectMember() only when the test is about removal.
 *   Do NOT delete pool users in a spec; the coordinator calls releasePoolUsers(admin) after the phase.
 *
 * Budgets: one poolUser() first fill = 1 invitation (users_invite 30 / 3600 s per admin, no env override exists)
 * + 1 accept (recovery_ip). Slots in use should stay small: shared viewer, shared engineer, one engineer per
 * upload-heavy file at most. Every upload init counts against drawings_init per user (DRAWINGS_INIT_RATE_LIMIT,
 * qa-limits.override.yml). Name projects by catalog id (slug) so leftovers are traceable.
 */
import { randomUUID } from 'node:crypto';
import { readFileSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { deflateSync } from 'node:zlib';

import { expect, type APIRequestContext, type Browser, type BrowserContext } from '@playwright/test';

import { ImageQualityAssessmentSchema } from '../../../src/api/schemas/quality';
import { PIPELINE_TIMEOUT_MS } from '../../../e2e/fullstack/env';
import { apiBaseUrl, newApiContext, signedInApi } from './api';
import { createDrawingProject, deleteSeededProject, type SeededDrawing } from './drawingSeed';
import { TEST_DATA_PREFIX, testEmail } from './evidence';
import { deleteMails, linkFrom, waitForMail } from './mailpit';
import { readAdminCredentials } from './auth';
import { inviteWithFallback, loginOrRefresh, mergeWriteJsonFile, readJsonFile, type Answer } from './poolFile';

export {
  createDrawingProject,
  createPipelineDrawingProject,
  createPipelineProject,
  createSkewedDrawingProject,
  deleteSeededProject,
  rotatedPng,
  SKEW_DEG,
  uploadDrawing,
  type SeededDrawing,
} from './drawingSeed';

type Json = Record<string, unknown>;

const PROJECTS = '/api/projects';
/** BE:auth_recovery/messages.py invitation subject (phase02_dashboard_api INVITE_SUBJECT). */
const INVITE_SUBJECT = 'Lời mời tham gia AppFront';

const asJson = (value: unknown, what: string): Json => {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) throw new Error(`${what}: not a JSON object`);
  return value as Json;
};

/* ---- projects and floors ---------------------------------------------------------------------- */

export interface SeededFloorRow {
  readonly id: string;
  readonly name: string;
  readonly order: number;
}

export interface SeededProject {
  readonly projectId: string;
  readonly name: string;
  readonly floors: readonly SeededFloorRow[];
}

/** The env drawing (`E2E_DRAWING_PNG`, straight 1600x1200 plan; finishes the fake-ML pipeline). */
export function envDrawingPng(): Buffer {
  const path = process.env.E2E_DRAWING_PNG;
  if (!path) throw new Error('E2E_DRAWING_PNG is not set (qa.config.json env.vars)');
  return readFileSync(path);
}

/** Own project `qa-<runId>-<slug>-<uniq>` with `floors` ("Tầng 1..n" when a count; 0 = none), each 3 m high, 3 m apart. */
export async function createProject(
  api: APIRequestContext,
  slug: string,
  floors: number | readonly string[] = 0,
): Promise<SeededProject> {
  const names = typeof floors === 'number' ? Array.from({ length: floors }, (_, i) => `Tầng ${String(i + 1)}`) : floors;
  const name = `${TEST_DATA_PREFIX}${slug}-${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;
  const created = await api.post(PROJECTS, {
    data: {
      name,
      ...(names.length ? { floors: names.map((n, order) => ({ name: n, order, elevationMm: order * 3_000, heightMm: 3_000 })) } : {}),
    },
  });
  expect(created.status(), `setup: POST ${PROJECTS} "${name}": ${(await created.text()).slice(0, 300)}`).toBe(201);
  const projectId = String(asJson(await created.json(), `POST ${PROJECTS}`).id);
  try {
    return { projectId, name, floors: await listFloors(api, projectId) };
  } catch (error) {
    await deleteSeededProject(api, projectId);
    throw error;
  }
}

/** Floors of a project from `GET /api/projects/:id`, sorted by `order`. */
export async function listFloors(api: APIRequestContext, projectId: string): Promise<SeededFloorRow[]> {
  const read = await api.get(`${PROJECTS}/${projectId}`);
  expect(read.status(), `setup: GET ${PROJECTS}/${projectId}`).toBe(200);
  const rows = asJson(await read.json(), `GET ${PROJECTS}/:id`).floors;
  return (Array.isArray(rows) ? rows : [])
    .map((row) => asJson(row, 'floor'))
    .map((row) => ({ id: String(row.id), name: String(row.name), order: Number(row.order) }))
    .sort((a, b) => a.order - b.order);
}

/* ---- pipeline runs ---------------------------------------------------------------------------- */

export interface RunOutcome {
  readonly status: 'completed' | 'failed';
  /** UPPER_SNAKE code of a failed run or rejected upload ("" when the BE had none); absent when completed. */
  readonly error?: string;
  readonly progress: Json;
}

/** Polls #8 progress every 2 s until `completed` or `failed` (BE drawings/progress.py:30-67); throws after `timeoutMs`. */
export async function waitForRunOutcome(
  api: APIRequestContext,
  projectId: string,
  uploadId: string,
  timeoutMs: number = PIPELINE_TIMEOUT_MS,
): Promise<RunOutcome> {
  const deadline = Date.now() + timeoutMs;
  for (;;) {
    const res = await api.get(`${PROJECTS}/${projectId}/drawings/uploads/${uploadId}/progress`);
    const progress: Json = res.status() === 200 ? asJson(await res.json(), '#8 progress') : { status: `#8 ${String(res.status())}` };
    if (progress.status === 'completed') return { status: 'completed', progress };
    if (progress.status === 'failed') return { status: 'failed', error: String(progress.error ?? ''), progress };
    if (Date.now() > deadline) throw new Error(`setup: #8 progress still "${String(progress.status)}" after ${String(timeoutMs)} ms`);
    await new Promise((resolve) => setTimeout(resolve, 2_000));
  }
}

/** Finding codes of `floorId` once #30 reports it measured (polls; e.g. FRAME_NOT_FOUND, SKEW_DETECTED). */
export async function waitForQualityFindings(api: APIRequestContext, projectId: string, floorId: string): Promise<string[]> {
  let codes: string[] = [];
  await expect
    .poll(
      async () => {
        const res = await api.get(`${PROJECTS}/${projectId}/floors/${floorId}/quality`);
        if (res.status() !== 200) return `#30 ${String(res.status())}`;
        const floor = ImageQualityAssessmentSchema.parse(await res.json()).floors.find((f) => f.floorId === floorId);
        if (floor?.isMeasured !== true) return 'not measured';
        codes = floor.findings.map((f) => f.code);
        return 'measured';
      },
      { message: `setup: #30 measures floor ${floorId}`, timeout: PIPELINE_TIMEOUT_MS, intervals: [2_000] },
    )
    .toBe('measured');
  return codes;
}

/** Worker-side failure codes reachable with a crafted PNG (pass #7, fail in preprocess load_raster). */
export type CraftedFailure = 'FILE_CORRUPT' | 'IMAGE_TOO_LARGE';

/**
 * Own 1-floor project whose run FAILED with `code` (crafted PNG via the API, BE packages/vision/preprocess/raster.py:
 * 49-67,111-116). Throws (and deletes the project) when the run completes or fails with another code.
 */
export async function createFailedRunProject(
  api: APIRequestContext,
  slug: string,
  code: CraftedFailure,
): Promise<SeededDrawing & { readonly uploadId: string; readonly error: string }> {
  const seeded = await createDrawingProject(api, slug, code === 'FILE_CORRUPT' ? corruptPng() : oversizePng(), ['Tầng 1']);
  try {
    const outcome = await waitForRunOutcome(api, seeded.projectId, seeded.uploadId);
    if (outcome.status !== 'failed' || outcome.error !== code) {
      throw new Error(`setup: crafted ${code} PNG gave run ${outcome.status} ${outcome.error ?? ''} (expected failed ${code})`);
    }
    return { ...seeded, error: outcome.error };
  } catch (error) {
    await deleteSeededProject(api, seeded.projectId);
    throw error;
  }
}

/* ---- crafted drawings (in memory) ------------------------------------------------------------- */

const CRC_TABLE = Array.from({ length: 256 }, (_, n) => {
  let c = n;
  for (let k = 0; k < 8; k += 1) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  return c >>> 0;
});

const crc32 = (buf: Buffer): number => {
  let c = 0xffffffff;
  for (const byte of buf) c = (CRC_TABLE[(c ^ byte) & 0xff] ?? 0) ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
};

const pngChunk = (type: string, data: Buffer, badCrc = false): Buffer => {
  const head = Buffer.alloc(8);
  head.writeUInt32BE(data.length, 0);
  head.write(type, 4, 'ascii');
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE((crc32(Buffer.concat([head.subarray(4), data])) ^ (badCrc ? 1 : 0)) >>> 0, 0);
  return Buffer.concat([head, data, crc]);
};

const PNG_SIGNATURE = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);

/** PNG of `width` x `height` (8-bit gray) whose IHDR is valid and whose IDAT is `idat` (CRC broken when `badCrc`). */
function craftedPng(width: number, height: number, idat: Buffer, badCrc: boolean): Buffer {
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr.set([8, 0, 0, 0, 0], 8); // bit depth 8, gray, deflate, adaptive filter, no interlace
  return Buffer.concat([PNG_SIGNATURE, pngChunk('IHDR', ihdr), pngChunk('IDAT', idat, badCrc), pngChunk('IEND', Buffer.alloc(0))]);
}

/** Signature + IHDR + IEND valid (passes #7 magic/end-marker checks) but IDAT is garbage with a bad CRC → FILE_CORRUPT. */
export function corruptPng(): Buffer {
  return craftedPng(64, 64, Buffer.from('not a zlib stream, just garbage bytes'), true);
}

/** Tiny file whose IHDR declares `width` x `height` (default 8000x6000 = 48 MP > 40 MP pipeline_max_pixels) → IMAGE_TOO_LARGE. */
export function oversizePng(width = 8_000, height = 6_000): Buffer {
  return craftedPng(width, height, deflateSync(Buffer.alloc(0)), false);
}

/** 1600x1200 white PNG, short separate strokes + text, no closed quad: #30 lists FRAME_NOT_FOUND (+ RESOLUTION_TOO_LOW, as the env drawing); run completes. */
export async function framelessPng(browser: Browser): Promise<Buffer> {
  const page = await browser.newPage();
  try {
    const dataUrl = await page.evaluate(() => {
      const canvas = document.createElement('canvas');
      canvas.width = 1600;
      canvas.height = 1200;
      const ctx = canvas.getContext('2d');
      if (ctx === null) throw new Error('no 2d canvas');
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(0, 0, 1600, 1200);
      ctx.strokeStyle = '#000000';
      ctx.lineWidth = 3;
      for (let y = 200; y < 1000; y += 120) {
        for (let x = 200; x < 1400; x += 160) {
          ctx.beginPath();
          ctx.moveTo(x, y);
          ctx.lineTo(x + 60, y + ((x / 160) % 2 ? 0 : 40));
          ctx.stroke();
        }
      }
      ctx.fillStyle = '#000000';
      ctx.font = '28px monospace';
      ctx.fillText('BAN VE KHONG KHUNG', 600, 1100);
      return canvas.toDataURL('image/png');
    });
    return Buffer.from(dataUrl.slice(dataUrl.indexOf(',') + 1), 'base64');
  } finally {
    await page.close();
  }
}

/* ---- non-admin user pool ---------------------------------------------------------------------- */

export type PoolRole = 'admin' | 'engineer' | 'viewer';

export interface PoolUser {
  readonly id: string;
  readonly email: string;
  readonly password: string;
  readonly role: PoolRole;
  readonly name: string;
}

/**
 * `<E2E_RESULTS_DIR>/user-pool-phase03.json` — across runs on purpose (authors' targeted runs use different run ids and
 * would otherwise each invite). Holds passwords of throw-away `@example.test` users of the local QA stack only.
 */
export const USER_POOL_FILE = join(process.env.E2E_RESULTS_DIR ?? 'F:/App/qa-results', 'user-pool-phase03.json');

type Pool = Record<string, PoolUser>;

const readPool = (): Pool => readJsonFile<Pool>(USER_POOL_FILE);

/** Merges `changes` into the file as it is NOW (other worker processes add slots too), under a lock; see poolFile.ts. */
const writePool = (changes: Pool): void => mergeWriteJsonFile(USER_POOL_FILE, changes);

/**
 * `true` while `user` still exists: #39 `GET /api/users/:id/memberships` (admin, no rate limit) answers 404 for a
 * soft-deleted user or a reset stack (BE users/service.py:249-252). #38 is capped and oldest-first, so not used.
 */
async function stillActive(admin: APIRequestContext, user: PoolUser): Promise<boolean> {
  const res = await admin.get(`/api/users/${user.id}/memberships`);
  if (res.status() === 404) return false;
  expect(res.status(), 'setup: GET /api/users/:id/memberships (pool check, admin only)').toBe(200);
  return true;
}

/** Admin invites a run-unique address with `role`, reads the real mail in Mailpit, accepts with a fresh password. */
async function inviteAndAccept(admin: APIRequestContext, role: PoolRole, slot: string): Promise<PoolUser> {
  const email = testEmail(`pool-${role}-${slot}`);
  const name = `${TEST_DATA_PREFIX}pool ${role} ${slot}`;
  const since = new Date(Date.now() - 5_000);
  const invite = async (inviter: APIRequestContext): Promise<Answer> => {
    const res = await inviter.post('/api/users/invitations', { data: { emails: [email], role } });
    return { status: res.status(), text: await res.text() };
  };
  // BE: 30 invitations / h PER INVITING USER (users/router.py:32-41) -> on 429 let another active pool admin invite.
  const sent = await inviteWithFallback(
    () => invite(admin),
    Object.values(readPool())
      .filter((u) => u.role === 'admin')
      .map((u) => async (): Promise<Answer | null> => {
        if (!(await stillActive(admin, u))) return null;
        const other = await signedInApi(u.email, u.password);
        try {
          return await invite(other);
        } finally {
          await other.dispose();
        }
      }),
  );
  expect(sent.status, `setup: POST /api/users/invitations (${role}): ${sent.text.slice(0, 200)}`).toBe(201);
  const rows = JSON.parse(sent.text) as unknown[];
  const id = rows.map((row) => asJson(row, 'invited')).find((row) => row.email === email)?.id;
  if (typeof id !== 'string') throw new Error(`setup: invitation answer has no row for ${email}`);
  const mail = await waitForMail(email, since, 30_000, INVITE_SUBJECT);
  try {
    // `{PUBLIC_BASE_URL}/login/invitation#token=…` (BE:auth_recovery/messages.py).
    const token = new URLSearchParams(new URL(linkFrom(mail, '/login/invitation')).hash.slice(1)).get('token');
    if (!token) throw new Error(`setup: mail "${mail.subject}" link has no #token`);
    const password = `Qa-${randomUUID()}`;
    const anon = await newApiContext();
    try {
      const accepted = await anon.post('/api/auth/invitations/accept', { data: { token, fullName: name, password } });
      expect(accepted.status(), 'setup: POST /api/auth/invitations/accept').toBe(204);
    } finally {
      await anon.dispose();
    }
    return { id, email, password, role, name };
  } finally {
    await deleteMails([mail.id]);
  }
}

/**
 * Active user of `role` for `slot` from the pool file; invites + accepts only when the slot is empty or stale.
 * Use a distinct `slot` per upload-heavy file (own drawings_init bucket); default 'shared'.
 */
export async function poolUser(admin: APIRequestContext, role: PoolRole, slot = 'shared'): Promise<PoolUser> {
  const key = `${role}:${slot}`;
  const cached = readPool()[key];
  if (cached && (await stillActive(admin, cached))) return cached;
  const fresh = await inviteAndAccept(admin, role, slot);
  writePool({ [key]: fresh });
  return fresh;
}

/** Browser session of `user` in `context`: one `POST /api/auth/login` through the context's own cookie jar. */
export async function signInPoolUser(context: BrowserContext, user: PoolUser): Promise<void> {
  const login = async (who: PoolUser): Promise<number> =>
    (
      await context.request.post('/api/auth/login', {
        data: { email: who.email, password: who.password, rememberMe: false },
        headers: { Origin: apiBaseUrl() },
      })
    ).status();
  // 401 for a cached slot = stale password (RF p07: a password flow changed it, restore failed) -> fresh user for the slot.
  const key = user.id === '' ? undefined : Object.keys(readPool()).find((k) => readPool()[k]?.id === user.id);
  const refresh =
    key === undefined
      ? null
      : async (): Promise<PoolUser> => {
          const { email, password } = readAdminCredentials();
          const admin = await signedInApi(email, password);
          try {
            const fresh = await inviteAndAccept(admin, user.role, key.slice(key.indexOf(':') + 1));
            writePool({ [key]: fresh });
            return fresh;
          } finally {
            await admin.dispose();
          }
        };
  const done = await loginOrRefresh(user, login, refresh);
  expect(done.status, `setup: POST /api/auth/login as pool ${user.role}`).toBe(204);
  // The caller keeps using its `user` object (e.g. its password as the "old" one): make it the fresh one.
  if (done.user !== user) Object.assign(user, done.user);
}

/** N3 `POST /api/projects/:id/members {email}` → 201 (BE project_members/router.py:42-70); no project role exists. */
export async function addProjectMember(admin: APIRequestContext, projectId: string, email: string): Promise<void> {
  const res = await admin.post(`${PROJECTS}/${projectId}/members`, { data: { email } });
  expect(res.status(), `setup: POST ${PROJECTS}/${projectId}/members: ${(await res.text()).slice(0, 200)}`).toBe(201);
}

/** N4 `DELETE /api/projects/:id/members/:userId`; 200 / 404 are fine, anything else is returned, never thrown. */
export async function removeProjectMember(admin: APIRequestContext, projectId: string, userId: string): Promise<string | null> {
  const res = await admin.delete(`${PROJECTS}/${projectId}/members/${userId}`);
  return res.status() === 200 || res.status() === 404 ? null : `DELETE members/${userId} → ${String(res.status())}`;
}

/** Coordinator cleanup after the phase: soft-deletes every pool user (`DELETE /api/users/:id`) and removes the pool file. */
export async function releasePoolUsers(admin: APIRequestContext): Promise<string[]> {
  const problems: string[] = [];
  for (const user of Object.values(readPool())) {
    const res = await admin.delete(`/api/users/${user.id}`, { data: { userId: user.id, confirmEmail: user.email } });
    if (res.status() !== 200 && res.status() !== 404) problems.push(`DELETE /api/users/${user.id} → ${String(res.status())}`);
  }
  if (problems.length === 0) rmSync(USER_POOL_FILE, { force: true });
  return problems;
}
