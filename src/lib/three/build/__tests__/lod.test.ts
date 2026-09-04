import { Object3D } from 'three';
import { describe, expect, it } from 'vitest';

import {
  DETAIL_LEVELS,
  DETAIL_DISTANCES_M,
  REDUCED_DISTANCE_M,
  BLOCK_DISTANCE_M,
  detailLevelAt,
  readDetail,
  droppedKindsAt,
} from '../lod';

describe('lod', () => {
  describe('detailLevelAt', () => {
    it('returns full for distances less than 25 m', () => {
      expect(detailLevelAt(0)).toBe('full');
      expect(detailLevelAt(12.5)).toBe('full');
      expect(detailLevelAt(24.9)).toBe('full');
    });

    it('returns reduced for distances >= 25 m and < 60 m', () => {
      expect(detailLevelAt(25)).toBe('reduced');
      expect(detailLevelAt(42.5)).toBe('reduced');
      expect(detailLevelAt(59.9)).toBe('reduced');
    });

    it('returns block for distances >= 60 m', () => {
      expect(detailLevelAt(60)).toBe('block');
      expect(detailLevelAt(100)).toBe('block');
      expect(detailLevelAt(1000)).toBe('block');
    });

    it('throws RangeError for negative distances', () => {
      expect(() => detailLevelAt(-1)).toThrow(RangeError);
    });

    it('throws RangeError for NaN', () => {
      expect(() => detailLevelAt(NaN)).toThrow(RangeError);
    });

    it('throws RangeError for Infinity', () => {
      expect(() => detailLevelAt(Infinity)).toThrow(RangeError);
    });

    it('throws RangeError for -Infinity', () => {
      expect(() => detailLevelAt(-Infinity)).toThrow(RangeError);
    });
  });

  describe('readDetail', () => {
    it('returns null when userData has no detail field', () => {
      const obj = new Object3D();
      obj.userData = {};
      expect(readDetail(obj)).toBeNull();
    });

    it('returns null when detail is not a string', () => {
      const obj = new Object3D();
      obj.userData = { detail: 123 };
      expect(readDetail(obj)).toBeNull();
    });

    it('returns null when detail is an invalid string', () => {
      const obj = new Object3D();
      obj.userData = { detail: 'invalid' };
      expect(readDetail(obj)).toBeNull();
    });

    it('returns the detail level when userData.detail is valid', () => {
      const objFull = new Object3D();
      objFull.userData = { detail: 'full' };
      expect(readDetail(objFull)).toBe('full');

      const objReduced = new Object3D();
      objReduced.userData = { detail: 'reduced' };
      expect(readDetail(objReduced)).toBe('reduced');

      const objBlock = new Object3D();
      objBlock.userData = { detail: 'block' };
      expect(readDetail(objBlock)).toBe('block');
    });

    it('ignores other properties in userData', () => {
      const obj = new Object3D();
      obj.userData = { detail: 'full', otherProp: 'value' };
      expect(readDetail(obj)).toBe('full');
    });
  });

  describe('droppedKindsAt', () => {
    it('returns empty array for full detail', () => {
      expect(droppedKindsAt('full')).toEqual([]);
    });

    it('returns [opening] for reduced detail', () => {
      expect(droppedKindsAt('reduced')).toEqual(['opening']);
    });

    it('returns [opening, ceiling] for block detail', () => {
      expect(droppedKindsAt('block')).toEqual(['opening', 'ceiling']);
    });

    it('returns the same array reference on repeated calls for each detail level', () => {
      const fullA = droppedKindsAt('full');
      const fullB = droppedKindsAt('full');
      expect(fullA).toBe(fullB);

      const reducedA = droppedKindsAt('reduced');
      const reducedB = droppedKindsAt('reduced');
      expect(reducedA).toBe(reducedB);

      const blockA = droppedKindsAt('block');
      const blockB = droppedKindsAt('block');
      expect(blockA).toBe(blockB);
    });

    it('covers all detail levels', () => {
      for (const detail of DETAIL_LEVELS) {
        expect(() => droppedKindsAt(detail)).not.toThrow();
      }
    });
  });

  describe('constants', () => {
    it('DETAIL_LEVELS includes all three levels', () => {
      expect(DETAIL_LEVELS).toEqual(['full', 'reduced', 'block']);
    });

    it('DETAIL_DISTANCES_M matches the thresholds', () => {
      expect(DETAIL_DISTANCES_M.full).toBe(0);
      expect(DETAIL_DISTANCES_M.reduced).toBe(REDUCED_DISTANCE_M);
      expect(DETAIL_DISTANCES_M.block).toBe(BLOCK_DISTANCE_M);
    });

    it('REDUCED_DISTANCE_M is 25', () => {
      expect(REDUCED_DISTANCE_M).toBe(25);
    });

    it('BLOCK_DISTANCE_M is 60', () => {
      expect(BLOCK_DISTANCE_M).toBe(60);
    });
  });
});
