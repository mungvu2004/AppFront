import { createRequire } from 'node:module';

import { RuleTester } from 'eslint';
import { describe, it } from 'vitest';

/**
 * The rule is CommonJS, because ESLint loads its plugins that way; this file is
 * ESM, because vitest runs it. `createRequire` is the bridge, and it is the only
 * reason this file is not a plain import.
 */
const requireFromHere = createRequire(import.meta.url);
const rule = requireFromHere('../no-fetch-outside-http.js') as Parameters<RuleTester['run']>[1];

/** Files inside the gate: everything that is not the transport folder. */
const LIBRARY_FILE = 'src/lib/autosave/flush.ts';
const DOMAIN_FILE = 'src/domain/walls/publish.ts';
const HOOK_FILE = 'src/hooks/useExport.ts';
const COMPONENT_FILE = 'src/components/ui/SaveButton.tsx';

/** The one folder allowed to hold a real transport. */
const TRANSPORT_FILE = 'src/lib/http/client.ts';

/** Tests and stories inject fakes on purpose. */
const TEST_FILE = 'src/lib/autosave/__tests__/flush.test.ts';
const STORY_FILE = 'src/components/ui/SaveButton.stories.tsx';

const FETCH_MESSAGE =
  'Cấm gọi fetch trực tiếp ngoài src/lib/http; đi qua client của src/lib/http hoặc nhận transport qua tham số.';
const BEACON_MESSAGE =
  'Cấm gọi navigator.sendBeacon ngoài src/lib/http; mọi truy cập mạng đi qua src/lib/http.';
const XHR_MESSAGE = 'Cấm dùng XMLHttpRequest; mọi truy cập mạng đi qua src/lib/http.';

/**
 * `env.browser` is what makes this rule's hard case reachable. It declares
 * `fetch`, `window` and `navigator`, so those names resolve to a global
 * variable instead of falling through unresolved — the exact condition the
 * rule has to handle, and the one a bare `RuleTester` without `env` would hide.
 */
const ruleTester = new RuleTester({
  parser: requireFromHere.resolve('@typescript-eslint/parser'),
  parserOptions: { ecmaVersion: 2020, sourceType: 'module' },
  env: { browser: true, es2020: true },
});

describe('local/no-fetch-outside-http', () => {
  it('is registered under a name the config can reach', () => {
    const plugin = requireFromHere('../index.js') as {
      rules: Record<string, unknown>;
      configs: { project: { rules: Record<string, unknown> } };
    };

    if (plugin.rules['no-fetch-outside-http'] !== rule) {
      throw new Error('eslint-rules/index.js chưa export no-fetch-outside-http.');
    }

    if (plugin.configs.project.rules['local/no-fetch-outside-http'] !== 'error') {
      throw new Error('Bộ luật dự án chưa bật local/no-fetch-outside-http ở mức error.');
    }
  });
});

ruleTester.run('no-fetch-outside-http', rule, {
  valid: [
    // The transport folder is where a real fetch is supposed to live.
    { code: 'const impl = globalThis.fetch.bind(globalThis); void impl;', filename: TRANSPORT_FILE },
    { code: 'export const get = (url: string) => fetch(url);', filename: TRANSPORT_FILE },

    // An injected transport is the pattern the rule exists to encourage.
    {
      code: 'export const send = (fetchImpl: typeof fetch, url: string) => fetchImpl(url);',
      filename: LIBRARY_FILE,
    },
    {
      code: 'export const flush = (options: { sendBeacon: () => void }) => { options.sendBeacon(); };',
      filename: LIBRARY_FILE,
    },
    {
      code: 'export const send = (config: { fetchImpl: typeof fetch }) => config.fetchImpl("/a");',
      filename: LIBRARY_FILE,
    },

    // A local named like a global shadows it, and is not the browser's.
    {
      code: 'export const ping = (navigator: { sendBeacon: (u: string) => boolean }) => navigator.sendBeacon("/a");',
      filename: LIBRARY_FILE,
    },

    // Probing whether an injected transport exists decides something; it opens nothing.
    {
      code: 'export const has = (windowObject?: { fetch?: unknown }) => Boolean(windowObject?.fetch);',
      filename: LIBRARY_FILE,
    },

    // Type positions name a shape.
    { code: 'export interface Options { readonly fetchImpl?: typeof fetch }', filename: LIBRARY_FILE },
    { code: 'export type Ping = Pick<Window, "fetch">;', filename: LIBRARY_FILE },

    // Tests and stories stand up fakes on purpose.
    { code: 'globalThis.fetch = vi.fn();', filename: TEST_FILE },
    { code: 'const stub = () => fetch("/a"); void stub;', filename: STORY_FILE },
  ],

  invalid: [
    // The bare global, called and merely referenced.
    {
      code: 'export const load = (url: string) => fetch(url);',
      filename: LIBRARY_FILE,
      errors: [{ message: FETCH_MESSAGE }],
    },
    {
      code: 'export const impl = fetch;',
      filename: DOMAIN_FILE,
      errors: [{ message: FETCH_MESSAGE }],
    },

    // Read off a global root: the short way to smuggle a call past a rule that
    // only watches calls.
    {
      code: 'export const impl = globalThis.fetch.bind(globalThis);',
      filename: LIBRARY_FILE,
      errors: [{ message: FETCH_MESSAGE }],
    },
    {
      code: 'export const load = (url: string) => window.fetch(url);',
      filename: HOOK_FILE,
      errors: [{ message: FETCH_MESSAGE }],
    },
    {
      code: 'export const guard = () => Boolean(globalThis.fetch);',
      filename: LIBRARY_FILE,
      errors: [{ message: FETCH_MESSAGE }],
    },

    // Called through a parameter: the receiver is not a global, but the socket
    // still opens where src/lib/http cannot see it.
    {
      code: 'export const ping = (windowObject: Pick<Window, "fetch">) => windowObject.fetch("/a");',
      filename: LIBRARY_FILE,
      errors: [{ message: FETCH_MESSAGE }],
    },

    // HTTP egress under another name.
    {
      code: 'export const flush = (body: string) => navigator.sendBeacon("/t", body);',
      filename: LIBRARY_FILE,
      errors: [{ message: BEACON_MESSAGE }],
    },
    {
      code: 'export const beacon = navigator.sendBeacon.bind(navigator);',
      filename: LIBRARY_FILE,
      errors: [{ message: BEACON_MESSAGE }],
    },
    {
      code: 'export const older = () => new XMLHttpRequest();',
      filename: LIBRARY_FILE,
      errors: [{ message: XHR_MESSAGE }],
    },

    // The view layer has no business reaching the network at all.
    {
      code: 'export const Button = () => { void fetch("/a"); return null; };',
      filename: COMPONENT_FILE,
      errors: [{ message: FETCH_MESSAGE }],
    },
  ],
});
