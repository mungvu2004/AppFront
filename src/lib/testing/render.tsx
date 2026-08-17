/**
 * One line to render a screen with everything a screen expects to be inside.
 *
 * A screen test that opens with fifteen lines of scaffolding — build a
 * `QueryClient`, remember to turn retries off, wrap the tree, put the store back
 * where the last test left it — is fifteen lines that get copied forty-seven
 * times and then diverge. Worse, the details that get forgotten are the ones
 * that make a suite slow and flaky: a client with retries on turns one failing
 * request into three seconds of waiting, and a global store nobody reset makes
 * tests pass in order and fail alone.
 *
 * So: `renderWithProviders(<QcScreen />)`, and the rest is decided here.
 *
 * ## What it wraps
 *
 * - **A fresh `QueryClient` per render**, never the application's shared one.
 *   Retries are off, so a rejected query fails immediately instead of being
 *   retried on a timer — no test in this suite should ever be waiting on the
 *   clock. Its cache is thrown away on unmount, so no test can see what another
 *   one fetched.
 * - **The Vietnamese bundle**, as a real i18next instance over `src/i18n/vi.json`
 *   with interpolation working. It comes back as `translate` so an assertion can
 *   ask for the same string the screen asks for, rather than repeating the
 *   Vietnamese in a test file where it will rot.
 * - **The store**, put back to its initial state before every render, along with
 *   any undo history zundo has accumulated.
 *
 * ## Why the store is handed in rather than imported
 *
 * `src/lib/**` may not import `src/store/**` — mục 0.4, and ESLint enforces it —
 * for a good reason: everything under `src/lib` is meant to be a pure function
 * of what it is given. A test harness is not an exception worth carving; it is
 * a case for injection. Wire it once, in `vitest.setup.ts`:
 *
 * ```ts
 * import { configureTestProviders, createStoreReset } from '@/lib/testing/render';
 * import { useStore } from '@/store';
 *
 * configureTestProviders({ resetStore: createStoreReset(useStore) });
 * ```
 *
 * and every screen test after that is still one line. Without that wiring
 * everything else here works and the store is simply left alone — the harness
 * degrades, it does not break.
 *
 * The one thing it deliberately does not do is reach into `localStorage`.
 * The store persists a slice there, and a harness that quietly wiped browser
 * storage would be a harness that hides a persistence bug rather than one that
 * finds it.
 */

import { QueryClientProvider, type QueryClient } from '@tanstack/react-query';
import { render as renderToDom, type RenderOptions, type RenderResult } from '@testing-library/react';
import i18next, { type TFunction } from 'i18next';

import viMessages from '@/i18n/vi.json';
import { createQueryClient } from '@/lib/query/queryClient';

/** Whatever `render()` accepts — taken from `render()` so the two cannot drift. */
export type RenderableUi = Parameters<typeof renderToDom>[0];

/**
 * The little of a zustand store this harness needs: read it, and put it back.
 *
 * Structural on purpose. It matches a bare store and a store wrapped in
 * `devtools`, `persist` and `temporal` alike, and it means this module never
 * names the application's store — which is what keeps `src/lib` free of
 * `src/store`.
 */
export interface ResettableStore<TState> {
  readonly getState: () => TState;
  readonly setState: (state: TState, replace?: boolean) => void;
}

/** Undo history, if the store has any — zundo hangs it off `temporal`. */
interface MaybeTemporal {
  readonly temporal?: { readonly getState: () => { readonly clear?: () => void } };
}

/** What every render in this suite gets, unless a single call says otherwise. */
export interface TestProviderConfig {
  /**
   * Puts global state back to a known point before each render.
   *
   * Build one with {@link createStoreReset}, or write your own.
   */
  readonly resetStore?: (() => void) | undefined;
  /** Builds the per-render query client. Defaults to {@link createTestQueryClient}. */
  readonly createQueryClient?: (() => QueryClient) | undefined;
}

/** What one render hands back: everything testing-library gives, plus the wrapping. */
export interface ProvidedRenderResult extends RenderResult {
  /** The client this render used, for seeding or inspecting the cache. */
  readonly queryClient: QueryClient;
  /** The application's Vietnamese, so a test never spells a label out twice. */
  readonly translate: TFunction;
}

export interface RenderWithProvidersOptions extends Omit<RenderOptions, 'wrapper'> {
  /** Overrides the configured client for this render only. */
  readonly queryClient?: QueryClient | undefined;
  /** Overrides the configured store reset for this render only. */
  readonly resetStore?: (() => void) | undefined;
  /** Skip the store reset for this render — for a test that seeds state itself. */
  readonly keepStore?: boolean | undefined;
}

