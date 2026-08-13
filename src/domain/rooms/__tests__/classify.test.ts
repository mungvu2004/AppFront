import { describe, expect, it } from 'vitest';

import type { RoomUsage } from '../../spatial/types';
import { squareMetres } from '../../units/types';
import {
  describeUsage,
  suggestRoomUsage,
  USAGE_CONFIDENCE,
  USAGE_THRESHOLDS,
  type RoomSignals,
} from '../classify';

/* -------------------------------------------------------------------------- */
/* Fixtures.                                                                   */
/* -------------------------------------------------------------------------- */

function signals(areaM2: number, doorCount: number, slenderness?: number): RoomSignals {
  return slenderness === undefined
    ? { areaM2: squareMetres(areaM2), doorCount }
    : { areaM2: squareMetres(areaM2), doorCount, slenderness };
}

/** Every use the graph knows, so the label table can be checked in full. */
const EVERY_USAGE: readonly RoomUsage[] = [
  'livingRoom',
  'bedroom',
  'kitchen',
  'bathroom',
  'corridor',
  'stairwell',
  'utility',
  'other',
];

/* -------------------------------------------------------------------------- */
/* Tests.                                                                      */
/* -------------------------------------------------------------------------- */

describe('what the rules suggest', () => {
  it('reads a room the size of a bedroom behind one door as a bedroom', () => {
    const suggestion = suggestRoomUsage(signals(15, 1));

    expect(suggestion.usage).toBe('bedroom');
    expect(suggestion.label).toBe('Phòng ngủ');
    expect(suggestion.confidence).toBe(USAGE_CONFIDENCE.fair);
  });

  it('is less sure of a bedroom with a second door', () => {
    const suggestion = suggestRoomUsage(signals(15, 2));

    expect(suggestion.usage).toBe('bedroom');
    expect(suggestion.confidence).toBe(USAGE_CONFIDENCE.weak);
  });

  it('reads a small room behind one door as a bathroom', () => {
    const suggestion = suggestRoomUsage(signals(4, 1));

    expect(suggestion.usage).toBe('bathroom');
    expect(suggestion.label).toBe('Vệ sinh');
  });

  it('reads the space three doors open onto as a corridor', () => {
    const suggestion = suggestRoomUsage(signals(18, 5));

    expect(suggestion.usage).toBe('corridor');
    expect(suggestion.label).toBe('Hành lang');
    expect(suggestion.confidence).toBe(USAGE_CONFIDENCE.fair);
  });

  it('is surest of a corridor that is long and thin as well as busy', () => {
    const suggestion = suggestRoomUsage(signals(18, 5, 60));

    expect(suggestion.usage).toBe('corridor');
    expect(suggestion.confidence).toBe(USAGE_CONFIDENCE.strong);
  });

  it('reads a long thin space with one door as a corridor, but only just', () => {
    const suggestion = suggestRoomUsage(signals(12, 1, 60));

    expect(suggestion.usage).toBe('corridor');
    expect(suggestion.confidence).toBe(USAGE_CONFIDENCE.weak);
  });

  it('reads a space with no way into it as a shaft', () => {
    const suggestion = suggestRoomUsage(signals(1.2, 0));

    expect(suggestion.usage).toBe('utility');
    expect(suggestion.label).toBe('Kỹ thuật');
    expect(suggestion.confidence).toBe(USAGE_CONFIDENCE.strong);
  });

  it('reads any space under two square metres as services', () => {
    const suggestion = suggestRoomUsage(signals(1.5, 1));

    expect(suggestion.usage).toBe('utility');
    expect(suggestion.confidence).toBe(USAGE_CONFIDENCE.weak);
  });
});

describe('what the rules refuse to guess', () => {
  it('says nothing about a room too big for the table', () => {
    const suggestion = suggestRoomUsage(signals(35, 2));

    expect(suggestion.usage).toBeNull();
    expect(suggestion.label).toBe('Không xác định');
    expect(suggestion.confidence).toBe(USAGE_CONFIDENCE.none);
  });

  it('says nothing about the gap between a bathroom and a bedroom', () => {
    expect(suggestRoomUsage(signals(7.5, 1)).usage).toBeNull();
  });

  it('says nothing about a full-sized room with no door', () => {
    // Two square metres of shaft is one thing; twelve with no way in is a
    // drawing to look at, not a room to name.
    expect(suggestRoomUsage(signals(12, 0)).usage).toBeNull();
  });

  it('gives a reason even when it has no answer', () => {
    const suggestion = suggestRoomUsage(signals(35, 2));

    expect(suggestion.reason).toContain('35,00 m²');
    expect(suggestion.reason).toContain('2 cửa');
    expect(suggestion.reason.length).toBeGreaterThan(20);
  });
});

