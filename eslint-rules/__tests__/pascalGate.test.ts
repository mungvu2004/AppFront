/**
 * Cổng nhập gói Pascal (Bước 8.1) — kiểm **cấu hình đang chạy**, không kiểm ý định.
 *
 * Khác ba file cạnh nó: chúng kiểm một luật nội bộ bằng `RuleTester`, còn đây
 * không có luật nội bộ nào để kiểm. Cổng này dựng từ `overrides` của
 * `@typescript-eslint/no-restricted-imports`, nên thứ duy nhất chứng minh được
 * nó chạy là **gọi chính ESLint** với đúng cấu hình của repo.
 *
 * Hệ quả cố ý: file này đọc bản `eslint-plugin-local` đã **cài** trong
 * `node_modules`, không đọc `eslint-rules/` trên đĩa (pnpm sao chép cứng thư mục
 * đó — CLAUDE.md, bẫy số 1). Sửa cấu hình mà quên `pnpm install` thì bài kiểm
 * này đỏ, và đó đúng là cái bẫy nó tồn tại để bắt.
 */

import { ESLint } from 'eslint';
import { beforeAll, describe, expect, it } from 'vitest';

const GATE_RULE = '@typescript-eslint/no-restricted-imports';

const TYPE_ONLY_MESSAGE =
  'src/lib/pascal chỉ được `import type` từ gói Pascal — tầng thuần không được kéo mã Pascal vào bao đóng của nó.';
const HOST_ONLY_MESSAGE =
  'Chỉ src/components/pascal được nhập gói Pascal. Tầng khác đi qua src/lib/pascal, và chính nó chỉ được import type.';

let eslint: ESLint;

/**
 * Lỗi của riêng cổng này; các luật khác (biến không dùng…) không tính.
 *
 * ESLint dán sẵn một câu của chính nó trước lời nhắn tuỳ biến — `"'X' import is
 * restricted from being used by a pattern. …"` — nên phép so là `toContain`
 * chứ không phải so cả chuỗi. So cả chuỗi là buộc bài kiểm vào chữ của ESLint,
 * và một lượt nâng phiên bản sẽ làm nó đỏ mà cổng vẫn chạy đúng.
 */
const gateErrorsIn = async (filePath: string, code: string): Promise<readonly string[]> => {
  const [result] = await eslint.lintText(code, { filePath, warnIgnored: false });

  return (result?.messages ?? [])
    .filter((message) => message.ruleId === GATE_RULE)
    .map((message) => message.message);
};

describe('cổng nhập gói Pascal', () => {
  beforeAll(() => {
    eslint = new ESLint({ cwd: process.cwd() });
  });

  it('cho src/lib/pascal nhập KIỂU của gói Pascal', async () => {
    const errors = await gateErrorsIn(
      'src/lib/pascal/probe.ts',
      "import type { AnyNode } from '@pascal-app/core';\n\nexport type Node = AnyNode;\n",
    );

    expect(errors).toEqual([]);
  });

  it('chặn src/lib/pascal nhập MÃ của gói Pascal', async () => {
    const errors = await gateErrorsIn(
      'src/lib/pascal/probe.ts',
      "import { WallNode } from '@pascal-app/core';\n\nexport const schema = WallNode;\n",
    );

    expect(errors).toHaveLength(1);
    expect(errors[0]).toContain(TYPE_ONLY_MESSAGE);
  });

  it('cho src/components/pascal nhập mã Pascal — đây là thư mục duy nhất được', async () => {
    const errors = await gateErrorsIn(
      'src/components/pascal/PascalHost.tsx',
      "import { mount } from '@pascal-app/editor';\n\nexport const host = mount;\n",
    );

    expect(errors).toEqual([]);
  });

  it('chặn tầng khác nhập gói Pascal, kể cả chỉ nhập kiểu', async () => {
    const value = await gateErrorsIn(
      'src/hooks/usePascalScene.ts',
      "import { mount } from '@pascal-app/editor';\n\nexport const m = mount;\n",
    );
    const type = await gateErrorsIn(
      'src/store/pascalSlice.ts',
      "import type { AnyNode } from '@pascal-app/core';\n\nexport type N = AnyNode;\n",
    );

    expect(value).toHaveLength(1);
    expect(value[0]).toContain(HOST_ONLY_MESSAGE);
    expect(type).toHaveLength(1);
    expect(type[0]).toContain(HOST_ONLY_MESSAGE);
  });

  it('chặn đường vòng qua một barrel tái xuất — chặn ngay ở file tái xuất', async () => {
    const errors = await gateErrorsIn(
      'src/lib/pascalBarrel.ts',
      "export { mount } from '@pascal-app/editor';\n",
    );

    expect(errors).toHaveLength(1);
    expect(errors[0]).toContain(HOST_ONLY_MESSAGE);
  });

  it('chặn cả lượt nhập gói trần, không chỉ nhập gói con', async () => {
    const errors = await gateErrorsIn(
      'src/screens/project/PascalScreen.tsx',
      "import { thing } from '@pascal-app';\n\nexport const t = thing;\n",
    );

    expect(errors).toHaveLength(1);
    expect(errors[0]).toContain(HOST_ONLY_MESSAGE);
  });

  it('không đụng tới lượt nhập gói khác', async () => {
    const errors = await gateErrorsIn(
      'src/lib/pascal/probe.ts',
      "import { z } from 'zod';\n\nexport const s = z.string();\n",
    );

    expect(errors).toEqual([]);
  });
});
