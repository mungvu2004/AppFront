import { captureEvidence } from './support/evidence';
import { devTest as test, expect } from './support/p10/devServer';
import {
  DEMO_SCREENS,
  crashFallback,
  motionRows,
  navButton,
  navButtons,
  phaseCaption,
  recordCaption,
  recordedCaptions,
  rowDelays,
} from './support/p10/P4';

const STAGGER_BUDGET_MS = 200; // src/lib/motion/stagger.ts:55
const SELECTED = /bg-bg-selected/u; // App.tsx:76

test('SCR-40 · FL-10D-01 · anon · /demo: vỏ chọn màn', async ({ devPage: page }) => {
  test.setTimeout(120_000);

  await test.step('[10D-A-101] mở /demo không phiên', async () => {
    await page.goto('/demo');
    await expect(page.getByRole('heading', { level: 1, name: 'Demo App' })).toBeVisible(); // App.tsx:70
    await expect(page).toHaveURL(/\/demo$/u);
    await captureEvidence(page, 'D10_10D-A-101_demo-shell.png');
  });

  await test.step('[10D-A-102] 9 nút thanh trái đúng thứ tự', async () => {
    await expect.soft(navButtons(page)).toHaveText([...DEMO_SCREENS]); // App.tsx:44-54
    await captureEvidence(page, 'D10_10D-A-102_nav-nine.png');
  });

  await test.step('[10D-A-103] mặc định Design System', async () => {
    await expect.soft(page.getByRole('heading', { level: 1, name: 'Quiet Blueprint v1.1' })).toBeVisible(); // DesignSystem.tsx:28
    await expect.soft(navButton(page, 'Design System')).toHaveClass(SELECTED);
    await captureEvidence(page, 'D10_10D-A-103_default-design-system.png');
  });

  await test.step('[10D-A-104] bấm Motion & Transitions', async () => {
    await navButton(page, 'Motion & Transitions').click();
    await expect.soft(page.getByRole('heading', { level: 2, name: 'Chuyển cảnh và nhịp' })).toBeVisible(); // MotionDemo.tsx:60
    await expect.soft(navButton(page, 'Motion & Transitions')).toHaveClass(SELECTED);
    await captureEvidence(page, 'D10_10D-A-104_motion.png');
  });

  await test.step('[10D-A-105] bấm State Gallery (QA)', async () => {
    await navButton(page, 'State Gallery (QA)').click();
    await expect.soft(page.getByRole('heading', { level: 1, name: 'State Gallery (QA)' })).toBeVisible(); // StateGallery.tsx:42
    await captureEvidence(page, 'D10_10D-A-105_state-gallery.png');
  });

  await test.step('[10D-A-106] bấm 6 mục còn lại, không sập', async () => {
    const six = ['Canvas & Overlays', 'Data Entry', 'Shared Controls', 'Feedback & States', 'List & Review', 'App Shell'];
    for (const name of six) {
      await navButton(page, name).click();
      await expect.soft(navButton(page, name), name).toHaveClass(SELECTED);
      // named mark first: the State Gallery h1 is gone, so the new screen is mounted
      await expect.soft(page.getByRole('heading', { name: 'State Gallery (QA)' }), name).toHaveCount(0);
      await expect.soft(crashFallback(page), name).toHaveCount(0); // App.tsx:33
    }
    await captureEvidence(page, 'D10_10D-A-106_six-screens.png');
  });

  await test.step('[10D-A-107] qua lại nhiều mục không rơi fallback', async () => {
    for (const name of ['Design System', 'Motion & Transitions', 'Data Entry', 'State Gallery (QA)', 'Design System']) {
      await navButton(page, name).click();
      await expect.soft(navButton(page, name), name).toHaveClass(SELECTED);
    }
    await expect.soft(page.getByRole('heading', { level: 1, name: 'Quiet Blueprint v1.1' })).toBeVisible();
    await expect.soft(crashFallback(page)).toHaveCount(0); // App.tsx:88 key={activeScreen}
    await captureEvidence(page, 'D10_10D-A-107_back-forth.png');
  });

  await test.step('[10D-E-101] Tab + Enter chọn màn', async () => {
    await page.goto('/demo');
    await expect(page.getByRole('heading', { level: 1, name: 'Demo App' })).toBeVisible();
    await page.keyboard.press('Tab'); // first focusable = 'Design System'
    await expect.soft(navButton(page, 'Design System')).toBeFocused();
    await page.keyboard.press('Tab');
    const second = navButton(page, 'Canvas & Overlays');
    await expect.soft(second).toBeFocused();
    // focus-visible:ring-2 gives a box-shadow ring (App.tsx:73-76)
    await expect.soft(second).not.toHaveCSS('box-shadow', 'none');
    await captureEvidence(page, 'D10_10D-E-101_focus-ring.png');
    await page.keyboard.press('Enter');
    await expect.soft(second).toHaveClass(SELECTED);
    await expect.soft(navButton(page, 'Design System')).not.toHaveClass(SELECTED);
  });
});

