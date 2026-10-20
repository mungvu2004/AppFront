/**
 * Plugin vật liệu webp: viết lại tệp vendor thật thì đúng 14 vật liệu đổi map `_512.ktx2`
 * → `_512.webp`, mọi dòng khác giữ nguyên; upstream đổi thì lượt dựng hỏng.
 */
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

import { pascalMaterialLocal, rewriteMaterialLibrary } from '../pascal-material-local.mjs';
import { WEBP_MATERIAL_IDS } from '../pascal-material-webp.mjs';

const LIBRARY = path.resolve('vendor/pascal/packages/core/src/material-library.ts');
const WEBP = new Set(WEBP_MATERIAL_IDS);

describe('pascal-material-local', () => {
  it('tệp vendor thật: chỉ map của 14 id đổi sang webp, mọi dòng khác giữ nguyên', () => {
    const code = readFileSync(LIBRARY, 'utf8');
    const before = code.split('\n');
    const after = rewriteMaterialLibrary(code).split('\n');
    expect(after).toHaveLength(before.length);
    const changedIds = new Set();
    let id = null;
    for (let i = 0; i < before.length; i += 1) {
      id = /^ {4}id: '([^']+)',/.exec(before[i])?.[1] ?? id;
      if (WEBP.has(id) && before[i].includes('_512.ktx2')) {
        expect(after[i]).toBe(before[i].replace('_512.ktx2', '_512.webp'));
        changedIds.add(id);
      } else {
        expect(after[i]).toBe(before[i]);
      }
    }
    expect([...changedIds].sort()).toEqual([...WEBP].sort());
  });

  it('ném lỗi khi id mất khỏi tệp hoặc không có map _512.ktx2', () => {
    expect(() => rewriteMaterialLibrary("id: 'other',")).toThrow(/wood-woodplank48/);
    const noMaps = WEBP_MATERIAL_IDS.map((id) => `    id: '${id}',\n    previewThumbnailUrl: '/material/x_thumb.webp',\n`).join('');
    expect(() => rewriteMaterialLibrary(noMaps)).toThrow(/_512\.ktx2/);
  });

  it('chỉ chạm material-library.ts (cả đường dẫn Windows) và báo khi lượt dựng không gặp nó', () => {
    const plugin = pascalMaterialLocal();
    expect(plugin.enforce).toBe('pre');
    expect(plugin.transform("'/material/a_512.ktx2'", 'x.ts')).toBeNull();
    expect(() => plugin.buildEnd()).toThrow(/material-library\.ts/);
    expect(() => plugin.buildEnd(new Error('khác'))).not.toThrow();
    const out = plugin.transform(readFileSync(LIBRARY, 'utf8'), LIBRARY.replaceAll('/', '\\') + '?v=1').code;
    expect(out).toContain('/material/wood/woodplank_48/woodplank_48_basecolor_512.webp');
    expect(() => plugin.buildEnd()).not.toThrow();
  });
});
