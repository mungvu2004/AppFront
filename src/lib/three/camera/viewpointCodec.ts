/**
 * A view, small enough to paste into a message.
 *
 * "Look at this" is the most common thing one reviewer says to another, and
 * without a way to say it the answer is a screenshot — which cannot be turned,
 * measured or checked, and which stops being true the moment the model changes.
 * This module is the other answer: the camera as a short URL-safe string that
 * puts the colleague where the sender was standing, facing what they were
 * facing, in the same mode, on the same storey, with the same colouring.
 *
 * ```text
 * 1BAAAMI4AAAZAAAATiAAASERAAFVVAjAxvFU
 * ```
 *
 * ## What is in it, and what is deliberately not
 *
 * A {@link SharedViewpoint} is the camera's own handover currency — the point
 * being looked at, the heading, the vertical angle, the framing distance — plus
 * the three things the *screen* is in that the camera does not know about: which
 * mode is driving, which storey is being reviewed, and how the model is
 * coloured. Nothing else. No selection, no filter, no project id: a link is a
 * viewpoint, and a viewpoint that also carried application state would go stale
 * against the very thing it is meant to outlive.
 *
 * ## Why a binary payload rather than JSON
 *
 * The requirement is a hundred and twenty characters. `JSON.stringify` of the
 * same seven fields runs past two hundred before escaping, and percent-encoding
 * a JSON blob into a query string roughly doubles it again. So the payload is
 * packed into {@link CODE_BYTES_WITHOUT_LEVEL} plus the storey code and written
 * in the base64url alphabet, which needs no escaping in a query string or a
 * fragment. That comes to **36 characters** for a storey called `L-01` and
 * **49** for the longest storey code the format takes — the fields are fixed
 * width, so {@link MAX_VIEWPOINT_CODE_LENGTH} is not a limit anything approaches
 * but a budget with more than half of it unspent.
 *
 * Precision follows the domain: positions are stored to the **millimetre**, the
 * unit every length in this product is measured in, and angles to about a
 * two-hundredth of a degree, which is far finer than a pixel of rotation at any
 * viewport this application runs at. What comes back is therefore the same view,
 * not the same floats — {@link quantiseViewpoint} states exactly which view, so
 * a round-trip test can assert equality rather than a tolerance.
 *
 * ## A broken code is an answer, not a crash
 *
 * Links get truncated by chat clients, cut off at line wraps, and typed in by
 * hand. {@link decodeViewpoint} therefore **never throws and never returns a
 * plausible-looking wrong view**: every code carries a checksum, so a code with
 * one character changed is rejected rather than silently decoded into some other
 * corner of the building. Failure comes back as
 * `{ ok: false, problem, message }` with a Vietnamese sentence, and the caller
 * keeps the camera it already had.
 *
 * Encoding is the other way round: a viewpoint that cannot be encoded is a
 * programming mistake — a `NaN` coordinate, a storey code with a space in it —
 * and {@link encodeViewpoint} throws a `RangeError` naming it rather than
 * producing a link that goes somewhere else. {@link isEncodableLevelId} lets a
 * caller ask first.
 *
 * ## Stability
 *
 * The mode and colouring tables below map a name to a **fixed number**, and they
 * are complete `Record`s, so adding a camera mode or a colouring mode fails the
 * build here and forces a code to be chosen rather than shifting every existing
 * link by one. That is the whole reason they are not `indexOf` over the lists
 * those two modules already export.
 */

import { Vector3 } from 'three';

import { RADIANS_PER_TURN, metres, metresToMillimetres, millimetres } from '@/domain/units/types';
import type { ColoringModeId } from '@/lib/coloring/modes';
import type { LevelId } from '@/domain/spatial/types';

import { toSceneLength } from '../build/scene';
import type { CameraMode, Viewpoint } from './modes';

/* -------------------------------------------------------------------------- */
/* What is shared.                                                             */
/* -------------------------------------------------------------------------- */

