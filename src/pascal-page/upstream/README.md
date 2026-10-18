# Pascal upstream page (verbatim)

Source: `F:\pascal-editor\apps\editor` (MIT), commit `cd14090` — the same commit `vendor/pascal` was copied from.
These files are upstream code; do not restyle or refactor them. They are excluded from AppFront's ESLint
(`.eslintrc.cjs`) and file-length gate (`scripts/check-file-length.mjs`), like `vendor/`.

| File here | Upstream | Edits |
|---|---|---|
| `page.tsx` | `app/page.tsx` | see below |
| `components/build-tab.tsx` | `components/build-tab.tsx` | import paths only (`@/components/*`, `@/lib/*` -> relative) |
| `components/viewer-toolbar.tsx` | `components/viewer-toolbar.tsx` | import paths only |
| `components/toolbar-tooltip.tsx` | `components/toolbar-tooltip.tsx` | import paths only |
| `lib/build-palette.ts` | `lib/build-palette.ts` | import paths only |
| `lib/build-tab-state.ts` | `lib/build-tab-state.ts` | none |
| `lib/utils.ts` | `lib/utils.ts` | none |

Every file also carries a header comment (source path, commit, edits) after `'use client'`.

`page.tsx` edits, the complete list:

1. Import paths: `@/components/*` -> `./components/*`.
2. WebXR plugin gate removed (`vr` treated as null): no `@webxr/plugin` / `webxr-feature-gate` imports, no
   `WebXRFeatureRuntime`/`WebXRFeatureConsumer` wrappers, no `PascalWebXRButton`, no `immersive` prop,
   `vrButton={null}`.
3. "Blank canvas — saved scenes are under Scenes" banner removed (`/scenes` does not exist), with the now-unused
   `next/link` import and `PROJECT_ID` constant.
4. `Home` takes props `{ projectId, onLoad, onSave, readOnly }` and passes `projectId`/`onLoad`/`onSave` to
   `<Editor>`. The read-only lease (`acquireSceneReadOnlyLease`) is taken by `../main.tsx`.
5. Optional `backCard` prop rendered first in the `viewerToolbarLeft` slot (`../BackToProjectCard.tsx`).

`next/image` / `next/link` resolve to `vendor/pascal/shims/*` (aliases in `vite.pascal.config.ts`, paths in `tsconfig.json`).
