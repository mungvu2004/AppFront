import { describe, expect, it } from 'vitest';

import type { PointMm } from '../../units/compare';
import { millimetres } from '../../units/types';
import { splitWall } from '../../walls/edit';
import type { Wall } from '../../walls/types';
import {
  describeReflowStatus,
  reflowOpenings,
  reflowOpeningsAcrossSplit,
  type ReflowChange,
} from '../reflow';
import {
  findOrphans,
  openingSpan,
  OPENING_RULES,
  validateOpening,
  validateOpenings,
  type OpeningRule,
} from '../validate';
import type { AttachedOpening, Opening, OrphanOpening } from '../types';

/* -------------------------------------------------------------------------- */
/* Fixtures.                                                                   */
/* -------------------------------------------------------------------------- */

function point(x: number, y: number): PointMm {
  return { x: millimetres(x), y: millimetres(y) };
}

function wall(id: string, start: PointMm, end: PointMm, thicknessMm = 200): Wall {
  return {
    id: `W-${id}`,
    kind: 'partition',
    centreline: { start, end },
    thicknessMm: millimetres(thicknessMm),
    baseElevationMm: millimetres(0),
    topElevationMm: millimetres(3000),
  };
}

function door(
  id: string,
  wallId: string,
  relativePosition: number,
  overrides: Partial<AttachedOpening> = {},
): AttachedOpening {
  return {
    id: `D-${id}`,
    kind: 'door',
    widthMm: millimetres(900),
    heightMm: millimetres(2200),
    sillHeightMm: millimetres(0),
    swing: 'left',
    wallId: `W-${wallId}`,
    relativePosition,
    ...overrides,
  };
}

function windowOn(
  id: string,
  wallId: string,
  relativePosition: number,
  overrides: Partial<AttachedOpening> = {},
): AttachedOpening {
  return {
    id: `D-${id}`,
    kind: 'window',
    widthMm: millimetres(1200),
    heightMm: millimetres(1400),
    sillHeightMm: millimetres(900),
    swing: 'sliding',
    wallId: `W-${wallId}`,
    relativePosition,
    ...overrides,
  };
}

function orphanOpening(
  id: string,
  centre: PointMm,
  overrides: Partial<OrphanOpening> = {},
): OrphanOpening {
  return {
    id: `D-${id}`,
    kind: 'door',
    widthMm: millimetres(900),
    heightMm: millimetres(2200),
    sillHeightMm: millimetres(0),
    swing: 'left',
    wallId: null,
    centre,
    orphanReason: 'noWallInRange',
    ...overrides,
  };
}

/** A four metre run along the x axis, the wall every reflow starts from. */
const WALL_BEFORE = wall('1', point(0, 0), point(4000, 0));

function onlyChange(changes: readonly ReflowChange[]): ReflowChange {
  expect(changes).toHaveLength(1);
  const change = changes[0];
  if (change === undefined) {
    throw new Error('Expected exactly one change.');
  }
  return change;
}

function rulesBroken(violations: readonly { readonly rule: OpeningRule }[]): readonly OpeningRule[] {
  return violations.map((violation) => violation.rule);
}

/* -------------------------------------------------------------------------- */
/* Reflow: the fraction is kept.                                              */
/* -------------------------------------------------------------------------- */

