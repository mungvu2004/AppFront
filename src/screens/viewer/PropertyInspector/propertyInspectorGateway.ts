/**
 * Cổng dữ liệu và tầng lệnh của `PropertyInspector` — mọi lời gọi ra khỏi panel
 * đi qua đây, đúng khuôn `wallLayerReviewGateway.ts` và
 * `dimensionOcrReviewGateway.ts` của các màn QC anh em.
 *
 * ## Đường ghi — `dispatch` chạy qua `commit` (S-07 + S-05 + A10)
 *
 * Mọi ô nhập của panel TẠO LỆNH rồi điều phối qua `dispatch` (năm bước
 * `validate → apply → history → rules → sync`), và `SpatialPort.applyPatches`
 * của `dispatch` được cài bằng `commit(patches, label)` của `src/store/commit.ts`.
 * `commit` chỉ xuất hiện trong file này, không bao giờ trong hook hay view; không
 * một dòng nào gọi `set()` hay `_applyPatches()` (A10, `local/no-direct-set`).
 *
 * ## Ba lệnh dựng bằng nguyên thuỷ công khai, và vì sao được phép
 *
 * `src/lib/commands/business` KHÔNG có lệnh đổi `swing` của một ô mở đã tồn tại
 * (hợp đồng T2 mục C8 #1) và KHÔNG có lệnh nào đặt cờ duyệt. Điều phối viên đã
 * phán quyết từng mục một trước khi file này được viết:
 *
 * - **Đổi chiều mở** — được dựng bằng `createCommand` + `changeForUpdate`, chép
 *   đúng khuôn `buildOverrideDimensionCommand`
 *   (`screens/qc/DimensionOcrReview/dimensionOcrReviewGateway.ts:780-783`). Lý do
 *   đã ghi trong phán quyết: `swing` là một trường enum trên thực thể, đổi nó
 *   không phải phép tính hình học nên R-61 không cấm. Lệnh mang tên riêng
 *   {@link OPENING_SWING_COMMAND_TYPE}, không mượn tên của họ lệnh khác.
 * - **Duyệt** — {@link buildApproveCommand} là đường DUY NHẤT đặt `reviewed: true`,
 *   và nó luôn đặt kèm `source: 'human'` CỨNG trong thân hàm. Không tham số nào
 *   cho phép nơi gọi truyền `source`, nên đầu ra AI không có đường nào bật được
 *   cờ xanh "đã xác minh" (A5). Kỷ luật này chép nguyên từ
 *   `buildApproveDimensionCommand` (cùng file trên, dòng 790).
 * - **Bộ đếm duyệt** — {@link approvedCountOf} đếm từ chính đồ thị, không có một
 *   biến đếm nào được nuôi tay: `src/store` không có bộ đếm duyệt nào (đã tìm),
 *   và một con số suy ra không bao giờ lệch khỏi dữ liệu. Khuôn:
 *   `reviewCounterOf` (cùng file trên, dòng 727).
 *
 * ## Ba việc tầng logic TỪNG chưa có đường — nay đã có, và đã nối
 *
 * 1. **~~Chiều cao tường và kích thước bao nội thất không ghi được~~ — lỗ hổng
 *    #1 và #2, đã vá (U1).** `WALL_COMMAND_TYPES.changeHeight` và
 *    `OPENING_COMMAND_TYPES.resizeFurniture` nay có thật, mỗi lệnh tự mang phán
 *    quyết mà trước đây chưa ai ra: hạ tường xuống dưới đỉnh một ô mở bị TỪ
 *    CHỐI kèm câu tiếng Việt nói còn thiếu bao nhiêu milimét, còn nội thất
 *    phình ra thì để `FURNITURE-CLASH` cảnh báo sau chứ lệnh không tự dọn đồ.
 *    Panel vì thế mở khoá hai dòng đó — {@link propertyInspectorTypes} và
 *    `usePropertyInspector.ts` là nơi chúng thành ô nhập.
 * 2. **~~`copyAsTemplate` chưa tồn tại ở bất cứ tầng nào~~ — lỗ hổng #4, đã vá
 *    (U4).** `PropertyTemplate` + `ENDPOINTS.propertyTemplates`
 *    (`src/api/client.ts`, `src/api/endpoints.ts`), `queryKeys.template.byProject`
 *    và `WriteOperation` `createPropertyTemplate` nay đủ bộ, nên
 *    {@link PropertyInspectorGateway.copyAsTemplate} GỬI THẬT thay vì trả một
 *    lý do. Nó chỉ còn từ chối khi chưa mở dự án nào — một tình huống của phiên
 *    làm việc, không phải một khả năng còn thiếu.
 * 3. **~~Không endpoint nào nhận lớp không gian~~ — lỗ hổng #5, đã vá (U4).**
 *    `SpatialApi.writeLayer` nhận đủ bốn danh sách (tường / ô mở / phòng / nội
 *    thất) của một tầng, nên {@link PropertyInspectorGateway.persistProperties}
 *    là một lượt ghi thật và chỉ báo tự lưu nói được "Đã lưu lúc …" mà không
 *    nói dối. Trước đây nó NÉM để khỏi nói dối; giờ nó chỉ ném khi máy chủ thật
 *    sự từ chối, và `createAutosave` lo phần thử lại.
 *
 * `openingsOfRoom` giờ đã được export từ `src/domain/spatial/roomOpenings.ts`
 * (lỗ hổng #3) — {@link roomOpeningCountsOf} dưới đây gọi thẳng nó thay vì nuôi
 * một bản sao.
 */

