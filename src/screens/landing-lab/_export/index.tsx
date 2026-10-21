/**
 * Chỉ bản dev: dựng nhà minh hoạ ở trạng thái hoàn chỉnh và xuất `house.glb`, `walls.json`, các bản vẽ SVG
 * cho bước chuẩn bị homepage v6. Playwright đọc `window.__houseExport` rồi ghi ra `F:/App-review/homepage-v6/shared`.
 */

import { useEffect, useState } from 'react';
import { Box3, Group, InstancedMesh, Matrix4, Mesh, MeshBasicMaterial, Vector3, type Material, type Object3D } from 'three';
import { GLTFExporter } from 'three/examples/jsm/exporters/GLTFExporter.js';

import { buildStair, LANDING_HOUSE, levelPlanSvg, planSvg } from '@/lib/landing/house';
import { buildStageHouse } from '@/lib/landing/stage/house';
import { landingScenePalette } from '@/lib/landing/stage/look';
import { buildRoofs } from '@/lib/landing/stage/roof';
import { createSite } from '@/lib/landing/stage/site/index';
import type { LandingState } from '@/lib/landing/types';
import { readPartData } from '@/lib/three/build/scene';
import { createAssetService, readPalette } from '@/lib/three/present';

interface HouseExport {
  glb: string;
  walls: string;
  svgs: Record<string, string>;
  log: string[];
}

declare global {
  interface Window {
    __houseExport?: Promise<HouseExport>;
  }
}

const DECOR = /plant|artwork|picture|rug|carpet|lamp|pendant|vase/;
const M = (mm: number): number => Math.round(mm) / 1000;

function group(name: string, parent: Object3D): Group {
  const g = new Group();
  g.name = name;
  parent.add(g);
  return g;
}

/** Replace every InstancedMesh with one Mesh per instance (shared geometry, so Blender gets linked duplicates). */
function bakeInstances(root: Object3D): void {
  const found: InstancedMesh[] = [];
  root.traverse((o) => {
    if (o instanceof InstancedMesh) found.push(o);
  });
  const m = new Matrix4();
  for (const inst of found) {
    const holder = new Group();
    holder.name = inst.name;
    holder.position.copy(inst.position);
    holder.quaternion.copy(inst.quaternion);
    holder.scale.copy(inst.scale);
    for (let i = 0; i < inst.count; i += 1) {
      inst.getMatrixAt(i, m);
      const mesh = new Mesh(inst.geometry, inst.material);
      mesh.name = `${inst.name}#${i}`;
      m.decompose(mesh.position, mesh.quaternion, mesh.scale);
      holder.add(mesh);
    }
    inst.parent?.add(holder);
    inst.removeFromParent();
  }
}

function wallsJson(): unknown {
  const { plan } = LANDING_HOUSE;
  const names = new Map(LANDING_HOUSE.rooms.map((r) => [r.roomId, r]));
  return {
    frame: 'plan metres: x east (along the street), y into the plot (street at y=0). GLB: X=x, Y=up, Z=y. Blender after glTF import: X=x, Y=-y, Z=up.',
    axes: LANDING_HOUSE.axes.map((a) => ({ id: a.id, along: a.along, at_m: M(a.atMm) })),
    levels: [...plan.levels]
      .sort((a, b) => a.elevationMm - b.elevationMm)
      .map((level, index) => {
        const walls = plan.walls.filter((w) => w.levelId === level.id);
        return {
          index,
          id: level.id,
          elevation_m: M(level.elevationMm),
          storey_height_m: M(level.heightMm),
          walls: walls.map((w) => ({
            id: w.id,
            kind: w.kind,
            start: [M(w.start[0] ?? 0), M(w.start[1] ?? 0)],
            end: [M(w.end[0] ?? 0), M(w.end[1] ?? 0)],
            thickness_m: M(w.thicknessMm),
            height_m: M(w.heightMm ?? level.heightMm),
          })),
          openings: plan.openings
            .filter((o) => walls.some((w) => w.id === o.wallId))
            .map((o) => {
              const w = walls.find((x) => x.id === o.wallId);
              const [ax, ay, bx, by] = [w?.start[0] ?? 0, w?.start[1] ?? 0, w?.end[0] ?? 0, w?.end[1] ?? 0];
              const len = Math.hypot(bx - ax, by - ay);
              const t = o.relativePosition;
              return {
                id: o.id,
                wall: o.wallId,
                type: o.kind,
                swing: o.swing,
                ...(o.opensTowards === undefined ? {} : { opens_towards: o.opensTowards }),
                along_m: M(t * len),
                centre: [M(ax + (bx - ax) * t), M(ay + (by - ay) * t)],
                width_m: M(o.widthMm),
                sill_m: M(o.sillHeightMm),
                head_m: M(o.sillHeightMm + o.heightMm),
              };
            }),
          rooms: plan.rooms
            .filter((r) => r.levelId === level.id)
            .map((r) => {
              const pts = r.outline.map((p) => [M(p[0] ?? 0), M(p[1] ?? 0)] as const);
              let a = 0;
              pts.forEach(([x0, y0], i) => {
                const [x1, y1] = pts[(i + 1) % pts.length] ?? [0, 0];
                a += x0 * y1 - x1 * y0;
              });
              return {
                id: r.id,
                name: names.get(r.id)?.name ?? r.id,
                finish: r.finish,
                polygon: pts,
                area_m2: Math.round(Math.abs(a / 2) * 100) / 100,
                stated_area_m2: names.get(r.id)?.statedAreaM2 ?? null,
              };
            }),
        };
      }),
  };
}

