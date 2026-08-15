import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

import { describe, expect, it } from 'vitest';

import type { LevelId, RoomUsage } from '@/domain/spatial/types';
import {
  expectNoRawColor,
  findRawColors,
  maskComments,
  RAW_COLOR_PATTERN,
} from '@/lib/testing/expectNoRawColor';

import {
  applyEmphasis,
  applyEmphasisTo,
  checkContrast,
  CONTRAST_MINIMUM_BODY,
  contrastRatio,
  DIMMED_OPACITY,
  FOCUSED_OPACITY,
  generateLegend,
  LEGEND_SURFACE_TOKEN,
  LEGEND_TEXT_TOKEN,
  parseColor,
  parsePalette,
  relativeLuminance,
  resolveLabelTreatment,
  type Legend,
  type Palette,
} from '../legend';
import {
  COLORING_MODE_IDS,
  createColoringMode,
  createColoringModes,
  type PaintSubject,
} from '../modes';
import { MAX_SCALE_STEPS, UNPAINTED_TOKEN, type ColorTokenName } from '../scales';

/* -------------------------------------------------------------------------- */
/* Fixtures.                                                                   */
/* -------------------------------------------------------------------------- */

/** The fourteen rooms the legend of the area mode has to add up to. */
const LEGEND_ROOM_COUNT = 14;

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

/** Fourteen rooms of 1…14 m², spread over the four levels. */
function makeRooms(): PaintSubject[] {
  return Array.from({ length: LEGEND_ROOM_COUNT }, (_unused, index) =>
    makeSubject({
      id: `R-${String(index).padStart(6, '0')}`,
      levelId: SAMPLE_LEVEL_IDS[index % SAMPLE_LEVEL_IDS.length] ?? 'L-01',
      areaM2: index + 1,
      usage: ROOM_USAGES[index % ROOM_USAGES.length] ?? 'other',
      review: {
        confidence: (index % 10) / 10,
        source: index % 3 === 0 ? 'human' : 'ai',
        reviewed: index % 5 === 0,
      },
      worstSeverity: (['critical', 'warning', 'suggestion', null] as const)[index % 4] ?? null,
    }),
  );
}

/** Walls carry no floor area, so the area mode has no reading for them. */
function makeWalls(count: number): PaintSubject[] {
  return Array.from({ length: count }, (_unused, index) =>
    makeSubject({
      id: `W-${String(index).padStart(6, '0')}`,
      levelId: SAMPLE_LEVEL_IDS[index % SAMPLE_LEVEL_IDS.length] ?? 'L-01',
      review: {
        confidence: (index % 11) / 10,
        source: index % 2 === 0 ? 'human' : 'ai',
        reviewed: index % 4 === 0,
      },
      worstSeverity: (['critical', 'warning', 'suggestion', null] as const)[index % 4] ?? null,
    }),
  );
}

/** 34 rooms and the 248,60 m² hall — the standard sample set of invariant A14. */
const STANDARD_ROOM_COUNT = 34;
const STANDARD_HALL_AREA_M2 = 248.6;

function makeStandardRooms(): PaintSubject[] {
  return Array.from({ length: STANDARD_ROOM_COUNT }, (_unused, index) =>
    makeSubject({
      id: `R-${String(index).padStart(6, '0')}`,
      levelId: SAMPLE_LEVEL_IDS[index % SAMPLE_LEVEL_IDS.length] ?? 'L-01',
      areaM2: index === STANDARD_ROOM_COUNT - 1 ? STANDARD_HALL_AREA_M2 : index + 1,
      usage: ROOM_USAGES[index % ROOM_USAGES.length] ?? 'other',
    }),
  );
}

function projectFile(relativePath: string): string {
  return readFileSync(resolve(process.cwd(), relativePath), 'utf8');
}

function samplePalette(): Palette {
  return parsePalette(projectFile('src/styles/globals.css'));
}

/* -------------------------------------------------------------------------- */
/* Reading colours out of the stylesheet.                                      */
/* -------------------------------------------------------------------------- */

