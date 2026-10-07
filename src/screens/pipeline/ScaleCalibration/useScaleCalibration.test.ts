/**
 * Nửa "suy nghĩ" của màn Hiệu chỉnh tỷ lệ, kiểm không cần DOM của màn.
 *
 * Hook được lái qua `renderHook`, và tầng dữ liệu là `createMockApiClient()` của
 * `src/api/__mocks__/client.ts` — cùng phép ánh xạ bản sản phẩm dùng, nên test
 * không dựng một ý niệm thứ hai về hình dạng câu trả lời (R-70). Đồ thị trong
 * store là bộ mẫu chuẩn của A14 (`createCleanBuildingScenario`), và các chuỗi
 * kích thước được dựng từ chính 34 `Dimension` của bộ mẫu đó — không có bảng dữ
 * liệu thứ hai bịa tại chỗ.
 *
 * Ba con số duy nhất viết ra ở đây — `400 px`, `4.800 mm`, `250 mm/px` — là
 * chính ví dụ đặc tả nêu, và cũng là ví dụ `domain/units/__tests__/scale.test.ts`
 * đang kiểm. Chúng đi vào `createScale`; không phép chia nào xảy ra trong file
 * này, kể cả để dựng dữ liệu: tỉ lệ `0..1` của một đoạn 400 px trên khung ảnh do
 * chính một `Scale` của M-02 tính ra.
 */

import { createElement, type ReactNode } from 'react';
import { QueryClientProvider } from '@tanstack/react-query';
import { act, cleanup, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi, type MockInstance } from 'vitest';

import { __resetMockLayerState, createMockApiClient, simulateProvisionalScale } from '@/api/__mocks__/client';
import type { ApiClient, SpatialApi } from '@/api/client';
import { createSampleBuilding, sampleLevelId } from '@/domain/spatial/__fixtures__/sampleBuilding';
import { normalizeSpatial } from '@/domain/spatial/normalize';
import type { LevelId } from '@/domain/spatial/types';
import { __resetFloorLayerSavers, flushAutosaves } from '@/hooks/useAutosave';
import { spatialLayerOf } from '@/lib/autosave/spatialLayerSave';
import type { HttpError } from '@/lib/http/types';
import {
  createScale,
  millimetresPerPixel,
  pixels,
  SCALE_THRESHOLDS,
  type MillimetresPerPixel,
  type Pixels,
  type Scale,
} from '@/domain/units/scale';
import { millimetres } from '@/domain/units/types';
import { RETRY_SCHEDULE_MS } from '@/lib/autosave/retrySchedule';
import { formatLength } from '@/lib/format/measure';
import { formatNumber } from '@/lib/format/number';
import { formatCombo, parseCombo } from '@/lib/input/shortcutRegistry';
import { createCleanBuildingScenario } from '@/lib/testing/fixtures';
import { createTestQueryClient } from '@/lib/testing/render';
import { installFakeClock, type FakeClock } from '@/lib/testing/fakeClock';
import { SEVEN_STATES } from '@/lib/testing/sevenStateScenarios';
import { useStore } from '@/store';
import { commit } from '@/store/commit';
import type { ProjectRole } from '@/types/project';

import {
  createScaleCalibrationGateway,
  withScaleCapabilities,
  type ScaleCalibrationGateway,
  type ScaleDrawingSnapshot,
  type ScaleRawDimensionString,
} from './scaleCalibrationGateway';
import { __resetScaleRatioMarks, useScaleCalibration } from './useScaleCalibration';
import type {
  ImageRatioPoint,
  ScaleCalibrationState,
  UseScaleCalibrationResult,
} from './types';

/* -------------------------------------------------------------------------- */
/* Ví dụ đã có sẵn trong đặc tả và trong test của domain.                       */
/* -------------------------------------------------------------------------- */

const PROJECT_ID = 'project-1';

/** Số nhịp đồng hồ giả một lượt đọc của bộ mẫu cần để về. */
const SETTLE_TURNS = 20;

/** Tầng của bộ mẫu chuẩn. Mã tầng có tiền tố `L-`, tức một `LevelId` thật. */
const FLOOR_ID = sampleLevelId(0);

/** `4.800 mm ÷ 400 px = 12 mm/px` — ví dụ của chính đặc tả. */
const REFERENCE_PIXEL_LENGTH: Pixels = pixels(400);
const REFERENCE_REAL_LENGTH = millimetres(4800);
const REFERENCE_SCALE: Scale = createScale({
  pixelLength: REFERENCE_PIXEL_LENGTH,
  realLength: REFERENCE_REAL_LENGTH,
});

/** Tỷ lệ vô lý đặc tả nêu đích danh: 250 mm/px trên nét tường 12 px là tường 3 m. */
const IMPLAUSIBLE_RATIO: MillimetresPerPixel = millimetresPerPixel(250);
const REFERENCE_WALL_WIDTH: Pixels = pixels(12);

/** Tỉ lệ tạm của pipeline cho tầng `unresolved`: đoạn 400 px dài 4.000 mm. */
const PROVISIONAL_REAL_LENGTH = millimetres(4000);
const PROVISIONAL_RATIO: MillimetresPerPixel = createScale({
  pixelLength: REFERENCE_PIXEL_LENGTH,
  realLength: PROVISIONAL_REAL_LENGTH,
}).millimetresPerPixel;

const FORBIDDEN: HttpError = {
  code: 'FORBIDDEN',
  kind: 'http',
  raw: { code: 'FORBIDDEN' },
  requestId: 'r',
  retryable: false,
  status: 403,
};

/** Ảnh mẫu để đo trên: tầng của bộ mẫu mock đã đo xong và tìm được khung bản vẽ. */
const MEASURED_MOCK_FLOOR_ID = 'L2';
/** Tầng mock mà máy KHÔNG tìm được khung bản vẽ — nguồn của trạng thái `error`. */
const WARPED_MOCK_FLOOR_ID = 'L1';

/* -------------------------------------------------------------------------- */
/* Môi trường.                                                                 */
/* -------------------------------------------------------------------------- */

let clock: FakeClock;

