import { describe, expect, it } from 'vitest';

import type { LevelId } from '../../spatial/types';
import type { RuleSeverity, Violation } from '../registry';
import {
  computeHealthScore,
  countBySeverity,
  explainHealthScore,
  groupViolationsByLevel,
  HEALTH_SCORE_MAX,
  HEALTH_SCORE_MIN,
  SEVERITY_PENALTY,
  sortBySeverity,
  worstSeverityOf,
} from '../healthScore';

/* -------------------------------------------------------------------------- */
/* Fixtures.                                                                   */
/* -------------------------------------------------------------------------- */

const GROUND: LevelId = 'L-GROUND0000';
const FIRST: LevelId = 'L-FIRST00000';

let nextEntity = 0;

function violation(severity: RuleSeverity, levelId: LevelId | null = GROUND): Violation {
  nextEntity += 1;

  return {
    ruleCode: severity === 'critical' ? 'ROOM-NO-DOOR' : 'ROOM-NO-WINDOW',
    severity,
    levelId,
    entityId: `R-TEST${String(nextEntity).padStart(6, '0')}`,
    message: 'Câu mô tả cho bản kiểm.',
    suggestion: 'Việc cần làm để sửa.',
  };
}

function repeat(count: number, severity: RuleSeverity, levelId: LevelId | null = GROUND): Violation[] {
  return Array.from({ length: count }, () => violation(severity, levelId));
}

/* -------------------------------------------------------------------------- */
/* The score.                                                                  */
/* -------------------------------------------------------------------------- */

describe('the health score', () => {
  it('is 100 when nothing is wrong', () => {
    expect(computeHealthScore([])).toBe(HEALTH_SCORE_MAX);
    expect(computeHealthScore([])).toBe(100);
  });

  it('is 44 for seven critical violations', () => {
    expect(computeHealthScore(repeat(7, 'critical'))).toBe(44);
  });

  it('takes 8 off for a critical, 3 for a warning and 1 for a suggestion', () => {
    expect(computeHealthScore(repeat(1, 'critical'))).toBe(92);
    expect(computeHealthScore(repeat(1, 'warning'))).toBe(97);
    expect(computeHealthScore(repeat(1, 'suggestion'))).toBe(99);
    expect(SEVERITY_PENALTY).toEqual({ critical: 8, warning: 3, suggestion: 1 });
  });

  it('adds the three severities up', () => {
    const mixed = [...repeat(3, 'critical'), ...repeat(3, 'warning'), ...repeat(1, 'suggestion')];

    // 100 − 24 − 9 − 1.
    expect(computeHealthScore(mixed)).toBe(66);
  });

  it('stops at zero rather than going negative', () => {
    // Twelve criticals still leave 4; the thirteenth is where the floor bites.
    expect(computeHealthScore(repeat(12, 'critical'))).toBe(4);
    expect(computeHealthScore(repeat(13, 'critical'))).toBe(HEALTH_SCORE_MIN);
    expect(computeHealthScore(repeat(60, 'critical'))).toBe(0);
  });

  it('says how much of the penalty the floor absorbed', () => {
    const drowned = explainHealthScore(repeat(20, 'critical'));

    expect(drowned.score).toBe(0);
    expect(drowned.penalty).toBe(160);
    expect(drowned.clampedPenalty).toBe(60);

    const survivable = explainHealthScore(repeat(7, 'critical'));

    expect(survivable.clampedPenalty).toBe(0);
  });

  it('shows the counts that produced it', () => {
    const mixed = [...repeat(2, 'critical'), ...repeat(1, 'warning'), ...repeat(4, 'suggestion')];
    const explained = explainHealthScore(mixed);

    expect(explained.counts).toEqual({ critical: 2, warning: 1, suggestion: 4 });
    expect(explained.total).toBe(7);
    expect(explained.worstSeverity).toBe('critical');
    expect(explained.score).toBe(100 - 2 * 8 - 3 - 4);
  });

  it('gives the same answer whatever order the violations arrive in', () => {
    const mixed = [...repeat(2, 'critical'), ...repeat(3, 'warning'), ...repeat(5, 'suggestion')];
    const shuffled = [...mixed].reverse();

    expect(computeHealthScore(shuffled)).toBe(computeHealthScore(mixed));
  });

  it('gives the same answer twice running, and leaves the list alone', () => {
    const mixed = [...repeat(2, 'critical'), ...repeat(1, 'suggestion')];
    const before = JSON.stringify(mixed);

    expect(computeHealthScore(mixed)).toBe(computeHealthScore(mixed));
    expect(JSON.stringify(mixed)).toBe(before);
  });

  it('always lands on a whole number inside the scale', () => {
    for (let count = 0; count < 30; count += 1) {
      const score = computeHealthScore(repeat(count, 'warning'));

      expect(Number.isInteger(score)).toBe(true);
      expect(score).toBeGreaterThanOrEqual(HEALTH_SCORE_MIN);
      expect(score).toBeLessThanOrEqual(HEALTH_SCORE_MAX);
    }
  });
});

