/**
 * Shared constants and types for the QA-08 ML API packs (P13, P14, P15). Re-exported by each P<n>.ts so specs keep their imports.
 *
 * Exports:
 *   ML: string                         '/api/admin/ml'
 *   NO_JOB / NO_DATASET / NO_DATASET_VERSION / NO_MODEL_VERSION: string   well-formed ids no row carries (job_/dst_/dsv_/mdl_ + 26 zeros)
 *   OPENING: string                    'openingAndFurnitureDetection'
 *   FAMILIES: readonly ['wallSegmentation', OPENING, 'dimensionReading']   (families.py order)
 *   type Json = Record<string, unknown>
 *   asJson(value: unknown): Json       throws when not a plain object (P13 + P15)
 * Kept per pack (different signature or semantics): call, expectError, Sent, asJson in P14 (expect-based), itemsOf.
 */
const ULID0 = '0'.repeat(26); // Crockford ULID body that no row carries (packages/core/ids.py:35)
export const ML = '/api/admin/ml';
export const NO_JOB = `job_${ULID0}`;
export const NO_DATASET = `dst_${ULID0}`;
export const NO_DATASET_VERSION = `dsv_${ULID0}`;
export const NO_MODEL_VERSION = `mdl_${ULID0}`;
export const OPENING = 'openingAndFurnitureDetection';
export const FAMILIES = ['wallSegmentation', OPENING, 'dimensionReading'] as const;
export type Json = Record<string, unknown>;

export const asJson = (value: unknown): Json => {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) throw new Error(`expected a JSON object, got ${JSON.stringify(value)}`);
  return value as Json;
};
