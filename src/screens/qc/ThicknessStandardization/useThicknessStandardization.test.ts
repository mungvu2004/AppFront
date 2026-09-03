/**
 * Nửa "suy nghĩ" của màn S-18 "Chuẩn hoá độ dày tường", kiểm không cần DOM.
 *
 * Hook được lái qua `renderHook`; tầng dữ liệu là
 * `createMockThicknessStandardizationGateway()` — CÙNG cổng story sẽ dùng
 * (R-73) — và mọi con số khẳng định đọc ra từ `thicknessFixture.ts` /
 * `thicknessStandardizationScenarios.ts`, không có bảng dữ liệu thứ hai bịa
 * tại chỗ (R-70).
 *
 * ## Sáu phép kiểm đặc tả gọi tên
 *
 * 1. áp ba nhóm cho ĐÚNG MỘT bước lịch sử, và một lượt hoàn tác trả về nguyên
 *    trạng;
 * 2. kéo ngưỡng năm lần cho ĐÚNG KHÔNG bước lịch sử — không một lượt ghi nào;
 * 3. `standardizeThickness(195) === 220` đi đúng vào nhóm đề xuất của bảng;
 * 4. "áp dụng lại bộ lọc" nêu ĐÚNG số tường đã duyệt sẽ bị đổi trước khi ghi;
 * 5. không hàng nhóm nào `accepted === true` lúc khởi tạo;
 * 6. bảy trạng thái đi qua được.
 *
 * ## Vì sao số tường đã duyệt bị ảnh hưởng KHÔNG phải `FIXTURE_REVIEWED_COUNT`
 *
 * Bộ mẫu có {@link FIXTURE_REVIEWED_COUNT} đoạn `reviewed: true`, nhưng cảnh
 * báo phải nêu số tường đã duyệt **sẽ bị đổi**, không phải số tường đã duyệt
 * nói chung: ba trong số đó không đổi được dù dung sai có nới tới đâu — một
 * đoạn đã đúng độ dày chuẩn (lệnh no-op bị `createChangeWallThicknessCommand`
 * từ chối), một đoạn thuộc cột bê tông cốt thép (không có giá trị mm để gán,
 * X2), và một đoạn lệch quá dung sai. Bài kiểm vì thế đếm lại con số đó TỪ bộ
 * mẫu bằng chính `standardizeThickness`, chứ không gõ tay và cũng không nới
 * khẳng định cho vừa mã (R-70).
 */

