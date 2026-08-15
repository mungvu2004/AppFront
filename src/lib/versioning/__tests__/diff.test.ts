import { describe, expect, it } from 'vitest';

import { formatChange } from '@/lib/format/semantic';

import { describeChanges, diffVersions, type EntityRecord, type VersionSnapshot } from '../diff';
import {
  appendVersionToHistory,
  MAX_FULL_VERSIONS,
  restoreVersion,
  type VersionEntry,
  type VersionHistoryEntry,
  type VersionMetadata,
} from '../restore';

const emptySnapshot = (): VersionSnapshot => ({
  dimension: {},
  door: {},
  furniture: {},
  room: {},
  vertex: {},
  wall: {},
  window: {},
});

const wall = (thicknessMm: number, extra: EntityRecord = {}): EntityRecord => ({
  confidence: 0.9,
  from: 'V-1',
  thickness_mm: thicknessMm,
  to: 'V-2',
  ...extra,
});

describe('diffVersions', () => {
  it('reports a new entity id as added, carrying its full record as newValue', () => {
    const previous = emptySnapshot();
    const next = emptySnapshot();
    next.wall = { 'W-014': wall(220) };

    const diff = diffVersions(previous, next);

    expect(diff.added).toEqual([
      { entityId: 'W-014', entityType: 'wall', kind: 'added', newValue: wall(220) },
    ]);
    expect(diff.removed).toHaveLength(0);
    expect(diff.changed).toHaveLength(0);
  });

  it('reports a removed entity id as removed, carrying its full record as oldValue', () => {
    const previous = emptySnapshot();
    previous.wall = { 'W-014': wall(220) };
    const next = emptySnapshot();

    const diff = diffVersions(previous, next);

    expect(diff.removed).toEqual([
      { entityId: 'W-014', entityType: 'wall', kind: 'removed', oldValue: wall(220) },
    ]);
    expect(diff.added).toHaveLength(0);
    expect(diff.changed).toHaveLength(0);
  });

  it('reports a per-field change for an entity present on both sides with a different value', () => {
    const previous = emptySnapshot();
    previous.wall = { 'W-014': wall(200) };
    const next = emptySnapshot();
    next.wall = { 'W-014': wall(220) };

    const diff = diffVersions(previous, next);

    expect(diff.changed).toEqual([
      { entityId: 'W-014', entityType: 'wall', field: 'thickness_mm', kind: 'changed', newValue: 220, oldValue: 200 },
    ]);
    expect(diff.added).toHaveLength(0);
    expect(diff.removed).toHaveLength(0);
  });

  it('does not report a field as changed when both sides hold an equal but differently-ordered array', () => {
    const previous = emptySnapshot();
    previous.room = { 'R-005': { area_m2: 18.4, vertices: ['V-1', 'V-2', 'V-3'] } };
    const next = emptySnapshot();
    next.room = { 'R-005': { area_m2: 18.4, vertices: ['V-1', 'V-2', 'V-3'] } };

    const diff = diffVersions(previous, next);

    expect(diff.changed).toHaveLength(0);
  });

  it('reports a changed array field when element order differs', () => {
    const previous = emptySnapshot();
    previous.room = { 'R-005': { vertices: ['V-1', 'V-2', 'V-3'] } };
    const next = emptySnapshot();
    next.room = { 'R-005': { vertices: ['V-2', 'V-1', 'V-3'] } };

    const diff = diffVersions(previous, next);

    expect(diff.changed).toEqual([
      {
        entityId: 'R-005',
        entityType: 'room',
        field: 'vertices',
        kind: 'changed',
        newValue: ['V-2', 'V-1', 'V-3'],
        oldValue: ['V-1', 'V-2', 'V-3'],
      },
    ]);
  });

  it('ignores the id field itself so it never shows up as a spurious change', () => {
    const previous = emptySnapshot();
    previous.wall = { 'W-014': { id: 'W-014', thickness_mm: 200 } };
    const next = emptySnapshot();
    next.wall = { 'W-014': { id: 'W-014', thickness_mm: 200 } };

    const diff = diffVersions(previous, next);

    expect(diff.changed).toHaveLength(0);
  });

  it('is a pure, deterministic postulate: same input always yields the same output', () => {
    const previous = emptySnapshot();
    previous.wall = { 'W-021': wall(110), 'W-014': wall(200) };
    const next = emptySnapshot();
    next.wall = { 'W-014': wall(220), 'W-021': wall(110), 'W-034': wall(330) };

    const first = diffVersions(previous, next);
    const second = diffVersions(previous, next);

    expect(second).toEqual(first);
  });

  it('orders entries by sorted entity id regardless of the source objects key insertion order', () => {
    const previousInOneOrder = emptySnapshot();
    previousInOneOrder.wall = { 'W-034': wall(330), 'W-014': wall(200), 'W-021': wall(110) };
    const previousInAnotherOrder = emptySnapshot();
    previousInAnotherOrder.wall = { 'W-014': wall(200), 'W-021': wall(110), 'W-034': wall(330) };
    const next = emptySnapshot();

    const diffA = diffVersions(previousInOneOrder, next);
    const diffB = diffVersions(previousInAnotherOrder, next);

    expect(diffA.removed.map((entry) => entry.entityId)).toEqual(['W-014', 'W-021', 'W-034']);
    expect(diffB.removed.map((entry) => entry.entityId)).toEqual(['W-014', 'W-021', 'W-034']);
  });

  it('groups results into added, removed, and changed', () => {
    const previous = emptySnapshot();
    previous.wall = { 'W-014': wall(200), 'W-021': wall(110) };
    const next = emptySnapshot();
    next.wall = { 'W-014': wall(220), 'W-034': wall(330) };

    const diff = diffVersions(previous, next);

    expect(diff.added.map((entry) => entry.entityId)).toEqual(['W-034']);
    expect(diff.removed.map((entry) => entry.entityId)).toEqual(['W-021']);
    expect(diff.changed.map((entry) => entry.entityId)).toEqual(['W-014']);
  });
});