describe('carrying openings onto an edited wall', () => {
  it('keeps a door on the wall and marks it moved when the wall is halved', () => {
    const halved = wall('1', point(0, 0), point(2000, 0));

    const result = reflowOpenings(WALL_BEFORE, halved, [door('1', '1', 0.25)]);
    const change = onlyChange(result.changes);

    expect(change.after.wallId).toBe('W-1');
    expect(change.after.relativePosition).toBeCloseTo(0.25, 9);
    expect(change.status).toBe('moved');
    expect(change.reason).toBe('wallReshaped');
    expect(change.driftMm).toBeCloseTo(500, 6);
    expect(describeReflowStatus(change.status)).toBe('Đã dịch chuyển');
  });

  it('leaves that door wholly inside the shortened wall', () => {
    const halved = wall('1', point(0, 0), point(2000, 0));

    const result = reflowOpenings(WALL_BEFORE, halved, [door('1', '1', 0.25)]);
    const moved = onlyChange(result.changes).after;
    const span = openingSpan(halved, moved);

    expect(span.lowMm).toBeCloseTo(50, 6);
    expect(span.highMm).toBeCloseTo(950, 6);
    expect(rulesBroken(validateOpening(moved, halved))).toEqual([]);
  });

  it('says in Vietnamese that the opening drifted with the wall', () => {
    const halved = wall('1', point(0, 0), point(2000, 0));

    const result = reflowOpenings(WALL_BEFORE, halved, [door('1', '1', 0.25)]);

    expect(onlyChange(result.changes).message).toBe(
      'Cửa đi D-1 giữ nguyên vị trí tương đối 0,25 nhưng đã dịch chuyển 500 mm theo tường W-1.',
    );
  });

  it('reports nothing moved when the edit left the centreline alone', () => {
    const thicker = wall('1', point(0, 0), point(4000, 0), 300);

    const change = onlyChange(reflowOpenings(WALL_BEFORE, thicker, [door('1', '1', 0.25)]).changes);

    expect(change.status).toBe('unchanged');
    expect(change.reason).toBe('positionKept');
    expect(change.driftMm).toBe(0);
    expect(change.message).toBe('Giữ nguyên cửa đi D-1 tại vị trí tương đối 0,25 trên tường W-1.');
  });

  it('carries openings along when the wall is dragged across the plan', () => {
    const dragged = wall('1', point(1000, 0), point(5000, 0));

    const change = onlyChange(reflowOpenings(WALL_BEFORE, dragged, [door('1', '1', 0.25)]).changes);

    expect(change.after.relativePosition).toBeCloseTo(0.25, 9);
    expect(change.driftMm).toBeCloseTo(1000, 6);
    expect(change.status).toBe('moved');
  });

  it('spreads openings proportionally when the wall is stretched', () => {
    const stretched = wall('1', point(0, 0), point(8000, 0));

    const change = onlyChange(
      reflowOpenings(WALL_BEFORE, stretched, [door('1', '1', 0.25)]).changes,
    );

    expect(openingSpan(stretched, change.after).centreMm).toBeCloseTo(2000, 6);
    expect(change.driftMm).toBeCloseTo(1000, 6);
  });

  it('pulls an opening that now runs past the end back inside the wall', () => {
    const halved = wall('1', point(0, 0), point(2000, 0));

    const change = onlyChange(reflowOpenings(WALL_BEFORE, halved, [door('1', '1', 0.85)]).changes);

    expect(change.reason).toBe('slidInsideWall');
    expect(change.status).toBe('moved');
    expect(change.after.relativePosition).toBeCloseTo(0.775, 9);
    expect(openingSpan(halved, change.after).highMm).toBeCloseTo(2000, 6);
    expect(change.message).toContain('đã được kéo về trong lòng tường W-1');
  });

  it('moves nothing and asks for a person when the opening no longer fits', () => {
    const stub = wall('1', point(0, 0), point(700, 0));

    const result = reflowOpenings(WALL_BEFORE, stub, [door('1', '1', 0.25)]);
    const change = onlyChange(result.changes);

    expect(change.status).toBe('needsDecision');
    expect(change.reason).toBe('openingWiderThanWall');
    expect(change.after.relativePosition).toBe(0.25);
    expect(result.needsDecision).toEqual(['D-1']);
    expect(change.message).toContain('cần người dùng quyết định');
  });

  it('asks for a person when the wall has no length left', () => {
    const collapsed = wall('1', point(0, 0), point(0, 0));

    const change = onlyChange(
      reflowOpenings(WALL_BEFORE, collapsed, [door('1', '1', 0.25)]).changes,
    );

    expect(change.status).toBe('needsDecision');
    expect(change.reason).toBe('wallHasNoLength');
  });

  it('never drops an opening, however short the wall becomes', () => {
    const stub = wall('1', point(0, 0), point(700, 0));
    const openings = [door('1', '1', 0.1), door('2', '1', 0.5), door('3', '1', 0.9)];

    const result = reflowOpenings(WALL_BEFORE, stub, openings);

    expect(result.openings).toHaveLength(3);
    expect(result.openings.map((opening) => opening.id)).toEqual(['D-1', 'D-2', 'D-3']);
    expect(result.needsDecision).toEqual(['D-1', 'D-2', 'D-3']);
  });

  it('leaves other walls and orphans out of it', () => {
    const halved = wall('1', point(0, 0), point(2000, 0));
    const openings: readonly Opening[] = [
      door('1', '1', 0.25),
      door('2', '2', 0.5),
      orphanOpening('3', point(9000, 9000)),
    ];

    const result = reflowOpenings(WALL_BEFORE, halved, openings);

    expect(result.openings.map((opening) => opening.id)).toEqual(['D-1']);
  });

  it('refuses to move openings between two different walls', () => {
    expect(() => reflowOpenings(WALL_BEFORE, wall('2', point(0, 0), point(2000, 0)), [])).toThrow(
      /one wall before and after/,
    );
  });

  it('writes to neither the openings nor the walls it was given', () => {
    const opening = Object.freeze(door('1', '1', 0.25));
    const before = Object.freeze({
      ...WALL_BEFORE,
      centreline: Object.freeze({ start: point(0, 0), end: point(4000, 0) }),
    });
    const after = wall('1', point(0, 0), point(2000, 0));

    const change = onlyChange(reflowOpenings(before, after, Object.freeze([opening])).changes);

    expect(change.before).toBe(opening);
    expect(change.after).not.toBe(opening);
    expect(opening.relativePosition).toBe(0.25);
  });
});

