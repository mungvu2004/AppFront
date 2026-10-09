/**
 * Khoá các cặp chữ/nền và viền/nền của bảng màu ở CẢ HAI chủ đề (QA-01c, FIX-653..655).
 *
 * `parsePalette` đọc cả file và khai báo sau đè khai báo trước, nên ở đây cắt từng khối
 * selector ra trước: sáng = `:root`, tối = `:root` rồi `html.dark` đè lên.
 */
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

import {
  CONTRAST_MINIMUM_BODY,
  CONTRAST_MINIMUM_LARGE,
  contrastRatio,
  parsePalette,
  type Palette,
} from '../legend';
import type { ColorTokenName } from '../scales';

const css = readFileSync(resolve(process.cwd(), 'src/styles/globals.css'), 'utf8');

function block(selector: string): string {
  const start = css.indexOf(`${selector} {`);
  return css.slice(start, css.indexOf('\n  }', start));
}

const THEMES: Record<'sáng' | 'tối', Palette> = {
  sáng: parsePalette(block(':root')),
  tối: { ...parsePalette(block(':root')), ...parsePalette(block('html.dark')) },
};

const SURFACES: ColorTokenName[] = [
  '--bg-app',
  '--bg-surface',
  '--bg-sunken',
  '--bg-selected',
  '--bg-flash',
  '--accent-wash',
];

const TEXT_PAIRS: [ColorTokenName, ColorTokenName][] = [
  ...SURFACES.map((bg): [ColorTokenName, ColorTokenName] => ['--text-muted', bg]),
  ...SURFACES.map((bg): [ColorTokenName, ColorTokenName] => ['--accent', bg]),
  ['--text-muted', '--state-violation-tint'],
  ['--text-muted', '--state-attention-tint'],
  ['--bg-surface', '--accent'],
  ['--bg-surface', '--accent-hover'],
];

/** Rãnh `Toggle` khi tắt và núm trên nó (WCAG 1.4.11). */
const NON_TEXT_PAIRS: [ColorTokenName, ColorTokenName][] = [
  ['--border-control', '--bg-surface'],
  ['--border-control', '--bg-app'],
  ['--bg-surface', '--border-control'],
];

function ratio(palette: Palette, first: ColorTokenName, second: ColorTokenName): number {
  return contrastRatio(palette[first] ?? '', palette[second] ?? '');
}

describe.each(Object.entries(THEMES))('chủ đề %s', (_name, palette) => {
  it.each(TEXT_PAIRS)('chữ %s trên %s đạt 4,5:1', (text, bg) => {
    expect(ratio(palette, text, bg)).toBeGreaterThanOrEqual(CONTRAST_MINIMUM_BODY);
  });

  it.each(NON_TEXT_PAIRS)('%s cạnh %s đạt 3:1', (first, second) => {
    expect(ratio(palette, first, second)).toBeGreaterThanOrEqual(CONTRAST_MINIMUM_LARGE);
  });
});
