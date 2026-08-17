/// <reference types="vite/client" />

/**
 * The feature-flag table, and the one order in which a flag is decided.
 *
 * A few things this product does are expensive enough that they cannot simply
 * be shipped to everybody at once — instanced wall meshes, soft shadows, a rule
 * pass on workers. They have to be turned on for one group, watched, then the
 * next. That is the whole purpose of this module, and the purpose is worth
 * writing down because feature flags rot into two other things if nobody
 * states it:
 *
 * **A flag gates a feature for a group of people. It never hides a failure, and
 * it never lives forever.**
 *
 * Both halves are enforced here rather than asked for politely.
 * {@link FeatureFlagDefinition.removeBy} is a required field, so a flag with no
 * planned removal date does not typecheck; and {@link findFlagsThatHideFailures}
 * refuses a table whose key or description says the flag exists to silence,
 * suppress or skip something. A branch that swallows an error is a bug with a
 * switch on it — the switch does not make it less of a bug, it makes it harder
 * to find.
 *
 * ## The order a flag is read in
 *
 * {@link FEATURE_FLAG_PRECEDENCE} — local development override, then the
 * server's value, then the default written in the table. First source that has
 * an opinion wins.
 *
 * The override is first on purpose. It only exists in a development build (see
 * {@link isDevelopmentBuild}), and an override that lost to the server could
 * never turn anything off that the server had turned on, which is exactly the
 * case somebody reaches for the dev panel to test. In a production build the
 * override source is not consulted at all, so the chain there is precisely
 * server → default. The order is a parameter — {@link resolveFeatureFlag}
 * accepts one — so the decision is visible and reversible rather than baked
 * into an if-statement.
 *
 * ## Why nothing here can block a screen
 *
 * Reading a flag is synchronous and always answers: the store starts at the
 * table's defaults, and the server's snapshot is folded in whenever it happens
 * to arrive. Nothing awaits it. A server that never answers, answers with
 * rubbish, or answers with one good flag and one broken one leaves every flag
 * it did not successfully describe sitting on its default — see
 * {@link parseFeatureFlagPayload}, which drops bad entries one at a time rather
 * than refusing the batch.
 *
 * Falling back is not the same as falling back silently.
 * {@link getFeatureFlagDiagnostics} counts every entry that was dropped and why,
 * and the dev panel prints it, so "the flag is off" and "the flag could not be
 * read" are never the same sentence.
 */

/* -------------------------------------------------------------------------- */
/* The table.                                                                  */
/* -------------------------------------------------------------------------- */

/**
 * What a flag key may contain: the code shape of `./events.ts`, restated here
 * rather than imported.
 *
 * Importing `TELEMETRY_CODE_PATTERN` reads better and costs 65 kB. The
 * catalogue next door builds its zod schemas at module scope, so one import of
 * one regular expression drags zod into every bundle that reads a flag — and
 * this module is wired into application start, so that is *the* bundle. A file
 * whose job is keeping heavy things out of a page until somebody asks for them
 * cannot be the reason a parser ships to everybody.
 *
 * The copy cannot drift: `flags.test.ts` imports both and asserts they are the
 * same pattern and the same length, where a test-time zod costs nothing.
 */
export const FEATURE_FLAG_KEY_PATTERN = /^[a-z0-9][a-z0-9._-]*$/;

/** As long as a telemetry code may be: enough for a slug, too short for a note. */
export const MAX_FEATURE_FLAG_KEY_LENGTH = 48;

/**
 * Every flag this application knows, by name.
 *
 * Keys are wire-safe codes — the same lowercase-ASCII shape `./events.ts`
 * demands of a telemetry code — because a flag key travels to a server, into a
 * console and into bug reports, and none of those places should ever be able to
 * receive a sentence.
 */
export const FEATURE_FLAG_KEYS = [
  'scene.instanced-walls',
  'scene.soft-shadows',
  'rules.parallel-run',
  'export.pdf-vector',
  'qc.live-collaboration',
] as const;

export type FeatureFlagKey = (typeof FEATURE_FLAG_KEYS)[number];

/** A calendar day, `YYYY-MM-DD`. */
export type IsoDate = `${number}-${number}-${number}`;

/**
 * One row of the table.
 *
 * `removeBy` is required and has no default. A flag is a temporary fork in the
 * product kept alive by hand; the date is the promise that somebody will come
 * back and delete one of the two branches. Without it the fork is permanent,
 * and a permanent fork is just untested code with a nicer name.
 */
export interface FeatureFlagDefinition {
  readonly key: FeatureFlagKey;
  /** What happens when nobody — no server, no override — has an opinion. */
  readonly defaultValue: boolean;
  /** Mô tả tiếng Việt: cờ này bật cái gì, và vì sao nó nặng. */
  readonly description: string;
  /** Ngày dự kiến gỡ bỏ cờ (không phải hạn của tính năng). */
  readonly removeBy: IsoDate;
}

