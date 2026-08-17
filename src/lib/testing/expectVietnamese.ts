/**
 * One assertion that everything a screen says is Vietnamese, written properly.
 *
 * Two failures keep coming back, and neither is caught by a type or by review:
 *
 * - an English label survives the translation pass — a "Save" left on a button,
 *   a `placeholder="Enter name"`, a `Toggle Empty State` chip that rule B
 *   already bans from product screens;
 * - a Vietnamese label loses its diacritics — "Luu ban ve" instead of "Lưu bản
 *   vẽ". It reads as Vietnamese to whoever typed it and as gibberish to whoever
 *   reads it, and no compiler will ever mind.
 *
 * Forty-seven screens are going to be checked by the same pass, so the pass
 * lives here once and each screen spends one line on it.
 *
 * ## How a word is judged
 *
 * There is no Vietnamese dictionary in this repo and adding one would be a
 * dependency for a test helper. Three cheaper signals do the work instead, in
 * this order:
 *
 * 1. **Diacritics.** A word carrying any Vietnamese diacritic — including `đ` —
 *    is Vietnamese and is accepted, full stop. This is the fast path, and it is
 *    most of every real screen.
 * 2. **The product's own vocabulary.** `src/i18n/vi.json` is the shipped
 *    Vietnamese of this application, so every word in it is known-good. It also
 *    supplies the *suggestions*: "luu" is reported as missing its diacritics
 *    precisely because stripping "Lưu" produces "luu". Interpolation holes
 *    (`{{count}}`) are cut out first — otherwise `count`, `time` and `step`
 *    would enter the vocabulary as approved words and English would walk in
 *    through the i18n file.
 * 3. **Vietnamese syllable shape.** A Vietnamese syllable is
 *    onset + nucleus + coda drawn from three small, closed sets. `danh` decomposes
 *    (`d` + `a` + `nh`) and is left alone even though it carries no diacritic and
 *    is not in the bundle; `save`, `close`, `loading`, `export` and `filter`
 *    cannot decompose at all and are reported. This is what makes the check
 *    usable on a screen whose vocabulary nobody has listed anywhere.
 *
 * A short list of English words that *do* happen to fit Vietnamese shape — `the`,
 * `main`, `can`, `run`, `map`, `go`, `no` — is kept as well, so those are named
 * as English rather than waved through. Blacklisting one of those costs nothing:
 * it only ever applies to a word written without diacritics, and the Vietnamese
 * words it collides with (`gõ`, `căn`, `nó`) carry theirs and never reach step 3.
 *
 * ## And the whole string, not only its words
 *
 * "Danh sách" survives word by word, and so does "Danh sach" — both syllables
 * are shaped like Vietnamese and neither is in the bundle. What gives the second
 * one away is the *string*: two or more Vietnamese-shaped words and not one
 * diacritic between them is not a Vietnamese phrase, it is a Vietnamese phrase
 * someone typed without a Vietnamese keyboard.
 *
 * Which is also why the *string* decides whether step 2 may suggest a spelling.
 * Stripping the bundle's "đánh" produces "danh", and "danh" is a perfectly good
 * Vietnamese word in its own right — so "Danh sách tường" would be reported, on
 * every screen, as a misspelling of "đánh". The signal that settles it is the
 * rest of the string: somebody who typed "sách" and "tường" had a Vietnamese
 * keyboard and meant the "danh" they wrote. So a suggestion is only ever offered
 * for a word standing in a string with no diacritics anywhere in it, and a
 * string with two or more unaccented Vietnamese words is reported as a phrase
 * rather than guessed at one word at a time.
 *
 * The cost of that is a known blind spot, and it is the right way round: a
 * single unaccented word inside an otherwise accented string — "Luu bản vẽ" —
 * gets through. Catching it would mean flagging "Danh sách" on forty-seven
 * screens, and a check people switch off catches nothing at all.
 *
 * ## What it reads
 *
 * Visible text plus the attributes a person actually hears or sees:
 * `aria-label`, `alt`, `placeholder`, `title` and friends. Not `id`, not
 * `class`, not `data-*` — those are for machines, and English is where they
 * belong. `<code>`, `<pre>` and `<kbd>` are skipped whole, because a keyboard
 * shortcut says `Ctrl`, `Shift`, `Esc`, and always will.
 *
 * Nothing here imports React or a test framework: the input is an element and
 * the failure is a thrown `Error` naming the element, the attribute, the word
 * and — when it can — the spelling that was meant.
 */

