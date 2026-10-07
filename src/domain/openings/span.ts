import { millimetres, type Millimetres } from '../units/types';
import { centrelineLength, type Wall } from '../walls/types';
import type { AttachedOpening } from './types';

/** How far along a wall an opening reaches, from the `start` end. */
export interface OpeningSpan {
  readonly centreMm: Millimetres;
  readonly lowMm: Millimetres;
  readonly highMm: Millimetres;
}

/**
 * Where an opening starts and stops along its wall, in millimetres.
 *
 * The centre comes from the stored fraction, so this moves with the wall like
 * everything else about an opening.
 */
export function openingSpan(wall: Wall, opening: AttachedOpening): OpeningSpan {
  const centreMm = millimetres(opening.relativePosition * centrelineLength(wall));
  const halfWidthMm = opening.widthMm / 2;

  return {
    centreMm,
    lowMm: millimetres(centreMm - halfWidthMm),
    highMm: millimetres(centreMm + halfWidthMm),
  };
}
