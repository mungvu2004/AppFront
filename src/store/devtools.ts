/// <reference types="vite/client" />
/**
 * State tracking for development.
 *
 * Two pieces, both composed in the store's `index.ts`:
 *
 * - `nameActions` — a middleware that gives every anonymous `set()` a readable
 *   action name derived from the fields it changes, in unaccented Vietnamese
 *   ("chon/them", "tuong/keo"), so the timeline in Redux DevTools reads like
 *   what the user did;
 * - `isStateTrackingEnabled` — the one switch: tracking exists in development
 *   only, never in production builds and never under tests.
 *
 * The action names here are display labels for the debugging timeline, like
 * commit labels are for toasts; identifiers stay English.
 */

import type { StateCreator, StoreMutatorIdentifier } from 'zustand';

/** Name the store connects to Redux DevTools under. */
export const STATE_TRACKING_NAME = 'AppFront';

/** Tracking runs in development only: not in production, not under tests. */
export const isStateTrackingEnabled = (): boolean =>
  import.meta.env.DEV && import.meta.env.MODE !== 'test';

type StateObject = Record<string, unknown>;

/** Action name per changed field, for fields with one obvious meaning. */
const ACTION_NAME_BY_FIELD: Readonly<Record<string, string>> = {
  activeFloorId: 'du-an/doi-tang',
  activeLayer: 'chon/lop',
  activeTool: 'cong-cu/chon',
  colorMode: 'khung-nhin/to-mau',
  errorId: 'quy-trinh/loi',
  floors: 'du-an/danh-sach-tang',
  hiddenLayers: 'khung-nhin/an-hien-lop',
  hoveredId: 'chon/di-chuot',
  lastCommitLabel: 'lich-su/cam-ket',
  lastCommitTimestamp: 'lich-su/cam-ket',
  leftPanelOpen: 'giao-dien/bang-ben',
  leftPanelWidthPx: 'giao-dien/rong-bang',
  openDialog: 'giao-dien/hop-thoai',
  project: 'du-an/mo',
  rightPanelOpen: 'giao-dien/bang-ben',
  rightPanelWidthPx: 'giao-dien/rong-bang',
  selectionMode: 'chon/che-do',
  spatial: 'khong-gian/cap-nhat',
  spatialLoading: 'khong-gian/dang-tai',
  steps: 'quy-trinh/cap-nhat',
  theme: 'giao-dien/chu-de',
  toolInteracting: 'cong-cu/thao-tac',
  toolOptions: 'cong-cu/tuy-chon',
  userRoles: 'du-an/quyen',
  versionId: 'phien-ban/dat',
  viewCenter: 'khung-nhin/di-chuyen',
  viewMode: 'khung-nhin/che-do',
  zoom: 'khung-nhin/thu-phong',
};

const draftOperationKind = (operation: unknown): unknown =>
  typeof operation === 'object' && operation !== null && 'kind' in operation
    ? (operation as { kind?: unknown }).kind
    : undefined;

/** Drafting distinguishes staging, dragging a wall, drawing one, discarding. */
const draftActionName = (previous: readonly unknown[], next: readonly unknown[]): string => {
  if (next.length > previous.length) {
    return 'nhap/them';
  }

  if (next.length === 0) {
    return 'nhap/huy';
  }

  if (next.length < previous.length) {
    return 'nhap/bot';
  }

  const changed = next.find((operation, index) => !Object.is(operation, previous[index]));
  const kind = draftOperationKind(changed);

  if (kind === 'moveWall') {
    return 'tuong/keo';
  }

  if (kind === 'drawWall') {
    return 'tuong/ve';
  }

  return 'nhap/cap-nhat';
};

const selectionActionName = (previous: readonly unknown[], next: readonly unknown[]): string => {
  if (next.length > previous.length) {
    return 'chon/them';
  }

  if (next.length === 0) {
    return 'chon/xoa';
  }

  if (next.length < previous.length) {
    return 'chon/bot';
  }

  return 'chon/dat-lai';
};

/** Derives a timeline label from what a `set()` is about to change. */
export const deriveActionName = (previous: StateObject, changes: StateObject): string => {
  const changedKeys = Object.keys(changes).filter((key) => !Object.is(previous[key], changes[key]));
  const keys = changedKeys.length > 0 ? changedKeys : Object.keys(changes);

  if (keys.includes('selectedIds')) {
    const before = previous['selectedIds'];
    const after = changes['selectedIds'];

    if (Array.isArray(before) && Array.isArray(after)) {
      return selectionActionName(before, after);
    }
  }

  if (keys.includes('draftOperations')) {
    const before = previous['draftOperations'];
    const after = changes['draftOperations'];

    if (Array.isArray(before) && Array.isArray(after)) {
      return draftActionName(before, after);
    }
  }

  for (const key of keys) {
    const name = ACTION_NAME_BY_FIELD[key];

    if (name !== undefined) {
      return name;
    }
  }

  return 'trang-thai/cap-nhat';
};

type NameActions = <
  T,
  Mps extends [StoreMutatorIdentifier, unknown][] = [],
  Mcs extends [StoreMutatorIdentifier, unknown][] = [],
>(
  creator: StateCreator<T, Mps, Mcs>,
) => StateCreator<T, Mps, Mcs>;

type NameActionsImpl = <T>(creator: StateCreator<T, [], []>) => StateCreator<T, [], []>;

type SetWithAction = (partial: unknown, replace?: unknown, action?: unknown) => void;

const nameActionsImpl: NameActionsImpl = (creator) => (set, get, api) => {
  const rawSet = set as unknown as SetWithAction;

  const namedSet: SetWithAction = (partial, replace, action) => {
    if (!isStateTrackingEnabled() || action !== undefined) {
      rawSet(partial, replace, action);

      return;
    }

    const previous = get() as StateObject;
    const resolved =
      typeof partial === 'function' ? (partial as (state: unknown) => unknown)(previous) : partial;
    const changes = typeof resolved === 'object' && resolved !== null ? (resolved as StateObject) : {};

    rawSet(resolved, replace, deriveActionName(previous, changes));
  };

  return creator(namedSet as unknown as typeof set, get, api);
};

/**
 * Middleware that names anonymous `set()` calls for the devtools timeline.
 * Outside development it forwards untouched.
 */
export const nameActions = nameActionsImpl as unknown as NameActions;
