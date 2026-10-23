/**
 * The stair as real geometry: a box per tread (with nosing), a plate per riser
 * and a saw-tooth stringer on each flight's outer side, all from one `StairSpec`.
 *
 * Built in scene metres around the foot of the stair with the climb along local
 * +z, then turned to the compass direction. The group's base is y = 0: the caller
 * lifts it to the level's elevation. In a flight, riser i stands at run i * tread;
 * a straight stair's last tread is only the lip of the upper slab, so its run is
 * (risers - 1) * tread. A U-stair (`spec.landing`) climbs `afterRisers` risers,
 * whose last tread is the half-landing, then a parallel flight climbs back to a
 * slab lip on the line of the foot. Ids: `stair:tread:<i>` / `stair:riser:<i>`
 * numbered up the whole stair (the landing is the tread of riser afterRisers - 1),
 * `stair:stringer:<flight>`.
 */

import { BoxGeometry, ExtrudeGeometry, Group, Mesh, MeshStandardMaterial, Shape, type Material } from 'three';

import type { StairSpec } from '../types';

const MM = 0.001;
const TREAD_THICKNESS = 0.04;
const NOSING = 0.025;
const RISER_THICKNESS = 0.02;
const STRINGER_THICKNESS = 0.04;
const STRINGER_DEPTH = 0.25;
const LIP = 0.06;

type Compass = StairSpec['climbs'];
const TURN: Record<Compass, number> = { north: 0, east: Math.PI / 2, south: Math.PI, west: -Math.PI / 2 };
/** Scene x / z of each compass point (north = +z). */
const DIR: Record<Compass, readonly [number, number]> = { north: [0, 1], east: [1, 0], south: [0, -1], west: [-1, 0] };

interface Flight {
  readonly risers: number;
  readonly first: number; // index of its first riser in the whole stair
  /** Depth of the top tread past the last riser: a landing, or the slab lip. */
  readonly topDepth: number;
  readonly stringerSide: 1 | -1;
}

function buildFlight(f: Flight, spec: StairSpec, mat: Material): Group {
  const rise = spec.riserMm * MM;
  const run = spec.treadMm * MM;
  const width = spec.widthMm * MM;
  const flight = new Group();
  const add = (geometry: BoxGeometry, id: string, x: number, y: number, z: number): void => {
    const mesh = new Mesh(geometry, mat);
    mesh.position.set(x, y, z);
    mesh.userData['id'] = id;
    flight.add(mesh);
  };
  for (let i = 0; i < f.risers; i += 1) {
    const n = f.first + i;
    const top = (i + 1) * rise;
    const front = i * run;
    const back = i === f.risers - 1 ? front + f.topDepth : (i + 1) * run;
    const depth = back - front + NOSING;
    add(new BoxGeometry(width, TREAD_THICKNESS, depth), `stair:tread:${String(n)}`, 0, top - TREAD_THICKNESS / 2, front - NOSING + depth / 2);
    add(
      new BoxGeometry(width, rise - TREAD_THICKNESS, RISER_THICKNESS),
      `stair:riser:${String(n)}`,
      0,
      i * rise + (rise - TREAD_THICKNESS) / 2,
      front + RISER_THICKNESS / 2,
    );
  }
  flight.add(stringer(f, mat, rise, run, width));
  return flight;
}

export function buildStair(spec: StairSpec, material?: Material): Group {
  const mat = material ?? new MeshStandardMaterial({ color: 0xb08a5a, roughness: 0.7 });
  const group = new Group();
  group.name = spec.id;
  group.userData['id'] = spec.id;
  const run = spec.treadMm * MM;
  const landing = spec.landing;

  if (landing === undefined) {
    group.add(buildFlight({ risers: spec.risers, first: 0, topDepth: LIP, stringerSide: 1 }, spec, mat));
  } else {
    // Which local side (+x or -x) the return flight is on: local +x after the turn.
    const t = TURN[spec.climbs];
    const [rx, rz] = DIR[landing.returnsOn];
    const side = Math.sign(Math.cos(t) * rx - Math.sin(t) * rz) >= 0 ? 1 : -1;
    const a = landing.afterRisers;
    const offset = (spec.widthMm + landing.gapMm) * MM;
    const first = buildFlight({ risers: a, first: 0, topDepth: 0, stringerSide: side === 1 ? -1 : 1 }, spec, mat);
    group.add(first);
    // The half-landing spans both flights and the gap.
    const depth = landing.depthMm * MM;
    const across = 2 * spec.widthMm * MM + landing.gapMm * MM;
    const plate = new Mesh(new BoxGeometry(across, TREAD_THICKNESS, depth + NOSING), mat);
    plate.position.set((side * offset) / 2, a * spec.riserMm * MM - TREAD_THICKNESS / 2, (a - 1) * run - NOSING + (depth + NOSING) / 2);
    plate.userData['id'] = 'stair:landing';
    group.add(plate);
    // The return flight, turned half round, its first riser on the landing's front line.
    const back = buildFlight({ risers: spec.risers - a, first: a, topDepth: LIP, stringerSide: side === 1 ? -1 : 1 }, spec, mat);
    back.rotation.y = Math.PI;
    back.position.set(side * offset, a * spec.riserMm * MM, (a - 1) * run);
    group.add(back);
  }

  group.position.set(spec.startMm[0] * MM, 0, spec.startMm[1] * MM);
  group.rotation.y = TURN[spec.climbs];
  return group;
}

/** Saw-tooth profile (X = run, Y = height) extruded across the flight's outer side. */
function stringer(f: Flight, mat: Material, rise: number, run: number, width: number): Mesh {
  const last = f.risers - 1;
  const shape = new Shape();
  shape.moveTo(0, 0);
  for (let i = 0; i < last; i += 1) {
    shape.lineTo(i * run, (i + 1) * rise);
    shape.lineTo((i + 1) * run, (i + 1) * rise);
  }
  shape.lineTo(last * run, f.risers * rise);
  // Underside parallel to the nosing line, cut off where it meets the floor.
  shape.lineTo(last * run, f.risers * rise - STRINGER_DEPTH);
  shape.lineTo((STRINGER_DEPTH / rise - 1) * run, 0);
  shape.closePath();

  const geometry = new ExtrudeGeometry(shape, { depth: STRINGER_THICKNESS, bevelEnabled: false });
  // Shape X -> local +z, extrusion Z -> local -x; shift so it hugs the chosen tread edge.
  geometry.rotateY(-Math.PI / 2);
  geometry.translate(f.stringerSide === 1 ? width / 2 + STRINGER_THICKNESS : -width / 2, 0, 0);
  const mesh = new Mesh(geometry, mat);
  mesh.userData['id'] = `stair:stringer:${String(f.first)}`;
  return mesh;
}
