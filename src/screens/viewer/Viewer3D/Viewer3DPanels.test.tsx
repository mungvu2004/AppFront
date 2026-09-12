/**
 * [VP] Cột panel phụ của `Viewer3D` — bài kiểm chứng minh panel THẬT SỰ hiện ra.
 *
 * Không phải "biên dịch được": mỗi ca dưới đây dựng `Viewer3DPanels` với đúng
 * điều kiện của một panel rồi đòi thấy VÙNG của chính panel ấy trong DOM, bằng
 * nhãn mà panel tự khai (`PropertyInspector.tsx:66`,
 * `RoomAreaPanel.chrome.tsx:43`, `FurnitureLibraryPanel.tsx:74`,
 * `HistoryPanel.chrome.tsx:49`) chứ không bằng một `data-testid` do bài kiểm
 * tự cắm vào.
 *
 * `Viewer3DPanels` thuần từ props (R-70), nên không màn 3D nào phải dựng ở đây:
 * bốn container panel bên dưới tự đọc phiên và kho của chúng, và
 * `renderWithProviders` cấp đúng hai thứ ấy.
 */

import { cleanup, fireEvent, screen, waitFor } from '@testing-library/react';
import { useState } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { renderWithProviders } from '@/lib/testing/render';

import {
  Viewer3DPanels,
  VIEWER_3D_FURNITURE_PANEL_LABEL,
  VIEWER_3D_HISTORY_PANEL_LABEL,
  VIEWER_3D_INSPECTOR_LABEL,
  VIEWER_3D_ROOMS_PANEL_LABEL,
  type Viewer3DPanelId,
  type Viewer3DPanelsProps,
} from './Viewer3DPanels';

/** `window.matchMedia` thật của môi trường, trả lại nguyên vẹn sau mỗi lượt. */
let originalMatchMedia: typeof window.matchMedia;

/**
 * Khung nhìn máy để bàn cho mọi lượt kiểm — cùng khuôn giả lập đã chốt ở
 * `FurnitureLibraryPanel.test.tsx:296-314` và `ViewerShell.test.tsx:405-431`.
 *
 * jsdom KHÔNG cài `window.matchMedia`, mà `useAppShell` (qua `useBreakpoint`)
 * hỏi nó ngay lượt dựng đầu của thư viện đồ đạc. Thiếu bản giả này thì panel
 * ném lỗi và ranh giới lỗi của chính nó nuốt mất — đúng thứ ranh giới ấy sinh
 * ra để làm, nên bài kiểm sẽ thấy "Có trục trặc" chứ không thấy một lỗi.
 */
function installDesktopViewport(): void {
  originalMatchMedia = window.matchMedia;

  Object.defineProperty(window, 'matchMedia', {
    configurable: true,
    writable: true,
    value: vi.fn().mockImplementation((query: string) => ({
      matches: false,
      media: query,
      onchange: null,
      addListener: vi.fn(),
      removeListener: vi.fn(),
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      dispatchEvent: vi.fn(),
    })),
  });
}

beforeEach(() => {
  vi.stubEnv('VITE_USE_MOCK_API', 'true');
  installDesktopViewport();
});

afterEach(() => {
  cleanup();
  vi.unstubAllEnvs();

  Object.defineProperty(window, 'matchMedia', {
    configurable: true,
    writable: true,
    value: originalMatchMedia,
  });
});

/** Một mã tường hợp lệ theo `domain/spatial/ids.ts` — tiền tố `W`, thân base36. */
const WALL_ID = 'W-0000000000A';
/** Một mã tầng hợp lệ; thư viện đồ đạc lọc "Đã phát hiện" theo tầng. */
const FLOOR_ID = 'L-0000000000A';
const PROJECT_ID = 'P-VIEWER3D';

const noop = (): void => {
  /* không có màn nào ở phía bên kia trong bài kiểm này. */
};

/** Cột panel với trạng thái đóng/mở thật, đúng như container giữ nó. */
function StatefulPanels(
  overrides: Partial<Viewer3DPanelsProps> & { readonly initialPanelId?: Viewer3DPanelId | null },
) {
  const [openPanelId, setOpenPanelId] = useState<Viewer3DPanelId | null>(
    overrides.initialPanelId ?? null,
  );

  return (
    <Viewer3DPanels
      floorId={FLOOR_ID}
      onCheckWallGaps={noop}
      onDismissInspector={noop}
      onModelDropped={noop}
      onNavigateToObject={noop}
      onOpenExport={noop}
      onOpenRuleScreen={noop}
      projectId={PROJECT_ID}
      selectedEntityId={null}
      selectedEntityIds={[]}
      {...overrides}
      onTogglePanel={(panelId) => {
        setOpenPanelId(panelId);
        overrides.onTogglePanel?.(panelId);
      }}
      openPanelId={openPanelId}
    />
  );
}

function renderPanels(
  overrides: Partial<Viewer3DPanelsProps> & { readonly initialPanelId?: Viewer3DPanelId | null } = {},
) {
  return renderWithProviders(<StatefulPanels {...overrides} />);
}

