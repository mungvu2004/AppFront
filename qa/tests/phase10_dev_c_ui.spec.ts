/**
 * Phase 10 · SCR-40 dev routes, UI at 4 desktop/tablet widths (skill qa-verify-ui, `verifyUi`).
 * FL-10E-16 ShellDemo, FL-10E-17 CanvasOverlaysDemo, FL-10E-18 FeedbackDemo. Env: dev server mock (`devTest`).
 * Every id = one state; `open` brings the page to the state and waits for a visible marker, then verifyUi measures + shoots.
 */
import { devTest as test, expect } from './support/p10/devServer';
import { DESKTOP_VIEWPORTS } from './support/p10/viewports';
import { verifyUi } from './support/ui-verify';
import { expectInside, expectInViewport, expectNoHScroll, expectNoOverlap, expectNotClipped } from './support/p10/P14';
import type { Page } from '@playwright/test';

const WIDE = DESKTOP_VIEWPORTS.filter((v) => v.width >= 1280);
const AT_1024 = DESKTOP_VIEWPORTS.filter((v) => v.width === 1024);
const AT_768 = DESKTOP_VIEWPORTS.filter((v) => v.width === 768);

/* ---- ShellDemo (src/screens/ShellDemo.tsx, src/components/shell/AppShell.tsx) ---- */
const canvasHeading = (p: Page) => p.getByRole('heading', { name: 'Canvas Area', exact: true, level: 2 }); // ShellDemo.tsx:50
const openShell = async (p: Page): Promise<void> => {
  await p.goto('/shell-demo');
  await expect(canvasHeading(p)).toBeVisible();
};
const canvasRegion = (p: Page) => p.locator('[data-region="canvas"]'); // AppShell.tsx:266
const dialogs = (p: Page) => p.getByRole('dialog'); // AppShell.tsx ShortcutHelp.tsx:125 role=dialog

test('SCR-40e-3 · FL-10E-16 · anon · UI ShellDemo (c_ui)', async ({ devPage: page }) => {
  test.setTimeout(150_000);

  await test.step('[10E-F-009] two panels open at 1920/1440: no horizontal scroll', async () => {
    await verifyUi(page, 'E10_10E-F-009_shell_two_panels', async (p) => {
      await openShell(p);
      await expect(p.getByRole('button', { name: 'Thu gọn panel trái ([)', exact: true })).toBeVisible();
      await expect(p.getByRole('button', { name: 'Thu gọn panel phải (])', exact: true })).toBeVisible();
    }, WIDE);
  });

  await test.step('[10E-F-010] collapse left / right (>=1280): canvas grows', async () => {
    await verifyUi(page, 'E10_10E-F-010_shell_collapsed', async (p) => {
      await openShell(p);
      const before = (await canvasRegion(p).boundingBox())?.width ?? 0;
      await p.getByRole('button', { name: 'Thu gọn panel trái ([)', exact: true }).click();
      await p.getByRole('button', { name: 'Thu gọn panel phải (])', exact: true }).click();
      await expect(p.getByRole('button', { name: 'Mở panel trái ([)', exact: true })).toBeVisible();
      await expect(p.getByRole('button', { name: 'Mở panel phải (])', exact: true })).toBeVisible();
      await expect.poll(async () => (await canvasRegion(p).boundingBox())?.width ?? 0).toBeGreaterThan(before);
    }, WIDE);
  });

  await test.step('[10E-F-011] 1024: right overlay Drawer open does not cover the header', async () => {
    await verifyUi(page, 'E10_10E-F-011_shell_right_overlay_1024', async (p) => {
      await openShell(p);
      await p.keyboard.press(']'); // useKeyboardMap: rightAsOverlay → overlay toggle (AppShell.tsx:172)
      await expect(dialogs(p).first()).toBeVisible();
      await expect(dialogs(p).first().getByText('Properties', { exact: true })).toBeVisible();
    }, AT_1024, { fullPage: false });
    const header = page.locator('[data-region="topBar"]');
    const drawer = dialogs(page).first();
    const h = await header.boundingBox();
    const d = await drawer.boundingBox();
    expect.soft((d?.y ?? 0) + 1, 'Drawer top is at/below the header bottom').toBeGreaterThanOrEqual((h?.y ?? 0) + (h?.height ?? 0));
  });

  await test.step('[10E-F-012] 768: left Drawer open, no horizontal scroll', async () => {
    await verifyUi(page, 'E10_10E-F-012_shell_left_drawer_768', async (p) => {
      await openShell(p);
      await p.keyboard.press('['); // leftAsDrawer → drawer toggle (AppShell.tsx:171)
      await expect(dialogs(p).first()).toBeVisible();
      await expect(dialogs(p).first().getByText('Architecture', { exact: true })).toBeVisible();
    }, AT_768, { fullPage: false });
  });

  await test.step('[10E-F-013] shortcut help + command palette stay in the viewport', async () => {
    await verifyUi(page, 'E10_10E-F-013_shell_help_palette', async (p) => {
      await openShell(p);
      await p.getByRole('button', { name: 'Phím tắt (?)', exact: true }).click();
      await expect(dialogs(p).first()).toBeVisible();
      await expectInViewport(p, dialogs(p).first(), 'shortcut help dialog');
      await p.keyboard.press('Escape');
      await expect(dialogs(p)).toHaveCount(0);
      await p.keyboard.press('Control+k'); // CommandPalette.tsx
      const box = p.getByPlaceholder('Tìm lệnh, dự án, tầng, lớp...');
      await expect(box).toBeVisible();
      await expectInViewport(p, box, 'command palette input');
    }, DESKTOP_VIEWPORTS);
  });
});

