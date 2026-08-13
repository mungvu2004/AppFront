import { describe, expect, it } from 'vitest';

import { distanceBetween } from '../../units/snap';
import { millimetres, type Millimetres } from '../../units/types';
import type { PointMm } from '../../units/compare';
import type { Wall } from '../../walls/types';
import {
  attachToWall,
  DEFAULT_ATTACH_RADIUS_MM,
  openingCentre,
  placeOnWall,
} from '../attach';
import {
  isAttached,
  isOrphan,
  type Opening,
  type RelativePosition,
  type TracedOpening,
} from '../types';

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

function traced(id: string, centre: PointMm, overrides: Partial<TracedOpening> = {}): TracedOpening {
  return {
    id: `D-${id}`,
    kind: 'door',
    widthMm: millimetres(900),
    heightMm: millimetres(2200),
    sillHeightMm: millimetres(0),
    swing: 'left',
    centre,
    ...overrides,
  };
}

/** A four metre run along the x axis, 200 mm thick, so its face is 100 mm out. */
const RUN_ALONG_X = wall('1', point(0, 0), point(4000, 0));

/** The same length along the y axis. */
const RUN_ALONG_Y = wall('2', point(0, 0), point(0, 4000));

/** A 3-4-5 diagonal, five metres long, so fractions land on round millimetres. */
const RUN_DIAGONAL = wall('3', point(0, 0), point(3000, 4000));

/** Drawn from the far corner back, so the `start` end is not the lower one. */
const RUN_REVERSED = wall('4', point(6000, 2000), point(2000, 2000));

const EVERY_RUN: readonly Wall[] = [RUN_ALONG_X, RUN_ALONG_Y, RUN_DIAGONAL, RUN_REVERSED];

/** Fractions worth checking, including both ends and an unrepresentable third. */
const EVERY_POSITION: readonly RelativePosition[] = [0, 0.001, 0.25, 1 / 3, 0.5, 0.9, 0.999, 1];

/** Reads a fraction off an attachment, failing the test when it orphaned. */
function positionOf(opening: Opening): RelativePosition {
  if (!isAttached(opening)) {
    throw new Error(`Expected an attached opening, got orphan: ${opening.orphanReason}`);
  }
  return opening.relativePosition;
}

/* -------------------------------------------------------------------------- */
/* Storing a position along the wall.                                          */
/* -------------------------------------------------------------------------- */

describe('what attaching stores', () => {
  it('turns a centre on the centreline into the fraction along it', () => {
    const attachment = attachToWall(traced('1', point(1000, 0)), [RUN_ALONG_X]);

    expect(attachment.wallId).toBe('W-1');
    expect(positionOf(attachment.opening)).toBeCloseTo(0.25, 9);
  });

  it('keeps no absolute coordinate on an attached opening', () => {
    const attachment = attachToWall(traced('1', point(1000, 0)), [RUN_ALONG_X]);

    expect('centre' in attachment.opening).toBe(false);
  });

  it('carries the size, the sill and the swing through untouched', () => {
    const window = traced('7', point(2000, 0), {
      kind: 'window',
      widthMm: millimetres(1200),
      heightMm: millimetres(1400),
      sillHeightMm: millimetres(900),
      swing: 'sliding',
    });

    const attachment = attachToWall(window, [RUN_ALONG_X]);

    expect(attachment.opening).toMatchObject({
      id: 'D-7',
      kind: 'window',
      widthMm: 1200,
      heightMm: 1400,
      sillHeightMm: 900,
      swing: 'sliding',
    });
  });

  it('projects a centre traced off the centreline onto it', () => {
    const attachment = attachToWall(traced('1', point(1000, 40)), [RUN_ALONG_X]);

    expect(positionOf(attachment.opening)).toBeCloseTo(0.25, 9);
    expect(attachment.distanceToCentrelineMm).toBeCloseTo(40, 6);
    expect(attachment.distanceToFaceMm).toBe(0);
  });

  it('reads a centre traced on the face of a thick wall as sitting on the wall', () => {
    const thick = wall('9', point(0, 0), point(4000, 0), 400);

    const attachment = attachToWall(traced('1', point(1000, 200)), [thick]);

    expect(attachment.wallId).toBe('W-9');
    expect(attachment.distanceToFaceMm).toBe(0);
  });

  it('pulls a centre traced past the end back onto the end', () => {
    const attachment = attachToWall(traced('1', point(-100, 0)), [RUN_ALONG_X]);

    expect(positionOf(attachment.opening)).toBe(0);
    expect(attachment.distanceToCentrelineMm).toBeCloseTo(100, 6);
  });

  it('measures the fraction from the start end, whichever corner that is', () => {
    // RUN_REVERSED runs from x 6000 back to x 2000, so a quarter along is x 5000.
    const attachment = attachToWall(traced('1', point(5000, 2000)), [RUN_REVERSED]);

    expect(positionOf(attachment.opening)).toBeCloseTo(0.25, 9);
  });

  it('says in Vietnamese what it did', () => {
    const attachment = attachToWall(traced('1', point(1000, 40)), [RUN_ALONG_X]);

    expect(attachment.message).toBe(
      'Đã gắn cửa đi D-1 vào tường W-1, cách đầu tường 1000 mm (vị trí tương đối 0,25), ' +
        'lệch 40 mm khỏi tim tường.',
    );
  });
});

