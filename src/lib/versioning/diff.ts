import { formatM, formatM2, formatMm, formatNumberVi } from '@/lib/format';

import type { EntityKind } from './mergeStrategies';

export type { EntityKind } from './mergeStrategies';

export interface EntityRecord {
  [field: string]: unknown;
}

export type VersionSnapshot = Record<EntityKind, Record<string, EntityRecord>>;

export type DiffChangeKind = 'added' | 'changed' | 'removed';

export interface DiffEntry {
  entityId: string;
  entityType: EntityKind;
  kind: DiffChangeKind;
  field?: string;
  newValue?: unknown;
  oldValue?: unknown;
}

export interface VersionDiff {
  added: DiffEntry[];
  changed: DiffEntry[];
  removed: DiffEntry[];
}

const ENTITY_KINDS: readonly EntityKind[] = ['vertex', 'wall', 'door', 'window', 'furniture', 'room', 'dimension'];

const valuesEqual = (a: unknown, b: unknown): boolean => {
  if (a === b) {
    return true;
  }

  if (Array.isArray(a) && Array.isArray(b)) {
    return a.length === b.length && a.every((item, index) => valuesEqual(item, b[index]));
  }

  if (a !== null && b !== null && typeof a === 'object' && typeof b === 'object') {
    const aRecord = a as Record<string, unknown>;
    const bRecord = b as Record<string, unknown>;
    const aKeys = Object.keys(aRecord).sort();
    const bKeys = Object.keys(bRecord).sort();

    return (
      aKeys.length === bKeys.length &&
      aKeys.every((key, index) => key === bKeys[index] && valuesEqual(aRecord[key], bRecord[key]))
    );
  }

  return false;
};

const diffEntityKind = (
  entityType: EntityKind,
  previousRecords: Record<string, EntityRecord>,
  nextRecords: Record<string, EntityRecord>,
): VersionDiff => {
  const previousIds = Object.keys(previousRecords).sort();
  const nextIds = Object.keys(nextRecords).sort();
  const previousIdSet = new Set(previousIds);
  const nextIdSet = new Set(nextIds);

  const removed: DiffEntry[] = previousIds
    .filter((entityId) => !nextIdSet.has(entityId))
    .map((entityId) => ({ entityId, entityType, kind: 'removed', oldValue: previousRecords[entityId] }));

  const added: DiffEntry[] = nextIds
    .filter((entityId) => !previousIdSet.has(entityId))
    .map((entityId) => ({ entityId, entityType, kind: 'added', newValue: nextRecords[entityId] }));

  const changed: DiffEntry[] = [];

  for (const entityId of nextIds) {
    if (!previousIdSet.has(entityId)) {
      continue;
    }

    const previousEntity = previousRecords[entityId] as EntityRecord;
    const nextEntity = nextRecords[entityId] as EntityRecord;
    const fieldNames = Array.from(new Set([...Object.keys(previousEntity), ...Object.keys(nextEntity)]))
      .filter((field) => field !== 'id')
      .sort();

    for (const field of fieldNames) {
      const oldValue = previousEntity[field];
      const newValue = nextEntity[field];

      if (!valuesEqual(oldValue, newValue)) {
        changed.push({ entityId, entityType, field, kind: 'changed', newValue, oldValue });
      }
    }
  }

  return { added, changed, removed };
};

/**
 * Pure, order-deterministic diff between two version snapshots: identical
 * inputs always yield entries in the same entity-kind → sorted-id →
 * sorted-field order, regardless of the objects' own key insertion order.
 * Values are compared structurally via `valuesEqual`, never JSON.stringify.
 */
export function diffVersions(previous: VersionSnapshot, next: VersionSnapshot): VersionDiff {
  const added: DiffEntry[] = [];
  const changed: DiffEntry[] = [];
  const removed: DiffEntry[] = [];

  for (const entityType of ENTITY_KINDS) {
    const group = diffEntityKind(entityType, previous[entityType], next[entityType]);
    added.push(...group.added);
    changed.push(...group.changed);
    removed.push(...group.removed);
  }

  return { added, changed, removed };
}

interface FieldDescriptor {
  format: (value: unknown) => string;
  phrase: string;
}

const FIELD_DESCRIPTORS: Partial<Record<string, FieldDescriptor>> = {
  area_m2: { format: (value) => formatM2(Number(value)), phrase: 'diện tích' },
  elevation_m: { format: (value) => formatM(Number(value)), phrase: 'cao độ' },
  height_mm: { format: (value) => formatMm(Number(value)), phrase: 'cao' },
  rotation_deg: { format: (value) => `${formatNumberVi(Number(value), 0)}°`, phrase: 'xoay' },
  thickness_mm: { format: (value) => formatMm(Number(value)), phrase: 'dày' },
  value_mm: { format: (value) => formatMm(Number(value)), phrase: 'kích thước' },
  width_mm: { format: (value) => formatMm(Number(value)), phrase: 'rộng' },
};

const ENTITY_LABELS: Record<EntityKind, string> = {
  dimension: 'kích thước',
  door: 'cửa đi',
  furniture: 'nội thất',
  room: 'phòng',
  vertex: 'điểm',
  wall: 'tường',
  window: 'cửa sổ',
};

const capitalize = (label: string): string => (label.length > 0 ? `${label[0]!.toUpperCase()}${label.slice(1)}` : label);

const describeGenericValue = (value: unknown): string => {
  if (value === undefined) {
    return '(trống)';
  }

  if (Array.isArray(value)) {
    return value.map((item) => describeGenericValue(item)).join(', ');
  }

  if (typeof value === 'number') {
    return formatNumberVi(value, Number.isInteger(value) ? 0 : 2);
  }

  return String(value);
};

/**
 * Renders one diff entry as a Vietnamese sentence, e.g. "Tường W-014 dày 200
 * mm → 220 mm". Measurement fields (mm/m/m²/°) always carry their unit via
 * `FIELD_DESCRIPTORS`; fields with no known unit fall back to a generic
 * "đổi field từ X sang Y" phrasing instead of inventing one.
 */
export function describeChange(entry: DiffEntry): string {
  const label = ENTITY_LABELS[entry.entityType];

  if (entry.kind === 'added') {
    return `Thêm ${label} ${entry.entityId}`;
  }

  if (entry.kind === 'removed') {
    return `Xoá ${label} ${entry.entityId}`;
  }

  const field = entry.field ?? '';
  const descriptor = FIELD_DESCRIPTORS[field];

  if (descriptor) {
    return `${capitalize(label)} ${entry.entityId} ${descriptor.phrase} ${descriptor.format(entry.oldValue)} → ${descriptor.format(entry.newValue)}`;
  }

  return `${capitalize(label)} ${entry.entityId} đổi ${field} từ ${describeGenericValue(entry.oldValue)} sang ${describeGenericValue(entry.newValue)}`;
}

/** Renders every entry of a diff, added first, then removed, then changed. */
export function describeChanges(diff: VersionDiff): string[] {
  return [...diff.added, ...diff.removed, ...diff.changed].map(describeChange);
}
