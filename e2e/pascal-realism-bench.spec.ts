/**
 * Bộ đo hiện trạng editor-realism (R0, GĐ0). Không có ngưỡng đỏ: chỉ in số + ghi file.
 *
 * Chạy (headed Chrome thật, máy chủ vite chính đang phục vụ `public/editor3d.html`):
 *   E2E_PORT=5391 BENCH_GPU=dgpu  npx playwright test e2e/pascal-realism-bench.spec.ts --workers=1
 *   E2E_PORT=5391 BENCH_GPU=igpu  npx playwright test e2e/pascal-realism-bench.spec.ts --workers=1
 *   BENCH_THERMAL=1 thêm hai lượt xoay 2 phút (mặc định, `?disable=ao`) — thử nhiệt RÚT GỌN.
 *   BENCH_OUT đổi thư mục kết quả (mặc định F:/App-review/editor-realism/baseline).
 *
 * Nguồn số: renderer + scene lấy qua móc `__THREE_DEVTOOLS__` của three (sự kiện `observe`),
 * không sửa mã app. Thời gian khung = delta rAF (perf-tracks `gpu-render` của `?perf` không lộ ra
 * ngoài mô-đun). Khung thật đã vẽ = chênh `renderer.info.render.frame`.
 */
import type { AdapterInfo, Bench, HookWindow, ThreeRenderer, ThreeScene } from './realism/window-hooks';
import { execFile } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';

import { expect, test } from '@playwright/test';
import type { Page } from '@playwright/test';

import { fixtureF1, fixtureF5, type Fixture } from '../src/lib/pascal/__fixtures__';

import { installFakeApi, type WireGraphDocument } from './fixtures/fakeApi';
import { POSE_NAMES, posesFor, type Bounds } from './realism/poses';

const GPU = process.env.BENCH_GPU === 'igpu' ? 'igpu' : 'dgpu';
const THERMAL = process.env.BENCH_THERMAL === '1';
const OUT = process.env.BENCH_OUT ?? 'F:/App-review/editor-realism/baseline';
const PROJECT_ID = 'P-FIXTURE0001';
const ROTATE_MS = 20_000;
const IDLE_MS = 10_000;
const THERMAL_MS = 120_000;

test.use({
  headless: false,
  viewport: { width: 1920, height: 1080 },
  launchOptions: {
    args: [
      '--disable-features=CalculateNativeWinOcclusion',
      '--disable-backgrounding-occluded-windows',
      '--enable-unsafe-webgpu',
      ...(GPU === 'dgpu' ? ['--force_high_performance_gpu'] : []),
    ],
  },
});

const PROJECTS: readonly (readonly [string, () => Fixture])[] = [
  ['F1-apartment-furnished', () => fixtureF1({ ext: true })],
  ['F5-building-4floors', fixtureF5],
];

/** Cài trước lượt goto: bắt renderer/scene, đo khung đầu. */
const INIT = () => {
  const w = window as unknown as HookWindow;
  const bench = { renderers: [] as ThreeRenderer[], scenes: [] as ThreeScene[], firstFrameMs: null as number | null } as Bench;
  w.__bench = bench;
  const hook = new EventTarget();
  hook.addEventListener('observe', (e) => {
    const d = (e as CustomEvent).detail as ThreeScene & ThreeRenderer | undefined;
    if (d?.isScene) bench.scenes.push(d);
    else if (d?.info && d?.render) bench.renderers.push(d);
  });
  w.__THREE_DEVTOOLS__ = hook;
  const poll = () => {
    const r = bench.renderers[0];
    const f = r?.info?.render?.frame ?? r?.info?.frame ?? 0;
    if (f > 0) bench.firstFrameMs = performance.now();
    else requestAnimationFrame(poll);
  };
  requestAnimationFrame(poll);
};

