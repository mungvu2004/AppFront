/**
 * Phase 8 — SCR-35 Training Jobs, UI verify (QA-08 P3): FL-35T-13 (real, read-only) and FL-35T-14 ([mocked response]).
 * `verifyUi` at 1920/1440/1024/768 (DESKTOP_VIEWPORTS), evidence `U08_<id>_training_<w>.png` + `.json`.
 * Never clicked: "Bắt đầu huấn luyện"; no POST /training-jobs reaches the server (guard aborts it).
 * Request budget: 1 admin UI sign-in per test (+1 engineer sign-in with shared pool user `p08-eng`, no invitation); 1 admin API login in FL-35T-14.
 */
import { expect, test, type Page } from '@playwright/test';

import { signInAdmin } from './support/auth';
import { typeHeight } from './support/numeric-field';
import { DESKTOP_VIEWPORTS, ROUTES, adminApi } from './support/p08/admin';
import { jobFixture, mockTraining, openCreateForm, openTraining, panelOrDrawer, panelRows } from './support/p08/P3';
import { poolUser, signInPoolUser } from './support/p08/pool';
import { verifyUi } from './support/ui-verify';

const JOBS = /\/api\/admin\/ml\/training-jobs(\?.*)?$/u;
const MODAL_SHOT = { fullPage: false } as const;
const VPS = DESKTOP_VIEWPORTS;

/** The only POST to training-jobs/** a test may see is a mocked cancel; a create is aborted. */
async function guardCreate(page: Page): Promise<{ count: () => number }> {
  let n = 0;
  await page.route(/\/api\/admin\/ml\/training-jobs$/u, async (route) => {
    if (route.request().method() !== 'POST') return route.fallback();
    n += 1;
    return route.abort();
  });
  return { count: () => n };
}

