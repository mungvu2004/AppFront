/**
 * Nửa "suy nghĩ" của màn Đối chiếu bản vẽ, kiểm không cần DOM của màn.
 *
 * Hook được lái qua `renderHook`, và tầng dữ liệu là `createMockApiClient()` của
 * `src/api/__mocks__/client.ts` đi qua chính `createOverlayComparisonGateway` —
 * cùng phép ánh xạ bản sản phẩm dùng, nên test không dựng một ý niệm thứ hai về
 * hình dạng câu trả lời (R-70). Đồ thị trong store là bộ mẫu chuẩn của A14
 * (`createCleanBuildingScenario`), bốn tầng của nó khớp đúng bốn tầng mà lượt đo
 * chất lượng của bộ mẫu trả về.
 *
 * ## Ba con số nghiệm thu không được viết vào cổng giả
 *
 * Trung bình 8 mm · lớn nhất 41 mm · vượt 20 mm là 3 vùng là **thuộc tính của
 * `SAMPLE_DEVIATIONS_MM`** trong `overlayComparisonScenarios.ts`. Cổng giả ở đây
 * tính chúng từ chính bộ số đó — và đếm bằng `countOverTolerance` của cùng file,
 * tức phép so sánh ngặt (`> dung sai`) do bộ dữ liệu chốt chứ không do test chốt.
 * Không con số nào trong ba con số đó được gán tay ở đâu trong file này ngoài
 * phần khẳng định.
 *
 * ## Vùng lệch được nạp vào theo thứ tự NGƯỢC
 *
 * `SAMPLE_DEVIATIONS_MM` đã sắp tệ nhất lên đầu. Nếu nạp nguyên xi thì một hook
 * quên sắp xếp vẫn qua bài. Nên cổng giả trả về bộ đảo ngược — nhẹ nhất lên
 * trước — và phép "sắp tệ nhất lên đầu" phải có việc thật để làm.
 *
 * ## Vì sao đặt "giảm chuyển động"
 *
 * `useCountUp` chạy `overToleranceCount` trong 260 ms. Dưới "giảm chuyển động"
 * nó là một lát cắt: con số ĐÚNG ngay ở khung hình đầu, nên phép kiểm nói về
 * giá trị chứ không về thời điểm lấy mẫu. Bản thân lượt chạy số là việc của
 * `useCountUp` và đã có test riêng ở `src/hooks/useCountUp.test.ts`.
 */

