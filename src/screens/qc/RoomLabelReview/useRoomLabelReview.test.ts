/**
 * Nửa "suy nghĩ" của màn S-17 "Duyệt tên phòng", kiểm không cần DOM.
 *
 * Hook được lái qua `renderHook`; tầng dữ liệu là
 * `createMockRoomLabelReviewGateway()` — CÙNG cổng story sẽ dùng (R-73) — và
 * mọi con số khẳng định đọc ra từ `roomLabelFixture.ts` /
 * `roomLabelReviewScenarios.ts`, không có bảng dữ liệu thứ hai bịa tại chỗ
 * (R-70).
 *
 * ## Năm phép kiểm đặc tả gọi tên
 *
 * 1. tổng diện tích ra ĐÚNG `248,60 m²` và phòng `#R-005` ra ĐÚNG `18,40 m²`;
 * 2. "Chuẩn hoá tên" sinh bảng xem trước và KHÔNG đổi một tên nào trước khi
 *    xác nhận;
 * 3. áp chuẩn hoá xong thì có vé hoàn tác, và hoàn tác trả lại đúng tên cũ;
 * 4. nhắc công năng M-14 không chặn thao tác nào;
 * 5. vòng hở được liệt kê KÈM kích thước.
 *
 * Cộng thêm hai phép kiểm của những lời hứa dễ trôi nhất: bảy trạng thái đủ
 * bảy nhánh, và **đổi tên KHÔNG tính lại diện tích** — khẳng định bằng ĐỒNG
 * NHẤT THAM CHIẾU (`toBe`) trên `labelAnchorMm`, thứ chỉ đúng khi `measureRoom`
 * không chạy lại.
 */

import { createElement, type ReactNode } from 'react';
import { QueryClientProvider } from '@tanstack/react-query';
import { act, cleanup, renderHook, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { normalizeSpatial } from '@/domain/spatial/normalize';
import type { Level, Room, RoomId, Wall } from '@/domain/spatial/types';
import { millimetres } from '@/domain/units/types';
import { formatArea, formatLength } from '@/lib/format/measure';
import { createNotificationBus, type NotificationBus } from '@/lib/mutations/notificationBus';
import { createTestQueryClient } from '@/lib/testing/render';
import { SEVEN_STATES } from '@/lib/testing/sevenStateScenarios';
import { ROUTES } from '@/routes/paths';
import { resetSelectorCaches } from '@/store/selectors';
import { useStore } from '@/store';

import {
  ROOM_LABEL_FIXTURE_BUILDING,
  ROOM_LABEL_FIXTURE_LEVEL,
  ROOM_LABEL_FIXTURE_ROOMS,
  ROOM_LABEL_FIXTURE_ROOM_R005,
  ROOM_LABEL_FIXTURE_TOTAL,
  ROOM_LABEL_FIXTURE_TOTAL_AREA_M2,
  ROOM_LABEL_FIXTURE_UNNAMED_COUNT,
} from './roomLabelFixture';
import {
  createMockRoomLabelReviewGateway,
  roomCodeLabel,
  ROOM_NAME_TARGETS,
  ROOM_NORMALIZE_COMMAND_TYPE,
} from './roomLabelReviewGateway';
import {
  ROOM_LABEL_REVIEW_SCENARIOS,
  ROOM_LABEL_SCENARIO_COLLAPSED,
  ROOM_LABEL_SCENARIO_EMPTY,
  ROOM_LABEL_SCENARIO_ERROR,
  ROOM_LABEL_SCENARIO_FORBIDDEN,
  ROOM_LABEL_SCENARIO_GAP_MM,
  ROOM_LABEL_SCENARIO_PARTIAL,
  ROOM_LABEL_SCENARIO_SUCCESS,
  type RoomLabelReviewScenario,
} from './roomLabelReviewScenarios';
import {
  applyUnnamedFilter,
  areaCaptionOf,
  deriveRoomLabelScreenState,
  mergeCandidatesOf,
  outlineKeyOf,
  useRoomLabelReview,
  type UseRoomLabelReviewOptions,
  type UseRoomLabelReviewResult,
} from './useRoomLabelReview';

/* -------------------------------------------------------------------------- */
/* Bộ mẫu — đọc ra, không viết tay lại.                                        */
/* -------------------------------------------------------------------------- */

const PROJECT_ID = 'project-1';
const FIXTURE_LEVEL: Level = ROOM_LABEL_FIXTURE_LEVEL;
const FLOOR_ID = FIXTURE_LEVEL.id;

/** Đồ thị của một kịch bản, dựng đúng cách kho dựng nó. */
const graphOf = (rooms: readonly Room[], walls: readonly Wall[]): ReturnType<typeof normalizeSpatial> =>
  normalizeSpatial({
    building: ROOM_LABEL_FIXTURE_BUILDING,
    levels: [FIXTURE_LEVEL],
    walls: [...walls],
    openings: [],
    furniture: [],
    rooms: [...rooms],
    axes: [],
    dimensions: [],
    notes: [],
  });

const graphOfScenario = (scenario: RoomLabelReviewScenario): ReturnType<typeof normalizeSpatial> =>
  graphOf(scenario.rooms, scenario.walls);

/** Mã phòng `#R-005` — ví dụ nghiệm thu của đặc tả. */
const ROOM_R005: Room = ROOM_LABEL_FIXTURE_ROOM_R005 as Room;

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
  readonly result: { current: UseRoomLabelReviewResult };
  readonly unmount: () => void;
}