/* -------------------------------------------------------------------------- */
/* The round trip.                                                             */
/* -------------------------------------------------------------------------- */

describe('placing back where it came from', () => {
  it('returns the traced centre within a millimetre, on every run and fraction', () => {
    for (const run of EVERY_RUN) {
      for (const position of EVERY_POSITION) {
        const centre = placeOnWall(run, position);
        const attachment = attachToWall(traced('1', centre), [run]);
        const placed = placeOnWall(run, positionOf(attachment.opening));

        expect(distanceBetween(placed, centre)).toBeLessThanOrEqual(1);
        expect(positionOf(attachment.opening)).toBeCloseTo(position, 9);
      }
    }
  });

  it('returns the exact same coordinate for a centre on the centreline', () => {
    const centre = point(1800, 2400);

    const attachment = attachToWall(traced('1', centre), [RUN_DIAGONAL]);
    const placed = placeOnWall(RUN_DIAGONAL, positionOf(attachment.opening));

    expect(placed.x).toBeCloseTo(1800, 6);
    expect(placed.y).toBeCloseTo(2400, 6);
  });

  it('gives back the foot of the perpendicular, losing only the sideways offset', () => {
    const attachment = attachToWall(traced('1', point(1000, 40)), [RUN_ALONG_X]);
    const placed = placeOnWall(RUN_ALONG_X, positionOf(attachment.opening));

    expect(placed).toEqual(point(1000, 0));
    expect(distanceBetween(placed, point(1000, 40))).toBeCloseTo(40, 6);
  });

  it('places an attached opening through its own host', () => {
    const attachment = attachToWall(traced('1', point(1000, 0)), [RUN_ALONG_X]);
    const opening = attachment.opening;

    if (!isAttached(opening)) {
      throw new Error('Expected the opening to attach.');
    }

    expect(openingCentre(RUN_ALONG_X, opening)).toEqual(point(1000, 0));
  });
});

/* -------------------------------------------------------------------------- */
/* An opening follows its wall.                                                */
/* -------------------------------------------------------------------------- */

describe('following the wall it belongs to', () => {
  const attachment = attachToWall(traced('1', point(1000, 0)), [RUN_ALONG_X]);
  const opening = attachment.opening;

  if (!isAttached(opening)) {
    throw new Error('Expected the opening to attach.');
  }

  it('moves with the wall when the wall is dragged', () => {
    const dragged = wall('1', point(1000, 1000), point(5000, 1000));

    expect(openingCentre(dragged, opening)).toEqual(point(2000, 1000));
  });

  it('turns with the wall when the wall is turned', () => {
    const turned = wall('1', point(0, 0), point(0, 4000));

    expect(openingCentre(turned, opening)).toEqual(point(0, 1000));
  });

  it('slides along as the wall is stretched', () => {
    const stretched = wall('1', point(0, 0), point(8000, 0));

    expect(openingCentre(stretched, opening)).toEqual(point(2000, 0));
  });

  it('refuses to be placed on a wall that does not own it', () => {
    expect(() => openingCentre(RUN_ALONG_Y, opening)).toThrow(/belongs to wall W-1/);
  });
});

