/**
 * Điểm vào của ESLint. Cố ý mỏng.
 *
 * Luật riêng của dự án — sáu rule nội bộ, ranh giới import, sổ nợ kỹ thuật —
 * nằm gọn trong `eslint-plugin-local`, đọc ở `eslint-rules/configs/project.js`.
 * File này chỉ ghép nó vào các preset ngoài. Muốn biết dự án cấm gì thì mở đúng
 * một file, không phải hai.
 *
 * Sửa `eslint-rules/**` xong phải chạy lại `pnpm install`: pnpm sao chép cứng
 * thư mục đó vào `node_modules/.pnpm/` chứ không symlink, nên bản cũ vẫn được
 * dùng cho tới khi cài lại (CLAUDE.md mục 0.3).
 */
module.exports = {
  root: true,
  env: { browser: true, es2020: true },
  extends: [
    'eslint:recommended',
    'plugin:@typescript-eslint/recommended',
    'plugin:react-hooks/recommended',
    'plugin:local/project',
  ],
  ignorePatterns: ['dist', 'coverage', '.eslintrc.cjs'],
  parser: '@typescript-eslint/parser',
  plugins: ['react-refresh', 'local', 'import'],
  rules: {
    'react-refresh/only-export-components': ['warn', { allowConstantExport: true }],
  },
};
