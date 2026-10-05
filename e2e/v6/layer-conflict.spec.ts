import { expect, test, type Page } from '@playwright/test';

import { ROUTES } from '../fixtures/routes';
import { dismissTour } from '../fixtures/tour';

import { QC_PROJECT } from './seedQc';

/**
 * F-04x-1 bước 9 — xung đột lưu lớp tầng trên màn tường, đường nạp thật (không bơm).
 *
 * Sửa → "Đã lưu lúc"; người khác sửa tầng (`simulateRemoteLayerEdit`: revision tăng,
 * một tường bị xoá); sửa tiếp → 409 → dải "Tải lại"; bấm → hộp thoại A9 → đồng ý → dải
 * mất và tường bị xoá ở nơi khác biến mất; sửa → "Đã lưu lúc".
 *
 * Mock gọi qua `import('/src/api/__mocks__/client.ts')` như `seedQc.ts` — cùng mô-đun
 * mà ứng dụng dev đang dùng, nên revision là của "máy chủ" thật của trang.
 */

/** Lần tải đầu một route bắt Vite dịch nguội; tiền lệ `smoke-grid.spec.ts`. */
const FIRST_PAINT_TIMEOUT_MS = 15_000;

/** Tầng 2 của bộ mẫu A14: 12 tường. */
const FLOOR = 'L-LEVEL000001';
const WALLS_ON_FLOOR = 12;

const RELOAD_MESSAGE = 'Tầng này vừa được sửa ở nơi khác. Tải lại để xem bản mới nhất.';

const list = (page: Page) => page.getByRole('listbox', { name: 'Danh sách đoạn tường' });
const statusBar = (page: Page) => page.getByRole('status', { name: 'Thanh trạng thái' });

interface ServerLayer {
  readonly revision: number;
  readonly wallIds: readonly string[];
}

/** Lớp tầng trên "máy chủ" mock — đọc qua N16 của chính mô-đun trang đang dùng. */
async function serverLayer(page: Page): Promise<ServerLayer> {
  return page.evaluate(
    async ({ floorId, projectId }) => {
      const load = (path: string): Promise<Record<string, unknown>> =>
        import(/* @vite-ignore */ path) as Promise<Record<string, unknown>>;
      const mock = await load('/src/api/__mocks__/client.ts');
      const client = (mock.createMockApiClient as () => {
        spatial: {
          readLayer: (input: { floorId: string; projectId: string }) => Promise<
            { ok: true; data: { revision: number; layer: { walls: { id: string }[] } } } | { ok: false }
          >;
        };
      })();
      const read = await client.spatial.readLayer({ floorId, projectId });

      if (!read.ok) {
        throw new Error('N16 mock hỏng');
      }

      return { revision: read.data.revision, wallIds: read.data.layer.walls.map((wall) => wall.id) };
    },
    { floorId: FLOOR, projectId: QC_PROJECT },
  );
}

async function simulateRemoteEdit(page: Page): Promise<void> {
  await page.evaluate(async (floorId) => {
    const load = (path: string): Promise<Record<string, unknown>> =>
      import(/* @vite-ignore */ path) as Promise<Record<string, unknown>>;
    const mock = await load('/src/api/__mocks__/client.ts');

    (mock.simulateRemoteLayerEdit as (id: string) => void)(floorId);
  }, FLOOR);
}

async function wallInStore(page: Page, wallId: string): Promise<boolean> {
  return page.evaluate(async (id) => {
    const load = (path: string): Promise<Record<string, unknown>> =>
      import(/* @vite-ignore */ path) as Promise<Record<string, unknown>>;
    const store = (await load('/src/store/index.ts')).useStore as {
      getState: () => { spatial: { byId: Record<string, unknown> } | null };
    };

    return store.getState().spatial?.byId[id] !== undefined;
  }, wallId);
}

async function approveFirstWall(page: Page): Promise<void> {
  await list(page).getByRole('option').first().click();
  await page.getByRole('button', { name: 'Duyệt đoạn này' }).first().click();
}

test('xung đột lưu lớp: 409 → dải "Tải lại" → A9 → tải bản mới, tường bị xoá ở nơi khác biến mất → lưu tiếp được (F-04x-1)', async ({
  page,
}) => {
  await page.goto(ROUTES.project.walls(QC_PROJECT, FLOOR));
  await expect(list(page).getByRole('option')).toHaveCount(WALLS_ON_FLOOR, { timeout: FIRST_PAINT_TIMEOUT_MS });
  await dismissTour(page);

  /* 1. Sửa (xoá một tường) → tự lưu. */
  await list(page).getByRole('option').first().click();
  await page.keyboard.press('Backspace');
  await expect(list(page).getByRole('option')).toHaveCount(WALLS_ON_FLOOR - 1);
  await expect(statusBar(page)).toContainText(/Đã lưu lúc \d{2}:\d{2}/u);
  await expect.poll(async () => (await serverLayer(page)).revision).toBe(1);

  /* 2. Người khác sửa tầng: revision 2, một tường nữa bị xoá trên máy chủ. */
  const before = await serverLayer(page);
  await simulateRemoteEdit(page);
  const remote = await serverLayer(page);
  const removedRemotely = before.wallIds.find((id) => !remote.wallIds.includes(id));

  expect(remote.revision).toBe(2);
  expect(removedRemotely).toBeDefined();
  expect(await wallInStore(page, removedRemotely ?? '')).toBe(true);

  /* 3. Sửa tiếp → PUT base 1 → 409 → dải "Tải lại". */
  await approveFirstWall(page);
  await expect(page.getByText(`1/${String(WALLS_ON_FLOOR - 1)} tường đã duyệt`)).toBeVisible();

  const banner = page.getByRole('alert').filter({ hasText: RELOAD_MESSAGE });
  await expect(banner).toBeVisible();

  /* 4. Còn sửa chưa lưu → "Tải lại" hỏi trước (A9), đồng ý thì tải bản mới. */
  await banner.getByRole('button', { name: 'Tải lại' }).click();
  const dialog = page.getByRole('dialog', { name: 'Bỏ thay đổi chưa lưu của tầng này?' });
  await expect(dialog).toBeVisible();
  await dialog.getByRole('button', { name: 'Tải lại và bỏ thay đổi' }).click();

  await expect(banner).toHaveCount(0);
  await expect(list(page).getByRole('option')).toHaveCount(remote.wallIds.length);
  await expect(page.getByText(`0/${String(remote.wallIds.length)} tường đã duyệt`)).toBeVisible();
  expect(await wallInStore(page, removedRemotely ?? '')).toBe(false);

  /* 5. Sửa lại → lưu bằng revision mới, không 409. */
  await approveFirstWall(page);
  await expect.poll(async () => (await serverLayer(page)).revision).toBe(3);
  await expect(statusBar(page)).toContainText(/Đã lưu lúc \d{2}:\d{2}/u);
  await expect(page.getByRole('alert').filter({ hasText: RELOAD_MESSAGE })).toHaveCount(0);
});
