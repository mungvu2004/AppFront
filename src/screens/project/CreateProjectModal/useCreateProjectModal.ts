/**
 * The create-project wizard's whole mind: three steps, a floor stack, and the
 * one call to a gateway that turns it all into a project.
 *
 * Invariant D's split: this hook holds every piece of state and does every
 * computation; `CreateProjectModal.tsx` only renders. Every string the view
 * shows for a floor's position — "-3,0 m", the overlap sentence — arrives
 * already built, so the view never calls `formatNumber` or a domain
 * conversion itself (invariant A15).
 *
 * ## The elevation stack (the one thing worth reading carefully)
 *
 * The ground floor is the datum: its `floorElevationMm` is always `0`. Every
 * floor above it is placed by one repeated call —
 * `ceilingElevationMm(previousFloor)` from `@/domain/axes/alignFloors` — so a
 * floor's floor level is always exactly its neighbour's ceiling, never a
 * number typed by this hook. The basement, if there is one, gets exactly ONE
 * downward negation: its ceiling has to land on the ground floor's `0`, so its
 * own floor level is `-clearHeightMm`. That line is marked below and it is the
 * only place a floor's elevation is computed by subtraction rather than by
 * `ceilingElevationMm`.
 *
 * Collisions are read straight off `alignFloors(plans).issues`, filtered to
 * `kind === 'overlap'` — `unalignable` and `clearHeight` also fire on this
 * data (every row's `axes` is `[]`, and this form's own 2–10 m range is wider
 * than the domain's 2,4–6 m one) but neither is a complaint this screen owns.
 * `FloorIssue.message` is used verbatim: it already names both floors in
 * Vietnamese with formatted millimetres.
 *
 * ## Seven states, one precedence
 *
 * `collapsed → forbidden → loading → error → empty → partial → success`, most
 * of which are read straight off {@link SEVEN_STATES}' own wording. `empty`
 * only fires on step 2 with no floors yet — step 1 with nothing wrong is
 * `success` by default, which is also why the eventual "all clean" story for
 * `success` happens to sit on step 3.
 */

import { useEffect, useMemo, useState } from 'react';

import type { SelectOption } from '@/components/ui/Select';
import { alignFloors, ceilingElevationMm, type FloorPlan } from '@/domain/axes/alignFloors';
import { PROJECT_LIMITS } from '@/domain/project/limits';
import type { LevelId } from '@/domain/spatial/types';

/** Re-exported so `CreateProjectModal.tsx`/`StepFloors.tsx` (pure views, R-60)
 * never import `src/domain` directly — only this hook may. */
export { PROJECT_LIMITS };
import {
  metres,
  metresToMillimetres,
  millimetres,
  millimetresToMetres,
  roundMeasurement,
  type Millimetres,
} from '@/domain/units/types';
import { describeError, toAppError } from '@/lib/errors';
import { can } from '@/lib/auth/permissions';
import { createUuid } from '@/lib/http/ids';
import type { Result } from '@/lib/http';
import { formatNumber } from '@/lib/format/number';
import type { SevenState } from '@/lib/testing/sevenStateScenarios';
import type { ProjectRole } from '@/types/project';

/** How many characters of the generated slug the code keeps. */
const CODE_SLUG_MAX_LENGTH = 24;

/** `L-` — the fixed prefix a row id is turned into a {@link LevelId} with. */
const LEVEL_ID_PREFIX_LENGTH = 2;

const BUILDING_TYPE_OPTIONS: SelectOption[] = [
  { value: 'residential', label: 'nhà ở' },
  { value: 'commercial', label: 'thương mại' },
  { value: 'industrial', label: 'công nghiệp' },
  { value: 'mixed', label: 'hỗn hợp' },
  { value: 'other', label: 'khác' },
];

const DEFAULT_BUILDING_TYPE = 'residential';

/** How many floors the wizard starts with — a stack worth reviewing at a glance. */
const DEFAULT_FLOOR_COUNT = 4;

