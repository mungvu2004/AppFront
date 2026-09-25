/**
 * Nửa "suy nghĩ" của màn S-16 "Quản lý tầng", kiểm không cần DOM thật của sản
 * phẩm: hook được lái qua `renderHook`, tầng dữ liệu là
 * `createMockFloorManagerGateway()` của `floorManagerGateway.ts` — cùng cổng
 * story sẽ dùng — và mọi con số khẳng định đọc ra từ
 * `FLOOR_MANAGER_SAMPLE_LEVELS`, không có bảng dữ liệu thứ hai bịa tại chỗ
 * (R-70).
 *
 * ## Năm phép kiểm nghiệm thu
 *
 * 1. Đổi chiều cao Tầng trệt 3,9 → 4,2 m thì cao độ Tầng 2 dịch 3,9 → 4,2 m —
 *    và cả lượt đó là ĐÚNG MỘT bước lịch sử (QĐ-2).
 * 2. Chặn trùng cao độ, câu chặn nêu TÊN CẢ HAI TẦNG.
 * 3. Xoá tầng rồi hoàn tác thì thứ tự và cao độ trở về nguyên trạng.
 * 4. Nhân bản có / không kèm nội thất.
 * 5. Tỷ lệ chiều cao bốn dải khớp 3,0 / 3,9 / 3,6 / 3,6 m.
 */

import { createElement, type ReactNode } from 'react';
import { QueryClientProvider } from '@tanstack/react-query';
import { act, cleanup, renderHook, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi, type Mock } from 'vitest';

import { normalizeSpatial, type NormalizedSpatial } from '@/domain/spatial/normalize';
import type { Level, LevelId } from '@/domain/spatial/types';
import { metres, metresToMillimetres } from '@/domain/units/types';
import { createApiClient, type ApiResult } from '@/api/client';
import { FloorSchema, type Floor } from '@/api/contracts';
import { ApiErrorBodySchema } from '@/api/schemas/errors';
import { createHttpClient, type HttpError } from '@/lib/http';
import { formatLength } from '@/lib/format/measure';
import type { Announcer } from '@/lib/input/announcer';
import { createShortcutRegistry, type ShortcutRegistry } from '@/lib/input/shortcutRegistry';
import { createNotificationBus, type NotificationBus } from '@/lib/mutations/notificationBus';
import { createTestQueryClient } from '@/lib/testing/render';
import { resetSelectorCaches } from '@/store/selectors';
import { useStore } from '@/store';

import {
  createFloorManagerGateway,
  createFloorManagerSampleGraph,
  createMockFloorManagerGateway,
  floorWriteBodyOf,
  type FloorManagerGatewaySeed,
  entitiesOnLevel,
  findElevationConflict,
  FLOOR_MANAGER_SAMPLE_GROUND_ID,
  FLOOR_MANAGER_SAMPLE_LEVELS,
  FLOOR_MANAGER_SAMPLE_ROOF_ID,
  FLOOR_MANAGER_SAMPLE_SECOND_ID,
  FLOOR_MANAGER_UNSUPPORTED_NOTICES,
  levelsOf,
  type FloorManagerGateway,
} from './floorManagerGateway';
import type { UseFloorManagerResult } from './floorManagerTypes';
import {
  draftToMillimetres,
  FLOOR_MANAGER_TEXT,
  FLOOR_RESTORE_WINDOW_MS,
  useFloorManager,
  type UseFloorManagerOptions,
} from './useFloorManager';

/* -------------------------------------------------------------------------- */
/* Bộ mẫu — đọc ra, không viết tay lại.                                        */
/* -------------------------------------------------------------------------- */

const PROJECT_ID = 'project-floor-manager';

/** Bốn chiều cao của bộ mẫu: 3,0 / 3,9 / 3,6 / 3,6 m. */
const SAMPLE_HEIGHTS_MM = FLOOR_MANAGER_SAMPLE_LEVELS.map((entry) => entry.heightMm);

/** Tổng chiều cao ngăn xếp — CỘNG RA từ bộ mẫu, không phải một chuỗi viết tay. */
const TOTAL_STACK_HEIGHT_MM = SAMPLE_HEIGHTS_MM.reduce((total, value) => total + value, 0);

/** Chiều cao mới của Tầng trệt trong bài nghiệm thu: 4,2 m. */
const NEW_GROUND_HEIGHT_M = 4.2;

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
  readonly result: { current: UseFloorManagerResult };
  readonly registry: ShortcutRegistry;
  readonly notifications: NotificationBus;
  readonly spoken: readonly string[];
  readonly unmount: () => void;
}

type MountOptions = Partial<Omit<UseFloorManagerOptions, 'registry'>>;

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
      useFloorManager({
        projectId: options.projectId ?? PROJECT_ID,
        roles: options.roles ?? ['engineer'],
        gateway: options.gateway ?? createMockFloorManagerGateway(),
        registry,
        notifications,
        announcer,
        ...(options.forceCollapsed === undefined
          ? {}
          : { forceCollapsed: options.forceCollapsed }),
      }),
    { wrapper },
  );

  return { result: rendered.result, registry, notifications, spoken, unmount: rendered.unmount };
}

/** Chờ lượt đọc danh sách tầng xong — trước đó mọi kịch bản đều là `'loading'`. */
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

/** Đồ thị đang nằm trong kho — nơi `commit` vừa ghi vào. */
const storeGraph = (): NormalizedSpatial | null => useStore.getState().spatial;

/** Ảnh chụp thứ tự và cao độ của cả ngăn xếp, để so nguyên trạng trước và sau. */
function stackReadings(graph: NormalizedSpatial | null): readonly string[] {
  return levelsOf(graph).map(
    (level) =>
      `${String(level.id)} #${String(level.order)} @${String(level.elevationMm)} h${String(level.heightMm)}`,
  );
}

