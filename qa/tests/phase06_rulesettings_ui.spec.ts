/**
 * Phase 6 — SCR-29 Rule Settings, UI layer (QA-06b P3, `flows-C2.md` "phase06_rulesettings_ui.spec.ts"): 3 flows, 17 steps. Each
 * visual state goes through `verifyUi` (skill `qa-verify-ui`): 1440 / 1024 / 768 / 375, layout measured and shot per width
 * (`U06s_<row id>_<slug>_<width>.png` + `.json`). Whatever the plan asks beyond the generic measures (columns, nav 220 px, box inside
 * the card, dialog width…) is read INSIDE the `open` callback at that width and asserted after `verifyUi` returns, so a width where
 * the state does not open fails softly and the other three still run.
 *
 * ## Seeds
 * - FL-29-U1: a finished pipeline project (`createPipelineProject`, needs `E2E_DRAWING_PNG`; without it the flow is skipped with the
 *   reason "Environment: …").
 * - FL-29-U2: an empty project; every width resets the rule config through N22 first, so each width starts from the same state.
 * - FL-29-U3: an empty project, the "+X" writer, a pool engineer (`p06-settings1`) who is a member, and an unknown project id.
 *
 * ## Request budget per full run
 * - `POST /api/auth/login`: 2 per flow (page + admin API) + 1 engineer session in FL-29-U3 = 7. `POST /api/projects` 3, `DELETE` 3,
 *   `POST …/members` 1. `POST …/drawings/uploads` init 1 (`drawings_init` 60 / 600 s per user) + one fake-ML run (≈ 0,5 s).
 * - `PUT …/rule-config`: FL-29-U2 ≈ 4 widths × (1 reset + 1–6 edits) = 30; FL-29-U3 4 widths × (1 other writer + 1 rejected) = 8.
 *   Page loads ≈ 40 (each width re-opens the state).
 */
import { expect, test, type Locator } from '@playwright/test';

import { ROUTES } from '../../e2e/fixtures/routes';
import { createPipelineProject, envDrawingPng, addProjectMember, poolUser } from './support/phase03Seed';
import { verifyUi } from './support/ui-verify';
import {
  DEFAULT_ON,
  DESKTOP,
  GROUPS,
  MIN_THICKNESS,
  NOID,
  ROOM_HAS_DOOR,
  ROOM_NO_DOOR,
  RS,
  TOTAL_RULES,
  WALL_LENGTH,
  WALL_THICKNESS,
  allRuleSwitches,
  closeSession,
  dialogReload,
  groupCard,
  groupSwitch,
  heading,
  indicator,
  numberField,
  openSession,
  openSettings,
  ownProject,
  putRuleConfig,
  readRevision,
  ruleSwitch,
  settled,
  severityCombo,
  shot,
  stickyFooter,
  toast,
  typeNum,
  waitRulePut,
  withAdmin,
  writeElsewhere,
  type Ctx,
  type Viewport,
} from './support/p06/ruleSettings';

interface Box {
  readonly x: number;
  readonly y: number;
  readonly width: number;
  readonly height: number;
}
const widthOf = (page: { viewportSize: () => Viewport | null }): number => page.viewportSize()?.width ?? 0;
const heightOf = (page: { viewportSize: () => Viewport | null }): number => page.viewportSize()?.height ?? 0;
const insideX = (box: Box | null, vw: number): boolean => box !== null && box.x >= -1 && box.x + box.width <= vw + 1;
const insideBox = (inner: Box | null, outer: Box | null): boolean =>
  inner !== null && outer !== null && inner.x >= outer.x - 1 && inner.x + inner.width <= outer.x + outer.width + 1;
const overlap = (a: Box | null, b: Box | null): boolean =>
  a !== null && b !== null && Math.min(a.x + a.width, b.x + b.width) - Math.max(a.x, b.x) > 1 && Math.min(a.y + a.height, b.y + b.height) - Math.max(a.y, b.y) > 1;

