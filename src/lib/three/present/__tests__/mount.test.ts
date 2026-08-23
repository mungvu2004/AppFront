/**
 * `mountPresentation` with the renderer faked: jsdom has no WebGL, and none
 * is needed to check what the mount *decides* — when it draws, what it caps,
 * what it redraws, and what it lets go of.
 */

import { Group, Mesh, PointLight, Scene, SpotLight, Texture, type Camera } from 'three';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { FIXTURE_PLAN, stubCanvasContext } from './fixtures';

/* -------------------------------------------------------------------------- */
/* Fakes.                                                                      */
/* -------------------------------------------------------------------------- */

interface RenderCall {
  readonly scene: Scene;
  readonly camera: Camera;
  /** Whether the shadow map was due a redraw when this frame was drawn. */
  readonly shadowRedrawn: boolean;
}

/** Hoisted with the mock: `vi.mock` runs before any top-level statement of this file. */
const { renderers, FakeRenderer } = vi.hoisted(() => {
  const made: FakeRenderer[] = [];

  class FakeRenderer {
    readonly calls: RenderCall[] = [];
    readonly shadowMap = { enabled: false, type: 0, autoUpdate: true, needsUpdate: false };
    toneMapping = 0;
    toneMappingExposure = 1;
    pixelRatio = 1;
    width = 0;
    height = 0;
    readonly setClearColor = vi.fn();
    readonly dispose = vi.fn();
    readonly forceContextLoss = vi.fn();

    constructor(readonly parameters: { canvas: HTMLCanvasElement; antialias: boolean }) {
      made.push(this);
    }

    setPixelRatio(ratio: number): void {
      this.pixelRatio = ratio;
    }

    setSize(width: number, height: number): void {
      this.width = width;
      this.height = height;
    }

    getDrawingBufferSize(target: { x: number; y: number }): { x: number; y: number } {
      target.x = this.width * this.pixelRatio;
      target.y = this.height * this.pixelRatio;
      return target;
    }

    render(scene: Scene, camera: Camera): void {
      const shadowRedrawn = this.shadowMap.autoUpdate || this.shadowMap.needsUpdate;
      this.shadowMap.needsUpdate = false;
      this.calls.push({ scene, camera, shadowRedrawn });
    }
  }

  return { renderers: made, FakeRenderer };
});

vi.mock('three', async (importOriginal) => {
  const actual = await importOriginal<Record<string, unknown>>();

  class FakePMREMGenerator {
    fromScene(): { texture: Texture; dispose: () => void } {
      return { texture: new Texture(), dispose: vi.fn() };
    }
    dispose(): void {
      /* nothing to release */
    }
  }

  return { ...actual, WebGLRenderer: FakeRenderer, PMREMGenerator: FakePMREMGenerator };
});

/** A hand-driven `requestAnimationFrame`. */
function fakeFrames() {
  const queue = new Map<number, FrameRequestCallback>();
  let next = 1;
  let now = 0;
  vi.stubGlobal('requestAnimationFrame', (callback: FrameRequestCallback) => {
    const handle = next;
    next += 1;
    queue.set(handle, callback);
    return handle;
  });
  vi.stubGlobal('cancelAnimationFrame', (handle: number) => {
    queue.delete(handle);
  });
  return {
    tick: (ms: number) => {
      now += ms;
      const due = [...queue.values()];
      queue.clear();
      for (const callback of due) {
        callback(now);
      }
    },
    pending: () => queue.size,
  };
}

/** A `matchMedia` for reduced motion the test can flip. */
function fakeStillness(matches: boolean) {
  const listeners = new Set<() => void>();
  const query = {
    matches,
    addEventListener: (_: string, listener: () => void) => listeners.add(listener),
    removeEventListener: (_: string, listener: () => void) => listeners.delete(listener),
  };
  vi.stubGlobal('matchMedia', () => query);
  return {
    set: (value: boolean) => {
      query.matches = value;
      for (const listener of listeners) {
        listener();
      }
    },
    listeners,
  };
}

