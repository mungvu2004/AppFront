/**
 * The standard command builder every business command goes through.
 *
 * Centralizing construction here keeps the invariants in one place:
 * - a change never has both snapshots `null`;
 * - snapshot ids always match the change id;
 * - the scope is derived from the snapshots, never hand-written.
 */

import type { EntityKind, IdByKind } from '@/domain/spatial/ids';
import { isEntityOfKind, type EntityByKind, type SpatialEntity } from '@/domain/spatial/normalize';
import type { EntityId, LevelId } from '@/domain/spatial/types';
import { createUuid } from '@/lib/http/ids';

import type { Command, CommandId, CommandScope, CommandType, EntityChange, EntityChangeOfKind } from './types';

/** Everything a business command must provide; ids and time are generated. */
export interface CommandInput {
  type: CommandType;
  actorId: string;
  /** Human-readable description, written in Vietnamese for the activity log. */
  description: string;
  changes: readonly EntityChange[];
  /** Only for tests and replay; generated when omitted. */
  id?: CommandId
  /** Only for tests and replay; defaults to the current time. */
  timestamp?: string;
}

// `EntityByKind[K]['id']` and `IdByKind[K]` name the same id type per kind,
// but TypeScript cannot relate the two indexed accesses while `K` is still a
// type parameter, so the builders re-assert that equality.
const idOfEntity = <K extends EntityKind>(entity: EntityByKind[K]): IdByKind[K] => entity.id as IdByKind[K];

/** A change that creates an entity. */
export const changeForAdd = <K extends EntityKind>(kind: K, entity: EntityByKind[K]): EntityChangeOfKind<K> => ({
  kind,
  id: idOfEntity(entity),
  before: null,
  after: entity,
});

/** A change that removes an entity; the snapshot is kept so undo can restore it. */
export const changeForRemove = <K extends EntityKind>(kind: K, entity: EntityByKind[K]): EntityChangeOfKind<K> => ({
  kind,
  id: idOfEntity(entity),
  before: entity,
  after: null,
});

/** A change that replaces an entity with a new full snapshot. */
export const changeForUpdate = <K extends EntityKind>(
  kind: K,
  before: EntityByKind[K],
  after: EntityByKind[K],
): EntityChangeOfKind<K> => {
  if (before.id !== after.id) {
    throw new Error(`Command change cannot update across ids: ${before.id} -> ${after.id}.`);
  }

  return { kind, id: idOfEntity(before), before, after };
};

/** Rejects the one shape that would make a command non-invertible. */
const assertChangeIsInvertible = (change: EntityChange): void => {
  if (change.before === null && change.after === null) {
    throw new Error(`Command change on ${change.id} has no snapshot at all; it cannot be inverted.`);
  }

  for (const snapshot of [change.before, change.after]) {
    if (snapshot !== null && snapshot.id !== change.id) {
      throw new Error(`Command change on ${change.id} carries a snapshot of ${snapshot.id}.`);
    }
  }
};

/**
 * The levels a snapshot sits on, read from the snapshot alone.
 *
 * An opening carries no `levelId` of its own (it inherits its wall's level),
 * so a command that only touches an opening contributes no level here.
 */
const levelIdsOfSnapshot = (snapshot: SpatialEntity): readonly LevelId[] => {
  if (isEntityOfKind('level', snapshot)) {
    return [snapshot.id];
  }

  if ('levelId' in snapshot) {
    return [snapshot.levelId];
  }

  return [];
};

const deriveScope = (changes: readonly EntityChange[]): CommandScope => {
  const entityIds = new Set<EntityId>();
  const levelIds = new Set<LevelId>();
  const kinds = new Set<EntityKind>();

  for (const change of changes) {
    entityIds.add(change.id);
    kinds.add(change.kind);

    for (const snapshot of [change.before, change.after]) {
      if (snapshot !== null) {
        for (const levelId of levelIdsOfSnapshot(snapshot)) {
          levelIds.add(levelId);
        }
      }
    }
  }

  return {
    entityIds: [...entityIds],
    levelIds: [...levelIds],
    kinds: [...kinds],
  };
};

const createCommandId = (): CommandId => `C-${createUuid().toUpperCase()}`;

/**
 * Builds a command from its business payload.
 *
 * Throws when any change is not invertible, so a command that reaches the
 * store is guaranteed to have an inverse.
 */
export const createCommand = (input: CommandInput): Command => {
  for (const change of input.changes) {
    assertChangeIsInvertible(change);
  }

  return {
    id: input.id ?? createCommandId(),
    type: input.type,
    timestamp: input.timestamp ?? new Date().toISOString(),
    actorId: input.actorId,
    description: input.description,
    changes: [...input.changes],
    scope: deriveScope(input.changes),
  };
};