import type {
  ApiClient,
  PropertyTemplate,
  PropertyTemplateDraft,
  SpatialLayer,
} from '@/api/client';
import { createAppApiClient } from '@/api/appClient';
import { readEntity } from '@/domain/spatial/applyPatch';
import type { NormalizedSpatial, SpatialEntity } from '@/domain/spatial/normalize';
import { idsOnLevel, isEntityOfKind } from '@/domain/spatial/normalize';
import { countOpeningsByKind, openingsOfRoom } from '@/domain/spatial/roomOpenings';
import type {
  Furniture,
  LevelId,
  Opening,
  Room,
  SwingDirection,
  Wall,
  WallId,
} from '@/domain/spatial/types';
import type { Violation } from '@/domain/rules/registry';
import { changeForUpdate, createCommand } from '@/lib/commands/createCommand';
import type { Command } from '@/lib/commands/types';
import type { DispatchDeps, DispatchResult, SpatialPort } from '@/lib/commands/dispatch';
import { createIncrementalRuleRunner, dispatch } from '@/lib/commands/dispatch';
import type { HistoryStack, SelectionSnapshot } from '@/lib/commands/history';
import { createHistoryStack, NO_SELECTION } from '@/lib/commands/history';
import { MERGE_WINDOW_MS } from '@/lib/commands/mergeCommands';
import { useStore } from '@/store';
import { commit } from '@/store/commit';

import type { ObjectKind } from './propertyInspectorTypes';
import { OBJECT_KIND_LABELS } from './propertyInspectorTypes';

/* -------------------------------------------------------------------------- */
/* Bốn loại đối tượng panel thanh tra được.                                    */
/* -------------------------------------------------------------------------- */

/** Bốn thực thể ứng với bốn `ObjectKind` — không gồm `level`/`axis`/`dimension`. */
export type InspectableEntity = Wall | Opening | Room | Furniture;

/**
 * Loại của một thực thể theo từ vựng của panel, hoặc `null` khi panel không
 * thanh tra loại đó (trục, cao độ tầng, chuỗi kích thước).
 *
 * Dùng `isEntityOfKind` của domain — tiền tố id là dấu hiệu runtime DUY NHẤT
 * đáng tin, các thực thể không chung một trường phân biệt nào.
 */
export function objectKindOf(entity: SpatialEntity): ObjectKind | null {
  if (isEntityOfKind('wall', entity)) {
    return 'wall';
  }

  if (isEntityOfKind('opening', entity)) {
    return 'opening';
  }

  if (isEntityOfKind('room', entity)) {
    return 'room';
  }

  if (isEntityOfKind('furniture', entity)) {
    return 'furniture';
  }

  return null;
}

/** Thực thể panel thanh tra được, hoặc `null` — hẹp `SpatialEntity` xuống bốn loại. */
export function toInspectableEntity(entity: SpatialEntity): InspectableEntity | null {
  if (isEntityOfKind('wall', entity)) {
    return entity;
  }

  if (isEntityOfKind('opening', entity)) {
    return entity;
  }

  if (isEntityOfKind('room', entity)) {
    return entity;
  }

  if (isEntityOfKind('furniture', entity)) {
    return entity;
  }

  return null;
}

