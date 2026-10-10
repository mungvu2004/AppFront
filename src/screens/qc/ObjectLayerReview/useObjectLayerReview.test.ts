/**
 * Nửa "suy nghĩ" của màn S-13 "Lớp đối tượng", kiểm không cần DOM của màn.
 *
 * Hook được lái qua `renderHook`, tầng dữ liệu là
 * `createMockObjectLayerReviewGateway()` — cùng cổng story sẽ dùng — và mọi con
 * số khẳng định đọc ra từ `objectLayerFixture.ts` /
 * `objectLayerReviewScenarios.ts`, không có bảng dữ liệu thứ hai bịa tại chỗ
 * (R-70).
 *
 * ## Ba phép kiểm nghiệm thu, mỗi phép IN RA con số nó đếm được
 *
 * 1. Kéo một cửa **20 lần liên tục** trong cửa sổ gộp 400 ms → lịch sử chỉ tăng
 *    **một** bước (D-06). In số bước thật, đọc từ `undoStepCount`.
 * 2. Bật cả ba lớp con → đúng **ba** màu dữ liệu hiện cùng lúc, không hơn (P-06).
 *    In số màu đếm được.
 * 3. Tổng số đối tượng là **21**, và 9 + 7 + 5 = 21 ở mọi nơi con số xuất hiện.
 *    In cả bốn con số.
 */