/** Sửa một ô rồi CHỐT giá trị — đúng đường `NumericField` báo về khi blur/Enter. */
async function commitField(
  mounted: Mounted,
  floorId: string,
  field: 'name' | 'elevation' | 'height',
  draftValue: string,
): Promise<void> {
  await act(async () => {
    mounted.result.current.onFloorFieldChange(floorId, field, draftValue);
    await Promise.resolve();
  });

  await act(async () => {
    mounted.result.current.onFloorFieldCommit(floorId, field);
    await Promise.resolve();
  });
}

const rowOf = (mounted: Mounted, floorId: string): UseFloorManagerResult['rows'][number] => {
  const row = mounted.result.current.rows.find((candidate) => candidate.id === floorId);

  if (row === undefined) {
    throw new Error(`Không tìm thấy dòng của tầng ${floorId} trong view-model.`);
  }

  return row;
};

const levelIn = (graph: NormalizedSpatial | null, floorId: string): Level => {
  const level = levelsOf(graph).find((candidate) => String(candidate.id) === floorId);

  if (level === undefined) {
    throw new Error(`Không tìm thấy tầng ${floorId} trong đồ thị.`);
  }

  return level;
};

/* -------------------------------------------------------------------------- */
/* 1. Đổi chiều cao Tầng trệt: 3,9 → 4,2 m, Tầng 2 dịch theo.                  */
/* -------------------------------------------------------------------------- */

describe('đổi chiều cao một tầng', () => {
  it('kéo cao độ tầng bên trên theo, và tốn ĐÚNG MỘT bước lịch sử', async () => {
    const mounted = await mountSettled();

    const groundId = String(FLOOR_MANAGER_SAMPLE_GROUND_ID);
    const secondId = String(FLOOR_MANAGER_SAMPLE_SECOND_ID);

    const groundBefore = levelIn(storeGraph(), groundId);
    const secondBefore = levelIn(storeGraph(), secondId);
    const stepsBefore = mounted.result.current.historyStepCount();

    /* Bộ mẫu phải đúng cảnh đặc tả tả: Tầng trệt cao 3,9 m, Tầng 2 ở cao độ 3,9 m. */
    expect(rowOf(mounted, groundId).heightText).toBe('3,9 m');
    expect(rowOf(mounted, secondId).elevationText).toBe('3,9 m');

    await commitField(mounted, groundId, 'height', '4,2');

    await waitFor(() => {
      expect(levelIn(storeGraph(), secondId).elevationMm).not.toBe(secondBefore.elevationMm);
    });

    const expectedHeightMm = metresToMillimetres(metres(NEW_GROUND_HEIGHT_M));

    console.log(
      `Tầng trệt: cao ${String(groundBefore.heightMm)} → ${String(levelIn(storeGraph(), groundId).heightMm)} mm · ` +
        `Tầng 2: cao độ ${String(secondBefore.elevationMm)} → ${String(levelIn(storeGraph(), secondId).elevationMm)} mm`,
    );

    expect(levelIn(storeGraph(), groundId).heightMm).toBe(expectedHeightMm);
    expect(levelIn(storeGraph(), secondId).elevationMm).toBe(expectedHeightMm);

    /* Và view-model nói cùng một chuyện, bằng chuỗi người đọc. */
    expect(rowOf(mounted, groundId).heightText).toBe('4,2 m');
    expect(rowOf(mounted, secondId).elevationText).toBe('4,2 m');

    /*
     * MỘT bước lịch sử cho cả hai lệnh (đổi chiều cao + xếp chồng lại) — hai
     * bước là đúng thứ QĐ-2 tồn tại để chặn.
     */
    expect(mounted.result.current.historyStepCount()).toBe(stepsBefore + 1);
  });

  it('một lần Ctrl+Z trả cả ngăn xếp về nguyên trạng', async () => {
    const mounted = await mountSettled();

    const groundId = String(FLOOR_MANAGER_SAMPLE_GROUND_ID);
    const readingsBefore = stackReadings(storeGraph());

    await commitField(mounted, groundId, 'height', '4,2');

    await waitFor(() => {
      expect(stackReadings(storeGraph())).not.toEqual(readingsBefore);
    });

    await pressKey(mounted.registry, 'z', { ctrlKey: true });

    expect(stackReadings(storeGraph())).toEqual(readingsBefore);
  });
});

/* -------------------------------------------------------------------------- */
/* 2. Chặn trùng cao độ — câu chặn nêu TÊN CẢ HAI TẦNG.                        */
/* -------------------------------------------------------------------------- */

