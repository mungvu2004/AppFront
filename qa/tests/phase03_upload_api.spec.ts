/**
 * Phase 3 — BE2 lifecycle flows through the REAL API (QA-03d P12, skill `qa-api-test`): upload init / chunks /
 * complete, #8 progress, the S1 stream, worker outcomes of crafted pages, #30 / #31 / #32 quality writes, N7, N16.
 * One `test()` per flow of `flow-plan.md` (`phase03_upload_api.spec.ts`), one `test.step('[<row id>] …')` per catalog
 * row, in the planned order. No browser page, no mocks (FL-A2-08 only uses the browser to rotate a PNG).
 * Rows already asserted by `phase03_pipeline_api.spec.ts` are not repeated (api-author-map.md).
 * Helpers: `support/p03/P12.ts`; seeds and pool users: `support/phase03Seed.ts`. `BE:` = `F:/App/AppBack` main 2ee030c5.
 *
 * ## Non-serial, own data, parallel-safe (--workers N runs files side by side)
 * Every flow signs in on its own, creates its own project and deletes it in `finally`. Pool users live in P12's
 * OWN slots: `engineer:p12-up-owner` (every upload), `engineer:p12-up-member` (FL-A2-01 second uploader, FL-A2-06
 * removed / disabled member — re-enabled in cleanup and by `p12User`), `engineer:p12-up-budget` (FL-A2-07 only).
 *
 * ## Real-backend budget per run of this file
 * - `drawings_init` per user per 600 s (BE default 60; QA stack 300 = E2E_DRAWINGS_INIT_RATE_LIMIT):
 *   `p12-up-owner` ≈ 44 (A2-01 19, A2-02 11, A2-03 2, A2-04 2, A2-05 4, A2-06 1, A2-08 1, A2-09 2, A2-10 1; inits refused
 *   by the 1 MiB body ceiling are not counted, every 422 after the gate is), `p12-up-member` 1, `p12-up-budget`
 *   INIT_LIMIT + 1 (bucket burnt on purpose: a re-run of FL-A2-07 inside 600 s fails at its first init — wait 10 min).
 *   The admin spends none.
 * - `POST /api/auth/login` (120 / 60 s): ≈ 25 (admin + owner per flow, + member / second session / viewer where used).
 * - `POST /api/users/invitations` (30 / 3600 s per admin): 0 once the slots are filled; first run ever 4 (the three P12
 *   slots + `viewer:shared`, which other phase-03 files fill too).
 * - `members_add` (60 / 3600 s per actor): `p12-up-owner` 4. #42 / #43 disable / enable: admin 1 + 1.
 * - Pipeline worker (fake ML): ≈ 25 runs (A2-02 7 superseding each other on one floor, A2-03 2, A2-04 2, A2-05 4,
 *   A2-08 2, A2-09 7 incl. the two BE2-G-139 rhombus runs left running, A2-10 1); the real 121 s wait of BE2-G-027
 *   dominates FL-A2-01. #35 scale writes: A2-03 2.
 * - SSE: ≤ 7 concurrent streams of `p12-up-owner` (FL-A2-06, the 7th is the 429 precondition; A2-03's resume stream is
 *   opened after its live one closed); `viewer:shared` 1 for ~17 s (A2-10); nginx limit_conn 30 / IP.
 * - QA-03i added A2-01 BE2-G-006 / 008 / 009 / 020 / 029 / 054, A2-03 BE2-G-194 / 126, A2-09 BE2-G-139 and FL-A2-10
 *   (`BE:` main 4633e479 for these). #27 is admin-only (BUG-513): `ownProject`'s cleanup adds the admin and the admin
 *   deletes (`deleteSeededProject`), +1 members_add and +1 admin login per engineer-owned project.
 */
import { expect, test, type APIRequestContext } from '@playwright/test';

import { PIPELINE_TIMEOUT_MS } from '../../e2e/fullstack/env';
import { newApiContext, signedInApi } from './support/api';
import {
  CORNERS_C1,
  FULL_PAGE,
  Cleanup,
  INIT_LIMIT,
  JSON_CT,
  PIPELINE_STEPS,
  PREFIX,
  STREAM_CLOSE_MS,
  STREAM_HEARTBEAT_S,
  STREAM_MAX_PER_USER,
  SYNTHETIC_ANSWER,
  SseConn,
  UPLOAD_MAX_BYTES,
  addFloor,
  addMember,
  adminApi,
  asArray,
  asJson,
  call,
  captureStream,
  chunksOf,
  completeUpload,
  disableUser,
  drawingPng,
  errBody,
  expectError,
  finishedUpload,
  framedPng,
  initBody,
  initPath,
  initUpload,
  latestItems,
  layerPath,
  makePdf,
  newLevelId,
  noisePng,
  note,
  ownProject,
  p12User,
  pdfEofFarFromEnd,
  progressOf,
  progressPath,
  qualityPath,
  rc4UserPasswordPdf,
  receivingUpload,
  rgbaPng,
  sendChunk,
  settingsBody,
  sleep,
  smallPng,
  streamCookieOf,
  streamPath,
  syntheticPage,
  tinyJpeg,
  uniq,
  userApi,
  waitFinal,
  type Json,
  type Sent,
  type SseFrame,
} from './support/p03/P12';
import {
  corruptPng,
  createSkewedDrawingProject,
  framelessPng,
  deleteSeededProject,
  oversizePng,
  poolUser,
  rotatedPng,
  SKEW_DEG,
  waitForQualityFindings,
} from './support/phase03Seed';

const SLOT_OWNER = 'p12-up-owner';
const SLOT_MEMBER = 'p12-up-member';
const SLOT_BUDGET = 'p12-up-budget';
const isFinal = (f: SseFrame): boolean => f.data.status === 'completed' || f.data.status === 'failed';

async function owner(cleanup: Cleanup): Promise<{ admin: APIRequestContext; e1: APIRequestContext; user: Awaited<ReturnType<typeof p12User>> }> {
  const admin = await adminApi(cleanup);
  const user = await p12User(admin, 'engineer', SLOT_OWNER);
  return { admin, e1: await userApi(user, cleanup), user };
}

/** init → every chunk → #7; returns the upload id and the #7 exchange (evidence `A03_<ev>_complete`). */
async function uploadAndComplete(
  api: APIRequestContext, ev: string, pid: string, fid: string, bytes: Buffer, fileName: string, mimeType: string, claim: string,
): Promise<{ readonly uid: string; readonly done: Sent }> {
  const uid = await receivingUpload(api, ev, pid, fid, bytes, fileName, mimeType);
  return { uid, done: await completeUpload(api, `${ev}_complete`, pid, uid, [claim]) };
}

/** #30 entry of `fid` (soft: undefined when missing). */
async function qualityEntry(api: APIRequestContext, ev: string, pid: string, fid: string): Promise<Json | undefined> {
  const sent = await call(api, ev, 'GET', qualityPath(pid, fid), undefined, ['200 QualityAssessmentOut (quality/assessments.py:221-279)']);
  expect.soft(sent.res.status()).toBe(200);
  return asArray(asJson(sent.body).floors ?? []).map((f) => asJson(f)).find((f) => f.floorId === fid);
}

const dims = (entry: Json | undefined): [unknown, unknown] => {
  const m = errBody(entry?.measurement);
  return [m.widthPx, m.heightPx];
};