import { createElement, type ReactNode } from 'react';
import { QueryClientProvider } from '@tanstack/react-query';
import { act, cleanup, renderHook, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import type { Wall, WallId } from '@/domain/spatial/types';
import { createHistoryStack, type HistoryStack } from '@/lib/commands/history';
import { standardizeThickness } from '@/lib/geometry/standardize';
import { createNotificationBus, type NotificationBus } from '@/lib/mutations/notificationBus';
import { createTestQueryClient } from '@/lib/testing/render';
import { SEVEN_STATES } from '@/lib/testing/sevenStateScenarios';
import { resetSelectorCaches } from '@/store/selectors';
import { useStore } from '@/store';

import {
  FIXTURE_EXCEEDING_COUNT,
  FIXTURE_MEASURED_195_COUNT,
  FIXTURE_REVIEWED_COUNT,
  FIXTURE_SEGMENT_COUNT,
  THICKNESS_FIXTURE_LEVELS,
  THICKNESS_FIXTURE_WALLS,
} from './thicknessFixture';
import {
  createMockThicknessStandardizationGateway,
  deviationOf,
  groupOfMeasurement,
  isDefaultThresholds,
  sortThresholds,
  thicknessGraphOf,
  withThresholdAt,
} from './thicknessStandardizationGateway';
import {
  THICKNESS_SCENARIO_COLLAPSED,
  THICKNESS_SCENARIO_EMPTY,
  THICKNESS_SCENARIO_ERROR,
  THICKNESS_SCENARIO_FORBIDDEN,
  THICKNESS_SCENARIO_LOADING,
  THICKNESS_SCENARIO_PARTIAL,
  THICKNESS_STANDARDIZATION_SCENARIOS,
  type ThicknessStandardizationScenario,
} from './thicknessStandardizationScenarios';
import {
  DEFAULT_THICKNESS_THRESHOLDS,
  DEFAULT_TOLERANCE_MM,
  type ThicknessThresholds,
} from './thicknessTypes';
import {
  deriveThicknessScreenState,
  sortSegmentRows,
  useThicknessStandardization,
  type UseThicknessStandardizationOptions,
  type UseThicknessStandardizationResult,
} from './useThicknessStandardization';

/* -------------------------------------------------------------------------- */
/* Bộ mẫu — đọc ra, không viết tay lại.                                        */
/* -------------------------------------------------------------------------- */

const PROJECT_ID = 'project-1';
const FLOOR_ID = THICKNESS_FIXTURE_LEVELS[0]?.id ?? '';

const graphOfScenario = (
  scenario: ThicknessStandardizationScenario,
): ReturnType<typeof thicknessGraphOf> => thicknessGraphOf(scenario.walls, scenario.levels);

/** Sai lệch của một đoạn so với nhóm M-05 gán cho nó, đếm lại từ bộ mẫu. */
function fixtureDeviationOf(wall: Wall): number | null {
  const { standardized } = standardizeThickness(wall.thicknessMm);

  return typeof standardized === 'number'
    ? deviationOf(wall.thicknessMm, standardized)
    : null;
}

/** Những đoạn ĐÃ DUYỆT mà một lượt chuẩn hoá thật sự đổi được — xem ghi chú đầu file. */
const REVIEWED_AND_CHANGEABLE: readonly Wall[] = THICKNESS_FIXTURE_WALLS.filter((wall) => {
  const deviation = fixtureDeviationOf(wall);

  return wall.reviewed && deviation !== null && deviation !== 0 && deviation <= DEFAULT_TOLERANCE_MM;
});

/** Ba số đo dùng cho bài "áp ba nhóm" — mỗi số một nhóm chuẩn khác nhau. */
const THREE_MEASUREMENTS = [100, 195, 315] as const;

const wallsOfMeasurement = (measuredMm: number): readonly Wall[] =>
  THICKNESS_FIXTURE_WALLS.filter((wall) => wall.thicknessMm === measuredMm);

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
  readonly result: { current: UseThicknessStandardizationResult };
  readonly history: HistoryStack;
  readonly unmount: () => void;
}

type MountOptions = Partial<UseThicknessStandardizationOptions>;

function mountHook(options: MountOptions = {}): Mounted {
  const queryClient = createTestQueryClient();
  const history = options.history ?? createHistoryStack();
  const wrapper = ({ children }: { children: ReactNode }): ReactNode =>
    createElement(QueryClientProvider, { client: queryClient }, children);

  const rendered = renderHook(
    () =>
      useThicknessStandardization({
        projectId: options.projectId ?? PROJECT_ID,
        floorId: options.floorId ?? FLOOR_ID,
        roles: options.roles ?? ['engineer'],
        gateway: options.gateway ?? createMockThicknessStandardizationGateway(),
        history,
        ...(options.notifications === undefined ? {} : { notifications: options.notifications }),
        ...(options.forceCollapsed === undefined
          ? {}
          : { forceCollapsed: options.forceCollapsed }),
      }),
    { wrapper },
  );

  return { result: rendered.result, history, unmount: rendered.unmount };
}

/** Chờ lượt đọc lớp số đo xong — trước đó mọi kịch bản đều là `'loading'`. */
async function mountSettled(options: MountOptions = {}): Promise<Mounted> {
  const mounted = mountHook(options);

  await waitFor(() => {
    expect(mounted.result.current.state).not.toBe('loading');
  });

  return mounted;
}

