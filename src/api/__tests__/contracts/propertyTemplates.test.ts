import { describe, expect, it } from 'vitest';

import {
  PROPERTY_TEMPLATE_OBJECT_KINDS,
  PropertyTemplateDraftSchema,
  PropertyTemplateSchema,
} from '../../schemas/propertyTemplates';

/**
 * #28–#29 — mẫu thuộc tính, bốn nhánh theo `objectKind`.
 *
 * Bài kiểm quan trọng nhất ở đây không phải "nhánh tường có nhận độ dày không"
 * mà là **"nhánh phòng có TỪ CHỐI độ dày không"**. Đó là điều một `fields`
 * chung với mười khoá tuỳ chọn không làm được, và là lý do schema này là một
 * `discriminatedUnion`.
 */

const TEMPLATE_ID = 'tpl_01J9ZQK7X4N2M8P6R3T5V7W9Y1';
const PROJECT_ID = 'prj_01J9ZQK7X4N2M8P6R3T5V7W9Y1';

const base = {
  createdAt: '2026-09-17T05:09:00.123Z',
  id: TEMPLATE_ID,
  projectId: PROJECT_ID,
  scope: 'project',
} as const;

const fullWall = {
  ...base,
  fields: { heightMm: 3900, kind: 'partition', thicknessMm: 100 },
  name: 'Tường ngăn 100',
  objectKind: 'wall',
} as const;

const minimalWall = {
  ...base,
  fields: {},
  name: 'Tường ngăn 100',
  objectKind: 'wall',
} as const;

const fullOpening = {
  ...base,
  fields: { heightMm: 2200, sillHeightMm: 0, swing: 'left', widthMm: 900 },
  name: 'Cửa đi 900',
  objectKind: 'opening',
} as const;

const fullRoom = {
  ...base,
  fields: { usage: 'bedroom' },
  name: 'Phòng ngủ',
  objectKind: 'room',
} as const;

const fullFurniture = {
  ...base,
  fields: { kind: 'wardrobe', rotationDeg: 90 },
  name: 'Tủ áp tường',
  objectKind: 'furniture',
} as const;

describe('PROPERTY_TEMPLATE_OBJECT_KINDS', () => {
  it('là đúng bốn loại đối tượng', () => {
    expect(PROPERTY_TEMPLATE_OBJECT_KINDS).toStrictEqual(['wall', 'opening', 'room', 'furniture']);
  });
});

