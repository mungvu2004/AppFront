/**
 * Plugin khoanh CSS của Pascal — mỗi ca khoá một đường rò đã kể trong docblock
 * của `scripts/pascal-css-scope.mjs`.
 */

import postcss from 'postcss';
import { describe, expect, it } from 'vitest';

import { pascalCssScope } from '../pascal-css-scope.mjs';

const run = (css) => postcss([pascalCssScope()]).process(css, { from: undefined }).css.replace(/\s+/g, ' ').trim();

describe('pascalCssScope', () => {
  it('prefixes every rule and maps document roots onto the Pascal root', () => {
    const out = run(':root, :host { --x: 1 } body { color: red } .flex { display: flex } * { margin: 0 }');
    expect(out).toContain('.pascal-root { --x: 1 }');
    expect(out).toContain('.pascal-root { color: red }');
    expect(out).toContain('.pascal-root .flex { display: flex }');
    expect(out).toContain('.pascal-root * { margin: 0 }');
    expect(out.split('}').filter((r) => r.trim()).every((r) => r.trim().startsWith('.pascal-root'))).toBe(true);
  });

  it('puts the dark theme on the root itself and below it', () => {
    expect(run('.dark { --bg: black }')).toContain('.pascal-root.dark, .pascal-root .dark { --bg: black }');
  });

  it('unwraps layers in cascade order so unlayered AppFront CSS cannot outrank them', () => {
    const out = run('@layer theme, base, utilities; @layer utilities { .u { a: 1 } } .loose { c: 3 } @layer base { b { b: 2 } }');
    expect(out).not.toContain('@layer');
    expect(out.indexOf('b { b: 2 }')).toBeLessThan(out.indexOf('.u { a: 1 }'));
    expect(out.indexOf('.u { a: 1 }')).toBeLessThan(out.indexOf('.loose { c: 3 }'));
  });

  it('turns global @property registrations into scoped initial values', () => {
    const out = run('@property --tw-shadow { syntax: "*"; inherits: false; initial-value: 0 0 #0000 } .s { box-shadow: var(--tw-shadow) }');
    expect(out).not.toContain('@property');
    expect(out).toContain('.pascal-root *, .pascal-root ::before, .pascal-root ::after, .pascal-root ::backdrop { --tw-shadow: 0 0 #0000 }');
  });

  it('renames keyframes and their uses, leaving nested and keyframe selectors alone', () => {
    const out = run('@keyframes spin { to { rotate: 1turn } } .a { animation: spin 1s; --animate-spin: spin 1s; --other: spin } .b { &:hover { c: 1 } }');
    expect(out).toContain('@keyframes pascal-spin { to { rotate: 1turn } }');
    expect(out).toContain('animation: pascal-spin 1s');
    expect(out).toContain('--animate-spin: pascal-spin 1s');
    expect(out).toContain('--other: spin');
    expect(out).toContain('.pascal-root .b { &:hover { c: 1 } }');
  });
});
