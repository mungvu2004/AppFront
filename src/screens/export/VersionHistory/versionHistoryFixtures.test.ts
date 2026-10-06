import { describe, expect, it } from 'vitest';

import { SAMPLE_HISTORY, SAMPLE_ROWS } from './versionHistoryFixtures';

describe('VersionHistory fixtures', () => {
  it('marks the newest version of the sample history as current', () => {
    const newest = [...SAMPLE_HISTORY].sort((a, b) => b.version.sequence - a.version.sequence)[0]?.version.id;

    expect(SAMPLE_ROWS.filter((row) => row.isCurrent).map((row) => row.id)).toEqual([newest]);
  });
});
