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

import { Mesh, PointLight, SpotLight } from 'three';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { readPartData } from '@/lib/three/build/scene';
import {
  assembleHouse,
  createMaterials,
  DEFAULT_LIGHT_BUDGET,
  isCatalogueVariant,
  isFacing,
  isFinish,
  LAMP_VARIANTS,
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
    for (const opening of plan.openings) {
      if (opening.opensTowards !== undefined) {
        expect(isFacing(opening.opensTowards), `${opening.id}: ${opening.opensTowards}`).toBe(true);
      }
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

  it('lights every room and point the plan names, plus each lamp on the plan, given the budget', () => {
    const palette = readPalette(() => '');
    const unbudgeted = assembleHouse(plan, palette, createMaterials(palette), { lightBudget: Infinity });
    let downlights = 0;
    let lamps = 0;
    unbudgeted.house.traverse((object) => {
      if (object instanceof SpotLight) {
        downlights += 1;
      } else if (object instanceof PointLight) {
        lamps += 1;
      }
    });

    const lampsOnPlan = plan.furniture.filter((entry) => LAMP_VARIANTS.includes(entry.variant)).length;

    expect(downlights).toBe(plan.ceilingLights.roomIds.length + (plan.ceilingLights.positionsMm?.length ?? 0));
    expect(lamps).toBe(lampsOnPlan);
    expect(unbudgeted.lights.drawn).toHaveLength(0);
  });

  it('keeps eight lights real — the big rooms and the pendant — and draws the rest', () => {
    const real: object[] = [];
    assembled.house.traverse((object) => {
      if (object instanceof SpotLight || object instanceof PointLight) {
        real.push(object);
      }
    });

    expect(real).toHaveLength(DEFAULT_LIGHT_BUDGET);
    expect(assembled.lights.kept).toHaveLength(DEFAULT_LIGHT_BUDGET);
    expect(assembled.lights.kept.filter((light) => light instanceof SpotLight)).toHaveLength(7);
    expect(assembled.lights.kept.filter((light) => light instanceof PointLight)).toHaveLength(1);

    // Both bathrooms are the smallest rooms on the plan; their downlights are drawn.
    const lampsOnPlan = plan.furniture.filter((entry) => LAMP_VARIANTS.includes(entry.variant)).length;
    const downlightsOnPlan = plan.ceilingLights.roomIds.length + (plan.ceilingLights.positionsMm?.length ?? 0);
    expect(assembled.lights.drawn).toHaveLength(lampsOnPlan + downlightsOnPlan - DEFAULT_LIGHT_BUDGET);
    expect(assembled.lights.drawn.filter(({ light }) => light instanceof SpotLight)).toHaveLength(2);
  });

  it('stands every hinged door open, and every other panel still', () => {
    for (const opening of plan.openings.filter((entry) => entry.kind !== 'void')) {
      const panel = assembled.house.getObjectByName(opening.id);
      const hinged = opening.kind === 'door' && (opening.swing === 'left' || opening.swing === 'right');

      expect(panel, opening.id).toBeInstanceOf(Mesh);
      expect(panel?.rotation.y !== 0, `${opening.id} open`).toBe(hinged);
    }
  });

  it('keeps every lifted piece off the floor and every other piece on it', () => {
    for (const entry of plan.furniture) {
      const piece = assembled.house.getObjectByName(entry.id);
      expect(piece?.position.y ?? -1, entry.id).toBeCloseTo((entry.liftMm ?? 0) / 1000);
    }
  });

  it('keeps every piece procedural: the plan ships no model URLs', async () => {
    expect(plan.furniture.every((entry) => entry.modelUrl === undefined)).toBe(true);

    const sources = await Promise.all(assembled.pieces.map((piece) => piece.ready));
    expect(new Set(sources)).toEqual(new Set(['procedural']));
  });
});
