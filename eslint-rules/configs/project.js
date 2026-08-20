/**
 * Bộ luật của dự án — một chỗ duy nhất.
 *
 * Trước file này, luật riêng của repo nằm rải: tên rule khai trong `.eslintrc.cjs`,
 * ranh giới import khai lại theo từng thư mục, danh sách nợ kỹ thuật lẫn giữa hai
 * thứ đó. Sửa một bất biến phải nhớ sửa mấy chỗ, và không chỗ nào trả lời được câu
 * "luật của dự án gồm những gì".
 *
 * Giờ có: `.eslintrc.cjs` chỉ `extends: ['plugin:local/project']`, còn toàn bộ nội
 * dung nằm ở đây, chia làm ba tầng, đọc từ trên xuống:
 *
 *   1. LUẬT — sáu rule nội bộ ép các bất biến của CLAUDE.md mục A/B.
 *   2. RANH GIỚI — ai được import ai (CLAUDE.md mục 0.4).
 *   3. SỔ NỢ — file cũ tạm được miễn, mỗi mục có lý do và cách trả nợ.
 *
 * Sổ nợ chỉ được ngắn đi. Thêm một dòng vào đó là quyết định của người duyệt,
 * không phải của người đang vội.
 *
 * LƯU Ý VẬN HÀNH: pnpm sao chép cứng `eslint-rules/` vào `node_modules/.pnpm/`
 * (khai bằng `file:eslint-rules`), không symlink. Sửa file này xong phải chạy lại
 * `pnpm install`, nếu không ESLint vẫn đọc bản cũ — xem CLAUDE.md mục 0.3.
 */

/** Thông điệp ranh giới, viết một lần để sáu override không lệch chữ nhau. */
const FORBIDS = {
  react: 'lib TUYỆT ĐỐI không import React.',
  store: 'Tầng này KHÔNG được import store.',
  hooks: 'Tầng này KHÔNG được import hooks.',
  components: 'Tầng này KHÔNG được import components.',
  screens: 'Tầng này KHÔNG được import screens.',
};

/** `no-restricted-imports` cho một tầng, dựng từ danh sách tầng bị cấm. */
const forbidLayers = (layers) => ({
  'no-restricted-imports': [
    'error',
    {
      patterns: layers.map((layer) => ({
        group: ['**/' + layer + '/*', '**/' + layer],
        message: FORBIDS[layer],
      })),
    },
  ],
});