/** Dựng hook trên đúng một kịch bản của bảy. */
async function mountScenario(scenario: ThicknessStandardizationScenario): Promise<Mounted> {
  return mountSettled({
    roles: scenario.isViewerRole ? ['viewer'] : ['engineer'],
    forceCollapsed: scenario.isCollapsed,
    gateway: createMockThicknessStandardizationGateway({
      graph: graphOfScenario(scenario),
      failReadThicknessLayer: scenario.error !== null,
    }),
  });
}

/** Độ dày hiện tại của một tường, đọc THẲNG từ kho — không qua viewmodel. */
const thicknessInStore = (wallId: WallId): number | undefined => {
  const graph = useStore.getState().spatial;
  const wall = graph === null ? undefined : (graph.byId[wallId] as Wall | undefined);

  return wall?.thicknessMm;
};

/** Tích đồng ý cho một danh sách số đo, rồi mở bảng xem trước. */
function acceptAndPreview(mounted: Mounted, measurements: readonly number[]): void {
  act(() => {
    for (const measuredMm of measurements) {
      mounted.result.current.onToggleAccepted(measuredMm, true);
    }
  });

  act(() => {
    mounted.result.current.onOpenPreview();
  });
}

/* -------------------------------------------------------------------------- */
/* Phép ghép thuần — kiểm được mà không cần dựng hook.                          */
/* -------------------------------------------------------------------------- */

describe('phép ghép thuần của màn Chuẩn hoá độ dày tường', () => {
  it('gán nhóm ở ngưỡng mặc định ĐÚNG là standardizeThickness, cả 48 đoạn', () => {
    expect(isDefaultThresholds(DEFAULT_THICKNESS_THRESHOLDS)).toBe(true);

    for (const wall of THICKNESS_FIXTURE_WALLS) {
      expect(groupOfMeasurement(wall.thicknessMm, DEFAULT_THICKNESS_THRESHOLDS)).toBe(
        standardizeThickness(wall.thicknessMm).standardized,
      );
    }

    /* Ba đường biên, đúng chỗ dễ trôi nhất. */
    for (const boundaryMm of DEFAULT_THICKNESS_THRESHOLDS) {
      expect(groupOfMeasurement(boundaryMm, DEFAULT_THICKNESS_THRESHOLDS)).toBe(
        standardizeThickness(boundaryMm).standardized,
      );
    }

    expect(groupOfMeasurement(195, DEFAULT_THICKNESS_THRESHOLDS)).toBe(220);
  });

  it('kéo một ngưỡng thì ba ngưỡng vẫn tăng dần', () => {
    const dragged = withThresholdAt(DEFAULT_THICKNESS_THRESHOLDS, 0, 400);

    expect(dragged).toEqual(sortThresholds(dragged));
    expect(isDefaultThresholds(dragged)).toBe(false);
  });

  it('kéo ngưỡng đổi nhóm của số đo nằm giữa hai ngưỡng', () => {
    const dragged: ThicknessThresholds = withThresholdAt(DEFAULT_THICKNESS_THRESHOLDS, 0, 200);

    expect(groupOfMeasurement(195, DEFAULT_THICKNESS_THRESHOLDS)).toBe(220);
    expect(groupOfMeasurement(195, dragged)).toBe(110);
  });

  it('sai lệch của cột bê tông cốt thép luôn bằng không', () => {
    expect(deviationOf(450, 'CONCRETE_COLUMN')).toBe(0);
    expect(deviationOf(195, 220)).toBe(25);
    expect(deviationOf(345, 330)).toBe(15);
  });

  it('bảy trạng thái đi đúng thứ tự ưu tiên', () => {
    const base = {
      isViewerRole: false,
      isCollapsed: false,
      hasError: false,
      isLoading: false,
      segmentCount: FIXTURE_SEGMENT_COUNT,
      applicableCount: 1,
      hasApplied: false,
    } as const;

    expect(deriveThicknessScreenState({ ...base, isViewerRole: true })).toBe('forbidden');
    expect(deriveThicknessScreenState({ ...base, isCollapsed: true })).toBe('collapsed');
    expect(deriveThicknessScreenState({ ...base, hasError: true })).toBe('error');
    expect(deriveThicknessScreenState({ ...base, isLoading: true })).toBe('loading');
    expect(deriveThicknessScreenState({ ...base, segmentCount: 0 })).toBe('empty');
    expect(deriveThicknessScreenState({ ...base, applicableCount: 0 })).toBe('empty');
    expect(
      deriveThicknessScreenState({ ...base, applicableCount: 0, hasApplied: true }),
    ).toBe('success');
    expect(deriveThicknessScreenState(base)).toBe('partial');
  });

  it('bảng chi tiết mặc định đưa trường hợp tệ nhất lên đầu', async () => {
    const mounted = await mountSettled();
    const rows = mounted.result.current.segmentRows;
    const worst = rows[0];

    expect(mounted.result.current.sortKey).toBe('deviation');
    expect(worst?.deviationMm).toBe(
      sortSegmentRows(rows, 'deviation')[0]?.deviationMm,
    );
    expect(worst?.exceedsTolerance).toBe(true);
  });
});

