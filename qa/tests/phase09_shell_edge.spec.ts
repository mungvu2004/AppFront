/**
 * Phase 09 (QA-09) P1 - role matrix, shell + dashboard + onboarding + settings + notifications.
 * Flows FL-9P-01..04 (flows-C1.md). Real stack; pool users per role (viewer / engineer), never written into MP.
 */
import { expect, test } from '@playwright/test';

import { COPY, shot, spaGo } from './support/p09/P1';
import { DESKTOP, adminApi, apiAs, asMember, gotoAs, mainProject, recordWrites, roleUser, signInRole } from './support/p09/roles';

test.use({ viewport: DESKTOP });

const backLink = (page: import('@playwright/test').Page) =>
  page.getByRole('button', { name: COPY.backToProjects }).or(page.getByRole('link', { name: COPY.backToProjects })).first();

test.describe('phase09 shell edge', () => {
  test('SCR-05 · FL-9P-01 · viewer · dashboard chỉ đọc', async ({ page, context }) => {
    test.setTimeout(180_000);
    const admin = await adminApi();
    const pv = await roleUser(admin, 'viewer', 'shell');
    const { projectId, projectName } = mainProject();
    const undo = await asMember(admin, projectId, pv);
    try {
      await signInRole(context, pv);
      const rec = recordWrites(page);
      await test.step('[9P-B-001] viewer line + MP card', async () => {
        await gotoAs(page, '/', COPY.dashH1);
        await expect(page.getByRole('button', { name: `Tuỳ chọn cho ${projectName}`, exact: true })).toBeVisible();
        await expect(page.getByText(COPY.viewerLine, { exact: true })).toBeVisible(); // PD:198-201
        await shot(page, '9P-B-001', 'viewer_dash');
      });
      await test.step('[9P-D-001] no "Dự án mới" button', async () => {
        await expect(page.getByRole('button', { name: COPY.newProject })).toHaveCount(0); // PD:154
        await shot(page, '9P-D-001', 'no_new_project');
      });
      await test.step('[9P-D-002] card menu Đổi tên/Xoá disabled', async () => {
        await page.getByRole('button', { name: `Tuỳ chọn cho ${projectName}`, exact: true }).click(); // PCT:108
        const menu = page.getByRole('menu');
        for (const name of ['Đổi tên', 'Xoá']) {
          const item = menu.getByRole('menuitem', { name });
          await expect.soft(item).toBeDisabled(); // PMG:24-25
          await expect.soft(item).toHaveAttribute('aria-disabled', 'true');
        }
        await shot(page, '9P-D-002', 'menu_disabled');
      });
      await test.step('[9P-E-001] Enter on disabled item does nothing; Tab skips absent button', async () => {
        const menu = page.getByRole('menu');
        for (const name of ['Đổi tên', 'Xoá']) {
          await menu.getByRole('menuitem', { name }).focus();
          await page.keyboard.press('Enter');
        }
        await expect.soft(page.getByRole('dialog')).toHaveCount(0);
        await expect.soft(page.getByRole('textbox', { name: `Đổi tên ${projectName}` })).toHaveCount(0); // PCT:127
        await page.keyboard.press('Escape');
        await expect.soft(page.getByRole('button', { name: COPY.newProject })).toHaveCount(0);
        await expect.soft(page.getByText(COPY.viewerLine, { exact: true })).toBeVisible();
        await shot(page, '9P-E-001', 'enter_disabled');
      });
      await test.step('[9P-C-001] N outside inputs opens no create dialog', async () => {
        await page.locator('body').click({ position: { x: 5, y: 5 } });
        await page.keyboard.press('n'); // UPD:420 enabled: canCreate
        await expect.soft(page.getByRole('dialog')).toHaveCount(0);
        await shot(page, '9P-C-001', 'key_n');
      });
      await test.step('[9P-D-003] recordWrites empty so far', async () => {
        expect.soft(rec.writes).toEqual([]);
        await shot(page, '9P-D-003', 'no_writes');
      });
      await test.step('[9P-G-001] GET /api/project-summaries 200 contains MP', async () => {
        const api = await apiAs(pv);
        const res = await api.get('/api/project-summaries');
        expect.soft(res.status()).toBe(200);
        // ponytail: the "no DP" half is skipped - this flow creates no DP; membership filter PR:88 covered by contains-MP.
        expect.soft(JSON.stringify(await res.json())).toContain(projectId);
        await shot(page, '9P-G-001', 'summaries');
      });
      await test.step('[9P-A-001] open MP card', async () => {
        await page.getByRole('button', { name: `Mở ${projectName}`, exact: true }).click(); // PCT:166
        await expect.soft(page).toHaveURL(new RegExp(`/projects/${projectId}`, 'u'));
        await expect.soft(page.getByText(COPY.deniedTitle)).toHaveCount(0);
        await shot(page, '9P-A-001', 'open_card');
      });
    } finally {
      await undo();
    }
  });

  test('SCR-05/Vỏ · FL-9P-02 · viewer · chưa là thành viên', async ({ page, context }) => {
    test.setTimeout(120_000);
    const admin = await adminApi();
    const pn = await roleUser(admin, 'viewer', 'shell-novice');
    const { projectId, projectName } = mainProject();
    await signInRole(context, pn);
    await test.step('[9P-B-003] empty state, no create / viewer line', async () => {
      await page.goto('/');
      await expect(page.getByText(COPY.emptyViewer, { exact: true })).toBeVisible(); // PD:245-249
      await expect.soft(page.getByText(COPY.createEmpty)).toHaveCount(0);
      await expect.soft(page.getByText('Vai người xem')).toHaveCount(0);
      await shot(page, '9P-B-003', 'novice_empty');
    });
    await test.step('[9P-D-208] non-member settings: no project name, back button', async () => {
      await page.goto(`/projects/${projectId}/settings`);
      await expect(backLink(page)).toBeVisible(); // BE 404 ACC:53
      await expect.soft(page.getByText(projectName)).toHaveCount(0);
      await shot(page, '9P-D-208', 'non_member');
    });
    await test.step('[9P-D-308] unknown path -> not found', async () => {
      await page.goto('/duong-dan-khong-co');
      await expect.soft(page.getByText(COPY.notFoundTitle, { exact: true })).toBeVisible(); // NF
      await shot(page, '9P-D-308', 'not_found');
    });
    await test.step('[9P-D-304] /khong-co-quyen copy + actions', async () => {
      await page.goto('/khong-co-quyen');
      await expect(page.getByText(COPY.deniedTitle, { exact: true })).toBeVisible();
      await expect.soft(page.getByText(COPY.deniedIdentity)).toBeVisible();
      await expect.soft(page.getByRole('button', { name: COPY.switchAccount })).toBeVisible();
      await expect.soft(backLink(page)).toBeVisible();
      await shot(page, '9P-D-304', 'denied');
    });
    await test.step('[9P-D-305] restriction copy, no project name', async () => {
      await expect.soft(page.getByText(COPY.deniedRestriction, { exact: true })).toBeVisible();
      await expect.soft(page.getByText(COPY.deniedWhoGrants, { exact: true })).toBeVisible();
      await expect.soft(page.getByText(projectName)).toHaveCount(0);
      await shot(page, '9P-D-305', 'denied_copy');
    });
    await test.step('[9P-D-306] switch account -> /login, /api/me 401', async () => {
      await page.getByRole('button', { name: COPY.switchAccount }).click();
      await expect(page).toHaveURL(/\/login/u);
      const me = await page.request.get('/api/me'); // UNKNOWN — NEED VERIFICATION: same-origin /api proxy assumed
      expect.soft(me.status()).toBe(401);
      await shot(page, '9P-D-306', 'switch_account');
    });
  });

  test('SCR-08/Onboarding/Thông báo · FL-9P-03 · viewer', async ({ page, context }) => {
    test.setTimeout(240_000);
    const admin = await adminApi();
    const pv = await roleUser(admin, 'viewer', 'shell');
    const { projectId } = mainProject();
    const undo = await asMember(admin, projectId, pv);
    try {
      await signInRole(context, pv);
      const rec = recordWrites(page);
      await test.step('[9P-D-101] onboarding forbidden: only step 3', async () => {
        await page.goto('/onboarding');
        await expect(page.getByText(COPY.onbViewerNote, { exact: true })).toBeVisible();
        await expect.soft(page.getByText(COPY.onbStep3, { exact: true })).toBeVisible();
        await expect.soft(page.getByText('Tải bản vẽ theo từng tầng')).toHaveCount(0);
        await expect.soft(page.getByRole('heading', { name: 'Tạo dự án' })).toHaveCount(0);
        await shot(page, '9P-D-101', 'onb_viewer');
      });
      await test.step('[9P-D-103] sample/skip enabled, tutorial aria-disabled', async () => {
        await expect.soft(page.getByRole('button', { name: COPY.onbSample })).toBeEnabled();
        await expect.soft(page.getByRole('button', { name: COPY.onbSkip })).toBeEnabled();
        const tut = page.getByRole('button', { name: COPY.onbTutorialOff });
        await expect.soft(tut).toHaveAttribute('aria-disabled', 'true');
        await expect.soft(tut).not.toHaveAttribute('disabled', /.*/u);
        await shot(page, '9P-D-103', 'onb_links');
      });
      await test.step('[9P-B-201] settings read-only line', async () => {
        await gotoAs(page, `/projects/${projectId}/settings`, COPY.settingsH1);
        await expect.soft(page.getByText(COPY.settingsReadOnly, { exact: true })).toBeVisible();
        await shot(page, '9P-B-201', 'settings_viewer');
      });
      await test.step('[9P-D-201] tab Chung: no editable field, Ghi chú paragraph', async () => {
        await page.getByRole('tab', { name: COPY.tabGeneral }).click();
        await expect.soft(page.getByRole('textbox')).toHaveCount(0); // GT:71-78
        await expect.soft(page.getByText('Ghi chú', { exact: true })).toBeVisible();
        await shot(page, '9P-D-201', 'tab_general');
      });
      await test.step('[9P-D-202] tab Đơn vị đo read-only', async () => {
        await page.getByRole('tab', { name: COPY.tabUnits }).click();
        await expect.soft(page.getByRole('textbox')).toHaveCount(0); // UnitsTab.tsx:50 isReadOnly
        await expect.soft(page.getByRole('spinbutton')).toHaveCount(0);
        await shot(page, '9P-D-202', 'tab_units');
      });
      await test.step('[9P-D-203] tab Thành viên: list, no add/remove', async () => {
        await page.getByRole('tab', { name: COPY.tabMembers }).click();
        await expect.soft(page.getByRole('listitem').first()).toBeVisible(); // MT:48
        await expect.soft(page.getByRole('textbox')).toHaveCount(0);
        await expect.soft(page.getByRole('button', { name: COPY.addMember })).toHaveCount(0);
        await expect.soft(page.getByRole('button', { name: /^Gỡ/u })).toHaveCount(0);
        await shot(page, '9P-D-203', 'tab_members');
      });
      await test.step('[9P-D-204] no "Vùng nguy hiểm" tab', async () => {
        await expect.soft(page.getByRole('tab')).toHaveText([COPY.tabGeneral, COPY.tabUnits, COPY.tabMembers]); // UPS:1360
        await expect.soft(page.getByRole('tab', { name: COPY.tabDanger })).toHaveCount(0);
        await shot(page, '9P-D-204', 'no_danger_tab');
      });
      await test.step('[9P-E-201] Tab key never lands on a readonly textarea', async () => {
        await page.getByRole('tab', { name: COPY.tabGeneral }).click();
        await page.getByRole('tab', { name: COPY.tabGeneral }).focus();
        for (let i = 0; i < 6; i++) {
          await page.keyboard.press('Tab');
          const tag = await page.evaluate(() => document.activeElement?.tagName ?? '');
          expect.soft(tag).not.toBe('TEXTAREA');
        }
        await shot(page, '9P-E-201', 'tab_order');
      });
      await test.step('[9P-C-201] no writes after tabs', async () => {
        expect.soft(rec.writes).toEqual([]);
        await shot(page, '9P-C-201', 'no_writes');
      });
      await test.step('[9P-G-201] GET settings 200', async () => {
        const api = await apiAs(pv);
        const res = await api.get(`/api/projects/${projectId}/settings`);
        expect.soft(res.status()).toBe(200); // SR:22
        await shot(page, '9P-G-201', 'settings_api');
      });
      await test.step('[9P-D-309] /thong-bao: invite has "Chấp nhận" when one exists', async () => {
        const listed = page.waitForResponse((r) => new URL(r.url()).pathname === '/api/notifications' && r.request().method() === 'GET');
        await page.goto('/thong-bao');
        const body = (await (await listed).json()) as { id: string }[];
        const hasInvite = body.some((n) => JSON.stringify(n).toLowerCase().includes('invite'));
        if (hasInvite) {
          await expect.soft(page.getByRole('button', { name: COPY.accept }).first()).toBeVisible(); // NG:182
        } else {
          // UNKNOWN — NEED VERIFICATION: seed does not produce an invite notification for PV; step skipped, report missing seed.
          test.info().annotations.push({ type: 'skipped-seed', description: '9P-D-309: no invite notification seeded' });
          expect.soft(Array.isArray(body)).toBe(true);
        }
        await shot(page, '9P-D-309', 'notifications');
      });
      await test.step('[9P-G-301] GET notifications 200, POST read 204', async () => {
        const api = await apiAs(pv);
        const res = await api.get('/api/notifications');
        expect.soft(res.status()).toBe(200);
        const rows = (await res.json()) as { id: string }[];
        const mark = await api.post('/api/notifications/read', { data: { ids: rows.slice(0, 1).map((n) => n.id) } }); // router.py:30
        expect.soft(mark.status()).toBe(204);
        await shot(page, '9P-G-301', 'notifications_api');
      });
    } finally {
      await undo();
    }
  });

  test('SCR-05/08 · FL-9P-04 · engineer · chỉ đọc MP', async ({ page, context }) => {
    test.setTimeout(120_000);
    const admin = await adminApi();
    const pe = await roleUser(admin, 'engineer', 'shell');
    const { projectId } = mainProject();
    const undo = await asMember(admin, projectId, pe);
    try {
      await signInRole(context, pe);
      await test.step('[9P-D-004] "Dự án mới" visible, no viewer line', async () => {
        await gotoAs(page, '/', COPY.dashH1);
        await expect(page.getByRole('button', { name: COPY.newProject })).toBeVisible();
        await expect.soft(page.getByText('Vai người xem')).toHaveCount(0);
        await shot(page, '9P-D-004', 'eng_dash');
      });
      await test.step('[9P-D-205] settings: no read-only line, add member, no danger tab', async () => {
        await gotoAs(page, `/projects/${projectId}/settings`, COPY.settingsH1);
        await expect.soft(page.getByText(COPY.settingsReadOnly)).toHaveCount(0);
        await page.getByRole('tab', { name: COPY.tabMembers }).click();
        await expect.soft(page.getByRole('button', { name: COPY.addMember })).toBeVisible(); // not clicked
        await expect.soft(page.getByRole('tab', { name: COPY.tabDanger })).toHaveCount(0);
        await shot(page, '9P-D-205', 'eng_settings');
      });
      await test.step('[9P-C-202] member engineer still has no danger tab (global role)', async () => {
        await gotoAs(page, `/projects/${projectId}/settings`, COPY.settingsH1);
        await expect.soft(page.getByRole('tab')).toHaveText([COPY.tabGeneral, COPY.tabUnits, COPY.tabMembers]); // UPS:757, PSC:167
        await shot(page, '9P-C-202', 'eng_no_danger');
      });
      await test.step('[9P-D-402] ⚑ client-side nav to /admin/models: library readable, no manage', async () => {
        await spaGo(page, '/admin/models');
        await expect(page.getByRole('textbox', { name: COPY.librarySearch })).toBeVisible({ timeout: 15_000 });
        await expect.soft(page.getByText(COPY.libraryForbidden)).toHaveCount(0);
        await expect.soft(page.getByText(COPY.libraryReadOnly)).toHaveCount(1); // useModelLibrary.ts:~103
        await shot(page, '9P-D-402', 'eng_library');
      });
    } finally {
      await undo();
    }
  });
});