/** Đọc một đối tượng theo id (D-12); `null` khi id không có hoặc không thuộc bốn loại. */
export function readInspectableEntity(
  graph: NormalizedSpatial | null,
  id: string,
): InspectableEntity | null {
  if (graph === null) {
    return null;
  }

  const entity = graph.byId[id];

  return entity === undefined ? null : toInspectableEntity(entity);
}

/* -------------------------------------------------------------------------- */
/* Quan hệ — ghép dữ liệu trên các trường id đã có, không một phép hình học.    */
/* -------------------------------------------------------------------------- */

/** Số cửa đi và số cửa sổ của một phòng. */
export interface RoomOpeningCounts {
  readonly doorCount: number;
  readonly windowCount: number;
}

/**
 * Đếm cửa đi / cửa sổ của một phòng, qua tiện ích dùng chung
 * `openingsOfRoom`/`countOpeningsByKind` của `src/domain/spatial/roomOpenings.ts`.
 *
 * `Room` không có `doorCount`/`windowCount`/`openingIds` (hợp đồng T1 mục M7 #5),
 * nên hai con số này chỉ có thể ghép ra. Việc của hàm này chỉ còn là giải
 * `room.wallIds`/`wall.openingIds` thành hai mảng phẳng từ `NormalizedSpatial`
 * — phép đếm và phép duyệt hình học thật sự nằm trong tiện ích domain.
 *
 * **Một ô mở nằm trên tường dùng chung giữa hai phòng được đếm cho CẢ HAI phòng.**
 * Đó là hành vi đúng của `openingsOfRoom`: cái cửa ấy đúng là cửa của cả hai
 * phòng. Ghi ra đây để người đọc sau không tưởng là lỗi trùng.
 */
export function roomOpeningCountsOf(graph: NormalizedSpatial, room: Room): RoomOpeningCounts {
  const walls: Wall[] = [];
  const openingIds = new Set<Opening['id']>();

  for (const wallId of room.wallIds) {
    const wall = readEntity(graph, 'wall', wallId);

    if (wall === null) {
      continue;
    }

    walls.push(wall);

    for (const openingId of wall.openingIds) {
      openingIds.add(openingId);
    }
  }

  const openings: Opening[] = [];

  for (const openingId of openingIds) {
    const opening = readEntity(graph, 'opening', openingId);

    if (opening !== null) {
      openings.push(opening);
    }
  }

  return countOpeningsByKind(openingsOfRoom(room, walls, openings));
}

/**
 * Phòng chứa một đối tượng, hoặc `null`.
 *
 * Nội thất mang thẳng `roomId`. Tường thì không: phòng mới là bên giữ danh sách
 * `wallIds`, nên chiều tra ngược là duyệt các phòng của đồ thị — vẫn chỉ đọc id.
 */
export function containingRoomIdOf(graph: NormalizedSpatial, entity: InspectableEntity): string | null {
  if (isEntityOfKind('furniture', entity)) {
    return entity.roomId ?? null;
  }

  if (isEntityOfKind('room', entity)) {
    return null;
  }

  const wallId: WallId | null = isEntityOfKind('wall', entity) ? entity.id : entity.wallId;

  for (const roomId of graph.byKind.room) {
    const candidate = graph.byId[roomId];

    if (candidate !== undefined && isEntityOfKind('room', candidate) && candidate.wallIds.includes(wallId)) {
      return candidate.id;
    }
  }

  return null;
}

/* -------------------------------------------------------------------------- */
/* M-12 — vi phạm của MỘT đối tượng.                                           */
/* -------------------------------------------------------------------------- */

/** Danh sách rỗng dùng chung — không tạo mảng mới mỗi lần render. */
const NO_VIOLATIONS: readonly Violation[] = Object.freeze([]);

/**
 * Vi phạm gắn với một id, lọc từ mảng `Violation[]` mà `selectViolations` đã
 * tính sẵn.
 *
 * Không selector nào trong repo lọc theo thực thể — chỉ có theo TẦNG
 * (`selectFloorViolations`), xác nhận ở hợp đồng T1 mục M7 #3. Phép lọc này là
 * GHÉP DỮ LIỆU trên kết quả có sẵn, không phải chạy lại luật: bộ luật chạy trong
 * `selectViolations`, panel chỉ đọc.
 *
 * **Khoảng trống đã biết:** registry dùng chung chỉ đăng ký 8 luật gốc, nên các
 * luật hình học / công năng / fit-out (kể cả `FURNITURE-CLASH`) không bao giờ
 * xuất hiện ở đây. Panel GIỮ NGUYÊN điều đó — tự đăng ký thêm luật là tự kiểm
 * luật, điều bị cấm tuyệt đối.
 */