const rendererInfo = (page: Page) =>
  page.evaluate(async () => {
    const b = (window as unknown as HookWindow).__bench;
    const r = b.renderers.at(-1);
    const isWebGPU = !!r?.backend?.isWebGPUBackend;
    let adapter: string | null = null;
    if (isWebGPU) {
      const info = r.backend?.adapter?.info ?? (await (navigator as unknown as { gpu?: { requestAdapter(): Promise<{ info?: AdapterInfo } | null> } }).gpu?.requestAdapter())?.info;
      adapter = info ? `${info.vendor} ${info.architecture} ${info.description ?? ''}`.trim() : null;
    } else {
      const gl = r?.getContext?.();
      const ext = gl?.getExtension?.('WEBGL_debug_renderer_info');
      adapter = ext && gl ? gl.getParameter(ext.UNMASKED_RENDERER_WEBGL) : null;
    }
    return {
      navigatorGpu: 'gpu' in navigator,
      rendererCount: b.renderers.length,
      rendererType: r?.constructor?.name ?? null,
      backend: isWebGPU ? 'webgpu' : r?.backend ? 'webgl(fallback)' : r ? 'webgl' : 'none',
      adapter,
      memory: r ? { ...r.info.memory } : null,
      jsHeapMB: (performance as unknown as { memory?: { usedJSHeapSize: number } }).memory ? Math.round((performance as unknown as { memory?: { usedJSHeapSize: number } }).memory!.usedJSHeapSize / 1e6) : null,
      firstFrameMs: b.firstFrameMs ? Math.round(b.firstFrameMs) : null,
    };
  });

/** rAF delta + khung vẽ thật trong `ms`, chạy song song với `during`. */
async function sampleFrames(page: Page, ms: number, during: () => Promise<void>) {
  await page.evaluate((dur) => {
    const b = (window as unknown as HookWindow).__bench;
    const r = b.renderers.at(-1);
    const frame = () => r?.info?.render?.frame ?? r?.info?.frame ?? 0;
    b.sample = { deltas: [] as number[], f0: frame(), f1: 0, done: false };
    let last = performance.now();
    const end = last + dur;
    const tick = (t: number) => {
      b.sample.deltas.push(t - last);
      last = t;
      if (t < end) requestAnimationFrame(tick);
      else {
        b.sample.f1 = frame();
        b.sample.done = true;
      }
    };
    requestAnimationFrame(tick);
  }, ms);
  await during();
  await page.waitForFunction(() => (window as unknown as HookWindow).__bench.sample.done, null, { timeout: ms + 30_000 });
  return page.evaluate(() => {
    const s = (window as unknown as HookWindow).__bench.sample;
    const d = [...s.deltas].sort((a, b) => a - b);
    const q = (p: number) => Math.round(d[Math.min(d.length - 1, Math.floor(d.length * p))]! * 10) / 10;
    return { rafCount: d.length, p50: q(0.5), p95: q(0.95), max: q(1), renderedFrames: s.f1 - s.f0 };
  });
}

async function cpuDuring(page: Page, during: () => Promise<void>) {
  const s = await page.context().newCDPSession(page);
  await s.send('Performance.enable');
  const read = async () => {
    const { metrics } = await s.send('Performance.getMetrics');
    const v = (n: string) => metrics.find((m) => m.name === n)?.value ?? 0;
    return { task: v('TaskDuration'), at: v('Timestamp') };
  };
  const a = await read();
  await during();
  const b = await read();
  await s.detach();
  return Math.round(((b.task - a.task) / (b.at - a.at)) * 1000);
}

/** % GPU 3D của tiến trình GPU Chrome thử (bộ đếm Windows), song song với `during`. */
async function gpuUtilDuring(seconds: number, during: () => Promise<void>) {
  const script = path.resolve('e2e/realism/gpu-util.ps1');
  const util = new Promise<unknown>((resolve) =>
    execFile('powershell', ['-NoProfile', '-File', script, '-Seconds', String(seconds)], { timeout: (seconds + 30) * 1000 }, (err, out) => {
      try {
        resolve(JSON.parse(String(out).trim()));
      } catch {
        resolve({ error: String(err ?? out).slice(0, 200) });
      }
    }),
  );
  await during();
  return util;
}