/**
 * The flags, with their defaults and their removal dates.
 *
 * Every default is `false`. That is not a coincidence and not a style: a heavy
 * feature that defaults to on is a heavy feature shipped to everybody, and the
 * fallback path — no server, no answer, broken payload — must be the cheap one.
 */
export const FEATURE_FLAGS = {
  'scene.instanced-walls': {
    key: 'scene.instanced-walls',
    defaultValue: false,
    description:
      'Dựng tường bằng lưới thực thể hoá (instanced mesh) để giảm số lệnh vẽ trên mặt bằng lớn; tốn thêm bộ nhớ GPU.',
    removeBy: '2026-10-31',
  },
  'scene.soft-shadows': {
    key: 'scene.soft-shadows',
    defaultValue: false,
    description: 'Bóng mềm trong khung nhìn 3D; đẹp hơn nhưng nặng GPU, chỉ bật cho nhóm máy mạnh.',
    removeBy: '2026-11-30',
  },
  'rules.parallel-run': {
    key: 'rules.parallel-run',
    defaultValue: false,
    description: 'Chạy bộ rule trên worker song song thay vì tuần tự trên luồng chính; nhanh hơn nhưng tốn CPU.',
    removeBy: '2026-12-31',
  },
  'export.pdf-vector': {
    key: 'export.pdf-vector',
    defaultValue: false,
    description: 'Xuất hồ sơ PDF dạng vector thay vì ảnh raster; nét hơn khi in nhưng nặng CPU với hồ sơ nhiều tầng.',
    removeBy: '2027-01-31',
  },
  'qc.live-collaboration': {
    key: 'qc.live-collaboration',
    defaultValue: false,
    description: 'Đồng bộ con trỏ và ghi chú theo thời gian thực giữa nhiều người soát; tốn băng thông và kết nối.',
    removeBy: '2027-03-31',
  },
} as const satisfies Readonly<Record<FeatureFlagKey, FeatureFlagDefinition>>;

/** Is this string one of the keys above? */
export function isFeatureFlagKey(value: unknown): value is FeatureFlagKey {
  return typeof value === 'string' && (FEATURE_FLAG_KEYS as readonly string[]).includes(value);
}

/** A partial opinion about some flags. What a server or an override carries. */
export type FeatureFlagValues = Readonly<Partial<Record<FeatureFlagKey, boolean>>>;

/** An opinion about every flag. What a caller actually reads. */
export type FeatureFlagRecord = Readonly<Record<FeatureFlagKey, boolean>>;

const buildRecord = <T>(compute: (key: FeatureFlagKey) => T): Readonly<Record<FeatureFlagKey, T>> =>
  Object.fromEntries(FEATURE_FLAG_KEYS.map((key) => [key, compute(key)])) as Readonly<Record<FeatureFlagKey, T>>;

/** The table's defaults, as a record. */
export function featureFlagDefaults(): FeatureFlagRecord {
  return buildRecord((key) => FEATURE_FLAGS[key].defaultValue);
}

/* -------------------------------------------------------------------------- */
/* A flag may not hide a failure.                                              */
/* -------------------------------------------------------------------------- */

/**
 * Words that describe suppressing something rather than shipping something.
 *
 * Checked against the key, which is English by house rule. A flag called
 * `upload.skip-error` is not a rollout; it is a `catch` block somebody gave a
 * name to so the alert would stop.
 */
export const FORBIDDEN_FLAG_KEY_WORDS = [
  'hide',
  'suppress',
  'silence',
  'mute',
  'ignore',
  'bypass',
  'swallow',
  'skip-error',
  'skip-validation',
  'disable-error',
  'workaround',
  'hotfix',
] as const;

/** The same idea in the language the descriptions are written in. */
export const FORBIDDEN_FLAG_DESCRIPTION_PHRASES = [
  'giấu lỗi',
  'ẩn lỗi',
  'che lỗi',
  'nuốt lỗi',
  'bỏ qua lỗi',
  'tắt lỗi',
  'tắt cảnh báo',
  'bỏ qua kiểm tra',
] as const;

/**
 * Which rows of a table are a suppressed failure wearing a flag's clothes.
 *
 * A word list is a blunt instrument and it is meant to be: it cannot catch a
 * determined author, only an absent-minded one, which is who this is for. The
 * test calls it on {@link FEATURE_FLAGS}, so the day somebody adds
 * `rules.ignore-invalid-geometry` the build says why.
 */