/* -------------------------------------------------------------------------- */
/* Draft floors — what this hook edits before it becomes a FloorPlan.          */
/* -------------------------------------------------------------------------- */

interface DraftFloorRow {
  readonly id: string;
  readonly name: string;
  readonly kind: 'basement' | 'floor';
  readonly clearHeightM: number | null;
}

/** One floor, ready for the table. Every field is a value; the view computes nothing. */
export interface CreateProjectFloorRowModel {
  readonly id: string;
  readonly name: string;
  readonly kind: 'basement' | 'floor';
  readonly clearHeightM: number | null;
  /** `"-3,0 m"`, already formatted; `null` while the stack cannot be computed yet. */
  readonly elevationLabel: string | null;
  /** This row's own complaint — missing height, out of range, or a collision naming it. */
  readonly problem: string | null;
}

/* -------------------------------------------------------------------------- */
/* Wording.                                                                    */
/* -------------------------------------------------------------------------- */

function heightProblemFor(clearHeightM: number | null): string | null {
  if (clearHeightM === null) {
    return 'Chưa nhập chiều cao thông thuỷ.';
  }
  if (
    clearHeightM < PROJECT_LIMITS.storeyHeightMinM ||
    clearHeightM > PROJECT_LIMITS.storeyHeightMaxM
  ) {
    return (
      `Chiều cao thông thuỷ áp dụng từ ${formatNumber(PROJECT_LIMITS.storeyHeightMinM)} ` +
      `đến ${formatNumber(PROJECT_LIMITS.storeyHeightMaxM)} mét.`
    );
  }
  return null;
}

function elevationProblemFor(elevationMm: Millimetres): string | null {
  const elevationM = millimetresToMetres(elevationMm);
  if (elevationM < PROJECT_LIMITS.elevationMinM || elevationM > PROJECT_LIMITS.elevationMaxM) {
    return (
      `Cao độ vượt giới hạn cho phép (${formatNumber(PROJECT_LIMITS.elevationMinM)} ` +
      `đến ${formatNumber(PROJECT_LIMITS.elevationMaxM)} mét).`
    );
  }
  return null;
}

function formatElevationLabel(elevationMm: Millimetres): string {
  return `${formatNumber(millimetresToMetres(elevationMm), { fractionDigits: 1 })} m`;
}

function localNameProblemFor(name: string): string | null {
  const trimmed = name.trim();
  if (trimmed.length === 0) {
    return 'Chưa nhập tên dự án.';
  }
  if (trimmed.length < PROJECT_LIMITS.nameMinLength) {
    return `Tên dự án cần ít nhất ${formatNumber(PROJECT_LIMITS.nameMinLength)} ký tự.`;
  }
  if (trimmed.length > PROJECT_LIMITS.nameMaxLength) {
    return `Tên dự án không quá ${formatNumber(PROJECT_LIMITS.nameMaxLength)} ký tự.`;
  }
  return null;
}

/** The combining marks NFD leaves behind once a letter is split from its accent. */
const COMBINING_MARKS = new RegExp('[\\u0300-\\u036f]', 'g');

/**
 * A short, editable starting point for the project code — six-ish lines, as
 * agreed, rather than a dependency on `src/lib/export/exportGlb.ts`'s slug
 * helper (that module pulls in the GLB exporter and three.js, and the bundle
 * size gate is already red at HEAD).
 */
function generateProjectCode(name: string): string {
  const withoutDiacritics = name
    .trim()
    .normalize('NFD')
    .replace(COMBINING_MARKS, '')
    .replace(/đ/giu, 'd');
  const slug = withoutDiacritics
    .toUpperCase()
    .replace(/[^A-Z0-9]+/gu, '-')
    .replace(/^-+|-+$/gu, '')
    .slice(0, CODE_SLUG_MAX_LENGTH);

  return slug === '' ? '' : `DA-${slug}`;
}

