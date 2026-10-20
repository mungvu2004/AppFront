/**
 * Sinh `src/pascal-page/pascal-icons.json`: đúng các icon Iconify mà mã Pascal (vendor) và
 * trang 3D dùng, để `@iconify/react/offline` vẽ chúng mà không gọi `api.iconify.design` lúc chạy.
 *
 * Quét chuỗi `prefix:name` trong `vendor/pascal/packages/*\/src` và `src/pascal-page`, rồi
 * GET từng bộ một lần (chỉ lúc dev, khi đồng bộ upstream thêm icon). Kết quả được commit.
 *
 * Chạy: `node scripts/gen-pascal-icons.mjs`.
 */
import { readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { get } from 'node:https';
import { join, relative } from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';

const ROOT = fileURLToPath(new URL('..', import.meta.url));
export const ICONS_JSON = join(ROOT, 'src/pascal-page/pascal-icons.json');
export const PREFIXES = ['lucide', 'mdi', 'ph', 'charm', 'carbon', 'icon-park-outline'];

// Chuỗi đứng riêng trong nháy: `'lucide:box'`, `"mdi:floor-plan"`, `` `ph:door` ``.
const ICON_RE = new RegExp(`['"\`](${PREFIXES.join('|')}):([a-z0-9]+(?:-[a-z0-9]+)*)['"\`]`, 'g');

function sourceFiles(root) {
  const dirs = [
    ...readdirSync(join(root, 'vendor/pascal/packages'), { withFileTypes: true })
      .filter((d) => d.isDirectory())
      .map((d) => join(root, 'vendor/pascal/packages', d.name, 'src')),
    join(root, 'src/pascal-page'),
  ];
  return dirs.flatMap((dir) => {
    let names;
    try {
      names = readdirSync(dir, { recursive: true });
    } catch {
      return []; // gói không có src/
    }
    return names
      .map(String)
      .filter((f) => /\.tsx?$/.test(f) && !f.split(/[\\/]/).includes('node_modules'))
      .map((f) => join(dir, f));
  });
}

/** `{ prefix: [name, …] }` đã sắp xếp, gom từ mọi tệp nguồn. */
export function scanIconNames(root = ROOT) {
  const found = new Map(PREFIXES.map((p) => [p, new Set()]));
  for (const file of sourceFiles(root)) {
    for (const m of readFileSync(file, 'utf8').matchAll(ICON_RE)) found.get(m[1]).add(m[2]);
  }
  return Object.fromEntries([...found].filter(([, s]) => s.size).map(([p, s]) => [p, [...s].sort()]));
}

/** GET JSON bằng `node:https` — không `fetch` (luật `no-fetch-outside-http`). */
function getJson(url) {
  return new Promise((resolve, reject) => {
    get(url, (res) => {
      let body = '';
      res.setEncoding('utf8');
      res.on('data', (c) => (body += c));
      res.on('end', () => (res.statusCode === 200 ? resolve(JSON.parse(body)) : reject(new Error(`${url}: HTTP ${res.statusCode}`))));
    }).on('error', reject);
  });
}

async function main() {
  const wanted = scanIconNames();
  const sets = [];
  for (const [prefix, names] of Object.entries(wanted)) {
    const set = await getJson(`https://api.iconify.design/${prefix}.json?icons=${names.join(',')}`);
    const missing = names.filter((n) => !set.icons?.[n] && !set.aliases?.[n]);
    if (missing.length) throw new Error(`${prefix}: API không có ${missing.join(', ')}`);
    sets.push(set);
  }
  writeFileSync(ICONS_JSON, `${JSON.stringify(sets, null, 2)}\n`);
  const total = Object.values(wanted).reduce((n, a) => n + a.length, 0);
  console.log(`${total} icon / ${sets.length} bộ → ${relative(ROOT, ICONS_JSON)}`);
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) await main();