type MountOptions = Partial<UseRoomLabelReviewOptions>;

function mountHook(options: MountOptions = {}): Mounted {
  const queryClient = createTestQueryClient();
  const wrapper = ({ children }: { children: ReactNode }): ReactNode =>
    createElement(QueryClientProvider, { client: queryClient }, children);

  const rendered = renderHook(
    () =>
      useRoomLabelReview({
        projectId: options.projectId ?? PROJECT_ID,
        floorId: options.floorId ?? FLOOR_ID,
        roles: options.roles ?? ['engineer'],
        gateway:
          options.gateway ??
          createMockRoomLabelReviewGateway({
            graph: graphOf(ROOM_LABEL_FIXTURE_ROOMS, []),
          }),
        ...(options.notifications === undefined ? {} : { notifications: options.notifications }),
        ...(options.onNavigate === undefined ? {} : { onNavigate: options.onNavigate }),
        ...(options.levelId === undefined ? {} : { levelId: options.levelId }),
        ...(options.forceCollapsed === undefined ? {} : { forceCollapsed: options.forceCollapsed }),
        ...(options.forceCompact === undefined ? {} : { forceCompact: options.forceCompact }),
      }),
    { wrapper },
  );

  return { result: rendered.result, unmount: rendered.unmount };
}

/** Chờ lượt đọc lớp phòng xong — trước đó mọi kịch bản đều là `'loading'`. */
async function mountSettled(options: MountOptions = {}): Promise<Mounted> {
  const mounted = mountHook(options);

  await waitFor(() => {
    expect(mounted.result.current.state).not.toBe('loading');
  });

  return mounted;
}

/** Dựng hook trên đúng một kịch bản của bảy. */
async function mountScenario(scenario: RoomLabelReviewScenario): Promise<Mounted> {
  return mountSettled({
    roles: scenario.isViewerRole ? ['viewer'] : ['engineer'],
    forceCollapsed: scenario.isCollapsed,
    gateway: createMockRoomLabelReviewGateway({
      graph: graphOfScenario(scenario),
      failReadRoomLayer: scenario.error !== null,
      ...(scenario.backgroundImageUrl === null ? { withoutImage: true } : {}),
    }),
  });
}

/** Một dòng phòng của kết quả, đọc ra chứ không đoán chỉ số. */
const rowOf = (mounted: Mounted, roomId: RoomId): UseRoomLabelReviewResult['rooms'][number] => {
  const row = mounted.result.current.rooms.find((entry) => entry.id === roomId);

  expect(row).toBeDefined();

  return row as UseRoomLabelReviewResult['rooms'][number];
};

/** Tên hiện tại của một phòng, đọc THẲNG từ kho — không qua viewmodel. */
const nameInStore = (roomId: RoomId): string => {
  const graph = useStore.getState().spatial;
  const room = graph === null ? undefined : (graph.byId[roomId] as Room | undefined);

  return room?.name ?? '';
};

