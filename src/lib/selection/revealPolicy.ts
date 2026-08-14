/**
 * The decisions a selection change forces on the three places it is shown, and
 * nothing else: no subscribers, no timers, no drawing.
 *
 * Two questions are answered here, and both are pure functions of the selection
 * so they can be checked without a clock or a canvas.
 *
 * - **How much should a consumer build?** A handful of selected objects is a
 *   list of rows. Six hundred is not: building that list costs more than it
 *   tells anyone, so past `SUMMARY_THRESHOLD` consumers are handed counts by
 *   kind instead and are expected to render the tally, not the rows.
 * - **Who has to move to show it?** A wall picked in the 2D canvas is usually
 *   off the top of the side list and behind the camera in 3D. Each consumer
 *   reports what it can currently see; the ones that cannot see the newest pick
 *   are asked to bring it into view.
 *
 * A reveal names an id and a target and stops there. *How* a target obeys —
 * scrolling a row, panning a camera, flying an orbit — is the consumer's
 * business, which is what keeps Three.js out of this whole folder.
 */

import type { EntityId } from '@/domain/spatial/types';

import { selectableKindOf, type SelectableKind, type Selection } from './selectionOps';

/* -------------------------------------------------------------------------- */
/* Vocabulary.                                                                 */
/* -------------------------------------------------------------------------- */

/** The three places a selection is shown. */
export type SyncTarget = 'canvas2d' | 'scene3d' | 'list';

/** Every target, in the order events are delivered. */
export const SYNC_TARGETS: readonly SyncTarget[] = Object.freeze([
  'canvas2d',
  'scene3d',
  'list',
] as const);

/**
 * Select more than this many objects and consumers are told to summarise.
 *
 * The figure is a rendering budget rather than a rule of the drawing: it is the
 * point past which a full list costs more to build than it is worth reading.
 */
export const SUMMARY_THRESHOLD = 500;

/** How many selected objects there are of each kind. */
export type KindCounts = Readonly<Record<SelectableKind, number>>;

/**
 * How much a consumer should build from the selection it was handed.
 *
 * The ids always travel with the event whatever the mode says, because passing
 * an array by reference costs nothing and the canvas still has to highlight
 * every one of them. `summary` is about what a consumer should *build* — the
 * side list renders a tally of six hundred objects instead of six hundred rows.
 */
export type SelectionDetail =
  | { readonly mode: 'full' }
  | { readonly mode: 'summary'; readonly countsByKind: KindCounts };

/** An ask to bring one object into view in one place. */
export interface RevealRequest {
  readonly target: SyncTarget;
  readonly id: EntityId;
}

/**
 * What each target last reported it can show.
 *
 * A target that has reported nothing is taken to be showing nothing — see
 * `planReveals` for why that is the safe direction to guess in.
 */
export type VisibleByTarget = Partial<Readonly<Record<SyncTarget, readonly EntityId[]>>>;

/* -------------------------------------------------------------------------- */
/* How much to build.                                                          */
/* -------------------------------------------------------------------------- */

const emptyCounts = (): Record<SelectableKind, number> => ({
  axis: 0,
  dimension: 0,
  furniture: 0,
  opening: 0,
  room: 0,
  wall: 0,
});

/**
 * Tallies a selection by kind.
 *
 * The kind is read from the id prefix, so this never touches the drawing. An id
 * of no pickable kind is skipped rather than counted under a wrong heading;
 * `selectionOps` keeps such ids out of a selection in the first place.
 */
export const countByKind = (selection: Selection): KindCounts => {
  const counts = emptyCounts();

  for (const id of selection) {
    const kind = selectableKindOf(id);

    if (kind !== null) {
      counts[kind] += 1;
    }
  }

  return counts;
};

/** Decides between handing over rows and handing over a tally. */
export const describeSelection = (selection: Selection): SelectionDetail =>
  selection.length > SUMMARY_THRESHOLD
    ? { countsByKind: countByKind(selection), mode: 'summary' }
    : { mode: 'full' };

/* -------------------------------------------------------------------------- */
/* Who has to move.                                                            */
/* -------------------------------------------------------------------------- */

/**
 * The object a reveal is aimed at: the newest pick.
 *
 * A selection is held in selection order, so the last id is the one the user
 * just added and the one they expect to be looking at. Framing a whole batch is
 * a camera question the consumer is better placed to answer.
 */
export const revealAnchor = (selection: Selection): EntityId | null =>
  selection[selection.length - 1] ?? null;

/**
 * Which targets have to move to show the newest pick.
 *
 * A target that has reported nothing is assumed to be showing nothing, so it is
 * asked to reveal: a reveal a consumer did not need is one wasted scroll, while
 * a reveal never sent is an object the user cannot find. Targets that already
 * have the anchor on screen are left alone, which is what stops a pick made in
 * the 2D canvas from yanking that same canvas around.
 *
 * A summarised selection asks nobody to move. There is no row to scroll to once
 * the list is a tally, and throwing the camera at one of six hundred objects
 * helps no one.
 */
export const planReveals = (
  selection: Selection,
  detail: SelectionDetail,
  visible: VisibleByTarget,
): RevealRequest[] => {
  const anchor = revealAnchor(selection);

  if (anchor === null || detail.mode === 'summary') {
    return [];
  }

  return SYNC_TARGETS.filter((target) => !(visible[target] ?? []).includes(anchor)).map(
    (target) => ({ id: anchor, target }),
  );
};
