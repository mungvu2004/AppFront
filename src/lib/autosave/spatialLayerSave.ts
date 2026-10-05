import type { SpatialApi, SpatialLayer } from '@/api/client';
import { FloorLayerWriteSchema, type FloorLayerWriteResult } from '@/api/schemas/spatialLayer';
import { isIdOfKind } from '@/domain/spatial/ids';
import { idsOnLevel, isEntityOfKind, type NormalizedSpatial } from '@/domain/spatial/normalize';
import type { Furniture, LevelId, Opening, Room, Wall } from '@/domain/spatial/types';
import { isTransientWireError, readWireError } from '@/lib/errors/wireError';
import { runExclusive } from '@/lib/mutations/entityQueue';

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

/**
 * Các tầng của `next` có thực thể hoặc mảng `byLevel` khác tham chiếu với `previous` —
 * đích lưu là mọi tầng có thứ bị đổi, không phải tầng đang xem (B-V8-41). So tham
 * chiếu là đủ: `applyPatch` chỉ chép mảng `byLevel` và thực thể bị chạm.
 * Chỉ duyệt tầng còn trong `next`.
 * ponytail: trục và kích thước cũng nằm trong `byLevel`; đổi chúng sinh một PUT thừa, vô hại.
 */
export function changedLevelIds(previous: NormalizedSpatial, next: NormalizedSpatial): LevelId[] {
  return next.byKind.level.filter((levelId): levelId is LevelId => {
    if (!isIdOfKind('level', levelId)) {
      return false;
    }

    const ids = idsOnLevel(next, levelId);

    return idsOnLevel(previous, levelId) !== ids || ids.some((id) => previous.byId[id] !== next.byId[id]);
  });
}

/** Ba ngả của một lượt lưu lớp hỏng (prompt F-04x-1 khối [2]). */
export type LayerSaveErrorClass = 'reload' | 'blocked' | 'temporary';

/** Khối của một tầng: `reload` chờ `discardFloor`, `blocked` chờ một `markDirty` mới. */
export interface LayerSaveBlock {
  readonly kind: 'reload' | 'blocked';
  readonly message: string;
}

/** Câu người đọc của khối — việc D chép sang khối `floorLayerSave` của `vi.json`. */
export const LAYER_SAVE_MESSAGES = {
  forbidden: 'Bạn không còn quyền sửa tầng này.',
  integrity: (count: number): string => `Tầng này có ${count} chỗ hỏng liên kết hình học nên chưa lưu được.`,
  reload: 'Tầng này vừa được sửa ở nơi khác. Tải lại để xem bản mới nhất.',
  unknown: 'Không lưu được thay đổi của tầng này.',
} as const;

/** 409 và 422 `baseVersion` → tải lại (R6); lỗi tạm (mạng, timeout, 503) → thử lại; còn lại → khối. */
export function classifyLayerSaveError(error: unknown): LayerSaveErrorClass {
  const wire = readWireError(error);

  if (wire?.status === 409 || (wire?.status === 422 && wire.field === 'baseVersion')) {
    return 'reload';
  }

  return isTransientWireError(error) ? 'temporary' : 'blocked';
}

const blockMessageOf = (kind: LayerSaveBlock['kind'], error: unknown): string => {
  const wire = readWireError(error);
  const raw: unknown = typeof error === 'object' && error !== null && 'raw' in error ? error.raw : null;
  const count = typeof raw === 'object' && raw !== null && 'count' in raw ? raw.count : undefined;

  if (kind === 'reload') {
    return LAYER_SAVE_MESSAGES.reload;
  }

  if (wire?.status === 403) {
    return LAYER_SAVE_MESSAGES.forbidden;
  }

  return wire?.code === 'LAYER_INTEGRITY_BROKEN' && typeof count === 'number'
    ? LAYER_SAVE_MESSAGES.integrity(count)
    : LAYER_SAVE_MESSAGES.unknown;
};

export interface FloorLayerSaverPorts {
  writeLayer: SpatialApi['writeLayer'];
  readLayer(floorId: string): SpatialLayer | null;
  readRevision(floorId: string): number | null;
  onSaved(floorId: string, result: FloorLayerWriteResult, info: { redirtied: boolean }): void;
  queue?: typeof runExclusive;
}

export interface FloorLayerSaver {
  markDirty(floorIds: readonly string[]): void;
  hasDirty(): boolean;
  flush(): Promise<void>;
  discardFloor(floorId: string): void;
  getBlock(floorId: string): LayerSaveBlock | null;
  blockedFloorIds(): string[];
  /** `listener` nhận bẩn ∪ đang gửi ∪ bản giữ ∪ bị khối — đúng `unsavedFloorIds` của kho. */
  subscribe(listener: (unsavedFloorIds: readonly string[]) => void): () => void;
  dispose(): void;
}

interface LayerWrite {
  readonly baseVersion: number;
  readonly body: SpatialLayer;
}

interface FloorFailure {
  readonly error: unknown;
  readonly kind: LayerSaveErrorClass;
}