/**
 * A camera, plus the three things about the screen a colleague has to arrive in.
 *
 * Extends {@link Viewpoint} rather than repeating it, so a caller hands one
 * straight from `controller.viewpoint()` and gets one back that
 * `createCameraMode` accepts.
 */
export interface SharedViewpoint extends Viewpoint {
  /** Which way of looking the sender was using. */
  readonly mode: CameraMode;
  /** The storey being reviewed. */
  readonly levelId: LevelId;
  /** How the model was coloured. */
  readonly coloring: ColoringModeId;
}

/* -------------------------------------------------------------------------- */
/* The format.                                                                 */
/* -------------------------------------------------------------------------- */

/** The version character every code starts with. */
export const VIEWPOINT_CODE_VERSION = '1';

/** The longest code this module will produce or accept. */
export const MAX_VIEWPOINT_CODE_LENGTH = 120;

/** The longest storey code that fits: `L-` and up to this many characters. */
export const MAX_LEVEL_CODE_LENGTH = 12;

/** The prefix every {@link LevelId} carries. */
const LEVEL_PREFIX = 'L-';

/** What a storey code may be made of, so it survives a URL untouched. */
const LEVEL_CODE_PATTERN = /^[0-9A-Za-z_-]+$/;

/**
 * Bytes of payload before the storey code and its checksum.
 *
 * ```text
 * 0      modes      (camera mode << 4) | colouring mode
 * 1..4   x          millimetres, signed
 * 5..8   y          millimetres, signed
 * 9..12  z          millimetres, signed
 * 13..16 distance   millimetres, unsigned
 * 17..18 azimuth    turns / 65536
 * 19..20 polar      half turns / 65535
 * 21     length     how many storey-code bytes follow
 * ```
 */
export const CODE_BYTES_WITHOUT_LEVEL = 22;

/** Bytes of checksum at the end. */
const CHECKSUM_BYTES = 2;

/** Steps a full turn of heading is divided into. */
const AZIMUTH_STEPS = 65536;

/** Steps the half turn from straight down to straight up is divided into. */
const POLAR_STEPS = 65535;

/** Half a turn, in radians: the range the vertical angle lives in. */
const HALF_TURN_RAD = RADIANS_PER_TURN / 2;

/** The largest millimetre value a signed 32-bit field holds. */
const MAX_SIGNED_MM = 2147483647;

/** The largest millimetre value an unsigned 32-bit field holds. */
const MAX_UNSIGNED_MM = 4294967295;

/**
 * The code for each camera mode.
 *
 * A complete `Record`: adding a mode to `CameraMode` fails the build here, which
 * is the point — a new mode has to be given a number of its own rather than
 * quietly renumbering the four that links in the wild already use.
 */
const MODE_CODES: Readonly<Record<CameraMode, number>> = {
  orbit: 0,
  top: 1,
  elevation: 2,
  walk: 3,
};

/** The code for each colouring mode, on the same terms. */
const COLORING_CODES: Readonly<Record<ColoringModeId, number>> = {
  default: 0,
  roomUsage: 1,
  area: 2,
  aiConfidence: 3,
  reviewState: 4,
  violationSeverity: 5,
  level: 6,
};

/**
 * The lookups the decoder needs, derived from the tables above rather than
 * written out again — a code that encodes to one mode and decodes to another is
 * exactly the bug a shared link cannot afford.
 */
const MODE_BY_CODE: ReadonlyMap<number, CameraMode> = new Map(
  (Object.keys(MODE_CODES) as CameraMode[]).map((mode): [number, CameraMode] => [
    MODE_CODES[mode],
    mode,
  ]),
);

const COLORING_BY_CODE: ReadonlyMap<number, ColoringModeId> = new Map(
  (Object.keys(COLORING_CODES) as ColoringModeId[]).map((id): [number, ColoringModeId] => [
    COLORING_CODES[id],
    id,
  ]),
);

/* -------------------------------------------------------------------------- */
/* What a bad code comes back as.                                              */
/* -------------------------------------------------------------------------- */