describe('PropertyTemplateSchema', () => {
  it.each([
    ['tường', fullWall],
    ['ô mở', fullOpening],
    ['phòng', fullRoom],
    ['đồ đạc', fullFurniture],
  ])('nhận mẫu %s đầy đủ', (_label, template) => {
    expect(PropertyTemplateSchema.parse(template)).toStrictEqual({ ...template });
  });

  it('nhận mẫu tối thiểu — fields rỗng là một mẫu không áp gì cả', () => {
    expect(PropertyTemplateSchema.parse(minimalWall)).toStrictEqual({ ...minimalWall });
  });

  it('từ chối khoá lạ ở thân ngoài', () => {
    expect(PropertyTemplateSchema.safeParse({ ...minimalWall, updatedAt: base.createdAt }).success).toBe(
      false,
    );
  });

  it('từ chối khoá lạ trong fields lồng', () => {
    expect(
      PropertyTemplateSchema.safeParse({ ...minimalWall, fields: { material: 'gạch' } }).success,
    ).toBe(false);
  });

  it('từ chối một trường của nhánh khác — đó là việc mà discriminatedUnion làm', () => {
    expect(
      PropertyTemplateSchema.safeParse({ ...fullRoom, fields: { thicknessMm: 220 } }).success,
    ).toBe(false);
    expect(
      PropertyTemplateSchema.safeParse({ ...fullWall, fields: { usage: 'bedroom' } }).success,
    ).toBe(false);
  });

  it.each([
    ['heightMm', { ...minimalWall, fields: { heightMm: null } }],
    ['kind', { ...minimalWall, fields: { kind: null } }],
    ['thicknessMm', { ...minimalWall, fields: { thicknessMm: null } }],
  ])('từ chối null ở trường tuỳ chọn %s', (_label, template) => {
    expect(PropertyTemplateSchema.safeParse(template).success).toBe(false);
  });

  it('từ chối objectKind ngoài bốn giá trị', () => {
    expect(PropertyTemplateSchema.safeParse({ ...minimalWall, objectKind: 'axis' }).success).toBe(
      false,
    );
  });

  it('từ chối scope ngoài project — giá trị mới là việc của v2', () => {
    expect(PropertyTemplateSchema.safeParse({ ...minimalWall, scope: 'user' }).success).toBe(false);
  });

  it.each([
    ['id sai tiền tố', { ...minimalWall, id: PROJECT_ID }],
    ['id quá ngắn', { ...minimalWall, id: 'tpl_01J9ZQK7X4' }],
    ['projectId sai tiền tố', { ...minimalWall, projectId: TEMPLATE_ID }],
  ])('từ chối %s', (_label, template) => {
    expect(PropertyTemplateSchema.safeParse(template).success).toBe(false);
  });

  it('từ chối tên rỗng và tên dài quá 120 ký tự', () => {
    expect(PropertyTemplateSchema.safeParse({ ...minimalWall, name: '' }).success).toBe(false);
    expect(
      PropertyTemplateSchema.safeParse({ ...minimalWall, name: 'a'.repeat(121) }).success,
    ).toBe(false);
    expect(
      PropertyTemplateSchema.safeParse({ ...minimalWall, name: 'a'.repeat(120) }).success,
    ).toBe(true);
  });

  it('từ chối kích thước 0, âm, hay thập phân', () => {
    expect(
      PropertyTemplateSchema.safeParse({ ...minimalWall, fields: { thicknessMm: 0 } }).success,
    ).toBe(false);
    expect(
      PropertyTemplateSchema.safeParse({ ...minimalWall, fields: { thicknessMm: -100 } }).success,
    ).toBe(false);
    expect(
      PropertyTemplateSchema.safeParse({ ...minimalWall, fields: { thicknessMm: 99.5 } }).success,
    ).toBe(false);
  });

  it('nhận bệ cửa 0 — cửa đi nằm sát sàn', () => {
    expect(
      PropertyTemplateSchema.safeParse({ ...fullOpening, fields: { sillHeightMm: 0 } }).success,
    ).toBe(true);
  });

  it('từ chối góc xoay 360, nhận 0 và 359', () => {
    expect(
      PropertyTemplateSchema.safeParse({ ...fullFurniture, fields: { rotationDeg: 360 } }).success,
    ).toBe(false);
    expect(
      PropertyTemplateSchema.safeParse({ ...fullFurniture, fields: { rotationDeg: 0 } }).success,
    ).toBe(true);
    expect(
      PropertyTemplateSchema.safeParse({ ...fullFurniture, fields: { rotationDeg: 359 } }).success,
    ).toBe(true);
  });

  it.each([
    ['tường', { ...fullWall, fields: { kind: 'sliding' } }],
    ['ô mở', { ...fullOpening, fields: { swing: 'up' } }],
    ['phòng', { ...fullRoom, fields: { usage: 'garage' } }],
    ['đồ đạc', { ...fullFurniture, fields: { kind: 'lamp' } }],
  ])('từ chối giá trị enum ngoài tập ở nhánh %s', (_label, template) => {
    expect(PropertyTemplateSchema.safeParse(template).success).toBe(false);
  });

  it('không có refine — mọi ràng buộc là kiểu, mẫu và nhánh', () => {
    expect(PropertyTemplateSchema.safeParse(fullWall).success).toBe(true);
  });
});

describe('PropertyTemplateDraftSchema', () => {
  it.each([
    ['tường', fullWall],
    ['ô mở', fullOpening],
    ['phòng', fullRoom],
    ['đồ đạc', fullFurniture],
  ])('nhận bản nháp %s: đúng ba trường, không năm', (_label, template) => {
    const draft = {
      fields: template.fields,
      name: template.name,
      objectKind: template.objectKind,
    };

    expect(PropertyTemplateDraftSchema.parse(draft)).toStrictEqual(draft);
  });

  it('nhận bản nháp tối thiểu — fields rỗng', () => {
    const draft = { fields: {}, name: 'Tường ngăn 100', objectKind: 'wall' };

    expect(PropertyTemplateDraftSchema.parse(draft)).toStrictEqual(draft);
  });

  it.each([
    ['id', 'id', TEMPLATE_ID],
    ['projectId', 'projectId', PROJECT_ID],
    ['createdAt', 'createdAt', base.createdAt],
    ['scope', 'scope', 'project'],
  ])('từ chối khoá %s — bốn trường ấy do máy chủ đặt', (_label, key, value) => {
    expect(
      PropertyTemplateDraftSchema.safeParse({
        fields: {},
        name: 'Tường ngăn 100',
        objectKind: 'wall',
        [key]: value,
      }).success,
    ).toBe(false);
  });

  it('từ chối khoá lạ trong fields lồng', () => {
    expect(
      PropertyTemplateDraftSchema.safeParse({
        fields: { usage: 'bedroom' },
        name: 'Tường ngăn 100',
        objectKind: 'wall',
      }).success,
    ).toBe(false);
  });

  it('từ chối null ở trường tuỳ chọn trong fields', () => {
    expect(
      PropertyTemplateDraftSchema.safeParse({
        fields: { thicknessMm: null },
        name: 'Tường ngăn 100',
        objectKind: 'wall',
      }).success,
    ).toBe(false);
  });

  it('không có refine — cùng bộ luật với bản đã lưu, chỉ ít trường hơn', () => {
    expect(
      PropertyTemplateDraftSchema.safeParse({ fields: {}, name: 'x', objectKind: 'room' }).success,
    ).toBe(true);
  });
});
