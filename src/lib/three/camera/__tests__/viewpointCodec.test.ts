import { Vector3 } from 'three';
import { describe, expect, it } from 'vitest';

import { RADIANS_PER_TURN } from '@/domain/units/types';
import { COLORING_MODE_IDS } from '@/lib/coloring/modes';
import type { LevelId } from '@/domain/spatial/types';

import type { CameraMode } from '../modes';
import {
  CODE_BYTES_WITHOUT_LEVEL,
  decodeViewpoint,
  encodeViewpoint,
  isEncodableLevelId,
  MAX_LEVEL_CODE_LENGTH,
  MAX_VIEWPOINT_CODE_LENGTH,
  quantiseViewpoint,
  VIEWPOINT_CODE_PROBLEM_LABELS,
  VIEWPOINT_CODE_VERSION,
  type SharedViewpoint,
} from '../viewpointCodec';

/* -------------------------------------------------------------------------- */
/* Fixtures.                                                                   */
/* -------------------------------------------------------------------------- */

const ALL_MODES: readonly CameraMode[] = ['orbit', 'top', 'elevation', 'walk'];

/** Somewhere in the middle of the standard 24,86 m × 10 m sample plan. */
const SAMPLE: SharedViewpoint = {
  target: new Vector3(12.43, 1.6, 5),
  azimuthRad: RADIANS_PER_TURN / 4,
  polarRad: RADIANS_PER_TURN / 6,
  distanceM: 18.5,
  mode: 'orbit',
  levelId: 'L-01',
  coloring: 'reviewState',
};

/** The same view, already on the grid the format stores it on. */
const ON_GRID = quantiseViewpoint(SAMPLE);

function decoded(shared: SharedViewpoint): SharedViewpoint {
  const result = decodeViewpoint(encodeViewpoint(shared));
  if (!result.ok) {
    throw new Error(`Expected a readable code, got: ${result.message}`);
  }
  return result.viewpoint;
}

/* -------------------------------------------------------------------------- */
/* A second, independent writer — used to craft codes no encoder would emit.   */
/* -------------------------------------------------------------------------- */

const ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_';

function bytesOf(code: string): number[] {
  const bytes: number[] = [];
  let accumulator = 0;
  let bits = 0;

  for (const character of code.slice(1)) {
    accumulator = (accumulator << 6) | ALPHABET.indexOf(character);
    bits += 6;
    if (bits >= 8) {
      bits -= 8;
      bytes.push((accumulator >> bits) & 0xff);
    }
  }
  return bytes;
}

function codeOf(bytes: readonly number[]): string {
  let text = '';

  for (let index = 0; index < bytes.length; index += 3) {
    const first = bytes[index] ?? 0;
    const second = bytes[index + 1];
    const third = bytes[index + 2];

    text += ALPHABET[first >> 2] ?? '';
    text += ALPHABET[((first & 0x03) << 4) | ((second ?? 0) >> 4)] ?? '';
    if (second === undefined) {
      break;
    }
    text += ALPHABET[((second & 0x0f) << 2) | ((third ?? 0) >> 6)] ?? '';
    if (third === undefined) {
      break;
    }
    text += ALPHABET[third & 0x3f] ?? '';
  }

  return VIEWPOINT_CODE_VERSION + text;
}

function checksumOf(bytes: readonly number[], end: number): number {
  let hash = 0x811c9dc5;
  for (let index = 0; index < end; index += 1) {
    hash = (hash ^ (bytes[index] ?? 0)) >>> 0;
    hash = Math.imul(hash, 0x01000193) >>> 0;
  }
  return ((hash >>> 16) ^ hash) & 0xffff;
}

/** A well-formed code carrying a field no build of this format would write. */
function craft(from: string, mutate: (bytes: number[]) => void): string {
  const bytes = bytesOf(from);
  mutate(bytes);

  const end = bytes.length - 2;
  const checksum = checksumOf(bytes, end);
  bytes[end] = (checksum >> 8) & 0xff;
  bytes[end + 1] = checksum & 0xff;
  return codeOf(bytes);
}

/* -------------------------------------------------------------------------- */
/* The round trip.                                                             */
/* -------------------------------------------------------------------------- */

