import '@testing-library/jest-dom/vitest';

import { configureTestProviders, createStoreReset } from '@/lib/testing/render';
import { useStore } from '@/store';

/**
 * Hand the test harness the application store, once.
 *
 * `src/lib/**` may not import `src/store/**` — mục 0.4 — so `renderWithProviders`
 * takes the store rather than reaching for it. This is the one place that
 * knows both, and it runs before any test file, which is what keeps a screen
 * test down to a single line.
 *
 * The snapshot is taken here, at setup time, so "initial state" means the state
 * the application boots with rather than whatever the first test happened to
 * leave behind. Undo history is cleared alongside it.
 */
configureTestProviders({ resetStore: createStoreReset(useStore) });

/**
 * `window.scrollTo`, which jsdom declares and does not implement.
 *
 * `framer-motion` measures a row's real height before collapsing it to zero —
 * it has to, because `height: auto` cannot be interpolated — and that
 * measurement saves and restores the scroll position through `window.scrollTo`.
 * Left alone, every disappearing row prints a `Not implemented: window.scrollTo`
 * stack, and a suite that is green but noisy is a suite whose next real warning
 * nobody reads.
 *
 * It lives here rather than in one test file because any test that collapses a
 * motion element hits it — `SessionsSection.test.tsx` was only the first.
 */
window.scrollTo = () => undefined;
