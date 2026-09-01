/**
 * Cổng dữ liệu và tầng lệnh của màn S-16 "Quản lý tầng" — mọi lời gọi ra khỏi
 * màn đi qua đây.
 *
 * Cùng khuôn `axisGridManagerGateway.ts` (S-15, màn vừa qua toàn bộ cổng kiểm):
 * một danh sách khả năng, một bản kê nợ endpoint, một `interface` cho hình dạng
 * cổng, một factory dựng cổng thật và một factory dựng cổng có dữ liệu cho test
 * và story (R-73).
 *
 * ## Ba lệnh tầng dựng TRONG cổng — quyết định của điều phối viên
 *
 * `src/lib/commands/business/roomFloorCommands.ts` chỉ có
 * `level.changeElevation` và `level.reorder`; KHÔNG có lệnh thêm / nhân bản /
 * xoá tầng, và R-68 cấm thêm file vào `src/lib` trong lúc dựng màn. Ba việc đó
 * vì vậy GHÉP tại đây bằng nguyên thuỷ công khai `createCommand` +
 * `changeForAdd`/`changeForRemove`/`changeForUpdate`, đúng tiền lệ
 * `axis.add`/`axis.remove`/`axis.move` của S-15. Hợp lệ vì `CommandType` là
 * `string` MỞ và `validateCommands` chỉ đòi `command.type` khác rỗng
 * (`dispatch.ts:249`); thứ DUY NHẤT bị so bảng là `change.kind`, mà `'level'`
 * đã là một `EntityKind` có sẵn (`src/domain/spatial/ids.ts:15-23`).
 *
 * Không một dòng mã hoàn tác nào được viết ở đây: `changeFor*` mang ĐỦ ảnh chụp
 * `before`/`after` (không phải diff) và `invertCommand` chỉ hoán đổi hai ảnh đó
 * rồi phát lại ngược thứ tự (`src/lib/commands/invert.ts:3-5,43-47`) — nó KHÔNG
 * hề nhìn `command.type`. Mọi lệnh dựng ở đây vì thế tự `Ctrl+Z` được.
 *
 * ## Không công thức nghiệp vụ mới
 *
 * - Cao độ khi xếp lại chồng tầng: `createReorderLevelsCommand` (hàm `restack`
 *   private bên trong nó dồn cao độ từ `building.datumElevationMm`). Cổng và
 *   màn KHÔNG cộng cao độ.
 * - Đỉnh của một tầng: `ceilingElevationMm` (M-11, `alignFloors.ts:451`).
 * - Sao chép nội dung tầng: `copyFloor` (`copyFloor.ts:230`) lo TOÀN BỘ; cổng
 *   chỉ gói kết quả vào `changeForAdd`.
 * - Đọc đối tượng theo tầng: `idsOnLevel` + `isEntityOfKind` (D-12). Không nơi
 *   nào duyệt tay cả đồ thị.
 * - Chặn cao độ: `validateChangeLevelElevation` chạy TRƯỚC và câu chữ của nó
 *   được dùng NGUYÊN VĂN; cổng chỉ bổ sung đúng MỘT phép so bằng `elevationMm`
 *   với các tầng còn lại (xem {@link findElevationConflict}).
 *
 * ## Đổi chiều cao tầng = HAI lệnh trong MỘT bước lịch sử
 *
 * `ROOM_FLOOR_COMMAND_TYPES` không có `level.changeHeight`.
 * {@link createChangeFloorHeightCommands} ghép hai bước:
 *
 * 1. `level.changeHeight` — `changeForUpdate('level', before, after)` với
 *    `after.heightMm` là giá trị mới.
 * 2. `createReorderLevelsCommand` với THỨ TỰ KHÔNG ĐỔI, dựng trên context ĐÃ áp
 *    bước 1 (`commandToPatches` + `applyPatch`, hai hàm công khai) — `restack`
 *    đọc `context.graph`, nên bước 2 phải THẤY chiều cao mới, nếu không cao độ
 *    các tầng phía trên sẽ ra sai.
 *
 * Hai lệnh chạy qua `runTransaction` (`src/lib/commands/transaction.ts:53`):
 * một `UndoEntry`, một lượt rule, một lượt sync — tức ĐÚNG MỘT lần `Ctrl+Z`.
 *
 * ## Hai việc chưa có đường (bản kê nợ)
 *
 * - `hideFloorFrom3d` — **NOT FOUND**. `interface Level`
 *   (`src/domain/spatial/types.ts:104-117`) chỉ có
 *   `id · name · order · elevationMm · heightMm · areaM2? · scaleMillimetresPerPixel?`,
 *   `FloorWriteBody` (`src/api/client.ts:87-92`) cũng không mang trường nào ghi
 *   trạng thái ẩn, và R-68 cấm thêm trường vào `src/domain`. Cờ ẩn vì vậy sống
 *   trong phiên làm việc của màn (cùng loại với `ghostEnabled` của
 *   `AxisGridManager`) và cổng NÓI RA sự thật đó bằng một nhánh có kiểu.
 * - `persistFloorContents` — **NOT FOUND**. `ENDPOINTS` không có đường nào ghi
 *   tường / ô mở / phòng / nội thất của một tầng lên máy chủ.
 *
 * BỐN việc còn lại KHÁC hẳn tiền lệ trục: `ENDPOINTS.floors` có
 * `create` · `delete(floorId)` · `list` · `reorder` THẬT (`src/api/endpoints.ts:42-47`)
 * và `ENDPOINTS.spatial.floor` nhận `Partial<FloorWriteBody>` — nên cổng này
 * KHÔNG mang nhánh `supported: false` cho thêm / xoá / sắp xếp / sửa trường tầng.
 */

import {
  ceilingElevationMm,
  MIN_CLEAR_HEIGHT_MM,
  type FloorPlan,
} from '@/domain/axes/alignFloors';
import { copyFloor, type CopyFloorResult, type FloorContents } from '@/domain/axes/copyFloor';
import { applyPatch } from '@/domain/spatial/applyPatch';
import { SAMPLE_TOTAL_AREA_M2 } from '@/domain/spatial/__fixtures__/sampleBuilding';
import { createId } from '@/domain/spatial/ids';
import {
  idsOnLevel,
  isEntityOfKind,
  normalizeSpatial,
  type NormalizedSpatial,
  type SpatialEntity,
} from '@/domain/spatial/normalize';
import type {
  Axis,
  Building,
  Dimension,
  Furniture,
  FurnitureId,
  Level,
  LevelId,
  Opening,
  Room,
  RoomId,
  Wall,
  WallId,
} from '@/domain/spatial/types';
import { millimetres, type Millimetres } from '@/domain/units/types';

import { createAppApiClient } from '@/api/appClient';
import type { ApiClient, ApiResult, FloorWriteBody } from '@/api/client';
import type { Floor } from '@/api/contracts';

import {
  accept,
  AUTHORED_BY_HAND,
  buildCommand,
  formatCount,
  formatElevationM,
  formatMetres,
  readOf,
  refuse,
  type CommandContext,
  type CommandResult,
} from '@/lib/commands/business/shared';
import {
  createChangeLevelElevationCommand,
  createReorderLevelsCommand,
  validateChangeLevelElevation,
  type ChangeLevelElevationInput,
} from '@/lib/commands/business/roomFloorCommands';
import {
  changeForAdd,
  changeForRemove,
  changeForUpdate,
} from '@/lib/commands/createCommand';
import {
  createIncrementalRuleRunner,
  dispatch,
  type DispatchDeps,
  type DispatchResult,
  type SpatialPort,
} from '@/lib/commands/dispatch';
import {
  createHistoryStack,
  NO_SELECTION,
  type HistoryStack,
  type SelectionSnapshot,
} from '@/lib/commands/history';
import { commandToPatches } from '@/lib/commands/invert';
import type { HttpError } from '@/lib/http/types';
import { runTransaction } from '@/lib/commands/transaction';
import type { Command, EntityChange } from '@/lib/commands/types';
import { formatLength } from '@/lib/format/measure';
import { formatNumber } from '@/lib/format/number';
import { createUndoTicket, UNDO_WINDOW_MS, type UndoTicket } from '@/lib/mutations/undoTicket';
import { commit } from '@/store/commit';
import { useStore } from '@/store';

import type { DuplicateElevationViolation } from './floorManagerTypes';

/* -------------------------------------------------------------------------- */
/* Khả năng — những gì màn hỏi thế giới bên ngoài.                             */
/* -------------------------------------------------------------------------- */

