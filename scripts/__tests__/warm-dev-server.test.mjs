import http from 'node:http';

import { afterEach, describe, expect, it } from 'vitest';

import { extractImports, warmDevServer } from '../warm-dev-server.mjs';

describe('extractImports', () => {
  it('follows static, side-effect and lazy imports with absolute paths, once each', () => {
    const code = [
      'import __vite__cjsImport0_react from "/node_modules/.vite/deps/react.js?v=1a2b";',
      'import "/src/index.css";',
      "export * from '/src/lib/format/number.ts';",
      'const Viewer = lazy(() => import("/src/screens/viewer/Viewer3D/index.ts"));',
      'import { x } from "/src/index.css";',
      'const remote = import(/* @vite-ignore */ url);',
      'import y from "./relative.ts";',
    ].join('\n');

    expect(extractImports(code)).toEqual([
      '/node_modules/.vite/deps/react.js?v=1a2b',
      '/src/index.css',
      '/src/lib/format/number.ts',
      '/src/screens/viewer/Viewer3D/index.ts',
    ]);
  });
});

/** Máy chủ cục bộ: `handler` trả lời mọi request; trả về địa chỉ và danh sách đường dẫn đã bị gọi. */
const listen = async (handler) => {
  const paths = [];
  const server = http.createServer((request, response) => {
    paths.push(request.url);
    handler(request, response, paths);
  });
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));

  return {
    baseUrl: `http://127.0.0.1:${server.address().port}`,
    close: () => {
      server.closeAllConnections();
      return new Promise((resolve) => server.close(resolve));
    },
    paths,
  };
};

describe('extractImports — không đi ra ngoài', () => {
  it('bỏ đường dẫn bắt đầu bằng //', () => {
    expect(extractImports('import "//evil.example/x.js"; import "/src/a.ts";')).toEqual(['/src/a.ts']);
  });
});

describe('warmDevServer', () => {
  let local;

  afterEach(async () => {
    await local?.close();
  });

  it('đi lại cho tới khi hết 504 rồi ổn định, và không gọi //host', async () => {
    let depHits = 0;
    local = await listen((request, response) => {
      if (request.url === '/src/main.tsx') {
        response.end('import "/dep.js?v=1"; import "//evil.example/x.js";');
      } else if (request.url === '/dep.js?v=1') {
        depHits += 1;
        response.statusCode = depHits === 1 ? 504 : 200;
        response.end('');
      } else {
        response.end('');
      }
    });

    const result = await warmDevServer(local.baseUrl, {
      entries: ['/src/main.tsx'],
      log: () => {},
      timeoutMs: 5000,
    });

    expect(result.passes).toBe(2);
    expect(depHits).toBe(2);
    expect(local.paths.some((path) => path.includes('evil'))).toBe(false);
  });

  it('ném lỗi đúng hạn khi máy chủ treo, không đợi request vô hạn', async () => {
    local = await listen(() => {});

    const startedAt = Date.now();
    await expect(
      warmDevServer(local.baseUrl, { entries: ['/src/main.tsx'], log: () => {}, timeoutMs: 400 }),
    ).rejects.toThrow(/quá trần/);

    expect(Date.now() - startedAt).toBeLessThan(3000);
  });
});
