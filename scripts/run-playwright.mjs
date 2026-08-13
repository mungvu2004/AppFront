import { spawn, spawnSync } from 'node:child_process';
import http from 'node:http';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import process from 'node:process';

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const baseUrl = 'http://127.0.0.1:5173';
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

const serverWasRunning = await requestUrl(baseUrl);
const serverProcess = serverWasRunning
  ? undefined
  : spawn(packageRunner, ['exec', 'vite', '--host', '127.0.0.1'], {
      cwd: projectRoot,
      detached: process.platform !== 'win32',
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
