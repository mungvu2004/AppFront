/**
 * `framer-motion` được nhập ở đúng một chỗ: `src/components/motion`.
 *
 * Luật này tồn tại vì lỗ hổng nó chặn là chuyện THIẾU, và thứ thiếu thì không
 * hiện ra khi đọc diff. Trước khi có cửa duy nhất, 16 component nhập thẳng
 * `motion`/`AnimatePresence` từ `framer-motion`, mỗi file tự quyết có tôn trọng
 * `prefers-reduced-motion` hay không, và 11 file không hỏi. Người bật "giảm
 * chuyển động" vì hoạt ảnh làm họ chóng mặt vẫn nhận đủ hoạt ảnh từ 11 chỗ đó.
 *
 * Với `src/components/motion` là cửa duy nhất, `MotionProvider` đặt
 * `reducedMotion="user"` một lần cho toàn ứng dụng, và luật này giữ cho không ai
 * đi vòng qua cửa — kể cả vô tình, bằng một dòng import mà trình soạn thảo tự
 * thêm vào.
 *
 * ĐƯỢC MIỄN TRỪ, theo đường dẫn chứ không theo lời hứa:
 *
 * - `src/components/motion/**` — chính cái cửa.
 * - Test và story. Một story dựng cảnh hoạt ảnh hoặc một test cần
 *   `MotionGlobalConfig` là luật đang chạy đúng, không phải ai đó lách luật.
 *
 * Vì sao KHÔNG phải `src/lib/motion`: `framer-motion` nhập React, mà `src/lib/**`
 * tuyệt đối không được import React (CLAUDE.md mục 0.4). `src/lib/motion` vẫn là
 * nguồn của thang thời lượng và đường cong; nó không được biết tới React.
 */

/** Tên gói bị chặn, và mọi đường dẫn con của nó. */
const FORBIDDEN_SOURCE = /^framer-motion(?:\/|$)/;

/** Cửa duy nhất. */
const MOTION_GATE = 'src/components/motion';

/** Test và story dựng cảnh hoạt ảnh là việc bình thường của chúng. */
const TEST_FILE = /(?:^|\/)__tests__\/|\.test\.[cm]?[jt]sx?$|\.stories\.[cm]?[jt]sx?$/;

const MESSAGE =
  "Cấm nhập 'framer-motion' trực tiếp; nhập từ '@/components/motion' để hoạt ảnh " +
  'tôn trọng thiết lập giảm chuyển động của hệ điều hành (R-39).';

module.exports = {
  meta: {
    type: 'problem',
    docs: {
      description:
        'Disallow importing framer-motion outside src/components/motion, so reduced-motion is honoured in one place',
    },
    schema: [],
  },
  create(context) {
    const filename = context.getPhysicalFilename
      ? context.getPhysicalFilename()
      : context.getFilename();
    const normalized = String(filename).replace(/\\/g, '/');

    if (normalized.includes(MOTION_GATE) || TEST_FILE.test(normalized)) {
      return {};
    }

    /** Báo cho mọi cách viết một import: tĩnh, `export … from`, và `import()`. */
    const reportIfForbidden = (node, rawSource) => {
      if (typeof rawSource === 'string' && FORBIDDEN_SOURCE.test(rawSource)) {
        context.report({ node, message: MESSAGE });
      }
    };

    return {
      ImportDeclaration(node) {
        reportIfForbidden(node, node.source.value);
      },
      ExportNamedDeclaration(node) {
        if (node.source) {
          reportIfForbidden(node, node.source.value);
        }
      },
      ExportAllDeclaration(node) {
        if (node.source) {
          reportIfForbidden(node, node.source.value);
        }
      },
      // `await import('framer-motion')` và `require('framer-motion')`.
      'ImportExpression, CallExpression'(node) {
        const isDynamicImport = node.type === 'ImportExpression';
        const isRequire =
          node.type === 'CallExpression' &&
          node.callee.type === 'Identifier' &&
          node.callee.name === 'require';

        if (!isDynamicImport && !isRequire) {
          return;
        }

        const argument = isDynamicImport ? node.source : node.arguments[0];

        if (argument !== undefined && argument !== null && argument.type === 'Literal') {
          reportIfForbidden(node, argument.value);
        }
      },
    };
  },
};
