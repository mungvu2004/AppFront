/**
 * Phase 6 — SCR-30 Bảng xuất, UI VERIFY layer (skill `qa-verify-ui`): three flows (QA-06b P4, `flows-C3.md`
 * "phase06_export_ui.spec.ts"), 14 steps. Each step is one screen state captured at 1440 / 1024 / 768 / 375 by `verifyUi`
 * (which measures horizontal scroll, controls outside the viewport, broken images, clipped text, overlaps, small targets and
 * attaches `<name>.json`), plus the layout claims of its catalog row measured in the state's own `open` callback and asserted
 * after `verifyUi` (never inside it: a throw there becomes the width's `openError`). Evidence `U06_<row id>_<slug>_<width>.png`.
 *
 * Layout contract (EPV:268,278): two columns from `lg` (right column 344 px), stacked below; history "Thời điểm" column hidden
 * below 640 px; "Sửa" / "Tuỳ chọn" targets 44 px below `sm`, 24 px from `sm` (EPP:46-62, EPO:228).
 *
 * FL-30-U3 is `[mocked response]` (Worker stub + a held N15 read, support/p06/export.ts); real pairing: FL-30-U1.
 * ⚑ steps assert the CORRECT behaviour and stay red while the bug is there (30-F-013, BUG-445; 30-F-006 BUG-458 residual).
 *
 * ## Real-backend budget per full run
 * - `POST /api/auth/login` 3 (+ 1 viewer session) + 1 admin API; refresh ≈ 1 per page load (≈ 90); `POST /api/projects` 5
 *   (+ `DELETE` 5); `PUT …/spatial/layer` 5; `PATCH /api/projects/:id` 1; `POST …/members` 1. No upload.
 */
import { expect, test, type Browser, type Locator, type Page } from '@playwright/test';

import { ROUTES } from '../../e2e/fixtures/routes';
import { verifyUi } from './support/ui-verify';
import { addProjectMember, poolUser } from './support/phase03Seed';
import {
  EP,
  adminApi,
  closeExportFlow,
  downloadVia,
  emitFromWorker,
  exportButton,
  expandOptions,
  formatGroup,
  formatRadio,
  historyRegion,
  historyRows,
  holdRoute,
  openExport,
  openExportFlow,
  openPoolFlow,
  optionsToggle,
  preflightRegion,
  scopeRegion,
  scopeRow,
  seedEmptyProject,
  seedLongName,
  seedNoLayer,
  seedQc,
  selectFormat,
  setGlbWorkerMode,
  spatialRe,
  stubGlbWorker,
  floorOf,
  type ExportFlow,
  type PoolFlow,
} from './support/p06/export';

const NAME = (id: string, slug: string): string => `U06_${id}_${slug}`;

/** Per-viewport numbers a state's `open` callback recorded (key = viewport width). */
class Seen<T> {
  private readonly values = new Map<number, T>();
  record(page: Page, value: T): void {
    this.values.set(page.viewportSize()?.width ?? 0, value);
  }
  each(check: (width: number, value: T) => void): void {
    for (const [width, value] of this.values) check(width, value);
    expect.soft(this.values.size, 'the state was measured at every width').toBeGreaterThan(0);
  }
}

interface Box {
  readonly x: number;
  readonly y: number;
  readonly width: number;
  readonly height: number;
}

const boxOf = async (locator: Locator): Promise<Box> => {
  const box = await locator.boundingBox();
  if (box === null) throw new Error('element has no box');
  return box;
};
const inside = (box: Box, width: number, height?: number): boolean =>
  box.x >= -1 && box.x + box.width <= width + 1 && (height === undefined || (box.y >= -1 && box.y + box.height <= height + 1));

async function inFlow(browser: Browser, body: (flow: ExportFlow) => Promise<void>): Promise<void> {
  let flow: ExportFlow | undefined;
  try {
    flow = await openExportFlow(browser);
    await body(flow);
  } finally {
    await closeExportFlow(flow);
  }
}

