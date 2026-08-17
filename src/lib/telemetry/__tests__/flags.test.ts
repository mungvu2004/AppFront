import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { MAX_TELEMETRY_CODE_LENGTH, TELEMETRY_CODE_PATTERN } from '../events';
import {
  FEATURE_FLAGS,
  FEATURE_FLAG_KEYS,
  FEATURE_FLAG_KEY_PATTERN,
  MAX_FEATURE_FLAG_KEY_LENGTH,
  FEATURE_FLAG_PANEL_PROPERTY,
  FEATURE_FLAG_PRECEDENCE,
  FEATURE_FLAG_STORAGE_KEY,
  __resetFeatureFlagsForTests,
  buildFeatureFlagTable,
  clearFeatureFlagOverride,
  clearFeatureFlagOverrides,
  configureFeatureFlags,
  featureFlagDefaults,
  findFlagsThatHideFailures,
  findOverdueFeatureFlags,
  getFeatureFlag,
  getFeatureFlagDiagnostics,
  getFeatureFlagResolution,
  getFeatureFlagsSnapshot,
  installFeatureFlagDevPanel,
  isFeatureFlagKey,
  loadServerFeatureFlags,
  markServerFeatureFlagsUnavailable,
  parseFeatureFlagPayload,
  resolveAllFeatureFlags,
  resolveFeatureFlag,
  setFeatureFlagOverride,
  setServerFeatureFlags,
  subscribeFeatureFlags,
  type FeatureFlagDefinition,
  type FeatureFlagDevPanel,
  type FeatureFlagKey,
  type FeatureFlagLogger,
  type FeatureFlagStorage,
  type FeatureFlagTableRow,
} from '../flags';

/* -------------------------------------------------------------------------- */
/* Fixtures.                                                                   */
/* -------------------------------------------------------------------------- */

const SHADOWS: FeatureFlagKey = 'scene.soft-shadows';
const WALLS: FeatureFlagKey = 'scene.instanced-walls';
const RULES: FeatureFlagKey = 'rules.parallel-run';

/** A day before every removal date in the table, and one long after. */
const TODAY = '2026-08-17';
const A_DAY_LONG_AFTER = '2030-01-01';

/** Strings a diagnostic must never repeat back. See `../events.ts`. */
const PRIVATE_FILE_NAME = 'Bản vẽ nhà anh Ba.pdf';

/** A `localStorage` that lives in a variable, so a test can look inside it. */
function createMemoryStorage(seed: Record<string, string> = {}): FeatureFlagStorage & { readonly map: Map<string, string> } {
  const map = new Map<string, string>(Object.entries(seed));

  return {
    map,
    getItem: (key) => map.get(key) ?? null,
    setItem: (key, value) => {
      map.set(key, value);
    },
    removeItem: (key) => {
      map.delete(key);
    },
  };
}

/** A storage that refuses everything, the way a locked-down browser does. */
const hostileStorage: FeatureFlagStorage = {
  getItem: () => {
    throw new Error('storage is not available');
  },
  setItem: () => {
    throw new Error('storage is not available');
  },
  removeItem: () => {
    throw new Error('storage is not available');
  },
};

function createLogger(): FeatureFlagLogger & {
  readonly tables: FeatureFlagTableRow[][];
  readonly messages: string[];
} {
  const tables: FeatureFlagTableRow[][] = [];
  const messages: string[] = [];

  return {
    tables,
    messages,
    table: (rows) => {
      tables.push([...rows]);
    },
    info: (message) => {
      messages.push(message);
    },
  };
}

/** Install a panel on a plain object and hand back the panel itself. */
function installPanelOn(
  host: Record<string, unknown>,
  logger: FeatureFlagLogger,
): { panel: FeatureFlagDevPanel; uninstall: () => void } {
  const uninstall = installFeatureFlagDevPanel({ enabled: true, globalObject: host, logger, today: () => TODAY });

  return { panel: host[FEATURE_FLAG_PANEL_PROPERTY] as FeatureFlagDevPanel, uninstall };
}

