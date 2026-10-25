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
 * H1 giờ là "Bản vẽ được xử lý theo đường nào"; "Sơ đồ xử lý" còn ở breadcrumb và nhóm sơ đồ.
 */

const GRAPH = ROUTES.project.pipelineGraph(PROJECT_ID);
const FORBIDDEN_LINE =
  'Chế độ chi tiết kỹ thuật chỉ mở cho vai quản trị, nên phần đó và nút đổi nhánh không hiện ở đây.';
// G3-29: sơ đồ đọc lượt mới nhất (N7b); bộ mẫu `project-1` có lượt (`MOCK_PIPELINE_RUNS`) mà
// chưa có báo cáo nhánh. Từ đợt làm lại cụm 3, màn suy nhánh từ các bước của lượt ấy
// (`reasonInferredFromRun`) và nói rõ là suy từ lượt, thay cho câu "chưa báo nhánh nào".
const INFERRED_REASON =
  'Lượt xử lý gần nhất chạy các bước nhận dạng trên ảnh bản vẽ, nên hồ sơ đi nhánh ảnh quét.';
const MIXED_BRANCH_REASON =
  'Mỗi tầng đang đi một nhánh khác nhau, nên chưa có một câu trả lời chung cho cả hồ sơ.';

test('B-V5-03: chưa có báo cáo nhánh thì sơ đồ nói nhánh suy từ lượt gần nhất, không khẳng định "mỗi tầng một nhánh"', async ({
  page,
}) => {
  await page.goto(GRAPH);

  await expect(page.getByRole('heading', { level: 1, name: 'Bản vẽ được xử lý theo đường nào' })).toBeVisible({
    timeout: FIRST_PAINT_TIMEOUT_MS,
  });
  await expect(page.getByText(INFERRED_REASON)).toBeVisible();
  await expect(page.getByText(MIXED_BRANCH_REASON)).toHaveCount(0);
});

// Q1 (QA-09, b044f882): kỹ sư được mở chế độ chi tiết; chỉ người xem bị từ chối.
test('vai engineer theo phiên thật thấy lối mở chế độ chi tiết kỹ thuật, không thấy câu từ chối', async ({
  page,
}) => {
  await signInAs(page, 'engineer', GRAPH);

  await expect(page.getByRole('button', { name: 'Chi tiết kỹ thuật', exact: true })).toBeVisible();
  await expect(page.getByText(FORBIDDEN_LINE)).toHaveCount(0);
});

for (const role of ['viewer'] as const) {
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

// G3-29: `project-1` của bộ mẫu đã có lượt xử lý nên không còn trạng thái rỗng (tầng đơn vị giữ ca rỗng);
// quản trị thấy lối mở chế độ chi tiết kỹ thuật thay cho câu từ chối.
test('vai quản trị thấy lối mở chế độ chi tiết kỹ thuật, không thấy câu từ chối', async ({ page }) => {
  await signInAs(page, 'admin', GRAPH);

  await expect(page.getByRole('button', { name: 'Chi tiết kỹ thuật', exact: true })).toBeVisible();
  await expect(page.getByText(FORBIDDEN_LINE)).toHaveCount(0);
});
