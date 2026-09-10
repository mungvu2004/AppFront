/**
 * Phần THUẦN của tầng dữ liệu màn di động: cổng và bốn phép chiếu.
 *
 * Không React, không kho, không mạng — mọi thứ ở đây là hàm nhận vào trả ra,
 * nên bài kiểm không phải dựng một cây nào. Điều nó canh là hai chuyện dễ trôi
 * nhất: (1) tấm thông tin chỉ hiện đúng những thuộc tính đã chọn và mọi `value`
 * đã là chuỗi ĐÃ ĐỊNH DẠNG với dấu phẩy thập phân (A15), và (2) "mạng yếu"
 * đọc đúng hai trường của `NetworkMonitorStatus` chứ không đọc `online`.
 */

import { describe, expect, it } from 'vitest';

import { measureDistance, MEASUREMENT_LABELS } from '@/domain/measure/measure';
import { createSampleBuilding } from '@/domain/spatial/__fixtures__/sampleBuilding';
import { normalizeSpatial } from '@/domain/spatial/normalize';
import type { EntityHit } from '@/lib/three/interaction/hitTest';
import { storeysOf } from '@/screens/viewer/ViewerShell';

import {
  createMobileViewerGateway,
  desktopLinkMailtoHref,
  floorsOf,
  isNetworkDegraded,
  MOBILE_KIND_LABELS,
  selectionOf,
  toMobileMeasurement,
} from './mobileViewerGateway';

const SPATIAL = normalizeSpatial(createSampleBuilding());
const STOREYS = storeysOf(SPATIAL);

/** Một cú chạm giả: chỉ hai trường mà `selectionOf` thật sự đọc. */
function hitOn(entityId: string, kind: EntityHit['kind']): EntityHit {
  return { entityId, kind } as unknown as EntityHit;
}

function firstIdOfKind(kind: 'wall' | 'room'): string {
  const id = SPATIAL.byKind[kind].at(0);

  if (id === undefined) {
    throw new Error(`bộ mẫu không có ${kind} nào`);
  }

  return id;
}

describe('cổng', () => {
  it('vắng chỗ tiêm thì dùng cửa THẬT, không dùng cổng giả im lặng', () => {
    const gateway = createMobileViewerGateway();

    expect(typeof gateway.projectsApi.read).toBe('function');
    expect(typeof gateway.createMonitor).toBe('function');
  });

  it('cửa nào được truyền thì cửa ấy thay bản thật', async () => {
    const opened: string[] = [];
    const gateway = createMobileViewerGateway({
      openMail: (href) => opened.push(href),
      copyText: async () => true,
    });

    gateway.openMail('mailto:?subject=x');

    expect(opened).toEqual(['mailto:?subject=x']);
    await expect(gateway.copyText('x')).resolves.toBe(true);
  });
});

describe('mạng yếu — T-09', () => {
  it('có sóng nhưng máy chủ không trả lời kịp là YẾU, không phải bình thường', () => {
    expect(isNetworkDegraded({ browserOnline: true, pingOnline: false })).toBe(true);
  });

  it('mất hẳn cũng vào cùng nhánh', () => {
    expect(isNetworkDegraded({ browserOnline: false, pingOnline: false })).toBe(true);
  });

  it('cả hai trường đều tốt thì không báo gì', () => {
    expect(isNetworkDegraded({ browserOnline: true, pingOnline: true })).toBe(false);
  });
});

describe('tầng', () => {
  it('mỗi tầng của đồ thị thành đúng một mục, nhãn viết thường (A6)', () => {
    const floors = floorsOf(SPATIAL, STOREYS);

    expect(floors).toHaveLength(STOREYS.length);
    for (const floor of floors) {
      expect(floor.label).toBe(floor.label.toLocaleLowerCase('vi-VN'));
    }
  });

  it('tầng có phòng trong đồ thị là tầng đã dựng xong hình', () => {
    const floors = floorsOf(SPATIAL, STOREYS);

    expect(floors.every((floor) => floor.isLoaded)).toBe(true);
  });

  it('đồ thị chưa nạp thì không có tầng nào, không phải một mục rỗng', () => {
    expect(floorsOf(null, STOREYS)).toHaveLength(0);
  });
});

describe('tấm thông tin — CHỈ ĐỌC', () => {
  it('chạm vào chỗ trống là không còn gì để hiện', () => {
    expect(selectionOf(null, SPATIAL, true)).toBeNull();
  });

  it('một bức tường rút còn bề dày và chiều dài, mọi value đã định dạng', () => {
    const wallId = firstIdOfKind('wall');
    const selection = selectionOf(hitOn(wallId, 'wall'), SPATIAL, true);

    expect(selection).not.toBeNull();
    expect(selection?.kindLabel).toBe(MOBILE_KIND_LABELS.wall);
    expect(selection?.rows.map((row) => row.label)).toEqual(['Bề dày', 'Chiều dài']);
    for (const row of selection?.rows ?? []) {
      expect(typeof row.value).toBe('string');
      expect(row.value).not.toBe('');
    }
  });

  it('một phòng rút còn diện tích, và diện tích mang dấu PHẨY thập phân (A15)', () => {
    const roomId = firstIdOfKind('room');
    const selection = selectionOf(hitOn(roomId, 'room'), SPATIAL, true);

    expect(selection?.rows.map((row) => row.label)).toEqual(['Diện tích']);
    expect(selection?.rows.at(0)?.value).toMatch(/,\d/u);
    expect(selection?.rows.at(0)?.value).toContain('m²');
  });

  it('vai chỉ xem KHÔNG được mời mở trên máy tính — câu mời ấy sẽ dẫn tới ngõ cụt', () => {
    const wallId = firstIdOfKind('wall');

    expect(selectionOf(hitOn(wallId, 'wall'), SPATIAL, false)?.needsDesktopToEdit).toBe(false);
    expect(selectionOf(hitOn(wallId, 'wall'), SPATIAL, true)?.needsDesktopToEdit).toBe(true);
  });

  it('không có đối tượng nào mang id ấy thì không dựng tấm rỗng', () => {
    expect(selectionOf(hitOn('W-999999', 'wall'), SPATIAL, true)).toBeNull();
  });

  it('đồ thị chưa nạp thì không có gì để chiếu', () => {
    expect(selectionOf(hitOn(firstIdOfKind('wall'), 'wall'), null, true)).toBeNull();
  });
});

describe('đo — M-15', () => {
  it('khoảng cách hai điểm mang nhãn của src/domain/measure và trị số đã định dạng', () => {
    const measurement = measureDistance({ x: 0, y: 0 } as never, { x: 3450, y: 0 } as never);
    const row = toMobileMeasurement(measurement, 'm-1');

    expect(row.id).toBe('m-1');
    expect(row.kindLabel).toBe(MEASUREMENT_LABELS.distance);
    expect(row.valueLabel).toBe('3,45 m');
  });
});

describe('gửi liên kết qua thư — X-04', () => {
  it('là một địa chỉ mailto:, mang cả câu giải thích lẫn liên kết', () => {
    const href = desktopLinkMailtoHref('Nhà phố Bình Thạnh', 'https://app.example.com/s/8f2c1d');

    expect(href.startsWith('mailto:?')).toBe(true);
    expect(decodeURIComponent(href)).toContain('chỉ sửa được trên máy tính');
    expect(decodeURIComponent(href)).toContain('https://app.example.com/s/8f2c1d');
    expect(decodeURIComponent(href)).toContain('Nhà phố Bình Thạnh');
  });
});