/** WCAG contrast ratio of an element's text against its effective background (NaN when a colour cannot be read). */
async function contrastOf(locator: Locator): Promise<number> {
  return locator.evaluate((el) => {
    type Rgba = [number, number, number, number];
    const parse = (value: string): Rgba | null => {
      const text = value.trim();
      const rgb = /^rgba?\(([^)]+)\)$/u.exec(text);
      if (rgb?.[1] !== undefined) {
        const p = rgb[1].split(/[\s,/]+/u).filter((part) => part !== '').map(Number);
        return [p[0] ?? 0, p[1] ?? 0, p[2] ?? 0, p[3] ?? 1];
      }
      const srgb = /^color\(srgb ([^)]+)\)$/u.exec(text);
      if (srgb?.[1] !== undefined) {
        const p = srgb[1].split(/[\s/]+/u).filter((part) => part !== '').map(Number);
        return [(p[0] ?? 0) * 255, (p[1] ?? 0) * 255, (p[2] ?? 0) * 255, p[3] ?? 1];
      }
      return null;
    };
    const channel = (v: number): number => {
      const s = v / 255;
      return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
    };
    const luminance = (c: readonly [number, number, number]): number => 0.2126 * channel(c[0]) + 0.7152 * channel(c[1]) + 0.0722 * channel(c[2]);
    const layers: Rgba[] = [];
    for (let node: Element | null = el; node !== null; node = node.parentElement) {
      const raw = getComputedStyle(node).backgroundColor;
      const bg = parse(raw);
      if (bg === null) {
        if (raw !== 'transparent') return Number.NaN;
        continue;
      }
      if (bg[3] > 0) {
        layers.push(bg);
        if (bg[3] >= 0.99) break;
      }
    }
    let base: [number, number, number] = [255, 255, 255];
    for (let i = layers.length - 1; i >= 0; i -= 1) {
      const [r, g, b, a] = layers[i] ?? [255, 255, 255, 1];
      base = [r * a + base[0] * (1 - a), g * a + base[1] * (1 - a), b * a + base[2] * (1 - a)];
    }
    const fg = parse(getComputedStyle(el).color);
    if (fg === null) return Number.NaN;
    const text: [number, number, number] = [
      fg[0] * fg[3] + base[0] * (1 - fg[3]),
      fg[1] * fg[3] + base[1] * (1 - fg[3]),
      fg[2] * fg[3] + base[2] * (1 - fg[3]),
    ];
    const [hi, lo] = [Math.max(luminance(text), luminance(base)), Math.min(luminance(text), luminance(base))];
    return (hi + 0.05) / (lo + 0.05);
  });
}