describe('parsePalette', () => {
  it('reads every declared token out of globals.css', () => {
    const palette = samplePalette();

    expect(palette['--wall-330']).toBeDefined();
    expect(palette['--text-primary']).toBeDefined();
    expect(palette['--state-verified']).toBeDefined();
    expect(Object.keys(palette).length).toBeGreaterThanOrEqual(30);
  });

  it('keeps only names the token vocabulary knows', () => {
    const palette = parsePalette(':root { --wall-330: #5C564D; --invented-token: #123456; }');

    expect(palette['--wall-330']).toBe('#5C564D');
    expect(Object.keys(palette)).toEqual(['--wall-330']);
  });
});

describe('parseColor', () => {
  it('reads the notations globals.css actually uses', () => {
    expect(parseColor('#5C564D')).toEqual({ red: 92, green: 86, blue: 77, alpha: 1 });
    expect(parseColor('#fff')).toEqual({ red: 255, green: 255, blue: 255, alpha: 1 });
    expect(parseColor('rgba(43, 42, 40, 0.035)')).toEqual({
      red: 43,
      green: 42,
      blue: 40,
      alpha: 0.035,
    });
  });

  it('returns null rather than guessing at something it cannot read', () => {
    expect(parseColor('rebeccapurple')).toBeNull();
    expect(parseColor('')).toBeNull();
    expect(parseColor('#12345')).toBeNull();
  });
});

/* -------------------------------------------------------------------------- */
/* Contrast.                                                                   */
/* -------------------------------------------------------------------------- */

describe('contrastRatio', () => {
  it('puts the extremes of the scale where WCAG puts them', () => {
    expect(contrastRatio('#ffffff', '#000000')).toBeCloseTo(21, 10);
    expect(contrastRatio('#ffffff', '#ffffff')).toBeCloseTo(1, 10);
  });

  it('does not care which colour is named first', () => {
    expect(contrastRatio('#33322f', '#ffffff')).toBeCloseTo(contrastRatio('#ffffff', '#33322f'), 10);
  });

  it('agrees with the luminance definition it is built on', () => {
    expect(relativeLuminance({ red: 255, green: 255, blue: 255, alpha: 1 })).toBeCloseTo(1, 10);
    expect(relativeLuminance({ red: 0, green: 0, blue: 0, alpha: 1 })).toBeCloseTo(0, 10);
  });
});

describe('checkContrast', () => {
  it('passes the body text of the interface on its own surface', () => {
    const check = checkContrast(LEGEND_SURFACE_TOKEN, LEGEND_TEXT_TOKEN, samplePalette());

    expect(check.threshold).toBe(CONTRAST_MINIMUM_BODY);
    expect(check.passes).toBe(true);
    expect(check.ratio).toBeGreaterThanOrEqual(CONTRAST_MINIMUM_BODY);
  });

  it('fails a pair that does not clear the minimum', () => {
    // The darkest ramp step under the darkest text: the pair the legend must
    // never produce.
    const check = checkContrast('--wall-330', '--text-primary', samplePalette());

    expect(check.passes).toBe(false);
    expect(check.ratio).toBeLessThan(CONTRAST_MINIMUM_BODY);
  });

  it('refuses a token the palette does not hold', () => {
    expect(() => checkContrast('--wall-330', '--text-primary', {})).toThrow(/token/);
  });

  it('refuses a translucent token instead of answering from its opaque form', () => {
    const palette = samplePalette();

    // A ratio against something partly see-through depends on what is behind it.
    expect(() => checkContrast('--bg-hover', '--text-primary', palette)).toThrow(/trong suốt/);
  });
});

/* -------------------------------------------------------------------------- */
/* Where a label can go.                                                       */
/* -------------------------------------------------------------------------- */