/** Tên máy đọc của từng việc màn cần. Mỗi việc chưa làm được có một dòng nợ. */
export const FLOOR_MANAGER_CAPABILITIES = [
  'readFloorList',
  'readFloorGraph',
  'writeFloorGraph',
  'readFloorQcProgress',
  'createFloor',
  'deleteFloor',
  'reorderFloors',
  'patchFloor',
  'duplicateFloor',
  'persistFloorContents',
  'hideFloorFrom3d',
] as const;

export type FloorManagerCapability = (typeof FLOOR_MANAGER_CAPABILITIES)[number];

/** Việc trong danh sách trên mà bản cài đặt THẬT chưa làm được. Chỉ được ngắn đi. */
export const FLOOR_MANAGER_MISSING_CAPABILITIES = [
  'persistFloorContents',
  'hideFloorFrom3d',
] as const;

export type FloorManagerMissingCapability =
  (typeof FLOOR_MANAGER_MISSING_CAPABILITIES)[number];

/** Endpoint còn thiếu của từng khả năng, viết nguyên văn cho người nối dây sau. */
export const FLOOR_MANAGER_MISSING_ENDPOINTS: Readonly<
  Record<FloorManagerMissingCapability, string>
> = {
  persistFloorContents:
    'Không endpoint nào của src/api ghi được tường/ô mở/phòng/nội thất của một tầng: ENDPOINTS chỉ có auth/drawings/featureFlags/floors/projects/quality/spatial (src/api/endpoints.ts:18-82), floors.create nhận FloorWriteBody (src/api/client.ts:87-92) chỉ mang name/order/elevationMm/heightMm/areaM2/drawings, và PATCH .../spatial nhận Partial<FloorWriteBody> — cùng bấy nhiêu trường. Nội dung tầng nhân bản, và nội dung mất đi khi xoá tầng, vì vậy chỉ sống trong đồ thị cục bộ',
  hideFloorFrom3d:
    'Trạng thái ẩn khỏi mô hình 3D không có chỗ ghi ở BẤT KỲ tầng nào: interface Level (src/domain/spatial/types.ts:104-117) chỉ có id/name/order/elevationMm/heightMm/areaM2?/scaleMillimetresPerPixel?, SpatialPatch không phủ trường nào khác, FloorWriteBody cũng không mang nó, và R-68 cấm thêm trường vào src/domain. Cờ ẩn chỉ sống trong phiên làm việc hiện tại và mất sau một lần tải lại trang',
};

/**
 * Câu NÓI RA sự thật cho NGƯỜI DÙNG, một câu cho mỗi khoản nợ.
 *
 * Khác {@link FLOOR_MANAGER_MISSING_ENDPOINTS}: câu ở trên viết cho người nối
 * dây sau, câu ở đây là thứ người dùng nghe được, và không câu nào hứa một lượt
 * lưu đã xong.
 */
export const FLOOR_MANAGER_UNSUPPORTED_NOTICES: Readonly<
  Record<FloorManagerMissingCapability, string>
> = {
  persistFloorContents:
    'nội dung tầng (tường, phòng, nội thất) mới chỉ đổi trong phiên làm việc này; hệ thống chưa có chỗ lưu nó nên nó mất sau khi tải lại trang.',
  hideFloorFrom3d:
    'ẩn tầng khỏi mô hình 3d chỉ có hiệu lực trong phiên làm việc này; hệ thống chưa có chỗ lưu lựa chọn đó nên nó mất sau khi tải lại trang.',
};

/** Một khả năng chưa tồn tại. `supported: false` là câu trả lời thật, không phải lỗi. */
export interface FloorManagerUnsupported {
  readonly supported: false;
  readonly capability: FloorManagerMissingCapability;
  /** Lấy nguyên từ {@link FLOOR_MANAGER_MISSING_ENDPOINTS} — câu cho người nối dây. */
  readonly missing: string;
  /** Lấy nguyên từ {@link FLOOR_MANAGER_UNSUPPORTED_NOTICES} — câu cho người dùng. */
  readonly notice: string;
}

export interface FloorManagerSupported<TValue> {
  readonly supported: true;
  readonly value: TValue;
}

export type FloorManagerCapabilityResult<TValue> =
  | FloorManagerSupported<TValue>
  | FloorManagerUnsupported;

/** Dựng nhánh "chưa có đường làm việc này" — một chỗ duy nhất ghép tên với nợ. */
export function unsupportedFloorCapability(
  capability: FloorManagerMissingCapability,
): FloorManagerUnsupported {
  return {
    supported: false,
    capability,
    missing: FLOOR_MANAGER_MISSING_ENDPOINTS[capability],
    notice: FLOOR_MANAGER_UNSUPPORTED_NOTICES[capability],
  };
}

/* -------------------------------------------------------------------------- */
/* Đọc đồ thị — mọi phép đọc theo tầng đi qua `idsOnLevel` (D-12).             */
/* -------------------------------------------------------------------------- */

const NO_LEVELS: readonly Level[] = Object.freeze([]);

/** Mọi tầng của đồ thị, TỪ DƯỚI LÊN — đúng thứ tự `ReorderLevelsInput.levelIds`. */
export function levelsOf(graph: NormalizedSpatial | null): readonly Level[] {
  if (graph === null) {
    return NO_LEVELS;
  }

  const levels: Level[] = [];

  for (const id of graph.byKind.level) {
    const entity = graph.byId[id];

    if (entity !== undefined && isEntityOfKind('level', entity)) {
      levels.push(entity);
    }
  }

  return levels.sort((left, right) => left.order - right.order);
}

/** Một tầng theo mã, hoặc `null`. */
export function levelOf(graph: NormalizedSpatial | null, levelId: string | null): Level | null {
  if (graph === null || levelId === null) {
    return null;
  }

  const entity = graph.byId[levelId];

  return entity !== undefined && isEntityOfKind('level', entity) ? entity : null;
}

/** Mọi thực thể đứng trên một tầng, đọc qua `idsOnLevel` — không duyệt cả đồ thị. */
export function entitiesOnLevel(
  graph: NormalizedSpatial | null,
  levelId: LevelId,
): readonly SpatialEntity[] {
  if (graph === null) {
    return [];
  }

  const entities: SpatialEntity[] = [];

  for (const id of idsOnLevel(graph, levelId)) {
    const entity = graph.byId[id];

    if (entity !== undefined) {
      entities.push(entity);
    }
  }

  return entities;
}

/** Đếm tường của một tầng. Bộ lọc là `isEntityOfKind` (D-12), không phải chuỗi id tự đọc. */
export function wallCountOfLevel(graph: NormalizedSpatial | null, levelId: LevelId): number {
  return entitiesOnLevel(graph, levelId).filter((entity) => isEntityOfKind('wall', entity)).length;
}

/** Phòng của một tầng. */
export function roomsOfLevel(graph: NormalizedSpatial | null, levelId: LevelId): readonly Room[] {
  const rooms: Room[] = [];

  for (const entity of entitiesOnLevel(graph, levelId)) {
    if (isEntityOfKind('room', entity)) {
      rooms.push(entity);
    }
  }

  return rooms;
}

/**
 * Diện tích sàn của một tầng, mét vuông.
 *
 * Cộng thẳng `Room.areaM2` — không có hàm domain nào cộng sẵn diện tích theo
 * tầng, và tiền lệ trong repo là chính phép cộng này
 * (`src/domain/rooms/detect.ts:459`). Không tính lại hình học, không quy đổi
 * đơn vị: `Room.areaM2` đã là m².
 */
export function areaOfLevel(graph: NormalizedSpatial | null, levelId: LevelId): number {
  return roomsOfLevel(graph, levelId).reduce((total, room) => total + room.areaM2, 0);
}

/**
 * Tầng ở dạng `FloorPlan` của M-11, để gọi `ceilingElevationMm` / `alignFloors`.
 *
 * `clearHeightMm` nhận `Level.heightMm`: `ceilingElevationMm` cộng đúng nó vào
 * cao độ sàn để ra ĐỈNH của tầng — thứ màn cần để biết ngăn xếp cao tới đâu, và
 * là lý do màn không phải tự cộng một lần nào.
 */
