// @vitest-environment node
/**
 * Áo của trang 3D (`../pascal-theme.css`) là bản chép token của globals.css: khối tối chép
 * `html.dark`, khối sáng chép `:root`. Mỗi dòng `--x: giá-trị; /* = --token *\/` phải bằng đúng
 * giá trị token đó ở khối tương ứng, và các cặp chữ/nền chính đọc được (≥ 4,5:1) ở cả hai.
 */
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

import { contrastRatio } from '@/lib/coloring/legend';

const read = (rel: string) => readFileSync(fileURLToPath(new URL(rel, import.meta.url)), 'utf8');

/** Khai báo `--x: v;` trong một khối CSS, chú thích bỏ đi. */
function declarations(block: string): Map<string, string> {
  const clean = block.replace(/\/\*[\s\S]*?\*\//g, '');
  return new Map([...clean.matchAll(/(--[\w-]+)\s*:\s*([^;]+);/g)].map((m) => [m[1] ?? '', (m[2] ?? '').trim()]));
}

/** Các dòng chép `--x: v; /* = --token *\/` của một khối. */
function mirrorsOf(block: string): { name: string; value: string; token: string }[] {
  return [...block.matchAll(/(--[\w-]+)\s*:\s*([^;]+);\s*\/\*\s*=\s*(--[\w-]+)\s*\*\//g)].map((m) => ({
    name: m[1] ?? '',
    value: (m[2] ?? '').trim(),
    token: m[3] ?? '',
  }));
}

const globals = read('../../styles/globals.css');
const themeCss = read('../pascal-theme.css');
/** Thân khối CSS ngay sau `selector` (khối không lồng). */
const blockAfter = (css: string, selector: RegExp) =>
  new RegExp(`${selector.source}\\s*\\{([^}]*)\\}`).exec(css)?.[1] ?? '';

const DARK = { mode: 'tối', app: blockAfter(globals, /html\.dark/), page: blockAfter(themeCss, /body\.dark \.dark/) };
const LIGHT = { mode: 'sáng', app: blockAfter(globals, /:root/), page: blockAfter(themeCss, /html:not\(\.dark\) body \.dark/) };

describe.each([DARK, LIGHT])('pascal-theme.css — khối $mode', ({ app, page }) => {
  const appTokens = declarations(app);
  const theme = declarations(page);
  const mirrors = mirrorsOf(page);

  it('đọc được khối của app và có các dòng chép', () => {
    expect(appTokens.size).toBeGreaterThan(10);
    expect(mirrors.length).toBeGreaterThanOrEqual(27);
  });

  it.each(mirrors)('$name khớp $token', ({ value, token }) => {
    expect(value).toBe(appTokens.get(token));
  });

  it('chữ trên nút chính, chữ mờ trên nền và chữ trên thẻ đạt 4,5:1', () => {
    const v = (name: string) => theme.get(name) ?? '';
    expect(contrastRatio(v('--primary-foreground'), v('--primary'))).toBeGreaterThanOrEqual(4.5);
    expect(contrastRatio(v('--muted-foreground'), v('--background'))).toBeGreaterThanOrEqual(4.5);
    expect(contrastRatio(v('--foreground'), v('--card'))).toBeGreaterThanOrEqual(4.5);
  });
});

describe('pascal-theme.css — hai khối', () => {
  it('khối sáng chỉ áp khi <html> không có lớp dark, và phủ cả khung con `.dark` của Pascal', () => {
    expect(themeCss).toMatch(/html:not\(\.dark\) body,\s*html:not\(\.dark\) body \.dark \{/);
  });

  it('cùng một bộ biến chép, cùng token gốc', () => {
    const pairs = (block: string) => mirrorsOf(block).map((m) => `${m.name}=${m.token}`).sort();
    expect(pairs(LIGHT.page)).toEqual(pairs(DARK.page));
  });
});

describe('pascal-theme.css — phông (UI-1023 aesthetic 2.7 #2)', () => {
  it('sans là Be Vietnam Pro tự lưu, như app', () => {
    expect(themeCss).toMatch(/--font-barlow:\s*'Be Vietnam Pro'/);
    expect(themeCss).toContain("url('/landing/fonts/BeVietnamPro-400-vietnamese.woff2')");
  });

  it('"3,0 m" trên chip tầng không dùng mono', () => {
    expect(themeCss).toMatch(/button\[title="Level height"\]\.font-mono\s*\{\s*font-family:\s*var\(--font-barlow\)/);
  });
});