describe('chặn trùng cao độ', () => {
  it('từ chối lượt đặt Tầng mái xuống đúng cao độ của Tầng 2, và gọi tên cả hai', async () => {
    const mounted = await mountSettled();

    const roofId = String(FLOOR_MANAGER_SAMPLE_ROOF_ID);
    const second = levelIn(storeGraph(), String(FLOOR_MANAGER_SAMPLE_SECOND_ID));
    const roof = levelIn(storeGraph(), roofId);
    const readingsBefore = stackReadings(storeGraph());
    const stepsBefore = mounted.result.current.historyStepCount();

    /* 3,9 m là ĐÚNG cao độ Tầng 2 đang đứng — đọc ra từ đồ thị, không gõ tay. */
    await commitField(
      mounted,
      roofId,
      'elevation',
      formatLength(second.elevationMm, { unit: 'm', fractionDigits: 1 }).replace(' m', ''),
    );

    const violation = mounted.result.current.duplicateElevationViolation;
    const message = mounted.result.current.duplicateElevationMessage ?? '';

    console.log(`câu chặn: ${message}`);

    expect(violation).not.toBeNull();
    expect(violation?.firstFloorName).toBe(roof.name);
    expect(violation?.secondFloorName).toBe(second.name);

    /* Câu người dùng đọc phải nêu ĐÍCH DANH cả hai tầng. */
    expect(message).toContain(roof.name);
    expect(message).toContain(second.name);

    /* aria-live cũng nghe được đúng câu đó (A12, R-72). */
    expect(mounted.spoken.some((line) => line.includes(second.name))).toBe(true);

    /* Và lượt đặt KHÔNG được ghi: không tầng nào dịch, không bước lịch sử nào thêm. */
    expect(stackReadings(storeGraph())).toEqual(readingsBefore);
    expect(mounted.result.current.historyStepCount()).toBe(stepsBefore);

    /* Câu chặn KHÔNG được lật màn sang trạng thái lỗi — nó là ràng buộc, không phải lỗi đọc. */
    expect(mounted.result.current.errorMessage).toBeNull();
    expect(mounted.result.current.state).not.toBe('error');
  });

  it('bắt cả hai tầng KHÔNG liền kề đứng cùng một cao độ', () => {
    /*
     * `validateChangeLevelElevation` chỉ nhìn hai hàng xóm theo `Level.order`.
     * Ngăn xếp dưới đây có `order` không khớp thứ tự cao độ, nên chỉ phép so
     * bằng bổ sung của QĐ-3 mới bắt được lượt đặt này.
     */
    const graph = normalizeSpatial({
      building: {
        name: 'Ngăn xếp lệch thứ tự',
        datumElevationMm: 0,
        confidence: 1,
        source: 'human',
        reviewed: false,
      },
      levels: [
        {
          id: 'L-OUTOFORDER01' as LevelId,
          name: 'Tầng A',
          order: 0,
          elevationMm: 5000,
          heightMm: 1000,
          confidence: 1,
          source: 'human',
          reviewed: false,
        },
        {
          id: 'L-OUTOFORDER02' as LevelId,
          name: 'Tầng B',
          order: 1,
          elevationMm: 0,
          heightMm: 1000,
          confidence: 1,
          source: 'human',
          reviewed: false,
        },
        {
          id: 'L-OUTOFORDER03' as LevelId,
          name: 'Tầng C',
          order: 2,
          elevationMm: 9000,
          heightMm: 1000,
          confidence: 1,
          source: 'human',
          reviewed: false,
        },
      ],
      walls: [],
      openings: [],
      furniture: [],
      rooms: [],
      axes: [],
      dimensions: [],
      notes: [],
    });

    const conflict = findElevationConflict(
      { levelId: 'L-OUTOFORDER03' as LevelId, elevationMm: 5000 },
      { graph, actorId: 'test' },
    );

    expect(conflict).not.toBeNull();
    expect(conflict?.violation.firstFloorName).toBe('Tầng C');
    expect(conflict?.violation.secondFloorName).toBe('Tầng A');
    expect(conflict?.violation.elevationText).toBe('5,0 m');
    expect(conflict?.reasons.join(' ')).toContain('Tầng A');
    expect(conflict?.reasons.join(' ')).toContain('Tầng C');
  });
});

/* -------------------------------------------------------------------------- */
/* 3. Xoá tầng rồi hoàn tác.                                                   */
/* -------------------------------------------------------------------------- */

describe('xoá tầng', () => {
  it('xoá ngay, KHÔNG hộp thoại, và phát vé hoàn tác 8 giây (A8)', async () => {
    const notifications = createNotificationBus();
    const mounted = await mountSettled({ notifications });
    const secondId = String(FLOOR_MANAGER_SAMPLE_SECOND_ID);

    await act(async () => {
      mounted.result.current.onRemoveFloor(secondId);
      await Promise.resolve();
    });

    await waitFor(() => {
      expect(notifications.list()).toHaveLength(1);
    });

    const published = notifications.list()[0];

    expect(published?.undoTicket).toBeDefined();
    expect(published?.undoTicket?.getStatus()).toBe('active');
    expect(published?.title).toContain('Tầng 2');
  });

  it('hoàn tác trả thứ tự, cao độ và nội dung của tầng về nguyên trạng', async () => {
    const mounted = await mountSettled();
    const secondId = String(FLOOR_MANAGER_SAMPLE_SECOND_ID);

    const readingsBefore = stackReadings(storeGraph());
    const contentsBefore = entitiesOnLevel(
      storeGraph(),
      FLOOR_MANAGER_SAMPLE_SECOND_ID,
    ).length;
    const stepsBefore = mounted.result.current.historyStepCount();

    expect(contentsBefore).toBeGreaterThan(0);

    await act(async () => {
      mounted.result.current.onRemoveFloor(secondId);
      await Promise.resolve();
    });

    await waitFor(() => {
      expect(mounted.result.current.historyStepCount()).toBe(stepsBefore + 1);
    });

    expect(levelsOf(storeGraph()).some((level) => String(level.id) === secondId)).toBe(false);
    expect(entitiesOnLevel(storeGraph(), FLOOR_MANAGER_SAMPLE_SECOND_ID)).toHaveLength(0);

    /* MỘT lần Ctrl+Z, qua sổ phím thật — không gọi tắt vào hàm hoàn tác. */
    await pressKey(mounted.registry, 'z', { ctrlKey: true });

    expect(stackReadings(storeGraph())).toEqual(readingsBefore);
    expect(entitiesOnLevel(storeGraph(), FLOOR_MANAGER_SAMPLE_SECOND_ID)).toHaveLength(
      contentsBefore,
    );
  });
});

/* -------------------------------------------------------------------------- */
/* 4. Nhân bản có / không kèm nội thất.                                        */
/* -------------------------------------------------------------------------- */

