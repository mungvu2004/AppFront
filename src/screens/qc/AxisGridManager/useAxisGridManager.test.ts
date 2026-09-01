/**
 * Nửa "suy nghĩ" của màn S-15 "Quản lý trục và gốc toạ độ", kiểm không cần DOM.
 *
 * Hook được lái qua `renderHook`, tầng dữ liệu là
 * `createMockAxisGridManagerGateway()` của `axisGridManagerGateway.ts` — cùng
 * cổng story sẽ dùng — và mọi con số khẳng định đọc ra từ `axisGridFixture.ts`
 * / `axisGridManagerScenarios.ts`, không có bảng dữ liệu thứ hai bịa tại chỗ
 * (R-70).
 *
 * ## Phép kiểm quan trọng nhất của cả file
 *
 * `căn tự động rồi Ctrl+Z một lần` — bài kiểm IN RA bảng độ lệch từng tầng
 * trước và sau, khẳng định mọi tầng về dưới 50 mm, rồi khẳng định số bước lịch
 * sử tăng đúng **1** và một lần `Ctrl+Z` qua SỔ PHÍM THẬT trả mọi toạ độ trục
 * về nguyên trạng. Một bước lịch sử cho mỗi tầng — lỗi mà CẤM TUYỆT ĐỐI của đặc
 * tả nhắm tới — sẽ làm bài này đỏ ở đúng con số đó.
 */

import { createElement, type ReactNode } from 'react';
import { QueryClientProvider } from '@tanstack/react-query';
import { act, cleanup, renderHook, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { alignFloors, type FloorAlignmentReport } from '@/domain/axes/alignFloors';
import type { NormalizedSpatial } from '@/domain/spatial/normalize';
import type { LevelId } from '@/domain/spatial/types';
import { millimetres, type Millimetres } from '@/domain/units/types';
import type { Announcer } from '@/lib/input/announcer';
import { createShortcutRegistry, type ShortcutRegistry } from '@/lib/input/shortcutRegistry';
import { createNotificationBus, type NotificationBus } from '@/lib/mutations/notificationBus';
import { createTestQueryClient } from '@/lib/testing/render';
import { SEVEN_STATES } from '@/lib/testing/sevenStateScenarios';
import { resetSelectorCaches } from '@/store/selectors';
import { useStore } from '@/store';

import {
  AXIS_GRID_FIXTURE_FLOOR1,
  AXIS_GRID_FIXTURE_FLOOR3,
  AXIS_GRID_FIXTURE_SCALE,
  AXIS_GRID_FIXTURE_SPACING_VIOLATION_EXAMPLE,
} from './axisGridFixture';
import { AXIS_GRID_MANAGER_SCENARIOS } from './axisGridManagerScenarios';
import {
  axesOfLevel,
  createAxisGridManagerGateway,
  createAxisGridSampleGraph,
  createMockAxisGridManagerGateway,
  floorPlansOf,
  levelsOf,
  MIN_AXIS_SPACING_MM,
  type AxisGridManagerGateway,
} from './axisGridManagerGateway';
import {
  AXIS_GRID_TEXT,
  axisRowId,
  useAxisGridManager,
  type UseAxisGridManagerOptions,
  type UseAxisGridManagerResult,
} from './useAxisGridManager';
import type { AxisGridScreenState } from './axisGridTypes';

/* -------------------------------------------------------------------------- */
/* Bộ mẫu — đọc ra, không viết tay lại.                                        */
/* -------------------------------------------------------------------------- */

const PROJECT_ID = 'project-axis-grid';

/**
 * Hai tầng căn được HẾT: tầng 1 làm chuẩn, tầng 3 lệch đúng một phép tịnh tiến
 * đều (+100 mm theo x, +60 mm theo y — xem đầu `axisGridFixture.ts`), nên
 * `alignFloors` bù lại được trọn vẹn.
 *
 * Tầng 2 của bộ mẫu cố tình KHÔNG phải tịnh tiến đều (một trục lệch riêng
 * 200 mm) nên nó không bao giờ về dưới dung sai — đó là dữ liệu của kịch bản
 * cảnh báo, không phải của bài kiểm "căn xong thì mọi tầng trong dung sai".
 */
const ALIGNABLE_FLOORS = [AXIS_GRID_FIXTURE_FLOOR1, AXIS_GRID_FIXTURE_FLOOR3];

/** Ngưỡng nghiệm thu của đặc tả: căn xong thì không tầng nào còn lệch quá mức này. */
const ACCEPTANCE_OFFSET_MM: Millimetres = millimetres(50);

/* -------------------------------------------------------------------------- */
/* Môi trường.                                                                 */
/* -------------------------------------------------------------------------- */

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
  readonly result: { current: UseAxisGridManagerResult };
  readonly registry: ShortcutRegistry;
  readonly notifications: NotificationBus;
  readonly spoken: readonly string[];
  readonly unmount: () => void;
}

