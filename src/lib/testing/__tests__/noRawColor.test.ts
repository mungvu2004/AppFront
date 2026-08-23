/**
 * The repo-wide guard: no module that ships spells a colour out.
 *
 * `local/no-raw-color` watches `src/components` and `src/screens`, which is
 * where a colour literal would reach the screen. This closes the other half:
 * every other folder that ships — `src/lib`, `src/domain`, `src/store`,
 * `src/hooks`, and the end-to-end specs — is held to the same rule, so a module
 * that *decides* colour cannot quietly start spelling one.
 *
 * Test files are deliberately outside the rule. A test for a colour parser has
 * to contain colours; `parseColor('#5C564D')` is the test doing its job. Which
 * test files hold colour fixtures is pinned below, so a colour appearing in a
 * test that has no business with colour still fails.
 */

import { describe, expect, it } from 'vitest';

import { expectNoRawColor, scanForRawColors, SOURCE_ONLY } from '../expectNoRawColor';

/** The trees that ship, or that run against what ships. */
const SCANNED_ROOTS: readonly string[] = ['src', 'e2e'];

/**
 * The only files allowed to hold a colour literal, and why.
 *
 * The first two exercise the colour maths itself — a contrast ratio cannot be
 * tested without two colours to take the ratio of. The third exercises the
 * presentation engine's token *parser*: `looksLikeColour` decides whether a
 * custom property's value is something `THREE.Color` can read, and a parser
 * cannot be tested without hex and `hsl()` strings to hand it.
 */
const COLOUR_FIXTURE_FILES: readonly string[] = [
  'src/lib/coloring/__tests__/legend.test.ts',
  'src/lib/coloring/__tests__/coloring.test.ts',
  'src/lib/three/present/__tests__/palette.test.ts',
];

/** Paths as the allowlist writes them, whatever the platform hands back. */
function relativePath(absolute: string): string {
  return absolute.replace(process.cwd(), '').replace(/\\/g, '/').replace(/^\//, '');
}

describe('no raw colour ships', () => {
  it.each(SCANNED_ROOTS)('finds none in %s', (root) => {
    expect(() => expectNoRawColor(root, SOURCE_ONLY)).not.toThrow();
  });

  it('holds colour literals to the files that test colour, and no others', () => {
    const offenders = new Set(
      SCANNED_ROOTS.flatMap((root) => scanForRawColors(root)).map((finding) =>
        relativePath(finding.path),
      ),
    );

    expect([...offenders].sort()).toEqual([...COLOUR_FIXTURE_FILES].sort());
  });

  it('is looking at real files rather than passing on an empty sweep', () => {
    // Without this, a preset that accidentally skipped everything would make
    // the two tests above green and meaningless.
    const everything = scanForRawColors('src');
    const shippingOnly = scanForRawColors('src', SOURCE_ONLY);

    expect(everything.length).toBeGreaterThan(0);
    expect(shippingOnly).toEqual([]);
  });

  it('skips the test files by name as well as by folder', () => {
    // `src/lib/scale.test.ts` sits beside its source rather than in `__tests__`,
    // so folder-skipping alone would not cover it.
    const scanned = scanForRawColors('src', {
      ...SOURCE_ONLY,
      ignore: [],
    });

    expect(scanned).toEqual([]);
  });
});
