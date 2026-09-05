/**
 * Bài kiểm phép lọc của ô tìm phòng — thuần, không dựng cây React nào.
 *
 * Bộ dữ liệu là bộ mẫu THẬT của vỏ (`viewerShellFixture.ts`), không phải một
 * bảng phòng thứ hai gõ tay ở đây (R-70): 14 phòng trên 4 tầng, đúng những cái
 * tên mà bài e2e sẽ gõ vào ô tìm trên trình duyệt thật.
 *
 * Phép so là **khớp chuỗi con trên tên + mã + tên tầng**, nên nó rộng chứ không
 * chính xác: gõ `2` cũng đụng phải "Tầng 02". Đó là hành vi đúng của một cái
 * lọc — người dùng nhìn thấy mọi kết quả rồi chọn — nên bài kiểm dưới đây khẳng
 * định những truy vấn PHÂN BIỆT ĐƯỢC, chứ không giả vờ rằng một từ khoá mơ hồ
 * cho ra đúng một dòng.
 */

import { describe, expect, it } from 'vitest';

import {
  VIEWER_FIXTURE_LEVELS,
  VIEWER_FIXTURE_ROOMS,
} from '@/screens/viewer/ViewerShell/viewerShellFixture';

import { foldForSearch, matchRoomOptions, MAX_ROOM_RESULTS } from './roomSearch';
import type { ViewerRoomOption } from './roomSearch';

const STOREY_NAMES = new Map(VIEWER_FIXTURE_LEVELS.map((level) => [level.id, level.name]));

/** Bộ mẫu của vỏ, đổi sang đúng hình dạng ô tìm đọc. */
const ROOMS: readonly ViewerRoomOption[] = VIEWER_FIXTURE_ROOMS.map((room) => ({
  id: room.id,
  name: room.name,
  storeyName: STOREY_NAMES.get(room.levelId) ?? 'Tầng',
  areaLabel: '0,00 m²',
}));

/** Tên của những phòng khớp, để khẳng định đọc được. */
function namesOf(query: string): readonly string[] {
  return matchRoomOptions(ROOMS, query).options.map((room) => room.name);
}

describe('foldForSearch', () => {
  it('bỏ dấu và hạ chữ thường', () => {
    expect(foldForSearch('Phòng ngủ 1')).toBe('phong ngu 1');
  });

  it('đổi cả `đ`, thứ NFD không tách ra được', () => {
    expect(foldForSearch('Đèn')).toBe('den');
  });
});

describe('matchRoomOptions', () => {
  it('chuỗi rỗng cho thấy mọi phòng, tới trần kết quả', () => {
    const result = matchRoomOptions(ROOMS, '');

    expect(ROOMS.length).toBeGreaterThan(MAX_ROOM_RESULTS);
    expect(result.options).toHaveLength(MAX_ROOM_RESULTS);
    expect(result.hasMore).toBe(true);
  });

  it('gõ KHÔNG DẤU vẫn ra phòng có dấu — người dùng không cài bộ gõ tiếng Việt', () => {
    expect(namesOf('phong ngu 4')).toEqual(['Phòng ngủ 4']);
  });

  it('mọi từ đều phải khớp, thứ tự gõ không quan trọng', () => {
    expect(namesOf('phong khach')).toEqual(['Phòng khách']);
    expect(namesOf('khach phong')).toEqual(['Phòng khách']);
  });

  it('tìm được bằng MÃ phòng, không chỉ bằng tên', () => {
    expect(namesOf('R-011')).toEqual(['Phòng ngủ 4']);
  });

  it('không khớp gì thì trả danh sách rỗng, không phải cả bộ', () => {
    const result = matchRoomOptions(ROOMS, 'khong co phong nao ten nhu vay');

    expect(result.options).toEqual([]);
    expect(result.hasMore).toBe(false);
  });

  it('tìm được bằng TÊN TẦNG, để hai phòng trùng tên vẫn phân biệt được', () => {
    const result = matchRoomOptions(
      [
        { id: 'R-001', name: 'Kho', storeyName: 'Tầng trệt', areaLabel: '1,00 m²' },
        { id: 'R-009', name: 'Kho', storeyName: 'Tầng mái', areaLabel: '2,00 m²' },
      ],
      'kho mai',
    );

    expect(result.options.map((room) => room.id)).toEqual(['R-009']);
  });
});
