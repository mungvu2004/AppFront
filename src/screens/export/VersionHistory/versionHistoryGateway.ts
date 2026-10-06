/**
 * Cổng dữ liệu của S-33 — lịch sử phiên bản THEO TẦNG (N16–N20, B3-04). Thuần: không
 * React, không JSX, chạy và test được ngoài một cây React.
 *
 * ## Bốn luật của cổng này (HOP-DONG-MOI §1.1, §5)
 *
 * 1. **`baseVersion` là `revision` của tầng, không phải `sequence`.** Cổng không tự đọc nó:
 *    hook đưa vào (`floorMeta[floorId].revision`, vắng thì N16). Lấy nhầm `sequence` là ghi
 *    đè im lặng lên việc người khác vừa làm.
 * 2. **409 và 422 `field:"baseVersion"` là `kind: 'conflict'`, không bao giờ trộn.** Phục hồi
 *    là thao tác trên cả tầng; bộ trộn xung đột của `@/lib/versioning/conflict` không có chỗ ở đây. `remoteChanges` chỉ dùng
 *    để nói AI vừa đổi (`changedByName`). Mọi lỗi khác ném `toAppError(...)`, giữ `code`
 *    của máy chủ để hook rẽ theo (R1).
 * 3. **Cổng không giữ trang nào trong bao đóng.** N17 là `useInfiniteQuery` của hook; cổng chỉ
 *    đọc một trang khi được gọi. Hoàn tác đọc lại N17 chứ không tin bản nhớ.
 * 4. **N18 "không còn nội dung" không phải lỗi màn:** `VERSION_SNAPSHOT_PURGED` và
 *    `VERSION_FLOOR_MISMATCH` thành `{ kind: 'purged' }`.
 *
 * Hai khả năng dựng cảnh (`canShowCurrentModel3d`, `canHighlightEntity`) đứng trên
 * `mountViewerScene` và dựng mô hình HIỆN TẠI, không dựng lại bản cũ (`types.ts`, mục 1).
 * Xuất một phiên bản là điều hướng sang S-34 — `canExportVersion` do nơi ráp quyết.
 */

import type { ApiClient, ApiResult } from '@/api/client';
import { VersionConflictBodySchema } from '@/api/schemas/errors';
import type { FloorVersionSummary } from '@/api/schemas/versions';
import { toAppError } from '@/lib/errors/toAppError';
import { readWireError } from '@/lib/errors/wireError';
import { createUndoTicket, type UndoTicket } from '@/lib/mutations/undoTicket';
import { queryKeys } from '@/lib/query/queryKeys';
import { diffVersions, type VersionDiff } from '@/lib/versioning/diff';
import { MAX_FULL_VERSIONS, type VersionHistoryEntry, type VersionMetadata } from '@/lib/versioning/restore';

import type {
  ConflictNoticeModel,
  RestoreOutcome,
  VersionHistoryCapabilities,
  VersionHistoryGateway,
  VersionPage,
  VersionSnapshotRead,
} from './types';
import { toVersionSnapshot } from './versionSnapshotAdapter';

/* -------------------------------------------------------------------------- */
/* 1 — Khoá, hằng                                                             */
/* -------------------------------------------------------------------------- */

/** Khoá N17 của một tầng. Không đổi chữ ký: `invalidation.ts` vô hiệu nó sau `restoreVersion`. */
export const versionsQueryKey = (floorId: string) => queryKeys.version.byFloor(floorId);

/** Số bản một trang N17 (BE cho tới 200). */
export const VERSION_PAGE_LIMIT = 50;

/** Câu của hàng chỉ còn siêu dữ liệu — nói ra chính sách lưu giữ, không nói "tải hỏng". */
export const RETENTION_NOTICE = `Chỉ ${MAX_FULL_VERSIONS} phiên bản gần nhất còn giữ đủ nội dung; bản này chỉ còn siêu dữ liệu nên không so sánh và không phục hồi được`;