/* jsdom không có `matchMedia`; `matches: false` là cách xếp rộng, không giảm chuyển động. */
beforeEach(() => {
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

  clock = installFakeClock();
  __resetFloorLayerSavers();
  __resetMockLayerState();
  __resetScaleRatioMarks();
  seedStore();
});

afterEach(() => {
  cleanup();
  __resetFloorLayerSavers();
  clock.restore();
  vi.restoreAllMocks();
});

/** Đồ thị của bộ mẫu chuẩn A14 trong store, và một ngăn xếp hoàn tác sạch. */
function seedStore(): void {
  const scenario = createCleanBuildingScenario();
  const graph = normalizeSpatial(scenario.graph);

  // Cùng dự án với màn: `useFloorLayer` thấy kho đã có tầng, không nạp đè.
  useStore.getState().setSpatial(graph, 'version-1', {
    floorRevisions: Object.fromEntries(graph.byKind.level.map((id) => [id, 0])),
    projectId: PROJECT_ID,
  });
  useStore.temporal.getState().clear();
}

/** Tỷ lệ đang lưu trên tầng đang mở, đọc thẳng từ store. */
function storedRatio(): number | undefined {
  const entity = useStore.getState().spatial?.byId[FLOOR_ID];

  return entity !== undefined && 'scaleMillimetresPerPixel' in entity
    ? entity.scaleMillimetresPerPixel
    : undefined;
}

/**
 * Một con số viết ra như người dùng gõ nó.
 *
 * Dấu thập phân tiếng Việt là dấu PHẨY, nên `String(15.6)` là `"15.6"` và
 * `parseLength` đọc dấu chấm đó thành dấu phân nhóm hàng nghìn. `formatNumber`
 * là chiều thuận của chính `parseLength`, nên nó là cách đúng để gõ một số vào
 * ô nhập — kể cả trong test.
 */
function typedNumber(value: number): string {
  return formatNumber(value, { grouping: false });
}

/* -------------------------------------------------------------------------- */
/* Bộ dựng cổng.                                                               */
/* -------------------------------------------------------------------------- */

/**
 * Ảnh nền của một tầng, đọc từ chính bộ mẫu của `createMockApiClient()`.
 *
 * Mã tầng bị đổi sang mã của bộ mẫu chuẩn A14 vì store giữ đồ thị của bộ mẫu
 * đó: hai bộ dữ liệu đã có, và test nối chúng lại chứ không dựng bộ thứ ba.
 */
async function readMockDrawing(
  client: ApiClient,
  sourceFloorId: string,
): Promise<ScaleDrawingSnapshot> {
  const result = await client.quality.assess({ floorId: sourceFloorId, projectId: PROJECT_ID });

  if (!result.ok) {
    throw new Error('Không đọc được lượt đo chất lượng của bộ mẫu.');
  }

  const floor = result.data.floors.find((entry) => entry.floorId === sourceFloorId);

  if (floor === undefined || floor.measurement === undefined) {
    throw new Error(`Bộ mẫu không có tầng đã đo nào mang mã ${sourceFloorId}.`);
  }

  return {
    floorId: FLOOR_ID,
    floorName: floor.floorName,
    imageUrl: floor.sourceUrl,
    widthPx: pixels(floor.measurement.widthPx),
    heightPx: pixels(floor.measurement.heightPx),
    isWarped: floor.frame !== undefined && !floor.frame.isFound,
  };
}

/**
 * 34 chuỗi kích thước, dựng từ 34 `Dimension` của bộ mẫu chuẩn.
 *
 * Chiều dài pixel của mỗi hàng do `REFERENCE_SCALE` quy đổi từ chính giá trị
 * mi-li-mét của bộ mẫu — nên mọi hàng cùng nói một tỷ lệ 12 mm/px, và
 * `inferScale` phải suy ra đúng con số đó. Không phép chia nào ở đây: `Scale`
 * làm việc đó.
 */
function sampleDimensionRows(lowConfidenceCount = 0): readonly ScaleRawDimensionString[] {
  const graph = createSampleBuilding();

  return graph.dimensions.map((dimension, index) => {
    const realLength = millimetres(dimension.valueMm);

    return {
    id: dimension.id,
    realLength,
    pixelLength: REFERENCE_SCALE.millimetresToPixels(realLength),
    confidence:
      index < lowConfidenceCount ? SCALE_THRESHOLDS.minimumConfidence : dimension.confidence,
    boundingBox: {
      min: { x: 0.1, y: index * 0.02 },
      max: { x: 0.3, y: index * 0.02 + 0.01 },
    },
    };
  });
}

interface HarnessOptions {
  readonly sourceFloorId?: string;
  readonly rows?: readonly ScaleRawDimensionString[];
  readonly referenceWallWidthPx?: Pixels;
}

interface Harness {
  readonly gateway: ScaleCalibrationGateway;
  /** PUT #35 của bộ lưu lớp chung — mặc định nhận, trả lớp hiện tại của kho. */
  readonly writeLayer: MockInstance<SpatialApi['writeLayer']>;
}

type WriteResult = Awaited<ReturnType<SpatialApi['writeLayer']>>;

/** Phản hồi #35 thành công: lớp của tầng như kho đang giữ, `revision` cho sẵn. */
function savedLayer(floorId: string, revision: number): WriteResult {
  const spatial = useStore.getState().spatial;
  const layer =
    spatial === null
      ? { furniture: [], openings: [], rooms: [], walls: [] }
      : spatialLayerOf(spatial, floorId as LevelId);

  return { data: { layer, revision }, ok: true };
}

function deferredWrite(): { promise: Promise<WriteResult>; resolve: (value: WriteResult) => void } {
  let resolve: (value: WriteResult) => void = () => undefined;
  const promise = new Promise<WriteResult>((settleWith) => {
    resolve = settleWith;
  });

  return { promise, resolve };
}

/**
 * Cổng của bộ mẫu với đúng những việc đang kiểm được thay.
 *
 * Cùng lý lẽ `makeScriptedClient` của `useProcessingScreen.test.ts`: chỉ thứ
 * đang kiểm mới bị thay, phần còn lại vẫn là cổng thật chạy trên bộ mẫu.
 */