function rowIdFromLevelId(levelId: LevelId): string {
  return levelId.slice(LEVEL_ID_PREFIX_LENGTH);
}

/** Names the next floor above the ground the way {@link addFloor} always has. */
function nextFloorName(aboveCount: number): string {
  return aboveCount === 0 ? 'Tầng trệt' : `Tầng ${String(aboveCount)}`;
}

/** The wizard's starting stack: {@link DEFAULT_FLOOR_COUNT} floors, no basement, no heights yet. */
function createDefaultFloorRows(): DraftFloorRow[] {
  return Array.from({ length: DEFAULT_FLOOR_COUNT }, (_unused, index) => ({
    id: createUuid(),
    name: nextFloorName(index),
    kind: 'floor' as const,
    clearHeightM: null,
  }));
}

function describeCreateFailure(error: unknown): string {
  const appError = toAppError(error);
  // A 409 from `projects.create` is, in practice, always a name already taken
  // — the one field this form can collide on. Every other kind falls back to
  // the shared, already-Vietnamese wording `describeError` owns.
  if (appError.kind === 'conflict') {
    return 'Tên dự án đã trùng với một dự án khác. Đổi tên rồi thử lại.';
  }
  return describeError(appError).description;
}

/* -------------------------------------------------------------------------- */
/* The floor stack.                                                           */
/* -------------------------------------------------------------------------- */

interface FloorStack {
  readonly plans: readonly FloorPlan[];
  readonly problemById: ReadonlyMap<string, string>;
  readonly elevationLabelById: ReadonlyMap<string, string>;
  readonly collision: string | null;
  readonly collisionRowId: string | null;
}

function computeFloorStack(rows: readonly DraftFloorRow[]): FloorStack {
  const basement = rows.find((row) => row.kind === 'basement') ?? null;
  const aboveRows = rows.filter((row) => row.kind === 'floor');

  const plans: FloorPlan[] = [];
  const problemById = new Map<string, string>();
  const elevationLabelById = new Map<string, string>();

  let previousCeilingMm: Millimetres | null = null;
  let chainBroken = false;

  aboveRows.forEach((row, index) => {
    if (chainBroken) {
      problemById.set(row.id, 'Chưa tính được cao độ vì tầng bên dưới còn thiếu chiều cao hợp lệ.');
      return;
    }

    const heightProblem = heightProblemFor(row.clearHeightM);
    if (heightProblem !== null || row.clearHeightM === null) {
      problemById.set(row.id, heightProblem ?? 'Chưa nhập chiều cao thông thuỷ.');
      chainBroken = true;
      return;
    }

    let floorElevationMm: Millimetres;
    if (index === 0) {
      floorElevationMm = millimetres(0);
    } else if (previousCeilingMm === null) {
      // Defensive only: `chainBroken` already returns before this point once a
      // row fails, so a later row never reaches here with no ceiling to sit on.
      problemById.set(row.id, 'Chưa tính được cao độ vì tầng bên dưới còn thiếu chiều cao hợp lệ.');
      chainBroken = true;
      return;
    } else {
      floorElevationMm = previousCeilingMm;
    }

    const clearHeightMm = roundMeasurement(metresToMillimetres(metres(row.clearHeightM)));
    const elevationProblem = elevationProblemFor(floorElevationMm);
    if (elevationProblem !== null) {
      problemById.set(row.id, elevationProblem);
      chainBroken = true;
      return;
    }

    const plan: FloorPlan = {
      levelId: `L-${row.id}` as LevelId,
      name: row.name,
      floorElevationMm,
      clearHeightMm,
      axes: [],
    };
    plans.push(plan);
    previousCeilingMm = ceilingElevationMm(plan);
    elevationLabelById.set(row.id, formatElevationLabel(floorElevationMm));
  });

  if (basement !== null) {
    const heightProblem = heightProblemFor(basement.clearHeightM);
    if (heightProblem !== null || basement.clearHeightM === null) {
      problemById.set(basement.id, heightProblem ?? 'Chưa nhập chiều cao thông thuỷ.');
    } else {
      const clearHeightMm = roundMeasurement(metresToMillimetres(metres(basement.clearHeightM)));
      // The ONE downward negation for the basement datum: its ceiling has to
      // land exactly on the ground floor's own floor level (0), so its floor
      // level is the negative of its own clear height. Nowhere else in this
      // module computes an elevation by subtraction.
      const floorElevationMm = millimetres(-clearHeightMm);
      const elevationProblem = elevationProblemFor(floorElevationMm);
      if (elevationProblem !== null) {
        problemById.set(basement.id, elevationProblem);
      } else {
        plans.unshift({
          levelId: `L-${basement.id}` as LevelId,
          name: basement.name,
          floorElevationMm,
          clearHeightMm,
          axes: [],
        });
        elevationLabelById.set(basement.id, formatElevationLabel(floorElevationMm));
      }
    }
  }

  const overlaps = plans.length > 0 ? alignFloors(plans).issues.filter((issue) => issue.kind === 'overlap') : [];

  for (const issue of overlaps) {
    const upperId = rowIdFromLevelId(issue.levelId);
    problemById.set(upperId, issue.message);
    if (issue.relatedLevelId !== null) {
      const lowerId = rowIdFromLevelId(issue.relatedLevelId);
      if (!problemById.has(lowerId)) {
        problemById.set(lowerId, issue.message);
      }
    }
  }

  const firstOverlap = overlaps[0] ?? null;

  return {
    plans,
    problemById,
    elevationLabelById,
    collision: firstOverlap?.message ?? null,
    collisionRowId: firstOverlap ? rowIdFromLevelId(firstOverlap.levelId) : null,
  };
}