/* -------------------------------------------------------------------------- */
/* 3 + 5. Bảng nhóm: 195 mm về 220 mm, và KHÔNG hàng nào tích sẵn.             */
/* -------------------------------------------------------------------------- */

describe('bảng nhóm', () => {
  it('30 đoạn 195 mm rơi đúng vào nhóm 220 mm', async () => {
    const mounted = await mountSettled();
    const row = mounted.result.current.groupRows.find((entry) => entry.measuredMm === 195);

    console.log(
      `[S-18] 195 mm → ${String(row?.suggestedGroup)} · ${String(row?.wallCount)} đoạn`,
    );

    expect(row?.suggestedGroup).toBe(standardizeThickness(195).standardized);
    expect(row?.suggestedGroup).toBe(220);
    expect(row?.wallCount).toBe(FIXTURE_MEASURED_195_COUNT);
  });

  it('KHÔNG hàng nhóm nào tích sẵn lúc khởi tạo', async () => {
    const mounted = await mountSettled();

    expect(mounted.result.current.groupRows.length).toBeGreaterThan(0);
    expect(mounted.result.current.groupRows.every((row) => !row.accepted)).toBe(true);
    expect(mounted.result.current.preview).toBeNull();
    expect(mounted.history.undoSteps()).toHaveLength(0);
  });

  it('bốn con số tóm tắt đếm đúng bộ mẫu', async () => {
    const mounted = await mountSettled();
    const summary = mounted.result.current.summary;

    console.log(
      `[S-18] tóm tắt = ${String(summary.segmentCount)} đoạn · ${String(summary.normalizedCount)} đã chuẩn · ${String(summary.exceedingToleranceCount)} lệch quá dung sai · ${String(summary.concreteColumnCount)} cột bê tông cốt thép`,
    );

    expect(summary.segmentCount).toBe(FIXTURE_SEGMENT_COUNT);
    expect(summary.exceedingToleranceCount).toBe(FIXTURE_EXCEEDING_COUNT);
    expect(summary.concreteColumnCount).toBeGreaterThan(0);
  });
});

/* -------------------------------------------------------------------------- */
/* 2. Kéo ngưỡng là thao tác THUẦN.                                            */
/* -------------------------------------------------------------------------- */

