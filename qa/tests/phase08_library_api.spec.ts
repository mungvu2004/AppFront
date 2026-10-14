/**
 * Phase 8 - SCR-34 BE API `/api/library` (FL-B08U-08, QA-08 P10). One flow, ten steps, API only (no UI).
 * Source: BE apps/api/library/{router,service,schemas,settings}.py (router.py:17-28, service.py:24-90, schemas.py:1-28,
 * settings.py:18); FE zod `src/api/schemas/library.ts` (LibraryItemSchema, strict).
 *
 * ## Users
 * The library has no role gate (router.py:1-4), so the flow reads as the shared read-only pool users `p08-eng` (engineer)
 * and `p08-view` (viewer) (packs.md "Quyet dinh S2" 1) and anonymous. The admin seed is only used to look the pool up.
 *
 * ## Request budget
 * - `POST /api/auth/login` (120 / 60 s per IP): 1 admin + 2 pool users = 3.
 * - `POST /api/users/invitations`: 0 (shared slots exist; the very first fill of each = 1 from the admin seed).
 * - `GET /api/library` 6, `GET /api/library/{id}` 8, 1 signed model download. No writes, no rate-limited route.
 */
import { expect, request as pwRequest, test, type APIRequestContext, type APIResponse } from '@playwright/test';

import { LibraryItemSchema } from '../../src/api/schemas/library';
import { captureExchange, newApiContext, signedInApi } from './support/api';
import { readAdminCredentials } from './support/auth';
import { poolUser } from './support/phase03Seed';

type Json = Record<string, unknown>;

const LIBRARY_LIST_MAX = 500; // BE settings.py:18
const FIELDS = ['id', 'name', 'group', 'source', 'widthMm', 'depthMm', 'heightMm', 'triangleCount', 'fileSizeBytes', 'modelUrl'] as const; // schemas.py:1-28

/** Signed URLs are bearer links: the query string (signature) is cut before the exchange is written to evidence. */
function redacted(res: APIResponse, text: string): APIResponse {
  const clean = text.replace(/("(?:modelUrl|previewUrl)"\s*:\s*"[^"?]*)\?[^"]*"/gu, '$1?<signature redacted>"');
  return { status: () => res.status(), headers: () => res.headers(), text: async () => clean } as unknown as APIResponse;
}

async function exchange(api: APIRequestContext, name: string, path: string, assertions: readonly string[]): Promise<{ res: APIResponse; body: unknown }> {
  const res = await api.get(path);
  const text = await res.text();
  let body: unknown = null;
  try {
    body = text === '' ? null : JSON.parse(text);
  } catch {
    body = text;
  }
  await captureExchange(name, { method: 'GET', path }, redacted(res, text), assertions);
  return { res, body };
}

const errorOf = (body: unknown): Json => {
  const record = (body ?? {}) as Json;
  return (typeof record.error === 'object' && record.error !== null ? record.error : record) as Json;
};