const resizeObservers: { callback: ResizeObserverCallback; disconnect: ReturnType<typeof vi.fn> }[] = [];

class FakeResizeObserver {
  readonly disconnect = vi.fn();
  constructor(readonly callback: ResizeObserverCallback) {
    resizeObservers.push(this);
  }
  observe(): void {
    /* measured by the test */
  }
}

function sizedCanvas(width: number, height: number): HTMLCanvasElement {
  const canvas = document.createElement('canvas');
  Object.defineProperty(canvas, 'clientWidth', { configurable: true, get: () => width });
  Object.defineProperty(canvas, 'clientHeight', { configurable: true, get: () => height });
  return canvas;
}

/* -------------------------------------------------------------------------- */
/* Setup.                                                                      */
/* -------------------------------------------------------------------------- */

beforeEach(() => {
  renderers.length = 0;
  resizeObservers.length = 0;
  stubCanvasContext();
  vi.stubGlobal('ResizeObserver', FakeResizeObserver);
  vi.stubGlobal('IntersectionObserver', undefined);
  vi.stubGlobal('devicePixelRatio', 3);
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

async function mount(canvas = sizedCanvas(550, 400)) {
  const { mountPresentation } = await import('../mount');
  return mountPresentation(canvas, FIXTURE_PLAN, { readToken: () => '' });
}

/* -------------------------------------------------------------------------- */
/* Tests.                                                                      */
/* -------------------------------------------------------------------------- */

describe('mountPresentation', () => {
  it('draws the first frame on the first tick, with the shadow map drawn once and then held', async () => {
    const frames = fakeFrames();
    fakeStillness(false);

    const handle = await mount();
    const renderer = renderers[0]!;
    expect(renderer.calls).toHaveLength(0);
    expect(renderer.shadowMap.enabled).toBe(true);
    expect(renderer.shadowMap.autoUpdate).toBe(false);

    frames.tick(16);
    expect(renderer.calls).toHaveLength(1);
    expect(renderer.calls[0]?.shadowRedrawn).toBe(true);

    // The sway carries on, and no later frame redraws the shadows.
    frames.tick(200);
    frames.tick(200);
    expect(renderer.calls.length).toBeGreaterThan(1);
    expect(renderer.calls.slice(1).every((call) => !call.shadowRedrawn)).toBe(true);

    handle.dispose();
  });

  it('puts the house, the lights and the camera orbit in one scene, with the sun off the orbit', async () => {
    const frames = fakeFrames();
    fakeStillness(false);

    const handle = await mount();
    frames.tick(16);
    const { scene, camera } = renderers[0]!.calls[0]!;

    expect(scene).toBeInstanceOf(Scene);
    expect(camera.parent).toBeInstanceOf(Group);
    expect(camera.parent?.parent).toBe(scene);
    const lights = scene.children.filter((child) => 'isLight' in child);
    expect(lights.length).toBeGreaterThanOrEqual(4);
    expect(lights.every((light) => light.parent === scene)).toBe(true);
    let planLights = 0;
    scene.traverse((object) => {
      if (object instanceof SpotLight || object instanceof PointLight) {
        planLights += 1;
      }
    });
    expect(planLights).toBe(3);

    handle.dispose();
  });

  it('caps the pixel ratio at one and a half and sizes to the canvas', async () => {
    fakeFrames();
    fakeStillness(false);

    const handle = await mount();
    const renderer = renderers[0]!;

    expect(renderer.parameters.antialias).toBe(true);
    expect(renderer.pixelRatio).toBe(1.5);
    expect(renderer.width).toBe(550);
    expect(renderer.height).toBe(400);

    handle.dispose();
  });

  it('draws one parked frame under reduced motion, and sways again when the preference lifts', async () => {
    const frames = fakeFrames();
    const stillness = fakeStillness(true);

    const handle = await mount();
    const renderer = renderers[0]!;
    frames.tick(16);
    frames.tick(16);
    frames.tick(16);
    expect(renderer.calls).toHaveLength(1);
    expect(frames.pending()).toBe(0);

    stillness.set(false);
    frames.tick(16);
    frames.tick(500);
    expect(renderer.calls.length).toBeGreaterThan(1);

    handle.dispose();
  });

  it('redraws on resize and skips a canvas with no size', async () => {
    const frames = fakeFrames();
    fakeStillness(true);
    const canvas = sizedCanvas(550, 400);

    const handle = await mount(canvas);
    const renderer = renderers[0]!;
    frames.tick(16);
    expect(renderer.calls).toHaveLength(1);

    Object.defineProperty(canvas, 'clientWidth', { configurable: true, get: () => 300 });
    resizeObservers[0]!.callback([], {} as ResizeObserver);
    frames.tick(16);
    expect(renderer.width).toBe(300);
    expect(renderer.calls).toHaveLength(2);

    Object.defineProperty(canvas, 'clientWidth', { configurable: true, get: () => 0 });
    resizeObservers[0]!.callback([], {} as ResizeObserver);
    frames.tick(16);
    expect(renderer.width).toBe(300);
    expect(renderer.calls).toHaveLength(2);

    handle.dispose();
  });

  it('redraws the shadows and the frame once every piece has settled', async () => {
    const frames = fakeFrames();
    fakeStillness(true);

    const handle = await mount();
    const renderer = renderers[0]!;
    frames.tick(16);
    await handle.settled;
    expect(renderer.shadowMap.needsUpdate).toBe(true);

    frames.tick(16);
    expect(renderer.calls).toHaveLength(2);
    expect(renderer.calls[1]?.shadowRedrawn).toBe(true);
    expect(handle.report.refusals).toEqual([]);
    expect(handle.report.lights.kept).toHaveLength(3);

    handle.dispose();
  });

  it('stops drawing while the document is hidden', async () => {
    const frames = fakeFrames();
    fakeStillness(false);

    const handle = await mount();
    const renderer = renderers[0]!;
    frames.tick(16);
    expect(renderer.calls).toHaveLength(1);

    Object.defineProperty(document, 'visibilityState', { configurable: true, get: () => 'hidden' });
    document.dispatchEvent(new Event('visibilitychange'));
    expect(frames.pending()).toBe(0);
    frames.tick(500);
    expect(renderer.calls).toHaveLength(1);

    Object.defineProperty(document, 'visibilityState', { configurable: true, get: () => 'visible' });
    document.dispatchEvent(new Event('visibilitychange'));
    expect(frames.pending()).toBe(1);

    handle.dispose();
  });

  it('lets everything go on dispose: frames, observers, geometry, the renderer and its context', async () => {
    const frames = fakeFrames();
    const stillness = fakeStillness(false);

    const handle = await mount();
    const renderer = renderers[0]!;
    frames.tick(16);
    const { scene } = renderer.calls[0]!;
    const geometries: ReturnType<typeof vi.spyOn>[] = [];
    scene.traverse((object) => {
      if (object instanceof Mesh) {
        geometries.push(vi.spyOn(object.geometry, 'dispose'));
      }
    });
    expect(geometries.length).toBeGreaterThan(0);

    handle.dispose();

    expect(frames.pending()).toBe(0);
    expect(stillness.listeners.size).toBe(0);
    expect(resizeObservers[0]?.disconnect).toHaveBeenCalledTimes(1);
    expect(geometries.every((spy) => spy.mock.calls.length === 1)).toBe(true);
    expect(renderer.dispose).toHaveBeenCalledTimes(1);
    expect(renderer.forceContextLoss).toHaveBeenCalledTimes(1);
    expect(scene.environment).toBeNull();

    // Nothing arrives after: a settle that lands post-dispose draws nothing.
    await handle.settled;
    frames.tick(16);
    expect(renderer.calls).toHaveLength(1);
  });
});