describe('kéo ngưỡng', () => {
  it('kéo qua lại năm lần cho ĐÚNG KHÔNG bước lịch sử và không một lượt ghi nào', async () => {
    const notifications: NotificationBus = createNotificationBus();
    const mounted = await mountSettled({ notifications });

    const graphBefore = useStore.getState().spatial;
    const thicknessBefore = THICKNESS_FIXTURE_WALLS.map((wall) => thicknessInStore(wall.id));

    act(() => {
      mounted.result.current.onThresholdDrag(0, 150);
    });
    act(() => {
      mounted.result.current.onThresholdDrag(0, 180);
    });
    act(() => {
      mounted.result.current.onThresholdDrag(1, 260);
    });
    act(() => {
      mounted.result.current.onThresholdDrag(1, 275);
    });
    act(() => {
      mounted.result.current.onThresholdDrag(2, 360);
    });

    console.log(
      `[S-18] sau 5 lượt kéo: ${String(mounted.history.undoSteps().length)} bước lịch sử · ngưỡng = ${mounted.result.current.thresholdLabels.join(' · ')}`,
    );

    /* KHÔNG một lượt ghi nào: ngăn xếp trống, kho giữ nguyên THAM CHIẾU cũ. */
    expect(mounted.history.undoSteps()).toHaveLength(0);
    expect(mounted.history.canUndo()).toBe(false);
    expect(useStore.getState().spatial).toBe(graphBefore);
    expect(THICKNESS_FIXTURE_WALLS.map((wall) => thicknessInStore(wall.id))).toEqual(
      thicknessBefore,
    );
    expect(notifications.list()).toHaveLength(0);

    /* Nhưng bảng và nhãn thì ĐÃ tính lại theo ngưỡng mới. */
    expect(mounted.result.current.thresholds).toEqual([180, 275, 360]);
    expect(mounted.result.current.thresholdLabels).toHaveLength(
      DEFAULT_THICKNESS_THRESHOLDS.length,
    );
    expect(mounted.result.current.segmentRows).toHaveLength(FIXTURE_SEGMENT_COUNT);
  });
});

/* -------------------------------------------------------------------------- */
/* 1. Áp ba nhóm → MỘT bước lịch sử, một lượt hoàn tác trả nguyên trạng.       */
/* -------------------------------------------------------------------------- */

