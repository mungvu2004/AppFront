/**
 * A shared guard: no module may spell a colour out.
 *
 * `local/no-raw-color` already refuses hex, `rgb()` and `hsl()` inside
 * `src/components` and `src/screens`, and stops there for a good reason — those
 * are the folders where a colour literal would reach the screen. But the rule of
 * this codebase is stronger than the lint rule: a module that *decides* colour,
 * such as `src/lib/coloring`, must hand back token names, and a colour literal
 * appearing in it would be a bug the linter is not watching for. This is the
 * check those modules point at themselves in their own tests.
 *
 * Two decisions make it usable rather than annoying.
 *
 * **Comments are masked before scanning.** A docblock explaining that a function
 * "never returns an `rgb()` string" is prose, not a colour, and a checker that
 * flagged it would train people to stop writing the explanation. The masker
 * walks the source tracking whether it is inside a line comment, a block
 * comment, a quoted string or a template, and blanks out only the comment
 * regions — keeping every newline, so the line numbers it reports are the line
 * numbers in the editor. That is the same distinction the ESLint rule draws by
 * looking only at `Literal`, `TemplateElement` and `JSXText` nodes.
 *
 * **It does not depend on a test framework.** The failure is a thrown `Error`
 * carrying every offending line, so the same function works from a Vitest test,
 * a Node script or a CI step. `src/lib` is production source, and importing a
 * test runner into it to get one assertion would be the wrong trade.
 *
 * The pattern itself is copied verbatim from `eslint-rules/no-raw-color.js`, so
 * "raw colour" means exactly one thing across the repo. The rule is CommonJS and
 * does not export its regex, which is why it is restated rather than imported;
 * `expectNoRawColorPatternMatchesLintRule` in the test file reads the rule off
 * disk and compares the two, so the copy cannot drift.
 */

import { readdirSync, readFileSync, statSync } from 'node:fs';
import { extname, join, resolve } from 'node:path';

/**
 * Hex, `rgb()`, `rgba()`, `hsl()` and `hsla()` — the expression
 * `eslint-rules/no-raw-color.js` refuses, character for character.
 */
