import { z } from 'zod';

/**
 * N39–N43 — tài liệu nhiều bản vẽ và vùng trên trang (PHASE-1-CONTRACT §4, §5.1).
 *
 * Khoá camelCase như trên dây, mọi object `.strict()`: khoá lạ là lệch hợp đồng,
 * không phải thứ để lặng lẽ bỏ qua.
 */

export const DrawingTypeSchema = z.enum(['floorPlan', 'section', 'elevation', 'detail', 'other', 'unknown']);
export const OriginSchema = z.enum(['ai', 'user']);
export const DocumentStatusSchema = z.enum(['uploading', 'analyzing', 'ready', 'failed']);

/** Toạ độ tỉ lệ trang, 0..1. */
const unit = z.number().min(0).max(1);

export const RegionBoxSchema = z
  .object({ x0: unit, y0: unit, x1: unit, y1: unit })
  .strict()
  .refine((box) => box.x0 < box.x1 && box.y0 < box.y1, { message: 'box' });

export const DrawingRegionSchema = z
  .object({
    id: z.string().min(1),
    box: RegionBoxSchema,
    drawingType: DrawingTypeSchema,
    typeSource: OriginSchema,
    typeSignals: z.array(z.string()),
    source: OriginSchema,
    status: z.enum(['proposed', 'confirmed']),
    floorId: z.string().nullable(),
    version: z.number().int().min(1),
    runUploadId: z.string().nullable(),
  })
  .strict();

export const DocumentPageSchema = z
  .object({
    pageIndex: z.number().int().min(0),
    previewUrl: z.string().nullable(),
    widthPx: z.number().int().positive().nullable(),
    heightPx: z.number().int().positive().nullable(),
    regions: z.array(DrawingRegionSchema),
  })
  .strict();

export const DocumentSchema = z
  .object({
    id: z.string().min(1),
    fileName: z.string(),
    status: DocumentStatusSchema,
    pageCount: z.number().int().min(1).nullable(),
    errorCode: z.string().nullable(),
    createdAt: z.string(),
    pages: z.array(DocumentPageSchema),
  })
  .strict();

/** N41 — tóm tắt, không có `pages`. */
export const DocumentSummarySchema = DocumentSchema.omit({ pages: true })
  .extend({
    regionCount: z.number().int().min(0),
    floorPlanCount: z.number().int().min(0),
    unknownCount: z.number().int().min(0),
  })
  .strict();

export const DocumentListSchema = z.object({ items: z.array(DocumentSummarySchema) }).strict();

/** N39 — khúc/hoàn tất đi lại #6/#7 với `uploadId` này. */
export const InitDocumentUploadResponseSchema = z
  .object({
    documentId: z.string(),
    uploadId: z.string(),
    chunkSizeBytes: z.number().int().positive(),
    chunkCount: z.number().int().positive(),
  })
  .strict();

export const RegionWarningSchema = z
  .object({ code: z.literal('REGION_OVERLAP'), regionIds: z.array(z.string()) })
  .strict();

/** N42 — một phần tử `pages[]` của N40 cộng `warnings` (luôn có, có thể rỗng). */
export const PutRegionsResponseSchema = DocumentPageSchema.extend({ warnings: z.array(RegionWarningSchema) }).strict();

/** N43 — vùng không phải `floorPlan` được xác nhận nhưng không có trong `runs`. */
export const ConfirmRegionsResponseSchema = z
  .object({
    runs: z.array(z.object({ regionId: z.string(), floorId: z.string(), uploadId: z.string() }).strict()),
  })
  .strict();

export type DrawingType = z.infer<typeof DrawingTypeSchema>;
export type RegionBox = z.infer<typeof RegionBoxSchema>;
export type DrawingRegion = z.infer<typeof DrawingRegionSchema>;
export type DocumentPage = z.infer<typeof DocumentPageSchema>;
export type DocumentDetail = z.infer<typeof DocumentSchema>;
export type DocumentSummary = z.infer<typeof DocumentSummarySchema>;
export type InitDocumentUploadResponse = z.infer<typeof InitDocumentUploadResponseSchema>;
export type PutRegionsResponse = z.infer<typeof PutRegionsResponseSchema>;
export type ConfirmRegionsResponse = z.infer<typeof ConfirmRegionsResponseSchema>;

/** Thân gửi N42 — kiểu TS, không parse. `id` và `version` đi cùng nhau. */
export interface PutRegionInput {
  id?: string;
  version?: number;
  box: RegionBox;
  drawingType: DrawingType;
  floorId?: string | null;
}