describe('áp chuẩn hoá', () => {
  it('bảng xem trước dựng câu từ dữ liệu thật và KHÔNG đổi một độ dày nào', async () => {
    const mounted = await mountSettled();
    const measurements = mounted.result.current.groupRows.map((row) => row.measuredMm);

    acceptAndPreview(mounted, measurements);

    const preview = mounted.result.current.preview;

    console.log(`[S-18] câu xem trước = ${String(preview?.sentence)}`);

    expect(preview).not.toBeNull();
    expect(preview?.totalWalls).toBe(FIXTURE_SEGMENT_COUNT);
    expect(preview?.unchangedWalls).toHaveLength(FIXTURE_EXCEEDING_COUNT);
    expect(preview?.sentence).toBe(
      '48 tường → 3 nhóm chuẩn. 6 tường lệch quá 30 mm sẽ không đổi.',
    );

    /* Xem trước là XEM: ngăn xếp vẫn trống, kho chưa đổi một số nào. */
    expect(mounted.history.undoSteps()).toHaveLength(0);
    expect(thicknessInStore(wallsOfMeasurement(195)[0]?.id as WallId)).toBe(195);
  });

  it('áp ba nhóm cho ĐÚNG MỘT bước lịch sử, và hoàn tác trả về nguyên trạng', async () => {
    const notifications: NotificationBus = createNotificationBus();
    const mounted = await mountSettled({ notifications });

    acceptAndPreview(mounted, THREE_MEASUREMENTS);

    const targets = THREE_MEASUREMENTS.flatMap((measuredMm) => wallsOfMeasurement(measuredMm));

    expect(targets.length).toBeGreaterThan(0);

    await act(async () => {
      mounted.result.current.onApplyPreview();
      await Promise.resolve();
    });

    await waitFor(() => {
      expect(mounted.history.undoSteps()).toHaveLength(1);
    });

    console.log(
      `[S-18] áp ${String(THREE_MEASUREMENTS.length)} nhóm (${String(targets.length)} tường) = ${String(mounted.history.undoSteps().length)} bước lịch sử`,
    );

    /* MỘT bước cho cả lô — CẤM TUYỆT ĐỐI "không tách thành nhiều bước hoàn tác". */
    expect(mounted.history.undoSteps()).toHaveLength(1);
    expect(mounted.history.undoSteps()[0]?.commands).toHaveLength(targets.length);

    for (const wall of targets) {
      expect(thicknessInStore(wall.id)).toBe(standardizeThickness(wall.thicknessMm).standardized);
    }

    /* A8: một lượt áp = MỘT toast, MỘT vé tám giây. */
    const published = notifications.list();
    const ticket = published[0]?.undoTicket;

    expect(published).toHaveLength(1);
    expect(ticket?.getStatus()).toBe('active');

    await act(async () => {
      ticket?.undo();
      await Promise.resolve();
    });

    await waitFor(() => {
      expect(thicknessInStore(targets[0]?.id as WallId)).toBe(targets[0]?.thicknessMm);
    });

    for (const wall of targets) {
      expect(thicknessInStore(wall.id)).toBe(wall.thicknessMm);
    }

    expect(mounted.history.undoSteps()).toHaveLength(0);
    expect(mounted.history.canRedo()).toBe(true);
  });

  it('áp xong thì M-04 dựng lại hình tường của phần xem trước', async () => {
    const mounted = await mountSettled();
    const target = wallsOfMeasurement(195)[0] as Wall;

    const shapesBefore = mounted.result.current.shapes;

    expect(shapesBefore.length).toBeGreaterThan(0);

    acceptAndPreview(mounted, [195]);

    await act(async () => {
      mounted.result.current.onApplyPreview();
      await Promise.resolve();
    });

    await waitFor(() => {
      expect(thicknessInStore(target.id)).toBe(220);
    });

    const shapesAfter = mounted.result.current.shapes;

    console.log(
      `[S-18] hình tường sau khi áp: ${String(shapesAfter.length)} đa giác, nhóm của ${target.id} = ${String(shapesAfter.find((shape) => shape.wallId === target.id)?.group)}`,
    );

    /* Đa giác được dựng LẠI: cùng số hình, nhưng không phải cùng object cũ. */
    expect(shapesAfter).toHaveLength(shapesBefore.length);
    expect(shapesAfter).not.toBe(shapesBefore);
    expect(shapesAfter.find((shape) => shape.wallId === target.id)?.group).toBe(220);
  });

  it('gán một nhóm cho các hàng đang chọn cũng chỉ một bước lịch sử', async () => {
    const mounted = await mountSettled();
    const chosen = wallsOfMeasurement(195).slice(0, 3);

    act(() => {
      mounted.result.current.onToggleAllSelected(false);
    });

    act(() => {
      for (const wall of chosen) {
        mounted.result.current.onToggleRowSelected(wall.id, true);
      }
    });

    expect(mounted.result.current.selectedWallIds).toHaveLength(chosen.length);

    await act(async () => {
      mounted.result.current.onApplySelectedGroup(330);
      await Promise.resolve();
    });

    await waitFor(() => {
      expect(mounted.history.undoSteps()).toHaveLength(1);
    });

    for (const wall of chosen) {
      expect(thicknessInStore(wall.id)).toBe(330);
    }

    expect(mounted.result.current.flashingWallIds).toHaveLength(chosen.length);

    act(() => {
      mounted.result.current.onClearSelection();
    });

    expect(mounted.result.current.selectedWallIds).toHaveLength(0);
  });

  it('sửa gợi ý nhóm của một hàng là thao tác thuần', async () => {
    const mounted = await mountSettled();
    const target = wallsOfMeasurement(195)[0] as Wall;

    act(() => {
      mounted.result.current.onChangeNormalizedGroup(target.id, 330);
    });

    const row = mounted.result.current.segmentRows.find((entry) => entry.wallId === target.id);

    expect(row?.normalizedGroup).toBe(330);
    expect(row?.deviationMm).toBe(deviationOf(195, 330));
    expect(mounted.history.undoSteps()).toHaveLength(0);
    expect(thicknessInStore(target.id)).toBe(195);
  });
});

