/**
 * Every line and overlay the landing draws over (or instead of) the building:
 * the paper sheet, the stroke-drawn plan, grid and dimensions, scene 03's
 * detection layers, scene 04's gap correction and scene 08's check marks.
 *
 * All of it is built once from the same `LandingHouse`, so the drawing, the
 * "AI" layers and the 3D house share one geometry. `apply()` then only moves
 * groups, sets opacities and draw counts, and rewrites the four gap segments in
 * place — it never allocates, so it can run every scroll frame.
 *
 * Anchors are positions in the group's own space (the stage keeps the group at
 * the origin), updated in place by `apply()` as layers lift and separate.
 */

import { Group, Vector3, type Camera, type Material } from 'three';
import type { LineMaterial } from 'three/examples/jsm/lines/LineMaterial.js';

import type { LandingHouse, LandingState } from '@/lib/landing/types';

import { createGrid } from './axes';
import { createCompliance } from './compliance';
import { createDetect, LAYER, ROOM_FILL_ALPHA } from './detect';
import { footprint } from './geometry';
import { clamp01, disposeTree, smooth, type P3 } from './lines';
import { createReview } from './review';
import { createSheet, softShadow } from './sheet';
import { createStrokes } from './strokes';

export interface InkLayer {
  readonly group: Group;
  apply(state: LandingState, camera: Camera): void;
  readonly anchors: ReadonlyMap<string, Vector3>;
  setResolution(width: number, height: number): void;
  dispose(): void;
}

/** How far the drawing sits above the sheet at rest, against z-fighting. */
const INK_Y = 0.004;
/** Gap-bordering rooms read as "not closed" at this share of the full fill. */
const OPEN_ROOM_SHARE = 0.35;

interface Anchor {
  readonly v: Vector3;
  readonly base: P3;
  /** `null` = world space; `-1` = the drawing plane; `n` = detection layer n. */
  readonly layer: number | null;
}