describe('resolveLabelTreatment', () => {
  it('writes on the fills that can carry text', () => {
    const palette = samplePalette();

    for (const token of ['--bg-sunken', '--wall-idle', '--wall-110', '--wall-330'] as const) {
      const treatment = resolveLabelTreatment(token, palette);

      expect(treatment.placement, `${token} should be able to carry a label`).toBe('onSwatch');
      expect(treatment.backgroundToken).toBe(token);
      expect(treatment.ratio).toBeGreaterThanOrEqual(CONTRAST_MINIMUM_BODY);
    }
  });

  it('moves the label off the three fills no text token can sit on', () => {
    // This is the non-obvious half. These three are mid-tones: the dark text
    // reaches 3,3–4,0 and white reaches 3,2–3,9, so neither clears 4,5:1 and the
    // label has to sit beside the swatch instead of inside it.
    const palette = samplePalette();

    for (const token of ['--wall-220', '--state-verified', '--state-violation'] as const) {
      const treatment = resolveLabelTreatment(token, palette);

      expect(treatment.placement, `${token} cannot carry a readable label`).toBe('besideSwatch');
      expect(treatment.backgroundToken).toBe(LEGEND_SURFACE_TOKEN);
      expect(treatment.textToken).toBe(LEGEND_TEXT_TOKEN);
      expect(treatment.ratio).toBeGreaterThanOrEqual(CONTRAST_MINIMUM_BODY);
    }
  });

  it('picks the light token for a dark fill and the dark token for a light one', () => {
    const palette = samplePalette();

    expect(resolveLabelTreatment('--wall-330', palette).textToken).toBe('--bg-surface');
    expect(resolveLabelTreatment('--bg-sunken', palette).textToken).toBe('--text-primary');
  });

  it('falls back to the safe placement when no palette is available', () => {
    expect(resolveLabelTreatment('--bg-sunken', {}).placement).toBe('besideSwatch');
  });
});

/* -------------------------------------------------------------------------- */
/* Every legend pair in all seven modes is readable.                           */
/* -------------------------------------------------------------------------- */

describe('the readability of all seven legends', () => {
  const view = [...makeRooms(), ...makeWalls(12)];

  const legendsForView = (): readonly Legend[] => {
    const palette = samplePalette();

    return createColoringModes({ subjects: view, levelIds: SAMPLE_LEVEL_IDS }).map((mode) =>
      generateLegend(mode, view, palette),
    );
  };

  it('clears 4,5:1 on every background/text pair it produces', () => {
    const palette = samplePalette();
    let pairsChecked = 0;

    for (const legend of legendsForView()) {
      for (const item of legend.items) {
        const check = checkContrast(item.labelBackgroundToken, item.labelTextToken, palette);

        expect(
          check.passes,
          `${legend.modeId} / "${item.label}": ${item.labelTextToken} on ` +
            `${item.labelBackgroundToken} is ${check.ratio.toFixed(2)}:1`,
        ).toBe(true);
        pairsChecked += 1;
      }
    }

    // Guards the loop itself: an empty legend set would pass vacuously.
    expect(pairsChecked).toBeGreaterThanOrEqual(COLORING_MODE_IDS.length);
  });

  it('draws a label either on its own swatch or on the panel surface, never elsewhere', () => {
    for (const legend of legendsForView()) {
      for (const item of legend.items) {
        expect(item.labelBackgroundToken).toBe(
          item.labelPlacement === 'onSwatch' ? item.token : LEGEND_SURFACE_TOKEN,
        );
      }
    }
  });

  it('uses both placements across the seven modes', () => {
    // If everything came back `besideSwatch` the readability check above would
    // be true but meaningless.
    const placements = new Set(
      legendsForView().flatMap((legend) => legend.items.map((item) => item.labelPlacement)),
    );

    expect(placements).toEqual(new Set(['onSwatch', 'besideSwatch']));
  });
});

/* -------------------------------------------------------------------------- */
/* The legend is a report on the data, not a hand-written caption.             */
/* -------------------------------------------------------------------------- */