export function findFlagsThatHideFailures(
  table: Readonly<Record<string, FeatureFlagDefinition>> = FEATURE_FLAGS,
): readonly string[] {
  return Object.keys(table).filter((key) => {
    const definition = table[key];
    if (definition === undefined) {
      return false;
    }

    const description = definition.description.toLocaleLowerCase('vi');

    return (
      FORBIDDEN_FLAG_KEY_WORDS.some((word) => key.includes(word)) ||
      FORBIDDEN_FLAG_DESCRIPTION_PHRASES.some((phrase) => description.includes(phrase))
    );
  });
}

/**
 * Flags whose removal date has passed, given a day.
 *
 * Clock-free on purpose, exactly like `summariseExperience` in `./events.ts`:
 * the caller says what day it is, so the same function serves the dev panel, a
 * test and a console paste, and no test becomes a time bomb that turns CI red
 * on a date nobody chose.
 */
export function findOverdueFeatureFlags(todayIso: string): readonly FeatureFlagKey[] {
  return FEATURE_FLAG_KEYS.filter((key) => FEATURE_FLAGS[key].removeBy < todayIso);
}

/* -------------------------------------------------------------------------- */
/* Sources, and the order they are read in.                                    */
/* -------------------------------------------------------------------------- */

export const FEATURE_FLAG_SOURCES = ['override', 'server', 'default'] as const;
export type FeatureFlagSource = (typeof FEATURE_FLAG_SOURCES)[number];

/**
 * Override, then server, then default. See the module header for why the
 * override is first — briefly: it exists only in a development build, and an
 * override that could not overrule the server would not be an override.
 */
export const FEATURE_FLAG_PRECEDENCE = [
  'override',
  'server',
  'default',
] as const satisfies readonly FeatureFlagSource[];

/** What the resolver was given to work with. */
export interface FeatureFlagInputs {
  readonly server?: FeatureFlagValues | undefined;
  readonly override?: FeatureFlagValues | undefined;
}

/** A flag's value, and which source produced it. */
export interface FeatureFlagResolution {
  readonly key: FeatureFlagKey;
  readonly value: boolean;
  readonly source: FeatureFlagSource;
}

function readSource(key: FeatureFlagKey, source: FeatureFlagSource, inputs: FeatureFlagInputs): boolean | undefined {
  switch (source) {
    case 'override':
      return inputs.override?.[key];
    case 'server':
      return inputs.server?.[key];
    case 'default':
      return FEATURE_FLAGS[key].defaultValue;
    default:
      return undefined;
  }
}

/**
 * One flag, decided.
 *
 * Total by construction: `default` is the last link of the standard chain and
 * always has a value, so there is no path out of here without an answer. A
 * precedence list that omits `default` still ends on the table's default rather
 * than on `undefined` — a caller cannot configure this into returning nothing.
 */
export function resolveFeatureFlag(
  key: FeatureFlagKey,
  inputs: FeatureFlagInputs = {},
  precedence: readonly FeatureFlagSource[] = FEATURE_FLAG_PRECEDENCE,
): FeatureFlagResolution {
  for (const source of precedence) {
    const value = readSource(key, source, inputs);
    if (typeof value === 'boolean') {
      return { key, value, source };
    }
  }

  return { key, value: FEATURE_FLAGS[key].defaultValue, source: 'default' };
}

/** Every flag, decided. */
export function resolveAllFeatureFlags(
  inputs: FeatureFlagInputs = {},
  precedence: readonly FeatureFlagSource[] = FEATURE_FLAG_PRECEDENCE,
): Readonly<Record<FeatureFlagKey, FeatureFlagResolution>> {
  return buildRecord((key) => resolveFeatureFlag(key, inputs, precedence));
}

/* -------------------------------------------------------------------------- */
/* Reading what a server said.                                                 */
/* -------------------------------------------------------------------------- */

/** How many unknown key names are worth keeping for a diagnostic. */
export const MAX_REPORTED_UNKNOWN_KEYS = 20;

/** What came back from a payload, including everything that was thrown away. */
export interface FeatureFlagParseResult {
  /** Known keys that carried a real boolean. Everything else is absent. */
  readonly values: FeatureFlagValues;
  /** Was the payload something we could read flags out of at all? */
  readonly readable: boolean;
  /** Names the table does not know, capped and filtered — see below. */
  readonly unknownKeys: readonly string[];
  /** How many there were in total, including the ones not kept. */
  readonly unknownKeyCount: number;
  /** Known keys whose value was not a boolean. */
  readonly invalidKeys: readonly FeatureFlagKey[];
}

const EMPTY_PARSE_RESULT: FeatureFlagParseResult = {
  values: {},
  readable: false,
  unknownKeys: [],
  unknownKeyCount: 0,
  invalidKeys: [],
};

const isPlainObject = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

/**
 * Is this unknown key name safe to repeat back?
 *
 * An unknown key is a string a server chose, and it ends up in a console and in
 * pasted bug reports. Held to the same code shape `./events.ts` holds a
 * telemetry field to, so a server that answered with a sentence — or with
 * somebody's file name — is counted rather than quoted.
 */
