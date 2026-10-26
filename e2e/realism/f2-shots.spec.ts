/**
 * F2: chụp thường (tải về máy) + HQ lạnh/ấm cho F1, F5; ghi lỗi console "sample count".
 *   E2E_PORT=5401 npx playwright test e2e/realism/f2-shots.spec.ts --workers=1 --reporter=line
 * Ảnh + timings.jsonl -> F:/App-review/editor-realism/f2/
 */
import type { HookWindow } from './window-hooks';
import fs from 'node:fs';
import { expect, test } from '@playwright/test';
import type { Page } from '@playwright/test';
import { fixtureF1, fixtureF5, type Fixture } from '../../src/lib/pascal/__fixtures__';
import { installFakeApi, type WireGraphDocument } from '../fixtures/fakeApi';

const OUT = process.env.F2_OUT ?? 'F:/App-review/editor-realism/f2';
const PROJECT_ID = 'P-FIXTURE0001';
test.use({
  headless: false,
  acceptDownloads: true,
  viewport: { width: 1920, height: 1080 },
  launchOptions: { args: ['--disable-features=CalculateNativeWinOcclusion', '--disable-backgrounding-occluded-windows', '--enable-unsafe-webgpu', '--force_high_performance_gpu'] },
});

const INIT = () => {
  const w = window as unknown as HookWindow;
  w.__f2Blobs = [];
  const orig = OffscreenCanvas.prototype.convertToBlob;
  OffscreenCanvas.prototype.convertToBlob = async function (this: OffscreenCanvas, opts?: ImageEncodeOptions) {
    const blob = await orig.call(this, opts);
    w.__f2Blobs.push({ t: performance.now() });
    return blob;
  };
};

async function openSnapshot(page: Page) {
  if (await page.locator('button[aria-label="Take snapshot"]').count()) return;
  await page.locator('canvas').first().click({ position: { x: 960, y: 500 } });
  await page.keyboard.press('Control+k');
  await page.keyboard.type('Snapshot');
  await page.waitForTimeout(400);
  await page.keyboard.press('Enter');
  await page.locator('button[aria-label="Take snapshot"]').waitFor({ timeout: 10_000 });
}

async function shoot(page: Page, name: string, label: string, hq: boolean) {
  await openSnapshot(page);
  const hqBtn = page.getByRole('button', { name: /Chất lượng cao|HQ/ });
  const on = await hqBtn.evaluate((b) => b.className.includes('bg-white/15') || b.className.includes('ring'));
  if (on !== hq) await hqBtn.click();
  const t0 = await page.evaluate(() => performance.now());
  const dl = page.waitForEvent('download', { timeout: 60_000 });
  await page.locator('button[aria-label="Take snapshot"]').click();
  const d = await dl;
  const res = await page.evaluate((t0) => {
    const b = (window as unknown as HookWindow).__f2Blobs;
    const blobAt = b[b.length - 1]?.t ?? performance.now();
    const tm = (window as unknown as HookWindow).__r3sTimings ?? null;
    return { ms: Math.round(blobAt - t0), hqMs: (window as unknown as HookWindow).__r3sLastMs ?? null, tm: tm && { ...tm, encodeMs: Math.round(blobAt - tm.doneAt), doneAt: undefined } };
  }, t0);
  const file = d.suggestedFilename();
  const ext = file.split('.').pop();
  await d.saveAs(`${OUT}/${name}-${label}.${ext}`);
  const row = { name, label, hq, file, clickToBlobMs: res.ms, hqRenderReadbackMs: hq ? res.hqMs : null, hqSplit: hq ? res.tm : null, bytes: fs.statSync(`${OUT}/${name}-${label}.${ext}`).size };
  console.log(JSON.stringify(row));
  fs.appendFileSync(`${OUT}/timings.jsonl`, JSON.stringify(row) + '\n');
  // overlay báo "saved" rồi tự đóng sau 1,5 s; chờ đóng hẳn mới mở lại
  // F2b: trang không phát 'snapshot:saved' sau khi tải về -> overlay kẹt 'capturing'; thoát bằng Esc
  const btn = page.locator('button[aria-label="Take snapshot"]');
  if (!(await btn.waitFor({ state: 'detached', timeout: 3_000 }).then(() => true, () => false))) {
    console.log('OVERLAY_STUCK', name, label);
    await page.keyboard.press('Escape');
    await btn.waitFor({ state: 'detached', timeout: 10_000 });
  }
}

for (const [name, fx] of [['F1', () => fixtureF1({ ext: true })], ['F5', fixtureF5]] as [string, () => Fixture][]) {
  test(`f2 ${name}`, async ({ page }) => {
    test.setTimeout(300_000);
    fs.mkdirSync(OUT, { recursive: true });
    const depthErrs = { beforeCapture: 0, afterCapture: 0 };
    let capturing = false;
    page.on('console', (m) => {
      const t = m.text();
      if (/sample count/i.test(t)) {
        if (capturing) depthErrs.afterCapture++;
        else depthErrs.beforeCapture++;
        if (depthErrs.beforeCapture + depthErrs.afterCapture <= 2) console.log('DEPTHERR', t.slice(0, 600));
      } else if (m.type() === 'error') console.log('CONSOLE', t.slice(0, 300));
    });
    page.on('pageerror', (e) => console.log('PAGEERR', e.message.slice(0, 300)));
    await page.addInitScript(INIT);
    await installFakeApi(page, { projectId: PROJECT_ID, graphDoc: fx().doc as unknown as WireGraphDocument });
    await page.goto(`/editor3d.html?project=${PROJECT_ID}&probe=1`);
    await page.waitForFunction(() => { const p = (window as unknown as HookWindow).__pascalProbe; return p?.ready() && (p.counts().wall ?? 0) > 0; }, null, { timeout: 150_000 });
    await page.waitForTimeout(5_000);
    capturing = true;
    if (process.env.F2_HQ_FIRST) {
      // F2b: HQ là lần chụp đầu tiên của phiên (lạnh thật: pipeline chụp chưa dựng)
      await shoot(page, name, 'cao-lanh0', true);
      await shoot(page, name, 'cao-am0', true);
      await shoot(page, name, 'thuong0', false);
    } else {
      await shoot(page, name, 'thuong', false);
      await shoot(page, name, 'cao-lanh', true);
      await shoot(page, name, 'cao-am', true);
    }
    console.log(JSON.stringify({ name, depthErrs }));
    fs.appendFileSync(`${OUT}/timings.jsonl`, JSON.stringify({ name, depthErrs }) + '\n');
    expect(fs.readdirSync(OUT).some((f) => f.startsWith(`${name}-thuong`))).toBe(true);
  });
}