describe('generateLegend', () => {
  it('gives the area mode five rows that add up to the fourteen rooms in view', () => {
    const rooms = makeRooms();
    const mode = createColoringMode('area', { subjects: rooms });
    const legend = generateLegend(mode, rooms, samplePalette());

    expect(legend.items).toHaveLength(MAX_SCALE_STEPS);
    expect(legend.items.reduce((total, item) => total + item.count, 0)).toBe(LEGEND_ROOM_COUNT);
    expect(legend.items.map((item) => item.count)).toEqual([3, 3, 2, 3, 3]);
    expect(legend.unpaintedCount).toBe(0);
  });

  it('adds up to the standard sample set too, hall and all', () => {
    // The fourteen-room view above is the one the brief pins. Invariant A14
    // pins a different set — 34 rooms and the 248,60 m² hall — and the legend
    // has to add up over that one as well, outlier included.
    const rooms = makeStandardRooms();
    const mode = createColoringMode('area', { subjects: rooms });
    const legend = generateLegend(mode, rooms, samplePalette());

    expect(legend.items).toHaveLength(MAX_SCALE_STEPS);
    expect(legend.items.reduce((total, item) => total + item.count, 0)).toBe(STANDARD_ROOM_COUNT);
    expect(legend.unpaintedCount).toBe(0);

    // The hall sits alone at the top of its band; the quantiles keep the other
    // four bands populated rather than collapsing them behind the outlier.
    expect(legend.items.every((item) => item.count > 0)).toBe(true);
    expect(legend.items[MAX_SCALE_STEPS - 1]?.range).toBe('từ 27,40 m²');
  });

  it('counts objects the mode cannot read apart from the bands', () => {
    const rooms = makeRooms();
    const walls = makeWalls(12);
    const view = [...rooms, ...walls];
    const mode = createColoringMode('area', { subjects: view });
    const legend = generateLegend(mode, view, samplePalette());

    // A wall has no floor area, so it is not a small room — it is not a room.
    expect(legend.items.reduce((total, item) => total + item.count, 0)).toBe(LEGEND_ROOM_COUNT);
    expect(legend.unpaintedCount).toBe(walls.length);
    expect(legend.unpaintedToken).toBe(UNPAINTED_TOKEN);
  });

  it('takes its ranges from the quantile cuts of the view it was given', () => {
    const rooms = makeRooms();
    const mode = createColoringMode('area', { subjects: rooms });
    const legend = generateLegend(mode, rooms, samplePalette());

    expect(legend.items[0]?.range).toBe(mode.bands[0]?.label);
    expect(legend.items[0]?.range).toBe('đến 3,60 m²');
    expect(legend.items[MAX_SCALE_STEPS - 1]?.range).toBe('từ 11,40 m²');
  });

  it('recomputes ranges and counts when the view narrows', () => {
    const rooms = makeRooms();
    const firstLevel = rooms.filter((room) => room.levelId === 'L-01');

    const wide = generateLegend(createColoringMode('area', { subjects: rooms }), rooms);
    const narrow = generateLegend(
      createColoringMode('area', { subjects: firstLevel }),
      firstLevel,
    );

    expect(narrow.items).toHaveLength(MAX_SCALE_STEPS);
    expect(narrow.items.reduce((total, item) => total + item.count, 0)).toBe(firstLevel.length);
    expect(narrow.items[0]?.range).not.toBe(wide.items[0]?.range);
  });

  it('keeps a band with nothing in it rather than shortening the scale', () => {
    const rooms = makeRooms();
    const mode = createColoringMode('roomUsage', { subjects: rooms });
    // Only corridors in view: the other four groups are real but empty.
    const corridorsOnly = rooms.map((room) => ({ ...room, usage: 'corridor' as const }));
    const legend = generateLegend(mode, corridorsOnly, samplePalette());

    expect(legend.items).toHaveLength(MAX_SCALE_STEPS);
    expect(legend.items.filter((item) => item.count === 0)).toHaveLength(MAX_SCALE_STEPS - 1);
    expect(legend.items.reduce((total, item) => total + item.count, 0)).toBe(LEGEND_ROOM_COUNT);
  });

  it('names a quantity band after the reading and a category band after itself', () => {
    const rooms = makeRooms();

    const area = generateLegend(createColoringMode('area', { subjects: rooms }), rooms);
    expect(area.items.map((item) => item.label)).toEqual([
      'nhỏ nhất',
      'nhỏ',
      'trung bình',
      'lớn',
      'lớn nhất',
    ]);

    const usage = generateLegend(createColoringMode('roomUsage', { subjects: rooms }), rooms);
    expect(usage.items.map((item) => item.label)).toContain('lưu thông');
    // A category has no numeric range to show.
    expect(usage.items.every((item) => item.range === '')).toBe(true);
  });

  it('names the least confident band by its reading, not by its colour', () => {
    const rooms = makeRooms();
    const legend = generateLegend(createColoringMode('aiConfidence', { subjects: rooms }), rooms);

    // The band is painted darkest but describes the *lowest* scores.
    expect(legend.items[0]?.label).toBe('thấp nhất');
    expect(legend.items[0]?.range.startsWith('đến ')).toBe(true);
  });

  it('builds a legend for each of the seven modes', () => {
    const view = [...makeRooms(), ...makeWalls(8)];
    const legends = createColoringModes({ subjects: view, levelIds: SAMPLE_LEVEL_IDS }).map((mode) =>
      generateLegend(mode, view, samplePalette()),
    );

    expect(legends.map((legend) => legend.modeId)).toEqual(COLORING_MODE_IDS);

    for (const legend of legends) {
      expect(legend.items.length).toBeLessThanOrEqual(MAX_SCALE_STEPS);
      expect(legend.items.reduce((total, item) => total + item.count, 0) + legend.unpaintedCount).toBe(
        view.length,
      );
    }
  });

  it('writes every label in Vietnamese with its diacritics', () => {
    const view = makeRooms();
    const labels = createColoringModes({ subjects: view, levelIds: SAMPLE_LEVEL_IDS })
      .flatMap((mode) => generateLegend(mode, view, samplePalette()).items)
      .map((item) => item.label);

    // The unaccented spellings that would mean the diacritics were dropped.
    const stripped = /\b(nho nhat|lon nhat|thap nhat|trung binh|luu thong|da duyet|khong co|nghiem trong|goi y|phong ngu)\b/;

    for (const label of labels) {
      expect(label.length).toBeGreaterThan(0);
      expect(label, `"${label}" looks like unaccented Vietnamese`).not.toMatch(stripped);
    }
  });
});

