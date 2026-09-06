/**
 * Cutting a storey down to the few parts a preview actually redraws.
 *
 * A preview stands in for one thing the user is holding — a wall being pulled
 * thicker, a door being widened — and the rest of the storey is already on
 * screen, built by the worker, unchanged. So the preview does not rebuild a
 * storey; it rebuilds the parts of one, and this is where a storey's input is
 * narrowed to them.
 *
 * The result is a {@link BuildFloorInput} like any other, which is the point:
 * the preview layer builds it with the same `buildFloorMesh` the real model was
 * built from, so a previewed wall is cut, mitred and panelled exactly the way
 * the saved one is. Two code paths drawing the same wall two ways is how a
 * preview starts lying, and a preview that lies is worse than none.
 */

import type { EntityId } from '@/domain/spatial/types';

import type { BuildFloorInput } from '../build/floor';

/**
 * The storey input reduced to the entities named, plus what they cannot be
 * drawn without.
 *
 * Two things come along uninvited, and both because a wall is not drawable on
 * its own:
 *
 * - **The host wall of a previewed opening.** An opening is a hole cut in a
 *   wall; without the wall there is nothing for it to be a hole in.
 * - **Every opening on a kept wall.** A wall is built with its holes already
 *   cut (`buildFloorMesh` → `planCuts`), so dropping its other openings would
 *   redraw it solid — a preview that closes up two windows the moment the user
 *   touches a slider.
 *
 * Nothing else is kept. Rooms carry slabs and ceilings that are expensive and
 * that a wall edit never moves, so a wall preview builds no slab at all.
 *
 * @param input One storey, as `toBuildFloorInput` produced it.
 * @param entityIds The entities being previewed.
 * @returns The same storey with everything else removed. Empty is a valid
 * answer — a preview of something this storey does not hold draws nothing.
 */
export function narrowFloorInput(
  input: BuildFloorInput,
  entityIds: readonly EntityId[],
): BuildFloorInput {
  const wanted = new Set<string>(entityIds);
  const openings = input.openings ?? [];
  const hostWallIds = new Set<string>(
    openings.filter((opening) => wanted.has(opening.id)).map((opening) => String(opening.wallId)),
  );

  const walls = input.walls.filter(
    (wall) => wanted.has(wall.id) || hostWallIds.has(String(wall.id)),
  );
  const keptWallIds = new Set<string>(walls.map((wall) => String(wall.id)));

  return {
    level: input.level,
    walls,
    rooms: input.rooms.filter((room) => wanted.has(room.id)),
    openings: openings.filter((opening) => keptWallIds.has(String(opening.wallId))),
    ...(input.slabThicknessMm !== undefined ? { slabThicknessMm: input.slabThicknessMm } : {}),
  };
}