/** Why a code could not be read. */
export type ViewpointCodeProblem =
  /** Nothing was given, or an empty string was. */
  | 'empty'
  /** Longer than any code this format produces. */
  | 'tooLong'
  /** Written by a version of the format this build does not know. */
  | 'version'
  /** Characters outside the alphabet: something rewrote or wrapped the link. */
  | 'alphabet'
  /** The payload stops early or runs long: the link was cut. */
  | 'truncated'
  /** Every byte is there but they do not add up: a character changed. */
  | 'checksum'
  /** A field holds a value this build has no name for. */
  | 'field';

/**
 * What to tell the person holding the broken link.
 *
 * Vietnamese, lower case, sentence style, as invariant A6 requires. A complete
 * `Record`, so a new problem cannot reach a screen without a sentence.
 */
export const VIEWPOINT_CODE_PROBLEM_LABELS: Readonly<Record<ViewpointCodeProblem, string>> = {
  empty: 'liên kết không chứa mã góc nhìn',
  tooLong: 'mã góc nhìn dài hơn mức định dạng này tạo ra',
  version: 'mã góc nhìn thuộc phiên bản định dạng khác',
  alphabet: 'mã góc nhìn chứa ký tự lạ, có thể đã bị sửa khi gửi',
  truncated: 'mã góc nhìn bị cắt mất một phần',
  checksum: 'mã góc nhìn sai mã kiểm tra, có thể đã bị sửa một ký tự',
  field: 'mã góc nhìn chứa giá trị bản dựng này không hiểu',
};

/** A code that was read, or the reason it was not. */
export type ViewpointDecodeResult =
  | { readonly ok: true; readonly viewpoint: SharedViewpoint }
  | {
      readonly ok: false;
      readonly problem: ViewpointCodeProblem;
      /** Vietnamese sentence for the person who followed the link. */
      readonly message: string;
    };

function failure(problem: ViewpointCodeProblem): ViewpointDecodeResult {
  return { ok: false, problem, message: VIEWPOINT_CODE_PROBLEM_LABELS[problem] };
}

/* -------------------------------------------------------------------------- */
/* base64url.                                                                  */
/* -------------------------------------------------------------------------- */

/**
 * The URL-safe alphabet, unpadded.
 *
 * Written out rather than reached for through `btoa` or `Buffer`: one is a DOM
 * global this module has no business assuming, the other is Node's, and neither
 * produces the `-`/`_` pair that survives a query string without escaping.
 */
const ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_';

const ALPHABET_VALUES: ReadonlyMap<string, number> = new Map(
  [...ALPHABET].map((character, value) => [character, value]),
);

function toBase64Url(bytes: readonly number[]): string {
  let text = '';

  for (let index = 0; index < bytes.length; index += 3) {
    const first = bytes[index] ?? 0;
    const second = bytes[index + 1];
    const third = bytes[index + 2];

    text += ALPHABET[first >> 2] ?? '';
    text += ALPHABET[((first & 0x03) << 4) | ((second ?? 0) >> 4)] ?? '';
    if (second === undefined) {
      break;
    }
    text += ALPHABET[((second & 0x0f) << 2) | ((third ?? 0) >> 6)] ?? '';
    if (third === undefined) {
      break;
    }
    text += ALPHABET[third & 0x3f] ?? '';
  }

  return text;
}

/** The bytes of a base64url string, or `null` when it is not one. */
function fromBase64Url(text: string): number[] | null {
  // Four characters carry three bytes; one left over cannot carry anything.
  if (text.length % 4 === 1) {
    return null;
  }

  const bytes: number[] = [];
  let accumulator = 0;
  let bits = 0;

  for (const character of text) {
    const value = ALPHABET_VALUES.get(character);
    if (value === undefined) {
      return null;
    }
    accumulator = (accumulator << 6) | value;
    bits += 6;
    if (bits >= 8) {
      bits -= 8;
      bytes.push((accumulator >> bits) & 0xff);
    }
  }

  return bytes;
}

