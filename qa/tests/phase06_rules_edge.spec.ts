/**
 * Phase 6 — SCR-28 Rule Report (`/projects/:id/rules`) and its sheet "Chi tiết vi phạm" (28V), REAL stack, track A.
 * QA-06b pack P1 (plan: F:/App/AppBack/backend/dieu-phoi/chay/QA-06b/flows-C1.md `phase06_rules_edge.spec.ts`; ids ids-P1.txt, 141).
 * One flow = one `test()` = one journey on its own run-unique project; every id is one `test.step('[<id>] …')`.
 *
 * FE source (master d50bb248): RR RuleReport.tsx · RRG RuleReportGroups.tsx · RRS RuleReportSummary.tsx · RRC RuleReport.container.tsx ·
 * URR useRuleReport.ts · VD ViolationDetail.tsx · VDS ViolationDetailSections.tsx · VDF ViolationDetailFigure.tsx ·
 * UV useViolationDetail.ts · PSG src/components/feedback/ProjectSpatialGate.tsx (all under src/screens/rules/… or src/components/feedback/).
 *
 * ## Non-serial
 * Every test opens its own context from the stored admin session, creates its own `qa-<runId>-rules-…` project(s) through the real
 * API (`support/p06/rules.ts createRuleProject`, layer written through #35) and deletes them in `finally` (`closeAdmin`).
 * Pool users use slots `p06-rules` / `p06-rules-n` only (viewer, engineer member, engineer non-member).
 *
 * ## Real-backend budget per run (BE defaults; QA stack override `qa-limits.override.yml`)
 * - `POST /api/auth/login`: 0 for the admin (stored session); 1 per pool session (FL-28-08 ×1, FL-28-10 ×2) + 1 admin API login in
 *   those two flows (`adminRequest`) ⇒ ≤ 5 per run (limit 120 / 60 s per IP).
 * - `POST /api/auth/refresh` (300 / 60 s): 2 per test (session check + fixture token) + 1 per page load ≈ 3–8 per test.
 * - `POST /api/projects` : 17, each deleted in `finally` (no rate limit, BE apps/api/projects/router.py:54).
 * - `PUT …/spatial/layer` (#35) : 1–3 per project seed + ≤ 6 from the sheet fixes; `PUT …/rule-config` (N22) ≤ 6 in FL-28-09/FL-28V-05;
 *   neither is rate limited (no `rate_limit(` in BE spatial_write/ or rules/).
 * - `drawings_init` / pipeline: 0 (no drawing is uploaded; the layer is written by API).
 * - Pool invitations: only on a slot's first fill (`poolUser`), 3 slots.
 *
 * ## Conventions
 * ⚑ = suspected bug: the step asserts the CORRECT behaviour and stays red while the bug is there. `// S5-confirm:` = a seed value /
 * selector assumed from source, to be confirmed by the first real run. `UNKNOWN — NEED VERIFICATION` = no way found from source.
 */
import { expect, test } from '@playwright/test';
import type { Locator, Page } from '@playwright/test';

import { ROUTES } from '../../e2e/fixtures/routes';
import { waitForApi } from '../../e2e/fullstack/apiWatch';
import type { ApiEntry } from '../../e2e/fullstack/apiWatch';
import { readBaseUrl } from '../../e2e/fullstack/env';
import { attachJson, captureEvidence } from './support/evidence';
import { layerPathOf, writeLayer } from './support/layerSeed';
import { addProjectMember, poolUser } from './support/phase03Seed';
import {
  AT_1024,
  BELOW_1024,
  NARROW,
  RULE_NAMES,
  adminRequest,
  allHeaders,
  confirmButton,
  createCleanProject,
  createRuleProject,
  expandAll,
  expandRule,
  floorSelect,
  groupHeaders,
  groupSelect,
  headerInfos,
  layerPutRe,
  levelFilter,
  levelRadio,
  onlyRule,
  openFirstRowOf,
  openRules,
  openSheet,
  pathOf,
  poolSession,
  putRuleConfig,
  quiet,
  readFloorLayer,
  reportHeading,
  rerunButton,
  resolvedHeader,
  rowCode,
  rowMessage,
  rowView,
  rowsOf,
  ruleConfigRe,
  ruleLayer,
  ruleSection,
  seededOf,
  settledInt,
  settledText,
  sheet,
  sheetTitle,
  spatialRe,
  summaryValue,
  toast,
  trackLayerPuts,
  uniq,
  watchText,
  withAdmin,
  writesSince,
} from './support/p06/rules';
import type { HeaderInfo } from './support/p06/rules';

/* ---------------------------------------------------------------- constants (each cites its source) */

const softly = expect.configure({ soft: true });

/** RRL GROUP_LABELS: the tail of a passed-list `li` (RuleReportGroups.tsx RuleReportPassedList). */
const GROUP_TAIL = /(Hình học|Lưu thông|Diện tích|Ghi chú|Cao độ tầng)$/u;
const SEVERITY_WORDS = ['Nghiêm trọng', 'Cảnh báo', 'Gợi ý'] as const;
const DELETE_ACTION = 'Xoá đối tượng này'; // UV actions
const RENAME_ACTION = 'Đặt tên phòng theo công năng'; // UV actions
const SAVED_LABEL = /^Đã lưu lúc \d{2}:\d{2}$/u; // useSaveIndicator.ts
const ADVANCE_BANNER = 'Sắp chuyển sang vi phạm kế tiếp.'; // VD notices
const KEEP_BUTTON = 'Giữ lại màn này'; // VD notices
const FIXED_LINE = /^Đã sửa xong; luật .+ chạy lại và không còn báo lỗi trên đối tượng này\.$/u; // UV resolvedMessageOf
const UNDO = 'Hoàn tác'; // components/feedback/Toast.tsx
const NO_ACTIONS_LINE = 'Chưa có cách sửa tự động nào cho vi phạm này. Phần căn cứ ở trên đủ để sửa tay trên Bản vẽ.'; // VD notices
const SAVE_FAILED = 'Lưu thất bại'; // LAYER_SAVE_MESSAGES / useSaveIndicator
const RELOAD_MESSAGE = 'Tầng này vừa được sửa ở nơi khác. Tải lại để xem bản mới nhất.'; // spatialLayerSave.ts:83
const FORBIDDEN_MESSAGE = 'Bạn không còn quyền sửa tầng này.'; // spatialLayerSave.ts:81
const GATE_TITLE = 'Không tìm thấy dự án này'; // PSG
const GATE_DESCRIPTION = 'Dự án có thể đã bị xoá, đường dẫn chưa đúng, hoặc bạn chưa được thêm vào dự án.'; // PSG
const GATE_BACK = 'Về danh sách dự án'; // PSG
const WALLS_IN_RULE_LAYER = (ruleLayer('L-count', { thinWalls: false }) as { walls: unknown[] }).walls.length;

/* ---------------------------------------------------------------- spec-local helpers */

/** Evidence `E06r_<row id>_<slug>.png` (one per step). */
const shot = (page: Page, id: string, slug: string, caption?: string): Promise<string> =>
  captureEvidence(page, `E06r_${id}_${slug}.png`, caption === undefined ? {} : { caption });

const passedItems = (page: Page): Locator => page.getByRole('listitem').filter({ hasText: GROUP_TAIL });
const sectionAt = (page: Page, index: number): Locator => groupHeaders(page).nth(index).locator('xpath=ancestor::section[1]');

interface Figures {
  readonly total: number;
  readonly passed: number;
  readonly warnings: number;
  readonly violations: number;
}

/** The four settled figures of the strip (RRS SummaryStat). */
async function figuresOf(page: Page): Promise<Figures> {
  return {
    total: await settledInt(summaryValue(page, 'Tổng số kiểm tra')),
    passed: await settledInt(summaryValue(page, 'Đạt')),
    warnings: await settledInt(summaryValue(page, 'Cảnh báo')),
    violations: await settledInt(summaryValue(page, 'Nghiêm trọng')),
  };
}

/** Opens a Select (role combobox) and picks `option`. */
async function pick(page: Page, combobox: Locator, option: string): Promise<void> {
  await combobox.click();
  await page.getByRole('option', { name: option, exact: true }).click();
  await expect(combobox).toContainText(option);
}

/** Radio "Tất cả" + both selects back to "all". */
async function resetFilters(page: Page): Promise<void> {
  await levelRadio(page, 'Tất cả').click();
  await expect(levelRadio(page, 'Tất cả')).toHaveAttribute('aria-checked', 'true');
  await pick(page, groupSelect(page), 'Tất cả nhóm luật');
  await pick(page, floorSelect(page), 'Tất cả các tầng');
}

/** `:focus-visible` ring after a keyboard-initiated focus: a computed box-shadow or outline. */
async function hasFocusRing(page: Page, locator: Locator): Promise<boolean> {
  await page.keyboard.press('Shift'); // a key press first, so a scripted focus() counts as keyboard focus
  await locator.focus();
  return locator.evaluate((element) => {
    const style = getComputedStyle(element);
    return style.boxShadow !== 'none' || (style.outlineStyle !== 'none' && style.outlineWidth !== '0px');
  });
}

/** Group info of a rule (by name) after a fresh read of the headers. */
async function infoOf(page: Page, ruleName: string | RegExp): Promise<HeaderInfo | undefined> {
  const infos = await headerInfos(page);
  return infos.find((info) => (typeof ruleName === 'string' ? info.ruleName === ruleName : ruleName.test(info.ruleName)));
}

/** Messages of every open row in report order (expands every group first). */
async function allMessages(page: Page): Promise<string[]> {
  await expandAll(page);
  const rows = page.locator('section tbody tr');
  const count = await rows.count();
  const texts: string[] = [];
  for (let i = 0; i < count; i += 1) texts.push((await rowMessage(rows.nth(i)).innerText()).trim());
  return texts;
}

/** Canvas has painted something: a plain-colour PNG compresses to about a kilobyte. S5-confirm: threshold. */
async function canvasHasContent(canvas: Locator): Promise<boolean> {
  const png = await canvas.screenshot();
  return png.length > 3_000;
}

/* ================================================================= SCR-28 · report */

