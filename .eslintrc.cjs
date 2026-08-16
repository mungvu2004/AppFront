module.exports = {
  root: true,
  env: { browser: true, es2020: true },
  extends: [
    'eslint:recommended',
    'plugin:@typescript-eslint/recommended',
    'plugin:react-hooks/recommended',
  ],
  ignorePatterns: ['dist', '.eslintrc.cjs'],
  parser: '@typescript-eslint/parser',
  plugins: ['react-refresh', 'local', 'import'],
  rules: {
    'react-refresh/only-export-components': [
      'warn',
      { allowConstantExport: true },
    ],
    'local/no-raw-color': 'error',
    'local/no-raw-number': 'error',
    'local/no-raw-duration': 'error',
    'local/no-direct-set': 'error',
    'local/no-draft-write-outside-commands': 'error'
  },
  overrides: [
    {
      // Nợ kỹ thuật có sẵn từ trước khi local/no-raw-number ra đời. Danh sách này
      // chỉ được ngắn đi: chuyển màn hình sang ViewModel của src/lib/viewmodel rồi
      // xoá dòng tương ứng. Cấm thêm file mới vào đây.
      files: [
        'src/components/shell/StatusBar.tsx',
        'src/components/ui/ConfidenceMeter.tsx',
        'src/components/ui/Slider.tsx',
        'src/screens/ListReviewDemo.tsx'
      ],
      rules: {
        'local/no-raw-number': 'off'
      }
    },
    {
      files: ['src/components/**/*'],
      rules: {
        'no-restricted-imports': ['error', {
          patterns: [{ group: ['**/screens/*', '**/screens'], message: 'components KHÔNG được import screens.' }]
        }]
      }
    },
    {
      files: ['src/hooks/**/*'],
      rules: {
        'no-restricted-imports': ['error', {
          patterns: [
            { group: ['**/components/*', '**/components'], message: 'hooks KHÔNG được import components.' },
            { group: ['**/screens/*', '**/screens'], message: 'hooks KHÔNG được import screens.' }
          ]
        }]
      }
    },
    {
      files: ['src/store/**/*'],
      rules: {
        'local/no-direct-set': 'off',
        'no-restricted-imports': ['error', {
          patterns: [
            { group: ['**/hooks/*', '**/hooks'], message: 'store KHÔNG được import hooks.' },
            { group: ['**/components/*', '**/components'], message: 'store KHÔNG được import components.' },
            { group: ['**/screens/*', '**/screens'], message: 'store KHÔNG được import screens.' }
          ]
        }]
      }
    },
    {
      files: ['src/lib/**/*'],
      rules: {
        'no-restricted-imports': ['error', {
          patterns: [
            { group: ['react', 'react-dom'], message: 'lib TUYỆT ĐỐI không import React.' },
            { group: ['**/store/*', '**/store'], message: 'lib KHÔNG được import store.' },
            { group: ['**/hooks/*', '**/hooks'], message: 'lib KHÔNG được import hooks.' },
            { group: ['**/components/*', '**/components'], message: 'lib KHÔNG được import components.' },
            { group: ['**/screens/*', '**/screens'], message: 'lib KHÔNG được import screens.' }
          ]
        }]
      }
    },
    {
      files: ['src/types/**/*'],
      rules: {
        'no-restricted-imports': ['error', {
          patterns: [
            { group: ['**/lib/*', '**/lib'], message: 'types không import gì bên ngoài.' },
            { group: ['**/store/*', '**/store'], message: 'types không import gì bên ngoài.' },
            { group: ['**/hooks/*', '**/hooks'], message: 'types không import gì bên ngoài.' },
            { group: ['**/components/*', '**/components'], message: 'types không import gì bên ngoài.' },
            { group: ['**/screens/*', '**/screens'], message: 'types không import gì bên ngoài.' }
          ]
        }]
      }
    }
  ]
}