/* -------------------------------------------------------------------------- */
/* Choosing between walls.                                                     */
/* -------------------------------------------------------------------------- */

describe('choosing which wall owns the opening', () => {
  it('takes the nearest of several walls', () => {
    const attachment = attachToWall(traced('1', point(120, 1000)), EVERY_RUN);

    expect(attachment.wallId).toBe('W-2');
  });

  it('prefers the wall whose body the centre sits inside over a closer centreline', () => {
    const thick = wall('thick', point(0, 0), point(4000, 0), 400);
    const thin = wall('thin', point(0, 300), point(4000, 300), 100);

    // 180 mm from the thick centreline is inside its body; 120 mm from the thin
    // one is 70 mm outside its face.
    const attachment = attachToWall(traced('1', point(1000, 180)), [thin, thick]);

    expect(attachment.wallId).toBe('W-thick');
  });

  it('breaks a genuine tie the same way whatever the input order', () => {
    const north = wall('1', point(0, 0), point(4000, 0));
    const south = wall('2', point(0, 400), point(4000, 400));
    const centre = point(1000, 200);

    expect(attachToWall(traced('1', centre), [north, south]).wallId).toBe('W-1');
    expect(attachToWall(traced('1', centre), [south, north]).wallId).toBe('W-1');
  });

  it('skips a wall with no length and takes one that has some', () => {
    const degenerate = wall('0', point(1000, 0), point(1000, 0));

    const attachment = attachToWall(traced('1', point(1000, 0)), [degenerate, RUN_ALONG_X]);

    expect(attachment.wallId).toBe('W-1');
  });
});

/* -------------------------------------------------------------------------- */
/* Orphans.                                                                    */
/* -------------------------------------------------------------------------- */

describe('openings no wall will take', () => {
  it('marks an opening further than the radius from every wall as an orphan', () => {
    const stray = traced('4', point(2000, 2000));

    const attachment = attachToWall(stray, [RUN_ALONG_X, RUN_ALONG_Y]);

    expect(attachment.wallId).toBeNull();
    expect(isOrphan(attachment.opening)).toBe(true);
    expect(attachment.opening).toMatchObject({
      id: 'D-4',
      wallId: null,
      orphanReason: 'noWallInRange',
    });
  });

  it('keeps the traced centre and the whole opening rather than deleting it', () => {
    const stray = traced('4', point(2000, 2000), { widthMm: millimetres(1500) });

    const opening = attachToWall(stray, [RUN_ALONG_X]).opening;

    if (!isOrphan(opening)) {
      throw new Error('Expected the opening to be orphaned.');
    }

    expect(opening.centre).toEqual(point(2000, 2000));
    expect(opening.widthMm).toBe(1500);
    expect(opening.kind).toBe('door');
  });

  it('attaches at exactly the radius and orphans a millimetre beyond it', () => {
    // The wall face is 100 mm off its centreline, so 250 mm out is 150 mm clear.
    const atLimit = attachToWall(traced('1', point(1000, 250)), [RUN_ALONG_X]);
    const beyond = attachToWall(traced('1', point(1000, 251)), [RUN_ALONG_X]);

    expect(atLimit.wallId).toBe('W-1');
    expect(beyond.wallId).toBeNull();
    expect(beyond.distanceToFaceMm).toBeCloseTo(151, 6);
  });

  it('measures 150 mm by default', () => {
    expect(DEFAULT_ATTACH_RADIUS_MM).toBe(150);
  });

  it('honours a radius the caller widens', () => {
    const stray = traced('1', point(1000, 800));

    expect(attachToWall(stray, [RUN_ALONG_X]).wallId).toBeNull();
    expect(attachToWall(stray, [RUN_ALONG_X], millimetres(700)).wallId).toBe('W-1');
  });

  it('reports having no wall at all apart from having none in reach', () => {
    const attachment = attachToWall(traced('1', point(1000, 0)), []);

    expect(attachment.opening).toMatchObject({ wallId: null, orphanReason: 'noUsableWall' });
    expect(attachment.distanceToCentrelineMm).toBeNull();
    expect(attachment.distanceToFaceMm).toBeNull();
  });

  it('orphans an opening whose centre is not a coordinate', () => {
    // `millimetres()` refuses a non-finite value, so the broken point is built by
    // hand: this is the shape a failed OCR reading actually arrives in.
    const centre: PointMm = { x: Number.NaN as Millimetres, y: millimetres(0) };

    const attachment = attachToWall(traced('1', centre), [RUN_ALONG_X]);

    expect(attachment.opening).toMatchObject({ wallId: null, orphanReason: 'centreUnknown' });
  });

  it('says in Vietnamese why the opening is floating', () => {
    const attachment = attachToWall(traced('4', point(1000, 600)), [RUN_ALONG_X]);

    expect(attachment.message).toBe(
      'Cửa đi D-4 cách mặt tường gần nhất W-1 tới 500 mm, vượt bán kính 150 mm nên đã ' +
        'đánh dấu mồ côi và giữ nguyên toạ độ đã vẽ.',
    );
  });

  it('names the kind of a hole with nothing in it', () => {
    const attachment = attachToWall(traced('5', point(1000, 600), { kind: 'void' }), []);

    expect(attachment.message).toContain('lỗ trống D-5');
  });

  it('attaches an orphan on the second try, once the wall is drawn', () => {
    const first = attachToWall(traced('1', point(1000, 0)), []);
    const orphan = first.opening;

    if (!isOrphan(orphan)) {
      throw new Error('Expected the opening to be orphaned.');
    }

    const second = attachToWall(orphan, [RUN_ALONG_X]);

    expect(second.wallId).toBe('W-1');
    expect(positionOf(second.opening)).toBeCloseTo(0.25, 9);
    expect('orphanReason' in second.opening).toBe(false);
  });
});

