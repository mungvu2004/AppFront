import { describe, expect, it } from 'vitest';

import {
  FloorVersionPageSchema,
  FloorVersionSnapshotSchema,
  FloorVersionSummarySchema,
  LabelVersionSchema,
  RestoreVersionSchema,
} from '../../schemas/versions';

/**
 * N17–N20 — lịch sử phiên bản theo tầng.
 *
 * `FloorVersionPageSchema` là một thể hiện cụ thể của `CursorPageSchema`, nên
 * nó được kiểm ở đây thay vì lại ở `common.test.ts`: ở đó là cái vỏ, ở đây là
 * cái vỏ đã lắp mục thật.
 */

const VERSION_ID = 'ver_01J9ZQK7X4N2M8P6R3T5V7W9Y1';
const USER_ID = 'usr_01J9ZQK7X4N2M8P6R3T5V7W9Y1';

const fullSummary = {
  createdAt: '2026-09-17T05:09:00.123Z',
  creatorId: USER_ID,
  creatorName: 'Trần Minh',
  floorRevision: 7,
  hasSnapshot: true,
  id: VERSION_ID,
  label: 'bản gửi chủ đầu tư',
  note: 'trạng thái trước khi ghi kết quả AI',
  sequence: 12,
} as const;

const minimalSummary = {
  createdAt: '2026-09-17T05:09:00.123Z',
  creatorId: 'system:pipeline',
  creatorName: 'hệ thống AI',
  floorRevision: 0,
  hasSnapshot: false,
  id: VERSION_ID,
  sequence: 1,
} as const;

const layer = {
  furniture: [],
  openings: [],
  rooms: [],
  walls: [],
} as const;

describe('FloorVersionSummarySchema', () => {
  it('nhận mẫu đầy đủ', () => {
    expect(FloorVersionSummarySchema.parse(fullSummary)).toStrictEqual({ ...fullSummary });
  });

  it('nhận mẫu tối thiểu và bỏ hẳn label lẫn note', () => {
    expect(FloorVersionSummarySchema.parse(minimalSummary)).toStrictEqual({ ...minimalSummary });
  });

  it('từ chối khoá lạ — isCurrent là thứ màn tự tính, không phải thứ máy chủ gửi', () => {
    expect(
      FloorVersionSummarySchema.safeParse({ ...minimalSummary, isCurrent: true }).success,
    ).toBe(false);
  });

  it.each([
    ['label', { ...minimalSummary, label: null }],
    ['note', { ...minimalSummary, note: null }],
  ])('từ chối null ở trường tuỳ chọn %s', (_label, body) => {
    expect(FloorVersionSummarySchema.safeParse(body).success).toBe(false);
  });

  it.each([
    ['thiếu tiền tố', '01J9ZQK7X4N2M8P6R3T5V7W9Y1'],
    ['tiền tố của tài nguyên khác', 'prj_01J9ZQK7X4N2M8P6R3T5V7W9Y1'],
    ['có ký tự bị loại khỏi ULID', 'ver_01J9ZQK7X4N2M8P6R3T5V7W9YU'],
    ['quá ngắn', 'ver_01J9ZQK7X4'],
  ])('từ chối id phiên bản %s', (_label, id) => {
    expect(FloorVersionSummarySchema.safeParse({ ...minimalSummary, id }).success).toBe(false);
  });

  it('từ chối creatorId không phải usr_ULID lẫn system:pipeline', () => {
    expect(
      FloorVersionSummarySchema.safeParse({ ...minimalSummary, creatorId: 'user-1' }).success,
    ).toBe(false);
  });

  it('từ chối sequence 0 — phiên bản đầu tiên là 1', () => {
    expect(FloorVersionSummarySchema.safeParse({ ...minimalSummary, sequence: 0 }).success).toBe(
      false,
    );
  });

  it('nhận floorRevision 0 — tầng chưa ai sửa vẫn chụp được', () => {
    expect(
      FloorVersionSummarySchema.safeParse({ ...minimalSummary, floorRevision: 0 }).success,
    ).toBe(true);
  });

  it('từ chối floorRevision âm và thập phân', () => {
    expect(
      FloorVersionSummarySchema.safeParse({ ...minimalSummary, floorRevision: -1 }).success,
    ).toBe(false);
    expect(
      FloorVersionSummarySchema.safeParse({ ...minimalSummary, floorRevision: 1.5 }).success,
    ).toBe(false);
  });

  it('từ chối nhãn dài quá 60 ký tự, nhận đúng 60', () => {
    expect(
      FloorVersionSummarySchema.safeParse({ ...minimalSummary, label: 'a'.repeat(61) }).success,
    ).toBe(false);
    expect(
      FloorVersionSummarySchema.safeParse({ ...minimalSummary, label: 'a'.repeat(60) }).success,
    ).toBe(true);
  });

  it('từ chối nhãn rỗng và creatorName rỗng trên đường đọc', () => {
    expect(FloorVersionSummarySchema.safeParse({ ...minimalSummary, label: '' }).success).toBe(
      false,
    );
    expect(
      FloorVersionSummarySchema.safeParse({ ...minimalSummary, creatorName: '' }).success,
    ).toBe(false);
  });

  it('từ chối createdAt lệch múi giờ', () => {
    expect(
      FloorVersionSummarySchema.safeParse({
        ...minimalSummary,
        createdAt: '2026-09-17T12:09:00.123+07:00',
      }).success,
    ).toBe(false);
  });

  it('không có refine — mọi ràng buộc ở đây là kiểu và mẫu', () => {
    expect(FloorVersionSummarySchema.safeParse(fullSummary).success).toBe(true);
  });
});