describe('a diff entry, put into words', () => {
  it('describes a wall thickness change exactly as the product spec requires', () => {
    const description = formatChange({
      entityId: 'W-014',
      entityType: 'wall',
      field: 'thickness_mm',
      kind: 'changed',
      newValue: 220,
      oldValue: 200,
    });

    expect(description).toBe('Tường W-014 dày 200 mm → 220 mm');
  });

  it('always includes a unit for measurement fields', () => {
    const elevation = formatChange({
      entityId: 'WM-042',
      entityType: 'window',
      field: 'elevation_m',
      kind: 'changed',
      newValue: 1.2,
      oldValue: 0.9,
    });
    const area = formatChange({
      entityId: 'R-005',
      entityType: 'room',
      field: 'area_m2',
      kind: 'changed',
      newValue: 20.1,
      oldValue: 18.4,
    });
    const rotation = formatChange({
      entityId: 'F-012',
      entityType: 'furniture',
      field: 'rotation_deg',
      kind: 'changed',
      newValue: 90,
      oldValue: 0,
    });

    expect(elevation).toContain('m');
    expect(elevation).toMatch(/\d[\s]?m →/);
    expect(area).toContain('m²');
    expect(rotation).toContain('°');
  });

  // The copy of this renderer that used to live in `../diff` picked a unit per
  // side, so a change across one metre read "980 mm → 1,02 m". One unit for the
  // pair is the whole reason the shared renderer exists.
  it('writes both sides of a length change in one unit, even across the metre mark', () => {
    expect(
      formatChange({
        entityId: 'D-007',
        entityType: 'door',
        field: 'width_mm',
        kind: 'changed',
        newValue: 1020,
        oldValue: 980,
      }),
    ).toBe('Cửa đi D-007 rộng 0,98 m → 1,02 m');
  });

  it('writes a measurement that never arrived as a dash rather than NaN', () => {
    expect(
      formatChange({
        entityId: 'W-014',
        entityType: 'wall',
        field: 'thickness_mm',
        kind: 'changed',
        newValue: 220,
        oldValue: null,
      }),
    ).toBe('Tường W-014 dày — → 220 mm');
  });

  it('falls back to a generic phrasing without inventing a unit for non-measurement fields', () => {
    const description = formatChange({
      entityId: 'W-014',
      entityType: 'wall',
      field: 'review_state',
      kind: 'changed',
      newValue: 'approved',
      oldValue: 'pending',
    });

    expect(description).toBe('Tường W-014 đổi review_state từ pending sang approved');
  });

  it('describes an added entity', () => {
    expect(
      formatChange({ entityId: 'D-007', entityType: 'door', kind: 'added', newValue: { width_mm: 800 } }),
    ).toBe('Thêm cửa đi D-007');
  });

  it('describes a removed entity', () => {
    expect(
      formatChange({ entityId: 'D-007', entityType: 'door', kind: 'removed', oldValue: { width_mm: 800 } }),
    ).toBe('Xoá cửa đi D-007');
  });

  it('describeChanges renders every entry of a diff', () => {
    const previous = emptySnapshot();
    previous.wall = { 'W-014': wall(200) };
    const next = emptySnapshot();
    next.wall = { 'W-014': wall(220), 'W-021': wall(110) };

    const diff = diffVersions(previous, next);
    const sentences = describeChanges(diff);

    expect(sentences).toContain('Thêm tường W-021');
    expect(sentences).toContain('Tường W-014 dày 200 mm → 220 mm');
  });
});

