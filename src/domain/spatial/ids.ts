/**
 * Id generation and validation for the spatial graph.
 *
 * Id format: `<prefix>-<body>`, where the body is an uppercase base36 string
 * made of two parts joined together:
 * - the first 6 characters are a per-kind counter, so two ids can never
 *   collide within one session;
 * - the last 10 characters are random, which keeps collisions unlikely when
 *   data from several sessions or machines is merged. They come from
 *   `crypto.getRandomValues` (rejection-sampled, so unbiased) and only fall
 *   back to `Math.random` when `crypto` is absent.
 */

import type { AxisId, DimensionId, FurnitureId, LevelId, OpeningId, RoomId, WallId } from './types';

/** Id prefix per entity kind. */
export const ID_PREFIX_BY_KIND = {
  level: 'L',
  wall: 'W',
  opening: 'D',
  furniture: 'F',
  room: 'R',
  axis: 'A',
  dimension: 'M',
} as const;

/** Entity kinds that carry a prefixed id. */
export type EntityKind = keyof typeof ID_PREFIX_BY_KIND;

/** Maps an entity kind to its id type. */
export interface IdByKind {
  level: LevelId;
  wall: WallId;
  opening: OpeningId;
  furniture: FurnitureId;
  room: RoomId;
  axis: AxisId;
  dimension: DimensionId;
}

const BASE36_ALPHABET = '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ';
const COUNTER_LENGTH = 6;
const RANDOM_LENGTH = 10;
// Fixed on purpose: ids stored with a 10-character body must stay valid.
const MIN_BODY_LENGTH = 10;
// 252 = 7 * 36, so bytes 0..251 map evenly onto the 36 symbols.
const BYTE_LIMIT = 252;
const ID_BODY_PATTERN = /^[0-9A-Z]+$/;

const counterByKind: { [K in EntityKind]: number } = {
  level: 0,
  wall: 0,
  opening: 0,
  furniture: 0,
  room: 0,
  axis: 0,
  dimension: 0,
};

const kindByPrefix: ReadonlyMap<string, EntityKind> = new Map(
  (Object.keys(ID_PREFIX_BY_KIND) as EntityKind[]).map((kind) => [ID_PREFIX_BY_KIND[kind], kind] as const),
);

const encodeBase36 = (value: number, minLength: number): string => {
  let remaining = Math.trunc(Math.abs(value));
  let encoded = '';

  do {
    encoded = BASE36_ALPHABET.charAt(remaining % BASE36_ALPHABET.length) + encoded;
    remaining = Math.floor(remaining / BASE36_ALPHABET.length);
  } while (remaining > 0);

  return encoded.padStart(minLength, '0');
};

const randomSuffix = (length: number): string => {
  const cryptoObject = globalThis.crypto;
  let suffix = '';

  if (cryptoObject?.getRandomValues) {
    while (suffix.length < length) {
      const bytes = cryptoObject.getRandomValues(new Uint8Array(length * 2));

      for (const byte of bytes) {
        if (byte < BYTE_LIMIT && suffix.length < length) {
          suffix += BASE36_ALPHABET.charAt(byte % BASE36_ALPHABET.length);
        }
      }
    }

    return suffix;
  }

  for (let index = 0; index < length; index += 1) {
    suffix += BASE36_ALPHABET.charAt(Math.floor(Math.random() * BASE36_ALPHABET.length));
  }

  return suffix;
};

/**
 * Creates a new id for one entity kind.
 *
 * The per-kind counter guarantees that two consecutive calls never return the
 * same id within a session.
 */
export const createId = <K extends EntityKind>(kind: K): IdByKind[K] => {
  counterByKind[kind] += 1;

  const body = `${encodeBase36(counterByKind[kind], COUNTER_LENGTH)}${randomSuffix(RANDOM_LENGTH)}`;

  return `${ID_PREFIX_BY_KIND[kind]}-${body}` as IdByKind[K];
};

const isValidBody = (body: string): boolean => body.length >= MIN_BODY_LENGTH && ID_BODY_PATTERN.test(body);

const splitId = (id: string): { prefix: string; body: string } | null => {
  const separatorIndex = id.indexOf('-');

  if (separatorIndex !== 1) {
    return null;
  }

  return { prefix: id.slice(0, 1), body: id.slice(2) };
};