async function makeHarness(options: HarnessOptions = {}): Promise<Harness> {
  const client = createMockApiClient();
  const base = createScaleCalibrationGateway(client, { now: () => clock.epochMs() });
  const drawing = await readMockDrawing(client, options.sourceFloorId ?? MEASURED_MOCK_FLOOR_ID);
  const writeLayer = vi
    .spyOn(client.spatial, 'writeLayer')
    .mockImplementation(async (input) => savedLayer(input.floorId, input.baseVersion + 1));

  const gateway = withScaleCapabilities(base, {
    supports: {
      dimensionStrings: options.rows !== undefined,
      referenceWallWidth: options.referenceWallWidthPx !== undefined,
    },
    readFloorDrawing: async () => ({ ok: true, data: drawing }),
    readDimensionStrings: async () =>
      options.rows === undefined
        ? base.readDimensionStrings({ floorId: FLOOR_ID, projectId: PROJECT_ID })
        : { supported: true, value: options.rows },
    readReferenceWallWidth: async () =>
      options.referenceWallWidthPx === undefined
        ? base.readReferenceWallWidth({ floorId: FLOOR_ID, projectId: PROJECT_ID })
        : { supported: true, value: options.referenceWallWidthPx },
  });

  return { gateway, writeLayer };
}

/* -------------------------------------------------------------------------- */
/* Dựng hook.                                                                  */
/* -------------------------------------------------------------------------- */

interface MountOptions {
  readonly roles?: readonly ProjectRole[];
  readonly forceCollapsed?: boolean;
}

interface Mounted {
  readonly result: { current: UseScaleCalibrationResult };
  readonly unmount: () => void;
}

function mountHook(gateway: ScaleCalibrationGateway, options: MountOptions = {}): Mounted {
  const queryClient = createTestQueryClient();
  const wrapper = ({ children }: { children: ReactNode }): ReactNode =>
    createElement(QueryClientProvider, { client: queryClient }, children);

  const rendered = renderHook(
    () =>
      useScaleCalibration({
        projectId: PROJECT_ID,
        floorId: FLOOR_ID,
        gateway,
        ...(options.roles !== undefined ? { roles: options.roles } : {}),
        ...(options.forceCollapsed !== undefined ? { forceCollapsed: options.forceCollapsed } : {}),
      }),
    { wrapper },
  );

  return { result: rendered.result, unmount: rendered.unmount };
}

/**
 * Chờ lượt đọc đầu tiên về.
 *
 * Đồng hồ ở đây là đồng hồ giả, nên `waitFor` — vốn chờ bằng đồng hồ thật —
 * sẽ đứng im mãi mãi. Cách chờ đúng dưới đồng hồ giả là tự đẩy thời gian.
 */
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

/** Kéo một đoạn dài đúng `REFERENCE_PIXEL_LENGTH` theo phương ngang. */
async function dragReferenceLine(mounted: Mounted): Promise<void> {
  const drawingWidthPx = pixels(
    (useStore.getState().spatial === null ? 0 : 0) + imageWidthPxOf(mounted),
  );
  const frame = createScale({ pixelLength: drawingWidthPx, realLength: millimetres(1) });
  const start: ImageRatioPoint = { x: 0, y: 0 };
  const end: ImageRatioPoint = {
    x: frame.pixelsToMillimetres(REFERENCE_PIXEL_LENGTH),
    y: 0,
  };

  await act(async () => {
    mounted.result.current.actions.onStartDrag(start);
  });
  await act(async () => {
    mounted.result.current.actions.onMoveDrag(end, { isAxisLocked: false });
  });
  await act(async () => {
    mounted.result.current.actions.onEndDrag(end);
  });
}

/** Kéo đoạn 400 px và gõ chiều dài thật — đủ để có tỉ lệ đề nghị. */
async function typeReference(mounted: Mounted, length = REFERENCE_REAL_LENGTH): Promise<void> {
  await dragReferenceLine(mounted);
  await act(async () => {
    mounted.result.current.actions.onChangeRealLength(typedNumber(length));
  });
}

/** Đẩy đồng hồ giả và chờ `import()` lười của bộ lưu cho tới khi lượt gửi về. */
async function settleAsync(): Promise<void> {
  for (let turn = 0; turn < SETTLE_TURNS; turn += 1) {
    await act(async () => {
      await vi.dynamicImportSettled();
      await clock.advance(1);
    });
  }
}

async function applyNow(mounted: Mounted): Promise<void> {
  await act(async () => {
    mounted.result.current.actions.onApply();
  });
  await settleAsync();
}

/**
 * Bề rộng ảnh, đọc ngược từ chính hook.
 *
 * Toạ độ `1` trên khung ảnh là mép phải, nên toạ độ con trỏ mà thanh trạng thái
 * báo cho điểm đó chính là bề rộng ảnh tính bằng pixel — không phải một con số
 * test tự giữ, mà là con số hook đang dùng.
 */
function imageWidthPxOf(mounted: Mounted): number {
  act(() => {
    mounted.result.current.actions.onMoveCursor({ x: 1, y: 1 });
  });

  return mounted.result.current.model.statusBar.x;
}

/* -------------------------------------------------------------------------- */
/* Kiểm.                                                                       */
/* -------------------------------------------------------------------------- */

describe('useScaleCalibration — tỷ lệ do M-02 tính', () => {
  it('kéo đoạn 400 px rồi nhập 4800 mm cho ra 12 mm/px, và hiện đủ phép tính', async () => {
    const harness = await makeHarness();
    const mounted = mountHook(harness.gateway);
    await settle(mounted);
    await dragReferenceLine(mounted);

    await act(async () => {
      mounted.result.current.actions.onChangeRealLength('4800');
    });

    const { computation } = mounted.result.current.model.panel;

    expect(computation.numeratorLabel).toBe('4.800 mm');
    expect(computation.denominatorLabel).toBe('400 px');
    expect(computation.resultLabel).toBe('12 mm/px');
    expect(computation.isComplete).toBe(true);
    expect(mounted.result.current.model.panel.canApply).toBe(true);
  });

  it('chưa nhập chiều dài thì vế thiếu vẫn có chỗ đứng, và phép tính chưa đủ', async () => {
    const harness = await makeHarness();
    const mounted = mountHook(harness.gateway);
    await settle(mounted);
    await dragReferenceLine(mounted);

    const { computation } = mounted.result.current.model.panel;

    expect(computation.denominatorLabel).toBe('400 px');
    expect(computation.numeratorLabel).toBe('—');
    expect(computation.resultLabel).toBe('—');
    expect(computation.isComplete).toBe(false);
  });

  it('suy ra tỷ lệ của bộ mẫu từ 34 chuỗi kích thước qua inferScale', async () => {
    const harness = await makeHarness({ rows: sampleDimensionRows() });
    const mounted = mountHook(harness.gateway);
    await settle(mounted);

    const inference = mounted.result.current.aiInference;

    expect(inference).not.toBeNull();
    expect(inference?.suggestedMillimetresPerPixel).toBeCloseTo(
      REFERENCE_SCALE.millimetresPerPixel,
      6,
    );
  });
});