/* -------------------------------------------------------------------------- */
/* Pushing the irrelevant back.                                                */
/* -------------------------------------------------------------------------- */

describe('applyEmphasis', () => {
  const everySwatch: readonly ColorTokenName[] = [
    '--bg-sunken',
    '--wall-idle',
    '--wall-110',
    '--wall-220',
    '--wall-330',
    '--state-verified',
    '--state-attention',
    '--state-violation',
    UNPAINTED_TOKEN,
  ];

  it('turns an irrelevant object down to twelve per cent', () => {
    expect(DIMMED_OPACITY).toBe(0.12);
    expect(applyEmphasis('--wall-220', 'dimmed').opacity).toBe(0.12);
    expect(applyEmphasis('--wall-220', 'focused').opacity).toBe(FOCUSED_OPACITY);
  });

  it('never changes the colour, only how loud it is', () => {
    for (const token of everySwatch) {
      expect(applyEmphasis(token, 'dimmed').token).toBe(token);
      expect(applyEmphasis(token, 'focused').token).toBe(applyEmphasis(token, 'dimmed').token);
    }
  });

  it('offers no grey wash to lay over the plan', () => {
    // Two fields and no third: there is no overlay token, no tint and no
    // substitute colour to reach for.
    expect(Object.keys(applyEmphasis('--wall-330', 'dimmed')).sort()).toEqual(['opacity', 'token']);
  });

  it('keeps two dimmed bands as distinguishable as the bands themselves', () => {
    // A shared grey overlay would let two different bands land on one colour.
    const first = applyEmphasis('--wall-110', 'dimmed');
    const second = applyEmphasis('--wall-330', 'dimmed');

    expect(first.token).not.toBe(second.token);
    expect(first.opacity).toBe(second.opacity);
  });

  it('dims a whole view against a question', () => {
    const rooms = makeRooms();
    const mode = createColoringMode('area', { subjects: rooms });
    const appearances = applyEmphasisTo(mode, rooms, (room) => room.levelId === 'L-01');

    const focused = appearances.filter((appearance) => appearance.opacity === FOCUSED_OPACITY);
    const dimmed = appearances.filter((appearance) => appearance.opacity === DIMMED_OPACITY);

    expect(focused).toHaveLength(rooms.filter((room) => room.levelId === 'L-01').length);
    expect(dimmed).toHaveLength(rooms.length - focused.length);

    // Each dimmed object still wears the token its own band gave it.
    rooms.forEach((room, index) => {
      expect(appearances[index]?.token).toBe(mode.paint(room));
    });
  });
});