/**
 * Bộ lưu lớp DUY NHẤT của một người–dự án (F-04x-1 bước 4). Không đọc N16: base là
 * `max(revision lượt thành công gần nhất, readRevision)` — revision của chính lượt đọc
 * đã sinh đồ thị trong kho, nên sửa của người khác sau lượt đọc ấy ra 409 thay vì bị đè.
 * Lỗi tạm giữ nguyên `{ baseVersion, body }`; lượt sau gửi lại đúng thân ấy trước (C09b).
 */
export function createFloorLayerSaver(projectId: string, ports: FloorLayerSaverPorts): FloorLayerSaver {
  const queue = ports.queue ?? runExclusive;
  const dirty = new Set<string>();
  const held = new Map<string, LayerWrite>();
  const inFlight = new Map<string, Promise<FloorFailure | undefined>>();
  const blocks = new Map<string, LayerSaveBlock>();
  const revisions = new Map<string, number>();
  const listeners = new Set<(unsavedFloorIds: readonly string[]) => void>();
  let disposed = false;

  const sendable = (floorId: string): boolean => dirty.has(floorId) && blocks.get(floorId)?.kind !== 'reload';

  const notify = (): void => {
    const unsaved = [...new Set([...dirty, ...inFlight.keys(), ...held.keys(), ...blocks.keys()])];

    listeners.forEach((listener) => listener(unsaved));
  };

  const send = async (floorId: string, write: LayerWrite, laterPending: boolean): Promise<FloorFailure | undefined> => {
    // Khối [6]: thân sai hợp đồng thì không gửi — gửi đi chỉ tiêu một `baseVersion` để nhận 422.
    const parsed = FloorLayerWriteSchema.safeParse({ baseVersion: write.baseVersion, body: { layer: write.body } });

    if (!parsed.success) {
      blocks.set(floorId, { kind: 'blocked', message: LAYER_SAVE_MESSAGES.unknown });

      return { error: parsed.error, kind: 'blocked' };
    }

    let error: unknown;

    try {
      const result = await ports.writeLayer({ ...write, floorId, projectId });

      if (result.ok) {
        revisions.set(floorId, result.data.revision);
        blocks.delete(floorId);

        if (!disposed) {
          ports.onSaved(floorId, result.data, { redirtied: laterPending || dirty.has(floorId) });
        }

        return undefined;
      }

      error = result.error;
    } catch (thrown) {
      error = thrown;
    }

    const kind = classifyLayerSaveError(error);

    if (kind === 'temporary') {
      held.set(floorId, write);
    } else {
      blocks.set(floorId, { kind, message: blockMessageOf(kind, error) });
    }

    return { error, kind };
  };

  const run = async (
    floorId: string,
    first: LayerWrite | undefined,
    layer: SpatialLayer | null,
  ): Promise<FloorFailure | undefined> => {
    if (first) {
      const failure = await send(floorId, first, layer !== null);

      if (failure) {
        // Thân mới chưa gửi: lượt sau chụp lại từ kho. Khối thì chờ `markDirty`/`discardFloor`.
        if (failure.kind === 'temporary' && layer) {
          dirty.add(floorId);
        }

        return failure;
      }
    }

    if (!layer) {
      return undefined;
    }

    const baseVersion = Math.max(revisions.get(floorId) ?? 0, ports.readRevision(floorId) ?? 0);

    return send(floorId, { baseVersion, body: layer }, false);
  };

  /** Chụp ĐỒNG BỘ bản giữ và lớp của tầng; không có gì để gửi thì trả `undefined`. */
  const flushFloor = (floorId: string): Promise<FloorFailure | undefined> | undefined => {
    const first = held.get(floorId);
    // `readLayer` null (kho thiếu tầng) → giữ bẩn, không PUT: một PUT rỗng xoá sạch tầng.
    const layer = sendable(floorId) ? ports.readLayer(floorId) : null;

    if (!first && !layer) {
      return undefined;
    }

    held.delete(floorId);

    if (layer) {
      dirty.delete(floorId);
    }

    const settled = queue(`layer:${projectId}:${floorId}`, () => run(floorId, first, layer)).finally(() => {
      if (inFlight.get(floorId) === settled) {
        inFlight.delete(floorId);
      }

      notify();
    });

    inFlight.set(floorId, settled);

    return settled;
  };

  return {
    blockedFloorIds: () => [...blocks.keys()],
    discardFloor(floorId) {
      dirty.delete(floorId);
      held.delete(floorId);
      blocks.delete(floorId);
      notify();
    },
    dispose() {
      disposed = true;
      listeners.clear();
    },
    async flush() {
      if (disposed) {
        return;
      }

      const waiting = [...inFlight.values()];
      const sent = [...new Set([...dirty, ...held.keys()])].map(flushFloor);

      notify();
      await Promise.all(waiting);

      const failures = (await Promise.all(sent)).filter((failure) => failure !== undefined);
      const failure = failures.find(({ kind }) => kind === 'temporary') ?? failures[0];

      if (failure) {
        throw failure.error;
      }
    },
    getBlock: (floorId) => blocks.get(floorId) ?? null,
    hasDirty: () => held.size > 0 || inFlight.size > 0 || [...dirty].some(sendable),
    markDirty(floorIds) {
      floorIds.forEach((floorId) => dirty.add(floorId));
      notify();
    },
    subscribe(listener) {
      listeners.add(listener);

      return () => {
        listeners.delete(listener);
      };
    },
  };
}
