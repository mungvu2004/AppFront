/**
 * Luồng CAD chính trên BẢN VẼ CĂN HỘ THẬT và ML thật (ONNX), theo bố cục Duyệt tầng L23:
 * tải bản vẽ → pipeline → đặt tỷ lệ nếu máy không đọc được → duyệt một đoạn tường (tự lưu)
 * → cửa và nội thất → phòng → 3D có tường. Không mock; mỗi bản vẽ là một test riêng.
 *
 * `E2E_REAL_PLANS`: danh sách đường tới ảnh bản vẽ, ngăn bằng `;`. Trống thì bỏ qua cả tệp.
 * Chạy cùng điều kiện với `chain.fullstack.ts` (README cùng thư mục).
 */
import { basename } from 'node:path';

import { expect, test } from '@playwright/test';
import type { Page } from '@playwright/test';

import { ROUTES, editor3dHref } from '@/routes/paths';

import { EMAIL_LABEL, PASSWORD_LABEL, SIGN_IN_LABEL } from '../fixtures/session';
import { dismissTour } from '../fixtures/tour';
import { expectNoApiErrors, waitForApi, watchApi } from './apiWatch';
import { PASCAL_RENDER_TIMEOUT_MS, PIPELINE_TIMEOUT_MS, readFullstackEnv } from './env';

const PLANS = (process.env.E2E_REAL_PLANS ?? '').split(';').map((item) => item.trim()).filter(Boolean);
/** Chiều dài giả định của đường tham chiếu: bài này kiểm luồng chạy, không kiểm độ đúng tỷ lệ. */
const REFERENCE_LENGTH_MM = '8000';
const SCALE_MISSING = 'Chưa có tỷ lệ';

const idOf = (body: unknown): string => {
  const id = (body as { id?: unknown } | null)?.id;

  if (typeof id !== 'string' || id === '') throw new Error('thân không có "id"');
  return id;
};

async function login(page: Page): Promise<void> {
  const env = readFullstackEnv();

  await page.goto(ROUTES.login);
  await page.getByLabel(EMAIL_LABEL, { exact: true }).fill(env.adminEmail);
  await page.getByLabel(PASSWORD_LABEL, { exact: true }).fill(env.adminPassword);
  await page.getByRole('button', { name: SIGN_IN_LABEL, exact: true }).click();
  await expect.poll(() => new URL(page.url()).pathname).toBe(ROUTES.dashboard);
}

async function createProject(page: Page, name: string): Promise<string> {
  await page.getByRole('button', { name: /^Tạo dự án$/u }).click();
  const dialog = page.getByRole('dialog');

  await dialog.getByLabel('Tên dự án').fill(name);
  await dialog.getByRole('button', { name: /^Tiếp: /u }).click();
  await dialog.getByLabel('Chiều cao áp cho mọi tầng').fill('3');
  await dialog.getByRole('button', { name: 'Áp cho mọi tầng', exact: true }).click();
  await dialog.getByRole('button', { name: /^Tiếp: /u }).click();
  const created = waitForApi(page, 'POST', /^\/api\/projects$/u, [200, 201]);

  await dialog.getByRole('button', { name: 'Tạo dự án', exact: true }).click();
  return idOf((await created).json);
}

async function addFloor(page: Page, projectId: string): Promise<{ id: string; name: string }> {
  await page.goto(ROUTES.project.floors(projectId));
  const created = waitForApi(page, 'POST', new RegExp(`^/api/projects/${projectId}/floors$`, 'u'), [200, 201]);

  await page.getByRole('button', { name: 'Thêm tầng', exact: true }).click();
  const body = (await created).json as { name?: unknown };

  return { id: idOf(body), name: String(body.name) };
}

