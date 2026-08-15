/**
 * The seven states every screen has to handle, as data a test can render.
 *
 * Invariant A11 says a component handles seven states — rỗng, đang tải, một
 * phần, lỗi, thành công, không có quyền, thu gọn — and the usual way that
 * invariant rots is not that somebody argues with it. It is that each screen
 * invents its own idea of what "một phần" means, tests four of the seven, and
 * the other three are discovered by a user. So the seven live here, once, as a
 * generator: a screen test asks for the scenarios, renders each one, and
 * {@link expectSevenStates} refuses to pass if one is missing.
 *
 * The scenarios are deliberately shaped like a list screen, because most screens
 * in this application are one, but nothing here knows about walls, rooms or
 * violations. A screen with a different shape overrides the fields it cares
 * about rather than writing its own seven.
 *
 * The counts come from the standard sample set of invariant A14 (48 walls, 14
 * openings), so a screenshot taken from these scenarios shows the same figures
 * as the rest of the product.
 *
 * Nothing here imports React. A scenario is a plain object; turning it into a
 * screen is the caller's job.
 */

/** The seven, in the order invariant A11 lists them. */
export const SEVEN_STATES = [
  'empty',
  'loading',
  'partial',
  'error',
  'success',
  'forbidden',
  'collapsed',
] as const;

/** One of the seven states. */
export type SevenState = (typeof SEVEN_STATES)[number];

/** What each state is called in the interface — lower case, sentence style (A6). */
export const SEVEN_STATE_LABELS: Readonly<Record<SevenState, string>> = {
  empty: 'rỗng',
  loading: 'đang tải',
  partial: 'một phần',
  error: 'lỗi',
  success: 'thành công',
  forbidden: 'không có quyền',
  collapsed: 'thu gọn',
};

/** One row of whatever the screen lists. Deliberately the least a row can be. */
export interface SevenStateRow {
  readonly id: string;
  readonly label: string;
}

/**
 * One state of a screen, as the props a test would pass it.
 *
 * Every field is present in every scenario — a screen reading `canView` should
 * not have to guess whether the scenario bothered to set it.
 */
export interface SevenStateScenario {
  readonly state: SevenState;
  /** The Vietnamese name of the state, for a failure message a person can read. */
  readonly label: string;
  /** The rows the screen can show right now. */
  readonly rows: readonly SevenStateRow[];
  /** How many rows exist in total; larger than `rows.length` when partial. */
  readonly totalCount: number;
  readonly isLoading: boolean;
  readonly isCollapsed: boolean;
  /** `false` only in the `forbidden` state. */
  readonly canView: boolean;
  /** Non-null only in the `error` state. */
  readonly error: unknown;
}

/** Rows in the standard sample set: 48 walls on the ground floor (A14). */
const SAMPLE_TOTAL_COUNT = 48;

/** Rows loaded when only part of the list has arrived: 14, the sample opening count. */
const SAMPLE_PARTIAL_COUNT = 14;

/**
 * The failure the `error` scenario carries.
 *
 * A network error rather than a bare `Error`, so `toAppError` classifies it as
 * something retryable and the scenario exercises the retry path a screen is
 * supposed to offer. A screen that only ever sees an unclassifiable error never
 * finds out its retry button is wired to nothing.
 */
const SAMPLE_ERROR_MESSAGE = 'network: fetch failed';

/** Row identifiers read like wall codes, because most lists in this product are walls. */
function defaultRow(index: number): SevenStateRow {
  const code = `W-${String(index + 1).padStart(3, '0')}`;

  return { id: code, label: `Tường ${code}` };
}

export interface SevenStateScenarioOptions {
  /** How many rows a full list holds. Defaults to the sample set's 48. */
  readonly totalCount?: number;
  /** How many rows have arrived in the `partial` state. Defaults to 14. */
  readonly partialCount?: number;
  /** Builds one row. Override to give a screen the row shape it expects. */
  readonly createRow?: (index: number) => SevenStateRow;
  /**
   * Per-state patches, for a screen whose idea of a state needs one more field.
   *
   * A patch cannot remove a state or change which state a scenario is: the
   * generator always returns all seven, in order, which is what makes
   * `expectSevenStates` worth running.
   */
  readonly overrides?: Partial<Record<SevenState, Partial<SevenStateScenario>>>;
}

/**
 * The seven scenarios, in the order of {@link SEVEN_STATES}.
 *
 * @example
 * expectSevenStates(
 *   (scenario) => render(<WallList {...scenario} />),
 *   createSevenStateScenarios(),
 * );
 */
export function createSevenStateScenarios(
  options: SevenStateScenarioOptions = {},
): readonly SevenStateScenario[] {
  const totalCount = options.totalCount ?? SAMPLE_TOTAL_COUNT;
  const partialCount = Math.min(options.partialCount ?? SAMPLE_PARTIAL_COUNT, totalCount);
  const createRow = options.createRow ?? defaultRow;

  const allRows = Array.from({ length: totalCount }, (_unused, index) => createRow(index));
  const someRows = allRows.slice(0, partialCount);

  const base: Readonly<Record<SevenState, Omit<SevenStateScenario, 'state' | 'label'>>> = {
    empty: { rows: [], totalCount: 0, isLoading: false, isCollapsed: false, canView: true, error: null },
    loading: { rows: [], totalCount, isLoading: true, isCollapsed: false, canView: true, error: null },
    partial: {
      rows: someRows,
      totalCount,
      isLoading: false,
      isCollapsed: false,
      canView: true,
      error: null,
    },
    error: {
      rows: [],
      totalCount,
      isLoading: false,
      isCollapsed: false,
      canView: true,
      error: new Error(SAMPLE_ERROR_MESSAGE),
    },
    success: {
      rows: allRows,
      totalCount,
      isLoading: false,
      isCollapsed: false,
      canView: true,
      error: null,
    },
    forbidden: { rows: [], totalCount: 0, isLoading: false, isCollapsed: false, canView: false, error: null },
    collapsed: {
      rows: allRows,
      totalCount,
      isLoading: false,
      isCollapsed: true,
      canView: true,
      error: null,
    },
  };

  return SEVEN_STATES.map((state) => ({
    ...base[state],
    ...options.overrides?.[state],
    // Last, and not overridable: a scenario that lied about which state it is
    // would let a screen pass `expectSevenStates` while covering one state twice.
    state,
    label: SEVEN_STATE_LABELS[state],
  }));
}