/* -------------------------------------------------------------------------- */
/* Phép ghép thuần — kiểm được mà không cần dựng hook.                          */
/* -------------------------------------------------------------------------- */

describe('phép ghép thuần của màn Duyệt tên phòng', () => {
  it('chữ ký hình học không đổi khi chỉ đổi tên', () => {
    const renamed: Room = { ...ROOM_R005, name: 'phòng ngủ chính' };

    expect(outlineKeyOf(renamed)).toBe(outlineKeyOf(ROOM_R005));
  });

  it('chữ ký hình học ĐỔI khi ranh phòng đổi', () => {
    const first = ROOM_R005.outline[0];
    const moved: Room = {
      ...ROOM_R005,
      outline: [{ x: (first?.x ?? 0) + 1, y: first?.y ?? 0 }, ...ROOM_R005.outline.slice(1)],
    };

    expect(outlineKeyOf(moved)).not.toBe(outlineKeyOf(ROOM_R005));
  });

  it('bảy trạng thái đi đúng thứ tự ưu tiên', () => {
    const base = {
      isViewerRole: false,
      isCollapsed: false,
      hasError: false,
      isLoading: false,
      visibleRooms: [],
      unnamedCount: 0,
    } as const;

    expect(deriveRoomLabelScreenState({ ...base, isViewerRole: true })).toBe('forbidden');
    expect(deriveRoomLabelScreenState({ ...base, isCollapsed: true })).toBe('collapsed');
    expect(deriveRoomLabelScreenState({ ...base, hasError: true })).toBe('error');
    expect(deriveRoomLabelScreenState({ ...base, isLoading: true })).toBe('loading');
    expect(deriveRoomLabelScreenState(base)).toBe('empty');
  });

  it('danh sách gộp bỏ chính phòng đang chọn', () => {
    const candidates = mergeCandidatesOf(ROOM_LABEL_FIXTURE_ROOMS, ROOM_R005.id);

    expect(candidates).toHaveLength(ROOM_LABEL_FIXTURE_TOTAL - 1);
    expect(candidates.some((entry) => entry.id === ROOM_R005.id)).toBe(false);
    expect(candidates[0]?.codeLabel).toBe(roomCodeLabel(candidates[0]?.id as RoomId));
  });

  it('câu giải thích diện tích lấy lại từ M-07, không tự viết', () => {
    expect(areaCaptionOf(null)).toBe('');
    expect(areaCaptionOf(ROOM_R005)).toContain('dây giày');
  });

  it('bộ lọc "Chưa đặt tên" giữ đúng số phòng trống tên', () => {
    const rows = ROOM_LABEL_FIXTURE_ROOMS.map((room) => ({
      hasName: room.name.trim() !== '',
    })) as unknown as readonly UseRoomLabelReviewResult['rooms'][number][];

    expect(applyUnnamedFilter(rows, true)).toHaveLength(ROOM_LABEL_FIXTURE_UNNAMED_COUNT);
    expect(applyUnnamedFilter(rows, false)).toHaveLength(ROOM_LABEL_FIXTURE_TOTAL);
  });
});

/* -------------------------------------------------------------------------- */
/* 1. Hai con số nghiệm thu của đặc tả.                                        */
/* -------------------------------------------------------------------------- */

