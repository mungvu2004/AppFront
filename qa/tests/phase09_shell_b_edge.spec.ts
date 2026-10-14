/**
 * Phase 9 (QA-09 P2) - shell, engineer writes / no-project engineer / anonymous / admin + role flip. Real stack, pool users.
 * Flows FL-9P-05..08 (flows-C1.md). Desktop 1440 only. No mocks.
 */
import { expect, test } from '@playwright/test';

import { ROUTES, loginUrl, pathOf } from '../../e2e/fixtures/routes';
import { EMAIL_LABEL, PASSWORD_LABEL, SIGN_IN_LABEL } from '../../e2e/fixtures/session';
import { TEST_DATA_PREFIX, captureEvidence } from './support/evidence';
import { createProject, deleteSeededProject } from './support/phase03Seed';
import { DESKTOP, adminApi, apiAs, asMember, gotoAs, mainProject, recordWrites, roleUser, signInRole } from './support/p09/roles';
import {
  FORBIDDEN_TITLE,
  LIBRARY_READ_ONLY,
  SAVED_AT,
  SETTINGS_READ_ONLY,
  VIEWER_LINE,
  codeOf,
  createViaWizard,
  deleteProject,
  menuItem,
  openCardMenu,
  projectCard,
  recordResponses,
  spaGo,
} from './support/p09/P2';

test.use({ viewport: DESKTOP });

const DASH = 'Dự án của tôi';
const settingsPath = (id: string): string => ROUTES.project.settings(id);