import { createElement, type ReactNode } from 'react';
import { QueryClientProvider } from '@tanstack/react-query';
import { act, cleanup, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { createMockApiClient } from '@/api/__mocks__/client';
import { createSampleBuilding, sampleLevelId } from '@/domain/spatial/__fixtures__/sampleBuilding';
import { normalizeSpatial } from '@/domain/spatial/normalize';
import type { Level, LevelId } from '@/domain/spatial/types';
import { millimetresPerPixel } from '@/domain/units/scale';
import { MISSING_VALUE } from '@/lib/format/number';
import { MOTION_DURATIONS_MS } from '@/lib/motion/tokens';
import { installFakeClock, type FakeClock } from '@/lib/testing/fakeClock';
import { createTestQueryClient } from '@/lib/testing/render';
import { SEVEN_STATES } from '@/lib/testing/sevenStateScenarios';
import { ROUTES } from '@/routes/paths';
import { useStore } from '@/store';
import type { ProjectRole } from '@/types/project';

import {
  clearConfirmedMatches,
  createOverlayComparisonGateway,
  withOverlayCapabilities,
  type EvaluateToleranceInput,
  type OverlayCapabilityResult,
  type OverlayComparisonGateway,
  type OverlayDeviationRegion,
  type OverlayScanSnapshot,
  type OverlayToleranceEvaluation,
} from './overlayComparisonGateway';
import {
  buildMarks,
  buildRows,
  countOverTolerance,
  DEFAULT_TOLERANCE_MM,
  RELAXED_TOLERANCE_MM,
  SAMPLE_DEVIATIONS_MM,
  UNMEASURED_METRICS,
} from './overlayComparisonScenarios';
import { OVERLAY_MISSING_CAPABILITIES, type OverlayComparisonState } from './types';
import {
  useOverlayComparison,
  type UseOverlayComparisonResult,
} from './useOverlayComparison';

/* -------------------------------------------------------------------------- */
/* Bộ mẫu và cách nối hai bộ dữ liệu đã có.                                    */
/* -------------------------------------------------------------------------- */

const PROJECT_ID = 'project-1';

/** Số nhịp đồng hồ giả một lượt đọc của bộ mẫu cần để về. */
const SETTLE_TURNS = 20;

/** Dung sai biên: 21 mm loại đúng vùng 21 mm, vì phép so sánh là ngặt. */
const BOUNDARY_TOLERANCE_MM = 21;

const FLOOR_WITH_SCAN = sampleLevelId(0);
const FLOOR_WARPED = sampleLevelId(1);
const FLOOR_WITHOUT_SCAN = sampleLevelId(2);

/**
 * Tầng nào của bộ mẫu chuẩn lấy ảnh của tầng nào trong lượt đo chất lượng.
 *
 * Hai bộ dữ liệu đã có sẵn và mang hai hệ mã khác nhau (`L-LEVEL000000` với
 * `L2`), nên test NỐI chúng lại chứ không dựng bộ thứ ba. `L2` đã đo và tìm
 * được khung bản vẽ; `L1` đã đo nhưng KHÔNG tìm được khung; `L-1` và `L3` chưa
 * đo, tức không có ảnh đã nắn để đối chiếu.
 */
const LEVEL_BY_MOCK_FLOOR: Readonly<Record<string, LevelId>> = {
  L2: sampleLevelId(0),
  L1: sampleLevelId(1),
  'L-1': sampleLevelId(2),
  L3: sampleLevelId(3),
};

/* -------------------------------------------------------------------------- */
/* Môi trường.                                                                 */
/* -------------------------------------------------------------------------- */

let clock: FakeClock;

/**
 * jsdom không có `matchMedia`.
 *
 * "Giảm chuyển động" bật, nên `useCountUp` là một lát cắt; khung rộng, nên
 * `collapsed` chỉ đến khi test tự ép.
 */
function installMatchMedia(): void {
  Object.defineProperty(window, 'matchMedia', {
    writable: true,
    value: vi.fn().mockImplementation((query: string) => ({
      matches: query.includes('prefers-reduced-motion'),
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
  installMatchMedia();
  clock = installFakeClock();
  clearConfirmedMatches();
  seedStore();
});

afterEach(() => {
  cleanup();
  clock.restore();
  vi.restoreAllMocks();
});

/** Bốn tầng của bộ mẫu chuẩn A14, trong store, với một vai sửa được. */
function seedStore(floors?: readonly Level[], roles: readonly ProjectRole[] = ['engineer']): void {
  const graph = createSampleBuilding();
  const store = useStore.getState();

  store.setSpatial(normalizeSpatial(graph), 'version-1');
  store.setFloors(floors ?? graph.levels);
  store.setActiveFloor(FLOOR_WITH_SCAN);
  store.setUserRoles(roles);
  useStore.temporal.getState().clear();
}

/* -------------------------------------------------------------------------- */
/* Bộ dựng cổng.                                                               */
/* -------------------------------------------------------------------------- */

/**
 * Ảnh quét của bốn tầng, đọc qua ĐÚNG phép ánh xạ của cổng thật.
 *
 * Chỉ mã tầng bị đổi sang hệ mã của bộ mẫu chuẩn; `imageUrl`, `widthPx`,
 * `heightPx` và `isFrameFound` đều do `createOverlayComparisonGateway` sinh ra.
 */
async function readMockScans(
  base: OverlayComparisonGateway,
): Promise<readonly OverlayScanSnapshot[]> {
  const result = await base.readFloorScans({ floorId: 'L2', projectId: PROJECT_ID });

  if (!result.ok) {
    throw new Error('Không đọc được lượt đo chất lượng của bộ mẫu.');
  }

  return result.data.flatMap((snapshot) => {
    const levelId = LEVEL_BY_MOCK_FLOOR[snapshot.floorId];

    return levelId === undefined ? [] : [{ ...snapshot, floorId: levelId }];
  });
}

/**
 * Mười bốn vùng lệch, dựng từ chính bộ mẫu đã đóng băng.
 *
 * Vị trí tham chiếu và mã đối tượng lấy từ `buildRows`, hộp gạch chéo lấy từ
 * `buildMarks`, độ lệch lấy từ `SAMPLE_DEVIATIONS_MM` — không bảng dữ liệu nào
 * được bịa ở đây. Kết quả trả về theo thứ tự NGƯỢC để phép sắp xếp của hook có
 * việc thật để làm.
 */
function sampleRegions(): readonly OverlayDeviationRegion[] {
  const rows = buildRows(SAMPLE_DEVIATIONS_MM, DEFAULT_TOLERANCE_MM);
  const marks = buildMarks(SAMPLE_DEVIATIONS_MM, DEFAULT_TOLERANCE_MM);

  const regions = SAMPLE_DEVIATIONS_MM.flatMap((deviationMm, index) => {
    const row = rows[index];
    const mark = marks[index];

    if (row === undefined || mark === undefined) {
      return [];
    }

    return [
      {
        id: row.id,
        referenceLabel: row.referenceLabel,
        affectedObjectCode: row.affectedObjectCode,
        deviationMm,
        box: mark.box,
        measurement: {
          from: { x: mark.box.x, y: mark.box.y },
          to: { x: mark.box.x + mark.box.width, y: mark.box.y + mark.box.height },
        },
      },
    ];
  });

  return [...regions].reverse();
}

/**
 * Phép tổng hợp mà `src/domain/overlay` sẽ nhận lại khi nó về.
 *
 * Con số đếm đi qua `countOverTolerance` của bộ mẫu, nên luật "ngặt" nằm ở một
 * chỗ duy nhất và test không có cơ hội nói khác nó.
 */
function evaluateSample(
  input: EvaluateToleranceInput,
): OverlayCapabilityResult<OverlayToleranceEvaluation> {
  const deviations = input.regions.map((region) => region.deviationMm);

  if (deviations.length === 0) {
    return { supported: false, capability: 'matchMetrics', missing: 'bộ mẫu rỗng' };
  }

  const total = deviations.reduce((sum, value) => sum + value, 0);

  return {
    supported: true,
    value: {
      meanMm: total / deviations.length,
      maxMm: deviations.reduce((worst, value) => Math.max(worst, value), 0),
      overToleranceCount: countOverTolerance(deviations, input.toleranceMm),
      overToleranceIds: input.regions
        .filter((region) => region.deviationMm > input.toleranceMm)
        .map((region) => region.id),
    },
  };
}

interface HarnessOptions {
  /** Bỏ trống thì cổng KHÔNG có vùng lệch — đúng bản sản phẩm hôm nay. */
  readonly regions?: readonly OverlayDeviationRegion[];
}

/** Cổng của bộ mẫu với đúng những việc đang kiểm được thay. */
async function makeGateway(options: HarnessOptions = {}): Promise<OverlayComparisonGateway> {
  const base = createOverlayComparisonGateway(createMockApiClient(), {
    now: () => clock.epochMs(),
  });
  const scans = await readMockScans(base);
  const regions = options.regions;

  return withOverlayCapabilities(base, {
    supports: {
      deviationRegions: regions !== undefined,
      matchMetrics: regions !== undefined,
    },
    readFloorScans: async () => ({ ok: true, data: scans }),
    readDeviationRegions: async () =>
      regions === undefined
        ? base.readDeviationRegions({ floorId: FLOOR_WITH_SCAN, projectId: PROJECT_ID })
        : { supported: true, value: regions },
    evaluateTolerance: (input) =>
      regions === undefined ? base.evaluateTolerance(input) : evaluateSample(input),
  });
}

/* -------------------------------------------------------------------------- */
/* Dựng hook.                                                                  */
/* -------------------------------------------------------------------------- */

interface MountOptions {
  readonly floorId?: LevelId;
  readonly roles?: readonly ProjectRole[];
  readonly forceCollapsed?: boolean;
}

interface Mounted {
  readonly result: { current: UseOverlayComparisonResult };
  readonly unmount: () => void;
}

function mountHook(gateway: OverlayComparisonGateway, options: MountOptions = {}): Mounted {
  const queryClient = createTestQueryClient();
  const wrapper = ({ children }: { children: ReactNode }): ReactNode =>
    createElement(QueryClientProvider, { client: queryClient }, children);

  const rendered = renderHook(
    () =>
      useOverlayComparison({
        projectId: PROJECT_ID,
        floorId: options.floorId ?? FLOOR_WITH_SCAN,
        gateway,
        ...(options.roles !== undefined ? { roles: options.roles } : {}),
        ...(options.forceCollapsed !== undefined
          ? { forceCollapsed: options.forceCollapsed }
          : {}),
      }),
    { wrapper },
  );

  return { result: rendered.result, unmount: rendered.unmount };
}

/** Chờ lượt đọc đầu tiên về. Đồng hồ là đồng hồ giả, nên phải tự đẩy thời gian. */
async function settle(mounted: Mounted): Promise<void> {
  for (let turn = 0; turn < SETTLE_TURNS; turn += 1) {
    if (mounted.result.current.model.state !== 'loading') {
      return;
    }

    await act(async () => {
      await clock.advance(1);
    });
  }

  expect(mounted.result.current.model.state).not.toBe('loading');
}

/** Dựng hook trên bộ vùng lệch mẫu và chờ nó về. */
async function mountMeasured(options: MountOptions = {}): Promise<Mounted> {
  const gateway = await makeGateway({ regions: sampleRegions() });
  const mounted = mountHook(gateway, options);
  await settle(mounted);

  return mounted;
}

/** Đổi dung sai và để mọi hiệu ứng chạy xong. */
async function setTolerance(mounted: Mounted, toleranceMm: number): Promise<void> {
  await act(async () => {
    mounted.result.current.actions.setToleranceMm(toleranceMm);
  });
}

/* -------------------------------------------------------------------------- */
/* Ba con số, và phép đổi dung sai.                                            */
/* -------------------------------------------------------------------------- */

describe('useOverlayComparison — ba con số khớp', () => {
  it('ở dung sai 20 mm cho trung bình 8 mm, lớn nhất 41 mm, và 3 vùng vượt ngưỡng', async () => {
    const mounted = await mountMeasured();
    const { metrics } = mounted.result.current.model;

    expect(metrics.meanText).toBe('8 mm');
    expect(metrics.maxText).toBe('41 mm');
    expect(metrics.overToleranceCount).toBe(3);
  });

  it('sắp tệ nhất lên đầu dù cổng trả về theo thứ tự ngược', async () => {
    const mounted = await mountMeasured();
    const { rows } = mounted.result.current.model;

    expect(rows).toHaveLength(SAMPLE_DEVIATIONS_MM.length);
    expect(rows[0]?.deviationText).toBe('41 mm');
    expect(rows[0]?.referenceLabel).toBe('trục A-3');
    expect(rows[0]?.affectedObjectCode).toBe('W-12');
    expect(rows.at(-1)?.deviationText).toBe('1 mm');
    expect(rows.filter((row) => row.statusCode === 'attention')).toHaveLength(3);
  });

  it('nới dung sai 20 → 50 mm thì số vùng vượt ngưỡng giảm về 0 và danh sách đánh giá lại', async () => {
    const mounted = await mountMeasured();

    expect(mounted.result.current.model.metrics.overToleranceCount).toBe(3);
    expect(mounted.result.current.model.state).toBe('partial');

    await setTolerance(mounted, RELAXED_TOLERANCE_MM);

    const model = mounted.result.current.model;

    expect(model.metrics.overToleranceCount).toBe(0);
    expect(model.rows.every((row) => row.statusCode === 'neutral')).toBe(true);
    expect(model.marks.every((mark) => !mark.isOverTolerance)).toBe(true);
    // Ba con số kia là phép đo, không phải phán quyết: nới dung sai không đổi
    // sai số trung bình hay sai số lớn nhất.
    expect(model.metrics.meanText).toBe('8 mm');
    expect(model.metrics.maxText).toBe('41 mm');
    expect(model.state).toBe('success');
  });

  it('ở dung sai 21 mm cho 2 vùng, vì phép so sánh là ngặt', async () => {
    const mounted = await mountMeasured();

    await setTolerance(mounted, BOUNDARY_TOLERANCE_MM);

    expect(mounted.result.current.model.metrics.overToleranceCount).toBe(2);
    expect(
      mounted.result.current.model.rows.filter((row) => row.statusCode === 'attention'),
    ).toHaveLength(2);
  });

  it('đập viền ba nhịp cho vùng vừa vượt ngưỡng, rồi tự hạ cờ xuống', async () => {
    const mounted = await mountMeasured();

    await setTolerance(mounted, RELAXED_TOLERANCE_MM);
    await setTolerance(mounted, DEFAULT_TOLERANCE_MM);

    const crossed = mounted.result.current.model.marks.filter(
      (mark) => mark.hasJustCrossedTolerance,
    );

    expect(crossed).toHaveLength(3);
    expect(crossed.every((mark) => mark.isOverTolerance)).toBe(true);

    await act(async () => {
      await clock.advance(MOTION_DURATIONS_MS.slow);
    });

    expect(
      mounted.result.current.model.marks.every((mark) => !mark.hasJustCrossedTolerance),
    ).toBe(true);
  });
});

/* -------------------------------------------------------------------------- */
/* Xác nhận là chữ ký của người (A5).                                          */
/* -------------------------------------------------------------------------- */

describe('useOverlayComparison — xác nhận', () => {
  it('không vùng nào vượt dung sai vẫn KHÔNG tự bật isConfirmed', async () => {
    const mounted = await mountMeasured();

    await setTolerance(mounted, RELAXED_TOLERANCE_MM);

    const model = mounted.result.current.model;

    expect(model.metrics.overToleranceCount).toBe(0);
    expect(model.confirmation.isConfirmed).toBe(false);
    expect(model.confirmation.confirmedNotice).toBeNull();
    expect(model.confirmation.canConfirm).toBe(true);
  });

  it('confirmMatch() là đường duy nhất bật isConfirmed, và chỗ duy nhất có verified', async () => {
    const mounted = await mountMeasured();

    await setTolerance(mounted, RELAXED_TOLERANCE_MM);

    await act(async () => {
      mounted.result.current.actions.confirmMatch();
      await clock.advance(1);
    });

    const model = mounted.result.current.model;

    expect(model.confirmation.isConfirmed).toBe(true);
    expect(model.confirmation.canConfirm).toBe(false);
    expect(model.confirmation.confirmedNotice?.statusCode).toBe('verified');
    // `'verified'` chỉ có một chỗ được phép xuất hiện, và tầng kiểu đã ép điều
    // đó: `DeviationRowViewModel.statusCode` không nhận nổi giá trị ấy.
    expect(
      model.rows.every(
        (row) => row.statusCode === 'attention' || row.statusCode === 'neutral',
      ),
    ).toBe(true);
  });

  it('không có quyền sửa thì không bấm xác nhận được', async () => {
    const mounted = await mountMeasured({ roles: ['viewer'] });

    expect(mounted.result.current.model.confirmation.canConfirm).toBe(false);
    expect(mounted.result.current.model.isAlignmentLocked).toBe(true);
  });
});

/* -------------------------------------------------------------------------- */
/* Bảy trạng thái (A11).                                                       */
/* -------------------------------------------------------------------------- */

describe('useOverlayComparison — bảy trạng thái', () => {
  it('đứng ở loading cho tới khi lượt đọc đầu tiên về', async () => {
    const gateway = await makeGateway({ regions: sampleRegions() });
    const mounted = mountHook(gateway);

    expect(mounted.result.current.model.state).toBe('loading');
    expect(mounted.result.current.model.stateNotice).not.toBeNull();
    expect(mounted.result.current.model.metrics).toEqual(UNMEASURED_METRICS);

    await settle(mounted);
  });

  it('tầng không có ảnh gốc là empty, và ba con số là gạch ngang', async () => {
    const mounted = await mountMeasured();

    await act(async () => {
      mounted.result.current.actions.selectFloor(FLOOR_WITHOUT_SCAN);
      await clock.advance(1);
    });
    await settle(mounted);

    const model = mounted.result.current.model;

    expect(model.state).toBe('empty');
    expect(model.metrics.meanText).toBe(MISSING_VALUE);
    expect(model.metrics.overToleranceCount).toBeNull();
    expect(model.scanUrl).toBeNull();
  });

  it('không tìm được khung bản vẽ là error, kèm lối sang màn hiệu chỉnh tỷ lệ', async () => {
    const mounted = await mountMeasured();

    await act(async () => {
      mounted.result.current.actions.selectFloor(FLOOR_WARPED);
      await clock.advance(1);
    });
    await settle(mounted);

    const model = mounted.result.current.model;

    expect(model.state).toBe('error');
    expect(model.scaleFixHref).toBe(ROUTES.project.scale(PROJECT_ID, FLOOR_WARPED));
    expect(model.metrics.maxText).toBe(MISSING_VALUE);
  });

  it('hai tầng dùng tỷ lệ khác nhau cũng là error', async () => {
    const graph = createSampleBuilding();
    const floors = graph.levels.map((level, index) => ({
      ...level,
      scaleMillimetresPerPixel: millimetresPerPixel(index === 0 ? 12 : 24),
    }));

    seedStore(floors);

    const mounted = await mountMeasured();
    const model = mounted.result.current.model;

    expect(model.state).toBe('error');
    expect(model.scaleFixHref).toBe(ROUTES.project.scale(PROJECT_ID, FLOOR_WITH_SCAN));
  });

  it('chỉ một số tầng có ảnh là partial, và câu giải thích nói ra con số', async () => {
    const mounted = await mountMeasured();
    const model = mounted.result.current.model;

    expect(model.state).toBe('partial');
    expect(model.floors).toHaveLength(4);
    expect(model.floors.filter((floor) => floor.hasScan)).toHaveLength(2);
    expect(model.stateNotice).toContain('2 trong 4');
  });

  it('vai chỉ xem là forbidden', async () => {
    const mounted = await mountMeasured({ roles: ['viewer'] });

    expect(mounted.result.current.model.state).toBe('forbidden');
    expect(mounted.result.current.model.role).toBe('viewer');
  });

  it('khung hẹp là collapsed, và kiểu cạnh nhau bị tắt kèm lý do', async () => {
    const mounted = await mountMeasured({ forceCollapsed: true });

    await act(async () => {
      mounted.result.current.actions.setCompareMode('sideBySide');
    });

    const model = mounted.result.current.model;

    expect(model.state).toBe('collapsed');
    expect(model.disabledCompareModes.sideBySide).toBeTruthy();
    // Kiểu bị tắt không được trở thành kiểu đang chọn.
    expect(model.compareMode).toBe('swipe');
  });

  it('dựng đủ bảy trạng thái của A11', async () => {
    const seen = new Set<OverlayComparisonState>();

    const loadingGateway = await makeGateway({ regions: sampleRegions() });
    const loadingMounted = mountHook(loadingGateway);
    seen.add(loadingMounted.result.current.model.state);
    await settle(loadingMounted);
    seen.add(loadingMounted.result.current.model.state);

    await setTolerance(loadingMounted, RELAXED_TOLERANCE_MM);
    seen.add(loadingMounted.result.current.model.state);

    const collapsed = await mountMeasured({ forceCollapsed: true });
    seen.add(collapsed.result.current.model.state);

    const forbidden = await mountMeasured({ roles: ['viewer'] });
    seen.add(forbidden.result.current.model.state);

    const warped = await mountMeasured();
    await act(async () => {
      warped.result.current.actions.selectFloor(FLOOR_WARPED);
      await clock.advance(1);
    });
    await settle(warped);
    seen.add(warped.result.current.model.state);

    await act(async () => {
      warped.result.current.actions.selectFloor(FLOOR_WITHOUT_SCAN);
      await clock.advance(1);
    });
    await settle(warped);
    seen.add(warped.result.current.model.state);

    expect([...seen].sort()).toEqual([...SEVEN_STATES].sort());
  });
});

/* -------------------------------------------------------------------------- */
/* Cổng chưa nối, và định dạng ở hook chứ không ở view (A15).                  */
/* -------------------------------------------------------------------------- */

describe('useOverlayComparison — cổng và định dạng', () => {
  it('bản sản phẩm hôm nay khai đủ bốn việc chưa có đường, và không bịa phép đo', async () => {
    const gateway = await makeGateway();
    const mounted = mountHook(gateway);
    await settle(mounted);

    const model = mounted.result.current.model;

    expect(model.unsupported.map((entry) => entry.capability).sort()).toEqual(
      [...OVERLAY_MISSING_CAPABILITIES].sort(),
    );
    expect(model.unsupported.every((entry) => entry.missing.length > 0)).toBe(true);
    expect(model.metrics).toEqual(UNMEASURED_METRICS);
    expect(model.rows).toHaveLength(0);
    expect(model.marks).toHaveLength(0);
  });

  it('độ mờ ảnh nguồn đi ra dưới dạng chuỗi đã định dạng', async () => {
    const mounted = await mountMeasured();

    expect(mounted.result.current.model.scanOpacityPercent).toBe(25);
    expect(mounted.result.current.model.scanOpacityText).toBe('25%');
    expect(mounted.result.current.model.layers.scan.opacity).toBeCloseTo(0.25);

    await act(async () => {
      mounted.result.current.actions.setScanOpacity(60);
    });

    expect(mounted.result.current.model.scanOpacityText).toBe('60%');
    expect(mounted.result.current.model.layers.scan.opacity).toBeCloseTo(0.6);
  });

  it('chọn một vùng lệch thì vẽ đường đo kèm giá trị đã định dạng', async () => {
    const mounted = await mountMeasured();
    const worstId = mounted.result.current.model.rows[0]?.id;

    expect(worstId).toBeDefined();

    await act(async () => {
      mounted.result.current.actions.selectRegion(worstId ?? null);
    });

    const model = mounted.result.current.model;

    expect(model.measurement?.valueText).toBe('41 mm');
    expect(model.rows[0]?.isSelected).toBe(true);
    expect(model.marks.filter((mark) => mark.isSelected)).toHaveLength(1);
  });

  it('lớp hình học có nét ở MỌI trạng thái, kể cả khi tầng không có ảnh gốc', async () => {
    const mounted = await mountMeasured();
    const drawn = mounted.result.current.model.geometry;

    expect(drawn.length).toBeGreaterThan(0);
    // Đã chiếu xuống hệ tỉ lệ 0..1 của khung đối chiếu, không còn milimét.
    expect(
      drawn.every((line) =>
        line.points.every(
          (point) => point.x >= 0 && point.x <= 1 && point.y >= 0 && point.y <= 1,
        ),
      ),
    ).toBe(true);
    expect(drawn.some((line) => line.isClosed)).toBe(true);

    await act(async () => {
      mounted.result.current.actions.selectFloor(FLOOR_WITHOUT_SCAN);
      await clock.advance(1);
    });
    await settle(mounted);

    expect(mounted.result.current.model.state).toBe('empty');
    expect(mounted.result.current.model.geometry.length).toBeGreaterThan(0);
  });

  it('một viewport dùng chung, đặt được về giá trị tuyệt đối', async () => {
    const mounted = await mountMeasured();

    expect(mounted.result.current.model.viewport).toEqual({ x: 0, y: 0, zoom: 1 });

    await act(async () => {
      mounted.result.current.actions.setViewport({ x: 120, y: -40, zoom: 2 });
    });

    expect(mounted.result.current.model.viewport).toEqual({ x: 120, y: -40, zoom: 2 });
  });

  it('ba lớp thị giác, không bao giờ bốn', async () => {
    const mounted = await mountMeasured();
    const { layers } = mounted.result.current.model;

    expect(Object.keys(layers).sort()).toEqual(['deviation', 'geometry', 'scan']);
    expect(layers.geometry.opacity).toBeCloseTo(0.6);
    expect(layers.deviation.isVisible).toBe(true);
  });
});