test.describe('A03 · phase-3 BE2 lifecycles (upload, pipeline, stream, quality) — QA-03d P12', () => {
  test('FL-A2-01 · BE2 · init rules: size cap edge, parallel and variant inits, chunk body guards, W21 floorId, fileName / mimeType limits, idempotency keys on #5 and #6, dedupe window expiry', async () => {
    test.setTimeout(270_000);
    const cleanup = new Cleanup();
    try {
      const { admin, e1 } = await owner(cleanup);
      const member = await p12User(admin, 'engineer', SLOT_MEMBER);
      const e2 = await userApi(member, cleanup);
      const project = await ownProject(e1, 'FL-A2-01', cleanup, ['T1']);
      const pid = project.id;
      const fid = project.floors[0] as string;
      await addMember(e1, 'FL-A2-01_setup_add_e2', pid, member.email);
      const I = initBody(pid, fid, { fileName: `${PREFIX}a2-01-I.pdf`, mimeType: 'application/pdf', sizeBytes: 4096 });
      let capUid = '';
      let iUid = '';
      let windowFrom = 0;

      await test.step('[BE2-G-032] POST init with a 1 MiB + 1 byte JSON body → 413 PAYLOAD_TOO_LARGE (body ceiling, before auth)', async () => {
        const size = 1024 * 1024 + 1;
        const body = `{"x":"${'a'.repeat(size - 8)}"}`;
        const sent = await call(e1, 'BE2-G-032_init_1mib_plus1_413', 'POST', initPath(pid, fid), body, [
          '413 PAYLOAD_TOO_LARGE: 1 048 577 bytes > the 1 MiB body ceiling (core/routing.py:46), read before auth / the limiter',
        ], JSON_CT);
        expectError(sent, 413, 'PAYLOAD_TOO_LARGE');
      });

      await test.step('[BE2-G-012] init sizeBytes 104 857 600 → 200 Progress pending; 104 857 601 → 413 PAYLOAD_TOO_LARGE', async () => {
        const cap = await initUpload(e1, 'BE2-G-012_init_cap_200', pid, fid, { fileName: `${PREFIX}cap.png`, sizeBytes: UPLOAD_MAX_BYTES }, [
          '200 Progress pending: exactly UPLOAD_MAX_BYTES is accepted (drawings/uploads.py:195-196, settings.py:18)',
        ]);
        expect.soft(cap.res.status()).toBe(200);
        expect.soft(asJson(cap.body).status).toBe('pending');
        capUid = String(asJson(cap.body).id);
        const over = await initUpload(e1, 'BE2-G-012_init_cap_plus1_413', pid, fid, { fileName: `${PREFIX}cap1.png`, sizeBytes: UPLOAD_MAX_BYTES + 1 }, [
          '413 PAYLOAD_TOO_LARGE: one byte over the cap',
        ]);
        expectError(over, 413, 'PAYLOAD_TOO_LARGE');
      });

      await test.step('[BE2-G-025] two identical inits (body I) in parallel → both 200 with ONE upload id (floor row lock); the dedupe window starts', async () => {
        const [first, second] = await Promise.all([
          call(e1, 'BE2-G-025_init_parallel_a_200', 'POST', initPath(pid, fid), I, ['200 Progress pending']),
          call(e1, 'BE2-G-025_init_parallel_b_200', 'POST', initPath(pid, fid), I, ['200 the SAME id: the 2nd waits on the floor lock and finds the twin (uploads.py:144-171,190)']),
        ]);
        windowFrom = Date.now();
        expect(first.res.status(), 'parallel init a').toBe(200);
        expect(second.res.status(), 'parallel init b').toBe(200);
        iUid = String(asJson(first.body).id);
        expect(asJson(second.body).id, 'one upload for two identical parallel inits').toBe(iUid);
      });

      await test.step('[BE2-G-026] init = I but other sizeBytes / mimeType "" / pageIndex 1 → a new id each; E2 sends I → a new id (dedupe is per user)', async () => {
        const variants: Array<[string, Json]> = [
          ['size', { ...I, sizeBytes: 4097 }],
          ['mime_blank', { ...I, mimeType: '' }],
          ['page_index', { ...I, pageIndex: 1 }],
        ];
        const ids = new Set<string>([iUid]);
        for (const [slug, body] of variants) {
          const sent = await call(e1, `BE2-G-026_init_${slug}_200`, 'POST', initPath(pid, fid), body, [
            `200 a NEW upload: "${slug}" is part of the twin key (uploads.py:156-166)`,
          ]);
          expect.soft(sent.res.status()).toBe(200);
          ids.add(String(asJson(sent.body).id));
        }
        const other = await call(e2, 'BE2-G-026_init_other_user_200', 'POST', initPath(pid, fid), I, ['200 a NEW upload: created_by is part of the twin key']);
        expect.soft(other.res.status()).toBe(200);
        ids.add(String(asJson(other.body).id));
        expect.soft(ids.size, 'I + 3 variants + E2 = 5 distinct uploads').toBe(5);
      });

      await test.step('[BE2-G-049] chunk on the cap upload with an extra key sha256 → 422 VALIDATION field sha256 (no client hash in the contract)', async () => {
        const sent = await call(e1, 'BE2-G-049_chunk_sha256_422', 'POST', `/api/projects/${pid}/drawings/uploads/${capUid}/chunks`, {
          chunk: 'AAAA', chunkIndex: 0, sha256: 'ab'.repeat(32),
        }, ['422 VALIDATION field sha256: UploadChunkBody extra="forbid" (drawings/schemas.py:69-73); the server hashes itself (uploads.py:291)']);
        expectError(sent, 422, 'VALIDATION', { field: 'sha256' });
      });

      await test.step('[BE2-G-052] chunk body uploadId ≠ path uploadId → 422 PATH_BODY_MISMATCH field uploadId (W21)', async () => {
        const sent = await call(e1, 'BE2-G-052_chunk_upload_id_mismatch_422', 'POST', `/api/projects/${pid}/drawings/uploads/${capUid}/chunks`, {
          chunk: 'AAAA', chunkIndex: 0, uploadId: iUid,
        }, ['422 PATH_BODY_MISMATCH field uploadId: the W21 guard compares every path key the body declares (core/routing.py:138-151), before Pydantic']);
        expectError(sent, 422, 'PATH_BODY_MISMATCH', { field: 'uploadId' });
      });

      await test.step('[BE2-G-006] init body floorId ≠ path floor → 422 PATH_BODY_MISMATCH field floorId (W21)', async () => {
        const sent = await initUpload(e1, 'BE2-G-006_init_floor_id_mismatch_422', pid, fid, { floorId: newLevelId() }, [
          '422 PATH_BODY_MISMATCH field floorId: the W21 guard compares every path key the body declares (core/routing.py:138-151)',
        ]);
        expectError(sent, 422, 'PATH_BODY_MISMATCH', { field: 'floorId' });
      });

      await test.step('[BE2-G-008] fileName blank after trim → 422 field fileName; 256 code points after NFC (512 NFD) → 422 fileName; 255 after NFC → 200', async () => {
        // clean_file_name: clean_text (strip + NFC) THEN 1..255 (drawings/schemas.py:34-52, packages/core/text.py:34-46).
        const nfd = (n: number): string => 'e\u0301'.repeat(n); // "é" decomposed: 2 code points → 1 after NFC
        const cases: Array<[string, string]> = [
          ['blank', '   '],
          ['nfc_256', `${nfd(252)}.png`],
        ];
        for (const [slug, fileName] of cases) {
          const sent = await initUpload(e1, `BE2-G-008_init_${slug}_422`, pid, fid, { fileName }, [
            '422 VALIDATION field fileName: the length is counted after trim + NFC (drawings/schemas.py:44-48)',
          ]);
          expectError(sent, 422, 'VALIDATION', { field: 'fileName' });
        }
        const ok = await initUpload(e1, 'BE2-G-008_init_nfc_255_200', pid, fid, { fileName: `${nfd(251)}.png` }, [
          '200 Progress pending: 506 code points sent, 255 after NFC (the limit is inclusive)',
        ]);
        expect.soft(ok.res.status()).toBe(200);
        expect.soft(asJson(ok.body).status).toBe('pending');
      });

      await test.step('[BE2-G-009] fileName with a Cc (U+0007) / a bidi override (U+202E) → 422 VALIDATION field fileName', async () => {
        for (const [slug, fileName] of [['cc_bel', `${PREFIX}a\u0007b.png`], ['rlo', `${PREFIX}a\u202Egnp.exe.png`]] as const) {
          const sent = await initUpload(e1, `BE2-G-009_init_${slug}_422`, pid, fid, { fileName }, [
            '422 VALIDATION field fileName: clean_text refuses Cc and the bidi override / isolate set (packages/core/text.py:22-46)',
          ]);
          expectError(sent, 422, 'VALIDATION', { field: 'fileName' });
        }
      });

      await test.step('[BE2-G-020] init mimeType of 256 chars → 422 VALIDATION field mimeType', async () => {
        const sent = await initUpload(e1, 'BE2-G-020_init_mime_256_422', pid, fid, { fileName: `${PREFIX}mime.png`, mimeType: `image/${'x'.repeat(250)}` }, [
          '422 VALIDATION field mimeType: max_length MIME_TYPE_MAX 255 (drawings/schemas.py:29,63)',
        ]);
        expectError(sent, 422, 'VALIDATION', { field: 'mimeType' });
      });

      let chunkUid = '';
      await test.step('[BE2-G-029] init with Idempotency-Key K → 200; same K + another body → 422 IDEMPOTENCY_KEY_REUSED; a malformed key → 422 VALIDATION field idempotencyKey', async () => {
        const key = `qa-p12-init-${uniq()}`;
        const body = initBody(pid, fid, { fileName: `${PREFIX}a2-01-key.png`, sizeBytes: 3 });
        const first = await call(e1, 'BE2-G-029_init_key_200', 'POST', initPath(pid, fid), body, ['200 Progress pending (a new upload)'], { 'Idempotency-Key': key });
        expect(first.res.status(), 'init with a key').toBe(200);
        chunkUid = String(asJson(first.body).id);
        const reused = await call(e1, 'BE2-G-029_init_same_key_other_body_422', 'POST', initPath(pid, fid), { ...body, sizeBytes: 4 }, [
          '422 IDEMPOTENCY_KEY_REUSED: same key, another request digest (core/idempotency.py:225-233)',
        ], { 'Idempotency-Key': key });
        expectError(reused, 422, 'IDEMPOTENCY_KEY_REUSED');
        const malformed = await call(e1, 'BE2-G-029_init_malformed_key_422', 'POST', initPath(pid, fid), body, [
          '422 VALIDATION field idempotencyKey: the key must match ^[A-Za-z0-9_-]{8,128}$ (core/idempotency.py:48,79-83; packages/db/models/idempotency.py:35)',
        ], { 'Idempotency-Key': 'bad key!' });
        expectError(malformed, 422, 'VALIDATION', { field: 'idempotencyKey' });
      });

      await test.step('[BE2-G-054] chunk 0 sent twice with the SAME Idempotency-Key and different bytes → 200 both (idempotency "off" on #6: no replay, no KEY_REUSED)', async () => {
        const key = `qa-p12-chunk-${uniq()}`;
        const path = `/api/projects/${pid}/drawings/uploads/${chunkUid}/chunks`;
        const a = await call(e1, 'BE2-G-054_chunk0_key_200', 'POST', path, { chunk: Buffer.from([1, 2, 3]).toString('base64'), chunkIndex: 0 }, [
          '200 Progress pending: #6 is route_options(idempotency="off"), the key is not read (drawings/router.py:70-71, core/routing.py AppRoute.uses_idempotency)',
        ], { 'Idempotency-Key': key });
        const b = await call(e1, 'BE2-G-054_chunk0_same_key_other_bytes_200', 'POST', path, { chunk: Buffer.from([4, 5, 6]).toString('base64'), chunkIndex: 0 }, [
          '200 again: another body under the same key is neither replayed nor refused; the index is overwritten (uploads.py:249-270 upsert)',
        ], { 'Idempotency-Key': key });
        for (const [what, sent] of [['first', a], ['second', b]] as const) {
          expect.soft(sent.res.status(), what).toBe(200);
          expect.soft(asJson(sent.body).id, what).toBe(chunkUid);
          expect.soft(asJson(sent.body).status, what).toBe('pending');
        }
      });

      await test.step('[BE2-G-027] at t0 + 122 s (UPLOAD_INIT_DEDUPE_S 120, server clock) init I again → 200 with a NEW upload id', async () => {
        const wait = windowFrom + 122_000 - Date.now();
        note(`BE2-G-027 waits ${String(Math.max(0, wait))} ms for the 120 s dedupe window`);
        if (wait > 0) await sleep(wait);
        const sent = await call(e1, 'BE2-G-027_init_after_window_200', 'POST', initPath(pid, fid), I, [
          '200 a NEW upload: the twin is older than UPLOAD_INIT_DEDUPE_S (uploads.py:153,165; settings.py:20)',
        ]);
        expect.soft(sent.res.status()).toBe(200);
        expect.soft(asJson(sent.body).id, 'outside the window the identical init opens a new upload').not.toBe(iUid);
      });
    } finally {
      await cleanup.run();
    }
  });

  test('FL-A2-02 · BE2 · chunk assembly and #7 branches with crafted files', async () => {
    test.setTimeout(240_000);
    const cleanup = new Cleanup();
    try {
      const { e1 } = await owner(cleanup);
      const project = await ownProject(e1, 'FL-A2-02', cleanup, ['T1']);
      const pid = project.id;
      const fid = project.floors[0] as string;

      await test.step('[BE2-G-046] 2-chunk noise PNG (> 5 MiB): chunk 1 sent before chunk 0 → 200 each; complete → 200 pending (joined by index)', async () => {
        const noise = noisePng();
        const parts = chunksOf(noise);
        expect(parts.length, 'fixture needs exactly 2 chunks').toBe(2);
        const init = await initUpload(e1, 'BE2-G-046_init', pid, fid, { fileName: `${PREFIX}noise.png`, sizeBytes: noise.length }, ['200 pending, chunk_count 2']);
        expect(init.res.status()).toBe(200);
        const uid = String(asJson(init.body).id);
        const c1 = await sendChunk(e1, 'BE2-G-046_chunk1_first_200', pid, uid, parts[1] as Buffer, 1, ['200: the last chunk may arrive first']);
        const c0 = await sendChunk(e1, 'BE2-G-046_chunk0_second_200', pid, uid, parts[0] as Buffer, 0, ['200']);
        expect(c1.res.status(), 'chunk 1 first').toBe(200);
        expect(c0.res.status(), 'chunk 0 second').toBe(200);
        const done = await completeUpload(e1, 'BE2-G-046_complete_200', pid, uid, ['200 Progress pending: #7 joins by chunk index, not arrival order (complete.py:120-125)']);
        expect(done.res.status(), 'complete joins by index').toBe(200);
        expect(asJson(done.body).status).toBe('pending');
      });

      await test.step('[BE2-G-048] 1-chunk upload: chunk 0 = text bytes, resend chunk 0 = a valid PNG → complete 200 pending (last bytes win)', async () => {
        const png = smallPng();
        const init = await initUpload(e1, 'BE2-G-048_init', pid, fid, { fileName: `${PREFIX}last-wins.png`, sizeBytes: png.length }, ['200 pending']);
        const uid = String(asJson(init.body).id);
        const text = Buffer.from('plain text, not a PNG: the first bytes would be FILE_TYPE_MISMATCH at #7', 'utf8');
        expect.soft((await sendChunk(e1, 'BE2-G-048_chunk0_text_200', pid, uid, text, 0, ['200: any bytes'])).res.status()).toBe(200);
        expect.soft((await sendChunk(e1, 'BE2-G-048_chunk0_png_200', pid, uid, png, 0, ['200: the same index overwrites (upsert, uploads.py:268)'])).res.status()).toBe(200);
        const done = await completeUpload(e1, 'BE2-G-048_complete_200', pid, uid, ['200 pending: original.* = the LAST bytes (a PNG)']);
        expect.soft(done.res.status()).toBe(200);
        expect.soft(asJson(done.body).status).toBe('pending');
      });

      await test.step('[BE2-G-062] 2-chunk upload, only chunk 1 sent → complete 422 UPLOAD_INCOMPLETE; send chunk 0, complete again → 200 pending (recoverable)', async () => {
        const noise = noisePng();
        const parts = chunksOf(noise);
        const init = await initUpload(e1, 'BE2-G-062_init', pid, fid, { fileName: `${PREFIX}incomplete.png`, sizeBytes: noise.length }, ['200 pending']);
        const uid = String(asJson(init.body).id);
        await sendChunk(e1, 'BE2-G-062_chunk1_200', pid, uid, parts[1] as Buffer, 1, ['200']);
        const missing = await completeUpload(e1, 'BE2-G-062_complete_incomplete_422', pid, uid, ['422 UPLOAD_INCOMPLETE count 1; the upload stays receiving (complete.py:113-122)']);
        const body = expectError(missing, 422, 'UPLOAD_INCOMPLETE');
        expect.soft(body.count).toBe(1);
        await sendChunk(e1, 'BE2-G-062_chunk0_200', pid, uid, parts[0] as Buffer, 0, ['200: still receiving']);
        const done = await completeUpload(e1, 'BE2-G-062_complete_again_200', pid, uid, ['200 Progress pending: recovered (complete.py:303-305)']);
        expect.soft(done.res.status()).toBe(200);
        expect.soft(asJson(done.body).status).toBe('pending');
      });

      const rejected = async (row: string, bytes: Buffer, fileName: string, mime: string, code: string, why: string): Promise<void> => {
        const { uid, done } = await uploadAndComplete(e1, `${row}_upload`, pid, fid, bytes, fileName, mime, `422 ${code}: ${why}`);
        expectError(done, 422, code);
        const p = await progressOf(e1, `${row}_progress_failed`, pid, uid, `200 #8 failed error ${code}: the upload is kept "rejected" (complete.py:243-257, progress.py:52-53)`);
        expect.soft(p.status).toBe('failed');
        expect.soft(p.error).toBe(code);
      };

      await test.step('[BE2-G-067] JPEG with SOI but no FFD9 → complete 422 FILE_CORRUPT; #8 failed FILE_CORRUPT', async () => {
        await rejected('BE2-G-067', tinyJpeg({ components: 3, eoi: false }), `${PREFIX}no-eoi.jpg`, 'image/jpeg', 'FILE_CORRUPT', 'no FF D9 after SOI (complete.py:58-60,97-101)');
      });

      await test.step('[BE2-G-068] PDF whose %%EOF sits > 1 KiB before the end → complete 422 FILE_CORRUPT', async () => {
        await rejected('BE2-G-068', pdfEofFarFromEnd(), `${PREFIX}eof-far.pdf`, 'application/pdf', 'FILE_CORRUPT', '%%EOF not in the last 1 KiB (complete.py:55-56,94-96)');
      });

      await test.step('[BE2-G-070] PDF of exactly 20 pages → complete 200 pending', async () => {
        const { done } = await uploadAndComplete(e1, 'BE2-G-070', pid, fid, makePdf(20), `${PREFIX}twenty.pdf`, 'application/pdf', '200 pending: 20 = PDF_PAGE_MAX is allowed (complete.py:181)');
        expect.soft(done.res.status()).toBe(200);
        expect.soft(asJson(done.body).status).toBe('pending');
      });

      await test.step('[BE2-G-073] RC4 user-password PDF → complete 422 PDF_UNREADABLE; #8 failed PDF_UNREADABLE', async () => {
        await rejected('BE2-G-073', rc4UserPasswordPdf(), `${PREFIX}locked.pdf`, 'application/pdf', 'PDF_UNREADABLE', 'PDFium FPDF_ERR_PASSWORD with the empty password (packages/vision/preprocess/pdf.py:31,48-51)');
      });

      await test.step('[BE2-G-075] tolerated files: JPEG with blank mimeType, CMYK JPEG, RGBA PNG, EXIF-rotated JPEG → complete 200 pending each', async () => {
        const files: Array<[string, Buffer, string, string]> = [
          ['blank_mime_jpeg', tinyJpeg({ components: 3 }), `${PREFIX}blank-mime.jpg`, ''],
          ['cmyk_jpeg', tinyJpeg({ components: 4 }), `${PREFIX}cmyk.jpg`, 'image/jpeg'],
          ['rgba_png', rgbaPng(), `${PREFIX}rgba.png`, 'image/png'],
          ['exif_jpeg', tinyJpeg({ components: 3, exifOrientation: 6 }), `${PREFIX}exif-6.jpg`, 'image/jpeg'],
        ];
        for (const [slug, bytes, name, mime] of files) {
          const { done } = await uploadAndComplete(e1, `BE2-G-075_${slug}`, pid, fid, bytes, name, mime, `200 pending: ${slug} is tolerated (complete.py:197-218)`);
          expect.soft(done.res.status(), slug).toBe(200);
          expect.soft(asJson(done.body).status, slug).toBe('pending');
        }
      });
    } finally {
      await cleanup.run();
    }
  });

  test('FL-A2-03 · BE2 · one plain-page run on #8 and S1, S1 resume, layer at the project default scale, scale demoted by a re-upload, human scale blocks quality writes', async ({ browser }) => {
    test.setTimeout(2 * PIPELINE_TIMEOUT_MS + 90_000);
    const cleanup = new Cleanup();
    const conns: SseConn[] = [];
    try {
      const { e1 } = await owner(cleanup);
      const project = await ownProject(e1, 'FL-A2-03', cleanup, ['T1']);
      const pid = project.id;
      const fid = project.floors[0] as string;
      const scale = 2.5;
      const put = await call(e1, 'FL-A2-03_setup_settings_scale', 'PUT', `/api/projects/${pid}/settings`, { baseVersion: 0, body: settingsBody({ defaultScaleMmPerPx: scale }) }, [
        'setup: 200 N6 revision 1 with defaultScaleMmPerPx 2.5',
      ]);
      expect(put.res.status(), 'setup: project default scale').toBe(200);
      // Not E2E_DRAWING_PNG: that drawing is a render_plan page (run 33: walls, openings, pipeline scale 10.035), so
      // the "non-synthetic page" rows need a plain page — framelessPng has no marker, the fake ML answers nothing.
      const plain = await framelessPng(browser);
      const uid = await receivingUpload(e1, 'FL-A2-03_setup_u1', pid, fid, plain, `${PREFIX}a2-03.png`);
      const path = streamPath(pid, uid);
      const live = await SseConn.open(path, { cookie: await streamCookieOf(e1) });
      conns.push(live);
      expect(live.status, 'S1 opens on the receiving upload').toBe(200);
      await live.until((c) => c.frames.length >= 1, 10_000);
      const done = await completeUpload(e1, 'FL-A2-03_setup_complete', pid, uid, ['200 pending, run queued']);
      expect(done.res.status()).toBe(200);
      // #8 polled back to back while the fake-ML run is live (it lasts ~0.5 s after the worker picks it up).
      const samples: Json[] = [];
      for (const deadline = Date.now() + PIPELINE_TIMEOUT_MS; Date.now() < deadline;) {
        const res = await e1.get(progressPath(pid, uid));
        const body = res.status() === 200 ? asJson(await res.json()) : { status: `#8 ${String(res.status())}` };
        await res.dispose();
        samples.push({ ...body, polledAt: new Date().toISOString() });
        if (body.status === 'completed' || body.status === 'failed') break;
      }
      await live.until((c) => c.frames.some(isFinal), 30_000);
      await live.close();

      await test.step('[BE2-G-089] #8 polled while the run is live → status running, step = current step, progressPercent, startedAt, no endedAt', async () => {
        const running = samples.filter((s) => s.status === 'running');
        await captureStream('BE2-G-089_progress_samples', progressPath(pid, uid), { polls: samples.length }, { samples }, [
          '#8 samples taken back to back from #7 to the final status; a running sample has step ∈ PIPELINE_STEPS, percent, startedAt and no endedAt (progress.py:57-64)',
        ]);
        expect.soft(running.length, 'at least one #8 read caught the run live').toBeGreaterThan(0);
        for (const s of running) {
          expect.soft(PIPELINE_STEPS as readonly unknown[]).toContain(s.step);
          expect.soft(typeof s.progressPercent).toBe('number');
          expect.soft(typeof s.startedAt).toBe('string');
          expect.soft(s, 'no endedAt while running (K33)').not.toHaveProperty('endedAt');
        }
      });

      await test.step('[BE2-G-190] S1 frames: pending → preprocess → … → qualityCheck → completed; percent never decreases', async () => {
        await captureStream('BE2-G-190_s1_frames', path, { cookie: '<owner stream cookie>', openedBefore: '#7' }, live, [
          'snapshot pending, then running frames walking PIPELINE_STEPS in order, then completed (drawings/runs.py:301-327)',
        ]);
        const statuses = live.frames.map((f) => f.data.status).filter((s, i, all) => i === 0 || all[i - 1] !== s);
        expect(statuses, 'status sequence').toEqual(['pending', 'running', 'completed']);
        const steps = live.frames.filter((f) => f.data.status === 'running').map((f) => f.data.step).filter((s, i, all) => i === 0 || all[i - 1] !== s);
        expect(steps, 'every step once, in order').toEqual([...PIPELINE_STEPS]);
        const percents = live.frames.map((f) => Number(f.data.progressPercent));
        expect(percents.every((p, i) => i === 0 || p >= (percents[i - 1] ?? 0)), `percent never decreases: ${percents.join(',')}`).toBe(true);
      });

      await test.step('[BE2-G-204] the three ML steps appear strictly in order wallSegmentation → openingAndFurnitureDetection → dimensionReading (no step goes back)', async () => {
        const order = live.frames.filter((f) => f.data.status === 'running').map((f) => PIPELINE_STEPS.indexOf(f.data.step as (typeof PIPELINE_STEPS)[number]));
        await captureStream('BE2-G-204_step_order', path, { cookie: '<owner stream cookie>' }, { stepIndexes: order }, [
          'indexes of the running steps never decrease (pipeline_steps/step_done.py:163-185)',
        ]);
        expect.soft(order.every((v, i) => v >= 0 && (i === 0 || v >= (order[i - 1] ?? 0))), `step indexes ${order.join(',')}`).toBe(true);
        const ml = ['wallSegmentation', 'openingAndFurnitureDetection', 'dimensionReading'].map((s) => live.frames.findIndex((f) => f.data.step === s && f.data.status === 'running'));
        expect.soft(ml.every((v, i) => v >= 0 && (i === 0 || v > (ml[i - 1] ?? -1))), `first frame of each ML step ${ml.join(',')}`).toBe(true);
      });

      await test.step('[BE2-G-197] reopen S1 with only the Last-Event-ID HEADER = the last frame id → one snapshot frame (completed): the header is ignored', async () => {
        const last = live.frames[live.frames.length - 1];
        const again = await SseConn.open(path, { cookie: await streamCookieOf(e1), headers: { 'Last-Event-ID': String(last?.id) } });
        conns.push(again);
        await again.until((c) => c.frames.length >= 1, 10_000);
        await sleep(2_000);
        await again.close();
        await captureStream('BE2-G-197_last_event_id_header', path, { 'Last-Event-ID': last?.id, query: 'none' }, again, [
          'one snapshot frame, status completed: only the lastEventId QUERY resumes (streams/router.py:37,124)',
        ]);
        expect.soft(again.status).toBe(200);
        expect.soft(again.frames.map((f) => f.data.status)).toEqual(['completed']);
      });

      await test.step('[BE2-G-194] reopen S1 with ?lastEventId = the first live event → no snapshot; the following frames replayed in order, no duplicates', async () => {
        expect(live.frames.length, 'precondition: snapshot + ≥ 2 live events').toBeGreaterThanOrEqual(3);
        const from = live.frames[1] as SseFrame;
        const expected = live.frames.slice(2);
        const last = expected[expected.length - 1] as SseFrame;
        const resumed = await SseConn.open(`${path}?lastEventId=${encodeURIComponent(from.id)}`, { cookie: await streamCookieOf(e1) });
        conns.push(resumed);
        await resumed.until((c) => c.frames.some((f) => f.id === last.id), 10_000);
        await sleep(1_000);
        await resumed.close();
        await captureStream('BE2-G-194_resume_inside_stream', path, { lastEventId: from.id, cookie: '<owner stream cookie>' }, resumed, [
          'well-formed, ≤ tail, not trimmed → cursor = lastEventId: XREAD from there, no snapshot frame (streams/sse.py:279-292)',
        ]);
        expect.soft(resumed.status).toBe(200);
        expect.soft(resumed.frames.map((f) => f.id), 'the ids after lastEventId, in order').toEqual(expected.map((f) => f.id));
        expect.soft(resumed.frames.map((f) => f.data), 'the same data').toEqual(expected.map((f) => f.data));
        expect.soft(new Set(resumed.frames.map((f) => f.id)).size, 'no duplicate frame').toBe(resumed.frames.length);
      });

      await test.step('[BE2-G-205] N16 after the run: no walls / openings; level scale = project defaultScaleMmPerPx; scaleStatus "unresolved"', async () => {
        const sent = await call(e1, 'BE2-G-205_n16_after_run', 'GET', layerPath(pid, fid), undefined, [
          'a plain page (no render_plan marker): the fake ML answers nothing (packages/ml_contracts/fakes.py:25-36) and the build falls back to the project default scale (pipeline_build/build.py:199-220)',
        ]);
        expect.soft(sent.res.status()).toBe(200);
        const layer = asJson(sent.body);
        expect.soft(asJson(layer.layer ?? {}).walls).toEqual([]);
        expect.soft(asJson(layer.layer ?? {}).openings).toEqual([]);
        expect.soft(asJson(layer.level ?? {}).scaleMillimetresPerPixel).toBe(scale);
        expect.soft(layer.scaleStatus).toBe('unresolved');
      });

      let reupload = { uid: '', endedAt: undefined as unknown };
      await test.step('[BE2-G-158] #35 human scale, then re-upload the page on the floor → N16 scaleStatus "unresolved" again (page_key changed); the merge of the new run replaces the scale', async () => {
        const rev = Number(asJson((await call(e1, 'BE2-G-158_n16_before', 'GET', layerPath(pid, fid), undefined, ['N16 revision'])).body).revision);
        const human = await call(e1, 'BE2-G-158_scale_write_200', 'PUT', layerPath(pid, fid), { baseVersion: rev, body: { scaleMillimetresPerPixel: 3 } }, [
          '200: scale-only human write (#35, phase 4 owns its rules)',
        ]);
        expect(human.res.status(), '#35 scale write').toBe(200);
        const reviewed = asJson((await call(e1, 'BE2-G-158_n16_human', 'GET', layerPath(pid, fid), undefined, ['scaleStatus absent: human on this page'])).body);
        expect.soft(reviewed, 'human scale → no scaleStatus (W24)').not.toHaveProperty('scaleStatus');
        const second = await finishedUpload(e1, 'BE2-G-158_reupload', pid, fid, plain, `${PREFIX}a2-03-again.png`);
        expect.soft(second.final.status).toBe('completed');
        reupload = { uid: second.uid, endedAt: second.final.endedAt };
        const after = asJson((await call(e1, 'BE2-G-158_n16_after_reupload', 'GET', layerPath(pid, fid), undefined, [
          'scaleStatus "unresolved": the human scale belongs to the old page_key (spatial_read/router.py:77-78, assemble.py:27-36); the new run merges on ANOTHER page, where the human scale ranks 0, so its project-default scale replaces 3 (spatial_write/writer.py:376-391)',
        ])).body);
        expect.soft(after.scaleStatus, 'demoted: the scale no longer belongs to this page').toBe('unresolved');
        const value = asJson(after.level ?? {}).scaleMillimetresPerPixel;
        note(`BE2-G-158 scale after the re-upload run: ${String(value)} (catalog "kept" 3 is only the read-side state before the new run persists)`);
        expect.soft(value, 'the new page carries its own (project default) scale').toBe(scale);
      });

      await test.step('[BE2-G-126] #35 human scale on the completed re-upload → #32 straighten and #31 corners → 422 QUALITY_LAYER_REVIEWED; nothing re-queued', async () => {
        expect(reupload.uid, 'precondition: the BE2-G-158 re-upload ran').not.toBe('');
        const rev = Number(asJson((await call(e1, 'BE2-G-126_n16_before', 'GET', layerPath(pid, fid), undefined, ['N16 revision'])).body).revision);
        const human = await call(e1, 'BE2-G-126_scale_write_200', 'PUT', layerPath(pid, fid), { baseVersion: rev, body: { scaleMillimetresPerPixel: 4 } }, [
          '200: scale-only human write → scale_source "human" (#35, phase 4 owns its rules)',
        ]);
        expect(human.res.status(), '#35 scale write').toBe(200);
        const straighten = await call(e1, 'BE2-G-126_straighten_422', 'POST', qualityPath(pid, fid, '/straighten'), {}, [
          '422 QUALITY_LAYER_REVIEWED: has_human_geometry (scale_source == "human") AND a completed run of the drawing (quality/service.py:114-120; spatial_read/documents.py:165-176)',
        ]);
        expectError(straighten, 422, 'QUALITY_LAYER_REVIEWED');
        const corners = await call(e1, 'BE2-G-126_corners_422', 'POST', qualityPath(pid, fid, '/corners'), { corners: CORNERS_C1 }, [
          '422 QUALITY_LAYER_REVIEWED: the geometry passes first, then the same editability check',
        ]);
        expectError(corners, 422, 'QUALITY_LAYER_REVIEWED');
        const p = await progressOf(e1, 'BE2-G-126_progress_after', pid, reupload.uid, '#8 of the re-upload: still the same completed run');
        expect.soft(p.status).toBe('completed');
        expect.soft(p.endedAt, 'nothing re-queued').toBe(reupload.endedAt);
      });
    } finally {
      for (const c of conns) await c.close();
      await cleanup.run();
    }
  });

  test('FL-A2-04 · BE2 · second upload on a floor while run 1 is live supersedes it', async () => {
    test.setTimeout(PIPELINE_TIMEOUT_MS + 60_000);
    const cleanup = new Cleanup();
    const conns: SseConn[] = [];
    try {
      const { e1 } = await owner(cleanup);
      const project = await ownProject(e1, 'FL-A2-04', cleanup, ['T1']);
      const pid = project.id;
      const fid = project.floors[0] as string;
      const u1 = await receivingUpload(e1, 'FL-A2-04_setup_u1', pid, fid, drawingPng(), `${PREFIX}a2-04-u1.png`);
      const u2 = await receivingUpload(e1, 'FL-A2-04_setup_u2', pid, fid, drawingPng(), `${PREFIX}a2-04-u2.png`);
      const cookie = await streamCookieOf(e1);
      const s1 = await SseConn.open(streamPath(pid, u1), { cookie });
      const s2 = await SseConn.open(streamPath(pid, u2), { cookie });
      conns.push(s1, s2);
      // Back to back as two parallel #7: the floor lock serialises them, so the second start_run always meets the
      // first run still pending — sequential calls race the ~0.5 s fake-ML run.
      const [c1, c2] = await Promise.all([
        completeUpload(e1, 'FL-A2-04_complete_u1', pid, u1, ['200 pending']),
        completeUpload(e1, 'FL-A2-04_complete_u2', pid, u2, ['200 pending']),
      ]);
      expect(c1.res.status()).toBe(200);
      expect(c2.res.status()).toBe(200);
      const [p1, p2] = await Promise.all([waitFinal(e1, 'FL-A2-04_final_u1', pid, u1), waitFinal(e1, 'FL-A2-04_final_u2', pid, u2)]);
      await Promise.all([s1.until((c) => c.frames.some(isFinal), 15_000), s2.until((c) => c.frames.some(isFinal), 15_000)]);
      const loserIsU1 = p1.status === 'failed';
      const [loser, winner, loserStream, winnerStream] = loserIsU1 ? [p1, p2, s1, s2] : [p2, p1, s2, s1];
      note(`superseded upload: ${loserIsU1 ? 'U1' : 'U2'} (the #7 that committed first)`);

      await test.step('[BE2-G-209] the first run on the floor → #8 failed PIPELINE_SUPERSEDED + a final frame on its stream; the other run completes', async () => {
        await captureStream('BE2-G-209_superseded_stream', streamPath(pid, loserIsU1 ? u1 : u2), { cookie: '<owner stream cookie>' }, loserStream, [
          'final frame failed PIPELINE_SUPERSEDED on the stream of the superseded upload (drawings/runs.py:218-233,259-280)',
        ]);
        expect([p1.status, p2.status].sort(), 'one superseded, one completed').toEqual(['completed', 'failed']);
        expect.soft(loser.error).toBe('PIPELINE_SUPERSEDED');
        const last = loserStream.frames[loserStream.frames.length - 1];
        expect.soft(last?.data.status).toBe('failed');
        expect.soft(last?.data.error).toBe('PIPELINE_SUPERSEDED');
      });

      await test.step('[BE2-G-191] terminal frames: completed = step qualityCheck, 100, endedAt; superseded = failed PIPELINE_SUPERSEDED, no endedAt', async () => {
        const wLast = winnerStream.frames[winnerStream.frames.length - 1];
        await captureStream('BE2-G-191_completed_stream', streamPath(pid, loserIsU1 ? u2 : u1), { cookie: '<owner stream cookie>' }, winnerStream, [
          'completed frame: qualityCheck 100 + endedAt; failed frame: error, no endedAt (progress.py:57-68)',
        ]);
        for (const [what, p] of [['#8 winner', winner], ['S1 winner', wLast?.data ?? {}]] as const) {
          expect.soft(p.status, what).toBe('completed');
          expect.soft(p.step, what).toBe('qualityCheck');
          expect.soft(p.progressPercent, what).toBe(100);
          expect.soft(typeof p.endedAt, what).toBe('string');
        }
        expect.soft(loser, '#8 superseded: no endedAt (K33)').not.toHaveProperty('endedAt');
        expect.soft(loserStream.frames[loserStream.frames.length - 1]?.data ?? {}, 'S1 superseded: no endedAt').not.toHaveProperty('endedAt');
      });
    } finally {
      for (const c of conns) await c.close();
      await cleanup.run();
    }
  });

  test('FL-A2-05 · BE2 · worker outcomes of crafted pages, one floor each, runs in parallel', async () => {
    test.setTimeout(PIPELINE_TIMEOUT_MS + 60_000);
    const cleanup = new Cleanup();
    try {
      const { e1 } = await owner(cleanup);
      const project = await ownProject(e1, 'FL-A2-05', cleanup, ['T1', 'T2', 'T3', 'T4']);
      const pid = project.id;
      const [fCorrupt, fPdf, fHuge, fSynth] = project.floors as [string, string, string, string];
      const pages: Array<[string, string, Buffer, string, string]> = [
        ['BE2-G-220', fCorrupt, corruptPng(), `${PREFIX}broken-idat.png`, 'image/png'],
        ['BE2-G-221', fPdf, makePdf(1, 'Pagez'), `${PREFIX}bad-page-type.pdf`, 'application/pdf'],
        ['BE2-G-201', fHuge, oversizePng(), `${PREFIX}48mp.png`, 'image/png'],
        ['BE2-G-206', fSynth, syntheticPage(), `${PREFIX}synthetic-100.png`, 'image/png'],
      ];
      const started: Record<string, { uid: string; done: Sent }> = {};
      for (const [row, fid, bytes, name, mime] of pages) {
        started[row] = await uploadAndComplete(e1, `${row}_upload`, pid, fid, bytes, name, mime, '200 pending: #7 only checks magic bytes, end marker and the PDF page count');
      }
      const finals = Object.fromEntries(
        await Promise.all(Object.entries(started).map(async ([row, s]) => [row, await waitFinal(e1, `${row}_final`, pid, s.uid)] as const)),
      );
      const failedAtPreprocess = (row: string, code: string): void => {
        expect.soft(started[row]?.done.res.status(), `${row} #7`).toBe(200);
        expect.soft(finals[row]?.status, `${row} #8`).toBe('failed');
        expect.soft(finals[row]?.step, `${row} step`).toBe('preprocess');
        expect.soft(finals[row]?.error, `${row} error`).toBe(code);
      };

      await test.step('[BE2-G-220] PNG with a valid signature + IEND but a broken IDAT → #7 200; #8 failed preprocess FILE_CORRUPT', async () => {
        failedAtPreprocess('BE2-G-220', 'FILE_CORRUPT');
      });

      await test.step('[BE2-G-221] PDF with a broken page object (bad /Type, page count OK at #7) → #7 200; #8 failed preprocess FILE_CORRUPT', async () => {
        failedAtPreprocess('BE2-G-221', 'FILE_CORRUPT');
      });

      await test.step('[BE2-G-201] 8000x6000 PNG (48 MP, small file) → #7 200; #8 failed preprocess IMAGE_TOO_LARGE', async () => {
        failedAtPreprocess('BE2-G-201', 'IMAGE_TOO_LARGE');
      });

      await test.step('[BE2-G-206] synthetic render_plan(100) page (ML_BACKEND=fake) → run completes; N16 = the render_plan answer; scale within 2 %', async () => {
        expect.soft(finals['BE2-G-206']?.status).toBe('completed');
        const sent = await call(e1, 'BE2-G-206_n16_synthetic', 'GET', layerPath(pid, fSynth), undefined, [
          `fake ML returns render_plan(100)'s answer (fakes.py:25-36): ${String(SYNTHETIC_ANSWER.walls)} walls, ${String(SYNTHETIC_ANSWER.doors)} doors + ${String(SYNTHETIC_ANSWER.windows)} windows, dimension texts; scale from the dimensions within 2 % of ${String(SYNTHETIC_ANSWER.mmPerPx)} mm/px`,
        ]);
        expect.soft(sent.res.status()).toBe(200);
        const doc = asJson(sent.body);
        const layer = asJson(doc.layer ?? {});
        const walls = asArray(layer.walls ?? []);
        const openings = asArray(layer.openings ?? []);
        const dimensions = asArray(doc.dimensions ?? []);
        note(`BE2-G-206 N16: ${String(walls.length)} walls, ${String(openings.length)} openings, ${String(dimensions.length)} dimensions, furniture ${String(asArray(layer.furniture ?? []).length)}`);
        expect.soft(walls.length, 'walls vectorised from the answer mask').toBeGreaterThanOrEqual(SYNTHETIC_ANSWER.walls);
        expect.soft(openings.length, 'openings = answer doors + windows').toBe(SYNTHETIC_ANSWER.doors + SYNTHETIC_ANSWER.windows);
        expect.soft(dimensions.length, 'dimension texts read').toBeGreaterThan(0);
        const mmPerPx = Number(asJson(doc.level ?? {}).scaleMillimetresPerPixel);
        expect.soft(Math.abs(mmPerPx - SYNTHETIC_ANSWER.mmPerPx) / SYNTHETIC_ANSWER.mmPerPx, `scale ${String(mmPerPx)} within 2 %`).toBeLessThanOrEqual(0.02);
        expect.soft(doc.scaleStatus, 'pipeline scale is provisional').toBe('unresolved');
      });
    } finally {
      await cleanup.run();
    }
  });

  test('FL-A2-06 · BE2 · S1 stream lifecycle: heartbeat, slot release, server-side close on revocation', async () => {
    test.setTimeout(180_000);
    const cleanup = new Cleanup();
    const conns: SseConn[] = [];
    try {
      const { admin, e1, user } = await owner(cleanup);
      const member = await p12User(admin, 'engineer', SLOT_MEMBER);
      const project = await ownProject(e1, 'FL-A2-06', cleanup, ['T1']);
      const pid = project.id;
      const fid = project.floors[0] as string;
      await addMember(e1, 'FL-A2-06_setup_add_m', pid, member.email);
      const uid = await receivingUpload(e1, 'FL-A2-06_setup_receiving', pid, fid, smallPng(), `${PREFIX}a2-06.png`);
      const path = streamPath(pid, uid);
      const cookie = await streamCookieOf(e1);
      const openUntil200 = async (c: string, timeoutMs: number): Promise<SseConn> => {
        const deadline = Date.now() + timeoutMs;
        for (;;) {
          const conn = await SseConn.open(path, { cookie: c });
          conns.push(conn);
          if (conn.status === 200 || Date.now() > deadline) return conn;
          await sleep(500);
        }
      };

      await test.step('[BE2-G-193] open S1 on the receiving upload, read the snapshot, stay idle ≥ 16 s → a ": ping" comment arrives (STREAM_HEARTBEAT_S 15)', async () => {
        const conn = await SseConn.open(path, { cookie });
        conns.push(conn);
        await conn.until((c) => c.pings.length >= 1, (STREAM_HEARTBEAT_S + 6) * 1000);
        await conn.close();
        await captureStream('BE2-G-193_heartbeat', path, { cookie: '<owner stream cookie>' }, conn, [
          'snapshot frame, then ": ping" after ~15 s of silence (streams/sse.py:62,403-405; settings.py:32)',
        ]);
        expect.soft(conn.status).toBe(200);
        expect.soft(conn.frames, 'only the snapshot frame').toHaveLength(1);
        expect.soft(conn.pings.length, 'a heartbeat within 21 s').toBeGreaterThanOrEqual(1);
        const gap = (conn.pings[0] ?? 0) - (conn.frames[0]?.at ?? 0);
        expect.soft(gap >= (STREAM_HEARTBEAT_S - 1) * 1000 && gap <= (STREAM_HEARTBEAT_S + 3) * 1000, `first ping ${String(gap)} ms after the snapshot`).toBe(true);
      });

      await test.step('[BE2-G-199] owner holds 6 streams (7th → 429 as precondition); closing one frees its slot → the next open → 200 snapshot', async () => {
        const held: SseConn[] = [];
        for (let i = 0; i < STREAM_MAX_PER_USER; i += 1) {
          const conn = await openUntil200(cookie, 10_000); // slots of step 1 may still be draining
          held.push(conn);
          expect(conn.status, `stream ${String(i + 1)}`).toBe(200);
        }
        const seventh = await SseConn.open(path, { cookie });
        conns.push(seventh);
        await captureStream('BE2-G-199_7th_429', path, { alreadyOpen: STREAM_MAX_PER_USER }, seventh, ['429 RATE_LIMITED: STREAM_MAX_PER_USER 6 (precondition)']);
        expect(seventh.status, 'precondition: the 7th stream is refused').toBe(429);
        await held[0]?.close();
        const reopened = await openUntil200(cookie, 15_000);
        await reopened.until((c) => c.frames.length >= 1, 5_000);
        await captureStream('BE2-G-199_reopen_200', path, { closed: 1, alreadyOpen: STREAM_MAX_PER_USER - 1 }, reopened, [
          '200 + snapshot frame: the closed stream released its slot (streams/sse.py:429-452)',
        ]);
        expect(reopened.status, 'next open after a close').toBe(200);
        expect.soft(reopened.frames.length).toBeGreaterThanOrEqual(1);
        for (const c of [...held, reopened]) await c.close();
      });

      await test.step('[BE2-G-200] while streaming: owner removes M → M\'s stream closed ≤ 5 s; admin disables M → closed ≤ 5 s; owner logout → its stream closed ≤ 5 s; no frame after', async () => {
        const mApi = await userApi(member, cleanup);
        const mCookie = await streamCookieOf(mApi);
        const closedWithin = async (conn: SseConn, act: () => Promise<unknown>, what: string, ev: string): Promise<void> => {
          await conn.until((c) => c.frames.length >= 1, 10_000);
          const framesBefore = conn.frames.length;
          await act();
          const actedAt = conn.elapsed;
          await conn.until((c) => c.end !== undefined, 15_000);
          const latency = (conn.endedAt ?? Number.POSITIVE_INFINITY) - actedAt;
          await captureStream(ev, path, { what }, { ...conn.record(), closeLatencyMs: latency }, [`${what}: the server ends the stream ≤ 5 s (streams/sse.py:332-354; settings.py:23,33)`]);
          expect.soft(conn.end, `${what}: ended by the server`).toBe('server-ended');
          expect.soft(latency, `${what}: closed within ${String(STREAM_CLOSE_MS)} ms`).toBeLessThanOrEqual(STREAM_CLOSE_MS);
          expect.soft(conn.frames.length, `${what}: no frame after`).toBe(framesBefore);
        };

        const removed = await SseConn.open(path, { cookie: mCookie });
        conns.push(removed);
        expect.soft(removed.status, 'member stream opens').toBe(200);
        await closedWithin(removed, async () => {
          const res = await call(e1, 'BE2-G-200_remove_m_200', 'DELETE', `/api/projects/${pid}/members/${member.id}`, undefined, ['200 N4']);
          expect(res.res.status()).toBe(200);
        }, 'member removed', 'BE2-G-200_removed_member_stream');

        await addMember(e1, 'BE2-G-200_readd_m', pid, member.email);
        const disabled = await SseConn.open(path, { cookie: mCookie });
        conns.push(disabled);
        expect.soft(disabled.status, 'member stream reopens after re-add').toBe(200);
        await closedWithin(disabled, () => disableUser(admin, member, 'BE2-G-200_admin_disables_m_200', cleanup), 'user disabled', 'BE2-G-200_disabled_user_stream');

        const second = await signedInApi(user.email, user.password); // a 2nd owner session: logout revokes only it
        cleanup.add(() => second.dispose());
        const own = await openUntil200(await streamCookieOf(second), 15_000);
        expect.soft(own.status, 'owner stream (2nd session) opens').toBe(200);
        await closedWithin(own, async () => {
          const out = await call(second, 'BE2-G-200_logout_204', 'POST', '/api/auth/logout', undefined, ['204: the 2nd session is revoked']);
          expect(out.res.status()).toBe(204);
        }, 'session logged out', 'BE2-G-200_logout_stream');
      });
    } finally {
      for (const c of conns) await c.close();
      await cleanup.run();
    }
  });

  test('FL-A2-07 · BE2 · init budget: refused (422) inits count toward the per-user drawings_init limit', async () => {
    test.setTimeout(240_000);
    const cleanup = new Cleanup();
    try {
      const admin = await adminApi(cleanup);
      const budget = await p12User(admin, 'engineer', SLOT_BUDGET);
      const b = await userApi(budget, cleanup);
      const project = await ownProject(b, 'FL-A2-07', cleanup, ['T1']);
      const pid = project.id;
      const fid = project.floors[0] as string;

      await test.step(`[BE2-G-031] ${String(INIT_LIMIT)} inits each 422 CAD_NOT_SUPPORTED (.dwg) → then one valid init → 429 RATE_LIMITED + Retry-After (422s counted after the gate)`, async () => {
        const dwg = initBody(pid, fid, { fileName: `${PREFIX}plan.dwg`, mimeType: 'application/acad', sizeBytes: 100 });
        const statuses: number[] = [];
        const codes = new Set<unknown>();
        const first = await call(b, 'BE2-G-031_dwg_init_1_422', 'POST', initPath(pid, fid), dwg, ['422 CAD_NOT_SUPPORTED, counted by the limiter (drawings/router.py:52, core/ratelimit.py:116-118)']);
        if (first.res.status() === 429) {
          throw new Error(`p12-up-budget's drawings_init bucket is still burnt by a run < 600 s ago — re-run FL-A2-07 after 10 min`);
        }
        statuses.push(first.res.status());
        codes.add(errBody(first.body).code);
        for (let sent = 1; sent < INIT_LIMIT;) {
          const batch = Math.min(10, INIT_LIMIT - sent);
          const answers = await Promise.all(Array.from({ length: batch }, async () => {
            const res = await b.post(initPath(pid, fid), { data: dwg });
            const code = errBody(await res.json().catch(() => ({}))).code;
            const status = res.status();
            await res.dispose();
            return [status, code] as const;
          }));
          for (const [status, code] of answers) {
            statuses.push(status);
            codes.add(code);
          }
          sent += batch;
        }
        const valid = await call(b, 'BE2-G-031_valid_init_after_limit_429', 'POST', initPath(pid, fid), initBody(pid, fid, { fileName: `${PREFIX}ok.png`, sizeBytes: 100 }), [
          `429 RATE_LIMITED + Retry-After: the ${String(INIT_LIMIT)} refused inits filled drawings_init (${String(INIT_LIMIT)} / 600 s per user)`,
        ]);
        await captureStream('BE2-G-031_init_statuses', initPath(pid, fid), { body: dwg, times: statuses.length }, { statuses: [...new Set(statuses)], codes: [...codes] }, [
          `every .dwg init answered 422 CAD_NOT_SUPPORTED (${String(INIT_LIMIT)} requests, 10 in flight)`,
        ]);
        expect.soft(statuses.filter((s) => s === 422).length, `all ${String(INIT_LIMIT)} .dwg inits → 422`).toBe(INIT_LIMIT);
        expect.soft([...codes]).toEqual(['CAD_NOT_SUPPORTED']);
        expectError(valid, 429, 'RATE_LIMITED');
        const retry = Number(valid.res.headers()['retry-after']);
        expect.soft(retry >= 1 && retry <= 600, `Retry-After ${String(retry)} s within the 600 s window`).toBe(true);
        note(`BE2-G-031 Retry-After = ${String(retry)} s`);
      });
    } finally {
      await cleanup.run();
    }
  });

  test('FL-A2-08 · BE2 · straighten a skewed page: run, key replay, no-key repeat, key reused on another floor', async ({ browser }) => {
    test.setTimeout(2 * PIPELINE_TIMEOUT_MS + 60_000);
    const cleanup = new Cleanup();
    try {
      const { e1 } = await owner(cleanup);
      const pngPath = process.env.E2E_DRAWING_PNG ?? '';
      const skewed = await rotatedPng(browser, pngPath, SKEW_DEG);
      const seeded = await createSkewedDrawingProject(e1, 'FL-A2-08', skewed);
      const pid = seeded.projectId;
      const fid = seeded.floorId;
      cleanup.add(() => deleteSeededProject(e1, pid));
      const other = await addFloor(e1, 'FL-A2-08_setup_extra_floor', pid, 1);
      const uid = String((await latestItems(e1, 'FL-A2-08_setup_n7', pid, 'setup: N7 item of the skewed floor')).find((i) => i.floorId === fid)?.uploadId);
      const before = await waitFinal(e1, 'FL-A2-08_setup_run1_final', pid, uid);
      const findingsBefore = asArray((await qualityEntry(e1, 'FL-A2-08_setup_quality_before', pid, fid))?.findings ?? []).map((f) => asJson(f).id);
      const key = `qa-p12-straighten-${uniq()}`;
      const path = qualityPath(pid, fid, '/straighten');
      let firstBody: unknown;
      let afterRun: Json = {};

      await test.step('[BE2-G-124] POST straighten + Idempotency-Key K → 200 re-measured, new finding ids; #8 back to pending then completed', async () => {
        const sent = await call(e1, 'BE2-G-124_straighten_key_200', 'POST', path, {}, ['200 QualityAssessmentOut re-measured, new finding ids; a new run of the same upload (quality/service.py:355-380)'], { 'Idempotency-Key': key });
        expect(sent.res.status(), 'straighten').toBe(200);
        firstBody = sent.body;
        const queued = await progressOf(e1, 'BE2-G-124_progress_queued', pid, uid, '#8 right after #32: the new run (pending | running, or completed after run 1 ended)');
        note(`#8 right after #32: ${String(queued.status)}`);
        // QA-03f (E1): the straighten run can finish before this read (run-36: 222 ms run, read 95 ms later) — a `completed`
        // that STARTED after run 1 ended is the new run too.
        const isNewRun =
          queued.status === 'completed'
            ? Date.parse(String(queued.startedAt)) > Date.parse(String(before.endedAt))
            : ['pending', 'running'].includes(String(queued.status));
        expect.soft(isNewRun, `#8 is the new run: ${String(queued.status)} startedAt ${String(queued.startedAt)} > run 1 endedAt ${String(before.endedAt)}`).toBe(true);
        const entry = asArray(asJson(sent.body).floors).map((f) => asJson(f)).find((f) => f.floorId === fid);
        const idsAfter = asArray(entry?.findings ?? []).map((f) => asJson(f).id);
        expect.soft(idsAfter.filter((id) => findingsBefore.includes(id)), 'finding ids renewed').toEqual([]);
        afterRun = await waitFinal(e1, 'BE2-G-124_run2_final', pid, uid);
        expect(afterRun.status, 'the straighten run completes').toBe('completed');
        expect.soft(Date.parse(String(afterRun.endedAt))).toBeGreaterThan(Date.parse(String(before.endedAt)));
      });

      await test.step('[BE2-G-130] same K + body again → the stored 200 body; still ONE new run (#8 endedAt unchanged)', async () => {
        const replay = await call(e1, 'BE2-G-130_straighten_same_key_200', 'POST', path, {}, ['the STORED 200 body (core/idempotency.py:225-233); nothing queued'], { 'Idempotency-Key': key });
        expect.soft(replay.res.status()).toBe(200);
        expect.soft(replay.body, 'replayed body').toEqual(firstBody);
        await sleep(3_000);
        const p = await progressOf(e1, 'BE2-G-130_progress_after', pid, uid, '#8 still the straighten run (same endedAt)');
        expect.soft(p.status).toBe('completed');
        expect.soft(p.endedAt, 'no second run').toBe(afterRun.endedAt);
      });

      await test.step('[BE2-G-131] straighten without a key on the now straight page → 200, no new run (#8 endedAt unchanged)', async () => {
        const sent = await call(e1, 'BE2-G-131_straighten_no_key_200', 'POST', path, {}, ['200 current view: the page is settled (service.py:198-205,365-366)']);
        expect.soft(sent.res.status()).toBe(200);
        await sleep(3_000);
        const p = await progressOf(e1, 'BE2-G-131_progress_after', pid, uid, '#8 unchanged');
        expect.soft(p.status).toBe('completed');
        expect.soft(p.endedAt, 'no new run for a settled page').toBe(afterRun.endedAt);
      });

      await test.step('[BE2-G-132] same K on the other floor\'s straighten path → 422 IDEMPOTENCY_KEY_REUSED (the digest uses the real path)', async () => {
        const sent = await call(e1, 'BE2-G-132_same_key_other_floor_422', 'POST', qualityPath(pid, other, '/straighten'), {}, [
          '422 IDEMPOTENCY_KEY_REUSED: same route template, another path in the digest (core/idempotency.py:86-90,231), checked before the drawing lookup',
        ], { 'Idempotency-Key': key });
        expectError(sent, 422, 'IDEMPOTENCY_KEY_REUSED');
      });
    } finally {
      await cleanup.run();
    }
  });

  test('FL-A2-09 · BE2 · manual corners lifecycle: anon, path guard, key replay, newest run wins in N7, frame state, no-op, undo corners, top-left start rule', async () => {
    test.setTimeout(3 * PIPELINE_TIMEOUT_MS);
    const cleanup = new Cleanup();
    try {
      const { e1 } = await owner(cleanup);
      const project = await ownProject(e1, 'FL-A2-09', cleanup, ['T1', 'T2']);
      const pid = project.id;
      const [fid, framedFid] = project.floors as [string, string];
      const u1 = await finishedUpload(e1, 'FL-A2-09_setup_u1', pid, fid, drawingPng(), `${PREFIX}a2-09-u1.png`);
      expect(u1.final.status, 'setup: U1 run completes').toBe('completed');
      await waitForQualityFindings(e1, pid, fid);
      const u2 = await finishedUpload(e1, 'FL-A2-09_setup_u2', pid, fid, corruptPng(), `${PREFIX}a2-09-u2.png`);
      expect(u2.final.status, 'setup: U2 (broken IDAT) fails in the worker').toBe('failed');
      const n7Before = await latestItems(e1, 'BE2-G-101_n7_before_c1', pid, 'N7 before C1: the item of the floor is U2 (newest run, failed)');
      const entryBefore = await qualityEntry(e1, 'BE2-G-114_quality_before_c1', pid, fid);
      // T2: a page whose frame IS found (drawing.png has none). Run 33-r2: preprocess crops a found frame itself
      // (stored corners = the frame, page 1279x959), so #30 already reports it as APPLIED.
      const framed = await finishedUpload(e1, 'FL-A2-09_setup_framed', pid, framedFid, framedPng(), `${PREFIX}a2-09-framed.png`);
      expect(framed.final.status, 'setup: the framed page run completes').toBe('completed');
      await waitForQualityFindings(e1, pid, framedFid);
      const framedBefore = await qualityEntry(e1, 'BE2-G-114_quality_framed_before', pid, framedFid);
      const corners = qualityPath(pid, fid, '/corners');
      const key = `qa-p12-corners-${uniq()}`;
      let c1Body: unknown;
      let c1Run: Json = {};

      await test.step('[BE2-G-133] anonymous POST #31 corners → 401 UNAUTHENTICATED', async () => {
        const anon = await newApiContext();
        cleanup.add(() => anon.dispose());
        const sent = await call(anon, 'BE2-G-133_corners_anon_401', 'POST', corners, { corners: CORNERS_C1 }, ['401 UNAUTHENTICATED before the body (core/routing.py:125-131)']);
        expectError(sent, 401, 'UNAUTHENTICATED');
      });

      await test.step('[BE2-G-141] #31 body floorId ≠ path, then projectId ≠ path → 422 PATH_BODY_MISMATCH with that field', async () => {
        const floorBody = await call(e1, 'BE2-G-141_corners_floor_mismatch_422', 'POST', corners, { corners: CORNERS_C1, floorId: `L-${'0'.repeat(24)}` }, ['422 PATH_BODY_MISMATCH field floorId (core/routing.py:138-151)']);
        expectError(floorBody, 422, 'PATH_BODY_MISMATCH', { field: 'floorId' });
        const projectBody = await call(e1, 'BE2-G-141_corners_project_mismatch_422', 'POST', corners, { corners: CORNERS_C1, projectId: `prj_${'0'.repeat(26)}` }, ['422 PATH_BODY_MISMATCH field projectId']);
        expectError(projectBody, 422, 'PATH_BODY_MISMATCH', { field: 'projectId' });
      });

      await test.step('[BE2-G-149] #31 corners C1 + Idempotency-Key K → 200, run queued; same K again → the same 200 body, still one run', async () => {
        const sent = await call(e1, 'BE2-G-149_corners_c1_key_200', 'POST', corners, { corners: CORNERS_C1 }, ['200 QualityAssessmentOut; a new run on U1 (the floor\'s drawing)'], { 'Idempotency-Key': key });
        expect(sent.res.status(), 'C1 applied').toBe(200);
        c1Body = sent.body;
        c1Run = await waitFinal(e1, 'BE2-G-149_c1_run_final', pid, u1.uid);
        expect(c1Run.status, 'the C1 run on U1 completes').toBe('completed');
        expect.soft(Date.parse(String(c1Run.endedAt))).toBeGreaterThan(Date.parse(String(u1.final.endedAt)));
        const replay = await call(e1, 'BE2-G-149_corners_c1_same_key_200', 'POST', corners, { corners: CORNERS_C1 }, ['the STORED 200 body, nothing queued'], { 'Idempotency-Key': key });
        expect.soft(replay.res.status()).toBe(200);
        expect.soft(replay.body).toEqual(c1Body);
        await sleep(3_000);
        const p = await progressOf(e1, 'BE2-G-149_progress_after_replay', pid, u1.uid, '#8 U1: still the C1 run');
        expect.soft(p.endedAt, 'one run for C1').toBe(c1Run.endedAt);
      });

      await test.step('[BE2-G-101] N7 before C1 = U2 (newest run, failed); after the C1 re-run on U1 ends → N7 item = U1', async () => {
        expect.soft(n7Before.find((i) => i.floorId === fid)?.uploadId, 'before C1').toBe(u2.uid);
        const after = await latestItems(e1, 'BE2-G-101_n7_after_c1', pid, 'N7 after the C1 run: the upload with the newest run wins (latest.py:39-50)');
        expect.soft(after.find((i) => i.floorId === fid)?.uploadId, 'after C1').toBe(u1.uid);
      });

      await test.step('[BE2-G-114] #30 before C1: frame.corners only when isFound; after C1: frame {isFound: true}, corners omitted (applied)', async () => {
        const frame = asJson(entryBefore?.frame ?? {});
        if (frame.isFound === true) expect.soft(asArray(frame.corners ?? []), 'found frame lists 4 corners').toHaveLength(4);
        else expect.soft(frame, 'frame not found → no corners').not.toHaveProperty('corners');
        note(`BE2-G-114 frame before C1: isFound=${String(frame.isFound)}`);
        // The third state ("found, not applied" → corners listed) is not reachable through the pipeline: a found frame is
        // applied by preprocess, so a framed page reads like an applied one (DB quality_assessments.corners = the frame).
        expect.soft(framedBefore?.frame, 'framed page: the frame found by preprocess is applied, corners omitted').toEqual({ isFound: true });
        note('BE2-G-114: "found + corners" branch unreachable over HTTP (preprocess auto-applies a found frame); pytest test_read_view__frame_applied_found_and_missing keeps it');
        const after = await qualityEntry(e1, 'BE2-G-114_quality_after_c1', pid, fid);
        expect.soft(after?.frame, 'applied corners are not echoed (assessments.py:221-228)').toEqual({ isFound: true });
      });

      await test.step('[BE2-G-143] #31 the applied C1 again without a key (= the full displayed page) → 200 current, no processing, no new run (#8 endedAt unchanged)', async () => {
        // #31 corners are ratios of the DISPLAYED page (to_unrectified, quality/geometry.py:88-101): after C1 the page IS
        // the C1 region, so "the same corners" are the full page (BE pytest test_quality_set_corners__C10_no_key_replay).
        const sent = await call(e1, 'BE2-G-143_corners_c1_again_200', 'POST', corners, { corners: FULL_PAGE }, ['200 current view: maps back to the applied C1 (quality/service.py:344-345)']);
        expect.soft(sent.res.status()).toBe(200);
        await sleep(3_000);
        const p = await progressOf(e1, 'BE2-G-143_progress_after', pid, u1.uid, '#8 U1 unchanged');
        expect.soft(p.endedAt, 'no new run').toBe(c1Run.endedAt);
      });

      await test.step('[BE2-G-144] #31 C2 → run; then the stored undo corners → previous page — UNKNOWN — NEED VERIFICATION over HTTP (undo corners never on the wire)', async () => {
        const path = qualityPath(pid, fid, '/corners');
        const before = await progressOf(e1, 'BE2-G-144_progress_before_c2', pid, u1.uid, '#8 U1 before C2');
        const sentC2 = await call(e1, 'BE2-G-144_corners_c2_200', 'POST', path, { corners: FULL_PAGE.map((c) => ({ xRatio: c.xRatio === 0 ? 0.1 : 0.9, yRatio: c.yRatio === 0 ? 0.1 : 0.9 })) }, [
          '200, a new run (C2 = an inset quad of the displayed page)',
        ]);
        expect.soft(sentC2.res.status()).toBe(200);
        const c2Run = await waitFinal(e1, 'BE2-G-144_c2_run_final', pid, u1.uid);
        expect.soft(Date.parse(String(c2Run.endedAt)), 'C2 is a new run').toBeGreaterThan(Date.parse(String(before.endedAt)));
        // The undo branch (service.py:170-180) needs the body to equal report.undo.corners = the frame corners the page
        // showed before the write. Run 33-r2 (DB read of quality_assessments): pipeline-measured pages store frame.corners
        // null (not found, or found and auto-applied by preprocess) and undo null, and #30 hides corners once applied — so
        // no HTTP client can learn undo corners; the FE has no corner undo either. Covered by pytest
        // test_quality_set_corners__undo only.
        note('BE2-G-144 UNKNOWN — NEED VERIFICATION: undo corners are not reachable over HTTP (frame corners null / hidden once applied)');
        await captureStream('BE2-G-144_undo_unreachable', path, { corners: 'C2' }, { c2Run, undoCorners: 'not exposed by #30 (frame {isFound: true} without corners once applied)' }, [
          'C2 ran; the undo half cannot be driven through the API',
        ]);
      });

      await test.step('[BE2-G-139] #31 on the framed floor: first point not top-left (beyond eps 0.002) → 422 field corners; a 45° rhombus starting at its top vertex → 200, then starting at its left vertex → 200', async () => {
        const path = qualityPath(pid, framedFid, '/corners');
        const c = (x: number, y: number): Json => ({ xRatio: x, yRatio: y });
        const notTl = await call(e1, 'BE2-G-139_corners_not_top_left_422', 'POST', path, { corners: [c(0.95, 0.05), c(0.95, 0.95), c(0.05, 0.95), c(0.05, 0.05)] }, [
          '422 VALIDATION field corners: x + y of the first point > min(x + y) + QUALITY_CORNER_EPS (quality/geometry.py:71-73; settings.py:23)',
        ]);
        expectError(notTl, 422, 'VALIDATION', { field: 'corners' });
        // A 45° rhombus has two "top-left" vertices with the same x + y: (0.5, 0) and (0, 0.5) — both are valid starts (NO-227).
        const rhombi: Array<[string, Json[]]> = [
          ['top_first', [c(0.5, 0), c(1, 0.5), c(0.5, 1), c(0, 0.5)]],
          ['left_first', [c(0, 0.5), c(0.5, 0), c(1, 0.5), c(0.5, 1)]],
        ];
        for (const [slug, corners] of rhombi) {
          const sent = await call(e1, `BE2-G-139_corners_rhombus_${slug}_200`, 'POST', path, { corners }, [
            '200 QualityAssessmentOut: the tie within eps is accepted; a new run is queued on the framed upload (quality/service.py:319-345, geometry.py:54-78)',
          ]);
          expect.soft(sent.res.status(), slug).toBe(200);
        }
      });
    } finally {
      await cleanup.run();
    }
  });

  test('FL-A2-10 · BE2 · viewer member reads a finished run (N7, #30, N16, N15 → 200); S1 stays open after its terminal frame', async () => {
    test.setTimeout(PIPELINE_TIMEOUT_MS + 90_000);
    const cleanup = new Cleanup();
    const conns: SseConn[] = [];
    try {
      const { admin, e1 } = await owner(cleanup);
      const viewer = await poolUser(admin, 'viewer');
      const project = await ownProject(e1, 'FL-A2-10', cleanup, ['T1']);
      const pid = project.id;
      const fid = project.floors[0] as string;
      const run = await finishedUpload(e1, 'FL-A2-10_setup_run', pid, fid, drawingPng(), `${PREFIX}a2-10.png`);
      expect(run.final.status, 'setup: the drawing.png run completes').toBe('completed');
      await addMember(e1, 'FL-A2-10_setup_add_viewer', pid, viewer.email);
      const vApi = await userApi(viewer, cleanup);
      let n16Revision: unknown;

      await test.step('[BE2-G-095] viewer member GET N7 latest uploads → 200, one item: T1 with the finished upload', async () => {
        const items = await latestItems(vApi, 'BE2-G-095_viewer_n7_200', pid, '200 N7: require_project() = member gate only, no permission key (drawings/latest.py:120-123)');
        expect.soft(items.map((i) => [i.floorId, i.uploadId])).toEqual([[fid, run.uid]]);
      });

      await test.step('[BE2-G-107] viewer member GET #30 quality of T1 (completed run) → 200 with the T1 entry', async () => {
        const entry = await qualityEntry(vApi, 'BE2-G-107_viewer_quality_200', pid, fid);
        expect.soft(entry?.floorId, '#30 lists T1 (member gate only, quality/router.py:30-37)').toBe(fid);
      });

      await test.step('[BE2-G-152] viewer member GET N16 layer of T1 → 200, revision ≥ 1 after the run', async () => {
        const sent = await call(vApi, 'BE2-G-152_viewer_n16_200', 'GET', layerPath(pid, fid), undefined, [
          '200 FloorLayerDocumentOut: member gate only (spatial_read/router.py:71-87)',
        ]);
        expect.soft(sent.res.status()).toBe(200);
        n16Revision = asJson(sent.body).revision;
        expect.soft(Number(n16Revision), 'the run wrote the layer').toBeGreaterThanOrEqual(1);
      });

      await test.step('[BE2-G-160] viewer member GET N15 project spatial graph → 200, floorRevisions lists T1 at the N16 revision', async () => {
        const sent = await call(vApi, 'BE2-G-160_viewer_n15_200', 'GET', `/api/projects/${pid}/spatial`, undefined, [
          '200 SpatialGraphDocumentOut {graph, floorRevisions}: member gate only (spatial_read/router.py:65-68)',
        ]);
        expect.soft(sent.res.status()).toBe(200);
        const revisions = asArray(asJson(sent.body).floorRevisions ?? []).map((r) => asJson(r));
        expect.soft(revisions).toEqual([{ floorId: fid, revision: n16Revision }]);
      });

      await test.step('[BE2-G-192] viewer opens S1 on the completed upload → one snapshot frame, already terminal (completed); the server keeps the stream open: a ": ping" ~15 s later and no end', async () => {
        const path = streamPath(pid, run.uid);
        const conn = await SseConn.open(path, { cookie: await streamCookieOf(vApi) });
        conns.push(conn);
        await conn.until((c) => c.pings.length >= 1 || c.end !== undefined, (STREAM_HEARTBEAT_S + 6) * 1000);
        await sleep(1_000);
        const openAfterPing = conn.end === undefined;
        await conn.close();
        await captureStream('BE2-G-192_open_after_terminal', path, { cookie: '<viewer stream cookie>' }, { ...conn.record(), openAfterPing }, [
          '_pump has no terminal-status check: after the completed frame it keeps reading and sends ": ping" every STREAM_HEARTBEAT_S until the client leaves (streams/sse.py:387-405); the FE must close',
        ]);
        expect(conn.status, 'S1 opens for a viewer member').toBe(200);
        expect.soft(conn.frames.map((f) => f.data.status), 'only the terminal snapshot').toEqual(['completed']);
        expect.soft(conn.pings.length, 'a heartbeat after the terminal frame').toBeGreaterThanOrEqual(1);
        expect.soft(openAfterPing, 'the server did not end the stream after the final status').toBe(true);
      });
    } finally {
      for (const c of conns) await c.close();
      await cleanup.run();
    }
  });
});
