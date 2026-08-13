import { describe, expect, it } from 'vitest';

import { createId, type EntityKind, ID_PREFIX_BY_KIND, isIdOfKind, isValidId, readKindFromId } from '../ids';

const ALL_KINDS = Object.keys(ID_PREFIX_BY_KIND) as EntityKind[];

describe('createId', () => {
  it('prefixes every generated id with the letter reserved for its kind', () => {
    expect(createId('wall').startsWith('W-')).toBe(true);
    expect(createId('opening').startsWith('D-')).toBe(true);
    expect(createId('furniture').startsWith('F-')).toBe(true);
    expect(createId('room').startsWith('R-')).toBe(true);
    expect(createId('axis').startsWith('A-')).toBe(true);
    expect(createId('dimension').startsWith('M-')).toBe(true);
    expect(createId('level').startsWith('L-')).toBe(true);
  });

  it('produces 10000 distinct ids for a single kind', () => {
    const ids = new Set<string>();

    for (let index = 0; index < 10_000; index += 1) {
      ids.add(createId('wall'));
    }

    expect(ids.size).toBe(10_000);
  });

  it('produces 10000 distinct ids when kinds are interleaved', () => {
    const ids = new Set<string>();

    for (let index = 0; index < 10_000; index += 1) {
      const kind = ALL_KINDS[index % ALL_KINDS.length];

      if (kind === undefined) {
        throw new Error('kind list must not be empty');
      }

      ids.add(createId(kind));
    }

    expect(ids.size).toBe(10_000);
  });

  it('accepts every generated id as valid for its own kind', () => {
    for (const kind of ALL_KINDS) {
      const id = createId(kind);

      expect(isIdOfKind(kind, id)).toBe(true);
      expect(readKindFromId(id)).toBe(kind);
    }
  });
});

describe('isIdOfKind', () => {
  it('rejects an id whose prefix belongs to another kind', () => {
    const wallId = createId('wall');

    expect(isIdOfKind('room', wallId)).toBe(false);
  });

  it('rejects ids with a missing, misplaced or repeated separator', () => {
    expect(isIdOfKind('wall', 'W000001AB2C')).toBe(false);
    expect(isIdOfKind('wall', 'WW-000001AB2C')).toBe(false);
    expect(isIdOfKind('wall', '-W000001AB2C')).toBe(false);
  });

  it('rejects a body that is too short', () => {
    expect(isIdOfKind('wall', 'W-000001AB')).toBe(false);
    expect(isIdOfKind('wall', 'W-')).toBe(false);
  });

  it('rejects a body containing lowercase letters or punctuation', () => {
    expect(isIdOfKind('wall', 'W-000001ab2c')).toBe(false);
    expect(isIdOfKind('wall', 'W-000001-B2C')).toBe(false);
    expect(isIdOfKind('wall', 'W-000001 B2C')).toBe(false);
  });

  it('narrows the id type when it returns true', () => {
    const candidate: string = createId('wall');

    if (isIdOfKind('wall', candidate)) {
      const narrowed: `W-${string}` = candidate;

      expect(narrowed).toBe(candidate);
    } else {
      throw new Error('a generated wall id must pass its own validator');
    }
  });
});

describe('readKindFromId', () => {
  it('maps each prefix back to its kind', () => {
    expect(readKindFromId('W-000001AB2C')).toBe('wall');
    expect(readKindFromId('D-000001AB2C')).toBe('opening');
    expect(readKindFromId('F-000001AB2C')).toBe('furniture');
    expect(readKindFromId('R-000001AB2C')).toBe('room');
    expect(readKindFromId('A-000001AB2C')).toBe('axis');
    expect(readKindFromId('M-000001AB2C')).toBe('dimension');
    expect(readKindFromId('L-000001AB2C')).toBe('level');
  });

  it('returns null for an unknown prefix or a malformed body', () => {
    expect(readKindFromId('X-000001AB2C')).toBeNull();
    expect(readKindFromId('W-0001')).toBeNull();
    expect(readKindFromId('')).toBeNull();
  });
});

describe('isValidId', () => {
  it('accepts ids of every kind and rejects foreign identifiers', () => {
    for (const kind of ALL_KINDS) {
      expect(isValidId(createId(kind))).toBe(true);
    }

    expect(isValidId('wall-1')).toBe(false);
    expect(isValidId('W_000001AB2C')).toBe(false);
  });
});