test('SCR-40 · FL-10D-02 · anon · /demo → Motion & Transitions', async ({ devPage: page }) => {
  test.setTimeout(120_000);
  const chip = (name: string) => page.getByRole('button', { name, exact: true });
  const lowChip = chip('Giả lập máy yếu');
  const scene = (label: string) => page.getByText(label, { exact: true });

  await test.step('[10D-B-101] vào Motion & Transitions, trạng thái đầu', async () => {
    await page.goto('/demo');
    await expect(page.getByRole('heading', { level: 1, name: 'Demo App' })).toBeVisible();
    await navButton(page, 'Motion & Transitions').click();
    await expect(page.getByRole('heading', { level: 2, name: 'Chuyển cảnh và nhịp' })).toBeVisible();
    await expect(chip('Đổi khung nhìn')).toHaveAttribute('aria-pressed', 'true'); // MotionDemo.tsx:109
    await expect(chip('8 mục')).toHaveAttribute('aria-pressed', 'true');
    await expect(page.getByText('60 khung hình/giây', { exact: true })).toBeVisible();
    await captureEvidence(page, 'D10_10D-B-101_motion-initial.png');
  });

  await test.step('[10D-B-102] bật rồi tắt Giả lập máy yếu', async () => {
    await lowChip.click();
    await expect.soft(lowChip).toHaveAttribute('aria-pressed', 'true');
    await expect
      .soft(page.getByText('12 khung hình/giây — dưới ngưỡng, mọi thời lượng về mức tức thì', { exact: true }))
      .toBeVisible();
    await captureEvidence(page, 'D10_10D-B-102_lowperf-on.png');
    await lowChip.click();
    await expect.soft(lowChip).toHaveAttribute('aria-pressed', 'false');
    await expect.soft(page.getByText('60 khung hình/giây', { exact: true })).toBeVisible();
  });

  await test.step('[10D-B-103] chip 0 mục', async () => {
    await chip('0 mục').click();
    await expect.soft(page.getByText('Chưa có mục nào.')).toBeVisible(); // MotionDemo.tsx:164
    await expect.soft(motionRows(page)).toHaveCount(0);
    await captureEvidence(page, 'D10_10D-B-103_zero-rows.png');
  });

  await test.step('[10D-B-104] chip 3/20/8 mục', async () => {
    for (const n of [3, 20, 8]) {
      await chip(`${n} mục`).click();
      await expect.soft(motionRows(page), `${n} rows`).toHaveCount(n);
      await expect.soft(page.getByText(`Mục ${n}`, { exact: true })).toBeVisible();
      for (const other of [0, 3, 8, 20]) {
        await expect
          .soft(chip(`${other} mục`), `${other} pressed for ${n}`)
          .toHaveAttribute('aria-pressed', other === n ? 'true' : 'false');
      }
    }
    await captureEvidence(page, 'D10_10D-B-104_rows-8.png');
  });

  await test.step('[10D-B-105] 20 mục: trễ ≤ trần', async () => {
    await chip('20 mục').click();
    await expect.soft(motionRows(page)).toHaveCount(20);
    const delays = await rowDelays(page);
    expect.soft(delays).toHaveLength(20);
    expect.soft(Math.max(...delays)).toBeLessThanOrEqual(STAGGER_BUDGET_MS);
    await expect.soft(page.getByText(`luôn dưới trần ${STAGGER_BUDGET_MS}ms`)).toBeVisible(); // MotionDemo.tsx:176-181
    await captureEvidence(page, 'D10_10D-B-105_stagger-ceiling.png');
  });

  await test.step('[10D-B-106] máy yếu + 20 mục', async () => {
    await lowChip.click();
    await expect.soft(lowChip).toHaveAttribute('aria-pressed', 'true');
    await expect.soft(page.getByText('trễ 0ms', { exact: true })).toHaveCount(20); // MotionDemo.tsx:170
    expect.soft((await rowDelays(page)).every((d) => d === 0)).toBe(true);
    await expect.soft(phaseCaption(page)).toHaveText(/tổng 0ms · chồng 0ms/u);
    await captureEvidence(page, 'D10_10D-B-106_lowperf-rows.png');
    await lowChip.click(); // restore healthy conditions for the scene steps
    await expect(lowChip).toHaveAttribute('aria-pressed', 'false');
    await chip('8 mục').click();
  });

  await test.step('[10D-C-101] Đổi cảnh', async () => {
    await expect(scene('Mặt bằng 2D')).toHaveCount(1);
    await recordCaption(page);
    await page.getByRole('button', { name: 'Đổi cảnh', exact: true }).click();
    await expect.soft(phaseCaption(page)).toHaveText(/^đứng yên/u);
    await expect.soft(scene('Mô hình 3D')).toHaveCount(1);
    await expect.soft(scene('Mặt bằng 2D')).toHaveCount(0);
    const seen = (await recordedCaptions(page)).join('|');
    expect.soft(seen).toMatch(/đang ra|chồng nhau|đang vào/u); // PHASE_LABELS MotionDemo.tsx:38-43
    await captureEvidence(page, 'D10_10D-C-101_scene-swapped.png');
  });

  await test.step('[10D-C-102] Đổi cảnh 2 lần liền', async () => {
    const swap = page.getByRole('button', { name: 'Đổi cảnh', exact: true });
    await swap.click();
    await swap.click(); // second press replaces the running handover (MotionDemo.tsx:136-139)
    await expect.soft(phaseCaption(page)).toHaveText(/^đứng yên/u);
    await expect.soft(scene('Mặt bằng 2D')).toHaveCount(1);
    await expect.soft(scene('Mô hình 3D')).toHaveCount(0);
    await captureEvidence(page, 'D10_10D-C-102_swap-twice.png');
  });

  await test.step('[10D-C-103] kind đổi màn / đổi tầng', async () => {
    const captions = new Set<string>();
    for (const kind of ['Đổi khung nhìn', 'đổi màn', 'đổi tầng']) {
      await chip(kind).click();
      await expect.soft(chip(kind)).toHaveAttribute('aria-pressed', 'true');
      await expect.soft(phaseCaption(page)).toHaveText(/^đứng yên/u);
      captions.add(((await phaseCaption(page).textContent()) ?? '').trim());
    }
    expect.soft(captions.size, 'total/overlap ms differ per kind').toBeGreaterThan(1);
    await captureEvidence(page, 'D10_10D-C-103_kinds.png');
  });

  await test.step('[10D-C-104] Chạy lại', async () => {
    await expect(motionRows(page)).toHaveCount(8);
    const oldList = await page.locator('ul').first().elementHandle();
    await page.getByRole('button', { name: 'Chạy lại', exact: true }).click();
    await expect.soft(motionRows(page)).toHaveCount(8);
    await expect.poll(() => oldList?.evaluate((n) => n.isConnected)).toBe(false); // new <ul key=replayKey>
    await captureEvidence(page, 'D10_10D-C-104_replay.png');
  });

  await test.step('[10D-C-105] máy yếu + OS reduced', async () => {
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await lowChip.click();
    await expect.soft(lowChip).toHaveAttribute('aria-pressed', 'true');
    await expect.soft(phaseCaption(page)).toHaveText(/tổng 0ms · chồng 0ms/u);
    await expect.soft(page.getByText('trễ 0ms', { exact: true })).toHaveCount(8);
    await expect.soft(crashFallback(page)).toHaveCount(0);
    await captureEvidence(page, 'D10_10D-C-105_lowperf-reduced.png');
  });

  await test.step('[10D-E-102] a11y chip + vùng live', async () => {
    for (const name of ['Giả lập máy yếu', 'Đổi khung nhìn', 'đổi màn', 'đổi tầng', '0 mục', '3 mục', '8 mục', '20 mục']) {
      await expect.soft(chip(name), name).toHaveAttribute('aria-pressed', /^(true|false)$/u);
    }
    await expect.soft(phaseCaption(page)).toHaveAttribute('aria-live', 'polite'); // MotionDemo.tsx:131
    await captureEvidence(page, 'D10_10D-E-102_a11y.png');
  });

  await test.step('[10D-B-107] reducedMotion=reduce hiện thông báo', async () => {
    const note = page.getByText('Hệ điều hành đang bật giảm chuyển động: mọi thời lượng bằng 0.'); // MotionDemo.tsx:98-102
    await page.emulateMedia({ reducedMotion: 'no-preference' });
    await expect(page.getByRole('heading', { level: 2, name: 'Chuyển cảnh và nhịp' })).toBeVisible();
    await expect.soft(note).toHaveCount(0);
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await expect.soft(note).toBeVisible();
    await captureEvidence(page, 'D10_10D-B-107_reduced-os.png');
  });
});
