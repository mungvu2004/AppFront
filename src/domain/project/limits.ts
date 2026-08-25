/**
 * The numeric bounds a project and its floors are validated against.
 *
 * This is business rule, not UI: two different screens editing the same
 * project (create it, or later rename it and add a floor) must reject the
 * same inputs the same way, and a form field is the wrong place to own a rule
 * another form has to agree with independently. `src/screens/**` may only
 * call this, never redefine it (mục 0.4, R-61).
 *
 * `storeyHeightMinM`–`storeyHeightMaxM` (2,0–10,0 m) is this product's UX
 * range for a single floor's clear height — the widest a person is allowed to
 * type into the form. It is deliberately not
 * `src/domain/axes/alignFloors.ts`'s `MIN_CLEAR_HEIGHT_MM`–`MAX_CLEAR_HEIGHT_MM`
 * (2,4–6 m): that pair is the narrower structural range the alignment engine
 * checks a *detected* storey against once a real drawing exists, which is a
 * different question from what a person may still be typing while planning
 * one. The two ranges are allowed to disagree; this module is only ever the
 * answer to the first question.
 */

/** Shortest and longest a project name may be. */
export const PROJECT_NAME_MIN_LENGTH = 3;
export const PROJECT_NAME_MAX_LENGTH = 80;

/** Fewest and most floors a project may have, basement included. */
export const PROJECT_FLOOR_COUNT_MIN = 1;
export const PROJECT_FLOOR_COUNT_MAX = 50;

/** Lowest and highest a floor's elevation may sit, relative to the ground floor's 0. */
export const PROJECT_ELEVATION_MIN_M = -30;
export const PROJECT_ELEVATION_MAX_M = 300;

/** Shortest and tallest a single floor's clear height may be. See the file doc comment. */
export const PROJECT_STOREY_HEIGHT_MIN_M = 2;
export const PROJECT_STOREY_HEIGHT_MAX_M = 10;

/** Every bound above, grouped for the common case of importing them all. */
export const PROJECT_LIMITS = Object.freeze({
  nameMinLength: PROJECT_NAME_MIN_LENGTH,
  nameMaxLength: PROJECT_NAME_MAX_LENGTH,
  floorCountMin: PROJECT_FLOOR_COUNT_MIN,
  floorCountMax: PROJECT_FLOOR_COUNT_MAX,
  elevationMinM: PROJECT_ELEVATION_MIN_M,
  elevationMaxM: PROJECT_ELEVATION_MAX_M,
  storeyHeightMinM: PROJECT_STOREY_HEIGHT_MIN_M,
  storeyHeightMaxM: PROJECT_STOREY_HEIGHT_MAX_M,
});
