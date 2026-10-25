/**
 * Phase 3 — SCR-08 project settings, dedicated UI-verify flows (skill `qa-verify-ui`; QA-03d flow plan, agent P2):
 * FL-U08-01 … FL-U08-04. Each step is one state shot at 1440 / 1024 / 768 / 375 by `verifyUi` (it re-opens the state per
 * width, measures layout defects and writes `<name>_<width>.png` + `<name>.json`), plus the row's own measurement.
 *
 * ## Mocks
 * Only FL-U08-04 ("[mocked response]"): GET /api/projects/:id → 503 every try (unpairable: 5xx). Its held settings read
 * is a delay, not a mock. Everything else is the real stack, including the 409 (a real API PUT in between) and the 422
 * MEMBER_LAST_EDITOR of the self-removal.
 *
 * ## Real-backend budget per run
 * - `POST /api/auth/login`: 5 (admin ×4, own login per flow, no shared session file; pool viewer ×1).
 * - `POST /api/projects`: 4, each deleted in `finally`. `POST …/members`: 1 (viewer). Invitations: 0 (or 1, first fill).
 * - `PUT …/settings`: ~20 (4 widths × notes save, 409 states and the API writer); `PATCH /api/projects/:id` 4 (F-014).
 * - `DELETE …/members/:self` → 422: 4. No mail.
 */
import { expect, test, type Locator, type Page, type Route } from '@playwright/test';

import { ROUTES } from '../../e2e/fixtures/routes';
import { waitForApi } from '../../e2e/fullstack/apiWatch';
import { addProjectMember, createProject, deleteSeededProject, poolUser } from './support/phase03Seed';
import {
  COPY,
  DANGER,
  LABEL,
  MEMBER,
  TAB,
  TABS_LABEL,
  alertWith,
  asRecord,
  boxOf,
  chooseTab,
  closeSession,
  fieldFrame,
  fulfillError,
  openSession,
  openSettings,
  projectPath,
  settingsPath,
  settingsRe,
  textbox,
  toastWith,
  uniq,
  writeSettingsElsewhere,
} from './support/p03/P2';
import { UI_VIEWPORTS, verifyUi } from './support/ui-verify';

const width = (page: Page): number => page.viewportSize()?.width ?? 0;
const height = async (locator: Locator): Promise<number> => Math.round((await boxOf(locator)).height);

/* ================================================================= FL-U08-01 */