/* -------------------------------------------------------------------------- */
/* [VP-1] PropertyInspector — hiện khi có đối tượng đang chọn.                  */
/* -------------------------------------------------------------------------- */

describe('[VP-1] panel thanh tra thuộc tính', () => {
  it('chưa chọn gì thì KHÔNG dựng — vỏ đã có câu "Chưa chọn đối tượng" của nó', () => {
    renderPanels();

    expect(screen.queryByRole('region', { name: VIEWER_3D_INSPECTOR_LABEL })).toBeNull();
    expect(screen.queryByRole('region', { name: 'Thanh tra đối tượng' })).toBeNull();
  });

  it('chọn một bức tường thì panel thật sự hiện ra trong DOM', async () => {
    renderPanels({ selectedEntityId: WALL_ID, selectedEntityIds: [WALL_ID] });

    expect(screen.getByRole('region', { name: VIEWER_3D_INSPECTOR_LABEL })).toBeInTheDocument();

    await waitFor(() => {
      expect(screen.getByRole('region', { name: 'Thanh tra đối tượng' })).toBeInTheDocument();
    });
  });
});

/* -------------------------------------------------------------------------- */
/* [VP-2] Ba bảng phụ — bấm nút bật thì bảng hiện ra.                           */
/* -------------------------------------------------------------------------- */

describe('[VP-2] ba bảng phụ bật/tắt được', () => {
  it('bấm "Diện tích phòng" thì bảng diện tích hiện ra', async () => {
    renderPanels();

    fireEvent.click(screen.getByRole('button', { name: VIEWER_3D_ROOMS_PANEL_LABEL }));

    await waitFor(() => {
      expect(screen.getByRole('region', { name: /diện tích phòng/i })).toBeInTheDocument();
    });
  });

  it('bấm "Thư viện đồ đạc" thì thư viện nội thất hiện ra', async () => {
    renderPanels();

    fireEvent.click(screen.getByRole('button', { name: VIEWER_3D_FURNITURE_PANEL_LABEL }));

    await waitFor(() => {
      expect(screen.getByRole('region', { name: 'Thư viện nội thất' })).toBeInTheDocument();
    });
  });

  it('bấm "Lịch sử thao tác" thì bảng lịch sử chỉnh sửa hiện ra', async () => {
    renderPanels();

    fireEvent.click(screen.getByRole('button', { name: VIEWER_3D_HISTORY_PANEL_LABEL }));

    await waitFor(() => {
      expect(screen.getByRole('region', { name: 'Lịch sử chỉnh sửa' })).toBeInTheDocument();
    });
  });

  it('mở bảng thứ hai thì bảng thứ nhất đóng lại — cột 344 chỉ chứa nổi một bảng', async () => {
    renderPanels();

    fireEvent.click(screen.getByRole('button', { name: VIEWER_3D_ROOMS_PANEL_LABEL }));
    await waitFor(() => {
      expect(screen.getByRole('region', { name: /diện tích phòng/i })).toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole('button', { name: VIEWER_3D_HISTORY_PANEL_LABEL }));

    await waitFor(() => {
      expect(screen.getByRole('region', { name: 'Lịch sử chỉnh sửa' })).toBeInTheDocument();
    });
    expect(screen.queryByRole('region', { name: /diện tích phòng/i })).toBeNull();
  });

  it('chưa biết tầng thì nút "Thư viện đồ đạc" KHÔNG được dựng (R-73, không nút chết)', () => {
    renderPanels({ floorId: null });

    expect(screen.queryByRole('button', { name: VIEWER_3D_FURNITURE_PANEL_LABEL })).toBeNull();
    expect(screen.getByRole('button', { name: VIEWER_3D_ROOMS_PANEL_LABEL })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: VIEWER_3D_HISTORY_PANEL_LABEL })).toBeInTheDocument();
  });
});

/* -------------------------------------------------------------------------- */
/* [VP-3] A12 — Esc đóng bảng đang mở.                                         */
/* -------------------------------------------------------------------------- */

describe('[VP-3] A12 — Esc đóng lớp trên cùng', () => {
  it('Esc đóng bảng phụ đang mở', async () => {
    const onTogglePanel = vi.fn();
    renderPanels({ initialPanelId: 'history', onTogglePanel });

    await waitFor(() => {
      expect(screen.getByRole('region', { name: 'Lịch sử chỉnh sửa' })).toBeInTheDocument();
    });

    fireEvent.keyDown(window, { key: 'Escape' });

    expect(onTogglePanel).toHaveBeenCalledWith(null);
    await waitFor(() => {
      expect(screen.queryByRole('region', { name: 'Lịch sử chỉnh sửa' })).toBeNull();
    });
  });

  it('không bảng nào mở thì Esc KHÔNG bị cột panel nuốt mất', () => {
    const onTogglePanel = vi.fn();
    renderPanels({ onTogglePanel });

    fireEvent.keyDown(window, { key: 'Escape' });

    expect(onTogglePanel).not.toHaveBeenCalled();
  });
});
