import type { SpatialApi, SpatialLayer } from '@/api/client';
import {
  FloorLayerWriteSchema,
  type FloorLayerWriteBody,
  type FloorLayerWriteResult,
} from '@/api/schemas/spatialLayer';
import { isIdOfKind } from '@/domain/spatial/ids';
import { idsOnLevel, isEntityOfKind, type NormalizedSpatial } from '@/domain/spatial/normalize';
import type { Furniture, LevelId, Opening, Room, Wall } from '@/domain/spatial/types';
import { isTransientWireError, readWireError } from '@/lib/errors/wireError';
import type { HttpError } from '@/lib/http/types';
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
  scaleRedirtied: 'Tỉ lệ tầng này vừa đổi trong lúc bạn sửa. Tải lại để sửa trên số đo mới.',
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
  /** `scaleSent` chỉ có mặt (luôn `true`) khi thân mang tỉ lệ — kho gỡ `scaleStatus` của tầng. */
  onSaved(floorId: string, result: FloorLayerWriteResult, info: { redirtied: boolean; scaleSent?: true }): void;
  queue?: typeof runExclusive;
}

export interface FloorLayerSaver {
  markDirty(floorIds: readonly string[]): void;
  hasDirty(): boolean;
  flush(): Promise<void>;
  /**
   * Gửi tỉ lệ của một tầng qua #35, cùng khoá tầng với lớp (F-04x-2 bước 5). Tầng bị khối →
   * không gửi, ném lại lỗi đang giữ. Tầng bẩn → một PUT lớp + tỉ lệ, base của lớp (`hint` bị bỏ:
   * thân có `layer` mà base lấy từ N15 là đè im lặng). Tầng sạch → thân chỉ tỉ lệ, base nâng
   * theo `hint`. Hỏng → ném lỗi gốc; thân tỉ lệ không bao giờ bị giữ để tự gửi lại.
   */
  saveScale(floorId: string, ratio: number, hint?: number): Promise<void>;
  discardFloor(floorId: string): void;
  getBlock(floorId: string): LayerSaveBlock | null;
  blockedFloorIds(): string[];
  /** `listener` nhận bẩn ∪ đang gửi ∪ bản giữ ∪ bị khối — đúng `unsavedFloorIds` của kho. */
  subscribe(listener: (unsavedFloorIds: readonly string[]) => void): () => void;
  dispose(): void;
}

interface LayerWrite {
  readonly baseVersion: number;
  readonly body: FloorLayerWriteBody;
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
  /** Lỗi đã sinh ra khối — `saveScale` ném lại nó thay vì gửi. */
  const blockErrors = new Map<string, unknown>();
  const revisions = new Map<string, number>();
  /** Lượt `saveScale` đang bay — lỗi của chúng không về engine nào khác ngoài `flush` đang chờ. */
  const scaleTasks = new Set<Promise<FloorFailure | undefined>>();
  const listeners = new Set<(unsavedFloorIds: readonly string[]) => void>();
  let disposed = false;

  const layerBase = (floorId: string): number =>
    Math.max(revisions.get(floorId) ?? 0, ports.readRevision(floorId) ?? 0);

  const sendable = (floorId: string): boolean => dirty.has(floorId) && blocks.get(floorId)?.kind !== 'reload';

  const notify = (): void => {
    const unsaved = [...new Set([...dirty, ...inFlight.keys(), ...held.keys(), ...blocks.keys()])];

    listeners.forEach((listener) => listener(unsaved));
  };

