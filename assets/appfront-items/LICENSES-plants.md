# AppFront plant items (editor-realism C1)

Served at `/pascal/items/<folder>/` (copied by `scripts/copy-pascal-assets.mjs`).
Regenerate: `node scripts/realism-assets/plants.mjs <cinemaModels> <homepageModels>`
(`F:/App-review/homepage-v6/cinema/assets/models`, `F:/worktrees/AppFront/homepage-audit/public/models`).
GLB with Draco, textures as sibling 512 px webp (no embedded images: CSP blocks `blob:`), <= 3k triangles.
The local Poly Haven copies have the leaf diffuse as JPG without alpha, so the leaf cut-out (alphaMode MASK,
cutoff 0.5, double-sided) is rebuilt from the diffuse by colour key in the script.
Thumbnails are neutral icon cards with the item name (sharp, no 3D render).

| Folder | Source | License |
|---|---|---|
| plant-ph | https://polyhaven.com/a/potted_plant_01 | CC0 1.0 (Poly Haven) |
| planter-ph | https://polyhaven.com/a/potted_plant_04 | CC0 1.0 (Poly Haven) |