import viMessages from '@/i18n/vi.json';

import { containerOf, describeElement, isHidden, type TestSubject } from './subject';

/** Why a string was refused. */
export type VietnameseIssueKind =
  /** A word from the English interface vocabulary. */
  | 'english'
  /** Vietnamese with the diacritics missing. */
  | 'unaccented'
  /** Neither Vietnamese-shaped nor a technical code. */
  | 'foreign';

/** One string that is not Vietnamese written properly. */
export interface VietnameseIssue {
  readonly kind: VietnameseIssueKind;
  /** Where it sits, as a short path: `div#root > button`. */
  readonly element: string;
  /** `text`, or the attribute the string came from. */
  readonly source: string;
  /** The whole string, trimmed. */
  readonly text: string;
  /** The offending word, or `null` when the whole string is at fault. */
  readonly word: string | null;
  /** The spelling that was probably meant, when the bundle knows one. */
  readonly suggestion: string | null;
  /** Vietnamese explanation, ready to print. */
  readonly reason: string;
}

export interface VietnameseOptions {
  /**
   * Extra words to accept, case-insensitively — product names, file formats, a
   * unit this module has not heard of. The escape hatch for a false positive.
   */
  readonly allowWords?: readonly string[];
  /**
   * Extra known-good Vietnamese, for a screen whose vocabulary is wider than
   * `vi.json`. Words written *with* their diacritics also teach the checker to
   * suggest them: pass `'sách'` and `sach` starts being reported as unaccented.
   */
  readonly lexicon?: readonly string[];
  /**
   * Strings to let through whole. A string matches when it appears anywhere in
   * the text; a `RegExp` is tested against it.
   */
  readonly ignore?: readonly (string | RegExp)[];
  /** Attributes to read. Defaults to {@link LABEL_ATTRIBUTES}. */
  readonly attributes?: readonly string[];
  /** Tag names never descended into. Defaults to {@link OPAQUE_TAGS}. */
  readonly skipTags?: readonly string[];
}

/** Prefix on every failure, so a report says which check refused. */
const FAILURE_PREFIX = 'expectVietnamese';

/** Attributes a person reads or hears. Everything else on an element is plumbing. */
export const LABEL_ATTRIBUTES: readonly string[] = [
  'aria-label',
  'aria-placeholder',
  'aria-roledescription',
  'aria-valuetext',
  'alt',
  'placeholder',
  'title',
];

/**
 * Tags whose text is never prose.
 *
 * `<kbd>` and `<code>` hold key names and identifiers — `Ctrl`, `Esc`,
 * `queryKey` — which are English on purpose and would otherwise be reported on
 * every screen with a keyboard hint.
 */
export const OPAQUE_TAGS: readonly string[] = [
  'script',
  'style',
  'template',
  'noscript',
  'code',
  'pre',
  'kbd',
  'samp',
];

/** Only `input`s of these types carry a user-visible `value`. */
const VALUE_INPUT_TYPES = new Set(['submit', 'reset', 'button']);

/** Below this, a word is an axis code or a symbol rather than a word. */
const MIN_WORD_LENGTH = 2;

/**
 * How many unaccented Vietnamese words make a phrase rather than a coincidence.
 *
 * One is a coincidence: `danh`, `cao` and `ban` are ordinary Vietnamese words
 * that need no diacritic. Two in a row, with none anywhere in the string, is
 * somebody typing without a Vietnamese keyboard.
 */
