/**
 * Phản chiếu + trời qua kính (bền, dùng chung mọi vật liệu). Vendor gọi qua `@pascal-realism/reflect`
 * (luật `scripts/realism/r9t-reflect.mjs`).
 *
 * - `hdriBackdrop`: phông hậu kỳ vốn là gradient tự tính (`lib/backdrop.ts`), HDRI chỉ làm
 *   `scene.environment` → nhìn qua kính chỉ thấy dải sương be ở chân trời. Trên chân trời giờ lấy
 *   HDRI (đã pha gradient như môi trường); sát chân trời giữ gradient để đĩa chân trời khớp không viền.
 * - `syncReflectionProbe`: gương/inox/kính/sàn bóng phản chiếu HDRI chung → "tấm bạc mờ". Khi camera
 *   đứng yên trong nhà (dưới trần, trong hộp trần) chụp một PMREM tại camera, gán `envMap` cho vật
 *   liệu bóng; ra ngoài nhà trả lại môi trường chung. Mức Thấp không chụp.
 */
import {
  DataTexture,
  EquirectangularReflectionMapping,
  FloatType,
  LinearFilter,
  type Material,
  type Object3D,
  type PerspectiveCamera,
  RGBAFormat,
  type RenderTarget,
  type Scene,
  type Texture,
  Vector3,
} from 'three';
import { equirectUV, float, mix, positionViewDirection, smoothstep, texture, transformedNormalView, uniform } from 'three/tsl';
import { MeshStandardNodeMaterial, PMREMGenerator, type WebGPURenderer } from 'three/webgpu';

import { glassTwinParams, isGlossy, isLambertGlass, reflectProbeWanted } from './reflectRules';
import { useRealism } from './store';
import { currentTier } from './tiers';

// Ảnh giữ chỗ cùng kiểu với HDRI (RGBA float) → đổi `value` không đổi bố cục binding.
const placeholder = new DataTexture(new Float32Array(4), 1, 1, RGBAFormat, FloatType);
placeholder.minFilter = LinearFilter;
placeholder.magFilter = LinearFilter;
placeholder.generateMipmaps = false;
placeholder.needsUpdate = true;
const skyTex = texture(placeholder);
const skyWeight = uniform(0);
let skyHdri: Texture | null = null;

/** Số đo probe, đọc qua `__pascalProbe.reflect()` (`?probe=1`). `lastMs` = thời gian CPU của `fromScene`. */
export const reflectStats = { captures: 0, lastMs: 0, maxMs: 0, glossy: 0, inside: false };
(globalThis as { __realismReflect?: object }).__realismReflect = reflectStats;

/**
 * Bản HDRI THUẦN cho phông trời (chỉ chuẩn độ sáng, không pha gradient như môi trường) — pha gradient
 * làm mây nhạt, nhìn qua kính chỉ còn mảng xám. `raw` bị nhân `scale` tại chỗ.
 */
export function makeSkyTexture(raw: Float32Array, width: number, height: number, scale: number): Texture {
  for (let i = 0; i < raw.length; i++) if (i % 4 !== 3) raw[i]! *= scale;
  const t = new DataTexture(raw, width, height, RGBAFormat, FloatType);
  t.minFilter = LinearFilter;
  t.magFilter = LinearFilter;
  t.generateMipmaps = false;
  t.mapping = EquirectangularReflectionMapping;
  t.needsUpdate = true;
  return t;
}

/** `installHdri` gọi khi HDRI nạp xong (null = gỡ). */
export function setHdriSky(tex: Texture | null): void {
  skyHdri = tex;
  skyTex.value = tex ?? placeholder;
  skyWeight.value = tex ? 1 : 0;
}

/** Phông trời: HDRI ngay trên chân trời (đủ 3,4°: tầm mắt qua cửa sổ thấy mây), dưới giữ gradient. Mức Thấp giữ gradient (không thêm lượt đọc ảnh). */
export function hdriBackdrop(worldDir: any, gradient: any): any {
  if (currentTier() === 'low') return gradient;
  const sky = skyTex.sample(equirectUV(worldDir)).rgb;
  return mix(gradient, sky, skyWeight.mul(smoothstep(0, 0.06, worldDir.y)));
}

interface RegistryLike {
  nodes: Map<string, Object3D>;
  byType: Record<string, Set<string> | undefined>;
}

const ENV_KEY = '__realismProbe';
let pmrem: PMREMGenerator | null = null;
let probeRT: RenderTarget | null = null;
let applied = false;
const last = new Vector3(Number.NaN, 0, 0);
const prev = new Vector3();
let lastCount = -1;

function eachGlossy(scene: Scene, fn: (m: Material & { envMap: Texture | null }) => void) {
  scene.traverse((o) => {
    if (!(o as any).isMesh || !o.layers.isEnabled(0)) return;
    for (const m of [(o as any).material ?? []].flat() as any[]) if (isGlossy(m)) fn(m);
  });
}