async function rotate(page: Page, ms: number) {
  const cx = 960;
  const cy = 560;
  await page.mouse.move(cx - 300, cy);
  await page.mouse.down();
  const until = Date.now() + ms;
  let fwd = true;
  while (Date.now() < until) {
    await page.mouse.move(fwd ? cx + 300 : cx - 300, cy, { steps: 30 });
    fwd = !fwd;
  }
  await page.mouse.up();
}

/** Mở dự án, theo dõi mạng qua CDP (byte + 404 + bộ giải + HDRI). */
async function openProject(page: Page, fixture: Fixture, search = '') {
  const net = { bytes: 0, status: new Map<string, number>(), urls: new Map<string, string>() };
  const cdp = await page.context().newCDPSession(page);
  await cdp.send('Network.enable');
  cdp.on('Network.responseReceived', (e) => {
    net.status.set(e.requestId, e.response.status);
    net.urls.set(e.requestId, e.response.url);
  });
  cdp.on('Network.loadingFinished', (e) => (net.bytes += e.encodedDataLength));
  await page.addInitScript(INIT);
  await installFakeApi(page, { projectId: PROJECT_ID, graphDoc: fixture.doc as unknown as WireGraphDocument });
  const t0 = Date.now();
  // BENCH_PERF=1: thêm `?perf` → mẫu GPU timestamp ở `window.__pascalPerf` (R2).
  const perf = process.env.BENCH_PERF === '1' ? '&perf' : '';
  // BENCH_IDLE=off: `?disable=idle` tắt realism-idle để so trước/sau cùng tải GPU (R2).
  const perfIdle = process.env.BENCH_IDLE === 'off' ? `${perf}&disable=idle` : perf;
  await page.goto(`/editor3d.html?project=${PROJECT_ID}&probe=1${perfIdle}${search}`);
  await page.waitForFunction(
    () => {
      const p = (window as unknown as HookWindow).__pascalProbe;
      return p?.ready() && (p.counts().wall ?? 0) > 0;
    },
    null,
    { timeout: 150_000 },
  );
  const readyMs = Date.now() - t0;
  await page.waitForTimeout(4_000); // đuôi tải vật liệu/HDRI
  const list = () => [...net.urls].map(([id, url]) => ({ url, status: net.status.get(id) ?? 0 }));
  return { net, readyMs, list, cdp };
}

function bounds(walls: { start: [number, number]; end: [number, number] }[]): Bounds {
  const xs = walls.flatMap((w) => [w.start[0], w.end[0]]);
  const zs = walls.flatMap((w) => [w.start[1], w.end[1]]);
  return { minX: Math.min(...xs), maxX: Math.max(...xs), minZ: Math.min(...zs), maxZ: Math.max(...zs) };
}

/** Vật liệu "kính" trong cảnh chính + môi trường cảnh. */
const glassFacts = (page: Page) =>
  page.evaluate(() => {
    const b = (window as unknown as HookWindow).__bench;
    const count = (s: ThreeScene) => {
      let n = 0;
      s.traverse(() => n++);
      return n;
    };
    const scene = [...b.scenes].sort((a, c) => count(c) - count(a))[0];
    const seen = new Map<string, unknown>();
    scene?.traverse((o) => {
      if (!o.isMesh) return;
      for (const m of [o.material].flat()) {
        if (!m) continue;
        const glassy = /glass|kinh/i.test(`${m.name} ${o.name}`) || (m.transparent && m.opacity < 1) || (m.transmission ?? 0) > 0;
        if (!glassy) continue;
        const key = `${m.type}|${m.name}|${m.opacity}`;
        if (!seen.has(key))
          seen.set(key, {
            type: m.type,
            name: m.name,
            mesh: o.name,
            opacity: m.opacity,
            transparent: m.transparent,
            transmission: m.transmission ?? null,
            metalness: m.metalness ?? null,
            roughness: m.roughness ?? null,
            envMap: !!m.envMap,
            envMapIntensity: m.envMapIntensity ?? null,
            side: m.side,
          });
      }
    });
    return {
      sceneEnvironment: scene?.environment ? scene.environment.constructor?.name ?? 'set' : null,
      sceneBackground: scene?.background ? scene.background.constructor?.name ?? 'set' : null,
      glassMaterials: [...seen.values()],
    };
  });

