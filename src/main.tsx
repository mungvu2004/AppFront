import React from 'react';
import ReactDOM from 'react-dom/client';
import { App } from './App';
import { installFeatureFlagDevPanel } from './lib/telemetry/flags';
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

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);
