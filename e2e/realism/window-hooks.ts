/** Kiểu cho các móc `window.__*` mà trang editor3d lộ ra cho e2e (chỉ dùng trong page.evaluate). */
import type { Vec3 } from './poses';

export interface ProbeWall {
  id: string;
  start: [number, number];
  end: [number, number];
}

export interface PascalProbe {
  ready(): boolean;
  counts(): { wall?: number };
  walls(): ProbeWall[];
  setCamera(position: Vec3, target: Vec3, fov: number | 'top-ortho'): void;
  editNode(id: string, patch: Record<string, unknown>): void;
}

export interface IdleStats {
  drawn: number;
  [k: string]: unknown;
}

/** Phần three.js mà bench đọc (renderer/scene bắt qua `__THREE_DEVTOOLS__`). */
export interface ThreeMaterial {
  type: string;
  name: string;
  opacity: number;
  transparent: boolean;
  transmission?: number;
  metalness?: number;
  roughness?: number;
  envMap?: unknown;
  envMapIntensity?: number;
  side: number;
}

export interface ThreeObject {
  isMesh?: boolean;
  isScene?: boolean;
  name: string;
  material?: ThreeMaterial | ThreeMaterial[];
}

export interface ThreeScene {
  isScene?: boolean;
  environment?: object | null;
  background?: object | null;
  traverse(fn: (o: ThreeObject) => void): void;
}

export interface ThreeRenderer {
  info: { frame?: number; render?: { frame?: number }; memory: Record<string, number> };
  render: unknown;
  backend?: { isWebGPUBackend?: boolean; adapter?: { info?: AdapterInfo } };
  getContext?(): WebGLRenderingContext | null;
}

export interface AdapterInfo {
  vendor: string;
  architecture: string;
  description?: string;
}

export interface Bench {
  renderers: ThreeRenderer[];
  scenes: ThreeScene[];
  firstFrameMs: number | null;
  sample: { deltas: number[]; f0: number; f1: number; done: boolean };
}

export interface HookWindow {
  __pascalProbe: PascalProbe;
  __pascalIdle: () => IdleStats;
  __pascalPerf?: number[];
  __bench: Bench;
  __THREE_DEVTOOLS__?: EventTarget;
  __f2Blobs: { t: number }[];
  __r3sTimings?: { doneAt: number; [k: string]: unknown };
  __r3sLastMs?: number;
  __d: number[];
  __done?: boolean;
}

