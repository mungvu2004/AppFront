/** Phase 10 · dev server (mock) — UI at 1920/1440/1024/768 of DataEntryDemo (FL-10E-14) and ListReviewDemo (FL-10E-15). */
import type { Page } from '@playwright/test';

import { verifyUi } from './support/ui-verify';
import { devTest as test, expect } from './support/p10/devServer';
import { DESKTOP_VIEWPORTS } from './support/p10/viewports';
import { DATA_ENTRY, LIST_REVIEW, cell, comboTrigger, numeric3, overlay, selectTrigger, stateButton } from './support/p10/P9';
import { typeHeight } from './support/numeric-field';

/** True when box `inner` lies inside box `outer` (1 px slack). */
interface Box {
  readonly x: number;
  readonly y: number;
  readonly width: number;
  readonly height: number;
}
function inside(inner: Box, outer: Box): boolean {
  return inner.x >= outer.x - 1 && inner.y >= outer.y - 1 && inner.x + inner.width <= outer.x + outer.width + 1 && inner.y + inner.height <= outer.y + outer.height + 1;
}

async function openData(page: Page): Promise<void> {
  await page.goto(DATA_ENTRY);
  await expect(page.getByRole('heading', { level: 1, name: 'Data Entry Components' })).toBeVisible();
}

async function openList(page: Page): Promise<void> {
  await page.goto(LIST_REVIEW);
  await expect(page.getByText('States:', { exact: true })).toBeVisible();
}

/** A fixed-position panel (listbox) must sit wholly inside the viewport. */
async function expectPanelInViewport(page: Page): Promise<void> {
  const listbox = page.getByRole('listbox');
  await expect(listbox).toBeVisible();
  const vp = page.viewportSize()!;
  await expect
    .poll(async () => inside((await listbox.boundingBox())!, { x: 0, y: 0, width: vp.width, height: vp.height }), { message: 'listbox inside viewport' })
    .toBe(true);
}

test('SCR-40e-1 · FL-10E-14 · anon · UI DataEntryDemo', async ({ devPage: page }) => {
  test.setTimeout(120_000);

  await test.step('[10E-F-001] bố cục mặc định: không cuộn ngang', async () => {
    const all = await verifyUi(page, 'E10_10E-F-001_data_entry_default', openData, DESKTOP_VIEWPORTS);
    expect(all.map((m) => m.openError)).toEqual([undefined, undefined, undefined, undefined]);
    expect(all.map((m) => m.horizontalOverflowPx)).toEqual([0, 0, 0, 0]);
  });

  await test.step('[10E-F-002] lỗi #3 "Giá trị không nhỏ hơn 50 mm." nằm trong cột', async () => {
    await verifyUi(
      page,
      'E10_10E-F-002_data_entry_error',
      async (p) => {
        await openData(p);
        await typeHeight(numeric3(p), '30'); // qa/tests/support/numeric-field.ts
        const err = p.getByText('Giá trị không nhỏ hơn 50 mm.');
        await expect(err).toBeVisible();
        const col = (await cell(p, '3. Invalid (Min: 50)').boundingBox())!;
        expect.soft(inside((await err.boundingBox())!, col), 'error text inside its column').toBe(true);
      },
      DESKTOP_VIEWPORTS,
    );
  });

  await test.step('[10E-F-003] dropdown Select/Combobox mở nằm trong viewport', async () => {
    await verifyUi(
      page,
      'E10_10E-F-003_select_open',
      async (p) => {
        await openData(p);
        await selectTrigger(p).click();
        await expectPanelInViewport(p);
      },
      DESKTOP_VIEWPORTS,
    );
    await verifyUi(
      page,
      'E10_10E-F-003_combobox_open',
      async (p) => {
        await openData(p);
        await comboTrigger(p).click();
        await expectPanelInViewport(p);
      },
      DESKTOP_VIEWPORTS,
    );
  });
});

test('SCR-40e-2 · FL-10E-15 · anon · UI ListReviewDemo', async ({ devPage: page }) => {
  test.setTimeout(180_000);

  await test.step('[10E-F-004] default: không tràn', async () => {
    const all = await verifyUi(page, 'E10_10E-F-004_list_default', openList, DESKTOP_VIEWPORTS);
    expect(all.map((m) => m.openError)).toEqual([undefined, undefined, undefined, undefined]);
    expect(all.map((m) => m.horizontalOverflowPx)).toEqual([0, 0, 0, 0]);
  });

  await test.step('[10E-F-005] collapsed: hai cột', async () => {
    await verifyUi(
      page,
      'E10_10E-F-005_list_collapsed',
      async (p) => {
        await openList(p);
        await stateButton(p, 'collapsed').click();
        await expect(p.getByRole('columnheader', { name: 'Mã cấu kiện' })).toBeVisible();
        await expect.soft(p.locator('thead th'), 'two columns').toHaveCount(2);
      },
      DESKTOP_VIEWPORTS,
    );
  });

  await test.step('[10E-F-006] "Đã chọn N cấu kiện" nằm trong khung (cả 768)', async () => {
    await verifyUi(
      page,
      'E10_10E-F-006_list_selected',
      async (p) => {
        await openList(p);
        for (let i = 0; i < 3; i += 1) await p.locator('tbody tr input[type="checkbox"]').nth(i).check();
        const bar = p.getByText('Đã chọn 3 cấu kiện');
        await expect(bar).toBeVisible();
        const vp = p.viewportSize()!;
        expect.soft(inside((await bar.boundingBox())!, { x: 0, y: 0, width: vp.width, height: vp.height }), 'summary inside viewport').toBe(true);
      },
      DESKTOP_VIEWPORTS,
    );
  });

  await test.step('[10E-F-007] empty/error/permission/success: nội dung căn giữa', async () => {
    const shown = { empty: 'Chưa có dữ liệu', error: 'Đã có lỗi xảy ra khi tải dữ liệu', permission: 'Bạn không có quyền xem dữ liệu này', success: 'Duyệt dữ liệu thành công!' };
    for (const [state, text] of Object.entries(shown)) {
      await verifyUi(
        page,
        `E10_10E-F-007_list_${state}`,
        async (p) => {
          await openList(p);
          await stateButton(p, state).click();
          const msg = p.getByText(text, { exact: true });
          await expect(msg).toBeVisible();
          const [m, o] = [(await msg.boundingBox())!, (await overlay(p).boundingBox())!];
          expect.soft(Math.abs(m.x + m.width / 2 - (o.x + o.width / 2)), `${state}: horizontal centre offset`).toBeLessThanOrEqual(8);
          expect.soft(Math.abs(m.y + m.height / 2 - (o.y + o.height / 2)), `${state}: vertical centre offset`).toBeLessThanOrEqual(60);
        },
        DESKTOP_VIEWPORTS,
      );
    }
  });

  await test.step('[10E-F-008] loading + partial: không cắt chữ', async () => {
    for (const state of ['loading', 'partial']) {
      const all = await verifyUi(
        page,
        `E10_10E-F-008_list_${state}`,
        async (p) => {
          await openList(p);
          await stateButton(p, state).click();
          if (state === 'partial') await expect(p.getByText('Có lỗi khi tải trang 2. Một số dữ liệu có thể bị thiếu.')).toBeVisible();
          else await expect(p.locator('tbody tr:has(.animate-pulse)')).toHaveCount(8);
        },
        DESKTOP_VIEWPORTS,
      );
      for (const m of all) expect.soft(m.clipped, `${state} ${m.viewport}: clipped text`).toEqual([]);
    }
  });
});