describe('useScaleCalibration — áp dụng: PUT trước, commit sau (F-04x-2 bước 5)', () => {
  it('áp → PUT chỉ tỉ lệ trước; kho đổi tỉ lệ CHỈ sau khi máy chủ nhận; success màu verified', async () => {
    const harness = await makeHarness();
    const pending = deferredWrite();

    harness.writeLayer.mockReturnValueOnce(pending.promise);
    const mounted = mountHook(harness.gateway);
    await settle(mounted);
    await typeReference(mounted);

    await act(async () => {
      mounted.result.current.actions.onApply();
    });
    await settleAsync();

    expect(harness.writeLayer).toHaveBeenCalledTimes(1);
    expect(harness.writeLayer.mock.calls[0]?.[0].body).toEqual({
      scaleMillimetresPerPixel: REFERENCE_SCALE.millimetresPerPixel,
    });
    expect(storedRatio()).toBeUndefined();
    expect(mounted.result.current.model.panel.isApplying).toBe(true);
    expect(mounted.result.current.model.state).not.toBe('success');

    pending.resolve(savedLayer(FLOOR_ID, 1));
    await settleAsync();

    expect(storedRatio()).toBeCloseTo(REFERENCE_SCALE.millimetresPerPixel, 6);
    expect(mounted.result.current.model.state).toBe('success');
    expect(mounted.result.current.model.panel.statusCode).toBe('verified');
    expect(mounted.result.current.model.panel.isApplying).toBe(false);
    expect(mounted.result.current.appliedScale?.pixelsToMillimetres(REFERENCE_PIXEL_LENGTH)).toBeCloseTo(
      REFERENCE_REAL_LENGTH,
      6,
    );
  });

  it('PUT 422 → kho giữ tỉ lệ cũ, không success, nói lý do', async () => {
    const harness = await makeHarness();

    harness.writeLayer.mockResolvedValueOnce({
      error: { code: 'VALIDATION', kind: 'http', raw: { code: 'VALIDATION' }, requestId: 'r', retryable: false, status: 422 },
      ok: false,
    });
    const mounted = mountHook(harness.gateway);
    await settle(mounted);
    await typeReference(mounted);
    await applyNow(mounted);

    expect(harness.writeLayer).toHaveBeenCalledTimes(1);
    expect(storedRatio()).toBeUndefined();
    expect(mounted.result.current.model.state).toBe('partial');
    expect(mounted.result.current.model.panel.statusCode).not.toBe('verified');
    expect(mounted.result.current.model.panel.applyBlockedNotice).toContain('Chưa lưu được tỉ lệ lên máy chủ');
  });

  it('sửa đồ thị khác sau khi áp không sinh PUT tỉ lệ', async () => {
    const harness = await makeHarness();
    const mounted = mountHook(harness.gateway);
    await settle(mounted);
    await typeReference(mounted);
    await applyNow(mounted);

    const wall = Object.values(useStore.getState().spatial?.byId ?? {}).find(
      (entity) => 'thicknessMm' in entity && 'levelId' in entity && entity.levelId === FLOOR_ID,
    );

    await act(async () => {
      if (wall !== undefined && 'thicknessMm' in wall) {
        commit({ op: 'update', kind: 'wall', id: wall.id, changes: { thicknessMm: wall.thicknessMm + 10 } }, 'Đổi độ dày');
      }
    });
    await act(async () => {
      await clock.advance(RETRY_SCHEDULE_MS[0]);
    });
    await settleAsync();

    const scaleCalls = harness.writeLayer.mock.calls.filter(([input]) => input.body.scaleMillimetresPerPixel !== undefined);

    expect(scaleCalls).toHaveLength(1);
  });

  it('kho rỗng thì nạp tầng qua N16, và áp vào đúng mã Level N16 trả, không phải mã route (B-V5-01)', async () => {
    useStore.getState().setSpatial(null, null);
    const harness = await makeHarness();
    const otherLevel = sampleLevelId(1);
    // Route mang `FLOOR_ID`; N16 trả một tầng có mã `Level` khác — như BE thật.
    const gateway = withScaleCapabilities(harness.gateway, {
      readLayer: () => harness.gateway.readLayer({ floorId: otherLevel, projectId: PROJECT_ID }),
    });
    const mounted = mountHook(gateway);
    await settle(mounted);
    await settleAsync();
    await typeReference(mounted);
    await applyNow(mounted);

    expect(mounted.result.current.model.panel.applyBlockedNotice).toBeUndefined();
    expect(harness.writeLayer.mock.calls[0]?.[0].floorId).toBe(otherLevel);
    const level = useStore.getState().spatial?.byId[otherLevel];
    expect(level !== undefined && 'scaleMillimetresPerPixel' in level).toBe(true);
    expect(mounted.result.current.appliedScale).not.toBeNull();
  });

  it('kho rỗng và N16 hỏng thì bấm áp nói lý do tại chỗ, không im lặng, không PUT (B-V5-01)', async () => {
    useStore.getState().setSpatial(null, null);
    const harness = await makeHarness();
    const gateway = withScaleCapabilities(harness.gateway, {
      readLayer: () => Promise.reject(new Error('N16 hỏng')),
    });
    const mounted = mountHook(gateway);
    await settle(mounted);
    await typeReference(mounted);

    expect(mounted.result.current.model.panel.applyBlockedNotice).toBeUndefined();

    await applyNow(mounted);

    expect(harness.writeLayer).not.toHaveBeenCalled();
    expect(mounted.result.current.model.state).not.toBe('success');
    expect(mounted.result.current.model.panel.applyBlockedNotice).toBe(
      'Chưa nạp dữ liệu không gian của tầng này, nên chưa áp được tỷ lệ.',
    );
  });
});

