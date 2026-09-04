/**
 * Lượt kiểm của VỎ CHUNG chín màn 3D, ĐÃ RÁP.
 *
 * Bốn bộ khẳng định dùng chung (`expectSevenStates`, `expectAccessible`,
 * `expectVietnamese`, `expectNoRawColor`) cộng sáu phép đo mà chỉ vỏ đã ráp mới
 * trả lời được:
 *
 * | mã | đo cái gì | ngưỡng |
 * |---|---|---|
 * | `[VS-1]` | bảy trạng thái của A11, không trạng thái nào ra màn trắng | 7/7 |
 * | `[VS-2]` | vai Người xem GỠ công cụ sửa khỏi ray, không làm mờ | 6 → 5 nút |
 * | `[VS-3]` | `separation = 0` trả lại ĐÚNG cao độ thật của cả bốn tầng | 0 mm sai lệch |
 * | `[VS-4]` | mặt phẳng cắt: nóc bị cắt, nền không | 2/2 |
 * | `[VS-5]` | bộ mẫu cộng lại đúng con số A14 | 248,60 m², 14 phòng, 4 tầng |
 * | `[VS-6]` | chip hiệu năng chỉ hiện khi cờ nhà phát triển bật | có/không |
 *
 * Mọi con số ấy được IN RA khi chạy, vì một bản nghiệm thu cần con số thật chứ
 * không chỉ một lời khẳng định đã xanh.
 *
 * ## Vì sao bài kiểm này dựng CONTAINER
 *
 * Cùng lý lẽ file story: kịch bản mang NGUYÊN LIỆU đồ thị, và mọi con số
 * ("4 tầng · 14 phòng · 248,60 m²") là KẾT QUẢ của `useViewerShell` cộng
 * `src/domain/rooms/area`. Dựng props bằng tay ở đây nghĩa là tự gõ lại đúng
 * những con số đang cần chứng minh — một bài kiểm như vậy không kiểm gì cả.
 * Nên bảy trạng thái đi qua {@link scenarioArgsFor} của file story, tức CÙNG
 * cổng giả và CÙNG bộ mẫu (R-70).
 */