/* -------------------------------------------------------------------------- */
/* Counting.                                                                   */
/* -------------------------------------------------------------------------- */

describe('counting by severity', () => {
  it('reports all three keys even when a severity is missing', () => {
    expect(countBySeverity(repeat(2, 'warning'))).toEqual({ critical: 0, warning: 2, suggestion: 0 });
    expect(countBySeverity([])).toEqual({ critical: 0, warning: 0, suggestion: 0 });
  });

  it('names the worst severity present, and nothing for a clean model', () => {
    expect(worstSeverityOf([])).toBeNull();
    expect(worstSeverityOf(repeat(3, 'suggestion'))).toBe('suggestion');
    expect(worstSeverityOf([...repeat(3, 'suggestion'), ...repeat(1, 'warning')])).toBe('warning');
    expect(worstSeverityOf([...repeat(1, 'suggestion'), ...repeat(1, 'critical')])).toBe('critical');
  });
});

/* -------------------------------------------------------------------------- */
/* Grouping by level.                                                          */
/* -------------------------------------------------------------------------- */

describe('grouping by level', () => {
  it('gives each level its own list, counts and score', () => {
    const groups = groupViolationsByLevel([
      ...repeat(2, 'critical', GROUND),
      ...repeat(1, 'warning', FIRST),
    ]);

    expect(groups).toHaveLength(2);
    expect(groups[0]?.levelId).toBe(GROUND);
    expect(groups[0]?.violations).toHaveLength(2);
    expect(groups[0]?.counts).toEqual({ critical: 2, warning: 0, suggestion: 0 });
    expect(groups[0]?.score).toBe(84);
    expect(groups[1]?.levelId).toBe(FIRST);
    expect(groups[1]?.score).toBe(97);
  });

  it('keeps the levels in the order they first appear', () => {
    const groups = groupViolationsByLevel([
      violation('warning', FIRST),
      violation('warning', GROUND),
      violation('warning', FIRST),
    ]);

    expect(groups.map((group) => group.levelId)).toEqual([FIRST, GROUND]);
    expect(groups[0]?.violations).toHaveLength(2);
  });

  it('puts the building-wide findings in one group, always last', () => {
    const groups = groupViolationsByLevel([
      violation('critical', null),
      violation('warning', GROUND),
      violation('suggestion', null),
    ]);

    expect(groups.map((group) => group.levelId)).toEqual([GROUND, null]);
    expect(groups[1]?.violations).toHaveLength(2);
    expect(groups[1]?.counts).toEqual({ critical: 1, warning: 0, suggestion: 1 });
  });

  it('gives nothing back for an empty list', () => {
    expect(groupViolationsByLevel([])).toEqual([]);
  });

  it('adds up to the same model score across every group', () => {
    const all = [
      ...repeat(2, 'critical', GROUND),
      ...repeat(3, 'warning', FIRST),
      ...repeat(1, 'suggestion', null),
    ];
    const groups = groupViolationsByLevel(all);
    const totalPenalty = groups.reduce((sum, group) => sum + (HEALTH_SCORE_MAX - group.score), 0);

    expect(HEALTH_SCORE_MAX - totalPenalty).toBe(computeHealthScore(all));
  });

  it('leaves the list it was given alone', () => {
    const all = [...repeat(2, 'critical', GROUND), ...repeat(1, 'warning', null)];
    const before = JSON.stringify(all);

    groupViolationsByLevel(all);

    expect(JSON.stringify(all)).toBe(before);
  });
});

/* -------------------------------------------------------------------------- */
/* Sorting by severity.                                                        */
/* -------------------------------------------------------------------------- */

describe('sorting by severity', () => {
  it('puts the worst first', () => {
    const sorted = sortBySeverity([
      violation('suggestion'),
      violation('critical'),
      violation('warning'),
    ]);

    expect(sorted.map((found) => found.severity)).toEqual(['critical', 'warning', 'suggestion']);
  });

  it('keeps the order violations came in within one severity', () => {
    const first = violation('warning');
    const second = violation('warning');
    const third = violation('warning');

    expect(sortBySeverity([first, second, third])).toEqual([first, second, third]);
    expect(sortBySeverity([violation('critical'), first, second]).slice(1)).toEqual([first, second]);
  });

  it('returns a new list and leaves the original in its own order', () => {
    const unsorted = [violation('suggestion'), violation('critical')];
    const sorted = sortBySeverity(unsorted);

    expect(sorted).not.toBe(unsorted);
    expect(unsorted.map((found) => found.severity)).toEqual(['suggestion', 'critical']);
  });

  it('gives the same order twice running', () => {
    const mixed = [
      violation('warning'),
      violation('critical'),
      violation('suggestion'),
      violation('warning'),
      violation('critical'),
    ];

    expect(sortBySeverity(mixed)).toEqual(sortBySeverity(mixed));
  });

  it('handles an empty list', () => {
    expect(sortBySeverity([])).toEqual([]);
  });
});
