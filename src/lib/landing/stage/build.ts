/**
 * One frame's build state written into the stage house (split from house.ts): rises, cutaway caps,
 * ceilings, the glass look and the window glow, joinery fades. Numbers and flags only, no allocation.
 */

import { Color, type Material } from 'three';

import type { LandingState } from '../types';

import { cutColour, GLASS_LOOK, setGlassLook } from './facade';
import { CUTAWAY_HEIGHT_M, JOINERY_DROP_M, type Grower, type StageHouse } from './house';
import { NO_CLAMP_Y } from './patch';

/** Below this a part is hidden rather than drawn as a sliver. */
const SHOWN = 0.001;

/** Rise a part to `amount` of its height (capped at `capM` above its foot). */
function rise(grower: Grower, amount: number, material: number, lift: number, capM = Infinity): void {
  const shown = amount > SHOWN;
  grower.object.visible = shown;
  grower.uniforms.uRiseY.value = grower.baseY + lift + Math.min(amount * grower.heightM, capM);
  grower.uniforms.uMat.value = material;
}

const RENDER_WHITE = new Color('#F4F6F7');
const NO_EYE = { x: -1e6, y: 0, z: -1e6 };
const CUT_DARK = new Color('#7D7972');
const cutNow = new Color();

/** Write one frame's build state into the house, seen from `eye` (the camera). Allocates nothing. */
export function applyBuild(h: StageHouse, s: LandingState, eye: { x: number; y: number; z: number } = NO_EYE): void {
  const { build } = s;
  const upperLift = build.upperLiftM;
  if (h.upper !== null) {
    h.upper.position.y = upperLift;
    h.upper.visible = build.upper > SHOWN;
  }
  for (const storey of h.stacked) {
    storey.position.y = upperLift;
  }
  const liftOf = (grower: Grower): number => grower.liftK * upperLift;

  for (const wall of h.walls.values()) {
    const cap = wall.heightM + (CUTAWAY_HEIGHT_M - wall.heightM) * build.cutaway;
    rise(wall, build.wallRise[wall.id] ?? 0, build.material, liftOf(wall), Math.max(cap, 0));
  }
  // Tall pieces are clamped with the walls in the cutaway, a little above the cut (finding 8).
  const pieceCap = CUTAWAY_HEIGHT_M + 0.15;
  for (const piece of h.furniture.values()) {
    const cap = piece.heightM > pieceCap ? piece.heightM + (pieceCap - piece.heightM) * build.cutaway : Infinity;
    rise(piece, build.furniture[piece.id] ?? 0, build.material, liftOf(piece), cap);
  }
  // From the moment the camera is in the ground storey its ceiling is on: the upper floor's oak
  // underside must never read as the ceiling (archviz-r2 fix 11, p 0.60).
  const [ix0, iz0, ix1, iz1, itop] = h.inside;
  const inside = eye.x > ix0 && eye.x < ix1 && eye.z > iz0 && eye.z < iz1 && eye.y < itop;
  const ceilingOn = (build.ceiling > 0.5 || inside) && build.cutaway <= SHOWN;
  for (const ceiling of h.ceilings) {
    ceiling.visible = ceilingOn;
  }
  // Roof on and camera outside: dark reflective glass with warm rooms behind it; otherwise clear.
  const exterior = !inside && build.roof > 0.5 && build.roofLiftM < 0.5 && build.cutaway <= SHOWN && upperLift < 0.05;
  for (const glow of h.glows) {
    glow.visible = exterior;
  }
  if (h.look.exterior !== exterior) {
    h.look.exterior = exterior;
    for (const clone of h.clonesOf.get(h.materials.glass) ?? []) {
      setGlassLook(clone, exterior ? GLASS_LOOK.exterior : GLASS_LOOK.interior);
    }
  }
  cutColour(cutNow, RENDER_WHITE, CUT_DARK, build.cutaway);
  for (const clone of h.clonesOf.get(h.materials.cut) ?? []) {
    (clone as Material & { color: Color }).color.copy(cutNow);
  }
  for (const floor of h.floors) {
    rise(floor, build.floors, build.floors, liftOf(floor));
  }
  rise(h.stair, build.stair, build.material, liftOf(h.stair));

  const storeyM = h.walls.get('W1')?.heightM ?? 3;
  const doorFade = 1 - s.compliance.bathDoor;
  for (const part of h.joinery) {
    const opacity = part.id === h.failedDoorId ? build.joinery * doorFade : build.joinery;
    part.object.visible = opacity > SHOWN;
    // Frames and leaves are cut with the walls, or a window frame floats above a 1.2 m wall.
    part.uniforms.uRiseY.value =
      build.cutaway > SHOWN ? part.floorY + liftOf(part) + storeyM + (CUTAWAY_HEIGHT_M - storeyM) * build.cutaway : NO_CLAMP_Y;
    part.uniforms.uOpacity.value = opacity;
    // Negative drop = raised: it settles into place as joinery reaches 1.
    part.uniforms.uDrop.value = -JOINERY_DROP_M * (1 - build.joinery);
    part.uniforms.uMat.value = build.material;
  }
}
