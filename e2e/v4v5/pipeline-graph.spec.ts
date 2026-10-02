import { expect, test } from '@playwright/test';

import { ROUTES } from '../fixtures/routes';
import { signInAs } from '../fixtures/session';

import { FIRST_PAINT_TIMEOUT_MS, PROJECT_ID } from './files';

/**
 * Nhóm V5 — `projectPipelineGraph` (`docs/notes/e2e/plan.md` V5 mục 1).
 *
 * Nội dung là chữ tĩnh; thứ CHỈ phiên thật chứng minh là cổng vai: kỹ sư và người
 * xem không thấy chế độ chi tiết kỹ thuật, quản trị thì thấy trạng thái rỗng có
 * giải thích. Mọi nhánh có dữ liệu (`branchReport`, so sánh, đổi nhánh, chạy lại)
 * đều `supported: false` ở cổng thật — tầng đơn vị (21 bài) giữ chúng.
 *
 * `Sơ đồ xử lý` là tên của cả h1, nav và nhóm sơ đồ ⇒ luôn bám kèm `level`.
 */

const GRAPH = ROUTES.project.pipelineGraph(PROJECT_ID);
const FORBIDDEN_LINE =
  'Chế độ chi tiết kỹ thuật chỉ mở cho vai quản trị, nên phần đó và nút đổi nhánh không hiện ở đây.';
const NO_REPORT_REASON = 'Chưa có lượt xử lý nào, nên chưa biết hồ sơ đi nhánh nào.';
const MIXED_BRANCH_REASON =
  'Mỗi tầng đang đi một nhánh khác nhau, nên chưa có một câu trả lời chung cho cả hồ sơ.';

test('B-V5-03: chưa có báo cáo nhánh thì sơ đồ nói "chưa biết", không khẳng định "mỗi tầng một nhánh"', async ({
  page,
}) => {
  await page.goto(GRAPH);

  await expect(page.getByRole('heading', { level: 1, name: 'Sơ đồ xử lý' })).toBeVisible({
    timeout: FIRST_PAINT_TIMEOUT_MS,
  });
  await expect(page.getByText(NO_REPORT_REASON)).toBeVisible();
  await expect(page.getByText(MIXED_BRANCH_REASON)).toHaveCount(0);
});

for (const role of ['engineer', 'viewer'] as const) {
  test(`vai ${role} theo phiên thật không thấy chế độ chi tiết kỹ thuật, và được nói vì sao`, async ({
    page,
  }) => {
    await signInAs(page, role, GRAPH);

    await expect(page.getByText(FORBIDDEN_LINE)).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Chưa có lượt xử lý nào để kể lại' })).toHaveCount(
      0,
    );
  });
}

test('vai quản trị thấy trạng thái rỗng có giải thích, không thấy câu từ chối', async ({ page }) => {
  await signInAs(page, 'admin', GRAPH);

  await expect(page.getByRole('heading', { name: 'Chưa có lượt xử lý nào để kể lại' })).toBeVisible();
  await expect(page.getByText(FORBIDDEN_LINE)).toHaveCount(0);
});