test.describe('P08 SCR-35 training UI', () => {
  test('SCR-35 · FL-35T-13 · UI thật: các trạng thái chỉ-đọc', async ({ page, browser }) => {
    test.setTimeout(240_000);
    await signInAdmin(page, ROUTES.jobs);
    const guard = await guardCreate(page);
    const eng = await browser.newContext();
    const admin = await adminApi();
    try {
      await test.step('[35T-F-001] tab "Lượt huấn luyện": no horizontal scroll, cards <1024, table min 640 px ≥1024', async () => {
        const m = await verifyUi(page, 'U08_35T-F-001_training', openTraining, VPS);
        for (const x of m) expect.soft(x.horizontalOverflowPx, `${x.viewport}`).toBe(0);
        await page.setViewportSize({ width: 1440, height: 900 });
        await openTraining(page);
        const table = page.getByRole('tabpanel').locator('table').first();
        if ((await table.count()) > 0) expect.soft((await table.boundingBox())?.width ?? 0).toBeGreaterThanOrEqual(640);
      });
      await test.step('[35T-F-003] filter "Đang huỷ": toolbar does not overflow', async () => {
        await verifyUi(page, 'U08_35T-F-003_training', async (p) => {
          await openTraining(p);
          const combo = p.getByRole('combobox', { name: 'Lọc theo trạng thái', exact: true });
          await combo.click();
          await p.getByRole('option', { name: 'Đang huỷ', exact: true }).click();
          await expect(combo).toContainText('Đang huỷ');
          await expect(p.locator('[aria-busy="true"]')).toHaveCount(0);
        }, VPS);
      });
      await test.step('[35T-F-012] ⚑ long "Lọc theo họ" at ≥1024: scrollWidth <= clientWidth, page not widened (BUG-584)', async () => {
        const bad: string[] = [];
        await verifyUi(page, 'U08_35T-F-012_training', async (p) => {
          await openTraining(p);
          const group = p.getByRole('radiogroup', { name: 'Lọc theo họ' });
          await expect(group).toBeVisible();
          const w = p.viewportSize()?.width ?? 0;
          if (w < 1024) return;
          const fits = await group.evaluate((el) => el.scrollWidth <= el.clientWidth);
          const page_ = await p.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth);
          if (!fits || !page_) bad.push(`${w}: group fits=${fits} page fits=${page_}`);
        }, VPS);
        expect.soft(bad, 'family filter inside its box and page not widened').toEqual([]);
      });
      await test.step('[35T-F-002] tab "Bộ dữ liệu": list stacks above the table <1024', async () => {
        await verifyUi(page, 'U08_35T-F-002_training', async (p) => {
          await openTraining(p);
          const tab = p.getByRole('tab', { name: 'Bộ dữ liệu', exact: true });
          await tab.click();
          await expect(tab).toHaveAttribute('aria-selected', 'true');
          await expect(p.getByText('Chưa có bộ dữ liệu', { exact: true }).or(p.getByRole('navigation', { name: 'Danh sách bộ dữ liệu', exact: true }))).toBeVisible();
        }, VPS);
      });
      await test.step('[35T-F-005] form open: SegmentedControl does not overflow the 560 modal', async () => {
        await verifyUi(page, 'U08_35T-F-005_training', async (p) => {
          const d = await openCreateForm(p);
          const radios = d.getByRole('radiogroup').first();
          await expect(radios).toBeVisible();
          expect.soft(await radios.evaluate((el) => el.scrollWidth <= el.clientWidth), 'segmented control fits').toBe(true);
        }, VPS, MODAL_SHOT);
      });
      await test.step('[35T-F-006] "Số vòng" = 0: refusal text not clipped', async () => {
        await verifyUi(page, 'U08_35T-F-006_training', async (p) => {
          const d = await openCreateForm(p);
          await typeHeight(d.getByLabel('Số vòng', { exact: true }), '0');
          await expect(d.getByText(/^Giá trị không nhỏ hơn 1\.$/u)).toBeVisible();
        }, VPS, MODAL_SHOT);
      });
      await test.step('[35T-F-010] engineer: "Không có quyền truy cập" centred', async () => {
        await signInPoolUser(eng, await poolUser(admin, 'engineer', 'p08-eng'));
        const ePage = await eng.newPage();
        await verifyUi(ePage, 'U08_35T-F-010_training', async (p) => {
          await p.goto(ROUTES.jobs);
          await expect(p.getByText('Không có quyền truy cập', { exact: false }).first()).toBeVisible({ timeout: 20_000 });
        }, VPS);
      });
      expect(guard.count(), 'no POST training-jobs').toBe(0);
    } finally {
      await eng.close();
      await admin.dispose();
    }
  });

  test('SCR-35 · FL-35T-14 · [mocked response] UI: chi tiết, lỗi, một phần, hộp huỷ', async ({ page }) => {
    test.setTimeout(240_000);
    await signInAdmin(page, ROUTES.jobs);
    const guard = await guardCreate(page);
    const one = [jobFixture(1, 'running')];
    const two = [jobFixture(2, 'running'), jobFixture(3, 'queued'), jobFixture(4, 'succeeded')];
    const state = { mode: 'ok' as 'ok' | '500', jobs: one, cancels: 0 };
    await mockTraining(page, state);
    await test.step('[35T-F-004] job detail with metrics and log (panel ≥1024, Drawer <1024), no overflow at 1024 (BUG-584)', async () => {
      const m = await verifyUi(page, 'U08_35T-F-004_training', async (p) => {
        await openTraining(p);
        await panelRows(p).first().click();
        const detail = panelOrDrawer(p, 'Chi tiết lượt huấn luyện');
        await expect(detail).toBeVisible();
        await expect(detail.getByRole('region', { name: 'Số đo', exact: true })).toBeVisible();
        await expect(detail.getByRole('region', { name: 'Nhật ký', exact: true })).toBeVisible();
        await expect(detail.getByText('qa-p08 log line 1', { exact: true })).toBeVisible();
      }, VPS, MODAL_SHOT);
      expect.soft(m.find((x) => x.viewport.startsWith('1024'))?.horizontalOverflowPx).toBe(0);
    });
    await test.step('[35T-F-007] GET 500: InlineAlert fits the frame', async () => {
      state.mode = '500';
      await verifyUi(page, 'U08_35T-F-007_training', async (p) => {
        await p.goto(ROUTES.jobs);
        await expect(p.getByRole('alert').first()).toBeVisible({ timeout: 20_000 });
      }, VPS);
      state.mode = 'ok';
    });
    await test.step('[35T-F-008] two active runs + row: attention strip and table', async () => {
      state.jobs = two;
      await verifyUi(page, 'U08_35T-F-008_training', async (p) => {
        await openTraining(p);
        await expect(panelRows(p)).toHaveCount(3);
      }, VPS);
    });
    await test.step('[35T-F-009] cancel dialog with error: modal 480 does not overflow at 768', async () => {
      const m = await verifyUi(page, 'U08_35T-F-009_training', async (p) => {
        await openTraining(p);
        await panelRows(p).first().click();
        await panelOrDrawer(p, 'Chi tiết lượt huấn luyện').getByRole('button', { name: 'Huỷ lượt', exact: true }).click(); // TrainingJobDetail.tsx:23
        const d = p.getByRole('dialog', { name: 'Huỷ lượt huấn luyện này?' });
        await expect(d).toBeVisible();
        await d.getByRole('button', { name: 'Huỷ lượt', exact: true }).click(); // confirm, answered by the mock (409)
        await expect(d.getByText('Lượt này vừa kết thúc nên không huỷ được nữa.', { exact: true })).toBeVisible(); // gateway:130
        const box = await d.boundingBox();
        expect.soft((box?.x ?? 0) + (box?.width ?? 0), 'dialog inside viewport').toBeLessThanOrEqual((p.viewportSize()?.width ?? 0) + 1);
      }, VPS, MODAL_SHOT);
      expect(m.length).toBe(VPS.length);
      expect(state.cancels, 'cancel answered by the mock only').toBeGreaterThan(0);
    });
    expect(guard.count(), 'no POST training-jobs').toBe(0);
  });
});
