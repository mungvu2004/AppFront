import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

import { describe, expect, it } from 'vitest';

import { RULE_SEVERITY_LABELS, type RuleSeverity } from '@/domain/rules/registry';
import type { LevelId, RoomUsage } from '@/domain/spatial/types';

import {
  COLORING_MODE_IDS,
  COLORING_MODE_LABELS,
  createColoringMode,
  createColoringModes,
  type ColoringMode,
  type ColoringModeId,
  type PaintSubject,
} from '../modes';
import {
  bandIndexOf,
  COLOR_TOKEN_NAMES,
  createQuantileScale,
  isColorTokenName,
  MAX_SCALE_STEPS,
  quantileBreaks,
  SEQUENTIAL_RAMP,
  UNPAINTED_TOKEN,
  type ColorTokenName,
} from '../scales';

/* -------------------------------------------------------------------------- */
/* The standard sample set (invariant A14).                                    */
/* -------------------------------------------------------------------------- */

/** 48 walls, 21 axes, 34 rooms, 14 openings, 4 levels — and 248,60 m². */
const SAMPLE_WALL_COUNT = 48;
const SAMPLE_ROOM_COUNT = 34;
const SAMPLE_OPENING_COUNT = 14;
const SAMPLE_LEVEL_COUNT = 4;
const SAMPLE_HALL_AREA_M2 = 248.6;

const SAMPLE_LEVEL_IDS: readonly LevelId[] = ['L-01', 'L-02', 'L-03', 'L-04'];

const ROOM_USAGES: readonly RoomUsage[] = [
  'livingRoom',
  'bedroom',
  'kitchen',
  'bathroom',
  'corridor',
  'stairwell',
  'utility',
  'other',
];

function makeSubject(overrides: Partial<PaintSubject> = {}): PaintSubject {
  return {
    id: 'W-000014',
    levelId: 'L-01',
    review: { confidence: 0.72, source: 'ai', reviewed: false },
    usage: null,
    areaM2: null,
    worstSeverity: null,
    ...overrides,
  };
}

/**
 * The level a room of a given index sits on: ten, ten, eight, six.
 *
 * The first level holds exactly the ten smallest rooms, which is what lets the
 * "filter to one level" test below predict the re-cut boundaries by hand.
 */
function levelOfRoom(index: number): LevelId {
  if (index < 10) {
    return 'L-01';
  }
  if (index < 20) {
    return 'L-02';
  }

  return index < 28 ? 'L-03' : 'L-04';
}

/**
 * Thirty-four rooms: areas 1 to 33 m², and the 248,60 m² hall.
 *
 * Deliberately arithmetic apart from the hall, so every quantile below is a
 * number that can be checked by hand rather than by re-running the code under
 * test. The hall is the outlier the equal-width comparison needs.
 */
function makeSampleRooms(): PaintSubject[] {
  return Array.from({ length: SAMPLE_ROOM_COUNT }, (_unused, index) =>
    makeSubject({
      id: `R-${String(index).padStart(6, '0')}`,
      levelId: levelOfRoom(index),
      areaM2: index === SAMPLE_ROOM_COUNT - 1 ? SAMPLE_HALL_AREA_M2 : index + 1,
      usage: ROOM_USAGES[index % ROOM_USAGES.length] ?? 'other',
      review: { confidence: (index % 10) / 10, source: 'ai', reviewed: index % 5 === 0 },
      worstSeverity: (['critical', 'warning', 'suggestion', null] as const)[index % 4] ?? null,
    }),
  );
}

function makeSampleWalls(): PaintSubject[] {
  return Array.from({ length: SAMPLE_WALL_COUNT }, (_unused, index) =>
    makeSubject({
      id: `W-${String(index).padStart(6, '0')}`,
      levelId: SAMPLE_LEVEL_IDS[index % SAMPLE_LEVEL_COUNT] ?? 'L-01',
      review: {
        confidence: (index % 11) / 10,
        source: index % 3 === 0 ? 'human' : 'ai',
        reviewed: index % 7 === 0,
      },
    }),
  );
}

