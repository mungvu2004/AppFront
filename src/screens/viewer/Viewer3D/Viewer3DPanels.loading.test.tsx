/**
 * BUG-379 — vỏ chờ của ba bảng phụ nói ĐÚNG bảng nào đang tải.
 *
 * Tệp riêng vì `lazy()` nhớ kết quả ở cấp module: trong `Viewer3DPanels.test.tsx`
 * các bài trước đã nạp xong ba chunk, nên vỏ chờ không bao giờ hiện lại. Ở đây
 * ba module bảng bị thay bằng một lượt nhập không bao giờ xong — chính là lúc
 * chunk còn trên đường mà người dùng nhìn thấy.
 */
import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import {
  Viewer3DPanels,
  VIEWER_3D_FURNITURE_PANEL_LABEL,
  VIEWER_3D_HISTORY_PANEL_LABEL,
  VIEWER_3D_ROOMS_PANEL_LABEL,
  type Viewer3DPanelId,
} from './Viewer3DPanels';

vi.mock('@/screens/viewer/RoomAreaPanel', () => new Promise<never>(() => undefined));
vi.mock('@/screens/viewer/FurnitureLibraryPanel', () => new Promise<never>(() => undefined));
vi.mock('@/screens/viewer/HistoryPanel', () => new Promise<never>(() => undefined));

const noop = (): void => undefined;

function renderOpen(openPanelId: Viewer3DPanelId) {
  return render(
    <Viewer3DPanels
      canEditWallGeometry={false}
      floorId="L-0000000000A"
      isWallEditing={false}
      onCheckWallGaps={noop}
      onDismissInspector={noop}
      onModelDropped={noop}
      onNavigateToObject={noop}
      onOpenExport={noop}
      onOpenRuleScreen={noop}
      onOpenScreen={noop}
      onTogglePanel={noop}
      onToggleWallEditing={noop}
      openPanelId={openPanelId}
      projectId="P-VIEWER3D"
      saveLabel={null}
      selectedEntityId={null}
      selectedEntityIds={[]}
    />,
  );
}

describe('[BUG-379] vỏ chờ của bảng phụ', () => {
  it.each([
    ['rooms', VIEWER_3D_ROOMS_PANEL_LABEL, 'Đang tải bảng diện tích phòng…'],
    ['furniture', VIEWER_3D_FURNITURE_PANEL_LABEL, 'Đang tải thư viện đồ đạc…'],
    ['history', VIEWER_3D_HISTORY_PANEL_LABEL, 'Đang tải lịch sử thao tác…'],
  ] as const)('bảng "%s" đang tải thì có một câu trạng thái nói tên bảng', (panelId, label, loading) => {
    renderOpen(panelId);

    // Một khung xương câm giống hệt nhau ở ba bảng thì không phân biệt được "đang tải" với "rỗng".
    expect(screen.getByRole('status')).toHaveTextContent(loading);
    expect(screen.getByRole('button', { name: label })).toHaveAttribute('aria-expanded', 'true');
  });
});
