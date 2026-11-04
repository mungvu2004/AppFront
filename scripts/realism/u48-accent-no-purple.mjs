/**
 * Bỏ tím Pascal còn sót (04/11): mọi mã tím/chàm trong `vendor/pascal/packages/<gói>/src` đổi về màu chủ đạo của app.
 * Màu đích nằm ở `EDITOR_ACCENT_PALETTE` (`src/lib/pascal/scenePalette.ts`), tệp này chỉ đọc ra. Lớp Tailwind đổi sang
 * `primary` (đã theo sáng/tối); lớp chưa có trong nguồn Pascal khai ở `@source inline` của `src/pascal-page/pascal.css`.
 * Quét lúc nạp nên số lần thay tự đúng khi vendor đổi.
 *
 * Không đổi: test của vendor (ghim màu gốc), tệp không được dựng tới (`pascal-realism` báo đỏ nếu nêu chúng), và
 * `color-dot.tsx`: bảng màu để người dùng tự chọn cho vùng, không phải màu giao diện.
 */
import { readdirSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const PACKAGES = path.join(ROOT, 'vendor/pascal/packages');

const paletteSource = readFileSync(path.join(ROOT, 'src/lib/pascal/scenePalette.ts'), 'utf8');
const color = (name) => {
  const value = new RegExp(`\\b${name}: '(#[0-9a-f]{6})'`).exec(paletteSource)?.[1];
  if (!value) throw new Error(`u48: thiếu màu ${name} trong scenePalette.ts`);
  return value;
};
const rgb = (hex) => [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16)).join(', ');

const accent = color('editorAccent');
const accentHover = color('editorAccentHover');
const accentOnDark = color('editorAccentOnDark');
const accentOnDarkActive = color('editorAccentOnDarkActive');
const wash = color('editorAccentWash');

/** Dài trước ngắn: `bg-indigo-500/90` phải thay trước `bg-indigo-500`. Bản nhạt (indigo-400 trở lên) là nét trên nền tối và trong cảnh 3D. */
export const SWAPS = [
  ['#6366f1', accent],
  ['#4f46e5', accent],
  ['#4338ca', accentHover],
  ['#8381ed', accent],
  ['#a855f7', accent],
  ['#818cf8', accentOnDark],
  ['#a78bfa', accentOnDark],
  ['#a5b4fc', accentOnDark],
  ['#c7d2fe', accentOnDarkActive],
  ['#e0e7ff', wash],
  ['129, 140, 248', rgb(accentOnDark)],
  ['bg-violet-500 text-white', 'bg-primary text-primary-foreground'],
  ['bg-indigo-500 px-3 font-medium text-white', 'bg-primary px-3 font-medium text-primary-foreground'],
  ['text-violet-200', 'text-primary-foreground'],
  ['bg-indigo-700 ring-1 ring-indigo-200', 'bg-primary ring-1 ring-primary/40'],
  ['bg-indigo-500/90', 'bg-primary/90'],
  ['ring-indigo-200', 'ring-primary/40'],
  ['border-indigo-400/70', 'border-primary/70'],
  ['focus:border-indigo-400', 'focus:border-primary'],
];

const SKIP = new Set(['editor/src/components/ui/primitives/color-dot.tsx']);

function* sources(dir) {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) yield* sources(full);
    else if (/\.(ts|tsx)$/.test(entry.name) && !/\.test\.tsx?$/.test(entry.name)) yield full;
  }
}

export const RULES = {};
for (const pkg of readdirSync(PACKAGES)) {
  for (const file of sources(path.join(PACKAGES, pkg, 'src'))) {
    const key = path.relative(PACKAGES, file).split(path.sep).join('/');
    if (SKIP.has(key)) continue;
    let text = readFileSync(file, 'utf8');
    const pairs = [];
    for (const [from, to] of SWAPS) {
      const count = text.split(from).length - 1;
      if (count === 0) continue;
      pairs.push([from, to, count]);
      text = text.split(from).join(to);
    }
    if (pairs.length) RULES[key] = pairs;
  }
}