/* -------------------------------------------------------------------------- */
/* Checksum.                                                                   */
/* -------------------------------------------------------------------------- */

/**
 * Sixteen bits of FNV-1a over the payload.
 *
 * Not a security measure — nobody is being kept out of a viewpoint — but the
 * thing that turns "this link decodes to somewhere odd" into "this link is
 * broken". Without it every base64url string of the right length decodes to
 * *some* view, and a colleague following a mangled link would be sent to a
 * corner of the model with no way of telling it was not the corner they were
 * sent to.
 */
function checksumOf(bytes: readonly number[], end: number): number {
  let hash = 0x811c9dc5;
  for (let index = 0; index < end; index += 1) {
    hash = (hash ^ (bytes[index] ?? 0)) >>> 0;
    hash = Math.imul(hash, 0x01000193) >>> 0;
  }
  return ((hash >>> 16) ^ hash) & 0xffff;
}

/* -------------------------------------------------------------------------- */
/* Fixed-width fields.                                                         */
/* -------------------------------------------------------------------------- */

function pushUint16(bytes: number[], value: number): void {
  bytes.push((value >> 8) & 0xff, value & 0xff);
}

function pushInt32(bytes: number[], value: number): void {
  bytes.push((value >> 24) & 0xff, (value >> 16) & 0xff, (value >> 8) & 0xff, value & 0xff);
}

function readUint16(bytes: readonly number[], offset: number): number {
  return ((bytes[offset] ?? 0) << 8) | (bytes[offset + 1] ?? 0);
}

function readInt32(bytes: readonly number[], offset: number): number {
  return (
    (((bytes[offset] ?? 0) << 24) |
      ((bytes[offset + 1] ?? 0) << 16) |
      ((bytes[offset + 2] ?? 0) << 8) |
      (bytes[offset + 3] ?? 0)) |
    0
  );
}

function readUint32(bytes: readonly number[], offset: number): number {
  return readInt32(bytes, offset) >>> 0;
}

/* -------------------------------------------------------------------------- */
/* Quantisation.                                                               */
/* -------------------------------------------------------------------------- */

/** A scene length, on the millimetre grid the format stores it on. */
function lengthToMm(valueM: number, field: string): number {
  if (!Number.isFinite(valueM)) {
    throw new RangeError(`Cannot encode a viewpoint whose ${field} is ${String(valueM)}.`);
  }
  return Math.round(metresToMillimetres(metres(valueM)));
}

function mmToLength(valueMm: number): number {
  return toSceneLength(millimetres(valueMm));
}

/** A heading folded into one turn and put on the 16-bit grid. */
function azimuthToCode(azimuthRad: number): number {
  const folded = ((azimuthRad % RADIANS_PER_TURN) + RADIANS_PER_TURN) % RADIANS_PER_TURN;
  return Math.round((folded / RADIANS_PER_TURN) * AZIMUTH_STEPS) % AZIMUTH_STEPS;
}

function codeToAzimuth(code: number): number {
  return (code / AZIMUTH_STEPS) * RADIANS_PER_TURN;
}

/** A vertical angle held to `[0, π]` and put on the 16-bit grid. */
function polarToCode(polarRad: number): number {
  const held = Math.min(HALF_TURN_RAD, Math.max(0, polarRad));
  return Math.round((held / HALF_TURN_RAD) * POLAR_STEPS);
}

function codeToPolar(code: number): number {
  return (code / POLAR_STEPS) * HALF_TURN_RAD;
}

/**
 * The view a code really carries, for a viewpoint that has not been through one.
 *
 * Encoding is lossy by design — millimetres and a two-hundredth of a degree —
 * and this states the loss exactly, so `decode(encode(v))` can be asserted equal
 * to `quantise(v)` rather than merely close to `v`. It also folds the heading
 * into one turn: an orbit camera that has been spun four times carries the
 * winding count, and a link carries a direction.
 *
 * @throws RangeError on the same input {@link encodeViewpoint} refuses.
 */