function isReportableKeyName(value: string): boolean {
  return value.length <= MAX_FEATURE_FLAG_KEY_LENGTH && FEATURE_FLAG_KEY_PATTERN.test(value);
}

/**
 * Find the map of flags inside whatever the caller was handed.
 *
 * Three shapes are accepted, because all three turn up: the bare map, the map
 * under a `flags` property, and this repo's own `Result` envelope from
 * `src/lib/http` — so `await http.get(...)` can be passed straight in. A failed
 * `Result` is not a map and is refused here, which is the correct answer: no
 * flags were read, so every flag falls to its default.
 */
function findFlagMap(input: unknown): Record<string, unknown> | null {
  if (!isPlainObject(input)) {
    return null;
  }

  if (typeof input['ok'] === 'boolean') {
    return input['ok'] === true ? findFlagMap(input['data']) : null;
  }

  const nested = input['flags'];

  return isPlainObject(nested) ? nested : input;
}

/** A `Result` from `src/lib/http` that says the request did not succeed. */
function isFailedResult(input: unknown): boolean {
  return isPlainObject(input) && input['ok'] === false;
}

/**
 * A payload, reduced to the flags it actually described.
 *
 * Never throws and never refuses wholesale: one entry with the wrong type costs
 * that entry its opinion and nothing else, so a server rolling out a sixth flag
 * this client has never heard of cannot take the other five down with it.
 */
export function parseFeatureFlagPayload(input: unknown): FeatureFlagParseResult {
  const map = findFlagMap(input);
  if (map === null) {
    return EMPTY_PARSE_RESULT;
  }

  const values: Partial<Record<FeatureFlagKey, boolean>> = {};
  const unknownKeys: string[] = [];
  const invalidKeys: FeatureFlagKey[] = [];
  let unknownKeyCount = 0;

  for (const [key, value] of Object.entries(map)) {
    if (!isFeatureFlagKey(key)) {
      unknownKeyCount += 1;
      if (unknownKeys.length < MAX_REPORTED_UNKNOWN_KEYS && isReportableKeyName(key)) {
        unknownKeys.push(key);
      }

      continue;
    }

    if (typeof value !== 'boolean') {
      // Deliberately not coerced. `'true'`, `1` and `'on'` are three different
      // guesses about what a server meant, and a wrong guess turns a heavy
      // feature on for somebody who was never in the group.
      invalidKeys.push(key);

      continue;
    }

    values[key] = value;
  }

  return { values, readable: true, unknownKeys, unknownKeyCount, invalidKeys };
}

/* -------------------------------------------------------------------------- */
/* The build we are in.                                                        */
/* -------------------------------------------------------------------------- */

/**
 * Is this a development build?
 *
 * Read as a static `import.meta.env` property so Vite substitutes it and a
 * production bundle carries no override path at all; wrapped because a bare
 * Node context has no `import.meta.env` and asking must not be a way to crash
 * at import time. Fail-closed: anything other than a real `true` is production.
 */
export function isDevelopmentBuild(): boolean {
  try {
    return import.meta.env.DEV === true;
  } catch {
    return false;
  }
}

/** Are we inside the test runner? Used only to keep the dev panel out of it. */
function isTestMode(): boolean {
  try {
    return import.meta.env.MODE === 'test';
  } catch {
    return false;
  }
}

/* -------------------------------------------------------------------------- */
/* Where a local override is kept.                                             */
/* -------------------------------------------------------------------------- */

/** The `localStorage` key overrides live under. */
export const FEATURE_FLAG_STORAGE_KEY = 'appfront-feature-flags';

/** The two and a half methods of `localStorage` this module needs. */
export interface FeatureFlagStorage {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
}

/** `localStorage`, or nothing — it throws outright under some privacy modes. */
function resolveDefaultStorage(): FeatureFlagStorage | null {
  try {
    return globalThis.localStorage ?? null;
  } catch {
    return null;
  }
}

/* -------------------------------------------------------------------------- */
/* The store.                                                                  */
/* -------------------------------------------------------------------------- */

/** Whether the server's opinion has arrived. `pending` is not `unavailable`. */
export type FeatureFlagServerStatus = 'pending' | 'ready' | 'unavailable';

/**
 * Why the last *server* read failed, as a code.
 *
 * A code rather than a message, for the reason `./events.ts` gives at length: a
 * message is whatever a server happened to write, and this string is printed in
 * a console and pasted into tickets.
 *
 * Scoped to the server on purpose. A storage that will not open is a different
 * subsystem with a different consequence — overrides do not survive a reload —
 * and it is reported separately as
 * {@link FeatureFlagDiagnostics.storageAvailable}. One field holding both meant
 * the second failure erased the first from the record.
 */
