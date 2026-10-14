/**
 * Phase 10 · SCR-40e-4 — CanvasOverlaysDemo (/demo/canvas-overlays), dev server mock (devTest).
 * FL-10E-10 (mode, halo, zoom, minimap, legend) and FL-10E-11 (measurement + context menu).
 */
import { devTest as test, expect } from './support/p10/devServer';
import { canvasDemo, CANVAS_DEMO_PATH, MM_PER_PIXEL, openMenuAt } from './support/p10/P12';
import { captureEvidence } from './support/evidence';

test('SCR-40e-4 · FL-10E-10 · anon · CanvasOverlaysDemo: chế độ, halo, zoom, minimap, legend', async ({ devPage: page }) => {
  test.setTimeout(120_000);
  const d = canvasDemo(page);
  const mode3d = page.getByRole('button', { name: 'Chế độ 3D' });
  const mode2d = page.getByRole('button', { name: 'Chế độ 2D' });
  const haloToggle = page.getByRole('button', { name: 'Bật/tắt Selection Halo' });
  const legend110 = d.legend.getByRole('button', { name: /110 mm$/ });
  const clearFilter = d.legend.getByRole('button', { name: 'Xoá lọc' });

  await test.step('[10E-B-027] idle 2D: no measurement label, zoom 100%', async () => {
    await page.goto(CANVAS_DEMO_PATH);
    await expect(d.heading).toBeVisible();
    await expect(d.zoomPct).toHaveText('100%'); // ZoomCluster.tsx:100
    await expect(d.label).toHaveCount(0);
    await captureEvidence(page, 'E10_10E-B-027_canvas_idle.png');
  });

  await test.step('[10E-A-044] "Chế độ 3D" turns the label into "Chế độ 2D"', async () => {
    await mode3d.click();
    await expect.soft(mode2d).toBeVisible();
    await expect.soft(d.canvas).toHaveAttribute('style', /--canvas-3d/); // CanvasOverlaysDemo.tsx:103
    await captureEvidence(page, 'E10_10E-A-044_canvas_mode3d.png');
  });

  await test.step('[10E-B-030] 3D: TransformGizmo shown, back to 2D hides it', async () => {
    await expect.soft(d.gizmo).toBeVisible();
    await mode2d.click();
    await expect.soft(d.gizmo).toBeHidden();
    await expect.soft(mode3d).toBeVisible();
    await captureEvidence(page, 'E10_10E-B-030_canvas_gizmo.png');
  });

  await test.step('[10E-A-045] Selection Halo toggle: shown then hidden', async () => {
    await haloToggle.click();
    await expect.soft(d.halo).toBeVisible();
    await haloToggle.click();
    await expect.soft(d.halo).toBeHidden();
    await captureEvidence(page, 'E10_10E-A-045_canvas_halo.png');
  });

  await test.step('[10E-B-031] halo shown: frame 200x150', async () => {
    await haloToggle.click();
    await expect.soft(d.halo).toBeVisible();
    // the enter animation scales the box (120 ms) - poll until it settles
    await expect.poll(async () => (await d.halo.boundingBox())?.width).toBe(200);
    await expect.poll(async () => (await d.halo.boundingBox())?.height).toBe(150);
    await captureEvidence(page, 'E10_10E-B-031_canvas_halo_frame.png');
  });

  await test.step('[10E-C-019] halo toggled twice quickly: final state right, not stuck', async () => {
    await haloToggle.click();
    await haloToggle.click();
    await expect.soft(d.halo).toBeVisible();
    await haloToggle.click();
    await expect.soft(d.halo).toBeHidden();
    await captureEvidence(page, 'E10_10E-C-019_canvas_halo_rapid.png');
  });

  await test.step('[10E-A-050] zoom +x3, -, %, fit: 130 -> 120 -> 100 -> 85', async () => {
    await d.zoomIn.click();
    await d.zoomIn.click();
    await d.zoomIn.click();
    await expect.soft(d.zoomPct).toHaveText('130%');
    await d.zoomOut.click();
    await expect.soft(d.zoomPct).toHaveText('120%');
    await d.zoomPct.click();
    await expect.soft(d.zoomPct).toHaveText('100%');
    await d.zoomFit.click();
    await expect.soft(d.zoomPct).toHaveText('85%'); // useZoomCluster.ts:19
    await captureEvidence(page, 'E10_10E-A-050_canvas_zoom.png');
  });

  await test.step('[10E-C-018] zoom clamped to 10% / 400%', async () => {
    for (let i = 0; i < 40; i++) await d.zoomOut.click();
    await expect.soft(d.zoomPct).toHaveText('10%');
    for (let i = 0; i < 40; i++) await d.zoomIn.click();
    await expect.soft(d.zoomPct).toHaveText('400%');
    await captureEvidence(page, 'E10_10E-C-018_canvas_zoom_clamp.png');
    await d.zoomPct.click();
  });

  await test.step('[10E-A-051] MiniMap click moves the viewport frame', async () => {
    const frame = d.miniMapButton.locator('div.border-accent'); // MiniMap.tsx:487
    await expect.soft(frame).toHaveAttribute('style', /left: 20%; top: 20%/); // useMiniMap.ts:44
    await d.miniMapButton.click({ position: { x: 130, y: 100 } });
    // x clamps to 100-40=60 (useMiniMap.ts:52); y is ~69 (clamp max 70)
    await expect.soft(frame).toHaveAttribute('style', /left: 60%; top: (6[89]|70)/);
    await captureEvidence(page, 'E10_10E-A-051_canvas_minimap.png');
  });

  await test.step('[10E-A-052] legend "Lọc theo 110 mm": pressed, "Đang lọc 110 mm", "Xoá lọc"', async () => {
    await d.legend.getByRole('button', { name: 'Lọc theo 110 mm' }).click();
    await expect.soft(d.legend.getByRole('button', { name: 'Đang lọc 110 mm' })).toHaveAttribute('aria-pressed', 'true');
    await expect.soft(clearFilter).toBeVisible();
    await captureEvidence(page, 'E10_10E-A-052_canvas_legend_filter.png');
  });

  await test.step('[10E-B-033] filter on: other entries dimmed, filter entry not; clearing restores', async () => {
    await expect.soft(d.legend.getByRole('button', { name: 'Lọc theo 220 mm' })).toHaveClass(/opacity-40/); // WallThicknessLegend.tsx:335
    await expect.soft(d.legend.getByRole('button', { name: 'Lọc theo 330 mm' })).toHaveClass(/opacity-40/);
    await expect.soft(d.legend.getByRole('button', { name: 'Đang lọc 110 mm' })).not.toHaveClass(/opacity-40/);
    await captureEvidence(page, 'E10_10E-B-033_canvas_legend_dimmed.png');
    await clearFilter.click();
    await expect.soft(legend110).toHaveAttribute('aria-pressed', 'false');
    await expect.soft(clearFilter).toHaveCount(0);
  });

  await test.step('[10E-E-011] ZoomCluster group "Cụm thu phóng" and its four named buttons', async () => {
    await expect.soft(d.zoomGroup).toBeVisible();
    await expect.soft(d.zoomOut).toHaveAttribute('title', 'Thu nhỏ (−)'); // ZoomCluster.tsx:82
    await expect.soft(d.zoomIn).toHaveAttribute('title', 'Phóng to (+)');
    await expect.soft(d.zoomFit).toHaveAttribute('title', 'Vừa khung (F)');
    await expect.soft(d.zoomPct).toHaveAttribute('title', 'Bấm để về 100%');
    await captureEvidence(page, 'E10_10E-E-011_canvas_zoom_a11y.png');
  });

  await test.step('[10E-E-013] legend group "Lọc theo độ dày tường": entries carry aria-pressed', async () => {
    await expect.soft(d.legend).toBeVisible();
    await expect.soft(d.legend.locator('button[aria-pressed]')).toHaveCount(4); // 110 / 220 / 330 / Cột BTCT (WallThicknessLegend.tsx:327)
    await expect.soft(legend110).toHaveAttribute('aria-pressed', 'false');
    await legend110.click();
    await expect.soft(d.legend.getByRole('button', { name: 'Đang lọc 110 mm' })).toHaveAttribute('aria-pressed', 'true');
    await captureEvidence(page, 'E10_10E-E-013_canvas_legend_a11y.png');
    await clearFilter.click();
  });
});

