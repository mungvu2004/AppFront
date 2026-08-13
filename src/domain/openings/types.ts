/**
 * Openings: what a door, a window or a plain hole is, and where it sits.
 *
 * An opening has no life of its own — it is a hole cut in one wall — so it is
 * stored the way a hole in a wall behaves: **along** the wall rather than at a
 * place on the plan. `relativePosition` is a fraction of the host centreline, so
 * dragging a wall, stretching it or turning it carries every opening with it and
 * no coordinate is ever rewritten. Storing the absolute centre instead would
 * leave doors standing in mid-air the first time somebody moved a wall.
 *
 * Two consequences shape the types below.
 *
 * - An opening that no wall will take is **never deleted**. It becomes an
 *   `OrphanOpening`, which keeps the traced centre it arrived with and says why
 *   it is floating, so a person can see it on the plan and put it right.
 *   Throwing away model output that failed to attach would hide the mistake
 *   instead of raising it.
 * - Being attached lives in the **type**, not in a flag: an `AttachedOpening`
 *   has a `WallId` and a relative position, an `OrphanOpening` has `null` and a
 *   point. The compiler will not let a caller read a position that is not there.
 *
 * Lengths are millimetres, as everywhere else in the domain. `sillHeightMm` is
 * measured from the base of the host wall rather than from the project datum,
 * for the same reason the plan position is relative: a window sill rides with
 * the wall it is cut into.
 *
 * The kinds are this module's own rather than the spatial graph's `OpeningKind`,
 * because a hole with nothing in it — no leaf, no glazing — behaves differently
 * from both a door and a window and the graph's pair has no room for it.
 */

import { compareNearly, type PointMm } from '../units/compare';
import type { Millimetres } from '../units/types';
import type { OpeningId, SwingDirection, WallId } from '../spatial/types';

export type { PointMm } from '../units/compare';
export type { SwingDirection } from '../spatial/types';

/* -------------------------------------------------------------------------- */
/* Kinds.                                                                      */
/* -------------------------------------------------------------------------- */

/**
 * What has been cut into the wall.
 *
 * `void` is a structural hole a person walks through with nothing hung in it: an
 * archway, a pass-through, a doorway whose leaf was never drawn. It bounds a
 * room the way a door does but never carries a swing.
 */
export type OpeningKind = 'door' | 'window' | 'void';

/** Every kind, in the order the interface lists them. */
export const OPENING_KINDS: readonly OpeningKind[] = ['door', 'window', 'void'];

/**
 * Vietnamese names for every kind.
 *
 * A complete record rather than a lookup with a fallback, so adding a kind fails
 * the build here instead of quietly showing its English name on the screen.
 */
export const OPENING_KIND_LABELS: Readonly<Record<OpeningKind, string>> = {
  door: 'Cửa đi',
  window: 'Cửa sổ',
  void: 'Lỗ trống',
};

/** The Vietnamese name for a kind. */
export function describeOpeningKind(kind: OpeningKind): string {
  return OPENING_KIND_LABELS[kind];
}

/* -------------------------------------------------------------------------- */
/* Position along a wall.                                                      */
/* -------------------------------------------------------------------------- */

/**
 * Where the centre of an opening sits along its host centreline.
 *
 * `0` is the `start` end of the centreline, `1` is the `end` end, and the value
 * is dimensionless: it stays correct when the wall is lengthened, shortened,
 * moved or turned.
 */
export type RelativePosition = number;

/** The `start` end of the host centreline. */
export const AT_WALL_START: RelativePosition = 0;

/** The `end` end of the host centreline. */
export const AT_WALL_END: RelativePosition = 1;

/**
 * Tolerance used on a relative position.
 *
 * Far tighter than the millimetre tolerances elsewhere in the domain, because
 * this number is a fraction, not a length: on a four metre wall the domain's
 * default micrometre epsilon would be four millimetres of slack. This value only
 * absorbs the last few ulps of a division.
 */
export const RELATIVE_POSITION_EPSILON = 1e-9;