const GLASS_KEY = '__realismGlass';
const twins = new WeakMap<Material, MeshStandardNodeMaterial>();
let glassSwapped = false;

/** Bản Standard (cache theo vật liệu gốc) của kính Lambert, fresnel giống `applyGlassFresnel` của vendor. */
function glassTwin(src: Material): MeshStandardNodeMaterial {
  let t = twins.get(src);
  if (t) return t;
  t = new MeshStandardNodeMaterial(glassTwinParams(src));
  t.userData = { ...src.userData };
  const facing = transformedNormalView.dot(positionViewDirection).clamp(0, 1);
  t.opacityNode = mix(float(src.opacity), float(0.92), facing.oneMinus().pow(3));
  t.envMapIntensity = 1.4;
  twins.set(src, t);
  return t;
}

/**
 * Kính Lambert không phản chiếu → đổi sang bản Standard trên mesh (giữ gốc ở `userData`). Chạy cùng nhịp
 * chụp probe (cảnh đổi số node / camera dời > 1,5 m), không mỗi khung.
 * ponytail: vendor gán lại vật liệu mà số node không đổi → kính về Lambert tới lần đổi kế; cần thì móc vào renderer.
 */
function swapGlass(scene: Scene) {
  scene.traverse((o) => {
    const mesh = o as any;
    if (!mesh.isMesh) return;
    const mats = [mesh.material ?? []].flat() as Material[];
    if (!mats.some(isLambertGlass)) return;
    if (!(GLASS_KEY in mesh.userData)) mesh.userData[GLASS_KEY] = mesh.material;
    const next = mats.map((m) => (isLambertGlass(m) ? glassTwin(m) : m));
    mesh.material = Array.isArray(mesh.material) ? next : next[0];
  });
  glassSwapped = true;
}

function restoreGlass(scene: Scene) {
  scene.traverse((o) => {
    if (!(GLASS_KEY in o.userData)) return;
    (o as any).material = o.userData[GLASS_KEY];
    delete o.userData[GLASS_KEY];
  });
  glassSwapped = false;
}

function restore(scene: Scene) {
  eachGlossy(scene, (m) => {
    if (!(ENV_KEY in m.userData)) return;
    m.envMap = m.userData[ENV_KEY];
    delete m.userData[ENV_KEY];
    m.needsUpdate = true;
  });
  applied = false;
}

/**
 * Gọi mỗi khung từ `Lights` (vendor). Rẻ khi không chụp: so vị trí camera + đếm node.
 * Chụp khi camera đứng yên (bằng khung trước) và đã đi > 1,5 m / cảnh thêm node so với lần chụp trước.
 */
export function syncReflectionProbe(renderer: unknown, scene: Scene, camera: PerspectiveCamera, registry: RegistryLike): void {
  const p = camera.position;
  const moving = p.distanceToSquared(prev) > 1e-6;
  prev.copy(p);
  const { tier, backend, flags } = useRealism.getState();
  const enabled = backend === 'webgpu' && flags.materials && tier !== 'low';
  if (!enabled) {
    if (applied) restore(scene);
    if (glassSwapped) restoreGlass(scene);
    lastCount = -1; // bật lại → đổi kính ngay lần đứng yên đầu
    return;
  }
  if (moving) return;
  const count = registry.nodes.size;
  if (count === lastCount && last.distanceToSquared(p) < 2.25) return;
  last.copy(p);
  lastCount = count;
  swapGlass(scene);
  const ceilings = [...(registry.byType.ceiling ?? [])].map((id) => registry.nodes.get(id)).filter(Boolean) as Object3D[];
  reflectStats.inside = reflectProbeWanted(p, ceilings);
  if (!reflectStats.inside) {
    if (applied) restore(scene);
    return;
  }
  pmrem ??= new PMREMGenerator(renderer as WebGPURenderer);
  const bg = scene.background;
  // Cửa sổ trong ảnh chụp thấy trời HDRI thay màu nền phẳng.
  if (skyHdri && skyWeight.value > 0) scene.background = skyHdri;
  const t0 = performance.now();
  probeRT = pmrem.fromScene(scene, 0, 0.05, 60, { size: 256, position: p, renderTarget: probeRT });
  scene.background = bg;
  reflectStats.lastMs = performance.now() - t0;
  reflectStats.maxMs = Math.max(reflectStats.maxMs, reflectStats.lastMs);
  reflectStats.captures++;
  reflectStats.glossy = 0;
  const env = probeRT.texture;
  eachGlossy(scene, (m) => {
    reflectStats.glossy++;
    if (!(ENV_KEY in m.userData)) m.userData[ENV_KEY] = m.envMap;
    if (m.envMap !== env) {
      m.envMap = env;
      m.needsUpdate = true;
    }
  });
  applied = true;
}
