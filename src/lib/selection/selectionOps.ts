/**
 * The selection algebra: what a plain pick, a Ctrl-pick, a pick-all-of-kind and
 * an inversion do to what the user has selected.
 *
 * Four rules hold across every operation in this file, and the tests are built
 * around them rather than around any single operation.
 *
 * - **A selection is a set of ids, never a set of entities.** Nothing here
 *   returns a `Wall` or a `Room`; the drawing is read only to answer "may this
 *   id be picked?". The store keeps the same shape (`selectedIds`), so the
 *   result of any operation can be handed straight to `setSelection`.
 * - **Every operation is a pure function `(selection, …, context) -> selection`.**
 *   The previous selection goes in, a new one comes out, and neither the input
 *   array nor the drawing is touched. A frozen selection is a valid input.
 * - **Eligibility gates entry, never exit.** A hidden or locked layer, or a
 *   floor other than the one being viewed, stops an id from *entering* the
 *   selection — it never traps one that is already in it. Locking a layer while
 *   its objects are selected must not make those objects impossible to drop.
 * - **An operation that changes nothing returns the array it was given**, so a
 *   no-op pick cannot make a subscriber re-render.
 *
 * Layer keys are entity kinds, which is the same vocabulary as `ViewLayer` in
 * the view slice minus `note` (notes are annotations, not pickable geometry).
 * The store is not imported here — `src/lib` never reaches into it — so a
 * caller assembles `SelectionContext` from the slices it already reads.
 */

import { readKindFromId, type EntityKind } from '@/domain/spatial/ids';
import { idsOnLevel, resolveLevelId, type NormalizedSpatial } from '@/domain/spatial/normalize';
import type { EntityId, LevelId } from '@/domain/spatial/types';

/* -------------------------------------------------------------------------- */
/* Vocabulary.                                                                 */
/* -------------------------------------------------------------------------- */

/**
 * A kind that can be picked on the canvas.
 *
 * A level is a container, not something drawn on the plan, so it is excluded:
 * it carries no footprint and `resolveLevelId` reports no level for it.
 */
export type SelectableKind = Exclude<EntityKind, 'level'>;

/** Whether a layer is drawn, and whether its objects may be picked. */
export interface LayerState {
  readonly visible: boolean;
  readonly locked: boolean;
}

/** What an unlisted layer is assumed to be: drawn and pickable. */
export const DEFAULT_LAYER_STATE: LayerState = Object.freeze({ locked: false, visible: true });

/** Layer states by kind; an absent key means `DEFAULT_LAYER_STATE`. */
export type LayerStates = Partial<Readonly<Record<SelectableKind, LayerState>>>;

/** Everything an operation needs to decide what may be picked right now. */
export interface SelectionContext {
  /** The drawing, in the flat form built by `domain/spatial/normalize`. */
  readonly spatial: NormalizedSpatial;
  /** The floor being viewed; nothing off it can ever be selected. */
  readonly activeLevelId: LevelId;
  readonly layers: LayerStates;
}

/** Selected ids, in selection order; the same shape the store holds. */
export type Selection = readonly EntityId[];

/** How a set of freshly picked ids meets the selection already held. */
export type SelectionCombine = 'replace' | 'add' | 'subtract';

const EMPTY_SELECTION: Selection = Object.freeze([]);

/* -------------------------------------------------------------------------- */
/* Eligibility.                                                                */
/* -------------------------------------------------------------------------- */

/** Reads a layer's state, falling back to visible and unlocked. */
export const readLayerState = (layers: LayerStates, kind: SelectableKind): LayerState =>
  layers[kind] ?? DEFAULT_LAYER_STATE;

/** The pickable kind an id belongs to; `null` for a level or a malformed id. */
export const selectableKindOf = (id: EntityId): SelectableKind | null => {
  const kind = readKindFromId(id);

  return kind === null || kind === 'level' ? null : kind;
};

/**
 * May this id enter a selection?
 *
 * Four conditions, all required: the id is well formed and of a pickable kind,
 * the drawing actually holds it, it sits on the floor being viewed — resolved
 * through the host wall for an opening — and its layer is visible and unlocked.
 */
export const isSelectable = (id: EntityId, context: SelectionContext): boolean => {
  const kind = selectableKindOf(id);

  if (kind === null) {
    return false;
  }

  const entity = context.spatial.byId[id];

  if (entity === undefined) {
    return false;
  }

  if (resolveLevelId(entity, context.spatial.byId) !== context.activeLevelId) {
    return false;
  }

  const layer = readLayerState(context.layers, kind);

  return layer.visible && !layer.locked;
};

