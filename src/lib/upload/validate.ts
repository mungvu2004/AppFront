/**
 * What may be uploaded, and which floor a scan says it belongs to.
 *
 * Two jobs, both answered as **data**. Nothing in this module writes a sentence
 * a person reads: a refusal comes back as a tagged reason carrying the numbers
 * the sentence needs, and the screen turns `{ kind: 'tooLarge', sizeBytes,
 * maxSizeBytes }` into "tệp 128 MB, vượt mức 100 MB". That split is what keeps
 * the limits testable without a DOM and the wording changeable without a test
 * rewrite.
 *
 * ## The limits live here
 *
 * {@link MAX_UPLOAD_FILE_SIZE_BYTES}, {@link MAX_PDF_PAGE_COUNT} and
 * {@link ACCEPTED_UPLOAD_EXTENSIONS} are written down once, in this file. A
 * screen that retypes "100 MB" into a hint has quietly forked the rule.
 *
 * ## The PDF page count is read from the bytes
 *
 * No library and no network call: {@link readPdfPageCount} scans the file for
 * the page tree's `/Count`, and falls back to counting `/Type /Page` objects.
 * It reads the file in windows and keeps a short tail between them, so a token
 * lying across a window boundary is still found and still counted once.
 *
 * It has one honest blind spot. From PDF 1.5 a generator may pack the page
 * objects into compressed object streams, where neither token appears as plain
 * text. Such a file comes back with an **unknown** page count rather than a
 * refusal, because the failure directions are not symmetric: letting a 40-page
 * PDF through costs one server-side 422 that `toAppError` already maps, while
 * refusing a valid 3-page drawing costs the engineer the upload entirely.
 * `unreadable` is therefore reserved for bytes that are not a PDF at all.
 *
 * ## The floor guess is a suggestion
 *
 * {@link guessFloorFromFileName} never throws and is always overridable in the
 * interface. A miss is a normal answer — plenty of scans are named `A-101.pdf`
 * — so it is modelled as `{ ok: false }`, not as an error.
 */

import { bytesToBinaryString, readBlobBytes, sliceIntoChunks } from './chunk';

/**
 * The largest file the upload accepts: 100 MiB.
 *
 * The one and only home of this number; the server answers 413 above it, which
 * `src/lib/errors/toAppError` maps to the `upload` kind.
 */
export const MAX_UPLOAD_FILE_SIZE_BYTES = 100 * 1024 * 1024;

/** The most pages a PDF drawing may carry. The one and only home of this number. */
export const MAX_PDF_PAGE_COUNT = 20;

/** The formats the upload accepts. The one and only home of this list. */
export const ACCEPTED_UPLOAD_EXTENSIONS = ['.png', '.jpg', '.pdf', '.dwg'] as const;

/** One of {@link ACCEPTED_UPLOAD_EXTENSIONS}. */
export type AcceptedUploadExtension = (typeof ACCEPTED_UPLOAD_EXTENSIONS)[number];

/**
 * Which pipeline a file takes once it is uploaded.
 *
 * The screen reads this to show the "Nhánh CAD" pill instead of sniffing the
 * extension a second time.
 */
export type UploadBranch = 'cad' | 'pdf' | 'raster';

/** Why a file was refused. Each case carries what a sentence about it needs. */
export type UploadRejection =
  | {
      readonly kind: 'tooLarge';
      readonly sizeBytes: number;
      readonly maxSizeBytes: number;
    }
  | {
      readonly kind: 'unsupportedFormat';
      readonly extension: string;
      readonly acceptedExtensions: readonly AcceptedUploadExtension[];
    }
  | {
      readonly kind: 'tooManyPages';
      readonly pageCount: number;
      readonly maxPageCount: number;
    }
  | {
      readonly kind: 'unreadable';
      readonly extension: string;
    };

/** A file the upload will take. */
export interface UploadAccepted {
  readonly ok: true;
  readonly branch: UploadBranch;
  readonly extension: AcceptedUploadExtension;
  readonly sizeBytes: number;
  /** Pages found in a PDF. `undefined` for other formats and for the blind spot above. */
  readonly pageCount?: number;
}

/** A file the upload refuses, and the reason as data. */
export interface UploadRejected {
  readonly ok: false;
  readonly reason: UploadRejection;
}

/** The answer {@link validateUploadFile} gives. */
export type UploadValidation = UploadAccepted | UploadRejected;