async function upload(page: Page, projectId: string, floor: { id: string; name: string }, file: string): Promise<void> {
  await page.goto(ROUTES.project.upload(projectId));
  const complete = waitForApi(page, 'POST', /\/drawings\/uploads\/[^/]+\/complete$/u, [200]);

  await page.getByTestId('floor-upload-file-input').setInputFiles(file);
  await page.getByRole('combobox', { name: 'Gán cho tầng', exact: true }).click();
  await page.getByRole('option', { name: floor.name, exact: true }).click();
  // PDF nhiều trang: màn đòi chọn trang trước khi tải. Bản vẽ thử để mặt bằng ở trang cuối (sau bìa).
  const pagePicker = page.getByRole('combobox', { name: 'Chọn trang', exact: true });

  if (await pagePicker.waitFor({ timeout: 3_000 }).then(() => true, () => false)) {
    await pagePicker.click();
    await page.getByRole('option').last().click();
  }
  await complete;
}

async function waitPipeline(page: Page, projectId: string): Promise<void> {
  await page.goto(ROUTES.project.pipeline(projectId));
  const done = page.getByText(/^Đã (?:xử lý )?xong ([1-9]\d*)\/\1 tầng/u);
  const failure = page.getByRole('button', { name: 'Sao chép mã lỗi' });

  await expect(done.or(failure).first()).toBeVisible({ timeout: PIPELINE_TIMEOUT_MS });
  if (await failure.isVisible()) {
    const code = /\b[A-Z][A-Z0-9_]{2,}\b/u.exec(await page.locator('body').innerText());

    throw new Error(`pipeline hỏng: ${code?.[0] ?? '(không đọc được mã)'}`);
  }
}

/** Máy không đọc được tỷ lệ thì đặt tay bằng đường tham chiếu, như người dùng làm. */
async function ensureScale(page: Page, projectId: string, floorId: string): Promise<boolean> {
  await page.goto(ROUTES.project.walls(projectId, floorId));
  await dismissTour(page, { waitMs: 3_000 });
  if ((await page.getByText(SCALE_MISSING, { exact: true }).count()) === 0) return false;

  await page.goto(ROUTES.project.scale(projectId, floorId));
  const canvas = page.getByRole('group', { name: 'Bản vẽ đã nắn, kéo để vẽ đường tham chiếu', exact: true });

  await expect(canvas.locator('img')).toHaveJSProperty('complete', true, { timeout: 45_000 });
  await dismissTour(page, { waitMs: 3_000 });
  const methods = page.getByRole('radiogroup', { name: 'Chọn cách xác định tỷ lệ', exact: true });
  const reference = methods.getByRole('radio', { name: 'Vẽ đường tham chiếu', exact: true });

  if ((await reference.count()) > 0 && !(await reference.isChecked())) await reference.click();
  const box = await canvas.boundingBox();

  if (box === null) throw new Error('khung tỷ lệ không có kích thước');
  await page.mouse.move(box.x + box.width * 0.2, box.y + box.height * 0.5);
  await page.mouse.down();
  await page.mouse.move(box.x + box.width * 0.8, box.y + box.height * 0.5, { steps: 8 });
  await page.mouse.up();
  await page.getByLabel('Chiều dài thật', { exact: true }).fill(REFERENCE_LENGTH_MM);
  await page.getByRole('button', { name: 'Xác nhận tỷ lệ', exact: true }).click();
  await expect(
    page.getByRole('region', { name: 'Trạng thái của màn hiệu chỉnh tỷ lệ', exact: true }).getByText('Đã áp tỷ lệ cho bản vẽ', {
      exact: true,
    }),
  ).toBeVisible();
  return true;
}

