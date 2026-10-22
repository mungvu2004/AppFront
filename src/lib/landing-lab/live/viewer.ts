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
    reflectivity: 0.35,
    transparent: true,
    opacity: 0.45,
    depthWrite: false,
    toneMapped: false,
  });
}

export function createLiveViewer(canvas: HTMLCanvasElement, base: string, startPose: string): LiveViewer {
  const renderer = new WebGLRenderer({ canvas, antialias: true });
  renderer.outputColorSpace = SRGBColorSpace;
  renderer.toneMapping = NoToneMapping;
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.5));
  const scene = new Scene();
  const cam = new PerspectiveCamera(40, 16 / 9, 0.05, 2000);
  const controls = new OrbitControls(cam, canvas);
  controls.enableDamping = true;
  controls.dampingFactor = 0.08;
  controls.enablePan = false;
  let manifest: LiveScene | null = null;
  let pose: LivePose | null = null;
  let raf = 0;
  let active = 0;

  const resize = () => {
    const w = canvas.clientWidth;
    const h = canvas.clientHeight;
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
    controls.target.copy(cam.position).addScaledVector(fwd, p.focusDistance);
    const d = p.focusDistance;
    controls.minDistance = d * 0.45;
    controls.maxDistance = d * 1.6;
    applyShift(cam, p);
    controls.update();
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

  return {
    ready,
    setPose,
    dispose() {
      cancelAnimationFrame(raf);
      window.removeEventListener('resize', resize);
      controls.dispose();
      renderer.dispose();
    },
  };
}