/** Is this a fraction of a wall a real opening could sit at? */
export function isValidRelativePosition(value: number): boolean {
  return (
    Number.isFinite(value) &&
    compareNearly(value, AT_WALL_START, RELATIVE_POSITION_EPSILON) >= 0 &&
    compareNearly(value, AT_WALL_END, RELATIVE_POSITION_EPSILON) <= 0
  );
}

/**
 * Fold a position onto `[0, 1]`.
 *
 * Only ever moves a value by the tolerance above when it is used on a position
 * that `isValidRelativePosition` has already accepted; the projection in
 * `attach.ts` uses it to pull a foot that fell past a wall end back onto it.
 */
export function clampRelativePosition(value: RelativePosition): RelativePosition {
  return Math.min(AT_WALL_END, Math.max(AT_WALL_START, value));
}

/* -------------------------------------------------------------------------- */
/* The opening itself.                                                         */
/* -------------------------------------------------------------------------- */

/**
 * Everything an opening is, apart from where it sits.
 *
 * Split out so the attached form and the orphan form cannot drift apart: adding
 * a property here adds it to both, and to the traced input as well.
 */
export interface OpeningCore {
  readonly id: OpeningId;
  readonly kind: OpeningKind;
  /** Along the wall, measured on the centreline. */
  readonly widthMm: Millimetres;
  /** From the sill to the head. */
  readonly heightMm: Millimetres;
  /** Height of the sill above the base of the host wall; a door uses 0. */
  readonly sillHeightMm: Millimetres;
  /** How the leaf opens, seen from inside the room; a `void` uses `fixed`. */
  readonly swing: SwingDirection;
}

/** An opening that knows which wall it belongs to and where along it. */
export interface AttachedOpening extends OpeningCore {
  readonly wallId: WallId;
  /** Fraction of the host centreline, from the `start` end. */
  readonly relativePosition: RelativePosition;
}

/**
 * Why no wall would take an opening.
 *
 * Each case needs a different move from the person reading it, which is why they
 * are not collapsed into one "failed" state.
 */
export type OrphanReason =
  /** There was no wall with any length to attach to at all. */
  | 'noUsableWall'
  /** A nearest wall was found, but it sits further away than the radius. */
  | 'noWallInRange'
  /** No usable point to project: the traced centre is not a finite coordinate. */
  | 'centreUnknown';

/** Vietnamese names for every reason an opening can be left floating. */
export const ORPHAN_REASON_LABELS: Readonly<Record<OrphanReason, string>> = {
  noUsableWall: 'Chưa có tường nào để gắn',
  noWallInRange: 'Không có tường nào trong bán kính tìm kiếm',
  centreUnknown: 'Không có toạ độ hợp lệ để chiếu',
};

/** The Vietnamese name for a reason. */
export function describeOrphanReason(reason: OrphanReason): string {
  return ORPHAN_REASON_LABELS[reason];
}

/**
 * An opening that could not be attached, kept rather than thrown away.
 *
 * It holds the centre it was traced at, so it can still be drawn where the model
 * put it and re-attached later — once a missing wall is drawn, passing this
 * straight back to `attachToWall` is all a retry takes.
 */
export interface OrphanOpening extends OpeningCore {
  readonly wallId: null;
  /** The absolute centre it was traced at, in millimetres. */
  readonly centre: PointMm;
  readonly orphanReason: OrphanReason;
}

/** An opening in either state, as it is stored. */
export type Opening = AttachedOpening | OrphanOpening;

/**
 * An opening as the model traced it: an absolute centre and no host yet.
 *
 * `OrphanOpening` satisfies this shape too, which is what makes retrying an
 * orphan a plain second call to `attachToWall`.
 */
export interface TracedOpening extends OpeningCore {
  readonly centre: PointMm;
}

/** Does this opening belong to a wall? */
export function isAttached(opening: Opening): opening is AttachedOpening {
  return opening.wallId !== null;
}

/** Is this opening still floating? */
export function isOrphan(opening: Opening): opening is OrphanOpening {
  return opening.wallId === null;
}
