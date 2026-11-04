import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

import { EDITOR_ACCENT_PALETTE } from '../../src/lib/pascal/scenePalette';
import { RULES, SWAPS } from '../realism/u48-accent-no-purple.mjs';

const PURPLE = /#(6366f1|4f46e5|4338ca|8381ed|a855f7|818cf8|a78bfa|a5b4fc|c7d2fe|e0e7ff)|129, 140, 248|-(indigo|violet)-\d/i;

describe('u48: bỏ tím Pascal', () => {
  it('mọi tệp sau khi thay không còn mã tím', () => {
    expect(Object.keys(RULES).length).toBeGreaterThan(50);
    for (const [file, pairs] of Object.entries(RULES)) {
      let text = readFileSync(`vendor/pascal/packages/${file}`, 'utf8');
      for (const [from, to] of pairs) text = text.split(from).join(to);
      expect(PURPLE.test(text), file).toBe(false);
    }
  });

  it('bảng màu người dùng tự chọn và test của vendor giữ nguyên', () => {
    expect(RULES['editor/src/components/ui/primitives/color-dot.tsx']).toBeUndefined();
    expect(Object.keys(RULES).some((file) => file.includes('.test.'))).toBe(false);
  });

  it('màu đích chỉ lấy từ bảng màu, và bảng màu là màu đang dùng trong app', () => {
    const palette = Object.values(EDITOR_ACCENT_PALETTE);
    for (const [, to] of SWAPS.filter(([from]) => from.startsWith('#'))) expect(palette).toContain(to);
    const theme = readFileSync('src/pascal-page/pascal-theme.css', 'utf8');
    for (const value of palette) expect(theme, value).toContain(value);
  });
});
