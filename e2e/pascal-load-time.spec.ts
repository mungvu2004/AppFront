/**
 * Tốc độ nạp mô hình 3D của màn editor (`editor3d.html`). Không có ngưỡng đỏ: chỉ in số + ghi file.
 *
 * Đo trên BẢN DỰNG (dev server nạp hàng nghìn module rời, số sai lệch):
 *   npx vite build && npx vite preview --port 4199 --strictPort
 *   E2E_PORT=4199 npx playwright test e2e/pascal-load-time.spec.ts --workers=1
 * Chỉ đo nạp lạnh: `page.route` (máy chủ giả) làm Playwright tắt cache HTTP, nên không đo được lượt
 * mở lại có cache. LOAD_RUNS đổi số lượt mỗi nhánh (mặc định 5), LOAD_OUT đổi thư mục kết quả.
 *
 * Mốc (ms, tính từ đầu điều hướng — `performance.now()` của trang):
 * - `dcl`: HTML + JS khởi động đã chạy (DOMContentLoaded).
 * - `graph`: phản hồi `/spatial` (đồ thị dự án) về tới trang.
 * - `firstFrame`: renderer vẽ khung đầu (móc `__THREE_DEVTOOLS__`, như `pascal-realism-bench`).
 * - `walls`: tường đã có trong cảnh (đồ thị đã đổi xong), chưa chờ mô hình đồ đạc.
 * - `ready`: đầu dò báo cảnh dựng xong — có tường, mọi item đã tải xong mô hình (hoặc hỏng hẳn).
 * - `settled`: request tài nguyên cuối cùng (vật liệu, HDRI, mô hình) kết thúc, xét 5 s sau `ready`.
 * `longTaskMs` = tổng long task (>50 ms) trước `ready` — lúc ấy trang đơ.
 */
import fs from 'node:fs';
import path from 'node:path';

import { test } from '@playwright/test';
import type { Browser, Page } from '@playwright/test';

import { fixtureF1, fixtureF5, type Fixture } from '../src/lib/pascal/__fixtures__';

import { installFakeApi, type WireGraphDocument } from './fixtures/fakeApi';

const PROJECT_ID = 'P-FIXTURE0001';
const RUNS = Number(process.env.LOAD_RUNS ?? 5);
const OUT = process.env.LOAD_OUT ?? 'F:/App/qa-results/perf-load-editor3d';
/** Mạng chậm cho nhánh `throttled`: ~20 Mbit/s, 40 ms trễ — wifi văn phòng bình thường. */
const SLOW_NET = { offline: false, latency: 40, downloadThroughput: (20e6 / 8), uploadThroughput: (5e6 / 8) };

test.use({
  headless: false,
  viewport: { width: 1920, height: 1080 },
  launchOptions: {
    args: ['--disable-features=CalculateNativeWinOcclusion', '--disable-backgrounding-occluded-windows', '--force_high_performance_gpu'],
  },
});

const FIXTURES: readonly (readonly [string, () => Fixture])[] = [
  ['F1-apartment-furnished', () => fixtureF1({ ext: true })],
  ['F5-building-4floors', fixtureF5],
];

interface Marks {
  firstFrame: number | null;
  /** Lần đầu đầu dò thấy tường trong store (đồ thị đã đổi thành cảnh), chưa chờ đồ đạc. */
  walls: number | null;
  ready: number | null;
  longTaskMs: number;
}

/** Chạy trước mọi script của trang: bắt renderer, rồi mỗi khung xét khung đầu + `ready`. */
const INIT = () => {
  const w = window as unknown as {
    __THREE_DEVTOOLS__?: EventTarget;
    __pascalProbe?: { ready(): boolean; counts(): Record<string, number> };
    __load: Marks;
  };
  const marks: Marks = { firstFrame: null, walls: null, ready: null, longTaskMs: 0 };
  w.__load = marks;
  const renderers: { info?: { frame?: number; render?: { frame?: number } } }[] = [];
  const hook = new EventTarget();
  hook.addEventListener('observe', (e) => {
    const d = (e as CustomEvent).detail as { isScene?: boolean; info?: unknown; render?: unknown } | undefined;
    if (d && !d.isScene && d.info && d.render) renderers.push(d as never);
  });
  w.__THREE_DEVTOOLS__ = hook;
  new PerformanceObserver((list) => {
    if (marks.ready !== null) return;
    for (const t of list.getEntries()) marks.longTaskMs += t.duration;
  }).observe({ type: 'longtask', buffered: true });
  const tick = (t: number) => {
    if (marks.firstFrame === null && renderers.some((r) => (r.info?.render?.frame ?? r.info?.frame ?? 0) > 0)) marks.firstFrame = t;
    const p = w.__pascalProbe;
    if (marks.walls === null && (p?.counts().wall ?? 0) > 0) marks.walls = t;
    if (p?.ready() && (p.counts().wall ?? 0) > 0) marks.ready = t;
    else requestAnimationFrame(tick);
  };
  requestAnimationFrame(tick);
};