/* -------------------------------------------------------------------------- */
/* The shared raw-colour guard.                                                */
/* -------------------------------------------------------------------------- */

describe('expectNoRawColor', () => {
  it('uses the same definition of a raw colour as the ESLint rule', () => {
    const rule = projectFile('eslint-rules/no-raw-color.js');
    const declared = /const regex = \/(.+)\/;/.exec(rule);

    expect(declared).not.toBeNull();
    expect(declared?.[1]).toBe(RAW_COLOR_PATTERN.source);
  });

  it('passes the colouring modules, which name tokens and never colours', () => {
    expect(() => expectNoRawColor('src/lib/coloring/scales.ts')).not.toThrow();
    expect(() => expectNoRawColor('src/lib/coloring/modes.ts')).not.toThrow();
    expect(() => expectNoRawColor('src/lib/coloring/legend.ts')).not.toThrow();
    expect(() => expectNoRawColor('src/lib/testing/expectNoRawColor.ts')).not.toThrow();
  });

  it('catches a colour spelled out in code', () => {
    const findings = findRawColors("const brand = '#567a96';", 'fake.ts');

    expect(findings).toHaveLength(1);
    expect(findings[0]?.match).toBe('#567a96');
    expect(findings[0]?.line).toBe(1);
  });

  it('catches the functional notations too', () => {
    expect(findRawColors('const a = rgba(1, 2, 3, 0.5);')).toHaveLength(1);
    expect(findRawColors('const b = hsl(200, 50%, 50%);')).toHaveLength(1);
  });

  it('leaves prose about colours alone', () => {
    // Otherwise a module could not explain that it refuses to emit #abcdef,
    // and people would stop writing the explanation.
    expect(findRawColors('// never emit #abcdef here\nconst fill = "--wall-330";')).toEqual([]);
    expect(findRawColors('/* rgb() and #fff are forbidden */\nconst x = 1;')).toEqual([]);
  });

  it('reports the line a colour is really on, past a block comment', () => {
    const source = ['/*', ' * A comment', ' * spanning lines', ' */', "const c = '#abc';"].join('\n');
    const findings = findRawColors(source, 'fake.ts');

    expect(findings).toHaveLength(1);
    expect(findings[0]?.line).toBe(5);
  });

  it('does not mistake a comment marker inside a string for a comment', () => {
    expect(findRawColors('const url = "https://example.com/#abcdef";')).toHaveLength(1);
  });

  it('lets a caller wave through a deliberate case', () => {
    const source = "expect(isColorTokenName('#567a96')).toBe(false);";

    expect(findRawColors(source)).toHaveLength(1);
    expect(findRawColors(source, 'fake.ts', { ignore: ['isColorTokenName'] })).toEqual([]);
  });

  it('names every offender when it throws', () => {
    expect(() => expectNoRawColor('src/lib/coloring/__tests__')).toThrow(/mã màu thô/);
  });

  it('keeps the line count of what it masks', () => {
    expect(maskComments('a\n/* two\nlines */\nb').split('\n')).toHaveLength(4);
  });
});
