/**
 * QA-11 P8 helpers — SCR-32 version restore and SCR-29 rule reset (`phase11_project_versions_edge.spec.ts`).
 * Copy read from FE source (master 5fcaf502): VH=src/screens/export/VersionHistory/VersionHistory.tsx, VHM=versionHistoryModel.ts,
 * UVH=useVersionHistory.ts, RS=src/screens/rules/RuleSettings/RuleSettings.tsx, URS=useRuleSettings.ts.
 */
import { expect, type Locator, type Page, type Request } from '@playwright/test';

import { qcLayer, layerPathOf, type LayerApi } from '../layerSeed';

type Json = Record<string, unknown>;

export const RESTORE_CAPTION = 'Phục hồi không xoá phiên bản nào'; // VHM:502 (prefix)
export const UNDO_HISTORY_CLEARED = 'Riêng lịch sử hoàn tác (Ctrl+Z) của mọi tầng sẽ được xoá.'; // VHM:509
export const CHECKBOX_RE = /^Chọn phiên bản (.+) để so sánh$/u; // VersionList.tsx

export const versionList = (page: Page): Locator => page.getByRole('navigation', { name: 'Danh sách phiên bản', exact: true });
export const restoreButton = (page: Page): Locator => page.getByRole('button', { name: 'Phục hồi phiên bản này', exact: true }); // VH:~185
// Toast.tsx:215 - two "Thông báo" regions exist (one inside main from Toast.Provider, one from NotificationHost; RR4 strict-mode error);
// the intended one is whichever holds a toast (role=status, Toast.tsx:147).
export const toastRegion = (page: Page): Locator =>
  page.getByRole('region', { name: 'Thông báo', exact: true }).filter({ has: page.getByRole('status') });
export const undoButton = (page: Page): Locator => toastRegion(page).getByRole('button', { name: 'Hoàn tác', exact: true });
export const restoreDefaults = (page: Page): Locator => page.getByRole('button', { name: 'Khôi phục mặc định', exact: true }); // RS:327
export const footerText = (page: Page): Locator => page.getByText('Cấu hình đã khác mặc định.', { exact: true }); // RS:326

export const restorePathRe = (projectId: string): RegExp => new RegExp(`^/api/projects/${projectId}/versions/[^/]+/restore$`, 'u');
export const ruleConfigRe = (projectId: string): RegExp => new RegExp(`^/api/projects/${projectId}/rule-config$`, 'u');

/** Records every non-GET `/api/` request of the page (read after a landmark, never right after a click). */
export function recordWrites(page: Page): Request[] {
  const writes: Request[] = [];
  page.on('request', (request) => {
    if (request.method() !== 'GET' && new URL(request.url()).pathname.startsWith('/api/')) writes.push(request);
  });
  return writes;
}

/** Ids of the walls in a layer body (N16 or #35 answer). */
export function wallIds(layer: unknown): string[] {
  const walls = (layer as Json).walls;
  if (!Array.isArray(walls)) throw new Error('layer has no walls array');
  return walls.map((wall) => String((wall as Json).id)).sort();
}

/** N16 read of a floor through the fixture API: `{ revision, ids }`. */
export async function readLayer(api: LayerApi, projectId: string, floorId: string): Promise<{ revision: number; ids: string[] }> {
  const res = await api.request.get(layerPathOf(projectId, floorId), { headers: api.headers });
  expect(res.status(), `GET ${layerPathOf(projectId, floorId)} (N16)`).toBe(200);
  const body = (await res.json()) as Json;
  return { revision: Number(body.revision), ids: wallIds(body.layer) };
}

/** A `qcLayer` with only its first `count` walls (count >= 8 keeps the door/window host walls; 8..10). */
export function layerWithWalls(count: number): (levelId: string) => Json {
  return (levelId) => {
    const layer = qcLayer(levelId);
    return { ...layer, walls: (layer.walls as unknown[]).slice(0, count) };
  };
}

/** Row labels ("v3") newest first, read from the checkbox names of the version list. */
export async function rowLabels(page: Page): Promise<string[]> {
  const names = await versionList(page)
    .getByRole('listitem')
    .getByRole('checkbox')
    .evaluateAll((boxes) => boxes.map((box) => box.getAttribute('aria-label') ?? ''));
  return names.map((name) => CHECKBOX_RE.exec(name)?.[1] ?? '');
}

/** Pair = exactly `[right, left]`: uncheck all (<= 2), then check both (the right one is the newer). */
export async function pickPair(page: Page, labels: readonly [string, string]): Promise<void> {
  const checked = versionList(page).getByRole('checkbox', { checked: true });
  // RR3: after the client-side hop (11P-A-029) the pick state was reset to the default pair (v6, v5) between two clicks (pickedPair state
  // cleared by a remount/re-hydration, useVersionHistory.ts:140-145), so the 3rd row was `disabled` (isPickable, pickedCount = 2). Redo the whole
  // pick until the pair holds; each attempt still asserts the end state, so a pair that never sticks still fails.
  await expect(async () => {
    for (let round = 0; round < 2 && (await checked.count()) > 0; round += 1) await checked.first().uncheck({ force: true, timeout: 3_000 }); // versionHistoryCompare.ts togglePick; force: the input is `sr-only` in a <label> (Checkbox.tsx:54,68), its painted box intercepts the pointer (RR call log)
    await expect(checked).toHaveCount(0, { timeout: 2_000 });
    for (const label of labels) await versionList(page).getByRole('checkbox', { name: `Chọn phiên bản ${label} để so sánh`, exact: true }).check({ force: true, timeout: 3_000 });
    await expect(checked).toHaveCount(2, { timeout: 2_000 });
    await expect(versionList(page).getByRole('checkbox', { checked: true, name: `Chọn phiên bản ${labels[0]} để so sánh`, exact: true })).toHaveCount(1, { timeout: 2_000 });
  }).toPass({ timeout: 20_000 });
}

export const confirmDialog = (page: Page): Locator => page.getByRole('dialog');

/** Opens `/versions?floorId=` (UVH container reads `?floorId=`) and waits for the list. */
export async function openVersions(page: Page, projectId: string, floorId: string): Promise<void> {
  await page.goto(`/projects/${projectId}/versions?floorId=${floorId}`);
  await expect(versionList(page).getByRole('listitem').first()).toBeVisible();
}

/** POST restore of the version with `sequence` (N17 list), at the floor's current layer revision; expects 201 (versions/router.py:64; 200 only on replay). */
export async function restoreViaApi(api: LayerApi, projectId: string, floorId: string, sequence: number): Promise<void> {
  const list = await api.request.get(`/api/projects/${projectId}/versions?floorId=${encodeURIComponent(floorId)}`, { headers: api.headers });
  expect(list.status(), 'setup: GET versions (N17)').toBe(200);
  const items = ((await list.json()) as { items: { id: string; sequence: number }[] }).items;
  const target = items.find((item) => item.sequence === sequence);
  if (target === undefined) throw new Error(`setup: no version with sequence ${String(sequence)}`);
  const { revision } = await readLayer(api, projectId, floorId);
  const res = await api.request.post(`/api/projects/${projectId}/versions/${target.id}/restore`, {
    headers: api.headers,
    data: { baseVersion: revision, body: { floorId } }, // client.ts:1469
  });
  expect(res.status(), `setup: POST restore v${String(sequence)}: ${(await res.text()).slice(0, 200)}`).toBe(201);
}