describe('nhân bản tầng', () => {
  const furnitureCountOn = (graph: NormalizedSpatial | null, levelId: LevelId): number =>
    entitiesOnLevel(graph, levelId).filter((entity) => String(entity.id).startsWith('F-')).length;

  const newestLevelId = (graph: NormalizedSpatial | null): LevelId => {
    const stack = levelsOf(graph);
    const top = stack[stack.length - 1];

    if (top === undefined) {
      throw new Error('Đồ thị không còn tầng nào sau lượt nhân bản.');
    }

    return top.id;
  };

  it('kèm nội thất thì tầng mới có đúng bấy nhiêu món', async () => {
    const mounted = await mountSettled();
    const groundId = String(FLOOR_MANAGER_SAMPLE_GROUND_ID);
    const sourceFurniture = furnitureCountOn(storeGraph(), FLOOR_MANAGER_SAMPLE_GROUND_ID);
    const levelsBefore = levelsOf(storeGraph()).length;

    expect(sourceFurniture).toBeGreaterThan(0);

    await act(async () => {
      mounted.result.current.onDuplicateFloor(groundId, { copyFurniture: true });
      await Promise.resolve();
    });

    await waitFor(() => {
      expect(levelsOf(storeGraph())).toHaveLength(levelsBefore + 1);
    });

    const copied = newestLevelId(storeGraph());

    console.log(
      `nhân bản KÈM nội thất: nguồn ${String(sourceFurniture)} món → bản sao ${String(furnitureCountOn(storeGraph(), copied))} món`,
    );

    expect(furnitureCountOn(storeGraph(), copied)).toBe(sourceFurniture);
  });

  it('không kèm nội thất thì tầng mới có tường và phòng nhưng không món nào', async () => {
    const mounted = await mountSettled();
    const groundId = String(FLOOR_MANAGER_SAMPLE_GROUND_ID);
    const levelsBefore = levelsOf(storeGraph()).length;
    const sourceEntities = entitiesOnLevel(storeGraph(), FLOOR_MANAGER_SAMPLE_GROUND_ID).length;
    const sourceFurniture = furnitureCountOn(storeGraph(), FLOOR_MANAGER_SAMPLE_GROUND_ID);

    await act(async () => {
      mounted.result.current.onDuplicateFloor(groundId, { copyFurniture: false });
      await Promise.resolve();
    });

    await waitFor(() => {
      expect(levelsOf(storeGraph())).toHaveLength(levelsBefore + 1);
    });

    const copied = newestLevelId(storeGraph());

    console.log(
      `nhân bản KHÔNG kèm nội thất: bản sao ${String(furnitureCountOn(storeGraph(), copied))} món, ` +
        `${String(entitiesOnLevel(storeGraph(), copied).length)} đối tượng`,
    );

    expect(furnitureCountOn(storeGraph(), copied)).toBe(0);
    expect(entitiesOnLevel(storeGraph(), copied).length).toBe(sourceEntities - sourceFurniture);
  });
});

/* -------------------------------------------------------------------------- */
/* 5. Tỷ lệ chiều cao bốn dải.                                                 */
/* -------------------------------------------------------------------------- */

describe('lát cắt', () => {
  it('bốn dải đúng tỷ lệ 3,0 / 3,9 / 3,6 / 3,6 m, và cộng lại bằng 1', async () => {
    const mounted = await mountSettled();
    const bands = mounted.result.current.bands;

    expect(bands).toHaveLength(FLOOR_MANAGER_SAMPLE_LEVELS.length);

    bands.forEach((band, index) => {
      const heightMm = SAMPLE_HEIGHTS_MM[index] ?? 0;

      expect(band.bandHeightRatio).toBeCloseTo(heightMm / TOTAL_STACK_HEIGHT_MM, 12);
      expect(band.label).toContain(
        formatLength(heightMm, { unit: 'm', fractionDigits: 1 }),
      );
    });

    const sum = bands.reduce((total, band) => total + band.bandHeightRatio, 0);

    console.log(
      `tỷ lệ dải: ${bands.map((band) => band.bandHeightRatio.toString()).join(' · ')} (tổng ${String(sum)})`,
    );

    expect(sum).toBeCloseTo(1, 12);
  });

  it('chân bảng cộng ra tổng chiều cao thật, không phải một chuỗi viết cứng', async () => {
    const mounted = await mountSettled();

    expect(mounted.result.current.footer.totalHeightText).toBe(
      formatLength(TOTAL_STACK_HEIGHT_MM, { unit: 'm', fractionDigits: 1 }),
    );
    expect(mounted.result.current.totalHeightText).toBe(
      mounted.result.current.footer.totalHeightText,
    );
    expect(mounted.result.current.footer.floorCountText).toBe('4 tầng');
  });

  it('vạch thang cao độ chạy từ đáy lên đỉnh, 0 tới 1', async () => {
    const mounted = await mountSettled();
    const ticks = mounted.result.current.elevationTicks;

    expect(ticks).toHaveLength(FLOOR_MANAGER_SAMPLE_LEVELS.length + 1);
    expect(ticks[0]?.offsetRatio).toBe(0);
    expect(ticks[ticks.length - 1]?.offsetRatio).toBe(1);
    expect(ticks[ticks.length - 1]?.offsetCssPercent).toBe('100%');
  });
});

/* -------------------------------------------------------------------------- */
/* Bảng và bản kê nợ.                                                          */
/* -------------------------------------------------------------------------- */

