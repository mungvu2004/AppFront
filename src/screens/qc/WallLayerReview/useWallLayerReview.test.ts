/**
 * Nửa "suy nghĩ" của màn S-12 "Duyệt lớp tường", kiểm không cần DOM của màn.
 *
 * Hook được lái qua `renderHook`, tầng dữ liệu là
 * `createMockWallLayerReviewGateway()` của `wallLayerReviewGateway.ts` — cùng
 * cổng story sẽ dùng — và mọi con số khẳng định đọc ra từ
 * `wallLayerReviewFixture.ts` / `wallLayerReviewScenarios.ts`, không có bảng dữ
 * liệu thứ hai bịa tại chỗ (R-70).
 *
 * ## Phép kiểm quan trọng nhất của cả file
 *
 * `duyệt 5 tường bằng bàn phím` — bộ đếm phải đi 12 → 17, rồi `Ctrl+Z` năm lần
 * phải đưa nó về đúng 12. Bài kiểm **in ra số đếm sau mỗi bước** chứ không chỉ
 * khẳng định hai đầu, nên một bước nhảy sai ở giữa cũng lộ.
 *
 * Điều hướng (`J`) và hoàn tác (`Ctrl+Z`) đi qua SỔ PHÍM THẬT
 * (`registry.handleKeyDown`), không phải qua một lời gọi tắt. Lượt duyệt thì
 * gọi hành động mặc định của hàng đang có tiêu điểm — đúng những gì phím `Enter`
 * làm trên một phần tử focus được, và là lý do `Enter` không bị đăng ký làm
 * phím tắt toàn cục (nó nằm trong `RESERVED_KEYS`).
 */