test('FL-U08-01 · SCR-08 · UI verify: admin states (heights, toast, refusals, member error, dialogs, 404)', async ({ browser }) => {
  test.setTimeout(240_000);
  const s = await openSession(browser, 'admin');
  const project = await createProject(s.api, 'u08-01', 1);
  const members = asRecord(await (await s.api.get(projectPath(project.projectId))).json(), 'GET project').members;
  const selfName = Array.isArray(members) ? String(asRecord(members[0], 'members[0]').name) : ''; // the creator, only editor
  try {
    const { page } = s;
    const open = (): Promise<void> => openSettings(page, project.projectId, project.name);

    await test.step('[08-E-016] "Chung": at 375 inputs 46 px, "Nhóm cài đặt" ≥ 44 px; no small target', async () => {
      const metrics = await verifyUi(page, 'U03_08-E-016_general', open);
      for (const m of metrics) expect.soft(m.smallTargets, `${m.viewport} small targets`).toEqual([]);
      // verifyUi leaves the page at 375.
      expect.soft(await height(fieldFrame(textbox(page, LABEL.name))), 'input frame 46 px below 640').toBe(46); // Input.tsx:70
      expect.soft(await height(page.getByRole('combobox', { name: TABS_LABEL, exact: true }))).toBeGreaterThanOrEqual(44);
    });

    await test.step('[08-F-020] toast with "Hoàn tác" after a notes save does not cover form controls', async () => {
      const covered: string[] = [];
      await verifyUi(page, 'U03_08-F-020_saved-toast', async (p) => {
        await open();
        const put = waitForApi(p, 'PUT', settingsRe(project.projectId), [200]);
        await textbox(p, LABEL.notes).fill(`qa toast ${uniq()}`);
        await put;
        const toast = toastWith(p, COPY.savedToast).first();
        await expect(toast.getByRole('button', { name: COPY.undo, exact: true })).toBeVisible();
        const t = await boxOf(toast);
        // QA-03e (BUG-512, FIX-2204): below 640 px the viewport pins toasts to the top edge (Toast.tsx:187 max-sm:top-4).
        if (width(p) < 640) expect.soft(t.y, `${String(width(p))}: toast at the top edge`).toBeLessThan((p.viewportSize()?.height ?? 0) / 2);
        for (const label of [LABEL.name, LABEL.code, LABEL.address, LABEL.notes]) {
          const c = await boxOf(textbox(p, label));
          const overlap = c.x < t.x + t.width && t.x < c.x + c.width && c.y < t.y + t.height && t.y < c.y + c.height;
          if (overlap) covered.push(`${String(width(p))}: ${label}`);
        }
      });
      expect.soft(covered, 'form controls under the toast').toEqual([]);
    });

    await test.step('[08-F-005] "Đơn vị đo" with "Giá trị không quá 120 mm." and "Giá trị không quá 1." shown', async () => {
      await verifyUi(page, 'U03_08-F-005_units-refusals', async (p) => {
        await open();
        await chooseTab(p, TAB.units);
        await textbox(p, LABEL.snap).fill('121');
        await textbox(p, LABEL.confidence).fill('1,5');
        await expect(p.getByText('Giá trị không quá 120 mm.', { exact: true })).toBeVisible(); // useNumericField.ts:73
        await expect(p.getByText('Giá trị không quá 1.', { exact: true })).toBeVisible();
      });
    });

    await test.step('[08-F-023] "Thành viên": < 640 input, button and "Nhóm cài đặt" select 46 px; ≥ 640 38 px; ≥ 1024 tabs 36 px', async () => {
      const sizes: string[] = [];
      await verifyUi(page, 'U03_08-F-023_members', async (p) => {
        await open();
        await chooseTab(p, TAB.members);
        const w = width(p);
        const input = await height(fieldFrame(textbox(p, MEMBER.email)));
        const button = await height(p.getByRole('button', { name: MEMBER.add, exact: true }));
        const expected = w < 640 ? 46 : 38; // AMF:41, Input.tsx:70
        if (input !== expected || button !== expected) sizes.push(`${String(w)}: input ${String(input)}, button ${String(button)} (want ${String(expected)})`);
        // Catalog fixed by QA-03e: below 1024 px the tab strip is a Select (useProjectSettings.ts:603, ProjectSettings.tsx:112-118),
        // so the "tabs 44 px below 640" of the catalog never renders; the Select trigger is measured there instead.
        if (w < 1024) {
          const h = await height(p.getByRole('combobox', { name: TABS_LABEL, exact: true }));
          if (h !== expected) sizes.push(`${String(w)}: select ${String(h)} (want ${String(expected)})`); // Select.tsx:144
        } else {
          const h = await height(p.getByRole('navigation', { name: 'Mục trong trang', exact: true }).getByRole('link').first());
          if (h !== 36) sizes.push(`${String(w)}: tab ${String(h)} (want 36)`); // Tabs.tsx:134 h-11 sm:h-9
        }
      });
      expect.soft(sizes).toEqual([]);
    });

    await test.step('[08-F-007] add-member error "Chưa nhập địa chỉ email.": button top stays aligned with the input', async () => {
      const offsets: string[] = [];
      await verifyUi(page, 'U03_08-F-007_member-error', async (p) => {
        await open();
        await chooseTab(p, TAB.members);
        await p.getByRole('button', { name: MEMBER.add, exact: true }).click();
        await expect(p.getByText(MEMBER.required, { exact: true })).toBeVisible(); // UPM:157-161
        const field = await boxOf(fieldFrame(textbox(p, MEMBER.email)));
        const button = await boxOf(p.getByRole('button', { name: MEMBER.add, exact: true }));
        if (Math.abs(field.y - button.y) > 1) offsets.push(`${String(width(p))}: field top ${String(field.y)}, button top ${String(button.y)}`);
      });
      expect.soft(offsets, 'AMF:36-46 mt-7 keeps the button on the field').toEqual([]);
    });

    await test.step('[08-F-008] "Gỡ {self}" dialog after 422: title + role=alert line fit', async () => {
      await verifyUi(
        page,
        'U03_08-F-008_self-remove-422',
        async (p) => {
          await open();
          await chooseTab(p, TAB.members);
          await p.getByRole('button', { name: `${MEMBER.remove} ${selfName}`, exact: true }).click();
          const dialog = p.getByRole('dialog', { name: `Gỡ ${selfName} khỏi dự án?`, exact: true });
          const refused = waitForApi(p, 'DELETE', /\/members\/[^/]+$/u, [422]);
          await dialog.getByRole('button', { name: MEMBER.remove, exact: true }).click();
          await refused; // BE project_members/service.py MEMBER_LAST_EDITOR
          await expect(dialog.getByRole('alert')).toHaveText(MEMBER.lastEditor);
        },
        UI_VIEWPORTS,
        { fullPage: false },
      );
    });

    await test.step('[08-F-012] "Xoá mọi tầng" dialog: no typed-name input, fits', async () => {
      await verifyUi(
        page,
        'U03_08-F-012_delete-floors-dialog',
        async (p) => {
          await open();
          await chooseTab(p, TAB.danger);
          await p.getByRole('button', { name: DANGER.deleteFloors, exact: true }).click(); // the panel has no tab label below 1024
          const dialog = p.getByRole('dialog', { name: DANGER.deleteFloorsTitle, exact: true });
          await expect(dialog).toBeVisible();
          await expect.soft(dialog.getByRole('textbox')).toHaveCount(0); // PS:161
        },
        UI_VIEWPORTS,
        { fullPage: false },
      );
    });

    await test.step('[08-F-016] random id: load-error alert + "Về danh sách dự án" fit', async () => {
      const id = `prj_qa-p2-${uniq()}`; // not a prj_<ULID>: BE 404 before any DB read
      await verifyUi(page, 'U03_08-F-016_not-found', async (p) => {
        await p.goto(ROUTES.project.settings(id));
        const alert = alertWith(p, COPY.loadError);
        await expect(alert.getByRole('button', { name: COPY.backToProjects, exact: true })).toBeVisible({ timeout: 20_000 });
      });
    });
  } finally {
    await deleteSeededProject(s.api, project.projectId);
    await closeSession(s);
  }
});

