/**
 * QA-09 P7 helpers (phase09_viewer_edge.spec.ts): copy + 3D scene + measurement seed for the viewer-role flows.
 * Copy sources (FE 5fcaf502): VI src/screens/viewer/ViewerShell/ViewerInspector.tsx:82-89 · V3 Viewer3D/Viewer3D.tsx:268-273
 * · RT RoomAreaPanel/RoomAreaTable.tsx:81 · RC RoomAreaPanel.chrome.tsx:65-67 · FP FurnitureLibraryPanel.tsx:77
 * · FC FurnitureLibraryPanelCard.tsx:47 · HC HistoryPanel.chrome.tsx:63 · PE PascalViewer/usePascalEdits.ts:58
 * · MT MeasurementTool.tsx / useMeasurementTool.ts:202 · RR rules/RuleReport/RuleReport.tsx · WG WallGeometryEditorTypes.ts:510-515.
 */
import { randomInt } from 'node:crypto';

import { expect, type APIRequestContext, type Page } from '@playwright/test';

import { TEST_DATA_PREFIX } from '../evidence';

export const VIEWER_ONLY_TITLE = 'Chỉ xem'; // VI
export const VIEWER_ONLY_MESSAGE = 'Bạn đang xem ở vai người xem nên không sửa được mô hình.'; // VI
export const VIEWER_3D_NOTE = 'Bạn đang xem ở vai người xem nên không sửa được hình học trên mô hình 3D.'; // V3
export const ROOM_READONLY_NOTICE = 'Bảng chỉ xem — không có quyền sửa tên phòng.'; // RT
export const ROOM_FORBIDDEN_TITLE = 'Không xem được diện tích'; // RC
export const LIBRARY_FORBIDDEN_NOTE = 'Bạn đang xem ở vai chỉ xem nên không kéo mô hình vào bản vẽ được.'; // FP
export const LIBRARY_LOCKED_NOTE = 'Chỉ xem được, không kéo vào bản vẽ.'; // FC
export const HISTORY_FORBIDDEN_TITLE = 'Chỉ xem được lịch sử'; // HC
export const HISTORY_JUMP = 'Quay lại trạng thái này'; // HistoryPanel.rows.tsx:53
export const PASCAL_READ_ONLY_REASON = 'Vai của bạn chỉ được xem, không sửa được mô hình.'; // PE:58
export const VIEWER_RAIL = 'Công cụ khung nhìn';
export const VIEWER_VIEWPORT = 'Khung nhìn mô hình';
export const WALL_EDIT_LABELS = ['Di chuyển đỉnh', 'Thêm đỉnh', 'Xoá đỉnh', 'Tách tường', 'Nối tường', 'Đặt lại chiều cao'] as const; // WG
export const MEASURE_TOOL = 'Đo (M)';
export const MEASURE_PIN = 'Ghim phép đo (phím Enter)';
export const MEASURE_PIN_BLOCKED =
  'Bạn chỉ có quyền xem dự án này, nên chưa ghim được phép đo. vẫn đo và đọc số bình thường.'; // useMeasurementTool.ts:202
export const RULES_HEADING = 'Quy chuẩn';
export const RULES_RERUN = 'Chạy kiểm tra lại';
export const RULES_CONFIRM = 'Xác nhận đã xử lý';

/** Pascal mount point (PascalViewer.tsx data-testid="pascal-canvas"); /3d mounts the vendored Pascal editor since F-15 (router.tsx:382). */
export const pascalCanvas = (page: Page) => page.getByTestId('pascal-canvas').locator('canvas').first();

/**
 * Sure anchor for the 3D screens: /3d = Pascal canvas drawn (the old 'Khung nhìn mô hình' is gone, ViewerViewport.tsx);
 * /3d/measure still renders the legacy viewport, which reports aria-busy=false when its first paint is done.
 */
export async function viewportReady(page: Page): Promise<void> {
  const legacy = page.locator(`[aria-label="${VIEWER_VIEWPORT}"][aria-busy="false"]`);
  await expect(legacy.or(pascalCanvas(page)).first()).toBeVisible({ timeout: 60_000 });
}

/** Two different scene points = a complete measurement draft (MeasurementTool.tsx:201 shows the pin only when draftComplete). */
export async function drawTwoPoints(page: Page): Promise<void> {
  const box = await page.locator('canvas').first().boundingBox();
  if (box === null) throw new Error('canvas has no bounding box: the 3D scene is not mounted');
  await page.mouse.click(box.x + box.width * 0.4, box.y + box.height * 0.5);
  await page.mouse.click(box.x + box.width * 0.6, box.y + box.height * 0.5);
}

async function canvasCentre(page: Page): Promise<{ x: number; y: number }> {
  const box = await page.locator('canvas').first().boundingBox();
  if (box === null) throw new Error('canvas has no bounding box: the 3D scene is not mounted');
  return { x: box.x + box.width / 2, y: box.y + box.height / 2 };
}

/** Click the middle of the first canvas (needs {@link viewportReady} first). */
export async function clickSceneCentre(page: Page): Promise<void> {
  const { x, y } = await canvasCentre(page);
  await page.mouse.click(x, y);
}

/** A short drag across the middle of the canvas (an edit gesture; a viewer must produce no write). */
export async function dragScene(page: Page): Promise<void> {
  const { x, y } = await canvasCentre(page);
  await page.mouse.move(x, y);
  await page.mouse.down();
  await page.mouse.move(x + 40, y + 20, { steps: 5 });
  await page.mouse.up();
}

/** Admin creates one measurement on the project (BE measurements/schemas.py: id `MS-<4..15 digits>`, 2 points, mm). */
export async function seedMeasurement(
  admin: APIRequestContext,
  projectId: string,
): Promise<{ id: string; name: string; remove: () => Promise<void> }> {
  const id = `MS-${String(randomInt(100_000_000, 999_999_999))}`;
  const name = `${TEST_DATA_PREFIX}do-p09`;
  const res = await admin.post(`/api/projects/${projectId}/measurements`, {
    data: { id, name, mode: 'pointToPoint', points: [{ x: 0, y: 0 }, { x: 3000.5, y: 0 }], rawValueMm: 3000.5 },
  });
  if (res.status() !== 201) throw new Error(`seedMeasurement: ${String(res.status())} ${(await res.text()).slice(0, 200)}`);
  return {
    id,
    name,
    remove: async () => {
      const del = await admin.delete(`/api/projects/${projectId}/measurements/${id}`);
      if (![200, 204].includes(del.status())) throw new Error(`seedMeasurement remove: ${String(del.status())}`);
    },
  };
}

/** Writes sent since `mark` (a `writes.length` taken earlier). */
export const writesAfter = (writes: readonly string[], mark: number): string[] => writes.slice(mark);
