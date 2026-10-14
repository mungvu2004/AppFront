/**
 * P13 helpers - phase 09 BE role matrix (viewer / admin control / outsider). API only, no browser.
 * Codes: BE access/deps.py:41-43 `gate` -> 403 FORBIDDEN (no resource); projects/access.py:91 -> 404 NOT_FOUND resource `project`;
 * projects/access.py:99 -> 403 FORBIDDEN for a member lacking the permission. Error body = {code, requestId, ...} (core/errors.py:84).
 */
import { expect, type APIRequestContext, type APIResponse } from '@playwright/test';

import { apiBaseUrl } from '../api';
import { attachJson } from '../evidence';
import { addProjectMember, createProject, deleteSeededProject, removeProjectMember, type PoolUser } from '../phase03Seed';
import { requireState } from '../state';
import { adminApi, apiAs, asMember, mainProject, roleUser } from './roles';

export type Method = 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';
/** Well-formed fake ULID/uuid for path ids that must not resolve (the gate runs before any lookup). */
export const FAKE_ID = '00000000-0000-4000-8000-000000000000';

const bodyOf = async (res: APIResponse): Promise<{ code?: string; resource?: string }> => {
  try {
    return (await res.json()) as { code?: string; resource?: string };
  } catch {
    return {};
  }
};

export interface Expected {
  status: number;
  code?: string;
  resource?: string;
  data?: unknown;
  /** false = hard `expect` (step H) */
  soft?: boolean;
  /** `<row id>_<slug>` -> attachment `A09_<ev>.json` */
  ev: string;
}

// dup-of: P12 expectDenied
export async function expectDenied(ctx: APIRequestContext, method: Method, path: string, e: Expected): Promise<void> {
  const data = e.data ?? (method === 'GET' ? undefined : {});
  const res = await ctx.fetch(path, { method, ...(data === undefined ? {} : { data }) });
  const body = await bodyOf(res);
  await attachJson(`A09_${e.ev}.json`, { method, path, status: res.status(), code: body.code ?? null, resource: body.resource ?? null });
  const ex = e.soft === false ? expect : expect.soft;
  ex(res.status(), `${method} ${path}`).toBe(e.status);
  if (e.code !== undefined) ex(body.code, `${method} ${path} code`).toBe(e.code);
  if (e.resource !== undefined) ex(body.resource, `${method} ${path} resource`).toBe(e.resource);
}

/**
 * Positive control: status in `statuses` (default [200]) and never 401/403. A fake path id may legitimately give 404 -
 * pass [200, 404] there; the point is that the role gate lets the call through.
 */
export async function expectOpen(ctx: APIRequestContext, path: string, ev: string, opts: { statuses?: number[]; soft?: boolean } = {}): Promise<void> {
  const res = await ctx.get(path, { timeout: 15_000 });
  const code = (await bodyOf(res)).code ?? null;
  await attachJson(`A09_${ev}.json`, { method: 'GET', path, status: res.status(), code });
  const ex = opts.soft === false ? expect : expect.soft;
  ex(opts.statuses ?? [200], `GET ${path} -> ${String(res.status())} ${String(code)}`).toContain(res.status());
  ex([401, 403]).not.toContain(res.status());
}

export interface ViewerSeed {
  admin: APIRequestContext;
  viewer: PoolUser;
  viewerApi: APIRequestContext;
  projectId: string;
  floorId: string;
  versionId: string;
  cleanup: () => Promise<void>;
}