/** Checks whether a string is a valid id for exactly the given entity kind. */
export const isIdOfKind = <K extends EntityKind>(kind: K, id: string): id is IdByKind[K] => {
  const parts = splitId(id);

  if (parts === null) {
    return false;
  }

  return parts.prefix === ID_PREFIX_BY_KIND[kind] && isValidBody(parts.body);
};

/** Reads the entity kind from an id prefix; returns `null` when the id is invalid. */
export const readKindFromId = (id: string): EntityKind | null => {
  const parts = splitId(id);

  if (parts === null || !isValidBody(parts.body)) {
    return null;
  }

  return kindByPrefix.get(parts.prefix) ?? null;
};

const DISPLAY_CODE_DIGITS = 3;

const counterCodeOf = (id: string): string => {
  const counter = id.slice(2, 2 + COUNTER_LENGTH).replace(/^0+/u, '');

  return `${id.slice(0, 1)}-${(counter === '' ? '0' : counter).padStart(DISPLAY_CODE_DIGITS, '0')}`;
};

// A counter-led body starts with a `0` and is no longer than counter + random part
// (16). Both halves matter: a BE id also starts with `0` (its timestamp, until ~2558)
// but its body is 25 long, so only the length rules it out.
const isCounterLed = (id: string): boolean =>
  id.slice(2, 3) === '0' && id.length - 2 <= COUNTER_LENGTH + RANDOM_LENGTH;

/**
 * Nhãn người đọc của MỘT mã đứng riêng (không có danh sách anh em để đánh số): mã
 * có số đếm đứng đầu ra `W-014`, mọi mã khác (mã BE, `A-AXIS0000000`, `W-MISSING1AA`)
 * giữ nguyên văn — cắt sáu ký tự đầu của chúng chỉ ra nhãn rác (B-V7-42).
 */
export const counterLabelOf = (id: string): string => (isCounterLed(id) ? counterCodeOf(id) : id);

/**
 * Nhãn người đọc (không có dấu `#`) cho một danh sách mã CÙNG LOẠI trên cùng một tầng.
 *
 * Quy tắc:
 * 1. Nếu MỌI mã có số đếm đứng đầu (thân bắt đầu bằng `0`, dài không quá 16 ký tự)
 *    thì đọc sáu ký tự đầu của thân làm số đếm, bỏ số 0 đầu, đệm đủ 3 chữ số
 *    (`W-000014WALL` -> `W-014`). Nếu mọi nhãn đó KHÔNG trùng nhau thì dùng chúng,
 *    nên mã do `createId` sinh và bộ mẫu QC giữ nguyên nhãn, và nhãn không dịch
 *    chỗ khi một thực thể bị xoá.
 * 2. Ngược lại (mã BE `<chữ>-<25 ký tự base36>` có mốc thời gian đứng đầu, mã
 *    bộ mẫu A14 `M-DIMN0000010` có chỉ số đứng sau, hay số đếm trùng nhau) thì
 *    đánh số cả danh sách theo THỨ TỰ của mã xếp tăng dần (`X-001`, `X-002`...).
 *    Với cả ba dạng mã, thứ tự
 *    tăng dần chính là thứ tự tạo, nên thực thể mới nối đuôi mà không đánh lại số cũ.
 *
 * ponytail: ở nhánh thứ tự, xoá một thực thể làm nhãn các thực thể sau nó dịch đi
 * một. Đường nâng cấp: đánh số trên hợp của ảnh chụp máy chủ đã tải và các mã hiện có.
 */
export const displayCodesOf = (ids: readonly string[]): ReadonlyMap<string, string> => {
  const counterCodes = ids.map(counterCodeOf);

  if (ids.every(isCounterLed) && new Set(counterCodes).size === new Set(ids).size) {
    return new Map(ids.map((id, index) => [id, counterCodes[index] as string] as const));
  }

  const sorted = [...new Set(ids)].sort();

  return new Map(
    sorted.map(
      (id, index) => [id, `${id.slice(0, 1)}-${String(index + 1).padStart(DISPLAY_CODE_DIGITS, '0')}`] as const,
    ),
  );
};

/** Checks whether a string is a valid id of any entity kind. */
export const isValidId = (id: string): boolean => readKindFromId(id) !== null;