beforeEach(() => {
  __resetFeatureFlagsForTests();
  // No ambient browser storage in a test: every case says what it wants.
  configureFeatureFlags({ allowOverrides: true, storage: null });
});

afterEach(() => {
  __resetFeatureFlagsForTests();
});

/* -------------------------------------------------------------------------- */
/* The table.                                                                  */
/* -------------------------------------------------------------------------- */

describe('the flag table', () => {
  it('lists every flag exactly once, under its own key', () => {
    expect(Object.keys(FEATURE_FLAGS).sort()).toEqual([...FEATURE_FLAG_KEYS].sort());
    expect(new Set(FEATURE_FLAG_KEYS).size).toBe(FEATURE_FLAG_KEYS.length);

    for (const key of FEATURE_FLAG_KEYS) {
      expect(FEATURE_FLAGS[key].key).toBe(key);
    }
  });

  it('gives every flag a removal date that is a real calendar day', () => {
    for (const key of FEATURE_FLAG_KEYS) {
      const { removeBy } = FEATURE_FLAGS[key];

      expect(removeBy).toMatch(/^\d{4}-\d{2}-\d{2}$/);
      expect(Number.isNaN(Date.parse(removeBy))).toBe(false);
      expect(new Date(removeBy).toISOString().slice(0, removeBy.length)).toBe(removeBy);
    }
  });

  it('describes every flag in Vietnamese', () => {
    for (const key of FEATURE_FLAG_KEYS) {
      const { description } = FEATURE_FLAGS[key];

      expect(description.length).toBeGreaterThan(20);
      expect(description).toMatch(/[àáảãạăâđêôơư]/i);
    }
  });

  it('names flags in the wire-safe code shape', () => {
    for (const key of FEATURE_FLAG_KEYS) {
      expect(key).toMatch(TELEMETRY_CODE_PATTERN);
      expect(key.length).toBeLessThanOrEqual(MAX_TELEMETRY_CODE_LENGTH);
    }
  });

  it('holds a key shape identical to a telemetry code, without importing one', () => {
    // The copy in `flags.ts` exists to keep zod out of the application bundle;
    // this is the guard that stops the two definitions drifting apart.
    expect(FEATURE_FLAG_KEY_PATTERN.source).toBe(TELEMETRY_CODE_PATTERN.source);
    expect(FEATURE_FLAG_KEY_PATTERN.flags).toBe(TELEMETRY_CODE_PATTERN.flags);
    expect(MAX_FEATURE_FLAG_KEY_LENGTH).toBe(MAX_TELEMETRY_CODE_LENGTH);
  });

  it('defaults every heavy feature to off', () => {
    expect(featureFlagDefaults()).toEqual({
      'scene.instanced-walls': false,
      'scene.soft-shadows': false,
      'rules.parallel-run': false,
      'export.pdf-vector': false,
      'qc.live-collaboration': false,
    });
  });

  it('recognises its own keys and nothing else', () => {
    expect(isFeatureFlagKey(SHADOWS)).toBe(true);
    expect(isFeatureFlagKey('scene.hard-shadows')).toBe(false);
    expect(isFeatureFlagKey(42)).toBe(false);
    expect(isFeatureFlagKey(null)).toBe(false);
  });
});

describe('a flag may not hide a failure', () => {
  it('finds nothing wrong with the shipped table', () => {
    expect(findFlagsThatHideFailures()).toEqual([]);
  });

  it('catches a flag whose name says it suppresses something', () => {
    const table: Record<string, FeatureFlagDefinition> = {
      'upload.skip-error': {
        key: WALLS,
        defaultValue: false,
        description: 'Bỏ qua bước kiểm tra tệp tải lên.',
        removeBy: '2026-12-31',
      },
    };

    expect(findFlagsThatHideFailures(table)).toEqual(['upload.skip-error']);
  });

  it('catches a flag whose description says it hides an error', () => {
    const table: Record<string, FeatureFlagDefinition> = {
      'rules.quiet-run': {
        key: RULES,
        defaultValue: false,
        description: 'Chạy rule nhưng giấu lỗi hình học để bảng soát trông sạch hơn.',
        removeBy: '2026-12-31',
      },
    };

    expect(findFlagsThatHideFailures(table)).toEqual(['rules.quiet-run']);
  });
});