import { createElement, type ReactNode } from 'react';
import { QueryClientProvider } from '@tanstack/react-query';
import { act, cleanup, renderHook, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { __resetMockLayerState, createMockApiClient, simulateRemoteLayerEdit } from '@/api/__mocks__/client';
import { createSampleBuilding, sampleLevelId } from '@/domain/spatial/__fixtures__/sampleBuilding';
import { isIdOfKind } from '@/domain/spatial/ids';
import { denormalizeSpatial, normalizeSpatial, type NormalizedSpatial } from '@/domain/spatial/normalize';
import type {
  Furniture,
  FurnitureId,
  FurnitureKind,
  Level,
  OpeningId,
  SwingDirection,
} from '@/domain/spatial/types';
import { boxAround } from '@/lib/input/dragDrop';
import { toAttachedOpening } from '@/lib/commands/business/shared';
import { __resetFloorLayerSavers, flushAutosaves } from '@/hooks/useAutosave';
import { FLOOR_NOT_FOUND_MESSAGE } from '@/hooks/useFloorLayer';
import { ROUTES } from '@/routes/paths';
import { createShortcutRegistry, type ShortcutRegistry } from '@/lib/input/shortcutRegistry';
import { createNotificationBus, type NotificationBus } from '@/lib/mutations/notificationBus';
import { installFakeClock, type FakeClock } from '@/lib/testing/fakeClock';
import { createTestQueryClient } from '@/lib/testing/render';
import { SEVEN_STATES } from '@/lib/testing/sevenStateScenarios';
import { toOpeningViewModel } from '@/lib/viewmodel/toViewModel';
import { resetSelectorCaches } from '@/store/selectors';
import { useStore } from '@/store';

import {
  applyObjectFilters,
  deriveScreenState,
  subtypeSlotsOf,
  useObjectLayerReview,
  type UseObjectLayerReviewOptions,
} from './useObjectLayerReview';
import {
  attachOrphanToNearestWall,
  buildAddOpeningCommand,
  buildApproveObjectCommand,
  buildObjectLayerGraph,
  commandContextOf,
  countsOf,
  createMockObjectLayerReviewGateway,
  createObjectLayerReviewGateway,
  dataLayerTokens,
  entityIdOf,
  formatObjectSize,
  manualDoorProposalOf,
  OBJECT_LAYER_TEXT,
  type ObjectLayerReviewGateway,
  graphOpeningsOf,
  objectsOf,
  objectStatusCode,
  OBJECT_APPROVE_COMMAND_TYPE,
  OBJECT_CHANGE_KIND_COMMAND_TYPE,
  OBJECT_CHANGE_SWING_COMMAND_TYPE,
  OBJECT_LAYER_SAMPLE_GRAPH,
  OBJECT_LAYER_SAMPLE_LEVEL,
  OBJECT_LAYER_SEED,
  reviewCounterOf,
  reviewProgressLabel,
  scaleOfLevel,
  solidWallsOf,
  toPixelPoint,
} from './objectLayerReviewGateway';
import {
  OBJECT_LAYER_REVIEW_SCENARIOS,
  OBJECT_LAYER_SCENARIO_FURNITURE_BRANCH,
  objectLayerScenarioFor,
} from './objectLayerReviewScenarios';
import {
  OBJECT_LAYER_FIXTURE_COUNTS,
  OBJECT_LAYER_FIXTURE_LOW_CONFIDENCE,
  OBJECT_LAYER_FIXTURE_OBJECTS,
  OBJECT_LAYER_FIXTURE_REVIEWED,
} from './objectLayerFixture';
import {
  OBJECT_LAYER_IDS,
  type ObjectLayerReviewModel,
  type ObjectSubtype,
  type ReviewObject,
} from './objectLayerTypes';

/* -------------------------------------------------------------------------- */
/* Bộ mẫu — đọc ra, không viết tay lại.                                        */
/* -------------------------------------------------------------------------- */

const PROJECT_ID = 'project-1';
const FLOOR_ID = OBJECT_LAYER_SAMPLE_LEVEL.id;

/** Số lượt kéo liên tục của phép kiểm D-06 — đúng con số đặc tả đòi. */
const DRAG_COUNT = 20;

/** Mỗi lượt kéo dịch một phần trăm chiều dài tim tường — đủ xa để không bị coi là đứng yên. */
const DRAG_STEP = 0.01;

/** Cửa được kéo trong phép kiểm D-06 — `D-001`, cửa đơn trên tường `W-001`. */
const DRAGGED_OBJECT_ID = 'D-001';

/** Đối tượng CHƯA GẮN của bộ mẫu — `D-009`. */
const ORPHAN_OBJECT_ID = 'D-009';

/* -------------------------------------------------------------------------- */
/* Môi trường.                                                                 */
/* -------------------------------------------------------------------------- */

beforeEach(() => {
  /* Bộ lưu lớp và revision mock sống cấp module — mỗi bài kiểm bắt đầu sạch. */
  __resetFloorLayerSavers();
  __resetMockLayerState();
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
  readonly result: { current: ObjectLayerReviewModel };
  readonly registry: ShortcutRegistry;
  readonly unmount: () => void;
}

type MountOptions = Partial<Omit<UseObjectLayerReviewOptions, 'registry'>>;

function mountHook(options: MountOptions = {}): Mounted {
  const registry = createShortcutRegistry();
  const queryClient = createTestQueryClient();
  const wrapper = ({ children }: { children: ReactNode }): ReactNode =>
    createElement(QueryClientProvider, { client: queryClient }, children);

  const rendered = renderHook(
    () =>
      useObjectLayerReview({
        projectId: options.projectId ?? PROJECT_ID,
        floorId: options.floorId ?? FLOOR_ID,
        roles: options.roles ?? ['engineer'],
        gateway: options.gateway ?? createMockObjectLayerReviewGateway(),
        registry,
        ...(options.notifications === undefined ? {} : { notifications: options.notifications }),
        ...(options.forceCollapsed === undefined ? {} : { forceCollapsed: options.forceCollapsed }),
        ...(options.onNavigate === undefined ? {} : { onNavigate: options.onNavigate }),
      }),
    { wrapper },
  );

  return { result: rendered.result, registry, unmount: rendered.unmount };
}

/** Chờ lượt đọc xong — trước đó mọi kịch bản đều là `'loading'`. */
async function mountSettled(options: MountOptions = {}): Promise<Mounted> {
  const mounted = mountHook(options);

  await waitFor(() => {
    expect(mounted.result.current.state).not.toBe('loading');
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

/** Một lượt gọi hành động của hook, chờ cho tới khi mọi promise của nó lắng. */
async function run(action: () => void): Promise<void> {
  await act(async () => {
    action();
    await Promise.resolve();
    await Promise.resolve();
    await Promise.resolve();
  });
}

/** Đọc thẳng một thực thể ra khỏi kho — không qua viewmodel. */
const entityInStore = (displayId: string, layer: 'door' | 'window' | 'furniture'): unknown =>
  useStore.getState().spatial?.byId[entityIdOf(displayId, layer)];

/* -------------------------------------------------------------------------- */
/* Phép ghép thuần — kiểm được mà không cần dựng hook.                          */
/* -------------------------------------------------------------------------- */

describe('phép ghép thuần của màn Lớp đối tượng', () => {
  it('bảy trạng thái dẫn xuất đúng, đủ và không thừa nhánh nào', () => {
    const derived = OBJECT_LAYER_REVIEW_SCENARIOS.map((scenario) =>
      deriveScreenState({
        isViewerRole: scenario.isViewerRole,
        isCollapsed: scenario.isCollapsed,
        hasError: scenario.error !== null,
        isLoading: scenario.graph === null && scenario.error === null,
        hasFurnitureAttention: false,
        counter: scenario.reviewCounter,
      }),
    );

    expect(derived).toEqual([...SEVEN_STATES]);
  });

  it('nhánh nội thất lỗi giữ màn ở "Một phần" chứ không đẩy sang "Lỗi"', () => {
    const scenario = OBJECT_LAYER_SCENARIO_FURNITURE_BRANCH;

    expect(
      deriveScreenState({
        isViewerRole: false,
        isCollapsed: false,
        hasError: false,
        isLoading: false,
        hasFurnitureAttention: true,
        counter: scenario.reviewCounter,
      }),
    ).toBe('partial');
    /* Cùng bộ đếm mà không có lỗi nhánh nội thất thì màn đã xong. */
    expect(
      deriveScreenState({
        isViewerRole: false,
        isCollapsed: false,
        hasError: false,
        isLoading: false,
        hasFurnitureAttention: false,
        counter: scenario.reviewCounter,
      }),
    ).toBe('success');
  });

  it('ba ô 1/2/3 của mỗi nhóm cắt đúng từ chín loại con', () => {
    expect(subtypeSlotsOf('door')).toEqual(['singleDoor', 'doubleDoor']);
    expect(subtypeSlotsOf('window')).toEqual(['window']);
    expect(subtypeSlotsOf('furniture')).toEqual(['bed', 'sofa', 'diningTable', 'toilet', 'basin', 'otherFurniture']);
  });

  it('bộ lọc lớp con và chip lọc cắt đúng danh sách', () => {
    const objects = objectsOf(OBJECT_LAYER_SAMPLE_GRAPH, OBJECT_LAYER_SAMPLE_LEVEL);
    const doorsOnly = applyObjectFilters(objects, {
      layerVisibility: { door: true, window: false, furniture: false },
      subtypes: new Set(),
      lowConfidenceOnly: false,
    });

    expect(doorsOnly).toHaveLength(OBJECT_LAYER_FIXTURE_COUNTS.doorCount);
  });

  it('trạng thái màu khớp `toOpeningViewModel` cho MỌI lỗ mở của bộ mẫu (A5)', () => {
    const walls = new Map(
      solidWallsOf(OBJECT_LAYER_SAMPLE_GRAPH, OBJECT_LAYER_SAMPLE_LEVEL).map(
        (wall) => [wall.id, wall] as const,
      ),
    );
    let compared = 0;

    for (const opening of graphOpeningsOf(OBJECT_LAYER_SAMPLE_GRAPH)) {
      const wall = walls.get(opening.wallId);

      if (wall === undefined) {
        continue;
      }

      compared += 1;
      expect(objectStatusCode(opening, false)).toBe(toOpeningViewModel(opening).statusCode);
      /* `toAttachedOpening` đọc được lỗ mở đó, tức đồ thị dựng ra là hợp lệ. */
      expect(toAttachedOpening(opening, wall).wallId).toBe(wall.id);
    }

    expect(compared).toBeGreaterThan(0);
  });

  it('P-01 định dạng "900 × 2.200 mm" — dấu nghìn là dấu chấm', () => {
    expect(formatObjectSize(900, 2200)).toBe('900 × 2.200 mm');
    expect(reviewProgressLabel(9, 21)).toBe('9/21 đối tượng đã duyệt');
  });
});

/* -------------------------------------------------------------------------- */
/* NGHIỆM THU 3 — 21 = 9 + 7 + 5.                                              */
/* -------------------------------------------------------------------------- */

describe('[NGHIEM-3] tổng số đối tượng', () => {
  it('tổng là 21 và 9 + 7 + 5 = 21 ở mọi nơi con số xuất hiện', async () => {
    const mounted = await mountSettled();
    const model = mounted.result.current;
    const { counts, reviewCounter } = model;

    console.log(
      `tổng đối tượng: ${counts.total} = ${counts.doorCount} cửa đi + ${counts.windowCount} cửa sổ + ${counts.furnitureCount} nội thất`,
    );
    console.log(`bộ đếm duyệt: ${reviewCounter.reviewed}/${reviewCounter.total}`);

    expect(counts.doorCount).toBe(9);
    expect(counts.windowCount).toBe(7);
    expect(counts.furnitureCount).toBe(5);
    expect(counts.total).toBe(21);
    expect(counts.doorCount + counts.windowCount + counts.furnitureCount).toBe(counts.total);

    /* Bốn nơi con số phải bằng nhau: cây lớp, bộ đếm, danh sách thô, và bộ mẫu. */
    expect(model.objects).toHaveLength(21);
    expect(reviewCounter.total).toBe(21);
    expect(OBJECT_LAYER_FIXTURE_OBJECTS).toHaveLength(21);
    expect(countsOf(model.objects)).toEqual(OBJECT_LAYER_FIXTURE_COUNTS);

    expect(reviewCounter.reviewed).toBe(OBJECT_LAYER_FIXTURE_REVIEWED);
    expect(model.reviewProgressLabel).toBe('9/21 đối tượng đã duyệt');
    expect(model.layerTotalLabel).toBe('Tổng 21 đối tượng');

    mounted.unmount();
  });

  it('năm mục dưới ngưỡng tin cậy được lọc sẵn ở trạng thái một phần', async () => {
    const mounted = await mountSettled();

    console.log(`mục dưới ngưỡng tin cậy: ${mounted.result.current.rows.length}`);

    expect(mounted.result.current.state).toBe('partial');
    expect(mounted.result.current.isLowConfidenceOnly).toBe(true);
    expect(mounted.result.current.partialNotice).toBe('5 mục dưới ngưỡng tin cậy, đã lọc sẵn');
    expect(mounted.result.current.rows).toHaveLength(OBJECT_LAYER_FIXTURE_LOW_CONFIDENCE);

    /* Tắt bộ lọc thì cả 21 hàng quay lại — bộ đếm cây lớp không đổi bao giờ. */
    await run(() => mounted.result.current.onToggleLowConfidenceOnly());

    expect(mounted.result.current.rows).toHaveLength(21);
    expect(mounted.result.current.counts.total).toBe(21);

    mounted.unmount();
  });
});

/* -------------------------------------------------------------------------- */
/* NGHIỆM THU 2 — đúng ba màu dữ liệu.                                         */
/* -------------------------------------------------------------------------- */

describe('[NGHIEM-2] màu dữ liệu (P-06)', () => {
  it('bật cả ba lớp con cho ra ĐÚNG ba màu dữ liệu, không hơn', async () => {
    const mounted = await mountSettled();
    const tokens = mounted.result.current.dataLayerTokens;

    console.log(`số màu dữ liệu hiện cùng lúc: ${tokens.length} — ${tokens.join(', ')}`);

    expect(mounted.result.current.layerVisibility).toEqual({
      door: true,
      window: true,
      furniture: true,
    });
    expect(tokens).toHaveLength(3);
    expect(new Set(tokens).size).toBe(3);
    expect(tokens.length).toBeLessThanOrEqual(OBJECT_LAYER_IDS.length);

    /* Tắt một lớp thì màu của nó biến khỏi danh sách — không có màu thứ tư nào chờ sẵn. */
    await run(() => mounted.result.current.onToggleLayer('furniture'));

    console.log(`sau khi tắt lớp nội thất: ${mounted.result.current.dataLayerTokens.length} màu`);
    expect(mounted.result.current.dataLayerTokens).toHaveLength(2);

    mounted.unmount();
  });

  it('màu độ tin cậy do `src/lib/coloring` tô, không phải một bảng tự chế', async () => {
    const mounted = await mountSettled();
    const token = mounted.result.current.confidenceTokenOf('D-007');

    expect(typeof token).toBe('string');
    expect(token.startsWith('--')).toBe(true);

    mounted.unmount();
  });

  it('ba lớp con, ba màu — bảng tra không nhận một lớp thứ tư', () => {
    expect(dataLayerTokens({ door: true, window: true, furniture: true })).toHaveLength(3);
    expect(dataLayerTokens({ door: false, window: false, furniture: false })).toHaveLength(0);
  });
});

/* -------------------------------------------------------------------------- */
/* NGHIỆM THU 1 — D-06, hai mươi lượt kéo, một bước lịch sử.                    */
/* -------------------------------------------------------------------------- */

describe('[NGHIEM-1] D-06 gộp lệnh trong cửa sổ 400 ms', () => {
  let clock: FakeClock | null = null;

  afterEach(() => {
    clock?.restore();
    clock = null;
  });

  it('kéo một cửa 20 lần liên tục → lịch sử chỉ tăng 1 bước', async () => {
    const mounted = await mountSettled();
    const startPosition = 0.5;

    expect(mounted.result.current.undoStepCount).toBe(0);

    /*
     * Đồng hồ đóng băng SAU khi lượt đọc đã lắng: hai mươi lệnh vì thế mang
     * cùng một mốc giờ, tức khoảng cách giữa chúng là 0 ms — nằm gọn trong cửa
     * sổ `MERGE_WINDOW_MS` mà không cần viết con số 400 ở đây (R-71).
     */
    clock = installFakeClock();

    for (let index = 0; index < DRAG_COUNT; index += 1) {
      await run(() =>
        mounted.result.current.onDragPosition(
          DRAGGED_OBJECT_ID,
          startPosition + (index + 1) * DRAG_STEP,
        ),
      );
    }

    const steps = mounted.result.current.undoStepCount;

    console.log(`số lượt kéo: ${DRAG_COUNT} — số bước lịch sử sau đó: ${steps}`);

    expect(steps).toBe(1);

    /* Một lần Ctrl+Z đưa cửa về đúng chỗ TRƯỚC khi cử chỉ bắt đầu, không phải bước 19. */
    const movedPosition = mounted.result.current.inspector;

    expect(movedPosition).toBeNull();

    await pressKey(mounted.registry, 'z', { ctrlKey: true });

    console.log(`số bước lịch sử sau một lần hoàn tác: ${mounted.result.current.undoStepCount}`);
    expect(mounted.result.current.undoStepCount).toBe(0);

    mounted.unmount();
  });
});

/* -------------------------------------------------------------------------- */
/* Ba lệnh còn thiếu (QĐ-3).                                                   */
/* -------------------------------------------------------------------------- */

describe('ba lệnh dựng bằng nguyên thuỷ công khai', () => {
  it('đổi loại cửa sổ → cửa đi là MỘT lệnh hoàn tác được, kéo theo cao độ bệ', async () => {
    const mounted = await mountSettled();

    await run(() => mounted.result.current.onChangeSubtype('S-003', 'singleDoor'));

    await waitFor(() => {
      expect((entityInStore('S-003', 'window') as { kind: string }).kind).toBe('door');
    });

    const changed = entityInStore('S-003', 'window') as {
      kind: string;
      sillHeightMm: number;
      swing: string;
      reviewed: boolean;
    };

    /* Đổi loại kéo theo cao độ bệ (cửa sổ 900 → cửa đi 0) trong CÙNG một lệnh. */
    expect(changed.sillHeightMm).toBe(0);
    expect(changed.swing).toBe('left');
    /* Đổi loại KHÔNG phải duyệt: cờ review giữ nguyên (A5). */
    expect(changed.reviewed).toBe(false);
    expect(mounted.result.current.undoStepCount).toBe(1);

    await run(() => mounted.result.current.onUndo());

    await waitFor(() => {
      const back = entityInStore('S-003', 'window') as { kind: string; sillHeightMm: number };

      expect(back.kind).toBe('window');
      expect(back.sillHeightMm).toBe(900);
    });

    mounted.unmount();
  });

  it('`validateOpening` của M-08 CHẶN lượt đổi loại làm lỗ mở vượt đỉnh tường', async () => {
    const mounted = await mountSettled();
    const before = entityInStore('D-004', 'door') as { kind: string; sillHeightMm: number };

    expect(before.kind).toBe('door');

    /*
     * Cửa `D-004` cao 2.200 mm trên tường cao 3.000 mm. Thành cửa sổ thì bệ lên
     * 900 mm và đỉnh lỗ mở thành 3.100 mm — cao hơn đỉnh tường. Màn KHÔNG tự
     * kiểm điều đó: `validateOpening` của M-08 nói ra, và lệnh bị từ chối.
     */
    await run(() => mounted.result.current.onChangeSubtype('D-004', 'window'));

    const after = entityInStore('D-004', 'door') as { kind: string; sillHeightMm: number };

    expect(after.kind).toBe('door');
    expect(after.sillHeightMm).toBe(0);
    /* Lệnh bị từ chối thì không có bước lịch sử nào được sinh ra. */
    expect(mounted.result.current.undoStepCount).toBe(0);

    mounted.unmount();
  });

  it('đổi chiều mở là một lệnh riêng, hoàn tác được', async () => {
    const mounted = await mountSettled();

    await run(() => mounted.result.current.onChangeSwing('D-001', 'right'));

    await waitFor(() => {
      expect((entityInStore('D-001', 'door') as { swing: string }).swing).toBe('right');
    });

    await run(() => mounted.result.current.onUndo());

    await waitFor(() => {
      expect((entityInStore('D-001', 'door') as { swing: string }).swing).toBe('left');
    });

    mounted.unmount();
  });

  it('duyệt đặt `reviewed: true` KÈM `source: "human"` — A5, và chỉ đường này đặt nó', async () => {
    const mounted = await mountSettled();
    const before = entityInStore('D-004', 'door') as { reviewed: boolean; source: string };

    expect(before.reviewed).toBe(false);
    expect(before.source).toBe('ai');

    await run(() => mounted.result.current.onApprove('D-004'));

    await waitFor(() => {
      const after = entityInStore('D-004', 'door') as { reviewed: boolean; source: string };

      expect(after.reviewed).toBe(true);
      expect(after.source).toBe('human');
    });

    console.log(`bộ đếm duyệt sau một lượt duyệt: ${mounted.result.current.reviewCounter.reviewed}/21`);
    expect(mounted.result.current.reviewCounter.reviewed).toBe(OBJECT_LAYER_FIXTURE_REVIEWED + 1);

    mounted.unmount();
  });

  it('lệnh duyệt không có tham số `source` — không đường nào cho AI bật cờ xanh (A5)', () => {
    const opening = graphOpeningsOf(OBJECT_LAYER_SAMPLE_GRAPH).find(
      (candidate) => !candidate.reviewed,
    );

    expect(opening).toBeDefined();

    const command = buildApproveObjectCommand(
      opening as NonNullable<typeof opening>,
      'test-actor',
      'D-004',
    );
    const change = command.changes[0];

    expect(command.type).toBe(OBJECT_APPROVE_COMMAND_TYPE);
    expect(command.description).toContain('Duyệt đối tượng');
    expect((change?.after as { reviewed: boolean; source: string }).reviewed).toBe(true);
    expect((change?.after as { reviewed: boolean; source: string }).source).toBe('human');
    /* Hoàn tác được: ảnh chụp `before` đầy đủ, không phải diff từng trường. */
    expect(change?.before).not.toBeNull();
  });

  it('ba loại lệnh mang ba tên khác nhau, viết đúng một chỗ (R-71)', () => {
    expect(
      new Set([
        OBJECT_CHANGE_KIND_COMMAND_TYPE,
        OBJECT_CHANGE_SWING_COMMAND_TYPE,
        OBJECT_APPROVE_COMMAND_TYPE,
      ]).size,
    ).toBe(3);
  });
});

/* -------------------------------------------------------------------------- */
/* Đối tượng chưa gắn được vào tường nào.                                      */
/* -------------------------------------------------------------------------- */

describe('đối tượng chưa gắn vào tường nào', () => {
  it('bị gắn cờ chứ không bị xoá, và nói rõ nó chưa có tường chủ', async () => {
    const mounted = await mountSettled();
    const row = mounted.result.current.objects.find((object) => object.id === ORPHAN_OBJECT_ID);

    expect(row).toBeDefined();
    expect(row?.hostWallId).toBeNull();

    await run(() => mounted.result.current.onSelect(ORPHAN_OBJECT_ID));

    await waitFor(() => {
      expect(mounted.result.current.inspector?.isOrphan).toBe(true);
    });

    const inspector = mounted.result.current.inspector;

    expect(inspector?.hostWallLabel).toBeNull();
    expect(inspector?.relativePosition).toBeNull();

    mounted.unmount();
  });

  it('mọi đối tượng ĐÃ gắn nói rõ tường nào chứa nó', async () => {
    const mounted = await mountSettled();
    const attached = mounted.result.current.objects.filter(
      (object) => object.id !== ORPHAN_OBJECT_ID,
    );

    expect(attached).toHaveLength(20);

    for (const object of attached) {
      expect(object.hostWallId).not.toBeNull();
    }

    mounted.unmount();
  });

  it('"gắn vào tường gần nhất" hỏi M-08 và nói ra câu từ chối của nó', async () => {
    const notifications: NotificationBus = createNotificationBus();
    const seen: string[] = [];

    notifications.subscribe((published) => {
      for (const notification of published) {
        seen.push(`${notification.title} ${notification.description}`);
      }
    });

    const mounted = await mountSettled({ notifications });

    expect(entityInStore(ORPHAN_OBJECT_ID, 'door')).toBeUndefined();

    await run(() => mounted.result.current.onAttachToNearestWall(ORPHAN_OBJECT_ID));

    /*
     * Tường gần nhất của `D-009` là `W-008`, và `D-008` đã chiếm đúng chỗ ấy.
     * Màn KHÔNG tự đi tìm tường thứ hai (CẤM TUYỆT ĐỐI) và cũng không tự kiểm
     * chồng lấn: câu từ chối dưới đây là câu `validateOpening` của M-08 viết ra.
     */
    await waitFor(() => {
      expect(seen.some((line) => line.includes('chồng lên'))).toBe(true);
    });

    expect(entityInStore(ORPHAN_OBJECT_ID, 'door')).toBeUndefined();
    /* Tổng vẫn là 21: một lượt gắn bị từ chối không làm mất đối tượng nào. */
    expect(mounted.result.current.counts.total).toBe(21);

    mounted.unmount();
  });

  it('"gắn vào tường gần nhất" dựng được lệnh khi tường gợi ý còn trống', () => {
    /*
     * Cùng đối tượng chưa gắn, nhưng trên một đồ thị mà `W-008` chưa có cửa nào:
     * ba bước M-08 (`findOrphans` → `placeOnWall` → `attachToWall`) cho ra một
     * đầu vào hợp lệ và `opening.add` của S-07 nhận nó.
     */
    const freeSeed = OBJECT_LAYER_SEED.filter((entry) => entry.displayId !== 'D-008');
    const graph = buildObjectLayerGraph(freeSeed);
    const entry = OBJECT_LAYER_SEED.find((candidate) => candidate.displayId === ORPHAN_OBJECT_ID);
    const input = attachOrphanToNearestWall(
      entry as NonNullable<typeof entry>,
      graph,
      OBJECT_LAYER_SAMPLE_LEVEL,
    );

    expect(input).not.toBeNull();

    const built = buildAddOpeningCommand(
      input as NonNullable<typeof input>,
      commandContextOf(graph, 'test-actor'),
    );

    expect(built.ok).toBe(true);
  });
});

/* -------------------------------------------------------------------------- */
/* Bàn phím, vùng chọn, vai trò.                                               */
/* -------------------------------------------------------------------------- */

describe('bàn phím và vùng chọn', () => {
  it('D / W / F đặt nhóm loại qua SỔ PHÍM THẬT', async () => {
    const mounted = await mountSettled();

    await pressKey(mounted.registry, 'W');
    expect(mounted.result.current.activeLayer).toBe('window');

    await pressKey(mounted.registry, 'F');
    expect(mounted.result.current.activeLayer).toBe('furniture');

    await pressKey(mounted.registry, 'D');
    expect(mounted.result.current.activeLayer).toBe('door');

    mounted.unmount();
  });

  it('1 / 2 đổi loại trong nhóm đang chọn', async () => {
    const mounted = await mountSettled();

    await run(() => mounted.result.current.onSelect('D-004'));
    await pressKey(mounted.registry, 'D');
    await pressKey(mounted.registry, '2');

    await waitFor(() => {
      expect((entityInStore('D-004', 'door') as { swing: string }).swing).toBe('double');
    });

    mounted.unmount();
  });

  it('Esc đóng lớp trên cùng — thanh tra đóng lại, vùng chọn trống', async () => {
    const mounted = await mountSettled();

    await run(() => mounted.result.current.onSelect('D-001'));

    await waitFor(() => {
      expect(mounted.result.current.selectedObjectId).toBe('D-001');
    });

    await pressKey(mounted.registry, 'Escape');

    await waitFor(() => {
      expect(mounted.result.current.selectedObjectId).toBeNull();
    });
    expect(mounted.result.current.inspector).toBeNull();

    mounted.unmount();
  });

  it('thêm/bớt vùng chọn và chọn cả lớp đi qua `src/lib/selection`', async () => {
    const mounted = await mountSettled();

    await run(() => mounted.result.current.onSelectLayerObjects('window'));

    await waitFor(() => {
      expect(useStore.getState().selectedIds).toHaveLength(
        OBJECT_LAYER_FIXTURE_COUNTS.windowCount,
      );
    });

    await run(() => mounted.result.current.onToggleSelect('S-001'));

    expect(useStore.getState().selectedIds).toHaveLength(
      OBJECT_LAYER_FIXTURE_COUNTS.windowCount - 1,
    );

    mounted.unmount();
  });

  it('bấm liên kết tường chủ chọn tường đó (R-07 bay khung nhìn tới)', async () => {
    const mounted = await mountSettled();
    const hostWallId = (
      OBJECT_LAYER_SEED.find((entry) => entry.displayId === 'D-007') as { hostWallId: string }
    ).hostWallId;

    await run(() => mounted.result.current.onSelectHostWall(hostWallId as `W-${string}`));

    await waitFor(() => {
      expect(useStore.getState().selectedIds).toEqual([hostWallId]);
    });

    mounted.unmount();
  });
});

describe('vai trò và vỏ màn', () => {
  it('vai Người xem: trạng thái `forbidden` và mọi hàm sửa không ghi gì', async () => {
    const scenario = objectLayerScenarioFor('forbidden');
    const mounted = await mountSettled({
      roles: scenario.roles,
      gateway: createMockObjectLayerReviewGateway(scenario.gatewaySeed),
    });

    expect(mounted.result.current.state).toBe('forbidden');
    expect(mounted.result.current.viewerRoleNotice).toBe(
      'Bạn không có quyền xem lớp đối tượng của dự án này',
    );

    await run(() => mounted.result.current.onApprove('D-004'));

    expect((entityInStore('D-004', 'door') as { reviewed: boolean }).reviewed).toBe(false);

    mounted.unmount();
  });

  it('trạng thái lỗi giữ được ảnh nền — canvas không trắng dù danh sách trắng', async () => {
    const scenario = objectLayerScenarioFor('error');
    const mounted = await mountSettled({
      gateway: createMockObjectLayerReviewGateway(scenario.gatewaySeed),
    });

    await waitFor(() => {
      expect(mounted.result.current.state).toBe('error');
    });

    expect(mounted.result.current.errorMessage).not.toBeNull();
    expect(mounted.result.current.backgroundImageUrl).not.toBeNull();

    mounted.unmount();
  });

  it('nhánh nội thất lỗi hiện một hàng cần chú ý, KHÔNG chặn cả màn', async () => {
    const scenario = OBJECT_LAYER_SCENARIO_FURNITURE_BRANCH;
    const mounted = await mountSettled({
      gateway: createMockObjectLayerReviewGateway(scenario.gatewaySeed),
    });

    await waitFor(() => {
      expect(mounted.result.current.furnitureAttentionNotice).toBe(
        'Nhận diện nội thất lỗi, cửa vẫn xong',
      );
    });

    expect(mounted.result.current.state).toBe('partial');
    expect(mounted.result.current.errorMessage).toBeNull();
    expect(mounted.result.current.objects).toHaveLength(21);

    mounted.unmount();
  });

  it('trạng thái thu gọn ẩn hai panel', async () => {
    const collapsed = await mountSettled({ forceCollapsed: true });

    expect(collapsed.result.current.state).toBe('collapsed');
    expect(collapsed.result.current.isCollapsed).toBe(true);
    collapsed.unmount();
  });

  it('trạng thái rỗng: không đối tượng nào, kèm câu giải thích', async () => {
    const empty = await mountSettled({
      gateway: createMockObjectLayerReviewGateway(objectLayerScenarioFor('empty').gatewaySeed),
    });

    await waitFor(() => {
      expect(empty.result.current.counts.total).toBe(0);
    });

    expect(empty.result.current.state).toBe('empty');
    expect(empty.result.current.emptyNotice).not.toBeNull();
    empty.unmount();
  });
});

/* -------------------------------------------------------------------------- */
/* Xoá — vé hoàn tác của A8.                                                   */
/* -------------------------------------------------------------------------- */

describe('xoá một đối tượng', () => {
  it('phát toast hoàn tác (A8) và hoàn tác được', async () => {
    const notifications: NotificationBus = createNotificationBus();
    const seen: string[] = [];

    notifications.subscribe((published) => {
      for (const notification of published) {
        seen.push(notification.title);
      }
    });

    const mounted = await mountSettled({ notifications });

    await run(() => mounted.result.current.onDelete('D-002'));

    await waitFor(() => {
      expect(entityInStore('D-002', 'door')).toBeUndefined();
    });

    expect(seen.some((title) => title.includes('D-002'))).toBe(true);

    await run(() => mounted.result.current.onUndo());

    await waitFor(() => {
      expect(entityInStore('D-002', 'door')).toBeDefined();
    });

    mounted.unmount();
  });
});

/* -------------------------------------------------------------------------- */
/* Mã máy và mã hiển thị.                                                      */
/* -------------------------------------------------------------------------- */

describe('mã hiển thị và mã máy', () => {
  it('21 mã hiển thị cho ra 21 mã máy khác nhau, đủ dài cho tầng lệnh', () => {
    const ids = OBJECT_LAYER_SEED.map((entry) => entry.entityId);

    expect(new Set(ids).size).toBe(21);

    for (const id of ids) {
      expect(id.slice(2).length).toBeGreaterThanOrEqual(10);
    }

    expect(entityIdOf('S-003', 'window')).toBe('D-000003WNDW' as OpeningId);
  });
});

/* -------------------------------------------------------------------------- */
/* Tự lưu (A7) — B-V6-03.                                                      */
/* -------------------------------------------------------------------------- */

/*
 * Đổi vì bộ lưu mới (F-04x-1): cổng không còn `persistObjectLayer`; lượt lưu đi qua
 * `useFloorLayerAutosave` với client cổng lộ ra, nên bài kiểm rình `writeLayer`.
 */
describe('tự lưu lớp đối tượng (B-V6-03, F-04x-1)', () => {
  const savingGateway = () => {
    const apiClient = createMockApiClient();

    return { gateway: createMockObjectLayerReviewGateway({ apiClient }), writeLayer: vi.spyOn(apiClient.spatial, 'writeLayer') };
  };

  it('một thao tác duyệt không gửi ngay — lưu 800 ms sau thao tác cuối, một lượt cho hai thao tác liền tay (A7, B-V6-03)', async () => {
    const { gateway, writeLayer } = savingGateway();
    const mounted = await mountSettled({ gateway });

    /* Đồng hồ đóng băng SAU khi lượt đọc đã lắng, trước khi hai thao tác tạo
     * đồng hồ chờ 800 ms của A7 — cùng khuôn mẫu NGHIEM-1 ở trên. */
    const clock = installFakeClock();

    try {
      await run(() => mounted.result.current.onApprove('D-004'));
      await run(() => mounted.result.current.onDelete('D-002'));

      expect(entityInStore('D-002', 'door')).toBeUndefined();
      expect(writeLayer).not.toHaveBeenCalled();

      /* Qua cửa sổ 800 ms của A7: đúng MỘT lượt lưu cho cả hai thao tác. */
      await act(async () => {
        await clock.advance(1000);
        await clock.flushMicrotasks();
      });
    } finally {
      clock.restore();
    }

    expect(writeLayer).toHaveBeenCalledTimes(1);

    mounted.unmount();
  });

  it('Ctrl+S với tới màn đối tượng — flushAutosaves lưu ngay', async () => {
    const { gateway, writeLayer } = savingGateway();
    const mounted = await mountSettled({ gateway });

    await run(() => mounted.result.current.onApprove('D-004'));
    expect(writeLayer).not.toHaveBeenCalled();

    await act(async () => {
      await flushAutosaves();
    });

    expect(writeLayer).toHaveBeenCalledTimes(1);

    mounted.unmount();
  });

  it('lượt lưu hỏng không gỡ thao tác của người duyệt', async () => {
    const { gateway, writeLayer } = savingGateway();

    writeLayer.mockRejectedValue(new Error('x'));
    const mounted = await mountSettled({ gateway });

    await run(() => mounted.result.current.onDelete('D-002'));
    await waitFor(() => {
      expect(entityInStore('D-002', 'door')).toBeUndefined();
    });

    await act(async () => {
      await flushAutosaves().catch(() => undefined);
      await Promise.resolve();
    });

    expect(writeLayer).toHaveBeenCalled();
    /* Cũ: lượt hỏng gọi applyUndo và cửa D-002 hiện lại. */
    expect(entityInStore('D-002', 'door')).toBeUndefined();

    mounted.unmount();
  });

  it('409 → dải "Tải lại" (F-04x-1 [8].6)', async () => {
    const { gateway, writeLayer } = savingGateway();

    /* Máy chủ đã đi trước bản mà màn nạp — lượt lưu đầu nhận 409. */
    simulateRemoteLayerEdit(FLOOR_ID);
    const mounted = await mountSettled({ gateway });

    await run(() => mounted.result.current.onApprove('D-004'));
    await act(async () => {
      await flushAutosaves().catch(() => undefined);
    });

    expect(writeLayer).toHaveBeenCalledTimes(1);
    await waitFor(() => {
      expect(mounted.result.current.saveBlock?.kind).toBe('reload');
    });
    expect(mounted.result.current.saveBlock?.onReload).toBeTypeOf('function');

    mounted.unmount();
  });
});

/* -------------------------------------------------------------------------- */
/* Danh sách dựng từ đồ thị — B-V6-13.                                         */
/* -------------------------------------------------------------------------- */

/** Một món nội thất KHÔNG có dòng mẫu, đặt xa mọi tường của bộ mẫu (lưới 12.500 × 8.800 mm). */
const FREE_FURNITURE_ID = 'F-000099FREE' as FurnitureId;
const FREE_FURNITURE_CENTRE = { x: 14500, y: 4000 };
const FREE_FURNITURE_SIZE_MM = 800;

function freeFurniture(kind: FurnitureKind, confidence = 0.95): Furniture {
  return {
    id: FREE_FURNITURE_ID,
    levelId: OBJECT_LAYER_SAMPLE_LEVEL.id,
    kind,
    centre: FREE_FURNITURE_CENTRE,
    boundingBox: boxAround(FREE_FURNITURE_CENTRE, FREE_FURNITURE_SIZE_MM, FREE_FURNITURE_SIZE_MM),
    rotationDeg: 0,
    confidence,
    source: 'ai',
    reviewed: false,
  };
}

/** Đồ thị bộ mẫu cộng thêm một món nội thất. */
function sampleGraphWith(item: Furniture): NormalizedSpatial {
  const raw = denormalizeSpatial(OBJECT_LAYER_SAMPLE_GRAPH);

  return normalizeSpatial({ ...raw, furniture: [...raw.furniture, item] });
}

/** Đồ thị bộ mẫu với lỗ mở `D-001` đổi kind/swing. */
function sampleGraphWithOpening(kind: 'door' | 'window', swing: SwingDirection): NormalizedSpatial {
  const raw = denormalizeSpatial(OBJECT_LAYER_SAMPLE_GRAPH);
  const target = entityIdOf('D-001', 'door');

  return normalizeSpatial({
    ...raw,
    openings: raw.openings.map((opening) => (opening.id === target ? { ...opening, kind, swing } : opening)),
  });
}

describe('danh sách dựng từ đồ thị (B-V6-13)', () => {
  it.each<[FurnitureKind, ObjectSubtype]>([
    ['bed', 'bed'],
    ['table', 'otherFurniture'],
    ['chair', 'otherFurniture'],
    ['sanitaryFixture', 'otherFurniture'],
    ['wardrobe', 'otherFurniture'],
    ['kitchenCabinet', 'otherFurniture'],
    ['stair', 'otherFurniture'],
    ['other', 'otherFurniture'],
  ])('nội thất kind %s không có dòng mẫu hiện ra với loại con %s — không bị ẩn', (kind, subtype) => {
    const objects = objectsOf(sampleGraphWith(freeFurniture(kind)), OBJECT_LAYER_SAMPLE_LEVEL);
    const found = objects.find((object) => object.entityId === FREE_FURNITURE_ID);

    expect(objects).toHaveLength(OBJECT_LAYER_FIXTURE_OBJECTS.length + 1);
    expect(found?.layer).toBe('furniture');
    expect(found?.subtype).toBe(subtype);
    expect(found?.hostWallId).toBeNull();
  });

  const SWINGS: readonly SwingDirection[] = ['left', 'right', 'double', 'sliding', 'fixed'];

  it.each(
    (['door', 'window'] as const).flatMap((kind) => SWINGS.map((swing) => [kind, swing] as const)),
  )('ô mở kind %s, swing %s đọc ra đúng loại con từ đồ thị', (kind, swing) => {
    const object = objectsOf(sampleGraphWithOpening(kind, swing), OBJECT_LAYER_SAMPLE_LEVEL).find(
      (candidate) => candidate.entityId === entityIdOf('D-001', 'door'),
    );
    const expected: ObjectSubtype = kind === 'window' ? 'window' : swing === 'double' ? 'doubleDoor' : 'singleDoor';

    expect(object?.subtype).toBe(expected);
    expect(object?.id).toBe('D-001');
  });

  it('tầng L-LEVEL000001 của bộ mẫu A14, không dòng mẫu: 9 đối tượng, 0 đã duyệt, không D-009, mã không trùng', () => {
    const graph = normalizeSpatial(createSampleBuilding());
    const level = graph.byId[sampleLevelId(1)] as Level;
    const objects = objectsOf(graph, level, []);
    const ids = objects.map((object) => object.id);

    console.log(`A14 tầng 1: ${ids.join(', ')}`);
    expect(objects).toHaveLength(9);
    expect(countsOf(objects)).toEqual({ doorCount: 2, windowCount: 2, furnitureCount: 5, total: 9 });
    expect(reviewCounterOf(objects)).toEqual({ reviewed: 0, total: 9 });
    expect(ids).not.toContain('D-009');
    expect(new Set(ids).size).toBe(ids.length);
    expect(ids.filter((id) => id.startsWith('S-'))).toHaveLength(2);

    for (const object of objects) {
      expect(graph.byId[object.entityId]).toBeDefined();
    }
  });

  it('mô tả lệnh duyệt in mã hiển thị ("D-001"), không in mã máy ("DOOR")', () => {
    const graph = normalizeSpatial(createSampleBuilding());
    const level = graph.byId[sampleLevelId(1)] as Level;
    const door = objectsOf(graph, level, []).find((object) => object.layer === 'door');
    const entity = graphOpeningsOf(graph).find((opening) => opening.id === door?.entityId);

    expect(door?.id).toBe('D-001');

    const command = buildApproveObjectCommand(
      entity as NonNullable<typeof entity>,
      'test-actor',
      (door as ReviewObject).id,
    );

    expect(command.description).toContain('D-001');
    expect(command.description).not.toContain('DOOR');
  });

  it('bàn đứng tự do cách tường 2.000 mm: không bị tô chú ý, vẽ đúng ở tâm, duyệt và xoá được', async () => {
    const gateway = createMockObjectLayerReviewGateway({ graph: sampleGraphWith(freeFurniture('table')) });
    const mounted = await mountSettled({ gateway });
    const table = (): ReviewObject | undefined =>
      mounted.result.current.objects.find((object) => object.entityId === FREE_FURNITURE_ID);
    const id = (table() as ReviewObject).id;

    expect(id).toMatch(/^F-\d{3}$/u);
    expect(mounted.result.current.counts.total).toBe(OBJECT_LAYER_FIXTURE_OBJECTS.length + 1);

    await run(() => mounted.result.current.onToggleLowConfidenceOnly());
    const row = mounted.result.current.rows.find((candidate) => candidate.id === id);

    expect(row?.statusCode).not.toBe('attention');
    expect(row?.isOrphan).toBe(false);
    expect(row?.hostWallLabel).toBeNull();

    const placement = mounted.result.current.placements.find((candidate) => candidate.id === id);

    expect(placement?.centrePx).toEqual(
      toPixelPoint(FREE_FURNITURE_CENTRE, scaleOfLevel(OBJECT_LAYER_SAMPLE_LEVEL)),
    );
    expect(placement?.isOrphan).toBe(false);

    await run(() => mounted.result.current.onSelect(id));
    expect(mounted.result.current.selectedObjectId).toBe(id);
    expect(mounted.result.current.inspector?.isOrphan).toBe(false);

    await run(() => mounted.result.current.onApprove(id));
    await waitFor(() => {
      expect(table()?.reviewed).toBe(true);
    });

    await run(() => mounted.result.current.onDelete(id));
    await waitFor(() => {
      expect(table()).toBeUndefined();
    });
    expect(useStore.getState().spatial?.byId[FREE_FURNITURE_ID]).toBeUndefined();

    mounted.unmount();
  });

  it('gắn D-009 vào tường trên cổng giả: tổng không đổi, D-009 đọc từ đồ thị đúng một lần', async () => {
    /* Đồ thị mà `W-008` còn trống — xem bài "dựng được lệnh khi tường gợi ý còn trống". */
    const freeSeed = OBJECT_LAYER_SEED.filter((entry) => entry.displayId !== 'D-008');
    const gateway = createMockObjectLayerReviewGateway({
      graph: buildObjectLayerGraph(freeSeed),
      seed: freeSeed,
    });
    const mounted = await mountSettled({ gateway });
    const before = mounted.result.current.counts.total;

    await run(() => mounted.result.current.onAttachToNearestWall(ORPHAN_OBJECT_ID));
    await waitFor(() => {
      expect(entityInStore(ORPHAN_OBJECT_ID, 'door')).toBeDefined();
    });

    const copies = mounted.result.current.objects.filter((object) => object.id === ORPHAN_OBJECT_ID);

    console.log(`tổng trước/sau khi gắn D-009: ${before}/${mounted.result.current.counts.total}`);
    expect(mounted.result.current.counts.total).toBe(before);
    expect(copies).toHaveLength(1);
    expect(copies[0]?.hostWallId).not.toBeNull();

    mounted.unmount();
  });

  it('cổng thật không mang bảng mẫu — dòng mồ côi D-009 không lọt vào tầng nào', () => {
    expect(createObjectLayerReviewGateway({ apiClient: {} as never }).seed).toEqual([]);
  });
});

describe('"Thêm thủ công" trên cổng thật, tầng rỗng (B-V6-41)', () => {
  /** Bộ A14 bỏ hết ô mở và nội thất — mọi tầng đều rỗng, nhưng còn tường. */
  const emptyGraph = (): NormalizedSpatial => {
    const raw = denormalizeSpatial(normalizeSpatial(createSampleBuilding()));

    return normalizeSpatial({
      ...raw,
      openings: [],
      furniture: [],
      walls: raw.walls.map((wall) => ({ ...wall, openingIds: [] })),
    });
  };

  const emptyGateway = (): ObjectLayerReviewGateway => {
    const graph = emptyGraph();

    return { ...createMockObjectLayerReviewGateway({ graph }), seed: [] };
  };

  it('hai tầng rỗng liên tiếp: cả hai cửa được thêm, không bị từ chối vì trùng mã', async () => {
    const gateway = emptyGateway();
    const notifications = createNotificationBus();
    const publish = vi.spyOn(notifications, 'publish');
    const openingCount = (): number =>
      Object.keys(useStore.getState().spatial?.byId ?? {}).filter((id) => isIdOfKind('opening', id)).length;

    const first = await mountSettled({ gateway, floorId: sampleLevelId(1), notifications });

    await run(() => first.result.current.onAddManually());
    await waitFor(() => {
      expect(openingCount()).toBe(1);
    });
    first.unmount();

    const second = await mountSettled({ gateway, floorId: sampleLevelId(2), notifications });

    await run(() => second.result.current.onAddManually());
    await waitFor(() => {
      expect(openingCount()).toBe(2);
    });

    const refused = publish.mock.calls.filter(([n]) => n.title === OBJECT_LAYER_TEXT.addRefused);
    const ids = second.result.current.objects.map((object) => object.id);

    console.log(`tầng 2 sau khi thêm: ${ids.join(', ')}`);
    expect(refused).toEqual([]);
    expect(ids).toHaveLength(1);
    expect(ids[0]).toMatch(/^D-[0-9A-Z]{3}$/u);
    expect(ids[0]).not.toContain('DOOR');

    second.unmount();
  });

  it('đề nghị mang mã mới chưa có trong đồ thị, đúng dạng mã cửa, và lệnh được nhận', () => {
    const graph = emptyGraph();
    const level = graph.byId[sampleLevelId(2)] as Level;
    const input = manualDoorProposalOf(graph, level);

    expect(input).not.toBeNull();

    const id = (input as NonNullable<typeof input>).id;

    expect(graph.byId[id]).toBeUndefined();
    expect(isIdOfKind('opening', id)).toBe(true);
    expect(buildAddOpeningCommand(input as NonNullable<typeof input>, commandContextOf(graph, 'test-actor')).ok).toBe(true);
  });
});

describe('tầng của URL không có trong đồ thị (B-V6-40)', () => {
  const openingCount = (): number =>
    Object.keys(useStore.getState().spatial?.byId ?? {}).filter((id) => isIdOfKind('opening', id)).length;

  /*
   * F-04x-2: tầng nay đọc qua N16 (`useFloorLayer`). Tầng máy chủ không có trả 404
   * `resource:"floor"` (cổng giả làm đúng thế), nên màn vào `error` với câu cố định
   * thay vì `empty` — trước đây đồ thị kho là nguồn, và tầng vắng chỉ là "không dòng".
   */
  it('màn vào `error` với câu "Tầng này không còn tồn tại.", không dòng nào, và "Thêm thủ công" báo không có tường', async () => {
    const notifications = createNotificationBus();
    const publish = vi.spyOn(notifications, 'publish');
    const mounted = await mountSettled({ floorId: 'L-LEVEL000099', notifications });
    const before = openingCount();

    expect(mounted.result.current.state).toBe('error');
    expect(mounted.result.current.errorMessage).toBe(FLOOR_NOT_FOUND_MESSAGE);
    expect(mounted.result.current.objects).toEqual([]);

    await run(() => mounted.result.current.onAddManually());

    expect(publish.mock.calls.map(([n]) => n.title)).toContain(OBJECT_LAYER_TEXT.addNoWall);
    expect(openingCount()).toBe(before);

    mounted.unmount();
  });
});

describe('tỉ lệ tạm (F-04x-2)', () => {
  it('tầng unresolved: hook trả dải, "Hiệu chỉnh tỉ lệ" mở màn tỉ lệ của tầng', async () => {
    const onNavigate = vi.fn();
    const mounted = await mountSettled({
      gateway: createMockObjectLayerReviewGateway({ scaleStatus: 'unresolved' }),
      onNavigate,
    });

    await waitFor(() => {
      expect(mounted.result.current.provisionalScaleNotice).not.toBeNull();
    });
    act(() => {
      mounted.result.current.provisionalScaleNotice?.onCalibrate();
    });
    expect(onNavigate).toHaveBeenCalledWith(ROUTES.project.scale(PROJECT_ID, FLOOR_ID));
    mounted.unmount();
  });

  it('tầng có tỉ lệ thật: không dải', async () => {
    const mounted = await mountSettled();

    expect(mounted.result.current.provisionalScaleNotice).toBeNull();
    mounted.unmount();
  });
});