describe('encodeViewpoint and decodeViewpoint', () => {
  it('gives back exactly the viewpoint that went in', () => {
    expect(decoded(ON_GRID)).toEqual(ON_GRID);
  });

  it('gives back the quantised viewpoint for one that was not on the grid', () => {
    expect(decoded(SAMPLE)).toEqual(quantiseViewpoint(SAMPLE));
  });

  it('loses no more than the millimetre and the fraction of a degree it says', () => {
    const back = decoded(SAMPLE);

    expect(back.target.x).toBeCloseTo(SAMPLE.target.x, 3);
    expect(back.target.y).toBeCloseTo(SAMPLE.target.y, 3);
    expect(back.target.z).toBeCloseTo(SAMPLE.target.z, 3);
    expect(back.distanceM).toBeCloseTo(SAMPLE.distanceM, 3);
    expect(back.azimuthRad).toBeCloseTo(SAMPLE.azimuthRad, 4);
    expect(back.polarRad).toBeCloseTo(SAMPLE.polarRad, 4);
  });

  it('carries every camera mode', () => {
    for (const mode of ALL_MODES) {
      expect(decoded({ ...ON_GRID, mode }).mode).toBe(mode);
    }
  });

  it('carries every colouring mode', () => {
    for (const coloring of COLORING_MODE_IDS) {
      expect(decoded({ ...ON_GRID, coloring }).coloring).toBe(coloring);
    }
  });

  it('carries the storey', () => {
    for (const levelId of ['L-01', 'L-B1', 'L-G', 'L-roof_02'] as readonly LevelId[]) {
      expect(decoded({ ...ON_GRID, levelId }).levelId).toBe(levelId);
    }
  });

  it('survives a walker standing at the datum with nothing framed', () => {
    const origin: SharedViewpoint = {
      target: new Vector3(0, 0, 0),
      azimuthRad: 0,
      polarRad: 0,
      distanceM: 0,
      mode: 'walk',
      levelId: 'L-01',
      coloring: 'default',
    };

    expect(decoded(origin)).toEqual(quantiseViewpoint(origin));
  });

  it('survives coordinates behind the datum', () => {
    const behind = quantiseViewpoint({ ...SAMPLE, target: new Vector3(-4.321, -2.5, -18.004) });

    expect(decoded(behind)).toEqual(behind);
  });

  it('folds a heading that has been spun round more than once', () => {
    const spun = { ...ON_GRID, azimuthRad: ON_GRID.azimuthRad + RADIANS_PER_TURN * 3 };

    expect(decoded(spun).azimuthRad).toBeCloseTo(ON_GRID.azimuthRad, 6);
  });

  it('is quantised idempotently, so re-sharing a link does not drift', () => {
    expect(quantiseViewpoint(ON_GRID)).toEqual(ON_GRID);
    expect(quantiseViewpoint(decoded(SAMPLE))).toEqual(decoded(SAMPLE));
  });
});

/* -------------------------------------------------------------------------- */
/* The length budget.                                                          */
/* -------------------------------------------------------------------------- */

describe('the code itself', () => {
  it('is the 36 characters the module note says, for a storey called L-01', () => {
    expect(encodeViewpoint(SAMPLE)).toHaveLength(36);
    expect(encodeViewpoint(SAMPLE).length).toBeLessThanOrEqual(MAX_VIEWPOINT_CODE_LENGTH);
  });

  it('is 49 characters for the largest input the format accepts, and still readable', () => {
    const worst: SharedViewpoint = {
      target: new Vector3(-2_000_000, 2_000_000, -2_000_000),
      azimuthRad: RADIANS_PER_TURN - 1e-6,
      polarRad: RADIANS_PER_TURN / 2,
      distanceM: 4_000_000,
      mode: 'walk',
      levelId: `L-${'a'.repeat(MAX_LEVEL_CODE_LENGTH)}`,
      coloring: 'violationSeverity',
    };

    expect(encodeViewpoint(worst)).toHaveLength(49);
    expect(encodeViewpoint(worst).length).toBeLessThanOrEqual(MAX_VIEWPOINT_CODE_LENGTH);
    expect(decoded(quantiseViewpoint(worst))).toEqual(quantiseViewpoint(worst));
  });

  it('needs no escaping in a URL', () => {
    expect(encodeViewpoint(SAMPLE)).toMatch(/^[A-Za-z0-9_-]+$/);
    expect(encodeURIComponent(encodeViewpoint(SAMPLE))).toBe(encodeViewpoint(SAMPLE));
  });

  it('starts with the version character', () => {
    expect(encodeViewpoint(SAMPLE).startsWith(VIEWPOINT_CODE_VERSION)).toBe(true);
  });

  it('changes when any one field changes', () => {
    const base = encodeViewpoint(ON_GRID);

    expect(encodeViewpoint({ ...ON_GRID, mode: 'top' })).not.toBe(base);
    expect(encodeViewpoint({ ...ON_GRID, coloring: 'area' })).not.toBe(base);
    expect(encodeViewpoint({ ...ON_GRID, levelId: 'L-02' })).not.toBe(base);
    expect(encodeViewpoint({ ...ON_GRID, distanceM: ON_GRID.distanceM + 0.01 })).not.toBe(base);
  });
});

/* -------------------------------------------------------------------------- */
/* Refusing to encode.                                                         */
/* -------------------------------------------------------------------------- */

