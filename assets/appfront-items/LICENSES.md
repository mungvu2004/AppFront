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

Downloaded 2026-10-21 from `https://api.polyhaven.com/files/<id>` -> `gltf.1k`.