/* -------------------------------------------------------------------------- */
/* Compact viewport.                                                          */
/* -------------------------------------------------------------------------- */

const NARROW_VIEWPORT_QUERY = '(max-width: 1023px)';

/** `< 1024px` — the same floor `ProjectDashboard`'s three-column grid uses. */
function useNarrowViewport(): boolean {
  const [isNarrow, setIsNarrow] = useState(() =>
    typeof window !== 'undefined' ? window.matchMedia(NARROW_VIEWPORT_QUERY).matches : false,
  );

  useEffect(() => {
    const media = window.matchMedia(NARROW_VIEWPORT_QUERY);
    setIsNarrow(media.matches);
    const listener = (event: MediaQueryListEvent): void => setIsNarrow(event.matches);
    media.addEventListener('change', listener);
    return () => media.removeEventListener('change', listener);
  }, []);

  return isNarrow;
}

/* -------------------------------------------------------------------------- */
/* The model and the actions.                                                  */
/* -------------------------------------------------------------------------- */

export interface CreateProjectNotice {
  readonly level: 'attention' | 'violation';
  readonly message: string;
}

export interface CreateProjectModel {
  readonly state: SevenState;
  readonly isCompact: boolean;
  readonly canCreate: boolean;
  readonly step: 1 | 2 | 3;
  readonly stepLabel: string;
  readonly isSubmitting: boolean;
  readonly isConfirmingDiscard: boolean;
  readonly isSelectOpen: boolean;
  readonly name: string;
  readonly address: string;
  readonly code: string;
  readonly buildingType: string;
  readonly notes: string;
  readonly buildingTypeOptions: SelectOption[];
  readonly problems: { readonly name: string | null };
  readonly notice: CreateProjectNotice | null;
  readonly floorRows: readonly CreateProjectFloorRowModel[];
  readonly hasBasement: boolean;
  readonly collision: string | null;
  readonly collisionRowId: string | null;
  readonly focusFloorId: string | null;
  readonly canAddFloor: boolean;
  /** The height typed into the "áp cho mọi tầng" field; `null` while empty. */
  readonly applyHeightM: number | null;
  readonly canApplyHeight: boolean;
  readonly canGoNext: boolean;
  readonly canSubmit: boolean;
}