const kindOf = (url: string): string => {
  const ext = new URL(url).pathname.split('.').pop()?.toLowerCase() ?? '';
  if (ext === 'js' || ext === 'mjs') return 'js';
  if (ext === 'css') return 'css';
  if (['glb', 'gltf', 'bin', 'drc'].includes(ext)) return 'model';
  if (['ktx2', 'webp', 'png', 'jpg', 'jpeg', 'avif'].includes(ext)) return 'texture';
  if (['hdr', 'exr'].includes(ext)) return 'hdri';
  if (ext === 'wasm') return 'wasm';
  return 'other';
};

async function loadOnce(page: Page, fixture: Fixture) {
  await page.goto(`/editor3d.html?project=${PROJECT_ID}&probe=1`);
  await page.waitForFunction(() => (window as unknown as { __load: Marks }).__load.ready !== null, null, { timeout: 180_000 });
  await page.waitForTimeout(5_000);
  return page.evaluate(() => {
    const marks = (window as unknown as { __load: Marks }).__load;
    const nav = performance.getEntriesByType('navigation')[0] as PerformanceNavigationTiming;
    const res = performance.getEntriesByType('resource') as PerformanceResourceTiming[];
    const graph = res.find((r) => r.name.includes('/spatial'));
    return {
      dcl: Math.round(nav.domContentLoadedEventEnd),
      graph: graph ? Math.round(graph.responseEnd) : null,
      firstFrame: marks.firstFrame && Math.round(marks.firstFrame),
      walls: marks.walls && Math.round(marks.walls),
      ready: marks.ready && Math.round(marks.ready),
      settled: Math.round(Math.max(...res.map((r) => r.responseEnd))),
      longTaskMs: Math.round(marks.longTaskMs),
      resources: res.map((r) => ({ url: r.name, bytes: r.transferSize, decoded: r.decodedBodySize, end: Math.round(r.responseEnd) })),
    };
  }).then((r) => ({ ...r, wallCount: fixture.expected.walls, itemCount: fixture.expected.furniture }));
}

async function newPage(browser: Browser, fixture: Fixture, slow: boolean) {
  const context = await browser.newContext({ viewport: { width: 1920, height: 1080 } });
  const page = await context.newPage();
  await page.addInitScript(INIT);
  await installFakeApi(page, { projectId: PROJECT_ID, graphDoc: fixture.doc as unknown as WireGraphDocument });
  if (slow) {
    const cdp = await context.newCDPSession(page);
    await cdp.send('Network.enable');
    await cdp.send('Network.emulateNetworkConditions', SLOW_NET);
  }
  return { context, page };
}

const median = (xs: (number | null)[]) => {
  const v = xs.filter((x): x is number => x !== null).sort((a, b) => a - b);
  return v.length ? v[Math.floor(v.length / 2)] : null;
};

test('tốc độ nạp mô hình 3D của editor', async ({ browser }) => {
  test.setTimeout(30 * 60_000);
  const rows: Record<string, unknown>[] = [];
  const detail: Record<string, unknown> = {};

  for (const [name, make] of FIXTURES) {
    const fixture = make();
    const arms: [string, boolean][] = [['cold', false], ['throttled-cold', true]];
    for (const [arm, slow] of arms) {
      const runs = [];
      const n = arm === 'throttled-cold' ? 1 : RUNS;
      for (let i = 0; i < n; i++) {
        const { context, page } = await newPage(browser, fixture, slow);
        runs.push(await loadOnce(page, fixture));
        await context.close();
      }
      const pick = (k: 'dcl' | 'graph' | 'firstFrame' | 'walls' | 'ready' | 'settled' | 'longTaskMs') => median(runs.map((r) => r[k]));
      const bytesBy: Record<string, number> = {};
      for (const r of runs[0].resources) bytesBy[kindOf(r.url)] = (bytesBy[kindOf(r.url)] ?? 0) + r.bytes;
      const row = {
        fixture: name, arm, runs: n,
        dcl: pick('dcl'), graph: pick('graph'), firstFrame: pick('firstFrame'), walls: pick('walls'), ready: pick('ready'),
        settled: pick('settled'), longTaskMs: pick('longTaskMs'),
        requests: runs[0].resources.length,
        transferMB: +(Object.values(bytesBy).reduce((a, b) => a + b, 0) / 1e6).toFixed(2),
        bytesByKindKB: Object.fromEntries(Object.entries(bytesBy).map(([k, v]) => [k, Math.round(v / 1e3)])),
        readyAll: runs.map((r) => r.ready),
      };
      rows.push(row);
      detail[`${name}/${arm}`] = runs;
      console.log(JSON.stringify(row));
    }
  }

  fs.mkdirSync(OUT, { recursive: true });
  const stamp = new Date().toISOString().replace(/[:.]/g, '-');
  fs.writeFileSync(path.join(OUT, `load-${stamp}.json`), JSON.stringify({ rows, detail }, null, 2));
});