/* ---- CanvasOverlaysDemo (src/screens/CanvasOverlaysDemo.tsx) ---- */
const openCanvas = async (p: Page): Promise<void> => {
  await p.goto('/demo/canvas-overlays');
  await expect(p.getByRole('heading', { name: 'Canvas Overlays Demo', exact: true, level: 1 })).toBeVisible(); // :104
};
const canvasBox = (p: Page) => p.locator('.cursor-crosshair'); // :113
const legend = (p: Page) => p.getByRole('group', { name: 'Lọc theo độ dày tường', exact: true }); // WallThicknessLegend.tsx:133
const zoom = (p: Page) => p.getByRole('group', { name: 'Cụm thu phóng', exact: true }); // ZoomCluster.tsx:74
const miniMap = (p: Page) => p.locator('[aria-label="Bản đồ thu nhỏ"]'); // MiniMap.tsx:73

test('SCR-40e-4 · FL-10E-17 · anon · UI CanvasOverlaysDemo (c_ui)', async ({ devPage: page }) => {
  test.setTimeout(150_000);

  await test.step('[10E-F-014] 2D at rest: overlays do not overlap', async () => {
    await verifyUi(page, 'E10_10E-F-014_canvas_2d_rest', async (p) => {
      await openCanvas(p);
      await expect(legend(p)).toBeVisible();
      await expect(zoom(p)).toBeVisible();
      await expect(miniMap(p)).toBeVisible();
      await expectNoOverlap([
        { name: 'legend', target: legend(p) },
        { name: 'zoom cluster', target: zoom(p) },
        { name: 'minimap', target: miniMap(p) },
      ]);
    }, DESKTOP_VIEWPORTS);
  });

  await test.step('[10E-F-015] 3D + halo: gizmo stays inside the canvas', async () => {
    await verifyUi(page, 'E10_10E-F-015_canvas_3d_halo', async (p) => {
      await openCanvas(p);
      await p.getByRole('button', { name: 'Chế độ 3D', exact: true }).click();
      await p.getByRole('button', { name: 'Bật/tắt Selection Halo', exact: true }).click();
      const gizmo = p.locator('[aria-label="Transform gizmo"]'); // TransformGizmo.tsx:84
      await expect(gizmo).toBeVisible();
      const halo = canvasBox(p).locator('div[role="presentation"][style*="width: 200px"]'); // P12.ts:19 hook
      await expect(halo).toBeVisible();
      await expectInside(canvasBox(p), halo, 'selection halo');
      await expectNoOverlap([
        { name: 'halo', target: halo },
        { name: 'legend', target: legend(p) },
        { name: 'zoom cluster', target: zoom(p) },
        { name: 'minimap', target: miniMap(p) },
      ]);
      await expectInside(canvasBox(p), gizmo, 'transform gizmo');
    }, DESKTOP_VIEWPORTS);
  });

  await test.step('[10E-F-016] committed measurement label does not spill out of the canvas', async () => {
    await verifyUi(page, 'E10_10E-F-016_canvas_measurement', async (p) => {
      await openCanvas(p);
      const box = (await canvasBox(p).boundingBox()) as { x: number; y: number; width: number; height: number };
      await p.mouse.move(box.x + 120, box.y + 80);
      await p.mouse.down();
      await p.mouse.up();
      await p.mouse.move(box.x + 420, box.y + 160);
      await p.mouse.down();
      await p.mouse.up();
      // Distance 3xx px × 12 → 4-digit mm; legend rows are 3-digit ("110 mm"), so they do not match.
      const label = canvasBox(p).getByText(/^[\d.,\s]{4,} mm$/u).first();
      await expect(label).toBeVisible();
      await expectInside(canvasBox(p), label, 'measurement label');
    }, DESKTOP_VIEWPORTS);
  });

  await test.step('[10E-F-017] context menu near right/bottom edge shifts into the viewport', async () => {
    await verifyUi(page, 'E10_10E-F-017_canvas_context_menu_edge', async (p) => {
      await openCanvas(p);
      const box = (await canvasBox(p).boundingBox()) as { x: number; y: number; width: number; height: number };
      await p.mouse.click(box.x + box.width - 6, box.y + box.height - 6, { button: 'right' });
      const menu = p.getByRole('menu', { name: 'Tuỳ chọn', exact: true }); // ContextMenu.tsx:141
      await expect(menu).toBeVisible();
      await expectInViewport(p, menu, 'context menu');
    }, DESKTOP_VIEWPORTS, { fullPage: false });
  });

  await test.step('[10E-F-018] legend filter on: labels not clipped', async () => {
    await verifyUi(page, 'E10_10E-F-018_canvas_legend_filter', async (p) => {
      await openCanvas(p);
      await p.getByRole('button', { name: 'Lọc theo 110 mm', exact: true }).click(); // WallThicknessLegend.tsx:171
      const active = p.getByRole('button', { name: 'Đang lọc 110 mm', exact: true });
      await expect(active).toBeVisible();
      await expectNotClipped(active, 'active legend row');
      await expectNotClipped(legend(p), 'legend group');
    }, DESKTOP_VIEWPORTS);
  });
});