test.describe('A08 phase-8 library API', () => {
  test('SCR-34 · FL-B08U-08 · Library read contract and gate', async () => {
    test.setTimeout(120_000);
    const apis: APIRequestContext[] = [];
    const anon = await newApiContext();
    const bare = await pwRequest.newContext();
    apis.push(anon, bare);
    try {
      const { email, password } = readAdminCredentials();
      const admin = await signedInApi(email, password);
      apis.push(admin);
      const eng = await poolUser(admin, 'engineer', 'p08-eng');
      const view = await poolUser(admin, 'viewer', 'p08-view');
      const engApi = await signedInApi(eng.email, eng.password);
      const viewApi = await signedInApi(view.email, view.password);
      apis.push(engApi, viewApi);

      let items: Json[] = [];

      await test.step('[B08U-G-074] #14 GET /api/library decode', async () => {
        // schemas.py:1-28
        const list = await exchange(engApi, 'A08_B08U-G-074_library_list.json', '/api/library', ['200 bare array of LibraryItem', 'no furnitureKind/ownerId/publishedAt', 'absolute URLs']);
        expect(list.res.status()).toBe(200);
        expect(Array.isArray(list.body), 'bare array, not an envelope').toBe(true);
        items = list.body as Json[];
        expect(items.length, 'environment: library has at least one item').toBeGreaterThan(0);
        for (const item of items) {
          expect(LibraryItemSchema.safeParse(item).success, `FE LibraryItemSchema decodes ${String(item.id)}`).toBe(true);
          for (const key of FIELDS) expect(item, `field ${key}`).toHaveProperty(key);
          for (const key of ['furnitureKind', 'ownerId', 'publishedAt']) expect(item).not.toHaveProperty(key);
          expect(String(item.modelUrl)).toMatch(/^https?:\/\//u);
          if (item.previewUrl !== undefined) expect(String(item.previewUrl)).toMatch(/^https?:\/\//u);
        }
      });

      await test.step('[B08U-G-075] #14 length <= 500', async () => {
        // settings.py:18
        expect.soft(items.length, `<= LIBRARY_LIST_MAX (${String(LIBRARY_LIST_MAX)})`).toBeLessThanOrEqual(LIBRARY_LIST_MAX);
      });

      await test.step('[B08U-G-076] #14 model URL downloadable', async () => {
        const first = items[0];
        expect(first, 'environment: an item to download').toBeDefined();
        const dl = await bare.get(String(first?.modelUrl));
        expect.soft(dl.status(), 'GET modelUrl').toBe(200);
        expect.soft(dl.headers()['content-disposition'] ?? '', 'content-disposition').toMatch(/^attachment/iu);
        expect.soft((await dl.body()).subarray(0, 4).toString('latin1'), 'glTF magic').toBe('glTF');
        await test.info().attach('A08_B08U-G-076_model_download.json', {
          body: JSON.stringify({ status: dl.status(), contentDisposition: dl.headers()['content-disposition'] ?? null }),
          contentType: 'application/json',
        });
      });

      await test.step('[B08U-G-077] #14 previewUrl absent not null', async () => {
        // W2
        const without = items.filter((i) => i.previewUrl === undefined);
        for (const item of items) expect.soft(item.previewUrl, `previewUrl of ${String(item.id)} is never null`).not.toBeNull();
        for (const item of without) expect.soft(Object.keys(item), `no previewUrl key on ${String(item.id)}`).not.toContain('previewUrl');
        await test.info().attach('A08_B08U-G-077_library_preview.json', {
          body: JSON.stringify({ items: items.length, withoutPreview: without.length }),
          contentType: 'application/json',
        });
      });

      await test.step('[B08U-G-083] #15 detail equals list row', async () => {
        const row = items[0] ?? {};
        const d = await exchange(engApi, 'A08_B08U-G-083_library_detail.json', `/api/library/${String(row.id)}`, ['200 same fields as list row (URLs re-signed)']);
        expect.soft(d.res.status()).toBe(200);
        const detail = d.body as Json;
        const strip = ({ modelUrl: _m, previewUrl: _p, ...rest }: Json): Json => rest;
        expect.soft(strip(detail)).toEqual(strip(row));
        expect.soft(Object.keys(detail).sort()).toEqual(Object.keys(row).sort());
        for (const key of ['widthMm', 'depthMm', 'heightMm', 'triangleCount', 'fileSizeBytes']) expect.soft(Number(detail[key]), key).toBeGreaterThan(0);
      });

      await test.step('[B08U-G-084] #15 malformed id', async () => {
        // service.py:83-84
        for (const [index, id] of ['A', 'a_b', 'a'.repeat(65)].entries()) {
          const r = await exchange(engApi, `A08_B08U-G-084_library_bad_${String(index)}.json`, `/api/library/${id}`, ['404 NOT_FOUND resource libraryItem']);
          expect.soft(r.res.status(), `id #${String(index)}`).toBe(404);
          expect.soft(errorOf(r.body).code).toBe('NOT_FOUND');
          expect.soft(errorOf(r.body).resource).toBe('libraryItem');
        }
      });

      await test.step('[B08U-G-085] #15 well-formed unknown id', async () => {
        const r = await exchange(engApi, 'A08_B08U-G-085_library_unknown.json', '/api/library/qa08-no-such-item', ['404 libraryItem']);
        expect.soft(r.res.status()).toBe(404);
        expect.soft(errorOf(r.body).code).toBe('NOT_FOUND');
        expect.soft(errorOf(r.body).resource).toBe('libraryItem');
      });

      await test.step('[B08U-G-088] #14 anonymous', async () => {
        const r = await exchange(anon, 'A08_B08U-G-088_library_list_anon.json', '/api/library', ['401 UNAUTHENTICATED']);
        expect.soft(r.res.status()).toBe(401);
        expect.soft(errorOf(r.body).code).toBe('UNAUTHENTICATED');
      });

      await test.step('[B08U-G-089] #15 anonymous', async () => {
        const r = await exchange(anon, 'A08_B08U-G-089_library_item_anon.json', `/api/library/${String(items[0]?.id ?? 'qa08-x')}`, ['401 UNAUTHENTICATED']);
        expect.soft(r.res.status()).toBe(401);
        expect.soft(errorOf(r.body).code).toBe('UNAUTHENTICATED');
      });

      await test.step('[B08U-G-090] #14 + #15 any signed-in role', async () => {
        // library/router.py:1-4 - no role gate
        for (const [role, api] of [['viewer', viewApi], ['engineer', engApi]] as const) {
          const l = await exchange(api, `A08_B08U-G-090_library_list_${role}.json`, '/api/library', [`${role} -> 200`]);
          expect.soft(l.res.status(), `${role} list`).toBe(200);
          const d = await exchange(api, `A08_B08U-G-090_library_item_${role}.json`, `/api/library/${String(items[0]?.id)}`, [`${role} -> 200`]);
          expect.soft(d.res.status(), `${role} detail`).toBe(200);
        }
      });
    } finally {
      for (const api of apis) await api.dispose();
    }
  });
});
