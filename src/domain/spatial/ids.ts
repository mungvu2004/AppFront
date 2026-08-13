/**
 * Id generation and validation for the spatial graph.
 *
 * Id format: `<prefix>-<body>`, where the body is an uppercase base36 string
 * made of two parts joined together:
 * - the first 6 characters are a per-kind counter, so two ids can never
 *   collide within one session;
 * - the last 4 characters are random, which keeps collisions unlikely when
 *   data from several sessions or machines is merged.
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
const RANDOM_LENGTH = 4;
const ID_BODY_PATTERN = /^[0-9A-Z]+$/;
const MIN_BODY_LENGTH = COUNTER_LENGTH + RANDOM_LENGTH;

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
  let suffix = '';

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

/** Checks whether a string is a valid id of any entity kind. */
export const isValidId = (id: string): boolean => readKindFromId(id) !== null;
