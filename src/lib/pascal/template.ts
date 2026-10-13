/**
 * "Lưu làm khuôn mẫu" từ inspector Pascal (#25).
 *
 * Chuyển từ `screens/viewer/PropertyInspector/propertyInspectorGateway.ts` (màn
 * cũ đã xoá) sang đây, giữ nguyên lời gọi máy chủ: `propertyTemplates.create`
 * với đúng bộ trường `PropertyTemplateFieldsByKind`. Pascal chỉ đưa id node;
 * thực thể đọc từ bản vẽ AppFront, nên khuôn mẫu là số của bản vẽ đã lưu.
 */

import type { ApiClient, PropertyTemplateDraft } from '@/api/client';
import { isEntityOfKind, type NormalizedSpatial, type SpatialEntity } from '@/domain/spatial/normalize';

import { bodyOfPascalId } from './ids';

/** Câu trả lời cho Pascal — nó hiện nguyên `message` dưới nút. */
export interface TemplateResult {
  readonly ok: boolean;
  readonly message: string;
}

const KIND_LABELS = { wall: 'tường', opening: 'ô mở', furniture: 'nội thất', room: 'phòng' } as const;

export const NO_PROJECT_REASON =
  'Chưa mở dự án nào nên chưa có nơi để lưu. Bản vẽ của bạn không có lỗi nào ở đây.';
export const NOT_IN_DRAWING_REASON =
  'Đối tượng này chưa có trong bản vẽ đã lưu, hoặc không lưu làm khuôn mẫu được. Chờ tự lưu xong rồi thử lại.';
export const templateFailedReason = (kind: string): string =>
  `Máy chủ chưa lưu được khuôn mẫu thuộc tính (${kind}). Chưa có khuôn nào được tạo.`;
export const templateSavedNotice = (name: string): string => `Đã lưu khuôn mẫu "${name}" cho dự án này.`;

/** Chỉ những thuộc tính đặt trước được — đúng các trường `PropertyTemplateFieldsByKind`. */
export function propertyTemplateDraftOf(entity: SpatialEntity): PropertyTemplateDraft | null {
  const nameOf = (kind: keyof typeof KIND_LABELS) => `Khuôn ${KIND_LABELS[kind]} ${entity.id}`;

  if (isEntityOfKind('wall', entity)) {
    return {
      fields: { heightMm: entity.heightMm, kind: entity.kind, thicknessMm: entity.thicknessMm },
      name: nameOf('wall'),
      objectKind: 'wall',
    };
  }
  if (isEntityOfKind('opening', entity)) {
    return {
      fields: {
        heightMm: entity.heightMm,
        sillHeightMm: entity.sillHeightMm,
        swing: entity.swing,
        widthMm: entity.widthMm,
      },
      name: nameOf('opening'),
      objectKind: 'opening',
    };
  }
  if (isEntityOfKind('room', entity)) {
    return { fields: { usage: entity.usage }, name: nameOf('room'), objectKind: 'room' };
  }
  if (isEntityOfKind('furniture', entity)) {
    return {
      fields: { kind: entity.kind, rotationDeg: entity.rotationDeg },
      name: nameOf('furniture'),
      objectKind: 'furniture',
    };
  }
  return null;
}

export interface SaveTemplateInput {
  readonly nodeId: string;
  readonly spatial: NormalizedSpatial | null;
  readonly projectId: string | null;
  readonly api: Pick<ApiClient, 'propertyTemplates'>;
}

export async function savePascalNodeAsTemplate(input: SaveTemplateInput): Promise<TemplateResult> {
  if (input.projectId === null) return { ok: false, message: NO_PROJECT_REASON };

  const entity = input.spatial?.byId[bodyOfPascalId(input.nodeId)];
  const draft = entity === undefined ? null : propertyTemplateDraftOf(entity);

  if (draft === null) return { ok: false, message: NOT_IN_DRAWING_REASON };

  const result = await input.api.propertyTemplates.create({ body: draft, projectId: input.projectId });

  return result.ok
    ? { ok: true, message: templateSavedNotice(draft.name) }
    : { ok: false, message: templateFailedReason(result.error.kind) };
}