/* -------------------------------------------------------------------------- */
/* 4. Áp dụng lại bộ lọc — không bao giờ ghi đè im lặng tường đã duyệt.        */
/* -------------------------------------------------------------------------- */

describe('áp dụng lại bộ lọc', () => {
  it('lượt bấm đầu chỉ cảnh báo, và nêu ĐÚNG số tường đã duyệt sẽ bị đổi', async () => {
    const mounted = await mountSettled();

    expect(mounted.result.current.reapplyWarning).toBeNull();

    act(() => {
      mounted.result.current.onReapplyFilter(false);
    });

    const warning = mounted.result.current.reapplyWarning;

    console.log(
      `[S-18] áp dụng lại bộ lọc: ${String(warning?.affectedReviewedCount)} tường đã duyệt sẽ bị đổi (bộ mẫu có ${String(FIXTURE_REVIEWED_COUNT)} tường đã duyệt)`,
    );

    expect(REVIEWED_AND_CHANGEABLE.length).toBeGreaterThan(0);
    expect(REVIEWED_AND_CHANGEABLE.length).toBeLessThan(FIXTURE_REVIEWED_COUNT);
    expect(warning?.affectedReviewedCount).toBe(REVIEWED_AND_CHANGEABLE.length);
    expect(warning?.affectedWallIds).toHaveLength(REVIEWED_AND_CHANGEABLE.length);
    expect(warning?.excludeReviewed).toBe(false);

    /* Cảnh báo là CẢNH BÁO: chưa một độ dày nào đổi. */
    expect(mounted.history.undoSteps()).toHaveLength(0);

    for (const wall of REVIEWED_AND_CHANGEABLE) {
      expect(thicknessInStore(wall.id)).toBe(wall.thicknessMm);
    }
  });

  it('chọn "loại chúng ra" thì tường đã duyệt giữ nguyên, tường còn lại vẫn đổi', async () => {
    const mounted = await mountSettled();

    await act(async () => {
      mounted.result.current.onReapplyFilter(true);
      await Promise.resolve();
    });

    await waitFor(() => {
      expect(mounted.history.undoSteps()).toHaveLength(1);
    });

    /* Tường đã duyệt: NGUYÊN VẸN. */
    for (const wall of REVIEWED_AND_CHANGEABLE) {
      expect(thicknessInStore(wall.id)).toBe(wall.thicknessMm);
    }

    /* Tường chưa duyệt mà đổi được: đã về nhóm chuẩn. */
    const changed = THICKNESS_FIXTURE_WALLS.filter((wall) => {
      const deviation = fixtureDeviationOf(wall);

      return (
        !wall.reviewed && deviation !== null && deviation !== 0 && deviation <= DEFAULT_TOLERANCE_MM
      );
    });

    expect(changed.length).toBeGreaterThan(0);

    for (const wall of changed) {
      expect(thicknessInStore(wall.id)).toBe(standardizeThickness(wall.thicknessMm).standardized);
    }
  });

  it('xác nhận lần hai thì ghi cả tường đã duyệt — nhưng chỉ sau khi đã cảnh báo', async () => {
    const mounted = await mountSettled();

    act(() => {
      mounted.result.current.onReapplyFilter(false);
    });

    expect(mounted.result.current.reapplyWarning).not.toBeNull();
    expect(mounted.history.undoSteps()).toHaveLength(0);

    await act(async () => {
      mounted.result.current.onReapplyFilter(false);
      await Promise.resolve();
    });

    await waitFor(() => {
      expect(mounted.history.undoSteps()).toHaveLength(1);
    });

    expect(mounted.result.current.reapplyWarning).toBeNull();

    for (const wall of REVIEWED_AND_CHANGEABLE) {
      expect(thicknessInStore(wall.id)).toBe(standardizeThickness(wall.thicknessMm).standardized);
    }
  });
});

