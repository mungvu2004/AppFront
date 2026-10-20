/**
 * Icon offline: mọi icon mã Pascal nhắc tới phải có trong `pascal-icons.json` (thiếu → ô trống),
 * và bản `@iconify/react` mà alias trỏ tới không chứa đường gọi API.
 */
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

import { ICONS_JSON, scanIconNames } from '../gen-pascal-icons.mjs';

describe('pascal-icons', () => {
  it('mọi icon quét được đều có trong pascal-icons.json', () => {
    const sets = JSON.parse(readFileSync(ICONS_JSON, 'utf8'));
    const have = new Set(sets.flatMap((s) => Object.keys({ ...s.icons, ...s.aliases }).map((n) => `${s.prefix}:${n}`)));
    const wanted = Object.entries(scanIconNames()).flatMap(([p, names]) => names.map((n) => `${p}:${n}`));
    expect(wanted.length).toBeGreaterThan(0);
    expect(wanted.filter((n) => !have.has(n))).toEqual([]);
  });

  it('bản offline không gọi iconify.design', () => {
    const editorRequire = createRequire(path.resolve('vendor/pascal/packages/editor/package.json'));
    const file = editorRequire.resolve('@iconify/react/dist/offline.js');
    const code = readFileSync(file, 'utf8');
    expect(code).toContain('addCollection');
    expect(code).not.toMatch(/iconify\.design|simplesvg\.com|unisvg\.com/);
  });
});