/**
 * The least a candidate has to be: a name, a size, and sliceable bytes.
 *
 * `File` satisfies it. Naming the shape rather than demanding `File` is what
 * lets a test hand in three bytes without building one.
 */
export interface UploadCandidate {
  readonly name: string;
  readonly size: number;
  slice: (start?: number, end?: number) => Blob;
}

/** How sure {@link guessFloorFromFileName} is. */
export type FloorGuessConfidence = 'high' | 'medium' | 'low';

/** A floor read out of a file name. */
export interface FloorGuessHit {
  readonly ok: true;
  /** Ground is `0`, upper floors positive, basements negative. */
  readonly level: number;
  readonly confidence: FloorGuessConfidence;
  /** The part of the normalised name that produced the guess, for a tooltip. */
  readonly matchedText: string;
}

/** No floor could be read. A normal answer, not a failure. */
export interface FloorGuessMiss {
  readonly ok: false;
}

/** The answer {@link guessFloorFromFileName} gives. */
export type FloorGuess = FloorGuessHit | FloorGuessMiss;

/** Which branch each accepted extension takes. */
const BRANCH_BY_EXTENSION = {
  '.dwg': 'cad',
  '.jpg': 'raster',
  '.pdf': 'pdf',
  '.png': 'raster',
} as const satisfies Record<AcceptedUploadExtension, UploadBranch>;

/** Bytes read per pass when scanning a PDF for its page count. */
const PDF_SCAN_WINDOW_BYTES = 256 * 1024;

/**
 * Bytes carried over between scan windows.
 *
 * Long enough for the widest token this scan looks for — a `/Type` and a
 * `/Page` with whitespace between them, or a `/Count` and its digits — so a
 * token split across a window boundary is still matched.
 */
const PDF_SCAN_OVERLAP_BYTES = 64;

/** Every PDF starts with this, within the first kilobyte. */
const PDF_HEADER = '%PDF-';

/** How far into the file the header may sit. Some files carry a junk prefix. */
const PDF_HEADER_SEARCH_BYTES = 1024;

/** A page-tree node's page total: `/Count 12`. */
const PDF_COUNT_TOKEN = /\/Count\s+(\d+)/gu;

/** A leaf page object: `/Type /Page` — but not `/Type /Pages`, its parent. */
const PDF_PAGE_TOKEN = /\/Type\s*\/Page(?![a-zA-Z])/gu;

/**
 * Page or sheet numbers, stripped before any floor is looked for.
 *
 * `trang-3`, `sheet3`, `p3` are positions in a document, not storeys, and a
 * floor guesser that reads them as storeys is worse than one that misses.
 */
const SHEET_NUMBER_TOKEN = /\b(?:trang|sheet|page|pg|p)[\s._-]*\d+/gu;

/** Where a matched token puts the storey relative to grade. */
type FloorSide = 'above' | 'below' | 'ground';

/** A pattern whose first capture group is the storey number, if it has one. */
interface FloorPattern {
  readonly confidence: FloorGuessConfidence;
  readonly pattern: RegExp;
  readonly side: FloorSide;
}

/**
 * The forms a floor is written in, most explicit first — and order is the whole
 * design here.
 *
 * `tang ham`, `basement`, `tret`, `ground`, `tang`, `floor` and `level` name
 * the thing outright, so they are read first and read with confidence. What
 * follows them is progressively more ambiguous and is only reached when no
 * explicit form matched:
 *
 * - `lau` is Vietnamese for the storeys *above* the ground one, so `lầu 2` is
 *   the third storey to some people and the second to others. The number is
 *   taken as written and the confidence drops.
 * - `B1`, `T2`, `L2` are each one letter away from a grid label, a block name
 *   or a drawing revision. `ban-ve-B2-tang-3` is why `B2` is tried *after*
 *   `tang 3` rather than before it.
 *
 * This is also why every hit is overridable in the interface.
 */