describe('bảng tầng', () => {
  it('tầng chưa có bản vẽ là trạng thái Một phần, và ba ô đếm hiện "—"', async () => {
    const mounted = await mountSettled();
    const roof = rowOf(mounted, String(FLOOR_MANAGER_SAMPLE_ROOF_ID));

    expect(mounted.result.current.state).toBe('partial');
    expect(roof.needsDrawing).toBe(true);
    expect(roof.drawingCountText).toBe('chưa có bản vẽ');
    expect(roof.wallCountText).toBe('—');
    expect(roof.roomCountText).toBe('—');
    expect(roof.areaText).toBe('—');
    expect(roof.areaM2).toBeNull();
  });

  it('tầng có bản vẽ đếm được tường, phòng và diện tích của chính nó', async () => {
    const mounted = await mountSettled();
    const ground = rowOf(mounted, String(FLOOR_MANAGER_SAMPLE_GROUND_ID));
    const sample = FLOOR_MANAGER_SAMPLE_LEVELS[1];

    console.log(
      `Tầng trệt: ${ground.wallCountText} tường · ${ground.roomCountText} phòng · ${ground.areaText}`,
    );

    expect(ground.wallCountText).toBe(String(sample?.wallCount));
    expect(ground.roomCountText).toBe(String(sample?.roomCount));
    expect(ground.areaText).toBe('248,60 m²');
  });

  it('vai Người xem ẩn mọi thao tác sửa và nói ra vì sao', async () => {
    const mounted = await mountSettled({ roles: ['viewer'] });

    expect(mounted.result.current.state).toBe('forbidden');
    expect(mounted.result.current.canEdit).toBe(false);
    expect(mounted.result.current.forbiddenNotice).not.toBeNull();
  });

  it('nói ra hai khoản nợ của cổng thay vì im lặng', async () => {
    const mounted = await mountSettled();

    expect(mounted.result.current.unsupportedNotices).toEqual([
      FLOOR_MANAGER_UNSUPPORTED_NOTICES.persistFloorContents,
      FLOOR_MANAGER_UNSUPPORTED_NOTICES.hideFloorFrom3d,
    ]);
  });

  it('ẩn tầng khỏi 3D là khung đọc của màn, và màn nói rằng nó không lưu được', async () => {
    const mounted = await mountSettled();
    const roofId = String(FLOOR_MANAGER_SAMPLE_ROOF_ID);

    await act(async () => {
      mounted.result.current.onToggleHiddenIn3d(roofId);
      await Promise.resolve();
    });

    await waitFor(() => {
      expect(rowOf(mounted, roofId).isHiddenIn3d).toBe(true);
    });

    expect(
      mounted.spoken.some(
        (line) => line === FLOOR_MANAGER_UNSUPPORTED_NOTICES.hideFloorFrom3d,
      ),
    ).toBe(true);

    /* Khung đọc, không phải thay đổi mô hình: không bước lịch sử nào sinh ra. */
    expect(mounted.result.current.historyStepCount()).toBe(0);
  });

  it('trạng thái lỗi mang câu của describeError và giữ nút Thử lại', async () => {
    const gateway: FloorManagerGateway = createMockFloorManagerGateway({
      failReadFloorList: true,
    });
    const mounted = await mountSettled({ gateway });

    expect(mounted.result.current.state).toBe('error');
    expect(mounted.result.current.errorMessage).not.toBeNull();
    expect(mounted.result.current.rows).toHaveLength(0);
  });

  it('dự án chưa có tầng nào là trạng thái Rỗng, không phải màn trắng', async () => {
    const gateway = createMockFloorManagerGateway({
      graph: createFloorManagerSampleGraph({ levels: [] }),
      floors: [],
    });
    const mounted = await mountSettled({ gateway });

    expect(mounted.result.current.state).toBe('empty');
    expect(mounted.result.current.emptyNotice).toBe(
      'thêm tầng đầu tiên, hoặc nhập số tầng từ màn hình tạo dự án.',
    );
    expect(mounted.result.current.bands).toHaveLength(0);
  });
});

/* -------------------------------------------------------------------------- */
/* F-03: lồng dự án, hoàn tác gọi máy chủ, lùi khi ghi hỏng.                    */
/* -------------------------------------------------------------------------- */

const NEW_ID = 'L-0000000001' as LevelId;
const BASEMENT_ID = 'L-FLOORBASEMENT';
const GROUND_ID = String(FLOOR_MANAGER_SAMPLE_GROUND_ID);
const SECOND_ID = String(FLOOR_MANAGER_SAMPLE_SECOND_ID);
const ROOF_ID = String(FLOOR_MANAGER_SAMPLE_ROOF_ID);
const SAMPLE_ORDER = [BASEMENT_ID, GROUND_ID, SECOND_ID, ROOF_ID];

/** Thân tầng như máy chủ trả — dữ liệu DÂY; schema chỉ khẳng định nó hợp lệ. */
function wireFloorBody(id: string): Record<string, unknown> {
  return { id, name: 'Tầng', order: 0, elevationMm: 0, heightMm: 3000, drawings: [] };
}

function wireFloor(id: string): Floor {
  return FloorSchema.parse(wireFloorBody(id));
}

/** Lỗi dây: `HttpError` có `status`, `code`, và `raw` khớp `ApiErrorBodySchema`. */
function wireFailure<TValue>(
  status: number,
  code: string,
  resource?: 'floor' | 'project',
): Promise<ApiResult<TValue>> {
  const raw = { code, requestId: 'REQ-F03', ...(resource === undefined ? {} : { resource }) };

  ApiErrorBodySchema.parse(raw);

  const error: HttpError = { kind: 'http', status, code, requestId: 'REQ-F03', retryable: false, raw };

  return Promise.resolve({ ok: false, error });
}

type Persist<TKey extends 'persistAddFloor' | 'persistRemoveFloor' | 'persistReorderFloors' | 'persistFloorFields'> =
  Mock<FloorManagerGateway[TKey]>;

/** Cổng mẫu, nhưng mỗi lượt ghi là một `vi.fn` để đọc lại từng request. */
function spiedGateway(seed: FloorManagerGatewaySeed = {}): {
  readonly gateway: FloorManagerGateway;
  readonly add: Persist<'persistAddFloor'>;
  readonly remove: Persist<'persistRemoveFloor'>;
  readonly reorder: Persist<'persistReorderFloors'>;
  readonly patch: Persist<'persistFloorFields'>;
} {
  const base = createMockFloorManagerGateway(seed);
  const add = vi.fn(base.persistAddFloor);
  const remove = vi.fn(base.persistRemoveFloor);
  const reorder = vi.fn(base.persistReorderFloors);
  const patch = vi.fn(base.persistFloorFields);

  return {
    gateway: {
      ...base,
      persistAddFloor: add,
      persistRemoveFloor: remove,
      persistReorderFloors: reorder,
      persistFloorFields: patch,
    },
    add,
    remove,
    reorder,
    patch,
  };
}

const sleep = (): Promise<void> =>
  act(async () => {
    await new Promise<void>((resolve) => {
      setTimeout(resolve, 0);
    });
  });

