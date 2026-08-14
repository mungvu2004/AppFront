const FORBIDDEN_ACTIONS = new Set(['stageDraftOperation', 'amendDraftOperation', 'discardDraft']);

module.exports = {
  meta: {
    type: "problem",
    docs: {
      description: "Disallow writing to draftSlice outside the command layer (src/store)",
    },
    schema: []
  },
  create(context) {
    const filename = String(context.getFilename()).replace(/\\/g, '/');

    // The command layer — src/store, where commit() and the coordinators live —
    // is the only place allowed to drive the draft.
    if (filename.includes('/src/store/')) {
      return {};
    }

    return {
      CallExpression(node) {
        const callee = node.callee;
        const name =
          callee.type === 'Identifier'
            ? callee.name
            : callee.type === 'MemberExpression' && callee.property.type === 'Identifier'
              ? callee.property.name
              : null;

        if (name !== null && FORBIDDEN_ACTIONS.has(name)) {
          context.report({
            node,
            message: `Cấm ghi trực tiếp vào draftSlice từ ngoài tầng lệnh (src/store); không gọi ${name}() ở đây.`
          });
        }
      }
    };
  }
};
