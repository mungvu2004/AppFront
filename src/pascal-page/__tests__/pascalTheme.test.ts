// @vitest-environment node
/**
 * Áo tối của trang 3D (`../pascal-theme.css`) là bản chép token `html.dark` của globals.css:
 * mỗi dòng `--x: giá-trị; /* = --token *\/` phải bằng đúng giá trị token đó, và hai cặp chữ/nền
 * chính đọc được (≥ 4,5:1).
 */
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

import { contrastRatio } from '@/lib/coloring/legend';

const read = (rel: string) => readFileSync(fileURLToPath(new URL(rel, import.meta.url)), 'utf8');

/** Khai báo `--x: v;` trong một khối CSS, chú thích bỏ đi. */
function declarations(block: string): Map<string, string> {
  const clean = block.replace(/\/\*[\s\S]*?\*\//g, '');
  return new Map([...clean.matchAll(/(--[\w-]+)\s*:\s*([^;]+);/g)].map((m) => [m[1], m[2].trim()]));
}

const darkBlock = /html\.dark\s*\{([^}]*)\}/.exec(read('../../styles/globals.css'))?.[1] ?? '';
const appDark = declarations(darkBlock);
const themeCss = read('../pascal-theme.css');
const theme = declarations(themeCss);
const mirrors = [...themeCss.matchAll(/(--[\w-]+)\s*:\s*([^;]+);\s*\/\*\s*=\s*(--[\w-]+)\s*\*\//g)].map(
  (m) => ({ name: m[1], value: m[2].trim(), token: m[3] }),
);

describe('pascal-theme.css', () => {
  it('đọc được khối html.dark và có các dòng chép', () => {
    expect(appDark.size).toBeGreaterThan(10);
    expect(mirrors.length).toBeGreaterThanOrEqual(26);
  });

  it.each(mirrors)('$name khớp $token của html.dark', ({ value, token }) => {
    expect(value).toBe(appDark.get(token));
  });

  it('chữ trên nút chính và chữ mờ trên nền đạt 4,5:1', () => {
    const v = (name: string) => theme.get(name) ?? '';
    expect(contrastRatio(v('--primary-foreground'), v('--primary'))).toBeGreaterThanOrEqual(4.5);
    expect(contrastRatio(v('--muted-foreground'), v('--background'))).toBeGreaterThanOrEqual(4.5);
    expect(contrastRatio(v('--foreground'), v('--card'))).toBeGreaterThanOrEqual(4.5);
  });
});