export interface CreateProjectActions {
  readonly setName: (value: string) => void;
  readonly setAddress: (value: string) => void;
  readonly setCode: (value: string) => void;
  readonly setBuildingType: (value: string) => void;
  readonly setNotes: (value: string) => void;
  readonly setSelectOpen: (open: boolean) => void;
  readonly setHasBasement: (value: boolean) => void;
  readonly addFloor: () => void;
  readonly removeFloor: (id: string) => void;
  readonly setFloorName: (id: string, value: string) => void;
  readonly setFloorHeight: (id: string, valueM: number | undefined) => void;
  readonly setApplyHeightM: (valueM: number | undefined) => void;
  readonly applyHeightToAllFloors: () => void;
  readonly focusFloor: (id: string) => void;
  readonly acknowledgeFocus: () => void;
  readonly goNext: () => void;
  readonly goBack: () => void;
  readonly requestClose: () => void;
  readonly confirmDiscard: () => void;
  readonly submit: () => void;
}

/**
 * Every prop the view (and its per-step siblings) render from — model plus
 * actions plus the one field the hook itself has no opinion about.
 *
 * Lives here rather than in `CreateProjectModal.tsx` so that a step split off
 * into its own file (mục D, once a view crosses R-22's 400-line ceiling) can
 * import it without creating an import cycle with the view file.
 */
export interface CreateProjectModalViewProps extends CreateProjectModel, CreateProjectActions {
  readonly isOpen: boolean;
}

export interface CreateProjectRequest {
  readonly name: string;
  readonly address: string;
  readonly code: string;
  readonly buildingType: string;
  readonly notes: string;
  readonly floors: readonly FloorPlan[];
}

/** The port this hook talks through — a fetch, an undo, and nothing else. */
export interface CreateProjectGateway {
  readonly create: (request: CreateProjectRequest) => Promise<Result<{ readonly id: string }, unknown>>;
  readonly remove: (projectId: string) => Promise<Result<void, unknown>>;
}

export interface UseCreateProjectModalOptions {
  readonly gateway: CreateProjectGateway;
  readonly role?: ProjectRole;
  /** Overrides the viewport probe — for a story or a test that wants a fixed answer. */
  readonly forceCompact?: boolean;
  readonly onCreated?: (projectId: string) => void;
  readonly onDismiss: () => void;
  /** Invariant A8's undoable toast. Injected — `Toast.Provider` is mounted by the caller. */
  readonly onToast?: (toast: { readonly message: string; readonly onUndo?: () => void }) => void;
}