describe('removal dates', () => {
  it('finds nothing overdue today', () => {
    expect(findOverdueFeatureFlags(TODAY)).toEqual([]);
  });

  it('names every flag left behind long enough', () => {
    expect(findOverdueFeatureFlags(A_DAY_LONG_AFTER)).toEqual([...FEATURE_FLAG_KEYS]);
  });
});

/* -------------------------------------------------------------------------- */
/* The read order.                                                             */
/* -------------------------------------------------------------------------- */

describe('the read order', () => {
  it('is override, then server, then default', () => {
    expect([...FEATURE_FLAG_PRECEDENCE]).toEqual(['override', 'server', 'default']);
  });

  it('falls back to the default when nobody has an opinion', () => {
    expect(resolveFeatureFlag(SHADOWS)).toEqual({ key: SHADOWS, value: false, source: 'default' });
  });

  it('takes the server value over the default', () => {
    expect(resolveFeatureFlag(SHADOWS, { server: { [SHADOWS]: true } })).toEqual({
      key: SHADOWS,
      value: true,
      source: 'server',
    });
  });

  it('takes a development override over the server value', () => {
    const resolution = resolveFeatureFlag(SHADOWS, {
      server: { [SHADOWS]: true },
      override: { [SHADOWS]: false },
    });

    expect(resolution).toEqual({ key: SHADOWS, value: false, source: 'override' });
  });

  it('follows a caller-supplied order instead, when given one', () => {
    const resolution = resolveFeatureFlag(
      SHADOWS,
      { server: { [SHADOWS]: true }, override: { [SHADOWS]: false } },
      ['server', 'override', 'default'],
    );

    expect(resolution).toEqual({ key: SHADOWS, value: true, source: 'server' });
  });

  it('still answers when the order it was given leads nowhere', () => {
    expect(resolveFeatureFlag(SHADOWS, {}, [])).toEqual({ key: SHADOWS, value: false, source: 'default' });
  });

  it('resolves every flag at once', () => {
    const resolutions = resolveAllFeatureFlags({ server: { [WALLS]: true } });

    expect(Object.keys(resolutions).sort()).toEqual([...FEATURE_FLAG_KEYS].sort());
    expect(resolutions[WALLS]).toEqual({ key: WALLS, value: true, source: 'server' });
    expect(resolutions[SHADOWS].source).toBe('default');
  });
});

/* -------------------------------------------------------------------------- */
/* What a server said, and what it did not.                                    */
/* -------------------------------------------------------------------------- */

