/**
 * Command layer: the single path every data change goes through.
 *
 * A command is pure data — serializable to JSON and back without loss, and it
 * never carries functions. Every command is invertible by construction: each
 * change records the FULL snapshot of the entity before and after, never a
 * partial diff, so the inverse always exists (see `invert.ts`).
 *
 * Field mapping to the product spec (spec names are Vietnamese; identifiers
 * must be English per the project conventions):
 * - `id`          ↔ mã lệnh
 * - `type`        ↔ loại lệnh
 * - `timestamp`   ↔ thời điểm
 * - `actorId`     ↔ người thực hiện
 * - `description` ↔ mô tả (the CONTENT stays Vietnamese, e.g. "Di chuyển tường")
 * - `changes[].before` / `changes[].after` ↔ dữ liệu trước / dữ liệu sau
 * - `scope`       ↔ phạm vi ảnh hưởng
 */

import type { EntityKind, IdByKind } from '@/domain/spatial/ids';
import type { EntityByKind } from '@/domain/spatial/normalize';
import type { EntityId, LevelId } from '@/domain/spatial/types';

/** Command id, prefixed with `C-`. */
export type CommandId = `C-${string}`;

/**
 * Names the business action, as a short dot-separated English verb phrase,
 * for example `wall.move` or `room.rename`.
 */
export type CommandType = string;

/**
 * One entity-level change inside a command, recorded as full snapshots.
 *
 * - `before === null` means the command creates the entity.
 * - `after === null` means the command removes the entity.
 * - Both `null` is invalid; the builder rejects it (`createCommand`).
 *
 * Snapshots are complete entities, never partial diffs, which is what makes
 * every command invertible without extra bookkeeping.
 */
export interface EntityChangeOfKind<K extends EntityKind> {
  kind: K;
  id: IdByKind[K];
  before: EntityByKind[K] | null;
  after: EntityByKind[K] | null;
}

/**
 * The per-kind union of changes, so `id`, `before` and `after` are always
 * typed against the kind named in the same change.
 */
export type EntityChange = {
  [K in EntityKind]: EntityChangeOfKind<K>;
}[EntityKind];

/**
 * What a command touches, precomputed so undo/redo, sync and cache
 * invalidation can route without re-reading the snapshots.
 */
export interface CommandScope {
  entityIds: readonly EntityId[];
  levelIds: readonly LevelId[];
  kinds: readonly EntityKind[];
}

/**
 * A single, atomic, invertible unit of change.
 *
 * Commands are the foundation of undo and of sync: nothing mutates the graph
 * except by applying a command, and the inverse of a command is itself a
 * command (`invertCommand`).
 */
export interface Command {
  id: CommandId;
  type: CommandType;
  /** Creation time as an ISO 8601 string. */
  timestamp: string;
  actorId: string;
  /** Human-readable description, written in Vietnamese for the activity log. */
  description: string;
  /** Applied in array order; the inverse applies them in reverse order. */
  changes: readonly EntityChange[];
  scope: CommandScope;
}
