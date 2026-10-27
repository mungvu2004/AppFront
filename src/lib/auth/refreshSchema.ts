import { z } from 'zod';

/**
 * Hình dạng thân phản hồi `/auth/refresh`, tách khỏi `refresh.ts` để zod KHÔNG nằm
 * trong chunk vào.
 *
 * `refresh.ts` nằm trên đường khởi động (`SessionBootstrap`), mà zod 3 là một tệp
 * gộp (`zod/lib/index.mjs`, ~56 KiB thô) — rung cây không bỏ được gì, nhập tĩnh là
 * mang cả thư viện vào màn hình đầu tiên. Schema chỉ cần khi phản hồi đã về, nên
 * `refresh.ts` nạp module này bằng `import()` song song với POST refresh
 * (cổng kích thước gói, đo 2026-10-27: màn hình đầu tiên 185,6 KiB gzip).
 */
const roleSchema = z.union([
  z.literal('admin'),
  z.literal('engineer'),
  z.literal('viewer'),
]);

const refreshUserSchema = z
  .object({
    email: z.string().optional(),
    id: z.string().min(1),
    name: z.string().optional(),
    roles: z.array(roleSchema).optional(),
  })
  .passthrough();

const refreshPayloadSchema = z
  .object({
    accessToken: z.string().min(1).optional(),
    access_token: z.string().min(1).optional(),
    expiresAt: z.union([z.number(), z.string()]).optional(),
    expiresIn: z.number().optional(),
    expires_at: z.union([z.number(), z.string()]).optional(),
    expires_in: z.number().optional(),
    roles: z.array(roleSchema).optional(),
    user: refreshUserSchema.nullable().optional(),
  })
  .passthrough();

export type RefreshPayload = z.infer<typeof refreshPayloadSchema>;

export const refreshResponseSchema = z.union([
  z.object({ data: refreshPayloadSchema }).passthrough(),
  refreshPayloadSchema,
]);
