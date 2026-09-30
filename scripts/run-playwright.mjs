import { spawn, spawnSync } from 'node:child_process';
import http from 'node:http';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import process from 'node:process';

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
/*
 * Cổng của máy chủ dev, lấy từ `E2E_PORT` chứ không viết cứng.
 *
 * Hai worktree cùng chạy `pnpm e2e` đều lấy 5173 — và nhánh "máy chủ đã chạy
 * sẵn" bên dưới trước đây chỉ cảnh báo rồi chạy tiếp, nên worker thứ hai đi
 * kiểm mã của worker thứ nhất và báo XANH. Không đỏ, không xung đột, không dấu
 * vết. Đặt `E2E_PORT` là nói "tôi muốn cổng riêng", nên từ lượt này việc cổng
 * đã có người là một lỗi, không phải một dòng cảnh báo.
 *
 * ## `E2E_PORT` cô lập CỔNG, không cô lập THƯ MỤC DỰNG
 *
 * Đo 2026-09-30: hai lượt `pnpm e2e` song song trong **cùng một worktree**, hai cổng
 * khác nhau, vẫn đụng nhau — nhưng ở chỗ khác. `vite.pascal.config.ts:65-66` dựng vách
 * ngăn vào `public/assets/pascal` với `emptyOutDir: true`, và `pnpm pascal` chạy ở đầu
 * mỗi lượt, nên một lượt đang ghi trong lúc lượt kia đang xoá sạch:
 *
 *     EPERM, Permission denied: …\publicssets\pascalloorplan-tool-*.js
 *         at emptyDir (…vite…) ← prepareOutDir
 *
 * Lỗi này ồn ào (exit 1, thông báo rõ) nên nó không nguy hiểm như lỗi cổng ở trên. Nhưng
 * đừng đọc `E2E_PORT` thành "chạy bao nhiêu lượt song song cũng được": nó để hai
 * **worktree** không đi kiểm mã của nhau. Trong một worktree, **một lượt một lúc**.
 */
const port = process.env.E2E_PORT ?? '5173';
const portWasRequested = process.env.E2E_PORT !== undefined;
const baseUrl = `http://127.0.0.1:${port}`;
const useShell = process.platform === 'win32';
const packageRunner = process.platform === 'win32' ? 'pnpm.cmd' : 'pnpm';
const testArgs = process.argv.slice(2);

const requestUrl = (url) =>
  new Promise((resolve) => {
    const request = http.get(url, (response) => {
      response.resume();
      resolve(response.statusCode !== undefined && response.statusCode < 500);
    });

    request.on('error', () => resolve(false));
    request.setTimeout(1000, () => {
      request.destroy();
      resolve(false);
    });
  });

const waitForServer = async (url, timeoutMs) => {
  const startedAt = Date.now();

  while (Date.now() - startedAt < timeoutMs) {
    if (await requestUrl(url)) {
      return;
    }

    await new Promise((resolve) => {
      setTimeout(resolve, 250);
    });
  }

  throw new Error(`Timed out waiting for ${url}`);
};

const stopProcessTree = (childProcess) => {
  if (childProcess.pid === undefined) {
    return;
  }

  if (process.platform === 'win32') {
    spawnSync('taskkill', ['/pid', String(childProcess.pid), '/t', '/f'], { stdio: 'ignore' });
    return;
  }

  try {
    process.kill(-childProcess.pid, 'SIGTERM');
  } catch {
    childProcess.kill('SIGTERM');
  }
};

const runCommand = (command, args) =>
  new Promise((resolve) => {
    const childProcess = spawn(command, args, {
      cwd: projectRoot,
      env: { ...process.env, PLAYWRIGHT_HTML_OPEN: 'never' },
      shell: useShell,
      stdio: 'inherit',
    });

    childProcess.on('error', () => {
      resolve({ code: 1, signal: null });
    });

    childProcess.on('exit', (code, signal) => {
      resolve({ code: code ?? 1, signal });
    });
  });

/*
 * Vách ngăn Pascal phải có TRƯỚC khi máy chủ chạy.
 *
 * `e2e/pascal-viewer.spec.ts` nạp `/assets/pascal/pascal-mount.js` lúc chạy —
 * một tệp tĩnh do lượt dựng thứ hai sinh ra, không phải thứ Vite dịch từ `src`.
 * Script này gọi thẳng `vite`, KHÔNG đi qua `pnpm dev` (vốn đã tự chạy
 * `pnpm pascal`), nên trên một bản checkout sạch thư mục ấy rỗng và bài e2e sẽ
 * đỏ vì `PASCAL-01` chứ không vì màn hỏng.
 *
 * Chạy lại rẻ khi đã có: `cpSync` chép đè và `vite build` đọc cache.
 */
const pascalResult = spawnSync(packageRunner, ['run', 'pascal'], {
  cwd: projectRoot,
  shell: useShell,
  stdio: 'inherit',
});

if (pascalResult.status !== 0) {
  console.error('Không dựng được vách ngăn Pascal; bài e2e của màn Pascal sẽ đỏ.');
  process.exit(pascalResult.status ?? 1);
}

const serverWasRunning = await requestUrl(baseUrl);
if (serverWasRunning) {
  if (portWasRequested) {
    console.error(
      `Cổng ${port} đã có người. E2E_PORT được đặt tường minh nên lượt này DỪNG:`
      + ' chạy tiếp là đi kiểm mã của một worktree khác và báo xanh.',
    );
    process.exit(1);
  }

  console.warn(
    'Cảnh báo: máy chủ Vite đã chạy sẵn. Bài e2e cần VITE_USE_MOCK_API=true; máy chủ này có thể chưa bật cờ đó.',
  );
}
const serverProcess = serverWasRunning
  ? undefined
  : spawn(packageRunner, ['exec', 'vite', '--host', '127.0.0.1', '--port', port, '--strictPort'], {
      cwd: projectRoot,
      detached: process.platform !== 'win32',
      env: { ...process.env, VITE_USE_MOCK_API: 'true' },
      shell: useShell,
      stdio: 'ignore',
    });

serverProcess?.unref();

let exitCode = 1;

try {
  await waitForServer(baseUrl, 120_000);
  const result = await runCommand(packageRunner, ['exec', 'playwright', 'test', ...testArgs]);
  exitCode = result.code;
} finally {
  if (serverProcess !== undefined) {
    stopProcessTree(serverProcess);
  }
}

process.exitCode = exitCode;
