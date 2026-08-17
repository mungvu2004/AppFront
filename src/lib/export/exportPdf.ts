/**
 * Building the data of the printed QC dossier.
 *
 * Everything here returns **finished display text** arranged into the pages of
 * `./pdfSchema`; nothing draws, nothing lays out, and nothing touches a PDF
 * library. A renderer downstream receives strings and places them, which is
 * the same division of labour the screens live by — and it is what makes this
 * module testable without a PDF in sight.
 *
 * Two promises shape every builder:
 *
 * - **No figure is computed here.** Areas come from the fields the graph
 *   stores, scores and per-level groupings come from `@/domain/rules`'
 *   canonical functions, and the wording of a room or a violation comes from
 *   the same view models the QC screens render. The dossier can therefore
 *   never disagree with the screen it was exported from: they read the one
 *   source. The only arithmetic left is counting list lengths and numbering
 *   pages.
 * - **Every string is already formatted.** Numbers go through `@/lib/format`
 *   (comma decimals, dot grouping, the em-dash for a missing value), dates
 *   through `formatCalendarDate`, and readings split into value + unit are
 *   rejoined exactly the way the canonical formatter writes them. A raw
 *   `248.6` cannot reach a page, and the test file walks the whole document
 *   to prove it.
 *
 * The pages themselves — which sections are included, who prepared the
 * dossier, and the page-number / data-version footer on every page — are
 * assembled by {@link buildPdfDocument}. The cover is always present; the
 * four content sections are chosen by the caller and always appear in schema
 * order, whatever order they were asked for in.
 */

import {
  explainHealthScore,
  groupViolationsByLevel,
  HEALTH_SCORE_MAX,
  sortBySeverity,
  type LevelViolationGroup,
} from '@/domain/rules/healthScore';
import type { Violation } from '@/domain/rules/registry';
import type { Level, LevelId, SpatialGraph } from '@/domain/spatial/types';
import { formatCalendarDate, type TimeInput } from '@/lib/format/datetime';
import { formatArea } from '@/lib/format/measure';
import { formatNumber, MISSING_VALUE } from '@/lib/format/number';
import { toRoomViewModel, toViolationViewModel } from '@/lib/viewmodel/toViewModel';
import type { ViewModel } from '@/lib/viewmodel/types';

import {
  LEVEL_SUMMARY_COLUMNS,
  PDF_FONT,
  PDF_SECTION_KINDS,
  PDF_SECTION_LABELS,
  ROOM_AREAS_COLUMNS,
  VIOLATIONS_COLUMNS,
  type PdfAttachmentImage,
  type PdfAttachmentsPage,
  type PdfCoverPage,
  type PdfDocument,
  type PdfFooter,
  type PdfLabelledText,
  type PdfLevelSummaryPage,
  type PdfPage,
  type PdfRoomAreasPage,
  type PdfSectionKind,
  type PdfTableRow,
  type PdfViolationsPage,
} from './pdfSchema';

/* -------------------------------------------------------------------------- */
/* Input.                                                                      */
/* -------------------------------------------------------------------------- */

/** Who signs the dossier, and what they wanted noted on it. */
export interface PdfPreparer {
  readonly name: string;
  /** Free text printed on the cover. Left off entirely when empty. */
  readonly note?: string;
}

/** One 3D snapshot the caller already captured. This module never renders one. */
export interface PdfAttachmentInput {
  readonly id: string;
  readonly title: string;
  /** Falls back to the title, so no image prints uncaptioned. */
  readonly captionText?: string;
  /** A `data:image/png;base64,…` URL. */
  readonly pngDataUrl: string;
}

/** Everything a dossier is built from. All of it is read; none of it is changed. */
export interface ExportPdfInput {
  readonly graph: SpatialGraph;
  /** The findings of the last rule run — handed in, never re-run here. */
  readonly violations: readonly Violation[];
  /** Stamped into every footer, so a page separated from the pile still dates itself. */
  readonly dataVersion: string;
  /** When the dossier was drawn up. Passed in, never read from the clock. */
  readonly exportedAt: TimeInput;
  readonly preparer: PdfPreparer;
  /**
   * Which content sections to include. Defaults to all of them; order is
   * ignored — the dossier always reads in {@link PDF_SECTION_KINDS} order.
   */
  readonly sections?: readonly PdfSectionKind[];
  readonly attachments?: readonly PdfAttachmentInput[];
  /** IANA zone the cover date is written in. Tests should always name one. */
  readonly timeZone?: string;
}