export function floorPlanOf(graph: NormalizedSpatial | null, level: Level): FloorPlan {
  const axes: Axis[] = [];

  for (const entity of entitiesOnLevel(graph, level.id)) {
    if (isEntityOfKind('axis', entity)) {
      axes.push(entity);
    }
  }

  return {
    levelId: level.id,
    name: level.name,
    floorElevationMm: millimetres(level.elevationMm),
    clearHeightMm: millimetres(level.heightMm),
    axes: axes.map((axis) => ({
      direction: axis.direction,
      coordinateMm: millimetres(
        axis.direction === 'vertical' ? axis.line.start.x : axis.line.start.y,
      ),
      startMm: millimetres(axis.direction === 'vertical' ? axis.line.start.y : axis.line.start.x),
      endMm: millimetres(axis.direction === 'vertical' ? axis.line.end.y : axis.line.end.x),
      spreadMm: millimetres(0),
      wallIds: [],
    })),
  };
}

/** Mọi tầng ở dạng `FloorPlan`, từ dưới lên. */
export function floorPlansOf(graph: NormalizedSpatial | null): readonly FloorPlan[] {
  return levelsOf(graph).map((level) => floorPlanOf(graph, level));
}

/** Nội dung một tầng, đúng hình dạng `copyFloor` nhận. */
export function floorContentsOf(
  graph: NormalizedSpatial | null,
  levelId: LevelId,
): FloorContents {
  const walls: Wall[] = [];
  const openings: Opening[] = [];
  const rooms: Room[] = [];
  const furniture: Furniture[] = [];
  const axes: Axis[] = [];
  const dimensions: Dimension[] = [];

  for (const entity of entitiesOnLevel(graph, levelId)) {
    if (isEntityOfKind('wall', entity)) {
      walls.push(entity);
    } else if (isEntityOfKind('opening', entity)) {
      openings.push(entity);
    } else if (isEntityOfKind('room', entity)) {
      rooms.push(entity);
    } else if (isEntityOfKind('furniture', entity)) {
      furniture.push(entity);
    } else if (isEntityOfKind('axis', entity)) {
      axes.push(entity);
    } else if (isEntityOfKind('dimension', entity)) {
      dimensions.push(entity);
    }
  }

  return { levelId, walls, openings, rooms, furniture, axes, dimensions };
}

/**
 * Đỉnh của cả ngăn xếp, milimét — `ceilingElevationMm` của tầng cao nhất.
 *
 * Màn KHÔNG cộng cao độ: phép cộng `floorElevationMm + clearHeightMm` nằm trong
 * M-11 (`alignFloors.ts:451-453`); ở đây chỉ chọn giá trị lớn nhất.
 */
export function stackTopMm(graph: NormalizedSpatial | null): Millimetres | null {
  let top: number | null = null;

  for (const plan of floorPlansOf(graph)) {
    const ceiling = ceilingElevationMm(plan);

    top = top === null || ceiling > top ? ceiling : top;
  }

  return top === null ? null : millimetres(top);
}

/** Đáy của cả ngăn xếp, milimét — cao độ thấp nhất trong các tầng. */
export function stackBottomMm(graph: NormalizedSpatial | null): Millimetres | null {
  let bottom: number | null = null;

  for (const level of levelsOf(graph)) {
    bottom = bottom === null || level.elevationMm < bottom ? level.elevationMm : bottom;
  }

  return bottom === null ? null : millimetres(bottom);
}

/* -------------------------------------------------------------------------- */
/* Chặn cao độ — QĐ-3: dùng lại phần đã có, thêm ĐÚNG một phép so bằng.        */
/* -------------------------------------------------------------------------- */

/** Cao độ đã định dạng, đúng khuôn `FloorRowVm.elevationText` (A15). */
export const elevationText = (valueMm: number): string =>
  formatLength(valueMm, { unit: 'm', fractionDigits: 1 });

/** Một lượt đặt cao độ bị từ chối: câu của domain, cộng hai cái tên có cấu trúc. */
export interface ElevationConflict {
  /** Câu tiếng Việt, NGUYÊN VĂN của `validateChangeLevelElevation` khi nó lên tiếng. */
  readonly reasons: readonly string[];
  readonly violation: DuplicateElevationViolation;
}

/**
 * Cao độ mới có đụng tầng nào không — `null` khi đặt được.
 *
 * Hai bước, đúng QĐ-3 của điều phối viên:
 *
 * 1. `validateChangeLevelElevation` chạy TRƯỚC. Nó đã chặn chồng lấn với hai
 *    tầng LIỀN KỀ và câu của nó đã nêu tên CẢ HAI tầng — câu đó được dùng
 *    NGUYÊN VĂN, không viết bản thứ hai. Tên tầng thứ hai lấy ra bằng cách xem
 *    tên hàng xóm nào ĐƯỢC NHẮC trong chính câu đó, chứ không tính lại phép so
 *    của domain.
 * 2. Bổ sung đúng MỘT phép so bằng `elevationMm` với các tầng CÒN LẠI. Đây là
 *    lỗ hổng thật: bước 1 chỉ nhìn hai hàng xóm theo `Level.order`, nên một ngăn
 *    xếp có `order` không khớp thứ tự cao độ vẫn để lọt hai tầng trùng nhau. So
 *    hai số nguyên milimét bằng nhau: KHÔNG làm tròn, KHÔNG đổi đơn vị, KHÔNG
 *    dung sai tự đặt.
 */
export function findElevationConflict(
  input: ChangeLevelElevationInput,
  context: CommandContext,
): ElevationConflict | null {
  const level = readOf(context.graph, 'level', input.levelId);

  if (level === null) {
    return null;
  }

  /* Đặt lại đúng giá trị cũ không phải lỗi — không có gì để làm, và không có gì để nói. */
  if (level.elevationMm === input.elevationMm) {
    return null;
  }

  const stack = levelsOf(context.graph);
  const position = stack.findIndex((candidate) => candidate.id === level.id);
  const neighbours = [stack[position - 1], stack[position + 1]];
  const reasons = validateChangeLevelElevation(input, context);

  if (reasons.length > 0) {
    const named = neighbours.find(
      (neighbour) =>
        neighbour !== undefined && reasons.some((reason) => reason.includes(`"${neighbour.name}"`)),
    );

    /*
     * CẤM TUYỆT ĐỐI đòi câu chặn nêu RÕ HAI TẦNG NÀO. Nhánh "tầng ngay trên" của
     * `validateChangeLevelElevation` (`roomFloorCommands.ts:594-600`) nêu cả hai
     * tên; nhánh "tầng ngay dưới" (dòng 586-591) chỉ nêu tên tầng dưới. Bản
     * thiết kế T4 nói cả hai nhánh đều gọi tên hai tầng — đã kiểm tận nơi và
     * KHÔNG đúng cho nhánh dưới.
     *
     * Câu của domain giữ NGUYÊN VĂN; chỉ thêm một câu dẫn phía trước, đúng giọng
     * văn đó, nói tầng nào đang bị đặt lại — không sửa, không viết lại câu nào.
     */
    const mentionsSubject = reasons.some((reason) => reason.includes(`"${level.name}"`));

    return {
      reasons: mentionsSubject
        ? reasons
        : [
            `Không đặt được cao độ ${formatElevationM(input.elevationMm)} cho tầng "${level.name}".`,
            ...reasons,
          ],
      violation: {
        firstFloorName: level.name,
        secondFloorName: named?.name ?? level.name,
        elevationText: elevationText(input.elevationMm),
      },
    };
  }

  const twin = stack.find(
    (candidate) => candidate.id !== level.id && candidate.elevationMm === input.elevationMm,
  );

  if (twin === undefined) {
    return null;
  }

  return {
    reasons: [
      `Tầng "${twin.name}" đã ở cao độ ${formatElevationM(twin.elevationMm)}; ` +
        `đặt tầng "${level.name}" ở đúng cao độ đó thì hai tầng trùng nhau.`,
    ],
    violation: {
      firstFloorName: level.name,
      secondFloorName: twin.name,
      elevationText: elevationText(input.elevationMm),
    },
  };
}

/* -------------------------------------------------------------------------- */
/* Tầng lệnh — ba lệnh còn thiếu, dựng bằng nguyên thuỷ công khai.             */
/* -------------------------------------------------------------------------- */

/**
 * Loại của từng lệnh tầng dựng tại màn.
 *
 * Giữ đúng khuôn `roomFloorCommands.ts` (`level.<việc>`) để sau này nhấc nguyên
 * khối lên `src/lib` mà không màn nào phải sửa. Hằng đặt tên ở đây là chỗ DUY
 * NHẤT các chuỗi đó được viết (R-71).
 */