async function reviewOneWall(page: Page, projectId: string, floorId: string): Promise<void> {
  const layer = new RegExp(`^/api/projects/${projectId}/floors/${floorId}/spatial/layer$`, 'u');
  const read = waitForApi(page, 'GET', layer, [200]);

  await page.goto(ROUTES.project.walls(projectId, floorId));
  const walls = ((await read).json as { layer?: { walls?: unknown[] } }).layer?.walls ?? [];

  expect(walls.length, 'máy không tìm ra tường nào').toBeGreaterThan(0);
  await dismissTour(page, { waitMs: 3_000 });
  await expect(page.getByText(SCALE_MISSING, { exact: true })).toHaveCount(0);
  const list = page.getByRole('listbox', { name: 'Danh sách đoạn tường' });

  // Mọi đoạn tường phải hiện trên bản vẽ: một đoạn hình học xấu từng làm mất hình cả tầng (ch-08).
  await expect(page.locator('svg[data-canvas-bg] g[aria-label^="#W-"]'), 'số đoạn tường vẽ trên bản vẽ').toHaveCount(
    walls.length,
  );
  await list.getByRole('option').first().click();
  const saved = waitForApi(page, 'PUT', layer, [200]);
  const approve = page.getByRole('button', { name: 'Duyệt đoạn này' });
  // Đoạn có độ dày không chuẩn: màn đòi chọn độ dày thay cho nút duyệt.
  const thickness = page.getByRole('combobox', { name: 'Độ dày tường', exact: true });

  await expect(approve.or(thickness).first()).toBeVisible();
  if ((await approve.count()) > 0) {
    await approve.first().click();
  } else {
    const current = await thickness.inputValue();
    const values = await thickness.locator('option').evaluateAll((options) => options.map((option) => (option as HTMLOptionElement).value));
    const other = values.find((value) => value !== current && value !== '');

    if (other === undefined) throw new Error('ô "Độ dày tường" không có lựa chọn nào khác');
    await thickness.selectOption(other);
  }
  await saved;
}

test.describe('luồng CAD trên bản vẽ căn hộ thật', () => {
  test.skip(PLANS.length === 0, 'chưa đặt E2E_REAL_PLANS');

  for (const plan of PLANS) {
    test(basename(plan), async ({ page }) => {
      test.setTimeout(PIPELINE_TIMEOUT_MS + 300_000);
      const api = watchApi(page);
      const pageErrors: string[] = [];

      page.on('pageerror', (error) => pageErrors.push(`${error.name}: ${error.message}`));

      await login(page);
      const loginIndex = api.findIndex((entry) => entry.path === '/api/auth/login');
      const projectId = await createProject(page, `e2e-real-${basename(plan)}-${String(Date.now())}`);
      const floor = await addFloor(page, projectId);

      await test.step('tải bản vẽ', () => upload(page, projectId, floor, plan));
      await test.step('pipeline ML thật', () => waitPipeline(page, projectId));
      const calibrated = await test.step('tỷ lệ', () => ensureScale(page, projectId, floor.id));

      test.info().annotations.push({ type: 'scale', description: calibrated ? 'đặt tay' : 'máy đọc được' });
      await test.step('duyệt tường, tự lưu', () => reviewOneWall(page, projectId, floor.id));
      for (const [label, path] of [
        ['cửa và nội thất', ROUTES.project.objects(projectId, floor.id)],
        ['phòng', ROUTES.project.rooms(projectId, floor.id)],
      ] as const) {
        await test.step(label, async () => {
          await page.goto(path);
          await dismissTour(page, { waitMs: 3_000 });
          await expect(page.getByText('Đang tải màn hình', { exact: false })).toHaveCount(0, { timeout: 30_000 });
          await expect(page.getByRole('main').or(page.locator('#root')).first()).toBeVisible();
        });
      }
      await test.step('3D có tường', async () => {
        await page.goto(editor3dHref(projectId, 'probe=1'));
        await expect
          .poll(() => page.evaluate(() => (window.__pascalProbe?.ready() === true ? window.__pascalProbe.walls().length : 0)), {
            timeout: PASCAL_RENDER_TIMEOUT_MS,
          })
          .toBeGreaterThan(0);
      });

      expect(pageErrors).toEqual([]);
      expectNoApiErrors(
        api,
        (entry, index) => entry.path === '/api/auth/refresh' && entry.status === 401 && index < loginIndex,
      );
    });
  }
});