describe('the order the rules are tried in', () => {
  it('lets a busy small room be circulation rather than a bathroom', () => {
    // Five square metres would read as a WC on area alone; four doors say it is
    // the lobby they all open onto.
    expect(suggestRoomUsage(signals(5, 4)).usage).toBe('corridor');
    expect(suggestRoomUsage(signals(5, 1)).usage).toBe('bathroom');
  });

  it('lets a busy large room be circulation rather than a bedroom', () => {
    expect(suggestRoomUsage(signals(20, 4)).usage).toBe('corridor');
    expect(suggestRoomUsage(signals(20, 1)).usage).toBe('bedroom');
  });

  it('calls a space too small to stand in services however many doors it has', () => {
    expect(suggestRoomUsage(signals(1.8, 4)).usage).toBe('utility');
  });
});

describe('the edges of every range', () => {
  it('takes the services threshold as included', () => {
    expect(suggestRoomUsage(signals(USAGE_THRESHOLDS.servicesMaxAreaM2, 1)).usage).toBe('utility');
  });

  it('takes both ends of the bathroom range as included', () => {
    expect(suggestRoomUsage(signals(USAGE_THRESHOLDS.bathroomMaxAreaM2, 1)).usage).toBe('bathroom');
    expect(suggestRoomUsage(signals(USAGE_THRESHOLDS.bathroomMaxAreaM2 + 0.5, 1)).usage).toBeNull();
  });

  it('takes both ends of the bedroom range as included', () => {
    expect(suggestRoomUsage(signals(USAGE_THRESHOLDS.bedroomMinAreaM2, 1)).usage).toBe('bedroom');
    expect(suggestRoomUsage(signals(USAGE_THRESHOLDS.bedroomMaxAreaM2, 1)).usage).toBe('bedroom');
    expect(suggestRoomUsage(signals(USAGE_THRESHOLDS.bedroomMaxAreaM2 + 0.5, 1)).usage).toBeNull();
  });

  it('takes the corridor door count as included', () => {
    expect(suggestRoomUsage(signals(18, USAGE_THRESHOLDS.corridorMinDoorCount)).usage).toBe(
      'corridor',
    );
    expect(suggestRoomUsage(signals(18, USAGE_THRESHOLDS.corridorMinDoorCount - 1)).usage).toBe(
      'bedroom',
    );
  });

  it('takes the slenderness threshold as included', () => {
    expect(
      suggestRoomUsage(signals(12, 1, USAGE_THRESHOLDS.corridorMinSlenderness)).usage,
    ).toBe('corridor');
    // A square is 16, well below the threshold, so shape says nothing.
    expect(suggestRoomUsage(signals(12, 1, 16)).usage).toBe('bedroom');
  });
});

describe('the promise a suggestion makes', () => {
  it('always carries a confidence inside [0, 1]', () => {
    const cases = [
      signals(1.2, 0),
      signals(4, 1),
      signals(15, 1),
      signals(18, 5),
      signals(35, 2),
      signals(0, 0),
    ];

    for (const each of cases) {
      const suggestion = suggestRoomUsage(each);
      expect(suggestion.confidence).toBeGreaterThanOrEqual(0);
      expect(suggestion.confidence).toBeLessThanOrEqual(1);
    }
  });

  it('never suggests anything at full confidence', () => {
    // Nothing this file produces has been looked at by a person, so nothing it
    // produces is ever certain.
    const cases = [signals(1.2, 0), signals(4, 1), signals(15, 1), signals(18, 5, 60)];

    for (const each of cases) {
      expect(suggestRoomUsage(each).confidence).toBeLessThan(1);
    }
  });

  it('always carries a reason and a label', () => {
    const cases = [signals(1.2, 0), signals(4, 1), signals(15, 1), signals(18, 5), signals(35, 2)];

    for (const each of cases) {
      const suggestion = suggestRoomUsage(each);
      expect(suggestion.label.length).toBeGreaterThan(0);
      expect(suggestion.reason.length).toBeGreaterThan(0);
    }
  });

  it('gives the same answer every time it is asked', () => {
    expect(suggestRoomUsage(signals(15, 1))).toEqual(suggestRoomUsage(signals(15, 1)));
  });

  it('leaves the signals it was given untouched', () => {
    const given = signals(15, 1, 20);
    const before = JSON.stringify(given);
    suggestRoomUsage(given);

    expect(JSON.stringify(given)).toBe(before);
  });
});

describe('the Vietnamese names', () => {
  it('has one for every use the graph knows', () => {
    for (const usage of EVERY_USAGE) {
      expect(describeUsage(usage).length).toBeGreaterThan(0);
    }
  });

  it('has one for not knowing', () => {
    expect(describeUsage(null)).toBe('Không xác định');
  });

  it('names the four the brief asks for', () => {
    expect(describeUsage('bedroom')).toBe('Phòng ngủ');
    expect(describeUsage('bathroom')).toBe('Vệ sinh');
    expect(describeUsage('corridor')).toBe('Hành lang');
    expect(describeUsage('utility')).toBe('Kỹ thuật');
  });

  it('is the same name the suggestion carries', () => {
    const suggestion = suggestRoomUsage(signals(15, 1));

    expect(suggestion.label).toBe(describeUsage(suggestion.usage));
  });
});