describe('diện tích — M-07 tính, màn chỉ đọc', () => {
  it('tổng diện tích ra 248,60 m² và #R-005 ra 18,40 m²', async () => {
    const mounted = await mountSettled();

    const total = mounted.result.current.summary.totalAreaText;
    const r005 = rowOf(mounted, ROOM_R005.id).areaText;

    /* In ra số THẬT: một lượt xanh mà không ai đọc được con số thì chứng minh ít. */
    console.log(`[S-17] tổng diện tích = ${total} · #R-005 = ${r005}`);

    expect(total).toBe(formatArea(ROOM_LABEL_FIXTURE_TOTAL_AREA_M2));
    expect(total).toBe('248,60 m²');
    expect(r005).toBe(formatArea(ROOM_R005.areaM2));
    expect(r005).toBe('18,40 m²');
    expect(mounted.result.current.summary.roomCount).toBe(ROOM_LABEL_FIXTURE_TOTAL);
    expect(mounted.result.current.summary.unnamedCount).toBe(ROOM_LABEL_FIXTURE_UNNAMED_COUNT);
  });

  it('đổi tên KHÔNG tính lại diện tích', async () => {
    const mounted = await mountSettled();

    const before = rowOf(mounted, ROOM_R005.id);
    const anchorBefore = before.labelAnchorMm;
    const areaBefore = before.areaText;

    await act(async () => {
      mounted.result.current.onRename(ROOM_R005.id, 'phòng ngủ chính');
      await Promise.resolve();
    });

    await waitFor(() => {
      expect(nameInStore(ROOM_R005.id)).toBe('phòng ngủ chính');
    });

    const after = rowOf(mounted, ROOM_R005.id);

    /* ĐỒNG NHẤT THAM CHIẾU: chỉ đúng khi `measureRoom` không chạy lại. */
    expect(after.labelAnchorMm).toBe(anchorBefore);
    expect(after.areaText).toBe(areaBefore);
  });
});

/* -------------------------------------------------------------------------- */
/* 2 + 3. Chuẩn hoá tên: xem trước, rồi áp, rồi hoàn tác.                       */
/* -------------------------------------------------------------------------- */

describe('chuẩn hoá tên — luôn xem trước trước khi áp', () => {
  it('sinh bảng xem trước mà KHÔNG đổi một tên nào', async () => {
    const mounted = await mountSettled();

    const namesBefore = mounted.result.current.rooms.map((row) => row.name);

    act(() => {
      mounted.result.current.onOpenNormalizePreview();
    });

    const preview = mounted.result.current.normalizePreview;

    expect(preview).not.toBeNull();
    expect(preview?.changedCount).toBeGreaterThan(0);
    expect(preview?.rows.length).toBe(preview?.changedCount);
    /* Mọi đích đến nằm trong tám nhãn của tầng luật — màn không bịa nhãn mới. */
    for (const row of preview?.rows ?? []) {
      expect(ROOM_NAME_TARGETS.some((target) => row.to.startsWith(target))).toBe(true);
    }

    /* KHÔNG một tên nào đổi: cả ở viewmodel lẫn trong kho. */
    expect(mounted.result.current.rooms.map((row) => row.name)).toEqual(namesBefore);
    expect(nameInStore(ROOM_R005.id)).toBe(ROOM_R005.name);
  });

  it('huỷ xem trước thì đóng bảng và vẫn không đổi gì', async () => {
    const mounted = await mountSettled();

    act(() => {
      mounted.result.current.onOpenNormalizePreview();
    });
    act(() => {
      mounted.result.current.onCancelNormalize();
    });

    expect(mounted.result.current.normalizePreview).toBeNull();
    expect(nameInStore(ROOM_R005.id)).toBe(ROOM_R005.name);
  });

  it('áp xong thì có vé hoàn tác, và hoàn tác trả lại tên cũ', async () => {
    const notifications: NotificationBus = createNotificationBus();
    const mounted = await mountSettled({ notifications });

    act(() => {
      mounted.result.current.onOpenNormalizePreview();
    });

    const rows = mounted.result.current.normalizePreview?.rows ?? [];

    expect(rows.length).toBeGreaterThan(0);

    await act(async () => {
      mounted.result.current.onApplyNormalize();
      await Promise.resolve();
    });

    /* Bảng đóng lại, và mọi dòng của bảng đã thành tên mới trong kho. */
    await waitFor(() => {
      expect(nameInStore(rows[0]?.roomId as RoomId)).toBe(rows[0]?.to);
    });

    expect(mounted.result.current.normalizePreview).toBeNull();

    for (const row of rows) {
      expect(nameInStore(row.roomId)).toBe(row.to);
    }

    /* A8: một lượt chuẩn hoá = MỘT toast, MỘT vé, MỘT bước hoàn tác. */
    const published = notifications.list();
    const ticket = published[0]?.undoTicket;

    expect(published).toHaveLength(1);
    expect(published[0]?.type).toBe(ROOM_NORMALIZE_COMMAND_TYPE);
    expect(ticket).toBeDefined();
    expect(ticket?.getStatus()).toBe('active');

    await act(async () => {
      ticket?.undo();
      await Promise.resolve();
    });

    await waitFor(() => {
      expect(nameInStore(rows[0]?.roomId as RoomId)).toBe(rows[0]?.from);
    });

    for (const row of rows) {
      expect(nameInStore(row.roomId)).toBe(row.from);
    }
  });
});