test('SCR-40e-4 · FL-10E-11 · anon · CanvasOverlaysDemo: phép đo và menu ngữ cảnh', async ({ devPage: page }) => {
  test.setTimeout(120_000);
  const d = canvasDemo(page);
  const mode3d = page.getByRole('button', { name: 'Chế độ 3D' });
  const mode2d = page.getByRole('button', { name: 'Chế độ 2D' });
  // canvas-relative points; the label reads round(hypot(dx,dy) * MM_PER_PIXEL) mm
  const P1 = { x: 400, y: 300 };
  const P2 = { x: P1.x + 30, y: P1.y + 40 }; // 3-4-5 triangle -> 50 px
  const P3 = { x: 700, y: 450 };
  const mmText = `${String(Math.round(Math.hypot(30, 40) * MM_PER_PIXEL))} mm`; // 600 mm, below the 1 m threshold
  let box = { x: 0, y: 0 };
  const moveTo = async (p: { x: number; y: number }): Promise<void> => page.mouse.move(box.x + p.x, box.y + p.y);
  const items = d.menu.getByRole('menuitem');

  await test.step('[10E-A-053] ⚑ clicking "Phóng to" inside the canvas must not start a measurement', async () => {
    await page.goto(CANVAS_DEMO_PATH);
    await expect(d.heading).toBeVisible();
    await expect(d.zoomPct).toHaveText('100%');
    const b = await d.canvas.boundingBox();
    if (b === null) throw new Error('canvas has no box');
    box = b;
    await d.zoomIn.click();
    await expect(d.zoomPct).toHaveText('110%'); // the click landed
    // CanvasOverlaysDemo.tsx:105 onPointerDown + ZoomCluster has no stopPropagation -> a label appears today
    await expect.soft(d.label).toHaveCount(0);
    await captureEvidence(page, 'E10_10E-A-053_canvas_overlay_click.png');
  });

  await test.step('[10E-A-046] click 1, move: label reads round(dist x 12) mm', async () => {
    // N-4 may have left a measurement started by the zoom click: reload so the state machine is idle before P1
    await page.goto(CANVAS_DEMO_PATH);
    await expect(d.heading).toBeVisible();
    const b = await d.canvas.boundingBox();
    if (b === null) throw new Error('canvas has no box');
    box = b;
    await d.canvas.click({ position: P1 });
    await moveTo(P2);
    await expect.soft(d.label).toHaveText(mmText); // useMeasurementLabel.ts:96
    await captureEvidence(page, 'E10_10E-A-046_canvas_measure_value.png');
  });

  await test.step('[10E-B-028] measuring: line follows the mouse + label', async () => {
    await expect.soft(d.label).toBeVisible();
    await expect.soft(d.measureLines).toHaveCount(3); // main + 2 ticks, no connector yet
    await captureEvidence(page, 'E10_10E-B-028_canvas_measuring.png');
  });

  await test.step('[10E-B-029] click 2 commits: label stays + connector line', async () => {
    await d.canvas.click({ position: P2 });
    await expect.soft(d.label).toHaveText(mmText);
    await expect.soft(d.measureLines).toHaveCount(4); // + midpoint->label connector (MeasurementLabel.tsx:100)
    await captureEvidence(page, 'E10_10E-B-029_canvas_committed.png');
  });

  await test.step('[10E-A-047] click 3 starts a new measurement', async () => {
    await d.canvas.click({ position: P3 });
    await expect.soft(d.measureLines).toHaveCount(3); // connector gone: measuring again
    await expect.soft(d.label).toHaveCount(1);
    await expect.soft(d.label).toHaveText('—');
    await captureEvidence(page, 'E10_10E-A-047_canvas_measure_restart.png');
  });

  await test.step('[10E-C-017] two clicks on the same point: label "—"', async () => {
    await d.canvas.click({ position: P3 });
    await expect.soft(d.measureLines).toHaveCount(4); // committed
    await expect.soft(d.label).toHaveText('—');
    await captureEvidence(page, 'E10_10E-C-017_canvas_zero_distance.png');
  });

  await test.step('[10E-C-016] right click does not start a measurement', async () => {
    await openMenuAt(d.canvas, 300, 200);
    await expect.soft(d.menu).toBeVisible();
    await expect.soft(d.measureLines).toHaveCount(4); // still committed, not reset to measuring (CanvasOverlaysDemo.tsx:48)
    await expect.soft(d.label).toHaveText('—');
    await captureEvidence(page, 'E10_10E-C-016_canvas_right_click.png');
    await page.keyboard.press('Escape');
    await expect.soft(d.menu).toBeHidden();
  });

  await test.step('[10E-C-020] switching 2D <-> 3D keeps the measurement', async () => {
    await mode3d.click();
    await expect.soft(mode2d).toBeVisible();
    await expect.soft(d.label).toHaveText('—');
    await expect.soft(d.measureLines).toHaveCount(4);
    await mode2d.click();
    await expect.soft(mode3d).toBeVisible();
    await expect.soft(d.label).toHaveText('—');
    await expect.soft(d.measureLines).toHaveCount(4);
    await captureEvidence(page, 'E10_10E-C-020_canvas_mode_keeps_measure.png');
  });

  await test.step('[10E-A-048] right click: menu "Tuỳ chọn" with 3 items, native menu suppressed', async () => {
    await page.evaluate(() => {
      const w = window as unknown as { __ctxPrevented: boolean[] };
      w.__ctxPrevented = [];
      window.addEventListener('contextmenu', (e) => w.__ctxPrevented.push(e.defaultPrevented));
    });
    await openMenuAt(d.canvas, 700, 350);
    await expect.soft(d.menu).toBeVisible();
    await expect.soft(items).toHaveCount(3);
    await expect.soft(items.nth(0)).toContainText('Chỉnh sửa thuộc tính'); // CanvasOverlaysDemo.tsx:78
    await expect.soft(items.nth(0)).toContainText('⌘E');
    await expect.soft(items.nth(1)).toContainText('Cô lập');
    await expect.soft(items.nth(2)).toContainText('Xoá phần tử');
    await expect.soft(items.nth(2)).toContainText('⌫');
    const prevented = await page.evaluate(() => (window as unknown as { __ctxPrevented: boolean[] }).__ctxPrevented);
    expect.soft(prevented).toEqual([true]);
    await captureEvidence(page, 'E10_10E-A-048_canvas_context_menu.png');
  });

  await test.step('[10E-B-032] menu open: first item has focus', async () => {
    await expect.soft(items.nth(0)).toBeFocused(); // ContextMenu.tsx:128 (rAF focus)
    await captureEvidence(page, 'E10_10E-B-032_canvas_menu_focus.png');
  });

  await test.step('[10E-A-049] menu keys: arrows wrap, Home/End, Esc closes, selecting closes', async () => {
    await page.keyboard.press('ArrowDown');
    await expect.soft(items.nth(1)).toBeFocused();
    await page.keyboard.press('ArrowDown');
    await expect.soft(items.nth(2)).toBeFocused();
    await page.keyboard.press('ArrowDown');
    await expect.soft(items.nth(0)).toBeFocused(); // wraps
    await page.keyboard.press('ArrowUp');
    await expect.soft(items.nth(2)).toBeFocused(); // wraps back
    await page.keyboard.press('Home');
    await expect.soft(items.nth(0)).toBeFocused();
    await page.keyboard.press('End');
    await expect.soft(items.nth(2)).toBeFocused();
    await captureEvidence(page, 'E10_10E-A-049_canvas_menu_keys.png');
    await page.keyboard.press('Escape');
    await expect.soft(d.menu).toBeHidden();
    // the opener was the page body (the canvas is not focusable), so there is no focus target to assert: menu gone is the check
    await openMenuAt(d.canvas, 700, 350);
    await expect.soft(d.menu).toBeVisible();
    await items.nth(1).click();
    await expect.soft(d.menu).toBeHidden();
  });

  await test.step('[10E-E-012] menu semantics: role=menu "Tuỳ chọn", menuitems, separators', async () => {
    await openMenuAt(d.canvas, 700, 350);
    await expect.soft(d.menu).toBeVisible();
    await expect.soft(d.menu).toHaveAttribute('role', 'menu'); // ContextMenu.tsx:141
    await expect.soft(items).toHaveCount(3);
    // UNKNOWN — NEED VERIFICATION: catalog lists a separator, but the demo calls openMenuFlat (one group) and
    // ContextMenu.tsx:245 only draws a separator between groups, so none is expected here.
    await expect.soft(d.menu.getByRole('separator')).toHaveCount(0);
    await captureEvidence(page, 'E10_10E-E-012_canvas_menu_a11y.png');
    await page.keyboard.press('Escape');
    await expect.soft(d.menu).toBeHidden();
  });
});