export function violationsOfEntity(
  violations: readonly Violation[],
  entityId: string | null,
): readonly Violation[] {
  if (entityId === null) {
    return NO_VIOLATIONS;
  }

  const matched = violations.filter((violation) => violation.entityId === entityId);

  return matched.length === 0 ? NO_VIOLATIONS : matched;
}

/* -------------------------------------------------------------------------- */
/* Duyệt — bộ đếm suy ra, và lệnh đặt cờ xanh.                                 */
/* -------------------------------------------------------------------------- */

/** Bốn loại panel thanh tra được, đúng thứ tự panel duyệt vòng. */
const INSPECTABLE_KINDS = ['wall', 'opening', 'room', 'furniture'] as const;

/**
 * Số đối tượng đã duyệt trong toàn đồ thị — bộ đếm toàn cục của H8.
 *
 * Đếm từ chính dữ liệu, không nuôi một biến đếm nào: `src/store` không có bộ đếm
 * duyệt, và một con số suy ra không thể lệch khỏi thứ nó đếm. Khuôn:
 * `reviewCounterOf` (`dimensionOcrReviewGateway.ts:727`).
 */
export function approvedCountOf(graph: NormalizedSpatial | null): number {
  if (graph === null) {
    return 0;
  }

  let approved = 0;

  for (const kind of INSPECTABLE_KINDS) {
    for (const id of graph.byKind[kind]) {
      const entity = graph.byId[id];

      if (entity !== undefined && 'reviewed' in entity && entity.reviewed) {
        approved += 1;
      }
    }
  }

  return approved;
}

/**
 * Đối tượng CHƯA DUYỆT kế tiếp CÙNG LOẠI, tính từ đối tượng đang xem.
 *
 * Duyệt vòng: hết danh sách thì quay lại đầu, nên người duyệt không bao giờ rơi
 * vào ngõ cụt ở cuối tầng. `null` khi loại đó không còn gì chưa duyệt.
 */
export function nextUnapprovedIdOf(
  graph: NormalizedSpatial | null,
  kind: ObjectKind,
  currentId: string,
): string | null {
  if (graph === null) {
    return null;
  }

  const ids = graph.byKind[kind];
  const currentIndex = ids.findIndex((id) => id === currentId);
  const start = currentIndex === -1 ? 0 : currentIndex + 1;

  for (let step = 0; step < ids.length; step += 1) {
    const id = ids[(start + step) % ids.length];

    if (id === undefined || id === currentId) {
      continue;
    }

    const entity = graph.byId[id];

    if (entity !== undefined && 'reviewed' in entity && !entity.reviewed) {
      return id;
    }
  }

  return null;
}

/* -------------------------------------------------------------------------- */
/* Ba lệnh của panel.                                                          */
/* -------------------------------------------------------------------------- */

/** Loại lệnh đổi chiều mở. Viết đúng một chỗ (R-71). */
export const OPENING_SWING_COMMAND_TYPE = 'opening.changeSwing';

/** Loại lệnh duyệt một đối tượng. Cùng lý do đặt tên như trên. */
export const INSPECTOR_APPROVE_COMMAND_TYPE = 'inspector.approve';

/** Câu mô tả đi vào nhật ký hoạt động, nút hoàn tác và nhãn của `commit`. */
export const swingCommandDescription = (openingId: string): string =>
  `Đổi chiều mở ${OBJECT_KIND_LABELS.opening} ${openingId}`;

/** Câu mô tả của lệnh duyệt. */
export const approveCommandDescription = (kind: ObjectKind, entityId: string): string =>
  `Duyệt ${OBJECT_KIND_LABELS[kind]} ${entityId}`;

/**
 * Lệnh đổi chiều mở của một ô mở ĐÃ TỒN TẠI.
 *
 * `ResizeOpeningInput` không mang `swing`, và `AddOpeningInput.swing` chỉ dùng
 * được lúc tạo (hợp đồng T2 mục C8 #1), nên lệnh này dựng bằng nguyên thuỷ công
 * khai. Hợp lệ vì `CommandType` là `string` mở và `validateCommands` chỉ kiểm
 * `type` khác rỗng; tự hoàn tác được vì `changeForUpdate` mang ĐỦ ảnh chụp
 * `before`/`after` và `invertCommand` chỉ hoán đổi hai ảnh đó.
 *
 * KHÔNG chạm `reviewed`, `confidence` hay `source`: đổi một trường dữ liệu không
 * phải là phán quyết của người duyệt (A5).
 */
