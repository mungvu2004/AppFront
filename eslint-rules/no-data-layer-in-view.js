/**
 * A screen's view file does not reach the data layer. (R-60)
 *
 * This is the rule that makes invariant D's split hold by itself instead of by
 * discipline. `<Name>.tsx` is meant to be a function from props to markup: hand
 * it values and callbacks and it renders, with no provider to stand up and no
 * transport to fake. The moment a view imports `src/api` or `src/store` that
 * stops being true, and it stops being true quietly — the story still renders
 * on the developer's machine, because the developer's machine happens to have a
 * configured client. The failure shows up later, in somebody else's test.
 *
 * What is refused, in a view:
 *
 * - Importing `src/api/**`, `src/store/**`, `src/domain/**` or `src/lib/http/**`,
 *   written either through the `@/` alias or as a relative path. Both spellings
 *   resolve to the same module, so a rule that only knew one of them would be a
 *   rule with a documented way around it.
 * - The same paths reached by `export … from` or by a dynamic `import()`.
 *   Re-exporting a store slice from a view is still a view that depends on the
 *   store; deferring the import to runtime still means the view cannot render
 *   without it.
 *
 * What is deliberately left alone:
 *
 * - **`*.container.tsx`, `*.test.tsx`, `*.stories.tsx`.** The container is the
 *   layer whose whole job is to reach the data layer and hand the result down —
 *   forbidding it there would leave the work nowhere to go. Tests and stories
 *   build fixtures on purpose.
 * - **`use<Name>.ts` and every other non-`.tsx` file in a screen folder.** R-60
 *   is about the view; the hook is the half of invariant D that is *allowed* to
 *   know where data comes from, which is the whole reason the split exists.
 * - **Type-only imports.** `import type { Result } from '@/lib/http'` names a
 *   shape and is erased before the bundle exists — it cannot drag a transport
 *   into the view because at runtime there is nothing left of it. The same
 *   reasoning `no-fetch-outside-http` applies to type positions.
 *
 * Companion to `local/no-fetch-outside-http`, and written from it.
 */

const path = require('path');

/** Only files under this folder are views; everything else is somebody else's rule. */
const SCREEN_FOLDER = 'src/screens/';

/** The three `.tsx` files in a screen folder that are not the view. */
const NOT_A_VIEW = /\.(?:container|test|stories)\.[cm]?[jt]sx?$/;

/** A view is a `.tsx`; a hook is a `.ts` and R-60 does not speak to it. */
const VIEW_EXTENSION = /\.[cm]?tsx$/;

/** The four layers a view may not know about. Longest-first is irrelevant; these do not nest. */
const DATA_LAYERS = ['src/api', 'src/store', 'src/domain', 'src/lib/http'];

const MESSAGE =
  'View thuần không được chạm tầng dữ liệu. Đưa việc này xuống `use<Name>.ts` rồi truyền kết quả vào view bằng props. (R-60)';

/**
 * Where a specifier lands, as a path from the repository root.
 *
 * `@/x` is the alias for `src/x`; a relative specifier is resolved against the
 * importing file and then cut back to its `src/…` tail, so the answer does not
 * depend on where the repository is checked out. A bare package name resolves
 * to `node_modules` and is nobody's layer, so it returns null.
 */
function repoPathOf(specifier, filename) {
  const normalized = String(specifier).replace(/\\/g, '/');

  if (normalized.startsWith('@/')) {
    return 'src/' + normalized.slice(2);
  }

  if (!normalized.startsWith('.')) {
    return null;
  }

  const absolute = path.resolve(path.dirname(filename), normalized).replace(/\\/g, '/');
  const index = absolute.lastIndexOf('/src/');

  return index === -1 ? null : absolute.slice(index + 1);
}

/** The forbidden layer this path is inside, or null. */
function forbiddenLayer(repoPath) {
  if (repoPath === null) {
    return null;
  }

  return DATA_LAYERS.find((layer) => repoPath === layer || repoPath.startsWith(layer + '/')) ?? null;
}

/**
 * Is this import erased before it can pull anything in?
 *
 * Two spellings mean the same thing: `import type { A } from …` marks the whole
 * declaration, and `import { type A } from …` marks each specifier. A
 * declaration with no specifiers at all is a side-effect import — it runs the
 * module for what it does, which is exactly the thing being refused.
 */
function isTypeOnly(node) {
  if (node.importKind === 'type' || node.exportKind === 'type') {
    return true;
  }

  const specifiers = node.specifiers;

  if (!Array.isArray(specifiers) || specifiers.length === 0) {
    return false;
  }

  return specifiers.every((specifier) => specifier.importKind === 'type' || specifier.exportKind === 'type');
}

module.exports = {
  meta: {
    type: 'problem',
    docs: {
      description:
        'Disallow importing src/api, src/store, src/domain or src/lib/http from a screen view (R-60)',
    },
    schema: [],
  },
  create(context) {
    const filename = context.getPhysicalFilename ? context.getPhysicalFilename() : context.getFilename();
    const normalizedFilename = String(filename).replace(/\\/g, '/');

    const isView =
      normalizedFilename.includes(SCREEN_FOLDER) &&
      VIEW_EXTENSION.test(normalizedFilename) &&
      !NOT_A_VIEW.test(normalizedFilename);

    if (!isView) {
      return {};
    }

    const report = (sourceNode) => {
      if (sourceNode === null || sourceNode === undefined || typeof sourceNode.value !== 'string') {
        return;
      }

      if (forbiddenLayer(repoPathOf(sourceNode.value, normalizedFilename)) !== null) {
        context.report({ node: sourceNode, message: MESSAGE });
      }
    };

    return {
      ImportDeclaration(node) {
        if (!isTypeOnly(node)) {
          report(node.source);
        }
      },
      ExportNamedDeclaration(node) {
        if (node.source !== null && node.source !== undefined && !isTypeOnly(node)) {
          report(node.source);
        }
      },
      ExportAllDeclaration(node) {
        if (!isTypeOnly(node)) {
          report(node.source);
        }
      },
      ImportExpression(node) {
        report(node.source);
      },
    };
  },
};