describe('FloorVersionPageSchema', () => {
  it('nhận trang đầy đủ', () => {
    expect(
      FloorVersionPageSchema.parse({ items: [fullSummary], nextCursor: 'eyJzZXEiOjExfQ' }),
    ).toStrictEqual({ items: [{ ...fullSummary }], nextCursor: 'eyJzZXEiOjExfQ' });
  });

  it('nhận trang cuối và bỏ hẳn nextCursor', () => {
    expect(FloorVersionPageSchema.parse({ items: [] })).toStrictEqual({ items: [] });
  });

  it('từ chối khoá lạ và null ở nextCursor', () => {
    expect(FloorVersionPageSchema.safeParse({ items: [], total: 0 }).success).toBe(false);
    expect(FloorVersionPageSchema.safeParse({ items: [], nextCursor: null }).success).toBe(false);
  });

  it('áp schema của mục cho từng phần tử', () => {
    expect(
      FloorVersionPageSchema.safeParse({ items: [{ ...minimalSummary, sequence: 0 }] }).success,
    ).toBe(false);
  });
});

describe('FloorVersionSnapshotSchema', () => {
  it('nhận một bản chụp — chỉ lớp và kích thước, không tỉ lệ', () => {
    expect(
      FloorVersionSnapshotSchema.parse({ dimensions: [], layer, versionId: VERSION_ID }),
    ).toStrictEqual({ dimensions: [], layer, versionId: VERSION_ID });
  });

  it('không áp dụng phép kiểm null-ở-trường-tuỳ-chọn: ba khoá đều bắt buộc', () => {
    expect(
      FloorVersionSnapshotSchema.safeParse({ dimensions: [], layer, versionId: VERSION_ID }).success,
    ).toBe(true);
  });

  it('từ chối khoá lạ — khôi phục giữ nguyên tỉ lệ hiện tại của tầng', () => {
    expect(
      FloorVersionSnapshotSchema.safeParse({
        dimensions: [],
        layer,
        scaleMillimetresPerPixel: 12.5,
        versionId: VERSION_ID,
      }).success,
    ).toBe(false);
  });

  it('từ chối id phiên bản sai mẫu', () => {
    expect(
      FloorVersionSnapshotSchema.safeParse({ dimensions: [], layer, versionId: 'v1' }).success,
    ).toBe(false);
  });
});

describe('RestoreVersionSchema', () => {
  it('nhận thân khôi phục', () => {
    expect(RestoreVersionSchema.parse({ baseVersion: 7, body: { floorId: 'L-LEVEL00' } })).toStrictEqual(
      { baseVersion: 7, body: { floorId: 'L-LEVEL00' } },
    );
  });

  it('không áp dụng phép kiểm null-ở-trường-tuỳ-chọn: hai khoá đều bắt buộc', () => {
    expect(
      RestoreVersionSchema.safeParse({ baseVersion: 7, body: { floorId: 'L-LEVEL00' } }).success,
    ).toBe(true);
  });

  it('từ chối thiếu baseVersion — máy chủ trả 428', () => {
    expect(RestoreVersionSchema.safeParse({ body: { floorId: 'L-LEVEL00' } }).success).toBe(false);
  });

  it('từ chối khoá lạ trong body, kể cả id phiên bản đã nằm trên đường', () => {
    expect(
      RestoreVersionSchema.safeParse({
        baseVersion: 7,
        body: { floorId: 'L-LEVEL00', versionId: VERSION_ID },
      }).success,
    ).toBe(false);
  });

  it('từ chối mã tầng rỗng', () => {
    expect(RestoreVersionSchema.safeParse({ baseVersion: 7, body: { floorId: '' } }).success).toBe(
      false,
    );
  });
});

describe('LabelVersionSchema', () => {
  it('nhận một nhãn', () => {
    expect(LabelVersionSchema.parse({ label: 'bản gửi chủ đầu tư' })).toStrictEqual({
      label: 'bản gửi chủ đầu tư',
    });
  });

  it('nhận chuỗi rỗng — đó là cách gỡ nhãn', () => {
    expect(LabelVersionSchema.parse({ label: '' })).toStrictEqual({ label: '' });
  });

  it('cắt khoảng trắng trước khi đếm, nên toàn dấu cách cũng là gỡ nhãn', () => {
    expect(LabelVersionSchema.parse({ label: '   ' })).toStrictEqual({ label: '' });
  });

  it('không áp dụng phép kiểm null-ở-trường-tuỳ-chọn: khoá duy nhất là bắt buộc', () => {
    expect(LabelVersionSchema.safeParse({ label: '' }).success).toBe(true);
  });

  it('từ chối nhãn dài quá 60 ký tự, nhận đúng 60', () => {
    expect(LabelVersionSchema.safeParse({ label: 'a'.repeat(61) }).success).toBe(false);
    expect(LabelVersionSchema.safeParse({ label: 'a'.repeat(60) }).success).toBe(true);
  });

  it('từ chối khoá lạ', () => {
    expect(LabelVersionSchema.safeParse({ label: 'x', note: 'y' }).success).toBe(false);
  });
});
