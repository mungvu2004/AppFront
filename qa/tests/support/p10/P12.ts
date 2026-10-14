import type { Locator, Page } from '@playwright/test';

/** Dev route of CanvasOverlaysDemo (src/routes/paths.ts:72). */
export const CANVAS_DEMO_PATH = '/demo/canvas-overlays';
/** Pixels -> millimetres factor of the measuring overlay (src/hooks/useMeasurementLabel.ts MM_PER_PIXEL). */
export const MM_PER_PIXEL = 12;

/** Locators of the demo; every one is derived from source (file:line beside each). */
export function canvasDemo(page: Page) {
  const canvas = page.locator('div.cursor-crosshair'); // CanvasOverlaysDemo.tsx:101
  return {
    heading: page.getByRole('heading', { name: 'Canvas Overlays Demo' }), // :87
    canvas,
    /** MeasurementLabel pill span (MeasurementLabel.tsx:119, `text-[13px]`). */
    label: canvas.locator('span[class*="text-[13px]"]'),
    /** Measuring svg lines: dashed main + 2 ticks (+1 connector once committed) (MeasurementLabel.tsx:57-110). */
    measureLines: canvas.locator('svg.absolute.inset-0 line'),
    /** SelectionHalo 200x150 (SelectionHalo.tsx:46, demo :132-140). */
    halo: canvas.locator('div[role="presentation"][style*="width: 200px"]'),
    gizmo: canvas.getByRole('group', { name: 'Transform gizmo' }), // TransformGizmo.tsx:83
    zoomGroup: canvas.getByRole('group', { name: 'Cụm thu phóng' }), // ZoomCluster.tsx:74
    zoomPct: canvas.getByRole('button', { name: /^Mức thu phóng / }), // ZoomCluster.tsx:97
    zoomIn: canvas.getByRole('button', { name: 'Phóng to' }),
    zoomOut: canvas.getByRole('button', { name: 'Thu nhỏ' }),
    zoomFit: canvas.getByRole('button', { name: 'Vừa khung nhìn' }),
    miniMap: canvas.getByRole('region', { name: 'Bản đồ thu nhỏ' }), // MiniMap.tsx:442
    miniMapButton: canvas.getByRole('button', { name: 'Bấm để di chuyển vùng nhìn' }), // MiniMap.tsx:462
    legend: canvas.getByRole('group', { name: 'Lọc theo độ dày tường' }), // WallThicknessLegend.tsx:300
    menu: page.getByRole('menu', { name: 'Tuỳ chọn' }), // ContextMenu.tsx:141
  };
}

/** Open the demo's context menu with a right click at canvas-relative (x, y). */
export async function openMenuAt(canvas: Locator, x: number, y: number): Promise<void> {
  await canvas.click({ button: 'right', position: { x, y } });
}
