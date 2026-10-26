/**
 * F3 đo tay (không chạy trong CI mặc định): ảnh 4 góc F1 với TRAA (AO đã chỉnh), xoay 10 s đo rAF
 * theo mức. `F3_TIERS=auto,high,low` (mặc định auto), `F3_GPU=igpu` bỏ cờ dGPU.
 * Chạy: E2E_PORT=5399 npx playwright test e2e/realism/f3-traa-tier.spec.ts --workers=1
 */
import type { HookWindow } from './window-hooks';
import fs from 'node:fs';
import path from 'node:path';
import { test } from '@playwright/test';
import type { Page } from '@playwright/test';
import { fixtureF1 } from '../../src/lib/pascal/__fixtures__';
import { installFakeApi, type WireGraphDocument } from '../fixtures/fakeApi';
import { POSE_NAMES, posesFor } from './poses';

const OUT = 'F:/App-review/editor-realism/f3';
const PID = 'P-FIXTURE0001';
const GPU = process.env.F3_GPU === 'igpu' ? 'igpu' : 'dgpu';
const TIERS = (process.env.F3_TIERS ?? 'auto').split(',');

async function rotate(page: Page, ms: number) {
  await page.mouse.move(660, 560);
  await page.mouse.down();
  const until = Date.now() + ms;
  let fwd = true;
  while (Date.now() < until) {
    await page.mouse.move(fwd ? 1260 : 660, 560, { steps: 30 });
    fwd = !fwd;
  }
  await page.mouse.up();
}

for (const mode of TIERS) {
  test(`f3 ${GPU} ${mode}`, async ({ page }) => {
    test.setTimeout(240_000);
    fs.mkdirSync(OUT, { recursive: true });
    const errors: string[] = [];
    page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text().slice(0, 300)); });
    await page.addInitScript((m) => { try { localStorage.setItem('pascal.realism.tierMode', m); } catch { /* */ } }, mode);
    await installFakeApi(page, { projectId: PID, graphDoc: fixtureF1({ ext: true }).doc as unknown as WireGraphDocument });
    await page.goto(`/editor3d.html?project=${PID}&probe=1`);
    await page.waitForFunction(() => { const p = (window as unknown as HookWindow).__pascalProbe; return p?.ready() && (p.counts().wall ?? 0) > 0; }, null, { timeout: 150_000 });
    await page.waitForTimeout(4_000);
    const walls = await page.evaluate(() => (window as unknown as HookWindow).__pascalProbe.walls());
    const xs = walls.flatMap((w) => [w.start[0], w.end[0]]);
    const zs = walls.flatMap((w) => [w.start[1], w.end[1]]);
    const poses = posesFor({ minX: Math.min(...xs), maxX: Math.max(...xs), minZ: Math.min(...zs), maxZ: Math.max(...zs) });
    const shotPoses = mode === 'auto' && GPU === 'dgpu' ? POSE_NAMES : (['interior'] as const);
    for (const pose of shotPoses) {
      await page.evaluate((x) => (window as unknown as HookWindow).__pascalProbe.setCamera(x.position, x.target, x.fov), poses[pose]);
      await page.waitForTimeout(2_500);
      await page.screenshot({ path: path.join(OUT, `${GPU}-${mode}-F1-${pose}.png`) });
    }
    await page.evaluate((x) => (window as unknown as HookWindow).__pascalProbe.setCamera(x.position, x.target, x.fov), poses['high-diag']);
    await page.waitForTimeout(1_500);
    await page.evaluate(() => {
      const w = window as unknown as HookWindow;
      w.__d = [];
      let last = performance.now();
      const end = last + 10_000;
      const tick = (t: number) => { w.__d.push(t - last); last = t; if (t < end) requestAnimationFrame(tick); else w.__done = true; };
      requestAnimationFrame(tick);
    });
    await rotate(page, 10_000);
    await page.waitForFunction(() => (window as unknown as HookWindow).__done, null, { timeout: 30_000 });
    const stats = await page.evaluate(() => {
      const d = [...(window as unknown as HookWindow).__d].sort((a, b) => a - b);
      const q = (p: number) => Math.round(d[Math.min(d.length - 1, Math.floor(d.length * p))]! * 10) / 10;
      return { n: d.length, p50: q(0.5), p95: q(0.95), max: q(1) };
    });
    const tier = await page.evaluate(() => document.querySelector('summary[aria-label^="Chất lượng"]')?.getAttribute('aria-label') ?? null);
    const res = { gpu: GPU, mode, tier, rotate10s: stats, errors: errors.slice(0, 10) };
    console.log(JSON.stringify(res));
    fs.writeFileSync(path.join(OUT, `${GPU}-${mode}-metrics.json`), JSON.stringify(res, null, 2));
  });
}

const args = ['--disable-features=CalculateNativeWinOcclusion', '--disable-backgrounding-occluded-windows', '--enable-unsafe-webgpu'];
test.use({
  headless: false,
  viewport: { width: 1920, height: 1080 },
  launchOptions: { args: GPU === 'dgpu' ? [...args, '--force_high_performance_gpu'] : args },
});