export const FLOOR_COMMAND_TYPES = {
  add: 'level.add',
  duplicate: 'level.duplicate',
  remove: 'level.delete',
  rename: 'level.rename',
  changeHeight: 'level.changeHeight',
} as const;

export type FloorCommandType = (typeof FLOOR_COMMAND_TYPES)[keyof typeof FLOOR_COMMAND_TYPES];

/** Câu mô tả trên nhật ký hoạt động — `validateCommands` đòi nó khác rỗng. */
export const addFloorDescription = (name: string, elevationMm: number): string =>
  `Thêm tầng "${name}" ở cao độ ${formatElevationM(elevationMm)}.`;

export const duplicateFloorDescription = (
  sourceName: string,
  name: string,
  copiedCount: number,
): string =>
  `Nhân bản tầng "${sourceName}" thành "${name}", kèm ${formatCount(copiedCount)} đối tượng.`;

export const removeFloorDescription = (name: string, entityCount: number): string =>
  `Xoá tầng "${name}" và ${formatCount(entityCount)} đối tượng trên nó.`;

export const renameFloorDescription = (before: string, after: string): string =>
  `Đổi tên tầng "${before}" thành "${after}".`;

export const changeFloorHeightDescription = (
  name: string,
  beforeMm: number,
  afterMm: number,
): string =>
  `Đổi chiều cao tầng "${name}" từ ${formatMetres(beforeMm)} sang ${formatMetres(afterMm)}.`;

/** Câu trên toast hoàn tác sau khi xoá một tầng. */
export const removeFloorToastDescription = (name: string): string => `Đã xoá tầng ${name}.`;

/** Câu trên toast hoàn tác sau khi nhân bản một tầng. */
export const duplicateFloorToastDescription = (name: string): string =>
  `Đã nhân bản tầng ${name}.`;

/** Câu trên toast hoàn tác sau khi đổi thứ tự ngăn xếp. */
export const REORDER_FLOORS_TOAST_DESCRIPTION = 'Đã đổi thứ tự tầng.';

export interface CreateLevelEntityInput {
  readonly id: LevelId;
  readonly name: string;
  readonly order: number;
  readonly elevationMm: number;
  readonly heightMm: number;
}

/**
 * Một tầng mới của đồ thị.
 *
 * A5: `AUTHORED_BY_HAND` (`business/shared.ts:124`) đặt `reviewed: false` và
 * `source: 'human'` — người dùng vừa thêm nó bằng tay, nhưng chưa ai duyệt, nên
 * cờ xanh "đã xác minh" vẫn tắt. Không tham số nào cho phép nơi gọi bật cờ đó.
 */
export function createLevelEntity(input: CreateLevelEntityInput): Level {
  return {
    ...AUTHORED_BY_HAND,
    id: input.id,
    name: input.name,
    order: input.order,
    elevationMm: input.elevationMm,
    heightMm: input.heightMm,
  };
}

/**
 * Chiều cao mặc định của một tầng mới.
 *
 * KHÔNG phải một con số mới: lấy chiều cao của tầng trên cùng đang có, vì tầng
 * mới ngồi lên chính nó; toà nhà chưa có tầng nào thì lấy `MIN_CLEAR_HEIGHT_MM`
 * (2400 mm, `alignFloors.ts:70`) — hằng của domain, không phải hằng thô của màn
 * (R-71).
 */
export function defaultNewFloorHeightMm(graph: NormalizedSpatial | null): number {
  const stack = levelsOf(graph);

  return stack[stack.length - 1]?.heightMm ?? MIN_CLEAR_HEIGHT_MM;
}

/**
 * Cao độ của một tầng đặt lên đỉnh ngăn xếp.
 *
 * `stackTopMm` gọi `ceilingElevationMm` (M-11); toà nhà chưa có tầng nào thì mốc
 * là `building.datumElevationMm` — đúng chỗ `restack` bắt đầu.
 */
export function nextFloorElevationMm(graph: NormalizedSpatial | null, building: Building): number {
  return stackTopMm(graph) ?? building.datumElevationMm;
}

export interface AddFloorInput {
  readonly id: LevelId;
  readonly name: string;
}

/** Thêm một tầng rỗng lên đỉnh ngăn xếp. */
export function createAddFloorCommand(
  input: AddFloorInput,
  context: CommandContext,
): CommandResult {
  const stack = levelsOf(context.graph);
  const level = createLevelEntity({
    id: input.id,
    name: input.name,
    order: stack.length,
    elevationMm: nextFloorElevationMm(context.graph, context.graph.building),
    heightMm: defaultNewFloorHeightMm(context.graph),
  });

  return accept(
    buildCommand(
      FLOOR_COMMAND_TYPES.add,
      addFloorDescription(level.name, level.elevationMm),
      [changeForAdd('level', level)],
      context,
    ),
  );
}

export interface DuplicateFloorInput {
  readonly sourceLevelId: LevelId;
  readonly targetLevelId: LevelId;
  readonly name: string;
  /** Hộp chọn "sao chép nội thất" đứng cạnh mục nhân bản. */
  readonly copyFurniture: boolean;
}

/**
 * Nhân bản một tầng lên đỉnh ngăn xếp.
 *
 * `copyFloor` (`copyFloor.ts:230`) lo TOÀN BỘ phần sao chép: đánh id mới, viết
 * lại tham chiếu, bỏ những thứ mất tham chiếu. Cổng chỉ gói kết quả vào
 * `changeForAdd`. `includeFurniture` là cờ của chính hộp chọn "sao chép nội
 * thất"; bốn cờ `include*` còn lại giữ mặc định `true`.
 *
 * Tầng mới đặt lên ĐỈNH ngăn xếp, không chèn ngay trên tầng gốc: chèn giữa sẽ
 * đẩy cao độ mọi tầng phía trên, mà dời cao độ là việc của
 * `createReorderLevelsCommand` chứ không phải của một lượt nhân bản.
 */
export function createDuplicateFloorCommand(
  input: DuplicateFloorInput,
  context: CommandContext,
): CommandResult {
  const source = readOf(context.graph, 'level', input.sourceLevelId);

  if (source === null) {
    return refuse(FLOOR_COMMAND_TYPES.duplicate, [
      `Không tìm thấy tầng ${input.sourceLevelId} trong bản vẽ.`,
    ]);
  }

  const stack = levelsOf(context.graph);
  const level = createLevelEntity({
    id: input.targetLevelId,
    name: input.name,
    order: stack.length,
    elevationMm: nextFloorElevationMm(context.graph, context.graph.building),
    heightMm: source.heightMm,
  });

  const copied: CopyFloorResult = copyFloor(
    floorContentsOf(context.graph, source.id),
    input.targetLevelId,
    {
      includeFurniture: input.copyFurniture,
      reservedIds: Object.keys(context.graph.byId),
    },
  );

  const changes: EntityChange[] = [changeForAdd('level', level)];

  for (const wall of copied.contents.walls) {
    changes.push(changeForAdd('wall', wall));
  }

  for (const opening of copied.contents.openings) {
    changes.push(changeForAdd('opening', opening));
  }

  for (const room of copied.contents.rooms) {
    changes.push(changeForAdd('room', room));
  }

  for (const item of copied.contents.furniture) {
    changes.push(changeForAdd('furniture', item));
  }

  for (const axis of copied.contents.axes) {
    changes.push(changeForAdd('axis', axis));
  }

  for (const dimension of copied.contents.dimensions) {
    changes.push(changeForAdd('dimension', dimension));
  }

  return accept(
    buildCommand(
      FLOOR_COMMAND_TYPES.duplicate,
      duplicateFloorDescription(source.name, level.name, copied.copiedCount),
      changes,
      context,
    ),
  );
}

export interface RemoveFloorInput {
  readonly levelId: LevelId;
}

/**
 * Xoá một tầng và mọi đối tượng đứng trên nó.
 *
 * Danh sách đối tượng đọc bằng `idsOnLevel` (D-12) — không duyệt tay cả đồ thị.
 * Mỗi `changeForRemove` mang ảnh chụp `before` đầy đủ, nên `invertCommand` dựng
 * lại được cả tầng lẫn nội dung của nó trong đúng một lần `Ctrl+Z`.
 */