const MIN_PHRASE_WORDS = 2;

/* -------------------------------------------------------------------------- */
/* Diacritics.                                                                 */
/* -------------------------------------------------------------------------- */

/** The combining marks NFD leaves behind once a letter is split from its accent. */
const COMBINING_MARKS = new RegExp('[\u0300-\u036f]', 'g');

/**
 * The word with every Vietnamese diacritic removed.
 *
 * `NFD` splits a letter into its base plus combining marks, which the range
 * below deletes; `đ` has no decomposition and is spelled out separately.
 */
export function stripDiacritics(text: string): string {
  return text
    .normalize('NFD')
    .replace(COMBINING_MARKS, '')
    .replace(/đ/g, 'd')
    .replace(/Đ/g, 'D');
}

/** Does this word carry a Vietnamese diacritic? */
export function hasDiacritics(word: string): boolean {
  return stripDiacritics(word) !== word;
}

/** Is every letter of this word plain ASCII? */
function isAscii(word: string): boolean {
  return /^[A-Za-z-]+$/.test(word);
}

/* -------------------------------------------------------------------------- */
/* Vietnamese syllable shape.                                                  */
/* -------------------------------------------------------------------------- */

/**
 * Everything a Vietnamese syllable can begin with, once diacritics are gone.
 *
 * The empty string is a member: `ăn`, `oai` and `uy` begin with their nucleus.
 */
const ONSETS: readonly string[] = [
  '', 'b', 'c', 'ch', 'd', 'g', 'gh', 'gi', 'h', 'k', 'kh', 'l', 'm', 'n', 'ng',
  'ngh', 'nh', 'p', 'ph', 'qu', 'r', 's', 't', 'th', 'tr', 'v', 'x',
];

/**
 * Every vowel cluster a syllable can be built round, stripped of diacritics —
 * so `ươ`, `uô` and `uơ` all arrive here as `uo`.
 */
const NUCLEI = new Set([
  'a', 'e', 'i', 'o', 'u', 'y',
  'ai', 'ao', 'au', 'ay', 'eo', 'eu', 'ia', 'ie', 'iu', 'oa', 'oe', 'oi', 'oo',
  'ua', 'ue', 'ui', 'uo', 'uu', 'uy', 'ye',
  'ieu', 'oai', 'oao', 'oay', 'oeo', 'uai', 'uay', 'uoi', 'uou', 'uya', 'uye',
  'uyu', 'yeu',
]);

/** Everything a Vietnamese syllable can end with. The empty string is a member. */
const CODAS: readonly string[] = ['', 'c', 'ch', 'm', 'n', 'ng', 'nh', 'p', 't'];

/**
 * Could this be a Vietnamese syllable?
 *
 * True when the word splits into a legal onset, nucleus and coda — `danh` is
 * `d` + `a` + `nh` — and false when no split works, which is the case for
 * `save`, `close`, `filter`, `export` and most of the English an interface
 * accumulates. Diacritics are stripped first, so `tường` and `tuong` answer the
 * same; telling those two apart is the vocabulary's job, not this function's.
 *
 * It says *shape*, not *word*: `nghieu` is shaped like Vietnamese and means
 * nothing. Shape is enough to catch English, which is what this is for.
 */
export function isVietnameseSyllable(word: string): boolean {
  const stripped = stripDiacritics(word).toLowerCase();

  if (stripped === '' || !/^[a-z]+$/.test(stripped)) {
    return false;
  }

  for (const onset of ONSETS) {
    if (!stripped.startsWith(onset)) {
      continue;
    }

    const rest = stripped.slice(onset.length);

    for (const coda of CODAS) {
      if (coda !== '' && !rest.endsWith(coda)) {
        continue;
      }

      const nucleus = coda === '' ? rest : rest.slice(0, rest.length - coda.length);

      if (NUCLEI.has(nucleus)) {
        return true;
      }
    }
  }

  return false;
}

