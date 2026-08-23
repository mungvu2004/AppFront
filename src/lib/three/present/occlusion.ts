/**
 * Ambient occlusion, baked into the vertices once at assembly.
 *
 * What separates a rendered room from a lit diagram, after the pools of
 * light, is that nothing is evenly lit where two things meet: a leg darkens
 * towards the floor, the back of a sofa darkens against the wall, the inside
 * of a bookcase is dimmer than its face. A screen-space pass would find all
 * that every frame and pay for it every frame. Nothing here moves, so it is
 * found once, on the CPU, and written into the `color` attribute the lit
 * materials multiply by.
 *
 * The model is a cheap stand-in for hemisphere sampling. Every opaque mesh
 * — the walls and slabs included — is an axis-aligned box; a vertex is
 * occluded by a box in proportion to how close the box's nearest point is
 * (within {@link OCCLUSION_REACH}) and how squarely the vertex's normal faces
 * it; a vertex touching a box is occluded by it whatever its normal, which
 * is what darkens a leg's foot on every side. The boxes live in a coarse
 * grid so each vertex looks at its neighbours rather than at the whole
 * house. A vertex never occludes itself: its own mesh's box is skipped.
 *
 * A box's corners are the only places a value is stored, so a big carcass
 * would smear its floor shadow up its whole face; `pieces/primitives.ts`
 * therefore subdivides large boxes, and the darkening stays where it belongs.
 */

import { Box3, BufferAttribute, Matrix3, Mesh, Vector3, type Object3D } from 'three';

/* -------------------------------------------------------------------------- */
/* Constants.                                                                  */
/* -------------------------------------------------------------------------- */

/** How far, in scene units, an occluder reaches. Past this it contributes nothing. */
export const OCCLUSION_REACH = 0.35;

/** How much darker a fully occluded vertex gets. */
const OCCLUSION_STRENGTH = 0.55;

/** The darkest a vertex may go, as a multiplier of its lit colour. */
const OCCLUSION_FLOOR = 0.45;

/** Grid cell size for the occluder lookup; a reach or so, so one ring of cells covers it. */
const CELL = 0.5;

/** Closer than this, a vertex is touching the box and faces it whatever its normal says. */
const TOUCHING = 0.002;

/* -------------------------------------------------------------------------- */
/* Occluders.                                                                  */
/* -------------------------------------------------------------------------- */

/** A world-space box and the mesh it came from, if any. */
export interface Occluder {
  readonly box: Box3;
  readonly owner: Object3D | null;
}

/** Whether a mesh is solid enough to occlude, or to be occluded: opaque, or a multi-material part. */
function isSolid(object: Object3D): object is Mesh {
  if (!(object instanceof Mesh)) {
    return false;
  }
  return Array.isArray(object.material) || !object.material.transparent;
}

/** Every solid mesh under `root` as an occluder, in `root`'s frame. */
export function meshOccluders(root: Object3D): Occluder[] {
  root.updateMatrixWorld(true);
  const found: Occluder[] = [];
  root.traverse((object) => {
    if (isSolid(object) && object.geometry.hasAttribute('position')) {
      found.push({ box: new Box3().setFromObject(object), owner: object });
    }
  });
  return found;
}

/** A coarse spatial index over occluders. */
class OccluderGrid {
  private readonly cells = new Map<string, Occluder[]>();

  constructor(occluders: readonly Occluder[]) {
    for (const occluder of occluders) {
      const { min, max } = occluder.box;
      for (let x = Math.floor(min.x / CELL); x <= Math.floor(max.x / CELL); x += 1) {
        for (let y = Math.floor(min.y / CELL); y <= Math.floor(max.y / CELL); y += 1) {
          for (let z = Math.floor(min.z / CELL); z <= Math.floor(max.z / CELL); z += 1) {
            const key = `${x},${y},${z}`;
            const cell = this.cells.get(key) ?? [];
            cell.push(occluder);
            this.cells.set(key, cell);
          }
        }
      }
    }
  }