/** Own project + 1 floor; viewer pool user `p09-authz-viewer` added as member (removed in cleanup). */
export async function seedViewerProject(): Promise<ViewerSeed> {
  const admin = await adminApi();
  const seeded = await createProject(admin, 'p09-authz', 1);
  const cleanup = async (viewer?: PoolUser): Promise<void> => {
    if (viewer) await removeProjectMember(admin, seeded.projectId, viewer.id);
    await deleteSeededProject(admin, seeded.projectId);
  };
  let viewer: PoolUser | undefined;
  try {
    viewer = await roleUser(admin, 'viewer', 'authz-b');
    await addProjectMember(admin, seeded.projectId, viewer.email);
    const viewerApi = await apiAs(viewer);
    const list = await admin.get(`/api/projects/${seeded.projectId}/versions`);
    const items = list.ok() ? (((await list.json()) as { items?: { id?: string }[] }).items ?? []) : [];
    const member = viewer;
    return {
      admin,
      viewer: member,
      viewerApi,
      projectId: seeded.projectId,
      floorId: seeded.floors[0]?.id ?? FAKE_ID,
      // UNKNOWN - NEED VERIFICATION: a fresh floor may have no version row; then FAKE_ID (version steps accept 404).
      versionId: items[0]?.id ?? FAKE_ID,
      cleanup: () => cleanup(member),
    };
  } catch (error) {
    await cleanup(viewer);
    throw error;
  }
}

/**
 * Positive reads on the main chain project (real floor / version / upload): viewer added as member, undo in cleanup.
 * Hard-fails when the main chain has no version (no fake ids: 404 would prove nothing).
 */
export async function seedMainViewer(): Promise<ViewerSeed & { uploadId: string }> {
  const admin = await adminApi();
  const { projectId, workFloorId } = mainProject();
  const uploadId = requireState((s) => s.checkpoints.uploadId, 'checkpoints.uploadId', 'Phase 3 (upload complete)');
  const viewer = await roleUser(admin, 'viewer', 'authz-b');
  const undo = await asMember(admin, projectId, viewer);
  try {
    const viewerApi = await apiAs(viewer);
    const list = await admin.get(`/api/projects/${projectId}/versions`);
    expect(list.status(), 'setup: GET versions on main project').toBe(200);
    const versionId = ((await list.json()) as { items?: { id?: string }[] }).items?.[0]?.id;
    expect(versionId, 'setup: main project has a version').toBeTruthy();
    return { admin, viewer, viewerApi, projectId, floorId: workFloorId, versionId: String(versionId), uploadId, cleanup: undo };
  } catch (error) {
    await undo();
    throw error;
  }
}

/** First row id of an admin list endpoint (array or `{items}` body); null when the list is empty or not 200. */
export async function firstId(ctx: APIRequestContext, listPath: string): Promise<string | null> {
  const res = await ctx.get(listPath);
  if (res.status() !== 200) return null;
  const body = (await res.json()) as { items?: { id?: string }[] } | { id?: string }[];
  const rows = Array.isArray(body) ? body : (body.items ?? []);
  return rows[0]?.id ?? null;
}

/** Valid-shaped ids (`<prefix>_<ULID>`, packages/core/ids.py:74-78) that match no row. */
export const FAKE_UPLOAD_ID = 'upl_01ARZ3NDEKTSV4RRFFQ69G5FAV';

/**
 * GET an SSE route with the `appback_stream` cookie (auth/cookies.py:13-14, streams/sse.py:161-169) and read only
 * status + error body, then drop the stream (Playwright's request would wait for the stream to end).
 */
export async function probeStream(ctx: APIRequestContext, path: string): Promise<{ status: number; code?: string; resource?: string }> {
  const cookie = (await ctx.storageState()).cookies.find((c) => c.name === 'appback_stream');
  expect(cookie, 'setup: signed-in context holds the appback_stream cookie').toBeTruthy();
  const origin = new URL(apiBaseUrl()).origin;
  const abort = new AbortController();
  const res = await fetch(`${origin}${path}`, {
    headers: { cookie: `appback_stream=${String(cookie?.value)}`, origin, accept: 'text/event-stream' },
    signal: abort.signal,
  });
  const out: { status: number; code?: string; resource?: string } = { status: res.status };
  if (res.status === 200) abort.abort();
  else Object.assign(out, (await res.json()) as object);
  await attachJson(`A09_probe_${path.split('/').pop() ?? 'stream'}_${String(res.status)}.json`, { path, ...out });
  return out;
}
