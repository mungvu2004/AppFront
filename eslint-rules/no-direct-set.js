module.exports = {
  meta: {
    type: "problem",
    docs: {
      description: "Disallow calling set() or useStore.setState() directly in components",
    },
    schema: []
  },
  create(context) {
    return {
      CallExpression(node) {
        if (node.callee.type === 'Identifier' && node.callee.name === 'set') {
          context.report({
            node,
            message: "Cấm gọi trực tiếp set() của store trong component; mọi thay đổi đi qua commit(patch, label)."
          });
        }
        
        if (
          node.callee.type === 'MemberExpression' &&
          node.callee.property.type === 'Identifier' &&
          node.callee.property.name === 'setState'
        ) {
          context.report({
            node,
            message: "Cấm gọi trực tiếp setState() của store trong component; mọi thay đổi đi qua commit(patch, label)."
          });
        }
      }
    };
  }
};