/* -------------------------------------------------------------------------- */
/* Fixed wording.                                                              */
/* -------------------------------------------------------------------------- */

/** The dossier's title, printed once on the cover. */
export const PDF_COVER_TITLE = 'Hồ sơ kiểm tra bản vẽ mặt bằng';

/** Names the group of findings that belong to no single level. */
export const BUILDING_SCOPE_LABEL = 'Toàn công trình';

/** Printed in place of the violations table when the model is clean. */
export const NO_VIOLATIONS_TEXT = 'Không ghi nhận vi phạm nào.';

/** Counts and scores are whole numbers; nothing here shows a decimal count. */
const COUNT_FRACTION_DIGITS = 0;

/* -------------------------------------------------------------------------- */
/* Small helpers every page shares.                                            */
/* -------------------------------------------------------------------------- */

/** Free text, or the dash when there is nothing usable to print. */
function textOrMissing(text: string | null | undefined): string {
  const trimmed = text?.trim() ?? '';

  return trimmed === '' ? MISSING_VALUE : trimmed;
}

/** A count or a score, written whole in Vietnamese notation. */
function countText(value: number): string {
  return formatNumber(value, { fractionDigits: COUNT_FRACTION_DIGITS });
}

/**
 * One reading of a view model, rejoined into the string the canonical
 * formatter writes: the value, a space, the unit — or the value alone when
 * the reading has no unit, which includes the missing-value dash.
 */
function attributeText(model: ViewModel, label: string): string {
  const attribute = model.attributes.find((entry) => entry.label === label);

  if (attribute === undefined) {
    return MISSING_VALUE;
  }

  return attribute.unit === undefined ? attribute.value : `${attribute.value} ${attribute.unit}`;
}

/**
 * The printed name of a level.
 *
 * On paper an id like `L-LEVEL000002` sends the reader back to the software
 * the dossier exists to replace, so levels print by name. `null` is the
 * building-wide scope, which is a real place and must not read as unknown;
 * only an id the graph cannot resolve earns the dash.
 */
function levelNameOf(levels: readonly Level[], levelId: LevelId | null): string {
  if (levelId === null) {
    return BUILDING_SCOPE_LABEL;
  }

  const level = levels.find((candidate) => candidate.id === levelId);

  return level === undefined ? MISSING_VALUE : textOrMissing(level.name);
}

/** The section label, capitalised into a page title: `Bảng tổng hợp tầng`. */
function sectionTitle(kind: PdfSectionKind): string {
  const label = PDF_SECTION_LABELS[kind];
  const first = label[0];

  return first === undefined ? label : `${first.toUpperCase()}${label.slice(1)}`;
}

/** How many items fall on each level, for lists that carry a level id. */
function tallyByLevel<T>(
  items: readonly T[],
  levelOf: (item: T) => LevelId | undefined,
): ReadonlyMap<LevelId, number> {
  const counts = new Map<LevelId, number>();

  for (const item of items) {
    const levelId = levelOf(item);

    if (levelId !== undefined) {
      counts.set(levelId, (counts.get(levelId) ?? 0) + 1);
    }
  }

  return counts;
}

/* -------------------------------------------------------------------------- */
/* The footer.                                                                 */
/* -------------------------------------------------------------------------- */

/**
 * The foot of one page: `Trang 3/5` and the data version.
 *
 * Grouping is off because a page number is an identifier, not a magnitude —
 * a five-figure dossier would still not write `Trang 1.024`.
 */
export function buildPdfFooter(pageNumber: number, pageCount: number, dataVersion: string): PdfFooter {
  const pageLabel = (value: number): string =>
    formatNumber(value, { fractionDigits: COUNT_FRACTION_DIGITS, grouping: false });

  return {
    pageText: `Trang ${pageLabel(pageNumber)}/${pageLabel(pageCount)}`,
    versionText: `Phiên bản dữ liệu ${textOrMissing(dataVersion)}`,
  };
}

/* -------------------------------------------------------------------------- */
/* The five page builders.                                                     */
/* -------------------------------------------------------------------------- */

/**
 * The cover: project, address, date, preparer, data version, and the three
 * headline figures — stored total area, health score, violation count.
 *
 * The score and its total come from `explainHealthScore`, the same function
 * every report screen reads; the area is the building's stored gross floor
 * area, never a sum over the room rows.
 */
