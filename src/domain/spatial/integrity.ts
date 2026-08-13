/**
 * Integrity checks for a normalized spatial graph.
 *
 * AI output breaks in predictable ways — a door hanging off a wall that was
 * never emitted, a room whose outline has no vertices — and the app has to see
 * that before it draws anything. `checkIntegrity` only reads: it never repairs,
 * reorders or fills in the data it is given.
 *
 * Issue messages are user-facing Vietnamese and always name the entity code;
 * `rule` and `severity` stay machine-readable.
 */

import { isEntityOfKind, resolveLevelId, type EntityByKind, type NormalizedSpatial } from './normalize';
import type { LevelId, OpeningId } from './types';

/** How badly a broken rule hurts. */
export type IntegritySeverity = 'critical' | 'warning';

/** Which of the six checks reported the issue. */
export type IntegrityRule =
  | 'duplicateId'
  | 'missingReference'
  | 'levelMembership'
  | 'zeroLengthWall'
  | 'roomOutline'
  | 'levelElevationOrder';

/** One problem found in the graph. */
export interface IntegrityIssue {
  rule: IntegrityRule;
  severity: IntegritySeverity;
  /** The entity the issue is attached to. */
  entityId: string;
  /** Vietnamese sentence naming the entity code. */
  message: string;
}

const CRITICAL: IntegritySeverity = 'critical';
const WARNING: IntegritySeverity = 'warning';

const entitiesOfKind = <K extends keyof EntityByKind>(
  normalized: NormalizedSpatial,
  kind: K,
): EntityByKind[K][] => {
  const entities: EntityByKind[K][] = [];

  for (const id of normalized.byKind[kind]) {
    const entity = normalized.byId[id];

    if (entity !== undefined && isEntityOfKind(kind, entity)) {
      entities.push(entity);
    }
  }

  return entities;
};

/** Rule 1 — no id may appear twice across the kind indexes. */
const checkDuplicateIds = (normalized: NormalizedSpatial): IntegrityIssue[] => {
  const seen = new Map<string, number>();

  for (const ids of Object.values(normalized.byKind)) {
    for (const id of ids) {
      seen.set(id, (seen.get(id) ?? 0) + 1);
    }
  }

  const issues: IntegrityIssue[] = [];

  for (const [id, count] of seen) {
    if (count > 1) {
      issues.push({
        entityId: id,
        message: `Mã ${id} xuất hiện ${count} lần trong chỉ mục.`,
        rule: 'duplicateId',
        severity: CRITICAL,
      });
    }
  }

  return issues;
};