export type FeatureFlagFailureCode = 'none' | 'unreadable-payload' | 'reader-failed';

/** Everything a reader needs, in one referentially stable object. */
export interface FeatureFlagsSnapshot {
  readonly values: FeatureFlagRecord;
  readonly resolutions: Readonly<Record<FeatureFlagKey, FeatureFlagResolution>>;
  readonly serverStatus: FeatureFlagServerStatus;
  readonly overridesAllowed: boolean;
}

/** What was dropped on the way here, and why. Never guesswork, always counted. */
export interface FeatureFlagDiagnostics {
  readonly serverStatus: FeatureFlagServerStatus;
  readonly lastFailureCode: FeatureFlagFailureCode;
  readonly unknownKeys: readonly string[];
  readonly unknownKeyCount: number;
  readonly invalidKeys: readonly FeatureFlagKey[];
  readonly overrideKeys: readonly FeatureFlagKey[];
  readonly overridesAllowed: boolean;
  /** Whether overrides can actually be kept — a storage that throws is not. */
  readonly storageAvailable: boolean;
}

interface FeatureFlagState {
  serverValues: FeatureFlagValues;
  overrides: FeatureFlagValues;
  serverStatus: FeatureFlagServerStatus;
  allowOverrides: boolean;
  precedence: readonly FeatureFlagSource[];
  storage: FeatureFlagStorage | null;
  storageFailed: boolean;
  unknownKeys: readonly string[];
  unknownKeyCount: number;
  invalidKeys: readonly FeatureFlagKey[];
  lastFailureCode: FeatureFlagFailureCode;
  initialised: boolean;
}

function createState(): FeatureFlagState {
  return {
    serverValues: {},
    overrides: {},
    serverStatus: 'pending',
    allowOverrides: false,
    precedence: FEATURE_FLAG_PRECEDENCE,
    storage: null,
    storageFailed: false,
    unknownKeys: [],
    unknownKeyCount: 0,
    invalidKeys: [],
    lastFailureCode: 'none',
    initialised: false,
  };
}

let state = createState();
let cachedSnapshot: FeatureFlagsSnapshot | null = null;
const listeners = new Set<() => void>();

function notify(): void {
  cachedSnapshot = null;
  // A copy, so a listener that unsubscribes itself does not shorten the walk.
  for (const listener of [...listeners]) {
    try {
      listener();
    } catch {
      // One broken subscriber must not stop the others from being told.
    }
  }
}

/**
 * Read the stored overrides, tolerantly. A broken store means no overrides.
 *
 * The two failures are caught separately because they are not the same news. A
 * storage that throws is unusable, and an override set now will be gone after a
 * reload — worth telling a developer. Stored text that will not parse is a
 * value left behind by an older build: the storage is fine, the line is junk,
 * and dropping it is the whole of the repair.
 */
function loadOverridesFromStorage(): FeatureFlagValues {
  const { storage } = state;
  if (storage === null || !state.allowOverrides) {
    return {};
  }

  let raw: string | null;
  try {
    raw = storage.getItem(FEATURE_FLAG_STORAGE_KEY);
    state.storageFailed = false;
  } catch {
    state.storageFailed = true;

    return {};
  }

  if (raw === null || raw === '') {
    return {};
  }

  try {
    return parseFeatureFlagPayload(JSON.parse(raw)).values;
  } catch {
    return {};
  }
}

function saveOverridesToStorage(): void {
  const { storage } = state;
  if (storage === null) {
    return;
  }

  try {
    if (Object.keys(state.overrides).length === 0) {
      storage.removeItem(FEATURE_FLAG_STORAGE_KEY);

      return;
    }

    storage.setItem(FEATURE_FLAG_STORAGE_KEY, JSON.stringify(state.overrides));
    state.storageFailed = false;
  } catch {
    // A full or refusing quota costs persistence across reloads, nothing more:
    // the override is already live in memory for this session.
    state.storageFailed = true;
  }
}

/**
 * Decide what build we are in, without touching a storage.
 *
 * Split from {@link ensureInitialised} so {@link configureFeatureFlags} can
 * settle *which* storage to use before anything reads one. Doing it the other
 * way round opened the ambient `localStorage` first and then threw the answer
 * away — a read of a store the caller had not asked for.
 */
function applyDefaultConfig(): void {
  if (state.initialised) {
    return;
  }

  state.initialised = true;
  state.allowOverrides = isDevelopmentBuild();
  state.storage = resolveDefaultStorage();
}

function ensureInitialised(): void {
  if (state.initialised) {
    return;
  }

  applyDefaultConfig();
  state.overrides = loadOverridesFromStorage();
}