describe('restoreVersion', () => {
  const metadata = (id: string, sequence: number): VersionMetadata => ({
    createdAt: `2026-08-${10 + sequence}T09:00:00.000Z`,
    creatorId: 'user-1',
    id,
    sequence,
  });

  const fullEntry = (id: string, sequence: number, snapshot: VersionSnapshot): VersionHistoryEntry => ({
    kind: 'full',
    version: { ...metadata(id, sequence), snapshot },
  });

  it('restoring v14 while at v15 produces v16 with content equal to v14', () => {
    const v14Snapshot = emptySnapshot();
    v14Snapshot.wall = { 'W-014': wall(200) };
    const v15Snapshot = emptySnapshot();
    v15Snapshot.wall = { 'W-014': wall(220) };

    const v13 = fullEntry('v13', 13, emptySnapshot());
    const v14: VersionEntry = { ...metadata('v14', 14), snapshot: v14Snapshot };
    const v15 = fullEntry('v15', 15, v15Snapshot);

    const history: VersionHistoryEntry[] = [v15, { kind: 'full', version: v14 }, v13];

    const { restoredVersion } = restoreVersion({
      floorId: 'floor-1',
      newVersion: metadata('v16', 16),
      sourceVersion: v14,
    });

    expect(restoredVersion.id).toBe('v16');
    expect(restoredVersion.snapshot).toEqual(v14Snapshot);
    expect(diffVersions(restoredVersion.snapshot, v14Snapshot).changed).toHaveLength(0);

    const nextHistory = appendVersionToHistory(history, restoredVersion);

    // no history entry was removed — restore is forward-only, never destructive
    expect(nextHistory.map((entry) => entry.version.id)).toEqual(['v16', 'v15', 'v14', 'v13']);
    expect(nextHistory[0]).toEqual({ kind: 'full', version: restoredVersion });
  });

  it('keeps at most MAX_FULL_VERSIONS entries with full content, demoting older ones to metadata only', () => {
    let history: VersionHistoryEntry[] = [];

    for (let sequence = 1; sequence <= MAX_FULL_VERSIONS + 10; sequence += 1) {
      const snapshot = emptySnapshot();
      snapshot.wall = { [`W-${sequence}`]: wall(sequence) };
      history = appendVersionToHistory(history, { ...metadata(`v${sequence}`, sequence), snapshot });
    }

    expect(history).toHaveLength(MAX_FULL_VERSIONS + 10);
    expect(history.filter((entry) => entry.kind === 'full')).toHaveLength(MAX_FULL_VERSIONS);
    expect(history.slice(0, MAX_FULL_VERSIONS).every((entry) => entry.kind === 'full')).toBe(true);
    expect(history.slice(MAX_FULL_VERSIONS).every((entry) => entry.kind === 'metadataOnly')).toBe(true);

    const oldestKept = history[history.length - 1];
    expect(oldestKept?.version.id).toBe('v1');
    expect(oldestKept?.kind).toBe('metadataOnly');
  });

  it('never re-promotes a metadata-only entry back to full once its snapshot has been dropped', () => {
    let history: VersionHistoryEntry[] = [];

    for (let sequence = 1; sequence <= MAX_FULL_VERSIONS + 1; sequence += 1) {
      history = appendVersionToHistory(history, { ...metadata(`v${sequence}`, sequence), snapshot: emptySnapshot() });
    }

    // v1 is now metadata-only (pushed past the window by v2..v51)
    expect(history[history.length - 1]).toMatchObject({ kind: 'metadataOnly', version: { id: 'v1' } });

    const historyAfterOneMore = appendVersionToHistory(history, {
      ...metadata('v52', 52),
      snapshot: emptySnapshot(),
    });

    const v1Entry = historyAfterOneMore.find((entry) => entry.version.id === 'v1');
    expect(v1Entry?.kind).toBe('metadataOnly');
  });
});