export function buildChangeSwingCommand(
  before: Opening,
  swing: SwingDirection,
  actorId: string,
): Command {
  return createCommand({
    type: OPENING_SWING_COMMAND_TYPE,
    actorId,
    description: swingCommandDescription(before.id),
    changes: [changeForUpdate('opening', before, { ...before, swing })],
  });
}

/**
 * Lệnh duyệt — đường DUY NHẤT trong panel đặt cờ "đã xác minh" (A5).
 *
 * `source: 'human'` viết cứng trong thân hàm, không tham số nào cho phép nơi gọi
 * truyền nó vào: đầu ra AI không có đường nào bật được cờ xanh. Bốn nhánh viết
 * tường minh thay vì một hàm chung có tham số kiểu, vì `changeForUpdate` cần
 * biết loại thực thể ở mức kiểu chứ không phải lúc chạy.
 */
export function buildApproveCommand(before: InspectableEntity, actorId: string): Command {
  if (isEntityOfKind('wall', before)) {
    return createCommand({
      type: INSPECTOR_APPROVE_COMMAND_TYPE,
      actorId,
      description: approveCommandDescription('wall', before.id),
      changes: [
        changeForUpdate('wall', before, { ...before, reviewed: true, source: 'human' }),
      ],
    });
  }

  if (isEntityOfKind('opening', before)) {
    return createCommand({
      type: INSPECTOR_APPROVE_COMMAND_TYPE,
      actorId,
      description: approveCommandDescription('opening', before.id),
      changes: [
        changeForUpdate('opening', before, { ...before, reviewed: true, source: 'human' }),
      ],
    });
  }

  if (isEntityOfKind('room', before)) {
    return createCommand({
      type: INSPECTOR_APPROVE_COMMAND_TYPE,
      actorId,
      description: approveCommandDescription('room', before.id),
      changes: [
        changeForUpdate('room', before, { ...before, reviewed: true, source: 'human' }),
      ],
    });
  }

  return createCommand({
    type: INSPECTOR_APPROVE_COMMAND_TYPE,
    actorId,
    description: approveCommandDescription('furniture', before.id),
    changes: [
      changeForUpdate('furniture', before, { ...before, reviewed: true, source: 'human' }),
    ],
  });
}

/* -------------------------------------------------------------------------- */
/* Đường ghi — `dispatch` chạy qua `commit`.                                   */
/* -------------------------------------------------------------------------- */

/** Cửa đọc đồ thị đang sửa. Mặc định là store; test cắm một đồ thị cố định. */
export interface PropertyInspectorGraphPort {
  readonly read: () => NormalizedSpatial | null;
}

/**
 * Cổng ghi của `dispatch`, cài bằng `commit`.
 *
 * Nhãn lấy từ chính `description` của lượt dispatch đang chạy, nên nút hoàn tác,
 * nhật ký hoạt động và chỉ báo lưu đọc cùng một câu.
 */
export function createCommitSpatialPort(
  graph: PropertyInspectorGraphPort,
  labelOf: () => string,
): SpatialPort {
  return {
    read: () => graph.read(),
    applyPatches: (patches) => {
      commit(patches, labelOf());
    },
  };
}

/** Bộ phụ thuộc năm cổng của `dispatch`, gắn với ngăn xếp hoàn tác 100 bước của S-06. */
export interface PropertyInspectorDispatchBundle {
  readonly deps: DispatchDeps;
  readonly history: HistoryStack;
  /** Nhãn của lượt dispatch đang chạy — `SpatialPort` đọc nó để đặt tên cho `commit`. */
  readonly setLabel: (label: string) => void;
}

export interface CreatePropertyInspectorDispatchOptions {
  readonly graph: PropertyInspectorGraphPort;
  readonly selectionBefore: () => SelectionSnapshot;
  readonly selectionAfter: () => SelectionSnapshot;
  /** Bước `sync` — đánh dấu bản vẽ bẩn cho tự lưu (D-07). */
  readonly onSynced: () => void;
  readonly history?: HistoryStack;
}