export function createRemoveFloorCommand(
  input: RemoveFloorInput,
  context: CommandContext,
): CommandResult {
  const level = readOf(context.graph, 'level', input.levelId);

  if (level === null) {
    return refuse(FLOOR_COMMAND_TYPES.remove, [
      `Không tìm thấy tầng ${input.levelId} trong bản vẽ.`,
    ]);
  }

  const contents = floorContentsOf(context.graph, level.id);
  const changes: EntityChange[] = [];

  for (const dimension of contents.dimensions) {
    changes.push(changeForRemove('dimension', dimension));
  }

  for (const item of contents.furniture) {
    changes.push(changeForRemove('furniture', item));
  }

  for (const room of contents.rooms) {
    changes.push(changeForRemove('room', room));
  }

  for (const opening of contents.openings) {
    changes.push(changeForRemove('opening', opening));
  }

  for (const wall of contents.walls) {
    changes.push(changeForRemove('wall', wall));
  }

  for (const axis of contents.axes) {
    changes.push(changeForRemove('axis', axis));
  }

  changes.push(changeForRemove('level', level));

  return accept(
    buildCommand(
      FLOOR_COMMAND_TYPES.remove,
      removeFloorDescription(level.name, changes.length - 1),
      changes,
      context,
    ),
  );
}

export interface RenameFloorInput {
  readonly levelId: LevelId;
  readonly name: string;
}

/**
 * Đổi tên một tầng.
 *
 * `roomFloorCommands.ts` không có `level.rename`, nên lệnh dựng tại đây bằng
 * `changeForUpdate` — ảnh chụp `before`/`after` đầy đủ, và `invertCommand` chỉ
 * hoán đổi hai ảnh đó (`invert.ts:3-5`), nên `Ctrl+Z` chạy mà không một dòng mã
 * hoàn tác nào được viết. Bản thiết kế T4 nói lệnh này "không tự hoàn tác được"
 * — điều phối viên đã kiểm và ĐÍNH CHÍNH: `invertCommand` không hề nhìn
 * `command.type`.
 */
export function createRenameFloorCommand(
  input: RenameFloorInput,
  context: CommandContext,
): CommandResult {
  const level = readOf(context.graph, 'level', input.levelId);

  if (level === null) {
    return refuse(FLOOR_COMMAND_TYPES.rename, [
      `Không tìm thấy tầng ${input.levelId} trong bản vẽ.`,
    ]);
  }

  const name = input.name.trim();

  if (name === '') {
    return refuse(FLOOR_COMMAND_TYPES.rename, ['Tên tầng không được để trống.']);
  }

  if (name === level.name) {
    return refuse(FLOOR_COMMAND_TYPES.rename, [
      `Tầng "${level.name}" đã mang đúng tên đó nên không có gì thay đổi.`,
    ]);
  }

  return accept(
    buildCommand(
      FLOOR_COMMAND_TYPES.rename,
      renameFloorDescription(level.name, name),
      [changeForUpdate('level', level, { ...level, name })],
      context,
    ),
  );
}

/** Kết quả của một hàm dựng NHIỀU lệnh cho cùng một thao tác. */
export type FloorCommandsResult =
  | { readonly ok: true; readonly commands: readonly Command[] }
  | { readonly ok: false; readonly reasons: readonly string[] };

export interface ChangeFloorHeightInput {
  readonly levelId: LevelId;
  readonly heightMm: number;
}

/**
 * Đổi chiều cao một tầng — HAI lệnh, MỘT bước lịch sử (QĐ-2).
 *
 * Bước 2 dựng trên context ĐÃ áp bước 1: `commandToPatches` + `applyPatch` là
 * hai hàm công khai, và đó là cách duy nhất để `restack` bên trong
 * `createReorderLevelsCommand` THẤY chiều cao mới. Dựng cả hai lệnh trên cùng
 * một context cũ sẽ cho cao độ sai.
 *
 * Trả về MẢNG lệnh để nơi gọi chạy chúng bằng {@link runFloorTransaction} —
 * một `UndoEntry`, một lần `Ctrl+Z`.
 */
export function createChangeFloorHeightCommands(
  input: ChangeFloorHeightInput,
  context: CommandContext,
): FloorCommandsResult {
  const level = readOf(context.graph, 'level', input.levelId);

  if (level === null) {
    return { ok: false, reasons: [`Không tìm thấy tầng ${input.levelId} trong bản vẽ.`] };
  }

  if (level.heightMm === input.heightMm) {
    return { ok: false, reasons: [] };
  }

  const height = buildCommand(
    FLOOR_COMMAND_TYPES.changeHeight,
    changeFloorHeightDescription(level.name, level.heightMm, input.heightMm),
    [changeForUpdate('level', level, { ...level, heightMm: input.heightMm })],
    context,
  );

  const restacked: CommandContext = {
    ...context,
    graph: applyPatch(context.graph, commandToPatches(height)),
  };
  const reorder = createReorderLevelsCommand(
    { levelIds: levelsOf(restacked.graph).map((entry) => entry.id) },
    restacked,
  );

  /*
   * Đổi chiều cao tầng TRÊN CÙNG không dịch cao độ của ai cả, nên
   * `createReorderLevelsCommand` từ chối với "không có gì thay đổi" — lúc đó
   * một mình lệnh chiều cao là đủ, và nó vẫn là đúng một bước lịch sử.
   */
  return { ok: true, commands: reorder.ok ? [height, reorder.data] : [height] };
}

/* Xuất lại hai hàm của tầng lệnh để hook và bài kiểm đọc đúng một nguồn. */
export { createChangeLevelElevationCommand, createReorderLevelsCommand };

/* -------------------------------------------------------------------------- */
/* Đường ghi — `dispatch` chạy qua `commit` (A10).                             */
/* -------------------------------------------------------------------------- */

/** Cửa đọc đồ thị đang sửa. Mặc định là kho; test cắm một đồ thị cố định. */
export interface FloorManagerGraphPort {
  readonly read: () => NormalizedSpatial | null;
}

/**
 * Cổng ghi của `dispatch`, cài bằng `commit`.
 *
 * Không dòng nào gọi `set()` hay `_applyPatches()` (A10), và không dòng nào gọi
 * `CommitResult.undo` của zundo — hoàn tác của màn đi qua `HistoryStack` của S-06.
 */
export function createCommitSpatialPort(
  graph: FloorManagerGraphPort,
  labelOf: () => string,
): SpatialPort {
  return {
    read: () => graph.read(),
    applyPatches: (patches) => {
      commit(patches, labelOf());
    },
  };
}

/** Bộ phụ thuộc năm bước của `dispatch`, gắn với ngăn xếp hoàn tác 100 bước của S-06. */
export interface FloorManagerDispatchDeps {
  readonly deps: DispatchDeps;
  readonly history: HistoryStack;
  /** Nhãn của lượt dispatch đang chạy — `SpatialPort` đọc nó để đặt tên cho `commit`. */
  readonly setLabel: (label: string) => void;
}

export interface CreateFloorManagerDispatchOptions {
  readonly graph: FloorManagerGraphPort;
  readonly selectionBefore: () => SelectionSnapshot;
  readonly selectionAfter: () => SelectionSnapshot;
  /** Bước `sync` — đánh dấu bản vẽ bẩn cho tự lưu (A7). */
  readonly onSynced: () => void;
  readonly history?: HistoryStack;
}

/** Dựng `DispatchDeps` đầy đủ năm cổng — chép khuôn `createAxisGridDispatchDeps`. */
export function createFloorManagerDispatchDeps(
  options: CreateFloorManagerDispatchOptions,
): FloorManagerDispatchDeps {
  const history = options.history ?? createHistoryStack();
  let label = '';

  const deps: DispatchDeps = {
    spatial: createCommitSpatialPort(options.graph, () => label),
    history: {
      push: (entry) => {
        history.push({
          entry,
          selectionBefore: options.selectionBefore(),
          selectionAfter: options.selectionAfter(),
        });
      },
      drop: (entryId) => {
        history.drop(entryId);
      },
    },
    rules: createIncrementalRuleRunner(),
    sync: {
      enqueue: () => {
        options.onSynced();
      },
    },
  };

  return {
    deps,
    history,
    setLabel: (next) => {
      label = next;
    },
  };
}

/** Chạy một lệnh qua đủ năm bước. Nhãn của lượt là mô tả của chính lệnh. */
export async function runFloorCommand(
  command: Command,
  bundle: FloorManagerDispatchDeps,
): Promise<DispatchResult> {
  bundle.setLabel(command.description);

  return dispatch(command, bundle.deps);
}

/**
 * Chạy NHIỀU lệnh như MỘT bước lịch sử.
 *
 * `runTransaction` sinh đúng một `UndoEntry`, chạy rule một lần và xếp hàng sync
 * một lần (`transaction.ts:4-13`) — đây là chỗ hai bước của
 * {@link createChangeFloorHeightCommands} gộp thành một lần `Ctrl+Z`.
 */