/* -------------------------------------------------------------------------- */
/* Vocabulary.                                                                 */
/* -------------------------------------------------------------------------- */

/**
 * Codes, units and file formats that are English everywhere, including here.
 *
 * Key names sit here as well as in {@link OPAQUE_TAGS}: a shortcut is not always
 * wrapped in `<kbd>`, and "Esc" is not a translation failure.
 */
const TECHNICAL_TOKENS = new Set([
  'mm', 'cm', 'dm', 'km', 'kg', 'px', 'pt', 'ms', 'kb', 'mb', 'gb',
  'pdf', 'dxf', 'dwg', 'ifc', 'png', 'jpg', 'jpeg', 'svg', 'csv', 'json', 'xml',
  'id', 'url', 'api', 'qc', 'ui', 'ux', 'http', 'https', 'www',
  'ctrl', 'shift', 'alt', 'esc', 'enter', 'del', 'backspace', 'space',
]);

/**
 * English interface words.
 *
 * Two jobs. The ones that fit Vietnamese syllable shape — `the`, `main`, `can`,
 * `run`, `map`, `man`, `go`, `no`, `on`, `at`, `by`, `up`, `it`, `be`, `to`,
 * `me`, `that`, `then`, `than`, `them`, `min` — would otherwise be waved through
 * by {@link isVietnameseSyllable}, and this is the only thing standing in their
 * way. The rest are here so the failure can say "tiếng Anh" rather than the
 * vaguer "không phải tiếng Việt".
 *
 * A word listed here is only ever consulted for a spelling *without* diacritics,
 * so the Vietnamese words some of them collide with — `gõ`, `căn`, `nó`, `mãn` —
 * are unaffected: those carry their diacritics and never get this far.
 */
const ENGLISH_UI_WORDS = new Set([
  'the', 'that', 'then', 'than', 'them', 'this', 'these', 'those',
  'main', 'can', 'run', 'map', 'man', 'go', 'no', 'on', 'at', 'by', 'up', 'it',
  'be', 'to', 'me', 'min', 'ok', 'okay', 'yes',
  'save', 'saved', 'saving', 'cancel', 'close', 'delete', 'remove', 'edit',
  'add', 'submit', 'search', 'filter', 'sort', 'settings', 'loading', 'error',
  'success', 'warning', 'failed', 'retry', 'undo', 'redo', 'next', 'back',
  'previous', 'continue', 'confirm', 'apply', 'reset', 'clear', 'copy', 'paste',
  'export', 'import', 'upload', 'download', 'open', 'show', 'hide', 'select',
  'toggle', 'empty', 'state', 'states', 'view', 'list', 'item', 'items', 'name',
  'title', 'label', 'value', 'total', 'count', 'file', 'files', 'folder',
  'project', 'user', 'admin', 'login', 'logout', 'help', 'about', 'more',
  'less', 'none', 'done', 'start', 'stop', 'pause', 'play', 'refresh',
  'update', 'create', 'new', 'draft', 'preview', 'print', 'share', 'send',
  'message', 'notification', 'dashboard', 'report', 'summary', 'detail',
  'overview', 'wall', 'walls', 'room', 'rooms', 'floor', 'axis', 'opening',
  'openings', 'rule', 'rules', 'pipeline', 'upload', 'download',
]);

/** Interpolation holes, whose names are English and must not join the vocabulary. */
const PLACEHOLDER_PATTERN = new RegExp('\\{\\{[^}]*\\}\\}', 'g');

/** A run of letters, hyphenated compounds kept whole. */
function everyWord(): RegExp {
  return /\p{L}+(?:-\p{L}+)*/gu;
}

