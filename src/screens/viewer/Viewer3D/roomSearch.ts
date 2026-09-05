/**
 * Phần THUẦN của ô tìm đối tượng: một dòng kết quả trông như thế nào, và phép
 * lọc dần khi người dùng gõ.
 *
 * File `.ts` thuần, cùng lý do `viewer3dTypes.ts` là `.ts`: phép lọc phải kiểm
 * được mà không dựng một cây React, và mục B nói thẳng "tính toán không nằm
 * trong màn hình" — nên `ObjectSearch.tsx` chỉ gõ chữ vào rồi vẽ kết quả ra,
 * không tự viết phép so khớp nào.
 *
 * ## Vì sao phải bỏ dấu trước khi so
 *
 * Người dùng mà đặc tả nhắm tới là quản lý toà nhà, gõ trên một bàn phím không
 * cài bộ gõ tiếng Việt: họ gõ "phong ngu" và phải ra "Phòng ngủ". Bỏ dấu ở CẢ
 * HAI phía — chuỗi người gõ và tên phòng — là cách duy nhất để "phòng" khớp
 * "phong" mà không cần một bảng đồng nghĩa nào. `đ` không tách ra dấu phụ theo
 * NFD nên nó được đổi riêng; không có nó thì "Đèn" không bao giờ khớp "den".
 *
 * ## Vì sao có trần kết quả
 *
 * Bộ mẫu của vỏ có 14 phòng, một toà nhà thật có hàng trăm. Một danh sách dài
 * hơn màn hình thì bàn phím không đi hết được bằng mũi tên trong một khoảng
 * thời gian người ta chịu đựng, nên danh sách bị cắt ở {@link MAX_ROOM_RESULTS}
 * và {@link RoomSearchResult.hasMore} nói ra rằng nó đã bị cắt — thay vì im
 * lặng giấu đi phần còn lại (E.10).
 */

/** Bao nhiêu dòng kết quả được vẽ cùng lúc. */
export const MAX_ROOM_RESULTS = 8;

/** Một phòng, rút gọn về đúng những gì ô tìm vẽ ra. */
export interface ViewerRoomOption {
  /** Mã phòng, ví dụ `R-001` — cũng là mã đối tượng của S-10. */
  readonly id: string;
  /** Tên phòng người đọc, ví dụ "Phòng ngủ 1". */
  readonly name: string;
  /** Tên tầng chứa phòng, để hai phòng trùng tên vẫn phân biệt được. */
  readonly storeyName: string;
  /** Diện tích ĐÃ ĐỊNH DẠNG (A15) — view không tự làm tròn. */
  readonly areaLabel: string;
}

/** Kết quả một lượt lọc: phần vẽ ra, và có bị cắt bớt hay không. */
export interface RoomSearchResult {
  readonly options: readonly ViewerRoomOption[];
  readonly hasMore: boolean;
}

/** Dấu phụ Unicode, để tách ra khỏi chữ cái sau khi NFD. */
const DIACRITICS = /\p{Diacritic}/gu;

/** Khoảng trắng giữa các từ người dùng gõ. */
const SPACES = /\s+/u;

/**
 * Chuỗi đã bỏ dấu và về chữ thường, dạng dùng để so khớp.
 *
 * "Phòng ngủ 1" → "phong ngu 1". Đây là dạng của CẢ hai phía phép so, nên nó
 * là một hàm chứ không phải hai đoạn mã giống nhau ở hai chỗ.
 */
export function foldForSearch(text: string): string {
  return text.normalize('NFD').replace(DIACRITICS, '').toLowerCase().replace(/đ/gu, 'd');
}

/** Tên, mã và tầng gộp lại — mọi thứ một từ khoá được phép khớp vào. */
function haystackOf(option: ViewerRoomOption): string {
  return foldForSearch(`${option.name} ${option.id} ${option.storeyName}`);
}

/**
 * Những phòng khớp chuỗi người dùng đang gõ.
 *
 * Chuỗi được cắt thành từng từ và MỌI từ đều phải xuất hiện — "ngu 2" khớp
 * "Phòng ngủ 2" mà không khớp "Phòng ngủ 3", và thứ tự gõ không quan trọng.
 * Chuỗi rỗng khớp tất cả: mở ô tìm ra là thấy ngay có những phòng nào, thay vì
 * một danh sách trắng đòi người dùng đoán phải gõ gì.
 */
export function matchRoomOptions(
  rooms: readonly ViewerRoomOption[],
  query: string,
): RoomSearchResult {
  const tokens = foldForSearch(query)
    .split(SPACES)
    .filter((token) => token.length > 0);

  const matched =
    tokens.length === 0
      ? rooms
      : rooms.filter((room) => {
          const haystack = haystackOf(room);

          return tokens.every((token) => haystack.includes(token));
        });

  return {
    options: matched.slice(0, MAX_ROOM_RESULTS),
    hasMore: matched.length > MAX_ROOM_RESULTS,
  };
}