/* ================================================================= FL-U08-02 */

test('FL-U08-02 · SCR-08 · UI verify: conflict strip, stacked alerts, reload dialog', async ({ browser }) => {
  test.setTimeout(180_000);
  const s = await openSession(browser, 'admin');
  const project = await createProject(s.api, 'u08-02');
  try {
    const { page } = s;
    const id = project.projectId;
    /** Settings open, then a real write elsewhere, then `edit` → the screen's PUT meets 409. */
    const conflict = async (p: Page, edit: () => Promise<void>): Promise<void> => {
      await p.goto(ROUTES.project.settings(id));
      await expect(textbox(p, LABEL.name)).toBeVisible({ timeout: 20_000 });
      await writeSettingsElsewhere(s.api, id, `qa elsewhere ${uniq()}`);
      const refused = waitForApi(p, 'PUT', settingsRe(id), [409]);
      await edit();
      await refused;
      await expect(alertWith(p, COPY.conflictTitle)).toBeVisible();
    };

    await test.step('[08-F-013] 409 strip "Cài đặt đã đổi ở nơi khác" + "Tải lại"', async () => {
      await verifyUi(page, 'U03_08-F-013_conflict', (p) =>
        conflict(p, async () => {
          await textbox(p, LABEL.notes).fill(`qa conflict ${uniq()}`);
        }).then(() => expect(alertWith(p, COPY.conflictTitle).getByRole('button', { name: COPY.reload, exact: true })).toBeVisible()),
      );
    });

    await test.step('[08-F-014] name + notes edit → conflict strip and "Chưa lưu hết" stacked, no overlap', async () => {
      const overlaps: string[] = [];
      await verifyUi(page, 'U03_08-F-014_conflict-partial', async (p) => {
        await conflict(p, async () => {
          const name = textbox(p, LABEL.name);
          await name.fill(`${project.name.slice(0, 60)}-${uniq()}`);
          await textbox(p, LABEL.notes).fill(`qa stacked ${uniq()}`);
        });
        const partial = alertWith(p, COPY.saveFailure);
        await expect(partial).toBeVisible(); // PS:96-99 "Đã lưu tên dự án, chưa lưu ghi chú."
        const a = await boxOf(alertWith(p, COPY.conflictTitle));
        const b = await boxOf(partial);
        if (a.y < b.y + b.height && b.y < a.y + a.height) overlaps.push(`${String(width(p))}: strips overlap`);
      });
      expect.soft(overlaps).toEqual([]);
    });

    await test.step('[08-F-015] dialog "Tải lại sẽ bỏ thay đổi chưa lưu"', async () => {
      await verifyUi(
        page,
        'U03_08-F-015_reload-dialog',
        async (p) => {
          await conflict(p, async () => {
            await textbox(p, LABEL.notes).fill(`qa reload ${uniq()}`);
          });
          await alertWith(p, COPY.conflictTitle).getByRole('button', { name: COPY.reload, exact: true }).click();
          await expect(p.getByRole('dialog', { name: COPY.reloadDialog, exact: true })).toBeVisible(); // RD:19-35
        },
        UI_VIEWPORTS,
        { fullPage: false },
      );
    });
  } finally {
    await deleteSeededProject(s.api, project.projectId);
    await closeSession(s);
  }
});

