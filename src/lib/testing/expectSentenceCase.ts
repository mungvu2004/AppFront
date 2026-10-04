/**
 * One assertion for rule A6: every label and every sentence a screen shows
 * starts with a capital letter.
 *
 * Two rules, named in the failure:
 *
 * - `label-lowercase` — a label (a string with no sentence punctuation in it:
 *   a button, a tab, a heading) begins with a lower-case letter — "bỏ qua"
 *   where "Bỏ qua" was meant;
 * - `sentence-lowercase` — a sentence begins with a lower-case letter, the
 *   second sentence of a string included — "Mạng đang yếu. mô hình…".
 *
 * Lower case in the middle of a sentence is fine and is never looked at: "Ẩn
 * lớp tường", "vai người xem" after a capitalised start, a project name.
 *
 * ## What is let through
 *
 * - Text inside `kbd`, `code`, `pre` (and the rest of {@link OPAQUE_TAGS}) — a
 *   key name is not a sentence. It still counts as *position*: in
 *   "<kbd>Esc</kbd> đóng lớp trên cùng" the sentence starts at the key, so
 *   "đóng" is mid-sentence.
 * - Anything `hidden` or `aria-hidden`.
 * - A first word carrying any of `[\d_\-./@#:]` — a code, an id, an address,
 *   a version: "v12 — bản nháp", "engineer@example.com", "3 tường" — or one of
 *   the units and codes `expectVietnamese` already knows: "mm", "m²".
 *
 * ## Where a sentence starts
 *
 * Text is read per block element (anything not inline), with the text of its
 * inline children spliced in, so a sentence running across `<strong>` or a link
 * is still one sentence. A block child inside it stands as one placeholder and is
 * read on its own when the walk gets there.
 *
 * Run it before `unmount` — it reads the DOM that is there.
 */

import { LABEL_ATTRIBUTES, OPAQUE_TAGS, TECHNICAL_TOKENS } from './expectVietnamese';
import { containerOf, describeElement, isHidden, type TestSubject } from './subject';

export type SentenceCaseRule = 'label-lowercase' | 'sentence-lowercase';

export interface SentenceCaseIssue {
  readonly rule: SentenceCaseRule;
  /** Where it sits, as a short path: `div#root > button`. */
  readonly element: string;
  /** `text`, or the attribute the string came from. */
  readonly source: string;
  /** The whole string, trimmed. */
  readonly text: string;
  /** The word that should have started with a capital. */
  readonly word: string;
}

const FAILURE_PREFIX = 'expectSentenceCase';

