import React from 'react';
import ReactDOM from 'react-dom/client';
import { RouterProvider } from 'react-router-dom';
import { QueryClientProvider } from '@tanstack/react-query';

import { MotionProvider } from './components/motion';
import { queryClient } from './lib/query/queryClient';
import { installFeatureFlagDevPanel } from './lib/telemetry/flags';
import { router } from './routes';
import './styles/globals.css';

// `__featureFlags.list()` in the browser console — see
// `src/lib/telemetry/flags.ts`. Installed before render so a flag can be
// flipped and the page reloaded without touching any code.
//
// The guard is for the bundler, not for correctness: the function already
// refuses to install outside a development build, but Vite replaces
// `import.meta.env.DEV` with `false` here, so the panel and its help text are
// dropped from the production bundle rather than shipped switched off.
if (import.meta.env.DEV) {
  installFeatureFlagDevPanel();
}

/**
 * The application shell: navigation, data, motion — three things, one place.
 *
 * This file used to render `<App />` directly, which is the nine-screen demo
 * picker, while `src/routes.tsx` declared 28 routes that nothing ever mounted.
 * That meant the first real screen had no way to be reached, `useNavigate` had
 * no router to call, and `src/lib/query` had no provider to run under.
 *
 * The nesting order is deliberate:
 *
 * - `QueryClientProvider` outermost because it draws nothing — it holds the
 *   cache, and the cache has to outlive every route change.
 * - `MotionProvider` wraps the WHOLE shell rather than each screen: it sets
 *   `reducedMotion="user"` once for every framer-motion animation in the tree.
 *   Per-screen leaves room for a screen to forget (R-39).
 * - `RouterProvider` innermost, because it is the only part that changes with
 *   the URL.
 *
 * The demo picker is not lost: it is the `/demo` route, and only in a
 * development build. `/` is now the real dashboard route — still a
 * `<Placeholder>` until that screen is built.
 */
ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <QueryClientProvider client={queryClient}>
      <MotionProvider>
        <RouterProvider router={router} />
      </MotionProvider>
    </QueryClientProvider>
  </React.StrictMode>,
);