export const RAW_COLOR_PATTERN = /(#([0-9a-fA-F]{3}){1,2}\b)|(rgb|hsl)a?\(/;

/** The same expression, global, for finding every occurrence on a line. */
function everyRawColor(): RegExp {
  return new RegExp(RAW_COLOR_PATTERN.source, 'g');
}

/** One colour literal found in a file. */
export interface RawColorFinding {
  readonly path: string;
  /** One-based, as an editor counts. */
  readonly line: number;
  /** One-based column of the match. */
  readonly column: number;
  /** The text that matched: `#567a96`, `rgba(`. */
  readonly match: string;
  /** The whole line, trimmed, for the failure message. */
  readonly snippet: string;
}

export interface NoRawColorOptions {
  /**
   * Findings to let through. A string matches when it appears anywhere in the
   * offending line; a `RegExp` is tested against that line.
   *
   * For the rare legitimate case — a negative test asserting that
   * `isColorTokenName('#567a96')` is false, a fixture proving the checker works.
   */
  readonly ignore?: readonly (string | RegExp)[];
  /** Which files a directory scan looks at. Defaults to `.ts` and `.tsx`. */
  readonly extensions?: readonly string[];
  /** Directory names a scan never descends into. */
  readonly skipDirectories?: readonly string[];
  /**
   * Files a directory scan never opens, matched against the path with `/`
   * separators so one pattern works on every platform.
   *
   * Only consulted while walking a directory. Naming a file directly always
   * scans it, so a caller can never be surprised by silence.
   */
  readonly skipFiles?: readonly RegExp[];
}

const DEFAULT_EXTENSIONS: readonly string[] = ['.ts', '.tsx'];
const DEFAULT_SKIP_DIRECTORIES: readonly string[] = ['node_modules', 'dist', '.git'];

/**
 * Scan the code that ships, and leave the code that tests it alone.
 *
 * A test for a colour parser has to contain colours — `parseColor('#5C564D')`
 * is the test doing its job, not debt. The rule this guard enforces is about
 * *production source*: no module that ships may spell a colour out, because a
 * colour there is a decision taken outside the token layer.
 *
 * Pass this to scan a whole tree. To hold test files to the rule as well, scan
 * without it and allow the deliberate cases through {@link NoRawColorOptions.ignore}.
 */
export const SOURCE_ONLY: NoRawColorOptions = {
  skipDirectories: [...DEFAULT_SKIP_DIRECTORIES, '__tests__', '__fixtures__', '__mocks__'],
  skipFiles: [/\.test\.tsx?$/, /\.spec\.tsx?$/, /\.stories\.tsx?$/],
};

/* -------------------------------------------------------------------------- */
/* Masking comments.                                                           */
/* -------------------------------------------------------------------------- */

type ScanState = 'code' | 'lineComment' | 'blockComment' | 'single' | 'double' | 'template';

/**
 * The source with every comment blanked out and everything else untouched.
 *
 * Newlines survive inside blanked block comments, so a match's line number is
 * still the line number in the file.
 *
 * Two known limits, both deliberate and both conservative — they can only make
 * the check stricter, never blind it:
 *
 * - A `${…}` hole in a template literal is treated as part of the template
 *   rather than as code returning to the outer state. A colour spelled inside
 *   one is still caught, because the hole is scanned as string content.
 * - A regular-expression literal is treated as code. A hex inside one is
 *   therefore reported; the only files that hold such a pattern are colour
 *   checkers like this one, which pass `ignore`.
 */
export function maskComments(source: string): string {
  const output: string[] = [];
  let state: ScanState = 'code';
  let index = 0;

  const peek = (offset: number): string => source[index + offset] ?? '';

  while (index < source.length) {
    const character = source[index] ?? '';

    switch (state) {
      case 'code': {
        if (character === '/' && peek(1) === '/') {
          state = 'lineComment';
          output.push('  ');
          index += 2;
          continue;
        }
        if (character === '/' && peek(1) === '*') {
          state = 'blockComment';
          output.push('  ');
          index += 2;
          continue;
        }
        if (character === "'") {
          state = 'single';
        } else if (character === '"') {
          state = 'double';
        } else if (character === '`') {
          state = 'template';
        }
        output.push(character);
        index += 1;
        continue;
      }

      case 'lineComment': {
        if (character === '\n') {
          state = 'code';
          output.push('\n');
        } else {
          output.push(' ');
        }
        index += 1;
        continue;
      }

      case 'blockComment': {
        if (character === '*' && peek(1) === '/') {
          state = 'code';
          output.push('  ');
          index += 2;
          continue;
        }
        // Newlines are kept so reported line numbers stay true.
        output.push(character === '\n' ? '\n' : ' ');
        index += 1;
        continue;
      }

      default: {
        // Inside a string or template: a backslash hides the next character,
        // which is what stops `'\''` from reading as a closed quote.
        if (character === '\\') {
          output.push(character, peek(1));
          index += 2;
          continue;
        }
        if (
          (state === 'single' && character === "'") ||
          (state === 'double' && character === '"') ||
          (state === 'template' && character === '`')
        ) {
          state = 'code';
        }
        output.push(character);
        index += 1;
        continue;
      }
    }
  }

  return output.join('');
}

/* -------------------------------------------------------------------------- */
/* Finding.                                                                    */
/* -------------------------------------------------------------------------- */

function isIgnored(line: string, ignore: readonly (string | RegExp)[]): boolean {
  return ignore.some((rule) => (typeof rule === 'string' ? line.includes(rule) : rule.test(line)));
}

/**
 * Every colour literal in one file's text.
 *
 * Pure — takes the source rather than a path, so the checker itself is testable
 * without touching the filesystem.
 */
export function findRawColors(
  source: string,
  path = '<source>',
  options: NoRawColorOptions = {},
): RawColorFinding[] {
  const ignore = options.ignore ?? [];
  const findings: RawColorFinding[] = [];
  const lines = maskComments(source).split('\n');

  lines.forEach((line, offset) => {
    if (isIgnored(line, ignore)) {
      return;
    }

    for (const match of line.matchAll(everyRawColor())) {
      findings.push({
        path,
        line: offset + 1,
        column: (match.index ?? 0) + 1,
        match: match[0],
        snippet: line.trim(),
      });
    }
  });

  return findings;
}

/** Every `.ts`/`.tsx` file under a directory, recursively. */
function collectFiles(root: string, options: NoRawColorOptions): string[] {
  const extensions = options.extensions ?? DEFAULT_EXTENSIONS;
  const skip = options.skipDirectories ?? DEFAULT_SKIP_DIRECTORIES;
  const skipFiles = options.skipFiles ?? [];
  const found: string[] = [];

  const walk = (directory: string): void => {
    for (const entry of readdirSync(directory, { withFileTypes: true })) {
      const entryPath = join(directory, entry.name);

      if (entry.isDirectory()) {
        if (!skip.includes(entry.name)) {
          walk(entryPath);
        }
        continue;
      }

      // Windows hands back backslashes; the patterns are written with forward
      // slashes so one option object works on every platform.
      const comparable = entryPath.replace(/\\/g, '/');

      if (extensions.includes(extname(entry.name)) && !skipFiles.some((rule) => rule.test(comparable))) {
        found.push(entryPath);
      }
    }
  };

  walk(root);

  return found;
}

/** Every colour literal under a file or directory. */
export function scanForRawColors(target: string, options: NoRawColorOptions = {}): RawColorFinding[] {
  const absolute = resolve(target);
  const paths = statSync(absolute).isDirectory() ? collectFiles(absolute, options) : [absolute];

  return paths.flatMap((path) => findRawColors(readFileSync(path, 'utf8'), path, options));
}

/**
 * Assert that a file or directory spells no colour out.
 *
 * Throws an `Error` naming every offending line, so the failure says what to fix
 * rather than only that something is wrong.
 *
 * @param target A file or a directory, absolute or relative to the working
 *   directory. Vitest runs from the project root.
 *
 * @example
 * expectNoRawColor('src/lib/coloring');
 * expectNoRawColor('src/lib/coloring/__tests__', { ignore: ['isColorTokenName'] });
 */
export function expectNoRawColor(target: string, options: NoRawColorOptions = {}): void {
  const findings = scanForRawColors(target, options);

  if (findings.length === 0) {
    return;
  }

  const detail = findings
    .map((finding) => `  ${finding.path}:${String(finding.line)}:${String(finding.column)}  ${finding.snippet}`)
    .join('\n');

  throw new Error(
    `expectNoRawColor: tìm thấy ${String(findings.length)} mã màu thô trong "${target}". ` +
      `Dùng tên token thay cho mã màu.\n${detail}`,
  );
}