export async function runFloorTransaction(
  commands: readonly Command[],
  bundle: FloorManagerDispatchDeps,
  label: string,
): Promise<DispatchResult> {
  bundle.setLabel(label);

  return runTransaction(commands, bundle.deps, { label });
}

/** Vùng chọn rỗng, cho lượt ghi không có gì được chọn trước đó. */
export const NO_FLOOR_SELECTION: SelectionSnapshot = NO_SELECTION;

/* -------------------------------------------------------------------------- */
/* Vé hoàn tác (A8) — toast có nút Hoàn tác, KHÔNG hộp thoại.                  */
/* -------------------------------------------------------------------------- */

/** Loại thông báo của lượt xoá tầng — nút "Hoàn tác" của toast đọc vé qua nó. */
export const FLOOR_REMOVE_NOTIFICATION_TYPE = 'floorManager.remove';

/** Loại thông báo của lượt nhân bản tầng. */
export const FLOOR_DUPLICATE_NOTIFICATION_TYPE = 'floorManager.duplicate';

/** Loại thông báo của lượt đổi thứ tự tầng. */
export const FLOOR_REORDER_NOTIFICATION_TYPE = 'floorManager.reorder';

/** Loại thông báo của một lượt ghi lên máy chủ KHÔNG thành công. */
export const FLOOR_PERSIST_FAILED_NOTIFICATION_TYPE = 'floorManager.persistFailed';

export interface CreateFloorUndoTicketOptions {
  readonly description: string;
  readonly undo: () => void;
  readonly now: () => number;
}

/**
 * Vé hoàn tác của một lượt ghi.
 *
 * `UNDO_WINDOW_MS` (8000 ms — đúng 8 giây đặc tả đòi) tới từ
 * `src/lib/mutations/undoTicket.ts`: con số không được viết lại ở màn (R-71), và
 * `createUndoTicket` dùng nó làm mặc định nên ở đây thậm chí không có tham số
 * nào mang nó. `undo` trỏ vào `history.undo()` của chính bộ dispatch (ngăn xếp
 * S-06), KHÔNG phải `CommitResult.undo` của zundo.
 */
export function createFloorUndoTicket(options: CreateFloorUndoTicketOptions): UndoTicket {
  return createUndoTicket({
    description: options.description,
    now: options.now,
    undo: options.undo,
  });
}

/** Cửa sổ hoàn tác, xuất lại để hook và bài kiểm đọc đúng một nguồn. */
export { UNDO_WINDOW_MS };

/* -------------------------------------------------------------------------- */
/* Cái seam.                                                                   */
/* -------------------------------------------------------------------------- */

export interface ReadFloorListInput {
  readonly projectId: string;
  readonly signal?: AbortSignal;
}

/**
 * Một lượt đọc của màn: danh sách tầng của máy chủ, cộng đồ thị đang sửa.
 *
 * Hai nửa vì hai câu hỏi khác nhau. `floors` tới từ `GET /floors` và là nơi DUY
 * NHẤT biết mỗi tầng có mấy bản vẽ (`Floor.drawings`); `graph` là đồ thị không
 * gian, nơi DUY NHẤT đếm được tường và phòng của một tầng. Một khoá `useQuery`
 * cho cả hai, nên màn có đúng một cờ đang-tải và đúng một cờ hỏng (R-64).
 */
export interface FloorManagerSnapshot {
  readonly floors: readonly Floor[];
  readonly graph: NormalizedSpatial | null;
}

export interface PersistAddFloorInput {
  readonly projectId: string;
  readonly level: Level;
}

export interface PersistRemoveFloorInput {
  readonly projectId: string;
  readonly floorId: string;
}

export interface PersistReorderFloorsInput {
  readonly projectId: string;
  readonly floorIds: readonly string[];
}

export interface PersistFloorFieldsInput {
  readonly projectId: string;
  readonly floorId: string;
  readonly body: Partial<FloorWriteBody>;
}

export interface PersistHiddenIn3dInput {
  readonly projectId: string;
  readonly floorId: string;
  readonly isHidden: boolean;
}

export interface PersistFloorContentsInput {
  readonly projectId: string;
  readonly floorId: string;
}

/** Mỗi phương thức là một việc màn cần từ bên ngoài, và không có việc nào khác. */
export interface FloorManagerGateway {
  /** Khả năng nào cổng này làm được, trả lời ĐỒNG BỘ — màn phải biết trước lượt vẽ đầu. */
  readonly supports: Readonly<Record<FloorManagerCapability, boolean>>;
  /** Danh sách tầng + đồ thị. Lỗi ở đây là trạng thái `error` của A11. */
  readonly readFloorList: (input: ReadFloorListInput) => Promise<FloorManagerSnapshot>;
  /** Đồ thị đang sửa — nơi `commit` vừa ghi vào. */
  readonly graph: FloorManagerGraphPort;
  /** `POST /floors`. CÓ endpoint thật, nên không có nhánh `supported: false`. */
  readonly persistAddFloor: (input: PersistAddFloorInput) => Promise<ApiResult<Floor>>;
  /** `DELETE /floors/:floorId`. */
  readonly persistRemoveFloor: (input: PersistRemoveFloorInput) => Promise<ApiResult<Floor>>;
  /** `PATCH /floors/reorder`. */
  readonly persistReorderFloors: (
    input: PersistReorderFloorsInput,
  ) => Promise<ApiResult<Floor[]>>;
  /** `PATCH /projects/:id/floors/:floorId/spatial` — tên, cao độ, chiều cao. */
  readonly persistFloorFields: (input: PersistFloorFieldsInput) => Promise<ApiResult<Floor>>;
  /** NOT FOUND — nội dung tầng không có chỗ ghi. Xem bản kê nợ ở đầu file. */
  readonly persistFloorContents: (
    input: PersistFloorContentsInput,
  ) => Promise<FloorManagerCapabilityResult<void>>;
  /** NOT FOUND — `Level` không có trường ẩn khỏi 3D. Xem bản kê nợ ở đầu file. */
  readonly persistHiddenIn3d: (
    input: PersistHiddenIn3dInput,
  ) => Promise<FloorManagerCapabilityResult<void>>;
  /** Mã tầng mới. Cùng cửa với `ToolContext.nextId` của `toolMachine`. */
  readonly nextLevelId: () => LevelId;
  /** Ai đang thao tác — đi vào `Command.actorId` và nhật ký hoạt động. */
  readonly actorId: string;
  /** Mốc giờ hiện tại. Tiêm được để test không phụ thuộc đồng hồ thật. */
  readonly now: () => number;
}

/**
 * Người thực hiện mặc định khi nơi gọi chưa truyền ai.
 *
 * Một chuỗi ĐẶT TÊN chứ không phải chuỗi rỗng: `validateCommands` từ chối lệnh
 * thiếu `actorId`, nên một mặc định rỗng sẽ làm mọi lệnh hỏng ở bước `validate`
 * thay vì hỏng ở chỗ người nối dây quên truyền.
 */
export const FLOOR_MANAGER_DEFAULT_ACTOR_ID = 'floor-manager-reviewer';

/** Thân yêu cầu ghi một tầng lên máy chủ, dựng từ một `Level` của đồ thị. */
export function floorWriteBodyOf(level: Level): FloorWriteBody {
  return {
    drawings: [],
    elevationMm: level.elevationMm,
    heightMm: level.heightMm,
    name: level.name,
    order: level.order,
    ...(level.areaM2 === undefined ? {} : { areaM2: level.areaM2 }),
  };
}

export interface CreateFloorManagerGatewayOptions {
  /** Cửa đọc đồ thị. Vắng mặt thì cổng đọc thẳng kho. */
  readonly graph?: FloorManagerGraphPort;
  readonly api?: ApiClient;
  readonly actorId?: string;
  readonly now?: () => number;
  readonly nextLevelId?: () => LevelId;
}

