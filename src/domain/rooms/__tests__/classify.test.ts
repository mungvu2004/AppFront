import { describe, expect, it } from 'vitest';

import type { RoomUsage } from '../../spatial/types';
import { describeUsage } from '../classify';

/** Every use the graph knows, so the label table can be checked in full. */
const EVERY_USAGE: readonly RoomUsage[] = [
  'livingRoom',
  'bedroom',
  'kitchen',
  'bathroom',
  'corridor',
  'stairwell',
  'utility',
  'loggia',
  'other',
];

describe('the Vietnamese names', () => {
  it('has one for every use the graph knows', () => {
    for (const usage of EVERY_USAGE) {
      expect(describeUsage(usage).length).toBeGreaterThan(0);
    }
  });

  it('calls a loggia a lô gia', () => {
    expect(describeUsage('loggia')).toBe('Lô gia');
  });

  it('has one for not knowing', () => {
    expect(describeUsage(null)).toBe('Không xác định');
  });

  it('names the four the brief asks for', () => {
    expect(describeUsage('bedroom')).toBe('Phòng ngủ');
    expect(describeUsage('bathroom')).toBe('Vệ sinh');
    expect(describeUsage('corridor')).toBe('Hành lang');
    expect(describeUsage('utility')).toBe('Kỹ thuật');
  });
});
