import { z } from 'zod';

import { FURNITURE_VARIANTS } from '@/domain/spatial/types';

import { isoInstantSchema } from './common';
import { materialRefSchema } from './spatial';

/**
 * N47, N48 — AI chọn phong cách nội thất cho căn (AID-01, `docs/ai-design-director/HOP-DONG-AID-01.md`).
 *
 * W2: trường tuỳ chọn VẮNG, không `null` — `styleId` vắng tới khi lượt AI-tự-chọn chọn xong,
 * `startedAt` khi đã rời hàng chờ, `endedAt` khi đã kết thúc, `failureCode` khi hỏng, `result` khi xong.
 */
export const DESIGN_STYLE_IDS = [
  'japandi',
  'scandinavian',
  'modern-min',
  'modern-lux',
  'indochine',
  'wabi-sabi',
  'industrial',
  'tropical',
  'korean-min',
  'neoclassic',
  'midcentury',
  'rustic',
] as const;
export type DesignStyleId = (typeof DESIGN_STYLE_IDS)[number];

export const DESIGN_CONCEPT_STATUSES = ['queued', 'running', 'done', 'failed'] as const;

/** Khoá `models` = `FurnitureRole` của FE trừ `stair`/`fixed` (hợp đồng, mục "Vai trò đồ"). */
export const DESIGN_MODEL_ROLES = [
  'doubleBed',
  'singleBed',
  'closet',
  'dresser',
  'bookshelf',
  'diningChair',
  'armchair',
  'sofa',
  'nightstand',
  'coffeeTable',
  'desk',
  'diningTable',
  'fridge',
  'counter',
  'toilet',
  'bathtub',
  'shower',
  'basin',
  'washer',
  'plant',
  'smallPlant',
  'rug',
  'roundRug',
] as const;

const FLOOR_FINISHES = ['wood', 'tile', 'mosaic', 'decking', 'concrete'] as const;
const BASE_STYLES = ['am-ap', 'hien-dai-sang', 'go-am', 'toi-gian', 'sang-trong-toi'] as const;
const FURNITURE_KINDS = [
  'table',
  'chair',
  'bed',
  'wardrobe',
  'kitchenCabinet',
  'sanitaryFixture',
  'washingMachine',
  'shower',
  'stair',
  'other',
] as const;

const positiveMm = z.number().positive();

export const DesignAdditionSchema = z
  .object({
    levelId: z.string().min(1),
    roomId: z.string().min(1),
    kind: z.enum(FURNITURE_KINDS),
    variant: z.enum(FURNITURE_VARIANTS).optional(),
    centre: z.object({ x: z.number(), y: z.number() }).strict(),
    widthMm: positiveMm,
    depthMm: positiveMm,
    rotationDeg: z.number(),
    modelId: z.string().min(1).optional(),
  })
  .strict();

export type DesignAddition = z.infer<typeof DesignAdditionSchema>;

export const DesignResultSchema = z
  .object({
    nameVi: z.string(),
    summaryVi: z.string(),
    baseStyle: z.enum(BASE_STYLES),
    wall: z
      .object({ interior: materialRefSchema, exterior: materialRefSchema.optional() })
      .strict(),
    floor: z.record(z.enum(FLOOR_FINISHES), materialRefSchema),
    models: z.record(z.enum(DESIGN_MODEL_ROLES), z.string().min(1)),
    additions: z.array(DesignAdditionSchema),
  })
  .strict();

export type DesignResult = z.infer<typeof DesignResultSchema>;

export const DesignConceptSchema = z
  .object({
    id: z.string().regex(/^dcn_/),
    styleId: z.enum(DESIGN_STYLE_IDS).optional(),
    suggested: z.boolean(),
    status: z.enum(DESIGN_CONCEPT_STATUSES),
    failureCode: z.string().min(1).optional(),
    createdAt: isoInstantSchema,
    startedAt: isoInstantSchema.optional(),
    endedAt: isoInstantSchema.optional(),
    result: DesignResultSchema.optional(),
  })
  .strict()
  .refine((c) => (c.endedAt !== undefined) === (c.status === 'done' || c.status === 'failed'), {
    message: 'endedAt chỉ có khi lượt đã kết thúc',
    path: ['endedAt'],
  })
  .refine((c) => (c.failureCode !== undefined) === (c.status === 'failed'), {
    message: 'failureCode chỉ có khi lượt hỏng',
    path: ['failureCode'],
  })
  .refine((c) => (c.result !== undefined) === (c.status === 'done'), {
    message: 'result chỉ có khi lượt đã xong',
    path: ['result'],
  });

export type DesignConcept = z.infer<typeof DesignConceptSchema>;

export const DesignConceptStateSchema = z
  .object({
    enabled: z.boolean(),
    suggestedStyleId: z.enum(DESIGN_STYLE_IDS).optional(),
    active: DesignConceptSchema.optional(),
  })
  .strict();

export type DesignConceptState = z.infer<typeof DesignConceptStateSchema>;