describe('a server that does not answer', () => {
  it('leaves every flag on its default while the request is still out', () => {
    // A promise that never settles: the state of a screen mid-request.
    const pending = loadServerFeatureFlags(() => new Promise<unknown>(() => undefined));

    expect(getFeatureFlagsSnapshot().values).toEqual(featureFlagDefaults());
    expect(getFeatureFlagsSnapshot().serverStatus).toBe('pending');
    expect(getFeatureFlag(SHADOWS)).toBe(false);
    expect(pending).toBeInstanceOf(Promise);
  });

  it('falls back to the defaults when the request fails', async () => {
    const snapshot = await loadServerFeatureFlags(() => Promise.reject(new Error('network is down')));

    expect(snapshot.values).toEqual(featureFlagDefaults());
    expect(snapshot.serverStatus).toBe('unavailable');
    expect(getFeatureFlagDiagnostics().lastFailureCode).toBe('reader-failed');
  });

  it('falls back to the defaults when the reader throws outright', async () => {
    await loadServerFeatureFlags(() => {
      throw new Error('no transport');
    });

    expect(getFeatureFlagsSnapshot().values).toEqual(featureFlagDefaults());
    expect(getFeatureFlagsSnapshot().serverStatus).toBe('unavailable');
  });

  it('falls back to the defaults when the answer is a failed Result', async () => {
    await loadServerFeatureFlags(() => ({ ok: false, error: { kind: 'network' } }));

    expect(getFeatureFlagsSnapshot().values).toEqual(featureFlagDefaults());
    expect(getFeatureFlagsSnapshot().serverStatus).toBe('unavailable');
  });

  it('tells a failed request apart from a nonsense answer', () => {
    setServerFeatureFlags({ ok: false, error: { kind: 'network' } });
    expect(getFeatureFlagDiagnostics().lastFailureCode).toBe('reader-failed');

    setServerFeatureFlags('<html>502 Bad Gateway</html>');
    expect(getFeatureFlagDiagnostics().lastFailureCode).toBe('unreadable-payload');
  });

  it('forgets a good snapshot once a later one cannot be read', () => {
    setServerFeatureFlags({ [SHADOWS]: true });
    expect(getFeatureFlag(SHADOWS)).toBe(true);

    setServerFeatureFlags('<html>502 Bad Gateway</html>');

    expect(getFeatureFlag(SHADOWS)).toBe(false);
    expect(getFeatureFlagResolution(SHADOWS).source).toBe('default');
    expect(getFeatureFlagDiagnostics().lastFailureCode).toBe('unreadable-payload');
  });

  it('says so, rather than looking like a server that answered no', () => {
    markServerFeatureFlagsUnavailable();

    expect(getFeatureFlagsSnapshot().serverStatus).toBe('unavailable');
    expect(getFeatureFlagDiagnostics().lastFailureCode).toBe('reader-failed');
  });
});

describe('reading a payload', () => {
  it('accepts a bare map, a map under `flags`, and a Result envelope', () => {
    expect(parseFeatureFlagPayload({ [SHADOWS]: true }).values).toEqual({ [SHADOWS]: true });
    expect(parseFeatureFlagPayload({ flags: { [SHADOWS]: true } }).values).toEqual({ [SHADOWS]: true });
    expect(parseFeatureFlagPayload({ ok: true, data: { flags: { [SHADOWS]: true } } }).values).toEqual({
      [SHADOWS]: true,
    });
  });

  it('keeps the flags it understood when one entry is broken', () => {
    const result = parseFeatureFlagPayload({ [SHADOWS]: true, [WALLS]: 'true', [RULES]: false });

    expect(result.values).toEqual({ [SHADOWS]: true, [RULES]: false });
    expect(result.invalidKeys).toEqual([WALLS]);
    expect(result.readable).toBe(true);
  });

  it('refuses a string that looks like a boolean rather than guessing', () => {
    setServerFeatureFlags({ [SHADOWS]: 'true' });

    expect(getFeatureFlag(SHADOWS)).toBe(false);
    expect(getFeatureFlagDiagnostics().invalidKeys).toEqual([SHADOWS]);
  });

  it('drops a key it has never heard of without touching the rest', () => {
    const result = parseFeatureFlagPayload({ [SHADOWS]: true, 'scene.ray-tracing': true });

    expect(result.values).toEqual({ [SHADOWS]: true });
    expect(result.unknownKeys).toEqual(['scene.ray-tracing']);
    expect(result.unknownKeyCount).toBe(1);
  });

  it('counts an unknown key that is not a code, but does not repeat it back', () => {
    const result = parseFeatureFlagPayload({ [PRIVATE_FILE_NAME]: true });

    expect(result.unknownKeyCount).toBe(1);
    expect(result.unknownKeys).toEqual([]);
    expect(JSON.stringify(result)).not.toContain('anh Ba');
  });

  it('caps how many unknown names it keeps', () => {
    const map: Record<string, boolean> = {};
    for (let index = 0; index < 50; index += 1) {
      map[`scene.unknown-${String(index)}`] = true;
    }

    const result = parseFeatureFlagPayload(map);

    expect(result.unknownKeyCount).toBe(50);
    expect(result.unknownKeys).toHaveLength(20);
  });

  it('never throws, whatever it is handed', () => {
    const rubbish: readonly unknown[] = [
      undefined,
      null,
      0,
      '',
      'flags',
      [],
      [SHADOWS],
      new Date(),
      () => undefined,
      { flags: null },
      { ok: true },
    ];

    for (const input of rubbish) {
      expect(() => parseFeatureFlagPayload(input)).not.toThrow();
      expect(parseFeatureFlagPayload(input).values[SHADOWS]).toBeUndefined();
    }
  });

  it('does not let a broken flag block the ones that work', () => {
    setServerFeatureFlags({ [SHADOWS]: true, [WALLS]: { enabled: true }, 'scene.ray-tracing': true });

    expect(getFeatureFlag(SHADOWS)).toBe(true);
    expect(getFeatureFlag(WALLS)).toBe(false);
    expect(getFeatureFlagsSnapshot().serverStatus).toBe('ready');
    expect(getFeatureFlagDiagnostics()).toMatchObject({
      invalidKeys: [WALLS],
      unknownKeys: ['scene.ray-tracing'],
      unknownKeyCount: 1,
    });
  });
});

