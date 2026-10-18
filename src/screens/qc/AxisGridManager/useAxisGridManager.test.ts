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
import { act, cleanup, render, renderHook, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { __resetMockLayerState, createMockApiClient } from '@/api/__mocks__/client';
import { alignFloors, type FloorAlignmentReport } from '@/domain/axes/alignFloors';
import { createSampleBuilding, sampleLevelId, sampleWallId } from '@/domain/spatial/__fixtures__/sampleBuilding';
import { applyPatch } from '@/domain/spatial/applyPatch';
import { normalizeSpatial, type NormalizedSpatial } from '@/domain/spatial/normalize';
import type { Axis, LevelId } from '@/domain/spatial/types';
import { pixels } from '@/domain/units/scale';
import { millimetres, type Millimetres } from '@/domain/units/types';
import type { Announcer } from '@/lib/input/announcer';
import { createShortcutRegistry, type ShortcutRegistry } from '@/lib/input/shortcutRegistry';
import { NotificationHost } from '@/components/feedback/NotificationHost';
import { createNotificationBus, type NotificationBus } from '@/lib/mutations/notificationBus';
import { createTestQueryClient } from '@/lib/testing/render';
import { SEVEN_STATES } from '@/lib/testing/sevenStateScenarios';
import { resetSelectorCaches } from '@/store/selectors';
import { useStore } from '@/store';

import {
  AXIS_GRID_FIXTURE_FLOOR1,
  AXIS_GRID_FIXTURE_FLOOR2,
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
  extendPerpendicularAxes,
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

  it('[G12] căn tự động chỉ dời trục, không đụng tường (autosave sẽ PUT tường)', async () => {
    const graph = createAxisGridSampleGraph({ floors: ALIGNABLE_FLOORS });
    const mounted = await mountSettled({ gateway: createMockAxisGridManagerGateway({ graph }) });
    const wallsOf = (): string => {
      const current = storeGraph();

      return JSON.stringify((current?.byKind.wall ?? []).map((id) => current?.byId[id]));
    };
    const wallsBefore = wallsOf();
    const axesBefore = axisCoordinates(storeGraph());

    await act(async () => {
      mounted.result.current.onAutoAlign();
      await Promise.resolve();
    });
    await waitFor(() => {
      expect(axisCoordinates(storeGraph())).not.toEqual(axesBefore);
    });

    expect(wallsOf()).toBe(wallsBefore);
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

  it('[BUG-595/G10] sau nhiều lượt kéo, MỘT Ctrl+Z trả đúng vị trí trước lượt kéo cuối', async () => {
    const mounted = await mountSettled();
    const drag = async (mm: number): Promise<void> => {
      await act(async () => {
        mounted.result.current.onAxisDrag(
          axisRowId('vertical', '2'),
          AXIS_GRID_FIXTURE_SCALE.millimetresToPixels(millimetres(mm)),
        );
        await Promise.resolve();
      });
    };

    await drag(150);
    await drag(400);
    const afterSecond = axisCoordinates(storeGraph());

    await drag(650);
    expect(axisCoordinates(storeGraph())).not.toEqual(afterSecond);

    await pressKey(mounted.registry, 'z', { ctrlKey: true });

    expect(axisCoordinates(storeGraph())).toEqual(afterSecond);
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
      expect(viewModel.hasNoAxes).toBe(scenario.hasNoAxes);
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

  it('[BUG-320] thêm trục khi mới có bản xem trước dò từ tường: giữ cả lưới dò được, thêm đúng một hàng', async () => {
    const building = createSampleBuilding();
    const mounted = await mountSettled({
      floorId: sampleLevelId(0),
      gateway: createMockAxisGridManagerGateway({ graph: normalizeSpatial({ ...building, axes: [] }) }),
    });
    const rowCount = (): number =>
      mounted.result.current.viewModel.groups.reduce((sum, group) => sum + group.rows.length, 0);
    const before = rowCount();

    expect(before).toBeGreaterThan(0);

    await act(async () => {
      mounted.result.current.onAxisAdd('vertical');
      await Promise.resolve();
    });

    await waitFor(() => {
      expect(rowCount()).toBe(before + 1);
    });
    expect(mounted.result.current.historyStepCount()).toBe(1);
  });

  it('[G4b-22] thêm trục với tên và khoảng cách người dùng nhập', async () => {
    const mounted = await mountSettled();
    const labels = (): string[] =>
      mounted.result.current.viewModel.groups.flatMap((group) => group.rows.map((row) => row.label));

    await act(async () => {
      mounted.result.current.onAxisAdd('vertical', { label: 'X9', spacingMm: 2500 });
      await Promise.resolve();
    });

    await waitFor(() => {
      expect(labels()).toContain('X9');
    });
    /* Trục ngang được kéo tới trục dọc mới trong CÙNG lệnh: một bước hoàn tác. */
    expect(mounted.result.current.historyStepCount()).toBe(1);
  });

  it('[G4b-22] kéo dài trục vuông góc tới trục mới nằm ngoài lưới', () => {
    const horizontal = {
      direction: 'horizontal',
      line: { start: { x: millimetres(0), y: millimetres(0) }, end: { x: millimetres(10000), y: millimetres(0) } },
    } as unknown as Axis;
    const [change] = extendPerpendicularAxes([horizontal], 'vertical', 12500);

    expect(change?.after.line.end.x).toBe(12500);
    expect(change?.after.line.start.x).toBe(0);
    expect(extendPerpendicularAxes([horizontal], 'vertical', 5000)).toEqual([]);
  });
});

/* -------------------------------------------------------------------------- */
/* 5. Khả năng còn thiếu.                                                      */
/* -------------------------------------------------------------------------- */

describe('khả năng chưa có đường (không bịa, không ném)', () => {

  it('G4b-17: cổng thật lưu trục và gốc qua PUT lớp tầng, đọc lại thấy bản đã lưu', async () => {
    __resetMockLayerState();
    const saving = createAxisGridManagerGateway({ apiClient: createMockApiClient() });
    const floorId = String(AXIS_GRID_FIXTURE_FLOOR1.levelId);

    expect(saving.supports.persistAxisGrid).toBe(true);
    expect(saving.supports.persistAxisOrigin).toBe(true);

    const graph = createAxisGridSampleGraph();
    const grid = await saving.persistAxisGrid({ projectId: PROJECT_ID, floorId, graph });
    const origin = await saving.persistAxisOrigin({
      projectId: PROJECT_ID,
      floorId,
      anchor: 'A-1',
      point: { x: millimetres(1200.4), y: millimetres(-300) },
    });

    expect(grid.supported).toBe(true);
    expect(origin.supported).toBe(true);

    const saved = await saving.readLayer({ projectId: PROJECT_ID, floorId });
    const expectedIds = (graph.byLevel[floorId] ?? []).filter((id) => id.startsWith('A-'));

    expect(expectedIds.length).toBeGreaterThan(0);
    expect(saved.axes.map((axis) => axis.id).sort()).toEqual([...expectedIds].sort());
    expect(saved.origin).toEqual({ x: 1200, y: -300 });

    /* Hai lượt lưu liên tiếp đều qua, và kho mang revision mới nên lượt ghi kế (màn Tường) không 409. */
    expect(saved.revision).toBe(2);
    expect(useStore.getState().floorMeta[floorId]?.revision).toBe(2);

    const wallsWrite = await createMockApiClient().spatial.writeLayer({
      baseVersion: useStore.getState().floorMeta[floorId]?.revision ?? 0,
      body: { layer: saved.layer },
      floorId,
      projectId: PROJECT_ID,
    });

    expect(wallsWrite.ok).toBe(true);
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

/* -------------------------------------------------------------------------- */
/* QA-04c — SCR-19 nói thật, không điều khiển chết (BUG-578/594/601).          */
/* -------------------------------------------------------------------------- */

describe('QA-04c SCR-19', () => {
  /**
   * Tầng chưa có trục lưu — danh sách là bản xem trước dò từ tường (như BUG-320).
   * Thêm hai đoạn tường thẳng hàng ở y = 3000 để bản xem trước có HAI trục ngang.
   */
  const previewGateway = (): AxisGridManagerGateway => {
    const building = createSampleBuilding();
    const firstLevel = building.levels[0]?.id;
    const extra = building.walls
      .filter((wall) => wall.levelId === firstLevel)
      .slice(0, 2)
      .map((wall, index) => ({
        ...wall,
        id: sampleWallId(90 + index),
        openingIds: [],
        centreline: {
          start: { ...wall.centreline.start, y: 3000 },
          end: { ...wall.centreline.end, y: 3000 },
        },
      }));

    return createMockAxisGridManagerGateway({
      graph: normalizeSpatial({ ...building, axes: [], walls: [...building.walls, ...extra] }),
    });
  };
  const rowsOf = (mounted: Mounted) => mounted.result.current.viewModel.groups.flatMap((group) => group.rows);
  const leave = (): boolean => {
    const event = new Event('beforeunload', { cancelable: true });

    window.dispatchEvent(event);

    return event.defaultPrevented;
  };

  it('[BUG-578] câu "chỉ giữ trong phiên" luôn có; sửa xong thì hỏi trước khi rời trang', async () => {
    const mounted = await mountSettled();

    expect(mounted.result.current.unsavedNotice).toBe(AXIS_GRID_TEXT.unsavedNotice);
    expect(leave()).toBe(false);

    await act(async () => {
      mounted.result.current.onAxisAdd('vertical');
      await Promise.resolve();
    });
    await waitFor(() => {
      expect(mounted.result.current.historyStepCount()).toBe(1);
    });

    expect(leave()).toBe(true);
    mounted.unmount();
  });

  it('[BUG-578] vai người xem không sửa gì: không câu "chỉ giữ trong phiên"', async () => {
    const mounted = await mountSettled({ roles: ['viewer'] });

    expect(mounted.result.current.unsavedNotice).toBeNull();
  });

  it('[BUG-594] xoá một trục của bản xem trước: có tác dụng ngay, một bước hoàn tác', async () => {
    const mounted = await mountSettled({ floorId: sampleLevelId(0), gateway: previewGateway() });
    const before = rowsOf(mounted);
    const target = before[0];

    expect(target).toBeDefined();

    await act(async () => {
      mounted.result.current.onAxisRemove(target?.id ?? '');
      await Promise.resolve();
    });

    await waitFor(() => {
      expect(rowsOf(mounted)).toHaveLength(before.length - 1);
    });
    expect(mounted.result.current.historyStepCount()).toBe(1);
  });

  it('[19-A-006] xoá một trục đã lưu: toast "Đã xoá trục X." có vé hoàn tác còn hiệu lực', async () => {
    const notifications = createNotificationBus();
    const mounted = await mountSettled({ notifications });
    const target = rowsOf(mounted)[0];

    expect(target).toBeDefined();

    await act(async () => {
      mounted.result.current.onAxisRemove(target?.id ?? '');
      await Promise.resolve();
    });

    await waitFor(() => {
      expect(notifications.list()).toHaveLength(1);
    });
    expect(notifications.list()[0]?.undoTicket?.getStatus()).toBe('active');
    expect(notifications.list()[0]?.title).toMatch(/^Đã xoá trục /u);
  });

  it('[19-A-011] xoá lần hai sau khi toast đầu đã đóng (8 s): lại hiện một toast mới có vé hoàn tác', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true, toFake: ['Date', 'setTimeout', 'clearTimeout', 'requestAnimationFrame', 'cancelAnimationFrame', 'performance'] });
    const notifications = createNotificationBus();
    render(createElement(NotificationHost, { bus: notifications }));
    const mounted = await mountSettled({ notifications });
    const remove = async (): Promise<void> => {
      const target = rowsOf(mounted)[0];

      expect(target).toBeDefined();
      await act(async () => {
        mounted.result.current.onAxisRemove(target?.id ?? '');
        await Promise.resolve();
      });
    };

    await remove();
    await waitFor(() => {
      expect(notifications.list()).toHaveLength(1);
    });
    expect(screen.getByText(/^Đã xoá trục /u)).toBeTruthy();
    await act(async () => {
      vi.advanceTimersByTime(9000); // UNDO_WINDOW_MS = 8000
      await Promise.resolve();
    });
    expect(notifications.list()).toHaveLength(0);

    await remove();
    await waitFor(() => {
      expect(notifications.list()).toHaveLength(1);
    });
    expect(notifications.list()[0]?.undoTicket?.getStatus()).toBe('active');
    expect(screen.getByText(/^Đã xoá trục /u)).toBeTruthy();
  });

  it('[19-A-011] xoá, Mod+Z, xoá lại trong 5 s rồi đợi toast gộp hết: lần xoá kế vẫn hiện toast mới', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true, toFake: ['Date', 'setTimeout', 'clearTimeout', 'requestAnimationFrame', 'cancelAnimationFrame', 'performance'] });
    const notifications = createNotificationBus();
    render(createElement(NotificationHost, { bus: notifications }));
    const mounted = await mountSettled({ notifications });
    const remove = async (): Promise<void> => {
      const target = rowsOf(mounted)[0];

      expect(target).toBeDefined();
      await act(async () => {
        mounted.result.current.onAxisRemove(target?.id ?? '');
        await Promise.resolve();
      });
    };
    const advance = async (ms: number): Promise<void> => {
      await act(async () => {
        vi.advanceTimersByTime(ms);
        await Promise.resolve();
      });
    };

    await remove();
    await advance(3000);
    await act(async () => {
      mounted.result.current.onUndo();
      await Promise.resolve();
    });
    await remove(); // inside the 5 s group window of the first toast
    await waitFor(() => {
      expect(notifications.list()).toHaveLength(1);
    });
    await advance(9000);
    expect(notifications.list()).toHaveLength(0);

    await remove();
    await waitFor(() => {
      expect(notifications.list()).toHaveLength(1);
    });
    expect(screen.getByText(/^Đã xoá trục /u)).toBeTruthy();
  });

  it('[19-A-011] xoá hết các trục của một nhóm, mỗi lần cách 9 s: lần nào cũng hiện toast, kể cả trục cuối', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true, toFake: ['Date', 'setTimeout', 'clearTimeout', 'requestAnimationFrame', 'cancelAnimationFrame', 'performance'] });
    const notifications = createNotificationBus();
    render(createElement(NotificationHost, { bus: notifications }));
    const mounted = await mountSettled({ notifications });
    const firstGroupRows = () => mounted.result.current.viewModel.groups.find((group) => group.rows.length > 0)?.rows ?? [];
    const guard = firstGroupRows().length;

    expect(guard).toBeGreaterThan(0);

    for (let step = 0; step < guard; step += 1) {
      const target = firstGroupRows()[0];

      await act(async () => {
        mounted.result.current.onAxisRemove(target?.id ?? '');
        await Promise.resolve();
      });
      await waitFor(() => {
        expect(notifications.list()).toHaveLength(1);
      });
      expect(screen.getByText(/^Đã xoá trục /u)).toBeTruthy();
      await act(async () => {
        vi.advanceTimersByTime(9000);
        await Promise.resolve();
      });
      expect(notifications.list()).toHaveLength(0);
    }
  });

  it('[19-A-011, BUG-722] xoá lần hai: toast gọi trục bằng nhãn đang hiện trên hàng, không bằng nhãn cũ trong kho', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true, toFake: ['Date', 'setTimeout', 'clearTimeout', 'requestAnimationFrame', 'cancelAnimationFrame', 'performance'] });
    const notifications = createNotificationBus();
    const mounted = await mountSettled({ notifications });
    const firstGroupRows = () => mounted.result.current.viewModel.groups.find((group) => group.rows.length > 0)?.rows ?? [];
    const titles: string[] = [];
    const shown: string[] = [];

    for (let step = 0; step < 2; step += 1) {
      const target = firstGroupRows()[0];

      expect(target).toBeDefined();
      shown.push(`Đã xoá trục ${target?.label ?? ''}.`);
      await act(async () => {
        mounted.result.current.onAxisRemove(target?.id ?? '');
        await Promise.resolve();
      });
      await waitFor(() => {
        expect(notifications.list()).toHaveLength(1);
      });
      titles.push(notifications.list()[0]?.title ?? '');
      await act(async () => {
        vi.advanceTimersByTime(9000); // UNDO_WINDOW_MS = 8000; same-type toasts merge within 5 s
        await Promise.resolve();
      });
    }

    // the rows relabel after the first delete (labelAxes), so the second click is on a row that SHOWS the first label again
    expect(titles).toEqual(shown);
  });

  it('[G4b-21, G4b-24] xoá một trục: các trục còn lại giữ tên; Ctrl+Z rồi Ctrl+Shift+Z xoá lại', async () => {
    const mounted = await mountSettled();
    const labels = () => rowsOf(mounted).map((row) => row.label);

    /* Lần xoá đầu ghi bản xem trước vào kho; xoá lần hai mới là trục đã lưu. */
    await act(async () => {
      mounted.result.current.onAxisRemove(rowsOf(mounted)[0]?.id ?? '');
      await Promise.resolve();
    });
    const before = labels();
    const target = rowsOf(mounted)[1];

    expect(target).toBeDefined();
    await act(async () => {
      mounted.result.current.onAxisRemove(target?.id ?? '');
      await Promise.resolve();
    });
    await waitFor(() => {
      expect(labels()).toEqual(before.filter((label) => label !== target?.label));
    });

    await pressKey(mounted.registry, 'z', { ctrlKey: true });
    await waitFor(() => {
      expect(labels()).toEqual(before);
    });

    await act(async () => {
      mounted.registry.handleKeyDown({ key: 'z', ctrlKey: true, shiftKey: true }, null);
      await Promise.resolve();
    });
    await waitFor(() => {
      expect(labels()).toEqual(before.filter((label) => label !== target?.label));
    });
  });

  it('[G4b-20] đổi tên trục (không cho trùng) và sửa khoảng cách bằng mm', async () => {
    const mounted = await mountSettled();

    /* Lần xoá đầu ghi bản xem trước vào kho, để trục thành trục đã lưu. */
    await act(async () => {
      mounted.result.current.onAxisRemove(rowsOf(mounted)[0]?.id ?? '');
      await Promise.resolve();
    });
    const [first, second] = rowsOf(mounted);

    expect(mounted.result.current.onAxisRename(first?.id ?? '', second?.label ?? '')).toMatch(/Đã có trục/u);
    await act(async () => {
      expect(mounted.result.current.onAxisRename(first?.id ?? '', 'Z')).toBeNull();
      await Promise.resolve();
    });
    await waitFor(() => {
      expect(rowsOf(mounted).map((row) => row.label)).toContain('Z');
    });

    const target = rowsOf(mounted).find((row) => row.label === 'Z');
    await act(async () => {
      expect(mounted.result.current.onAxisSpacingChange(target?.id ?? '', 2500)).toBeNull();
      await Promise.resolve();
    });
    await waitFor(() => {
      expect(rowsOf(mounted).find((row) => row.label === 'Z')?.spacingMm).toBe(2500);
    });
  });

  it('[BUG-594] kéo một trục của bản xem trước: có tác dụng ngay, một bước hoàn tác', async () => {
    const mounted = await mountSettled({ floorId: sampleLevelId(0), gateway: previewGateway() });
    const target = rowsOf(mounted)[0];
    const axis = mounted.result.current.viewModel.canvas.axes.find((item) => item.id === target?.id);

    expect(axis).toBeDefined();

    await act(async () => {
      mounted.result.current.onAxisDrag(target?.id ?? '', pixels((axis?.startPx.y ?? 0) + 7));
      await Promise.resolve();
    });

    await waitFor(() => {
      expect(mounted.result.current.historyStepCount()).toBe(1);
    });
    expect(levelsOf(storeGraph()).some((level) => axesOfLevel(storeGraph(), level.id).length > 0)).toBe(true);
  });

  it('[BUG-594][BUG-601] "Căn chỉnh tự động" bị khoá kèm lý do khi không làm được gì', async () => {
    const viewer = await mountSettled({ roles: ['viewer'] });

    expect(viewer.result.current.autoAlignBlockedReason).toBe(AXIS_GRID_TEXT.autoAlignViewer);
    viewer.unmount();

    const mounted = await mountSettled();

    expect(mounted.result.current.autoAlignBlockedReason).toBeNull();

    await act(async () => {
      mounted.result.current.onAutoAlign();
      await Promise.resolve();
    });

    await waitFor(() => {
      expect(mounted.result.current.autoAlignBlockedReason).toBe(AXIS_GRID_TEXT.autoAlignNothing);
    });
  });
});

describe('[G22] SCR-19 vào bằng SPA tới tầng kho chưa giữ', () => {
  it('kho thiếu tầng 2 thì đọc N16 tầng 2 và hiện trục của nó, không "Chưa có trục nào"', async () => {
    const full = createAxisGridSampleGraph();
    const floor2 = AXIS_GRID_FIXTURE_FLOOR2.levelId;
    const withoutFloor2 = applyPatch(full, [{ id: floor2, kind: 'level', op: 'remove' }]);
    useStore.getState().setSpatial(withoutFloor2, null, { floorRevisions: {}, projectId: PROJECT_ID });
    const base = createMockAxisGridManagerGateway({ graph: full });
    const readLayer = vi.fn(base.readLayer);
    const mounted = mountHook({ floorId: String(floor2), gateway: { ...base, readLayer }, levelId: floor2 });

    await waitFor(() => {
      expect(mounted.result.current.viewModel.groups.some((group) => group.rows.length > 0)).toBe(true);
    });
    expect(readLayer).toHaveBeenCalledWith(expect.objectContaining({ floorId: String(floor2) }));
    mounted.unmount();
  });
});
