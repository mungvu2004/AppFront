/**
 * Phase 8 · SCR-36 Model AI registry (`/admin/training/models`) — real edge flows FL-36R-01..05 (C3). Read-only: dialogs are
 * only opened and cancelled behind `guardWrites` (PUT …/active aborted + counted, asserted 0); "Quay về đường cổ điển" is never confirmed.
 * Sources: MR/MRA/MRV/MRD/UMR (src/screens/admin/ModelRegistry/), SEG (src/components/ui/SegmentedControl.tsx); see support/p08/P7.ts.
 *
 * Request budget per run (BE defaults): admin UI logins 1 (FL-01) + 1 (FL-02) + 1 (FL-03) + 1 (FL-04) + 1 admin API (FL-04 candidate)
 * + 2 (FL-05: admin ctx + admin API for the pool) = 7 logins; pool users `p08-eng` / `p08-view` are shared read-only slots
 * (Quyết định S2.1), 0 new invitations when the pool is warm, at most 2 when cold. `/api/admin/ml/*` are reads only, no rate limit.
 */
import { expect, test, type Locator, type Page } from '@playwright/test';

import { loginUrl, pathOf } from '../../e2e/fixtures/routes';
import { readBaseUrl } from '../../e2e/fullstack/env';
import { poolUser, signInPoolUser } from './support/p08/pool';
import { captureEvidence } from './support/evidence';
import { adminApi } from './support/p08/admin';
import {
  ACTIVE_PUT,
  EVALUATION_LABEL,
  FAMILY_ORDER,
  REG,
  REGISTRY_PATH,
  VERSIONS,
  activateTitle,
  activeCard,
  detailAside,
  guardWrites,
  openRegistry,
  picker,
  pickCandidate,
  radio,
  recordRequests,
  revertTitle,
  selectFamily,
  str,
  versionRow,
  type Family,
  type Json,
} from './support/p08/P7';

const ev = (page: Page, id: string, caption?: string): Promise<string> => captureEvidence(page, `E08_${id}_registry.png`, caption === undefined ? {} : { caption });
const labelButton = (page: Page, label: string): Locator => versionRow(page, label).getByRole('button', { name: label, exact: true });
const activeIdOf = (families: readonly Json[], family: Family): string | null => {
  const r = families.find((f) => f.family === family);
  return typeof r?.activeVersionId === 'string' ? r.activeVersionId : null;
};