const FLOOR_PATTERNS: readonly FloorPattern[] = [
  { confidence: 'high', pattern: /\b(?:tang[\s._-]*)?ham[\s._-]*(\d+)?/u, side: 'below' },
  { confidence: 'high', pattern: /\bbasement[\s._-]*(\d+)?/u, side: 'below' },
  { confidence: 'high', pattern: /\b(?:tang[\s._-]*)?tret\b/u, side: 'ground' },
  { confidence: 'high', pattern: /\bground(?:[\s._-]*floor)?\b/u, side: 'ground' },
  { confidence: 'high', pattern: /\btang[\s._-]*(\d+)/u, side: 'above' },
  { confidence: 'high', pattern: /\bfloor[\s._-]*(\d+)/u, side: 'above' },
  { confidence: 'high', pattern: /\blevel[\s._-]*(\d+)/u, side: 'above' },
  { confidence: 'medium', pattern: /\blau[\s._-]*(\d+)/u, side: 'above' },
  { confidence: 'medium', pattern: /\bfl[\s._-]*(\d+)\b/u, side: 'above' },
  { confidence: 'medium', pattern: /\bb[\s._-]*(\d+)\b/u, side: 'below' },
  { confidence: 'medium', pattern: /\bt[\s._-]*(\d+)\b/u, side: 'above' },
  { confidence: 'medium', pattern: /\bl[\s._-]*(\d+)\b/u, side: 'above' },
];

/**
 * Decide whether a file may be uploaded.
 *
 * The order is size, then format, then — for a PDF only — page count, because
 * each step is cheaper than the next and the last one has to read bytes.
 *
 * @example
 * const check = await validateUploadFile(file);
 * if (!check.ok && check.reason.kind === 'tooLarge') showTooLarge(check.reason);
 */
export async function validateUploadFile(file: UploadCandidate): Promise<UploadValidation> {
  const extension = readExtension(file.name);

  if (file.size > MAX_UPLOAD_FILE_SIZE_BYTES) {
    return {
      ok: false,
      reason: {
        kind: 'tooLarge',
        maxSizeBytes: MAX_UPLOAD_FILE_SIZE_BYTES,
        sizeBytes: file.size,
      },
    };
  }

  if (!isAcceptedExtension(extension)) {
    return {
      ok: false,
      reason: {
        acceptedExtensions: ACCEPTED_UPLOAD_EXTENSIONS,
        extension,
        kind: 'unsupportedFormat',
      },
    };
  }

  const branch = BRANCH_BY_EXTENSION[extension];

  if (branch !== 'pdf') {
    return { branch, extension, ok: true, sizeBytes: file.size };
  }

  const pageCount = await readPdfPageCount(file);

  if (pageCount === null) {
    return { ok: false, reason: { extension, kind: 'unreadable' } };
  }

  if (pageCount > MAX_PDF_PAGE_COUNT) {
    return {
      ok: false,
      reason: { kind: 'tooManyPages', maxPageCount: MAX_PDF_PAGE_COUNT, pageCount },
    };
  }

  return {
    branch,
    extension,
    ok: true,
    ...(pageCount > 0 ? { pageCount } : {}),
    sizeBytes: file.size,
  };
}

/**
 * Count the pages in a PDF by reading its bytes.
 *
 * Returns the page count, `0` when the file is a PDF whose page tree this
 * reader cannot see (see the file comment), or `null` when the bytes are not a
 * PDF at all.
 *
 * @example
 * const pages = await readPdfPageCount(file);   // 3, 0 (unknown) or null (not a PDF)
 */
export async function readPdfPageCount(file: UploadCandidate): Promise<number | null> {
  const windows = sliceIntoChunks(file.slice(0, file.size), PDF_SCAN_WINDOW_BYTES);
  let tail = '';
  let treeCount = 0;
  let pageObjects = 0;
  let sawHeader = false;
  let bytesRead = 0;

  for (const window of windows) {
    const text = tail + bytesToBinaryString(await readBlobBytes(window.blob));

    if (!sawHeader) {
      sawHeader = text.slice(0, PDF_HEADER_SEARCH_BYTES).includes(PDF_HEADER);
      bytesRead += window.byteEnd - window.byteStart;

      if (!sawHeader && bytesRead >= PDF_HEADER_SEARCH_BYTES) {
        return null;
      }
    }

    treeCount = Math.max(treeCount, maxCountToken(text, tail.length));
    pageObjects += countMatches(text, PDF_PAGE_TOKEN, tail.length);
    tail = text.slice(Math.max(0, text.length - PDF_SCAN_OVERLAP_BYTES));
  }

  if (!sawHeader) {
    return null;
  }

  return treeCount > 0 ? treeCount : pageObjects;
}