/* -------------------------------------------------------------------------- */
/* Reflow across a cut.                                                       */
/* -------------------------------------------------------------------------- */

describe('sharing openings out when a wall is cut in two', () => {
  const split = splitWall(WALL_BEFORE, point(2000, 0), 'W-2');

  if (!split.ok) {
    throw new Error(`Expected the wall to split, got ${split.reason}.`);
  }

  const pieces = split.walls;

  it('sends each opening to the piece holding its centre', () => {
    const result = reflowOpeningsAcrossSplit(WALL_BEFORE, pieces, [
      door('1', '1', 0.25),
      door('2', '1', 0.75),
    ]);

    expect(result.changes.map((change) => change.after.wallId)).toEqual(['W-1', 'W-2']);
  });

  it('re-expresses the fraction against its own piece, moving nothing', () => {
    const result = reflowOpeningsAcrossSplit(WALL_BEFORE, pieces, [
      door('1', '1', 0.25),
      door('2', '1', 0.75),
    ]);

    expect(result.changes.map((change) => change.after.relativePosition)).toEqual([0.5, 0.5]);
    expect(result.changes.map((change) => change.driftMm)).toEqual([0, 0]);
    expect(result.changes.map((change) => change.status)).toEqual(['unchanged', 'unchanged']);
    expect(result.needsDecision).toEqual([]);
  });

  it('keeps every opening where it was on the plan', () => {
    const result = reflowOpeningsAcrossSplit(WALL_BEFORE, pieces, [door('1', '1', 0.35)]);
    const change = onlyChange(result.changes);
    const piece = change.after.wallId === pieces[0].id ? pieces[0] : pieces[1];

    expect(openingSpan(piece, change.after).centreMm).toBeCloseTo(1400, 6);
  });

  it('asks for a person when an opening lies across the cut', () => {
    const result = reflowOpeningsAcrossSplit(WALL_BEFORE, pieces, [door('1', '1', 0.5)]);
    const change = onlyChange(result.changes);

    expect(change.status).toBe('needsDecision');
    expect(change.reason).toBe('straddlesCut');
    expect(result.needsDecision).toEqual(['D-1']);
    expect(change.message).toContain('nằm vắt qua điểm cắt');
  });

  it('leaves a straddling opening exactly where it was, for validation to flag', () => {
    const result = reflowOpeningsAcrossSplit(WALL_BEFORE, pieces, [door('1', '1', 0.5)]);
    const change = onlyChange(result.changes);

    // The centre sat on the cut, so on the first piece it is at the very end.
    expect(change.after.wallId).toBe('W-1');
    expect(change.after.relativePosition).toBe(1);
    expect(change.driftMm).toBe(0);
    expect(rulesBroken(validateOpening(change.after, pieces[0]))).toEqual(['beyondWallEnd']);
  });

  it('does not call an opening that only touches the cut a straddler', () => {
    // Centre 1550 with a 900 wide leaf reaches exactly to the cut at 2000.
    const change = onlyChange(
      reflowOpeningsAcrossSplit(WALL_BEFORE, pieces, [door('1', '1', 0.3875)]).changes,
    );

    expect(change.status).toBe('unchanged');
    expect(change.after.wallId).toBe('W-1');
  });

  it('never drops an opening across a cut', () => {
    const openings = [door('1', '1', 0.1), door('2', '1', 0.5), door('3', '1', 0.9)];

    const result = reflowOpeningsAcrossSplit(WALL_BEFORE, pieces, openings);

    expect(result.openings.map((opening) => opening.id)).toEqual(['D-1', 'D-2', 'D-3']);
  });

  it('refuses pieces that do not meet at the cut', () => {
    const apart: readonly [Wall, Wall] = [
      wall('1', point(0, 0), point(1900, 0)),
      wall('2', point(2000, 0), point(4000, 0)),
    ];

    expect(() => reflowOpeningsAcrossSplit(WALL_BEFORE, apart, [])).toThrow(/do not meet at the cut/);
  });

  it('refuses pieces that do not cover the wall', () => {
    const short: readonly [Wall, Wall] = [
      wall('1', point(0, 0), point(2000, 0)),
      wall('2', point(2000, 0), point(3000, 0)),
    ];

    expect(() => reflowOpeningsAcrossSplit(WALL_BEFORE, short, [])).toThrow(/end to end/);
  });

  it('refuses two pieces carrying the same id', () => {
    const twins: readonly [Wall, Wall] = [
      wall('1', point(0, 0), point(2000, 0)),
      wall('1', point(2000, 0), point(4000, 0)),
    ];

    expect(() => reflowOpeningsAcrossSplit(WALL_BEFORE, twins, [])).toThrow(/carry the id/);
  });
});