/* -------------------------------------------------------------------------- */
/* Input the functions refuse.                                                 */
/* -------------------------------------------------------------------------- */

describe('input that is not a position', () => {
  it('refuses a fraction past either end of the wall', () => {
    expect(() => placeOnWall(RUN_ALONG_X, 1.5)).toThrow(RangeError);
    expect(() => placeOnWall(RUN_ALONG_X, -0.2)).toThrow(RangeError);
  });

  it('refuses a fraction that is not a number', () => {
    expect(() => placeOnWall(RUN_ALONG_X, Number.NaN)).toThrow(RangeError);
  });

  it('accepts both ends of the wall', () => {
    expect(placeOnWall(RUN_ALONG_X, 0)).toEqual(point(0, 0));
    expect(placeOnWall(RUN_ALONG_X, 1)).toEqual(point(4000, 0));
  });

  it('refuses a negative search radius', () => {
    expect(() => attachToWall(traced('1', point(0, 0)), [RUN_ALONG_X], millimetres(-1))).toThrow(
      RangeError,
    );
  });
});

/* -------------------------------------------------------------------------- */
/* Purity.                                                                     */
/* -------------------------------------------------------------------------- */

describe('leaving the arguments alone', () => {
  it('writes to neither the opening nor the walls it was given', () => {
    const centre = Object.freeze(point(1000, 40));
    const opening = Object.freeze(traced('1', centre));
    const frozenWall = Object.freeze({
      ...RUN_ALONG_X,
      centreline: Object.freeze({ start: Object.freeze(point(0, 0)), end: Object.freeze(point(4000, 0)) }),
    });
    const walls = Object.freeze([frozenWall]);

    const attachment = attachToWall(opening, walls);

    expect(attachment.opening).not.toBe(opening);
    expect(opening.centre).toEqual(point(1000, 40));
    expect(frozenWall.centreline.start).toEqual(point(0, 0));
  });

  it('gives the same answer every time it is asked', () => {
    const opening = traced('1', point(1234, 56));

    expect(attachToWall(opening, EVERY_RUN)).toEqual(attachToWall(opening, EVERY_RUN));
  });
});
