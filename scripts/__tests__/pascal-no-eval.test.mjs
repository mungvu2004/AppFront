/**
 * Plugin bật `jitless` của zod: chèn vào đúng `zod/v4/core/core.js` thật, trước dòng
 * zod giữ tham chiếu cấu hình; module khác không đụng; không gặp zod thì lượt dựng hỏng.
 */
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

import { pascalNoEval } from '../pascal-no-eval.mjs';

const requireFromCore = createRequire(path.resolve('vendor/pascal/packages/core/package.json'));
const ZOD_CORE = path.join(path.dirname(requireFromCore.resolve('zod/v4/core')), 'core.js');

describe('pascal-no-eval', () => {
  it('bật jitless trong core.js thật của zod trước khi zod giữ globalConfig', async () => {
    const plugin = pascalNoEval();
    const out = plugin.transform(readFileSync(ZOD_CORE, 'utf8'), ZOD_CORE).code;
    expect(out.indexOf('.jitless = true')).toBeLessThan(out.indexOf('export const globalConfig'));
    expect(() => plugin.buildEnd()).not.toThrow();

    // Chạy thử đoạn tầng module: cờ phải nằm trên đối tượng zod dùng.
    delete globalThis.__zod_globalConfig;
    const url = `data:text/javascript,${encodeURIComponent(out.replace(/^import .*$/gm, ''))}`;
    const { globalConfig } = await import(url);
    expect(globalConfig.jitless).toBe(true);
    delete globalThis.__zod_globalConfig;
  });

  it('bỏ qua module khác', () => {
    expect(pascalNoEval().transform('const F = Function;', 'x/zod/v4/core/util.js')).toBeNull();
  });

  it('ném lỗi khi zod đổi chữ hoặc không có trong gói', () => {
    expect(() => pascalNoEval().transform('export const x = 1;', '/n/zod/v4/core/core.js')).toThrow(/zod đã đổi/);
    expect(() => pascalNoEval().buildEnd()).toThrow(/không gặp zod/);
    expect(() => pascalNoEval().buildEnd(new Error('khác'))).not.toThrow();
  });
});
