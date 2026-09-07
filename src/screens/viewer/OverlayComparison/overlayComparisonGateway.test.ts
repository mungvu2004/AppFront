/**
 * Lượt kiểm của `overlayComparisonGateway` — bốn khả năng còn thiếu được
 * KHẲNG ĐỊNH, không phải chỉ được ghi chú.
 *
 * ## Vì sao một lỗ hổng lại cần test
 *
 * `src/domain/overlay` đã xong và đã có độ phủ 100%, nên rất dễ tưởng rằng nối
 * xong domain là màn đo được. Không: thứ còn thiếu là **đầu vào** —
 * `compareDrawingToModel` đòi trục dò từ ảnh quét, và không endpoint nào trả về
 * trục. Một chú thích nói điều đó sẽ im lặng mục đi theo thời gian; một bài kiểm
 * thì kêu lên đúng lúc có người bật nhầm một cờ `supports`, xoá nhầm một dòng
 * `OVERLAY_MISSING_SOURCES`, hay nối cổng vào một endpoint chưa tồn tại.
 *
 * Đây đúng là nguyên tắc của chính màn Đối chiếu bản vẽ — bằng chứng thay vì lời
 * khẳng định — áp cho mã nguồn của nó.
 *
 * ## File này KHÔNG khoá chuỗi
 *
 * Nó khẳng định *hình dạng* của lời từ chối (đúng `capability`, có câu nói thiếu
 * gì, câu đó nêu đích danh thứ cần) chứ không so chuỗi nguyên văn: câu chữ còn
 * được viết lại khi ai đó hiểu rõ hơn, và một test so nguyên văn sẽ biến việc
 * viết cho rõ hơn thành một vết đỏ.
 */

import { describe, expect, it } from 'vitest';

import { createMockApiClient } from '@/api/__mocks__/client';

import {
  OVERLAY_MISSING_SOURCES,
  clearConfirmedMatches,
  createOverlayComparisonGateway,
  unsupported,
} from './overlayComparisonGateway';
import type { OverlayMissingCapability } from './types';

/** Bốn khả năng, theo đúng thứ tự `OverlayMissingCapability` liệt kê. */
const MISSING_CAPABILITIES: readonly OverlayMissingCapability[] = [
  'imageToModelTransform',
  'deviationRegions',
  'matchMetrics',
  'confirmFloorMatch',
];

const PROJECT_ID = 'P-01';
const FLOOR_ID = 'L-01';

function makeGateway() {
  return createOverlayComparisonGateway(createMockApiClient());
}

describe('overlayComparisonGateway — bốn khả năng còn thiếu', () => {
  it('khai đúng bốn khả năng là chưa làm được, không thừa và không thiếu cái nào', () => {
    const gateway = makeGateway();

    /* Đọc theo KHOÁ chứ không đếm suông: một khả năng bị đổi tên sẽ hiện ra ở
       đây thay vì lặng lẽ rơi khỏi bảng. */
    expect(Object.keys(gateway.supports).sort()).toEqual([...MISSING_CAPABILITIES].sort());
    expect(Object.values(gateway.supports)).toEqual([false, false, false, false]);
  });

  it('mỗi khả năng thiếu đều nói ra thứ CẦN CÓ, nêu đích danh, không phải "chưa nối"', () => {
    for (const capability of MISSING_CAPABILITIES) {
      const missing = OVERLAY_MISSING_SOURCES[capability];

      expect(missing.length).toBeGreaterThan(0);

      /* Câu phải nói thứ CẦN, nên nó bắt đầu bằng "cần" hoặc nêu thứ nó phụ
         thuộc. Một câu chỉ nói "chưa có" thì không cho người đọc sau này biết
         phải làm gì tiếp — đó chính là thứ lượt sửa này bỏ đi. */
      expect(missing).toMatch(/^(cần|phụ thuộc)/u);
    }
  });

  it('nêu đích danh đầu vào còn thiếu của hai khả năng chặn đường', () => {
    /* Hai cái tên này là toàn bộ lý do màn chưa đo được. Chúng nằm trong câu để
       người nối tiếp tìm được ngay bằng một lượt tìm chuỗi. */
    expect(OVERLAY_MISSING_SOURCES.deviationRegions).toContain('drawingAxes');
    expect(OVERLAY_MISSING_SOURCES.imageToModelTransform).toContain('originMm');

    /* Và cả hai đều nói rõ phần domain ĐÃ SẴN, để không ai đi viết lại nó. */
    expect(OVERLAY_MISSING_SOURCES.deviationRegions).toContain('compareDrawingToModel');
    expect(OVERLAY_MISSING_SOURCES.matchMetrics).toContain('summariseDeviations');
  });

  it('`unsupported` trả đúng mã khả năng kèm đúng câu của nó', () => {
    for (const capability of MISSING_CAPABILITIES) {
      expect(unsupported(capability)).toEqual({
        supported: false,
        capability,
        missing: OVERLAY_MISSING_SOURCES[capability],
      });
    }
  });

  it('ba lời gọi đo đều từ chối, và từ chối bằng đúng mã của riêng nó', async () => {
    const gateway = makeGateway();

    /* Ba lượt gọi thật, không phải đọc lại hằng số: nếu một hôm nào đó
       `readScanPlacement` được nối vào nhầm endpoint thì phép kiểm này đỏ. */
    await expect(gateway.readScanPlacement({ floorId: FLOOR_ID, projectId: PROJECT_ID })).resolves.toEqual(
      unsupported('imageToModelTransform'),
    );
    await expect(
      gateway.readDeviationRegions({ floorId: FLOOR_ID, projectId: PROJECT_ID }),
    ).resolves.toEqual(unsupported('deviationRegions'));
    expect(gateway.evaluateTolerance({ regions: [], toleranceMm: 20 })).toEqual(
      unsupported('matchMetrics'),
    );
  });

  it('xác nhận khớp chỉ sống trong phiên, và cổng nói ra đúng điều đó', async () => {
    clearConfirmedMatches();
    const gateway = makeGateway();
    const input = { floorId: FLOOR_ID, projectId: PROJECT_ID };

    expect(gateway.hasConfirmedMatch(input)).toBe(false);

    const result = await gateway.confirmFloorMatch(input);

    /* Nó trả `ok` thật vì nó THẬT SỰ đã giữ giá trị — cho tới khi tải lại trang.
       Nhưng `supports.confirmFloorMatch` vẫn `false`, nên màn không được phép
       nói với người dùng rằng lượt xác nhận đã lên máy chủ. Hai điều này phải
       cùng đúng một lúc; đó là chỗ dễ nói dối nhất của cả cổng. */
    expect(result.ok).toBe(true);
    expect(gateway.hasConfirmedMatch(input)).toBe(true);
    expect(gateway.supports.confirmFloorMatch).toBe(false);

    clearConfirmedMatches();
    expect(gateway.hasConfirmedMatch(input)).toBe(false);
  });
});