/** The known-good Vietnamese of the product, and how to spell it. */
interface Lexicon {
  /** Every word as written, lower case — including the ones with no diacritics. */
  readonly written: ReadonlySet<string>;
  /** Stripped spelling to the accented word or words it could have been. */
  readonly byStripped: ReadonlyMap<string, readonly string[]>;
}

/** Every string in a translation bundle, however deeply it is nested. */
function collectBundleStrings(value: unknown, into: string[]): void {
  if (typeof value === 'string') {
    into.push(value);
    return;
  }

  if (value !== null && typeof value === 'object') {
    for (const nested of Object.values(value as Record<string, unknown>)) {
      collectBundleStrings(nested, into);
    }
  }
}

/** Turn a list of Vietnamese phrases into a lexicon. */
function buildLexicon(phrases: readonly string[]): Lexicon {
  const written = new Set<string>();
  const byStripped = new Map<string, string[]>();

  for (const phrase of phrases) {
    for (const match of phrase.replace(PLACEHOLDER_PATTERN, ' ').matchAll(everyWord())) {
      const word = match[0].toLowerCase();

      written.add(word);

      if (!hasDiacritics(word)) {
        continue;
      }

      const stripped = stripDiacritics(word);
      const spellings = byStripped.get(stripped);

      if (spellings === undefined) {
        byStripped.set(stripped, [word]);
      } else if (!spellings.includes(word)) {
        spellings.push(word);
      }
    }
  }

  return { written, byStripped };
}

/** The bundle this application ships, read once. */
const BUNDLE_PHRASES: readonly string[] = (() => {
  const phrases: string[] = [];
  collectBundleStrings(viMessages, phrases);

  return phrases;
})();

const BUNDLE_LEXICON = buildLexicon(BUNDLE_PHRASES);

/** The bundle plus whatever the caller added. */
function lexiconFor(extra: readonly string[] | undefined): Lexicon {
  if (extra === undefined || extra.length === 0) {
    return BUNDLE_LEXICON;
  }

  const added = buildLexicon(extra);
  const byStripped = new Map<string, readonly string[]>(BUNDLE_LEXICON.byStripped);

  for (const [stripped, spellings] of added.byStripped) {
    const existing = byStripped.get(stripped) ?? [];
    byStripped.set(stripped, [...new Set([...existing, ...spellings])]);
  }

  return { written: new Set([...BUNDLE_LEXICON.written, ...added.written]), byStripped };
}

/* -------------------------------------------------------------------------- */
/* Reading the screen.                                                         */
/* -------------------------------------------------------------------------- */

/** One string found on screen, and where it was found. */
interface FoundString {
  readonly element: Element;
  readonly source: string;
  readonly text: string;
}

/** Every user-visible string under an element, text and attributes alike. */
function findStrings(root: HTMLElement, options: VietnameseOptions): FoundString[] {
  const attributes = options.attributes ?? LABEL_ATTRIBUTES;
  const skipped = new Set(options.skipTags ?? OPAQUE_TAGS);
  const found: FoundString[] = [];

  const visit = (element: Element): void => {
    if (skipped.has(element.tagName.toLowerCase()) || isHidden(element)) {
      return;
    }

    for (const attribute of attributes) {
      const value = element.getAttribute(attribute);

      if (value !== null && value.trim() !== '') {
        found.push({ element, source: attribute, text: value.trim() });
      }
    }

    if (element instanceof HTMLInputElement && VALUE_INPUT_TYPES.has(element.type)) {
      const value = element.getAttribute('value');

      if (value !== null && value.trim() !== '') {
        found.push({ element, source: 'value', text: value.trim() });
      }
    }

    for (const child of element.childNodes) {
      if (child.nodeType === Node.ELEMENT_NODE) {
        visit(child as Element);
        continue;
      }

      if (child.nodeType !== Node.TEXT_NODE) {
        continue;
      }

      const text = (child.textContent ?? '').trim();

      if (text !== '') {
        found.push({ element, source: 'text', text });
      }
    }
  };

  visit(root);

  return found;
}