test.describe('SCR-30 Bảng xuất — UI verify', () => {
  test('SCR-30 · FL-30-U1 · panel states on a project with long names', async ({ browser }) => {
    test.setTimeout(900_000);
    await inFlow(browser, async (flow) => {
      const { page } = flow;
      const project = await seedLongName(flow); // X2L: 80-char name → ~100-char file names

      await test.step('[30-F-001] .glb, "Tuỳ chọn" open: two columns from 1024, stacked below', async () => {
        const seen = new Seen<{ side: boolean }>();
        await verifyUi(page, NAME('30-F-001', 'glb_options'), async (p) => {
          await openExport(p, project.id);
          await selectFormat(p, '.glb');
          await expandOptions(p);
          const [formats, scope] = [await boxOf(formatGroup(p)), await boxOf(scopeRegion(p))];
          seen.record(p, { side: scope.x >= formats.x + formats.width - 1 });
        });
        seen.each((width, value) => expect.soft(value.side, `${String(width)}: two columns from lg (1024)`).toBe(width >= 1024));
      });

      await test.step('[30-F-002] .json, options open: "Xuất" inside the frame', async () => {
        const seen = new Seen<Box>();
        await verifyUi(page, NAME('30-F-002', 'json_options'), async (p) => {
          await openExport(p, project.id);
          await selectFormat(p, '.json');
          await expandOptions(p);
          seen.record(p, await boxOf(exportButton(p)));
        });
        seen.each((width, box) => expect.soft(inside(box, width), `${String(width)}: "Xuất" inside the frame`).toBe(true));
      });

      await test.step('[30-F-003] .pdf: the notice wraps, no overflow', async () => {
        const seen = new Seen<Box>();
        await verifyUi(page, NAME('30-F-003', 'pdf_notice'), async (p) => {
          await openExport(p, project.id);
          await selectFormat(p, '.pdf');
          seen.record(p, await boxOf(p.getByText(EP.pdfNotice, { exact: true })));
        });
        seen.each((width, box) => expect.soft(inside(box, width), `${String(width)}: notice inside the frame`).toBe(true));
      });

      await test.step('[30-F-004] .png: the long caption wraps at 375', async () => {
        const seen = new Seen<Box>();
        await verifyUi(page, NAME('30-F-004', 'png_caption'), async (p) => {
          await openExport(p, project.id);
          await selectFormat(p, '.png');
          seen.record(p, await boxOf(formatRadio(p, '.png').getByText(EP.imageBlocked, { exact: true })));
        });
        seen.each((width, box) => expect.soft(inside(box, width), `${String(width)}: caption inside the frame`).toBe(true));
      });

      await test.step('[30-F-012] preflight with attention rows: "Sửa" and "Tuỳ chọn" target sizes', async () => {
        const seen = new Seen<{ fix: number; toggle: number }>();
        await verifyUi(page, NAME('30-F-012', 'preflight_targets'), async (p) => {
          await openExport(p, project.id);
          const heights = await preflightRegion(p).getByRole('link', { name: EP.fix }).evaluateAll((els) => els.map((el) => el.getBoundingClientRect().height));
          seen.record(p, { fix: Math.min(...heights), toggle: (await boxOf(optionsToggle(p))).height });
        });
        // min-h-11 below `sm` (44 px), min-h-6 from `sm` (24 px): EPP:46-62, EPO:228 (BUG-442)
        seen.each((width, value) => {
          const needed = width < 640 ? 44 : 24;
          expect.soft(value.fix, `${String(width)}: "Sửa" height`).toBeGreaterThanOrEqual(needed - 0.5);
          expect.soft(value.toggle, `${String(width)}: "Tuỳ chọn" height`).toBeGreaterThanOrEqual(needed - 0.5);
        });
      });

      await test.step('[30-F-005] after one .json export: the "Tệp đã xuất" table', async () => {
        const seen = new Seen<{ box: Box; heads: number }>();
        await verifyUi(page, NAME('30-F-005', 'history_table'), async (p) => {
          await openExport(p, project.id);
          await selectFormat(p, '.json');
          await downloadVia(p, () => exportButton(p).click());
          await expect(historyRows(p)).toHaveCount(1);
          seen.record(p, { box: await boxOf(historyRegion(p)), heads: await historyRegion(p).getByRole('columnheader').count() });
        });
        seen.each((width, value) => {
          expect.soft(inside(value.box, width), `${String(width)}: table inside the frame`).toBe(true);
          expect.soft(value.heads, `${String(width)}: columns (Tệp, [Thời điểm], Dung lượng, Tải lại)`).toBe(width < 640 ? 3 : 4);
        });
      });

      await test.step('[30-F-014] two rows across the `sm` edge: "Thời điểm" column at 639 / 640', async () => {
        const seen = new Seen<number>();
        await verifyUi(
          page,
          NAME('30-F-014', 'history_sm_edge'),
          async (p) => {
            await openExport(p, project.id);
            await selectFormat(p, '.json');
            for (let i = 0; i < 2; i += 1) await downloadVia(p, () => exportButton(p).click());
            await expect(historyRows(p)).toHaveCount(2);
            seen.record(p, await historyRegion(p).getByRole('columnheader', { name: EP.historyHeads[1] ?? '', exact: true }).count());
          },
          [
            { width: 639, height: 900 },
            { width: 640, height: 900 },
          ],
        );
        seen.each((width, count) => expect.soft(count, `${String(width)}: "Thời điểm" column`).toBe(width >= 640 ? 1 : 0)); // EPV:138,149
      });

      await test.step('[30-F-013] ⚑ a long file name is reachable (wraps or `title`)', async () => {
        const seen = new Seen<{ clipped: boolean; title: string; text: string }>();
        await verifyUi(page, NAME('30-F-013', 'long_file_name'), async (p) => {
          await openExport(p, project.id);
          await selectFormat(p, '.json');
          await downloadVia(p, () => exportButton(p).click());
          await expect(historyRows(p)).toHaveCount(1);
          const cell = historyRows(p).first().locator('td').first();
          seen.record(
            p,
            await cell.evaluate((el) => ({
              clipped: el.scrollWidth > el.clientWidth + 1,
              title: el.getAttribute('title') ?? el.querySelector('[title]')?.getAttribute('title') ?? '',
              text: (el.textContent ?? '').trim(),
            })),
          );
        });
        // EPV:148 `max-w-0 truncate` with no `title` (BUG-445): the full name is neither shown nor in a tooltip.
        seen.each((width, value) => expect.soft(!value.clipped || value.title === value.text, `${String(width)}: the ${String(value.text.length)}-char name is reachable`).toBe(true));
      });
    });
  });

  test('SCR-30 · FL-30-U2 · other seeds, one state each', async ({ browser }) => {
    test.setTimeout(300_000);
    await inFlow(browser, async (flow) => {
      const { page } = flow;
      const noLayer = await seedNoLayer(flow); // P1
      const readOnly = await seedQc(flow, 'export-u2v'); // X1 +V
      const empty = await seedEmptyProject(flow, 'export-u2m'); // M0
      const admin = await adminApi();
      let viewerFlow: PoolFlow | undefined;
      try {
        const viewer = await poolUser(admin, 'viewer', 'p06-export-v');
        await addProjectMember(admin, readOnly.id, viewer.email);
        viewerFlow = await openPoolFlow(browser, viewer);
        const viewerPage = viewerFlow.page;
        const floorName = floorOf(noLayer, 0).name;

        await test.step('[30-F-006] no-layer project: the long floor name and the Badge do not collide', async () => {
          const seen = new Seen<{ lines: number; badgeHeight: number; overlap: boolean }>();
          await verifyUi(page, NAME('30-F-006', 'no_layer_long_names'), async (p) => {
            await openExport(p, noLayer.id);
            const row = scopeRow(p, floorName);
            const badge = row.getByText(EP.notApprovedBadge, { exact: true });
            const label = row.locator('label').first();
            const lines = await label.evaluate((el) => {
              const range = document.createRange();
              range.selectNodeContents(el);
              return new Set([...range.getClientRects()].map((r) => Math.round(r.top))).size;
            });
            const [a, b] = [await boxOf(label), await boxOf(badge)];
            seen.record(p, { lines, badgeHeight: b.height, overlap: a.x < b.x + b.width && b.x < a.x + a.width && a.y < b.y + b.height && b.y < a.y + a.height });
          });
          // Badge.tsx:36 fixes the height at 22 px without nowrap (BUG-458): a wrapped Badge or a 3-line name is the finding.
          seen.each((width, value) => {
            expect.soft(value.overlap, `${String(width)}: name and Badge do not overlap`).toBe(false);
            expect.soft(value.lines, `${String(width)}: floor name lines`).toBeLessThanOrEqual(2);
            expect.soft(value.badgeHeight, `${String(width)}: Badge stays on one line`).toBeLessThanOrEqual(26);
          });
        });

        await test.step('[30-F-007] viewer: lock icon, heading, centred caption', async () => {
          const seen = new Seen<{ icon: number; centred: boolean }>();
          await verifyUi(viewerPage, NAME('30-F-007', 'viewer_forbidden'), async (p) => {
            await openExport(p, readOnly.id, { ready: (q) => q.getByRole('heading', { name: EP.forbiddenTitle, level: 2 }) });
            const caption = p.getByText(EP.forbiddenCaption, { exact: true });
            seen.record(p, {
              icon: await p.locator('svg.lucide-lock').count(),
              centred: (await caption.evaluate((el) => getComputedStyle(el).textAlign)) === 'center',
            });
          });
          seen.each((width, value) => {
            expect.soft(value.icon, `${String(width)}: lock icon`).toBeGreaterThan(0);
            expect.soft(value.centred, `${String(width)}: caption centred`).toBe(true);
          });
        });

        await test.step('[30-F-008] zero floors: icon, heading, centred text', async () => {
          const seen = new Seen<{ icon: number; centred: boolean }>();
          await verifyUi(page, NAME('30-F-008', 'zero_floors'), async (p) => {
            await openExport(p, empty.id, { ready: (q) => q.getByRole('heading', { name: EP.emptyTitle, level: 2 }) });
            seen.record(p, {
              icon: await p.locator('svg.lucide-folder-open').count(),
              centred: (await p.getByText(EP.noFloor, { exact: true }).evaluate((el) => getComputedStyle(el).textAlign)) === 'center',
            });
          });
          seen.each((width, value) => {
            expect.soft(value.icon, `${String(width)}: folder icon`).toBeGreaterThan(0);
            expect.soft(value.centred, `${String(width)}: text centred`).toBe(true);
          });
        });
      } finally {
        await viewerFlow?.context.close().catch(() => undefined);
        await admin.dispose();
      }
    });
  });

  // Real pairing: FL-30-U1 (the same panel with real reads and real files).
  test('SCR-30 · FL-30-U3 · [mocked response] loading, progress, error', async ({ browser }) => {
    test.setTimeout(300_000);
    await inFlow(browser, async (flow) => {
      const { page } = flow;
      const project = await seedQc(flow, 'export-u3');
      await stubGlbWorker(page, 'silent');

      await test.step('[30-F-009] loading skeleton keeps the card heights', async () => {
        const hold = await holdRoute(page, spatialRe(project.id), 'hold');
        const cards = ['.glb', '.pdf', '.png', '.json'];
        const heights = async (p: Page): Promise<number[]> => Promise.all(cards.map(async (ext) => (await boxOf(formatRadio(p, ext))).height));
        try {
          await verifyUi(page, NAME('30-F-009', 'loading_skeleton'), async (p) => {
            await p.goto(ROUTES.project.export(project.id), { waitUntil: 'commit' });
            await expect(p.locator('span[aria-hidden="true"].animate-pulse').first()).toBeVisible();
          });
          const loading = await heights(page);
          hold.release();
          await expect(formatRadio(page, '.pdf')).toContainText(/\d[\d.]* trang/u);
          const loaded = await heights(page);
          loading.forEach((height, index) => expect.soft(Math.abs(height - (loaded[index] ?? 0)), `${cards[index] ?? ''} card height: loading ${String(height)} vs loaded ${String(loaded[index])}`).toBeLessThanOrEqual(1));
        } finally {
          hold.release();
          await hold.stop();
        }
      });

      await test.step('[30-F-010] progress footer: sticky, full-width bar, "Huỷ" reachable', async () => {
        const seen = new Seen<{ footerBottom: number; viewportHeight: number; bar: number; footer: number; cancel: Box }>();
        await verifyUi(page, NAME('30-F-010', 'progress_footer'), async (p) => {
          await openExport(p, project.id);
          await exportButton(p).click();
          await emitFromWorker(p, { kind: 'progress', phase: 'build', completed: 12, total: 40 });
          const footer = await boxOf(p.locator('footer'));
          seen.record(p, {
            footerBottom: footer.y + footer.height,
            viewportHeight: p.viewportSize()?.height ?? 0,
            bar: (await boxOf(p.getByRole('progressbar'))).width,
            footer: footer.width,
            cancel: await boxOf(p.locator('footer').getByRole('button', { name: EP.cancel, exact: true })),
          });
        });
        seen.each((width, value) => {
          expect.soft(value.footerBottom, `${String(width)}: footer sticks to the bottom edge`).toBeGreaterThan(value.viewportHeight - 4);
          expect.soft(value.bar / value.footer, `${String(width)}: bar width / footer width`).toBeGreaterThan(0.8);
          expect.soft(inside(value.cancel, width, value.viewportHeight), `${String(width)}: "Huỷ" reachable`).toBe(true);
        });
      });

      await test.step('[30-F-011] error banner + hint: "thử lại" and "(processing)" wrap at 375', async () => {
        const seen = new Seen<{ banner: Box; retry: Box; code: Box }>();
        await verifyUi(page, NAME('30-F-011', 'error_banner'), async (p) => {
          await openExport(p, project.id);
          await setGlbWorkerMode(p, 'fail'); // this document's next Worker fails (the init script restarts in 'silent')
          await exportButton(p).click();
          const retry = p.getByRole('button', { name: EP.errorRetry, exact: true });
          await expect(retry).toBeVisible();
          seen.record(p, {
            banner: await boxOf(p.getByRole('alert').filter({ has: retry })),
            retry: await boxOf(retry),
            code: await boxOf(p.getByText('(processing)', { exact: true })),
          });
        });
        seen.each((width, value) => {
          expect.soft(inside(value.banner, width), `${String(width)}: banner inside the frame`).toBe(true);
          expect.soft(inside(value.retry, width), `${String(width)}: "thử lại" inside the frame`).toBe(true);
          expect.soft(inside(value.code, width), `${String(width)}: "(processing)" not cut`).toBe(true);
        });
      });
    });
  });
});
