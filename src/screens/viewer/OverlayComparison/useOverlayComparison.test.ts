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
import { PROJECT_NOT_FOUND_TITLE } from '@/components/feedback/ProjectSpatialGate';
import { FLOOR_MISSING_TITLE } from '@/screens/qc/shared/floorLayerReadFailure';
import { appShortcutRegistry } from '@/lib/input/shortcutRegistry';
import { createSampleBuilding, sampleLevelId } from '@/domain/spatial/__fixtures__/sampleBuilding';
import { normalizeSpatial } from '@/domain/spatial/normalize';
import type { Level, LevelId } from '@/domain/spatial/types';
import { millimetresPerPixel } from '@/domain/units/scale';
import { MISSING_VALUE } from '@/lib/format/number';
import type { HttpError } from '@/lib/http/types';
import { MOTION_DURATIONS_MS } from '@/lib/motion/tokens';
import { queryKeys } from '@/lib/query/queryKeys';
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
  readonly onNavigate?: (path: string) => void;
  /** Điền đệm trước khi hook dựng — như một màn khác đã ghi vào đệm dùng chung. */
  readonly seedCache?: (queryClient: ReturnType<typeof createTestQueryClient>) => void;
}

interface Mounted {
  readonly result: { current: UseOverlayComparisonResult };
  readonly unmount: () => void;
  /** Đổi route (Back/Forward) mà không dựng lại hook. */
  readonly goToFloor: (floorId: LevelId) => void;
}

