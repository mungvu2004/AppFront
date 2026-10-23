/**
 * T-01 / T-02 / phông: lớp `text-text-tertiary`, `text-title`, `text-heading` phải có trong
 * config và `--text-tertiary` phải có trong cả hai chủ đề — trước đây lớp tertiary không sinh CSS.
 */
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

import tailwindConfig from '../../../tailwind.config';

const extend = tailwindConfig.theme?.extend as unknown as Record<string, Record<string, unknown>>;
const colors = tailwindConfig.theme?.colors as unknown as Record<string, Record<string, string>>;
const css = readFileSync(resolve(process.cwd(), 'src/styles/globals.css'), 'utf8');

describe('thang chữ và token chữ', () => {
  it('có text.tertiary, định nghĩa ở cả sáng lẫn tối', () => {
    expect(colors.text?.tertiary).toBe('var(--text-tertiary)');
    expect(css.match(/--text-tertiary:/g)?.length).toBe(2);
  });

  it('có cỡ title 24/32 và heading 16/24, đậm 500', () => {
    expect(extend.fontSize?.title).toEqual(['1.5rem', { lineHeight: '2rem', fontWeight: '500' }]);
    expect(extend.fontSize?.heading).toEqual(['1rem', { lineHeight: '1.5rem', fontWeight: '500' }]);
  });

  it('phông Be Vietnam Pro, semibold/bold vẽ ở 500 (tệp chỉ có 300–500)', () => {
    expect((extend.fontFamily?.sans as string[])[0]).toBe('"Be Vietnam Pro"');
    expect(extend.fontWeight).toMatchObject({ semibold: '500', bold: '500' });
    for (const w of [300, 400, 500]) expect(css).toContain(`BeVietnamPro-${w}-vietnamese.woff2`);
  });
});