/** Câu ném ra khi so sánh chạm vào một phiên bản không còn ảnh chụp. */
export const SNAPSHOT_MISSING_REASON =
  'Phiên bản này không còn ảnh chụp nội dung, nên không so sánh và không phục hồi được';

/** Câu nói ra khi N17 không trả được lịch sử. */
export const VERSION_LIST_FAILED_REASON = 'Máy chủ chưa trả được lịch sử phiên bản của tầng này';

/** N18 "không còn nội dung" — hàng thành siêu dữ liệu, màn không `error`. */
const PURGED_CODES: ReadonlySet<string> = new Set(['VERSION_SNAPSHOT_PURGED', 'VERSION_FLOOR_MISMATCH']);

/* -------------------------------------------------------------------------- */
/* 2 — Phép chuyển thuần                                                      */
/* -------------------------------------------------------------------------- */

/** Số chữ cái một `Avatar` không ảnh hiện được. */
const INITIALS_LENGTH = 2;

/** Chữ cái đầu của một cái tên, cho ô đại diện không ảnh; không chữ nào thì chuỗi rỗng. */
export function initialsOf(name: string): string {
  const words = name.trim().split(/\s+/u).filter((word) => word.length > 0);
  if (words.length === 0) {
    return '';
  }

  const first = words[0] ?? '';
  const last = words[words.length - 1] ?? '';
  const letters = words.length === 1 ? first.slice(0, 1) : `${first.slice(0, 1)}${last.slice(0, 1)}`;

  return letters.slice(0, INITIALS_LENGTH).toLocaleUpperCase('vi-VN');
}

/** Bản tóm tắt N17 thành siêu dữ liệu phiên bản của `@/lib/versioning`. */
export function toVersionMetadata(summary: FloorVersionSummary): VersionMetadata {
  return {
    createdAt: summary.createdAt,
    creatorId: summary.creatorId,
    creatorName: summary.creatorName,
    id: summary.id,
    ...(summary.note !== undefined ? { note: summary.note } : {}),
    sequence: summary.sequence,
  };
}

/** Ảnh chụp đầy đủ của một mục lịch sử, hoặc `null` khi mục đó chưa có nội dung. */
export function readFullVersion(history: readonly VersionHistoryEntry[], versionId: string) {
  const entry = history.find((item) => item.version.id === versionId);

  return entry !== undefined && entry.kind === 'full' ? entry.version : null;
}

/** Tiêu đề dải xung đột (prompt 4.3). `actorName` là tiêu đề, như `writeErrorNotice`. */
export const CONFLICT_TITLE = 'Tầng vừa đổi ở nơi khác';

/** Dải xung đột: tiêu đề cố định, câu thân nêu `changedByName` đầu tiên (vắng thì "Người khác"). Không nhánh ghi đè. */
export function toConflictNotice(changedByName: string | null): ConflictNoticeModel {
  return {
    actorName: CONFLICT_TITLE,
    message: `${changedByName ?? 'Người khác'} đã sửa tầng này sau lúc bạn mở trang, nên lượt phục hồi chưa được ghi. Tải lại để xem bản mới nhất.`,
    detail: null,
    dismissLabel: 'Tải lại',
  };
}

/** Phiếu hoàn tác hết hạn (thường vì hộp thoại A9 chờ quá lâu) — không phải người khác sửa. */
export const UNDO_EXPIRED_NOTICE: ConflictNoticeModel = {
  actorName: 'Đã hết thời gian hoàn tác',
  message: 'Lượt phục hồi này không còn hoàn tác được. Tải lại để xem bản mới nhất của tầng.',
  detail: null,
  dismissLabel: 'Tải lại',
};

/** Phiếu đã dùng (bấm "Hoàn tác" hai lần) — lượt đầu đã hoàn tác, không phải hết giờ. */
export const UNDO_USED_NOTICE: ConflictNoticeModel = {
  actorName: 'Lượt phục hồi đã được hoàn tác',
  message: 'Bạn đã hoàn tác lượt phục hồi này rồi. Tải lại để xem bản mới nhất của tầng.',
  detail: null,
  dismissLabel: 'Tải lại',
};

