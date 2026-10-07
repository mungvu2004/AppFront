import { spawn, spawnSync } from 'node:child_process';
import fs from 'node:fs';
import http from 'node:http';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import process from 'node:process';

import { warmDevServer } from './warm-dev-server.mjs';

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
/** Trần cho bước làm ấm — xem `warm-dev-server.mjs`. */
const WARM_UP_TIMEOUT_MS = 180_000;

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
/*
 * `E2E_SKIP_PASCAL=1` — bỏ lượt dựng ấy khi đang lặp trên MỘT màn không phải Pascal.
 *
 * Đo 01-10-2026, một lượt `pnpm e2e e2e/smoke.spec.ts`: **100 s** tổng, trong đó vách
 * ngăn Pascal `built in 56,87 s` và bài test chạy **6,3 s**. Tức 94 % thời gian chờ là
 * dựng, và hơn một nửa là dựng một thứ màn ấy không chạm tới. Lặp hai mươi lượt trên một
 * màn là mất gần hai mươi phút cho không.
 *
 * **Chốt an toàn, và nó là phần quan trọng hơn cái cờ:** chỉ bỏ khi
 * `public/assets/pascal/pascal-mount.js` ĐÃ có. Thiếu tệp ấy thì màn Pascal rơi trạng thái
 * `PASCAL-01` — một bài đỏ vì hạ tầng, trông y như một bài đỏ vì sản phẩm. Đó đúng là loại
 * lỗi cả kế hoạch này tồn tại để chặn, nên cờ không được phép tạo ra nó: xin bỏ mà chưa có
 * tệp thì runner **vẫn dựng** và nói ra vì sao.
 *
 * Đừng đặt cờ này khi chạy cả bộ, và đừng đặt nó trong CI — ở đó lượt dựng là bắt buộc.
 */
const pascalEntry = path.join(projectRoot, 'public', 'assets', 'pascal', 'pascal-mount.js');
const skipAsked = process.env.E2E_SKIP_PASCAL === '1';
const pascalEntryExists = fs.existsSync(pascalEntry);

if (skipAsked && !pascalEntryExists) {
  console.warn(
    'E2E_SKIP_PASCAL=1 bị bỏ qua: chưa có public/assets/pascal/pascal-mount.js, nên vẫn dựng'
    + ' vách ngăn. Bỏ bước này lúc thiếu tệp sẽ cho một bài đỏ PASCAL-01 trông như lỗi sản phẩm.',
  );
}

if (skipAsked && pascalEntryExists) {
  console.log(
    'Bỏ lượt dựng vách ngăn Pascal (E2E_SKIP_PASCAL=1); dùng bản đang có trong'
    + ' public/assets/pascal. Đừng dùng cờ này khi chạy cả bộ.',
  );
} else {
  const pascalResult = spawnSync(packageRunner, ['run', 'pascal'], {
    cwd: projectRoot,
    shell: useShell,
    stdio: 'inherit',
  });

  if (pascalResult.status !== 0) {
    console.error('Không dựng được vách ngăn Pascal; bài e2e của màn Pascal sẽ đỏ.');
    process.exit(pascalResult.status ?? 1);
  }
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
  // Lạnh hoàn toàn (không `node_modules/.vite`) đo được 28,6 s / 891 module / 2 lượt
  // trên máy dev — trần 180 s chừa chỗ cho máy tải cao, và quá trần là DỪNG.
  await warmDevServer(baseUrl, { timeoutMs: WARM_UP_TIMEOUT_MS });
  const result = await runCommand(packageRunner, ['exec', 'playwright', 'test', ...testArgs]);
  exitCode = result.code;
} finally {
  if (serverProcess !== undefined) {
    stopProcessTree(serverProcess);
  }
}

process.exitCode = exitCode;
