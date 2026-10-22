/**
 * Live viewer for light-baked scenes (Cycles lightmaps with the AgX look burned in). Every baked mesh is shown
 * unlit (MeshBasicMaterial, toneMapped false) so the pixel equals the offline render's diffuse light.
 * Opens at a named pose from scene.json (same pose as a pre-rendered frame), then orbit + zoom.
 */
import {
  Color,
  DoubleSide,
  EquirectangularReflectionMapping,
  FileLoader,
  Mesh,
  MeshBasicMaterial,
  MixOperation,
  NoToneMapping,
  PerspectiveCamera,
  Quaternion,
  Scene,
  SRGBColorSpace,
  TextureLoader,
  Vector3,
  WebGLRenderer,
  type Material,
  type Texture,
} from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { MeshoptDecoder } from 'three/examples/jsm/libs/meshopt_decoder.module.js';

export interface LivePose {
  position: [number, number, number];
  quaternion: [number, number, number, number];
  fov: number;
  shiftX: number;
  shiftY: number;
  focusDistance: number;
}

export interface LiveScene {
  glb: string;
  background: string;
  env?: string;
  near?: number;
  far?: number;
  poses: Record<string, LivePose>;
}

export interface LiveViewer {
  ready: Promise<void>;
  setPose(name: string): void;
  /** Dev: render n frames while turning the orbit, each followed by a 1-px readback (GPU sync); returns sorted frame costs (ms). */
  bench(n: number): number[];
  dispose(): void;
}

/** Blender lens shift: a fraction of the frame width, applied as an off-axis projection. */
function applyShift(cam: PerspectiveCamera, pose: LivePose) {
  cam.updateProjectionMatrix();
  cam.projectionMatrix.elements[8] = 2 * pose.shiftX;
  cam.projectionMatrix.elements[9] = 2 * pose.shiftY * cam.aspect;
  cam.projectionMatrixInverse.copy(cam.projectionMatrix).invert();
}

function liveMaterial(src: Material, env: Texture | null): Material {
  const m = src as MeshBasicMaterial;
  if (src.name.startsWith('lm_')) {
    if (m.map) m.map.colorSpace = SRGBColorSpace;
    // sheer curtain: both sides of the folds, see-through like the Cycles translucent fabric
    if (src.name === 'lm_sheer') {
      return new MeshBasicMaterial({ map: m.map, side: DoubleSide, transparent: true, opacity: 0.7, toneMapped: false });
    }
    return new MeshBasicMaterial({ map: m.map, toneMapped: false });
  }
  if (src.name.startsWith('vc_')) return new MeshBasicMaterial({ vertexColors: true, toneMapped: false });
  if (src.name.startsWith('fol_')) {
    // foliage: albedo texture x baked irradiance (vertex colour stored at half scale); no tone curve
    return new MeshBasicMaterial({
      map: m.map,
      color: new Color(2, 2, 2),
      vertexColors: true,
      alphaTest: 0.5,
      side: DoubleSide,
      toneMapped: false,
    });
  }
  // glass: a faint tint plus the baked panorama as reflection
  return new MeshBasicMaterial({
    color: new Color(0.16, 0.17, 0.18),
    envMap: env,
    combine: MixOperation,
    reflectivity: 0.6,
    transparent: true,
    opacity: 0.3,
    depthWrite: false,
    toneMapped: false,
  });
}

export interface LiveOptions {
  /** Wheel zoom (off inside a scrolling page, so the wheel keeps scrolling it). */
  zoom?: boolean;
  /** Keep the orbit within this many degrees of the start pose (yaw, pitch), drag sensitivity scaled down to match. */
  limitDeg?: readonly [number, number];
  /** Orbit point this far ahead (m) instead of the focus distance: a small value turns the orbit into looking around. */
  pivot?: number;
}

