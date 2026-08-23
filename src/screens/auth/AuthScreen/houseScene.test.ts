/**
 * The plan on `/login`, checked through the presentation engine.
 *
 * The engine has its own tests under `src/lib/three/present/__tests__`; this
 * file asks only the questions that belong to *this* plan. A WebGL context is
 * not available here and not needed: `assembleHouse` is the part that turns
 * `houseModel.json` into geometry, and it is the part a plan edit can break.
 * Every opening must be cut into its wall (the builder refuses rather than
 * repairs, and a refusal shows on screen as a window that is not there), every
 * piece of furniture must be a variant the catalogue knows, every finish must be
 * one the engine can paint, and the ceilings the builder lays must be gone again.
 */

import { Mesh, PointLight } from 'three';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { readPartData } from '@/lib/three/build/scene';
import {
  assembleHouse,
  createMaterials,
  isCatalogueVariant,
  isFacing,
  isFinish,
  readPalette,
  type AssembledHouse,
  type PresentationPlan,
} from '@/lib/three/present';

import rawPlan from './houseModel.json';

const plan = rawPlan as PresentationPlan;

let assembled: AssembledHouse;

beforeEach(() => {
  // jsdom has no 2D canvas and says so on the console every time it is asked;
  // `null` is the answer the texture code is written for, so give it quietly.
  vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(null);

  const palette = readPalette(() => '');
  assembled = assembleHouse(plan, palette, createMaterials(palette));
});

afterEach(() => {
  vi.restoreAllMocks();
});

function idsOfKind(kind: string): string[] {
  const found: string[] = [];
  assembled.house.traverse((object) => {
    const part = readPartData(object);
    if (part?.kind === kind && (kind === 'furniture' || object instanceof Mesh)) {
      found.push(part.entityId);
    }
  });
  return found;
}

describe('houseModel.json', () => {
  it('names only variants, facings and finishes the engine knows', () => {
    for (const entry of plan.furniture) {
      expect(isCatalogueVariant(entry.variant), `${entry.id}: ${entry.variant}`).toBe(true);
      expect(isFacing(entry.facing), `${entry.id}: ${entry.facing}`).toBe(true);
    }
    for (const room of plan.rooms) {
      expect(isFinish(room.finish), `${room.id}: ${room.finish}`).toBe(true);
    }
    for (const roomId of plan.ceilingLights.roomIds) {
      expect(plan.rooms.some((room) => room.id === roomId), roomId).toBe(true);
    }
  });

  it('cuts every opening in the plan; nothing is refused', () => {
    expect(assembled.refusals.map((refusal) => refusal.message)).toEqual([]);
    expect(assembled.unknownFinishes).toEqual([]);
  });

  it('hangs a panel in every door and window, and none in the archway', () => {
    const expected = plan.openings.filter((opening) => opening.kind !== 'void').map((opening) => opening.id);

    expect(idsOfKind('opening').sort()).toEqual([...expected].sort());
  });

  it('lays a slab for every room and takes every ceiling away', () => {
    expect(idsOfKind('floorSlab')).toHaveLength(plan.rooms.length);
    expect(idsOfKind('ceiling')).toHaveLength(0);
  });

  it('places every piece of furniture the plan lists', () => {
    expect(idsOfKind('furniture').sort()).toEqual(plan.furniture.map((entry) => entry.id).sort());
  });

  it('lights every room the plan names, plus each lamp on the plan', () => {
    let lights = 0;
    assembled.house.traverse((object) => {
      if (object instanceof PointLight) {
        lights += 1;
      }
    });

    const lamps = plan.furniture.filter((entry) =>
      ['floorLamp', 'tableLamp', 'pendant'].includes(entry.variant),
    ).length;

    expect(lights).toBe(plan.ceilingLights.roomIds.length + lamps);
  });

  it('keeps every piece procedural: the plan ships no model URLs', async () => {
    expect(plan.furniture.every((entry) => entry.modelUrl === undefined)).toBe(true);

    const sources = await Promise.all(assembled.pieces.map((piece) => piece.ready));
    expect(new Set(sources)).toEqual(new Set(['procedural']));
  });
});