/* ---- FeedbackDemo (src/screens/FeedbackDemo.tsx) ---- */
const openFeedback = async (p: Page, state: string, marker: string): Promise<void> => {
  await p.goto('/feedback-demo');
  await expect(p.getByRole('button', { name: 'Test Undo Toast', exact: true })).toBeVisible(); // :63
  await p.getByRole('button', { name: state, exact: true }).click();
  await expect(p.getByText(marker, { exact: true })).toBeVisible();
};

test('SCR-40e-5 · FL-10E-18 · anon · UI FeedbackDemo (c_ui)', async ({ devPage: page }) => {
  test.setTimeout(150_000);

  await test.step('[10E-F-019] Empty: centred, no overflow', async () => {
    await verifyUi(page, 'E10_10E-F-019_feedback_empty', async (p) => {
      await openFeedback(p, 'Empty', 'Chưa có tầng nào'); // :74
      await expectInViewport(p, p.getByText('Chưa có tầng nào', { exact: true }), 'empty title');
    }, DESKTOP_VIEWPORTS);
  });

  await test.step('[10E-F-020] Loading: overlay + stepper + skeletons do not overlap', async () => {
    await verifyUi(page, 'E10_10E-F-020_feedback_loading', async (p) => {
      await openFeedback(p, 'Loading', 'Nhận diện cửa và nội thất (YOLOv8)'); // stepper step name, :27
      await expectNoHScroll(p, 'feedback loading');
      await expectInViewport(p, p.getByText('Nhận diện cửa và nội thất (YOLOv8)', { exact: true }), 'stepper step 3');
    }, DESKTOP_VIEWPORTS);
  });

  await test.step('[10E-F-021] Partial / Error: long text not clipped', async () => {
    await verifyUi(page, 'E10_10E-F-021_feedback_partial', async (p) => {
      await openFeedback(p, 'Partial', 'Thiếu kích thước tổng'); // :95
      const alert = p.getByRole('alert').filter({ hasText: 'Thiếu kích thước tổng' });
      await expectNotClipped(alert, 'partial alert');
    }, DESKTOP_VIEWPORTS);
    await verifyUi(page, 'E10_10E-F-021_feedback_error', async (p) => {
      await openFeedback(p, 'Error', 'Lỗi phân tích bản vẽ'); // :107
      const alert = p.getByRole('alert').filter({ hasText: 'Lỗi phân tích bản vẽ' });
      await expectNotClipped(alert, 'error alert');
      await expect(p.getByText('Lỗi OOM').first()).toBeVisible();
    }, DESKTOP_VIEWPORTS);
  });

  await test.step('[10E-F-022] 3 toasts stacked: they do not cover the toast buttons', async () => {
    await verifyUi(page, 'E10_10E-F-022_feedback_three_toasts', async (p) => {
      await openFeedback(p, 'Empty', 'Chưa có tầng nào');
      await p.getByRole('button', { name: 'Test Undo Toast', exact: true }).click();
      await p.getByRole('button', { name: 'Test Warning Toast', exact: true }).click();
      await p.getByRole('button', { name: 'Test Error Toast', exact: true }).click();
      const toasts = p.getByRole('status');
      await expect(toasts).toHaveCount(3);
      const region = p.getByRole('region', { name: 'Thông báo', exact: true }); // Toast.tsx:215-223
      await expectInViewport(p, region, 'toast region');
      await expectNoOverlap([
        { name: 'toast region', target: region },
        { name: 'Test Undo Toast button', target: p.getByRole('button', { name: 'Test Undo Toast', exact: true }) },
        { name: 'Test Warning Toast button', target: p.getByRole('button', { name: 'Test Warning Toast', exact: true }) },
        { name: 'Test Error Toast button', target: p.getByRole('button', { name: 'Test Error Toast', exact: true }) },
      ]);
    }, DESKTOP_VIEWPORTS, { fullPage: false });
  });

  await test.step('[10E-F-023] Success / Unprivileged / Collapsed: no overflow', async () => {
    await verifyUi(page, 'E10_10E-F-023_feedback_success', async (p) => {
      await openFeedback(p, 'Success', 'Đã xử lý xong'); // :125
    }, DESKTOP_VIEWPORTS);
    await verifyUi(page, 'E10_10E-F-023_feedback_unprivileged', async (p) => {
      await openFeedback(p, 'Unprivileged', 'Quyền truy cập hạn chế'); // :137
    }, DESKTOP_VIEWPORTS);
    await verifyUi(page, 'E10_10E-F-023_feedback_collapsed', async (p) => {
      await openFeedback(p, 'Collapsed', 'Bảng điều khiển'); // :148
    }, DESKTOP_VIEWPORTS);
  });
});
