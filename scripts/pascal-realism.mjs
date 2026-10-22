/**
 * Plugin vite gom luật "editor-realism" (kế hoạch A, `docs/editor-realism-plan.md`).
 *
 * Không sửa vendor: thay chuỗi trên mã nguồn lúc dựng, như `pascal-render.mjs`, và chạy SAU nó
 * (neo có thể là chuỗi đã qua `pascal-render`).
 *
 * THÊM LUẬT: tạo `scripts/realism/<thẻ>-<tên>.mjs` xuất
 *   export const RULES = { '<đường từ vendor/pascal/packages>': [[gốc, mới, sốLần = 1], …] }
 * Plugin tự đọc mọi `*.mjs` trong thư mục đó, áp theo thứ tự tên file. Không cần sửa tệp này.
 * Tệp không xuất `RULES` bị bỏ qua (có cảnh báo).
 *
 * Báo đỏ: neo gặp khác `sốLần`, hoặc tệp trong bảng không được dựng tới → ném lỗi, lượt dựng hỏng.
 */
import { readdirSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const RULES_DIR = path.join(path.dirname(fileURLToPath(import.meta.url)), 'realism');

/** Đọc các file luật → `[{ source, file, pairs }]` theo thứ tự tên file. */
export async function loadRealismRules(dir = RULES_DIR) {
  const out = [];
  for (const name of readdirSync(dir).filter((f) => f.endsWith('.mjs')).sort()) {
    const mod = await import(pathToFileURL(path.join(dir, name)).href);
    if (!mod.RULES) {
      console.warn(`pascal-realism: ${name} không xuất RULES — bỏ qua`);
      continue;
    }
    for (const [file, pairs] of Object.entries(mod.RULES)) out.push({ source: name, file, pairs });
  }
  return out;
}

export const REALISM_RULES = await loadRealismRules();

const fileOf = (rules, id) => {
  const norm = id.split('?')[0].replaceAll('\\', '/');
  return rules.map((r) => r.file).find((f) => norm.endsWith(`/packages/${f}`));
};

/** Áp mọi luật của một module; tệp ngoài bảng → `null`. */
export function transformRealism(code, id, rules = REALISM_RULES) {
  const file = fileOf(rules, id);
  if (!file) return null;
  const crlf = code.includes('\r\n');
  const fix = (s) => (crlf ? s.replaceAll('\n', '\r\n') : s);
  let out = code;
  for (const { source, pairs } of rules.filter((r) => r.file === file)) {
    for (const [rawFrom, rawTo, times = 1] of pairs) {
      const from = fix(rawFrom);
      const to = fix(rawTo);
      const count = out.split(from).length - 1;
      if (count !== times) {
        throw new Error(
          `pascal-realism: chuỗi gốc ${JSON.stringify(rawFrom)} gặp ${count} lần (cần ${times}) trong ${file} — sửa scripts/realism/${source}`,
        );
      }
      out = out.split(from).join(to);
    }
  }
  return out;
}

export function pascalRealism({ rules = REALISM_RULES } = {}) {
  const seen = new Set();
  return {
    name: 'pascal-realism',
    enforce: 'pre',
    transform(code, id) {
      const out = transformRealism(code, id, rules);
      if (out === null) return null;
      seen.add(fileOf(rules, id));
      return { code: out, map: null };
    },
    buildEnd(error) {
      if (error) return;
      const missing = [...new Set(rules.map((r) => r.file))].filter((f) => !seen.has(f));
      if (missing.length) throw new Error(`pascal-realism: tệp trong bảng không được dựng tới: ${missing.join(', ')}`);
    },
  };
}