export function buildCoverPage(input: ExportPdfInput, footer: PdfFooter): PdfCoverPage {
  const { building } = input.graph;
  const health = explainHealthScore(input.violations);
  const note = input.preparer.note?.trim() ?? '';

  const fields: PdfLabelledText[] = [
    { label: 'Địa chỉ', text: textOrMissing(building.address) },
    {
      label: 'Ngày lập',
      text: formatCalendarDate(
        input.exportedAt,
        input.timeZone === undefined ? {} : { timeZone: input.timeZone },
      ),
    },
    { label: 'Người lập', text: textOrMissing(input.preparer.name) },
    { label: 'Phiên bản dữ liệu', text: textOrMissing(input.dataVersion) },
    { label: 'Tổng diện tích', text: formatArea(building.grossFloorAreaM2) },
    { label: 'Điểm chất lượng', text: `${countText(health.score)}/${countText(HEALTH_SCORE_MAX)}` },
    { label: 'Tổng vi phạm', text: countText(health.total) },
  ];

  return {
    kind: 'cover',
    title: PDF_COVER_TITLE,
    projectNameText: textOrMissing(building.name),
    fields,
    ...(note === '' ? {} : { preparerNoteText: note }),
    footer,
  };
}

/**
 * One row per level, bottom level first, and a closing row for the
 * building-wide findings whenever any exist.
 *
 * The counts are list lengths; the per-level violation counts and scores come
 * from `groupViolationsByLevel`, whose grouping and scoring are the canonical
 * ones. A level with no findings scores the full {@link HEALTH_SCORE_MAX} —
 * the same answer the scorer gives an empty list. The building row leaves the
 * entity counts as dashes: every wall, room and opening belongs to a level,
 * so a building-wide count would double what the level rows already say.
 */
export function buildLevelSummaryPage(
  graph: SpatialGraph,
  violations: readonly Violation[],
  footer: PdfFooter,
): PdfLevelSummaryPage {
  const groupByLevel = new Map<LevelId | null, LevelViolationGroup>(
    groupViolationsByLevel(violations).map((group) => [group.levelId, group] as const),
  );

  const wallCounts = tallyByLevel(graph.walls, (wall) => wall.levelId);
  const roomCounts = tallyByLevel(graph.rooms, (room) => room.levelId);

  const levelOfWall = new Map(graph.walls.map((wall) => [wall.id, wall.levelId] as const));
  const openingCounts = tallyByLevel(graph.openings, (opening) => levelOfWall.get(opening.wallId));

  const orderedLevels = [...graph.levels].sort((first, second) => first.order - second.order);

  const rows: PdfTableRow[] = orderedLevels.map((level) => {
    const group = groupByLevel.get(level.id);

    return {
      id: level.id,
      cells: [
        textOrMissing(level.name),
        countText(wallCounts.get(level.id) ?? 0),
        countText(roomCounts.get(level.id) ?? 0),
        countText(openingCounts.get(level.id) ?? 0),
        countText(group?.violations.length ?? 0),
        countText(group?.score ?? HEALTH_SCORE_MAX),
      ],
    };
  });

  const buildingGroup = groupByLevel.get(null);

  if (buildingGroup !== undefined) {
    rows.push({
      id: 'building',
      cells: [
        BUILDING_SCOPE_LABEL,
        MISSING_VALUE,
        MISSING_VALUE,
        MISSING_VALUE,
        countText(buildingGroup.violations.length),
        countText(buildingGroup.score),
      ],
    });
  }

  return {
    kind: 'levelSummary',
    title: sectionTitle('levelSummary'),
    columns: LEVEL_SUMMARY_COLUMNS,
    rows,
    footer,
  };
}

/**
 * Every room with its area, in the order the graph lists them, closed by the
 * building's stored gross floor area.
 *
 * Each row is read off `toRoomViewModel` — the exact card the QC screens
 * draw — so the printed name, usage and area can never drift from the screen.
 * The area cell rejoins the model's value and unit, which the view-model
 * tests pin to the canonical `formatArea` output.
 */