test.describe('E08 SCR-36 registry (real)', () => {
  test.setTimeout(120_000);

  test('SCR-36 · FL-36R-01 · Open, header, wall state, table', async ({ browser }) => {
    const { context, page, families, walls, reads, detailReads } = await openRegistry(browser);
    try {
      const wallActive = activeIdOf(families, 'wallSegmentation');
      const crumb = page.getByRole('navigation', { name: 'Đường dẫn trang', exact: true });
      await test.step('[36R-A-001] open as admin: breadcrumb + h1', async () => {
        await expect(crumb.getByText(REG.crumbParent, { exact: true })).toBeVisible(); // MR:51-55
        await expect(crumb.getByText(REG.crumbHere, { exact: true })).toHaveAttribute('aria-current', 'page');
        await expect(page.getByRole('heading', { level: 1, name: REG.title, exact: true })).toBeVisible();
        await ev(page, '36R-A-001');
      });
      await test.step('[36R-E-009] breadcrumb semantics', async () => {
        await expect.soft(crumb).toBeVisible();
        await expect.soft(crumb.locator('[aria-hidden="true"]', { hasText: '›' }).first()).toBeAttached();
        await ev(page, '36R-E-009');
      });
      await test.step('[36R-A-003] default family', async () => {
        await expect.soft(radio(page, 'wallSegmentation')).toHaveAttribute('aria-checked', 'true'); // UMR:383,404-409
        await ev(page, '36R-A-003');
      });
      await test.step('[36R-G-001] arrival read of families', async () => {
        expect.soft(reads.families.response.status(), 'GET model-families status').toBe(200);
        expect.soft(families.map((f) => str(f, 'family')).sort(), 'three records').toEqual([...FAMILY_ORDER].sort());
        await ev(page, '36R-G-001');
      });
      await test.step('[36R-G-002] versions read, no cursor', async () => {
        expect.soft(reads.versions.response.status(), 'GET model-versions status').toBe(200);
        expect.soft(new URL(reads.versions.response.url()).searchParams.get('family')).toBe('wallSegmentation');
        expect.soft(new URL(reads.versions.response.url()).searchParams.has('cursor'), 'no cursor on first page').toBe(false);
        await ev(page, '36R-G-002');
      });
      await test.step('[36R-E-001] picker semantics', async () => {
        await expect.soft(picker(page)).toBeVisible();
        await expect.soft(picker(page).getByRole('radio')).toHaveCount(3); // SEG:69,108
        await ev(page, '36R-E-001');
      });
      await test.step('[36R-E-008] card region', async () => {
        await expect.soft(activeCard(page)).toBeVisible(); // MR:90-95
        await ev(page, '36R-E-008');
      });
      const card = activeCard(page);
      await test.step('[36R-B-001] wall card (branch on real record)', async () => {
        if (wallActive === null) {
          await expect.soft(card).toContainText('Đường cổ điển'); // UMR:235-243
          await expect.soft(card.getByRole('button', { name: REG.revert, exact: true })).toHaveCount(0);
        } else {
          const active = walls.find((v) => v.id === wallActive);
          expect.soft(active, 'environment: active wall version is in the first page').toBeDefined();
          await expect.soft(card).toContainText(str(active ?? {}, 'label'));
          await expect.soft(card).toContainText(/IoU \d,\d{3}/u); // UMR:246-253
          await expect.soft(card.getByRole('button', { name: REG.revert, exact: true })).toHaveCount(1);
        }
        await ev(page, '36R-B-001');
      });
      await test.step('[36R-G-005] active version read (UI request)', async () => {
        if (wallActive === null) {
          expect.soft(detailReads(), 'classic path: no GET model-versions/<id>').toEqual([]);
        } else {
          await expect.poll(detailReads, { message: 'UI reads the active version (UMR:415-419)' }).toContain(`GET ${VERSIONS}/${wallActive}`);
        }
        await ev(page, '36R-G-005');
      });
      await test.step('[36R-B-005] table header', async () => {
        const table = page.getByRole('table');
        if (walls.length === 0) {
          // Q13: stack has no wall versions and none may be activated; catalog 36R-B-012 = empty wall family shows the explanation, no table.
          await expect.soft(page.getByText(REG.emptyTitle, { exact: true })).toBeVisible();
          await expect.soft(page.getByText(wallActive === null ? REG.emptyWall : REG.emptyWall.replace(' Đang dùng đường cổ điển.', ''), { exact: true })).toBeVisible();
          await expect.soft(table).toHaveCount(0);
        } else {
          for (const h of REG.headers) await expect.soft(table.getByRole('columnheader', { name: h, exact: true })).toBeVisible(); // MRV:118-119
          await expect.soft(table.locator('th.sr-only, th .sr-only').filter({ hasText: 'Thao tác' })).toHaveCount(1);
        }
        await ev(page, '36R-B-005');
      });
      await test.step('[36R-B-006] row cells vs API', async () => {
        const labels = walls.map((v) => str(v, 'label'));
        await expect.soft(page.locator('tbody tr')).toHaveCount(walls.length);
        for (const v of walls) {
          const label = str(v, 'label');
          if (labels.filter((l) => l === label).length > 1) continue; // ambiguous row
          const row = versionRow(page, label);
          if (v.id !== wallActive) await expect.soft(row).toContainText(EVALUATION_LABEL[str(v, 'evaluationStatus')] ?? ''); // UMR:102-107
          const metric = (v.metrics as Json | undefined)?.iou;
          const cell = row.locator('td').nth(3); // MRV:134 metric cell
          if (typeof metric === 'number') await expect.soft(cell).toHaveText(`IoU ${metric.toFixed(3).replace('.', ',')}`);
          else await expect.soft(cell).toHaveText('—');
        }
        await ev(page, '36R-B-006');
      });
      await test.step('[36R-B-007] active row', async () => {
        const active = walls.find((v) => v.id === wallActive);
        if (active === undefined) {
          await expect.soft(page.locator('tbody').getByText(REG.active, { exact: true }), 'no active wall -> no "Đang dùng" row badge').toHaveCount(0);
        } else {
          const row = versionRow(page, str(active, 'label'));
          await expect.soft(row).toContainText(REG.active); // MRV:144-146
          await expect.soft(row.getByRole('button', { name: REG.activate, exact: true })).toHaveCount(0);
        }
        await ev(page, '36R-B-007');
      });
    } finally {
      await context.close();
    }
  });

  test('SCR-36 · FL-36R-02 · Families, keyboard, blocked rows, link', async ({ browser }) => {
    const { context, page, families, walls } = await openRegistry(browser);
    const versionsOf: Record<Family, Json[]> = { wallSegmentation: walls, openingAndFurnitureDetection: [], dimensionReading: [] };
    /** Shows `family` (click only when not yet selected) and returns its versions. */
    const show = async (family: Family): Promise<Json[]> => {
      if ((await radio(page, family).getAttribute('aria-checked')) !== 'true') versionsOf[family] = await selectFamily(page, family);
      return versionsOf[family];
    };
    try {
      await test.step('[36R-A-004] click "Nhận diện cửa và đồ đạc"', async () => {
        versionsOf.openingAndFurnitureDetection = await selectFamily(page, 'openingAndFurnitureDetection');
        await expect(radio(page, 'openingAndFurnitureDetection')).toHaveAttribute('aria-checked', 'true'); // UMR:567-573
        await ev(page, '36R-A-004');
      });
      await test.step('[36R-A-005] click "Đọc kích thước"', async () => {
        versionsOf.dimensionReading = await selectFamily(page, 'dimensionReading');
        await expect.soft(radio(page, 'dimensionReading')).toHaveAttribute('aria-checked', 'true');
        await ev(page, '36R-A-005');
      });
      const nonWall: Family[] = ['openingAndFurnitureDetection', 'dimensionReading'];
      await test.step('[36R-B-003] non-wall family without active', async () => {
        const without = nonWall.filter((f) => activeIdOf(families, f) === null);
        for (const f of without) {
          await show(f);
          await expect.soft(activeCard(page), f).toContainText(REG.noActive); // UMR:241
          await expect.soft(activeCard(page).getByRole('button', { name: REG.revert, exact: true })).toHaveCount(0);
        }
        await expect.soft(activeCard(page)).toBeVisible();
        await ev(page, '36R-B-003', `families without active: ${without.join(', ') || 'none'}`);
      });
      await test.step('[36R-B-004] non-wall family with active', async () => {
        const withActive = nonWall.filter((f) => activeIdOf(families, f) !== null);
        for (const f of withActive) {
          await show(f);
          await expect.soft(activeCard(page).getByRole('button', { name: REG.revert, exact: true }), f).toHaveCount(0); // UMR:247
        }
        await expect.soft(activeCard(page)).toBeVisible();
        await ev(page, '36R-B-004', `families with active: ${withActive.join(', ') || 'none'}`);
      });
      await test.step('[36R-E-002] ArrowRight/ArrowLeft with wrap', async () => {
        await show('wallSegmentation');
        await radio(page, 'wallSegmentation').focus();
        for (const next of ['openingAndFurnitureDetection', 'dimensionReading', 'wallSegmentation'] as const) {
          await page.keyboard.press('ArrowRight'); // SEG:128-141
          await expect.soft(radio(page, next)).toHaveAttribute('aria-checked', 'true');
        }
        await page.keyboard.press('ArrowLeft');
        await expect.soft(radio(page, 'dimensionReading')).toHaveAttribute('aria-checked', 'true');
        await expect.soft(radio(page, 'dimensionReading')).toBeFocused();
        await ev(page, '36R-E-002');
      });
      await test.step('[36R-E-003] roving tabindex + arrows relative to the focused radio (flag)', async () => {
        const tabStops = await picker(page).getByRole('radio').evaluateAll((els) => els.filter((e) => (e as HTMLElement).tabIndex >= 0).length);
        expect.soft(tabStops, 'one tab stop in the radiogroup').toBe(1); // SEG:69-80
        await show('wallSegmentation');
        await radio(page, 'openingAndFurnitureDetection').focus(); // focused != selected
        await page.keyboard.press('ArrowRight');
        await expect.soft(radio(page, 'dimensionReading'), 'arrow moves relative to the FOCUSED radio').toHaveAttribute('aria-checked', 'true');
        await ev(page, '36R-E-003');
      });
      await test.step('[36R-E-004] tab order', async () => {
        await show('wallSegmentation');
        await page.getByRole('link', { name: REG.related, exact: true }).focus();
        await page.keyboard.press('Tab');
        await expect.soft(radio(page, 'wallSegmentation'), 'Tab 1 -> picker').toBeFocused(); // MR:91-95
        await page.keyboard.press('Tab');
        const revert = activeCard(page).getByRole('button', { name: REG.revert, exact: true });
        if (activeIdOf(families, 'wallSegmentation') !== null) await expect.soft(revert, 'Tab 2 -> revert').toBeFocused();
        else await expect.soft(revert).toHaveCount(0);
        await page.keyboard.press('Tab');
        await expect.soft(page.locator('tbody tr:first-child').locator(':focus'), 'Tab 3 -> first row control').toHaveCount(1);
        await expect.soft(activeCard(page), 'card is not a stop').not.toBeFocused();
        await ev(page, '36R-E-004');
      });
      const blocked = async (): Promise<{ family: Family; version: Json } | null> => {
        for (const f of FAMILY_ORDER) {
          const v = versionsOf[f].find((x) => x.evaluationStatus !== 'completed' && x.id !== activeIdOf(families, f));
          if (v !== undefined) return { family: f, version: v };
        }
        return null;
      };
      await test.step('[36R-B-008] blocked not-evaluated row', async () => {
        const hit = await blocked();
        if (hit === null) {
          expect.soft(hit, 'no pending/running/failed version in any family (branch: nothing to block)').toBeNull();
        } else {
          await show(hit.family);
          const row = versionRow(page, str(hit.version, 'label'));
          await expect.soft(row.getByRole('button', { name: REG.activate, exact: true })).toBeDisabled(); // MRV:148-158
          await expect.soft(row).toContainText(REG.blockedNotEvaluated);
        }
        await ev(page, '36R-B-008');
      });
      await test.step('[36R-E-006] blocked described by reason', async () => {
        const hit = await blocked();
        if (hit === null) {
          expect.soft(hit, 'no blocked row to describe').toBeNull();
        } else {
          await show(hit.family);
          const button = versionRow(page, str(hit.version, 'label')).getByRole('button', { name: REG.activate, exact: true });
          const id = await button.getAttribute('aria-describedby');
          expect.soft(id, 'aria-describedby').not.toBeNull(); // MRV:151-157
          if (id !== null) await expect.soft(page.locator(`[id="${id}"]`)).toHaveText(REG.blockedNotEvaluated);
        }
        await ev(page, '36R-E-006');
      });
      await test.step('[36R-B-010] partial notice with N from the API', async () => {
        for (const f of FAMILY_ORDER) {
          await show(f);
          const n = versionsOf[f].filter((v) => v.evaluationStatus === 'pending' || v.evaluationStatus === 'running').length;
          if (n > 0) await expect.soft(page.getByText(`${String(n)} ${REG.partialTail}`, { exact: true }), f).toBeVisible(); // UMR:178-180
          else await expect.soft(page.getByText(REG.partialTail, { exact: false }), f).toHaveCount(0);
        }
        await ev(page, '36R-B-010');
      });
      await test.step('[36R-A-002] link "Lượt huấn luyện" and Back', async () => {
        await page.getByRole('link', { name: REG.related, exact: true }).click();
        await expect.poll(() => pathOf(page.url())).toBe('/admin/training/jobs');
        await ev(page, '36R-A-002');
        await page.goBack();
        await expect.poll(() => pathOf(page.url())).toBe(REGISTRY_PATH);
      });
    } finally {
      await context.close();
    }
  });

  test('SCR-36 · FL-36R-03 · Version detail', async ({ browser }) => {
    const { context, page, walls, families } = await openRegistry(browser);
    try {
      let family: Family = 'wallSegmentation';
      let versions: Json[] = walls;
      for (const next of FAMILY_ORDER.slice(1)) {
        if (versions.length > 0) break;
        family = next;
        versions = await selectFamily(page, next);
      }
      expect.soft(versions.length, 'environment: at least one model version in some family').toBeGreaterThan(0);
      const first = versions[0] ?? {};
      const label = str(first, 'label');
      const id = str(first, 'id');
      const aside = detailAside(page);
      await test.step('[36R-B-017] placeholder before any selection', async () => {
        await expect(aside).toContainText(REG.placeholder); // MRD:13-17
        await ev(page, '36R-B-017');
      });
      const detailRec = recordRequests(page, (u) => u.pathname.startsWith(`${VERSIONS}/`));
      await test.step('[36R-A-007] click first label', async () => {
        await labelButton(page, label).click();
        await expect.soft(labelButton(page, label)).toHaveAttribute('aria-pressed', 'true'); // MRV:29-40
        await expect.soft(aside.getByRole('heading', { level: 2, name: label, exact: true })).toBeVisible();
        await ev(page, '36R-A-007');
      });
      await test.step('[36R-G-004] detail read', async () => {
        const wasActive = first.id === activeIdOf(families, family);
        if (wasActive) await expect.soft(aside.getByRole('heading', { level: 2, name: label, exact: true }), 'active version: detail may come from cache').toBeVisible();
        else await expect.poll(detailRec.list, { message: 'UI reads the version (UMR:421-425)' }).toContain(`GET ${VERSIONS}/${id}`);
        await ev(page, '36R-G-004');
      });
      await test.step('[36R-B-018] detail fields', async () => {
        for (const f of REG.fields) await expect.soft(aside.locator('dt', { hasText: new RegExp(`^\\s*${f}\\s*$`, 'u') })).toBeVisible(); // MRD:78-98
        await ev(page, '36R-B-018');
      });
      const seed = versions.find((v) => str(v, 'label') === 'Gốc' && str(v, 'creatorId') === 'system:pipeline');
      await test.step('[36R-B-020] seed note (branch)', async () => {
        if (seed !== undefined) {
          await labelButton(page, 'Gốc').click();
          await expect.soft(aside).toContainText(REG.seedNote); // UMR:124,296
        } else {
          await expect.soft(aside, 'no seed version in this family').not.toContainText(REG.seedNote);
        }
        await ev(page, '36R-B-020');
      });
      const second = versions.find((v) => str(v, 'label') !== label);
      await test.step('[36R-A-008] second label', async () => {
        expect.soft(second, 'environment: family has >= 2 distinctly labelled versions').toBeDefined();
        if (second !== undefined) {
          await labelButton(page, str(second, 'label')).click();
          await expect.soft(labelButton(page, label)).toHaveAttribute('aria-pressed', 'false'); // UMR:739
          await expect.soft(aside.getByRole('heading', { level: 2, name: str(second, 'label'), exact: true })).toBeVisible();
        }
        await ev(page, '36R-A-008');
      });
      await test.step('[36R-E-005] Enter and Space on a label', async () => {
        await labelButton(page, label).focus();
        await page.keyboard.press('Enter');
        await expect.soft(labelButton(page, label)).toHaveAttribute('aria-pressed', 'true'); // MRV:130-136
        const other = second === undefined ? label : str(second, 'label');
        await labelButton(page, other).focus();
        await page.keyboard.press('Space');
        await expect.soft(labelButton(page, other)).toHaveAttribute('aria-pressed', 'true');
        await expect.soft(aside.getByRole('heading', { level: 2, name: other, exact: true })).toBeVisible();
        await ev(page, '36R-E-005');
      });
      await test.step('[36R-A-009] click the pressed label again (flag)', async () => {
        const pressed = await page.locator('tbody button[aria-pressed="true"]').first().textContent();
        await page.locator('tbody button[aria-pressed="true"]').first().click();
        await expect.soft(page.locator('tbody button[aria-pressed="true"]'), `"${pressed ?? ''}" toggles off`).toHaveCount(0); // MRV:131-133
        await expect.soft(aside).toContainText(REG.placeholder);
        await ev(page, '36R-A-009');
      });
      await test.step('[36R-A-006] select a label, switch family', async () => {
        await labelButton(page, label).click();
        await expect.soft(labelButton(page, label)).toHaveAttribute('aria-pressed', 'true');
        const other = FAMILY_ORDER.find((f) => f !== family) ?? 'dimensionReading';
        await selectFamily(page, other);
        await expect.soft(detailAside(page)).toContainText(REG.placeholder); // UMR:569
        await ev(page, '36R-A-006');
      });
    } finally {
      await context.close();
    }
  });

  test('SCR-36 · FL-36R-04 · Dialogs open and cancel', async ({ browser }) => {
    const api = await adminApi();
    const cand = await pickCandidate(api);
    await api.dispose();
    const { context, page } = await openRegistry(browser);
    const guard = await guardWrites(page, 'PUT', ACTIVE_PUT);
    const family: Family = 'openingAndFurnitureDetection';
    const missing = 'environment: no completed onnx non-active candidate in openingAndFurnitureDetection (CP-8 missing)';
    try {
      if (cand !== null) await selectFamily(page, family);
      const activate = (): Locator => versionRow(page, cand?.label ?? '').getByRole('button', { name: REG.activate, exact: true });
      const dlg = (): Locator => page.getByRole('dialog', { name: activateTitle(cand?.label ?? '', family), exact: true });
      await test.step('[36R-A-010] "Kích hoạt" on candidate row opens the dialog', async () => {
        expect(cand !== null, missing).toBe(true);
        if (cand === null) return;
        await activate().click(); // UMR:575-585
        await expect(dlg()).toBeVisible(); // UMR:160-162
        await expect(dlg()).toContainText(REG.dialogBody);
        await ev(page, '36R-A-010');
      });
      await test.step('[36R-E-007] dialog a11y', async () => {
        expect.soft(cand !== null, missing).toBe(true);
        if (cand === null) return;
        await expect(dlg().locator(':focus')).toHaveCount(1); // focus trap armed (rAF)
        await expect.soft(dlg()).toHaveAttribute('aria-modal', 'true'); // Modal.tsx:210-212
        const inside = (): Promise<boolean> => dlg().evaluate((el) => el.contains(document.activeElement));
        for (let i = 0; i < 3; i += 1) {
          await page.keyboard.press('Tab');
          expect.soft(await inside(), `Tab ${String(i + 1)} stays inside`).toBe(true);
        }
        for (let i = 0; i < 3; i += 1) {
          await page.keyboard.press('Shift+Tab');
          expect.soft(await inside(), `Shift+Tab ${String(i + 1)} stays inside`).toBe(true);
        }
        await ev(page, '36R-E-007');
      });
      await test.step('[36R-A-016] "Huỷ" closes, no PUT', async () => {
        expect.soft(cand !== null, missing).toBe(true);
        if (cand === null) return;
        await dlg().getByRole('button', { name: REG.cancel, exact: true }).click(); // MRA:35-37
        await expect.soft(page.getByRole('dialog')).toHaveCount(0);
        expect.soft(guard.count(), 'PUT count').toBe(0);
        await ev(page, '36R-A-016');
      });
      await test.step('[36R-A-017] reopen, Esc, focus returns', async () => {
        expect.soft(cand !== null, missing).toBe(true);
        if (cand === null) return;
        await activate().click();
        await expect.soft(dlg()).toBeVisible();
        await expect(dlg().locator(':focus')).toHaveCount(1); // focus trap armed (rAF)
        await page.keyboard.press('Escape'); // Modal.tsx:76-78
        await expect.soft(page.getByRole('dialog')).toHaveCount(0);
        await expect.soft(activate(), 'focus returns to the opener').toBeFocused();
        expect.soft(guard.count(), 'PUT count').toBe(0);
        await ev(page, '36R-A-017');
      });
      await test.step('[36R-A-018] wall revert dialog then "Huỷ"', async () => {
        await selectFamily(page, 'wallSegmentation');
        const revert = activeCard(page).getByRole('button', { name: REG.revert, exact: true });
        await expect.soft(revert, 'environment: wall has an active version').toHaveCount(1);
        if ((await revert.count()) === 1) {
          await revert.click(); // UMR:164-166
          const d = page.getByRole('dialog', { name: revertTitle('wallSegmentation'), exact: true });
          await expect.soft(d).toBeVisible();
          await expect.soft(d).toContainText(REG.revertBody);
          await expect.soft(d.getByRole('button', { name: REG.revert, exact: true })).toBeVisible();
          await ev(page, '36R-A-018');
          await d.getByRole('button', { name: REG.cancel, exact: true }).click();
          await expect.soft(page.getByRole('dialog')).toHaveCount(0);
        }
        expect.soft(guard.count(), 'PUT count after all dialogs closed').toBe(0);
      });
    } finally {
      await guard.release();
      await context.close();
    }
  });

  test('SCR-36 · FL-36R-05 · Roles', async ({ browser }) => {
    const api = await adminApi();
    const [eng, view] = [await poolUser(api, 'engineer', 'p08-eng'), await poolUser(api, 'viewer', 'p08-view')];
    await api.dispose();
    const { context: adminCtx, page: adminPage, walls } = await openRegistry(browser);
    const contexts = [adminCtx];
    const base = readBaseUrl();
    const forbidden = async (user: typeof eng): Promise<{ page: Page; reads: string[] }> => {
      const context = await browser.newContext({ baseURL: base, viewport: { width: 1440, height: 900 } });
      contexts.push(context);
      await signInPoolUser(context, user);
      const page = await context.newPage();
      const rec = recordRequests(page, (u) => u.pathname.startsWith('/api/admin/ml'));
      await page.goto(REGISTRY_PATH);
      await expect(page.getByRole('heading', { name: REG.forbiddenTitle, exact: true })).toBeVisible(); // UMR:395-396, MR:172-178
      rec.stop();
      return { page, reads: rec.list() };
    };
    try {
      await test.step('[36R-D-001] admin sees picker, card, table', async () => {
        await expect(picker(adminPage)).toBeVisible();
        await expect(activeCard(adminPage)).toBeVisible();
        // Q13: no wall versions on the stack -> the wall family shows the empty state instead of the table (catalog 36R-B-012)
        if (walls.length === 0) await expect(adminPage.getByText(REG.emptyTitle, { exact: true })).toBeVisible();
        else await expect(adminPage.getByRole('table')).toBeVisible();
        await ev(adminPage, '36R-D-001');
      });
      let engineer: { page: Page; reads: string[] } | undefined;
      await test.step('[36R-D-002] engineer: forbidden copy, no picker', async () => {
        engineer = await forbidden(eng);
        await expect.soft(engineer.page.getByText(REG.forbiddenBody, { exact: true })).toBeVisible();
        await expect.soft(picker(engineer.page)).toHaveCount(0);
        await ev(engineer.page, '36R-D-002');
      });
      await test.step('[36R-G-009] engineer: zero /api/admin/ml requests', async () => {
        expect.soft(engineer?.reads ?? ['engineer step did not run'], 'requests to /api/admin/ml').toEqual([]);
        if (engineer !== undefined) await ev(engineer.page, '36R-G-009');
      });
      await test.step('[36R-D-003] viewer: same forbidden copy', async () => {
        const v = await forbidden(view);
        await expect.soft(v.page.getByText(REG.forbiddenBody, { exact: true })).toBeVisible();
        await expect.soft(picker(v.page)).toHaveCount(0);
        expect.soft(v.reads, 'viewer requests to /api/admin/ml').toEqual([]);
        await ev(v.page, '36R-D-003');
      });
      await test.step('[36R-D-004] anonymous: login redirect, no /api/admin request', async () => {
        const context = await browser.newContext({ baseURL: base, viewport: { width: 1440, height: 900 } });
        contexts.push(context);
        const page = await context.newPage();
        const rec = recordRequests(page, (u) => u.pathname.startsWith('/api/admin'));
        await page.goto(REGISTRY_PATH);
        await expect.poll(() => pathOf(page.url())).toBe(loginUrl(REGISTRY_PATH));
        await expect(page.getByRole('button', { name: 'Đăng nhập', exact: true })).toBeVisible();
        rec.stop();
        expect.soft(rec.list(), 'requests to /api/admin').toEqual([]);
        await ev(page, '36R-D-004');
      });
    } finally {
      for (const c of contexts) await c.close();
    }
  });
});