/**
 * N19 hỏng thành `conflict` khi đúng là xung đột (409, 422 `field:"baseVersion"`); không thì
 * `null` và nơi gọi ném lỗi gốc.
 */
function conflictOf(error: unknown): RestoreOutcome | null {
  const wire = readWireError(error);

  if (wire?.status === 409 && wire.code === 'VERSION_CONFLICT') {
    const raw = typeof error === 'object' && error !== null && 'raw' in error ? error.raw : undefined;
    const body = VersionConflictBodySchema.safeParse(raw);
    const name = body.success ? (body.data.remoteChanges[0]?.changedByName ?? null) : null;

    return { kind: 'conflict', conflict: toConflictNotice(name) };
  }

  if (wire?.status === 422 && wire.code === 'VALIDATION' && wire.field === 'baseVersion') {
    return { kind: 'conflict', conflict: toConflictNotice(null) };
  }

  return null;
}

function unwrap<T>(result: ApiResult<T>): T {
  if (!result.ok) {
    throw toAppError(result.error);
  }

  return result.data;
}

/* -------------------------------------------------------------------------- */
/* 3 — Cổng                                                                   */
/* -------------------------------------------------------------------------- */

export interface CreateVersionHistoryGatewayOptions {
  readonly apiClient: Pick<ApiClient, 'spatial' | 'versions'>;
  readonly projectId: string;
  readonly floorId: string;
  /** Nơi ráp có đường xuất một phiên bản (điều hướng S-34). Mặc định `false`. */
  readonly canExportVersion?: boolean;
  /** Đồng hồ của phiếu hoàn tác — bơm được cho test. */
  readonly now?: () => Date;
}

/** Thứ hoàn tác một lượt phục hồi cần: bản "sau" và `revision` tầng mà N19 trả. */
interface RestoreReceipt {
  readonly afterSequence: number;
  readonly floorRevision: number;
}