export function createLiveViewer(canvas: HTMLCanvasElement, base: string, startPose: string, opts: LiveOptions = {}): LiveViewer {
  const renderer = new WebGLRenderer({ canvas, antialias: true });
  renderer.outputColorSpace = SRGBColorSpace;
  renderer.toneMapping = NoToneMapping;
  const scene = new Scene();
  const cam = new PerspectiveCamera(40, 16 / 9, 0.05, 2000);
  const controls = new OrbitControls(cam, canvas);
  controls.enableDamping = true;
  controls.dampingFactor = 0.08;
  controls.enablePan = false;
  controls.enableZoom = opts.zoom ?? true;
  if (opts.limitDeg) controls.rotateSpeed = 0.35;
  let manifest: LiveScene | null = null;
  let pose: LivePose | null = null;
  let raf = 0;
  let active = 0;

  const resize = () => {
    const w = canvas.clientWidth;
    const h = canvas.clientHeight;
    // At most ~2.5 MP per frame: a 2x-density screen otherwise renders 6.5 MP, too much fill for Intel UHD.
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.5, Math.sqrt(2.5e6 / Math.max(1, w * h))));
    renderer.setSize(w, h, false);
    cam.aspect = w / h;
    if (pose) applyShift(cam, pose);
    else cam.updateProjectionMatrix();
    active = 2;
  };

  const setPose = (name: string) => {
    if (!manifest) return;
    const p = manifest.poses[name];
    if (!p) return;
    pose = p;
    cam.position.fromArray(p.position);
    cam.quaternion.fromArray(p.quaternion);
    cam.fov = p.fov;
    // orbit about the focus point on the view axis, so the first frame keeps the exact baked orientation
    const fwd = new Vector3(0, 0, -1).applyQuaternion(new Quaternion().fromArray(p.quaternion));
    const d = opts.pivot ?? p.focusDistance;
    controls.target.copy(cam.position).addScaledVector(fwd, d);
    controls.minDistance = d * 0.45;
    controls.maxDistance = d * 1.6;
    applyShift(cam, p);
    controls.update();
    if (opts.limitDeg) {
      // Bounded around the photographed pose, so a drag never ends facing a bare wall.
      const [yaw, pitch] = opts.limitDeg.map((deg) => (deg * Math.PI) / 180) as [number, number];
      const az = controls.getAzimuthalAngle();
      const po = controls.getPolarAngle();
      controls.minAzimuthAngle = az - yaw;
      controls.maxAzimuthAngle = az + yaw;
      controls.minPolarAngle = po - pitch;
      controls.maxPolarAngle = po + pitch;
    }
    active = 2;
  };

  const tick = () => {
    raf = requestAnimationFrame(tick);
    if (controls.update()) active = 2;
    if (active > 0) {
      renderer.render(scene, cam);
      active--;
    }
  };
  controls.addEventListener('change', () => (active = 2));
  window.addEventListener('resize', resize);

  const ready = (async () => {
    manifest = (await new FileLoader().setResponseType('json').loadAsync(`${base}/scene.json`)) as unknown as LiveScene;
    scene.background = new Color(manifest.background);
    cam.near = manifest.near ?? cam.near;
    cam.far = manifest.far ?? cam.far;
    let env: Texture | null = null;
    if (manifest.env) {
      env = await new TextureLoader().loadAsync(`${base}/${manifest.env}`);
      env.mapping = EquirectangularReflectionMapping;
      env.colorSpace = SRGBColorSpace;
      scene.background = env;
    }
    MeshoptDecoder.useWorkers(2); // decode the meshopt buffers off the main thread
    const loader = new GLTFLoader().setMeshoptDecoder(MeshoptDecoder);
    const gltf = await loader.loadAsync(`${base}/${manifest.glb}`);
    gltf.scene.traverse((o) => {
      if (o instanceof Mesh) o.material = liveMaterial(o.material as Material, env);
    });
    scene.add(gltf.scene);
    resize();
    setPose(startPose);
    renderer.compile(scene, cam);
    tick();
  })();

  const bench = (n: number) => {
    const gl = renderer.getContext();
    const out: number[] = [];
    const px = new Uint8Array(4);
    const off = cam.position.clone().sub(controls.target);
    for (let i = 0; i < n; i++) {
      cam.position.copy(controls.target).add(off.clone().applyAxisAngle(new Vector3(0, 1, 0), (i / n) * 1.2));
      cam.lookAt(controls.target);
      const t = performance.now();
      renderer.render(scene, cam);
      gl.readPixels(0, 0, 1, 1, gl.RGBA, gl.UNSIGNED_BYTE, px); // forces the GPU to finish the frame
      out.push(performance.now() - t);
    }
    return out.sort((a, b) => a - b);
  };

  return {
    ready,
    setPose,
    bench,
    dispose() {
      cancelAnimationFrame(raf);
      window.removeEventListener('resize', resize);
      controls.dispose();
      renderer.dispose();
    },
  };
}
