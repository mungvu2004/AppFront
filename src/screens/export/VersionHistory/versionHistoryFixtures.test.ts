import { describe, expect, it } from 'vitest';

import { diffVersions } from '@/lib/versioning/diff';

import { SAMPLE_HISTORY, SAMPLE_ROWS } from './versionHistoryFixtures';

describe('VersionHistory fixtures', () => {
  it('marks the newest version of the sample history as current', () => {
    const newest = [...SAMPLE_HISTORY].sort((a, b) => b.version.sequence - a.version.sequence)[0]?.version.id;

    expect(SAMPLE_ROWS.filter((row) => row.isCurrent).map((row) => row.id)).toEqual([newest]);
  });

  it('v15 has its own snapshot and its row counts match the real diff from v14', () => {
    const [v15, v14] = SAMPLE_HISTORY;

    if (v15?.kind !== 'full' || v14?.kind !== 'full') throw new Error('fixture: v15/v14 phải đủ nội dung');

    const diff = diffVersions(v14.version.snapshot, v15.version.snapshot);
    const row = SAMPLE_ROWS.find((candidate) => candidate.id === 'v15');

    expect(v15.version.snapshot).not.toBe(v14.version.snapshot);
    expect([diff.added.length, diff.removed.length, diff.changed.length]).toEqual([
      row?.counts.added,
      row?.counts.removed,
      row?.counts.changed,
    ]);
  });
});
