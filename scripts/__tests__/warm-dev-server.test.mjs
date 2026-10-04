import { describe, expect, it } from 'vitest';

import { extractImports } from '../warm-dev-server.mjs';

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