/** Every id the user could pick right now, in the order the floor holds them. */
export const selectableIds = (context: SelectionContext): EntityId[] =>
  idsOnLevel(context.spatial, context.activeLevelId).filter((id) => isSelectable(id, context));

/* -------------------------------------------------------------------------- */
/* Internals.                                                                  */
/* -------------------------------------------------------------------------- */

/**
 * Returns `previous` when `next` holds the same ids in the same order.
 *
 * Selections are compared by content because every operation builds a fresh
 * array; without this a pick that changes nothing would still be a new
 * reference and would wake every subscriber.
 */
const keepIfUnchanged = (previous: Selection, next: Selection): Selection =>
  previous.length === next.length && previous.every((id, index) => id === next[index])
    ? previous
    : next;

/** Drops repeats while keeping first-seen order. */
const dedupe = (ids: readonly EntityId[]): EntityId[] => [...new Set(ids)];

/* -------------------------------------------------------------------------- */
/* Operations.                                                                 */
/* -------------------------------------------------------------------------- */

/** Is this id currently selected? */
export const isSelected = (selection: Selection, id: EntityId): boolean => selection.includes(id);

/**
 * A plain pick: the selection becomes this one id.
 *
 * A pick that lands on something ineligible — a locked layer, a hidden layer,
 * another floor — lands on nothing, and clears the selection exactly as a pick
 * on empty canvas would. The previous selection is never kept, which is what
 * makes this different from `toggleSelection`.
 */
export const selectSingle = (
  selection: Selection,
  id: EntityId,
  context: SelectionContext,
): Selection => keepIfUnchanged(selection, isSelectable(id, context) ? [id] : EMPTY_SELECTION);

/**
 * A Ctrl-pick: adds the id when it is absent, drops it when it is present.
 *
 * Dropping never consults eligibility. An object whose layer was locked after
 * it was selected can still be Ctrl-picked out of the selection.
 */
export const toggleSelection = (
  selection: Selection,
  id: EntityId,
  context: SelectionContext,
): Selection => {
  if (isSelected(selection, id)) {
    return selection.filter((selectedId) => selectedId !== id);
  }

  return isSelectable(id, context) ? [...selection, id] : selection;
};

/**
 * Selects every eligible object of one kind on the floor being viewed.
 *
 * The ids come from the kind index, so they arrive in the drawing's own order
 * rather than in floor order; `isSelectable` still keeps the result on the
 * active floor.
 */
export const selectAllOfKind = (
  selection: Selection,
  kind: SelectableKind,
  context: SelectionContext,
): Selection =>
  keepIfUnchanged(
    selection,
    context.spatial.byKind[kind].filter((id) => isSelectable(id, context)),
  );

/**
 * Swaps what is selected for what is not.
 *
 * The result is drawn from the eligible ids of the floor being viewed, so an
 * object on a locked layer stays out of the selection on both sides of the
 * swap, and a selected object that has since become ineligible simply drops.
 */
export const invertSelection = (selection: Selection, context: SelectionContext): Selection => {
  const held = new Set(selection);

  return keepIfUnchanged(
    selection,
    selectableIds(context).filter((id) => !held.has(id)),
  );
};

/** Deselects everything. */
export const clearSelection = (selection: Selection): Selection =>
  selection.length === 0 ? selection : EMPTY_SELECTION;

/**
 * Folds a batch of freshly picked ids — a marquee's hits, say — into the
 * selection already held.
 *
 * `replace` and `add` filter the incoming ids through `isSelectable`, so this
 * cannot be the door through which a locked or off-floor id enters a selection.
 * `subtract` filters nothing, because removal is always allowed.
 */
export const combineSelection = (
  selection: Selection,
  ids: readonly EntityId[],
  mode: SelectionCombine,
  context: SelectionContext,
): Selection => {
  if (mode === 'subtract') {
    const dropped = new Set(ids);

    return keepIfUnchanged(
      selection,
      selection.filter((id) => !dropped.has(id)),
    );
  }

  const eligible = ids.filter((id) => isSelectable(id, context));

  return keepIfUnchanged(
    selection,
    mode === 'replace' ? dedupe(eligible) : dedupe([...selection, ...eligible]),
  );
};
