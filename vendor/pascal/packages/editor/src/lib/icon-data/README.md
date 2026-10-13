# Offline icon subsets

Each file here is an Iconify icon-set subset (`addCollection()` input) for one
collection the editor uses. Generated once via `api.iconify.design/<prefix>.json
?icons=<names>` — the exact subset endpoint the editor used to call at
runtime — then committed so no network call happens in the browser.

Icon names covered, found via:
`git grep -ho "icon=\"[a-zA-Z0-9-]+:[a-zA-Z0-9-]+\"\|icon: '[a-zA-Z0-9-]+:[a-zA-Z0-9-]+'\|name: '[a-zA-Z0-9-]+:[a-zA-Z0-9-]+'" vendor/pascal/packages`

| Collection | Icons |
|---|---|
| lucide | boxes, circle-check, fence, mouse-pointer-click, palette, ruler, ruler-dimension-line, space, x |
| ph | arrow-fat-up, mouse-left-click-fill, mouse-right-click-fill, mouse-scroll-fill |
| mdi | cancel, eraser-variant, select-drag, trash-can-outline |
| carbon | cut-out |
| qlementine-icons | mouse-middle-button-16 |

Adding a new icon name anywhere in `vendor/pascal/packages/**` means re-running
the grep above and re-fetching the subset for that collection — see
`offline-icons.ts` in the parent directory.
