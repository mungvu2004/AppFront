module.exports = {
  meta: {
    type: "problem",
    docs: {
      description: "Disallow raw colors (hex/rgb/hsl) in components and screens",
    },
    schema: []
  },
  create(context) {
    const filename = context.getPhysicalFilename ? context.getPhysicalFilename() : context.getFilename();
    const normalizedFilename = filename.replace(/\\/g, '/');
    if (!normalizedFilename.includes('src/components') && !normalizedFilename.includes('src/screens')) {
      return {};
    }

    const regex = /(#([0-9a-fA-F]{3}){1,2}\b)|(rgb|hsl)a?\(/;

    return {
      Literal(node) {
        if (typeof node.value === 'string' && regex.test(node.value)) {
          context.report({
            node,
            message: "Cấm hex/rgb/hsl trong src/components và src/screens. Sử dụng token thay thế."
          });
        }
      },
      TemplateElement(node) {
        if (typeof node.value.raw === 'string' && regex.test(node.value.raw)) {
          context.report({
            node,
            message: "Cấm hex/rgb/hsl trong src/components và src/screens. Sử dụng token thay thế."
          });
        }
      },
      JSXText(node) {
        if (typeof node.value === 'string' && regex.test(node.value)) {
          context.report({
            node,
            message: "Cấm hex/rgb/hsl trong src/components và src/screens. Sử dụng token thay thế."
          });
        }
      }
    };
  }
};