describe('useScaleCalibration — tầng tỉ lệ tạm (scaleStatus unresolved)', () => {
  /** N16 của tầng mang tỉ lệ tạm; kho rỗng nên `useFloorLayer` nạp đúng tài liệu ấy. */
  async function mountProvisional(): Promise<{ harness: Harness; mounted: Mounted }> {
    useStore.getState().setSpatial(null, null);
    simulateProvisionalScale(FLOOR_ID, PROVISIONAL_RATIO);
    const harness = await makeHarness();
    const mounted = mountHook(harness.gateway);

    await settle(mounted);
    await settleAsync();

    return { harness, mounted };
  }

  it('storedRatio null: nhãn "chưa có", dải tỉ lệ tạm; áp đúng tỉ lệ tạm → một PUT, dải mất', async () => {
    const { harness, mounted } = await mountProvisional();

    expect(useStore.getState().floorMeta[FLOOR_ID]?.scaleStatus).toBe('unresolved');
    expect(mounted.result.current.model.panel.currentScaleLabel).toBe('chưa có');
    expect(mounted.result.current.model.provisionalScaleNotice).toBe(
      'Tỉ lệ tạm — số đo chưa tin được, hãy hiệu chỉnh tỉ lệ.',
    );

    await typeReference(mounted, PROVISIONAL_REAL_LENGTH);
    await applyNow(mounted);

    expect(harness.writeLayer).toHaveBeenCalledTimes(1);
    expect(harness.writeLayer.mock.calls[0]?.[0].body.scaleMillimetresPerPixel).toBeCloseTo(PROVISIONAL_RATIO, 6);
    expect(useStore.getState().floorMeta[FLOOR_ID]?.scaleStatus).toBeUndefined();
    expect(mounted.result.current.model.provisionalScaleNotice).toBeUndefined();
    expect(mounted.result.current.model.state).toBe('success');
  });

  it('hoàn tác trên tầng từng tỉ lệ tạm → một PUT tỉ lệ cũ, kèm câu của bước 5', async () => {
    const { harness, mounted } = await mountProvisional();

    await typeReference(mounted);
    await applyNow(mounted);
    expect(harness.writeLayer).toHaveBeenCalledTimes(1);

    await act(async () => {
      useStore.temporal.getState().undo();
    });
    await act(async () => {
      await clock.advance(RETRY_SCHEDULE_MS[0]);
    });
    await settleAsync();

    expect(harness.writeLayer).toHaveBeenCalledTimes(2);
    expect(harness.writeLayer.mock.calls[1]?.[0].body).toEqual({ scaleMillimetresPerPixel: PROVISIONAL_RATIO });
    expect(mounted.result.current.model.panel.applyBlockedNotice).toBe(
      'Đã đặt lại tỉ lệ cũ; tỉ lệ này nay được coi là tỉ lệ bạn chọn.',
    );
  });
});

describe('useScaleCalibration — áp mọi tầng (A9)', () => {
  const FLOORS = [
    { floorId: sampleLevelId(0), name: 'Tầng 1', hasDrawing: true, revision: 4 },
    { floorId: sampleLevelId(1), name: 'Tầng 2', hasDrawing: true, revision: 5 },
    { floorId: sampleLevelId(2), name: 'Tầng 3', hasDrawing: true, revision: 6 },
    { floorId: sampleLevelId(3), name: 'Mái', hasDrawing: false, revision: 7 },
  ] as const;

  async function mountAllFloors(): Promise<{ harness: Harness; mounted: Mounted }> {
    const harness = await makeHarness();
    const gateway = withScaleCapabilities(harness.gateway, { readAllFloors: async () => FLOORS });
    const mounted = mountHook(gateway);

    await settle(mounted);
    await settleAsync();
    await typeReference(mounted);
    await act(async () => {
      mounted.result.current.actions.onChangeApplyScope('allFloors');
    });
    await applyNow(mounted);

    return { harness, mounted };
  }

  it('bấm áp mở hộp thoại A9 với số tầng có bản vẽ; huỷ → không PUT, giữ trạng thái trước', async () => {
    const { harness, mounted } = await mountAllFloors();
    const before = mounted.result.current.model.state;

    expect(mounted.result.current.model.allFloorsConfirm).toEqual({
      title: 'Áp tỉ lệ này cho 3 tầng có bản vẽ?',
      message:
        'Tỉ lệ sẽ được coi là do bạn chọn; các tầng này không nắn hay cắt lại bản vẽ được nữa, trừ khi tải bản vẽ mới.',
      confirmLabel: 'Áp cho mọi tầng',
      cancelLabel: 'Huỷ',
    });

    await act(async () => {
      mounted.result.current.actions.onCancelAllFloors();
    });
    await settleAsync();

    expect(mounted.result.current.model.allFloorsConfirm).toBeUndefined();
    expect(mounted.result.current.model.state).toBe(before);
    expect(harness.writeLayer).not.toHaveBeenCalled();
  });

  it('đồng ý → nối tiếp, hint = revision N15, bỏ tầng không bản vẽ, nêu tầng bị khối và tầng hỏng', async () => {
    const { harness, mounted } = await mountAllFloors();
    const blockedFloor = FLOORS[2].floorId;
    let inFlight = 0;
    let maxInFlight = 0;

    // Tầng 3 bị khối trước: một lượt lưu lớp của nó vừa 403.
    harness.writeLayer.mockImplementation(async (input) => {
      inFlight += 1;
      maxInFlight = Math.max(maxInFlight, inFlight);
      await Promise.resolve();
      inFlight -= 1;

      if (input.floorId === blockedFloor) {
        return { error: FORBIDDEN, ok: false };
      }

      if (input.floorId === FLOORS[1].floorId) {
        return { error: { ...FORBIDDEN, code: 'VALIDATION', status: 422 }, ok: false };
      }

      return savedLayer(input.floorId, input.baseVersion + 1);
    });
    await act(async () => {
      const wall = Object.values(useStore.getState().spatial?.byId ?? {}).find(
        (entity) => 'thicknessMm' in entity && 'levelId' in entity && entity.levelId === blockedFloor,
      );

      if (wall !== undefined && 'thicknessMm' in wall) {
        commit({ op: 'update', kind: 'wall', id: wall.id, changes: { thicknessMm: wall.thicknessMm + 10 } }, 'Đổi độ dày');
      }
    });
    await act(async () => {
      await flushAutosaves().catch(() => undefined);
    });
    await settleAsync();
    harness.writeLayer.mockClear();

    await act(async () => {
      mounted.result.current.actions.onConfirmAllFloors();
    });
    await settleAsync();

    expect(harness.writeLayer.mock.calls.map(([input]) => [input.floorId, input.baseVersion, input.body])).toEqual([
      [FLOORS[0].floorId, 4, { scaleMillimetresPerPixel: REFERENCE_SCALE.millimetresPerPixel }],
      [FLOORS[1].floorId, 5, { scaleMillimetresPerPixel: REFERENCE_SCALE.millimetresPerPixel }],
    ]);
    expect(maxInFlight).toBe(1);

    const notice = mounted.result.current.model.panel.applyBlockedNotice ?? '';

    expect(notice).toContain('Đã áp tỉ lệ cho 1 tầng.');
    expect(notice).toContain('Không lưu được tỉ lệ cho: Tầng 2.');
    expect(notice).toContain('Chưa gửi vì tầng đang bị khoá lưu: Tầng 3.');
    expect(notice).toContain('Bỏ qua vì chưa có bản vẽ: Mái.');
    expect(mounted.result.current.model.state).not.toBe('success');
    expect(storedRatio()).toBeCloseTo(REFERENCE_SCALE.millimetresPerPixel, 6);
    const failedLevel = useStore.getState().spatial?.byId[FLOORS[1].floorId];
    expect(failedLevel !== undefined && 'order' in failedLevel ? failedLevel.scaleMillimetresPerPixel : null).not.toBe(
      REFERENCE_SCALE.millimetresPerPixel,
    );
  });
});

