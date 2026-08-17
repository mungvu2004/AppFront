/**
 * The structure of the printed QC dossier.
 *
 * Engineers still file paper. The PDF this schema describes is read at a desk,
 * without the app open beside it, so every page has to stand on its own: the
 * cover states what the dossier is about, the tables carry finished readings,
 * and the footer of every page says where the reader is and which version of
 * the data they are looking at.
 *
 * This module declares **structure only**. It holds no logic, builds no rows
 * and formats no numbers — that is `./exportPdf`'s job — and it names no
 * colour. A row may carry a {@link ViewStatusCode}, the same four codes the
 * screens use, and how a renderer marks them on paper is its own decision.
 * A dossier printed in grey ink must still read correctly, which also rules
 * out gradients and large colour fills by construction: there is nothing in
 * the schema a renderer could paint one with.
 *
 * ## The font
 *
 * Every string in the dossier is Vietnamese, and Vietnamese stacks two marks
 * on one letter (ệ, ở, ữ). A PDF that borrows whatever font the viewer has
 * turns those into boxes on the one machine the dossier was filed from, so
 * {@link PDF_FONT} names a family with complete Vietnamese coverage and
 * demands embedding: the file must carry its own glyphs, wherever it is
 * opened or printed.
 */

import type { ViewStatusCode } from '@/lib/viewmodel/types';

/* -------------------------------------------------------------------------- */
/* Sections a dossier can include.                                             */
/* -------------------------------------------------------------------------- */

/**
 * The selectable sections, in the order they appear in the dossier.
 *
 * The cover is not in this list on purpose: a dossier without a cover has no
 * project name, no preparer and no date, so the cover is always included and
 * only these four are offered as choices.
 */
export const PDF_SECTION_KINDS = ['levelSummary', 'roomAreas', 'violations', 'attachments'] as const;

/** One of the selectable sections. */
export type PdfSectionKind = (typeof PDF_SECTION_KINDS)[number];

/** What the selection UI calls each section. Lower case, sentence style (A6). */
export const PDF_SECTION_LABELS: Readonly<Record<PdfSectionKind, string>> = {
  levelSummary: 'bảng tổng hợp tầng',
  roomAreas: 'bảng phòng và diện tích',
  violations: 'bảng vi phạm',
  attachments: 'ảnh 3D đính kèm',
};

/* -------------------------------------------------------------------------- */
/* The font.                                                                   */
/* -------------------------------------------------------------------------- */

/** What the renderer must know about type before it draws a single glyph. */
export interface PdfFontSpec {
  /** The family every page is set in. Must cover Vietnamese completely. */
  readonly family: string;
  /** Tried in order when the family cannot be loaded. Same coverage demand. */
  readonly fallbacks: readonly string[];
  /**
   * Whether the font file must travel inside the PDF. Always `true` here:
   * a filed dossier is opened on machines nobody controls, and a missing
   * glyph on paper is a wrong dossier, not a cosmetic fault.
   */
  readonly mustEmbed: boolean;
}

/**
 * The one font specification every dossier uses.
 *
 * Noto Sans is chosen for its complete Vietnamese block — every base letter
 * with every tone mark, đ and Đ included — and for having permissively
 * licensed files that may legally be embedded. The fallbacks hold the same
 * coverage, so a fallback never silently loses a diacritic.
 */
export const PDF_FONT: PdfFontSpec = {
  family: 'Noto Sans',
  fallbacks: ['Be Vietnam Pro', 'DejaVu Sans'],
  mustEmbed: true,
};

/* -------------------------------------------------------------------------- */
/* Building blocks.                                                            */
/* -------------------------------------------------------------------------- */

/** How a column's cells line up. Numbers right, words left. */
export type PdfCellAlignment = 'left' | 'right';

/** One column of a table: a stable key, a printed heading, an alignment. */
export interface PdfTableColumn {
  readonly key: string;
  /** Vietnamese, printed as the column heading. */
  readonly label: string;
  readonly alignment: PdfCellAlignment;
}

/**
 * One row of a table.
 *
 * Every cell is finished text — Vietnamese notation, unit attached, or the
 * missing-value dash. A renderer never receives a number, so it has nothing
 * left to round or localise, which is the same bargain the screens make.
 */
export interface PdfTableRow {
  /** Stable key, usually the entity id the row is about. */
  readonly id: string;
  /** In {@link PdfTableColumn} order. Always strings, never numbers. */
  readonly cells: readonly string[];
  /** For the renderer's marginal mark. A code, never a colour. */
  readonly statusCode?: ViewStatusCode;
}

/** A labelled reading on the cover or under a table: `Tổng diện tích — 248,60 m²`. */
export interface PdfLabelledText {
  readonly label: string;
  /** Finished text, already formatted. */
  readonly text: string;
}