function mountHook(gateway: OverlayComparisonGateway, options: MountOptions = {}): Mounted {
  const queryClient = createTestQueryClient();
  options.seedCache?.(queryClient);
  const wrapper = ({ children }: { children: ReactNode }): ReactNode =>
    createElement(QueryClientProvider, { client: queryClient }, children);

  const rendered = renderHook(
    ({ floorId }: { floorId: LevelId }) =>
      useOverlayComparison({
        projectId: PROJECT_ID,
        floorId,
        gateway,
        ...(options.roles !== undefined ? { roles: options.roles } : {}),
        ...(options.forceCollapsed !== undefined
          ? { forceCollapsed: options.forceCollapsed }
          : {}),
        ...(options.onNavigate !== undefined ? { onNavigate: options.onNavigate } : {}),
      }),
    { wrapper, initialProps: { floorId: options.floorId ?? FLOOR_WITH_SCAN } },
  );

  return {
    result: rendered.result,
    unmount: rendered.unmount,
    goToFloor: (floorId) => rendered.rerender({ floorId }),
  };
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

  it('[X4-A-024] đệm đo chất lượng do SCR-11 ghi (khác hình dạng) không làm tầng có bản vẽ thành empty', async () => {
    const mounted = await mountMeasured({
      seedCache: (queryClient) => {
        // Hình dạng SCR-11 (InputQualityGate) ghi: một ImageQualityAssessment, không có `scans`.
        queryClient.setQueryData(queryKeys.quality.assessment(FLOOR_WITH_SCAN), {
          floorId: FLOOR_WITH_SCAN,
          floors: [],
        });
      },
    });
    const model = mounted.result.current.model;

    expect(model.state).not.toBe('empty');
    expect(model.scanUrl).not.toBeNull();
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
    // K11: đang lỗi thì không mời "Khớp rồi, xác nhận"; nói vì sao thay cho nút.
    expect(model.confirmation.canConfirm).toBe(false);
    expect(model.confirmation.disabledReason).toBe('Sửa lỗi ở trên rồi mới xác nhận được.');
  });

  it('[BUG-420] tầng chưa có bản vẽ (404 `upload`) là empty "chưa có bản vẽ" kèm lối tải lên, không phải lỗi đọc ảnh', async () => {
    const noDrawing: HttpError = {
      code: 'NOT_FOUND',
      kind: 'http',
      raw: { code: 'NOT_FOUND', resource: 'upload' },
      requestId: 'r',
      retryable: false,
      status: 404,
    };
    const gateway = await makeGateway();
    const mounted = mountHook({ ...gateway, readFloorScans: async () => ({ ok: false, error: noDrawing }) });

    await settle(mounted);

    const model = mounted.result.current.model;

    expect(model.state).toBe('empty');
    expect(model.stateNotice).toBe(
      'Tầng này chưa có bản vẽ nào nên chưa có gì để đối chiếu. Tải bản vẽ lên rồi quay lại đây.',
    );
    expect(model.uploadHref).toBe(ROUTES.project.upload(PROJECT_ID));
    expect(model.scaleFixHref).toBeNull();
  });

  it('[K11] tầng khác dùng tỷ lệ khác không làm tầng đang so báo lỗi', async () => {
    const graph = createSampleBuilding();
    const floors = graph.levels.map((level, index) => ({
      ...level,
      scaleMillimetresPerPixel: millimetresPerPixel(index === 0 ? 12 : 24),
    }));

    seedStore(floors);

    const mounted = await mountMeasured();
    const model = mounted.result.current.model;

    expect(model.state).not.toBe('error');
    expect(model.stateNotice ?? '').not.toContain('tỷ lệ khác nhau');
    expect(model.scaleFixHref).toBeNull();
  });

  it('[K11/K12] tầng đang so chưa có tỷ lệ (N16 project_default) là error đỏ, có lối sang bước tỷ lệ, khoá xác nhận', async () => {
    const base = await makeGateway({ regions: sampleRegions() });
    const readFloorScaleSource = vi.fn(async ({ floorId }: { readonly floorId: string }) =>
      floorId === FLOOR_WITH_SCAN ? ('project_default' as const) : null,
    );
    const mounted = mountHook(withOverlayCapabilities(base, { readFloorScaleSource }));

    await settle(mounted);

    const model = mounted.result.current.model;

    expect(model.state).toBe('error');
    expect(model.stateNotice).toContain('Máy không đo được tỷ lệ tầng này');
    expect(model.scaleFixHref).toBe(ROUTES.project.scale(PROJECT_ID, FLOOR_WITH_SCAN));
    expect(model.confirmation.canConfirm).toBe(false);
    expect(model.confirmation.disabledReason).toBe('Sửa lỗi ở trên rồi mới xác nhận được.');
  });

  it('[K12] tỷ lệ máy đo được (pipeline) không chặn màn đối chiếu', async () => {
    const base = await makeGateway({ regions: sampleRegions() });
    const mounted = mountHook(withOverlayCapabilities(base, { readFloorScaleSource: async () => 'pipeline' as const }));

    await settle(mounted);

    expect(mounted.result.current.model.state).not.toBe('error');
    expect(mounted.result.current.model.scaleFixHref).toBeNull();
  });

  it('[Codex P2] tỷ lệ tầng còn đang đọc thì chưa cho "Khớp rồi"', async () => {
    const base = await makeGateway({ regions: sampleRegions() });
    const mounted = mountHook(
      withOverlayCapabilities(base, { readFloorScaleSource: () => new Promise<null>(() => undefined) }),
    );

    await settle(mounted);

    expect(mounted.result.current.model.state).not.toBe('error');
    expect(mounted.result.current.model.confirmation.canConfirm).toBe(false);
    expect(mounted.result.current.model.confirmation.disabledReason).toBeNull();
  });

  it('[Codex P2] đọc tỷ lệ tầng hỏng thì khoá "Khớp rồi" và nói cách gỡ', async () => {
    const base = await makeGateway({ regions: sampleRegions() });
    const mounted = mountHook(
      withOverlayCapabilities(base, { readFloorScaleSource: () => Promise.reject(new Error('mạng')) }),
    );

    await settle(mounted);
    await act(async () => {
      await clock.advance(1);
    });

    expect(mounted.result.current.model.state).not.toBe('error');
    expect(mounted.result.current.model.confirmation.canConfirm).toBe(false);
    expect(mounted.result.current.model.confirmation.disabledReason).toBe(
      'Tải lại trang để đọc tỷ lệ tầng rồi mới xác nhận được.',
    );
  });

  it('[G20] tỷ lệ khác nhau chỉ ở tầng chưa có bản vẽ thì không phải xung đột tỷ lệ', async () => {
    const graph = createSampleBuilding();
    const floors = graph.levels.map((level, index) => ({
      ...level,
      scaleMillimetresPerPixel: millimetresPerPixel(index < 2 ? 12 : 24 * index),
    }));

    seedStore(floors);

    const mounted = await mountMeasured();

    expect(mounted.result.current.model.state).not.toBe('error');
    expect(mounted.result.current.model.scaleFixHref).toBeNull();
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

  it('[9U-D-063, Q4b] vai chỉ xem trên tầng thiếu khung vẫn là forbidden kèm câu chỉ-đọc, không phải error', async () => {
    const mounted = await mountMeasured({ roles: ['viewer'] });

    await act(async () => {
      mounted.result.current.actions.selectFloor(FLOOR_WARPED);
      await clock.advance(1);
    });
    await settle(mounted);

    const model = mounted.result.current.model;

    expect(model.state).toBe('forbidden');
    expect(model.stateNotice).toBe('Bạn chỉ được xem; việc đổi căn chỉnh dành cho người có quyền sửa.');
    expect(model.scaleFixHref).toBeNull();
  });

  it('[9U-D-063, Q4b] vai chỉ xem khi hai tầng lệch tỷ lệ cũng là forbidden', async () => {
    const graph = createSampleBuilding();
    seedStore(
      graph.levels.map((level, index) => ({ ...level, scaleMillimetresPerPixel: millimetresPerPixel(index === 0 ? 12 : 24) })),
      ['viewer'],
    );

    const mounted = await mountMeasured({ roles: ['viewer'] });

    expect(mounted.result.current.model.state).toBe('forbidden');
  });

  it('[Q4b] vai chỉ xem mà lỗi ĐỌC (N16 hỏng) vẫn là error trước forbidden', async () => {
    useStore.getState().setSpatial(null, null);
    useStore.getState().setFloors([]);
    const base = await makeGateway();
    const readFloorLayer = vi.fn(() => Promise.reject(new Error('500')));
    const mounted = mountHook(withOverlayCapabilities(base, { readFloorLayer }), { roles: ['viewer'] });
    await settle(mounted);
    for (let turn = 0; turn < SETTLE_TURNS; turn += 1) {
      await act(async () => {
        await clock.advance(1000);
      });
    }

    expect(mounted.result.current.model.state).toBe('error');
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

  it('[UX-R2 K18] bản gốc luôn đậm; thanh trượt chỉnh lớp mô hình, mặc định 65%', async () => {
    const mounted = await mountMeasured();

    expect(mounted.result.current.model.modelOpacityPercent).toBe(65);
    expect(mounted.result.current.model.modelOpacityText).toBe('65%');
    expect(mounted.result.current.model.layers.scan.opacity).toBe(1);
    expect(mounted.result.current.model.layers.geometry.opacity).toBeCloseTo(0.65);

    await act(async () => {
      mounted.result.current.actions.setModelOpacity(60);
    });

    expect(mounted.result.current.model.modelOpacityText).toBe('60%');
    expect(mounted.result.current.model.layers.scan.opacity).toBe(1);
    expect(mounted.result.current.model.layers.geometry.opacity).toBeCloseTo(0.6);

    // G4b-26: "trượt" đặt mô hình riêng một bên nên hiện đủ, không theo thanh trượt.
    await act(async () => {
      mounted.result.current.actions.setCompareMode('swipe');
    });

    expect(mounted.result.current.model.layers.geometry.opacity).toBe(1);
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

  it('kho rỗng thì đọc tầng của route qua N16: có tầng, có nét, không nói "chưa có tầng" (B-V9-06)', async () => {
    useStore.getState().setSpatial(null, null);
    useStore.getState().setFloors([]);
    const mounted = await mountMeasured();
    await act(async () => {
      await clock.advance(1);
    });
    await settle(mounted);

    const model = mounted.result.current.model;

    expect(model.floors.map((floor) => floor.levelId)).toEqual([FLOOR_WITH_SCAN]);
    expect(model.geometry.length).toBeGreaterThan(0);
    // Chỉ đọc: kho vẫn rỗng, `/3d` không bị thay đồ thị.
    expect(useStore.getState().spatial).toBeNull();
  });

  it('tầng N16 mang mã Level khác mã tầng API vẫn tìm ra ảnh quét và lối sửa tỷ lệ của tầng ấy (B-V9-06)', async () => {
    useStore.getState().setSpatial(null, null);
    useStore.getState().setFloors([]);
    const gateway = createOverlayComparisonGateway(createMockApiClient(), {
      now: () => clock.epochMs(),
    });
    // `L1` là mã tầng API của bộ mẫu, đã đo nhưng không tìm thấy khung; N16 trả nó
    // với một mã `Level` riêng.
    const mounted = mountHook(gateway, { floorId: 'L1' as LevelId });
    // Hai lượt đọc nối nhau: N16 cho ra tầng, rồi lượt đo của tầng ấy.
    for (let turn = 0; turn < SETTLE_TURNS; turn += 1) {
      await act(async () => {
        await clock.advance(1);
      });
    }

    const { activeFloorId, floors } = mounted.result.current.model;
    const floor = floors.find((option) => option.levelId === activeFloorId);

    // Mở thẳng link: ô chọn tầng đủ mọi tầng của #12, không chỉ tầng của route (BUG-600).
    expect(floors.length).toBeGreaterThan(1);
    expect(floor?.levelId).not.toBe('L1');
    expect(floor?.hasScan).toBe(true);
    // Lối sang màn tỷ lệ mang mã tầng API — route ấy đọc bản vẽ theo mã này.
    expect(mounted.result.current.model.scaleFixHref).toBe(ROUTES.project.scale(PROJECT_ID, 'L1'));
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
    expect(layers.scan.opacity).toBe(1);
    expect(layers.deviation.isVisible).toBe(true);
  });
});

describe('useOverlayComparison — QA-04c SCR-22 (BUG-588, 599, 600, 608)', () => {
  it('đang đọc tầng N16 là loading, không phải "chưa có tầng nào" (BUG-588)', async () => {
    useStore.getState().setSpatial(null, null);
    useStore.getState().setFloors([]);
    const base = await makeGateway();
    const gateway = withOverlayCapabilities(base, { readFloorLayer: () => new Promise(() => undefined) });
    const mounted = mountHook(gateway);

    await act(async () => {
      await clock.advance(1);
    });

    expect(mounted.result.current.model.state).toBe('loading');
    expect(mounted.result.current.model.stateNotice).not.toBe('Dự án này chưa có tầng nào để đối chiếu.');
  });

  it('đọc N16 hỏng là error có "Thử lại", và Thử lại đọc lại (BUG-588, BUG-608)', async () => {
    useStore.getState().setSpatial(null, null);
    useStore.getState().setFloors([]);
    const base = await makeGateway();
    const readFloorLayer = vi.fn(() => Promise.reject(new Error('500')));
    const readFloorScans = vi.fn(base.readFloorScans);
    const mounted = mountHook(withOverlayCapabilities(base, { readFloorLayer, readFloorScans }));
    await settle(mounted);
    for (let turn = 0; turn < SETTLE_TURNS; turn += 1) {
      await act(async () => {
        await clock.advance(1000);
      });
    }

    const model = mounted.result.current.model;
    expect(model.state).toBe('error');
    expect(readFloorScans).not.toHaveBeenCalled(); // G21: N16 gave no floor → no #30
    expect(model.canRetry).toBe(true);
    expect(model.stateNotice).toBe('Không đọc được mô hình của tầng này nên chưa có gì để đối chiếu.');

    const calls = readFloorLayer.mock.calls.length;
    await act(async () => {
      mounted.result.current.actions.retry();
      await clock.advance(1);
    });
    expect(readFloorLayer.mock.calls.length).toBeGreaterThan(calls);
  });

  it('URL thắng kho, và đổi tầng là đổi URL (BUG-600)', async () => {
    const onNavigate = vi.fn();
    const gateway = await makeGateway({ regions: sampleRegions() });
    // Kho đang mở FLOOR_WITH_SCAN (seedStore); route nói FLOOR_WARPED.
    const mounted = mountHook(gateway, { floorId: FLOOR_WARPED, onNavigate });
    await settle(mounted);

    expect(mounted.result.current.model.activeFloorId).toBe(FLOOR_WARPED);

    act(() => {
      mounted.result.current.actions.selectFloor(FLOOR_WITHOUT_SCAN);
    });
    expect(onNavigate).toHaveBeenCalledWith(ROUTES.project.overlay(PROJECT_ID, FLOOR_WITHOUT_SCAN));
  });

  it('chọn tầng rồi Back về URL cũ: tầng theo URL, không theo lựa chọn cũ (BUG-600, X4-A-032)', async () => {
    const mounted = mountHook(await makeGateway({ regions: sampleRegions() }), { floorId: FLOOR_WARPED });
    await settle(mounted);

    act(() => {
      mounted.result.current.actions.selectFloor(FLOOR_WITHOUT_SCAN);
    });
    expect(mounted.result.current.model.activeFloorId).toBe(FLOOR_WITHOUT_SCAN);

    act(() => mounted.goToFloor(FLOOR_WITHOUT_SCAN)); // URL theo lựa chọn
    act(() => mounted.goToFloor(FLOOR_WARPED)); // Back
    expect(mounted.result.current.model.activeFloorId).toBe(FLOOR_WARPED);
  });

  it('về toàn cảnh không mất cài đặt; nút xác nhận tắt có lý do; "Khoá căn" ẩn khi chưa có tác dụng (BUG-599)', async () => {
    const mounted = mountHook(await makeGateway());
    await settle(mounted);

    act(() => {
      mounted.result.current.actions.setModelOpacity(70);
      mounted.result.current.actions.setViewport({ x: 120, y: -40, zoom: 2 });
    });
    act(() => {
      mounted.result.current.actions.fitView();
    });

    const model = mounted.result.current.model;
    expect(model.viewport).toEqual({ x: 0, y: 0, zoom: 1 });
    expect(model.modelOpacityPercent).toBe(70);
    // J-7/B2-14: chưa đo được vùng lệch vẫn xác nhận được bằng mắt — không còn ngõ cụt.
    expect(model.confirmation.canConfirm).toBe(true);
    expect(model.confirmation.disabledReason).toBeNull();
    expect(model.canLockAlignment).toBe(false);
  });
});

describe('[G45] người ngoài dự án mở thẳng SCR-22', () => {
  it('N16 404 dự án: màn "Không tìm thấy dự án này", không câu lỗi đọc chung', async () => {
    useStore.getState().setSpatial(null, null);
    useStore.getState().setFloors([]);
    const base = await makeGateway();
    const notFound = { kind: 'http', raw: { resource: 'project' }, requestId: 'r', retryable: false, status: 404 };
    const mounted = mountHook(withOverlayCapabilities(base, { readFloorLayer: () => Promise.reject(notFound) }));
    await settle(mounted);
    for (let turn = 0; turn < SETTLE_TURNS; turn += 1) {
      await act(async () => {
        await clock.advance(1000);
      });
    }

    expect(mounted.result.current.model.readFailure?.title).toBe(PROJECT_NOT_FOUND_TITLE);
  });
});

describe('[X4-A-036 / BUG-326] mã tầng của route không có trong kho', () => {
  it('kho đã có đồ thị (N15 về trước N16): vẫn là màn "Không mở được tầng này", không rơi về tầng đầu của kho', async () => {
    const mounted = mountHook(await makeGateway(), { floorId: 'L-QAXMISSING' as LevelId });
    await settle(mounted);

    expect(mounted.result.current.model.readFailure?.title).toBe(FLOOR_MISSING_TITLE);
  });

  it('kho đã nạp với mã Level khác mã tầng API của route: đọc N16 của route rồi đối chiếu qua mã ấy, không báo tầng đã xoá (overlay race)', async () => {
    const spatial = useStore.getState().spatial;
    if (spatial === null) throw new Error('kho chưa có đồ thị');
    // Như bộ mẫu API: route `L1`, N16 của nó mang mã `Level` của kho (`FLOOR_WARPED`).
    const readFloorLayer = vi.fn(() =>
      Promise.resolve({ ...spatial, byKind: { ...spatial.byKind, level: [FLOOR_WARPED] } }),
    );
    const mounted = mountHook(withOverlayCapabilities(await makeGateway(), { readFloorLayer }), {
      floorId: 'L1' as LevelId,
    });
    await settle(mounted);
    for (let turn = 0; turn < SETTLE_TURNS; turn += 1) {
      await act(async () => {
        await clock.advance(1);
      });
    }

    expect(readFloorLayer).toHaveBeenCalled();
    expect(mounted.result.current.model.readFailure ?? null).toBeNull();
    expect(mounted.result.current.model.activeFloorId).toBe(FLOOR_WARPED);
  });
});

describe('[G36 22-E-016] khung đối chiếu đi được bằng bàn phím (A12)', () => {
  it('"=" phóng to, "-" thu nhỏ, mũi tên dời khung nhìn', async () => {
    const mounted = mountHook(await makeGateway());
    await settle(mounted);
    const press = async (key: string): Promise<void> => {
      await act(async () => {
        appShortcutRegistry.handleKeyDown({ key, ctrlKey: false }, null);
        await Promise.resolve();
      });
    };
    const start = mounted.result.current.model.viewport;

    await press('=');
    expect(mounted.result.current.model.viewport.zoom).toBeGreaterThan(start.zoom);

    await press('-');
    await press('-');
    expect(mounted.result.current.model.viewport.zoom).toBeLessThan(start.zoom);

    await press('ArrowLeft');
    await press('ArrowDown');
    const moved = mounted.result.current.model.viewport;
    expect(moved.x).not.toBe(start.x);
    expect(moved.y).not.toBe(start.y);
  });
});
