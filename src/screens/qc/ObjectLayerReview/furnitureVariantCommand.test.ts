import { describe, expect, it } from 'vitest';

import { createSampleBuilding, sampleFurnitureId } from '@/domain/spatial/__fixtures__/sampleBuilding';
import { normalizeSpatial } from '@/domain/spatial/normalize';
import type { Furniture } from '@/domain/spatial/types';

import {
  buildChangeFurnitureKindCommand,
  OBJECT_CHANGE_FURNITURE_KIND_COMMAND_TYPE,
  OBJECT_CHANGE_FURNITURE_VARIANT_COMMAND_TYPE,
} from './objectLayerReviewGateway';
import { FURNITURE_KIND_OPTIONS, FURNITURE_VARIANT_OPTIONS, furnitureVariantChoicesOf } from './objectLayerTypes';

const sample = (): Furniture => {
  const before = normalizeSpatial(createSampleBuilding()).byId[sampleFurnitureId(0)];
  if (before === undefined || !('boundingBox' in before)) throw new Error('sample furniture missing');
  const rest: Furniture = { ...(before as Furniture) };
  delete rest.variant;
  return rest;
};

const afterOf = (result: ReturnType<typeof buildChangeFurnitureKindCommand>) => {
  if (!result.ok) throw new Error(result.error.reasons.join(' '));
  return result.data.changes[0]?.after as Furniture;
};

describe('furniture kind + variant command (D3)', () => {
  it('turns a table into a sofa as chair + variant sofa in ONE undoable command', () => {
    const before = { ...sample(), kind: 'table' as const };
    const result = buildChangeFurnitureKindCommand(before, 'chair', 'u-1', 'F-001', 'sofa');

    expect(result.ok && result.data.type).toBe(OBJECT_CHANGE_FURNITURE_KIND_COMMAND_TYPE);
    expect(result.ok && result.data.description).toBe('Đổi loại F-001 thành Sofa.');
    expect(afterOf(result)).toMatchObject({ kind: 'chair', variant: 'sofa' });
    /* Hoàn tác = áp `before`: bản chụp trước còn nguyên loại cũ, chưa có kiểu. */
    expect(result.ok && result.data.changes[0]?.before).toEqual(before);
  });

  it('changes only the variant within the same kind, with its own command type', () => {
    const result = buildChangeFurnitureKindCommand({ ...sample(), kind: 'chair', variant: 'chair' }, 'chair', 'u-1', 'F-001', 'armchair');

    expect(result.ok && result.data.type).toBe(OBJECT_CHANGE_FURNITURE_VARIANT_COMMAND_TYPE);
    expect(result.ok && result.data.description).toBe('Đổi kiểu F-001 thành Ghế bành.');
    expect(afterOf(result).variant).toBe('armchair');
  });

  it('null clears the variant; a kind change without variant drops the stale one', () => {
    const sofa = { ...sample(), kind: 'chair' as const, variant: 'sofa' as const };

    expect('variant' in afterOf(buildChangeFurnitureKindCommand(sofa, 'chair', 'u-1', 'F-001', null))).toBe(false);
    expect('variant' in afterOf(buildChangeFurnitureKindCommand(sofa, 'bed', 'u-1', 'F-001'))).toBe(false);
  });

  it('refuses a write that changes nothing', () => {
    const sofa = { ...sample(), kind: 'chair' as const, variant: 'sofa' as const };

    expect(buildChangeFurnitureKindCommand(sofa, 'chair', 'u-1', 'F-001', 'sofa').ok).toBe(false);
    expect(buildChangeFurnitureKindCommand(sofa, 'chair', 'u-1', 'F-001').ok).toBe(false);
  });

  it('offers Sofa as a kind and only real variants per kind', () => {
    expect(FURNITURE_KIND_OPTIONS.map((option) => option.label)).toContain('Sofa');
    expect(furnitureVariantChoicesOf('chair').map((option) => option.label)).toEqual([
      'Theo cỡ (máy tự chọn)',
      'Ghế ăn',
      'Ghế bành',
      'Sofa',
      'Ghế băng',
    ]);
    expect(furnitureVariantChoicesOf('bed')).toEqual([]);
    expect(Object.keys(FURNITURE_VARIANT_OPTIONS).sort()).toEqual(['chair', 'kitchenCabinet', 'sanitaryFixture']);
  });
});