export interface ConfigureFeatureFlagsOptions {
  /**
   * Whether local overrides are consulted at all.
   *
   * Defaults to {@link isDevelopmentBuild}. A production caller passing `true`
   * here is asking for the thing this module exists to prevent, and says so out
   * loud at the call site, which is the point.
   */
  readonly allowOverrides?: boolean | undefined;
  /** Where overrides persist. `null` keeps them in memory for the session. */
  readonly storage?: FeatureFlagStorage | null | undefined;
  /** The read order. Defaults to {@link FEATURE_FLAG_PRECEDENCE}. */
  readonly precedence?: readonly FeatureFlagSource[] | undefined;
}

/**
 * Point the store at a storage, a precedence and a permission to override.
 *
 * Re-reads the persisted overrides afterwards, so switching storage in a test
 * does not leave the previous one's opinions behind.
 */
export function configureFeatureFlags(options: ConfigureFeatureFlagsOptions = {}): void {
  applyDefaultConfig();

  state.allowOverrides = options.allowOverrides ?? state.allowOverrides;
  state.precedence = options.precedence ?? state.precedence;
  if (options.storage !== undefined) {
    state.storage = options.storage;
    state.storageFailed = false;
  }
  state.overrides = loadOverridesFromStorage();

  notify();
}

function currentInputs(): FeatureFlagInputs {
  return {
    server: state.serverValues,
    ...(state.allowOverrides ? { override: state.overrides } : {}),
  };
}

/**
 * The whole store as one object, rebuilt only when something changed.
 *
 * The caching is not an optimisation, it is the contract `useSyncExternalStore`
 * requires: a getter that returned a fresh object every call would re-render
 * every subscriber on every render, forever.
 */
export function getFeatureFlagsSnapshot(): FeatureFlagsSnapshot {
  ensureInitialised();

  if (cachedSnapshot !== null) {
    return cachedSnapshot;
  }

  const resolutions = resolveAllFeatureFlags(currentInputs(), state.precedence);
  cachedSnapshot = {
    values: buildRecord((key) => resolutions[key].value),
    resolutions,
    serverStatus: state.serverStatus,
    overridesAllowed: state.allowOverrides,
  };

  return cachedSnapshot;
}

/** One flag, right now. Synchronous, total, and never throws. */
export function getFeatureFlag(key: FeatureFlagKey): boolean {
  return getFeatureFlagsSnapshot().values[key];
}

/** One flag and where its value came from. */
export function getFeatureFlagResolution(key: FeatureFlagKey): FeatureFlagResolution {
  return getFeatureFlagsSnapshot().resolutions[key];
}

/** Tell me when a flag changes. Returns the unsubscribe. */
export function subscribeFeatureFlags(listener: () => void): () => void {
  ensureInitialised();
  listeners.add(listener);

  return () => {
    listeners.delete(listener);
  };
}

export function getFeatureFlagDiagnostics(): FeatureFlagDiagnostics {
  ensureInitialised();

  return {
    serverStatus: state.serverStatus,
    lastFailureCode: state.lastFailureCode,
    unknownKeys: state.unknownKeys,
    unknownKeyCount: state.unknownKeyCount,
    invalidKeys: state.invalidKeys,
    overrideKeys: Object.keys(state.overrides).filter(isFeatureFlagKey),
    overridesAllowed: state.allowOverrides,
    storageAvailable: state.storage !== null && !state.storageFailed,
  };
}

/* -------------------------------------------------------------------------- */
/* Putting a server's answer in.                                               */
/* -------------------------------------------------------------------------- */

function markUnavailable(code: FeatureFlagFailureCode): void {
  // The previous snapshot is dropped rather than kept. "The last thing the
  // server said, five minutes ago" is a third source nobody declared, and the
  // rule for a flag that cannot be read is that it falls to its default.
  state.serverValues = {};
  state.serverStatus = 'unavailable';
  state.unknownKeys = [];
  state.unknownKeyCount = 0;
  state.invalidKeys = [];
  state.lastFailureCode = code;
  notify();
}

/**
 * Fold a server payload into the store.
 *
 * Accepts anything at all. A payload it cannot read leaves every flag on its
 * default and the status on `unavailable`; a payload it can partly read keeps
 * the entries it understood and counts the rest.
 */
export function setServerFeatureFlags(payload: unknown): FeatureFlagParseResult {
  ensureInitialised();

  const result = parseFeatureFlagPayload(payload);
  if (!result.readable) {
    // A failed `Result` is a request that did not succeed, not a server that
    // answered with nonsense. Same fallback, different thing to go and look at.
    markUnavailable(isFailedResult(payload) ? 'reader-failed' : 'unreadable-payload');

    return result;
  }

  state.serverValues = result.values;
  state.serverStatus = 'ready';
  state.unknownKeys = result.unknownKeys;
  state.unknownKeyCount = result.unknownKeyCount;
  state.invalidKeys = result.invalidKeys;
  state.lastFailureCode = 'none';
  notify();

  return result;
}