/* -------------------------------------------------------------------------- */
/* Validation.                                                                */
/* -------------------------------------------------------------------------- */

describe('checking an opening against the rules', () => {
  it('reports a window with a 0,2 m sill as invalid', () => {
    const low = windowOn('2', '1', 0.5, { sillHeightMm: millimetres(200) });

    const violations = validateOpening(low, WALL_BEFORE);

    expect(rulesBroken(violations)).toEqual(['windowSill']);
    expect(violations[0]?.message).toBe(
      'Cửa sổ D-2 có ngưỡng 200 mm, ngoài khoảng 400–1500 mm của cửa sổ.',
    );
  });

  it('accepts a window sill at either end of the range', () => {
    for (const sillHeightMm of [400, 1500]) {
      const sill = windowOn('2', '1', 0.5, { sillHeightMm: millimetres(sillHeightMm) });

      expect(rulesBroken(validateOpening(sill, WALL_BEFORE))).toEqual([]);
    }
  });

  it('reports a door outside the standard height range', () => {
    const low = door('1', '1', 0.25, { heightMm: millimetres(1500) });
    const tall = door('1', '1', 0.25, { heightMm: millimetres(2500) });

    expect(rulesBroken(validateOpening(low, WALL_BEFORE))).toEqual(['doorHeight']);
    expect(rulesBroken(validateOpening(tall, WALL_BEFORE))).toEqual(['doorHeight']);
  });

  it('accepts a door at either end of the height range', () => {
    for (const heightMm of [1800, 2400]) {
      const leaf = door('1', '1', 0.25, { heightMm: millimetres(heightMm) });

      expect(rulesBroken(validateOpening(leaf, WALL_BEFORE))).toEqual([]);
    }
  });

  it('reports a door with a sill', () => {
    const stepped = door('1', '1', 0.25, { sillHeightMm: millimetres(50) });

    expect(rulesBroken(validateOpening(stepped, WALL_BEFORE))).toEqual(['doorSill']);
  });

  it('holds a hole with nothing in it to no standards table', () => {
    const hole = door('1', '1', 0.25, {
      kind: 'void',
      heightMm: millimetres(1500),
      sillHeightMm: millimetres(200),
      swing: 'fixed',
    });

    expect(rulesBroken(validateOpening(hole, WALL_BEFORE))).toEqual([]);
  });

  it('reports an opening taking more than 80% of the wall', () => {
    const wide = door('1', '1', 0.5, { widthMm: millimetres(3300) });
    const atLimit = door('1', '1', 0.5, { widthMm: millimetres(3200) });

    expect(rulesBroken(validateOpening(wide, WALL_BEFORE))).toEqual(['widthShareOfWall']);
    expect(rulesBroken(validateOpening(atLimit, WALL_BEFORE))).toEqual([]);
  });

  it('reports two openings taking the same stretch of wall', () => {
    const first = door('1', '1', 0.25);
    const second = door('2', '1', 0.3);

    const violations = validateOpening(first, WALL_BEFORE, [first, second]);

    expect(rulesBroken(violations)).toEqual(['overlappingOpenings']);
    expect(violations[0]?.otherOpeningId).toBe('D-2');
    expect(violations[0]?.message).toBe('Cửa đi D-1 chồng lên D-2 trên tường W-1 một đoạn 700 mm.');
  });

  it('lets two openings sit edge to edge', () => {
    const first = door('1', '1', 0.25);
    const second = door('2', '1', 0.475);

    expect(rulesBroken(validateOpening(first, WALL_BEFORE, [first, second]))).toEqual([]);
  });

  it('never reads an opening on another wall as an overlap', () => {
    const here = door('1', '1', 0.25);
    const elsewhere = door('2', '2', 0.25);

    expect(rulesBroken(validateOpening(here, WALL_BEFORE, [here, elsewhere]))).toEqual([]);
  });

  it('reports an opening reaching past the end of its wall', () => {
    const overhanging = door('1', '1', 0.99);

    const violations = validateOpening(overhanging, WALL_BEFORE);

    expect(rulesBroken(violations)).toEqual(['beyondWallEnd']);
    expect(violations[0]?.severity).toBe('critical');
    expect(violations[0]?.message).toContain('mất 410 mm');
  });

  it('reports a head above the top of the wall', () => {
    const tall = windowOn('2', '1', 0.5, { heightMm: millimetres(2500) });

    expect(rulesBroken(validateOpening(tall, WALL_BEFORE))).toEqual(['aboveWallTop']);
  });

  it('reports a size that is not a positive length', () => {
    const flat = door('1', '1', 0.25, { widthMm: millimetres(0) });

    expect(rulesBroken(validateOpening(flat, WALL_BEFORE))).toEqual(['sizeNotPositive']);
  });

  it('puts the impossible before the merely unusual', () => {
    const broken = door('1', '1', 0.25, {
      widthMm: millimetres(0),
      heightMm: millimetres(1500),
    });

    expect(rulesBroken(validateOpening(broken, WALL_BEFORE))).toEqual([
      'sizeNotPositive',
      'doorHeight',
    ]);
  });

  it('separates what cannot be built from what is only off the table', () => {
    const overhanging = validateOpening(door('1', '1', 0.99), WALL_BEFORE);
    const tallLeaf = validateOpening(
      door('1', '1', 0.25, { heightMm: millimetres(2500) }),
      WALL_BEFORE,
    );

    expect(overhanging[0]?.severity).toBe('critical');
    expect(tallLeaf[0]?.severity).toBe('warning');
  });

  it('says nothing about a door that follows every rule', () => {
    expect(validateOpening(door('1', '1', 0.25), WALL_BEFORE)).toEqual([]);
  });

  it('refuses to judge an opening against a wall that does not own it', () => {
    expect(() => validateOpening(door('1', '2', 0.25), WALL_BEFORE)).toThrow(/belongs to wall W-2/);
  });
});