  const send = async (floorId: string, write: LayerWrite, laterPending: boolean): Promise<FloorFailure | undefined> => {
    // Khối [6]: thân sai hợp đồng thì không gửi — gửi đi chỉ tiêu một `baseVersion` để nhận 422.
    const parsed = FloorLayerWriteSchema.safeParse(write);
    const scaleSent = write.body.scaleMillimetresPerPixel !== undefined;
    let error: unknown;
    let kind: LayerSaveErrorClass = 'blocked';

    if (!parsed.success) {
      // Lỗi hình dây 422, không phải `ZodError`: lỗi không đọc được bị coi là tạm thời,
      // và engine sẽ thử lại 5/15/45 s một thân không bao giờ hợp lệ.
      const invalid: HttpError = { code: 'VALIDATION', kind: 'http', raw: parsed.error.issues, requestId: '', retryable: false, status: 422 };

      error = invalid;
    } else {
      try {
        const result = await ports.writeLayer({ ...write, floorId, projectId });

        if (result.ok) {
          const redirtied = laterPending || dirty.has(floorId);

          revisions.set(floorId, result.data.revision);
          blocks.delete(floorId);
          blockErrors.delete(floorId);

          if (scaleSent && redirtied) {
            // Máy chủ vừa quy đổi lại mm theo tỉ lệ mới; sửa đang chờ còn ở tỉ lệ cũ — gửi là đè.
            blocks.set(floorId, { kind: 'reload', message: LAYER_SAVE_MESSAGES.scaleRedirtied });
            blockErrors.set(floorId, new Error(LAYER_SAVE_MESSAGES.scaleRedirtied));
          }

          if (!disposed) {
            ports.onSaved(floorId, result.data, scaleSent ? { redirtied, scaleSent } : { redirtied });
          }

          return undefined;
        }

        error = result.error;
      } catch (thrown) {
        error = thrown;
      }

      kind = classifyLayerSaveError(error);
    }

    if (kind === 'temporary') {
      // Thân tỉ lệ không được giữ: màn đã báo hỏng, tự gửi lại về sau là ghi điều người dùng không thấy.
      if (!scaleSent) {
        held.set(floorId, write);
      } else if (write.body.layer) {
        dirty.add(floorId);
      }
    } else if (!scaleSent || write.body.layer) {
      // Thân chỉ tỉ lệ hỏng không khoá lớp: lỗi về tay màn đã bấm áp.
      blocks.set(floorId, { kind, message: blockMessageOf(kind, error) });
      blockErrors.set(floorId, error);
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

    return send(floorId, { baseVersion: layerBase(floorId), body: { layer } }, false);
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

    return track(floorId, () => run(floorId, first, layer));
  };

  /** Chạy `task` dưới khoá tầng, tính nó vào "đang gửi" tới khi xong. */
  const track = (floorId: string, task: () => Promise<FloorFailure | undefined>): Promise<FloorFailure | undefined> => {
    const settled = queue(`layer:${projectId}:${floorId}`, task).finally(() => {
      if (inFlight.get(floorId) === settled) {
        inFlight.delete(floorId);
      }

      notify();
    });

    inFlight.set(floorId, settled);

    return settled;
  };

  /** Thân của `saveScale`, chụp TRONG khoá tầng — sau mọi PUT lớp đang bay của tầng ấy. */
  const scaleWrite = (floorId: string, ratio: number, hint: number | undefined): Promise<FloorFailure | undefined> => {
    const block = blocks.get(floorId);

    if (block) {
      return Promise.resolve({ error: blockErrors.get(floorId) ?? new Error(block.message), kind: block.kind });
    }

    const pending = held.get(floorId);
    const layer = (sendable(floorId) ? ports.readLayer(floorId) : null) ?? pending?.body.layer;

    held.delete(floorId);

    if (layer) {
      dirty.delete(floorId);

      // Bản giữ mang base của lần chụp; lượt hỏng tạm không đổi revision nên hai số bằng nhau.
      return send(
        floorId,
        { baseVersion: pending?.baseVersion ?? layerBase(floorId), body: { layer, scaleMillimetresPerPixel: ratio } },
        false,
      );
    }

    return send(
      floorId,
      { baseVersion: Math.max(layerBase(floorId), hint ?? 0), body: { scaleMillimetresPerPixel: ratio } },
      false,
    );
  };

  return {
    blockedFloorIds: () => [...blocks.keys()],
    discardFloor(floorId) {
      dirty.delete(floorId);
      held.delete(floorId);
      blocks.delete(floorId);
      blockErrors.delete(floorId);
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

      const waiting = [...inFlight.entries()];
      const sent = [...new Set([...dirty, ...held.keys()])].map(flushFloor);

      notify();

      // PUT lớp + tỉ lệ của `saveScale` đang bay hỏng tạm và trả tầng về bẩn: flush không
      // được báo "đã lưu" — engine phải thử lại theo lịch (review-1 P2-3). Lỗi của một flush
      // khác thì flush ấy tự báo, không tính lại ở đây.
      const waited = await Promise.all(
        waiting.map(async ([floorId, settled]) => {
          const fromScale = scaleTasks.has(settled);
          const failure = await settled;
          const redirtied = dirty.has(floorId) || held.has(floorId);

          return fromScale && failure?.kind === 'temporary' && redirtied ? failure : undefined;
        }),
      );
      const failures = [...waited, ...(await Promise.all(sent))].filter((failure) => failure !== undefined);
      const failure = failures.find(({ kind }) => kind === 'temporary') ?? failures[0];

      if (failure) {
        throw failure.error;
      }
    },
    getBlock: (floorId) => blocks.get(floorId) ?? null,
    async saveScale(floorId, ratio, hint) {
      const settled = track(floorId, () => scaleWrite(floorId, ratio, hint));

      scaleTasks.add(settled);
      const failure = await settled.finally(() => scaleTasks.delete(settled));

      if (failure) {
        throw failure.error;
      }
    },
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