export function quantiseViewpoint(shared: SharedViewpoint): SharedViewpoint {
  const xMm = lengthToMm(shared.target.x, 'target x');
  const yMm = lengthToMm(shared.target.y, 'target y');
  const zMm = lengthToMm(shared.target.z, 'target z');
  const distanceMm = Math.max(0, lengthToMm(shared.distanceM, 'distance'));

  assertInSignedRange(xMm, 'target x');
  assertInSignedRange(yMm, 'target y');
  assertInSignedRange(zMm, 'target z');
  if (distanceMm > MAX_UNSIGNED_MM) {
    throw new RangeError(`Cannot encode a viewpoint ${String(shared.distanceM)} m from its target.`);
  }
  if (!Number.isFinite(shared.azimuthRad) || !Number.isFinite(shared.polarRad)) {
    throw new RangeError('Cannot encode a viewpoint whose heading or vertical angle is not finite.');
  }

  return {
    target: new Vector3(mmToLength(xMm), mmToLength(yMm), mmToLength(zMm)),
    azimuthRad: codeToAzimuth(azimuthToCode(shared.azimuthRad)),
    polarRad: codeToPolar(polarToCode(shared.polarRad)),
    distanceM: mmToLength(distanceMm),
    mode: shared.mode,
    levelId: shared.levelId,
    coloring: shared.coloring,
  };
}

function assertInSignedRange(valueMm: number, field: string): void {
  if (Math.abs(valueMm) > MAX_SIGNED_MM) {
    throw new RangeError(`Cannot encode a viewpoint whose ${field} is ${String(valueMm)} mm.`);
  }
}

/* -------------------------------------------------------------------------- */
/* The storey code.                                                            */
/* -------------------------------------------------------------------------- */

/**
 * Can this storey be named in a link?
 *
 * The ids this product generates — `L-01`, `L-G`, `L-B1` — all can. The check
 * exists because `LevelId` is `L-${string}` and a string can hold anything,
 * including the space or the slash that would need escaping and blow the length
 * budget.
 */
export function isEncodableLevelId(levelId: string): boolean {
  if (!levelId.startsWith(LEVEL_PREFIX)) {
    return false;
  }
  const code = levelId.slice(LEVEL_PREFIX.length);
  return code.length >= 1 && code.length <= MAX_LEVEL_CODE_LENGTH && LEVEL_CODE_PATTERN.test(code);
}

/* -------------------------------------------------------------------------- */
/* Encode and decode.                                                          */
/* -------------------------------------------------------------------------- */

/**
 * Pack a viewpoint into a code to paste into a link.
 *
 * The result is URL-safe as it stands: it goes into a query parameter or a
 * fragment with no escaping, and comes back the same length.
 *
 * @throws RangeError when a coordinate is not finite, when the model is so far
 * from the datum that a millimetre no longer fits in the field, or when the
 * storey id is not one {@link isEncodableLevelId} accepts. All three are
 * programming or data mistakes; producing a link that quietly went somewhere
 * else would be worse than refusing.
 */
