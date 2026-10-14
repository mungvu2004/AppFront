/**
 * Phase 8 — SCR-36 Model Registry, UI verify (QA-08 P3): FL-36R-U1..U5. `verifyUi` at 1920/1440/1024/768,
 * evidence `U08_<id>_registry_<w>.png` + `.json`. Global state is never written: real flows only open/cancel dialogs behind
 * a PUT guard (asserted 0); U5 answers PUT from a mock. "Quay về đường cổ điển" is never confirmed.
 * Request budget: 1 admin UI sign-in per test (+1 engineer sign-in, shared pool user `p08-eng`, no invitation).
 */
import { expect, test, type Page, type Route } from '@playwright/test';

import { signInAdmin } from './support/auth';
import { DESKTOP_VIEWPORTS, ROUTES, adminApi } from './support/p08/admin';
import {
  FAMILY_LABELS,
  enabledActivate,
  fail500,
  fulfilEdited,
  guardWrites,
  openRegistry,
  openRegistryWhere,
  panelOrDrawer,
  picker,
  selectFamily,
  versionLabels,
} from './support/p08/P3';
import { poolUser, signInPoolUser } from './support/phase03Seed';
import { verifyUi } from './support/ui-verify';

const VPS = DESKTOP_VIEWPORTS;
const MODAL_SHOT = { fullPage: false } as const;
const VERSIONS = /\/api\/admin\/ml\/model-versions(\?.*)?$/u;
const ACTIVE_PUT = /\/api\/admin\/ml\/model-families\/[^/]+\/active$/u;

