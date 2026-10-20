/**
 * The stair as real geometry: a box per tread (with nosing), a plate per riser
 * and a saw-tooth stringer on the open side, all from one `StairSpec`.
 *
 * Built in scene metres around the foot of the flight with the climb along local
 * +z and the open (stringer) side at local +x, then turned to the compass
 * direction. The group's base is y = 0: the caller lifts it to the level's
 * elevation (0 for the ground-floor flight). Riser i stands at run i * tread; the
 * 16th tread is only the lip of the upper slab, so the flight's run is
 * (risers - 1) * tread and the slab starts there.
 */

import { BoxGeometry, ExtrudeGeometry, Group, Mesh, MeshStandardMaterial, Shape, type Material } from 'three';

import type { StairSpec } from '../types';

const MM = 0.001;
const TREAD_THICKNESS = 0.04;
const NOSING = 0.025;
const RISER_THICKNESS = 0.02;
const STRINGER_THICKNESS = 0.04;
const STRINGER_DEPTH = 0.25;

const TURN: Record<StairSpec['climbs'], number> = { north: 0, east: Math.PI / 2, south: Math.PI, west: -Math.PI / 2 };

export function buildStair(spec: StairSpec, material?: Material): Group {
  const mat = material ?? new MeshStandardMaterial({ color: 0xb08a5a, roughness: 0.7 });
  const rise = spec.riserMm * MM;
  const run = spec.treadMm * MM;
  const width = spec.widthMm * MM;
  const group = new Group();
  group.name = spec.id;
  group.userData['id'] = spec.id;

  const add = (geometry: BoxGeometry, id: string, x: number, y: number, z: number): void => {
    const mesh = new Mesh(geometry, mat);
    mesh.position.set(x, y, z);
    mesh.userData['id'] = id;
    group.add(mesh);
  };

  for (let i = 0; i < spec.risers; i += 1) {
    const top = (i + 1) * rise;
    const front = i * run;
    // The last tread is the slab's lip: it ends just past the last riser.
    const back = i === spec.risers - 1 ? front + 0.06 : (i + 1) * run;
    const depth = back - front + NOSING;
    add(new BoxGeometry(width, TREAD_THICKNESS, depth), `stair:tread:${String(i)}`, 0, top - TREAD_THICKNESS / 2, front - NOSING + depth / 2);
    add(
      new BoxGeometry(width, rise - TREAD_THICKNESS, RISER_THICKNESS),
      `stair:riser:${String(i)}`,
      0,
      i * rise + (rise - TREAD_THICKNESS) / 2,
      front + RISER_THICKNESS / 2,
    );
  }

  group.add(stringer(spec, mat, rise, run, width));
  group.position.set(spec.startMm[0] * MM, 0, spec.startMm[1] * MM);
  group.rotation.y = TURN[spec.climbs];
  return group;
}

/** Saw-tooth profile (X = run, Y = height) extruded across the open side. */
function stringer(spec: StairSpec, mat: Material, rise: number, run: number, width: number): Mesh {
  const last = spec.risers - 1;
  const shape = new Shape();
  shape.moveTo(0, 0);
  for (let i = 0; i < last; i += 1) {
    shape.lineTo(i * run, (i + 1) * rise);
    shape.lineTo((i + 1) * run, (i + 1) * rise);
  }
  shape.lineTo(last * run, spec.risers * rise);
  // Underside parallel to the nosing line, cut off where it meets the floor.
  shape.lineTo(last * run, spec.risers * rise - STRINGER_DEPTH);
  shape.lineTo((STRINGER_DEPTH / rise - 1) * run, 0);
  shape.closePath();

  const geometry = new ExtrudeGeometry(shape, { depth: STRINGER_THICKNESS, bevelEnabled: false });
  // Shape X -> local +z, extrusion Z -> local -x; shift so it hugs the tread edge at x = width / 2.
  geometry.rotateY(-Math.PI / 2);
  geometry.translate(width / 2 + STRINGER_THICKNESS, 0, 0);
  const mesh = new Mesh(geometry, mat);
  mesh.userData['id'] = 'stair:stringer';
  return mesh;
}