export function encodeViewpoint(shared: SharedViewpoint): string {
  if (!isEncodableLevelId(shared.levelId)) {
    throw new RangeError(
      `Cannot encode level ${shared.levelId}: a shared viewpoint needs an ` +
        `"L-" code of at most ${String(MAX_LEVEL_CODE_LENGTH)} letters, digits, ` +
        'hyphens or underscores.',
    );
  }

  // Through the grid first, which is where every range check lives: encoding
  // and quantising then refuse exactly the same inputs by construction, rather
  // than by two lists of checks somebody has to keep in step.
  const grid = quantiseViewpoint(shared);

  const modeCode = MODE_CODES[grid.mode];
  const coloringCode = COLORING_CODES[grid.coloring];
  const levelCode = grid.levelId.slice(LEVEL_PREFIX.length);

  const bytes: number[] = [];
  bytes.push((modeCode << 4) | coloringCode);
  pushInt32(bytes, lengthToMm(grid.target.x, 'target x'));
  pushInt32(bytes, lengthToMm(grid.target.y, 'target y'));
  pushInt32(bytes, lengthToMm(grid.target.z, 'target z'));
  pushInt32(bytes, Math.max(0, lengthToMm(grid.distanceM, 'distance')));
  pushUint16(bytes, azimuthToCode(grid.azimuthRad));
  pushUint16(bytes, polarToCode(grid.polarRad));
  bytes.push(levelCode.length);
  for (const character of levelCode) {
    bytes.push(character.charCodeAt(0));
  }
  pushUint16(bytes, checksumOf(bytes, bytes.length));

  const code = VIEWPOINT_CODE_VERSION + toBase64Url(bytes);

  if (code.length > MAX_VIEWPOINT_CODE_LENGTH) {
    // Unreachable for any input that got this far — the fields are fixed width
    // and the storey code is capped — but a link that silently broke the budget
    // would be found by a colleague, not by us.
    throw new RangeError(
      `Encoded viewpoint is ${String(code.length)} characters, over the ` +
        `${String(MAX_VIEWPOINT_CODE_LENGTH)} a shared link allows.`,
    );
  }
  return code;
}

/**
 * Read a code back, or say why it cannot be read.
 *
 * Never throws, whatever it is given — including something that is not a string
 * at all, which is what a query parameter is until it has been checked. A caller
 * that gets `ok: false` keeps the camera it has and shows `message`.
 */
export function decodeViewpoint(code: unknown): ViewpointDecodeResult {
  if (typeof code !== 'string' || code.length === 0) {
    return failure('empty');
  }
  if (code.length > MAX_VIEWPOINT_CODE_LENGTH) {
    return failure('tooLong');
  }
  if (code[0] !== VIEWPOINT_CODE_VERSION) {
    return failure('version');
  }

  const bytes = fromBase64Url(code.slice(1));
  if (bytes === null) {
    return failure('alphabet');
  }
  if (bytes.length < CODE_BYTES_WITHOUT_LEVEL + 1 + CHECKSUM_BYTES) {
    return failure('truncated');
  }

  const levelLength = bytes[CODE_BYTES_WITHOUT_LEVEL - 1] ?? 0;
  const payloadEnd = CODE_BYTES_WITHOUT_LEVEL + levelLength;
  if (levelLength < 1 || levelLength > MAX_LEVEL_CODE_LENGTH) {
    return failure('truncated');
  }
  if (bytes.length !== payloadEnd + CHECKSUM_BYTES) {
    return failure('truncated');
  }
  if (readUint16(bytes, payloadEnd) !== checksumOf(bytes, payloadEnd)) {
    return failure('checksum');
  }

  const header = bytes[0] ?? 0;
  const mode = MODE_BY_CODE.get(header >> 4);
  const coloring = COLORING_BY_CODE.get(header & 0x0f);
  if (mode === undefined || coloring === undefined) {
    return failure('field');
  }

  let levelCode = '';
  for (let index = CODE_BYTES_WITHOUT_LEVEL; index < payloadEnd; index += 1) {
    levelCode += String.fromCharCode(bytes[index] ?? 0);
  }
  if (!LEVEL_CODE_PATTERN.test(levelCode)) {
    return failure('field');
  }

  return {
    ok: true,
    viewpoint: {
      target: new Vector3(
        mmToLength(readInt32(bytes, 1)),
        mmToLength(readInt32(bytes, 5)),
        mmToLength(readInt32(bytes, 9)),
      ),
      azimuthRad: codeToAzimuth(readUint16(bytes, 17)),
      polarRad: codeToPolar(readUint16(bytes, 19)),
      distanceM: mmToLength(readUint32(bytes, 13)),
      mode,
      levelId: `${LEVEL_PREFIX}${levelCode}`,
      coloring,
    },
  };
}
