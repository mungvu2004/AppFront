/**
 * [VO] Hai lớp phủ của `Viewer3D` — bài kiểm chứng minh chúng THẬT SỰ vẽ ra.
 *
 * Cùng lối của `Viewer3DPanels.test.tsx`: mỗi ca đòi thấy đúng phần tử mà lớp
 * phủ tự khai nhãn cho (`CollaborationLayer.tsx:82`,
 * `wallGeometryEditorTypes.ts:499`), không phải một `data-testid` do bài kiểm
 * cắm vào, và không phải chỉ "biên dịch được".
 */

import { cleanup, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { renderWithProviders } from '@/lib/testing/render';

import { Viewer3DOverlays, type Viewer3DOverlaysProps } from './Viewer3DOverlays';

/** Mã tường hợp lệ theo `domain/spatial/ids.ts`. */
const WALL_ID = 'W-0000000000A';

/** Nhãn nút mở danh sách người đang xem — `CollaborationLayer.tsx:82`. */
const ROSTER_TOGGLE_LABEL = 'Ai đang xem';
/** Nhãn vùng của lớp phủ sửa hình học — `wallGeometryEditorTypes.ts:499`. */
const WALL_EDITOR_REGION_LABEL = 'Sửa hình học tường';

let originalMatchMedia: typeof window.matchMedia;

/** Cùng bản giả khung nhìn máy để bàn của `Viewer3DPanels.test.tsx`. */
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

const noop = (): void => {
  /* không có chế độ nào để thoát trong bài kiểm này. */
};

function renderOverlays(overrides: Partial<Viewer3DOverlaysProps> = {}) {
  return renderWithProviders(
    <div className="relative h-full w-full">
      <Viewer3DOverlays
        isSectionOrthographic={false}
        isWallEditing={false}
        onExitWallEditMode={noop}
        selectedWallIds={[]}
        wallId={null}
        {...overrides}
      />
    </div>,
  );
}

/* -------------------------------------------------------------------------- */
/* [VO-1] CollaborationLayer — gắn bằng một dòng, và luôn có mặt.               */
/* -------------------------------------------------------------------------- */

describe('[VO-1] lớp phủ cộng tác', () => {
  it('có mặt ngay lượt dựng đầu, không cần bật gì', async () => {
    renderOverlays();

    await waitFor(() => {
      expect(screen.getByRole('button', { name: ROSTER_TOGGLE_LABEL })).toBeInTheDocument();
    });
  });

  it('vẫn có mặt khi chế độ sửa hình học đang bật — hai lớp phủ không loại trừ nhau', async () => {
    renderOverlays({ isWallEditing: true, selectedWallIds: [WALL_ID], wallId: WALL_ID });

    await waitFor(() => {
      expect(screen.getByRole('button', { name: ROSTER_TOGGLE_LABEL })).toBeInTheDocument();
    });
    expect(screen.getByRole('region', { name: WALL_EDITOR_REGION_LABEL })).toBeInTheDocument();
  });
});

/* -------------------------------------------------------------------------- */
/* [VO-2] WallGeometryEditor — một CHẾ ĐỘ, chỉ dựng khi chế độ bật.             */
/* -------------------------------------------------------------------------- */

describe('[VO-2] chế độ sửa hình học tường', () => {
  it('chế độ tắt thì lớp phủ KHÔNG có trong DOM, không phải chỉ bị ẩn', () => {
    renderOverlays({ selectedWallIds: [WALL_ID], wallId: WALL_ID });

    expect(screen.queryByRole('region', { name: WALL_EDITOR_REGION_LABEL })).toBeNull();
  });

  it('bật chế độ với một bức tường đang chọn thì lớp phủ thật sự hiện ra', () => {
    renderOverlays({ isWallEditing: true, selectedWallIds: [WALL_ID], wallId: WALL_ID });

    expect(
      screen.getByRole('region', { name: WALL_EDITOR_REGION_LABEL }),
    ).toBeInTheDocument();
  });

  it('bật chế độ mà chưa chọn tường nào thì lớp phủ nói ra, không để trắng (A11)', () => {
    renderOverlays({ isWallEditing: true });

    const region = screen.getByRole('region', { name: WALL_EDITOR_REGION_LABEL });
    expect(region).toBeInTheDocument();
    expect(region.textContent?.length ?? 0).toBeGreaterThan(0);
  });
});
