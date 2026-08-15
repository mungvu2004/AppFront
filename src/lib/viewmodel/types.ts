/**
 * What a view is allowed to know about the model: nothing.
 *
 * A component in `src/components` or `src/screens` never receives a `Wall`, an
 * `Opening`, a `Room` or a `Violation`. It receives a {@link ViewModel} — six
 * fields, every one of them a string or a list of strings — and its only job is
 * to place them. That boundary buys three things the design rules ask for and
 * that no amount of care inside a component can guarantee:
 *
 * - **No number reaches a view unformatted.** Every reading is already written
 *   in Vietnamese notation by `src/lib/format`, so a component has nothing left
 *   to round, divide or localise. `local/no-raw-number` enforces the other half
 *   of that bargain by refusing `toFixed`, `toLocaleString` and unit division
 *   inside the two view folders.
 * - **No colour is decided outside the token layer.** {@link ViewModel.statusCode}
 *   is one of four codes and never a class, a token name or a hex value. Which
 *   token a code maps to is the view's decision, and it is the only layer that
 *   can honour invariant A5 — the verified green marks human approval, never an
 *   AI score.
 * - **A view is testable from props alone**, which is what invariant D asks for.
 *   A `ViewModel` is a plain object, so a story or a test writes one by hand.
 *
 * The shape is deliberately the same for all four kinds. A list mixing walls,
 * openings, rooms and violations renders through one component, and a new kind
 * costs a builder in `./toViewModel` rather than a new card.
 *
 * ## Field names
 *
 * The brief for this module names the six fields in Vietnamese — `ma`, `nhan`,
 * `dongPhu`, `cacThuocTinh`, `maTrangThai`, `maBieuTuong`, and `{ nhan, giaTri,
 * donVi }` for one attribute. Invariants B and E.11 of `CLAUDE.md` forbid
 * Vietnamese identifiers for fields and types, and `CLAUDE.md` wins, so the same
 * six fields carry English names:
 *
 * | Brief          | Here             |
 * |----------------|------------------|
 * | `ma`           | `id`             |
 * | `nhan`         | `label`          |
 * | `dongPhu`      | `secondaryLine`  |
 * | `cacThuocTinh` | `attributes`     |
 * | `maTrangThai`  | `statusCode`     |
 * | `maBieuTuong`  | `iconCode`       |
 * | `giaTri`       | `value`          |
 * | `donVi`        | `unit`           |
 *
 * Only the identifiers are English. Every string a person reads is Vietnamese,
 * lower case and sentence style, as invariant A6 requires.
 */

import type { Opening, Room, Wall } from '@/domain/spatial/types';
import type { Violation } from '@/domain/rules/registry';

/* -------------------------------------------------------------------------- */
/* Codes a view maps to tokens.                                                */
/* -------------------------------------------------------------------------- */

/**
 * How a row asks to be coloured, without naming a colour.
 *
 * The first three are the three state colours of invariant A4 and nothing else
 * is allowed to exist. `neutral` is the absence of a state, for a row that is
 * neither approved nor asking for anything — it maps to the ordinary text token,
 * not to a fourth state colour.
 */
export const VIEW_STATUS_CODES = ['verified', 'attention', 'violation', 'neutral'] as const;

/** One of the four status codes. Never a class, a token name or a hex value. */
export type ViewStatusCode = (typeof VIEW_STATUS_CODES)[number];

/**
 * Which glyph belongs beside a row.
 *
 * A closed union rather than a free string, so the view's icon table is a
 * complete `Record` and adding a kind fails the build instead of rendering a
 * blank square. The codes name what the row *is*, never what it looks like.
 */
export const VIEW_ICON_CODES = [
  'wallLoadBearing',
  'wallPartition',
  'wallEnvelope',
  'openingDoor',
  'openingWindow',
  'room',
  'violationCritical',
  'violationWarning',
  'violationSuggestion',
] as const;

/** One of the icon codes. */
export type ViewIconCode = (typeof VIEW_ICON_CODES)[number];

/* -------------------------------------------------------------------------- */
/* The models.                                                                 */
/* -------------------------------------------------------------------------- */

/**
 * One labelled reading, already written out.
 *
 * `value` is finished text: `"3.450"`, `"248,60"`, `"—"`. It is never a number
 * and never carries its unit, because the unit is {@link ViewAttribute.unit} and
 * a view that shows both would print it twice.
 *
 * `unit` is absent — not `undefined`, absent — when there is nothing to write
 * after the value. That covers two cases: a reading with no unit at all, such as
 * a count or a rule code, and a reading that is missing, where `value` is the
 * placeholder dash and `"— mm"` would read as a measurement.
 */
export interface ViewAttribute {
  /** Vietnamese, lower case, sentence style. */
  readonly label: string;
  /** The reading, already formatted. Always a string; never carries the unit. */
  readonly value: string;
  /** The symbol written after the value: `mm`, `m`, `m²`, `%`. */
  readonly unit?: string;
}

/**
 * Everything a view needs to draw one thing, and nothing else.
 *
 * The same six fields describe a wall, an opening, a room and a violation. See
 * the module docblock for how they map onto the names used in the brief.
 */
export interface ViewModel {
  /** Stable key: the entity code, or `RULE-CODE:entityId` for a violation. */
  readonly id: string;
  /** The headline. Sentence style — a code inside it stays upper case (A6). */
  readonly label: string;
  /** The supporting fragment under the headline. Lower case. */
  readonly secondaryLine: string;
  /** The readings, in the order they are shown. */
  readonly attributes: readonly ViewAttribute[];
  readonly statusCode: ViewStatusCode;
  readonly iconCode: ViewIconCode;
}

/* -------------------------------------------------------------------------- */
/* What goes in.                                                               */
/* -------------------------------------------------------------------------- */

/**
 * The four things `toViewModel` converts, tagged so one call site can handle a
 * mixed list.
 *
 * The domain types are imported for their shape only; the import is erased at
 * build time, so this module stays free of any runtime dependency on the graph.
 */
export type ViewModelInput =
  | { readonly kind: 'wall'; readonly wall: Wall }
  | { readonly kind: 'opening'; readonly opening: Opening }
  | { readonly kind: 'room'; readonly room: Room }
  | { readonly kind: 'violation'; readonly violation: Violation };

/** The tag of one {@link ViewModelInput}. */
export type ViewModelKind = ViewModelInput['kind'];