  /** Every occluder whose box touches the cells within one reach of `point`. */
  near(point: Vector3, visit: (occluder: Occluder) => void): void {
    const seen = new Set<Occluder>();
    for (let x = Math.floor((point.x - OCCLUSION_REACH) / CELL); x <= Math.floor((point.x + OCCLUSION_REACH) / CELL); x += 1) {
      for (let y = Math.floor((point.y - OCCLUSION_REACH) / CELL); y <= Math.floor((point.y + OCCLUSION_REACH) / CELL); y += 1) {
        for (let z = Math.floor((point.z - OCCLUSION_REACH) / CELL); z <= Math.floor((point.z + OCCLUSION_REACH) / CELL); z += 1) {
          for (const occluder of this.cells.get(`${x},${y},${z}`) ?? []) {
            if (!seen.has(occluder)) {
              seen.add(occluder);
              visit(occluder);
            }
          }
        }
      }
    }
  }
}

/* -------------------------------------------------------------------------- */
/* The estimate.                                                               */
/* -------------------------------------------------------------------------- */

/**
 * How much one box occludes a point with a normal: nothing beyond the reach,
 * most when the point touches the box and faces it, falling off with the
 * square of the distance and the cosine of the angle.
 */
export function boxOcclusion(point: Vector3, normal: Vector3, box: Box3, closest = new Vector3()): number {
  box.clampPoint(point, closest);
  const distance = closest.distanceTo(point);
  if (distance >= OCCLUSION_REACH) {
    return 0;
  }

  const facing = distance < TOUCHING ? 1 : Math.max(0, closest.sub(point).divideScalar(distance).dot(normal));
  const nearness = 1 - distance / OCCLUSION_REACH;
  return nearness * nearness * facing;
}

/** Total occlusion folded into a vertex-colour multiplier. */
export function occlusionToShade(total: number): number {
  return Math.max(OCCLUSION_FLOOR, 1 - total * OCCLUSION_STRENGTH);
}

/**
 * Write a `color` attribute onto every solid mesh under `roots`, darkened
 * where the occluders crowd it. Positions and normals are read in world
 * space, so a turned or lifted piece is occluded by what is really beside it.
 * Returns how many meshes were shaded.
 */
export function bakeVertexOcclusion(roots: readonly Object3D[], occluders: readonly Occluder[]): number {
  const grid = new OccluderGrid(occluders);
  const point = new Vector3();
  const normal = new Vector3();
  const closest = new Vector3();
  const normalMatrix = new Matrix3();
  let shaded = 0;

  for (const root of roots) {
    root.updateMatrixWorld(true);
    root.traverse((object) => {
      if (!isSolid(object) || !object.geometry.hasAttribute('normal')) {
        return;
      }

      const positions = object.geometry.getAttribute('position');
      const normals = object.geometry.getAttribute('normal');
      const colors = new Float32Array(positions.count * 3);
      normalMatrix.getNormalMatrix(object.matrixWorld);

      for (let vertex = 0; vertex < positions.count; vertex += 1) {
        point.fromBufferAttribute(positions, vertex).applyMatrix4(object.matrixWorld);
        normal.fromBufferAttribute(normals, vertex).applyMatrix3(normalMatrix).normalize();

        let total = 0;
        grid.near(point, (occluder) => {
          if (occluder.owner !== object) {
            total += boxOcclusion(point, normal, occluder.box, closest);
          }
        });

        const shade = occlusionToShade(total);
        colors[vertex * 3] = shade;
        colors[vertex * 3 + 1] = shade;
        colors[vertex * 3 + 2] = shade;
      }

      object.geometry.setAttribute('color', new BufferAttribute(colors, 3));
      shaded += 1;
    });
  }

  return shaded;
}

/** A `color` attribute of plain white on a geometry that has none, so a vertex-coloured material draws it unchanged. */
export function ensureWhiteVertexColors(mesh: Mesh): void {
  const geometry = mesh.geometry;
  if (geometry.hasAttribute('color') || !geometry.hasAttribute('position')) {
    return;
  }
  const count = geometry.getAttribute('position').count;
  geometry.setAttribute('color', new BufferAttribute(new Float32Array(count * 3).fill(1), 3));
}
