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
import { afterEach, describe, expect, it, vi } from 'vitest';

import { normalizeSpatial, type NormalizedSpatial } from '@/domain/spatial/normalize';
import type { Level, LevelId } from '@/domain/spatial/types';
import { metres, metresToMillimetres } from '@/domain/units/types';
import { formatLength } from '@/lib/format/measure';
import type { Announcer } from '@/lib/input/announcer';
import { createShortcutRegistry, type ShortcutRegistry } from '@/lib/input/shortcutRegistry';
import { createNotificationBus, type NotificationBus } from '@/lib/mutations/notificationBus';
import { createTestQueryClient } from '@/lib/testing/render';
import { resetSelectorCaches } from '@/store/selectors';
import { useStore } from '@/store';

import {
  createFloorManagerSampleGraph,
  createMockFloorManagerGateway,
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
import { useFloorManager, type UseFloorManagerOptions } from './useFloorManager';

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