/** Rule 2 — every reference must point at something that exists. */
const checkReferences = (normalized: NormalizedSpatial): IntegrityIssue[] => {
  const issues: IntegrityIssue[] = [];
  const exists = (id: string): boolean => normalized.byId[id] !== undefined;

  const isLevel = (id: string): boolean => {
    const entity = normalized.byId[id];

    return entity !== undefined && isEntityOfKind('level', entity);
  };

  for (const [kind, ids] of Object.entries(normalized.byKind)) {
    for (const id of ids) {
      if (!exists(id)) {
        issues.push({
          entityId: id,
          message: `Chỉ mục ${kind} trỏ tới mã ${id} nhưng không có đối tượng nào.`,
          rule: 'missingReference',
          severity: CRITICAL,
        });
      }
    }
  }

  const requireLevel = (entityId: string, levelId: LevelId): void => {
    if (!isLevel(levelId)) {
      issues.push({
        entityId,
        message: `Đối tượng ${entityId} trỏ tới tầng ${levelId} không tồn tại.`,
        rule: 'missingReference',
        severity: CRITICAL,
      });
    }
  };

  const openingsByWall = new Map<string, OpeningId[]>();

  for (const opening of entitiesOfKind(normalized, 'opening')) {
    const hosted = openingsByWall.get(opening.wallId);

    if (hosted === undefined) {
      openingsByWall.set(opening.wallId, [opening.id]);
    } else {
      hosted.push(opening.id);
    }
  }

  for (const wall of entitiesOfKind(normalized, 'wall')) {
    requireLevel(wall.id, wall.levelId);

    for (const openingId of wall.openingIds) {
      if (!exists(openingId)) {
        issues.push({
          entityId: wall.id,
          message: `Tường ${wall.id} liệt kê lỗ mở ${openingId} không tồn tại.`,
          rule: 'missingReference',
          severity: CRITICAL,
        });
      }
    }

    for (const openingId of openingsByWall.get(wall.id) ?? []) {
      if (!wall.openingIds.includes(openingId)) {
        issues.push({
          entityId: wall.id,
          message: `Tường ${wall.id} không liệt kê lỗ mở ${openingId} đang trỏ về nó.`,
          rule: 'missingReference',
          severity: WARNING,
        });
      }
    }
  }

  for (const opening of entitiesOfKind(normalized, 'opening')) {
    const wall = normalized.byId[opening.wallId];

    if (wall === undefined || !isEntityOfKind('wall', wall)) {
      issues.push({
        entityId: opening.id,
        message: `Lỗ mở ${opening.id} trỏ tới tường ${opening.wallId} không tồn tại.`,
        rule: 'missingReference',
        severity: CRITICAL,
      });
    }
  }

  for (const item of entitiesOfKind(normalized, 'furniture')) {
    requireLevel(item.id, item.levelId);

    if (item.roomId !== undefined && !exists(item.roomId)) {
      issues.push({
        entityId: item.id,
        message: `Đồ đạc ${item.id} thuộc phòng ${item.roomId} không tồn tại.`,
        rule: 'missingReference',
        severity: WARNING,
      });
    }
  }

  for (const room of entitiesOfKind(normalized, 'room')) {
    requireLevel(room.id, room.levelId);

    for (const wallId of room.wallIds) {
      if (!exists(wallId)) {
        issues.push({
          entityId: room.id,
          message: `Phòng ${room.id} tham chiếu tường ${wallId} không tồn tại.`,
          rule: 'missingReference',
          severity: WARNING,
        });
      }
    }
  }

  for (const axis of entitiesOfKind(normalized, 'axis')) {
    requireLevel(axis.id, axis.levelId);
  }

  for (const dimension of entitiesOfKind(normalized, 'dimension')) {
    requireLevel(dimension.id, dimension.levelId);

    for (const referenceId of dimension.referenceIds) {
      if (!exists(referenceId)) {
        issues.push({
          entityId: dimension.id,
          message: `Kích thước ${dimension.id} tham chiếu đối tượng ${referenceId} không tồn tại.`,
          rule: 'missingReference',
          severity: WARNING,
        });
      }
    }
  }

  for (const note of normalized.notes) {
    if (!exists(note.entityId)) {
      issues.push({
        entityId: note.id,
        message: `Ghi chú ${note.id} gắn vào đối tượng ${note.entityId} không tồn tại.`,
        rule: 'missingReference',
        severity: WARNING,
      });
    }
  }

  return issues;
};

/** Rule 3 — every entity sits on exactly one level, and a level sits on none. */
const checkLevelMembership = (normalized: NormalizedSpatial): IntegrityIssue[] => {
  const levelsOfId = new Map<string, LevelId[]>();

  for (const [levelId, ids] of Object.entries(normalized.byLevel)) {
    for (const id of ids) {
      const hosts = levelsOfId.get(id);

      if (hosts === undefined) {
        levelsOfId.set(id, [levelId as LevelId]);
      } else {
        hosts.push(levelId as LevelId);
      }
    }
  }

  const issues: IntegrityIssue[] = [];

  for (const ids of Object.values(normalized.byKind)) {
    for (const id of ids) {
      const entity = normalized.byId[id];

      if (entity === undefined) {
        continue;
      }

      const hosts = levelsOfId.get(id) ?? [];

      if (isEntityOfKind('level', entity)) {
        if (hosts.length > 0) {
          issues.push({
            entityId: id,
            message: `Tầng ${id} bị xếp vào chỉ mục của tầng ${hosts[0]}.`,
            rule: 'levelMembership',
            severity: WARNING,
          });
        }

        continue;
      }

      if (hosts.length === 0) {
        issues.push({
          entityId: id,
          message: `Đối tượng ${id} không thuộc tầng nào.`,
          rule: 'levelMembership',
          severity: CRITICAL,
        });

        continue;
      }

      if (hosts.length > 1) {
        issues.push({
          entityId: id,
          message: `Đối tượng ${id} thuộc ${hosts.length} tầng cùng lúc: ${hosts.join(', ')}.`,
          rule: 'levelMembership',
          severity: CRITICAL,
        });

        continue;
      }

      const declared = resolveLevelId(entity, normalized.byId);

      if (declared !== null && declared !== hosts[0]) {
        issues.push({
          entityId: id,
          message: `Đối tượng ${id} khai báo thuộc tầng ${declared} nhưng nằm trong chỉ mục của tầng ${hosts[0]}.`,
          rule: 'levelMembership',
          severity: CRITICAL,
        });
      }
    }
  }

  return issues;
};