const undoWithKey = (mounted: Mounted): Promise<void> =>
  pressKey(mounted.registry, 'z', { ctrlKey: true });

const levelIds = (): readonly string[] => levelsOf(storeGraph()).map((level) => String(level.id));

const descriptionsOf = (notifications: NotificationBus): readonly string[] =>
  notifications.list().map((entry) => entry.description);

const fiftyLevels = Array.from({ length: 50 }, (_, index) => ({
  id: `L-${String(index + 1).padStart(10, '0')}` as LevelId,
  name: `Tầng ${String(index)}`,
  elevationMm: index * 3000,
  heightMm: 3000,
  drawingCount: 0,
  wallCount: 0,
  roomCount: 0,
  furnitureCount: 0,
}));

describe('làm tròn milimét', () => {
  it('gõ 3,95 m ra milimét nguyên, kể cả số lẻ dưới milimét', () => {
    expect(draftToMillimetres('3,95')).toBe(3950);
    expect(draftToMillimetres('3,9549')).toBe(3955);
    expect(Number.isInteger(draftToMillimetres('1,0004'))).toBe(true);
  });

  it('thân ghi tầng làm tròn cao độ và chiều cao', () => {
    const level: Level = {
      ...levelIn(createFloorManagerSampleGraph(), GROUND_ID),
      elevationMm: 1234.6,
      heightMm: 2999.5,
    };
    const body = floorWriteBodyOf(level);

    expect(body.elevationMm).toBe(1235);
    expect(body.heightMm).toBe(3000);
  });
});

describe('cổng thật', () => {
  it('đọc tầng theo dự án, và POST gửi id trong thân chứ không gửi projectId', async () => {
    const fetchImpl = vi.fn<typeof fetch>(() =>
      Promise.resolve(
        new Response(JSON.stringify([]), {
          headers: { 'Content-Type': 'application/json' },
          status: 200,
        }),
      ),
    );
    const gateway = createFloorManagerGateway({
      api: createApiClient(createHttpClient({ baseUrl: 'https://api.example.com', fetchImpl })),
      graph: { read: () => null },
    });

    await gateway.readFloorList({ projectId: 'P-0000000001' });

    expect(String(fetchImpl.mock.calls[0]?.[0])).toContain('/projects/P-0000000001/floors');

    fetchImpl.mockClear();
    fetchImpl.mockImplementation(() =>
      Promise.resolve(
        new Response(JSON.stringify(wireFloorBody(String(NEW_ID))), {
          headers: { 'Content-Type': 'application/json' },
          status: 201,
        }),
      ),
    );

    await gateway.persistAddFloor({
      projectId: 'P-0000000001',
      level: { ...levelIn(createFloorManagerSampleGraph(), GROUND_ID), id: NEW_ID },
    });

    const [url, init] = fetchImpl.mock.calls[0] ?? [];
    const sent = JSON.parse(String(init?.body)) as Record<string, unknown>;

    expect(String(url)).toContain('/projects/P-0000000001/floors');
    expect(sent.id).toBe(NEW_ID);
    expect(sent).not.toHaveProperty('projectId');
  });
});

describe('thêm tầng', () => {
  it('gửi đúng id của tầng vừa dựng cho dự án này', async () => {
    const { gateway, add } = spiedGateway({ nextLevelId: () => NEW_ID });
    const mounted = await mountSettled({ gateway });

    await act(async () => {
      mounted.result.current.onAddFloor();
      await Promise.resolve();
    });
    await waitFor(() => {
      expect(add).toHaveBeenCalledTimes(1);
    });

    const input = add.mock.calls[0]?.[0];

    expect(input?.projectId).toBe(PROJECT_ID);
    expect(String(input?.level.id)).toBe(String(NEW_ID));
    expect(wireFloor(String(NEW_ID)).id).toBe(String(NEW_ID));
  });

  it('đủ 50 tầng thì KHÔNG POST, không dựng lệnh, và nói ra câu', async () => {
    const { gateway, add } = spiedGateway({
      graph: createFloorManagerSampleGraph({ levels: fiftyLevels, withContents: false }),
      floors: [],
    });
    const mounted = await mountSettled({ gateway });

    await act(async () => {
      mounted.result.current.onAddFloor();
      mounted.result.current.onDuplicateFloor(String(fiftyLevels[0]?.id), { copyFurniture: false });
      await Promise.resolve();
    });
    await sleep();

    expect(add).not.toHaveBeenCalled();
    expect(levelIds()).toHaveLength(50);
    expect(mounted.result.current.historyStepCount()).toBe(0);
    expect(descriptionsOf(mounted.notifications)).toContain(FLOOR_MANAGER_TEXT.limitReached);
    expect(mounted.spoken).toContain(FLOOR_MANAGER_TEXT.limitReached);
  });

  it.each([
    [409, 'FLOOR_ID_TAKEN', FLOOR_MANAGER_TEXT.idTaken],
    [422, 'FLOOR_LIMIT_REACHED', FLOOR_MANAGER_TEXT.limitReached],
  ])(
    'máy chủ từ chối %i %s thì tầng rời khỏi đồ thị, có câu riêng, không dải tải lại',
    async (status, code, sentence) => {
      const { gateway, add } = spiedGateway({ nextLevelId: () => NEW_ID });
      const mounted = await mountSettled({ gateway });

      add.mockImplementation(() => wireFailure(status, code));

      await act(async () => {
        mounted.result.current.onAddFloor();
        await Promise.resolve();
      });
      await waitFor(() => {
        expect(descriptionsOf(mounted.notifications)).toContain(sentence);
      });

      expect(levelIds()).toEqual(SAMPLE_ORDER);
      expect(mounted.result.current.historyStepCount()).toBe(0);
      expect(mounted.result.current.state).not.toBe('error');
      expect(mounted.result.current.errorMessage).toBeNull();
      expect(descriptionsOf(mounted.notifications).join(' ')).not.toContain(code);
    },
  );
});