module.exports = {
  plugins: ['local'],

  // -- 1. LUẬT ---------------------------------------------------------------
  // Sáu rule, mỗi rule ép một bất biến, tất cả ở mức 'error'. Không rule nào ở
  // mức 'warn': `pnpm lint` chạy với `--max-warnings 0`, nên 'warn' chỉ là
  // 'error' viết vòng, mà viết vòng thì người đọc tưởng nó không quan trọng.
  rules: {
    // A1 + mục B: màu lấy từ token, không hex/rgb/hsl trong tầng giao diện.
    'local/no-raw-color': 'error',

    // A15 + mục D: định dạng số (toFixed, toLocaleString) và quy đổi đơn vị
    // không xảy ra trong tầng giao diện; view nhận chuỗi đã xong từ viewmodel.
    'local/no-raw-number': 'error',

    // Mục B: thời lượng animation chỉ 120/180/260/340/700 ms.
    'local/no-raw-duration': 'error',

    // A10: không gọi set() của store trong component; đi qua commit(patch, label).
    'local/no-direct-set': 'error',

    // A10: draftSlice chỉ được ghi từ tầng lệnh trong src/store.
    'local/no-draft-write-outside-commands': 'error',

    // Mọi truy cập mạng đi qua src/lib/http — nơi duy nhất có timeout, retry,
    // single-flight và hình dạng lỗi mà phần còn lại của ứng dụng đọc được.
    'local/no-fetch-outside-http': 'error',
  },

  overrides: [
    // -- 2. RANH GIỚI IMPORT (CLAUDE.md mục 0.4) -----------------------------
    {
      files: ['src/components/**/*'],
      rules: forbidLayers(['screens']),
    },
    {
      files: ['src/hooks/**/*'],
      rules: forbidLayers(['components', 'screens']),
    },
    {
      files: ['src/store/**/*'],
      rules: {
        // Tầng lệnh chính là nơi được phép gọi set(); cấm ở đây thì không còn
        // chỗ nào cài đặt được commit().
        'local/no-direct-set': 'off',
        ...forbidLayers(['hooks', 'components', 'screens']),
      },
    },
    {
      files: ['src/lib/**/*'],
      rules: {
        'no-restricted-imports': [
          'error',
          {
            patterns: [
              { group: ['react', 'react-dom'], message: FORBIDS.react },
              { group: ['**/store/*', '**/store'], message: FORBIDS.store },
              { group: ['**/hooks/*', '**/hooks'], message: FORBIDS.hooks },
              { group: ['**/components/*', '**/components'], message: FORBIDS.components },
              { group: ['**/screens/*', '**/screens'], message: FORBIDS.screens },
            ],
          },
        ],
      },
    },
    {
      // `src/lib/testing/**` là bộ kiểm mà màn hình được test qua, nên nó phải
      // dựng được một cây React. Lệnh cấm React KHÔNG được nới: `react` và
      // `react-dom` vẫn bị chặn, chỉ chặn đích danh theo tên thay vì theo mẫu —
      // vì mẫu `react` là gitignore-style nên nó bắt luôn đoạn cuối của
      // `@testing-library/react`, thứ duy nhất mục này cần cho qua. Ranh giới
      // thật sự — lib không được biết tới store, hooks, components, screens —
      // giữ nguyên từng dòng.
      files: ['src/lib/testing/**/*'],
      rules: {
        // Đưa store về trạng thái ban đầu giữa hai lần render là thao tác ghi
        // duy nhất KHÔNG được vào lịch sử hoàn tác — đúng thứ commit() sẽ làm
        // nếu đi qua nó. Ngoài thư mục harness này, A10 vẫn có hiệu lực khắp nơi.
        'local/no-direct-set': 'off',
        'no-restricted-imports': [
          'error',
          {
            paths: [
              { name: 'react', message: FORBIDS.react },
              { name: 'react-dom', message: FORBIDS.react },
            ],
            patterns: [
              { group: ['react/*', 'react-dom', 'react-dom/*'], message: FORBIDS.react },
              { group: ['**/store/*', '**/store'], message: FORBIDS.store },
              { group: ['**/hooks/*', '**/hooks'], message: FORBIDS.hooks },
              { group: ['**/components/*', '**/components'], message: FORBIDS.components },
              { group: ['**/screens/*', '**/screens'], message: FORBIDS.screens },
            ],
          },
        ],
      },
    },
    {
      files: ['src/types/**/*'],
      rules: {
        'no-restricted-imports': [
          'error',
          {
            patterns: ['lib', 'store', 'hooks', 'components', 'screens'].map((layer) => ({
              group: ['**/' + layer + '/*', '**/' + layer],
              message: 'types không import gì bên ngoài.',
            })),
          },
        ],
      },
    },

    // -- R-13: kiểu trả về, chỉ ở hai tầng nó mang thông tin ------------------
    // `src/lib` và `src/domain` là tầng thuần: hàm ở đây trả dữ liệu nghiệp vụ,
    // và kiểu suy ra được thì đổi lặng lẽ khi thân hàm đổi — lỗi hiện ở chỗ gọi
    // chứ không ở chỗ sửa. Tầng giao diện KHÔNG bật: hàm component trả
    // `JSX.Element`, khai ra thêm rất ít thông tin mà thêm nhiều nhiễu.
    //
    // Bỏ test ra ngoài: một `it()` không phải ranh giới module của ai cả.
    //
    // Mức 'error' ngay chứ không qua 'warn': `pnpm lint` chạy với
    // `--max-warnings 0` nên 'warn' chỉ là 'error' viết vòng, và ở phạm vi này
    // repo chỉ còn đúng MỘT vi phạm, đã sửa cùng lượt.
    {
      files: ['src/lib/**/*.ts', 'src/domain/**/*.ts'],
      excludedFiles: ['**/__tests__/**', '**/*.test.ts'],
      rules: {
        '@typescript-eslint/explicit-module-boundary-types': 'error',
      },
    },

    // -- 3. SỔ NỢ --------------------------------------------------------------
    // Mỗi mục dưới đây là một luật ĐANG bật cho toàn repo, tạm tắt trên đúng
    // những file có sẵn từ trước khi luật ra đời. Không mục nào được dài thêm.
    {
      // Nợ kỹ thuật có sẵn từ trước khi local/no-raw-number ra đời. Danh sách này
      // chỉ được ngắn đi: chuyển màn hình sang ViewModel của src/lib/viewmodel rồi
      // xoá dòng tương ứng. Cấm thêm file mới vào đây.
      files: [
        'src/components/shell/StatusBar.tsx',
        'src/components/ui/ConfidenceMeter.tsx',
        'src/components/ui/Slider.tsx',
        'src/screens/ListReviewDemo.tsx',
      ],
      rules: {
        'local/no-raw-number': 'off',
      },
    },
    // Sổ nợ của `local/no-fetch-outside-http` đã TRẢ HẾT và bị xoá.
    //
    // Ba adapter — auth/session, offline/networkMonitor, telemetry/sender — từng
    // tự với tay lên `globalThis.fetch` và `navigator.sendBeacon`. Giờ chúng nhận
    // transport từ `src/lib/http/platform.ts`, nên luật chạy khắp `src/**` mà
    // không phải miễn trừ cho file nào. Đừng dựng lại mục này: chỗ tra cứu
    // transport đã có sẵn, dùng nó.
  ],
};