export function createVersionHistoryGateway(options: CreateVersionHistoryGatewayOptions): VersionHistoryGateway {
  const { apiClient, floorId, projectId } = options;
  const receipts = new WeakMap<UndoTicket, RestoreReceipt>();
  /** Phiếu đang có N19 ngược bay — bấm đúp không gửi lượt thứ hai. */
  const reverting = new WeakSet<UndoTicket>();

  const capabilities: VersionHistoryCapabilities = {
    canShowCurrentModel3d: true,
    canHighlightEntity: true,
    canTagVersion: true,
    canGroupByAuthor: false,
    canExportVersion: options.canExportVersion ?? false,
  };

  const listVersionPage = async ({ cursor }: { readonly cursor?: string }): Promise<VersionPage> => {
    const read = (from?: string) =>
      apiClient.versions.list({
        floorId,
        projectId,
        limit: VERSION_PAGE_LIMIT,
        ...(from !== undefined ? { cursor: from } : {}),
      });
    let result = await read(cursor);

    // R7: con trỏ hết hạn → đọc lại trang đầu MỘT lần; hook gộp theo id nên không nhân đôi.
    if (!result.ok && cursor !== undefined && readWireError(result.error)?.code === 'CURSOR_INVALID') {
      result = await read();
    }

    return unwrap(result);
  };

  const readSnapshot = async (versionId: string): Promise<VersionSnapshotRead> => {
    const result = await apiClient.versions.snapshot({ floorId, projectId, versionId });

    if (!result.ok) {
      const code = readWireError(result.error)?.code;

      if (code !== undefined && PURGED_CODES.has(code)) {
        return { kind: 'purged' };
      }
    }

    return { kind: 'snapshot', snapshot: toVersionSnapshot(unwrap(result)) };
  };

  const send = async (versionId: string, baseVersion: number): Promise<RestoreOutcome & { sequence?: number }> => {
    const result = await apiClient.versions.restore({ baseVersion, floorId, projectId, versionId });

    if (!result.ok) {
      const conflict = conflictOf(result.error);

      if (conflict !== null) {
        return conflict;
      }

      throw toAppError(result.error);
    }

    return {
      kind: 'restored',
      floorRevision: result.data.floorRevision,
      restoredVersionId: result.data.id,
      sequence: result.data.sequence,
      unchanged: result.data.floorRevision === baseVersion,
    };
  };

  const restore = async (versionId: string, baseVersion: number): Promise<RestoreOutcome> => {
    const { sequence, ...outcome } = await send(versionId, baseVersion);

    if (outcome.kind !== 'restored' || outcome.unchanged === true || sequence === undefined) {
      return outcome;
    }

    const undoTicket = createUndoTicket({
      description: 'Hoàn tác lượt phục hồi phiên bản',
      ...(options.now !== undefined ? { now: () => (options.now?.() ?? new Date()).getTime() } : {}),
      undo: () => undefined,
    });

    receipts.set(undoTicket, { afterSequence: sequence, floorRevision: outcome.floorRevision ?? baseVersion });

    return { ...outcome, undoTicket };
  };

  /**
   * Hoàn tác = N19 ngược: đích là bản có `sequence` lớn nhất nhỏ hơn bản "sau", `baseVersion`
   * là `floorRevision` mà N19 vừa trả. Không thấy đích → không gửi, `conflict`; phiếu hết hạn →
   * `conflict` với câu riêng {@link UNDO_EXPIRED_NOTICE}; phiếu đã dùng hoặc đang có lượt bay →
   * {@link UNDO_USED_NOTICE}. Phiếu chỉ thành `used` khi N19 ngược có câu trả lời; lỗi ném (mạng, 5xx)
   * thì phiếu còn dùng lại được.
   */
  const revertRestore = async (ticket: UndoTicket): Promise<RestoreOutcome> => {
    const receipt = receipts.get(ticket);

    if (receipt === undefined) {
      return { kind: 'conflict', conflict: toConflictNotice(null) };
    }

    if (ticket.getStatus() === 'used' || reverting.has(ticket)) {
      return { kind: 'conflict', conflict: UNDO_USED_NOTICE };
    }

    if (ticket.getStatus() === 'expired') {
      return { kind: 'conflict', conflict: UNDO_EXPIRED_NOTICE };
    }

    reverting.add(ticket);

    try {
      const page = await listVersionPage({});
      const target = page.items
        .filter((item) => item.sequence < receipt.afterSequence)
        .reduce<FloorVersionSummary | null>((best, item) => (best === null || item.sequence > best.sequence ? item : best), null);

      if (target === null) {
        ticket.undo();

        return { kind: 'conflict', conflict: toConflictNotice(null) };
      }

      const outcome = await send(target.id, receipt.floorRevision);

      delete outcome.sequence;
      // Có câu trả lời (xong, hoặc xung đột — gửi lại cùng `baseVersion` chắc chắn 409 nữa) → dùng phiếu.
      // Hết hạn giữa chừng thì `undo()` từ chối và phiếu thành `expired`: cũng không dùng lại được.
      ticket.undo();

      return outcome;
    } finally {
      reverting.delete(ticket);
    }
  };

  const diff = async (leftVersionId: string, rightVersionId: string): Promise<VersionDiff> => {
    const [left, right] = await Promise.all([readSnapshot(leftVersionId), readSnapshot(rightVersionId)]);

    if (left.kind !== 'snapshot' || right.kind !== 'snapshot') {
      throw new Error(SNAPSHOT_MISSING_REASON);
    }

    return diffVersions(left.snapshot, right.snapshot);
  };

  return {
    capabilities,
    diff,
    restore,
    revertRestore,
    listVersionPage,
    readSnapshot,
    readFloorLayer: async () => {
      const { dimensions, layer, revision } = unwrap(await apiClient.spatial.readLayer({ floorId, projectId }));

      return { dimensions, layer, revision };
    },
    tagVersion: async (versionId, label) =>
      toVersionMetadata(unwrap(await apiClient.versions.label({ label, projectId, versionId }))),
  };
}