/* -------------------------------------------------------------------------- */
/* Local overrides.                                                            */
/* -------------------------------------------------------------------------- */

describe('a local override', () => {
  it('overrules the server in development', () => {
    setServerFeatureFlags({ [SHADOWS]: false });
    expect(setFeatureFlagOverride(SHADOWS, true)).toBe(true);

    expect(getFeatureFlag(SHADOWS)).toBe(true);
    expect(getFeatureFlagResolution(SHADOWS).source).toBe('override');
  });

  it('does nothing at all in a production build', () => {
    configureFeatureFlags({ allowOverrides: false, storage: null });
    setServerFeatureFlags({ [SHADOWS]: true });

    expect(setFeatureFlagOverride(SHADOWS, false)).toBe(false);
    expect(getFeatureFlag(SHADOWS)).toBe(true);
    expect(getFeatureFlagResolution(SHADOWS).source).toBe('server');
    expect(getFeatureFlagsSnapshot().overridesAllowed).toBe(false);
  });

  it('gives the flag back to the server when it is cleared', () => {
    setServerFeatureFlags({ [SHADOWS]: true });
    setFeatureFlagOverride(SHADOWS, false);
    clearFeatureFlagOverride(SHADOWS);

    expect(getFeatureFlagResolution(SHADOWS)).toEqual({ key: SHADOWS, value: true, source: 'server' });
  });

  it('gives all of them back at once', () => {
    setFeatureFlagOverride(SHADOWS, true);
    setFeatureFlagOverride(WALLS, true);
    clearFeatureFlagOverrides();

    expect(getFeatureFlagDiagnostics().overrideKeys).toEqual([]);
    expect(getFeatureFlagsSnapshot().values).toEqual(featureFlagDefaults());
  });

  it('survives a reload', () => {
    const storage = createMemoryStorage();
    configureFeatureFlags({ allowOverrides: true, storage });
    setFeatureFlagOverride(SHADOWS, true);

    expect(storage.map.get(FEATURE_FLAG_STORAGE_KEY)).toBe(JSON.stringify({ [SHADOWS]: true }));

    __resetFeatureFlagsForTests();
    configureFeatureFlags({ allowOverrides: true, storage });

    expect(getFeatureFlag(SHADOWS)).toBe(true);
    expect(getFeatureFlagResolution(SHADOWS).source).toBe('override');
  });

  it('ignores a stored override for a flag the table no longer knows', () => {
    const storage = createMemoryStorage({
      [FEATURE_FLAG_STORAGE_KEY]: JSON.stringify({ 'scene.ray-tracing': true, [SHADOWS]: true }),
    });
    configureFeatureFlags({ allowOverrides: true, storage });

    expect(getFeatureFlagDiagnostics().overrideKeys).toEqual([SHADOWS]);
  });

  it('ignores stored rubbish without calling the storage broken', () => {
    const storage = createMemoryStorage({ [FEATURE_FLAG_STORAGE_KEY]: 'not json at all' });
    configureFeatureFlags({ allowOverrides: true, storage });

    expect(getFeatureFlagsSnapshot().values).toEqual(featureFlagDefaults());
    expect(getFeatureFlagDiagnostics().storageAvailable).toBe(true);
  });

  it('keeps working when the browser refuses storage, and says overrides will not survive', () => {
    configureFeatureFlags({ allowOverrides: true, storage: hostileStorage });

    expect(() => setFeatureFlagOverride(SHADOWS, true)).not.toThrow();
    // Lost on reload, live for this session — which is the right half to keep.
    expect(getFeatureFlag(SHADOWS)).toBe(true);
    expect(getFeatureFlagDiagnostics().storageAvailable).toBe(false);
  });

  it('does not let a broken storage erase why the server failed', () => {
    configureFeatureFlags({ allowOverrides: true, storage: hostileStorage });
    setServerFeatureFlags('<html>502 Bad Gateway</html>');
    setFeatureFlagOverride(SHADOWS, true);

    const diagnostics = getFeatureFlagDiagnostics();

    expect(diagnostics.lastFailureCode).toBe('unreadable-payload');
    expect(diagnostics.storageAvailable).toBe(false);
  });

  it('never opens the ambient storage when the caller names one', () => {
    __resetFeatureFlagsForTests();
    const ambient = vi.spyOn(Storage.prototype, 'getItem');

    try {
      configureFeatureFlags({ allowOverrides: true, storage: createMemoryStorage() });

      expect(ambient).not.toHaveBeenCalled();
    } finally {
      ambient.mockRestore();
    }
  });

  it('is never read at all in a production build, even when one is stored', () => {
    const storage = createMemoryStorage({ [FEATURE_FLAG_STORAGE_KEY]: JSON.stringify({ [SHADOWS]: true }) });
    configureFeatureFlags({ allowOverrides: false, storage });

    expect(getFeatureFlag(SHADOWS)).toBe(false);
    expect(getFeatureFlagDiagnostics().overrideKeys).toEqual([]);
  });
});