describe('useScaleCalibration — hai cảnh báo, cả hai KHÔNG chặn', () => {
  it('250 mm/px bật cảnh báo tường ba mét ngay khi gõ, nút áp vẫn bấm được', async () => {
    const harness = await makeHarness({ referenceWallWidthPx: REFERENCE_WALL_WIDTH });
    const mounted = mountHook(harness.gateway);
    await settle(mounted);
    await dragReferenceLine(mounted);

    // Một đoạn 400 px dài 100.000 mm cho ra đúng 250 mm/px.
    await act(async () => {
      mounted.result.current.actions.onChangeRealLength(
        typedNumber(IMPLAUSIBLE_RATIO * REFERENCE_PIXEL_LENGTH),
      );
    });

    const { panel } = mounted.result.current.model;
    const warning = panel.warnings.find((notice) => notice.warning.kind === 'implausible');

    expect(warning).toBeDefined();
    expect(warning?.statusCode).toBe('attention');
    // Nét tường 12 px ở 250 mm/px là một bức tường dày ba mét — đúng câu đặc tả nêu.
    const impliedThickness = millimetres(IMPLAUSIBLE_RATIO * REFERENCE_WALL_WIDTH);

    expect(warning?.warning.kind).toBe('implausible');
    expect(warning?.message).toContain(formatLength(impliedThickness));
    // Cảnh báo nói ra hậu quả, không khoá nút.
    expect(panel.canApply).toBe(true);
    expect(panel.areActionsHidden).toBe(false);
    // Cùng cảnh báo đó đứng cạnh ô nhập, hiện ngay khi gõ chứ không đợi rời ô.
    expect(panel.reference.inlineWarning).not.toBeNull();
  });

  it('lệch quá 15% so với ước tính của AI thì cảnh báo, vẫn không chặn', async () => {
    const harness = await makeHarness({ rows: sampleDimensionRows() });
    const mounted = mountHook(harness.gateway);
    await settle(mounted);
    await dragReferenceLine(mounted);

    const aiRatio = mounted.result.current.aiInference?.suggestedMillimetresPerPixel;

    expect(aiRatio).toBeDefined();

    // Một tỷ lệ lệch gấp đôi ngưỡng 15%, dựng bằng chính ngưỡng đó.
    const drifted = millimetresPerPixel(
      (aiRatio ?? 0) * (1 + SCALE_THRESHOLDS.aiDeviationLimit + SCALE_THRESHOLDS.aiDeviationLimit),
    );

    await act(async () => {
      mounted.result.current.actions.onChangeRealLength(
        typedNumber(drifted * REFERENCE_PIXEL_LENGTH),
      );
    });

    const { panel } = mounted.result.current.model;
    const warning = panel.warnings.find(
      (notice) => notice.warning.kind === 'deviatesFromEstimate',
    );

    expect(warning).toBeDefined();
    expect(warning?.statusCode).toBe('attention');
    expect(panel.canApply).toBe(true);
  });

  it('tỷ lệ hợp lý thì không cảnh báo gì', async () => {
    const harness = await makeHarness({ referenceWallWidthPx: REFERENCE_WALL_WIDTH });
    const mounted = mountHook(harness.gateway);
    await settle(mounted);
    await dragReferenceLine(mounted);

    await act(async () => {
      mounted.result.current.actions.onChangeRealLength(typedNumber(REFERENCE_REAL_LENGTH));
    });

    expect(mounted.result.current.model.panel.warnings).toHaveLength(0);
  });
});

describe('useScaleCalibration — ba dòng kiểm chứng luôn đủ ba', () => {
  it('giữ đúng ba dòng, và dòng chưa đo được nói "—" chứ không biến mất', async () => {
    const harness = await makeHarness({ referenceWallWidthPx: REFERENCE_WALL_WIDTH });
    const mounted = mountHook(harness.gateway);
    await settle(mounted);
    await dragReferenceLine(mounted);

    await act(async () => {
      mounted.result.current.actions.onChangeRealLength('4800');
    });

    const rows = mounted.result.current.model.panel.crossChecks;

    expect(rows.map((row) => row.id)).toEqual([
      'wallThickness',
      'doorWidth',
      'largestRoomArea',
    ]);
    expect(rows[0]?.valueLabel).not.toBe('—');
    expect(rows[1]?.valueLabel).toBe('—');
    expect(rows[2]?.valueLabel).toBe('—');
    // A5: không dòng nào mang màu "đã xác minh".
    expect(rows.every((row) => row.statusCode !== 'verified')).toBe(true);
  });
});