type MountOptions = Partial<Omit<UseAxisGridManagerOptions, 'registry'>>;

function mountHook(options: MountOptions = {}): Mounted {
  const registry = createShortcutRegistry();
  const notifications = options.notifications ?? createNotificationBus();
  const spoken: string[] = [];
  const announcer: Announcer = {
    announce: (message) => {
      spoken.push(message);
    },
    destroy: () => undefined,
  };
  const queryClient = createTestQueryClient();
  const wrapper = ({ children }: { children: ReactNode }): ReactNode =>
    createElement(QueryClientProvider, { client: queryClient }, children);

  const rendered = renderHook(
    () =>
      useAxisGridManager({
        projectId: options.projectId ?? PROJECT_ID,
        floorId: options.floorId ?? String(AXIS_GRID_FIXTURE_FLOOR1.levelId),
        roles: options.roles ?? ['engineer'],
        gateway: options.gateway ?? createMockAxisGridManagerGateway(),
        registry,
        notifications,
        announcer,
        ...(options.levelId === undefined ? {} : { levelId: options.levelId }),
        ...(options.forceCollapsed === undefined ? {} : { forceCollapsed: options.forceCollapsed }),
      }),
    { wrapper },
  );

  return { result: rendered.result, registry, notifications, spoken, unmount: rendered.unmount };
}