/* -------------------------------------------------------------------------- */
/* 4. Nhắc công năng M-14 — NHẮC, không bao giờ CHẶN.                          */
/* -------------------------------------------------------------------------- */

describe('nhắc công năng M-14', () => {
  it('không chặn đổi tên, đổi công năng hay duyệt', async () => {
    const mounted = await mountSettled();
    const noticed = mounted.result.current.rooms.find((row) => row.notices.length > 0);

    expect(noticed).toBeDefined();

    const roomId = noticed?.id as RoomId;

    await act(async () => {
      mounted.result.current.onRename(roomId, 'phòng đã sửa theo nhắc');
      await Promise.resolve();
    });

    await waitFor(() => {
      expect(nameInStore(roomId)).toBe('phòng đã sửa theo nhắc');
    });

    await act(async () => {
      mounted.result.current.onChangeUsage(roomId, 'kitchen');
      await Promise.resolve();
    });

    await waitFor(() => {
      expect(rowOf(mounted, roomId).usage).toBe('kitchen');
    });

    await act(async () => {
      mounted.result.current.onApprove(roomId);
      await Promise.resolve();
    });

    /* A5: cờ xanh "đã xác minh" chỉ bật qua lượt duyệt của người. */
    await waitFor(() => {
      expect(rowOf(mounted, roomId).status).toBe('confirmed');
    });

    /* Và phòng vẫn còn nhắc: nhắc là NHẮC, không phải cổng chặn. */
    expect(rowOf(mounted, roomId).notices.length).toBeGreaterThan(0);
  });
});

/* -------------------------------------------------------------------------- */
/* 5. Vòng hở — kèm kích thước, kèm bước đi tiếp.                              */
/* -------------------------------------------------------------------------- */

describe('vòng tường hở', () => {
  it('liệt kê vòng hở KÈM kích thước', async () => {
    const mounted = await mountScenario(ROOM_LABEL_SCENARIO_PARTIAL);
    const gaps = mounted.result.current.gaps;

    console.log(`[S-17] vòng hở = ${gaps.map((gap) => gap.gapText).join(' · ')}`);

    expect(gaps.length).toBeGreaterThan(0);
    expect(gaps[0]?.gapText).toBe(formatLength(millimetres(ROOM_LABEL_SCENARIO_GAP_MM)));
    expect(gaps[0]?.wallIds.length).toBeGreaterThan(0);
  });

  it('trạng thái rỗng nói ra hai bước đi tiếp', async () => {
    const mounted = await mountScenario(ROOM_LABEL_SCENARIO_EMPTY);
    const notice = mounted.result.current.emptyNotice ?? '';

    expect(mounted.result.current.state).toBe('empty');
    expect(notice).toContain('lớp tường');
    expect(notice).toContain('Kiểm tra vòng hở');
  });

  it('"sang lớp tường" đi đúng đường dẫn ROUTES ghép ra', async () => {
    const onNavigate = vi.fn();
    const mounted = await mountSettled({ onNavigate });

    act(() => {
      mounted.result.current.onNavigateToWalls();
    });

    expect(onNavigate).toHaveBeenCalledWith(ROUTES.project.walls(PROJECT_ID, FLOOR_ID));
  });
});

/* -------------------------------------------------------------------------- */
/* Bảy trạng thái (A11/R-63).                                                  */
/* -------------------------------------------------------------------------- */