/**
 * Read a floor out of a scan's file name. Never throws.
 *
 * Handles the forms engineers actually type — `tang-2`, `tang2`, `TẦNG 2`,
 * `T2`, `L2`, `floor 2`, `lau 2`, `tret`, `ground`, `ham`, `basement`, `B1` —
 * and ignores sheet numbers (`trang-3`, `sheet3`, `p3`), which are the trap.
 * The answer is always overridable in the interface, so a miss is normal.
 *
 * @example
 * guessFloorFromFileName('mat-bang-tang-2.pdf')   // { ok: true, level: 2, confidence: 'high', … }
 * guessFloorFromFileName('A-101-trang-3.pdf')     // { ok: false }
 */
export function guessFloorFromFileName(name: string): FloorGuess {
  if (typeof name !== 'string') {
    return { ok: false };
  }

  const searchable = stripDiacritics(dropExtension(name))
    .toLowerCase()
    .replace(/[^a-z0-9]+/gu, '-')
    .replace(SHEET_NUMBER_TOKEN, '-');

  for (const { confidence, pattern, side } of FLOOR_PATTERNS) {
    const found = pattern.exec(searchable);

    if (found === null) {
      continue;
    }

    const level = readLevel(side, found[1]);

    if (level === null) {
      continue;
    }

    return { confidence, level, matchedText: found[0], ok: true };
  }

  return { ok: false };
}

/**
 * The lowercase extension of a file name, dot included.
 *
 * `""` when the name has no dot, which reads as an unsupported format rather
 * than as a crash.
 *
 * @example
 * readExtension('Mặt bằng TẦNG 2.PDF')   // ".pdf"
 */
export function readExtension(name: string): string {
  const lastDot = name.lastIndexOf('.');

  return lastDot < 0 ? '' : name.slice(lastDot).toLowerCase();
}

/**
 * The signed level a matched token stands for.
 *
 * `null` when the token needed a number and did not have one — `T` with no
 * digits is not a floor — so the search moves on to the next pattern instead
 * of inventing a storey. A basement with no number is `B1`, which is what
 * `hầm` on its own means.
 */
function readLevel(side: FloorSide, digits: string | undefined): number | null {
  if (side === 'ground') {
    return 0;
  }

  if (side === 'below') {
    return -Number.parseInt(digits ?? '1', 10);
  }

  return digits === undefined ? null : Number.parseInt(digits, 10);
}

/** Is this one of the four accepted extensions? */
function isAcceptedExtension(extension: string): extension is AcceptedUploadExtension {
  return (ACCEPTED_UPLOAD_EXTENSIONS as readonly string[]).includes(extension);
}

/** The name without its extension, so `tang-2.pdf` does not offer a stray `2`. */
function dropExtension(name: string): string {
  const lastDot = name.lastIndexOf('.');

  return lastDot <= 0 ? name : name.slice(0, lastDot);
}

/**
 * Vietnamese with the marks taken off: `tầng` becomes `tang`.
 *
 * `đ` is not a base letter with a mark, so `normalize('NFD')` leaves it alone
 * and it is replaced by hand.
 */
function stripDiacritics(text: string): string {
  return text
    .normalize('NFD')
    .replace(/[̀-ͯ]/gu, '')
    .replace(/[đĐ]/gu, 'd');
}

/**
 * Matches of `pattern` in `text` that were not already counted last window.
 *
 * A match lying wholly inside the carried-over tail was complete last time and
 * is skipped; one that reaches past the tail is new.
 */
function countMatches(text: string, pattern: RegExp, tailLength: number): number {
  const scan = new RegExp(pattern.source, pattern.flags);
  let found = 0;
  let match = scan.exec(text);

  while (match !== null) {
    if (match.index + match[0].length > tailLength) {
      found += 1;
    }

    match = scan.exec(text);
  }

  return found;
}

/** The largest `/Count n` in this window, ignoring ones already seen. */
function maxCountToken(text: string, tailLength: number): number {
  const scan = new RegExp(PDF_COUNT_TOKEN.source, PDF_COUNT_TOKEN.flags);
  let largest = 0;
  let match = scan.exec(text);

  while (match !== null) {
    const digits = match[1];

    if (digits !== undefined && match.index + match[0].length > tailLength) {
      largest = Math.max(largest, Number.parseInt(digits, 10));
    }

    match = scan.exec(text);
  }

  return largest;
}
