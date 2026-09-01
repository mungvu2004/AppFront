/**
 * Nửa "suy nghĩ" của màn S-14 "Đọc kích thước OCR", kiểm không cần DOM.
 *
 * Hook được lái qua `renderHook`, tầng dữ liệu là
 * `createMockDimensionOcrReviewGateway()` — cùng cổng story sẽ dùng — và mọi
 * con số khẳng định đọc ra từ `dimensionOcrFixture.ts` /
 * `dimensionOcrReviewScenarios.ts`, không có bảng dữ liệu thứ hai bịa tại chỗ
 * (R-70).
 *
 * ## Ba phép kiểm nghiệm thu, mỗi phép IN RA con số nó đếm được
 *
 * 1. `M-018` lệch 1,5% → dải đối chiếu KHÔNG tô màu; `M-028` lệch 2,5% → CÓ.
 *    In cả hai phần trăm và hai cờ.
 * 2. Duyệt một chuỗi → bộ đếm 18/34 thành 19/34, và vùng chọn tự nhảy sang
 *    chuỗi CHƯA DUYỆT kế tiếp. In cả ba con số.
 * 3. Chế độ duyệt bàn phím: một chuỗi xong trong ĐÚNG hai lần gõ phím. In danh
 *    sách phím đã gõ.
 */

import { createElement, type ReactNode } from 'react';
import { QueryClientProvider } from '@tanstack/react-query';
import { act, cleanup, renderHook, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { createShortcutRegistry, type ShortcutRegistry } from '@/lib/input/shortcutRegistry';
import { createNotificationBus, type NotificationBus } from '@/lib/mutations/notificationBus';
import { createTestQueryClient } from '@/lib/testing/render';
import { SEVEN_STATES } from '@/lib/testing/sevenStateScenarios';
import { resetSelectorCaches } from '@/store/selectors';
import { useStore } from '@/store';

import {
  buildApproveDimensionCommand,
  buildDimensionOcrGraph,
  buildOverrideDimensionCommand,
  createDimensionOcrReviewGateway,
  createMockDimensionOcrReviewGateway,
  deviationOf,
  DIMENSION_APPROVE_COMMAND_TYPE,
  DIMENSION_OCR_MISSING_CAPABILITIES,
  DIMENSION_OCR_MISSING_ENDPOINTS,
  DIMENSION_OCR_SAMPLE_LEVEL,
  DIMENSION_OVERRIDE_COMMAND_TYPE,
  dimensionEntityIdOf,
  dimensionProgressLabel,
  formatDeviation,
  formatDimensionLength,
  implausibleDimensionIds,
  isImplausibleDimensionValue,
  isLowConfidenceDimension,
  measuredLengthOf,
  readValueOf,
  reviewCounterOf,
} from './dimensionOcrReviewGateway';
import {
  DIMENSION_OCR_FIXTURE_DIMENSIONS,
  DIMENSION_OCR_FIXTURE_LOW_CONFIDENCE,
  DIMENSION_OCR_FIXTURE_MINOR_DEVIATION,
  DIMENSION_OCR_FIXTURE_REVIEWED,
  DIMENSION_OCR_FIXTURE_SIGNIFICANT_DEVIATION,
  DIMENSION_OCR_FIXTURE_TOTAL,
} from './dimensionOcrFixture';
import {
  DIMENSION_OCR_REVIEW_SCENARIOS,
  dimensionOcrScenarioFor,
} from './dimensionOcrReviewScenarios';
import {
  applyDimensionFilters,
  deriveScreenState,
  nextUnreviewedId,
  useDimensionOcrReview,
  type DimensionOcrReviewModel,
  type UseDimensionOcrReviewOptions,
} from './useDimensionOcrReview';

/* -------------------------------------------------------------------------- */
/* Bộ mẫu — đọc ra, không viết tay lại.                                        */
/* -------------------------------------------------------------------------- */

const PROJECT_ID = 'project-1';
const FLOOR_ID = DIMENSION_OCR_SAMPLE_LEVEL.id;

/** Ví dụ nghiệm thu độ lệch NHỎ — `M-018`, đọc 6.090 mm, đo 6.000 mm. */
const MINOR_ID = 'M-018';

/** Ví dụ nghiệm thu độ lệch ĐÁNG KỂ — `M-028`, đọc 9.225 mm, đo 9.000 mm. */
const SIGNIFICANT_ID = 'M-028';

/** Chuỗi chưa duyệt của bộ mẫu, dùng cho lượt duyệt và lượt hoàn tác. */
const UNREVIEWED_ID = 'M-002';

/** Chuỗi chưa duyệt KẾ TIẾP sau `M-002` — `M-003` đã duyệt nên bị bỏ qua. */
const NEXT_UNREVIEWED_ID = 'M-004';

/** Chuỗi dưới ngưỡng tin cậy, dùng cho phép kiểm giá trị vô lý. */
const IMPLAUSIBLE_TARGET_ID = 'M-014';

/** "Phòng dài 30 mét" của đặc tả — con số vô lý so với 33 chuỗi còn lại. */
const IMPLAUSIBLE_VALUE_MM = 30000;

/** Số chưa duyệt của bộ mẫu, tính ra chứ không gõ tay. */
const FIXTURE_UNREVIEWED = DIMENSION_OCR_FIXTURE_TOTAL - DIMENSION_OCR_FIXTURE_REVIEWED;

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
  readonly result: { current: DimensionOcrReviewModel };
  readonly registry: ShortcutRegistry;
  readonly unmount: () => void;
}