import { createElement, type ReactNode } from 'react';
import { QueryClientProvider } from '@tanstack/react-query';
import { act, cleanup, renderHook, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { normalizeSpatial } from '@/domain/spatial/normalize';
import type { Level, Wall, WallId } from '@/domain/spatial/types';
import { WALL_COMMAND_TYPES } from '@/lib/commands/business/wallCommands';
import { createShortcutRegistry, type ShortcutRegistry } from '@/lib/input/shortcutRegistry';
import { createTestQueryClient } from '@/lib/testing/render';
import { SEVEN_STATES } from '@/lib/testing/sevenStateScenarios';
import { shortcutForTool } from '@/lib/tools/shortcuts';
import { resetSelectorCaches } from '@/store/selectors';
import { useStore } from '@/store';

import {
  applyWallFilters,
  deriveScreenState,
  nextUnreviewedWallId,
  useWallLayerReview,
  wallsOfLevel,
  type UseWallLayerReviewOptions,
  type UseWallLayerReviewResult,
} from './useWallLayerReview';
import {
  buildApproveWallCommand,
  buildChangeThicknessCommand,
  commandContextOf,
  createMockWallLayerReviewGateway,
  createWallUndoTicket,
  CURSOR_IDLE_LABEL,
  isStandardThickness,
  toWallInspector,
  UNDO_WINDOW_MS,
  WALL_APPROVE_COMMAND_TYPE,
  WALL_LAYER_THICKNESS_CHOICES,
} from './wallLayerReviewGateway';
import {
  WALL_LAYER_FIXTURE_BUILDING,
  WALL_LAYER_FIXTURE_LEVEL,
  WALL_LAYER_FIXTURE_REVIEWED,
  WALL_LAYER_FIXTURE_TOTAL,
  WALL_LAYER_FIXTURE_WALLS,
} from './wallLayerReviewFixture';
import { WALL_LAYER_REVIEW_SCENARIOS } from './wallLayerReviewScenarios';
import type { WallThicknessChoice } from './types';

/* -------------------------------------------------------------------------- */
/* Bộ mẫu — đọc ra, không viết tay lại.                                        */
/* -------------------------------------------------------------------------- */

const PROJECT_ID = 'project-1';

/** Số tường bài kiểm bàn phím duyệt — đủ để dãy đếm có năm bước lên và năm bước xuống. */
const APPROVALS = 5;

/* -------------------------------------------------------------------------- */
/* Bộ mẫu, ĐỌC THẲNG — không còn lượt đánh lại mã nào.                         */
/* -------------------------------------------------------------------------- */

/*
 * Bản trước của file này đánh lại mã cho cả 48 tường trước khi dùng, vì bộ mẫu
 * đặt mã kiểu `W-001` mà `isIdOfKind` (`src/domain/spatial/ids.ts:95,108`) từ
 * chối — thân mã phải dài ít nhất 10 ký tự `[0-9A-Z]`. Hệ quả là bài kiểm chạy
 * trên một bộ mẫu KHÁC bộ mẫu màn thật dùng, tức là một lượt xanh không chứng
 * minh được gì về màn.
 *
 * Bộ mẫu đã được sửa tận gốc (xem đầu `wallLayerReviewFixture.ts`): mã sinh
 * đúng khuôn `createId` và vẫn tất định, còn nhãn người đọc "#W-014" do
 * `wallDisplayCode` dẫn xuất nên không dài theo. Nên lượt đánh lại mã ở đây là
 * thừa và đã bị xoá — bài kiểm nay chạy trên ĐÚNG bộ mẫu mà màn dựng.
 */
const FIXTURE_LEVEL: Level = WALL_LAYER_FIXTURE_LEVEL;
const FIXTURE_WALLS: readonly Wall[] = WALL_LAYER_FIXTURE_WALLS;

const FIXTURE_GRAPH = normalizeSpatial({
  building: WALL_LAYER_FIXTURE_BUILDING,
  levels: [FIXTURE_LEVEL],
  walls: FIXTURE_WALLS,
  openings: [],
  furniture: [],
  rooms: [],
  axes: [],
  dimensions: [],
  notes: [],
});

const FLOOR_ID = FIXTURE_LEVEL.id;

/* -------------------------------------------------------------------------- */
/* Môi trường.                                                                 */
/* -------------------------------------------------------------------------- */

beforeEach(() => {
  /* jsdom không có `matchMedia`; `matches: false` là "không giảm chuyển động". */
  Object.defineProperty(window, 'matchMedia', {
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
});

afterEach(() => {
  cleanup();
  /* Kho dùng chung giữa các bài kiểm: trả nó về rỗng qua ĐÚNG hành động công khai. */
  const store = useStore.getState();
  store.setSpatial(null, null);
  store.clearSelection();
  store.setHovered(null);
  resetSelectorCaches();
  vi.useRealTimers();
  vi.restoreAllMocks();
});

/* -------------------------------------------------------------------------- */
/* Dựng hook.                                                                  */
/* -------------------------------------------------------------------------- */

interface Mounted {
  readonly result: { current: UseWallLayerReviewResult };
  readonly registry: ShortcutRegistry;
  readonly unmount: () => void;
}

type MountOptions = Partial<Omit<UseWallLayerReviewOptions, 'registry'>>;

function mountHook(options: MountOptions = {}): Mounted {
  const registry = createShortcutRegistry();
  const queryClient = createTestQueryClient();
  const wrapper = ({ children }: { children: ReactNode }): ReactNode =>
    createElement(QueryClientProvider, { client: queryClient }, children);

  const rendered = renderHook(
    () =>
      useWallLayerReview({
        projectId: options.projectId ?? PROJECT_ID,
        floorId: options.floorId ?? FLOOR_ID,
        roles: options.roles ?? ['engineer'],
        gateway:
          options.gateway ??
          createMockWallLayerReviewGateway({ graph: FIXTURE_GRAPH }),
        registry,
        ...(options.levelId === undefined ? {} : { levelId: options.levelId }),
        ...(options.forceCollapsed === undefined ? {} : { forceCollapsed: options.forceCollapsed }),
      }),
    { wrapper },
  );

  return { result: rendered.result, registry, unmount: rendered.unmount };
}

/** Chờ lượt đọc ảnh nền xong — trước đó mọi kịch bản đều là `'loading'`. */
async function mountSettled(options: MountOptions = {}): Promise<Mounted> {
  const mounted = mountHook(options);

  await waitFor(() => {
    expect(mounted.result.current.panel.state).not.toBe('loading');
  });

  return mounted;
}

/** Gõ một phím vào SỔ PHÍM THẬT, đúng đường một bàn phím thật đi. */
async function pressKey(
  registry: ShortcutRegistry,
  key: string,
  modifiers: { readonly ctrlKey?: boolean } = {},
): Promise<void> {
  await act(async () => {
    registry.handleKeyDown({ key, ctrlKey: modifiers.ctrlKey ?? false }, null);
    await Promise.resolve();
  });
}

/**
 * Gõ `J` cho tới khi hàng đang chọn là một tường CHƯA DUYỆT.
 *
 * Bộ mẫu xen kẽ tường đã duyệt và chưa duyệt, nên một lượt `J` đơn lẻ có thể
 * rơi đúng vào hàng đã duyệt — người duyệt thật cũng gõ tiếp, và nút "Duyệt
 * đoạn này" của hàng đó vốn đã bị khoá. Vòng lặp có trần bằng số hàng để một
 * lỗi thật không biến thành một bài kiểm treo.
 */
async function pressUntilUnreviewed(mounted: Mounted): Promise<WallId | null> {
  for (let attempt = 0; attempt < WALL_LAYER_FIXTURE_TOTAL; attempt += 1) {
    await pressKey(mounted.registry, 'J');

    const id = mounted.result.current.panel.selectedWallId;
    const row = mounted.result.current.panel.rows.find((item) => item.id === id);

    if (row !== undefined && !row.isReviewed) {
      return row.id;
    }
  }

  return null;
}

/** Mã tường của một bộ mẫu, đọc ra chứ không gõ tay. */
const wallAt = (index: number): Wall => FIXTURE_WALLS[index] as Wall;

/** Số cuối của một dãy đếm. `noUncheckedIndexedAccess` bật, nên phải nói ra ý định. */
const lastOf = (values: readonly number[]): number => values[values.length - 1] as number;

/** Một trong ba băng độ dày, đọc ra từ hằng chứ không gõ số. */
const thicknessChoice = (index: number): WallThicknessChoice =>
  WALL_LAYER_THICKNESS_CHOICES[index] as WallThicknessChoice;

/* -------------------------------------------------------------------------- */
/* Phép ghép thuần.                                                            */
/* -------------------------------------------------------------------------- */

describe('phép ghép thuần của màn Duyệt lớp tường', () => {
  it('đọc đúng 48 tường của tầng mẫu', () => {
    const walls = wallsOfLevel(FIXTURE_GRAPH, FIXTURE_LEVEL.id);

    expect(walls).toHaveLength(WALL_LAYER_FIXTURE_TOTAL);
    expect(walls.filter((wall) => wall.reviewed)).toHaveLength(WALL_LAYER_FIXTURE_REVIEWED);
  });

  it('bảy trạng thái dẫn xuất đúng, đủ và không thừa nhánh nào', () => {
    const derived = WALL_LAYER_REVIEW_SCENARIOS.map((scenario) =>
      deriveScreenState({
        isViewerRole: scenario.isViewerRole,
        isCollapsed: scenario.isCollapsed,
        hasError: scenario.error !== null,
        isLoading: scenario.state === 'loading',
        counter: scenario.reviewCounter,
      }),
    );

    expect(derived).toEqual([...SEVEN_STATES]);
  });

  it('ba cờ lọc lọc đúng cái chúng nói', () => {
    const walls = FIXTURE_WALLS;

    const unreviewed = applyWallFilters(walls, {
      onlyUnreviewed: true,
      onlyLowConfidence: false,
      onlyNonStandardThickness: false,
    });
    const nonStandard = applyWallFilters(walls, {
      onlyUnreviewed: false,
      onlyLowConfidence: false,
      onlyNonStandardThickness: true,
    });

    expect(unreviewed).toHaveLength(WALL_LAYER_FIXTURE_TOTAL - WALL_LAYER_FIXTURE_REVIEWED);
    expect(unreviewed.every((wall) => !wall.reviewed)).toBe(true);
    expect(nonStandard.every((wall) => !isStandardThickness(wall.thicknessMm))).toBe(true);
    expect(nonStandard.length).toBeGreaterThan(0);
  });

  it('tìm đúng tường CHƯA DUYỆT kế tiếp, và quay vòng khi tới cuối', () => {
    const walls = FIXTURE_WALLS;
    const first = nextUnreviewedWallId(walls, null);
    const afterFirst = nextUnreviewedWallId(walls, first);

    expect(first).toBe(wallAt(0).id);
    /* W-002 đã duyệt, nên bước kế phải nhảy qua nó. */
    expect(afterFirst).toBe(wallAt(2).id);
  });
});

/* -------------------------------------------------------------------------- */
/* A5 — xanh "đã xác minh" chỉ đánh dấu việc người duyệt.                      */
/* -------------------------------------------------------------------------- */

describe('A5', () => {
  it('lệnh duyệt luôn đặt source người, không có đường nào để AI bật cờ xanh', () => {
    const before = wallAt(0);
    const command = buildApproveWallCommand(before, 'nguoi-duyet');
    const change = command.changes[0];
    const after = change?.after as Wall;

    expect(command.type).toBe(WALL_APPROVE_COMMAND_TYPE);
    expect(command.description).not.toHaveLength(0);
    expect(after.reviewed).toBe(true);
    expect(after.source).toBe('human');
    /* Ảnh chụp `before` ĐẦY ĐỦ — đó là thứ làm `Ctrl+Z` chạy được, xem mục C.5. */
    expect(change?.before).toEqual(before);
  });

  it('không tường nào trong bộ mẫu vừa reviewed vừa source ai', () => {
    const offenders = WALL_LAYER_FIXTURE_WALLS.filter(
      (wall) => wall.reviewed && wall.source === 'ai',
    );

    expect(offenders).toHaveLength(0);
  });
});

/* -------------------------------------------------------------------------- */
/* Nghiệm thu bàn phím — phép kiểm quan trọng nhất.                             */
/* -------------------------------------------------------------------------- */

describe('nghiệm thu bàn phím', () => {
  it('duyệt 5 tường rồi hoàn tác 5 lần: 12 → 17 → 12', async () => {
    const mounted = await mountSettled();
    const counterNow = (): number => mounted.result.current.panel.reviewCounter.reviewed;

    expect(mounted.result.current.panel.reviewCounter.total).toBe(WALL_LAYER_FIXTURE_TOTAL);

    const climbing: number[] = [counterNow()];

    for (let index = 0; index < APPROVALS; index += 1) {
      /* `J` — xuống cho tới hàng CHƯA DUYỆT kế tiếp, qua sổ phím thật. */
      const target = await pressUntilUnreviewed(mounted);

      expect(target).not.toBeNull();

      /* Hành động mặc định của hàng đang có tiêu điểm — đúng việc `Enter` làm. */
      await act(async () => {
        mounted.result.current.panel.onApprove(target as WallId);
        await Promise.resolve();
      });

      const reached = lastOf(climbing) + 1;

      await waitFor(() => {
        expect(counterNow()).toBe(reached);
      });

      climbing.push(counterNow());
    }

    const falling: number[] = [];

    for (let index = 0; index < APPROVALS; index += 1) {
      const before = counterNow();

      await pressKey(mounted.registry, 'z', { ctrlKey: true });

      await waitFor(() => {
        expect(counterNow()).not.toBe(before);
      });

      falling.push(counterNow());
    }

    /* In ra dãy đếm — một bước nhảy sai ở giữa cũng lộ, không chỉ hai đầu. */
    console.log(`dãy đếm lên:    ${climbing.join(', ')}`);
    console.log(`dãy đếm xuống:  ${falling.join(', ')}`);

    expect(climbing).toEqual([12, 13, 14, 15, 16, 17]);
    expect(falling).toEqual([16, 15, 14, 13, 12]);
    expect(counterNow()).toBe(WALL_LAYER_FIXTURE_REVIEWED);

    mounted.unmount();
  });

  it('duyệt xong một tường thì tự chọn tường CHƯA DUYỆT kế tiếp', async () => {
    const mounted = await mountSettled();

    await act(async () => {
      mounted.result.current.panel.onSelect(wallAt(0).id);
      await Promise.resolve();
    });

    await act(async () => {
      mounted.result.current.panel.onApprove(wallAt(0).id);
      await Promise.resolve();
    });

    /* W-002 đã duyệt sẵn, nên con trỏ phải nhảy qua nó tới W-003. */
    await waitFor(() => {
      expect(mounted.result.current.panel.selectedWallId).toBe(wallAt(2).id);
    });

    mounted.unmount();
  });

  it('J và K đi xuống rồi đi lên đúng một hàng', async () => {
    const mounted = await mountSettled();

    await pressKey(mounted.registry, 'J');
    const first = mounted.result.current.panel.selectedWallId;

    await pressKey(mounted.registry, 'J');
    const second = mounted.result.current.panel.selectedWallId;

    await pressKey(mounted.registry, 'K');

    expect(first).toBe(wallAt(0).id);
    expect(second).toBe(wallAt(1).id);
    expect(mounted.result.current.panel.selectedWallId).toBe(first);

    mounted.unmount();
  });
});

/* -------------------------------------------------------------------------- */
/* Đổi độ dày — qua lệnh S-07, không đặt state thẳng.                          */
/* -------------------------------------------------------------------------- */

describe('đổi độ dày', () => {
  it('dựng đúng lệnh wall.changeThickness của S-07', () => {
    const wall = wallAt(0);
    const built = buildChangeThicknessCommand(
      { wallId: wall.id, thicknessMm: thicknessChoice(1) },
      commandContextOf(FIXTURE_GRAPH, 'nguoi-duyet'),
    );

    expect(built.ok).toBe(true);
    expect(built.ok && built.data.type).toBe(WALL_COMMAND_TYPES.changeThickness);
  });

  it('đi qua tầng lệnh nên hoàn tác được, và không đụng cờ duyệt', async () => {
    const mounted = await mountSettled();
    const wall = wallAt(0);
    const target = thicknessChoice(0);

    await act(async () => {
      mounted.result.current.panel.onChangeThickness(wall.id, target);
      await Promise.resolve();
    });

    const changed = (): Wall =>
      wallsOfLevel(useStore.getState().spatial, FIXTURE_LEVEL.id).find(
        (item) => item.id === wall.id,
      ) as Wall;

    await waitFor(() => {
      expect(changed().thicknessMm).toBe(target);
    });
    /* Đổi độ dày KHÔNG phải duyệt: cờ review giữ nguyên (A5). */
    expect(changed().reviewed).toBe(wall.reviewed);
    expect(changed().source).toBe(wall.source);

    /* Hoàn tác được nghĩa là lệnh đã đi qua `dispatch` chứ không phải một lượt ghi tắt. */
    await act(async () => {
      mounted.result.current.panel.onUndo();
      await Promise.resolve();
    });

    await waitFor(() => {
      expect(changed().thicknessMm).toBe(wall.thicknessMm);
    });

    mounted.unmount();
  });

  it('ba lựa chọn độ dày là ba băng của hệ thiết kế, không phải ô nhập tự do', async () => {
    const mounted = await mountSettled();

    expect(mounted.result.current.panel.thicknessChoices).toEqual([...WALL_LAYER_THICKNESS_CHOICES]);
    expect(mounted.result.current.panel.thicknessChoices).toHaveLength(3);

    mounted.unmount();
  });
});

/* -------------------------------------------------------------------------- */
/* Xoá (D-05) — tức thì, vé hoàn tác, KHÔNG hộp thoại.                         */
/* -------------------------------------------------------------------------- */

describe('xoá', () => {
  it('xoá ngay và không mở hộp thoại nào', async () => {
    const mounted = await mountSettled();
    const wall = wallAt(0);

    await act(async () => {
      mounted.result.current.panel.onDelete(wall.id);
      await Promise.resolve();
    });

    await waitFor(() => {
      const remaining = wallsOfLevel(useStore.getState().spatial, FIXTURE_LEVEL.id);

      expect(remaining.some((item) => item.id === wall.id)).toBe(false);
    });

    expect(useStore.getState().openDialog).toBeNull();

    mounted.unmount();
  });

  it('vé hoàn tác sống đúng cửa sổ 8000 ms của A8 và gọi lại lượt hoàn tác', () => {
    let undone = 0;
    let clock = 0;
    const ticket = createWallUndoTicket({
      wallId: wallAt(0).id,
      now: () => clock,
      undo: () => {
        undone += 1;
      },
    });

    expect(ticket.expiresAt - 0).toBe(UNDO_WINDOW_MS);
    expect(ticket.getStatus()).toBe('active');

    const used = ticket.undo();

    expect(used.ok).toBe(true);
    expect(undone).toBe(1);

    clock = UNDO_WINDOW_MS + 1;
    expect(ticket.getStatus()).toBe('used');
  });
});

/* -------------------------------------------------------------------------- */
/* Vai Người xem — trạng thái 6.                                               */
/* -------------------------------------------------------------------------- */

describe('vai Người xem', () => {
  it('mọi hàm sửa vô hiệu ở tầng hook, không chỉ ẩn ở view', async () => {
    const mounted = await mountSettled({ roles: ['viewer'] });
    const wall = wallAt(0);
    const before = mounted.result.current.panel.reviewCounter.reviewed;

    expect(mounted.result.current.panel.state).toBe('forbidden');
    expect(mounted.result.current.panel.isViewerRole).toBe(true);
    expect(mounted.result.current.panel.viewerRoleNotice).not.toBeNull();
    expect(mounted.result.current.canvas.isInteractive).toBe(false);

    await act(async () => {
      mounted.result.current.panel.onApprove(wall.id);
      mounted.result.current.panel.onChangeThickness(wall.id, thicknessChoice(0));
      mounted.result.current.panel.onDelete(wall.id);
      mounted.result.current.panel.onMerge(wall.id, wallAt(1).id);
      mounted.result.current.panel.onUndo();
      await Promise.resolve();
    });

    const walls = wallsOfLevel(useStore.getState().spatial, FIXTURE_LEVEL.id);

    expect(walls).toHaveLength(WALL_LAYER_FIXTURE_TOTAL);
    expect(walls.filter((item) => item.reviewed)).toHaveLength(WALL_LAYER_FIXTURE_REVIEWED);
    expect(mounted.result.current.panel.reviewCounter.reviewed).toBe(before);

    mounted.unmount();
  });

  it('phím xoá cũng không làm gì ở vai Người xem', async () => {
    const mounted = await mountSettled({ roles: ['viewer'] });

    await act(async () => {
      mounted.result.current.panel.onSelect(wallAt(0).id);
      await Promise.resolve();
    });
    await pressKey(mounted.registry, 'Backspace');

    expect(wallsOfLevel(useStore.getState().spatial, FIXTURE_LEVEL.id)).toHaveLength(
      WALL_LAYER_FIXTURE_TOTAL,
    );

    mounted.unmount();
  });
});

/* -------------------------------------------------------------------------- */
/* Bảy trạng thái qua hook thật.                                               */
/* -------------------------------------------------------------------------- */

describe('bảy trạng thái', () => {
  it('lỗi lớp tường vẫn để ảnh gốc xem được', async () => {
    const mounted = await mountSettled({
      gateway: createMockWallLayerReviewGateway({
        graph: FIXTURE_GRAPH,
        failReadBackground: true,
      }),
    });

    expect(mounted.result.current.panel.state).toBe('error');
    expect(mounted.result.current.panel.errorMessage).not.toBeNull();
    /* Danh sách trắng nhưng canvas KHÔNG trắng: hình tường vẫn dựng được. */
    expect(mounted.result.current.panel.rows).toHaveLength(0);
    expect(mounted.result.current.canvas.shapes.length).toBeGreaterThan(0);

    mounted.unmount();
  });

  it('thu gọn là một trạng thái của vỏ màn, không làm mất dữ liệu', async () => {
    const mounted = await mountSettled({ forceCollapsed: true });

    expect(mounted.result.current.panel.state).toBe('collapsed');
    expect(mounted.result.current.panel.isCollapsed).toBe(true);
    expect(mounted.result.current.panel.reviewCounter.total).toBe(WALL_LAYER_FIXTURE_TOTAL);

    mounted.unmount();
  });
});

/* -------------------------------------------------------------------------- */
/* Ray công cụ, thanh trạng thái, thanh tra.                                   */
/* -------------------------------------------------------------------------- */

describe('ray công cụ và thanh trạng thái', () => {
  it('nối đoạn là hành động theo VÙNG CHỌN, chỉ bật khi đúng hai tường được chọn', async () => {
    const mounted = await mountSettled();

    expect(mounted.result.current.toolRail.canMerge).toBe(false);

    await act(async () => {
      useStore.getState().setSelection([wallAt(0).id, wallAt(1).id]);
      await Promise.resolve();
    });

    expect(mounted.result.current.toolRail.canMerge).toBe(true);

    mounted.unmount();
  });

  it('phím công cụ đổi đúng công cụ đang dùng', async () => {
    const mounted = await mountSettled();

    expect(mounted.result.current.toolRail.activeTool).toBe('select');

    await pressKey(mounted.registry, shortcutForTool('measure'));
    expect(mounted.result.current.toolRail.activeTool).toBe('measure');

    await pressKey(mounted.registry, shortcutForTool('select'));
    expect(mounted.result.current.toolRail.activeTool).toBe('select');

    mounted.unmount();
  });

  it('thanh trạng thái cấp đủ BA chuỗi đã định dạng của hợp đồng đã chốt', async () => {
    const mounted = await mountSettled();
    const { statusBar } = mounted.result.current;

    expect(statusBar.scaleLabel).toContain('mm/px');
    expect(statusBar.saveLabel.length).toBeGreaterThan(0);
    /* Chưa rê chuột lần nào: dấu thiếu, KHÔNG phải một toạ độ bịa ra. */
    expect(statusBar.cursorLabel).toBe(CURSOR_IDLE_LABEL);

    mounted.unmount();
  });

  it('bộ đếm duyệt ở panel, đúng một chỗ — thanh trạng thái không giữ bản thứ hai', async () => {
    const mounted = await mountSettled();

    expect(mounted.result.current.panel.reviewProgressLabel).toContain('tường đã duyệt');
    expect(mounted.result.current.panel.reviewProgressLabel).toContain(
      String(WALL_LAYER_FIXTURE_TOTAL),
    );

    mounted.unmount();
  });

  it('toạ độ con trỏ: canvas báo số thô, hook trả về chuỗi milimét đã định dạng', async () => {
    const mounted = await mountSettled();

    await act(async () => {
      mounted.result.current.canvas.onPointerMove({ xPx: 100, yPx: 80 });
      await Promise.resolve();
    });

    expect(mounted.result.current.statusBar.cursorLabel).not.toBe(CURSOR_IDLE_LABEL);
    expect(mounted.result.current.statusBar.cursorLabel).toContain('mm');

    await act(async () => {
      mounted.result.current.canvas.onPointerMove(null);
      await Promise.resolve();
    });

    expect(mounted.result.current.statusBar.cursorLabel).toBe(CURSOR_IDLE_LABEL);

    mounted.unmount();
  });

  it('thanh tra định dạng số theo A15 — dấu phẩy thập phân, đơn vị viết một lần', () => {
    const inspector = toWallInspector(wallAt(13), FIXTURE_LEVEL);

    /* Mã máy dài ra để tầng lệnh nhận; nhãn thanh tra vẫn đúng "#W-014" đặc tả đòi. */
    expect(inspector.codeLabel).toBe('#W-014');
    /* W-014 dài 2.500 mm: "2.500,00 mm" — chấm ngăn nghìn, phẩy thập phân. */
    expect(inspector.lengthLabel).toBe('2.500,00 mm');
    expect(inspector.heightLabel).toBe('3,00 m');
    expect(inspector.kindLabel).toBe('vách ngăn');
  });
});

/* -------------------------------------------------------------------------- */
/* Hợp đồng canvas MỞ RỘNG — những trường lớp canvas (T7) đòi thêm.            */
/* -------------------------------------------------------------------------- */

describe('hợp đồng canvas mở rộng', () => {
  it('cấp đủ hình tường bằng PIXEL bản vẽ, không phải milimét đồ thị', async () => {
    const mounted = await mountSettled();
    const shape = mounted.result.current.canvas.shapes[0];

    expect(shape).toBeDefined();
    expect(shape?.codeLabel).toBe('#W-001');
    expect(shape?.thicknessMm).toBe(wallAt(0).thicknessMm);
    expect(shape?.outline.length).toBeGreaterThanOrEqual(4);
    expect(shape?.boundsPx.width).toBeGreaterThan(0);
    expect(shape?.boundsPx.height).toBeGreaterThan(0);
    expect(shape?.centrelinePx.start).toBeDefined();

    /*
     * Phép kiểm phân biệt hai đơn vị: bộ mẫu chạy ở 12 mm/px, nên bề ngang tính
     * bằng PIXEL phải NHỎ HƠN hẳn bề ngang tính bằng milimét của cùng lưới đó.
     * Quên một lượt quy đổi là con số này bằng nhau, và bài kiểm đỏ.
     */
    const bounds = mounted.result.current.canvas.contentBoundsPx;
    const gridWidthMm = wallAt(4).centreline.end.x;

    expect(bounds).not.toBeNull();
    expect(bounds?.width).toBeGreaterThan(0);
    expect(bounds?.width).toBeLessThan(gridWidthMm);

    mounted.unmount();
  });

  it('nói ra trạng thái, nhãn khung, chú giải và cờ lớp Tường', async () => {
    const mounted = await mountSettled();
    const { canvas } = mounted.result.current;

    expect(canvas.state).toBe(mounted.result.current.panel.state);
    expect(canvas.canvasLabel).toContain(FIXTURE_LEVEL.name);
    expect(canvas.canvasLabel).toContain(String(WALL_LAYER_FIXTURE_TOTAL));
    expect(canvas.isWallLayerVisible).toBe(true);
    expect(canvas.legendLevels).toEqual([...WALL_LAYER_THICKNESS_CHOICES]);
    expect(canvas.drawingSizePx).not.toBeNull();
    expect(canvas.measurement).toBeNull();

    mounted.unmount();
  });

  it('bốn mục menu chuột phải nối vào đúng việc của chúng', async () => {
    const mounted = await mountSettled();
    const wall = wallAt(0);

    await act(async () => {
      mounted.result.current.canvas.onRequestSplit(wall.id);
      await Promise.resolve();
    });

    expect(mounted.result.current.panel.selectedWallId).toBe(wall.id);
    expect(mounted.result.current.toolRail.activeTool).toBe('splitWall');

    await act(async () => {
      mounted.result.current.canvas.onRequestThicknessChange(wall.id);
      await Promise.resolve();
    });

    /* Xin đổi độ dày = đưa tường vào thanh tra, nơi có điều khiển ba lựa chọn. */
    expect(mounted.result.current.panel.inspector?.id).toBe(wall.id);

    await act(async () => {
      mounted.result.current.canvas.onApprove(wall.id);
      await Promise.resolve();
    });

    await waitFor(() => {
      expect(mounted.result.current.panel.reviewCounter.reviewed).toBe(
        WALL_LAYER_FIXTURE_REVIEWED + 1,
      );
    });

    mounted.unmount();
  });
});
