import { Box3, Mesh, Vector3 } from 'three';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { readPartData } from '../../build/scene';
import { createMaterials, type SceneMaterials } from '../materials';
import { readPalette } from '../palette';
import { contactShadowFor, FACING_TURN, fitToSize, placeFurniture } from '../placement';

import { fakeAssets, fakeModel, FIXTURE_PLAN, stubCanvasContext, stubNoCanvas, withModel } from './fixtures';

const BED = FIXTURE_PLAN.furniture[0]!;
const CHAIR = FIXTURE_PLAN.furniture[1]!;

let materials: SceneMaterials;

beforeEach(() => {
  stubCanvasContext();
  materials = createMaterials(readPalette(() => ''));
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe('placeFurniture — procedural first', () => {
  it('stands the procedural piece where the plan says, facing the way it says', () => {
    const { group } = placeFurniture(CHAIR, 'L-G', materials);

    expect(group.position.x).toBeCloseTo(4.5);
    expect(group.position.z).toBeCloseTo(2);
    expect(group.rotation.y).toBeCloseTo(FACING_TURN.east);
    expect(group.getObjectByName('procedural')).toBeDefined();
    expect(readPartData(group)).toMatchObject({ kind: 'furniture', entityId: 'F-CHAIR', levelId: 'L-G' });
  });

  it('turns local +z onto each compass point', () => {
    const front = new Vector3(0, 0, 1);

    expect(front.clone().applyAxisAngle(new Vector3(0, 1, 0), FACING_TURN.east).x).toBeCloseTo(1);
    expect(front.clone().applyAxisAngle(new Vector3(0, 1, 0), FACING_TURN.west).x).toBeCloseTo(-1);
    expect(front.clone().applyAxisAngle(new Vector3(0, 1, 0), FACING_TURN.south).z).toBeCloseTo(-1);
    expect(front.clone().applyAxisAngle(new Vector3(0, 1, 0), FACING_TURN.north).z).toBeCloseTo(1);
  });

  it('raises a lifted piece off the floor, and gives it no contact shadow', () => {
    const vase = placeFurniture(
      { id: 'F-VASE', variant: 'vase', centreMm: [1000, 1000], sizeMm: [200, 200, 400], facing: 'north', liftMm: 750 },
      'L-G',
      materials,
    );
    const liftedBed = placeFurniture({ ...BED, liftMm: 300 }, 'L-G', materials);

    expect(vase.group.position.y).toBeCloseTo(0.75);
    expect(placeFurniture(BED, 'L-G', materials).group.position.y).toBe(0);
    expect(liftedBed.group.getObjectByName('contactShadow')).toBeUndefined();
  });

  it('lays a contact shadow under a heavy piece and not under a light one', () => {
    const bed = placeFurniture(BED, 'L-G', materials);
    const chair = placeFurniture(CHAIR, 'L-G', materials);

    const decal = bed.group.getObjectByName('contactShadow');
    expect(decal).toBeInstanceOf(Mesh);
    expect((decal as Mesh).material).toBe(materials.contactShadow);
    expect(chair.group.getObjectByName('contactShadow')).toBeUndefined();
  });

  it('skips the contact shadow when no canvas could draw one', async () => {
    vi.restoreAllMocks();
    stubNoCanvas();
    const flat = createMaterials(readPalette(() => ''));

    const bed = placeFurniture(BED, 'L-G', flat);

    expect(bed.group.getObjectByName('contactShadow')).toBeUndefined();
    expect(contactShadowFor({ w: 1, d: 1, h: 1 }, flat)).toBeNull();
    await expect(bed.ready).resolves.toBe('procedural');
  });

  it('refuses an unknown variant or a facing that is not a compass point', () => {
    expect(() => placeFurniture({ ...CHAIR, variant: 'hammock' }, 'L-G', materials)).toThrow(RangeError);
    expect(() => placeFurniture({ ...CHAIR, facing: 'up' }, 'L-G', materials)).toThrow(RangeError);
  });
});

describe('placeFurniture — models', () => {
  it('stays procedural when the entry names no model, or there is no asset service', async () => {
    const withoutUrl = placeFurniture(CHAIR, 'L-G', materials, { assets: fakeAssets('resolve') });
    const withoutService = placeFurniture(withModel(CHAIR, '/chair.glb'), 'L-G', materials);

    await expect(withoutUrl.ready).resolves.toBe('procedural');
    await expect(withoutService.ready).resolves.toBe('procedural');
  });

  it('keeps the procedural piece and reports when the model fails to load', async () => {
    const onFallback = vi.fn();
    const entry = withModel(CHAIR, '/chair.glb');
    const assets = fakeAssets('reject');

    const piece = placeFurniture(entry, 'L-G', materials, { assets, onFallback });

    await expect(piece.ready).resolves.toBe('procedural');
    expect(assets.load).toHaveBeenCalledWith('/chair.glb', undefined);
    expect(onFallback).toHaveBeenCalledWith(entry, expect.any(Error));
    expect(piece.group.getObjectByName('procedural')).toBeDefined();
    expect(piece.group.getObjectByName('model')).toBeUndefined();
  });

  it('swaps the model in, normalised to the declared size and standing on the floor', async () => {
    const entry = withModel(CHAIR, '/chair.glb');
    const piece = placeFurniture(entry, 'L-G', materials, { assets: fakeAssets('resolve') });

    await expect(piece.ready).resolves.toBe('model');

    const model = piece.group.getObjectByName('model');
    expect(model).toBeDefined();
    expect(piece.group.getObjectByName('procedural')).toBeUndefined();

    const bounds = new Box3().setFromObject(model!);
    const extent = bounds.getSize(new Vector3());
    expect(extent.x).toBeCloseTo(0.45);
    expect(extent.y).toBeCloseTo(0.45);
    expect(bounds.min.y).toBeCloseTo(0);
    expect(bounds.getCenter(new Vector3()).x).toBeCloseTo(0);

    let shadowed = 0;
    model!.traverse((object) => {
      if (object instanceof Mesh && object.castShadow) {
        shadowed += 1;
      }
    });
    expect(shadowed).toBeGreaterThan(0);
  });

  it('does not swap a model that arrives after the mount was torn down', async () => {
    const aborter = new AbortController();
    const entry = withModel(CHAIR, '/chair.glb');
    const piece = placeFurniture(entry, 'L-G', materials, {
      assets: fakeAssets('resolve'),
      signal: aborter.signal,
    });

    aborter.abort();

    await expect(piece.ready).resolves.toBe('procedural');
    expect(piece.group.getObjectByName('procedural')).toBeDefined();
  });
});

describe('fitToSize', () => {
  it('scales uniformly to fit the box and puts the feet on the floor', () => {
    const model = fitToSize(fakeModel(), { w: 1, d: 0.5, h: 2 });
    const bounds = new Box3().setFromObject(model);
    const extent = bounds.getSize(new Vector3());

    // The 2 m cube is limited by the 0,5 m depth: every side becomes 0,5 m.
    expect(extent.x).toBeCloseTo(0.5);
    expect(extent.y).toBeCloseTo(0.5);
    expect(extent.z).toBeCloseTo(0.5);
    expect(bounds.min.y).toBeCloseTo(0);
    expect(bounds.getCenter(new Vector3()).x).toBeCloseTo(0);
    expect(bounds.getCenter(new Vector3()).z).toBeCloseTo(0);
  });

  it('leaves an empty model at scale 1', () => {
    const model = fitToSize(fakeModel().clear(), { w: 1, d: 1, h: 1 });

    expect(model.scale.x).toBe(1);
  });
});
