import { expect, test, type Page } from '@playwright/test';

import { ROUTES } from '../fixtures/routes';

import { QC_FLOOR, QC_PROJECT } from './seedQc';

/**
 * B3 — thêm món bị sót và gợi ý của máy trên Lớp đối tượng, ở 1440 px: bộ mẫu QC cộng hai gợi ý
 * (bơm qua cửa dev như `seedQc`), dải "Nhận tất cả gợi ý", kéo để vẽ một món đúng cỡ, ô rộng × sâu.
 */

const FIRST_PAINT_TIMEOUT_MS = 15_000;

test.use({ viewport: { width: 1440, height: 900 } });

/** Bơm bộ mẫu QC của màn, cộng hai giường AI mang cờ `suggested`. */
async function seedWithSuggestions(page: Page): Promise<void> {
  await page.evaluate(async () => {
    const load = (path: string): Promise<Record<string, unknown>> =>
      import(/* @vite-ignore */ path) as Promise<Record<string, unknown>>;
    const gateway = await load('/src/screens/qc/ObjectLayerReview/objectLayerReviewGateway.ts');
    const normalize = await load('/src/domain/spatial/normalize.ts');
    const level = gateway.OBJECT_LAYER_SAMPLE_LEVEL as { id: string };
    const raw = (normalize.denormalizeSpatial as (graph: unknown) => { furniture: unknown[] })(
      gateway.OBJECT_LAYER_SAMPLE_GRAPH,
    );
    const bed = (id: string, x: number) => ({
      id,
      levelId: level.id,
      kind: 'bed',
      centre: { x, y: 4000 },
      boundingBox: { min: { x: x - 800, y: 3000 }, max: { x: x + 800, y: 5000 } },
      rotationDeg: 0,
      confidence: 0.4,
      source: 'ai',
      reviewed: false,
      suggested: true,
    });
    const graph = (normalize.normalizeSpatial as (raw: unknown) => { byKind: { level: readonly string[] } })({
      ...raw,
      furniture: [...raw.furniture, bed('F-000091SUGG', 13000), bed('F-000092SUGG', 16000)],
    });
    const store = (await load('/src/store/index.ts')).useStore as {
      getState: () => { setSpatial: (spatial: unknown, versionId: null, source: unknown) => void };
    };
    const floorRevisions = Object.fromEntries(graph.byKind.level.map((id) => [id, 0]));

    store.getState().setSpatial(graph, null, { floorRevisions, projectId: 'project-1' });
  });
}

test('bơm hai gợi ý: nét đứt + nhãn, nhận tất cả, kéo vẽ một món đúng cỡ (B3)', async ({ page }, testInfo) => {
  await page.goto(ROUTES.project.objects(QC_PROJECT, QC_FLOOR.objects));
  await expect(page.getByRole('region', { name: 'Lớp đối tượng', exact: true })).toBeVisible({
    timeout: FIRST_PAINT_TIMEOUT_MS,
  });
  await seedWithSuggestions(page);

  await expect(page.getByText('2 gợi ý của máy đang chờ').first()).toBeVisible();
  await expect(page.locator('svg text', { hasText: 'Gợi ý' })).toHaveCount(2);
  await page.screenshot({ path: testInfo.outputPath('s13-suggestions-1440.png') });

  await page.getByRole('button', { name: 'Nhận tất cả gợi ý' }).click();
  await expect(page.getByText('2 gợi ý của máy đang chờ')).toHaveCount(0);
  await expect(page.locator('svg text', { hasText: 'Gợi ý' })).toHaveCount(0);

  /* Kéo để vẽ: bật "Vẽ nội thất" trên rail, kéo 120 × 80 px trên bản vẽ. */
  await page.getByRole('toolbar', { name: 'Công cụ lớp đối tượng' }).getByRole('button', { name: /Vẽ nội thất/u }).click();
  const surface = page.getByTestId('object-draw-surface');
  const box = await surface.boundingBox();

  if (box === null) {
    throw new Error('Không thấy lớp vẽ.');
  }

  const x = box.x + box.width * 0.45;
  const y = box.y + box.height * 0.45;

  await page.mouse.move(x, y);
  await page.mouse.down();
  await page.mouse.move(x + 60, y + 40, { steps: 4 });
  await page.mouse.move(x + 120, y + 80, { steps: 4 });
  await page.mouse.up();

  const width = page.getByLabel('Chiều rộng (mm)');

  await expect(width).toBeVisible();
  await expect(width).not.toHaveValue('600');
  await expect(page.getByRole('combobox', { name: 'Đổi loại nội thất' })).toBeFocused();
  await page.screenshot({ path: testInfo.outputPath('s13-drawn-1440.png') });
});