/* -------------------------------------------------------------------------- */
/* The store.                                                                  */
/* -------------------------------------------------------------------------- */

describe('the store', () => {
  it('hands back the same snapshot while nothing changes', () => {
    const first = getFeatureFlagsSnapshot();

    expect(getFeatureFlagsSnapshot()).toBe(first);
    expect(getFeatureFlagResolution(SHADOWS)).toBe(first.resolutions[SHADOWS]);
  });

  it('hands back a new snapshot once something does', () => {
    const first = getFeatureFlagsSnapshot();
    setServerFeatureFlags({ [SHADOWS]: true });

    expect(getFeatureFlagsSnapshot()).not.toBe(first);
  });

  it('tells subscribers when a flag changes', () => {
    const listener = vi.fn();
    const unsubscribe = subscribeFeatureFlags(listener);

    setServerFeatureFlags({ [SHADOWS]: true });
    setFeatureFlagOverride(SHADOWS, false);

    expect(listener).toHaveBeenCalledTimes(2);

    unsubscribe();
    setServerFeatureFlags({ [SHADOWS]: false });

    expect(listener).toHaveBeenCalledTimes(2);
  });

  it('keeps telling the others after one subscriber throws', () => {
    const second = vi.fn();
    subscribeFeatureFlags(() => {
      throw new Error('a subscriber blew up');
    });
    subscribeFeatureFlags(second);

    expect(() => setServerFeatureFlags({ [SHADOWS]: true })).not.toThrow();
    expect(second).toHaveBeenCalledTimes(1);
  });
});

/* -------------------------------------------------------------------------- */
/* The development panel.                                                      */
/* -------------------------------------------------------------------------- */