import { act, cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { REDUCED_MOTION_QUERY } from '@/lib/motion';
import { expectAccessible } from '@/lib/testing/expectAccessible';
import { expectNoRawColor } from '@/lib/testing/expectNoRawColor';
import { expectSevenStates } from '@/lib/testing/expectSevenStates';
import { expectVietnamese } from '@/lib/testing/expectVietnamese';
import { createTestQueryClient } from '@/lib/testing/render';
import {
  createSevenStateScenarios,
  SEVEN_STATES,
  SEVEN_STATE_LABELS,
} from '@/lib/testing/sevenStateScenarios';

import { ViewerShellContainer } from './ViewerShell.container';
import { VIEWER_SHELL_LABEL } from './ViewerShell';
import { scenarioArgsFor } from './ViewerShell.stories';
import {
  FIXTURE_ROOM_COUNT,
  FIXTURE_STOREY_COUNT,
  FIXTURE_TOTAL_AREA_M2,
  VIEWER_FIXTURE_LEVELS,
  VIEWER_FIXTURE_ROOMS,
} from './viewerShellFixture';
import { shellDataOf, VIEWER_FIXTURE_SPATIAL } from './viewerShellGateway';
import { VIEWER_SCREEN_STATES } from './viewerShellScenarios';
import { ALL_VIEWER_TOOLS } from './useViewerShell';
import {
  VIEWER_LAYOUT,
  type ViewerSceneActions,
  type ViewerSceneFrame,
  type ViewerScreenState,
} from './viewerShellTypes';
import { isClipped, sectionPlaneFor } from './viewerSectionPlane';
import { stackStoreys, storeySpreadMm, type StackableStorey } from './viewerStoreyStack';

/* -------------------------------------------------------------------------- */
/* Bộ dựng.                                                                    */
/* -------------------------------------------------------------------------- */

function renderState(state: ViewerScreenState) {
  return render(
    <QueryClientProvider client={createTestQueryClient()}>
      <MemoryRouter>
        <ViewerShellContainer {...scenarioArgsFor(state)} />
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

afterEach(() => {
  cleanup();
});

/* -------------------------------------------------------------------------- */
/* [VS-1] Bảy trạng thái của A11.                                              */
/* -------------------------------------------------------------------------- */

describe('[VS-1] bảy trạng thái', () => {
  it('đi qua expectSevenStates, và không trạng thái nào ra màn trắng', () => {
    let rendered = 0;

    expectSevenStates((scenario) => {
      const { container, unmount } = renderState(scenario.state as ViewerScreenState);
      rendered += 1;

      return { container, unmount };
    }, createSevenStateScenarios());

    console.log(`[VIEWER-SHELL][VS-1] expectSevenStates = ${rendered}/${SEVEN_STATES.length}`);

    expect(rendered).toBe(SEVEN_STATES.length);
    expect(rendered).toBe(7);
  });

  it('mỗi trạng thái vẫn còn vỏ màn, khung nhìn và thanh trạng thái', () => {
    for (const state of VIEWER_SCREEN_STATES) {
      const { unmount } = renderState(state);

      expect(
        screen.getByRole('region', { name: VIEWER_SHELL_LABEL }),
        `trạng thái ${SEVEN_STATE_LABELS[state]} mất vỏ màn`,
      ).toBeInTheDocument();
      expect(screen.getByRole('main', { name: 'Khung nhìn mô hình' })).toBeInTheDocument();
      expect(screen.getByRole('contentinfo', { name: 'Thanh trạng thái' })).toBeInTheDocument();

      unmount();
    }
  });

  it('bảng bảy trạng thái của vỏ khớp bảng của src/lib/testing', () => {
    expect([...VIEWER_SCREEN_STATES]).toEqual([...SEVEN_STATES]);
  });
});

/* -------------------------------------------------------------------------- */
/* [VS-2] Vai Người xem gỡ công cụ sửa khỏi ray.                               */
/* -------------------------------------------------------------------------- */

describe('[VS-2] vai Người xem', () => {
  it('gỡ công cụ sửa khỏi ray thay vì làm mờ nó', () => {
    const editingTools = ALL_VIEWER_TOOLS.filter((tool) => tool.requiresEdit);
    expect(editingTools.length).toBeGreaterThan(0);

    const { unmount } = renderState('success');
    const fullRail = within(screen.getByRole('toolbar', { name: 'Công cụ khung nhìn' }));
    const fullCount = fullRail.getAllByRole('button').length;
    unmount();

    renderState('forbidden');
    const viewerRail = within(screen.getByRole('toolbar', { name: 'Công cụ khung nhìn' }));
    const viewerButtons = viewerRail.getAllByRole('button');

    console.log(
      `[VIEWER-SHELL][VS-2] ray công cụ: kỹ sư ${fullCount} nút → Người xem ${viewerButtons.length} nút`,
    );

    expect(viewerButtons.length).toBe(fullCount - editingTools.length);

    /* GỠ, không phải làm mờ: không nút nào còn lại bị vô hiệu hoá, và tên công
       cụ sửa không còn xuất hiện ở bất kỳ đâu trên ray. */
    for (const button of viewerButtons) {
      expect(button).not.toBeDisabled();
    }

    for (const tool of editingTools) {
      expect(viewerRail.queryByLabelText(new RegExp(tool.label, 'i'))).toBeNull();
    }
  });
});

/* -------------------------------------------------------------------------- */
/* [VS-3] Độ tách: 0 trả lại đúng cao độ thật.                                 */
/* -------------------------------------------------------------------------- */

describe('[VS-3] xếp tầng và độ tách', () => {
  const storeys: readonly StackableStorey[] = VIEWER_FIXTURE_LEVELS.map((level) => ({
    id: level.id,
    order: level.order,
    elevationMm: level.elevationMm,
    heightMm: level.heightMm,
  }));

  it('separation = 0 không xê dịch tầng nào một milimét', () => {
    const drift = storeys.map((storey) => storeySpreadMm(storey, 0));

    console.log(`[VIEWER-SHELL][VS-3] sai lệch ở độ tách 0 = [${drift.join(', ')}] mm`);

    expect(drift).toEqual(storeys.map(() => 0));
  });

  it('tầng dưới cùng không bao giờ rời mặt đất, tầng trên tách theo thứ tự', () => {
    const stacked = stackStoreys(storeys, 1);

    expect(stacked[0]?.spreadM).toBe(0);

    for (let index = 1; index < stacked.length; index += 1) {
      const previous = stacked[index - 1];
      const current = stacked[index];

      expect(current?.spreadM ?? 0).toBeGreaterThan(previous?.spreadM ?? 0);
      expect(current?.offsetM ?? 0).toBeGreaterThan(previous?.offsetM ?? 0);
    }
  });
});

/* -------------------------------------------------------------------------- */
/* [VS-4] Mặt phẳng cắt.                                                       */
/* -------------------------------------------------------------------------- */

describe('[VS-4] mặt phẳng cắt', () => {
  const bounds = { minX: 0, minY: 0, minZ: 0, maxX: 10, maxY: 12, maxZ: 10 };

  it('cắt ngang ở giữa thì bỏ phần trên và giữ phần dưới', () => {
    const plane = sectionPlaneFor(bounds, 'horizontal', 0.5);

    const roofClipped = isClipped(plane, 5, bounds.maxY, 5);
    const floorKept = !isClipped(plane, 5, bounds.minY, 5);

    console.log(
      `[VIEWER-SHELL][VS-4] nóc bị cắt = ${String(roofClipped)}, nền được giữ = ${String(floorKept)}`,
    );

    expect(roofClipped).toBe(true);
    expect(floorKept).toBe(true);
  });

  it('vị trí ở hai đầu thanh trượt bám đúng hai đầu hộp bao', () => {
    expect(sectionPlaneFor(bounds, 'horizontal', 0).constant).toBe(-bounds.minY);
    expect(sectionPlaneFor(bounds, 'horizontal', 1).constant).toBe(-bounds.maxY);
  });
});

/* -------------------------------------------------------------------------- */
/* [VS-5] Bộ mẫu cộng lại đúng con số A14.                                     */
/* -------------------------------------------------------------------------- */

describe('[VS-5] bộ mẫu', () => {
  it('4 tầng · 14 phòng · 248,60 m², đo lại từ chính đồ thị', () => {
    const data = shellDataOf(VIEWER_FIXTURE_SPATIAL);

    console.log(
      `[VIEWER-SHELL][VS-5] ${data.storeys.length} tầng · ${data.roomCount} phòng · ${data.totalAreaM2} m²`,
    );

    expect(data.storeys.length).toBe(FIXTURE_STOREY_COUNT);
    expect(data.roomCount).toBe(FIXTURE_ROOM_COUNT);
    expect(data.roomCount).toBe(VIEWER_FIXTURE_ROOMS.length);
    expect(data.totalAreaM2).toBeCloseTo(FIXTURE_TOTAL_AREA_M2, 2);
  });

  it('thanh trạng thái in ra chính ba con số ấy, dấu thập phân là dấu phẩy', () => {
    renderState('success');

    const statusBar = screen.getByRole('contentinfo', { name: 'Thanh trạng thái' });

    expect(statusBar).toHaveTextContent('4 tầng');
    expect(statusBar).toHaveTextContent('14 phòng');
    expect(statusBar).toHaveTextContent('248,60');
    expect(statusBar).toHaveTextContent('58 fps');
  });
});

/* -------------------------------------------------------------------------- */
/* [VS-6] Chip hiệu năng chỉ hiện khi cờ nhà phát triển bật.                   */
/* -------------------------------------------------------------------------- */

describe('[VS-6] chip hiệu năng', () => {
  it('hiện số tam giác khi cờ bật, và biến mất khi cờ tắt', () => {
    const { unmount } = render(
      <QueryClientProvider client={createTestQueryClient()}>
        <MemoryRouter>
          <ViewerShellContainer {...scenarioArgsFor('success')} isDev />
        </MemoryRouter>
      </QueryClientProvider>,
    );

    const withFlag = screen.getByText(/tam giác/);
    console.log(`[VIEWER-SHELL][VS-6] cờ bật → "${withFlag.textContent ?? ''}"`);
    expect(withFlag).toBeInTheDocument();
    unmount();

    render(
      <QueryClientProvider client={createTestQueryClient()}>
        <MemoryRouter>
          <ViewerShellContainer {...scenarioArgsFor('success')} isDev={false} />
        </MemoryRouter>
      </QueryClientProvider>,
    );

    console.log('[VIEWER-SHELL][VS-6] cờ tắt → không có chip nào');
    expect(screen.queryByText(/tam giác/)).toBeNull();
  });
});

/* -------------------------------------------------------------------------- */
/* [VS-7] Setter vị trí mặt phẳng cắt — V7.A.                                  */
/* -------------------------------------------------------------------------- */

describe('[VS-7] setter vị trí mặt phẳng cắt', () => {
  it('sceneActions.setSectionPosition đổi frame.sectionPlane, và luôn kẹp về [0, 1] qua clampSectionPosition', () => {
    const captured: {
      frame: ViewerSceneFrame | null;
      actions: ViewerSceneActions | undefined;
    } = { frame: null, actions: undefined };

    const { unmount } = render(
      <QueryClientProvider client={createTestQueryClient()}>
        <MemoryRouter>
          <ViewerShellContainer
            {...scenarioArgsFor('success')}
            renderScene={(frame: ViewerSceneFrame, actions?: ViewerSceneActions): null => {
              captured.frame = frame;
              captured.actions = actions;
              return null;
            }}
          />
        </MemoryRouter>
      </QueryClientProvider>,
    );

    expect(typeof captured.actions?.setSectionPosition).toBe('function');

    // Chưa bật công cụ "mặt cắt" — vỏ không đưa mặt phẳng cắt nào.
    expect(captured.frame?.sectionPlane).toBeNull();

    const toolRail = within(screen.getByRole('toolbar', { name: 'Công cụ khung nhìn' }));
    fireEvent.click(toolRail.getByRole('button', { name: /mặt cắt/i }));
    expect(captured.frame?.sectionPlane).not.toBeNull();

    act(() => {
      captured.actions?.setSectionPosition?.(0);
    });
    const atStart = captured.frame?.sectionPlane;

    act(() => {
      captured.actions?.setSectionPosition?.(1);
    });
    const atEnd = captured.frame?.sectionPlane;

    console.log(
      `[VIEWER-SHELL][VS-7] constant tại vị trí 0 = ${String(atStart?.constant)}, tại vị trí 1 = ${String(atEnd?.constant)}`,
    );

    expect(atStart?.constant).not.toBe(atEnd?.constant);

    act(() => {
      // Ngoài [0, 1] — clampSectionPosition phải kẹp về đúng như vị trí 1.
      captured.actions?.setSectionPosition?.(5);
    });
    expect(captured.frame?.sectionPlane?.constant).toBe(atEnd?.constant);

    act(() => {
      // Ngoài [0, 1] phía dưới — kẹp về đúng như vị trí 0.
      captured.actions?.setSectionPosition?.(-3);
    });
    expect(captured.frame?.sectionPlane?.constant).toBe(atStart?.constant);

    unmount();
  });
});

/* -------------------------------------------------------------------------- */
/* [VS-8] Panel phải trượt vào — V7.B.                                        */
/* -------------------------------------------------------------------------- */

describe('[VS-8] panel phải trượt vào', () => {
  it('lúc thu gọn: panel vẫn nằm trong DOM, chỉ biến mất khỏi cây tiếp cận, width/opacity kẹp về 0', () => {
    const { unmount } = renderState('collapsed');

    const hiddenAside = screen.getByRole('complementary', {
      hidden: true,
      name: 'Thanh tra đối tượng',
    });

    // Không dùng `getByRole` mặc định (loại phần tử ẩn) tìm thấy nó — đúng
    // nghĩa "thu gọn" với trình đọc màn hình.
    expect(screen.queryByRole('complementary', { name: 'Thanh tra đối tượng' })).toBeNull();

    const wrapper = hiddenAside.parentElement as HTMLElement;

    expect(wrapper).toHaveAttribute('aria-hidden', 'true');
    expect(wrapper.style.width).toBe('0px');
    expect(wrapper.className).toContain('opacity-0');

    console.log(
      `[VIEWER-SHELL][VS-8] thu gọn → width=${wrapper.style.width}, aria-hidden=${wrapper.getAttribute('aria-hidden') ?? ''}`,
    );

    unmount();
  });

  it(`lúc mở: panel rộng đúng ${String(VIEWER_LAYOUT.inspectorPx)}px và dùng thang chuyển động chuẩn`, () => {
    const { unmount } = renderState('success');

    const openAside = screen.getByRole('complementary', { name: 'Thanh tra đối tượng' });
    const wrapper = openAside.parentElement as HTMLElement;

    expect(wrapper).not.toHaveAttribute('aria-hidden', 'true');
    expect(wrapper.style.width).toBe(`${String(VIEWER_LAYOUT.inspectorPx)}px`);
    expect(wrapper.className).toContain('duration-standard');
    expect(wrapper.className).not.toContain('transition-none');

    console.log(
      `[VIEWER-SHELL][VS-8] mở → width=${wrapper.style.width}, class="${wrapper.className}"`,
    );

    unmount();
  });

  describe('giảm chuyển động', () => {
    let originalMatchMedia: typeof window.matchMedia;

    beforeEach(() => {
      originalMatchMedia = window.matchMedia;
      Object.defineProperty(window, 'matchMedia', {
        configurable: true,
        writable: true,
        value: vi.fn().mockImplementation((query: string) => ({
          matches: query === REDUCED_MOTION_QUERY,
          media: query,
          onchange: null,
          addListener: vi.fn(),
          removeListener: vi.fn(),
          addEventListener: vi.fn(),
          removeEventListener: vi.fn(),
          dispatchEvent: vi.fn(),
        })),
      });
    });

    afterEach(() => {
      Object.defineProperty(window, 'matchMedia', {
        configurable: true,
        writable: true,
        value: originalMatchMedia,
      });
    });

    it('tắt hẳn transition thay vì chỉ chạy nhanh hơn, khi frame.reducedMotion true', () => {
      const { unmount } = renderState('success');

      const openAside = screen.getByRole('complementary', { name: 'Thanh tra đối tượng' });
      const wrapper = openAside.parentElement as HTMLElement;

      console.log(`[VIEWER-SHELL][VS-8] giảm chuyển động → class="${wrapper.className}"`);

      expect(wrapper.className).toContain('transition-none');
      expect(wrapper.className).not.toContain('duration-standard');

      unmount();
    });
  });
});

/* -------------------------------------------------------------------------- */
/* R-72: khả năng tiếp cận và tiếng Việt, trên cả bảy trạng thái.              */
/* -------------------------------------------------------------------------- */

describe('R-72 — expectAccessible và expectVietnamese', () => {
  it('bảy trạng thái đều qua expectAccessible', () => {
    for (const state of VIEWER_SCREEN_STATES) {
      const { container, unmount } = renderState(state);

      expectAccessible(container);

      unmount();
    }
  });

  it('bảy trạng thái đều qua expectVietnamese', () => {
    for (const state of VIEWER_SCREEN_STATES) {
      const { container, unmount } = renderState(state);

      expectVietnamese(container);

      unmount();
    }
  });

  it('không mã màu thô trong toàn thư mục màn (A1)', () => {
    expectNoRawColor('src/screens/viewer/ViewerShell');
  });
});