/* -------------------------------------------------------------------------- */
/* Judging.                                                                    */
/* -------------------------------------------------------------------------- */

function isIgnored(text: string, ignore: readonly (string | RegExp)[]): boolean {
  return ignore.some((rule) => (typeof rule === 'string' ? text.includes(rule) : rule.test(text)));
}

/** What a single word turned out to be. */
type WordVerdict =
  | { readonly ok: true }
  | { readonly ok: false; readonly kind: VietnameseIssueKind; readonly reason: string; readonly suggestion: string | null };

const ACCEPTED: WordVerdict = { ok: true };

/**
 * Judge one word.
 *
 * The order is the point. Diacritics settle most words immediately; the bundle
 * settles the ones written without any, in both directions — a word it knows is
 * accepted, and a word whose accented twin it knows is reported with that
 * spelling attached. Only what neither of those reaches is left to shape.
 *
 * `maySuggest` is the caller's reading of the string this word sits in: false
 * when the string carries diacritics elsewhere, or when it is a whole unaccented
 * phrase the caller will report as one. Both are cases where matching a stripped
 * bundle word would produce confident, wrong advice.
 */
function judgeWord(
  word: string,
  lexicon: Lexicon,
  allowed: ReadonlySet<string>,
  maySuggest: boolean,
): WordVerdict {
  if (word.length < MIN_WORD_LENGTH) {
    return ACCEPTED;
  }

  const lower = word.toLowerCase();

  if (allowed.has(lower) || TECHNICAL_TOKENS.has(lower)) {
    return ACCEPTED;
  }

  if (hasDiacritics(word)) {
    return ACCEPTED;
  }

  if (!isAscii(word)) {
    return {
      ok: false,
      kind: 'foreign',
      reason: 'không phải chữ tiếng Việt',
      suggestion: null,
    };
  }

  if (lexicon.written.has(lower)) {
    return ACCEPTED;
  }

  const spellings = maySuggest ? lexicon.byStripped.get(lower) : undefined;

  if (spellings !== undefined && spellings.length > 0) {
    return {
      ok: false,
      kind: 'unaccented',
      reason: 'tiếng Việt thiếu dấu',
      suggestion: spellings.join(' hoặc '),
    };
  }

  if (ENGLISH_UI_WORDS.has(lower)) {
    return {
      ok: false,
      kind: 'english',
      reason: 'từ tiếng Anh còn sót lại',
      suggestion: null,
    };
  }

  // Axis codes and error codes are the one place rule A6 allows capitals, and
  // they are the one place a run of ASCII letters is not a word.
  if (word === word.toUpperCase()) {
    return ACCEPTED;
  }

  if (isVietnameseSyllable(lower)) {
    return ACCEPTED;
  }

  return {
    ok: false,
    kind: 'foreign',
    reason: 'không phải âm tiết tiếng Việt; nhiều khả năng là tiếng Anh',
    suggestion: null,
  };
}

/**
 * How many words in this string read as Vietnamese written without its diacritics.
 *
 * The blind spot this measures: `danh` and `sach` are both shaped like
 * Vietnamese and neither is in the bundle, so nothing catches "Danh sach" one
 * word at a time. Two of them together, in a string with no diacritic anywhere,
 * is the signature. One is not — plenty of Vietnamese words genuinely carry no
 * diacritic, and a label is allowed to be one word long.
 *
 * Codes, units, allowed words and known English are all left out of the count,
 * so "Xem PDF" and "main can" do not read as Vietnamese phrases.
 */
function countUnaccentedVietnameseWords(text: string, allowed: ReadonlySet<string>): number {
  let shaped = 0;

  for (const match of text.matchAll(everyWord())) {
    const word = match[0];
    const lower = word.toLowerCase();

    if (
      word.length < MIN_WORD_LENGTH ||
      word === word.toUpperCase() ||
      allowed.has(lower) ||
      TECHNICAL_TOKENS.has(lower) ||
      ENGLISH_UI_WORDS.has(lower) ||
      !isAscii(word) ||
      !isVietnameseSyllable(lower)
    ) {
      continue;
    }

    shaped += 1;
  }

  return shaped;
}

