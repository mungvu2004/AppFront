/**
 * Selector đọc ĐỒ THỊ: diện tích phòng, đối tượng đang chọn, bản nháp đang treo.
 *
 * Tách khỏi `./selectors.ts` vì một lý do đo được. `selectors.ts` gọi `runRules`,
 * nên mọi module nhập nó — kể cả nhập đúng một hàm không dính gì tới luật, như
 * `selectDraftPreviewGraph` mà màn xem 3D dùng — đều kéo `domain/rules/runner`
 * cùng ba gói luật của nó vào bao đóng nhập tĩnh của màn ấy. Cổng kích thước gói
 * đo đúng chỗ đó: `screens/viewer/Viewer3D` trả 10,2 KiB gzip cho một engine nó
 * không bao giờ chạy.
 *
 * Chiều nhập là MỘT chiều: `selectors.ts` nhập file này rồi tái xuất, không có
 * chiều ngược lại. Màn nào cần luật thì nhập `./selectors`; màn nào chỉ đọc đồ
 * thị thì nhập thẳng file này và không trả gì cho phần luật. Thêm một `import`
 * từ `./selectors` vào đây là xoá sạch tác dụng của việc tách.
 *
 * Quy tắc ghi nhớ giữ nguyên như cũ: không selector nào cấp phát khi đầu vào
 * không đổi, và một selector trả về tập hợp thì giữ nguyên tham chiếu cũ khi kết
 * quả mới bằng nông với nó — nên canvas gọi được mỗi khung hình.
 */

import { computeArea, totalArea } from '../domain/rooms/area';
import {
  isEntityOfKind,
  type NormalizedSpatial,
  type SpatialEntity,
} from '../domain/spatial/normalize';
import type { EntityId, Point, Room } from '../domain/spatial/types';
import type { PointMm } from '../domain/units/compare';
import { millimetres, type SquareMetres } from '../domain/units/types';
import { draftEntityId, type DraftOperation } from './draftSlice';
import type { RootState } from './index';
import { keepIfShallowEqualArray, memoizeLatest } from './memoize';

const EMPTY_ROOMS_WITH_AREA: readonly RoomWithArea[] = Object.freeze([]);
const EMPTY_ENTITIES: readonly SpatialEntity[] = Object.freeze([]);
const EMPTY_DRAFT_IDS: readonly EntityId[] = Object.freeze([]);

let lastDraftIds: readonly EntityId[] | null = null;

/* -------------------------------------------------------------------------- */
/* Rooms and areas.                                                            */
/* -------------------------------------------------------------------------- */

/** A room together with its area as the domain computes it from the outline. */
export interface RoomWithArea {
  readonly room: Room;
  readonly areaM2: SquareMetres;
}

const pointToMm = (point: Point): PointMm => ({ x: millimetres(point.x), y: millimetres(point.y) });

const outlineCache = new WeakMap<Room, readonly PointMm[]>();

const outlineOf = (room: Room): readonly PointMm[] => {
  let outline = outlineCache.get(room);

  if (outline === undefined) {
    outline = room.outline.map(pointToMm);
    outlineCache.set(room, outline);
  }

  return outline;
};

const roomEntryCache = new WeakMap<Room, RoomWithArea>();

const roomWithArea = (room: Room): RoomWithArea => {
  let entry = roomEntryCache.get(room);

  if (entry === undefined) {
    entry = { room, areaM2: computeArea(outlineOf(room)) };
    roomEntryCache.set(room, entry);
  }

  return entry;
};

let lastRoomsWithArea: readonly RoomWithArea[] | null = null;

const roomsWithAreaOf = memoizeLatest((spatial: NormalizedSpatial | null): readonly RoomWithArea[] => {
  if (spatial === null) {
    return EMPTY_ROOMS_WITH_AREA;
  }

  const entries: RoomWithArea[] = [];

  for (const id of spatial.byKind.room) {
    const entity = spatial.byId[id];

    if (entity !== undefined && isEntityOfKind('room', entity)) {
      entries.push(roomWithArea(entity));
    }
  }

  lastRoomsWithArea = keepIfShallowEqualArray(lastRoomsWithArea, entries);

  return lastRoomsWithArea;
});

/** Every room of the loaded floor, each with its computed area. */
export const selectRoomsWithArea = (state: RootState): readonly RoomWithArea[] =>
  roomsWithAreaOf(state.spatial);