test.describe('SCR-28 Rule Report (edge, real)', () => {
  test.setTimeout(240_000);

  test('SCR-28 · FL-28-01 · Anatomy, numbers and wire', async ({ browser }) => {
    await withAdmin(browser, async (admin) => {
      const { page, api } = admin;
      const project = await createRuleProject(admin, 'rules-anatomy');
      const nav = page.getByRole('navigation', { name: 'Đường dẫn trang', exact: true });
      const spatialReads = (): number => api.filter((e) => e.method === 'GET' && spatialRe(project.id).test(e.path)).length;
      const configReads = (): ApiEntry[] => api.filter((e) => e.method === 'GET' && ruleConfigRe(project.id).test(e.path));
      let first: Figures = { total: 0, passed: 0, warnings: 0, violations: 0 };
      let firstTitles: string[] = [];
      let firstOpenSum = 0;

      await test.step('[28-G-001] open the route, watcher on', async () => {
        await openRules(page, project.id);
        await expect.poll(() => api.find((e) => e.method === 'GET' && e.path === `/api/projects/${project.id}`)?.status).toBe(200);
        await expect(reportHeading(page)).toBeVisible();
        await shot(page, '28-G-001', 'open');
      });

      await test.step('[28-G-003] N21 rule-config read', async () => {
        await softly.poll(() => configReads()[0]?.status).toBe(200);
        await softly.poll(() => configReads()[0]?.json).toMatchObject({ revision: 0, overrides: {} });
        await attachJson('E06r_28-G-003_reads.json', { ruleConfigReads: configReads().length }); // informational: 2 expected
        await shot(page, '28-G-003', 'rule_config');
      });

      await test.step('[28-G-002] exactly one N15 read so far', async () => {
        expect.soft(spatialReads(), 'GET …/spatial so far').toBe(1);
        await shot(page, '28-G-002', 'spatial_once');
      });

      await test.step('[28-A-002] breadcrumb "Dự án" is plain text (⚑ low)', async () => {
        // Pins today's markup (RR trail: <li>Dự án</li>); SCR-11's crumb is a link — see catalog Notes 7.
        await expect.soft(nav.getByRole('link', { name: 'Dự án', exact: true })).toHaveCount(0);
        await expect.soft(nav.getByText('Dự án', { exact: true })).toBeVisible();
        await shot(page, '28-A-002', 'trail');
      });

      await test.step('[28-A-004] last-run label', async () => {
        await expect.soft(page.getByText(/vừa xong/u).first()).toBeVisible();
        await expect.soft(rerunButton(page)).toBeVisible();
        await shot(page, '28-A-004', 'last_run');
      });

      await test.step('[28-B-003] ready layout', async () => {
        await expect.soft(page.locator('dl')).toBeVisible();
        await expect.soft(levelFilter(page)).toBeVisible();
        await expect.soft(groupSelect(page)).toBeVisible();
        await expect.soft(floorSelect(page)).toBeVisible();
        await expect.soft(groupHeaders(page).first()).toHaveAttribute('aria-expanded', 'false');
        await expect.soft(confirmButton(page)).toBeDisabled();
        await shot(page, '28-B-003', 'ready');
      });

      await test.step('[28-B-013] nothing missing is offered', async () => {
        await expect.soft(page.getByRole('complementary', { name: 'Xem trước mô hình' })).toHaveCount(0);
        await expect.soft(page.locator('canvas')).toHaveCount(0);
        await expect.soft(page.getByRole('button', { name: /tự động|bỏ qua/iu })).toHaveCount(0);
        await shot(page, '28-B-013', 'no_preview');
      });

      await test.step('[28-C-001] Tổng = Đạt list items + group headers', async () => {
        first = await figuresOf(page);
        const infos = await headerInfos(page);
        firstTitles = infos.map((info) => info.title);
        await levelRadio(page, 'Đạt').click();
        const passedCount = await passedItems(page).count();
        await levelRadio(page, 'Tất cả').click();
        await expect(groupHeaders(page).first()).toBeVisible();
        expect.soft(first.total, 'Tổng').toBe(passedCount + infos.length);
        await shot(page, '28-C-001', 'total', JSON.stringify(first));
      });

      await test.step('[28-C-002] Đạt = Tổng − group headers', async () => {
        expect.soft(first.passed, 'Đạt').toBe(first.total - firstTitles.length);
        await shot(page, '28-C-002', 'passed');
      });

      await test.step('[28-C-003] Nghiêm trọng = headers starting "Nghiêm trọng ·"', async () => {
        const infos = await headerInfos(page);
        expect.soft(first.violations, 'Nghiêm trọng').toBe(infos.filter((info) => info.severity === 'Nghiêm trọng').length);
        await shot(page, '28-C-003', 'violations');
      });

      await test.step('[28-C-004] Cảnh báo = headers − Nghiêm trọng', async () => {
        expect.soft(first.warnings, 'Cảnh báo').toBe(firstTitles.length - first.violations);
        await shot(page, '28-C-004', 'warnings');
      });

      await test.step('[28-C-005] Tổng = Đạt + Cảnh báo + Nghiêm trọng', async () => {
        expect.soft(first.total, 'identity').toBe(first.passed + first.warnings + first.violations);
        await shot(page, '28-C-005', 'identity');
      });

      await test.step('[28-C-006] Σ "N mục chưa xử lý" = rows after expanding every group', async () => {
        await expandAll(page);
        const infos = await headerInfos(page);
        firstOpenSum = infos.reduce((sum, info) => sum + info.open, 0);
        expect.soft(await page.locator('section tbody tr').count(), 'rows').toBe(firstOpenSum);
        await shot(page, '28-C-006', 'rows');
      });

      await test.step('[28-A-005] "Chạy kiểm tra lại" writes nothing and does not re-read N15', async () => {
        const mark = api.length;
        await rerunButton(page).click();
        await expect(rerunButton(page)).toBeEnabled();
        await quiet(page);
        expect.soft(writesSince(api, mark), 'writes').toEqual([]);
        expect
          .soft(api.slice(mark).filter((e) => e.method === 'GET' && spatialRe(project.id).test(e.path)).length, 'N15 reads')
          .toBe(0);
        await shot(page, '28-A-005', 'rerun_local');
      });

      await test.step('[28-A-006] determinism', async () => {
        expect.soft(await figuresOf(page), 'figures').toEqual(first);
        expect.soft((await headerInfos(page)).map((info) => info.title), 'group order').toEqual(firstTitles);
        expect.soft(await page.locator('section tbody tr').count(), 'rows').toBe(firstOpenSum);
        expect.soft(spatialReads(), 'GET …/spatial for the whole flow').toBe(1);
        await shot(page, '28-A-006', 'deterministic');
      });
    });
  });

  test('SCR-28 · FL-28-02 · Groups, rows, keyboard', async ({ browser }) => {
    await withAdmin(browser, async (admin) => {
      const { page } = admin;
      const project = await createRuleProject(admin, 'rules-groups');
      await openRules(page, project.id);
      const first = groupHeaders(page).first();
      const second = groupHeaders(page).nth(1);

      await test.step('[28-A-008] Enter, Space, Enter toggle the first group', async () => {
        await first.focus();
        await page.keyboard.press('Enter');
        await expect(first).toHaveAttribute('aria-expanded', 'true');
        await page.keyboard.press('Space');
        await expect(first).toHaveAttribute('aria-expanded', 'false');
        await page.keyboard.press('Enter');
        await expect(first).toHaveAttribute('aria-expanded', 'true');
        await shot(page, '28-A-008', 'keyboard_toggle');
      });

      await test.step('[28-A-009] header copy and N = rows of the open table', async () => {
        const [info] = await headerInfos(page);
        expect.soft(info?.title ?? '', 'title').toMatch(/^.+ · (Hình học|Lưu thông|Diện tích|Ghi chú|Cao độ tầng)$/u);
        expect.soft(info?.summary ?? '', 'summary').toMatch(/^(Nghiêm trọng|Cảnh báo|Gợi ý) · \d[\d.]* mục chưa xử lý/u);
        expect.soft(await rowsOf(sectionAt(page, 0)).count(), 'rows of the open table').toBe(info?.open ?? -1);
        await shot(page, '28-A-009', 'header_copy');
      });

      await test.step('[28-A-010] two groups open independently', async () => {
        await second.click();
        await expect.soft(first).toHaveAttribute('aria-expanded', 'true');
        await expect.soft(second).toHaveAttribute('aria-expanded', 'true');
        await first.click();
        await expect.soft(first).toHaveAttribute('aria-expanded', 'false');
        await expect.soft(second).toHaveAttribute('aria-expanded', 'true');
        await shot(page, '28-A-010', 'two_groups');
      });

      await test.step('[28-A-011] header order by severity', async () => {
        const infos = await headerInfos(page);
        const ranks = infos.map((info) => SEVERITY_WORDS.indexOf(info.severity as (typeof SEVERITY_WORDS)[number]));
        expect.soft(ranks, 'severity rank never decreases').toEqual([...ranks].sort((a, b) => a - b));
        expect.soft(infos[0]?.severity, 'first group').toBe('Nghiêm trọng');
        expect.soft(infos.at(-1)?.severity, 'last group').toBe('Gợi ý');
        await shot(page, '28-A-011', 'order');
      });

      await test.step('[28-A-012] one row of each severity', async () => {
        await expandAll(page);
        const infos = await headerInfos(page);
        for (const word of SEVERITY_WORDS) {
          const index = infos.findIndex((info) => info.severity === word);
          expect.soft(index, `a group of severity ${word}`).toBeGreaterThanOrEqual(0);
          if (index < 0) continue;
          const row = rowsOf(sectionAt(page, index)).first();
          const cells = row.locator('td');
          await expect.soft(cells.nth(0), `${word} badge`).toHaveText(word);
          await expect.soft(cells.nth(1), 'message').not.toBeEmpty();
          await expect.soft(cells.nth(2), 'floor').toHaveText(/^(Tầng 1|—)$/u);
          await expect.soft(rowCode(row), 'mono code').toHaveText(/^#/u); // S5-confirm: displayCodeIn prints "#…"
          await expect.soft(rowView(row), 'Xem').toBeVisible();
        }
        await shot(page, '28-A-012', 'row_anatomy');
      });

      await test.step('[28-C-007] severity order inside WALL-THICKNESS and FURNITURE-CLASH', async () => {
        for (const name of [RULE_NAMES.wallThickness, RULE_NAMES.furnitureClash]) {
          const badges = await rowsOf(ruleSection(page, name)).locator('td:first-child').allInnerTexts();
          const ranks = badges.map((text) => SEVERITY_WORDS.indexOf(text.trim() as (typeof SEVERITY_WORDS)[number]));
          expect.soft(badges.length, `${name} rows`).toBeGreaterThan(0);
          expect.soft(ranks, `${name}: severity non-increasing`).toEqual([...ranks].sort((a, b) => a - b));
        }
        await shot(page, '28-C-007', 'order_in_group');
      });

      await test.step('[28-C-008] the object code appears inside its message', async () => {
        const rows = page.locator('section tbody tr');
        const count = await rows.count();
        expect.soft(count, 'rows').toBeGreaterThan(0);
        for (let i = 0; i < count; i += 1) {
          const row = rows.nth(i);
          const code = (await rowCode(row).innerText()).trim();
          expect.soft((await rowMessage(row).innerText()).includes(code), `row ${String(i)}: message contains ${code}`).toBe(true);
        }
        await shot(page, '28-C-008', 'code_in_message');
      });

      await test.step('[28-A-013] every returned finding is a row (dangling ends of the isolated wall)', async () => {
        // S5-confirm: WALL-DANGLING-END raises one finding per dangling end (name: danglingWallEndRule).
        const info = await infoOf(page, 'Đầu tường nào cũng nối vào tường khác');
        expect.soft(info, 'WALL-DANGLING-END group').toBeDefined();
        const section = ruleSection(page, 'Đầu tường nào cũng nối vào tường khác');
        expect.soft(await rowsOf(section).count(), 'rows = N mục chưa xử lý').toBe(info?.open ?? -1);
        expect.soft(info?.open ?? 0, 'both ends listed').toBeGreaterThanOrEqual(2);
        await shot(page, '28-A-013', 'dangling_rows');
      });

      await test.step('[28-E-001] landmarks', async () => {
        await expect.soft(page.getByRole('main')).toHaveCount(1);
        await expect.soft(reportHeading(page)).toBeVisible();
        expect.soft(await page.locator('h3 > button').count(), 'every group header is h3 > button').toBe(await allHeaders(page).count());
        await shot(page, '28-E-001', 'landmarks');
      });

      await test.step('[28-E-002] aria-controls wiring', async () => {
        await groupHeaders(page).first().click(); // close one so a closed body exists
        const infos = await headerInfos(page);
        expect.soft(infos.some((info) => !info.expanded), 'a closed group').toBe(true);
        for (const info of infos) {
          const body = page.locator(`[id="${info.controls}"]`);
          await expect.soft(body, `body of ${info.ruleName}`).toHaveCount(1);
          if (info.expanded) await expect.soft(body.locator('table')).toHaveCount(1);
          else await expect.soft(body).toBeEmpty();
        }
        await shot(page, '28-E-002', 'aria_controls');
      });

      await test.step('[28-E-006] keyboard focus ring', async () => {
        await expandAll(page);
        const row = rowsOf(sectionAt(page, 0)).first();
        const targets: readonly [string, Locator][] = [
          ['group button', groupHeaders(page).first()],
          ['row message', rowMessage(row)],
          ['Xem', rowView(row)],
          ['Cài đặt bộ luật', page.getByRole('link', { name: 'Cài đặt bộ luật', exact: true })],
        ];
        for (const [label, locator] of targets) expect.soft(await hasFocusRing(page, locator), `${label}: focus-visible ring`).toBe(true);
        await shot(page, '28-E-006', 'focus_ring');
      });

      await test.step('[28-E-008] severity is text; the actions header is sr-only text', async () => {
        const badges = await page.locator('section tbody tr td:first-child').allInnerTexts();
        for (const text of badges) expect.soft(SEVERITY_WORDS as readonly string[], 'badge label').toContain(text.trim());
        await expect.soft(sectionAt(page, 0).locator('th .sr-only')).toHaveText('Hành động');
        await shot(page, '28-E-008', 'badge_text');
      });

      await test.step('[28-F-011] table at 1024 px, li cards at 1023 px', async () => {
        await page.setViewportSize(AT_1024);
        await expect.soft(page.getByRole('table').first()).toBeVisible();
        await page.setViewportSize(BELOW_1024);
        await expect.soft(page.getByRole('table')).toHaveCount(0);
        const card = rowsOf(sectionAt(page, 0)).first();
        await expect.soft(card).toBeVisible();
        await expect.soft(rowView(card)).toBeVisible();
        await shot(page, '28-F-011', 'cards_1023');
      });
    });
  });

  test('SCR-28 · FL-28-03 · Filters across two floors', async ({ browser }) => {
    await withAdmin(browser, async (admin) => {
      const { page } = admin;
      const project = await createRuleProject(admin, 'rules-filters', {
        floors: [
          { name: 'Tầng 1', elevationMm: 0 },
          { name: 'Tầng 2', elevationMm: 0 },
        ],
        layered: 2,
      });
      await openRules(page, project.id);
      let passedNames: string[] = [];

      await test.step('[28-A-026] radio "Nghiêm trọng"', async () => {
        await levelRadio(page, 'Nghiêm trọng').click();
        await expect(levelRadio(page, 'Nghiêm trọng')).toHaveAttribute('aria-checked', 'true');
        const infos = await headerInfos(page);
        expect(infos.length, 'groups listed').toBeGreaterThan(0);
        expect(infos.every((info) => info.severity === 'Nghiêm trọng'), 'every header starts "Nghiêm trọng ·"').toBe(true);
        await shot(page, '28-A-026', 'violations');
      });

      await test.step('[28-A-027] radio "Cảnh báo"', async () => {
        await levelRadio(page, 'Cảnh báo').click();
        await expect(levelRadio(page, 'Cảnh báo')).toHaveAttribute('aria-checked', 'true');
        const severities = (await headerInfos(page)).map((info) => info.severity);
        expect.soft(severities).toContain('Cảnh báo');
        expect.soft(severities).toContain('Gợi ý');
        expect.soft(severities).not.toContain('Nghiêm trọng');
        await shot(page, '28-A-027', 'warnings');
      });

      await test.step('[28-A-028] radio "Đạt"', async () => {
        await levelRadio(page, 'Đạt').click();
        await expect(levelRadio(page, 'Đạt')).toHaveAttribute('aria-checked', 'true');
        const passed = await settledInt(summaryValue(page, 'Đạt'));
        await expect.soft(groupHeaders(page)).toHaveCount(0);
        await expect.soft(passedItems(page)).toHaveCount(passed);
        await shot(page, '28-A-028', 'passed');
      });

      await test.step('[28-C-010] passed names ⊆ rules without a row on "Tất cả"', async () => {
        passedNames = (await passedItems(page).allInnerTexts()).map((text) => text.split('\n')[0]?.trim() ?? '');
        await levelRadio(page, 'Tất cả').click();
        await expect(groupHeaders(page).first()).toBeVisible();
        const failing = (await headerInfos(page)).map((info) => info.ruleName);
        expect.soft(passedNames.length, 'passed rules').toBeGreaterThan(0);
        for (const name of passedNames) expect.soft(failing, `"${name}" has no row`).not.toContain(name);
        await shot(page, '28-C-010', 'passed_vs_failing');
      });

      await test.step('[28-A-032] group "Hình học" on "Đạt"', async () => {
        await levelRadio(page, 'Đạt').click();
        await pick(page, groupSelect(page), 'Hình học');
        const labels = (await passedItems(page).allInnerTexts()).map((text) => text.split('\n').at(-1)?.trim());
        expect.soft(labels.length, 'passed geometry rules').toBeGreaterThan(0);
        for (const label of labels) expect.soft(label).toBe('Hình học');
        await shot(page, '28-A-032', 'passed_geometry');
      });

      await test.step('[28-A-030] radio "Tất cả"', async () => {
        await levelRadio(page, 'Tất cả').click();
        await expect(levelRadio(page, 'Tất cả')).toHaveAttribute('aria-checked', 'true');
        await expect.soft(groupHeaders(page).first()).toBeVisible();
        await shot(page, '28-A-030', 'all');
      });

      await test.step('[28-A-031] select "Nhóm luật"', async () => {
        await groupSelect(page).click();
        const options = (await page.getByRole('option').allInnerTexts()).map((text) => text.trim());
        expect.soft(options).toEqual(['Tất cả nhóm luật', 'Hình học', 'Lưu thông', 'Diện tích', 'Ghi chú', 'Cao độ tầng']);
        await page.getByRole('option', { name: 'Hình học', exact: true }).click();
        const infos = await headerInfos(page);
        expect.soft(infos.length).toBeGreaterThan(0);
        for (const info of infos) expect.soft(info.groupLabel).toBe('Hình học');
        await shot(page, '28-A-031', 'group_select');
      });

      await test.step('[28-A-033] select "Tầng"', async () => {
        await floorSelect(page).click();
        expect.soft((await page.getByRole('option').allInnerTexts()).map((text) => text.trim())).toEqual(['Tất cả các tầng', 'Tầng 1', 'Tầng 2']);
        await page.getByRole('option', { name: 'Tầng 1', exact: true }).click();
        await expandAll(page);
        const floors = await page.locator('section tbody tr td:nth-child(3)').allInnerTexts();
        expect.soft(floors.length, 'rows').toBeGreaterThan(0);
        for (const floor of floors) expect.soft(floor.trim()).toBe('Tầng 1');
        await shot(page, '28-A-033', 'floor_select');
      });

      await test.step('[28-C-011] building-scope rows leave with a floor chosen', async () => {
        await pick(page, groupSelect(page), 'Tất cả nhóm luật');
        await expect.soft(ruleSection(page, RULE_NAMES.levelElevation)).toHaveCount(0);
        await shot(page, '28-C-011', 'building_scope_hidden');
      });

      await test.step('[28-A-034] "Nghiêm trọng" + "Hình học" + "Tầng 2" = the intersection', async () => {
        await pick(page, floorSelect(page), 'Tất cả các tầng');
        await levelRadio(page, 'Nghiêm trọng').click();
        await pick(page, groupSelect(page), 'Hình học');
        await pick(page, floorSelect(page), 'Tầng 2');
        await expandAll(page);
        const infos = await headerInfos(page);
        expect.soft(infos.length, 'groups').toBeGreaterThan(0);
        for (const info of infos) {
          expect.soft(info.severity).toBe('Nghiêm trọng');
          expect.soft(info.groupLabel).toBe('Hình học');
        }
        const floors = await page.locator('section tbody tr td:nth-child(3)').allInnerTexts();
        for (const floor of floors) expect.soft(floor.trim()).toBe('Tầng 2');
        await expect.soft(rowsOf(ruleSection(page, RULE_NAMES.wallLength))).toHaveCount(1);
        await shot(page, '28-A-034', 'intersection');
      });

      await test.step('[28-C-012] ⚑ the chosen floor survives an empty result', async () => {
        await levelRadio(page, 'Tất cả').click();
        await pick(page, groupSelect(page), 'Tất cả nhóm luật');
        await pick(page, floorSelect(page), 'Tầng 2');
        await pick(page, groupSelect(page), 'Cao độ tầng'); // its only row is building-scope ("—"), none left on Tầng 2
        await expect.soft(floorSelect(page)).toContainText('Tầng 2');
        await floorSelect(page).click();
        await expect.soft(page.getByRole('option', { name: 'Tầng 2', exact: true })).toBeVisible();
        await expect.soft(page.getByRole('option', { name: 'Tầng 1', exact: true }), 'the floor list is kept, not rebuilt from the empty result').toBeVisible();
        await shot(page, '28-C-012', 'floor_survives');
        await page.keyboard.press('Escape');
      });

      await test.step('[28-A-035] no match', async () => {
        await expect.soft(page.getByText('Không có mục nào khớp bộ lọc đang đặt. Nới bộ lọc để xem thêm.', { exact: true })).toBeVisible();
        await shot(page, '28-A-035', 'no_match');
      });

      await test.step('[28-A-036] re-run keeps the filters', async () => {
        await rerunButton(page).click();
        await expect(rerunButton(page)).toBeEnabled();
        await expect.soft(levelRadio(page, 'Tất cả')).toHaveAttribute('aria-checked', 'true');
        await expect.soft(groupSelect(page)).toContainText('Cao độ tầng');
        await expect.soft(floorSelect(page)).toContainText('Tầng 2');
        await shot(page, '28-A-036', 'filters_kept');
      });

      await test.step('[28-C-009] LEVEL-ELEVATION row has floor "—", others show the floor name', async () => {
        await resetFilters(page);
        const elevation = await expandRule(page, RULE_NAMES.levelElevation);
        await expect.soft(rowsOf(elevation).first().locator('td').nth(2)).toHaveText('—');
        const geometry = await expandRule(page, RULE_NAMES.wallThickness);
        await expect.soft(rowsOf(geometry).first().locator('td').nth(2)).toHaveText(/^Tầng [12]$/u);
        await shot(page, '28-C-009', 'floor_cells');
      });
    });
  });

  test('SCR-28 · FL-28-04 · Selection, hand-off to the viewer, read-only wire', async ({ browser }) => {
    await withAdmin(browser, async (admin) => {
      const { page, api } = admin;
      const project = await createRuleProject(admin, 'rules-select');
      const mark = api.length;
      await openRules(page, project.id);
      const selectedRow = (): Locator => page.locator('section tbody tr.ring-accent'); // RRG: selected row class

      await test.step('[28-A-014] click a row message opens the sheet and selects the row', async () => {
        const section = await expandRule(page, RULE_NAMES.wallThickness);
        const row = rowsOf(section).first();
        const message = (await rowMessage(row).innerText()).trim();
        await openSheet(page, row);
        await expect(sheetTitle(page)).toHaveText(message);
        await expect.soft(row).toHaveClass(/ring-accent/u); // S5-confirm: Table.Row `selected` also sets aria-selected
        await shot(page, '28-A-014', 'row_selected');
      });

      await test.step('[28-E-009] keyboard open focuses the panel', async () => {
        await sheet(page).getByRole('button', { name: 'Đóng tấm trượt chi tiết vi phạm', exact: true }).click();
        await expect(sheet(page)).toHaveCount(0);
        const section = await expandRule(page, RULE_NAMES.furnitureClash);
        const next = rowMessage(rowsOf(section).nth(1));
        await next.focus();
        await page.keyboard.press('Enter');
        await expect.soft(sheet(page)).toBeVisible();
        await expect.soft(sheet(page)).toBeFocused();
        await shot(page, '28-E-009', 'keyboard_open');
      });

      await test.step('[28-A-015] selected-row pulse: 3 beats, 0 s under reduced motion', async () => {
        await expect.soft(selectedRow()).toHaveCount(1);
        const beats = await selectedRow().evaluate((element) => getComputedStyle(element).animationIterationCount);
        expect.soft(beats, 'animation-iteration-count').toBe('3');
        await page.emulateMedia({ reducedMotion: 'reduce' });
        await softly.poll(() => selectedRow().evaluate((element) => getComputedStyle(element).animationDuration)).toBe('0s');
        await shot(page, '28-A-015', 'pulse');
        await page.emulateMedia({ reducedMotion: 'no-preference' });
      });

      await test.step('[28-A-016] another row while the sheet is open', async () => {
        const section = await expandRule(page, RULE_NAMES.wallThickness);
        const row = rowsOf(section).first();
        const message = (await rowMessage(row).innerText()).trim();
        await rowMessage(row).click();
        await expect.soft(sheetTitle(page)).toHaveText(message);
        await expect.soft(selectedRow()).toHaveCount(1);
        await expect.soft(row).toHaveClass(/ring-accent/u);
        await shot(page, '28-A-016', 'switch_row');
      });

      await test.step('[28-A-025] footer stays disabled while Nghiêm trọng > 0', async () => {
        const url = page.url();
        expect.soft(await settledInt(summaryValue(page, 'Nghiêm trọng')), 'Nghiêm trọng').toBeGreaterThan(0);
        await expect.soft(confirmButton(page)).toBeDisabled();
        await confirmButton(page).click({ force: true });
        expect.soft(page.url(), 'URL unchanged').toBe(url);
        await shot(page, '28-A-025', 'confirm_disabled');
      });

      await test.step('[28-A-044] the whole journey wrote nothing', async () => {
        await page.goBack();
        await expect.poll(() => pathOf(page)).toBe(ROUTES.project.rules(project.id));
        await expect(reportHeading(page)).toBeVisible();
        expect.soft(writesSince(api, mark), 'POST/PUT/DELETE since step 1').toEqual([]);
        await shot(page, '28-A-044', 'read_only');
      });
    });
  });

  test('SCR-28 · FL-28-06 · Warnings-only run is `ready`, not `done`', async ({ browser }) => {
    await withAdmin(browser, async (admin) => {
      const { page, api } = admin;
      const project = await createRuleProject(admin, 'rules-done', { shortWall: false }); // R3
      await openRules(page, project.id);

      await test.step('[28-B-004] zero critical: figure 0, filter bar, footer enabled', async () => {
        // F6 (useRuleReport.ts:596): `done` only when violations + warnings are both 0; R3 still raises warnings -> `ready`.
        expect(await settledInt(summaryValue(page, 'Nghiêm trọng')), 'Nghiêm trọng').toBe(0);
        await expect(rerunButton(page)).toBeVisible();
        await expect(levelFilter(page)).toBeVisible();
        await expect(confirmButton(page)).toBeEnabled();
        await shot(page, '28-B-004', 'ready_no_critical');
      });

      await test.step('[28-B-005] ⚑ warnings stay reachable', async () => {
        expect.soft(await settledInt(summaryValue(page, 'Cảnh báo')), 'Cảnh báo').toBeGreaterThan(0);
        await expect.soft(groupHeaders(page).first(), 'a warning/suggestion group is listed').toBeVisible();
        await expect.soft(levelFilter(page), 'filter bar').toBeVisible();
        await shot(page, '28-B-005', 'warnings_reachable');
      });

    });
  });

  test('SCR-28 · FL-28-17 · zero-finding run: done panel', async ({ browser }) => {
    await withAdmin(browser, async (admin) => {
      const { page, api } = admin;
      const project = await createCleanProject(admin, 'rules-clean'); // R0
      await openRules(page, project.id);
      const donePanel = page.getByText('Không phát hiện vi phạm nào.', { exact: true });
      const shortcut = page.getByRole('button', { name: 'Sang bước xuất bản', exact: true });

      await test.step('[28-B-018] zero findings -> the done panel replaces the groups', async () => {
        await expect(donePanel).toBeVisible();
        expect.soft(await settledInt(summaryValue(page, 'Nghiêm trọng')), 'Nghiêm trọng').toBe(0);
        expect.soft(await settledInt(summaryValue(page, 'Cảnh báo')), 'Cảnh báo').toBe(0);
        await expect.soft(groupHeaders(page)).toHaveCount(0);
        await shot(page, '28-B-018', 'done_panel');
      });

      await test.step('[28-A-022] done panel copy', async () => {
        await expect.soft(page.getByText(/^\d[\d.]* luật đã chạy trên bản vẽ này và không luật nào bắt được lỗi\.$/u)).toBeVisible();
        await expect.soft(page.getByText('Lượt chạy này không có vi phạm', { exact: true })).toBeVisible();
        await shot(page, '28-A-022', 'done_panel_copy');
      });

      await test.step('[28-A-024] footer "Xác nhận đã xử lý" with 0 findings goes to export without writes', async () => {
        const mark = api.length;
        await expect(confirmButton(page)).toBeEnabled();
        await confirmButton(page).click();
        await expect.poll(() => pathOf(page)).toBe(ROUTES.project.export(project.id));
        expect.soft(writesSince(api, mark), 'POST/PUT/DELETE').toEqual([]);
        await shot(page, '28-A-024', 'confirm_export');
      });

      await test.step('[28-A-023] "Sang bước xuất bản" goes to export', async () => {
        await openRules(page, project.id);
        await expect(shortcut).toBeVisible();
        await shortcut.click();
        await expect.poll(() => pathOf(page)).toBe(ROUTES.project.export(project.id));
        await shot(page, '28-A-023', 'shortcut_export');
      });
    });
  });

  test('SCR-28 · FL-28-08 · Partial state and project gates', async ({ browser }) => {
    test.setTimeout(240_000);
    await withAdmin(browser, async (admin) => {
      const { page, api } = admin;
      const project = await createRuleProject(admin, 'rules-partial', { floors: [] }); // M0
      const fakeId = `prj_qa-${uniq()}`;
      const adminReq = await adminRequest();
      const extra: { close: () => Promise<void> }[] = [];
      try {
        // S5-confirm: a project with zero floors yields an empty, non-null graph (N15 200); if N15 errors, B-006..008 become n/a.
        await openRules(page, project.id);

        await test.step('[28-B-006] one attention line per rule group, link "Thêm tầng cho mô hình"', async () => {
          const lines = page.getByText(/^nhóm .+: \d+ luật chưa chạy được vì mô hình chưa có tầng nào để soi\.$/u);
          expect(await lines.count(), 'attention lines').toBeGreaterThan(0);
          await expect(page.getByRole('link', { name: 'Thêm tầng cho mô hình' }).first()).toBeVisible();
          await shot(page, '28-B-006', 'skipped_lines');
        });

        await test.step('[28-B-008] partial body', async () => {
          await expect.soft(levelFilter(page)).toBeVisible();
          await expect.soft(confirmButton(page)).toBeEnabled();
          await expect.soft(page.getByText('Không còn mục nào đang mở trong danh sách này.', { exact: true })).toBeVisible();
          await shot(page, '28-B-008', 'partial_body');
        });

        await test.step('[28-B-007] "Thêm tầng cho mô hình" is an in-app link', async () => {
          await page.evaluate(() => {
            (window as unknown as { __p06marker?: number }).__p06marker = 1;
          });
          await page.getByRole('link', { name: 'Thêm tầng cho mô hình' }).first().click();
          await expect.poll(() => pathOf(page)).toBe(ROUTES.project.floors(project.id));
          expect.soft(await page.evaluate(() => (window as unknown as { __p06marker?: number }).__p06marker), 'no reload').toBe(1);
          await shot(page, '28-B-007', 'to_floors');
        });

        const alert = page.getByRole('alert').filter({ hasText: GATE_TITLE });
        await test.step('[28-B-014] unknown project id', async () => {
          await page.goto(ROUTES.project.rules(fakeId));
          await expect(alert).toBeVisible();
          await expect(alert).toContainText(GATE_DESCRIPTION);
          await shot(page, '28-B-014', 'not_found');
          await alert.getByRole('button', { name: GATE_BACK, exact: true }).click();
          await expect.poll(() => pathOf(page)).toBe(ROUTES.dashboard);
        });

        await test.step('[28-G-009] the fake id\'s N15 answered 404', async () => {
          await softly.poll(() => api.find((e) => e.method === 'GET' && spatialRe(fakeId).test(e.path))?.status).toBe(404);
          await shot(page, '28-G-009', 'n15_404');
        });

        await test.step('[28-G-004] the fake id\'s N21 answered 404 and no report renders', async () => {
          await softly.poll(() => api.find((e) => e.method === 'GET' && ruleConfigRe(fakeId).test(e.path))?.status).toBe(404);
          await expect.soft(reportHeading(page)).toHaveCount(0);
          await shot(page, '28-G-004', 'n21_404');
        });

        await test.step('[28-D-005] an engineer who is not a member', async () => {
          const engineer = await poolUser(adminReq, 'engineer', 'p06-rules-n');
          const session = await poolSession(browser, engineer);
          extra.push(session.context);
          await session.page.goto(ROUTES.project.rules(project.id));
          await expect(session.page.getByRole('alert').filter({ hasText: GATE_TITLE })).toBeVisible();
          await shot(session.page, '28-D-005', 'non_member');
        });

        await test.step('[28-D-006] anonymous deep link', async () => {
          const anon = await browser.newContext({ baseURL: readBaseUrl() });
          extra.push(anon);
          const anonPage = await anon.newPage();
          await anonPage.goto(ROUTES.project.rules(project.id));
          await expect.poll(() => pathOf(anonPage)).toBe(ROUTES.login);
          await expect.soft(reportHeading(anonPage)).toHaveCount(0);
          await shot(anonPage, '28-D-006', 'anonymous');
        });
      } finally {
        for (const item of extra) await item.close().catch(() => undefined);
        await adminReq.dispose();
      }
    });
  });

  test('SCR-28 · FL-28-09 · Rule config drives the report (N22)', async ({ browser }) => {
    await withAdmin(browser, async (admin) => {
      const { page } = admin;
      const project = await createRuleProject(admin, 'rules-config');
      await openRules(page, project.id);
      const base = await figuresOf(page);
      const reload = async (): Promise<void> => {
        await openRules(page, project.id);
      };

      await test.step('[28-A-043] WALL-LENGTH off: Tổng − 1 and its group is gone', async () => {
        expect(await putRuleConfig(admin, project.id, { 'WALL-LENGTH': { enabled: false } }), 'N22 PUT').toBe(200);
        await reload();
        expect(await settledInt(summaryValue(page, 'Tổng số kiểm tra')), 'Tổng số kiểm tra').toBe(base.total - 1);
        await expect(ruleSection(page, RULE_NAMES.wallLength)).toHaveCount(0);
        await shot(page, '28-A-043', 'wall_length_off');
      });

      await test.step('[28-C-015] WALL-THICKNESS severity critical', async () => {
        expect(await putRuleConfig(admin, project.id, { 'WALL-THICKNESS': { severity: 'critical' } }), 'N22 PUT').toBe(200);
        await reload();
        const info = await infoOf(page, RULE_NAMES.wallThickness);
        expect.soft(info?.severity, 'group header').toBe('Nghiêm trọng');
        expect.soft(await settledInt(summaryValue(page, 'Nghiêm trọng')), 'Nghiêm trọng').toBe(base.violations + 1);
        await shot(page, '28-C-015', 'severity_critical');
      });

      await test.step('[28-C-016] threshold 45 mm: the 50 mm walls pass', async () => {
        expect(await putRuleConfig(admin, project.id, { 'WALL-THICKNESS': { thresholds: { 'wall.minThicknessMm': 45 } } }), 'N22 PUT').toBe(200);
        await reload();
        await expect.soft(ruleSection(page, RULE_NAMES.wallThickness)).toHaveCount(0);
        expect.soft(await settledInt(summaryValue(page, 'Đạt')), 'Đạt').toBe(base.passed + 1);
        await shot(page, '28-C-016', 'threshold_45');
      });

      await test.step('[28-A-029] only WALL-LENGTH enabled: nothing passes', async () => {
        expect(await putRuleConfig(admin, project.id, onlyRule('WALL-LENGTH')), 'N22 PUT').toBe(200);
        await reload();
        await levelRadio(page, 'Đạt').click();
        await expect.soft(page.getByText('Chưa có luật nào chạy xong mà không ra lỗi.', { exact: true })).toBeVisible();
        await shot(page, '28-A-029', 'no_passed');
      });

      let total0 = 0;
      // The window never refetches on focus (queryClient.ts:47 refetchOnWindowFocus:false); what does re-read N21 on a mounted
      // report is react-query's reconnect refetch (default refetchOnReconnect). S5-confirm: staleTime lets the query go stale.
      const reconnect = async (): Promise<void> => {
        await page.evaluate(() => {
          window.dispatchEvent(new Event('offline'));
          window.dispatchEvent(new Event('online'));
        });
      };
      await test.step('[28-A-042] another session disables a rule: after a reconnect Tổng drops, no reload', async () => {
        expect(await putRuleConfig(admin, project.id, {}), 'N22 PUT (all rules back on)').toBe(200);
        await reload();
        total0 = await settledInt(summaryValue(page, 'Tổng số kiểm tra'));
        await page.evaluate(() => {
          (window as unknown as { __p06marker?: number }).__p06marker = 1;
        });
        const reread = waitForApi(page, 'GET', ruleConfigRe(project.id), [200]);
        expect(await putRuleConfig(admin, project.id, { 'WALL-LENGTH': { enabled: false } }), '+X N22 PUT').toBe(200);
        await reconnect();
        await reread;
        await softly
          .poll(async () => Number((await summaryValue(page, 'Tổng số kiểm tra').innerText()).replace(/\./gu, '')))
          .toBe(total0 - 1);
        expect.soft(await page.evaluate(() => (window as unknown as { __p06marker?: number }).__p06marker), 'no reload').toBe(1);
        await shot(page, '28-A-042', 'live_refetch');
      });

      await test.step('[28-C-014] ⚑ the disabled rules rows are not "Đã xử lý"', async () => {
        // Same mounted report (previous run kept): rows of WALL-LENGTH vanish because of the config, not because they were fixed.
        await expect.soft(ruleSection(page, RULE_NAMES.wallLength)).toHaveCount(0);
        await expect.soft(resolvedHeader(page), 'nothing was fixed').toHaveCount(0);
        await shot(page, '28-C-014', 'not_resolved');
      });
    });
  });

  test('SCR-28 · FL-28-10 · Roles on the report and the sheet', async ({ browser }) => {
    await withAdmin(browser, async (admin) => {
      const { page } = admin;
      const project = await createRuleProject(admin, 'rules-roles');
      const adminReq = await adminRequest();
      const sessions: { close: () => Promise<void> }[] = [];
      try {
        const viewer = await poolUser(adminReq, 'viewer', 'p06-rules');
        const engineer = await poolUser(adminReq, 'engineer', 'p06-rules');
        await addProjectMember(adminReq, project.id, viewer.email);
        await addProjectMember(adminReq, project.id, engineer.email);
        const v = await poolSession(browser, viewer);
        sessions.push(v.context);
        const e = await poolSession(browser, engineer);
        sessions.push(e.context);
        const vPuts = trackLayerPuts(v.page);

        await test.step('[28-D-001] admin: h2, four figures, footer, filter bar', async () => {
          await openRules(page, project.id);
          await expect(reportHeading(page)).toBeVisible();
          expect(await settledInt(summaryValue(page, 'Tổng số kiểm tra'))).toBeGreaterThan(0);
          for (const label of ['Đạt', 'Cảnh báo', 'Nghiêm trọng']) await expect(summaryValue(page, label)).toBeVisible();
          await expect(confirmButton(page)).toBeVisible();
          await expect(levelFilter(page)).toBeVisible();
          await shot(page, '28-D-001', 'admin');
        });

        await test.step('[28-D-003] viewer: reads 200, figures settle, filters work', async () => {
          await openRules(v.page, project.id);
          await softly.poll(() => v.api.find((x) => x.method === 'GET' && ruleConfigRe(project.id).test(x.path))?.status).toBe(200);
          expect.soft(await settledInt(summaryValue(v.page, 'Tổng số kiểm tra')), 'Tổng').toBeGreaterThan(0);
          await levelRadio(v.page, 'Nghiêm trọng').click();
          await expect.soft(levelRadio(v.page, 'Nghiêm trọng')).toHaveAttribute('aria-checked', 'true');
          await levelRadio(v.page, 'Tất cả').click();
          await shot(v.page, '28-D-003', 'viewer_reads');
        });

        await test.step('[28-D-004] ⚑ viewer: no "Xác nhận đã xử lý"', async () => {
          await expect(summaryValue(v.page, 'Tổng số kiểm tra')).toBeVisible(); // report is up: the absence is meaningful
          await expect.soft(confirmButton(v.page)).toHaveCount(0);
          await shot(v.page, '28-D-004', 'viewer_footer');
        });

        await test.step('[28V-D-003] ⚑ viewer: no fix options in the sheet', async () => {
          await openFirstRowOf(v.page, RULE_NAMES.furnitureClash);
          // F6 (RuleReport.container.tsx:237): the sheet is up (title shown) before the absence is asserted.
          await expect(sheetTitle(v.page)).toBeVisible();
          await expect.soft(sheet(v.page).getByRole('heading', { name: 'Lựa chọn xử lý', level: 3 })).toHaveCount(0);
          await expect.soft(sheet(v.page).getByRole('button', { name: DELETE_ACTION })).toHaveCount(0);
          await shot(v.page, '28V-D-003', 'viewer_sheet');
        });

        await test.step('[28V-G-004] viewer clicks "Xoá đối tượng này" (today\'s behaviour): PUT answers 403', async () => {
          const deleteForViewer = sheet(v.page).getByRole('button', { name: DELETE_ACTION });
          if ((await deleteForViewer.count()) === 0) {
            test.info().annotations.push({ type: 'n/a', description: '28V-G-004: no fix action for a viewer (28V-D-003 fixed)' });
            await expect.soft(deleteForViewer).toHaveCount(0);
            return;
          }
          const answered = waitForApi(v.page, 'PUT', layerPutRe, [403]);
          await deleteForViewer.click();
          expect.soft((await answered).response.status(), 'PUT …/spatial/layer').toBe(403);
          expect.soft(vPuts.filter((p) => p.status === 403).length, 'single 403 PUT').toBe(1);
          await shot(v.page, '28V-G-004', 'viewer_403');
        });

        await test.step('[28V-D-004] after the 403: announcer and label', async () => {
          if ((await sheet(v.page).getByRole('button', { name: DELETE_ACTION }).count()) === 0) {
            test.info().annotations.push({ type: 'n/a', description: '28V-D-004: the viewer cannot trigger a save (28V-D-003 fixed)' });
            return;
          }
          await expect.soft(v.page.getByText(FORBIDDEN_MESSAGE).first()).toBeAttached();
          await expect.soft(sheet(v.page).getByText(SAVE_FAILED)).toBeVisible();
          await shot(v.page, '28V-D-004', 'viewer_forbidden');
        });

        await test.step('[28-D-002] engineer: h2, figures settle, rerun enabled', async () => {
          await openRules(e.page, project.id);
          expect.soft(await settledInt(summaryValue(e.page, 'Tổng số kiểm tra')), 'Tổng').toBeGreaterThan(0);
          await expect.soft(rerunButton(e.page)).toBeEnabled();
          await shot(e.page, '28-D-002', 'engineer');
        });

        await test.step('[28V-D-002] engineer fixes a table: PUT 200 and "Đã lưu lúc …"', async () => {
          await openFirstRowOf(e.page, RULE_NAMES.furnitureClash);
          const answered = waitForApi(e.page, 'PUT', layerPutRe, [200]);
          await sheet(e.page).getByRole('button', { name: DELETE_ACTION }).click();
          expect.soft((await answered).response.status()).toBe(200);
          await expect.soft(sheet(e.page).getByText(SAVED_LABEL)).toBeVisible();
          await shot(e.page, '28V-D-002', 'engineer_saved');
        });
      } finally {
        for (const item of sessions) await item.close().catch(() => undefined);
        await adminReq.dispose();
      }
    });
  });

  test('SCR-28 · FL-28-12 · Keyboard and motion', async ({ browser }) => {
    await withAdmin(browser, async (admin) => {
      const { page } = admin;
      const project = await createRuleProject(admin, 'rules-keys');
      await openRules(page, project.id);

      await test.step('[28-E-003] Tab order through the report', async () => {
        await page.evaluate(() => {
          (document.activeElement as HTMLElement | null)?.blur();
          window.scrollTo(0, 0);
        });
        const trail: { role: string; text: string; expanded: boolean }[] = [];
        for (let i = 0; i < 40; i += 1) {
          await page.keyboard.press('Tab');
          const item = await page.evaluate(() => {
            const el = document.activeElement as HTMLElement | null;
            return {
              role: el?.getAttribute('role') ?? el?.tagName.toLowerCase() ?? '',
              text: (el?.getAttribute('aria-label') ?? el?.textContent ?? '').trim(),
              expanded: el?.hasAttribute('aria-expanded') ?? false,
            };
          });
          trail.push(item);
          if (item.text === 'Xác nhận đã xử lý') break;
        }
        const at = (match: (item: (typeof trail)[number]) => boolean, from = 0): number => {
          const index = trail.findIndex((item, i) => i >= from && match(item));
          return index;
        };
        const settings = at((x) => x.text === 'Cài đặt bộ luật');
        const rerun = at((x) => x.text.includes('Chạy kiểm tra lại'), settings + 1);
        const radio = at((x) => x.role === 'radio', rerun + 1);
        const groupBox = at((x) => x.role === 'combobox', radio + 1);
        const floorBox = at((x) => x.role === 'combobox', groupBox + 1);
        const header = at((x) => x.expanded, floorBox + 1);
        const confirm = at((x) => x.text === 'Xác nhận đã xử lý', header + 1);
        const order = [settings, rerun, radio, groupBox, floorBox, header, confirm];
        expect.soft(order.every((index) => index >= 0), `all stops reached: ${JSON.stringify(order)}`).toBe(true);
        expect.soft(order, 'ascending').toEqual([...order].sort((a, b) => a - b));
        await shot(page, '28-E-003', 'tab_order');
      });

      await test.step('[28-E-004] arrow keys on the radiogroup', async () => {
        await levelRadio(page, 'Tất cả').focus();
        await page.keyboard.press('ArrowRight');
        await expect.soft(levelRadio(page, 'Nghiêm trọng')).toHaveAttribute('aria-checked', 'true');
        await page.keyboard.press('ArrowRight');
        await expect.soft(levelRadio(page, 'Cảnh báo')).toHaveAttribute('aria-checked', 'true');
        await page.keyboard.press('ArrowLeft');
        await page.keyboard.press('ArrowLeft');
        await expect.soft(levelRadio(page, 'Tất cả')).toHaveAttribute('aria-checked', 'true');
        await shot(page, '28-E-004', 'radio_arrows');
      });

      await test.step('[28-E-005] combobox "Nhóm luật" by keyboard', async () => {
        await groupSelect(page).focus();
        await page.keyboard.press('Enter');
        await page.keyboard.press('ArrowDown');
        await page.keyboard.press('Enter');
        await expect.soft(groupSelect(page)).toContainText('Hình học');
        await page.keyboard.press('Enter');
        await expect.soft(page.getByRole('listbox')).toBeVisible();
        await page.keyboard.press('Escape');
        await expect.soft(page.getByRole('listbox')).toHaveCount(0);
        await expect.soft(groupSelect(page)).toContainText('Hình học');
        await shot(page, '28-E-005', 'select_keys');
      });

      await test.step('[28-E-007] reduced motion: final values at once, pulse 0 s', async () => {
        await page.emulateMedia({ reducedMotion: 'reduce' });
        await openRules(page, project.id);
        const figure = summaryValue(page, 'Tổng số kiểm tra');
        const immediate = (await figure.innerText()).trim();
        expect.soft(immediate, 'first paint = settled value').toBe(await settledText(figure));
        const section = await expandRule(page, RULE_NAMES.wallThickness);
        await rowMessage(rowsOf(section).first()).click();
        await softly
          .poll(() => page.locator('section tbody tr.ring-accent').evaluate((element) => getComputedStyle(element).animationDuration))
          .toBe('0s');
        await shot(page, '28-E-007', 'reduced_motion');
        await page.emulateMedia({ reducedMotion: 'no-preference' });
      });
    });
  });

  test('SCR-28 · FL-28-13 · Compact boundary and the sheet next to the report', async ({ browser }) => {
    await withAdmin(
      browser,
      async (admin) => {
        const { page } = admin;
        const project = await createRuleProject(admin, 'rules-compact');
        await openRules(page, project.id);
        const wallRow = (): Locator => rowsOf(ruleSection(page, RULE_NAMES.wallLength)).first();

        await test.step('[28V-F-007] 1024: right panel 420 px; 1023: bottom sheet', async () => {
          await openFirstRowOf(page, RULE_NAMES.wallLength);
          await expect.soft(sheet(page)).toHaveClass(/absolute/u);
          await expect.soft(sheet(page)).toHaveClass(/right-0/u);
          expect.soft((await sheet(page).boundingBox())?.width, 'panel width').toBeCloseTo(420, 0);
          await shot(page, '28V-F-007', 'panel_1024');
          await page.setViewportSize(BELOW_1024);
          await expect.soft(sheet(page)).toHaveClass(/fixed/u);
          await expect.soft(sheet(page)).toHaveClass(/bottom-0/u);
        });

        await test.step('[28V-B-007] 768: bottom sheet, max-height 70 vh, no "Khối hình"', async () => {
          await page.setViewportSize(NARROW);
          await expect.soft(sheet(page)).toHaveClass(/bottom-0/u);
          const maxHeight = await sheet(page).evaluate((element) => getComputedStyle(element).maxHeight);
          expect.soft(Number.parseFloat(maxHeight), 'max-height px').toBeCloseTo(NARROW.height * 0.7, 0);
          await expect.soft(sheet(page).getByLabel('Khối hình của vi phạm')).toHaveCount(0);
          await shot(page, '28V-B-007', 'bottom_768');
        });

        await test.step('[28V-A-026] 1440 with the sheet open: report scrolls, rows and select stay usable', async () => {
          await page.setViewportSize({ width: 1440, height: 900 });
          await expect.soft(sheet(page)).toHaveClass(/right-0/u);
          await expandAll(page);
          const scroller = page.locator('div.overflow-y-auto').first();
          const scrolled = await scroller.evaluate((element) => {
            element.scrollTop = 120;
            return element.scrollTop;
          });
          expect.soft(scrolled, 'report scrollTop').toBeGreaterThan(0);
          const other = rowMessage(rowsOf(ruleSection(page, RULE_NAMES.wallThickness)).first());
          const message = (await other.innerText()).trim();
          await other.click();
          await expect.soft(sheetTitle(page)).toHaveText(message);
          await groupSelect(page).click();
          await expect.soft(page.getByRole('option', { name: 'Hình học', exact: true })).toBeVisible();
          await page.keyboard.press('Escape');
          await shot(page, '28V-A-026', 'sheet_beside_report');
        });

        await test.step('[28V-E-010] Escape closes the sheet once', async () => {
          await sheet(page).focus();
          await page.keyboard.press('Escape');
          await expect.soft(sheet(page)).toHaveCount(0);
          await expect.soft(reportHeading(page)).toBeVisible();
          expect.soft(pathOf(page), 'no second action').toBe(ROUTES.project.rules(project.id));
          await expect.soft(wallRow()).toBeVisible();
          await shot(page, '28V-E-010', 'escape_once');
        });
      },
      AT_1024,
    );
  });
});

/* ================================================================= SCR-28 · sheet "Chi tiết vi phạm" */

const CAUSE_GEOMETRY = 'Hình học dựng lại từ bản vẽ có thể lệch nhẹ ở bước dò tường, nên số đo tính ra không khớp ngưỡng.'; // UV CAUSE_BY_GROUP.geometry
const CAUSE_WALL = 'Tường này có thể được dò gộp hoặc tách khác với nét vẽ gốc, nên hai đầu của nó chưa chắc nằm đúng chỗ.'; // UV CAUSE_BY_KIND.wall
const CAUSE_LOW_CONFIDENCE = 'Nhận diện tự động có thể sai — độ tin cậy chỉ 0,50.'; // UV causesOf (0,50 = formatNumber vi, 2 digits)
const FIGURE_2D = 'Mặt bằng quanh đối tượng gây lỗi'; // VDF ViolationFigurePlan aria-label

const floorOf = (project: { readonly floors: readonly { readonly id: string; readonly name: string }[] }, index = 0): { id: string; name: string } => {
  const floor = project.floors[index];
  if (floor === undefined) throw new Error(`setup: no floor #${String(index)}`);
  return floor;
};

/** From now on, click "Giữ lại màn này" the instant the banner shows (the real button; the 340 ms advance cannot be raced by hand). */
async function armKeep(page: Page): Promise<{ kept: () => Promise<boolean>; disarm: () => Promise<void> }> {
  await page.evaluate((label) => {
    const w = window as unknown as { __p06keep?: { kept: boolean; observer: MutationObserver } };
    const state = { kept: false, observer: new MutationObserver(() => undefined) };
    state.observer = new MutationObserver(() => {
      const button = Array.from(document.querySelectorAll('button')).find((item) => item.textContent === label);
      if (button !== undefined) {
        state.kept = true;
        button.click();
      }
    });
    state.observer.observe(document.body, { childList: true, subtree: true });
    w.__p06keep = state;
  }, KEEP_BUTTON);
  return {
    kept: () => page.evaluate(() => (window as unknown as { __p06keep?: { kept: boolean } }).__p06keep?.kept === true),
    disarm: () =>
      page.evaluate(() => {
        (window as unknown as { __p06keep?: { observer: MutationObserver } }).__p06keep?.observer.disconnect();
      }),
  };
}

test.describe('SCR-28V Violation sheet (edge, real)', () => {
  test.setTimeout(240_000);

  test('SCR-28 · FL-28V-01 · Sheet anatomy on a wall violation', async ({ browser }) => {
    await withAdmin(browser, async (admin) => {
      const { page } = admin;
      const project = await createRuleProject(admin, 'rules-sheet', { thinWalls: false }); // no 50 mm walls: they blank the 2D figure (RangeError in resolveWallShapes)
      await openRules(page, project.id);
      const row = rowsOf(await expandRule(page, RULE_NAMES.wallLength)).first();
      const message = (await rowMessage(row).innerText()).trim();
      const panel = sheet(page);
      const findings = panel.locator('section[aria-labelledby="violation-findings-heading"]');
      const figure = panel.getByRole('img', { name: FIGURE_2D, exact: true });
      const modeRadio = (label: string): Locator => panel.getByRole('radiogroup', { name: 'Chế độ khối hình' }).getByRole('radio', { name: label, exact: true });

      await test.step('[28V-A-002] header', async () => {
        await openSheet(page, row);
        await expect(sheetTitle(page)).toHaveText(message);
        await expect(panel.locator('header p').first()).toHaveText('Hình học');
        await expect(panel.locator('header').getByText('Nghiêm trọng', { exact: true })).toBeVisible();
        await expect(panel.locator('header span.font-mono')).toHaveText(/^#/u); // S5-confirm: display code prints "#…"
        // useSaveIndicator idle label (useSaveIndicator.ts:35-37, vi.json autosave idle): the sheet always carries a save label.
        await expect.soft(panel.locator('header p').nth(1)).toHaveText('Chưa có thay đổi');
        await shot(page, '28V-A-002', 'header');
      });

      await test.step('[28V-A-003] "Luật"', async () => {
        await expect.soft(panel.getByRole('heading', { name: 'Luật', level: 3, exact: true })).toBeVisible();
        await expect.soft(panel.getByText(RULE_NAMES.wallLength, { exact: true })).toBeVisible();
        await expect.soft(panel.getByRole('img', { name: 'Sơ đồ hai đoạn tường và khe hở giữa chúng', exact: true })).toBeVisible();
        await shot(page, '28V-A-003', 'rule');
      });

      await test.step('[28V-A-004] "Phát hiện": subject first, no openings', async () => {
        await expect.soft(panel.getByRole('heading', { name: 'Phát hiện', level: 3, exact: true })).toBeVisible();
        await expect.soft(findings.locator('li')).toHaveCount(1);
        await shot(page, '28V-A-004', 'findings');
      });

      await test.step('[28V-A-005] object line', async () => {
        const item = findings.locator('li').first();
        await expect.soft(item.locator('span.font-mono')).toHaveText(/^#/u);
        await expect.soft(item).toContainText('tường');
        await expect.soft(item).toContainText('độ tin cậy 0,50');
        await shot(page, '28V-A-005', 'object_line');
      });

      await test.step('[28V-C-001] causes: low confidence first (the 0.9-wall half is the next-to-last step of this flow)', async () => {
        const causes = panel.locator('ol > li');
        await expect.soft(causes).toHaveCount(3);
        await expect.soft(causes.nth(0)).toHaveText(CAUSE_LOW_CONFIDENCE);
        await expect.soft(causes.nth(1)).toHaveText(CAUSE_GEOMETRY);
        await expect.soft(causes.nth(2)).toHaveText(CAUSE_WALL);
        await shot(page, '28V-C-001', 'causes');
      });

      await test.step('[28V-A-013] no fix options', async () => {
        await expect.soft(panel.getByRole('heading', { name: 'Lựa chọn xử lý', level: 3 })).toHaveCount(0);
        await expect.soft(panel.getByText(NO_ACTIONS_LINE, { exact: true })).toBeVisible();
        await shot(page, '28V-A-013', 'no_actions');
      });

      await test.step('[28V-B-002] partial state', async () => {
        await expect.soft(panel.getByText(NO_ACTIONS_LINE, { exact: true })).toBeVisible();
        await expect.soft(figure).toBeVisible();
        await shot(page, '28V-B-002', 'partial');
      });

      await test.step('[28V-A-007] 2D figure: one polygon per wall, subject filled differently', async () => {
        await expect.soft(figure.locator('polygon')).toHaveCount(WALLS_IN_RULE_LAYER);
        const opacities = await figure.locator('polygon').evaluateAll((items) => items.map((item) => item.getAttribute('fill-opacity')));
        expect.soft(new Set(opacities).size, 'two fill levels').toBe(2);
        expect.soft(opacities.filter((value) => value === '0.32').length, 'one subject polygon').toBe(1);
        await shot(page, '28V-A-007', 'figure_2d');
      });

      await test.step('[28V-A-008] "3D" swaps the svg for a painted canvas; "2D" restores', async () => {
        await modeRadio('3D').click();
        await expect.soft(figure).toHaveCount(0);
        await expect.soft(panel.locator('canvas')).toHaveCount(1);
        await softly.poll(() => canvasHasContent(panel.locator('canvas'))).toBe(true);
        await shot(page, '28V-A-008', 'figure_3d');
        await modeRadio('2D').click();
        await expect.soft(figure).toBeVisible();
        await expect.soft(panel.locator('canvas')).toHaveCount(0);
      });

      await test.step('[28V-A-009] 3D → 2D → 3D leaves exactly one canvas', async () => {
        await modeRadio('3D').click();
        await modeRadio('2D').click();
        await modeRadio('3D').click();
        await expect.soft(panel.locator('canvas')).toHaveCount(1);
        await shot(page, '28V-A-009', 'one_canvas');
      });

      await test.step('[28V-A-006] clicking an object in "Phát hiện" sends nothing and keeps the 3D scene', async () => {
        // The camera framing / viewer selection (UV onSelectObject → setSelection + frameEntities) has no DOM or network surface on
        // this route (no pixel compare: the scene already frames the subject at mount). Asserted: no write, one canvas, sheet intact.
        const mark = admin.api.length;
        await findings.getByRole('button').first().click();
        await expect.soft(panel.locator('canvas')).toHaveCount(1);
        await softly.poll(() => canvasHasContent(panel.locator('canvas'))).toBe(true);
        expect.soft(writesSince(admin.api, mark), 'writes').toEqual([]);
        await expect.soft(sheetTitle(page)).toHaveText(message);
        await shot(page, '28V-A-006', 'frame_subject');
      });

      await test.step('[28V-E-001] landmark', async () => {
        await expect.soft(page.getByRole('complementary', { name: 'Chi tiết vi phạm', exact: true })).toHaveCount(1);
        await shot(page, '28V-E-001', 'landmark');
      });

      await test.step('[28V-E-002] focus lands on the aside (tabindex -1) on open', async () => {
        await panel.getByRole('button', { name: 'Đóng tấm trượt chi tiết vi phạm', exact: true }).click();
        await expect(panel).toHaveCount(0);
        await openSheet(page, row);
        await expect.soft(panel).toBeFocused();
        await expect.soft(panel).toHaveAttribute('tabindex', '-1');
        await shot(page, '28V-E-002', 'focus_on_open');
      });

      await test.step('[28V-E-003] headings with labelled regions', async () => {
        for (const name of ['Luật', 'Phát hiện', 'Nguyên nhân có thể']) {
          await expect.soft(panel.getByRole('heading', { name, level: 3, exact: true })).toBeVisible();
          await expect.soft(panel.getByRole('region', { name, exact: true })).toBeVisible();
        }
        await shot(page, '28V-E-003', 'headings');
      });

      await test.step('[28V-E-006] both figures are named images', async () => {
        await expect.soft(panel.getByRole('img', { name: 'Sơ đồ hai đoạn tường và khe hở giữa chúng', exact: true })).toBeVisible();
        await expect.soft(figure).toBeVisible();
        await shot(page, '28V-E-006', 'img_labels');
      });

      await test.step('28V-C-001 (second half) causes: absent on a 0.9 wall (second project with the thin walls; the first one keeps the figure)', async () => {
        const thin = await createRuleProject(admin, 'rules-sheet-thin');
        await openRules(page, thin.id);
        await rowMessage(rowsOf(await expandRule(page, RULE_NAMES.wallThickness)).first()).click(); // wall of confidence 0.9
        const causes = panel.locator('ol > li');
        await expect.soft(causes).toHaveCount(2);
        await expect.soft(causes.first()).not.toHaveText(CAUSE_LOW_CONFIDENCE);
        await shot(page, '28V-C-001', 'causes_0_9_wall');
      });
    });
  });

  test('SCR-28 · FL-28V-02 · Navigation and keys inside the sheet', async ({ browser }) => {
    await withAdmin(browser, async (admin) => {
      const { page } = admin;
      const project = await createRuleProject(admin, 'rules-nav', { thinWalls: false });
      await openRules(page, project.id);
      const messages = await allMessages(page);
      const panel = sheet(page);
      const previous = panel.getByRole('button', { name: 'Vi phạm trước', exact: true });
      const next = panel.getByRole('button', { name: 'Vi phạm kế tiếp', exact: true });
      const clash = ruleSection(page, RULE_NAMES.furnitureClash);

      await test.step('[28V-C-009] click row N of a group', async () => {
        const row = rowsOf(clash).nth(1);
        const message = (await rowMessage(row).innerText()).trim();
        await openSheet(page, row);
        await expect(sheetTitle(page)).toHaveText(message);
        await shot(page, '28V-C-009', 'index_sync');
      });

      await test.step('[28V-A-019] previous / next buttons and their ends', async () => {
        expect(messages.length, 'rows in the report').toBeGreaterThan(2);
        await openSheet(page, rowsOf(sectionAt(page, 0)).first());
        await expect.soft(sheetTitle(page)).toHaveText(messages[0] ?? '');
        await expect.soft(previous).toBeDisabled();
        await next.click();
        await expect.soft(sheetTitle(page)).toHaveText(messages[1] ?? '');
        await expect.soft(previous).toBeEnabled();
        const lastIndex = (await groupHeaders(page).count()) - 1;
        await openSheet(page, rowsOf(sectionAt(page, lastIndex)).last());
        await expect.soft(sheetTitle(page)).toHaveText(messages.at(-1) ?? '');
        await expect.soft(next).toBeDisabled();
        await shot(page, '28V-A-019', 'ends');
      });

      await test.step('[28V-A-020] J / K', async () => {
        await openSheet(page, rowsOf(sectionAt(page, 0)).first());
        await page.keyboard.press('j');
        await expect.soft(sheetTitle(page)).toHaveText(messages[1] ?? '');
        await page.keyboard.press('k');
        await expect.soft(sheetTitle(page)).toHaveText(messages[0] ?? '');
        await shot(page, '28V-A-020', 'j_k');
      });

      await test.step('[28V-A-025] J visits every row in report order, collapsed groups included', async () => {
        await groupHeaders(page).nth(1).click(); // collapse a middle group: its rows must still be visited
        await expect(groupHeaders(page).nth(1)).toHaveAttribute('aria-expanded', 'false');
        await openSheet(page, rowsOf(sectionAt(page, 0)).first());
        for (let i = 1; i < messages.length; i += 1) {
          await page.keyboard.press('j');
          await expect.soft(sheetTitle(page), `row ${String(i)}`).toHaveText(messages[i] ?? '');
        }
        await shot(page, '28V-A-025', 'whole_list');
      });

      await test.step('[28V-E-004] accessible names of the icon buttons', async () => {
        await expect.soft(previous).toBeVisible();
        await expect.soft(next).toBeVisible();
        await expect.soft(panel.getByRole('button', { name: 'Đóng tấm trượt chi tiết vi phạm', exact: true })).toBeVisible();
        await shot(page, '28V-E-004', 'icon_names');
      });

      const opener = rowsOf(clash).first().locator('button[data-row-key]'); // F9: RowMessage keeps data-row-key; focus returns to it
      await test.step('[28V-E-007] Tab order inside the sheet', async () => {
        await expandRule(page, RULE_NAMES.furnitureClash);
        await opener.click();
        await expect(panel).toBeVisible();
        await previous.focus();
        const trail: { role: string; text: string; inFindings: boolean }[] = [{ role: 'button', text: 'Vi phạm trước', inFindings: false }];
        for (let i = 0; i < 12; i += 1) {
          await page.keyboard.press('Tab');
          const item = await page.evaluate(() => {
            const el = document.activeElement as HTMLElement | null;
            return {
              role: el?.getAttribute('role') ?? el?.tagName.toLowerCase() ?? '',
              text: (el?.getAttribute('aria-label') ?? el?.textContent ?? '').trim(),
              inFindings: el?.closest('section')?.getAttribute('aria-labelledby') === 'violation-findings-heading',
            };
          });
          trail.push(item);
          if (item.text === DELETE_ACTION) break;
        }
        const index = (match: (item: (typeof trail)[number]) => boolean, from = 0): number => trail.findIndex((item, i) => i >= from && match(item));
        const stops = [
          index((x) => x.text === 'Vi phạm trước'),
          index((x) => x.text === 'Vi phạm kế tiếp'),
          index((x) => x.text === 'Đóng tấm trượt chi tiết vi phạm'),
          index((x) => x.inFindings),
          index((x) => x.role === 'radio'),
          index((x) => x.text === DELETE_ACTION),
        ];
        expect.soft(stops.every((value) => value >= 0), `all stops reached: ${JSON.stringify(stops)}`).toBe(true);
        expect.soft(stops, 'ascending').toEqual([...stops].sort((a, b) => a - b));
        await shot(page, '28V-E-007', 'tab_order');
      });

      await test.step('[28V-A-021] Escape closes the sheet, the report stays', async () => {
        await page.keyboard.press('Escape');
        await expect(panel).toHaveCount(0);
        await expect.soft(reportHeading(page)).toBeVisible();
        await expect.soft(groupHeaders(page).first()).toBeVisible();
        await shot(page, '28V-A-021', 'escape');
      });

      await test.step('[28V-E-008] ⚑ focus returns to the row that opened the sheet', async () => {
        await expect.soft(opener, 'focus is on button[data-row-key] of the opened row').toBeFocused();
        await shot(page, '28V-E-008', 'focus_back');
      });
    });
  });

  // T (E4): the BE recomputes room.areaM2 from the outline on every layer write (writer.py W18), so the seed's `areaM2: 3` becomes 16 m2
  // and ROOM-AREA-BELOW-MINIMUM never fires. Shrink the kitchen outline to 2000 x 1500 = 3 m2 (kitchen minimum 5 m2).
  const smallKitchenLayer = (levelId: string, thinWalls = false): ReturnType<typeof ruleLayer> => {
    const layer = ruleLayer(levelId, { thinWalls }) as { rooms: { outline: unknown }[] };
    const kitchen = layer.rooms[0];
    if (kitchen) kitchen.outline = [{ x: 0, y: 0 }, { x: 2000, y: 0 }, { x: 2000, y: 1500 }, { x: 0, y: 1500 }];
    return layer;
  };

  test('SCR-28 · FL-28V-03 · Quick fix: delete a clashing table, report moves it to "Đã xử lý"', async ({ browser }) => {
    await withAdmin(browser, async (admin) => {
      const { page } = admin;
      const project = await createRuleProject(admin, 'rules-fix', { thinWalls: false });
      const floor = floorOf(project);
      const puts = trackLayerPuts(page);
      await openRules(page, project.id);
      const panel = sheet(page);
      const clashName = RULE_NAMES.furnitureClash;
      const clashSection = await expandRule(page, clashName);
      const clashMessages = await rowsOf(clashSection).evaluateAll((rows) =>
        rows.map((row) => row.querySelector('td:nth-child(2) button')?.textContent?.trim() ?? ''),
      );
      const before = (await infoOf(page, clashName))?.open ?? -1;
      const first = rowsOf(clashSection).first();
      const code = (await rowCode(first).innerText()).trim();
      const deleteButton = panel.getByRole('button', { name: DELETE_ACTION });
      const undoButton = page.getByRole('button', { name: UNDO, exact: true });
      let answered: ReturnType<typeof waitForApi> | undefined;
      let revisionBefore = -1;
      let furnitureBefore = -1;

      await test.step('[28V-B-001] the whole sheet for a clashing table', async () => {
        expect(before, 'clash rows').toBe(3);
        await openSheet(page, first);
        for (const name of ['Luật', 'Phát hiện', 'Nguyên nhân có thể', 'Lựa chọn xử lý']) {
          await expect(panel.getByRole('heading', { name, level: 3, exact: true })).toBeVisible();
        }
        await expect(sheetTitle(page)).toHaveText(clashMessages[0] ?? '');
        await expect(panel.getByLabel('Khối hình của vi phạm')).toBeVisible();
        await shot(page, '28V-B-001', 'whole_sheet');
      });

      await test.step('[28V-A-011] ⚑ action copy names the display code', async () => {
        await expect.soft(deleteButton).toBeVisible();
        await expect
          .soft(panel.locator('#violation-action-deleteObject-description'))
          .toHaveText(`Gỡ đồ đạc ${code} khỏi bản vẽ; hoàn tác được trong tám giây.`);
        await shot(page, '28V-A-011', 'action_copy');
      });

      await test.step('[28-C-013] before the fix there is no "Đã xử lý"', async () => {
        await expect.soft(resolvedHeader(page)).toHaveCount(0);
        await shot(page, '28-C-013', 'no_resolved_yet');
      });

      const seenBanner = await watchText(page, ADVANCE_BANNER);
      const seenKeep = await watchText(page, KEEP_BUTTON);
      // F9: keepPreviousData - after the PUT versionId changes but the sheet does NOT unmount and "Đã xử lý" shows as soon as the report re-runs.
      // The in-page recorder is kept (it also proves the transient order); post-PUT state is asserted directly below. Record whether the sheet ever showed the next row's title and whether "Đã sửa xong" was still on it.
      await page.evaluate(
        ([next, line]) => {
          const w = window as unknown as { __p06next?: { reached: boolean; stale: boolean } };
          const state: { reached: boolean; stale: boolean } = { reached: false, stale: false };
          w.__p06next = state;
          new MutationObserver(() => {
            const aside = document.querySelector('aside[aria-label="Chi tiết vi phạm"]');
            if (aside?.querySelector('h2')?.textContent !== next) return;
            state.reached = true;
            if ((aside.textContent ?? '').includes(line)) state.stale = true;
          }).observe(document.body, { characterData: true, childList: true, subtree: true });
        },
        [clashMessages[1] ?? '', 'Đã sửa xong'] as const,
      );
      await test.step('[28V-A-014] "Xoá đối tượng này": toast "Hoàn tác" and the resolved line', async () => {
        const layer = await readFloorLayer(admin, project.id, floor.id);
        revisionBefore = layer.revision;
        furnitureBefore = layer.furnitureIds.length;
        answered = waitForApi(page, 'PUT', layerPutRe, [200]);
        await deleteButton.click();
        await expect.soft(panel.getByText(FIXED_LINE)).toBeVisible();
        await expect.soft(undoButton.first()).toBeVisible();
        await shot(page, '28V-A-014', 'fixed');
      });

      await test.step('[28V-C-003] the rule ran again and no finding remains on the table', async () => {
        await softly.poll(async () => (await infoOf(page, clashName))?.open).toBe(before - 1);
        await shot(page, '28V-C-003', 'resolved_by_rerun');
      });

      await test.step('[28V-G-001] one PUT with the N15 revision and the layer without the table', async () => {
        await answered;
        expect.soft(puts.length, 'PUT …/spatial/layer').toBe(1);
        expect.soft(puts[0]?.baseVersion, 'baseVersion = revision read before').toBe(revisionBefore);
        expect.soft(puts[0]?.furnitureCount, 'furniture in the layer').toBe(furnitureBefore - 1);
        await shot(page, '28V-G-001', 'put_wire');
      });

      await test.step('[28V-G-002] answered 200, "Đã lưu lúc …", no second PUT', async () => {
        expect.soft((await answered)?.response.status()).toBe(200);
        await expect.soft(panel.getByText(SAVED_LABEL)).toBeVisible();
        await quiet(page);
        expect.soft(puts.length, 'PUT count').toBe(1);
        await shot(page, '28V-G-002', 'put_answer');
      });

      await test.step('[28V-A-016] the banner shows, then the sheet moves to the next violation', async () => {
        expect.soft(await seenBanner(), `banner "${ADVANCE_BANNER}"`).toBe(true);
        expect.soft(await seenKeep(), `button "${KEEP_BUTTON}"`).toBe(true);
        // S5-confirm: "the next row" is the old second clash row; recorded in the window before the PUT (see above).
        expect.soft(await page.evaluate(() => (window as unknown as { __p06next?: { reached: boolean } }).__p06next?.reached), 'sheet reached the next row').toBe(true);
        await expect.soft(panel, 'the sheet did not unmount after the save (F9)').toBeVisible();
        await shot(page, '28V-A-016', 'advanced');
      });

      await test.step('[28V-C-004] ⚑ the next violation has no "Đã sửa xong…" line', async () => {
        const seen = await page.evaluate(() => (window as unknown as { __p06next?: { reached: boolean; stale: boolean } }).__p06next);
        expect(seen?.reached, 'marker: the sheet showed the next row title').toBe(true);
        expect.soft(seen?.stale, '"Đã sửa xong…" still on the next violation').toBe(false);
        await expect.soft(panel.getByText(FIXED_LINE)).toHaveCount(0);
        await shot(page, '28V-C-004', 'stale_resolved_line');
      });

      await test.step('[28-A-037] report: "Đã xử lý" 1 mục, header " · 1 đã xử lý"', async () => {
        await expect.soft(panel, 'sheet still open while the group shows (F9)').toBeVisible();
        await expect.soft(resolvedHeader(page)).toContainText('1 mục');
        const info = await infoOf(page, clashName);
        expect.soft(info?.resolved, 'đã xử lý').toBe(1);
        expect.soft(info?.open, 'mục chưa xử lý').toBe(before - 1);
        await shot(page, '28-A-037', 'resolved_section');
      });

      await test.step('[28-A-038] "Đã xử lý" starts open and toggles', async () => {
        await expect.soft(resolvedHeader(page)).toHaveAttribute('aria-expanded', 'true');
        await resolvedHeader(page).click();
        await expect.soft(resolvedHeader(page)).toHaveAttribute('aria-expanded', 'false');
        await resolvedHeader(page).click();
        await expect.soft(resolvedHeader(page)).toHaveAttribute('aria-expanded', 'true');
        await shot(page, '28-A-038', 'resolved_toggle');
      });

      await test.step('[28-A-039] "Cảnh báo" filter keeps the resolved section', async () => {
        await levelRadio(page, 'Cảnh báo').click();
        await expect.soft(resolvedHeader(page)).toBeVisible();
        await levelRadio(page, 'Tất cả').click();
        await shot(page, '28-A-039', 'resolved_under_filter');
      });

      await test.step('[28-A-040] a resolved row opens the sheet', async () => {
        const resolvedSection = page.locator('section').filter({ has: resolvedHeader(page) });
        const row = rowsOf(resolvedSection).first();
        const message = (await rowMessage(row).innerText()).trim();
        await rowMessage(row).click();
        await expect.soft(sheetTitle(page)).toHaveText(message);
        await shot(page, '28-A-040', 'resolved_row_sheet');
      });

      await test.step('[28-A-041] settings and Back drop the resolved section', async () => {
        await page.getByRole('link', { name: 'Cài đặt bộ luật', exact: true }).click();
        await expect.poll(() => pathOf(page)).toBe(ROUTES.project.ruleSettings(project.id));
        await page.goBack();
        await expect(reportHeading(page)).toBeVisible();
        await expect.soft(resolvedHeader(page)).toHaveCount(0);
        await shot(page, '28-A-041', 'resolved_gone');
      });
    });
  });

  test('SCR-28 · FL-28V-04 · Undo, double fix and the 8 s window', async ({ browser }) => {
    await withAdmin(browser, async (admin) => {
      const { page } = admin;
      const project = await createRuleProject(admin, 'rules-undo', { thinWalls: false });
      const floor = floorOf(project);
      const puts = trackLayerPuts(page);
      await page.clock.install(); // time keeps flowing; only the 8 s toast window is jumped (fastForward)
      await openRules(page, project.id);
      const panel = sheet(page);
      const clashName = RULE_NAMES.furnitureClash;
      const startOpen = (await infoOf(page, clashName))?.open ?? -1;
      const deleteButton = panel.getByRole('button', { name: DELETE_ACTION });
      const undoButton = page.getByRole('button', { name: UNDO, exact: true });
      const furnitureCount = async (): Promise<number> => (await readFloorLayer(admin, project.id, floor.id)).furnitureIds.length;
      const openClash = async (index: number): Promise<void> => {
        const section = await expandRule(page, clashName);
        if (index < 0) {
          // hasNext must be false: the clash group has to be the last group of the report (else ROOM-UNNAMED etc. follow).
          expect((await headerInfos(page)).at(-1)?.ruleName, 'last group of the report').toBe(clashName);
        }
        const rows = rowsOf(section);
        await openSheet(page, index < 0 ? rows.last() : rows.nth(index));
      };
      const fix = async (): Promise<void> => {
        const answered = waitForApi(page, 'PUT', layerPutRe, [200]);
        await deleteButton.click();
        await answered;
      };
      const seenBanner = await watchText(page, ADVANCE_BANNER);
      expect(startOpen, 'clash rows').toBe(3);

      await test.step('[28V-A-018] fix the LAST row: no banner, the sheet stays', async () => {
        await openClash(-1);
        await fix();
        expect.soft(await seenBanner(), 'banner').toBe(false);
        await expect.soft(panel).toBeVisible();
        await shot(page, '28V-A-018', 'last_row');
      });

      const keep = await armKeep(page);
      let afterFix = -1;
      await test.step('[28V-A-017] fix a row that has a next one: banner, "Giữ lại màn này" keeps the sheet', async () => {
        // Deviation from the plan text ("the second table's row"): after the last row is gone the first row is the one with a next.
        await openClash(0);
        await fix();
        expect.soft(await seenBanner(), 'banner').toBe(true);
        expect.soft(await keep.kept(), `"${KEEP_BUTTON}" clicked`).toBe(true);
        await keep.disarm();
        await expect.soft(panel.getByText(ADVANCE_BANNER)).toHaveCount(0);
        await expect.soft(panel).toBeVisible();
        afterFix = await furnitureCount();
        await shot(page, '28V-A-017', 'keep_sheet');
      });

      await test.step('[28V-A-023] "Hoàn tác" in the toast brings the table back', async () => {
        const answered = waitForApi(page, 'PUT', layerPutRe, [200]);
        await undoButton.last().click();
        await answered;
        await softly.poll(furnitureCount).toBe(afterFix + 1);
        await expect.soft(deleteButton).toBeVisible();
        await shot(page, '28V-A-023', 'undone');
      });

      await test.step('[28V-G-008] the undo PUT carries the revision returned by the previous PUT', async () => {
        await softly.poll(() => puts.length).toBeGreaterThanOrEqual(3);
        const [, second, third] = puts;
        expect.soft(third?.baseVersion, 'baseVersion of the undo PUT').toBe(second?.revision);
        await expect.soft(panel.getByText(SAVED_LABEL)).toBeVisible();
        await shot(page, '28V-G-008', 'undo_put');
      });

      await test.step('[28V-C-005] ⚑ the report lists the undone row as open again', async () => {
        await softly.poll(async () => (await infoOf(page, clashName))?.open).toBe(startOpen - 1);
        await expect.soft(resolvedHeader(page), 'nothing is "Đã xử lý" after the undo').toHaveCount(0);
        await shot(page, '28V-C-005', 'report_after_undo');
      });

      await test.step('[28V-C-006] ⚑ fix again, then Ctrl+Z restores the table exactly once', async () => {
        await openClash(0);
        const beforeFix = await furnitureCount();
        await fix();
        await softly.poll(furnitureCount).toBe(beforeFix - 1);
        await page.locator('body').press('Control+Z');
        await softly.poll(furnitureCount).toBe(beforeFix);
        const putsAfter = puts.length;
        await quiet(page);
        expect.soft(await furnitureCount(), 'still exactly one restore').toBe(beforeFix);
        expect.soft(puts.length, 'no late or second PUT').toBe(putsAfter);
        await shot(page, '28V-C-006', 'ctrl_z');
      });

      const notFound = panel.getByText(/^Không tìm thấy đồ đạc .+ trong bản vẽ\.$/u);
      await test.step('[28V-B-004] ⚑ after a fix the same action is not offered again', async () => {
        await openClash(-1);
        await fix(); // marker: PUT 200 answered
        // F6 (useViolationDetail.ts:697, :1251): a deleted object is no longer offered, and "Đã sửa xong…" stays.
        await expect.soft(panel.getByText(FIXED_LINE), 'fixed line stays').toBeVisible();
        await expect.soft(deleteButton, 'no second action').toHaveCount(0);
        await expect.soft(notFound).toHaveCount(0);
        await shot(page, '28V-B-004', 'second_fix');
      });

      await test.step('[28V-B-009] "Đã sửa xong…" is not shown while an error is', async () => {
        if ((await notFound.count()) > 0) await expect.soft(panel.getByText(FIXED_LINE)).toHaveCount(0);
        else await expect.soft(notFound, 'no error to compare with: the second action is gone').toHaveCount(0);
        await shot(page, '28V-B-009', 'error_vs_resolved');
      });

      await test.step('[28V-A-024] after 8 s the toast "Hoàn tác" is gone', async () => {
        await page.clock.fastForward(8_100);
        await expect.soft(undoButton).toHaveCount(0);
        await shot(page, '28V-A-024', 'window_over');
      });
    });
  });

  test('SCR-28 · FL-28V-05 · Rename a room (not resolved) and save conflict', async ({ browser }) => {
    await withAdmin(browser, async (admin) => {
      const { page } = admin;
      const project = await createRuleProject(admin, 'rules-rename', { thinWalls: false });
      const floor = floorOf(project);
      await writeLayer(admin.fx, project.id, floor.id, (levelId) => smallKitchenLayer(levelId));
      const puts = trackLayerPuts(page);
      await openRules(page, project.id);
      const panel = sheet(page);
      const clashName = RULE_NAMES.furnitureClash;
      const deleteButton = panel.getByRole('button', { name: DELETE_ACTION });
      const writeElsewhere = async (): Promise<void> => {
        await writeLayer(admin.fx, project.id, floor.id, (levelId) => smallKitchenLayer(levelId)); // +X: another session replaces the layer
      };

      await test.step('[28V-A-012] ⚑ rename action copy', async () => {
        const row = rowsOf(await expandRule(page, RULE_NAMES.roomArea)).first();
        const code = (await rowCode(row).innerText()).trim();
        await openSheet(page, row);
        await expect(panel.getByRole('button', { name: RENAME_ACTION })).toBeVisible();
        // S5-confirm: the proposed name for a kitchen is "Bếp" (proposedRoomNameOf).
        await expect
          .soft(panel.locator('#violation-action-renameRoom-description'))
          .toHaveText(`Đặt tên phòng ${code} thành "Bếp"; hoàn tác được trong tám giây.`);
        await shot(page, '28V-A-012', 'rename_copy');
      });

      await test.step('[28V-A-015] rename: toast "Hoàn tác", no "Đã sửa xong", no banner', async () => {
        const seenBanner = await watchText(page, ADVANCE_BANNER);
        const answered = waitForApi(page, 'PUT', layerPutRe, [200]);
        await panel.getByRole('button', { name: RENAME_ACTION }).click();
        await answered;
        await expect.soft(page.getByRole('button', { name: UNDO, exact: true }).first()).toBeVisible();
        await expect.soft(panel.getByText(FIXED_LINE)).toHaveCount(0);
        expect.soft(await seenBanner(), 'banner').toBe(false);
        await shot(page, '28V-A-015', 'renamed');
      });

      await test.step('[28V-G-003] another session wrote the floor: PUT 409, "Lưu thất bại", no "Tải lại"', async () => {
        const section = ruleSection(page, clashName);
        await openSheet(page, rowsOf(section).first());
        await writeElsewhere();
        const answered = waitForApi(page, 'PUT', layerPutRe, [409]);
        await deleteButton.click();
        expect.soft((await answered).response.status(), 'PUT …/spatial/layer').toBe(409);
        expect.soft(puts.at(-1)?.status).toBe(409);
        await expect.soft(panel.getByText(SAVE_FAILED)).toBeVisible();
        await expect.soft(panel.getByRole('button', { name: 'Tải lại' })).toHaveCount(0);
        await shot(page, '28V-G-003', 'conflict_409');
      });

      await test.step('[28V-E-005] action buttons describe themselves (fresh load)', async () => {
        expect(await putRuleConfig(admin, project.id, {}), 'N22 PUT (rule back on)').toBe(200);
        await openRules(page, project.id);
        await openFirstRowOf(page, clashName);
        const buttons = panel.locator('section[aria-labelledby="violation-actions-heading"] button');
        expect(await buttons.count(), 'action buttons').toBeGreaterThan(0);
        for (let i = 0; i < (await buttons.count()); i += 1) {
          const describedBy = await buttons.nth(i).getAttribute('aria-describedby');
          expect.soft(describedBy, 'aria-describedby').not.toBeNull();
          await expect.soft(page.locator(`[id="${describedBy ?? ''}"]`)).not.toBeEmpty();
        }
        await shot(page, '28V-E-005', 'describedby');
      });

      await test.step('[28V-E-009] the conflict is announced', async () => {
        await writeElsewhere();
        const answered = waitForApi(page, 'PUT', layerPutRe, [409]);
        await deleteButton.click();
        await answered;
        await expect.soft(page.getByText(RELOAD_MESSAGE).first()).toBeAttached();
        await shot(page, '28V-E-009', 'announcer');
      });
    });
  });

  test('SCR-28 · FL-28V-06 · Floors and unavailable figure', async ({ browser }) => {
    await withAdmin(browser, async (admin) => {
      const { page } = admin;
      const project = await createRuleProject(admin, 'rules-floors', {
        floors: [
          { name: 'Tầng 1', elevationMm: 0 },
          { name: 'Tầng 2', elevationMm: 0 },
        ],
        layered: 1,
      }); // R5: floor 2 has no walls
      await writeLayer(admin.fx, project.id, floorOf(project).id, (levelId) => smallKitchenLayer(levelId, true));
      const puts = trackLayerPuts(page);
      await openRules(page, project.id);
      const panel = sheet(page);
      const firstKind = panel.locator('section[aria-labelledby="violation-findings-heading"] li').first();
      const levelRow = async (): Promise<Locator> => rowsOf(await expandRule(page, RULE_NAMES.levelElevation)).first();

      await test.step('[28-A-021] ⚑ a row with floor "—" and no active floor still opens the sheet', async () => {
        const row = await levelRow();
        await expect.soft(row.locator('td').nth(2)).toHaveText('—');
        await rowMessage(row).click();
        await expect.soft(panel).toBeVisible();
        await shot(page, '28-A-021', 'level_row_sheet');
      });

      await test.step('[28V-C-002] kind words: tầng / tường / ô mở / đồ đạc / phòng', async () => {
        await expect.soft(firstKind).toContainText('tầng');
        const expectations: readonly [string | RegExp, string][] = [
          [RULE_NAMES.wallThickness, 'tường'],
          [RULE_NAMES.doorWidth, 'ô mở'],
          [RULE_NAMES.furnitureClash, 'đồ đạc'],
          [RULE_NAMES.roomArea, 'phòng'],
        ];
        for (const [name, word] of expectations) {
          await rowMessage(rowsOf(await expandRule(page, name)).first()).click();
          await expect.soft(firstKind, `kind word of ${String(name)}`).toContainText(word);
        }
        await shot(page, '28V-C-002', 'kind_words');
      });

      await test.step('[28V-B-003] a floor without walls has no "Khối hình" section', async () => {
        await rowMessage(await levelRow()).click();
        await expect(panel, 'the sheet opened (28-A-021)').toBeVisible();
        await expect.soft(panel.getByLabel('Khối hình của vi phạm')).toHaveCount(0);
        await expect.soft(panel.getByRole('img', { name: FIGURE_2D, exact: true })).toHaveCount(0);
        await expect.soft(panel.locator('canvas')).toHaveCount(0);
        await expect.soft(panel.getByRole('heading', { name: 'Nguyên nhân có thể', level: 3 })).toBeVisible();
        await expect.soft(panel.getByText(NO_ACTIONS_LINE, { exact: true })).toBeVisible();
        await shot(page, '28V-B-003', 'no_figure');
      });

      await test.step('[28V-C-008] the save uses the floor chosen in the shell, else the own floor of the row', async () => {
        await openSheet(page, rowsOf(await expandRule(page, RULE_NAMES.furnitureClash)).first());
        let answered = waitForApi(page, 'PUT', layerPutRe, [200]);
        await panel.getByRole('button', { name: DELETE_ACTION }).click();
        await answered;
        expect.soft(puts.at(-1)?.path, 'no active floor: the own floor of the row').toBe(layerPathOf(project.id, floorOf(project).id));
        // Chosen floor: OverlayComparison selectFloor → setActiveFloor (useOverlayComparison.ts:1048-1053), then an SPA hop to /rules
        // (projectHydration.ts:200-210 does not reset activeFloorId). S5-confirm: the overlay opens without a scan; option label.
        await page.goto(ROUTES.project.overlay(project.id, floorOf(project).id));
        await page.getByRole('combobox', { name: 'Chọn tầng' }).click();
        await page.getByRole('option', { name: /Tầng 2/u }).click();
        await page.evaluate((url) => {
          window.history.pushState({}, '', url);
          window.dispatchEvent(new PopStateEvent('popstate'));
        }, ROUTES.project.rules(project.id));
        await expect(reportHeading(page)).toBeVisible();
        await openSheet(page, rowsOf(await expandRule(page, RULE_NAMES.furnitureClash)).first());
        const before = puts.length;
        answered = waitForApi(page, 'PUT', layerPutRe, [200, 403, 404, 409]);
        await panel.getByRole('button', { name: DELETE_ACTION }).click();
        await answered;
        expect.soft(puts.length, 'a PUT went out').toBeGreaterThan(before);
        expect.soft(puts.at(-1)?.path, 'a floor chosen in the shell: the save uses it').toBe(layerPathOf(project.id, floorOf(project, 1).id));
        await shot(page, '28V-C-008', 'floor_source');
      });
    });
  });
});