/** Chờ lượt đọc lớp trục xong — trước đó mọi kịch bản đều là `'loading'`. */
async function mountSettled(options: MountOptions = {}): Promise<Mounted> {
  const mounted = mountHook(options);

  await waitFor(() => {
    expect(mounted.result.current.viewModel.state).not.toBe('loading');
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

/** Đồ thị đang nằm trong kho — nơi `commit` vừa ghi vào. */
const storeGraph = (): NormalizedSpatial | null => useStore.getState().spatial;

/** Toạ độ mọi trục của mọi tầng, để so nguyên trạng trước và sau `Ctrl+Z`. */
function axisCoordinates(graph: NormalizedSpatial | null): readonly string[] {
  const readings: string[] = [];

  for (const level of levelsOf(graph)) {
    for (const axis of axesOfLevel(graph, level.id)) {
      readings.push(
        `${String(level.id)}/${axis.label}: ${String(axis.line.start.x)},${String(axis.line.start.y)} → ${String(axis.line.end.x)},${String(axis.line.end.y)}`,
      );
    }
  }

  return readings;
}

/**
 * Độ lệch còn lại của một tầng, đọc từ `alignFloors` — số càng lớn thì tầng
 * còn phải dời càng xa.
 *
 * Ba số của `FloorAlignment` cùng nói một chuyện: hai thành phần tịnh tiến mà
 * thuật toán còn phải áp, và phần dư sau khi áp. Bài kiểm lấy cái lớn nhất
 * trong ba, nên "mọi tầng dưới 50 mm" nghĩa là không tầng nào còn phải dời quá
 * 50 mm VÀ không tầng nào còn dư quá 50 mm.
 */
function floorOffsetsMm(report: FloorAlignmentReport): ReadonlyMap<string, number> {
  const offsets = new Map<string, number>();

  for (const floor of report.floors) {
    const dx = floor.transform.translationMm.x;
    const dy = floor.transform.translationMm.y;
    const candidates = [dx < 0 ? -dx : dx, dy < 0 ? -dy : dy, floor.maxResidualMm];
    let worst = 0;

    for (const candidate of candidates) {
      worst = candidate > worst ? candidate : worst;
    }

    offsets.set(String(floor.levelId), worst);
  }

  return offsets;
}

/** Bảng độ lệch của mọi tầng, in ra được. */
function offsetTable(report: FloorAlignmentReport): string {
  return report.floors
    .map((floor) => `${floor.name}: ${String(floorOffsetsMm(report).get(String(floor.levelId)))} mm`)
    .join(' · ');
}

/** Báo cáo căn tầng đọc thẳng từ đồ thị đang nằm trong kho. */
const reportOfStore = (): FloorAlignmentReport => alignFloors(floorPlansOf(storeGraph()));

/* -------------------------------------------------------------------------- */
/* 1 + 2. Căn tự động, và một lần Ctrl+Z.                                      */
/* -------------------------------------------------------------------------- */

describe('căn chỉnh tự động giữa các tầng', () => {
  it('kéo mọi tầng về dưới 50 mm, và in ra bảng độ lệch trước và sau', async () => {
    const graph = createAxisGridSampleGraph({ floors: ALIGNABLE_FLOORS });
    const mounted = await mountSettled({ gateway: createMockAxisGridManagerGateway({ graph }) });

    const before = reportOfStore();
    const beforeOffsets = floorOffsetsMm(before);

    console.log(`độ lệch TRƯỚC căn tự động:  ${offsetTable(before)}`);

    /* Bộ mẫu phải thật sự lệch, nếu không bài kiểm này không chứng minh gì. */
    expect([...beforeOffsets.values()].some((offset) => offset > ACCEPTANCE_OFFSET_MM)).toBe(true);

    await act(async () => {
      mounted.result.current.onAutoAlign();
      await Promise.resolve();
    });

    await waitFor(() => {
      expect(mounted.result.current.historyStepCount()).toBe(1);
    });

    const after = reportOfStore();
    const afterOffsets = floorOffsetsMm(after);

    console.log(`độ lệch SAU căn tự động:    ${offsetTable(after)}`);

    for (const [levelId, offset] of afterOffsets) {
      expect(
        offset,
        `tầng ${levelId} còn lệch ${String(offset)} mm sau khi căn tự động`,
      ).toBeLessThanOrEqual(ACCEPTANCE_OFFSET_MM);
    }

    /* Và view-model nói cùng một chuyện: không tầng nào còn ngoài dung sai. */
    expect(mounted.result.current.viewModel.floors.every((floor) => floor.status === 'ok')).toBe(
      true,
    );
    expect(mounted.result.current.viewModel.warningBanner).toBeNull();
  });

  it('một lần Ctrl+Z trả về nguyên trạng, và lịch sử chỉ tăng đúng một bước', async () => {
    const graph = createAxisGridSampleGraph({ floors: ALIGNABLE_FLOORS });
    const mounted = await mountSettled({ gateway: createMockAxisGridManagerGateway({ graph }) });

    const stepsBefore = mounted.result.current.historyStepCount();
    const coordinatesBefore = axisCoordinates(storeGraph());

    await act(async () => {
      mounted.result.current.onAutoAlign();
      await Promise.resolve();
    });

    await waitFor(() => {
      expect(mounted.result.current.historyStepCount()).toBe(stepsBefore + 1);
    });

    /* Căn tự động phải THẬT SỰ dời trục, nếu không lượt hoàn tác không kiểm gì. */
    expect(axisCoordinates(storeGraph())).not.toEqual(coordinatesBefore);

    /* MỘT lần Ctrl+Z, qua sổ phím thật — không gọi tắt vào hàm hoàn tác. */
    await pressKey(mounted.registry, 'z', { ctrlKey: true });

    expect(axisCoordinates(storeGraph())).toEqual(coordinatesBefore);
    expect(mounted.result.current.historyStepCount()).toBe(stepsBefore);
  });

  it('phát toast có vé hoàn tác sau khi căn tự động (A8)', async () => {
    const graph = createAxisGridSampleGraph({ floors: ALIGNABLE_FLOORS });
    const notifications = createNotificationBus();
    const mounted = await mountSettled({
      gateway: createMockAxisGridManagerGateway({ graph }),
      notifications,
    });

    await act(async () => {
      mounted.result.current.onAutoAlign();
      await Promise.resolve();
    });

    await waitFor(() => {
      expect(notifications.list()).toHaveLength(1);
    });

    const published = notifications.list()[0];

    expect(published?.undoTicket).toBeDefined();
    expect(published?.undoTicket?.getStatus()).toBe('active');
    expect(published?.title).toContain('tầng');
  });
});

/* -------------------------------------------------------------------------- */
/* 3. Chặn hai trục cách nhau dưới 100 mm.                                     */
/* -------------------------------------------------------------------------- */

describe('khoảng cách tối thiểu giữa hai trục', () => {
  it('chặn lượt kéo trục 2 về cách trục 1 đúng 80 mm, và nói đích danh hai trục', async () => {
    const mounted = await mountSettled();

    const coordinatesBefore = axisCoordinates(storeGraph());
    const stepsBefore = mounted.result.current.historyStepCount();

    /* 80 mm đọc ra pixel bằng CHÍNH tỷ lệ của bộ mẫu — không tự nhân chia (R-71). */
    const droppedPx = AXIS_GRID_FIXTURE_SCALE.millimetresToPixels(
      AXIS_GRID_FIXTURE_SPACING_VIOLATION_EXAMPLE.actualMm,
    );

    await act(async () => {
      mounted.result.current.onAxisDrag(axisRowId('vertical', '2'), droppedPx);
      await Promise.resolve();
    });

    const violation = mounted.result.current.spacingViolation;

    expect(violation).not.toBeNull();
    expect(violation?.firstLabel).toBe(AXIS_GRID_FIXTURE_SPACING_VIOLATION_EXAMPLE.firstLabel);
    expect(violation?.secondLabel).toBe(AXIS_GRID_FIXTURE_SPACING_VIOLATION_EXAMPLE.secondLabel);
    expect(violation?.actualMm).toBe(AXIS_GRID_FIXTURE_SPACING_VIOLATION_EXAMPLE.actualMm);
    expect(violation?.minimumMm).toBe(MIN_AXIS_SPACING_MM);

    /* Câu chặn nêu ĐÍCH DANH hai trục, và nêu cả ngưỡng lẫn khoảng cách hiện tại. */
    const message = mounted.result.current.spacingMessage ?? '';

    expect(message).toContain('đặt 1 và 2 cách nhau dưới');
    expect(message).toContain('100 mm');
    expect(message).toContain('80 mm');

    /* aria-live cũng phải nghe được câu đó (A12, R-72). */
    expect(mounted.spoken.some((line) => line.includes('đặt 1 và 2 cách dưới'))).toBe(true);

    /* Và lượt kéo KHÔNG được ghi: không trục nào dời, không bước lịch sử nào thêm. */
    expect(axisCoordinates(storeGraph())).toEqual(coordinatesBefore);
    expect(mounted.result.current.historyStepCount()).toBe(stepsBefore);
  });

  it('cho qua lượt kéo xa hơn ngưỡng, và ghi thành một bước lịch sử', async () => {
    const mounted = await mountSettled();

    const stepsBefore = mounted.result.current.historyStepCount();
    const farEnoughMm = millimetres(
      AXIS_GRID_FIXTURE_SPACING_VIOLATION_EXAMPLE.minimumMm + ACCEPTANCE_OFFSET_MM,
    );

    await act(async () => {
      mounted.result.current.onAxisDrag(
        axisRowId('vertical', '2'),
        AXIS_GRID_FIXTURE_SCALE.millimetresToPixels(farEnoughMm),
      );
      await Promise.resolve();
    });

    await waitFor(() => {
      expect(mounted.result.current.historyStepCount()).toBe(stepsBefore + 1);
    });

    expect(mounted.result.current.spacingViolation).toBeNull();
  });
});

/* -------------------------------------------------------------------------- */
/* 4. Bảy trạng thái.                                                          */
/* -------------------------------------------------------------------------- */

/** Cách ép từng trạng thái, một dòng cho mỗi tên của `SEVEN_STATES`. */
const SEVEN_STATE_MOUNTS: Readonly<Record<AxisGridScreenState, () => MountOptions>> = {
  empty: () => ({
    gateway: createMockAxisGridManagerGateway({
      graph: createAxisGridSampleGraph({ withAxes: false }),
    }),
  }),
  loading: () => ({}),
  partial: () => ({
    gateway: createMockAxisGridManagerGateway({
      graph: createAxisGridSampleGraph({ onlyDirection: 'vertical' }),
    }),
  }),
  error: () => ({ gateway: createMockAxisGridManagerGateway({ failReadAxisLayer: true }) }),
  success: () => ({
    gateway: createMockAxisGridManagerGateway({
      graph: createAxisGridSampleGraph({ floors: ALIGNABLE_FLOORS }),
    }),
  }),
  forbidden: () => ({ roles: ['viewer'] }),
  collapsed: () => ({ forceCollapsed: true }),
};

describe('bảy trạng thái màn (A11 / R-63)', () => {
  it('bảy kịch bản của axisGridManagerScenarios.ts phủ đúng bảy tên của SEVEN_STATES', () => {
    expect(AXIS_GRID_MANAGER_SCENARIOS.map((scenario) => scenario.state)).toEqual([...SEVEN_STATES]);
  });

  it('đang tải: trạng thái đầu tiên, trước khi lượt đọc lớp trục xong', () => {
    const mounted = mountHook(SEVEN_STATE_MOUNTS.loading());

    expect(mounted.result.current.viewModel.state).toBe('loading');
    expect(mounted.result.current.viewModel.emptyNotice).toBeNull();
    expect(mounted.result.current.viewModel.errorMessage).toBeNull();
  });

  for (const scenario of AXIS_GRID_MANAGER_SCENARIOS) {
    if (scenario.state === 'loading') {
      continue;
    }

    it(`suy ra đúng trạng thái "${scenario.state}" của kịch bản cùng tên`, async () => {
      const mounted = await mountSettled(SEVEN_STATE_MOUNTS[scenario.state]());
      const viewModel = mounted.result.current.viewModel;

      expect(viewModel.state).toBe(scenario.state);

      /* Ba cờ đi kèm phải khớp kịch bản, không chỉ cái tên trạng thái. */
      expect(viewModel.emptyNotice === null).toBe(scenario.emptyNotice === null);
      expect(viewModel.errorMessage === null).toBe(scenario.errorMessage === null);
      expect(viewModel.viewerRoleNotice === null).toBe(scenario.viewerRoleNotice === null);
      expect(viewModel.isCollapsed).toBe(scenario.isCollapsed);
      expect(viewModel.isViewerRole).toBe(scenario.isViewerRole);
    });
  }

  it('trạng thái rỗng: không hàng trục nào, và có câu mời vẽ thủ công', async () => {
    const mounted = await mountSettled(SEVEN_STATE_MOUNTS.empty());
    const viewModel = mounted.result.current.viewModel;

    expect(viewModel.groups.every((group) => group.rows.length === 0)).toBe(true);
    expect(viewModel.emptyNotice).not.toBeNull();
  });

  it('trạng thái một phần: có trục dọc, chưa có trục ngang', async () => {
    const mounted = await mountSettled(SEVEN_STATE_MOUNTS.partial());
    const viewModel = mounted.result.current.viewModel;

    const horizontal = viewModel.groups.find((group) => group.direction === 'horizontal');
    const vertical = viewModel.groups.find((group) => group.direction === 'vertical');

    expect(horizontal?.rows).toHaveLength(0);
    expect(vertical?.rows.length ?? 0).toBeGreaterThan(0);
  });

  it('vai người xem: mọi hàm sửa thành vô hiệu, không lệnh nào chạy', async () => {
    const mounted = await mountSettled(SEVEN_STATE_MOUNTS.forbidden());

    await act(async () => {
      mounted.result.current.onAutoAlign();
      mounted.result.current.onAxisAdd('vertical');
      await Promise.resolve();
    });

    expect(mounted.result.current.historyStepCount()).toBe(0);
    expect(mounted.result.current.viewModel.viewerRoleNotice).not.toBeNull();
  });
});

/* -------------------------------------------------------------------------- */
/* 5. Khả năng còn thiếu.                                                      */
/* -------------------------------------------------------------------------- */

describe('khả năng chưa có đường (không bịa, không ném)', () => {
  const gateway: AxisGridManagerGateway = createAxisGridManagerGateway();

  it('cổng thật khai đúng hai khả năng còn thiếu', () => {
    expect(gateway.supports.persistAxisGrid).toBe(false);
    expect(gateway.supports.persistAxisOrigin).toBe(false);
    expect(gateway.supports.readAxisLayer).toBe(true);
    expect(gateway.supports.writeAxisGraph).toBe(true);
  });

  it('persistAxisGrid trả nhánh supported:false có kiểu, kèm câu nợ endpoint', async () => {
    const result = await gateway.persistAxisGrid({
      projectId: PROJECT_ID,
      floorId: String(AXIS_GRID_FIXTURE_FLOOR1.levelId),
      graph: createAxisGridSampleGraph(),
    });

    expect(result.supported).toBe(false);

    if (!result.supported) {
      expect(result.capability).toBe('persistAxisGrid');
      expect(result.missing).toContain('FloorWriteBody');
    }
  });

  it('persistAxisOrigin trả nhánh supported:false có kiểu, kèm câu nợ endpoint', async () => {
    const result = await gateway.persistAxisOrigin({
      projectId: PROJECT_ID,
      floorId: String(AXIS_GRID_FIXTURE_FLOOR1.levelId),
      anchor: 'A-1',
      point: { x: millimetres(0), y: millimetres(0) },
    });

    expect(result.supported).toBe(false);

    if (!result.supported) {
      expect(result.capability).toBe('persistAxisOrigin');
      expect(result.missing).toContain('không có chỗ ghi');
    }
  });

  it('đổi giao trục neo: ghim lưới được, và NÓI RA là lượt chọn chưa lưu được', async () => {
    const mounted = await mountSettled();
    const options = mounted.result.current.viewModel.origin.anchorOptions;
    const target = options[options.length - 1];

    expect(target).toBeDefined();

    await act(async () => {
      mounted.result.current.onAnchorChange(target?.value ?? '');
      await Promise.resolve();
    });

    await waitFor(() => {
      expect(mounted.result.current.viewModel.origin.selectedAnchor).toBe(target?.value);
    });

    /* Không lệnh nào được sinh: gốc toạ độ là khung đọc, không phải thay đổi mô hình. */
    expect(mounted.result.current.historyStepCount()).toBe(0);

    await waitFor(() => {
      expect(mounted.spoken).toContain(AXIS_GRID_TEXT.originNotPersisted);
    });
  });
});

/* -------------------------------------------------------------------------- */
/* Định dạng số — A15, dấu thập phân là dấu PHẨY.                              */
/* -------------------------------------------------------------------------- */

describe('định dạng số ở view-model, không ở view (A15)', () => {
  it('mọi độ lệch gốc toạ độ ra CẢ hai đơn vị, bằng chữ, không dấu chấm thập phân', async () => {
    const mounted = await mountSettled();
    const origin = mounted.result.current.viewModel.origin;

    for (const text of [
      origin.offsetXPxText,
      origin.offsetYPxText,
      origin.offsetXMmText,
      origin.offsetYMmText,
    ]) {
      expect(text).not.toBe('');
      expect(text).not.toMatch(/\d\.\d/u);
    }

    expect(origin.offsetXPxText).toContain('px');
    expect(origin.offsetXMmText).toContain('mm');
  });

  it('khoảng cách tới trục kế tiếp có cả số thô lẫn chữ, và trục cuối nhóm không có', async () => {
    const mounted = await mountSettled();
    const vertical = mounted.result.current.viewModel.groups.find(
      (group) => group.direction === 'vertical',
    );
    const rows = vertical?.rows ?? [];

    expect(rows.length).toBeGreaterThan(1);

    for (const row of rows.slice(0, -1)) {
      expect(row.spacingMm).not.toBeNull();
      expect(row.spacingText).toContain('mm');
    }

    expect(rows[rows.length - 1]?.spacingMm).toBeNull();
    expect(rows[rows.length - 1]?.spacingText).toBeNull();
  });

  it('bóng ma tầng khác nháy lên đúng tầng đang được trỏ', async () => {
    const mounted = await mountSettled();
    const other = mounted.result.current.viewModel.canvas.ghostFloors[0];

    expect(other).toBeDefined();

    await act(async () => {
      mounted.result.current.onFloorRowHover(other?.levelId as LevelId);
      await Promise.resolve();
    });

    const ghosts = mounted.result.current.viewModel.canvas.ghostFloors;

    expect(ghosts.filter((ghost) => ghost.isHighlighted)).toHaveLength(1);
    expect(ghosts.find((ghost) => ghost.isHighlighted)?.levelId).toBe(other?.levelId);
  });
});
