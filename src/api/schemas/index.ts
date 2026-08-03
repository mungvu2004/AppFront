import { z } from 'zod';

const idSchema = z.string().min(1);
const isoDateTimeSchema = z.string().datetime({ offset: true });
const mmIntegerSchema = z.number().int();
const positiveMmIntegerSchema = mmIntegerSchema.positive();

export const NguoiDungSchema = z
  .object({
    anhDaiDienUrl: z.string().url().optional(),
    email: z.string().email(),
    id: idSchema,
    ten: z.string().min(1),
    vaiTro: z.enum(['quanTri', 'kySu', 'nguoiXem']),
  })
  .strict();

export type NguoiDung = z.infer<typeof NguoiDungSchema>;

export const BanVeSchema = z
  .object({
    chieuCao: positiveMmIntegerSchema,
    chieuRong: positiveMmIntegerSchema,
    id: idSchema,
    nguoiTaiLenId: idSchema,
    taiLenLuc: isoDateTimeSchema,
    ten: z.string().min(1),
    tiLe: z.number().positive().optional(),
    url: z.string().url(),
  })
  .strict();

export type BanVe = z.infer<typeof BanVeSchema>;

export const TangSchema = z
  .object({
    banVe: z.array(BanVeSchema),
    caoDo: mmIntegerSchema,
    chieuCao: positiveMmIntegerSchema,
    dienTich: z.number().nonnegative().optional(),
    id: idSchema,
    ten: z.string().min(1),
    thuTu: z.number().int(),
  })
  .strict();

export type Tang = z.infer<typeof TangSchema>;

export const TienTrinhAISchema = z
  .object({
    batDauLuc: isoDateTimeSchema.optional(),
    buoc: z.string().min(1),
    id: idSchema,
    ketThucLuc: isoDateTimeSchema.optional(),
    loi: z.string().min(1).optional(),
    tienDo: z.number().int().min(0).max(100),
    trangThai: z.enum(['choXuLy', 'dangChay', 'hoanThanh', 'thatBai']),
  })
  .strict();

export type TienTrinhAI = z.infer<typeof TienTrinhAISchema>;

export const PhienBanSchema = z
  .object({
    duAnId: idSchema,
    ghiChu: z.string().min(1).optional(),
    id: idSchema,
    nguoiTaoId: idSchema,
    so: z.number().int().positive(),
    taoLuc: isoDateTimeSchema,
  })
  .strict();

export type PhienBan = z.infer<typeof PhienBanSchema>;

export const DuAnSchema = z
  .object({
    capNhatLuc: isoDateTimeSchema,
    diaChi: z.string().min(1).optional(),
    id: idSchema,
    ma: z.string().min(1).optional(),
    phienBanHienTai: PhienBanSchema.optional(),
    tang: z.array(TangSchema),
    taoLuc: isoDateTimeSchema,
    ten: z.string().min(1),
    thanhVien: z.array(NguoiDungSchema),
    tienTrinhAI: TienTrinhAISchema.optional(),
    trangThai: z.enum(['nhap', 'dangXuLy', 'daDuyet', 'loi']),
  })
  .strict();

export type DuAn = z.infer<typeof DuAnSchema>;
