/**
 * Chặn tái phát nợ QA-01c #13: mọi màu trong `tailwind.config.ts` là `var(--token)`
 * trần, không `<alpha-value>`, nên hậu tố độ mờ `/NN` trên chúng bị Tailwind bỏ IM
 * LẶNG — không lỗi, không CSS. Cặp màu + độ mờ thật sự cần thì viết thành lớp
 * `-NN` trong `@layer utilities` của `globals.css` (bằng `color-mix`).
 *
 * Danh sách token đọc thẳng từ config, không chép tay.
 */
import { readdirSync, readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

import tailwindConfig from '../../../tailwind.config';

const PREFIXES =
  'bg|border(?:-[trblxyse])?|text|ring(?:-offset)?|outline|from|via|to|fill|stroke|divide|shadow|placeholder|caret|accent|decoration';

function tokenNames(colors: object, path: string[] = []): string[] {
  return Object.entries(colors).flatMap(([key, value]: [string, unknown]) => {
    const name = key === 'DEFAULT' ? path : [...path, key];
    if (typeof value === 'string') return value.startsWith('var(') ? [name.join('-')] : [];
    return typeof value === 'object' && value !== null ? tokenNames(value, name) : [];
  });
}

const TOKENS = tokenNames(tailwindConfig.theme?.colors ?? {})
  .sort((a, b) => b.length - a.length)
  .join('|');

const SLASH_OPACITY = new RegExp(`(?<![\\w-])(?:${PREFIXES})-(?:${TOKENS})/(?:\\d+|\\[[^\\]]*\\])(?![\\w-])`, 'g');
const DASH_OPACITY = new RegExp(`(?<![\\w-])(?:${PREFIXES})-(?:${TOKENS})-\\d+(?![\\w-])`, 'g');

const SRC = resolve(process.cwd(), 'src');

function sourceFiles(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) return sourceFiles(full);
    return /\.(tsx?|css|mdx)$/.test(entry.name) ? [full] : [];
  });
}

/** Bỏ chú thích: tài liệu được phép nhắc tới dạng lớp chết để giải thích vì sao tránh. */
function code(file: string): string {
  return readFileSync(file, 'utf8')
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/^\s*\/\/.*$/gm, '');
}

const FILES = sourceFiles(SRC).map((file) => ({ file: file.slice(SRC.length + 1), text: code(file) }));
const GLOBALS = readFileSync(join(SRC, 'styles/globals.css'), 'utf8');

describe('lớp màu có độ mờ trên token var()', () => {
  it('không dùng hậu tố `/NN` (Tailwind bỏ im lặng)', () => {
    const hits = FILES.flatMap(({ file, text }) => (text.match(SLASH_OPACITY) ?? []).map((m) => `${file}: ${m}`));
    expect(hits).toEqual([]);
  });

  it('mọi lớp `-NN` đang dùng đều được định nghĩa trong globals.css', () => {
    const used = new Set(FILES.flatMap(({ text }) => text.match(DASH_OPACITY) ?? []));
    const missing = [...used].filter((cls) => !GLOBALS.includes(`.${cls} {`));
    expect(missing).toEqual([]);
  });
});