/** The server is not going to answer. Say so, and keep going on defaults. */
export function markServerFeatureFlagsUnavailable(): void {
  ensureInitialised();
  markUnavailable('reader-failed');
}

/** Whatever fetches the flags. May return a promise, a value, or throw. */
export type FeatureFlagReader = () => Promise<unknown> | unknown;

/**
 * Ask, and carry on either way.
 *
 * Never rejects — a rejected promise here would be telemetry-shaped plumbing
 * breaking a screen, which is the one thing this file is not allowed to do.
 * Callers who want to know what happened read the returned snapshot's
 * `serverStatus`; callers who do not can leave the promise unawaited, because
 * every flag already has a value before this is called.
 */
export async function loadServerFeatureFlags(read: FeatureFlagReader): Promise<FeatureFlagsSnapshot> {
  ensureInitialised();

  try {
    setServerFeatureFlags(await read());
  } catch {
    markUnavailable('reader-failed');
  }

  return getFeatureFlagsSnapshot();
}

/* -------------------------------------------------------------------------- */
/* Local overrides.                                                            */
/* -------------------------------------------------------------------------- */

/**
 * Force a flag for this browser.
 *
 * Returns whether it took effect: in a production build it does nothing and
 * says so, rather than pretending and leaving somebody to wonder why the button
 * did not work.
 */
export function setFeatureFlagOverride(key: FeatureFlagKey, value: boolean): boolean {
  ensureInitialised();

  if (!state.allowOverrides) {
    return false;
  }

  state.overrides = { ...state.overrides, [key]: value };
  saveOverridesToStorage();
  notify();

  return true;
}

/** Give one flag back to the server. */
export function clearFeatureFlagOverride(key: FeatureFlagKey): void {
  ensureInitialised();

  if (state.overrides[key] === undefined) {
    return;
  }

  const next = { ...state.overrides };
  delete next[key];
  state.overrides = next;
  saveOverridesToStorage();
  notify();
}

/** Give all of them back. */
export function clearFeatureFlagOverrides(): void {
  ensureInitialised();

  if (Object.keys(state.overrides).length === 0) {
    return;
  }

  state.overrides = {};
  saveOverridesToStorage();
  notify();
}

/* -------------------------------------------------------------------------- */
/* The development panel.                                                      */
/* -------------------------------------------------------------------------- */

/** One printable line about one flag. */
export interface FeatureFlagTableRow {
  readonly key: FeatureFlagKey;
  readonly value: boolean;
  readonly source: FeatureFlagSource;
  readonly defaultValue: boolean;
  readonly removeBy: IsoDate;
  readonly overdue: boolean;
  readonly description: string;
}

/**
 * The table as rows, for a console or a report.
 *
 * `todayIso` is passed in rather than read from a clock, so this stays as
 * testable as everything above it.
 */
export function buildFeatureFlagTable(todayIso: string): readonly FeatureFlagTableRow[] {
  const snapshot = getFeatureFlagsSnapshot();

  return FEATURE_FLAG_KEYS.map((key) => {
    const definition = FEATURE_FLAGS[key];
    const resolution = snapshot.resolutions[key];

    return {
      key,
      value: resolution.value,
      source: resolution.source,
      defaultValue: definition.defaultValue,
      removeBy: definition.removeBy,
      overdue: definition.removeBy < todayIso,
      description: definition.description,
    };
  });
}

/** The two console methods the panel uses. Injected so a test needs no console. */
export interface FeatureFlagLogger {
  table(rows: readonly FeatureFlagTableRow[]): void;
  info(message: string): void;
}

/** What the panel exposes on the global object. */
export interface FeatureFlagDevPanel {
  /** Print the table, and return it. */
  list(): readonly FeatureFlagTableRow[];
  enable(key: string): boolean;
  disable(key: string): boolean;
  set(key: string, value: boolean): boolean;
  /** Clear one override, or all of them when called with nothing. */
  reset(key?: string): void;
  diagnostics(): FeatureFlagDiagnostics;
  help(): void;
}

/** The property the panel is installed under. */
export const FEATURE_FLAG_PANEL_PROPERTY = '__featureFlags';

export interface InstallFeatureFlagDevPanelOptions {
  /** Defaults to "development build, and not the test runner". */
  readonly enabled?: boolean | undefined;
  readonly globalObject?: Record<string, unknown> | undefined;
  readonly logger?: FeatureFlagLogger | undefined;
  /** Today, as `YYYY-MM-DD`. Defaults to the real one. */
  readonly today?: (() => string) | undefined;
}

const ISO_DATE_LENGTH = 10;