/* -------------------------------------------------------------------------- */
/* Configuration.                                                              */
/* -------------------------------------------------------------------------- */

let config: TestProviderConfig = {};

/**
 * Wire the harness up once, for the whole suite.
 *
 * Belongs in `vitest.setup.ts`. Calling it again replaces the previous
 * configuration rather than merging into it, so a test that needs something
 * different for one render should pass it to {@link renderWithProviders} instead.
 */
export function configureTestProviders(next: TestProviderConfig): void {
  config = next;
}

/** Forget the configuration. For a test that is testing the harness itself. */
export function resetTestProviders(): void {
  config = {};
}

/**
 * A reset that puts a zustand store back where it started.
 *
 * The snapshot is taken when this is called, so call it at setup time — before
 * any test has had a chance to change anything. Actions are captured along with
 * the data, which is what makes `replace` safe.
 */
export function createStoreReset<TState extends object>(store: ResettableStore<TState>): () => void {
  const initial = { ...store.getState() };

  return () => {
    // A10 says every change goes through commit(patch, label) so that it lands
    // in the undo history. Putting a store back to where it started between two
    // renders is the one write that must *not* — which is why `.eslintrc.cjs`
    // exempts this folder, and only this folder, from `local/no-direct-set`.
    store.setState(initial, true);

    // Undo history outlives a component tree, so it has to be cleared explicitly
    // or the second test in a file starts with the first one's edits behind it.
    (store as MaybeTemporal).temporal?.getState().clear?.();
  };
}

/* -------------------------------------------------------------------------- */
/* The providers.                                                              */
/* -------------------------------------------------------------------------- */

/**
 * A query client for tests: the application's, with everything on a timer off.
 *
 * Built by the application's own factory rather than from scratch, so a test
 * runs against the real `CACHE_POLICY` — a client assembled separately here
 * would drift from the one the product ships and quietly stop testing it.
 *
 * Only the retries are overridden, and they are the important ones. The
 * application retries a failed query, which is right in production and wrong in
 * a test: it turns one rejected promise into several seconds of waiting and an
 * error that surfaces long after the assertion that caused it.
 */
export function createTestQueryClient(): QueryClient {
  return createQueryClient({
    queries: { retry: false, refetchOnWindowFocus: false, refetchOnReconnect: false },
    mutations: { retry: false },
  });
}

/** The Vietnamese bundle, initialised once and shared — reading it changes nothing. */
let translator: TFunction | null = null;

/**
 * The application's Vietnamese, as a `t()` a test can call.
 *
 * `initImmediate: false` makes i18next initialise synchronously, so there is
 * nothing to await and no window in which a render could see a missing string.
 */
export function getTestTranslator(): TFunction {
  if (translator !== null) {
    return translator;
  }

  const instance = i18next.createInstance();

  void instance.init({
    lng: 'vi',
    fallbackLng: 'vi',
    resources: { vi: { translation: viMessages } },
    interpolation: { escapeValue: false },
    initImmediate: false,
  });

  translator = instance.t.bind(instance);

  return translator;
}

/** The tree every screen under test is rendered inside. */
function createProviders(queryClient: QueryClient) {
  return function TestProviders({ children }: { readonly children: RenderableUi }) {
    return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>;
  };
}

/* -------------------------------------------------------------------------- */
/* The one line.                                                               */
/* -------------------------------------------------------------------------- */

/**
 * Render a screen with the query client, the store and the Vietnamese bundle
 * already around it.
 *
 * @param ui The screen, exactly as it would be written in the application.
 * @param options Anything `render()` takes, plus the per-render overrides.
 *
 * @returns Everything `render()` returns, plus `queryClient` and `translate`.
 *   Its `unmount` also empties the query cache, so a test that unmounts by hand
 *   leaves as little behind as one that lets cleanup do it.
 *
 * @example
 * const { translate } = renderWithProviders(<QcScreen />);
 * expect(screen.getByRole('button', { name: translate('common.undo') })).toBeVisible();
 */
export function renderWithProviders(
  ui: RenderableUi,
  options: RenderWithProvidersOptions = {},
): ProvidedRenderResult {
  const { queryClient: given, resetStore, keepStore, ...renderOptions } = options;

  if (keepStore !== true) {
    const reset = resetStore ?? config.resetStore;

    reset?.();
  }

  const queryClient = given ?? (config.createQueryClient ?? createTestQueryClient)();
  const result = renderToDom(ui, { ...renderOptions, wrapper: createProviders(queryClient) });

  return {
    ...result,
    unmount: () => {
      result.unmount();
      queryClient.clear();
    },
    queryClient,
    translate: getTestTranslator(),
  };
}