/* -------------------------------------------------------------------------- */
/* 6. Bảy trạng thái (A11/R-63).                                               */
/* -------------------------------------------------------------------------- */

describe('bảy trạng thái', () => {
  it('bảy kịch bản phủ đúng bảy nhánh của SEVEN_STATES', () => {
    expect(THICKNESS_STANDARDIZATION_SCENARIOS.map((scenario) => scenario.state)).toEqual([
      ...SEVEN_STATES,
    ]);
  });

  it('kịch bản đang tải cho đúng trạng thái của nó trước khi số đo tới', () => {
    const mounted = mountHook({
      gateway: createMockThicknessStandardizationGateway({
        graph: graphOfScenario(THICKNESS_SCENARIO_LOADING),
      }),
    });

    expect(mounted.result.current.state).toBe(THICKNESS_SCENARIO_LOADING.state);
    expect(mounted.result.current.isLoading).toBe(true);
  });

  it.each([
    ['rỗng', THICKNESS_SCENARIO_EMPTY],
    ['một phần', THICKNESS_SCENARIO_PARTIAL],
    ['lỗi', THICKNESS_SCENARIO_ERROR],
    ['không có quyền', THICKNESS_SCENARIO_FORBIDDEN],
    ['thu gọn', THICKNESS_SCENARIO_COLLAPSED],
  ])('kịch bản %s cho đúng trạng thái của nó', async (_label, scenario) => {
    const mounted = await mountScenario(scenario);

    expect(mounted.result.current.state).toBe(scenario.state);
  });

  it('kịch bản xong tới nơi bằng một lượt áp thật', async () => {
    const mounted = await mountSettled();
    const measurements = mounted.result.current.groupRows.map((row) => row.measuredMm);

    acceptAndPreview(mounted, measurements);

    await act(async () => {
      mounted.result.current.onApplyPreview();
      await Promise.resolve();
    });

    await waitFor(() => {
      expect(mounted.result.current.state).toBe('success');
    });

    expect(mounted.history.undoSteps()).toHaveLength(1);
    expect(mounted.result.current.emptyNotice).toBeNull();
  });

  it('trạng thái rỗng nói ra bước đi tiếp', async () => {
    const mounted = await mountScenario(THICKNESS_SCENARIO_EMPTY);

    expect(mounted.result.current.state).toBe('empty');
    expect(mounted.result.current.emptyNotice).not.toBeNull();
    expect(mounted.result.current.emptyNotice ?? '').toContain('dung sai');
  });

  it('trạng thái lỗi có câu lỗi, và hai bảng vẫn đọc được', async () => {
    const mounted = await mountScenario(THICKNESS_SCENARIO_ERROR);

    expect(mounted.result.current.state).toBe('error');
    expect(mounted.result.current.errorMessage).not.toBeNull();
    expect(mounted.result.current.bins).toEqual([]);
  });

  it('vai Người xem có câu giải thích và mọi lượt ghi đều tắt', async () => {
    const mounted = await mountScenario(THICKNESS_SCENARIO_FORBIDDEN);
    const target = wallsOfMeasurement(195)[0] as Wall;

    expect(mounted.result.current.isViewerRole).toBe(true);
    expect(mounted.result.current.viewerRoleNotice).not.toBeNull();

    acceptAndPreview(mounted, [195]);

    await act(async () => {
      mounted.result.current.onApplyPreview();
      mounted.result.current.onReapplyFilter(true);
      await Promise.resolve();
    });

    expect(mounted.history.undoSteps()).toHaveLength(0);
    expect(thicknessInStore(target.id)).toBe(195);
  });
});
