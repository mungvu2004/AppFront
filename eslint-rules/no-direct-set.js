/**
 * Store writes go through `commit(patch, label)`, everywhere except the store.
 *
 * Invariant A10, and the reason it exists is invariant A8: every change is
 * undoable. `commit()` is what records the patch and the label the undo toast
 * shows; a write that goes straight to `set()` or `setState()` changes the data
 * and leaves the history behind, so the toast offers to undo something the
 * store has no record of. That is not a style preference, it is the difference
 * between an undo button that works and one that lies.
 *
 * ## Where it applies: everywhere, and that is deliberate
 *
 * Unlike `no-raw-color` and `no-raw-number`, which watch only `src/components`
 * and `src/screens`, this rule has no path scope in its own source. The two
 * exemptions are declared in `.eslintrc.cjs` instead, where they can be read
 * next to each other:
 *
 * - `src/store/**` — the slices are what `commit()` is built out of. They have
 *   to call `set()`; that is the whole job.
 * - `src/lib/testing/**` — the harness screens are tested through. Putting a
 *   store back to its initial state between two renders is the one write that
 *   must *not* land in the undo history, which is exactly what `commit()` would
 *   do with it.
 *
 * Everything else is covered on purpose. A hook that writes to the store behind
 * `commit()`'s back breaks A8 precisely as thoroughly as a component does, and
 * the message used to say "trong component" while the rule fired repo-wide —
 * which read as a false positive rather than as the rule working.
 *
 * ## Two known over-reaches, both harmless
 *
 * The check is syntactic: any call to a bare `set(...)`, and any call to
 * `something.setState(...)`. So a local helper genuinely named `set`, or a React
 * class component's `this.setState`, is reported too. Neither shape appears in
 * this codebase — there are no class components, and `src/lib/utils.ts` owns the
 * small helpers — and widening the rule to *understand* which object is a store
 * would mean type information ESLint does not have here. If one ever turns up,
 * a disable comment with a sentence explaining it is the right answer.
 */

/** Both messages end the same way, because there is only one right answer. */
const REMEDY = 'mọi thay đổi đi qua commit(patch, label).';

module.exports = {
  meta: {
    type: 'problem',
    docs: {
      description:
        'Disallow calling set() or store.setState() outside src/store; every change goes through commit()',
    },
    schema: [],
  },
  create(context) {
    return {
      CallExpression(node) {
        if (node.callee.type === 'Identifier' && node.callee.name === 'set') {
          context.report({
            node,
            message: `Cấm gọi trực tiếp set() của store ngoài src/store; ${REMEDY}`,
          });
        }

        if (
          node.callee.type === 'MemberExpression' &&
          node.callee.property.type === 'Identifier' &&
          node.callee.property.name === 'setState'
        ) {
          context.report({
            node,
            message: `Cấm gọi trực tiếp setState() của store ngoài src/store; ${REMEDY}`,
          });
        }
      },
    };
  },
};