test.describe('phase09 shell B edge', () => {
  test('SCR-05/08 · FL-9P-05 · engineer · ghi trên dự án riêng', async ({ context, page }) => {
    test.setTimeout(320_000);
    const admin = await adminApi();
    const pe = await roleUser(admin, 'engineer', 'shell-b');
    const pv = await roleUser(admin, 'viewer', 'shell-b');
    const dp = await createProject(admin, 'p09-shell-dp');
    const created: string[] = [];
    let undo: (() => Promise<void>) | undefined;
    try {
      undo = await asMember(admin, dp.projectId, pe);
      await signInRole(context, pe);
      const rec = recordResponses(page);
      const writes = recordWrites(page);
      let name = dp.name;
      const wizName = `${TEST_DATA_PREFIX}p09-wiz-${Date.now().toString(36)}`;

      await test.step('[9P-A-002] "Dự án mới" tạo dự án, thẻ mới hiện (POST 201)', async () => {
        await gotoAs(page, '/', DASH);
        await page.getByRole('button', { name: /^Dự án mới/u }).click(); // PD:154
        created.push(await createViaWizard(page, wizName));
        await expect(projectCard(page, wizName)).toBeVisible();
        await captureEvidence(page, 'E09_9P-A-002_engineer_created.png');
      });

      await test.step('[9P-A-003] bấm N ngoài ô nhập mở lại modal tạo', async () => {
        const dialog = page.getByRole('dialog', { name: 'Tạo dự án mới', exact: true });
        await expect(dialog).toHaveCount(0);
        await page.getByRole('heading', { name: DASH, exact: true }).click();
        await page.keyboard.press('n'); // UPD:420
        await expect.soft(dialog).toBeVisible();
        await captureEvidence(page, 'E09_9P-A-003_engineer_shortcut_n.png');
        await dialog.getByRole('button', { name: 'Huỷ', exact: true }).click();
        await expect(dialog).toHaveCount(0);
      });

      await test.step('[9P-C-002] "Đổi tên" bật, đổi tên → PATCH 200', async () => {
        const menu = await openCardMenu(page, name);
        await expect.soft(menuItem(menu, 'Đổi tên')).toBeEnabled(); // PMG:24
        await menuItem(menu, 'Đổi tên').click();
        const next = `${dp.name}-r`;
        const box = page.getByRole('textbox', { name: `Đổi tên ${name}`, exact: true });
        await box.fill(next);
        const patch = page.waitForResponse((r) => r.request().method() === 'PATCH' && new URL(r.url()).pathname === `/api/projects/${dp.projectId}`);
        await box.press('Enter');
        expect.soft((await patch).status()).toBe(200);
        name = next;
        await expect(projectCard(page, name)).toBeVisible();
        await captureEvidence(page, 'E09_9P-C-002_engineer_renamed.png');
      });

      await test.step('[9P-G-002] GET xác nhận tên đã đổi', async () => {
        const res = await (await apiAs(pe)).get(`/api/projects/${dp.projectId}`);
        expect(res.status()).toBe(200);
        expect.soft(((await res.json()) as { name: string }).name).toBe(name);
        await captureEvidence(page, 'E09_9P-G-002_engineer_name_persisted.png');
      });

      await test.step('[9P-C-003] ⚑ menu thẻ DP: "Xoá" phải disabled cho engineer', async () => {
        const menu = await openCardMenu(page, name);
        await expect.soft(menuItem(menu, 'Xoá')).toBeDisabled(); // PMG:25 dùng canEdit -> đỏ tới khi sửa
        await captureEvidence(page, 'E09_9P-C-003_engineer_delete_menu.png');
        await page.keyboard.press('Escape');
      });

      await test.step('[9P-G-003] DELETE bởi engineer → 403 FORBIDDEN, DP còn nguyên', async () => {
        const del = await (await apiAs(pe)).delete(`/api/projects/${dp.projectId}`);
        expect.soft(del.status()).toBe(403); // PR:80 admin-only
        expect.soft(await codeOf(del)).toBe('FORBIDDEN');
        const still = await admin.get(`/api/projects/${dp.projectId}`);
        expect.soft(still.status()).toBe(200);
        await captureEvidence(page, 'E09_9P-G-003_engineer_delete_403.png');
      });

      await test.step('[9P-A-201] settings DP: sửa "Tên dự án" + "Ghi chú", chip lưu, PATCH/PUT 200', async () => {
        await page.goto(settingsPath(dp.projectId));
        const nameBox = page.getByRole('textbox', { name: 'Tên dự án', exact: true });
        await expect(nameBox).toHaveValue(name);
        name = `${dp.name}-s`;
        await nameBox.fill(name);
        await page.getByRole('textbox', { name: 'Ghi chú', exact: true }).fill('qa-09 engineer note');
        await expect.soft(page.locator('header').getByRole('status')).toHaveText(SAVED_AT);
        await captureEvidence(page, 'E09_9P-A-201_engineer_settings_saved.png');
      });

      await test.step('[9P-A-202] tab "Thành viên": thêm email PV rồi "Gỡ"', async () => {
        await page.getByRole('tablist', { name: 'Nhóm cài đặt', exact: true }).getByRole('tab', { name: /^Thành viên/u }).click();
        await page.getByRole('textbox', { name: 'Email người cần thêm', exact: true }).fill(pv.email);
        await page.getByRole('button', { name: 'Thêm thành viên', exact: true }).click(); // AMF
        const remove = page.getByRole('button', { name: `Gỡ ${pv.name}`, exact: true });
        await expect(remove).toBeVisible();
        await captureEvidence(page, 'E09_9P-A-202_engineer_member_added.png');
        await remove.click();
        await page.getByRole('dialog', { name: `Gỡ ${pv.name} khỏi dự án?`, exact: true }).getByRole('button', { name: 'Gỡ', exact: true }).click();
        await expect(remove).toHaveCount(0);
      });

      await test.step('[9P-G-202] PATCH/PUT settings, POST/DELETE members đều 2xx', async () => {
        const pid = dp.projectId;
        const ok = (m: string, re: RegExp): boolean =>
          rec.seen.some((s) => s.method === m && re.test(s.path) && s.status >= 200 && s.status < 300);
        expect.soft(ok('PATCH', new RegExp(`^/api/projects/${pid}$`, 'u'))).toBe(true);
        expect.soft(ok('PUT', new RegExp(`^/api/projects/${pid}/settings$`, 'u'))).toBe(true);
        expect.soft(ok('POST', new RegExp(`^/api/projects/${pid}/members$`, 'u'))).toBe(true);
        expect.soft(ok('DELETE', new RegExp(`^/api/projects/${pid}/members/[^/]+$`, 'u'))).toBe(true);
        expect.soft(writes.writes.length).toBeGreaterThan(0);
        await captureEvidence(page, 'E09_9P-G-202_engineer_writes_2xx.png');
      });
    } finally {
      for (const id of created) await deleteProject(admin, id);
      await undo?.();
      await deleteSeededProject(admin, dp.projectId);
    }
  });

  test('SCR-05/Onboarding/Thông báo · FL-9P-06 · engineer · chưa có dự án', async ({ context, page }) => {
    const admin = await adminApi();
    try {
    const pen = await roleUser(admin, 'engineer', 'shell-b-novice');
    const mp = mainProject();
    await signInRole(context, pen);
    const rec = recordResponses(page);

    await test.step('[9P-B-004] `/` empty có "Tạo dự án mới"', async () => {
      await gotoAs(page, '/', DASH);
      await expect(page.getByText('Chưa có dự án nào', { exact: true })).toBeVisible();
      await expect(page.getByText('Bạn chưa được thêm vào dự án nào', { exact: false })).toHaveCount(0);
      await expect.soft(page.getByRole('button', { name: 'Tạo dự án mới', exact: true })).toBeVisible(); // PD:249
      await captureEvidence(page, 'E09_9P-B-004_engineer_empty.png');
    });

    await test.step('[9P-D-007] settings MP: "Về danh sách dự án", BE 404, không lộ tên', async () => {
      await page.goto(settingsPath(mp.projectId));
      await expect(page.getByRole('button', { name: 'Về danh sách dự án', exact: true })).toBeVisible();
      await expect.soft(page.getByText(mp.projectName, { exact: false })).toHaveCount(0);
      const mine = rec.seen.filter((s) => s.path.startsWith(`/api/projects/${mp.projectId}`));
      expect.soft(mine.some((s) => s.status === 404)).toBe(true);
      expect.soft(mine.some((s) => s.status === 403)).toBe(false);
      await captureEvidence(page, 'E09_9P-D-007_engineer_non_member.png');
    });

    await test.step('[9P-D-102] `/onboarding`: 3 thẻ, thẻ 3 khoá, không note vai', async () => {
      await page.goto('/onboarding');
      for (const t of ['Tạo dự án', 'Tải bản vẽ theo từng tầng', 'Duyệt kết quả và dựng 3D']) {
        await expect.soft(page.getByRole('heading', { name: t, exact: true })).toBeVisible();
      }
      await expect.soft(page.getByText('Cần tải bản vẽ trước.', { exact: true })).toBeVisible();
      await expect.soft(page.getByText('Vai người xem chỉ duyệt được kết quả', { exact: false })).toHaveCount(0);
      await captureEvidence(page, 'E09_9P-D-102_engineer_onboarding.png');
    });

    await test.step('[9P-D-310] `/thong-bao` hộp thư rỗng', async () => {
      await page.goto(ROUTES.notifications);
      await expect.soft(page.getByText('Không có thông báo nào', { exact: true })).toBeAttached(); // NC:159 (live region)
      await expect.soft(page.getByText('Không có thông báo mới', { exact: true })).toBeVisible(); // NC:64 empty title
      await captureEvidence(page, 'E09_9P-D-310_engineer_no_notifications.png');
    });
    } finally {
      await admin.dispose();
    }
  });

  test('Vỏ · FL-9P-07 · ẩn danh · rồi đăng nhập viewer', async ({ page }) => {
    const admin = await adminApi();
    const pv = await roleUser(admin, 'viewer', 'shell-b');
    const mp = mainProject();
    const undo = await asMember(admin, mp.projectId, pv);
    const rec = recordResponses(page);
    const next = settingsPath(mp.projectId);
    try {
      await test.step('[9P-D-006] `/` → /login?next=%2F, không có project-summaries 200', async () => {
        await page.goto('/');
        await expect.poll(() => pathOf(page.url())).toBe(loginUrl('/'));
        expect.soft(rec.seen.some((s) => s.path === '/api/project-summaries' && s.status === 200)).toBe(false);
        await captureEvidence(page, 'E09_9P-D-006_anon_dashboard.png');
      });
      await test.step('[9P-D-104] `/onboarding` → login next', async () => {
        await page.goto('/onboarding');
        await expect.poll(() => pathOf(page.url())).toBe(loginUrl('/onboarding'));
        await captureEvidence(page, 'E09_9P-D-104_anon_onboarding.png');
      });
      await test.step('[9P-D-207] settings MP → login next', async () => {
        await page.goto(next);
        await expect.poll(() => pathOf(page.url())).toBe(loginUrl(next));
        await captureEvidence(page, 'E09_9P-D-207_anon_settings.png');
      });
      await test.step('[9P-D-302] bốn đường bảo vệ → login next mã hoá', async () => {
        for (const p of ['/thong-bao', '/tai-khoan', '/admin/models', '/admin/users']) {
          await page.goto(p);
          await expect.poll(() => pathOf(page.url()), { message: p }).toBe(loginUrl(p));
        }
        await captureEvidence(page, 'E09_9P-D-302_anon_protected.png');
      });
      await test.step('[9P-D-307] đường lạ: lý do chưa đăng nhập', async () => {
        await page.goto('/duong-dan-la');
        await expect.soft(page.getByText('Cần đăng nhập để xem trang này', { exact: true })).toBeVisible(); // NF:99
        await expect.soft(page.getByText('Đăng nhập xong bạn sẽ được đưa lại đúng trang vừa mở.', { exact: true })).toBeVisible();
        await captureEvidence(page, 'E09_9P-D-307_anon_not_found.png');
      });
      await test.step('[9P-D-311] `/thong-bao` → /login?next=%2Fthong-bao', async () => {
        await page.goto('/thong-bao');
        await expect.poll(() => pathOf(page.url())).toBe('/login?next=%2Fthong-bao');
        await captureEvidence(page, 'E09_9P-D-311_anon_notifications.png');
      });
      await test.step('[9P-D-303] đăng nhập PV từ next của bước 3 → về settings MP chỉ-đọc', async () => {
        await page.goto(loginUrl(next));
        await page.getByLabel(EMAIL_LABEL, { exact: true }).fill(pv.email);
        await page.getByLabel(PASSWORD_LABEL, { exact: true }).fill(pv.password);
        const login = page.waitForResponse((r) => r.request().method() === 'POST' && new URL(r.url()).pathname === '/api/auth/login');
        await page.getByRole('button', { name: SIGN_IN_LABEL, exact: true }).click();
        expect((await login).status()).toBe(204);
        await expect.poll(() => pathOf(page.url())).toBe(next);
        await expect.soft(page.getByText(SETTINGS_READ_ONLY, { exact: true })).toBeVisible();
        await captureEvidence(page, 'E09_9P-D-303_viewer_back_to_next.png');
      });
    } finally {
      await undo();
    }
  });

  test('SCR-05/08/F-11 · FL-9P-08 · admin · đối chứng và vai đổi giữa chừng', async ({ context, page }) => {
    test.setTimeout(180_000);
    const admin = await adminApi();
    const flip = await roleUser(admin, 'admin', 'shell-b-flip');
    const mp = mainProject();
    const undo = await asMember(admin, mp.projectId, flip);
    let flipped = false;
    try {
      await signInRole(context, flip);
      const libReadOnly = page.getByText(LIBRARY_READ_ONLY, { exact: false });
      const libAnchor = page
        .getByLabel('tìm model', { exact: true })
        .or(page.getByText('Chưa có model nào', { exact: true }))
        .or(page.getByText(FORBIDDEN_TITLE, { exact: true }));

      await test.step('[9P-D-005] `/`: "Dự án mới" hiện, "Xoá" bật, không dòng vai', async () => {
        await gotoAs(page, '/', DASH);
        await expect(projectCard(page, mp.projectName)).toBeVisible();
        await expect(page.getByRole('button', { name: /^Dự án mới/u })).toBeVisible();
        await expect(page.getByText(VIEWER_LINE, { exact: true })).toHaveCount(0);
        const menu = await openCardMenu(page, mp.projectName);
        await expect.soft(menuItem(menu, 'Xoá')).toBeEnabled();
        await captureEvidence(page, 'E09_9P-D-005_admin_dashboard.png');
        await page.keyboard.press('Escape');
      });

      await test.step('[9P-D-206] settings MP: tab "Vùng nguy hiểm", không dòng chỉ-xem', async () => {
        await gotoAs(page, settingsPath(mp.projectId), 'Cài đặt dự án');
        await expect.soft(page.getByRole('tab', { name: /^Vùng nguy hiểm/u })).toBeVisible();
        await expect.soft(page.getByText(SETTINGS_READ_ONLY, { exact: true })).toHaveCount(0);
        await captureEvidence(page, 'E09_9P-D-206_admin_danger_tab.png');
      });

      await test.step('[9P-D-401] ⚑ MP → client nav `/admin/models`: không bị cấm, quản lý hiện', async () => {
        await spaGo(page, '/admin/models');
        await expect(libAnchor.first()).toBeVisible();
        await expect.soft(page.getByText(FORBIDDEN_TITLE, { exact: true })).toHaveCount(0);
        await expect.soft(libReadOnly).toHaveCount(0); // MLC:131 - quản lý hiện <=> không có dòng chỉ-xem
        await captureEvidence(page, 'E09_9P-D-401_admin_library_client_nav.png');
      });

      await test.step('[9P-D-403] ⚑ hạ flip xuống engineer, đăng nhập lại, client nav: quản lý ẩn', async () => {
        const patch = await admin.patch(`/api/users/${flip.id}/role`, { data: { role: 'engineer', userId: flip.id } }); // users/router.py:85
        flipped = true;
        expect(patch.status(), 'PATCH /api/users/:id/role').toBe(200);
        await signInRole(context, flip); // BE bump_token_version: phiên cũ mất giá trị
        await gotoAs(page, '/', DASH);
        await projectCard(page, mp.projectName).click();
        await expect(page).toHaveURL(new RegExp(mp.projectId, 'u'));
        await spaGo(page, '/admin/models');
        await expect(libAnchor.first()).toBeVisible();
        await expect.soft(libReadOnly).toBeVisible();
        await captureEvidence(page, 'E09_9P-D-403_flipped_library_read_only.png');
      });
    } finally {
      try {
        if (flipped) {
          const back = await admin.patch(`/api/users/${flip.id}/role`, { data: { role: 'admin', userId: flip.id } });
          expect(back.status(), 'restore flip role').toBe(200);
        }
      } finally {
        await undo();
      }
    }
  });
});
