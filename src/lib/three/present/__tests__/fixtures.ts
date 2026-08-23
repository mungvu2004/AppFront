/**
 * A small flat for the engine's tests: two rooms, a partition with a door, a
 * window, a glass balustrade, one of every kind of furniture source.
 *
 * Deliberately not the login screen's plan — `src/lib` may not import from
 * `src/screens`, and the engine has to be shown to work on a plan nobody tuned
 * it against.
 */

import { Group, Mesh, BoxGeometry, MeshStandardMaterial, type Object3D } from 'three';
import { vi } from 'vitest';

import type { AssetService } from '../assets';
import type { PlanFurniture, PresentationPlan } from '../plan';

export const FIXTURE_PLAN: PresentationPlan = {
  levels: [{ id: 'L-G', elevationMm: 0, heightMm: 2400 }],
  walls: [
    { id: 'W-S', levelId: 'L-G', kind: 'loadBearing', thicknessMm: 300, start: [0, 0], end: [6000, 0] },
    { id: 'W-E', levelId: 'L-G', kind: 'loadBearing', thicknessMm: 300, start: [6000, 0], end: [6000, 4000] },
    { id: 'W-N', levelId: 'L-G', kind: 'loadBearing', thicknessMm: 300, start: [6000, 4000], end: [0, 4000] },
    { id: 'W-W', levelId: 'L-G', kind: 'loadBearing', thicknessMm: 300, start: [0, 4000], end: [0, 0] },
    { id: 'W-P', levelId: 'L-G', kind: 'partition', thicknessMm: 120, start: [3000, 0], end: [3000, 4000] },
    { id: 'W-R', levelId: 'L-G', kind: 'railing', thicknessMm: 80, heightMm: 1050, start: [0, 5000], end: [6000, 5000] },
  ],
  openings: [
    { id: 'D-1', wallId: 'W-P', kind: 'door', relativePosition: 0.5, widthMm: 800, heightMm: 2050, sillHeightMm: 0, swing: 'left' },
    { id: 'D-2', wallId: 'W-S', kind: 'window', relativePosition: 0.25, widthMm: 1200, heightMm: 1200, sillHeightMm: 900, swing: 'sliding' },
    { id: 'D-3', wallId: 'W-N', kind: 'door', relativePosition: 0.75, widthMm: 1500, heightMm: 2100, sillHeightMm: 0, swing: 'sliding' },
    { id: 'D-4', wallId: 'W-P', kind: 'void', relativePosition: 0.1, widthMm: 600, heightMm: 2400, sillHeightMm: 0, swing: 'fixed' },
  ],
  rooms: [
    { id: 'R-A', levelId: 'L-G', finish: 'wood', outline: [[0, 0], [3000, 0], [3000, 4000], [0, 4000]] },
    { id: 'R-B', levelId: 'L-G', finish: 'tile', outline: [[3000, 0], [6000, 0], [6000, 4000], [3000, 4000]] },
    { id: 'R-C', levelId: 'L-G', finish: 'decking', outline: [[0, 4150], [6000, 4150], [6000, 5000], [0, 5000]] },
  ],
  furniture: [
    { id: 'F-BED', variant: 'bed', centreMm: [1500, 2000], sizeMm: [1600, 2000, 500], facing: 'north' },
    { id: 'F-CHAIR', variant: 'chair', centreMm: [4500, 2000], sizeMm: [450, 450, 900], facing: 'east' },
    { id: 'F-LAMP', variant: 'floorLamp', centreMm: [4000, 500], sizeMm: [400, 400, 1500], facing: 'south' },
  ],
  ceilingLights: { heightMm: 2300, roomIds: ['R-A', 'R-B'] },
};

/** A furniture entry that names a model. */
export function withModel(entry: PlanFurniture, modelUrl: string): PlanFurniture {
  return { ...entry, modelUrl };
}

/** A stand-in `.glb` root: one 2 m cube, sitting 1 m off the floor and off-centre. */
export function fakeModel(): Object3D {
  const root = new Group();
  const cube = new Mesh(new BoxGeometry(2, 2, 2), new MeshStandardMaterial());
  cube.position.set(3, 2, -1);
  root.add(cube);
  return root;
}

/** An asset service whose answers the test decides. */
export function fakeAssets(
  behaviour: 'resolve' | 'reject' | 'never',
): AssetService & { readonly load: ReturnType<typeof vi.fn> } {
  const load = vi.fn((url: string) => {
    switch (behaviour) {
      case 'resolve':
        return Promise.resolve(fakeModel());
      case 'reject':
        return Promise.reject(new Error(`no model at ${url}`));
      case 'never':
        return new Promise<Object3D>(() => undefined);
    }
  });

  return { load, dispose: vi.fn() };
}

/**
 * A 2D context stub just real enough for the texture painters: it records the
 * calls and hands back an image buffer of the right size. jsdom has no canvas.
 */
export function stubCanvasContext(): void {
  const getContext = function (this: HTMLCanvasElement): CanvasRenderingContext2D {
    const context = {
      canvas: this,
      fillStyle: '',
      fillRect: vi.fn(),
      clearRect: vi.fn(),
      createImageData: (width: number, height: number) => ({
        width,
        height,
        data: new Uint8ClampedArray(width * height * 4),
      }),
      putImageData: vi.fn(),
    };
    return context as unknown as CanvasRenderingContext2D;
  };

  vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockImplementation(
    getContext as unknown as HTMLCanvasElement['getContext'],
  );
}

/** jsdom's honest answer: no 2D canvas at all. */
export function stubNoCanvas(): void {
  vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(null);
}