/** Cổng thật — thứ container lớp 3 gọi. */
export function createFloorManagerGateway(
  options: CreateFloorManagerGatewayOptions = {},
): FloorManagerGateway {
  const graph: FloorManagerGraphPort = options.graph ?? {
    read: () => useStore.getState().spatial,
  };
  const api = options.api ?? createAppApiClient();

  return {
    supports: {
      readFloorList: true,
      readFloorGraph: true,
      writeFloorGraph: true,
      readFloorQcProgress: true,
      createFloor: true,
      deleteFloor: true,
      reorderFloors: true,
      patchFloor: true,
      duplicateFloor: true,
      persistFloorContents: false,
      hideFloorFrom3d: false,
    },

    readFloorList: async (input) => {
      const result = await api.floors.list(
        input.signal === undefined ? {} : { signal: input.signal },
      );

      if (!result.ok) {
        /* `useQuery` đọc lượt hỏng qua `isError`; A11 gọi đó là trạng thái `error`. */
        throw result.error;
      }

      return { floors: result.data, graph: graph.read() };
    },

    graph,

    persistAddFloor: (input) => api.floors.create({ body: floorWriteBodyOf(input.level) }),
    persistRemoveFloor: (input) => api.floors.delete({ floorId: input.floorId }),
    persistReorderFloors: (input) =>
      api.floors.reorder({ body: { floorIds: [...input.floorIds] } }),
    persistFloorFields: (input) =>
      api.spatial.patchFloor({
        body: input.body,
        floorId: input.floorId,
        projectId: input.projectId,
      }),

    persistFloorContents: () =>
      Promise.resolve(unsupportedFloorCapability('persistFloorContents')),
    persistHiddenIn3d: () => Promise.resolve(unsupportedFloorCapability('hideFloorFrom3d')),

    nextLevelId: options.nextLevelId ?? ((): LevelId => createId('level')),
    actorId: options.actorId ?? FLOOR_MANAGER_DEFAULT_ACTOR_ID,
    now: options.now ?? ((): number => Date.now()),
  };
}

/* -------------------------------------------------------------------------- */
/* Bộ mẫu — chỗ story và test cắm vào (R-73).                                  */
/* -------------------------------------------------------------------------- */

/**
 * Bốn tầng của bộ mẫu, chép NGUYÊN bảng ở mục D của
 * `notes/floor-manager/blueprint.md` — không bịa bảng dữ liệu thứ hai (R-70).
 *
 * `floorManagerFixture.ts` (T6) phải NHẬP bảng này chứ không gõ lại nó: hai bảng
 * là hai bộ số, và bài kiểm của T5 với story của T6 sẽ nói hai chuyện khác nhau.
 */
export interface FloorManagerSampleLevel {
  readonly id: LevelId;
  readonly name: string;
  readonly elevationMm: number;
  readonly heightMm: number;
  /** Số bản vẽ của tầng; `0` là tầng chưa có bản vẽ (trạng thái Một phần). */
  readonly drawingCount: number;
  /** Số tường của bộ mẫu — dựng ra bấy nhiêu tường thật để phép đếm có gì để đếm. */
  readonly wallCount: number;
  /** Số phòng của bộ mẫu. A14 cố định 34 phòng cho bộ mẫu chuẩn. */
  readonly roomCount: number;
  /**
   * Số món nội thất của bộ mẫu.
   *
   * Bốn con số cộng lại đúng `SAMPLE_FURNITURE_COUNT` (21) của công trình mẫu
   * chuẩn (`src/domain/spatial/__fixtures__/sampleBuilding.ts:35`), nên bộ mẫu
   * của màn không dựng thêm một tổng thứ hai.
   */
  readonly furnitureCount: number;
}

/** Số phòng của một tầng có bản vẽ — A14: *34 phòng và sảnh 248,60 m²*. */
export const FLOOR_MANAGER_SAMPLE_ROOM_COUNT = 34;

export const FLOOR_MANAGER_SAMPLE_LEVELS: readonly FloorManagerSampleLevel[] = [
  {
    id: 'L-FLOORBASEMENT' as LevelId,
    name: 'Tầng hầm',
    elevationMm: -3000,
    heightMm: 3000,
    drawingCount: 2,
    wallCount: 58,
    roomCount: FLOOR_MANAGER_SAMPLE_ROOM_COUNT,
    furnitureCount: 8,
  },
  {
    id: 'L-FLOORGROUND00' as LevelId,
    name: 'Tầng trệt',
    elevationMm: 0,
    heightMm: 3900,
    drawingCount: 2,
    wallCount: 72,
    roomCount: FLOOR_MANAGER_SAMPLE_ROOM_COUNT,
    furnitureCount: 8,
  },
  {
    id: 'L-FLOORSECOND00' as LevelId,
    name: 'Tầng 2',
    elevationMm: 3900,
    heightMm: 3600,
    drawingCount: 1,
    wallCount: 72,
    roomCount: FLOOR_MANAGER_SAMPLE_ROOM_COUNT,
    furnitureCount: 5,
  },
  {
    id: 'L-FLOORROOF0000' as LevelId,
    name: 'Tầng mái',
    elevationMm: 7500,
    heightMm: 3600,
    drawingCount: 0,
    wallCount: 0,
    roomCount: 0,
    furnitureCount: 0,
  },
];

/** Mã tầng trệt của bộ mẫu — nơi gọi không phải tự đoán. */
export const FLOOR_MANAGER_SAMPLE_GROUND_ID: LevelId = 'L-FLOORGROUND00' as LevelId;

/** Mã tầng 2 của bộ mẫu. */
export const FLOOR_MANAGER_SAMPLE_SECOND_ID: LevelId = 'L-FLOORSECOND00' as LevelId;

/** Mã tầng mái của bộ mẫu — tầng chưa có bản vẽ. */
export const FLOOR_MANAGER_SAMPLE_ROOF_ID: LevelId = 'L-FLOORROOF0000' as LevelId;

/**
 * Công trình mẫu.
 *
 * `datumElevationMm` là `-3000`, đúng cao độ tầng thấp nhất của bảng trên: đó là
 * chỗ `restack` bắt đầu xếp chồng, nên mốc chuẩn phải bằng đáy ngăn xếp thì bật
 * "Tự động tính cao độ" mới không dịch cả toà nhà lên (mục H của bản thiết kế).
 */
export const FLOOR_MANAGER_SAMPLE_BUILDING: Building = {
  name: 'Nhà mẫu quản lý tầng',
  datumElevationMm: -3000,
  confidence: 1,
  source: 'human',
  reviewed: true,
};

const pad = (value: number): string =>
  formatNumber(value, { grouping: false, fractionDigits: 0 }).padStart(6, '0');

/** Bề dày và chiều dài tường mẫu — hình học tối thiểu để một tường hợp lệ tồn tại. */
const SAMPLE_WALL_LENGTH_MM = 4000;
const SAMPLE_WALL_THICKNESS_MM = 220;
const SAMPLE_ROOM_DEPTH_MM = 4250;

const sampleWallId = (levelIndex: number, index: number): WallId =>
  `W-${pad(levelIndex)}${pad(index)}W` as WallId;

const sampleRoomId = (levelIndex: number, index: number): RoomId =>
  `R-${pad(levelIndex)}${pad(index)}R` as RoomId;

const sampleFurnitureId = (levelIndex: number, index: number): FurnitureId =>
  `F-${pad(levelIndex)}${pad(index)}F` as FurnitureId;

/** Cạnh của một món nội thất mẫu, milimét. */
const SAMPLE_FURNITURE_SIZE_MM = 800;

/**
 * Diện tích một phòng của bộ mẫu.
 *
 * `SAMPLE_TOTAL_AREA_M2` (248,6 — A14) chia đều cho số phòng, nên tổng của cả
 * tầng đọc ra đúng `"248,60 m²"` mà không con số nào viết tay ở đây.
 */
const sampleRoomAreaM2 = SAMPLE_TOTAL_AREA_M2 / FLOOR_MANAGER_SAMPLE_ROOM_COUNT;

const DETECTED = { confidence: 0.82, reviewed: false, source: 'ai' } as const;

export interface FloorManagerSampleGraphOptions {
  /** Tầng đưa vào đồ thị; vắng mặt thì cả bốn tầng của bộ mẫu. */
  readonly levels?: readonly FloorManagerSampleLevel[];
  /** `false` thì đồ thị có tầng nhưng CHƯA tường/phòng nào. */
  readonly withContents?: boolean;
}

/**
 * Đồ thị mẫu — dựng từ CHÍNH {@link FLOOR_MANAGER_SAMPLE_LEVELS}, tất định.
 *
 * Không gọi `Math.random`, không đọc đồng hồ: hai lần dựng cho hai đồ thị bằng
 * nhau từng trường, nên một bài kiểm hỏng là hỏng thật.
 */
