# AppFront decor items

Served at `/pascal/items/<folder>/` (copied by `scripts/copy-pascal-assets.mjs`).
Regenerate: `node scripts/gen-decor-models.mjs` (procedural) and
`node scripts/gen-decor-models.mjs --polyhaven <dir>` (Poly Haven 1k glTF -> GLB, Draco, textures 512 px webp).
Thumbnails are neutral icon cards with the item name (sharp, no 3D render).

| Folder | Source | License |
|---|---|---|
| curtain, pillow, throw-blanket, wall-sconce | procedural, `scripts/gen-decor-models.mjs` (AppFront) | project code |
| ceramic-vase | https://polyhaven.com/a/ceramic_vase_01 | CC0 1.0 (Poly Haven) |
| ceramic-vase-slim | https://polyhaven.com/a/ceramic_vase_03 | CC0 1.0 (Poly Haven) |
| fancy-picture-frame | https://polyhaven.com/a/fancy_picture_frame_01 | CC0 1.0 (Poly Haven) |
| ottoman | https://polyhaven.com/a/Ottoman_01 | CC0 1.0 (Poly Haven) |
| sofa-ph | https://polyhaven.com/a/sofa_02 (2k glTF, textures -> 512 webp; B1b: diffuse lightened to light grey) | CC0 1.0 (Poly Haven) |
| armchair-ph | https://polyhaven.com/a/modern_arm_chair_01 (2k glTF, simplify 0.3, cushion diffuse lightened to light grey; B1b) | CC0 1.0 (Poly Haven) |
| dining-chair-ph | https://polyhaven.com/a/dining_chair_02 (homepage-audit `public/models/dining-chair.glb`) | CC0 1.0 (Poly Haven) |
| plant-ph | https://polyhaven.com/a/pachira_aquatica_01 (tallest of the 4 trees) in the pot + soil of https://polyhaven.com/a/potted_plant_02 (1k glTF, real `*_leaves_alpha_1k.png`; P1) | CC0 1.0 (Poly Haven) |
| planter-ph | https://polyhaven.com/a/potted_plant_02 (1k glTF, real `*_leaves_alpha_1k.png`; P1) | CC0 1.0 (Poly Haven) |
| bedside-table-ph | https://polyhaven.com/a/side_table_01 (1k glTF; review2 pack 2A) | CC0 1.0 (Poly Haven) |
| bookshelf-ph | https://polyhaven.com/a/wooden_display_shelves_01 (1k glTF, turned 90 deg about y; pack 2A) | CC0 1.0 (Poly Haven) |
| ceiling-lamp-ph | https://polyhaven.com/a/modern_ceiling_lamp_01 (1k glTF; pack 2A) | CC0 1.0 (Poly Haven) |
| picture-ph | https://polyhaven.com/a/hanging_picture_frame_02 (1k glTF; pack 2A) | CC0 1.0 (Poly Haven) |
| planter-long | https://polyhaven.com/a/planter_box_02 (stretched 1.9 x 0.9 x 1.4) + 3 copies of the foliage of https://polyhaven.com/a/potted_plant_02 (real `*_leaves_alpha_1k.png`; pack 2A) | CC0 1.0 (Poly Haven) |
| rug-nf | vendor Pascal `rectangular-carpet` with the fringe tabs removed (`scripts/realism-assets/carpet.mjs`; review2 pack 1) | same as vendor/pascal assets |
| closet-gen, kitchen-counter-gen, kitchen-cabinet-gen, kitchen-shelf-gen, tv-stand-gen | procedural, `scripts/realism-assets/cabinets.mjs` (AppFront; pack 4B, replace the Pascal box cabinets) | project code |

Downloaded 2026-10-21 from `https://api.polyhaven.com/files/<id>` -> `gltf.1k`.

editor-realism B1 (2026-10-23): `--polyhaven F:/App-review/homepage-v6/cinema/assets/models --glb <homepage-audit>/public/models --only sofa_02,Armchair_01,dining_chair_02`.
editor-realism B1b (2026-10-23): `--polyhaven F:/App-review/homepage-v6/cinema/assets/models --only sofa_02,modern_arm_chair_01`.
sofa-ph / dining-chair-ph have a single material (wood + fabric in one atlas); armchair-ph has two (legs, pillow). None is named `slot_*`: the colour is fixed and does not follow the scene style.
editor-realism P1 (2026-10-23): `node scripts/realism-assets/plants.mjs F:/tmp/ph-plants/dl` (Poly Haven 1k glTF downloads). Leaves = diffuse + the real alpha map (RGBA webp, MASK 0.5, double sided); triangles cut by dropping whole leaf islands (seeded shuffle) after a light meshopt pass, trunk/pot simplified. plant-ph 7.8k tris, planter-ph 4.8k tris.
editor-realism review2 pack 1 (2026-10-23): pillow/throw-blanket regenerated (roundedBox winding was inside-out); dining-chair-ph diffuse `linear(2.2, 10)` (`--only dining_chair_02`); rug-nf via `node scripts/realism-assets/carpet.mjs`.
editor-realism review2 pack 2A (2026-10-23): downloads in `F:/tmp/ph-pack2/<id>/` (1k glTF). `node scripts/gen-decor-models.mjs --polyhaven F:/tmp/ph-pack2 --only side_table_01,wooden_display_shelves_01,modern_ceiling_lamp_01,hanging_picture_frame_02`; `node scripts/realism-assets/planter-long.mjs F:/tmp/ph-pack2` (planter_box_02 + potted_plant_02; box 1.5k + 3 x 1.4k plants joined into one mesh per material = 5.7k tris; 5 plants cost the dGPU 7 -> 14-21 ms per frame).
editor-realism pack 4B (2026-10-24): `node scripts/realism-assets/cabinets.mjs` -> closet-gen / kitchen-counter-gen / kitchen-cabinet-gen / kitchen-shelf-gen / tv-stand-gen (bounding box = the Pascal box, slot names as the Pascal model + `slot_handle` dark metal, box-projected UV in metres).