/**
 * Dựng `DispatchDeps` đầy đủ năm cổng.
 *
 * **D-06 nằm ở đây, không ở hook.** Ngăn xếp được dựng với `mergeWindowMs =
 * MERGE_WINDOW_MS` (hằng số của `src/lib/commands/mergeCommands`, gốc là
 * `COALESCE_WINDOW_MS` — panel không viết lại con số, R-71). `HistoryStack.push`
 * tự gọi `canMergeCommands`/`mergeCommands`: hai lượt ghi cùng loại, cùng người,
 * cùng đối tượng, cách nhau dưới cửa sổ đó gộp thành MỘT bước hoàn tác, giữ
 * `before` của lệnh đầu và `after` của lệnh cuối. Đó là lý do một mạch kéo rồi
 * `Ctrl+Z` một lần trả về đúng giá trị trước khi kéo.
 */
export function createPropertyInspectorDispatchDeps(
  options: CreatePropertyInspectorDispatchOptions,
): PropertyInspectorDispatchBundle {
  const history = options.history ?? createHistoryStack({ mergeWindowMs: MERGE_WINDOW_MS });
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

/** Chạy MỘT lệnh qua đủ năm bước. */
export async function runInspectorCommand(
  command: Command,
  bundle: PropertyInspectorDispatchBundle,
): Promise<DispatchResult> {
  bundle.setLabel(command.description);

  return dispatch(command, bundle.deps);
}

/** Vùng chọn rỗng, cho lượt ghi không có gì được chọn trước đó. */
export const PROPERTY_INSPECTOR_NO_SELECTION: SelectionSnapshot = NO_SELECTION;

/* -------------------------------------------------------------------------- */
/* Cái seam — khả năng, và những gì cổng KHÔNG làm được.                       */
/* -------------------------------------------------------------------------- */

/** Việc panel cần từ bên ngoài. Mỗi khoá là một khả năng, không có khả năng nào khác. */
export type PropertyInspectorCapability =
  | 'readSpatialLayer'
  | 'writeSpatialLayer'
  | 'persistProperties'
  | 'copyAsTemplate';

/** Kết quả của một khả năng có thể chưa có đường. */
export type PropertyInspectorCapabilityResult<TValue> =
  | { readonly ok: true; readonly data: TValue }
  | { readonly ok: false; readonly reason: string };

/**
 * Câu nói ra khi một lượt ghi không có ĐÍCH, chứ không phải không có ĐƯỜNG.
 *
 * Cả hai khả năng dưới đây nay đã có đủ endpoint (lỗ hổng #4 và #5, U4). Thứ
 * còn thiếu được là ngữ cảnh của phiên làm việc: chưa mở dự án nào thì không
 * có `projectId` để gửi tới, và chưa chọn tầng nào thì không biết lấy lớp
 * không gian của tầng nào. Câu chữ nói rõ đó là việc người dùng làm tiếp được,
 * không phải một lỗi của bản vẽ — panel hiện nó ở nhóm "Kiểm tra", nơi vốn
 * dành cho vi phạm quy tắc.
 */
export const NO_SAVE_TARGET_REASON =
  'Chưa mở dự án và tầng nào nên chưa có nơi để lưu. Bản vẽ của bạn không có lỗi nào ở đây.';

/** Câu nói ra khi máy chủ từ chối lượt lưu lớp không gian. */
export const persistFailedReason = (kind: string): string =>
  `Máy chủ chưa nhận được lớp không gian (${kind}). Thay đổi vẫn còn trên máy này.`;

/** Câu nói ra khi máy chủ từ chối lượt tạo khuôn mẫu. */
export const templateFailedReason = (kind: string): string =>
  `Máy chủ chưa lưu được khuôn mẫu thuộc tính (${kind}). Chưa có khuôn nào được tạo.`;

/** Câu xác nhận khi khuôn mẫu đã lưu xong — panel hiện nó ở nhóm "Kiểm tra". */
export const templateSavedNotice = (name: string): string =>
  `Đã lưu khuôn mẫu "${name}" cho dự án này.`;

/** Tên khuôn mẫu sinh từ chính đối tượng được sao chép — người dùng đổi được sau. */
export const templateNameOf = (entity: InspectableEntity): string => {
  const kind = objectKindOf(entity);

  return kind === null ? `Khuôn mẫu ${entity.id}` : `Khuôn ${OBJECT_KIND_LABELS[kind]} ${entity.id}`;
};

/**
 * Bộ giá trị một khuôn mẫu mang theo, đúng `PropertyTemplateFieldsByKind` của
 * `src/api/client.ts`.
 *
 * Chỉ những thuộc tính ĐẶT TRƯỚC được: hình học đo ra từ bản vẽ (chiều dài
 * tường, diện tích phòng, tường chủ của một ô mở) là số đo của MỘT đối tượng cụ
 * thể, không phải một lựa chọn ai đó chép sang đối tượng khác. Danh sách này
 * không được gõ lại ở đây lần thứ hai: nó là đúng các trường
 * `PropertyTemplateFieldsByKind` khai, và TypeScript bắt lệch.
 */
export function propertyTemplateDraftOf(entity: InspectableEntity): PropertyTemplateDraft | null {
  const name = templateNameOf(entity);

  if (isEntityOfKind('wall', entity)) {
    return {
      fields: { heightMm: entity.heightMm, kind: entity.kind, thicknessMm: entity.thicknessMm },
      name,
      objectKind: 'wall',
    };
  }

  if (isEntityOfKind('opening', entity)) {
    return {
      fields: {
        heightMm: entity.heightMm,
        sillHeightMm: entity.sillHeightMm,
        swing: entity.swing,
        widthMm: entity.widthMm,
      },
      name,
      objectKind: 'opening',
    };
  }

  if (isEntityOfKind('room', entity)) {
    return { fields: { usage: entity.usage }, name, objectKind: 'room' };
  }

  if (isEntityOfKind('furniture', entity)) {
    return {
      fields: { kind: entity.kind, rotationDeg: entity.rotationDeg },
      name,
      objectKind: 'furniture',
    };
  }

  return null;
}

/**
 * Bốn danh sách thực thể của MỘT tầng, đúng hình dạng `SpatialLayer` mà
 * `SpatialApi.writeLayer` nhận.
 *
 * Lọc theo tầng chứ không gửi cả toà nhà: `writeLayer` khoá theo
 * `projects/:id/floors/:floorId/spatial/layer`, nên gửi kèm tường của tầng
 * khác là ghi dữ liệu của tầng đó vào đường dẫn của tầng này. `idsOnLevel` là
 * chỉ mục `byLevel` mà `normalizeSpatial` đã dựng sẵn — không một phép duyệt
 * hình học nào ở đây, chỉ đọc id.
 */
export function spatialLayerOf(graph: NormalizedSpatial, floorId: LevelId): SpatialLayer {
  const furniture: Furniture[] = [];
  const openings: Opening[] = [];
  const rooms: Room[] = [];
  const walls: Wall[] = [];

  for (const id of idsOnLevel(graph, floorId)) {
    const entity = graph.byId[id];

    if (entity === undefined) {
      continue;
    }

    if (isEntityOfKind('wall', entity)) {
      walls.push(entity);
    } else if (isEntityOfKind('opening', entity)) {
      openings.push(entity);
    } else if (isEntityOfKind('room', entity)) {
      rooms.push(entity);
    } else if (isEntityOfKind('furniture', entity)) {
      furniture.push(entity);
    }
  }

  return { furniture, openings, rooms, walls };
}

/** Dự án và tầng lượt ghi đi tới. `null` khi phiên làm việc chưa mở đủ cả hai. */
export interface PropertyInspectorSaveTarget {
  readonly projectId: string;
  readonly floorId: LevelId;
}

/** Mỗi phương thức là một việc panel cần từ bên ngoài, và không có việc nào khác. */
export interface PropertyInspectorGateway {
  /** Khả năng nào cổng này làm được, trả lời ĐỒNG BỘ — view phải biết trước lượt vẽ đầu. */
  readonly supports: Readonly<Record<PropertyInspectorCapability, boolean>>;
  /**
   * Lớp không gian của tầng, đọc BẤT ĐỒNG BỘ dưới khoá `queryKeys.space.byFloor`.
   *
   * Đây là nguồn của cờ tải và cờ hỏng (R-64) — `graph.read` bên dưới là lượt đọc
   * ĐỒNG BỘ của đồ thị đang sửa và nó không hỏng được (trả `null` khi kho trống),
   * nên nó không diễn tả được trạng thái tải. Cổng thật trả lại đúng đồ thị
   * `graph.read()` cho ra, không bịa một endpoint nào — cùng khuôn `readWallLayer`
   * của `wallLayerReviewGateway.ts:357`.
   */
  readonly readSpatialLayer: () => Promise<NormalizedSpatial | null>;
  /** Đồ thị đang sửa — nơi `commit` vừa ghi vào. */
  readonly graph: PropertyInspectorGraphPort;
  /**
   * Gửi lớp không gian của tầng đang mở lên máy chủ — lượt lưu THẬT của A7.
   *
   * Nhận đồ thị chứ không tự đọc kho: nơi gọi là `useAutosave`, và chính nó đã
   * cầm ảnh chụp `state.spatial` của đúng lượt lưu này. Cổng tự đọc lại sẽ là
   * một ảnh chụp thứ hai, có thể mới hơn thứ bộ đếm giờ vừa quyết định lưu.
   */
  readonly persistProperties: (
    graph: NormalizedSpatial,
  ) => Promise<PropertyInspectorCapabilityResult<SpatialLayer>>;
  /** Lưu bộ thuộc tính của đối tượng này thành một khuôn mẫu của dự án. */
  readonly copyAsTemplate: (
    entity: InspectableEntity,
  ) => Promise<PropertyInspectorCapabilityResult<PropertyTemplate>>;
  /** Dự án và tầng lượt ghi đi tới, đọc ĐỒNG BỘ; `null` khi chưa mở đủ. */
  readonly saveTarget: () => PropertyInspectorSaveTarget | null;
  /** Ai đang thao tác — đi vào `Command.actorId` và nhật ký hoạt động. */
  readonly actorId: string;
}

/** Ai thao tác khi nơi gọi không nói. */
export const PROPERTY_INSPECTOR_DEFAULT_ACTOR_ID = 'property-inspector-editor';

export interface CreatePropertyInspectorGatewayOptions {
  /** Đồ thị đang sửa. Vắng mặt thì cổng đọc store thật. */
  readonly graph?: PropertyInspectorGraphPort;
  readonly actorId?: string;
  /**
   * Máy khách API. Vắng mặt thì dùng `createAppApiClient()` — cùng một quyết
   * định thật/giả cho mọi màn (`src/api/appClient.ts`), không tự đoán lại.
   */
  readonly apiClient?: ApiClient;
  /**
   * Dự án và tầng lượt ghi đi tới. Vắng mặt thì đọc `projectSlice` của store.
   *
   * Là một HÀM chứ không phải một giá trị: người dùng đổi tầng giữa hai lượt
   * tự lưu, và một cổng dựng đúng một lần (`useMemo` của hook) sẽ giữ mãi cái
   * tầng đang mở lúc panel gắn.
   */
  readonly target?: () => PropertyInspectorSaveTarget | null;
}

/** Dự án và tầng đang mở, đọc thẳng store. `null` khi thiếu một trong hai. */
function storeSaveTarget(): PropertyInspectorSaveTarget | null {
  const state = useStore.getState();
  const projectId = state.project?.id;
  const floorId = state.activeFloorId;

  return projectId === undefined || projectId === '' || floorId === null
    ? null
    : { floorId, projectId };
}

/** Cổng thật — đọc store, ghi qua `dispatch`, lưu qua `src/api`. */
export function createPropertyInspectorGateway(
  options: CreatePropertyInspectorGatewayOptions,
): PropertyInspectorGateway {
  const graph = options.graph ?? { read: (): NormalizedSpatial | null => null };
  const apiClient = options.apiClient ?? createAppApiClient();
  const saveTarget = options.target ?? storeSaveTarget;

  return {
    supports: {
      readSpatialLayer: true,
      writeSpatialLayer: true,
      persistProperties: true,
      copyAsTemplate: true,
    },
    readSpatialLayer: () => Promise.resolve(graph.read()),
    graph,
    saveTarget,
    persistProperties: async (current) => {
      const target = saveTarget();

      if (target === null) {
        return { ok: false, reason: NO_SAVE_TARGET_REASON };
      }

      const result = await apiClient.spatial.writeLayer({
        body: spatialLayerOf(current, target.floorId),
        floorId: target.floorId,
        projectId: target.projectId,
      });

      return result.ok
        ? { data: result.data, ok: true }
        : { ok: false, reason: persistFailedReason(result.error.kind) };
    },
    copyAsTemplate: async (entity) => {
      const target = saveTarget();
      const draft = propertyTemplateDraftOf(entity);

      if (target === null || draft === null) {
        return { ok: false, reason: NO_SAVE_TARGET_REASON };
      }

      const result = await apiClient.propertyTemplates.create({
        body: draft,
        projectId: target.projectId,
      });

      return result.ok
        ? { data: result.data, ok: true }
        : { ok: false, reason: templateFailedReason(result.error.kind) };
    },
    actorId: options.actorId ?? PROPERTY_INSPECTOR_DEFAULT_ACTOR_ID,
  };
}