type MountOptions = Partial<Omit<UseDimensionOcrReviewOptions, 'registry'>>;

function mountHook(options: MountOptions = {}): Mounted {
  const registry = createShortcutRegistry();
  const queryClient = createTestQueryClient();
  const wrapper = ({ children }: { children: ReactNode }): ReactNode =>
    createElement(QueryClientProvider, { client: queryClient }, children);

  const rendered = renderHook(
    () =>
      useDimensionOcrReview({
        projectId: options.projectId ?? PROJECT_ID,
        floorId: options.floorId ?? FLOOR_ID,
        roles: options.roles ?? ['engineer'],
        gateway: options.gateway ?? createMockDimensionOcrReviewGateway(),
        registry,
        ...(options.notifications === undefined ? {} : { notifications: options.notifications }),
        ...(options.forceCollapsed === undefined ? {} : { forceCollapsed: options.forceCollapsed }),
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
async function pressKey(registry: ShortcutRegistry, key: string): Promise<void> {
  await act(async () => {
    registry.handleKeyDown({ key, ctrlKey: false }, null);
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

/** Đọc thẳng một chuỗi kích thước ra khỏi kho — không qua viewmodel. */
const entityInStore = (displayId: string): Record<string, unknown> | undefined =>
  useStore.getState().spatial?.byId[dimensionEntityIdOf(displayId)] as
    | Record<string, unknown>
    | undefined;

/* -------------------------------------------------------------------------- */
/* Phép ghép thuần — kiểm được mà không cần dựng hook.                          */
/* -------------------------------------------------------------------------- */

describe('phép ghép thuần của màn Đọc kích thước OCR', () => {
  it('bảy trạng thái dẫn xuất đúng, đủ và không thừa nhánh nào (R-63)', () => {
    const derived = DIMENSION_OCR_REVIEW_SCENARIOS.map((scenario) =>
      deriveScreenState({
        isViewerRole: scenario.isViewerRole,
        isCollapsed: scenario.isCollapsed,
        hasError: scenario.error !== null,
        /* Kịch bản `loading` là kịch bản DUY NHẤT chưa có cả ảnh nền. */
        isLoading: scenario.backgroundImageUrl === null && scenario.error === null,
        hasPartialOcr: false,
        counter: scenario.reviewCounter,
      }),
    );

    expect(derived).toEqual([...SEVEN_STATES]);
  });

  it('OCR mới xong một phần giữ màn ở "một phần" dù 34/34 đã duyệt', () => {
    const done = dimensionOcrScenarioFor('success');

    expect(
      deriveScreenState({
        isViewerRole: false,
        isCollapsed: false,
        hasError: false,
        isLoading: false,
        hasPartialOcr: true,
        counter: done.reviewCounter,
      }),
    ).toBe('partial');
    expect(
      deriveScreenState({
        isViewerRole: false,
        isCollapsed: false,
        hasError: false,
        isLoading: false,
        hasPartialOcr: false,
        counter: done.reviewCounter,
      }),
    ).toBe('success');
  });

  it('chuỗi chưa duyệt kế tiếp bỏ qua chuỗi đã duyệt và vòng lại từ đầu', () => {
    const rows = DIMENSION_OCR_FIXTURE_DIMENSIONS.map((dimension, index) => ({
      id: `M-${String(index + 1).padStart(3, '0')}`,
      isReviewed: dimension.reviewed,
      isLowConfidence: isLowConfidenceDimension(dimension.confidence),
    }));

    expect(nextUnreviewedId(rows as never, UNREVIEWED_ID)).toBe(NEXT_UNREVIEWED_ID);
    /* Không còn chuỗi nào chưa duyệt thì không có gì để nhảy tới. */
    expect(
      nextUnreviewedId(
        rows.map((row) => ({ ...row, isReviewed: true })) as never,
        UNREVIEWED_ID,
      ),
    ).toBeNull();
  });

  it('P-01 định dạng "6.000 mm" và "18/34 kích thước đã duyệt" (A15)', () => {
    expect(formatDimensionLength(6000)).toBe('6.000 mm');
    expect(dimensionProgressLabel({ reviewed: 18, total: 34 })).toBe(
      '18/34 kích thước đã duyệt',
    );
    /* Dấu thập phân là dấu phẩy, và dấu phần trăm do `Intl` viết ra. */
    expect(formatDeviation(0.015)).toBe('1,5%');
  });

  it('bản kê nợ endpoint chỉ mang việc thật sự chưa có đường', () => {
    const gateway = createDimensionOcrReviewGateway();

    expect([...DIMENSION_OCR_MISSING_CAPABILITIES]).toEqual(['persistDimensionLayer']);
    expect(gateway.supports.persistDimensionLayer).toBe(false);
    expect(gateway.supports.readDimensionLayer).toBe(true);
    expect(DIMENSION_OCR_MISSING_ENDPOINTS.persistDimensionLayer).toContain('FloorWriteBody');
  });
});

/* -------------------------------------------------------------------------- */
/* NGHIỆM THU 1 — 1,5% không tô màu, 2,5% có.                                  */
/* -------------------------------------------------------------------------- */

describe('[NGHIEM-1] độ lệch chỉ tô màu khi thật sự đáng kể', () => {
  it('`M-018` lệch 1,5% cho cờ đáng kể FALSE, `M-028` lệch 2,5% cho TRUE', () => {
    const minor = deviationOf(DIMENSION_OCR_FIXTURE_MINOR_DEVIATION);
    const significant = deviationOf(DIMENSION_OCR_FIXTURE_SIGNIFICANT_DEVIATION);

    console.log(
      `M-018: đọc ${formatDimensionLength(readValueOf(DIMENSION_OCR_FIXTURE_MINOR_DEVIATION))} · đo ${formatDimensionLength(measuredLengthOf(DIMENSION_OCR_FIXTURE_MINOR_DEVIATION))} · lệch ${formatDeviation(minor.relativeDeviation)} · đáng kể: ${String(minor.exceedsLimit)}`,
    );
    console.log(
      `M-028: đọc ${formatDimensionLength(readValueOf(DIMENSION_OCR_FIXTURE_SIGNIFICANT_DEVIATION))} · đo ${formatDimensionLength(measuredLengthOf(DIMENSION_OCR_FIXTURE_SIGNIFICANT_DEVIATION))} · lệch ${formatDeviation(significant.relativeDeviation)} · đáng kể: ${String(significant.exceedsLimit)}`,
    );

    expect(formatDeviation(minor.relativeDeviation)).toBe('1,5%');
    expect(minor.exceedsLimit).toBe(false);
    expect(formatDeviation(significant.relativeDeviation)).toBe('2,5%');
    expect(significant.exceedsLimit).toBe(true);
  });

  it('dải đối chiếu của chuỗi đang chọn nói đúng ba con số', async () => {
    const mounted = await mountSettled();

    await run(() => {
      mounted.result.current.onSelect(MINOR_ID);
    });

    const compare = mounted.result.current.compare;

    expect(compare).not.toBeNull();
    expect(compare?.ocrValueLabel).toBe('6.090 mm');
    expect(compare?.measuredValueLabel).toBe('6.000 mm');
    expect(compare?.isSignificant).toBe(false);
    expect(compare?.deviationPercentValue).toBeCloseTo(0.015, 6);
    /* QĐ-7: T7 nhận cả số thô lẫn hàm định dạng, nên nó không tự ghép dấu phần trăm. */
    expect(compare?.formatDeviation(0.025)).toBe('2,5%');

    /* Lượt chạy số 260 ms kết thúc ở đúng giá trị đích. */
    await waitFor(() => {
      expect(mounted.result.current.compare?.deviationLabel).toBe('1,5%');
    });

    await run(() => {
      mounted.result.current.onSelect(SIGNIFICANT_ID);
    });

    expect(mounted.result.current.compare?.isSignificant).toBe(true);

    mounted.unmount();
  });

  it('sửa giá trị thì phép đối chiếu chạy lại NGAY, chưa cần lệnh nào chạy', async () => {
    const mounted = await mountSettled();

    await run(() => {
      mounted.result.current.onSelect(MINOR_ID);
    });

    expect(mounted.result.current.compare?.isSignificant).toBe(false);

    await run(() => {
      mounted.result.current.onEdit(MINOR_ID, 6300);
    });

    const compare = mounted.result.current.compare;

    console.log(
      `sau khi gõ 6.300 mm: lệch ${formatDeviation(compare?.deviationPercentValue ?? 0)} · đáng kể: ${String(compare?.isSignificant)}`,
    );

    expect(compare?.ocrValueLabel).toBe('6.300 mm');
    expect(compare?.isSignificant).toBe(true);
    expect(compare?.deviationPercentValue).toBeCloseTo(0.05, 6);
    /* Số đang gõ CHƯA thành lệnh: đồ thị vẫn giữ giá trị cũ. */
    expect(entityInStore(MINOR_ID)?.overrideValueMm).toBeUndefined();

    /* Esc bỏ sửa, dải đối chiếu quay lại con số của bản vẽ. */
    await pressKey(mounted.registry, 'Escape');

    expect(mounted.result.current.compare?.ocrValueLabel).toBe('6.090 mm');
    expect(mounted.result.current.compare?.isSignificant).toBe(false);

    mounted.unmount();
  });
});

/* -------------------------------------------------------------------------- */
/* NGHIỆM THU 2 — duyệt xong tự sang chuỗi kế tiếp, bộ đếm 18/34 tăng đúng.     */
/* -------------------------------------------------------------------------- */

describe('[NGHIEM-2] duyệt một chuỗi kích thước', () => {
  it('bộ đếm 18/34 thành 19/34 và vùng chọn nhảy sang chuỗi chưa duyệt kế tiếp', async () => {
    const mounted = await mountSettled();

    console.log(
      `trước khi duyệt: ${mounted.result.current.reviewProgressLabel} · trạng thái ${mounted.result.current.state}`,
    );

    expect(mounted.result.current.state).toBe('partial');
    expect(mounted.result.current.reviewCounter).toEqual({
      reviewed: DIMENSION_OCR_FIXTURE_REVIEWED,
      total: DIMENSION_OCR_FIXTURE_TOTAL,
    });
    expect(mounted.result.current.reviewProgressLabel).toBe('18/34 kích thước đã duyệt');

    await run(() => {
      mounted.result.current.onSelect(UNREVIEWED_ID);
    });
    await run(() => {
      mounted.result.current.onApprove(UNREVIEWED_ID);
    });

    await waitFor(() => {
      expect(entityInStore(UNREVIEWED_ID)?.reviewed).toBe(true);
    });

    console.log(
      `sau khi duyệt: ${mounted.result.current.reviewProgressLabel} · đang chọn ${String(mounted.result.current.selectedDimensionId)}`,
    );

    expect(mounted.result.current.reviewCounter.reviewed).toBe(DIMENSION_OCR_FIXTURE_REVIEWED + 1);
    expect(mounted.result.current.reviewProgressLabel).toBe('19/34 kích thước đã duyệt');
    /* Tự sang chuỗi CHƯA DUYỆT kế tiếp — `M-003` đã duyệt nên bị bỏ qua. */
    expect(mounted.result.current.selectedDimensionId).toBe(NEXT_UNREVIEWED_ID);

    mounted.unmount();
  });

  it('duyệt đặt `reviewed: true` KÈM `source: "human"` — A5', async () => {
    const mounted = await mountSettled();
    const before = entityInStore(UNREVIEWED_ID);

    expect(before?.reviewed).toBe(false);
    expect(before?.source).toBe('ai');

    await run(() => {
      mounted.result.current.onApprove(UNREVIEWED_ID);
    });

    await waitFor(() => {
      const after = entityInStore(UNREVIEWED_ID);

      expect(after?.reviewed).toBe(true);
      expect(after?.source).toBe('human');
    });

    mounted.unmount();
  });

  it('không đường nào cho đầu ra AI bật cờ xanh (A5)', () => {
    const target = DIMENSION_OCR_FIXTURE_DIMENSIONS.find((entry) => !entry.reviewed);

    expect(target).toBeDefined();

    const approve = buildApproveDimensionCommand(
      target as NonNullable<typeof target>,
      'test-actor',
    );
    const approved = approve.changes[0]?.after as { reviewed: boolean; source: string };

    expect(approve.type).toBe(DIMENSION_APPROVE_COMMAND_TYPE);
    expect(approved.reviewed).toBe(true);
    expect(approved.source).toBe('human');
    /* Hàm dựng lệnh duyệt nhận ĐÚNG hai tham số: không có chỗ nào truyền `source`. */
    expect(buildApproveDimensionCommand).toHaveLength(2);
    /* Hoàn tác được: ảnh chụp `before` đầy đủ, không phải diff từng trường. */
    expect(approve.changes[0]?.before).not.toBeNull();

    /* Lệnh gõ đè KHÔNG chạm cờ duyệt hay nguồn dữ liệu. */
    const override = buildOverrideDimensionCommand(
      target as NonNullable<typeof target>,
      1500,
      'test-actor',
    );
    const overridden = override.changes[0]?.after as {
      reviewed: boolean;
      source: string;
      overrideValueMm: number;
    };

    expect(override.type).toBe(DIMENSION_OVERRIDE_COMMAND_TYPE);
    expect(overridden.overrideValueMm).toBe(1500);
    expect(overridden.reviewed).toBe(false);
    expect(overridden.source).toBe('ai');
    expect(DIMENSION_OVERRIDE_COMMAND_TYPE).not.toBe(DIMENSION_APPROVE_COMMAND_TYPE);
  });

  it('hoàn tác trả lại giá trị cũ VÀ cờ duyệt cũ, bằng đúng một lượt (A8)', async () => {
    const notifications: NotificationBus = createNotificationBus();
    const seen: string[] = [];

    notifications.subscribe((published) => {
      for (const notification of published) {
        seen.push(notification.title);
      }
    });

    const mounted = await mountSettled({ notifications });
    const originalValue = readValueOf(
      DIMENSION_OCR_FIXTURE_DIMENSIONS.find(
        (entry) => entry.id === dimensionEntityIdOf(UNREVIEWED_ID),
      ) as never,
    );

    await run(() => {
      mounted.result.current.onEdit(UNREVIEWED_ID, 1500);
    });
    await run(() => {
      mounted.result.current.onApprove(UNREVIEWED_ID);
    });

    await waitFor(() => {
      expect(entityInStore(UNREVIEWED_ID)?.overrideValueMm).toBe(1500);
    });
    expect(entityInStore(UNREVIEWED_ID)?.reviewed).toBe(true);
    /* A8: mỗi thay đổi có toast hoàn tác, đẩy qua bus chứ không bọc Toast.Provider. */
    expect(seen.length).toBeGreaterThan(0);

    await run(() => {
      mounted.result.current.onUndo();
    });

    await waitFor(() => {
      const back = entityInStore(UNREVIEWED_ID);

      expect(back?.overrideValueMm).toBeUndefined();
      expect(back?.reviewed).toBe(false);
    });

    console.log(
      `sau hoàn tác: giá trị ${formatDimensionLength(originalValue)} · đã duyệt: ${String(entityInStore(UNREVIEWED_ID)?.reviewed)}`,
    );
    expect(mounted.result.current.reviewCounter.reviewed).toBe(DIMENSION_OCR_FIXTURE_REVIEWED);

    mounted.unmount();
  });
});

/* -------------------------------------------------------------------------- */
/* NGHIỆM THU 3 — chế độ duyệt bàn phím, đúng hai lần gõ phím.                  */
/* -------------------------------------------------------------------------- */

describe('[NGHIEM-3] chế độ duyệt bàn phím', () => {
  it('gõ số rồi Enter là XONG một chuỗi — đúng 2 lần gõ phím', async () => {
    const mounted = await mountSettled();

    /* Bật chế độ bằng chính phím R, không bằng một cờ đặt tay. */
    await pressKey(mounted.registry, 'R');
    expect(mounted.result.current.isKeyboardReviewMode).toBe(true);

    await run(() => {
      mounted.result.current.onSelect(UNREVIEWED_ID);
    });

    const keystrokes: string[] = [];

    /* Phím thứ nhất: con số người duyệt gõ vào ô nhập. */
    keystrokes.push('1250');
    await run(() => {
      mounted.result.current.keyboardReview.onEdit(UNREVIEWED_ID, 1250);
    });

    /* Phím thứ hai: Enter. Không có bước xác nhận nào chen vào. */
    keystrokes.push('Enter');
    await pressKey(mounted.registry, 'Enter');

    await waitFor(() => {
      expect(entityInStore(UNREVIEWED_ID)?.reviewed).toBe(true);
    });

    console.log(`số lần gõ phím để xong một chuỗi: ${keystrokes.length} — ${keystrokes.join(', ')}`);

    expect(keystrokes).toHaveLength(2);
    expect(entityInStore(UNREVIEWED_ID)?.overrideValueMm).toBe(1250);
    expect(entityInStore(UNREVIEWED_ID)?.source).toBe('human');
    /* Và vùng chọn đã ở chuỗi chưa duyệt kế tiếp, sẵn sàng cho hai phím sau. */
    expect(mounted.result.current.selectedDimensionId).toBe(NEXT_UNREVIEWED_ID);

    mounted.unmount();
  });

  it('khối chế độ bàn phím mang hàng đang duyệt và ba hàm sửa (QĐ-7)', async () => {
    const mounted = await mountSettled();

    expect(mounted.result.current.keyboardReview.row).toBeNull();

    await run(() => {
      mounted.result.current.onSelect(MINOR_ID);
    });

    const keyboardReview = mounted.result.current.keyboardReview;

    expect(keyboardReview.row?.id).toBe(MINOR_ID);
    expect(keyboardReview.row?.valueLabel).toBe('6.090 mm');
    expect(typeof keyboardReview.onEdit).toBe('function');
    expect(typeof keyboardReview.onApprove).toBe('function');
    expect(typeof keyboardReview.onCancelEdit).toBe('function');
    expect(keyboardReview.outlierMessage).toBeNull();

    mounted.unmount();
  });
});

/* -------------------------------------------------------------------------- */
/* Ba bộ lọc.                                                                  */
/* -------------------------------------------------------------------------- */

describe('ba bộ lọc của danh sách', () => {
  it('tất cả / độ tin cậy thấp / chưa duyệt cắt đúng ba con số', async () => {
    const mounted = await mountSettled();

    /* Mở màn ở trạng thái một phần: chín mục dưới ngưỡng đã lọc sẵn. */
    expect(mounted.result.current.activeFilter).toBe('lowConfidence');
    expect(mounted.result.current.rows).toHaveLength(DIMENSION_OCR_FIXTURE_LOW_CONFIDENCE);

    await run(() => {
      mounted.result.current.onFilterChange('all');
    });
    expect(mounted.result.current.rows).toHaveLength(DIMENSION_OCR_FIXTURE_TOTAL);

    await run(() => {
      mounted.result.current.onFilterChange('unreviewed');
    });
    expect(mounted.result.current.rows).toHaveLength(FIXTURE_UNREVIEWED);

    await run(() => {
      mounted.result.current.onFilterChange('lowConfidence');
    });

    console.log(
      `bộ lọc: tất cả ${DIMENSION_OCR_FIXTURE_TOTAL} · chưa duyệt ${FIXTURE_UNREVIEWED} · độ tin cậy thấp ${mounted.result.current.rows.length}`,
    );
    expect(mounted.result.current.rows).toHaveLength(DIMENSION_OCR_FIXTURE_LOW_CONFIDENCE);

    mounted.unmount();
  });

  it('hàm lọc là hàm THUẦN, chạy được không cần dựng hook', () => {
    const rows = DIMENSION_OCR_FIXTURE_DIMENSIONS.map((dimension) => ({
      isReviewed: dimension.reviewed,
      isLowConfidence: isLowConfidenceDimension(dimension.confidence),
    }));

    expect(applyDimensionFilters(rows as never, 'all')).toHaveLength(DIMENSION_OCR_FIXTURE_TOTAL);
    expect(applyDimensionFilters(rows as never, 'lowConfidence')).toHaveLength(
      DIMENSION_OCR_FIXTURE_LOW_CONFIDENCE,
    );
    expect(applyDimensionFilters(rows as never, 'unreviewed')).toHaveLength(FIXTURE_UNREVIEWED);
  });
});

/* -------------------------------------------------------------------------- */
/* Giá trị vô lý (QĐ-4).                                                       */
/* -------------------------------------------------------------------------- */

describe('giá trị vô lý bị chính tập chuỗi còn lại loại ra', () => {
  it('bộ mẫu nguyên vẹn không có chuỗi nào bị loại', () => {
    expect(implausibleDimensionIds(DIMENSION_OCR_FIXTURE_DIMENSIONS).size).toBe(0);
  });

  it('"phòng dài 30 mét" bị bắt, một giá trị hợp lý thì không', () => {
    const entityId = dimensionEntityIdOf(IMPLAUSIBLE_TARGET_ID);

    expect(
      isImplausibleDimensionValue(
        DIMENSION_OCR_FIXTURE_DIMENSIONS,
        entityId,
        IMPLAUSIBLE_VALUE_MM,
      ),
    ).toBe(true);
    expect(
      isImplausibleDimensionValue(DIMENSION_OCR_FIXTURE_DIMENSIONS, entityId, 5000),
    ).toBe(false);
  });

  it('hàng đang gõ mang câu gợi ý của T4, hàng khác thì không', async () => {
    const mounted = await mountSettled();

    await run(() => {
      mounted.result.current.onFilterChange('all');
    });
    expect(
      mounted.result.current.rows.every((row) => row.outlierMessage === null),
    ).toBe(true);

    await run(() => {
      mounted.result.current.onEdit(IMPLAUSIBLE_TARGET_ID, IMPLAUSIBLE_VALUE_MM);
    });

    const flagged = mounted.result.current.rows.find((row) => row.id === IMPLAUSIBLE_TARGET_ID);

    console.log(`gợi ý giá trị vô lý: ${String(flagged?.outlierMessage)}`);

    expect(flagged?.outlierMessage).toContain('30.000 mm');
    expect(
      mounted.result.current.rows.filter((row) => row.outlierMessage !== null),
    ).toHaveLength(1);

    mounted.unmount();
  });
});

/* -------------------------------------------------------------------------- */
/* Vai trò, vỏ màn và bảy trạng thái chạy thật.                                 */
/* -------------------------------------------------------------------------- */

describe('vai trò và vỏ màn', () => {
  it('vai Người xem: trạng thái `forbidden` và mọi hàm sửa không ghi gì', async () => {
    const mounted = await mountSettled({ roles: [] });

    expect(mounted.result.current.state).toBe('forbidden');
    expect(mounted.result.current.isViewerRole).toBe(true);
    expect(mounted.result.current.viewerRoleNotice).not.toBeNull();

    await run(() => {
      mounted.result.current.onApprove(UNREVIEWED_ID);
    });

    expect(entityInStore(UNREVIEWED_ID)?.reviewed).toBe(false);

    mounted.unmount();
  });

  it('trạng thái lỗi giữ được ảnh nền — canvas không trắng dù danh sách trắng', async () => {
    const mounted = await mountSettled({
      gateway: createMockDimensionOcrReviewGateway({ failReadDimensionLayer: true }),
    });

    await waitFor(() => {
      expect(mounted.result.current.state).toBe('error');
    });

    expect(mounted.result.current.errorMessage).not.toBeNull();
    expect(mounted.result.current.backgroundImageUrl).not.toBeNull();
    expect(mounted.result.current.rows).toHaveLength(0);

    mounted.unmount();
  });

  it('trạng thái rỗng: không chuỗi nào, kèm câu dẫn sang hiệu chỉnh tỷ lệ', async () => {
    const mounted = await mountSettled({
      gateway: createMockDimensionOcrReviewGateway({ graph: buildDimensionOcrGraph([]) }),
    });

    await waitFor(() => {
      expect(mounted.result.current.state).toBe('empty');
    });

    expect(mounted.result.current.reviewCounter.total).toBe(0);
    expect(mounted.result.current.emptyNotice).not.toBeNull();
    expect(mounted.result.current.compare).toBeNull();

    mounted.unmount();
  });

  it('trạng thái xong: 34/34 đã duyệt', async () => {
    const done = DIMENSION_OCR_FIXTURE_DIMENSIONS.map((entry) => ({
      ...entry,
      reviewed: true,
      source: 'human' as const,
    }));
    const mounted = await mountSettled({
      gateway: createMockDimensionOcrReviewGateway({ graph: buildDimensionOcrGraph(done) }),
    });

    await waitFor(() => {
      expect(mounted.result.current.state).toBe('success');
    });

    expect(mounted.result.current.reviewCounter).toEqual(reviewCounterOf(done));
    expect(mounted.result.current.reviewProgressLabel).toBe('34/34 kích thước đã duyệt');

    mounted.unmount();
  });

  it('OCR mới xong một phần giữ màn ở "một phần" dù đã duyệt hết', async () => {
    const done = DIMENSION_OCR_FIXTURE_DIMENSIONS.map((entry) => ({
      ...entry,
      reviewed: true,
      source: 'human' as const,
    }));
    const mounted = await mountSettled({
      gateway: createMockDimensionOcrReviewGateway({
        graph: buildDimensionOcrGraph(done),
        partialOcr: true,
      }),
    });

    await waitFor(() => {
      expect(mounted.result.current.state).toBe('partial');
    });

    expect(mounted.result.current.errorMessage).toBeNull();

    mounted.unmount();
  });

  it('trạng thái thu gọn ẩn bảng duyệt', async () => {
    const mounted = await mountSettled({ forceCollapsed: true });

    expect(mounted.result.current.state).toBe('collapsed');
    expect(mounted.result.current.isCollapsed).toBe(true);
    expect(mounted.result.current.isCompact).toBe(true);

    mounted.unmount();
  });
});

/* -------------------------------------------------------------------------- */
/* Chọn hàng, canvas và ảnh cắt.                                               */
/* -------------------------------------------------------------------------- */

describe('chọn hàng, canvas và ảnh cắt', () => {
  it('mỗi số đọc được có ảnh cắt gốc đi kèm — CẤM TUYỆT ĐỐI', async () => {
    const mounted = await mountSettled();

    await run(() => {
      mounted.result.current.onFilterChange('all');
    });

    expect(mounted.result.current.rows).toHaveLength(DIMENSION_OCR_FIXTURE_TOTAL);

    for (const row of mounted.result.current.rows) {
      expect(row.crop.sourcePx.width).toBeGreaterThan(0);
      expect(row.crop.sourcePx.height).toBeGreaterThan(0);
      expect(row.crop.displayWidthPx).toBe(row.crop.sourcePx.width);
      expect(row.crop.displayHeightPx).toBe(row.crop.sourcePx.height);
      expect(row.crop.alt).toContain(row.codeLabel);
    }

    mounted.unmount();
  });

  it('chọn một hàng đánh dấu đúng chuỗi trên canvas và nêu tường chủ', async () => {
    const mounted = await mountSettled();

    await run(() => {
      mounted.result.current.onSelect(MINOR_ID);
    });

    expect(mounted.result.current.chains).toHaveLength(DIMENSION_OCR_FIXTURE_TOTAL);
    expect(
      mounted.result.current.chains.filter((chain) => chain.isSelected).map((chain) => chain.id),
    ).toEqual([MINOR_ID]);
    expect(useStore.getState().selectedIds).toEqual([dimensionEntityIdOf(MINOR_ID)]);

    await run(() => {
      mounted.result.current.onFilterChange('all');
    });

    const row = mounted.result.current.rows.find((candidate) => candidate.id === MINOR_ID);

    expect(row?.hostWallId).not.toBeNull();
    expect(row?.hostWallLabel).toContain('Gắn với #W-');
    /*
     * Chuỗi đã duyệt đeo mã trạng thái xanh (A5), chuỗi DƯỚI NGƯỠNG mà chưa
     * duyệt thì "cần chú ý", còn chuỗi chưa duyệt nhưng vẫn trên ngưỡng thì
     * trung lập — `M-018` có độ tin cậy 0,79, tức `'suggested'` theo
     * `confidenceLevel`, nên nó KHÔNG phải một mục cần chú ý.
     */
    expect(
      mounted.result.current.rows.find((candidate) => candidate.isReviewed)?.statusCode,
    ).toBe('verified');
    expect(row?.isLowConfidence).toBe(false);
    expect(row?.statusCode).toBe('neutral');
    expect(
      mounted.result.current.rows.find(
        (candidate) => candidate.id === IMPLAUSIBLE_TARGET_ID,
      )?.statusCode,
    ).toBe('attention');

    mounted.unmount();
  });
});