export function createInk(house: LandingHouse): InkLayer {
  const bounds = footprint(house.plan);
  const group = new Group();
  group.name = 'ink';
  const drawing = new Group();
  drawing.name = 'ink:drawing';

  const sheet = createSheet(bounds);
  const [minX, minZ, maxX, maxZ] = bounds;
  const dropShadow = softShadow('ink:dropShadow', maxX - minX + 0.6, maxZ - minZ + 0.6, 0.35);
  dropShadow.position.set((minX + maxX) / 2, 0.001, (minZ + maxZ) / 2);
  dropShadow.renderOrder = -1;

  const strokes = createStrokes(house);
  const grid = createGrid(house);
  const detect = createDetect(house, strokes.faces);
  const wallsLayer = detect.layers[LAYER.walls] as Group;
  const review = detect.gapWall ? createReview(house, detect.gapWall, detect.walls.material, wallsLayer) : null;
  const compliance = createCompliance(house);
  const checks = new Group();
  checks.name = 'ink:checks';

  drawing.add(
    strokes.walls.object,
    strokes.openings.object,
    strokes.stair.object,
    strokes.junk.object,
    grid.axes.object,
    grid.dims.object,
    detect.group,
  );
  checks.add(compliance.stair.object, compliance.passes.object);
  if (compliance.door) {
    checks.add(compliance.door.object);
  }
  group.add(sheet.shadow, sheet.paper, dropShadow, drawing, checks);

  const anchorList: Anchor[] = [];
  const anchors = new Map<string, Vector3>();
  const addAnchor = (id: string, base: P3, layer: number | null): void => {
    const v = new Vector3(base[0], base[1], base[2]);
    anchorList.push({ v, base, layer });
    anchors.set(id, v);
  };
  grid.anchors.forEach((p, id) => addAnchor(id, p, -1));
  detect.anchors.forEach(({ p, layer }, id) => addAnchor(id, p, layer));
  if (review) {
    addAnchor('gap', review.centre, LAYER.walls);
  }
  compliance.anchors.forEach((p, id) => addAnchor(id, p, null));

  const lineMaterials: LineMaterial[] = [];
  group.traverse((node) => {
    const material = (node as { material?: Material }).material as LineMaterial | undefined;
    if (material && 'isLineMaterial' in material && !lineMaterials.includes(material)) {
      lineMaterials.push(material);
    }
  });

  let lastClose = Number.NaN;

  return {
    group,
    anchors,

    apply(state) {
      const { paper, detect: det, review: rev, compliance: comp, build } = state;
      const op = paper.opacity;
      const sem = state.semantic;
      const m = build.material;
      const inkFade = 1 - m;
      // The plan lines hand over to the physical walls, but a faint footprint stays until materials are in.
      const wallFade = Math.max(inkFade, 0.22 * (1 - smooth(0.9, 1, m)));

      sheet.set(op, paper.liftM);
      drawing.position.y = INK_Y + paper.liftM;
      dropShadow.material.uniforms['uOpacity']!.value = 0.16 * op * clamp01(paper.liftM / 0.12);
      dropShadow.visible = paper.liftM > 1e-4 && op > 1e-3;

      strokes.walls.reveal(paper.ink);
      strokes.walls.setOpacity(op * wallFade);
      strokes.openings.reveal(paper.ink);
      strokes.openings.setOpacity(op * inkFade);
      strokes.stair.reveal(paper.ink);
      strokes.stair.setOpacity(op * inkFade);
      strokes.junk.reveal(paper.ink);
      strokes.junk.setOpacity(op * paper.junkInk);
      grid.axes.reveal(paper.axes);
      grid.axes.setOpacity(op * inkFade);
      grid.dims.reveal(paper.dims);
      grid.dims.setOpacity(op * inkFade);

      detect.layers.forEach((layer, i) => {
        layer.position.y = det.explodeM * i;
      });
      detect.walls.reveal(det.walls);
      detect.walls.setOpacity(clamp01(det.walls * 3) * sem);
      const closed = rev.close >= 0.98;
      for (const fill of detect.fills) {
        const share = fill.bordersGap && !closed ? OPEN_ROOM_SHARE : 1;
        fill.mesh.material.opacity = ROOM_FILL_ALPHA * det.rooms * sem * share;
        fill.mesh.visible = fill.mesh.material.opacity > 1e-3;
      }
      detect.rooms.setOpacity(0.8 * det.rooms * sem);
      detect.openings.reveal(det.openings);
      detect.openings.setOpacity(clamp01(det.openings * 3) * sem);
      detect.furniture.reveal(det.furniture);
      detect.furniture.setOpacity(clamp01(det.furniture * 3) * sem);

      if (review) {
        if (rev.close !== lastClose) {
          review.setClose(rev.close);
          lastClose = rev.close;
        }
        review.gap.setOpacity(detect.walls.material.opacity);
        review.outline.setOpacity(rev.highlight * sem);
        review.handleFixed.setOpacity(rev.highlight * sem);
        review.handleMoving.setOpacity(rev.highlight * sem);
      }

      if (compliance.door) {
        compliance.door.reveal(comp.bathDoor);
        compliance.door.setOpacity(clamp01(comp.bathDoor * 4) * sem);
      }
      compliance.stair.reveal(comp.stair);
      compliance.stair.setOpacity(clamp01(comp.stair * 4) * sem);
      compliance.passes.setOpacity(comp.passMarks * sem);

      for (const anchor of anchorList) {
        const lift =
          anchor.layer === null ? 0 : drawing.position.y + (anchor.layer >= 0 ? det.explodeM * anchor.layer : 0);
        anchor.v.set(anchor.base[0], anchor.base[1] + lift, anchor.base[2]);
      }
    },

    setResolution(width, height) {
      for (const material of lineMaterials) {
        material.resolution.set(width, height);
      }
    },

    dispose() {
      group.removeFromParent();
      disposeTree(group);
      anchors.clear();
    },
  };
}