describe('encodeViewpoint refuses what it cannot carry', () => {
  it('refuses a coordinate that is not a number', () => {
    expect(() => encodeViewpoint({ ...SAMPLE, target: new Vector3(Number.NaN, 0, 0) })).toThrow(
      RangeError,
    );
  });

  it('refuses a heading that is not a number', () => {
    expect(() =>
      encodeViewpoint({ ...SAMPLE, azimuthRad: Number.POSITIVE_INFINITY }),
    ).toThrow(RangeError);
  });

  it('refuses a storey code a URL would have to escape', () => {
    expect(() => encodeViewpoint({ ...SAMPLE, levelId: 'L-tầng 2' })).toThrow(RangeError);
    expect(() => encodeViewpoint({ ...SAMPLE, levelId: 'L-' })).toThrow(RangeError);
    expect(() =>
      encodeViewpoint({ ...SAMPLE, levelId: `L-${'a'.repeat(MAX_LEVEL_CODE_LENGTH + 1)}` }),
    ).toThrow(RangeError);
  });

  it('says which storey codes it will take', () => {
    expect(isEncodableLevelId('L-01')).toBe(true);
    expect(isEncodableLevelId('L-B1_mezz')).toBe(true);
    expect(isEncodableLevelId('L-')).toBe(false);
    expect(isEncodableLevelId('L-tầng 2')).toBe(false);
    expect(isEncodableLevelId('W-01')).toBe(false);
  });
});

/* -------------------------------------------------------------------------- */
/* Broken codes.                                                               */
/* -------------------------------------------------------------------------- */

describe('decodeViewpoint on a broken code', () => {
  const code = encodeViewpoint(ON_GRID);

  function problemOf(input: unknown): string {
    const result = decodeViewpoint(input);
    expect(result.ok).toBe(false);
    return result.ok ? 'none' : result.problem;
  }

  it('never throws, whatever it is handed', () => {
    for (const input of [undefined, null, 42, {}, [], '', 'nonsense', code.slice(0, 5)]) {
      expect(() => decodeViewpoint(input)).not.toThrow();
    }
  });

  it('reports an empty or missing code', () => {
    expect(problemOf('')).toBe('empty');
    expect(problemOf(undefined)).toBe('empty');
    expect(problemOf(null)).toBe('empty');
    expect(problemOf(42)).toBe('empty');
  });

  it('reports a code longer than the format produces', () => {
    expect(problemOf(VIEWPOINT_CODE_VERSION + 'A'.repeat(MAX_VIEWPOINT_CODE_LENGTH))).toBe(
      'tooLong',
    );
  });

  it('reports a code from another version of the format', () => {
    expect(problemOf(`9${code.slice(1)}`)).toBe('version');
  });

  it('reports characters the alphabet has no room for', () => {
    expect(problemOf(`${code.slice(0, 10)}*${code.slice(11)}`)).toBe('alphabet');
    expect(problemOf(`${code} `)).toBe('alphabet');
  });

  it('reports a code a chat client cut in half', () => {
    expect(problemOf(code.slice(0, 20))).toBe('truncated');
    expect(problemOf(code.slice(0, 33))).toBe('truncated');
    expect(problemOf(`${code}AAAA`)).toBe('truncated');
  });

  it('reports one changed character rather than decoding somewhere else', () => {
    const flipped = code[5] === 'A' ? 'B' : 'A';
    expect(problemOf(`${code.slice(0, 5)}${flipped}${code.slice(6)}`)).toBe('checksum');
  });

  it('reports a camera mode this build has no name for', () => {
    expect(
      problemOf(
        craft(code, (bytes) => {
          bytes[0] = 7 << 4;
        }),
      ),
    ).toBe('field');
  });

  it('reports a colouring mode this build has no name for', () => {
    expect(
      problemOf(
        craft(code, (bytes) => {
          bytes[0] = 15;
        }),
      ),
    ).toBe('field');
  });

  it('reports a storey code that is not a storey code', () => {
    expect(
      problemOf(
        craft(code, (bytes) => {
          bytes[CODE_BYTES_WITHOUT_LEVEL] = 0x20;
        }),
      ),
    ).toBe('field');
  });

  it('has a Vietnamese sentence for every problem', () => {
    const result = decodeViewpoint('');

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.message).toBe(VIEWPOINT_CODE_PROBLEM_LABELS.empty);
    }
    for (const message of Object.values(VIEWPOINT_CODE_PROBLEM_LABELS)) {
      expect(message).toBe(message.toLowerCase());
      expect(message.length).toBeGreaterThan(0);
    }
  });

  it('leaves the caller a camera to keep', () => {
    const result = decodeViewpoint('không phải mã');

    expect(result.ok).toBe(false);
    expect('viewpoint' in result).toBe(false);
  });
});
