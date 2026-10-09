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
  parseColor,
  parsePalette,
  relativeLuminance,
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

const TINTS: ColorTokenName[] = [
  '--state-violation-tint',
  '--state-attention-tint',
  '--state-verified-tint',
  '--danger-tint',
];

const TEXT_PAIRS: [ColorTokenName, ColorTokenName][] = [
  ...SURFACES.map((bg): [ColorTokenName, ColorTokenName] => ['--text-primary', bg]),
  ...SURFACES.map((bg): [ColorTokenName, ColorTokenName] => ['--text-secondary', bg]),
  ...SURFACES.map((bg): [ColorTokenName, ColorTokenName] => ['--text-muted', bg]),
  ...SURFACES.map((bg): [ColorTokenName, ColorTokenName] => ['--accent', bg]),
  // Nền tint trạng thái: chữ muted và chữ accent (liên kết trong dải báo) sát ngưỡng ~4,8:1.
  ...TINTS.flatMap((bg): [ColorTokenName, ColorTokenName][] => [
    ['--text-muted', bg],
    ['--accent', bg],
  ]),
  ['--bg-surface', '--accent'],
  ['--bg-surface', '--accent-hover'],
];

/** Rãnh `Toggle` khi tắt và núm trên nó (WCAG 1.4.11). */
const NON_TEXT_PAIRS: [ColorTokenName, ColorTokenName][] = [
  ['--border-control', '--bg-surface'],
  ['--border-control', '--bg-app'],
  ['--bg-surface', '--border-control'],
];

/**
 * Ba bậc chữ phải còn phân biệt được với nhau (QA-01c nợ #5): sáng từng có muted và
 * secondary cách nhau 1,03:1 — hai bậc đọc ra là một.
 */
const HIERARCHY_MINIMUM = 1.2;
const HIERARCHY_PAIRS: [ColorTokenName, ColorTokenName][] = [
  ['--text-secondary', '--text-muted'],
  ['--text-primary', '--text-secondary'],
];

function ratio(palette: Palette, first: ColorTokenName, second: ColorTokenName): number {
  return contrastRatio(palette[first] ?? '', palette[second] ?? '');
}

/**
 * Tương phản của chữ `text` trên `--bg-hover` (rgba) trộn lên nền `base`: trộn từng kênh thành một
 * màu đặc rồi đo — đo thẳng trên kênh, không dựng chuỗi màu (luật `noRawColor`).
 */
function ratioOnHover(palette: Palette, text: ColorTokenName, base: ColorTokenName): number {
  const hover = parseColor(palette['--bg-hover'] ?? '');
  const under = parseColor(palette[base] ?? '');
  const ink = parseColor(palette[text] ?? '');
  if (hover === null || under === null || ink === null) return 0;
  const mix = (top: number, bottom: number): number => top * hover.alpha + bottom * (1 - hover.alpha);
  const surface = {
    red: mix(hover.red, under.red),
    green: mix(hover.green, under.green),
    blue: mix(hover.blue, under.blue),
    alpha: 1,
  };
  const [lighter, darker] = [relativeLuminance(ink), relativeLuminance(surface)].sort((a, b) => b - a);
  return ((lighter ?? 0) + 0.05) / ((darker ?? 0) + 0.05);
}

/** Hàng đang trỏ chuột: chữ muted và accent trên `--bg-hover` trộn lên app/surface (sáng 4,59–4,61:1 trên app). */
const HOVER_PAIRS: [ColorTokenName, ColorTokenName][] = [
  ['--text-muted', '--bg-app'],
  ['--text-muted', '--bg-surface'],
  ['--accent', '--bg-app'],
  ['--accent', '--bg-surface'],
];

describe.each(Object.entries(THEMES))('chủ đề %s', (_name, palette) => {
  it.each(TEXT_PAIRS)('chữ %s trên %s đạt 4,5:1', (text, bg) => {
    expect(ratio(palette, text, bg)).toBeGreaterThanOrEqual(CONTRAST_MINIMUM_BODY);
  });

  it.each(HOVER_PAIRS)('chữ %s trên `--bg-hover` trộn lên %s đạt 4,5:1', (text, base) => {
    expect(ratioOnHover(palette, text, base)).toBeGreaterThanOrEqual(CONTRAST_MINIMUM_BODY);
  });

  it.each(HIERARCHY_PAIRS)('bậc chữ %s tách khỏi %s ít nhất 1,2:1', (first, second) => {
    expect(ratio(palette, first, second)).toBeGreaterThanOrEqual(HIERARCHY_MINIMUM);
  });

  it.each(NON_TEXT_PAIRS)('%s cạnh %s đạt 3:1', (first, second) => {
    expect(ratio(palette, first, second)).toBeGreaterThanOrEqual(CONTRAST_MINIMUM_LARGE);
  });
});