describe('bảy trạng thái', () => {
  it('bảy kịch bản phủ đúng bảy nhánh của SEVEN_STATES', () => {
    expect(ROOM_LABEL_REVIEW_SCENARIOS.map((scenario) => scenario.state)).toEqual([
      ...SEVEN_STATES,
    ]);
  });

  it.each([
    ['rỗng', ROOM_LABEL_SCENARIO_EMPTY],
    ['một phần', ROOM_LABEL_SCENARIO_PARTIAL],
    ['lỗi', ROOM_LABEL_SCENARIO_ERROR],
    ['xong', ROOM_LABEL_SCENARIO_SUCCESS],
    ['không có quyền', ROOM_LABEL_SCENARIO_FORBIDDEN],
    ['thu gọn', ROOM_LABEL_SCENARIO_COLLAPSED],
  ])('kịch bản %s cho đúng trạng thái của nó', async (_label, scenario) => {
    const mounted = await mountScenario(scenario);

    expect(mounted.result.current.state).toBe(scenario.state);
  });

  it('trạng thái lỗi vẫn giữ ảnh gốc xem được', async () => {
    const mounted = await mountScenario(ROOM_LABEL_SCENARIO_ERROR);

    expect(mounted.result.current.state).toBe('error');
    expect(mounted.result.current.errorMessage).not.toBeNull();
    expect(mounted.result.current.backgroundImageUrl).not.toBeNull();
  });

  it('vai Người xem có câu giải thích và mọi lượt ghi đều tắt', async () => {
    const mounted = await mountScenario(ROOM_LABEL_SCENARIO_FORBIDDEN);

    expect(mounted.result.current.isViewerRole).toBe(true);
    expect(mounted.result.current.viewerRoleNotice).not.toBeNull();

    await act(async () => {
      mounted.result.current.onRename(ROOM_R005.id, 'tên của người xem');
      await Promise.resolve();
    });

    expect(nameInStore(ROOM_R005.id)).toBe(ROOM_R005.name);
  });
});

/* -------------------------------------------------------------------------- */
/* Sáu trường thanh tra — worker panel đang chờ đúng sáu thứ này.               */
/* -------------------------------------------------------------------------- */

describe('sáu trường thanh tra', () => {
  it('cấp đủ sáu trường, và cả sáu đọc từ tầng luật chứ không gõ tay', async () => {
    const mounted = await mountSettled();

    act(() => {
      mounted.result.current.onSelect(ROOM_R005.id);
    });

    await waitFor(() => {
      expect(mounted.result.current.selectedRoomId).toBe(ROOM_R005.id);
    });

    const model = mounted.result.current;

    expect(model.nameSuggestions).toEqual(ROOM_NAME_TARGETS);
    expect(model.nameSuggestions).toHaveLength(ROOM_NAME_TARGETS.length);
    expect(model.usageOptions.map((option) => option.label)).toEqual([...ROOM_NAME_TARGETS]);
    expect(model.areaCaption).not.toBe('');
    expect(model.mergeCandidates).toHaveLength(ROOM_LABEL_FIXTURE_TOTAL - 1);
    /* Bộ mẫu không có tường ngăn nào, nên chưa có điểm cắt — và nó nói ra bằng `null`. */
    expect(model.splitPointMm).toBeNull();
    expect(model.viewerRoleNotice).toBeNull();
  });
});

/* -------------------------------------------------------------------------- */
/* Bộ lọc và vỏ màn.                                                           */
/* -------------------------------------------------------------------------- */

describe('chip lọc "Chưa đặt tên"', () => {
  it('thu hẹp danh sách xuống đúng ba phòng trống tên, tóm tắt vẫn đếm cả tầng', async () => {
    const mounted = await mountSettled();

    act(() => {
      mounted.result.current.onToggleUnnamedFilter();
    });

    expect(mounted.result.current.showOnlyUnnamed).toBe(true);
    expect(mounted.result.current.rooms).toHaveLength(ROOM_LABEL_FIXTURE_UNNAMED_COUNT);
    expect(mounted.result.current.summary.roomCount).toBe(ROOM_LABEL_FIXTURE_TOTAL);

    act(() => {
      mounted.result.current.onToggleUnnamedFilter();
    });

    expect(mounted.result.current.rooms).toHaveLength(ROOM_LABEL_FIXTURE_TOTAL);
  });
});