/* -------------------------------------------------------------------------- */
/* Validating a whole plan.                                                   */
/* -------------------------------------------------------------------------- */

describe('checking every opening on a plan', () => {
  it('reports an overlapping pair once rather than from both sides', () => {
    const openings = [door('1', '1', 0.25), door('2', '1', 0.3)];

    const violations = validateOpenings(openings, [WALL_BEFORE]);

    expect(rulesBroken(violations)).toEqual(['overlappingOpenings']);
    expect(violations[0]?.openingId).toBe('D-1');
  });

  it('leaves orphans to findOrphans', () => {
    const openings: readonly Opening[] = [orphanOpening('9', point(9000, 9000))];

    expect(validateOpenings(openings, [WALL_BEFORE])).toEqual([]);
  });

  it('leaves a dangling wall reference to the integrity check', () => {
    const openings = [door('1', '404', 0.25)];

    expect(validateOpenings(openings, [WALL_BEFORE])).toEqual([]);
  });

  it('gathers the problems of several walls', () => {
    const second = wall('2', point(0, 1000), point(4000, 1000));
    const openings = [
      door('1', '1', 0.99),
      windowOn('2', '2', 0.5, { sillHeightMm: millimetres(200) }),
    ];

    expect(rulesBroken(validateOpenings(openings, [WALL_BEFORE, second]))).toEqual([
      'beyondWallEnd',
      'windowSill',
    ]);
  });
});