/** A first word carrying any of these is a code, not a word (`v12`, `a@b`, `3`). */
const CODE_CHARACTERS = /[\d²³_\-./@#:]/u;

/** Characters that may open a sentence before its first letter. */
const LEADING_PUNCTUATION = /^[“"'‘(«[]+/u;

/** End of one sentence, then the space before the next. */
const SENTENCE_BREAK = /[.!?…]+\s+/gu;

/** Any sentence punctuation at all — what turns a label into a sentence. */
const SENTENCE_PUNCTUATION = /[.!?…]/u;

const OPAQUE = new Set(OPAQUE_TAGS);

/** Elements that sit inside a sentence rather than starting one. */
const INLINE_TAGS = new Set([
  'a', 'abbr', 'b', 'bdi', 'bdo', 'br', 'cite', 'code', 'data', 'dfn', 'em', 'i', 'kbd', 'mark', 'q',
  's', 'samp', 'small', 'span', 'strong', 'sub', 'sup', 'time', 'u', 'var', 'wbr',
]);

/** What a block or opaque child reads as inside its parent's text: a place, not letters. */
const STAND_IN = '￼';

/** Offsets in `text` where a sentence begins, past any leading space. */
function sentenceStarts(text: string): number[] {
  const starts = [text.length - text.trimStart().length];

  for (const match of text.matchAll(SENTENCE_BREAK)) {
    starts.push((match.index ?? 0) + match[0].length);
  }

  return starts.filter((start) => start < text.length);
}

/** The word at `start`, if it should have been capitalised; `null` when it is fine. */
function lowercaseWordAt(text: string, start: number): string | null {
  const word = text.slice(start).split(/\s/u, 1)[0] ?? '';

  if (CODE_CHARACTERS.test(word) || TECHNICAL_TOKENS.has(word)) {
    return null;
  }

  const first = word.replace(LEADING_PUNCTUATION, '').charAt(0);

  return first !== first.toLocaleUpperCase('vi') ? word : null;
}

/** Every lower-case sentence start in one string. */
function issuesIn(text: string): { readonly rule: SentenceCaseRule; readonly word: string }[] {
  const rule: SentenceCaseRule = SENTENCE_PUNCTUATION.test(text) ? 'sentence-lowercase' : 'label-lowercase';

  return sentenceStarts(text)
    .map((start) => lowercaseWordAt(text, start))
    .filter((word): word is string => word !== null)
    .map((word) => ({ rule, word }));
}

/**
 * The text a block reads as: its own text with inline children spliced in.
 *
 * A block child, and an opaque one (`kbd`, `code`), stands as one
 * {@link STAND_IN} — it holds the place, so "Bấm <kbd>j</kbd> để đi xuống"
 * starts at the key rather than at "để", and is never judged by its letters.
 */
function readBlock(element: Element): string {
  let text = '';

  for (const child of element.childNodes) {
    if (child.nodeType === Node.TEXT_NODE) {
      text += child.textContent ?? '';
      continue;
    }

    if (child.nodeType !== Node.ELEMENT_NODE || isHidden(child as Element)) {
      continue;
    }

    const tag = (child as Element).tagName.toLowerCase();

    text += INLINE_TAGS.has(tag) && !OPAQUE.has(tag) ? readBlock(child as Element) : STAND_IN;
  }

  return text;
}

/** Every lower-case start under an element, text and label attributes alike. */
export function findSentenceCaseIssues(subject: TestSubject): SentenceCaseIssue[] {
  const root = containerOf(subject);
  const issues: SentenceCaseIssue[] = [];

  const visit = (element: Element): void => {
    const tag = element.tagName.toLowerCase();

    if (isHidden(element) || OPAQUE.has(tag)) {
      return;
    }

    const where = describeElement(element, root);

    for (const attribute of LABEL_ATTRIBUTES) {
      const value = element.getAttribute(attribute)?.trim() ?? '';

      for (const issue of issuesIn(value)) {
        issues.push({ ...issue, element: where, source: attribute, text: value });
      }
    }

    // An inline element is read as part of the block around it, not on its own:
    // "Bạn đang xem <strong>tầng 2</strong>" is one sentence.
    if (element === root || !INLINE_TAGS.has(tag)) {
      const text = readBlock(element).trim();

      for (const issue of issuesIn(text)) {
        issues.push({ ...issue, element: where, source: 'text', text });
      }
    }

    for (const child of element.children) {
      visit(child);
    }
  };

  visit(root);

  return issues;
}

function describeIssue(issue: SentenceCaseIssue): string {
  const source = issue.source === 'text' ? 'văn bản' : `thuộc tính ${issue.source}`;
  const what = issue.rule === 'label-lowercase' ? 'nhãn bắt đầu bằng chữ thường' : 'câu bắt đầu bằng chữ thường';

  return `  ${issue.element}  ${source}  "${issue.text}"\n      → ${issue.rule}: ${what} — "${issue.word}"`;
}

/**
 * Assert rule A6 on a rendered subtree.
 *
 * @example
 * expectSentenceCase(renderWithProviders(<BillingScreen />));
 */
export function expectSentenceCase(subject: TestSubject): void {
  const issues = findSentenceCaseIssues(subject);

  if (issues.length > 0) {
    throw new Error(
      `${FAILURE_PREFIX}: ${String(issues.length)} chuỗi chưa viết hoa chữ đầu (A6).\n${issues.map(describeIssue).join('\n')}`,
    );
  }
}

/**
 * Assert rule A6 on a table of strings that each stand alone — step titles,
 * labels a view reads straight from a record. Catches the string before any
 * screen has to render it, including the ones only a rare state shows.
 */
export function expectSentenceCaseStrings(values: readonly string[]): void {
  const bad = values.flatMap((text) => issuesIn(text.trim()).map((issue) => ({ ...issue, text })));

  if (bad.length > 0) {
    throw new Error(
      `${FAILURE_PREFIX}: ${String(bad.length)} chuỗi chưa viết hoa chữ đầu (A6).\n` +
        bad.map((issue) => `  "${issue.text}" → ${issue.rule}: "${issue.word}"`).join('\n'),
    );
  }
}