/** Printed at the foot of every page: where the reader is, and of what data. */
export interface PdfFooter {
  /** `Trang 3/5`. */
  readonly pageText: string;
  /** `Phiên bản dữ liệu r128` — which snapshot the whole dossier was built from. */
  readonly versionText: string;
}

/* -------------------------------------------------------------------------- */
/* The pages.                                                                  */
/* -------------------------------------------------------------------------- */

/** The cover: what this dossier is, of which project, by whom, from which data. */
export interface PdfCoverPage {
  readonly kind: 'cover';
  readonly title: string;
  /** The project name, printed as the headline under the title. */
  readonly projectNameText: string;
  /** Address, date, preparer, data version, totals — each already written out. */
  readonly fields: readonly PdfLabelledText[];
  /** The preparer's free-text note, when one was given. */
  readonly preparerNoteText?: string;
  readonly footer: PdfFooter;
}

/** One row per level, then one for the building-wide findings when any exist. */
export interface PdfLevelSummaryPage {
  readonly kind: 'levelSummary';
  readonly title: string;
  readonly columns: readonly PdfTableColumn[];
  readonly rows: readonly PdfTableRow[];
  readonly footer: PdfFooter;
}

/** Every room with its area, closed by the building's own total. */
export interface PdfRoomAreasPage {
  readonly kind: 'roomAreas';
  readonly title: string;
  readonly columns: readonly PdfTableColumn[];
  readonly rows: readonly PdfTableRow[];
  /** The stored gross floor area — never a sum recomputed from the rows. */
  readonly totalArea: PdfLabelledText;
  readonly footer: PdfFooter;
}

/** Every finding, worst first, exactly as the QC screens word them. */
export interface PdfViolationsPage {
  readonly kind: 'violations';
  readonly title: string;
  readonly columns: readonly PdfTableColumn[];
  readonly rows: readonly PdfTableRow[];
  /** Printed instead of the table when there is nothing to list. */
  readonly emptyText?: string;
  readonly footer: PdfFooter;
}

/** One captioned 3D snapshot, handed in by the caller — never rendered here. */
export interface PdfAttachmentImage {
  readonly id: string;
  readonly title: string;
  readonly captionText: string;
  /** A `data:image/png;base64,…` URL, self-contained like everything else. */
  readonly pngDataUrl: string;
}

/** The attached 3D views. Only present when there is at least one image. */
export interface PdfAttachmentsPage {
  readonly kind: 'attachments';
  readonly title: string;
  readonly images: readonly PdfAttachmentImage[];
  readonly footer: PdfFooter;
}

/** Any page of the dossier, tagged so a renderer can switch on `kind`. */
export type PdfPage =
  | PdfCoverPage
  | PdfLevelSummaryPage
  | PdfRoomAreasPage
  | PdfViolationsPage
  | PdfAttachmentsPage;

/** The whole dossier: the font contract, and the pages in reading order. */
export interface PdfDocument {
  readonly font: PdfFontSpec;
  readonly pages: readonly PdfPage[];
}

/* -------------------------------------------------------------------------- */
/* The columns of the three tables.                                            */
/* -------------------------------------------------------------------------- */

/** Tầng · Tường · Phòng · Ô mở · Vi phạm · Điểm chất lượng. */
export const LEVEL_SUMMARY_COLUMNS: readonly PdfTableColumn[] = [
  { key: 'levelName', label: 'Tầng', alignment: 'left' },
  { key: 'wallCount', label: 'Tường', alignment: 'right' },
  { key: 'roomCount', label: 'Phòng', alignment: 'right' },
  { key: 'openingCount', label: 'Ô mở', alignment: 'right' },
  { key: 'violationCount', label: 'Vi phạm', alignment: 'right' },
  { key: 'healthScore', label: 'Điểm chất lượng', alignment: 'right' },
];

/** Phòng · Tầng · Công năng · Diện tích. */
export const ROOM_AREAS_COLUMNS: readonly PdfTableColumn[] = [
  { key: 'roomName', label: 'Phòng', alignment: 'left' },
  { key: 'levelName', label: 'Tầng', alignment: 'left' },
  { key: 'usage', label: 'Công năng', alignment: 'left' },
  { key: 'area', label: 'Diện tích', alignment: 'right' },
];

/** Mã luật · Mức độ · Đối tượng · Tầng · Mô tả · Đề xuất. */
export const VIOLATIONS_COLUMNS: readonly PdfTableColumn[] = [
  { key: 'ruleCode', label: 'Mã luật', alignment: 'left' },
  { key: 'severity', label: 'Mức độ', alignment: 'left' },
  { key: 'entityId', label: 'Đối tượng', alignment: 'left' },
  { key: 'levelName', label: 'Tầng', alignment: 'left' },
  { key: 'message', label: 'Mô tả', alignment: 'left' },
  { key: 'suggestion', label: 'Đề xuất', alignment: 'left' },
];