describe('useScaleCalibration — bảy trạng thái', () => {
  it('đạt tới được cả bảy', async () => {
    const reached = new Set<ScaleCalibrationState>();

    // 1. loading — trước khi lượt đọc đầu tiên về.
    const loadingHarness = await makeHarness();
    const loading = mountHook(loadingHarness.gateway);
    reached.add(loading.result.current.model.state);
    await settle(loading);

    // 2. empty — đọc xong, không chuỗi kích thước nào.
    reached.add(loading.result.current.model.state);

    // 3. partial — đã bắt tay vào việc nhưng chưa chốt.
    await dragReferenceLine(loading);
    reached.add(loading.result.current.model.state);

    // 4. success — đã áp.
    await act(async () => {
      loading.result.current.actions.onChangeRealLength('4800');
    });
    await applyNow(loading);
    reached.add(loading.result.current.model.state);
    loading.unmount();

    // 5. error — máy không tìm được khung bản vẽ, bản vẽ có thể méo.
    const warpedHarness = await makeHarness({ sourceFloorId: WARPED_MOCK_FLOOR_ID });
    const warped = mountHook(warpedHarness.gateway);
    await settle(warped);
    reached.add(warped.result.current.model.state);
    expect(warped.result.current.model.errorMessage).not.toBeNull();
    expect(warped.result.current.model.errorCode).not.toBeNull();
    warped.unmount();

    // 6. forbidden — người xem không có quyền sửa.
    const forbiddenHarness = await makeHarness();
    const forbidden = mountHook(forbiddenHarness.gateway, { roles: ['viewer'] });
    await settle(forbidden);
    reached.add(forbidden.result.current.model.state);
    expect(forbidden.result.current.model.canvas.isInteractive).toBe(false);
    expect(forbidden.result.current.model.panel.areActionsHidden).toBe(true);
    forbidden.unmount();

    // 7. collapsed — panel thu gọn.
    const collapsedHarness = await makeHarness();
    const collapsed = mountHook(collapsedHarness.gateway, { forceCollapsed: true });
    await settle(collapsed);
    reached.add(collapsed.result.current.model.state);
    collapsed.unmount();

    expect([...reached].sort()).toEqual([...SEVEN_STATES].sort());
  });

  it('lượt đọc hỏng có tiêu đề riêng, không mượn tiêu đề "nắn ảnh thất bại" (B-V5-04)', async () => {
    const harness = await makeHarness();
    const failing = mountHook({
      ...harness.gateway,
      readFloorDrawing: () => Promise.reject(new Error('mất kết nối')),
    });
    await settle(failing);

    expect(failing.result.current.model.state).toBe('error');
    expect(failing.result.current.model.errorTitle).toBeDefined();
    expect(failing.result.current.model.canvas.warpingNotice).toBeNull();
    failing.unmount();

    const warpedHarness = await makeHarness({ sourceFloorId: WARPED_MOCK_FLOOR_ID });
    const warped = mountHook(warpedHarness.gateway);
    await settle(warped);

    expect(warped.result.current.model.state).toBe('error');
    expect(warped.result.current.model.errorTitle).toBeUndefined();
    expect(warped.result.current.model.canvas.warpingNotice).not.toBeNull();
    warped.unmount();
  });

  it('trạng thái `partial` cũng đến từ chuỗi kích thước tin cậy thấp', async () => {
    const harness = await makeHarness({ rows: sampleDimensionRows(3) });
    const mounted = mountHook(harness.gateway);
    await settle(mounted);

    const { model } = mounted.result.current;

    expect(model.state).toBe('partial');
    expect(model.panel.dimension.lowConfidenceNotice).not.toBeNull();
    expect(model.panel.dimension.rows.filter((row) => row.isLowConfidence)).toHaveLength(3);
    // A5: hàng do AI đọc không bao giờ mang màu "đã xác minh".
    expect(model.panel.dimension.rows.every((row) => row.statusCode !== 'verified')).toBe(true);
  });
});

describe('useScaleCalibration — bàn phím và phiên kéo', () => {
  it('Esc huỷ đoạn đang kéo, R đo lại', async () => {
    const harness = await makeHarness();
    const mounted = mountHook(harness.gateway);
    await settle(mounted);

    await act(async () => {
      mounted.result.current.actions.onStartDrag({ x: 0, y: 0 });
    });

    expect(mounted.result.current.model.panel.reference.draft).not.toBeNull();

    await act(async () => {
      mounted.result.current.actions.onCancelDrag();
    });

    expect(mounted.result.current.model.panel.reference.draft).toBeNull();

    await dragReferenceLine(mounted);

    expect(mounted.result.current.model.panel.reference.canRemeasure).toBe(true);

    await act(async () => {
      mounted.result.current.actions.onRemeasure();
    });

    expect(mounted.result.current.model.panel.reference.draft).toBeNull();
  });

  it('nhích một đầu đoạn: mũi tên đi một pixel, Shift + mũi tên đi mười', async () => {
    const harness = await makeHarness();
    const mounted = mountHook(harness.gateway);
    await settle(mounted);
    await dragReferenceLine(mounted);

    const before = mounted.result.current.model.panel.reference.draft?.pixelLength ?? 0;

    await act(async () => {
      mounted.result.current.actions.onNudgeEndpoint('end', 'right', 'fine');
    });

    const afterFine = mounted.result.current.model.panel.reference.draft?.pixelLength ?? 0;

    await act(async () => {
      mounted.result.current.actions.onNudgeEndpoint('end', 'right', 'coarse');
    });

    const afterCoarse = mounted.result.current.model.panel.reference.draft?.pixelLength ?? 0;

    expect(afterFine - before).toBeCloseTo(1, 6);
    expect(afterCoarse - afterFine).toBeCloseTo(10, 6);
  });

  it('giữ Shift khoá đoạn theo trục', async () => {
    const harness = await makeHarness();
    const mounted = mountHook(harness.gateway);
    await settle(mounted);

    await act(async () => {
      mounted.result.current.actions.onStartDrag({ x: 0.2, y: 0.2 });
    });
    await act(async () => {
      mounted.result.current.actions.onMoveDrag({ x: 0.5, y: 0.22 }, { isAxisLocked: true });
    });

    const draft = mounted.result.current.model.panel.reference.draft;

    expect(draft?.isAxisLocked).toBe(true);
    expect(draft?.end.y).toBeCloseTo(draft?.start.y ?? 0, 6);
  });

  it('nêu đủ sáu dòng nhắc phím tắt, tổ hợp do `formatCombo` viết', async () => {
    const harness = await makeHarness();
    const mounted = mountHook(harness.gateway);
    await settle(mounted);

    const hints = mounted.result.current.model.panel.shortcutHints;

    expect(hints).toHaveLength(6);
    expect(hints.map((hint) => hint.comboLabel)).toContain(
      formatCombo(parseCombo('Shift+ArrowLeft')),
    );
    expect(hints.every((hint) => hint.description.length > 0)).toBe(true);
  });
});