export function useCreateProjectModal(
  options: UseCreateProjectModalOptions,
): { readonly model: CreateProjectModel; readonly actions: CreateProjectActions } {
  const { gateway } = options;
  const role = options.role ?? 'engineer';

  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [name, setNameState] = useState('');
  const [address, setAddressState] = useState('');
  const [code, setCodeState] = useState('');
  const [codeManuallyEdited, setCodeManuallyEdited] = useState(false);
  const [buildingType, setBuildingTypeState] = useState(DEFAULT_BUILDING_TYPE);
  const [notes, setNotesState] = useState('');
  const [isSelectOpen, setIsSelectOpen] = useState(false);
  const [floorRows, setFloorRows] = useState<readonly DraftFloorRow[]>(createDefaultFloorRows);
  const [applyHeightM, setApplyHeightMState] = useState<number | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isConfirmingDiscard, setIsConfirmingDiscard] = useState(false);
  const [isDirty, setIsDirty] = useState(false);
  const [serverNameProblem, setServerNameProblem] = useState<string | null>(null);
  const [notice, setNotice] = useState<CreateProjectNotice | null>(null);
  const [focusFloorId, setFocusFloorId] = useState<string | null>(null);

  const detectedCompact = useNarrowViewport();
  const isCompact = options.forceCompact ?? detectedCompact;

  const canCreate = can('create', 'project', { roles: [role] });

  const floorStack = useMemo(() => computeFloorStack(floorRows), [floorRows]);
  const hasAnyRowProblem = floorRows.some((row) => floorStack.problemById.has(row.id));
  const nameProblem = localNameProblemFor(name);
  const problems = { name: serverNameProblem ?? nameProblem };

  const canGoNextStep1 = problems.name === null;
  const canGoNextStep2 = floorRows.length > 0 && !hasAnyRowProblem && floorStack.collision === null;
  const canGoNext = step === 1 ? canGoNextStep1 : step === 2 ? canGoNextStep2 : true;
  const canSubmit = canGoNextStep1 && canGoNextStep2 && !isSubmitting;
  const canAddFloor = floorRows.length < PROJECT_LIMITS.floorCountMax;
  const canApplyHeight = applyHeightM !== null && floorRows.length > 0;

  const state = useMemo<SevenState>(() => {
    if (isCompact) return 'collapsed';
    if (!canCreate) return 'forbidden';
    if (isSubmitting) return 'loading';
    if (notice !== null && notice.level === 'violation') return 'error';
    if (step === 2 && floorRows.length === 0) return 'empty';
    if (problems.name !== null || floorStack.collision !== null || hasAnyRowProblem) return 'partial';
    return 'success';
  }, [
    isCompact,
    canCreate,
    isSubmitting,
    notice,
    step,
    floorRows.length,
    problems.name,
    floorStack.collision,
    hasAnyRowProblem,
  ]);

  const floorRowModels: readonly CreateProjectFloorRowModel[] = floorRows.map((row) => ({
    id: row.id,
    name: row.name,
    kind: row.kind,
    clearHeightM: row.clearHeightM,
    elevationLabel: floorStack.elevationLabelById.get(row.id) ?? null,
    problem: floorStack.problemById.get(row.id) ?? null,
  }));

  /** Every mutating action goes through this: it marks the form worth confirming before a close. */
  const markDirty = (): void => {
    setIsDirty(true);
    setIsConfirmingDiscard(false);
  };

  const setName = (value: string): void => {
    markDirty();
    setNameState(value);
    setServerNameProblem(null);
    setNotice(null);
    if (!codeManuallyEdited) {
      setCodeState(generateProjectCode(value));
    }
  };

  const setCode = (value: string): void => {
    markDirty();
    setCodeManuallyEdited(true);
    setCodeState(value);
  };

  const setAddress = (value: string): void => {
    markDirty();
    setAddressState(value);
  };

  const setBuildingType = (value: string): void => {
    markDirty();
    setBuildingTypeState(value);
  };

  const setNotes = (value: string): void => {
    markDirty();
    setNotesState(value);
  };

  const addFloor = (): void => {
    if (!canAddFloor) return;
    markDirty();
    setFloorRows((current) => {
      const aboveCount = current.filter((row) => row.kind === 'floor').length;
      return [...current, { id: createUuid(), name: nextFloorName(aboveCount), kind: 'floor', clearHeightM: null }];
    });
  };

  const removeFloor = (id: string): void => {
    markDirty();
    setFloorRows((current) => current.filter((row) => row.id !== id));
  };

  const setFloorName = (id: string, value: string): void => {
    markDirty();
    setFloorRows((current) => current.map((row) => (row.id === id ? { ...row, name: value } : row)));
  };

  const setFloorHeight = (id: string, valueM: number | undefined): void => {
    markDirty();
    setFloorRows((current) =>
      current.map((row) => (row.id === id ? { ...row, clearHeightM: valueM ?? null } : row)),
    );
  };

  const setApplyHeightM = (valueM: number | undefined): void => {
    setApplyHeightMState(valueM ?? null);
  };

  /** The one place a height is written to every row at once, rather than row by row. */
  const applyHeightToAllFloors = (): void => {
    if (!canApplyHeight || applyHeightM === null) return;
    markDirty();
    setFloorRows((current) => current.map((row) => ({ ...row, clearHeightM: applyHeightM })));
  };

  const setHasBasement = (value: boolean): void => {
    markDirty();
    setFloorRows((current) => {
      const already = current.some((row) => row.kind === 'basement');
      if (value === already) return current;
      if (value) {
        return [{ id: createUuid(), name: 'Tầng hầm', kind: 'basement', clearHeightM: null }, ...current];
      }
      return current.filter((row) => row.kind !== 'basement');
    });
  };

  const goNext = (): void => {
    if (step === 1 && !canGoNextStep1) return;
    if (step === 2 && !canGoNextStep2) return;
    setStep((current) => (current < 3 ? ((current + 1) as 1 | 2 | 3) : current));
  };

  const goBack = (): void => {
    setStep((current) => (current > 1 ? ((current - 1) as 1 | 2 | 3) : current));
  };

  /**
   * Invariant A12: Esc reaches here through `Modal.Root`'s `onClose`. A first
   * Esc on a dirty form only warns — the inline alert `CreateProjectModal.tsx`
   * renders when `isConfirmingDiscard` is true; a second Esc, or the alert's
   * own button (both land here), really closes.
   */
  const requestClose = (): void => {
    if (isSelectOpen) return;
    if (!isDirty) {
      options.onDismiss();
      return;
    }
    if (isConfirmingDiscard) {
      options.onDismiss();
      return;
    }
    setIsConfirmingDiscard(true);
  };

  const confirmDiscard = (): void => {
    options.onDismiss();
  };

  const submit = (): void => {
    if (!canSubmit) return;
    setIsSubmitting(true);
    setNotice(null);

    const request: CreateProjectRequest = {
      name: name.trim(),
      address: address.trim(),
      code: code.trim(),
      buildingType,
      notes: notes.trim(),
      floors: floorStack.plans,
    };

    void gateway.create(request).then((result) => {
      setIsSubmitting(false);

      if (!result.ok) {
        const message = describeCreateFailure(result.error);
        setNotice({ level: 'violation', message });
        setServerNameProblem(message);
        return;
      }

      const created = result.data;
      // Invariant A8: even a freshly created project is undoable — the toast's
      // undo removes exactly what was just made.
      options.onToast?.({
        message: `Đã tạo dự án "${request.name}".`,
        onUndo: () => {
          void gateway.remove(created.id);
        },
      });
      options.onCreated?.(created.id);
      options.onDismiss();
    });
  };

  const model: CreateProjectModel = {
    state,
    isCompact,
    canCreate,
    step,
    stepLabel: `bước ${String(step)} / 3`,
    isSubmitting,
    isConfirmingDiscard,
    isSelectOpen,
    name,
    address,
    code,
    buildingType,
    notes,
    buildingTypeOptions: BUILDING_TYPE_OPTIONS,
    problems,
    notice,
    floorRows: floorRowModels,
    hasBasement: floorRows.some((row) => row.kind === 'basement'),
    collision: floorStack.collision,
    collisionRowId: floorStack.collisionRowId,
    focusFloorId,
    canAddFloor,
    applyHeightM,
    canApplyHeight,
    canGoNext,
    canSubmit,
  };

  const actions: CreateProjectActions = {
    setName,
    setAddress,
    setCode,
    setBuildingType,
    setNotes,
    setSelectOpen: setIsSelectOpen,
    setHasBasement,
    addFloor,
    removeFloor,
    setFloorName,
    setFloorHeight,
    setApplyHeightM,
    applyHeightToAllFloors,
    focusFloor: (id: string) => setFocusFloorId(id),
    acknowledgeFocus: () => setFocusFloorId(null),
    goNext,
    goBack,
    requestClose,
    confirmDiscard,
    submit,
  };

  return { model, actions };
}
