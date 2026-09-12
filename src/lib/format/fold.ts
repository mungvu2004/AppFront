/**
 * Bỏ dấu tiếng Việt để so khớp khi tìm.
 *
 * Hàm này ở `src/lib` chứ không ở thư mục của một màn, vì **năm màn cần nó**:
 * `viewer/Viewer3D` (ô tìm phòng), `viewer/FurnitureLibraryPanel`,
 * `admin/ModelLibrary`, `admin/UserManagement` và `account/AccountSettings`.
 *
 * Trước đây nó nằm ở `screens/viewer/Viewer3D/roomSearch.ts` và ba màn kia với
 * tay sang lấy, còn `AccountSettings` thì chép lại một bản riêng. Cả hai đều là
 * triệu chứng của cùng một chuyện: `src/screens` bị dùng làm thư viện cho màn
 * khác, mà ranh giới tầng ở mục 0.4 của `CLAUDE.md` không cho phép điều đó —
 * `src/screens/**` là tầng cao nhất, không ai được nhập từ nó.
 *
 * Chuyện đó tự lộ ra khi `Viewer3D` gắn `FurnitureLibraryPanel`: cạnh nhập
 * ngược `furnitureLibraryPanelGateway → Viewer3D` khép thành một vòng import mà
 * `import/no-cycle` chặn lại. Đưa phần dùng chung xuống một module thấp hơn là
 * cách cắt vòng mà chính thông điệp của cổng chỉ ra — không phải nới luật.
 */

/** Dấu phụ Unicode, tách ra khỏi chữ cái sau khi chuẩn hoá NFD. */
const DIACRITICS = /\p{Diacritic}/gu;

/**
 * Chuỗi đã bỏ dấu và về chữ thường, dạng dùng để so khớp.
 *
 * `"Phòng ngủ 1"` → `"phong ngu 1"`. Đây là dạng của **cả hai phía** phép so,
 * nên nó là một hàm chứ không phải hai đoạn mã giống nhau ở hai chỗ.
 *
 * `NFD` tách dấu thanh và dấu mũ thành ký tự tổ hợp, xoá được bằng một dải
 * Unicode. Riêng `đ`/`Đ` không phân tách được nên nó đi một bước riêng — và
 * bước ấy đứng **sau** `toLowerCase()` để một mình `đ` lo được cả hai chữ hoa
 * và chữ thường. Không có bước này thì gõ "hoan tac" không tìm ra "hoàn tác",
 * và một ô tìm không tìm ra thứ đang hiện trên màn hình là một ô tìm người ta
 * thôi dùng.
 */
export function foldForSearch(text: string): string {
  return text.normalize('NFD').replace(DIACRITICS, '').toLowerCase().replace(/đ/gu, 'd');
}