/** Rule 4 — a wall whose centreline collapses to a point cannot be drawn. */
const checkZeroLengthWalls = (normalized: NormalizedSpatial): IntegrityIssue[] => {
  const issues: IntegrityIssue[] = [];

  for (const wall of entitiesOfKind(normalized, 'wall')) {
    const { start, end } = wall.centreline;

    if (start.x === end.x && start.y === end.y) {
      issues.push({
        entityId: wall.id,
        message: `Tường ${wall.id} có độ dài 0 mm.`,
        rule: 'zeroLengthWall',
        severity: CRITICAL,
      });
    }
  }

  return issues;
};

/** Rule 5 — a room needs at least three vertices to close. */
const checkRoomOutlines = (normalized: NormalizedSpatial): IntegrityIssue[] => {
  const issues: IntegrityIssue[] = [];

  for (const room of entitiesOfKind(normalized, 'room')) {
    const { outline } = room;

    if (outline.length < 3) {
      issues.push({
        entityId: room.id,
        message: `Phòng ${room.id} chỉ có ${outline.length} đỉnh, không đủ để khép kín.`,
        rule: 'roomOutline',
        severity: CRITICAL,
      });

      continue;
    }

    const first = outline[0];
    const last = outline[outline.length - 1];

    if (first !== undefined && last !== undefined && first.x === last.x && first.y === last.y) {
      issues.push({
        entityId: room.id,
        message: `Phòng ${room.id} lặp lại đỉnh đầu ở cuối đường bao.`,
        rule: 'roomOutline',
        severity: WARNING,
      });
    }
  }

  return issues;
};

/** Rule 6 — read bottom to top, level elevations must strictly increase. */
const checkLevelElevations = (normalized: NormalizedSpatial): IntegrityIssue[] => {
  const levels = [...entitiesOfKind(normalized, 'level')].sort((left, right) => left.order - right.order);
  const issues: IntegrityIssue[] = [];

  for (let index = 1; index < levels.length; index += 1) {
    const previous = levels[index - 1];
    const current = levels[index];

    if (previous === undefined || current === undefined) {
      continue;
    }

    if (current.elevationMm <= previous.elevationMm) {
      issues.push({
        entityId: current.id,
        message: `Tầng ${current.id} có cao độ ${current.elevationMm} mm không lớn hơn tầng ${previous.id} (${previous.elevationMm} mm).`,
        rule: 'levelElevationOrder',
        severity: WARNING,
      });
    }
  }

  return issues;
};

/**
 * Runs the six integrity checks and returns everything that is wrong.
 *
 * Reads only — the graph comes back exactly as it went in. Issues arrive
 * grouped by rule in the order the rules are declared, which keeps the output
 * stable between runs.
 */
export const checkIntegrity = (normalized: NormalizedSpatial): IntegrityIssue[] => [
  ...checkDuplicateIds(normalized),
  ...checkReferences(normalized),
  ...checkLevelMembership(normalized),
  ...checkZeroLengthWalls(normalized),
  ...checkRoomOutlines(normalized),
  ...checkLevelElevations(normalized),
];

/** True when nothing blocks rendering, warnings aside. */
export const hasCriticalIssue = (issues: readonly IntegrityIssue[]): boolean =>
  issues.some((issue) => issue.severity === CRITICAL);

/** Counts issues per severity, for the status bar. */
export const countBySeverity = (
  issues: readonly IntegrityIssue[],
): Record<IntegritySeverity, number> => ({
  critical: issues.filter((issue) => issue.severity === CRITICAL).length,
  warning: issues.filter((issue) => issue.severity === WARNING).length,
});