/* ================================================================= FL-U08-03 */

test('FL-U08-03 · SCR-08 · UI verify: viewer read-only settings', async ({ browser }) => {
  test.setTimeout(120_000);
  const admin = await openSession(browser, 'admin');
  const viewer = await poolUser(admin.api, 'viewer');
  const project = await createProject(admin.api, 'u08-03');
  await addProjectMember(admin.api, project.projectId, viewer.email);
  const v = await openSession(browser, viewer);
  try {
    await test.step('[08-F-019] banner + text values, 3 tabs', async () => {
      await verifyUi(v.page, 'U03_08-F-019_viewer', async (p) => {
        await openSettings(p, project.projectId, project.name);
        await expect(p.getByText(COPY.readOnly, { exact: true })).toBeVisible(); // PS:82-86
        await expect(textbox(p, LABEL.name)).toHaveCount(0);
        const tablist = p.getByRole('navigation', { name: 'Mục trong trang', exact: true });
        if (await tablist.isVisible()) await expect.soft(tablist.getByRole('link')).toHaveCount(3);
      });
    });
  } finally {
    await deleteSeededProject(admin.api, project.projectId);
    await closeSession(v);
    await closeSession(admin);
  }
});

/* ================================================================= FL-U08-04 */

test('FL-U08-04 · SCR-08 · [mocked response] UI verify: loading skeleton and retryable load error', async ({ browser }) => {
  test.setTimeout(180_000);
  const s = await openSession(browser, 'admin');
  const project = await createProject(s.api, 'u08-04');
  try {
    const { page } = s;
    const id = project.projectId;

    await test.step('[08-F-018] skeleton "property-panel" while the settings read is held', async () => {
      let release: () => void = () => undefined;
      const gate = new Promise<void>((resolve) => (release = resolve));
      const matcher = (url: URL): boolean => url.pathname === settingsPath(id);
      const handler = async (route: Route): Promise<void> => {
        if (route.request().method() !== 'GET') return route.fallback();
        await gate; // a delay of the real read, released after the four shots
        await route.continue().catch(() => undefined);
      };
      await page.route(matcher, handler);
      try {
        await verifyUi(page, 'U03_08-F-018_skeleton', async (p) => {
          await p.goto(ROUTES.project.settings(id));
          await expect(p.locator('.animate-pulse').first()).toBeVisible(); // PS:108-109
        });
      } finally {
        release();
        await page.unroute(matcher, handler);
      }
    });

    await test.step('[08-F-017] load-error alert + "Thử lại" (GET project 503 every try)', async () => {
      const matcher = (url: URL): boolean => url.pathname === projectPath(id);
      const handler = (route: Route): Promise<void> =>
        route.request().method() === 'GET' ? fulfillError(route, 503, 'DEPENDENCY_UNAVAILABLE') : route.fallback();
      await page.route(matcher, handler);
      try {
        await verifyUi(page, 'U03_08-F-017_load-error', async (p) => {
          await p.goto(ROUTES.project.settings(id));
          const alert = alertWith(p, COPY.loadError);
          await expect(alert).toBeVisible({ timeout: 45_000 });
          await expect.soft(alert.getByRole('button', { name: COPY.retry, exact: true }), 'retryable load error offers "Thử lại"').toBeVisible({ timeout: 2_000 });
        });
      } finally {
        await page.unroute(matcher, handler);
      }
    });
  } finally {
    await deleteSeededProject(s.api, project.projectId);
    await closeSession(s);
  }
});
