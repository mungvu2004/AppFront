/**
 * Bảng màu cảnh Pascal không trôi khỏi token của trang đăng nhập: mỗi màu có token
 * phải bằng đúng giá trị token ấy trong `globals.css` (khối sáng, khai đầu tiên).
 */
import { readFileSync } from 'node:fs';

import { describe, expect, it } from 'vitest';

import { SCENE_PALETTE, SCENE_PALETTE_TOKENS } from '../scenePalette';

const CSS = readFileSync('src/styles/globals.css', 'utf8');

/** Mọi giá trị khai của một token, theo thứ tự trong tệp. */
const declaredValuesOf = (token: string): string[] =>
  [...CSS.matchAll(new RegExp(`${token}:\\s*([^;]+);`, 'g'))].map((m) => m[1]!.trim().toLowerCase());

describe('scenePalette', () => {
  it.each(Object.entries(SCENE_PALETTE_TOKENS))('%s = %s của globals.css', (role, token) => {
    expect(declaredValuesOf(token)).toContain(SCENE_PALETTE[role as keyof typeof SCENE_PALETTE].toLowerCase());
  });
});