export function buildRoomAreasPage(graph: SpatialGraph, footer: PdfFooter): PdfRoomAreasPage {
  const rows: PdfTableRow[] = graph.rooms.map((room) => {
    const model = toRoomViewModel(room);

    return {
      id: model.id,
      cells: [
        model.label,
        levelNameOf(graph.levels, room.levelId),
        model.secondaryLine,
        attributeText(model, 'Diện tích'),
      ],
      statusCode: model.statusCode,
    };
  });

  return {
    kind: 'roomAreas',
    title: sectionTitle('roomAreas'),
    columns: ROOM_AREAS_COLUMNS,
    rows,
    totalArea: { label: 'Tổng diện tích', text: formatArea(graph.building.grossFloorAreaM2) },
    footer,
  };
}

/**
 * Every finding, worst first, worded exactly as the QC screens word it.
 *
 * `sortBySeverity` supplies the canonical stable order, and each row is read
 * off `toViolationViewModel`: the code, the severity label, the entity, then
 * the message and the suggestion — what is wrong, then what to do, in the
 * order a reviewer reads them. Only the level cell is built here, because
 * paper wants the level's name where the screen can afford the id.
 */
export function buildViolationsPage(
  graph: SpatialGraph,
  violations: readonly Violation[],
  footer: PdfFooter,
): PdfViolationsPage {
  const rows: PdfTableRow[] = sortBySeverity(violations).map((violation) => {
    const model = toViolationViewModel(violation);

    return {
      id: model.id,
      cells: [
        attributeText(model, 'Mã luật'),
        attributeText(model, 'Mức độ'),
        attributeText(model, 'Đối tượng'),
        levelNameOf(graph.levels, violation.levelId),
        model.label,
        model.secondaryLine,
      ],
      statusCode: model.statusCode,
    };
  });

  return {
    kind: 'violations',
    title: sectionTitle('violations'),
    columns: VIOLATIONS_COLUMNS,
    rows,
    ...(rows.length === 0 ? { emptyText: NO_VIOLATIONS_TEXT } : {}),
    footer,
  };
}

/**
 * The attached 3D snapshots, passed through untouched except for captioning:
 * an image whose caption was left blank prints under its title, because an
 * unlabelled figure in a filed dossier answers no question.
 */
export function buildAttachmentsPage(
  attachments: readonly PdfAttachmentInput[],
  footer: PdfFooter,
): PdfAttachmentsPage {
  const images: PdfAttachmentImage[] = attachments.map((attachment) => {
    const caption = attachment.captionText?.trim() ?? '';

    return {
      id: attachment.id,
      title: textOrMissing(attachment.title),
      captionText: caption === '' ? textOrMissing(attachment.title) : caption,
      pngDataUrl: attachment.pngDataUrl,
    };
  });

  return {
    kind: 'attachments',
    title: sectionTitle('attachments'),
    images,
    footer,
  };
}

/* -------------------------------------------------------------------------- */
/* The whole dossier.                                                          */
/* -------------------------------------------------------------------------- */

/**
 * Assemble the dossier: the cover, then the chosen sections in schema order,
 * each page footed with its number and the data version.
 *
 * The attachments section is dropped when there is no image to show, even if
 * it was asked for — a page announcing the absence of pictures is not worth
 * the paper. The page count is fixed before any page is built, so every
 * footer states the same total.
 */
export function buildPdfDocument(input: ExportPdfInput): PdfDocument {
  const attachments = input.attachments ?? [];
  const chosen = new Set<PdfSectionKind>(input.sections ?? PDF_SECTION_KINDS);
  const included = PDF_SECTION_KINDS.filter(
    (kind) => chosen.has(kind) && (kind !== 'attachments' || attachments.length > 0),
  );

  const pageCount = included.length + 1;
  const footerAt = (pageNumber: number): PdfFooter =>
    buildPdfFooter(pageNumber, pageCount, input.dataVersion);

  const pages: PdfPage[] = [buildCoverPage(input, footerAt(1))];

  for (const kind of included) {
    const footer = footerAt(pages.length + 1);

    switch (kind) {
      case 'levelSummary':
        pages.push(buildLevelSummaryPage(input.graph, input.violations, footer));
        break;
      case 'roomAreas':
        pages.push(buildRoomAreasPage(input.graph, footer));
        break;
      case 'violations':
        pages.push(buildViolationsPage(input.graph, input.violations, footer));
        break;
      case 'attachments':
        pages.push(buildAttachmentsPage(attachments, footer));
        break;
    }
  }

  return { font: PDF_FONT, pages };
}
