/**
 * Phase 10 dev routes (SCR-40) need the Vite DEV build: the eight routes of `DEV_PUBLIC_ROUTE_PATTERNS`
 * (src/routes/paths.ts:221) only exist under `import.meta.env.DEV` (src/routes/router.tsx:130,155).
 * `run-full.mjs` only brings up the prod stack, so a dev-route spec starts its own mock dev server here.
 *
 * Usage (one dev server per Playwright worker, reused by every test of that worker, killed at worker teardown):
 *   import { devTest as test, expect } from './support/p10/devServer';
 *   test('SCR-40 · FL-10D-01 · anon · …', async ({ devPage, devBaseURL }) => {
 *     await devPage.goto('/design-system');   // relative to devBaseURL
 *   });
 *
 * - `devBaseURL`: `E2E_MOCK_BASE_URL` when set and answering 200 (a server the user started), else
 *   `http://127.0.0.1:<5300 + parallelIndex>` spawned with `VITE_USE_MOCK_API=true` (src/api/appClient.ts:45 —
 *   every API call answered by `src/api/__mocks__/`, no backend needed).
 * - `devPage`: a fresh page in a fresh context (no session, desktop 1440×900) with `baseURL = devBaseURL`.
 * Never touches the f14 stack, Docker or `tests/.state`.
 */
import { spawn, type ChildProcess } from 'node:child_process';
import { join } from 'node:path';

import { test as base, expect, request, type Page } from '@playwright/test';

export { expect };

const FE_ROOT = join(import.meta.dirname, '..', '..', '..', '..');
const VITE_BIN = join(FE_ROOT, 'node_modules', 'vite', 'bin', 'vite.js');
const START_TIMEOUT_MS = 120_000;

async function answers200(url: string): Promise<boolean> {
  const ctx = await request.newContext();
  try {
    return (await ctx.get(url, { timeout: 5_000 })).status() === 200;
  } catch {
    return false;
  } finally {
    await ctx.dispose();
  }
}

async function waitUntilUp(url: string, child: ChildProcess, log: () => string): Promise<void> {
  const deadline = Date.now() + START_TIMEOUT_MS;
  while (Date.now() < deadline) {
    if (child.exitCode !== null) throw new Error(`vite exited (${child.exitCode}) before ${url} answered:\n${log()}`);
    if (await answers200(url)) return;
    // fixed-wait-ok: polling interval while a child process boots; no event to await.
    await new Promise((r) => setTimeout(r, 500));
  }
  throw new Error(`vite dev server not up at ${url} after ${START_TIMEOUT_MS} ms:\n${log()}`);
}

export const devTest = base.extend<{ devPage: Page }, { devBaseURL: string }>({
  devBaseURL: [
    async ({}, use, workerInfo) => {
      const external = process.env.E2E_MOCK_BASE_URL;
      if (external && (await answers200(`${external}/`))) {
        await use(external);
        return;
      }
      const port = 5300 + workerInfo.parallelIndex;
      const url = `http://127.0.0.1:${port}`;
      // A server left by a crashed worker on the same port is reused instead of failing on --strictPort.
      if (await answers200(`${url}/`)) {
        await use(url);
        return;
      }
      let out = '';
      const child = spawn(process.execPath, [VITE_BIN, '--host', '127.0.0.1', '--port', String(port), '--strictPort'], {
        cwd: FE_ROOT,
        env: { ...process.env, VITE_USE_MOCK_API: 'true', BROWSER: 'none' },
        stdio: ['ignore', 'pipe', 'pipe'],
      });
      child.stdout?.on('data', (d) => (out = (out + String(d)).slice(-4_000)));
      child.stderr?.on('data', (d) => (out = (out + String(d)).slice(-4_000)));
      try {
        await waitUntilUp(`${url}/`, child, () => out);
        await use(url);
      } finally {
        child.kill();
      }
    },
    { scope: 'worker', timeout: START_TIMEOUT_MS + 10_000 },
  ],
  devPage: async ({ browser, devBaseURL }, use) => {
    const context = await browser.newContext({ baseURL: devBaseURL, viewport: { width: 1440, height: 900 } });
    const page = await context.newPage();
    try {
      await use(page);
    } finally {
      await context.close();
    }
  },
});