export function createFloorManagerSampleGraph(
  options: FloorManagerSampleGraphOptions = {},
): NormalizedSpatial {
  const source = options.levels ?? FLOOR_MANAGER_SAMPLE_LEVELS;
  const withContents = options.withContents ?? true;

  const levels: Level[] = source.map((entry, index) => ({
    confidence: 1,
    source: 'human',
    reviewed: false,
    id: entry.id,
    name: entry.name,
    order: index,
    elevationMm: entry.elevationMm,
    heightMm: entry.heightMm,
  }));

  const walls: Wall[] = [];
  const rooms: Room[] = [];
  const furniture: Furniture[] = [];

  if (withContents) {
    source.forEach((entry, levelIndex) => {
      for (let index = 0; index < entry.wallCount; index += 1) {
        walls.push({
          ...DETECTED,
          id: sampleWallId(levelIndex, index),
          levelId: entry.id,
          kind: 'partition',
          centreline: {
            start: { x: index * SAMPLE_WALL_LENGTH_MM, y: 0 },
            end: { x: (index + 1) * SAMPLE_WALL_LENGTH_MM, y: 0 },
          },
          heightMm: entry.heightMm,
          thicknessMm: SAMPLE_WALL_THICKNESS_MM,
          openingIds: [],
        });
      }

      for (let index = 0; index < entry.roomCount; index += 1) {
        rooms.push({
          confidence: 1,
          source: 'human',
          reviewed: true,
          id: sampleRoomId(levelIndex, index),
          levelId: entry.id,
          name: `Phòng ${formatNumber(index + 1, { grouping: false, fractionDigits: 0 })}`,
          usage: 'bedroom',
          areaM2: sampleRoomAreaM2,
          outline: [
            { x: index * SAMPLE_WALL_LENGTH_MM, y: 0 },
            { x: (index + 1) * SAMPLE_WALL_LENGTH_MM, y: 0 },
            { x: (index + 1) * SAMPLE_WALL_LENGTH_MM, y: SAMPLE_ROOM_DEPTH_MM },
            { x: index * SAMPLE_WALL_LENGTH_MM, y: SAMPLE_ROOM_DEPTH_MM },
          ],
          wallIds: [sampleWallId(levelIndex, index)],
        });
      }

      for (let index = 0; index < entry.furnitureCount; index += 1) {
        furniture.push({
          ...DETECTED,
          id: sampleFurnitureId(levelIndex, index),
          levelId: entry.id,
          roomId: sampleRoomId(levelIndex, index),
          kind: 'table',
          boundingBox: {
            min: { x: index * SAMPLE_WALL_LENGTH_MM, y: 0 },
            max: {
              x: index * SAMPLE_WALL_LENGTH_MM + SAMPLE_FURNITURE_SIZE_MM,
              y: SAMPLE_FURNITURE_SIZE_MM,
            },
          },
          centre: {
            x: index * SAMPLE_WALL_LENGTH_MM,
            y: 0,
          },
          rotationDeg: 0,
        });
      }
    });
  }

  return normalizeSpatial({
    building: FLOOR_MANAGER_SAMPLE_BUILDING,
    levels,
    walls,
    openings: [],
    furniture,
    rooms,
    axes: [],
    dimensions: [],
    notes: [],
  });
}

/**
 * Danh sách tầng của máy chủ, dựng từ cùng một bảng mẫu.
 *
 * `Floor.id` là `string` trần còn `Level.id` là `LevelId` có brand; cổng ghép
 * hai vựng bằng chính chuỗi đó, nên bộ mẫu giữ chúng bằng nhau.
 */
export function createFloorManagerSampleFloors(
  levels: readonly FloorManagerSampleLevel[] = FLOOR_MANAGER_SAMPLE_LEVELS,
): readonly Floor[] {
  return levels.map((entry, index) => ({
    id: String(entry.id),
    name: entry.name,
    order: index,
    elevationMm: entry.elevationMm,
    heightMm: entry.heightMm,
    drawings: Array.from({ length: entry.drawingCount }, (_unused, drawingIndex) => ({
      id: `${String(entry.id)}-DRAW${pad(drawingIndex)}`,
      name: `${entry.name} — bản vẽ ${formatNumber(drawingIndex + 1, { grouping: false, fractionDigits: 0 })}`,
      url: 'https://example.invalid/ban-ve.png',
      uploadedAt: '2026-01-01T00:00:00.000Z',
      uploaderId: 'U-SAMPLE0001',
      widthMm: 841,
      heightMm: 594,
    })),
  }));
}

/** Cách bài kiểm ép một cảnh cụ thể, không sửa mã. */
export interface FloorManagerGatewaySeed {
  /** Đồ thị cổng trả về. Vắng mặt thì đồ thị mẫu đủ bốn tầng. */
  readonly graph?: NormalizedSpatial | null;
  /** Danh sách tầng máy chủ. Vắng mặt thì bộ mẫu. */
  readonly floors?: readonly Floor[];
  /** `true` thì `readFloorList` ném — đúng cảnh `error` của bảy kịch bản. */
  readonly failReadFloorList?: boolean;
  /** `true` thì mọi lượt ghi lên máy chủ trả lỗi — cảnh "lưu không xong". */
  readonly failPersist?: boolean;
  readonly actorId?: string;
  readonly now?: () => number;
  readonly nextLevelId?: () => LevelId;
}

/** Lỗi API dựng sẵn cho bộ mẫu — đúng hình dạng `HttpError` mà cổng thật trả. */
export const FLOOR_MANAGER_SAMPLE_PERSIST_ERROR: HttpError = {
  kind: 'network',
  requestId: 'REQ-FLOOR-MANAGER-SAMPLE',
  retryable: true,
  raw: 'Không gửi được thay đổi tầng lên máy chủ.',
};

/** Cổng có dữ liệu — dùng chung giữa test và story (R-73, R-70). */
export function createMockFloorManagerGateway(
  seed: FloorManagerGatewaySeed = {},
): FloorManagerGateway {
  const graph = seed.graph === undefined ? createFloorManagerSampleGraph() : seed.graph;
  const floors = seed.floors ?? createFloorManagerSampleFloors();
  const failPersist = seed.failPersist ?? false;
  let counter = 0;

  const persisted = <TValue>(value: TValue): Promise<ApiResult<TValue>> =>
    Promise.resolve(
      failPersist
        ? { ok: false, error: FLOOR_MANAGER_SAMPLE_PERSIST_ERROR }
        : { ok: true, data: value },
    );

  return {
    supports: {
      readFloorList: true,
      readFloorGraph: true,
      writeFloorGraph: true,
      readFloorQcProgress: true,
      createFloor: true,
      deleteFloor: true,
      reorderFloors: true,
      patchFloor: true,
      duplicateFloor: true,
      persistFloorContents: false,
      hideFloorFrom3d: false,
    },

    readFloorList: () => {
      if (seed.failReadFloorList === true) {
        return Promise.reject(new Error('Không tải được danh sách tầng của dự án.'));
      }

      return Promise.resolve({ floors, graph });
    },

    graph: { read: () => useStore.getState().spatial ?? graph },

    persistAddFloor: (input) =>
      persisted({
        id: String(input.level.id),
        name: input.level.name,
        order: input.level.order,
        elevationMm: input.level.elevationMm,
        heightMm: input.level.heightMm,
        drawings: [],
      } as Floor),
    persistRemoveFloor: (input) =>
      persisted(
        (floors.find((floor) => floor.id === input.floorId) ?? {
          id: input.floorId,
          name: input.floorId,
          order: 0,
          elevationMm: 0,
          heightMm: MIN_CLEAR_HEIGHT_MM,
          drawings: [],
        }) as Floor,
      ),
    persistReorderFloors: () => persisted([...floors]),
    persistFloorFields: (input) =>
      persisted(
        (floors.find((floor) => floor.id === input.floorId) ?? {
          id: input.floorId,
          name: input.floorId,
          order: 0,
          elevationMm: 0,
          heightMm: MIN_CLEAR_HEIGHT_MM,
          drawings: [],
        }) as Floor,
      ),

    persistFloorContents: () =>
      Promise.resolve(unsupportedFloorCapability('persistFloorContents')),
    persistHiddenIn3d: () => Promise.resolve(unsupportedFloorCapability('hideFloorFrom3d')),

    nextLevelId:
      seed.nextLevelId ??
      ((): LevelId => {
        counter += 1;

        return `L-${pad(counter)}MOCK` as LevelId;
      }),
    actorId: seed.actorId ?? FLOOR_MANAGER_DEFAULT_ACTOR_ID,
    now: seed.now ?? ((): number => Date.now()),
  };
}