/* -------------------------------------------------------------------------- */
/* Orphans.                                                                   */
/* -------------------------------------------------------------------------- */

describe('listing the orphans with something to offer', () => {
  it('offers the nearest wall without attaching anything to it', () => {
    const orphan = orphanOpening('9', point(1000, 300));

    const reports = findOrphans([orphan], [WALL_BEFORE]);

    expect(reports).toHaveLength(1);
    expect(reports[0]?.opening).toBe(orphan);
    expect(reports[0]?.suggestedWallId).toBe('W-1');
    expect(reports[0]?.suggestedPosition).toBeCloseTo(0.25, 9);
    expect(reports[0]?.distanceToFaceMm).toBeCloseTo(200, 6);
    expect(reports[0]?.message).toBe(
      'Cửa đi D-9 đang mồ côi; có thể gắn vào tường W-1 cách đó 200 mm.',
    );
  });

  it('offers a wall further away than an automatic attach would take', () => {
    const orphan = orphanOpening('9', point(1000, 900));

    expect(findOrphans([orphan], [WALL_BEFORE])[0]?.suggestedWallId).toBe('W-1');
  });

  it('suggests nothing when the nearest wall is another room away', () => {
    const orphan = orphanOpening('9', point(1000, 5000));

    const report = findOrphans([orphan], [WALL_BEFORE])[0];

    expect(report?.suggestedWallId).toBeNull();
    expect(report?.suggestedPosition).toBeNull();
    expect(report?.distanceToFaceMm).toBeCloseTo(4900, 6);
    expect(report?.message).toContain('xa hơn bán kính gợi ý 1500 mm');
  });

  it('says so plainly when there is no wall at all', () => {
    const report = findOrphans([orphanOpening('9', point(1000, 0))], [])[0];

    expect(report?.suggestedWallId).toBeNull();
    expect(report?.distanceToFaceMm).toBeNull();
    expect(report?.message).toBe('Cửa đi D-9 đang mồ côi và chưa có tường nào để gợi ý.');
  });

  it('passes over the openings that are already attached', () => {
    const openings: readonly Opening[] = [
      door('1', '1', 0.25),
      orphanOpening('9', point(1000, 300)),
    ];

    expect(findOrphans(openings, [WALL_BEFORE]).map((report) => report.opening.id)).toEqual(['D-9']);
  });
});

/* -------------------------------------------------------------------------- */
/* The rule table.                                                            */
/* -------------------------------------------------------------------------- */

describe('the thresholds the rules are read from', () => {
  it('holds the numbers the brief fixes', () => {
    expect(OPENING_RULES).toMatchObject({
      doorHeightMinMm: 1800,
      doorHeightMaxMm: 2400,
      doorSillHeightMm: 0,
      windowSillMinMm: 400,
      windowSillMaxMm: 1500,
      maxWidthShareOfWall: 0.8,
    });
  });

  it('lets a project judge openings by its own table', () => {
    const ownRules = { ...OPENING_RULES, windowSillMinMm: millimetres(200) };
    const low = windowOn('2', '1', 0.5, { sillHeightMm: millimetres(200) });

    expect(rulesBroken(validateOpening(low, WALL_BEFORE, [], ownRules))).toEqual([]);
  });
});
