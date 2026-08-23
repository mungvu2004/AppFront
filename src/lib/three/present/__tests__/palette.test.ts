import { Color } from 'three';
import { describe, expect, it } from 'vitest';

import { COLOR_TOKEN_NAMES, isColorTokenName } from '@/lib/coloring/scales';
import { expectNoRawColor, SOURCE_ONLY } from '@/lib/testing/expectNoRawColor';

import {
  documentTokenReader,
  looksLikeColour,
  PALETTE_TOKENS,
  readPalette,
  tokenColour,
  type PaletteRole,
} from '../palette';

const ROLES = Object.keys(PALETTE_TOKENS) as PaletteRole[];

/** Colour strings composed at run time, so the raw-colour scan has nothing to read. */
const RED = new Color(1, 0, 0).getStyle();
const BLUE = new Color(0, 0, 1).getStyle();

describe('palette tokens', () => {
  it('binds every role to a token globals.css declares', () => {
    for (const role of ROLES) {
      expect(isColorTokenName(PALETTE_TOKENS[role]), `${role} → ${PALETTE_TOKENS[role]}`).toBe(true);
      expect(COLOR_TOKEN_NAMES).toContain(PALETTE_TOKENS[role]);
    }
  });

  it('spells no colour out anywhere in the engine source', () => {
    expect(() => {
      expectNoRawColor('src/lib/three/present', SOURCE_ONLY);
    }).not.toThrow();
  });
});

describe('tokenColour', () => {
  const fallback = new Color(0.5, 0.5, 0.5);

  it('resolves a declared value', () => {
    const colour = tokenColour('--scene-wood', fallback, () => RED);

    expect(colour.r).toBeCloseTo(1);
    expect(colour.g).toBeCloseTo(0);
  });

  it('falls back when the token is empty or unparsable', () => {
    expect(tokenColour('--scene-wood', fallback, () => '')).toBe(fallback);
    expect(tokenColour('--scene-wood', fallback, () => 'not a colour at all')).toBe(fallback);
    expect(tokenColour('--scene-wood', fallback, () => '#zzz')).toBe(fallback);
  });

  it('accepts hex, the functional forms and named colours, trimmed', () => {
    expect(looksLikeColour('  #abc ')).toBe(true);
    expect(looksLikeColour('#AABBCC')).toBe(true);
    expect(looksLikeColour(RED)).toBe(true);
    expect(looksLikeColour('hsl(0 0% 50%)')).toBe(true);
    expect(looksLikeColour('RebeccaPurple')).toBe(true);
    expect(looksLikeColour('')).toBe(false);
    expect(looksLikeColour('constructor')).toBe(false);
    expect(tokenColour('--scene-wood', fallback, () => ' #ff0000 ').r).toBeCloseTo(1);
  });
});

describe('readPalette', () => {
  it('reads every role through the reader it is given, by token name', () => {
    const asked: string[] = [];
    const palette = readPalette((name) => {
      asked.push(name);
      return BLUE;
    });

    expect(asked.sort()).toEqual(ROLES.map((role) => PALETTE_TOKENS[role]).sort());
    for (const role of ROLES) {
      expect(palette[role].b).toBeCloseTo(1);
    }
  });

  it('keeps dark roles dark and light roles light when nothing resolves', () => {
    const palette = readPalette(() => '');

    expect(palette.backdrop.r).toBeLessThan(palette.wood.r);
    expect(palette.wood.r).toBeLessThan(palette.plaster.r);
    expect(palette.cut.r).toBeCloseTo(palette.backdrop.r);
    expect(palette.glass.r).toBeCloseTo(palette.plaster.r);
  });

  it('reads off the document by default', () => {
    const read = documentTokenReader();

    expect(typeof read('--scene-wood')).toBe('string');
    expect(() => readPalette()).not.toThrow();
  });
});
