import { z } from 'zod';

const idSchema = z.string().min(1);
const isoDateTimeSchema = z.string().datetime({ offset: true });
const mmIntegerSchema = z.number().int();
const positiveMmIntegerSchema = mmIntegerSchema.positive();

const userRoleByWire = {
  admin: 'admin',
  engineer: 'engineer',
  viewer: 'viewer',
} as const;

const progressStatusByWire = {
  completed: 'completed',
  failed: 'failed',
  pending: 'pending',
  running: 'running',
} as const;

const projectStatusByWire = {
  approved: 'approved',
  draft: 'draft',
  error: 'error',
  processing: 'processing',
} as const;

const wireUserRoleSchema = z.enum(['admin', 'engineer', 'viewer']);
const wireProgressStatusSchema = z.enum(['pending', 'running', 'completed', 'failed']);
const wireProjectStatusSchema = z.enum(['draft', 'processing', 'approved', 'error']);

export const UserSchema = z
  .object({
    avatarUrl: z.string().url().optional(),
    email: z.string().email(),
    id: idSchema,
    name: z.string().min(1),
    role: wireUserRoleSchema,
  })
  .strict()
  .transform((wireUser) => ({
    ...(wireUser.avatarUrl !== undefined ? { avatarUrl: wireUser.avatarUrl } : {}),
    email: wireUser.email,
    id: wireUser.id,
    name: wireUser.name,
    role: userRoleByWire[wireUser.role],
  }));

export type User = z.infer<typeof UserSchema>;
export type UserWire = z.input<typeof UserSchema>;
export type UserRole = User['role'];

export const DrawingSchema = z
  .object({
    heightMm: positiveMmIntegerSchema,
    id: idSchema,
    name: z.string().min(1),
    scale: z.number().positive().optional(),
    uploadedAt: isoDateTimeSchema,
    uploaderId: idSchema,
    url: z.string().url(),
    widthMm: positiveMmIntegerSchema,
  })
  .strict()
  .transform((wireDrawing) => ({
    heightMm: wireDrawing.heightMm,
    id: wireDrawing.id,
    name: wireDrawing.name,
    ...(wireDrawing.scale !== undefined ? { scale: wireDrawing.scale } : {}),
    uploadedAt: wireDrawing.uploadedAt,
    uploaderId: wireDrawing.uploaderId,
    url: wireDrawing.url,
    widthMm: wireDrawing.widthMm,
  }));

export type Drawing = z.infer<typeof DrawingSchema>;
export type DrawingWire = z.input<typeof DrawingSchema>;

export const FloorSchema = z
  .object({
    areaM2: z.number().nonnegative().optional(),
    drawings: z.array(DrawingSchema),
    elevationMm: mmIntegerSchema,
    heightMm: positiveMmIntegerSchema,
    id: idSchema,
    name: z.string().min(1),
    order: z.number().int(),
  })
  .strict()
  .transform((wireFloor) => ({
    ...(wireFloor.areaM2 !== undefined ? { areaM2: wireFloor.areaM2 } : {}),
    drawings: wireFloor.drawings,
    elevationMm: wireFloor.elevationMm,
    heightMm: wireFloor.heightMm,
    id: wireFloor.id,
    name: wireFloor.name,
    order: wireFloor.order,
  }));

export type Floor = z.infer<typeof FloorSchema>;
export type FloorWire = z.input<typeof FloorSchema>;

export const ProgressSchema = z
  .object({
    endedAt: isoDateTimeSchema.optional(),
    error: z.string().min(1).optional(),
    id: idSchema,
    progressPercent: z.number().int().min(0).max(100),
    startedAt: isoDateTimeSchema.optional(),
    status: wireProgressStatusSchema,
    step: z.string().min(1),
  })
  .strict()
  .transform((wireProgress) => ({
    ...(wireProgress.endedAt !== undefined ? { endedAt: wireProgress.endedAt } : {}),
    ...(wireProgress.error !== undefined ? { error: wireProgress.error } : {}),
    id: wireProgress.id,
    progressPercent: wireProgress.progressPercent,
    ...(wireProgress.startedAt !== undefined ? { startedAt: wireProgress.startedAt } : {}),
    status: progressStatusByWire[wireProgress.status],
    step: wireProgress.step,
  }));

export type Progress = z.infer<typeof ProgressSchema>;
export type ProgressWire = z.input<typeof ProgressSchema>;
export type ProgressStatus = Progress['status'];

export const VersionSchema = z
  .object({
    createdAt: isoDateTimeSchema,
    creatorId: idSchema,
    id: idSchema,
    note: z.string().min(1).optional(),
    projectId: idSchema,
    sequence: z.number().int().positive(),
  })
  .strict()
  .transform((wireVersion) => ({
    createdAt: wireVersion.createdAt,
    creatorId: wireVersion.creatorId,
    id: wireVersion.id,
    ...(wireVersion.note !== undefined ? { note: wireVersion.note } : {}),
    projectId: wireVersion.projectId,
    sequence: wireVersion.sequence,
  }));

export type Version = z.infer<typeof VersionSchema>;
export type VersionWire = z.input<typeof VersionSchema>;

export const ProjectSchema = z
  .object({
    address: z.string().min(1).optional(),
    code: z.string().min(1).optional(),
    createdAt: isoDateTimeSchema,
    currentVersion: VersionSchema.optional(),
    floors: z.array(FloorSchema),
    id: idSchema,
    members: z.array(UserSchema),
    name: z.string().min(1),
    progress: ProgressSchema.optional(),
    status: wireProjectStatusSchema,
    updatedAt: isoDateTimeSchema,
  })
  .strict()
  .transform((wireProject) => ({
    ...(wireProject.address !== undefined ? { address: wireProject.address } : {}),
    ...(wireProject.code !== undefined ? { code: wireProject.code } : {}),
    createdAt: wireProject.createdAt,
    ...(wireProject.currentVersion !== undefined ? { currentVersion: wireProject.currentVersion } : {}),
    floors: wireProject.floors,
    id: wireProject.id,
    members: wireProject.members,
    name: wireProject.name,
    ...(wireProject.progress !== undefined ? { progress: wireProject.progress } : {}),
    status: projectStatusByWire[wireProject.status],
    updatedAt: wireProject.updatedAt,
  }));

export type Project = z.infer<typeof ProjectSchema>;
export type ProjectWire = z.input<typeof ProjectSchema>;
export type ProjectStatus = Project['status'];