function makeSampleOpenings(): PaintSubject[] {
  return Array.from({ length: SAMPLE_OPENING_COUNT }, (_unused, index) =>
    makeSubject({
      id: `D-${String(index).padStart(6, '0')}`,
      levelId: SAMPLE_LEVEL_IDS[index % SAMPLE_LEVEL_COUNT] ?? 'L-01',
      review: { confidence: 1, source: 'ai', reviewed: false },
    }),
  );
}

/** Everything the standard sample set puts on screen at once. */
function makeSampleView(): PaintSubject[] {
  return [...makeSampleWalls(), ...makeSampleRooms(), ...makeSampleOpenings()];
}

/* -------------------------------------------------------------------------- */
/* Helpers.                                                                    */
/* -------------------------------------------------------------------------- */

/**
 * The exact expression `eslint-rules/no-raw-color.js` refuses.
 *
 * Copied rather than imported — the rule is CommonJS and its regex is not
 * exported — so that "no raw colour" is tested against the same definition the
 * linter uses rather than a looser one written here.
 */
const RAW_COLOR = /(#([0-9a-fA-F]{3}){1,2}\b)|(rgb|hsl)a?\(/;

/**
 * The stylesheet, read from disk.
 *
 * Resolved from the working directory rather than from `import.meta.url`: the
 * suite runs under jsdom, where `import.meta.url` is an `http://` URL that
 * `fileURLToPath` refuses. Vitest runs from the project root, which is where
 * `vitest.config.ts` sits.
 */
function globalsCss(): string {
  return readFileSync(resolve(process.cwd(), 'src/styles/globals.css'), 'utf8');
}

/** Every custom property `globals.css` declares. */
function declaredTokenNames(): string[] {
  return [...globalsCss().matchAll(/^\s*(--[a-z0-9-]+)\s*:/gm)].map((match) => match[1] ?? '');
}

/** Every token a mode can put on screen: the legend plus every painted object. */
function tokensEmittedBy(mode: ColoringMode, subjects: readonly PaintSubject[]): ColorTokenName[] {
  return [...mode.bands.map((band) => band.token), ...subjects.map((subject) => mode.paint(subject))];
}

const allModes = (subjects: readonly PaintSubject[], levelIds?: readonly LevelId[]): readonly ColoringMode[] =>
  levelIds === undefined ? createColoringModes({ subjects }) : createColoringModes({ subjects, levelIds });

/* -------------------------------------------------------------------------- */
/* The token vocabulary.                                                       */
/* -------------------------------------------------------------------------- */

describe('the token vocabulary', () => {
  it('names only custom properties that globals.css actually declares', () => {
    const declared = new Set(declaredTokenNames());

    for (const token of COLOR_TOKEN_NAMES) {
      expect(declared.has(token), `${token} is not declared in globals.css`).toBe(true);
    }
  });

  it('names every custom property globals.css declares', () => {
    const known = new Set<string>(COLOR_TOKEN_NAMES);

    for (const declared of declaredTokenNames()) {
      expect(known.has(declared), `${declared} is missing from COLOR_TOKEN_NAMES`).toBe(true);
    }
  });

  it('recognises a declared token and rejects anything else', () => {
    expect(isColorTokenName('--wall-220')).toBe(true);
    expect(isColorTokenName('--not-a-token')).toBe(false);
    expect(isColorTokenName('#567a96')).toBe(false);
  });

  it('spends five ordered neutrals on the sequential ramp', () => {
    expect(SEQUENTIAL_RAMP).toHaveLength(MAX_SCALE_STEPS);
    expect(new Set(SEQUENTIAL_RAMP).size).toBe(MAX_SCALE_STEPS);
    expect(SEQUENTIAL_RAMP).not.toContain(UNPAINTED_TOKEN);
  });

  it('keeps the three state colours out of the sequential ramp', () => {
    // Invariants A4 and A5: the state colours mean verified, attention and
    // violation, and a rank is none of those.
    for (const token of SEQUENTIAL_RAMP) {
      expect(token.startsWith('--state-')).toBe(false);
    }
  });
});

/* -------------------------------------------------------------------------- */
/* The quantile maths.                                                         */
/* -------------------------------------------------------------------------- */

describe('quantileBreaks', () => {
  it('cuts five distinct readings into five bands, one each', () => {
    const breaks = quantileBreaks([1, 2, 3, 4, 5], 5);

    expect(breaks).toHaveLength(4);
    expect(breaks[0]).toBeCloseTo(1.8, 10);
    expect(breaks[1]).toBeCloseTo(2.6, 10);
    expect(breaks[2]).toBeCloseTo(3.4, 10);
    expect(breaks[3]).toBeCloseTo(4.2, 10);

    const bands = [1, 2, 3, 4, 5].map((value) => bandIndexOf(value, breaks));
    expect(bands).toEqual([0, 1, 2, 3, 4]);
  });

  it('interpolates between the order statistics either side of each cut', () => {
    const breaks = quantileBreaks([10, 20, 30, 40, 50, 60, 70, 80, 90, 100], 5);

    expect(breaks[0]).toBeCloseTo(28, 10);
    expect(breaks[1]).toBeCloseTo(46, 10);
    expect(breaks[2]).toBeCloseTo(64, 10);
    expect(breaks[3]).toBeCloseTo(82, 10);
  });

  it('does not depend on the order the readings arrive in', () => {
    const ascending = quantileBreaks([1, 2, 3, 4, 5], 5);
    const shuffled = quantileBreaks([4, 1, 5, 3, 2], 5);

    expect(shuffled).toEqual(ascending);
  });

  it('never writes to the list it was given', () => {
    const values = [5, 1, 4, 2, 3];
    quantileBreaks(values, 5);

    expect(values).toEqual([5, 1, 4, 2, 3]);
  });

  it('drops readings that are not finite instead of sorting them to one end', () => {
    const withHoles = quantileBreaks([1, Number.NaN, 2, Number.POSITIVE_INFINITY, 3, 4, 5], 5);

    expect(withHoles).toEqual(quantileBreaks([1, 2, 3, 4, 5], 5));
  });

  it('collapses the bands when the readings have no spread', () => {
    // Thirty rooms of the same area cannot be ranked, and inventing a spread
    // would be worse than admitting there is none.
    expect(quantileBreaks([7, 7, 7], 5)).toEqual([7, 7, 7, 7]);
    expect([7, 7, 7].map((value) => bandIndexOf(value, [7, 7, 7, 7]))).toEqual([0, 0, 0]);
  });

  it('has nothing to cut when nothing is in view', () => {
    expect(quantileBreaks([], 5)).toEqual([]);
  });

  it('refuses to cut more than five bands', () => {
    expect(quantileBreaks([1, 2, 3, 4, 5, 6, 7, 8], 9)).toHaveLength(MAX_SCALE_STEPS - 1);
  });
});

describe('bandIndexOf', () => {
  it('puts a reading sitting exactly on a boundary in the lower band', () => {
    expect(bandIndexOf(10, [10, 20, 30, 40])).toBe(0);
    expect(bandIndexOf(10.0001, [10, 20, 30, 40])).toBe(1);
  });

  it('never returns a band past the last one', () => {
    expect(bandIndexOf(Number.MAX_SAFE_INTEGER, [1, 2, 3, 4])).toBe(MAX_SCALE_STEPS - 1);
  });
});

describe('createQuantileScale', () => {
  it('gives the darkest step to the largest reading when ascending', () => {
    const scale = createQuantileScale([1, 2, 3, 4, 5], { direction: 'ascending' });

    expect(scale.tokenOf(1)).toBe(SEQUENTIAL_RAMP[0]);
    expect(scale.tokenOf(5)).toBe(SEQUENTIAL_RAMP[4]);
  });

  it('gives the darkest step to the smallest reading when descending', () => {
    const scale = createQuantileScale([1, 2, 3, 4, 5], { direction: 'descending' });

    expect(scale.tokenOf(1)).toBe(SEQUENTIAL_RAMP[4]);
    expect(scale.tokenOf(5)).toBe(SEQUENTIAL_RAMP[0]);
  });

  it('paints a reading that is not a number as unpainted, not as the smallest', () => {
    const scale = createQuantileScale([1, 2, 3, 4, 5]);

    expect(scale.tokenOf(Number.NaN)).toBe(UNPAINTED_TOKEN);
    expect(scale.tokenOf(Number.POSITIVE_INFINITY)).toBe(UNPAINTED_TOKEN);
    expect(UNPAINTED_TOKEN).not.toBe(SEQUENTIAL_RAMP[0]);
  });

  it('spends one token when there is nothing to rank', () => {
    const scale = createQuantileScale([], { direction: 'descending' });

    expect(scale.bandCount).toBe(1);
    expect(scale.tokens).toEqual([SEQUENTIAL_RAMP[0]]);
  });
});

/* -------------------------------------------------------------------------- */
/* The seven modes.                                                            */
/* -------------------------------------------------------------------------- */

describe('the seven colouring modes', () => {
  it('offers exactly the seven the brief asks for, in picker order', () => {
    expect(COLORING_MODE_IDS).toEqual([
      'default',
      'roomUsage',
      'area',
      'aiConfidence',
      'reviewState',
      'violationSeverity',
      'level',
    ]);
    expect(COLORING_MODE_IDS).toHaveLength(7);
  });

  it('builds all seven against one view', () => {
    const modes = allModes(makeSampleView(), SAMPLE_LEVEL_IDS);

    expect(modes.map((mode) => mode.id)).toEqual(COLORING_MODE_IDS);
    expect(modes.map((mode) => mode.label)).toEqual(
      COLORING_MODE_IDS.map((id) => COLORING_MODE_LABELS[id]),
    );
  });

  it('keeps every scale to at most five steps', () => {
    for (const mode of allModes(makeSampleView(), SAMPLE_LEVEL_IDS)) {
      expect(
        mode.bands.length,
        `${mode.id} has more than ${String(MAX_SCALE_STEPS)} steps`,
      ).toBeLessThanOrEqual(MAX_SCALE_STEPS);
    }
  });

  it('returns a token name and never a raw colour', () => {
    const subjects = makeSampleView();

    for (const mode of allModes(subjects, SAMPLE_LEVEL_IDS)) {
      for (const token of tokensEmittedBy(mode, subjects)) {
        expect(token, `${mode.id} returned a raw colour: ${token}`).not.toMatch(RAW_COLOR);
        expect(token.startsWith('--')).toBe(true);
      }
    }
  });

  it('returns only tokens that the stylesheet declares', () => {
    const subjects = makeSampleView();
    const declared = new Set(declaredTokenNames());

    for (const mode of allModes(subjects, SAMPLE_LEVEL_IDS)) {
      for (const token of tokensEmittedBy(mode, subjects)) {
        expect(isColorTokenName(token)).toBe(true);
        expect(declared.has(token)).toBe(true);
      }
    }
  });

  it('paints the same object the same token every time', () => {
    const subjects = makeSampleView();
    const first = allModes(subjects, SAMPLE_LEVEL_IDS);
    const second = allModes(subjects, SAMPLE_LEVEL_IDS);

    for (let index = 0; index < first.length; index += 1) {
      const before = first[index];
      const after = second[index];

      expect(before).toBeDefined();
      expect(after).toBeDefined();
      expect(subjects.map((subject) => before?.paint(subject))).toEqual(
        subjects.map((subject) => after?.paint(subject)),
      );
    }
  });

  it('never writes to the view it was built from', () => {
    const subjects = makeSampleView();
    const snapshot = JSON.stringify(subjects);

    for (const mode of allModes(subjects, SAMPLE_LEVEL_IDS)) {
      subjects.forEach((subject) => mode.paint(subject));
    }

    expect(JSON.stringify(subjects)).toBe(snapshot);
  });

  it('paints the untinted model in one neutral by default', () => {
    const mode = createColoringMode('default', { subjects: makeSampleView() });

    expect(mode.bands).toHaveLength(1);
    expect(new Set(makeSampleView().map((subject) => mode.paint(subject))).size).toBe(1);
  });
});

/* -------------------------------------------------------------------------- */
/* Invariant A5: the verified green belongs to a person.                       */
/* -------------------------------------------------------------------------- */

describe('the verified green (invariant A5)', () => {
  const VERIFIED: ColorTokenName = '--state-verified';

  it('is spent by the review mode and by no other', () => {
    const subjects = makeSampleView();

    for (const mode of allModes(subjects, SAMPLE_LEVEL_IDS)) {
      const emitted = tokensEmittedBy(mode, subjects);

      if (mode.id === 'reviewState') {
        expect(emitted).toContain(VERIFIED);
      } else {
        expect(
          emitted,
          `${mode.id} spends the verified green on something no person approved`,
        ).not.toContain(VERIFIED);
      }
    }
  });

  it('is never reached by an AI score, however certain', () => {
    const certain = Array.from({ length: 10 }, (_unused, index) =>
      makeSubject({ id: `W-${String(index)}`, review: { confidence: 1, source: 'ai', reviewed: false } }),
    );
    const mode = createColoringMode('aiConfidence', { subjects: certain });

    for (const subject of certain) {
      expect(mode.paint(subject)).not.toBe(VERIFIED);
    }
    expect(mode.bands.some((band) => band.token.startsWith('--state-'))).toBe(false);
  });

  it('follows the reviewed flag and nothing else', () => {
    const mode = createColoringMode('reviewState', { subjects: [] });

    const approvedByPerson = makeSubject({ review: { confidence: 0.1, source: 'human', reviewed: true } });
    const approvedModelOutput = makeSubject({ review: { confidence: 0.1, source: 'ai', reviewed: true } });
    const drawnByPerson = makeSubject({ review: { confidence: 0.99, source: 'human', reviewed: false } });
    const fromModel = makeSubject({ review: { confidence: 0.99, source: 'ai', reviewed: false } });

    // A low score a person signed off is green; a high score nobody looked at is not.
    expect(mode.paint(approvedByPerson)).toBe(VERIFIED);
    expect(mode.paint(approvedModelOutput)).toBe(VERIFIED);
    expect(mode.paint(drawnByPerson)).not.toBe(VERIFIED);
    expect(mode.paint(fromModel)).not.toBe(VERIFIED);

    // And the two unapproved states stay apart: a colleague's line is not a guess.
    expect(mode.paint(drawnByPerson)).not.toBe(mode.paint(fromModel));
  });
});

/* -------------------------------------------------------------------------- */
/* By room use.                                                                */
/* -------------------------------------------------------------------------- */

describe('the room-use mode', () => {
  it('gives every use of the graph a token, within five groups', () => {
    const mode = createColoringMode('roomUsage', { subjects: [] });
    const painted = ROOM_USAGES.map((usage) => mode.paint(makeSubject({ usage })));

    expect(painted).toHaveLength(ROOM_USAGES.length);
    expect(painted.every((token) => isColorTokenName(token))).toBe(true);
    expect(new Set(painted).size).toBeLessThanOrEqual(MAX_SCALE_STEPS);
    expect(mode.bands).toHaveLength(MAX_SCALE_STEPS);
  });

  it('leaves anything that is not a room unpainted', () => {
    const mode = createColoringMode('roomUsage', { subjects: [] });

    expect(mode.paint(makeSubject({ usage: null }))).toBe(UNPAINTED_TOKEN);
  });

  it('keeps rooms a plan is about apart from the spaces between them', () => {
    const mode = createColoringMode('roomUsage', { subjects: [] });
    const tokenFor = (usage: RoomUsage): ColorTokenName => mode.paint(makeSubject({ usage }));

    expect(tokenFor('kitchen')).toBe(tokenFor('bathroom'));
    expect(tokenFor('corridor')).toBe(tokenFor('stairwell'));
    expect(tokenFor('livingRoom')).not.toBe(tokenFor('corridor'));
    expect(tokenFor('bedroom')).not.toBe(tokenFor('livingRoom'));
  });
});

/* -------------------------------------------------------------------------- */
/* By area — the boundaries follow the view.                                   */
/* -------------------------------------------------------------------------- */

describe('the area mode', () => {
  /** The quantiles of 1…33 m² plus the 248,60 m² hall, worked out by hand. */
  const WHOLE_MODEL_BREAKS = [7.6, 14.2, 20.8, 27.4];
  /** The quantiles of the ten smallest rooms alone — level L-01. */
  const ONE_LEVEL_BREAKS = [2.8, 4.6, 6.4, 8.2];

  const roomsOnLevel = (levelId: LevelId): PaintSubject[] =>
    makeSampleRooms().filter((room) => room.levelId === levelId);

  it('cuts the whole model at the quantiles of the whole model', () => {
    const mode = createColoringMode('area', { subjects: makeSampleRooms() });

    expect(mode.breaks).toHaveLength(MAX_SCALE_STEPS - 1);
    WHOLE_MODEL_BREAKS.forEach((expected, index) => {
      expect(mode.breaks[index]).toBeCloseTo(expected, 10);
    });
  });

  it('re-cuts the boundaries when the view narrows to one level', () => {
    const wholeModel = createColoringMode('area', { subjects: makeSampleRooms() });
    const oneLevel = createColoringMode('area', { subjects: roomsOnLevel('L-01') });

    expect(oneLevel.breaks).toHaveLength(MAX_SCALE_STEPS - 1);
    ONE_LEVEL_BREAKS.forEach((expected, index) => {
      expect(oneLevel.breaks[index]).toBeCloseTo(expected, 10);
    });

    // The two views genuinely disagree about where every boundary sits.
    oneLevel.breaks.forEach((boundary, index) => {
      expect(boundary).not.toBeCloseTo(wholeModel.breaks[index] ?? Number.NaN, 6);
    });
  });

  it('moves a room into a different band when the view changes', () => {
    const biggestOnFirstLevel = roomsOnLevel('L-01').at(-1);
    expect(biggestOnFirstLevel?.areaM2).toBe(10);

    const wholeModel = createColoringMode('area', { subjects: makeSampleRooms() });
    const oneLevel = createColoringMode('area', { subjects: roomsOnLevel('L-01') });

    // A 10 m² room is unremarkable among all 34 rooms and is the largest on its
    // own level, so the same room takes a different step in each view.
    expect(wholeModel.paint(biggestOnFirstLevel ?? makeSubject())).toBe(SEQUENTIAL_RAMP[1]);
    expect(oneLevel.paint(biggestOnFirstLevel ?? makeSubject())).toBe(SEQUENTIAL_RAMP[4]);
  });

  it('keeps every band populated where equal-width bands would not', () => {
    // The point of quantiles: the 248,60 m² hall is 7,5 times the next largest
    // room, and equal-width slicing would put all 33 other rooms in one band.
    const rooms = makeSampleRooms();
    const mode = createColoringMode('area', { subjects: rooms });

    const population = new Map<ColorTokenName, number>();
    for (const room of rooms) {
      const token = mode.paint(room);
      population.set(token, (population.get(token) ?? 0) + 1);
    }

    expect(population.size).toBe(MAX_SCALE_STEPS);
    for (const token of SEQUENTIAL_RAMP) {
      expect(population.get(token) ?? 0).toBeGreaterThanOrEqual(6);
    }

    const areas = rooms.map((room) => room.areaM2 ?? 0);
    const widest = Math.max(...areas);
    const narrowest = Math.min(...areas);
    const equalWidth = (widest - narrowest) / MAX_SCALE_STEPS;
    const inFirstEqualWidthBand = areas.filter((area) => area < narrowest + equalWidth).length;
    expect(inFirstEqualWidthBand).toBe(SAMPLE_ROOM_COUNT - 1);
  });

  it('gives the largest rooms the darkest step', () => {
    const rooms = makeSampleRooms();
    const mode = createColoringMode('area', { subjects: rooms });
    const hall = rooms.at(-1);

    expect(hall?.areaM2).toBe(SAMPLE_HALL_AREA_M2);
    expect(mode.paint(hall ?? makeSubject())).toBe(SEQUENTIAL_RAMP[MAX_SCALE_STEPS - 1]);
  });

  it('leaves an object with no floor area unpainted', () => {
    const mode = createColoringMode('area', { subjects: makeSampleRooms() });

    expect(mode.paint(makeSubject({ areaM2: null }))).toBe(UNPAINTED_TOKEN);
  });

  it('writes each band as the range it covers, in Vietnamese notation', () => {
    const mode = createColoringMode('area', { subjects: makeSampleRooms() });

    expect(mode.bands[0]?.label).toBe('đến 7,60 m²');
    expect(mode.bands[MAX_SCALE_STEPS - 1]?.label).toBe('từ 27,40 m²');
    expect(mode.bands[1]?.label).toBe('7,60 m² – 14,20 m²');
  });
});

/* -------------------------------------------------------------------------- */
/* By AI confidence.                                                           */
/* -------------------------------------------------------------------------- */

describe('the AI-confidence mode', () => {
  const withConfidence = (values: readonly number[]): PaintSubject[] =>
    values.map((confidence, index) =>
      makeSubject({ id: `W-${String(index)}`, review: { confidence, source: 'ai', reviewed: false } }),
    );

  it('cuts at the quantiles of the scores in view', () => {
    const subjects = withConfidence([0.1, 0.2, 0.3, 0.4, 0.5]);
    const mode = createColoringMode('aiConfidence', { subjects });

    expect(mode.breaks).toHaveLength(MAX_SCALE_STEPS - 1);
    [0.18, 0.26, 0.34, 0.42].forEach((expected, index) => {
      expect(mode.breaks[index]).toBeCloseTo(expected, 10);
    });
  });

  it('re-cuts when the view changes', () => {
    const wide = createColoringMode('aiConfidence', {
      subjects: withConfidence([0.1, 0.3, 0.5, 0.7, 0.9]),
    });
    const narrow = createColoringMode('aiConfidence', {
      subjects: withConfidence([0.8, 0.82, 0.84, 0.86, 0.88]),
    });

    expect(wide.breaks[0]).toBeCloseTo(0.26, 10);
    expect(narrow.breaks[0]).toBeCloseTo(0.816, 10);
  });

  it('makes the least confident objects the loudest, not the most confident', () => {
    const subjects = withConfidence([0.1, 0.3, 0.5, 0.7, 0.9]);
    const mode = createColoringMode('aiConfidence', { subjects });

    const leastSure = subjects[0];
    const mostSure = subjects[4];

    expect(mode.paint(leastSure ?? makeSubject())).toBe(SEQUENTIAL_RAMP[MAX_SCALE_STEPS - 1]);
    expect(mode.paint(mostSure ?? makeSubject())).toBe(SEQUENTIAL_RAMP[0]);
  });

  it('writes each band as a percentage range', () => {
    const mode = createColoringMode('aiConfidence', {
      subjects: withConfidence([0.1, 0.2, 0.3, 0.4, 0.5]),
    });

    expect(mode.bands[0]?.label).toContain('%');
    expect(mode.bands[0]?.label.startsWith('đến ')).toBe(true);
  });
});

/* -------------------------------------------------------------------------- */
/* By violation severity.                                                      */
/* -------------------------------------------------------------------------- */

describe('the violation mode', () => {
  const severities: readonly RuleSeverity[] = ['critical', 'warning', 'suggestion'];

  it('names the severities exactly as the rule book names them', () => {
    // The labels are restated in `modes.ts` rather than imported; this is what
    // stops the copy drifting from the original.
    const mode = createColoringMode('violationSeverity', { subjects: [] });
    const labels = mode.bands.map((band) => band.label);

    for (const severity of severities) {
      expect(labels).toContain(RULE_SEVERITY_LABELS[severity]);
    }
  });

  it('gives each severity its own token, worst first', () => {
    const mode = createColoringMode('violationSeverity', { subjects: [] });
    const painted = severities.map((severity) => mode.paint(makeSubject({ worstSeverity: severity })));

    expect(new Set(painted).size).toBe(severities.length);
    expect(painted[0]).toBe('--state-violation');
    expect(painted[1]).toBe('--state-attention');
  });

  it('paints a clean object neutral rather than green', () => {
    const mode = createColoringMode('violationSeverity', { subjects: [] });
    const clean = mode.paint(makeSubject({ worstSeverity: null }));

    // Nothing wrong is not the same as somebody approved it (invariant A5).
    expect(clean).not.toBe('--state-verified');
    expect(clean.startsWith('--state-')).toBe(false);
  });

  it('keeps within five steps including the clean one', () => {
    const mode = createColoringMode('violationSeverity', { subjects: [] });

    expect(mode.bands.length).toBeLessThanOrEqual(MAX_SCALE_STEPS);
  });
});

/* -------------------------------------------------------------------------- */
/* By level.                                                                   */
/* -------------------------------------------------------------------------- */

describe('the level mode', () => {
  it('gives each of the four sample levels its own step, bottom lightest', () => {
    const mode = createColoringMode('level', {
      subjects: makeSampleView(),
      levelIds: SAMPLE_LEVEL_IDS,
    });

    const painted = SAMPLE_LEVEL_IDS.map((levelId) => mode.paint(makeSubject({ levelId })));

    expect(new Set(painted).size).toBe(SAMPLE_LEVEL_COUNT);
    expect(painted[0]).toBe(SEQUENTIAL_RAMP[0]);
    expect(mode.bands).toHaveLength(SAMPLE_LEVEL_COUNT);
    expect(mode.bands.map((band) => band.label)).toEqual(['L-01', 'L-02', 'L-03', 'L-04']);
  });

  it('does not let the boundaries follow how much was drawn on each floor', () => {
    // Forty objects on the ground floor and one on the top must not make the top
    // floor a different colour than it is in a balanced view: a floor is a fact
    // about the building, not about how busy its drawing is.
    const lopsided = [
      ...Array.from({ length: 40 }, (_unused, index) =>
        makeSubject({ id: `W-${String(index)}`, levelId: 'L-01' }),
      ),
      makeSubject({ id: 'W-999', levelId: 'L-04' }),
    ];

    const balanced = createColoringMode('level', {
      subjects: makeSampleView(),
      levelIds: SAMPLE_LEVEL_IDS,
    });
    const skewed = createColoringMode('level', { subjects: lopsided, levelIds: SAMPLE_LEVEL_IDS });

    for (const levelId of SAMPLE_LEVEL_IDS) {
      const subject = makeSubject({ levelId });
      expect(skewed.paint(subject)).toBe(balanced.paint(subject));
    }
  });

  it('folds a tall stack into five steps rather than a stripe per floor', () => {
    const tall = Array.from({ length: 12 }, (_unused, index): LevelId => `L-${String(index + 1).padStart(2, '0')}`);
    const mode = createColoringMode('level', { subjects: [], levelIds: tall });

    expect(mode.bands).toHaveLength(MAX_SCALE_STEPS);
    expect(new Set(tall.map((levelId) => mode.paint(makeSubject({ levelId })))).size).toBe(MAX_SCALE_STEPS);
    expect(mode.bands[0]?.label).toBe('L-01, L-02, L-03');
  });

  it('leaves an object off the stack unpainted', () => {
    const mode = createColoringMode('level', {
      subjects: makeSampleView(),
      levelIds: SAMPLE_LEVEL_IDS,
    });

    expect(mode.paint(makeSubject({ levelId: null }))).toBe(UNPAINTED_TOKEN);
    expect(mode.paint(makeSubject({ levelId: 'L-99' }))).toBe(UNPAINTED_TOKEN);
  });

  it('takes the stack from the subjects when none was given', () => {
    const mode = createColoringMode('level', { subjects: makeSampleView() });

    expect(mode.bands.map((band) => band.label)).toEqual(['L-01', 'L-02', 'L-03', 'L-04']);
  });
});

/* -------------------------------------------------------------------------- */
/* Nothing here knows about rendering.                                         */
/* -------------------------------------------------------------------------- */

describe('the module boundary', () => {
  it('builds a mode without a DOM, a store or a renderer', () => {
    // Every mode is built and exercised in this file from plain objects alone.
    // If any of them reached for Three.js, a canvas or the store, this suite
    // could not have run at all.
    const ids: readonly ColoringModeId[] = COLORING_MODE_IDS;

    for (const id of ids) {
      const mode = createColoringMode(id, { subjects: makeSampleView(), levelIds: SAMPLE_LEVEL_IDS });

      expect(typeof mode.paint).toBe('function');
      expect(mode.id).toBe(id);
    }
  });
});
