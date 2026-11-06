/**
 * The Vietnamese names for what a room is used for.
 *
 * The vocabulary is `RoomUsage` from the spatial graph rather than a private
 * one, so there is no translation step to drift out of date.
 */

import type { RoomUsage } from '../spatial/types';

/** Shown when the use is not known. */
const UNKNOWN_LABEL = 'Không xác định';

/**
 * Vietnamese names for every use the graph knows.
 *
 * A complete record rather than a lookup with a fallback, so adding a use to
 * `RoomUsage` fails the build here instead of quietly showing its English name
 * on a Vietnamese screen.
 */
const USAGE_LABELS: Readonly<Record<RoomUsage, string>> = {
  livingRoom: 'Phòng khách',
  bedroom: 'Phòng ngủ',
  kitchen: 'Bếp',
  bathroom: 'Vệ sinh',
  corridor: 'Hành lang',
  stairwell: 'Thang bộ',
  utility: 'Kỹ thuật',
  loggia: 'Lô gia',
  other: 'Khác',
};

/** The Vietnamese name for a use, or for not knowing. */
export function describeUsage(usage: RoomUsage | null): string {
  return usage === null ? UNKNOWN_LABEL : USAGE_LABELS[usage];
}