async function run(): Promise<HouseExport> {
  const log: string[] = [];
  const house = LANDING_HOUSE;
  const assets = createAssetService({ dracoDecoderPath: '/draco/' });
  const stage = buildStageHouse(house, (m) => buildStair(house.stair, m.wood), landingScenePalette(readPalette()), { assets });
  await Promise.allSettled(stage.pieces.map((p) => p.ready));
  const roofs = buildRoofs(house);
  const site = createSite(house, { materials: stage.materials, anisotropy: 1, assets });
  await site.ready;
  site.apply({ build: { site: 1, planting: 1, water: 1 } } as unknown as LandingState);

  // Name materials by their role in present's set (clones keep the original's role).
  const roles = new Map<Material, string>();
  for (const [key, mat] of Object.entries(stage.materials)) {
    roles.set(mat as Material, key);
    for (const clone of stage.clonesOf.get(mat as Material) ?? []) roles.set(clone, key);
  }

  const out = new Group();
  out.name = 'estate';
  const houseNode = group('house', out);
  const levels = [...house.plan.levels].sort((a, b) => a.elevationMm - b.elevationMm);
  const levelNodes = levels.map((l, k) => {
    const g = group(`level_${k}`, houseNode);
    g.userData = { levelId: l.id, elevation_m: M(l.elevationMm) };
    const kids = Object.fromEntries(
      ['walls', 'slabs', 'doors', 'windows', 'joinery', 'stair', 'furniture', 'decor'].map((n) => [n, group(`level_${k}_${n}`, g)]),
    );
    return kids;
  });
  stage.root.updateMatrixWorld(true);
  const put = (k: number, bin: string, name: string, obj: Object3D): void => {
    obj.name = name;
    const target = levelNodes[k]?.[bin];
    target?.attach(obj);
  };
  for (const w of stage.walls.values()) put(w.liftK, 'walls', `wall_${w.id}`, w.object);
  stage.floors.forEach((f) => put(f.liftK, 'slabs', `slab_${f.id}`, f.object));
  const openings = new Map(house.plan.openings.map((o) => [o.id, o.kind]));
  // Untagged joinery (frames, sills, mullions, glass) goes with the nearest opening centre on its storey.
  const centres = house.plan.openings.flatMap((o) => {
    const w = house.plan.walls.find((x) => x.id === o.wallId);
    if (w === undefined) return [];
    const t = o.relativePosition;
    const x = ((w.start[0] ?? 0) + ((w.end[0] ?? 0) - (w.start[0] ?? 0)) * t) / 1000;
    const z = ((w.start[1] ?? 0) + ((w.end[1] ?? 0) - (w.start[1] ?? 0)) * t) / 1000;
    return [{ id: o.id, kind: o.kind, level: w.levelId, x, z, r: o.widthMm / 2000 + 0.3 }];
  });
  const levelIds = levels.map((l) => l.id);
  const used = new Map<string, number>();
  const centre = new Vector3();
  for (const j of stage.joinery) {
    let kind = openings.get(j.id);
    let id = j.id;
    let suffix = '';
    if (kind === undefined) {
      new Box3().setFromObject(j.object).getCenter(centre);
      const near = centres
        .filter((c) => c.level === levelIds[j.liftK])
        .map((c) => ({ c, d: Math.hypot(c.x - centre.x, c.z - centre.z) }))
        .sort((a, b) => a.d - b.d)[0];
      if (near !== undefined && near.d < near.c.r) {
        kind = near.c.kind;
        id = near.c.id;
        const n = (used.get(id) ?? 0) + 1;
        used.set(id, n);
        suffix = `_part${n}`;
      }
    }
    if (kind === 'door') put(j.liftK, 'doors', `door_${id}${suffix}`, j.object);
    else if (kind === 'window') put(j.liftK, 'windows', `window_${id}${suffix}`, j.object);
    else {
      // Per-wall trims (skirting / caps) sit centred on their wall: name them after it.
      const wall = house.plan.walls.find(
        (w) =>
          w.levelId === levelIds[j.liftK] &&
          Math.hypot(((w.start[0] ?? 0) + (w.end[0] ?? 0)) / 2000 - centre.x, ((w.start[1] ?? 0) + (w.end[1] ?? 0)) / 2000 - centre.z) < 0.35,
      );
      put(j.liftK, 'joinery', wall === undefined ? `${readPartData(j.object)?.kind ?? 'part'}_${j.id}` : `trim_${wall.id}`, j.object);
      if (wall === undefined) log.push(`unmatched joinery L${j.liftK} at ${Math.round(centre.x)},${Math.round(centre.z)}`);
    }
  }
  put(stage.stair.liftK, 'stair', `stair_${stage.stair.id}`, stage.stair.object);
  const furniture = new Map(house.plan.furniture.map((f) => [f.id, f]));
  for (const p of stage.furniture.values()) {
    const f = furniture.get(p.id);
    const tag = `${p.id} ${f?.variant ?? ''} ${f?.modelUrl ?? ''}`.toLowerCase();
    put(p.liftK, DECOR.test(tag) ? 'decor' : 'furniture', `furn_${p.id}`, p.object);
  }
  log.push(`dropped house leftovers: ${stage.root.children.length} (downlights, ceilings, glows)`);

  roofs.group.name = 'roofs';
  out.add(roofs.group);
  const [hips, roofSite] = roofs.group.children;
  if (hips !== undefined) hips.name = 'roof_hips';
  if (roofSite !== undefined) roofSite.name = 'roof_site';
  hips?.children.forEach((o) => {
    o.name = `roof_level_${String(o.userData.liftK)}`;
  });

  site.group.visible = true;
  out.add(site.group);
  const siteNode = site.group;
  const bins = Object.fromEntries(['ground', 'paving', 'structures', 'water', 'plants', 'items'].map((n) => [n, group(`site_${n}`, siteNode)]));
  for (const child of [...siteNode.children]) {
    const n = child.name;
    if (Object.values(bins).includes(child as Group)) continue;
    const bin = /lawn|bed/.test(n)
      ? 'ground'
      : /paving|stone|granite/.test(n) && !/pond/i.test(n)
        ? 'paving'
        : /render|gate/.test(n)
          ? 'structures'
          : /pond|water/i.test(n)
            ? 'water'
            : /planting/.test(n)
              ? 'plants'
              : /items/.test(n)
                ? 'items'
                : null;
    if (bin === null) {
      log.push(`dropped site child ${n}`);
      child.removeFromParent();
    } else bins[bin]?.attach(child);
  }
  bakeInstances(out);

  // Drop see-through helpers (soffit light pools, contact blobs, glow cards); strip textures (they get replaced).
  const drop: Object3D[] = [];
  let meshes = 0;
  out.traverse((o) => {
    o.visible = true;
    if (!(o instanceof Mesh)) return;
    const mats = (Array.isArray(o.material) ? o.material : [o.material]) as Material[];
    if (mats.some((m) => m instanceof MeshBasicMaterial && m.transparent) || /contact|glow|ceiling/.test(o.name)) {
      drop.push(o);
      return;
    }
    meshes += 1;
    if (o.name === '') o.name = `${o.parent?.name ?? 'mesh'}_part`;
    for (const m of mats) {
      const rec = m as unknown as Record<string, unknown>;
      for (const k of ['map', 'normalMap', 'roughnessMap', 'metalnessMap', 'aoMap', 'emissiveMap', 'bumpMap', 'alphaMap', 'lightMap', 'envMap']) {
        if (k in rec) rec[k] = null;
      }
      if (m.name === '') m.name = roles.get(m) ?? `${(o.name.split('#')[0] ?? 'mat').replace(/^site:/, '')}_mat`;
    }
  });
  log.push([...new Set(drop.filter((o) => !/contact|soffit|glow/.test(o.name)).map((o) => `${o.parent?.parent?.name ?? ''}/${o.parent?.name ?? ''}/${o.name}`))].slice(0, 40).join(' | '));
  drop.forEach((o) => o.removeFromParent());
  log.push(`meshes ${meshes}, dropped ${drop.length}: ${[...new Set(drop.map((o) => o.name.split('#')[0]))].join(',')}`);

  const glb = (await new GLTFExporter().parseAsync(out, { binary: true, onlyVisible: false })) as ArrayBuffer;
  const bytes = new Uint8Array(glb);
  let bin = '';
  for (let i = 0; i < bytes.length; i += 0x8000) bin += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  const svgs: Record<string, string> = { 'plan-site': planSvg(house) };
  levels.forEach((l, k) => {
    svgs[`plan-level${k}`] = levelPlanSvg(house, l.id);
  });
  return { glb: btoa(bin), walls: JSON.stringify(wallsJson(), null, 1), svgs, log };
}

export default function ExportHouse() {
  const [state, setState] = useState('Đang xuất…');
  useEffect(() => {
    const job = run();
    window.__houseExport = job;
    job.then(
      (r) => setState(`Xong: ${r.log.join(' · ')}`),
      (e: unknown) => setState(`Lỗi: ${String(e)}`),
    );
  }, []);
  return <p>{state}</p>;
}