/* -------------------------------------------------------------------------- */
/* The check.                                                                  */
/* -------------------------------------------------------------------------- */

/**
 * Every string under an element that is not Vietnamese written properly.
 *
 * Pure and non-throwing, so a test can assert on what was found rather than on
 * a message. {@link expectVietnamese} is the assertion built on it.
 */
export function findNonVietnamese(
  subject: TestSubject,
  options: VietnameseOptions = {},
): VietnameseIssue[] {
  const root = containerOf(subject);
  const lexicon = lexiconFor(options.lexicon);
  const allowed = new Set((options.allowWords ?? []).map((word) => word.toLowerCase()));
  const ignore = options.ignore ?? [];
  const issues: VietnameseIssue[] = [];

  for (const found of findStrings(root, options)) {
    if (isIgnored(found.text, ignore)) {
      continue;
    }

    const element = describeElement(found.element, root);

    // What the rest of the string says about the words in it. A string that
    // carries diacritics vouches for the plain words standing next to them; a
    // string carrying none, with two or more Vietnamese words in it, is a phrase
    // to report whole rather than a set of words to guess at one by one.
    const accented = hasDiacritics(found.text);
    const unaccentedWords = accented ? 0 : countUnaccentedVietnameseWords(found.text, allowed);
    const isPhrase = !accented && unaccentedWords >= MIN_PHRASE_WORDS;
    const maySuggest = !accented && !isPhrase;

    for (const match of found.text.matchAll(everyWord())) {
      const word = match[0];
      const verdict = judgeWord(word, lexicon, allowed, maySuggest);

      if (verdict.ok) {
        continue;
      }

      issues.push({
        kind: verdict.kind,
        element,
        source: found.source,
        text: found.text,
        word,
        suggestion: verdict.suggestion,
        reason: verdict.reason,
      });
    }

    if (isPhrase) {
      issues.push({
        kind: 'unaccented',
        element,
        source: found.source,
        text: found.text,
        word: null,
        suggestion: null,
        reason: 'cả chuỗi là tiếng Việt không dấu',
      });
    }
  }

  return issues;
}

/** `text` reads better than `thuộc tính text` in a failure. */
function describeSource(source: string): string {
  return source === 'text' ? 'văn bản' : `thuộc tính ${source}`;
}

/** One issue as a line a person can act on. */
function describeIssue(issue: VietnameseIssue): string {
  const where = `  ${issue.element}  ${describeSource(issue.source)}  "${issue.text}"`;
  const what = issue.word === null ? issue.reason : `từ "${issue.word}" — ${issue.reason}`;
  const hint = issue.suggestion === null ? '' : `; đúng ra là "${issue.suggestion}"`;

  return `${where}\n      → ${what}${hint}`;
}

/**
 * Assert that everything a rendered screen says is Vietnamese, written properly.
 *
 * Throws an `Error` listing every offending string with its element, the
 * attribute it came from, the word at fault and the spelling that was meant, so
 * the failure says what to fix rather than only that something is wrong.
 *
 * @param subject A container, or the result of rendering one.
 *
 * @example
 * expectVietnamese(renderWithProviders(<QcScreen />));
 * expectVietnamese(container, { allowWords: ['Revit'] });
 */
export function expectVietnamese(subject: TestSubject, options: VietnameseOptions = {}): void {
  const issues = findNonVietnamese(subject, options);

  if (issues.length === 0) {
    return;
  }

  const detail = issues.map(describeIssue).join('\n');

  throw new Error(
    `${FAILURE_PREFIX}: ${String(issues.length)} chuỗi hiển thị chưa phải tiếng Việt có dấu.\n${detail}`,
  );
}
