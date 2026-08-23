/**
 * The colours a presentation is painted with, resolved from design tokens.
 *
 * Nothing in `present/` writes a colour down. Every surface is named after a
 * role — plaster, wood, foliage, lamp — and each role is bound to exactly one
 * CSS custom property from `src/styles/globals.css`. The binding is typed with
 * {@link ColorTokenName}, so a role cannot be pointed at a property the
 * stylesheet does not declare: the coloring module's own test keeps that union
 * in step with the stylesheet, and the compiler keeps this file in step with
 * the union.
 *
 * Resolution happens once per mount, off the live document, so the scene is
 * painted in whatever theme the page is in. The fallbacks are neutral greys in
 * linear components; they are only ever reached when there is no stylesheet at
 * all — a test, a headless run — and they keep the scene legible rather than
 * pretty.
 */

import { Color } from 'three';

import type { ColorTokenName } from '@/lib/coloring/scales';

/* -------------------------------------------------------------------------- */
/* Roles.                                                                      */
/* -------------------------------------------------------------------------- */

/** Every surface role a presentation paints. */
export type PaletteRole =
  | 'backdrop'
  | 'plaster'
  | 'exterior'
  | 'cut'
  | 'wood'
  | 'woodDark'
  | 'decking'
  | 'tile'
  | 'grout'
  | 'mosaic'
  | 'fabric'
  | 'textile'
  | 'ochre'
  | 'stone'
  | 'metal'
  | 'foliage'
  | 'clay'
  | 'glass'
  | 'lamp'
  | 'screen';

/** The colours the scene is built from, read once per mount. */
export type ScenePalette = Readonly<Record<PaletteRole, Color>>;

/**
 * Which token paints which role.
 *
 * The `--scene-*` family exists for this module; the rest are the page's own
 * surface, text and canvas tokens, so plaster is the page's surface white and a
 * wall's cut edge is the page's text black — the model belongs to the page it
 * sits on.
 */
export const PALETTE_TOKENS: Readonly<Record<PaletteRole, ColorTokenName>> = {
  backdrop: '--scene-backdrop',
  plaster: '--bg-surface',
  exterior: '--scene-exterior',
  cut: '--text-primary',
  wood: '--scene-wood',
  woodDark: '--scene-wood-dark',
  decking: '--scene-decking',
  tile: '--scene-tile',
  grout: '--scene-tile-grout',
  mosaic: '--scene-mosaic',
  fabric: '--canvas-3d',
  textile: '--scene-textile',
  ochre: '--scene-ochre',
  stone: '--canvas-3d-horizon',
  metal: '--wall-110',
  foliage: '--scene-foliage',
  clay: '--scene-clay',
  glass: '--scene-glass',
  lamp: '--scene-lamp',
  screen: '--text-primary',
};

/** Roles that fall back to a dark grey when their token is absent. */
const DARK_ROLES: ReadonlySet<PaletteRole> = new Set(['backdrop', 'cut', 'screen']);

/** Roles that fall back to a light grey when their token is absent. */
const LIGHT_ROLES: ReadonlySet<PaletteRole> = new Set(['plaster', 'tile', 'fabric', 'glass', 'lamp']);

const FALLBACK_DARK_LEVEL = 0.15;
const FALLBACK_MID_LEVEL = 0.6;
const FALLBACK_LIGHT_LEVEL = 0.95;

function fallbackFor(role: PaletteRole): Color {
  const level = DARK_ROLES.has(role)
    ? FALLBACK_DARK_LEVEL
    : LIGHT_ROLES.has(role)
      ? FALLBACK_LIGHT_LEVEL
      : FALLBACK_MID_LEVEL;

  return new Color(level, level, level);
}

/* -------------------------------------------------------------------------- */
/* Resolution.                                                                 */
/* -------------------------------------------------------------------------- */

/** Where token values are read from. The document by default; a test may pass its own. */
export type TokenReader = (name: ColorTokenName) => string;

/** Reads a custom property off the root element of the current document. */
export function documentTokenReader(): TokenReader {
  return (name) => getComputedStyle(document.documentElement).getPropertyValue(name).trim();
}

/** A hex triplet or sextet with or without alpha: `#abc`, `#aabbcc`, `#aabbccdd`. */
const HEX_COLOUR = /^#[0-9a-f]{3,8}$/i;

/**
 * Whether a string is something `THREE.Color` can read.
 *
 * Three does not throw on a value it cannot parse — it warns and leaves the
 * colour white — so "unparsable" has to be decided before it is asked. Hex,
 * the `rgb`/`hsl` functional forms and the named CSS colours are what it reads.
 */
export function looksLikeColour(raw: string): boolean {
  const value = raw.trim();

  return (
    HEX_COLOUR.test(value) ||
    value.startsWith('rgb') ||
    value.startsWith('hsl') ||
    Object.prototype.hasOwnProperty.call(Color.NAMES, value.toLowerCase())
  );
}

/**
 * A design token, resolved to a colour the renderer understands.
 *
 * An empty or unparsable value yields the fallback rather than throwing: a
 * missing token is a styling defect, not a reason to take the screen down.
 */
export function tokenColour(name: ColorTokenName, fallback: Color, read: TokenReader): Color {
  const raw = read(name);

  if (!looksLikeColour(raw)) {
    return fallback;
  }

  return new Color(raw.trim());
}

/** Resolve the whole palette. */
export function readPalette(read: TokenReader = documentTokenReader()): ScenePalette {
  const entries = (Object.keys(PALETTE_TOKENS) as PaletteRole[]).map(
    (role) => [role, tokenColour(PALETTE_TOKENS[role], fallbackFor(role), read)] as const,
  );

  return Object.fromEntries(entries) as ScenePalette;
}
