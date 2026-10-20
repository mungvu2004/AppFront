# Pascal upstream page (verbatim)

Source: `F:\pascal-editor\apps\editor` (MIT), commit `cd14090` — the same commit `vendor/pascal` was copied from.
These files are upstream code; do not restyle or refactor them. They are excluded from AppFront's ESLint
(`.eslintrc.cjs`) and file-length gate (`scripts/check-file-length.mjs`), like `vendor/`.

| File here | Upstream | Edits |
|---|---|---|
| `page.tsx` | `app/page.tsx` | see below |
| `components/build-tab.tsx` | `components/build-tab.tsx` | import paths; P40 (below) |
| `components/viewer-toolbar.tsx` | `components/viewer-toolbar.tsx` | import paths; P40 (below) |
| `components/toolbar-tooltip.tsx` | `components/toolbar-tooltip.tsx` | import paths only |
| `lib/build-palette.ts` | `lib/build-palette.ts` | import paths; P40 (below) |
| `lib/build-tab-state.ts` | `lib/build-tab-state.ts` | P40 (below) |
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

AppFront UX edits (UI review package P40), marked `AppFront edit (P40 …)` in code:

6. Vietnamese user-facing strings: sidebar tab labels (`page.tsx`), top toolbar + Display menu
   (`viewer-toolbar.tsx`, level/wall toggles labelled as state "Tầng: …"/"Tường: …"), Build palette labels
   (`build-palette.ts`), slab/roof option labels (`build-tab-state.ts`), Build sub-panel headings (`build-tab.tsx`).
7. `page.tsx`: after `onLoad` the editor is put in Select, or the Measure tool for `?tool=measure`;
   `?view=exploded` sets the viewer level mode; Esc leaves Preview, then the Delete/Measure tool; a banner
   shows while the Delete tool is armed.
8. `build-tab.tsx`: the first mount of a page load no longer arms the first tool (wall); the grid cells show
   their label under the icon and carry `aria-label`.

FE3D-FIX WP8:

10. `page.tsx` passes `viewerBanner={<ScaleBanner projectId={projectId} />}` to `<Editor>` (`../scaleBanner.tsx`):
    a non-blocking warning when a floor's N16 layer says `scaleStatus: 'unresolved'` or the walls fit in < 3 m.

`next/image` / `next/link` resolve to `vendor/pascal/shims/*` (aliases in `vite.pascal.config.ts`, paths in `tsconfig.json`).