test.describe('SCR-29 Rule Settings · ui (4 khổ)', () => {
  test('SCR-29 · FL-29-U1 · giao diện dự án pipeline: mặc định, thu gọn, menu mức, mờ/tương phản, vùng chạm', async ({ browser }) => {
    test.setTimeout(420_000);
    test.skip(!process.env.E2E_DRAWING_PNG, 'Environment: E2E_DRAWING_PNG is not set (qa.config.json env.vars) — FL-29-U1 needs the pipeline project');
    await withAdmin(browser, async (c) => {
      const { page } = c;
      const seeded = await createPipelineProject(c.api, '29-ui-pipe', envDrawingPng());
      c.ids.push(seeded.projectId);
      const id = seeded.projectId;

      await test.step('[29-B-002] trạng thái ready mặc định: h2; "23/25 luật đang bật"; "Chưa có thay đổi"; không chân dính, không alert', async () => {
        await openSettings(page, id);
        await expect(heading(page)).toBeVisible();
        await expect(page.getByText(RS.enabledCount)).toHaveText(`${String(DEFAULT_ON)}/${String(TOTAL_RULES)} luật đang bật`);
        await expect.soft(indicator(page)).toHaveText(RS.idle);
        await expect.soft(stickyFooter(page)).toHaveCount(0);
        await expect.soft(page.getByRole('alert')).toHaveCount(0);
        await shot(page, '29-B-002', 'ready_default', 'U06s');
      });

      await test.step('[29-F-001] bố cục mọi nhóm ở 4 khổ: 2 cột (nav 220 px) / Select đầu trang; không tràn; tên luật đủ ở hàng có ngưỡng', async () => {
        const seen: { width: number; navWidth: number | null; selectAboveCards: boolean; nameClipped: boolean; rows: number }[] = [];
        const metrics = await verifyUi(page, 'U06s_29-F-001_default', async (p) => {
          await openSettings(p, id);
          const nav = p.getByRole('navigation', { name: RS.nav, exact: true });
          const select = p.getByRole('combobox', { name: RS.collapsedSelect, exact: true });
          const navBox = (await nav.count()) > 0 ? await nav.boundingBox() : null;
          const selectBox = (await select.count()) > 0 ? await select.boundingBox() : null;
          const cardBox = await groupCard(p, GROUPS[0].label).boundingBox();
          const name = p.getByText(WALL_THICKNESS.name, { exact: true });
          seen.push({
            width: widthOf(p),
            navWidth: navBox === null ? null : Math.round(navBox.width),
            selectAboveCards: selectBox !== null && cardBox !== null && selectBox.y < cardBox.y,
            nameClipped: await name.evaluate((el) => el.scrollWidth > el.clientWidth + 1),
            rows: await allRuleSwitches(p).count(),
          });
        });
        expect.soft(seen.length, 'all four widths opened').toBe(4);
        for (const layout of seen) {
          if (layout.width >= 1024) {
            expect.soft(layout.navWidth, `${String(layout.width)}: two columns, nav 220 px`).toBe(220);
          } else {
            expect.soft(layout.selectAboveCards, `${String(layout.width)}: "Mục cài đặt" select sits above the cards`).toBe(true);
          }
          expect.soft(layout.nameClipped, `${String(layout.width)}: the rule name is not cut`).toBe(false);
          expect.soft(layout.rows, `${String(layout.width)}: all rule rows`).toBe(TOTAL_RULES);
        }
        for (const m of metrics) expect.soft(m.clipped, `${m.viewport}: clipped text`).toEqual([]);
      });

      await test.step('[29-B-011] cấu trúc thu gọn: < 1024 không có navigation, có combobox "Mục cài đặt"; ≥ 1024 ngược lại', async () => {
        for (const width of [1440, 1024, 768, 375]) {
          await page.setViewportSize({ width, height: 900 });
          await openSettings(page, id);
          const nav = page.getByRole('navigation', { name: RS.nav, exact: true });
          const select = page.getByRole('combobox', { name: RS.collapsedSelect, exact: true });
          await expect.soft(nav, `${String(width)}: navigation`).toHaveCount(width >= 1024 ? 1 : 0);
          await expect.soft(select, `${String(width)}: collapsed select`).toHaveCount(width >= 1024 ? 0 : 1);
        }
        await shot(page, '29-B-011', 'collapsed_structure', 'U06s');
      });

      await test.step('[29-F-002] menu mức độ mở (không chọn): ba option trọn trong khung ở 4 khổ', async () => {
        const seen: { width: number; height: number; boxes: (Box | null)[] }[] = [];
        const metrics = await verifyUi(page, 'U06s_29-F-002_severity_menu', async (p) => {
          await openSettings(p, id);
          await severityCombo(p, WALL_THICKNESS.name).click();
          const options = p.getByRole('option');
          await expect(options).toHaveCount(3);
          seen.push({ width: widthOf(p), height: heightOf(p), boxes: await Promise.all([0, 1, 2].map((i) => options.nth(i).boundingBox())) });
        });
        expect.soft(seen.length, 'all four widths opened the menu').toBe(4);
        for (const one of seen) {
          for (const box of one.boxes) {
            expect.soft(insideX(box, one.width) && box !== null && box.y >= -1 && box.y + box.height <= one.height + 1, `${String(one.width)}: option inside the viewport`).toBe(true);
          }
        }
        expect.soft(metrics.length).toBe(4);
      });

      await test.step('[29-A-014] liệt kê mức: đúng ba option "Nghiêm trọng", "Cảnh báo", "Gợi ý"; không "Bỏ qua"', async () => {
        const options = page.getByRole('option');
        if ((await options.count()) === 0) await severityCombo(page, WALL_THICKNESS.name).click();
        const names = (await options.allInnerTexts()).map((text) => text.trim());
        expect.soft(names).toEqual(['Nghiêm trọng', 'Cảnh báo', 'Gợi ý']);
        expect.soft(names).not.toContain('Bỏ qua');
        await shot(page, '29-A-014', 'three_levels', 'U06s');
        await page.keyboard.press('Escape');
      });

      await test.step('[29-B-013] luật tắt mờ (opacity-40) nhưng ghi chú "Đã được thay thế bởi …" không mờ', async () => {
        await page.setViewportSize(DESKTOP);
        await openSettings(page, id);
        const sentence = page.getByText(ROOM_HAS_DOOR.name, { exact: true });
        const note = page.getByText(`Đã được thay thế bởi ${ROOM_NO_DOOR.name}`, { exact: true });
        await expect(note).toBeVisible();
        expect.soft(await sentence.evaluate((el) => el.closest('.opacity-40') !== null), 'the off rule is dimmed').toBe(true);
        expect.soft(await note.evaluate((el) => el.closest('.opacity-40') === null), 'its "thay thế" note is not (BUG-457)').toBe(true);
        await shot(page, '29-B-013', 'dimmed_off_rule', 'U06s');
      });

      await test.step('[29-E-010] tương phản ghi chú thay thế ≥ 4,5:1 kể cả ở hàng tắt', async () => {
        const note = page.getByText(`Đã được thay thế bởi ${ROOM_NO_DOOR.name}`, { exact: true });
        const ratio = await contrastOf(note);
        expect.soft(Number.isNaN(ratio), 'UNKNOWN — NEED VERIFICATION: a colour that is not rgb()/color(srgb) could not be read').toBe(false);
        expect.soft(ratio, 'contrast of the note on its card').toBeGreaterThanOrEqual(4.5);
        await shot(page, '29-E-010', 'note_contrast', 'U06s');
      });

      await test.step('[29-E-012] vùng chạm ≥ 24 px (Select thu gọn ≥ 44 px ở 375): link nav, nút bộ luật, switch, ô số', async () => {
        const measure = async (): Promise<Record<string, number>> =>
          page.evaluate(() => {
            const smallest = (nodes: Element[]): number =>
              nodes.length === 0
                ? Number.POSITIVE_INFINITY
                : Math.min(...nodes.map((node) => {
                    const r = node.getBoundingClientRect();
                    return Math.min(r.width, r.height);
                  }));
            return {
              nav: smallest([...document.querySelectorAll('nav[aria-label="Mục cài đặt bộ luật"] a')]),
              presets: smallest([...document.querySelectorAll('section[aria-label="Bộ luật sẵn"] button')]),
              switches: smallest([...document.querySelectorAll('[role="switch"]')]),
              fields: smallest([...document.querySelectorAll('input[type="text"], input:not([type])')].filter((el) => el.getBoundingClientRect().width > 0)),
              select: smallest([...document.querySelectorAll('button[role="combobox"]')].slice(0, 1)),
            };
          });
        for (const width of [1440, 375]) {
          await page.setViewportSize({ width, height: 900 });
          await openSettings(page, id);
          const size = await measure();
          for (const [kind, px] of Object.entries(size)) {
            if (!Number.isFinite(px)) continue; // that control does not exist at this width
            expect.soft(px, `${String(width)}: ${kind} smallest side`).toBeGreaterThanOrEqual(24);
          }
          if (width === 375) {
            await expect(page.getByRole('combobox', { name: RS.collapsedSelect, exact: true })).toBeVisible();
            const select = await page.getByRole('combobox', { name: RS.collapsedSelect, exact: true }).boundingBox();
            expect.soft(select?.height ?? 0, '375: the collapsed Select is a text control → 44 px').toBeGreaterThanOrEqual(44);
          }
        }
        await shot(page, '29-E-012', 'touch_targets', 'U06s');
      });
    });
  });

  test('SCR-29 · FL-29-U2 · giao diện dự án trống: không lớp, chân dính + toast, ô lỗi, thẻ ngưỡng chung, tắt hết', async ({ browser }) => {
    test.setTimeout(420_000);
    await withAdmin(browser, async (c: Ctx) => {
      const { page } = c;
      const { projectId: id } = await ownProject(c, '29-ui-empty');
      /** Every width starts from the default config: the rule config is a server-side thing and earlier widths wrote it. */
      const resetConfig = async (): Promise<void> => {
        const revision = await readRevision(c.api, id);
        if (revision > 0) expect((await putRuleConfig(c.api, id, revision, {})).status, 'setup: reset rule config').toBe(200);
      };

      await test.step('[29-F-003] dự án không lớp: như ready, không phải trạng thái lỗi; 25 hàng', async () => {
        const metrics = await verifyUi(page, 'U06s_29-F-003_no_layer', async (p) => {
          await openSettings(p, id);
        });
        expect(metrics.length).toBe(4);
        await expect(allRuleSwitches(page)).toHaveCount(TOTAL_RULES);
        await expect(page.getByText(RS.loadErrorTitle, { exact: true })).toHaveCount(0);
        await expect.soft(heading(page)).toBeVisible();
      });

      await test.step('[29-F-009] nav tới "Ngưỡng chung": lưới 1 cột (< sm) / 2 cột; nhãn dài xuống dòng, không cắt', async () => {
        const seen: { width: number; columns: number; clipped: boolean; inView: boolean }[] = [];
        await verifyUi(page, 'U06s_29-F-009_general_card', async (p) => {
          await openSettings(p, id);
          if (widthOf(p) >= 1024) {
            await p.getByRole('navigation', { name: RS.nav, exact: true }).getByRole('link', { name: RS.generalNav, exact: true }).click();
          } else {
            await p.getByRole('combobox', { name: RS.collapsedSelect, exact: true }).click();
            await p.getByRole('option', { name: RS.generalNav, exact: true }).click();
          }
          const card = groupCard(p, RS.generalNav);
          await expect(card).toBeInViewport();
          const label = card.getByText(RS.generalJoint, { exact: true });
          seen.push({
            width: widthOf(p),
            columns: await card.locator('div.grid').evaluate((el) => getComputedStyle(el).gridTemplateColumns.split(' ').length),
            clipped: await label.evaluate((el) => el.scrollWidth > el.clientWidth + 1 || el.scrollHeight > el.clientHeight + 1),
            inView: insideBox(await label.boundingBox(), await card.boundingBox()),
          });
        });
        expect.soft(seen.length, 'all four widths opened').toBe(4);
        for (const one of seen) {
          expect.soft(one.columns, `${String(one.width)}: grid columns (sm = 640)`).toBe(one.width < 640 ? 1 : 2);
          expect.soft(one.clipped, `${String(one.width)}: the long label wraps, it is not cut`).toBe(false);
          expect.soft(one.inView, `${String(one.width)}: the label stays inside its card`).toBe(true);
        }
      });

      await test.step('[29-F-006] ô "Bề dày tường tối thiểu" gõ 250: alert "Giá trị không quá 200 mm." trong thẻ, không tràn', async () => {
        const seen: { width: number; inside: boolean }[] = [];
        await verifyUi(page, 'U06s_29-F-006_field_error', async (p) => {
          await openSettings(p, id);
          await typeNum(numberField(p, MIN_THICKNESS.label), '250');
          const alert = p.getByRole('alert').filter({ hasText: 'Giá trị không quá 200 mm.' });
          await expect(alert).toBeVisible();
          seen.push({ width: widthOf(p), inside: insideBox(await alert.boundingBox(), await groupCard(p, GROUPS[0].label).boundingBox()) });
        });
        expect.soft(seen.length, 'all four widths opened').toBe(4);
        for (const one of seen) expect.soft(one.inside, `${String(one.width)}: the alert stays inside the "Hình học" card`).toBe(true);
      });

      await test.step('[29-F-005] tắt một luật: chân dính + "Khôi phục mặc định" bám đáy; toast không chồng chân dính', async () => {
        const seen: { width: number; height: number; footer: Box | null; button: Box | null; toast: Box | null }[] = [];
        await verifyUi(page, 'U06s_29-F-005_sticky_footer', async (p) => {
          await resetConfig();
          await openSettings(p, id);
          const saved = waitRulePut(p, id);
          await ruleSwitch(p, WALL_THICKNESS.name).click();
          await saved;
          const footer = stickyFooter(p);
          await expect(footer).toBeVisible();
          const message = toast(p, `Tắt luật ${WALL_THICKNESS.name}.`).first();
          await expect(message).toBeVisible();
          seen.push({
            width: widthOf(p),
            height: heightOf(p),
            footer: await footer.boundingBox(),
            button: await footer.getByRole('button', { name: RS.restoreDefaults, exact: true }).boundingBox(),
            toast: await message.boundingBox(),
          });
          await settled(p);
        });
        expect.soft(seen.length, 'all four widths opened').toBe(4);
        for (const one of seen) {
          expect.soft(one.footer !== null && one.footer.y + one.footer.height >= one.height - 120 && one.footer.y + one.footer.height <= one.height + 1, `${String(one.width)}: the footer hugs the bottom edge`).toBe(true);
          expect.soft(insideX(one.button, one.width), `${String(one.width)}: "Khôi phục mặc định" inside the viewport`).toBe(true);
          expect.soft(overlap(one.toast, one.footer), `${String(one.width)}: the toast does not sit on the sticky footer`).toBe(false);
        }
      });

      await test.step('[29-F-010] tắt hết: alert "Mọi luật đều đang tắt…" đọc được; hàng mờ không vỡ bố cục', async () => {
        const seen: { width: number; alert: Box | null }[] = [];
        const metrics = await verifyUi(page, 'U06s_29-F-010_all_off', async (p) => {
          await resetConfig();
          await openSettings(p, id);
          for (const group of GROUPS) {
            const sw = groupSwitch(p, group.label);
            if ((await sw.getAttribute('aria-checked')) === 'true') await sw.click();
            await expect(sw).toHaveAttribute('aria-checked', 'false');
          }
          const alert = p.getByText(RS.disableAll, { exact: true });
          await expect(alert).toBeVisible();
          seen.push({ width: widthOf(p), alert: await alert.boundingBox() });
          await settled(p);
        });
        expect.soft(seen.length, 'all four widths opened').toBe(4);
        for (const one of seen) expect.soft(insideX(one.alert, one.width), `${String(one.width)}: the alert is readable inside the viewport`).toBe(true);
        for (const m of metrics) expect.soft(m.overlaps, `${m.viewport}: overlapping controls`).toEqual([]);
      });
    });
  });

  test('SCR-29 · FL-29-U3 · giao diện chỉ đọc, xung đột, hộp thoại, dự án không tồn tại', async ({ browser }) => {
    test.setTimeout(420_000);
    await withAdmin(browser, async (c: Ctx) => {
      const { page } = c;
      const { projectId: id } = await ownProject(c, '29-ui-states');
      const engineer = await poolUser(c.api, 'engineer', 'p06-settings1');
      await addProjectMember(c.api, id, engineer.email);
      await writeElsewhere(c.api, id, { [WALL_LENGTH.code]: { enabled: false } }); // "+X": a non-default config exists before anybody opens the screen
      const eng = await openSession(browser, engineer);
      /** "+X" again at the revision the server holds now, then one edit of this page → 409 (its store still holds the old revision). */
      const conflictAt = async (): Promise<void> => {
        await openSettings(page, id);
        await writeElsewhere(c.api, id, { [WALL_LENGTH.code]: { enabled: false } });
        const rejected = waitRulePut(page, id, undefined, [409]);
        await ruleSwitch(page, WALL_THICKNESS.name).click();
        await rejected;
        await expect(page.getByText(RS.conflict, { exact: true })).toBeVisible();
      };
      try {
        await test.step('[29-F-004] kỹ sư mở route: alert chỉ-đọc trọn khung; mức là chữ; không hàng bộ luật sẵn', async () => {
          const seen: { width: number; alert: Box | null; combos: number; presets: number }[] = [];
          await verifyUi(eng.page, 'U06s_29-F-004_read_only', async (p) => {
            await openSettings(p, id);
            const alert = p.getByText(RS.readOnly, { exact: true });
            await expect(alert).toBeVisible();
            seen.push({
              width: widthOf(p),
              alert: await alert.boundingBox(),
              combos: await p.getByRole('combobox').count(),
              presets: await p.getByRole('region', { name: RS.presets, exact: true }).count(),
            });
          });
          expect(seen.length, 'all four widths opened').toBe(4);
          for (const one of seen) {
            expect.soft(insideX(one.alert, one.width), `${String(one.width)}: the read-only alert fits the viewport`).toBe(true);
            // 375 and 768 draw the "Mục cài đặt" Select (nav → Select); the severity pickers must be plain text either way
            expect.soft(one.combos, `${String(one.width)}: only the collapsed nav Select may be a combobox`).toBe(one.width < 1024 ? 1 : 0);
            expect.soft(one.presets, `${String(one.width)}: no preset row`).toBe(0);
          }
        });

        await test.step('[29-F-007] admin: "+X" ghi, tắt một luật → 409: InlineAlert + "Tải lại" trọn trong khung', async () => {
          const seen: { width: number; alert: Box | null; button: Box | null }[] = [];
          await verifyUi(page, 'U06s_29-F-007_conflict', async (p) => {
            await conflictAt();
            seen.push({
              width: widthOf(p),
              alert: await p.getByText(RS.conflict, { exact: true }).boundingBox(),
              button: await p.getByRole('button', { name: RS.reload, exact: true }).boundingBox(),
            });
          });
          expect.soft(seen.length, 'all four widths opened').toBe(4);
          for (const one of seen) {
            expect.soft(insideX(one.alert, one.width), `${String(one.width)}: the conflict message fits`).toBe(true);
            expect.soft(insideX(one.button, one.width), `${String(one.width)}: the "Tải lại" button fits`).toBe(true);
          }
        });

        await test.step('[29-F-008] "Tải lại" → dialog 480 px thu theo khổ; hai nút không cắt', async () => {
          const seen: { width: number; dialog: Box | null; later: Box | null; confirm: Box | null }[] = [];
          await verifyUi(page, 'U06s_29-F-008_reload_dialog', async (p) => {
            await conflictAt();
            await p.getByRole('button', { name: RS.reload, exact: true }).click();
            const dialog = dialogReload(p);
            await expect(dialog).toBeVisible();
            seen.push({
              width: widthOf(p),
              dialog: await dialog.boundingBox(),
              later: await dialog.getByRole('button', { name: RS.reloadLater, exact: true }).boundingBox(),
              confirm: await dialog.getByRole('button', { name: RS.reloadConfirm, exact: true }).boundingBox(),
            });
          }, undefined, { fullPage: false });
          expect.soft(seen.length, 'all four widths opened').toBe(4);
          for (const one of seen) {
            const expected = Math.min(480, one.width - 32); // Modal.tsx p-4 frame, width={480}
            expect.soft(Math.abs((one.dialog?.width ?? 0) - expected) <= 2, `${String(one.width)}: dialog ${String(Math.round(one.dialog?.width ?? 0))} px vs ${String(expected)}`).toBe(true);
            expect.soft(insideBox(one.later, one.dialog) && insideBox(one.confirm, one.dialog), `${String(one.width)}: both buttons inside the dialog`).toBe(true);
          }
        });

        await test.step('[29-F-013] dự án không tồn tại: "Không tìm thấy dự án này" với biểu tượng nhìn thấy', async () => {
          const noid = NOID();
          const metrics = await verifyUi(page, 'U06s_29-F-013_unknown_project', async (p) => {
            await p.goto(ROUTES.project.ruleSettings(noid));
            await expect(p.getByText(RS.notFoundTitle, { exact: true })).toBeVisible({ timeout: 30_000 });
            await expect(p.getByRole('alert').locator('svg').first(), 'the icon is drawn (BUG-461)').toBeVisible();
          });
          expect(metrics.length).toBe(4);
        });
      } finally {
        await closeSession(eng);
      }
    });
  });
});