describe('the development panel', () => {
  it('installs nothing when it is not a development build', () => {
    const host: Record<string, unknown> = {};
    const uninstall = installFeatureFlagDevPanel({ enabled: false, globalObject: host });

    expect(host[FEATURE_FLAG_PANEL_PROPERTY]).toBeUndefined();
    expect(() => uninstall()).not.toThrow();
  });

  it('prints the table with its source, removal date and description', () => {
    const host: Record<string, unknown> = {};
    const logger = createLogger();
    setServerFeatureFlags({ [SHADOWS]: true });

    const { panel } = installPanelOn(host, logger);
    const rows = panel.list();

    expect(rows).toHaveLength(FEATURE_FLAG_KEYS.length);
    expect(logger.tables).toHaveLength(1);
    expect(rows.find((row) => row.key === SHADOWS)).toEqual({
      key: SHADOWS,
      value: true,
      source: 'server',
      defaultValue: false,
      removeBy: FEATURE_FLAGS[SHADOWS].removeBy,
      overdue: false,
      description: FEATURE_FLAGS[SHADOWS].description,
    });
  });

  it('marks a flag whose removal date has passed', () => {
    const rows = buildFeatureFlagTable(A_DAY_LONG_AFTER);

    expect(rows.every((row) => row.overdue)).toBe(true);
  });

  it('turns a flag on and off from the console', () => {
    const host: Record<string, unknown> = {};
    const { panel } = installPanelOn(host, createLogger());

    expect(panel.enable(SHADOWS)).toBe(true);
    expect(getFeatureFlag(SHADOWS)).toBe(true);

    expect(panel.disable(SHADOWS)).toBe(true);
    expect(getFeatureFlag(SHADOWS)).toBe(false);

    panel.reset();
    expect(getFeatureFlagDiagnostics().overrideKeys).toEqual([]);
  });

  it('refuses a name that is not a flag, and says which names exist', () => {
    const host: Record<string, unknown> = {};
    const logger = createLogger();
    const { panel } = installPanelOn(host, logger);

    expect(panel.enable('scene.ray-tracing')).toBe(false);
    expect(logger.messages[0]).toContain('scene.ray-tracing');
    expect(() => panel.reset('scene.ray-tracing')).not.toThrow();
  });

  it('says why a flag could not be read', () => {
    const host: Record<string, unknown> = {};
    const logger = createLogger();
    const { panel } = installPanelOn(host, logger);

    setServerFeatureFlags('<html>502 Bad Gateway</html>');

    expect(panel.diagnostics().lastFailureCode).toBe('unreadable-payload');
    expect(logger.messages.at(-1)).toContain('unavailable');
  });

  it('will not override anything in a build that forbids it', () => {
    configureFeatureFlags({ allowOverrides: false, storage: null });
    const host: Record<string, unknown> = {};
    const logger = createLogger();
    const { panel } = installPanelOn(host, logger);

    expect(panel.enable(SHADOWS)).toBe(false);
    expect(getFeatureFlag(SHADOWS)).toBe(false);
    expect(logger.messages.at(-1)).toContain('phát triển');
  });

  it('lists its own commands', () => {
    const host: Record<string, unknown> = {};
    const logger = createLogger();
    const { panel } = installPanelOn(host, logger);

    panel.help();

    expect(logger.messages.at(-1)).toContain(`${FEATURE_FLAG_PANEL_PROPERTY}.list()`);
  });

  it('puts back whatever held the property before it', () => {
    const host: Record<string, unknown> = { [FEATURE_FLAG_PANEL_PROPERTY]: 'something else' };
    const { uninstall } = installPanelOn(host, createLogger());

    uninstall();

    expect(host[FEATURE_FLAG_PANEL_PROPERTY]).toBe('something else');
  });

  it('leaves no trace when there was nothing there before', () => {
    const host: Record<string, unknown> = {};
    const { uninstall } = installPanelOn(host, createLogger());

    uninstall();

    expect(FEATURE_FLAG_PANEL_PROPERTY in host).toBe(false);
  });
});