describe('hoàn tác gọi máy chủ', () => {
  it('hoàn tác "thêm" gửi DELETE đúng tầng đó', async () => {
    const { gateway, remove } = spiedGateway({ nextLevelId: () => NEW_ID });
    const mounted = await mountSettled({ gateway });

    await act(async () => {
      mounted.result.current.onAddFloor();
      await Promise.resolve();
    });
    await waitFor(() => {
      expect(levelIds()).toContain(String(NEW_ID));
    });
    await sleep();
    await undoWithKey(mounted);
    await waitFor(() => {
      expect(remove).toHaveBeenCalledTimes(1);
    });

    expect(remove.mock.calls[0]?.[0]).toEqual({ projectId: PROJECT_ID, floorId: String(NEW_ID) });
    expect(levelIds()).toEqual(SAMPLE_ORDER);
  });

  it.each([
    [569 * 1000, true],
    [571 * 1000, false],
  ])('hoàn tác "xoá" sau %i ms: gửi POST khôi phục = %s', async (elapsedMs, restores) => {
    let clock = 1_000_000;
    const { gateway, add } = spiedGateway({ now: () => clock });
    const mounted = await mountSettled({ gateway });

    expect(FLOOR_RESTORE_WINDOW_MS).toBe(570 * 1000);

    await act(async () => {
      mounted.result.current.onRemoveFloor(SECOND_ID);
      await Promise.resolve();
    });
    await waitFor(() => {
      expect(levelIds()).not.toContain(SECOND_ID);
    });
    await sleep();

    const afterRemove = stackReadings(storeGraph());

    clock += elapsedMs;
    await undoWithKey(mounted);
    await sleep();

    if (restores) {
      await waitFor(() => {
        expect(add).toHaveBeenCalledTimes(1);
      });

      expect(String(add.mock.calls[0]?.[0].level.id)).toBe(SECOND_ID);
      expect(levelIds()).toContain(SECOND_ID);
    } else {
      expect(add).not.toHaveBeenCalled();
      expect(stackReadings(storeGraph())).toEqual(afterRemove);
      expect(descriptionsOf(mounted.notifications)).toContain(FLOOR_MANAGER_TEXT.undoExpired);
    }
  });

  it('hoàn tác đổi tên và đổi cao độ gửi PATCH mang giá trị cũ', async () => {
    const { gateway, patch } = spiedGateway();
    const mounted = await mountSettled({ gateway });
    const before = levelIn(storeGraph(), ROOF_ID);

    await commitField(mounted, ROOF_ID, 'name', 'Mái mới');
    await waitFor(() => {
      expect(patch).toHaveBeenCalledTimes(1);
    });
    await undoWithKey(mounted);
    await waitFor(() => {
      expect(patch).toHaveBeenCalledTimes(2);
    });

    expect(patch.mock.calls[1]?.[0].floorId).toBe(ROOF_ID);
    expect(patch.mock.calls[1]?.[0].body.name).toBe(before.name);

    patch.mockClear();
    await commitField(mounted, ROOF_ID, 'elevation', '8');
    await waitFor(() => {
      expect(patch).toHaveBeenCalledTimes(1);
    });
    await undoWithKey(mounted);
    await waitFor(() => {
      expect(patch).toHaveBeenCalledTimes(2);
    });

    expect(patch.mock.calls[1]?.[0].body.elevationMm).toBe(before.elevationMm);
  });

  it('hoàn tác sắp xếp gửi #13 thứ tự cũ (đủ 4 tầng) rồi mới #34', async () => {
    const { gateway, reorder, patch } = spiedGateway();
    const mounted = await mountSettled({ gateway });
    const swapped = [BASEMENT_ID, SECOND_ID, GROUND_ID, ROOF_ID];

    await act(async () => {
      mounted.result.current.onReorderFloors(swapped);
      await Promise.resolve();
    });
    await waitFor(() => {
      expect(levelIds()).toEqual(swapped);
    });
    await sleep();

    expect(reorder.mock.calls[0]?.[0].floorIds).toEqual(swapped);

    reorder.mockClear();
    patch.mockClear();
    await undoWithKey(mounted);
    await waitFor(() => {
      expect(reorder).toHaveBeenCalledTimes(1);
      expect(patch.mock.calls.length).toBeGreaterThan(0);
    });

    expect(reorder.mock.calls[0]?.[0]).toEqual({ projectId: PROJECT_ID, floorIds: SAMPLE_ORDER });
    expect(Math.max(...reorder.mock.invocationCallOrder)).toBeLessThan(
      Math.min(...patch.mock.invocationCallOrder),
    );
  });

  it('hoàn tác đổi chiều cao tầng 1 KHÔNG gửi #13, chỉ #34', async () => {
    const { gateway, reorder, patch } = spiedGateway();
    const mounted = await mountSettled({ gateway });

    await commitField(mounted, GROUND_ID, 'height', '4,2');
    await waitFor(() => {
      expect(patch.mock.calls.length).toBeGreaterThan(0);
    });
    await sleep();
    patch.mockClear();
    await undoWithKey(mounted);
    await waitFor(() => {
      expect(patch.mock.calls.length).toBeGreaterThan(0);
    });

    expect(reorder).not.toHaveBeenCalled();
    expect(patch.mock.calls.map((call) => call[0].floorId)).toContain(GROUND_ID);
  });

  it('máy chủ từ chối lúc hoàn tác thì đồ thị trở lại đúng như sau thao tác', async () => {
    const { gateway, patch } = spiedGateway();
    const mounted = await mountSettled({ gateway });

    await commitField(mounted, ROOF_ID, 'name', 'Mái mới');
    await waitFor(() => {
      expect(patch).toHaveBeenCalledTimes(1);
    });
    await sleep();

    const afterEdit = stackReadings(storeGraph());
    const stepsAfterEdit = mounted.result.current.historyStepCount();
    const pastBefore = useStore.temporal.getState().pastStates.length;

    patch.mockImplementation(() => wireFailure(404, 'NOT_FOUND', 'floor'));
    await undoWithKey(mounted);
    await waitFor(() => {
      expect(descriptionsOf(mounted.notifications)).toContain(FLOOR_MANAGER_TEXT.floorGone);
    });

    expect(levelIn(storeGraph(), ROOF_ID).name).toBe('Mái mới');
    expect(stackReadings(storeGraph())).toEqual(afterEdit);
    expect(mounted.result.current.historyStepCount()).toBe(stepsAfterEdit);
    /* Nhiều nhất là bước của chính lượt hoàn tác cục bộ; lượt lùi vì máy chủ từ chối không thêm bước nào. */
    expect(useStore.temporal.getState().pastStates.length).toBeLessThanOrEqual(pastBefore + 1);
    expect(patch).toHaveBeenCalledTimes(2);
  });

  it('bấm vé khi đã có thao tác mới hơn thì KHÔNG hoàn tác bước khác', async () => {
    const { gateway, add } = spiedGateway();
    const mounted = await mountSettled({ gateway });

    await act(async () => {
      mounted.result.current.onRemoveFloor(SECOND_ID);
      await Promise.resolve();
    });
    await waitFor(() => {
      expect(mounted.notifications.list()).toHaveLength(1);
    });

    const ticket = mounted.notifications.list()[0]?.undoTicket;

    await commitField(mounted, ROOF_ID, 'name', 'Mái mới');
    await sleep();
    add.mockClear();
    ticket?.undo();
    await sleep();

    expect(levelIds()).not.toContain(SECOND_ID);
    expect(levelIn(storeGraph(), ROOF_ID).name).toBe('Mái mới');
    expect(add).not.toHaveBeenCalled();
    expect(descriptionsOf(mounted.notifications)).toContain(FLOOR_MANAGER_TEXT.undoNotLatest);
  });

  it('bấm vé lúc #11 còn bay thì POST khôi phục chạy SAU khi #11 xong', async () => {
    const { gateway, add, remove } = spiedGateway();
    const mounted = await mountSettled({ gateway });
    const settled = wireFloor(SECOND_ID);
    let finishRemove: () => void = () => undefined;

    remove.mockImplementation(
      () =>
        new Promise((resolve) => {
          finishRemove = () => {
            resolve({ ok: true, data: settled });
          };
        }),
    );

    await act(async () => {
      mounted.result.current.onRemoveFloor(SECOND_ID);
      await Promise.resolve();
    });
    await waitFor(() => {
      expect(mounted.notifications.list()).toHaveLength(1);
      expect(remove).toHaveBeenCalledTimes(1);
    });

    mounted.notifications.list()[0]?.undoTicket?.undo();
    await sleep();

    expect(add).not.toHaveBeenCalled();

    await act(async () => {
      finishRemove();
      await Promise.resolve();
    });
    await waitFor(() => {
      expect(add).toHaveBeenCalledTimes(1);
    });

    expect(Math.max(...remove.mock.invocationCallOrder)).toBeLessThan(
      Math.min(...add.mock.invocationCallOrder),
    );
    expect(levelIds()).toContain(SECOND_ID);
  });

  it('#11 hỏng thì lùi cục bộ, tầng trở lại, không mở thêm bước hoàn tác', async () => {
    const { gateway, remove } = spiedGateway();
    const mounted = await mountSettled({ gateway });
    const before = stackReadings(storeGraph());
    const pastBefore = useStore.temporal.getState().pastStates.length;

    remove.mockImplementation(() => wireFailure(409, 'FLOOR_ID_AMBIGUOUS'));

    await act(async () => {
      mounted.result.current.onRemoveFloor(SECOND_ID);
      await Promise.resolve();
    });
    await waitFor(() => {
      expect(descriptionsOf(mounted.notifications)).toContain(FLOOR_MANAGER_TEXT.idAmbiguous);
    });

    expect(stackReadings(storeGraph())).toEqual(before);
    expect(mounted.result.current.historyStepCount()).toBe(0);
    /* Chỉ lượt xoá cục bộ mở một bước zundo; lượt lùi thì không. */
    expect(useStore.temporal.getState().pastStates.length).toBe(pastBefore + 1);
  });

  it('#11 hỏng rồi bấm vé (lịch sử đã rỗng) thì vé nói ra, không im lặng', async () => {
    const { gateway, remove } = spiedGateway();
    const mounted = await mountSettled({ gateway });

    remove.mockImplementation(() => wireFailure(409, 'FLOOR_ID_AMBIGUOUS'));

    await act(async () => {
      mounted.result.current.onRemoveFloor(SECOND_ID);
      await Promise.resolve();
    });
    await waitFor(() => {
      expect(descriptionsOf(mounted.notifications)).toContain(FLOOR_MANAGER_TEXT.idAmbiguous);
    });

    expect(mounted.result.current.historyStepCount()).toBe(0);

    const ticket = mounted.notifications.list().find((entry) => entry.undoTicket !== undefined)
      ?.undoTicket;

    ticket?.undo();
    await sleep();

    expect(descriptionsOf(mounted.notifications)).toContain(FLOOR_MANAGER_TEXT.undoNotLatest);
  });
});

describe('tên tầng', () => {
  it('tên chứa U+202E thì KHÔNG PATCH, và nói ra cả toast lẫn aria-live', async () => {
    const { gateway, patch } = spiedGateway();
    const mounted = await mountSettled({ gateway });
    const before = stackReadings(storeGraph());

    await commitField(mounted, ROOF_ID, 'name', 'Mái‮mới');
    await sleep();

    const sentence = 'tên tầng có ký tự điều khiển hoặc ký tự đảo chiều chữ, hãy xoá chúng đi.';

    expect(patch).not.toHaveBeenCalled();
    expect(stackReadings(storeGraph())).toEqual(before);
    expect(descriptionsOf(mounted.notifications)).toContain(sentence);
    expect(mounted.spoken).toContain(sentence);
  });
});