const defaultToday = (): string => new Date().toISOString().slice(0, ISO_DATE_LENGTH);

function resolveDefaultLogger(): FeatureFlagLogger {
  return {
    table: (rows) => {
      if (typeof console.table === 'function') {
        console.table(rows);

        return;
      }

      console.info(rows);
    },
    info: (message) => {
      console.info(message);
    },
  };
}

function resolveGlobalObject(): Record<string, unknown> | null {
  try {
    return globalThis as unknown as Record<string, unknown>;
  } catch {
    return null;
  }
}

/**
 * A flag console for development, and nothing in production.
 *
 * Deliberately not a screen. Invariant B forbids developer chips on product
 * surfaces, so the fast way to flip a heavy feature is
 * `__featureFlags.enable('scene.soft-shadows')` in the browser console — no
 * pixel of it can ever be shipped by accident, because in a production build
 * this function installs nothing and returns a no-op.
 *
 * Returns the uninstall, which restores whatever held the property before.
 */
export function installFeatureFlagDevPanel(options: InstallFeatureFlagDevPanelOptions = {}): () => void {
  const enabled = options.enabled ?? (isDevelopmentBuild() && !isTestMode());
  if (!enabled) {
    return () => undefined;
  }

  const host = options.globalObject ?? resolveGlobalObject();
  if (host === null) {
    return () => undefined;
  }

  const logger = options.logger ?? resolveDefaultLogger();
  const today = options.today ?? defaultToday;

  const list = (): readonly FeatureFlagTableRow[] => {
    const rows = buildFeatureFlagTable(today());
    logger.table(rows);

    return rows;
  };

  // Not named `set`: `local/no-direct-set` bans a bare call to that identifier,
  // and the rule is right to — one grep for `set(` should only ever find a store.
  const applyOverride = (key: string, value: boolean): boolean => {
    if (!isFeatureFlagKey(key)) {
      logger.info(`Không có cờ tên "${key}". Gõ ${FEATURE_FLAG_PANEL_PROPERTY}.list() để xem bảng cờ.`);

      return false;
    }

    if (!setFeatureFlagOverride(key, value)) {
      logger.info('Bản dựng này không cho ghi đè cờ; chỉ chế độ phát triển mới ghi đè được.');

      return false;
    }

    list();

    return true;
  };

  const panel: FeatureFlagDevPanel = {
    list,
    enable: (key) => applyOverride(key, true),
    disable: (key) => applyOverride(key, false),
    set: applyOverride,
    reset: (key) => {
      if (key === undefined) {
        clearFeatureFlagOverrides();
      } else if (isFeatureFlagKey(key)) {
        clearFeatureFlagOverride(key);
      } else {
        logger.info(`Không có cờ tên "${key}".`);

        return;
      }

      list();
    },
    diagnostics: () => {
      const diagnostics = getFeatureFlagDiagnostics();
      logger.info(
        `Cờ từ máy chủ: ${diagnostics.serverStatus}; lỗi gần nhất: ${diagnostics.lastFailureCode}; ` +
          `khoá lạ: ${String(diagnostics.unknownKeyCount)}; khoá sai kiểu: ${String(diagnostics.invalidKeys.length)}.`,
      );

      return diagnostics;
    },
    help: () => {
      logger.info(
        [
          `${FEATURE_FLAG_PANEL_PROPERTY}.list() — bảng cờ hiện tại`,
          `${FEATURE_FLAG_PANEL_PROPERTY}.enable('scene.soft-shadows') — bật một cờ`,
          `${FEATURE_FLAG_PANEL_PROPERTY}.disable('scene.soft-shadows') — tắt một cờ`,
          `${FEATURE_FLAG_PANEL_PROPERTY}.reset() — bỏ mọi ghi đè cục bộ`,
          `${FEATURE_FLAG_PANEL_PROPERTY}.diagnostics() — vì sao một cờ không đọc được`,
        ].join('\n'),
      );
    },
  };

  const hadProperty = FEATURE_FLAG_PANEL_PROPERTY in host;
  const previous = host[FEATURE_FLAG_PANEL_PROPERTY];

  try {
    host[FEATURE_FLAG_PANEL_PROPERTY] = panel;
  } catch {
    // A frozen global is a reason to have no panel, not a reason to fail boot.
    return () => undefined;
  }

  return () => {
    try {
      if (hadProperty) {
        host[FEATURE_FLAG_PANEL_PROPERTY] = previous;

        return;
      }

      delete host[FEATURE_FLAG_PANEL_PROPERTY];
    } catch {
      // Nothing left to do: the panel is inert either way.
    }
  };
}

/** Back to a fresh module, for tests. */
export function __resetFeatureFlagsForTests(): void {
  state = createState();
  cachedSnapshot = null;
  listeners.clear();
}
