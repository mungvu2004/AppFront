/**
 * Plugin vite dịch chuỗi giao diện Pascal sang tiếng Việt LÚC DỰNG (G5-03, G5-15).
 *
 * Vì sao không sửa vendor: quyết định A (`ui-review/fix/debate/DECISIONS.md`) — giữ
 * `vendor/pascal/**` nguyên byte để `diff -rq` với upstream còn ý nghĩa. Thay vào đó
 * ta thay chuỗi trên mã nguồn trước mọi plugin khác (`enforce: 'pre'`).
 *
 * Báo đỏ thay vì im lặng: chuỗi gốc không còn trong tệp (upstream đổi chữ) hoặc tệp
 * trong bảng không được dựng tới (upstream đổi tên tệp) → ném lỗi, lượt dựng hỏng.
 */
import path from 'node:path';

import { EDITOR_VI } from './pascal-vi/editor.mjs';
import { EDITOR_EXTRA_VI } from './pascal-vi/editor-extra.mjs';
import { EDITOR_EXTRA2_VI } from './pascal-vi/editor-extra2.mjs';
import { MATERIALS_UI_VI } from './pascal-vi/materials-ui.mjs';
import { BEHAVIOUR_PATCHES } from './pascal-vi/behaviour.mjs';

function mergeTables(...tables) {
  const out = {};
  for (const t of tables) for (const [f, pairs] of Object.entries(t)) out[f] = [...(out[f] ?? []), ...pairs];
  return out;
}

export const PASCAL_VI_TABLES = mergeTables(EDITOR_VI, EDITOR_EXTRA_VI, EDITOR_EXTRA2_VI, MATERIALS_UI_VI, BEHAVIOUR_PATCHES);

/** Thay mọi cặp `[gốc, Việt]` trong `code`; thiếu chuỗi gốc thì ném lỗi. */
export function applyTable(code, file, pairs) {
  const crlf = code.includes('\r\n');
  let out = code;
  for (const [rawFrom, rawTo] of pairs) {
    const from = crlf ? rawFrom.replaceAll('\n', '\r\n') : rawFrom;
    const to = crlf ? rawTo.replaceAll('\n', '\r\n') : rawTo;
    if (!out.includes(from)) {
      throw new Error(`pascal-vi: không thấy chuỗi gốc ${JSON.stringify(rawFrom)} trong ${file} — upstream đã đổi chữ, cập nhật scripts/pascal-vi/`);
    }
    out = out.split(from).join(to);
  }
  return out;
}

export function pascalVi({ packagesDir, tables = PASCAL_VI_TABLES } = {}) {
  const root = path.resolve(packagesDir);
  const seen = new Set();
  return {
    name: 'pascal-vi',
    enforce: 'pre',
    transform(code, id) {
      const file = path.relative(root, id.split('?')[0]).split(path.sep).join('/');
      const pairs = tables[file];
      if (!pairs) return null;
      seen.add(file);
      return { code: applyTable(code, file, pairs), map: null };
    },
    buildEnd(error) {
      if (error) return;
      const missing = Object.keys(tables).filter((f) => !seen.has(f));
      if (missing.length) throw new Error(`pascal-vi: tệp trong bảng không được dựng tới: ${missing.join(', ')}`);
    },
  };
}