test.describe('P08 SCR-36 registry UI', () => {
  test('SCR-36 · FL-36R-U1 · Three families', async ({ page }) => {
    test.setTimeout(200_000);
    await signInAdmin(page, ROUTES.registry);
    await test.step('[36R-F-001] walls success: table + aside >= 1024, cards at 768', async () => {
      const m = await verifyUi(page, 'U08_36R-F-001_registry', (p) => openRegistry(p, 'walls'), VPS);
      expect(m.length).toBe(VPS.length);
    });
    await test.step('[36R-F-013] ⚑ no horizontal scroll at 1024', async () => {
      const m = await verifyUi(page, 'U08_36R-F-013_registry', async (p) => {
        await openRegistry(p, 'walls');
        if ((p.viewportSize()?.width ?? 0) === 1024) await expect(versionLabels(p).first().or(p.getByText('Chưa có phiên bản', { exact: true }))).toBeVisible();
      }, VPS);
      expect.soft(m.find((x) => x.viewport.startsWith('1024'))?.horizontalOverflowPx, 'scrollWidth <= innerWidth at 1024').toBe(0);
    });
    await test.step('[36R-F-014] picker fits at 768: all three radios inside the viewport', async () => {
      await verifyUi(page, 'U08_36R-F-014_registry', async (p) => {
        await openRegistry(p, 'walls');
        const vw = p.viewportSize()?.width ?? 0;
        for (const label of Object.values(FAMILY_LABELS)) {
          const box = await picker(p).getByRole('radio', { name: label, exact: true }).boundingBox();
          expect.soft((box?.x ?? -1) >= 0 && (box?.x ?? 0) + (box?.width ?? 0) <= vw, `${label} inside ${vw}`).toBe(true);
        }
      }, VPS);
    });
    await test.step('[36R-F-002] opening family: same layout', async () => {
      await verifyUi(page, 'U08_36R-F-002_registry', (p) => openRegistry(p, 'opening'), VPS);
    });
    await test.step('[36R-F-003] dimension family: same layout', async () => {
      await verifyUi(page, 'U08_36R-F-003_registry', (p) => openRegistry(p, 'dimension'), VPS);
    });
  });

  test('SCR-36 · FL-36R-U2 · Version detail and drawer', async ({ page }) => {
    test.setTimeout(150_000);
    await signInAdmin(page, ROUTES.registry);
    let narrowLabel: string | undefined;
    await test.step('[36R-F-004] select a label: aside >= 1024, Drawer "Chi tiết phiên bản" at 768', async () => {
      await verifyUi(page, 'U08_36R-F-004_registry', async (p) => {
        const label = await openRegistryWhere(p, versionLabels, 'no family has a model version');
        narrowLabel = (await label.innerText()).trim();
        await label.click();
        await expect(label).toHaveAttribute('aria-pressed', 'true');
        await expect(panelOrDrawer(p, 'Chi tiết phiên bản').getByRole('heading', { level: 2, name: narrowLabel, exact: true })).toBeVisible();
      }, VPS, MODAL_SHOT);
    });
    await test.step('[36R-E-010] drawer a11y at 768: role=dialog named, focus returns to the label on close', async () => {
      await page.setViewportSize({ width: 768, height: 1024 });
      const label = await openRegistryWhere(page, versionLabels, 'no family has a model version');
      await label.click();
      const drawer = page.getByRole('dialog', { name: 'Chi tiết phiên bản', exact: true });
      await expect.soft(drawer).toBeVisible();
      await page.keyboard.press('Escape');
      await expect.soft(label).toBeFocused();
    });
    await test.step('[36R-A-022] Esc closes the drawer: label aria-pressed=false', async () => {
      const label = versionLabels(page).first();
      await label.click();
      await expect(label).toHaveAttribute('aria-pressed', 'true');
      await page.keyboard.press('Escape');
      await expect.soft(label).toHaveAttribute('aria-pressed', 'false');
    });
  });

  test('SCR-36 · FL-36R-U3 · Dialogs', async ({ page }) => {
    test.setTimeout(150_000);
    await signInAdmin(page, ROUTES.registry);
    const guard = await guardWrites(page);
    await test.step('[36R-F-005] activate dialog open: fits each viewport, never confirmed', async () => {
      await verifyUi(page, 'U08_36R-F-005_registry', async (p) => {
        const btn = await openRegistryWhere(p, enabledActivate, 'CP-8 missing: no family has an evaluated onnx candidate (every "Kích hoạt" disabled)');
        await btn.click();
        const d = p.getByRole('dialog', { name: /^Kích hoạt .+ cho .+\?$/u });
        await expect(d).toBeVisible();
        const box = await d.boundingBox();
        const vp = p.viewportSize();
        expect.soft((box?.x ?? -1) >= 0 && (box?.x ?? 0) + (box?.width ?? 0) <= (vp?.width ?? 0), 'dialog inside the viewport').toBe(true);
      }, VPS, MODAL_SHOT);
    });
    await test.step('[36R-F-006] revert dialog open (wall): "Quay về đường cổ điển cho tách lớp tường?"', async () => {
      await verifyUi(page, 'U08_36R-F-006_registry', async (p) => {
        await openRegistry(p, 'walls');
        await p.getByRole('button', { name: 'Quay về đường cổ điển', exact: true }).click();
        await expect(p.getByRole('dialog', { name: 'Quay về đường cổ điển cho tách lớp tường?', exact: true })).toBeVisible();
      }, VPS, MODAL_SHOT);
    });
    expect(guard.count(), 'no PUT …/active attempted').toBe(0);
  });

  test('SCR-36 · FL-36R-U4 · Forbidden', async ({ browser }) => {
    test.setTimeout(100_000);
    const ctx = await browser.newContext();
    const admin = await adminApi();
    try {
      await signInPoolUser(ctx, await poolUser(admin, 'engineer', 'p08-eng'));
      const page = await ctx.newPage();
      await test.step('[36R-F-007] engineer: header + "Không có quyền truy cập"', async () => {
        await verifyUi(page, 'U08_36R-F-007_registry', async (p) => {
          await p.goto(ROUTES.registry);
          await expect(p.getByRole('heading', { level: 1, name: 'Model AI của chuỗi xử lý', exact: true })).toBeVisible({ timeout: 20_000 });
          await expect(p.getByText('Không có quyền truy cập', { exact: false }).first()).toBeVisible();
        }, VPS);
      });
    } finally {
      await ctx.close();
      await admin.dispose();
    }
  });

  test('SCR-36 · FL-36R-U5 · [mocked response] states', async ({ page }) => {
    test.setTimeout(240_000);
    await signInAdmin(page, ROUTES.registry);
    type Mode = 'real' | 'hold' | '500' | 'empty' | 'pending' | 'long';
    const state = { mode: 'real' as Mode, release: Promise.resolve(), puts: 0, put409: false };
    await page.route(VERSIONS, async (route: Route) => {
      if (route.request().method() !== 'GET') return route.fallback();
      if (state.mode === 'hold') {
        await state.release;
        return route.fallback();
      }
      if (state.mode === '500') return fail500(route);
      if (state.mode === 'real') return route.fallback();
      return fulfilEdited(route, (b) => {
        const items = b.items as Record<string, unknown>[];
        if (state.mode === 'empty') b.items = [];
        else if (items[0] !== undefined && state.mode === 'pending') {
          const { metrics: _m, ...rest } = items[0];
          void _m;
          items[0] = { ...rest, evaluationStatus: 'pending' };
        } else if (items[0] !== undefined) items[0] = { ...items[0], label: 'L'.repeat(90) };
        delete b.nextCursor;
      });
    });
    await page.route(ACTIVE_PUT, async (route) => {
      if (route.request().method() !== 'PUT') return route.fallback();
      state.puts += 1;
      // body = VersionConflictBodySchema (errors.ts:234), remoteChanges [] (adminMl.ts:174)
      return route.fulfill({ status: 409, contentType: 'application/json', body: JSON.stringify({ code: 'VERSION_CONFLICT', currentVersion: 1, remoteChanges: [], requestId: 'req_qa_p08' }) });
    });
    const open = async (p: Page, mode: Mode): Promise<void> => {
      state.mode = mode;
      await p.goto(ROUTES.registry);
      await expect(picker(p)).toBeVisible({ timeout: 20_000 });
    };
    await test.step('[36R-F-008] loading hold: skeletons', async () => {
      await verifyUi(page, 'U08_36R-F-008_registry', async (p) => {
        let go: () => void = () => undefined;
        state.release = new Promise<void>((r) => {
          go = r;
        });
        await open(p, 'hold');
        await expect(p.locator('[aria-busy="true"]').first()).toBeVisible();
        go();
      }, VPS);
    });
    await test.step('[36R-F-009] read error: "Không đọc được danh sách model" + picker', async () => {
      await verifyUi(page, 'U08_36R-F-009_registry', async (p) => {
        await open(p, '500');
        await expect(p.getByText('Không đọc được danh sách model', { exact: true })).toBeVisible();
        await expect(picker(p)).toBeVisible();
      }, VPS);
    });
    await test.step('[36R-F-010] empty family: "Chưa có phiên bản"', async () => {
      await verifyUi(page, 'U08_36R-F-010_registry', async (p) => {
        await open(p, 'empty');
        await expect(p.getByText('Chưa có phiên bản', { exact: true })).toBeVisible();
      }, VPS);
    });
    await test.step('[36R-F-011] partial: notice above the table', async () => {
      await verifyUi(page, 'U08_36R-F-011_registry', async (p) => {
        await open(p, 'pending');
        await expect(p.getByText('1 phiên bản đang chờ hoặc đang đánh giá; chỉ kích hoạt được bản đã đánh giá.', { exact: true })).toBeVisible(); // useModelRegistry.ts:178
      }, VPS);
    });
    await test.step('[36R-F-012] conflict notice + dialog with error and warning: stacked alerts, no overflow', async () => {
      await verifyUi(page, 'U08_36R-F-012_registry', async (p) => {
        state.mode = 'real';
        const btn = await openRegistryWhere(p, enabledActivate, 'CP-8 missing: no evaluated onnx candidate to activate (PUT is mocked, the button must be enabled)');
        await btn.click();
        const d = p.getByRole('dialog', { name: /^Kích hoạt .+ cho .+\?$/u });
        await d.getByRole('button', { name: 'Kích hoạt', exact: true }).click(); // PUT answered by the mock (409)
        await expect(p.getByRole('alert').first()).toBeVisible();
      }, VPS, MODAL_SHOT);
      expect(state.puts, 'PUT answered by the mock').toBeGreaterThan(0);
    });
    await test.step('[36R-F-015] label of 90 chars: capture at 4 sizes', async () => {
      await verifyUi(page, 'U08_36R-F-015_registry', async (p) => {
        await open(p, 'long');
        await expect(p.getByText('L'.repeat(90)).first()).toBeVisible();
      }, VPS);
    });
    await test.step('[36R-B-028] truncation: card/table label truncate, detail h2 wraps, no horizontal scroll', async () => {
      await verifyUi(page, 'U08_36R-B-028_registry', async (p) => {
        await open(p, 'long');
        const label = versionLabels(p).first();
        await expect(label).toBeVisible();
        expect.soft(await label.evaluate((el) => (el.querySelector('.truncate') ?? el.closest('.truncate') ?? el.parentElement?.closest('.truncate')) !== null), 'label truncates').toBe(true);
        await label.click();
        const h2 = panelOrDrawer(p, 'Chi tiết phiên bản').getByRole('heading', { level: 2 });
        await expect(h2).toBeVisible();
        expect.soft(await h2.evaluate((el) => el.scrollWidth <= el.clientWidth), 'detail h2 wraps').toBe(true);
      }, VPS, MODAL_SHOT);
    });
    state.mode = 'real';
    await openRegistry(page, 'walls');
    await selectFamily(page, 'walls'); // ends on a real answer
  });
});