function save(key: string, value: unknown) {
  fs.mkdirSync(OUT, { recursive: true });
  const file = path.join(OUT, 'metrics.json');
  const all = fs.existsSync(file) ? JSON.parse(fs.readFileSync(file, 'utf8')) : {};
  all[key] = { at: new Date().toISOString(), ...(value as object) };
  fs.writeFileSync(file, JSON.stringify(all, null, 2));
}

for (const [name, make] of PROJECTS) {
  test(`bench ${GPU} ${name}`, async ({ page }) => {
    test.setTimeout(600_000);
    const { net, readyMs, list } = await openProject(page, make());
    const info = await rendererInfo(page);
    const walls = await page.evaluate(() => (window as unknown as HookWindow).__pascalProbe.walls());
    const poses = posesFor(bounds(walls));

    const shots: string[] = [];
    for (const pose of POSE_NAMES) {
      const p = poses[pose];
      await page.evaluate((x) => (window as unknown as HookWindow).__pascalProbe.setCamera(x.position, x.target, x.fov), p);
      await page.waitForTimeout(2_500);
      const file = path.join(OUT, `${GPU === 'dgpu' ? '' : 'igpu-'}${name}-${pose}.png`);
      await page.screenshot({ path: file });
      shots.push(file);
    }
    await page.evaluate((x) => (window as unknown as HookWindow).__pascalProbe.setCamera(x.position, x.target, x.fov), poses['high-diag']);
    await page.waitForTimeout(2_000);

    let rotateFrames: Awaited<ReturnType<typeof sampleFrames>> | null = null;
    let rotateGpu: unknown = null;
    const rotateCpu = await cpuDuring(page, async () => {
      rotateGpu = await gpuUtilDuring(15, async () => {
        rotateFrames = await sampleFrames(page, ROTATE_MS, () => rotate(page, ROTATE_MS));
      });
    });
    await page.waitForTimeout(1_500);
    let idleFrames: Awaited<ReturnType<typeof sampleFrames>> | null = null;
    let idleGpu: unknown = null;
    const idleCpu = await cpuDuring(page, async () => {
      idleGpu = await gpuUtilDuring(8, async () => {
        idleFrames = await sampleFrames(page, IDLE_MS, () => page.waitForTimeout(IDLE_MS));
      });
    });
    const after = await rendererInfo(page);
    const reqs = list();
    const facts = {
      material404: reqs.filter((r) => /\/pascal\/material\//.test(r.url) && r.status >= 400).map((r) => r.url),
      any4xx: reqs.filter((r) => r.status >= 400).map((r) => `${r.status} ${r.url}`),
      decoders: reqs.filter((r) => /basis|draco|ktx2|transcoder/i.test(r.url) && !/\.ktx2$/.test(r.url)).map((r) => `${r.status} ${r.url}`),
      ktx2Count: reqs.filter((r) => /\.ktx2(\?|$)/.test(r.url)).length,
      webpMaterialCount: reqs.filter((r) => /\/pascal\/material\/.*\.webp/.test(r.url)).length,
      hdr: reqs.filter((r) => /\.hdr(\?|$)|\.exr(\?|$)/i.test(r.url)).map((r) => `${r.status} ${r.url}`),
      offOrigin: [...new Set(reqs.filter((r) => !/^(http:\/\/127\.0\.0\.1|data:|blob:)/.test(r.url)).map((r) => new URL(r.url).origin))],
      ...(await glassFacts(page)),
    };
    const result = {
      gpu: GPU,
      project: name,
      renderer: info,
      memoryAfterRotate: after.memory,
      readyMs,
      totalBytesMB: Math.round((net.bytes / 1e6) * 10) / 10,
      requestCount: reqs.length,
      rotate20s: { ...rotateFrames!, cpuTaskMsPerS: rotateCpu, gpu3dPct: rotateGpu, source: 'rAF delta' },
      idle10s: { ...idleFrames!, cpuTaskMsPerS: idleCpu, gpu3dPct: idleGpu },
      // R2: bộ đếm vẽ/bỏ của realism-idle + mẫu GPU timestamp (`?perf`), nếu trang có.
      realism: await page.evaluate(() => ({ idle: (window as unknown as HookWindow).__pascalIdle?.() ?? null, gpuRenderMs: ((window as unknown as HookWindow).__pascalPerf ?? []).slice(-120) })),
      poses,
      shots,
      facts,
    };
    console.log(JSON.stringify(result, null, 2));
    save(`${GPU}/${name}`, result);
    expect(info.rendererCount).toBeGreaterThan(0);
  });
}

if (THERMAL) {
  for (const [label, search] of [
    ['default', ''],
    ['disable-ao', '&disable=ao'],
  ] as const) {
    test(`thermal-short ${GPU} ${label}`, async ({ page }) => {
      test.setTimeout(420_000);
      let lost = false;
      page.on('console', (m) => {
        if (/device.*lost|context lost/i.test(m.text())) lost = true;
      });
      await openProject(page, fixtureF1({ ext: true }), search);
      const frames = await sampleFrames(page, THERMAL_MS, () => rotate(page, THERMAL_MS));
      const result = { gpu: GPU, label, minutes: THERMAL_MS / 60_000, note: 'rút gọn (2 phút, không phải 10)', frames, deviceLost: lost, renderer: await rendererInfo(page) };
      console.log(JSON.stringify(result));
      save(`${GPU}/thermal-${label}`, result);
    });
  }
}

// R2: đứng yên → ngừng vẽ; camera đổi (không qua chuột) / hover → vẽ lại ngay. Đếm qua `window.__pascalIdle`.
test(`r2 idle ${GPU} F1`, async ({ page }) => {
  test.skip(process.env.BENCH_IDLE === 'off', 'cờ idle đang tắt');
  test.setTimeout(180_000);
  await openProject(page, fixtureF1({ ext: true }));
  const drawn = () => page.evaluate(() => (window as unknown as HookWindow).__pascalIdle().drawn as number);
  await page.waitForTimeout(3_000); // HOLD + SETTLE_FRAMES đã qua
  const a = await drawn();
  await page.waitForTimeout(2_000);
  const stats = await page.evaluate(() => (window as unknown as HookWindow).__pascalIdle());
  console.log('r2 idle stats', JSON.stringify(stats));
  expect(stats.drawn - a, `đứng yên 2 s vẫn vẽ (${stats.lastReason})`).toBe(0);

  const walls = await page.evaluate(() => (window as unknown as HookWindow).__pascalProbe.walls());
  const p = posesFor(bounds(walls))['high-diag'];
  const b = await drawn();
  await page.evaluate((x) => (window as unknown as HookWindow).__pascalProbe.setCamera(x.position, x.target, x.fov), p);
  await page.waitForTimeout(300);
  expect(await drawn() - b, 'camera đổi mà không vẽ lại').toBeGreaterThan(0);

  await page.waitForTimeout(3_000);
  const c = await drawn();
  await page.mouse.move(960, 560, { steps: 5 });
  await page.waitForTimeout(200);
  expect(await drawn() - c, 'hover/di chuột mà không vẽ lại').toBeGreaterThan(0);

  // F1: sửa nút (store scene) → vẽ lại; rồi lại đứng yên.
  await page.mouse.move(5, 5);
  await page.waitForTimeout(3_000);
  const d = await drawn();
  await page.evaluate((id) => (window as unknown as HookWindow).__pascalProbe.editNode(id, { height: 3.1 }), walls[0]!.id);
  await page.waitForTimeout(300);
  expect(await drawn() - d, 'sửa nút mà không vẽ lại').toBeGreaterThan(0);
  await page.waitForTimeout(3_000);
  const e = await drawn();
  await page.waitForTimeout(2_000);
  console.log('f1 idle stats end', JSON.stringify(await page.evaluate(() => (window as unknown as HookWindow).__pascalIdle())));
  expect(await drawn() - e, 'sau khi sửa, đứng yên 2 s vẫn vẽ').toBe(0);
});