const totalAreaOf = memoizeLatest((rooms: readonly RoomWithArea[]): SquareMetres =>
  totalArea(rooms.map((entry) => outlineOf(entry.room))),
);

/**
 * The total area of every room, summed in mm² and rounded once by the domain —
 * deliberately not the sum of the already-rounded per-room figures.
 */
export const selectTotalAreaM2 = (state: RootState): SquareMetres =>
  totalAreaOf(roomsWithAreaOf(state.spatial));

/* -------------------------------------------------------------------------- */
/* Selection.                                                                  */
/* -------------------------------------------------------------------------- */

let lastSelectedEntities: readonly SpatialEntity[] | null = null;

const selectedEntitiesOf = memoizeLatest(
  (spatial: NormalizedSpatial | null, selectedIds: readonly EntityId[]): readonly SpatialEntity[] => {
    if (spatial === null || selectedIds.length === 0) {
      return EMPTY_ENTITIES;
    }

    const entities: SpatialEntity[] = [];

    for (const id of selectedIds) {
      const entity = spatial.byId[id];

      if (entity !== undefined) {
        entities.push(entity);
      }
    }

    lastSelectedEntities = keepIfShallowEqualArray(lastSelectedEntities, entities);

    return lastSelectedEntities;
  },
);

/**
 * The selected entities in full, resolved from the ids the selection slice
 * stores. Ids pointing at nothing (just-deleted entities) are skipped.
 */
export const selectSelectedEntities = (state: RootState): readonly SpatialEntity[] =>
  selectedEntitiesOf(state.spatial, state.selectedIds);

/* -------------------------------------------------------------------------- */
/* Draft: the unconfirmed edit, read as a graph.                               */
/* -------------------------------------------------------------------------- */

/**
 * The saved graph with the staged operations laid over it.
 *
 * A draft carries whole entities (`draftSlice`), so laying one over the graph is
 * a replacement in `byId` and nothing else: no index is rebuilt, because a
 * preview never changes what kind a thing is nor which storey it stands on — it
 * is the same wall, thicker. That is what makes this cheap enough to run on
 * every frame of a drag.
 *
 * `null` when nothing is staged, and that is the answer a consumer wants: it
 * says "there is no preview" without asking the consumer to compare two graphs
 * to find out. The saved graph is never mutated and never re-normalized, so the
 * real one keeps its identity and nothing downstream of `state.spatial`
 * re-renders because somebody previewed something.
 *
 * A create-draft is skipped here rather than added to the graph: nothing in the
 * product stages one yet, and inventing an index entry for an entity that has
 * no saved counterpart would be writing a path no caller walks.
 */
const draftGraphOf = memoizeLatest(
  (
    spatial: RootState['spatial'],
    operations: readonly DraftOperation[],
  ): RootState['spatial'] => {
    if (spatial === null || operations.length === 0) {
      return null;
    }

    const byId: Record<string, SpatialEntity> = { ...spatial.byId };
    let replaced = 0;

    for (const operation of operations) {
      if (operation.kind !== 'editEntity' || byId[operation.entityId] === undefined) {
        continue;
      }

      byId[operation.entityId] = operation.preview;
      replaced += 1;
    }

    return replaced === 0 ? null : { ...spatial, byId };
  },
);

/**
 * The saved graph with the unconfirmed edit applied, or `null` when there is
 * none — the graph a 3D preview draws from.
 */
export const selectDraftPreviewGraph = (state: RootState): RootState['spatial'] =>
  draftGraphOf(state.spatial, state.draftOperations);

const draftIdsOf = memoizeLatest(
  (operations: readonly DraftOperation[]): readonly EntityId[] => {
    if (operations.length === 0) {
      return EMPTY_DRAFT_IDS;
    }

    const ids = operations.map(draftEntityId);

    lastDraftIds = keepIfShallowEqualArray(lastDraftIds, ids);

    return lastDraftIds;
  },
);

/** Which entities the staged operations are about, in the order they were made. */
export const selectDraftEntityIds = (state: RootState): readonly EntityId[] =>
  draftIdsOf(state.draftOperations);

/** Drops the caches this file owns; `resetSelectorCaches` calls it. */
export const resetGraphSelectorCaches = (): void => {
  lastRoomsWithArea = null;
  lastSelectedEntities = null;
  lastDraftIds = null;
};