describe('useScaleCalibration — review-1 F3 (P2-4, P2-5, Nit-3)', () => {
  /** Tầng đang mở đã có một tỉ lệ trước lượt áp — có cái để hoàn tác về mà gửi. */
  beforeEach(() => {
    const graph = createSampleBuilding();
    const levels = graph.levels.map((level) =>
      level.id === FLOOR_ID ? { ...level, scaleMillimetresPerPixel: PROVISIONAL_RATIO } : level,
    );
    const spatial = normalizeSpatial({ ...graph, levels });

    useStore.getState().setSpatial(spatial, 'version-1', {
      floorRevisions: Object.fromEntries(spatial.byKind.level.map((id) => [id, 0])),
      projectId: PROJECT_ID,
    });
  });

  /** Gõ đoạn tham chiếu rồi áp; trả về hook đã gắn. */
  async function mountAndApply(harness: Harness): Promise<Mounted> {
    const mounted = mountHook(harness.gateway);

    await settle(mounted);
    await settleAsync();
    await typeReference(mounted);
    await applyNow(mounted);

    return mounted;
  }

  async function undoAndSend(): Promise<void> {
    await act(async () => {
      useStore.temporal.getState().undo();
    });
    await act(async () => {
      await clock.advance(RETRY_SCHEDULE_MS[0]);
    });
    await settleAsync();
  }

  it('P2-4: áp, gỡ màn, gắn lại, Ctrl+Z → đúng một PUT tỉ lệ cũ', async () => {
    const before = storedRatio();
    const harness = await makeHarness();
    const first = await mountAndApply(harness);

    // Hẹn lưu 800 ms của lượt gắn đầu chạy xong TRƯỚC khi gỡ — không thì chính hẹn ấy
    // (closure của lượt gắn cũ) gửi cú hoàn tác, và bài này không còn kiểm lượt gắn lại.
    await act(async () => {
      await clock.advance(RETRY_SCHEDULE_MS[0]);
    });
    await settleAsync();
    expect(harness.writeLayer).toHaveBeenCalledTimes(1);
    first.unmount();

    const second = mountHook(harness.gateway);
    await settle(second);
    await settleAsync();
    await undoAndSend();

    expect(storedRatio()).toBe(before);
    expect(harness.writeLayer).toHaveBeenCalledTimes(2);
    expect(harness.writeLayer.mock.calls[1]?.[0].body).toEqual({ scaleMillimetresPerPixel: before });
  });

  it('P2-4: mốc khoá theo dự án — dự án khác thì Ctrl+Z không gửi tỉ lệ', async () => {
    const harness = await makeHarness();
    const first = await mountAndApply(harness);
    await act(async () => {
      await clock.advance(RETRY_SCHEDULE_MS[0]);
    });
    await settleAsync();
    first.unmount();

    const queryClient = createTestQueryClient();
    const other = renderHook(
      () => useScaleCalibration({ projectId: 'project-2', floorId: FLOOR_ID, gateway: harness.gateway }),
      { wrapper: ({ children }: { children: ReactNode }) => createElement(QueryClientProvider, { client: queryClient }, children) },
    );
    await settleAsync();
    await undoAndSend();
    other.unmount();

    expect(harness.writeLayer).toHaveBeenCalledTimes(1);
  });

  it('Nit-3: hoàn tác gửi PUT thì trạng thái không còn "success"', async () => {
    const harness = await makeHarness();
    const mounted = await mountAndApply(harness);

    expect(mounted.result.current.model.state).toBe('success');

    await undoAndSend();

    expect(harness.writeLayer).toHaveBeenCalledTimes(2);
    expect(mounted.result.current.model.state).not.toBe('success');
  });

  it('P2-5: readAllFloors trên bộ mẫu ghép #12 với N15 theo order khi mã lệch — đích mang mã Level và revision', async () => {
    const client = createMockApiClient();
    const floors = await client.floors.list({ projectId: PROJECT_ID });
    const graph = await client.spatial.readGraph({ projectId: PROJECT_ID });

    if (!floors.ok || !graph.ok) {
      throw new Error('Bộ mẫu không đọc được #12 hoặc N15.');
    }

    const levels = graph.data.graph.levels;
    // Tiền đề của ca này: trên bộ mẫu `Floor.id` ≠ `Level.id`.
    expect(floors.data.some((floor) => levels.some((level) => level.id === floor.id))).toBe(false);

    const targets = await createScaleCalibrationGateway(client).readAllFloors({ projectId: PROJECT_ID });

    expect(targets).toHaveLength(floors.data.length);
    targets.forEach((target, index) => {
      const level = levels.find((entry) => entry.id === target.floorId);

      expect(level?.order).toBe(floors.data[index]?.order);
      expect(target.revision).toBe(
        graph.data.floorRevisions.find((entry) => entry.floorId === target.floorId)?.revision,
      );
      expect(target.revision).toBeDefined();
    });
  });
});
