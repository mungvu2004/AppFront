import { describe, expect, test } from "bun:test";
import { vi } from "./vi";

// Chuỗi hợp lệ: không rỗng, chữ đầu hoa hoặc số/mã viết hoa, và có dấu tiếng Việt
// (hoặc nằm trong danh sách mã/viết tắt được phép không dấu).
const ALLOWLIST = [
  "2D",
  "3D",
  "GPU",
  "PDF",
  "AI",
  "CAD",
  "OCR",
  "SSO",
  "Pascal",
  "AppFront",
  "Esc",
  "Ctrl",
  "Shift",
  "Alt",
  "Tab",
  "Enter",
];

// So khớp bất kỳ ký tự có dấu tiếng Việt bằng cách tách tổ hợp Unicode (NFD) rồi tìm
// dấu kết hợp (combining diacritical marks) — tránh liệt kê thủ công từng ký tự dựng
// sẵn (dễ thiếu, như "ế" từng bị bỏ sót).
function hasVietnameseDiacritic(str: string): boolean {
  const decomposed = str.normalize("NFD");
  if (/[̀-ͯ]/.test(decomposed)) return true;
  // đ/Đ không tách dấu qua NFD (nó là chữ cái riêng, không phải d + dấu gạch).
  return /[đĐ]/.test(str);
}

function isAllowlistedStart(str: string): boolean {
  return ALLOWLIST.some((tok) => str.startsWith(tok));
}

// Số định dạng kiểu Việt ghép đơn vị ngắn ("1 x", "1 %" …) — đúng quy ước, không cần dấu.
const NUMERIC_FORMAT = /^\d+(,\d+)?\s*(%|x)$/;

// Chuỗi hợp lệ nhưng không qua được hai phép kiểm tự động ở trên vì một trong hai lý
// do chính đáng: (1) từ vựng kỹ thuật/từ mượn tiếng Việt không có dấu ("Chu vi", "Plugin",
// "Camera", "Drone", "Foot", "Inch" — các thuật ngữ này dùng nguyên trong UI tiếng Việt),
// hoặc (2) là một ĐOẠN được ghép vào giữa câu khác lúc hiển thị (không phải câu đứng một
// mình), nên viết thường chữ đầu là đúng ý — đã soát từng dòng trong vi.ts trước khi đưa
// vào đây, không phải tiếng Anh sót lại.
const FRAGMENT_OR_LOANWORD_EXEMPT = new Set([
  "Chu vi",
  "Foot",
  "Inch",
  "Drone",
  "Camera",
  "ID plugin",
  "Plugin",
  "Xem plugin",
  "bản quét",
  "ảnh hướng dẫn",
  "vt",
  "xoay",
  "tl",
  "đổi cỡ",
  "đặt tỉ lệ",
  "bảng điều khiển",
  "ảnh chụp",
  "di chuyển",
  "nhảy",
  "mở",
  "ống kính",
  "nhả con trỏ",
  "chụp",
  "lên",
  "xuống",
  "tăng tốc",
  "chậm lại",
  "để thoát",
  "hoặc",
  "để tiếp tục",
  "hoặc nhấp để",
  "nút",
  "ví dụ: 3,5, 180cm hoặc 5'11\"",
  " (chỉ GLB/USDZ)",
  "phần bổ trợ Pascal cho Blender",
  "? Toàn bộ tường, sàn và đồ đạc trên tầng này sẽ bị xoá vĩnh viễn.",
  "(chỉ trong phiên này). Chạm chọn thường sẽ chọn lại toàn bộ thành viên. Không được lưu vào dự án.",
  "đang chạy trong một Blender đang mở.",
  "đóng băng góc camera này thành ảnh tham chiếu dùng lại được cho ảnh render & video.",
]);

const failures: string[] = [];

function checkString(path: string, str: string) {
  expect(str.length, `${path} rỗng`).toBeGreaterThan(0);
  if (NUMERIC_FORMAT.test(str) || FRAGMENT_OR_LOANWORD_EXEMPT.has(str)) return;
  const firstChar = str[0] ?? "";
  const firstIsUpperVietnamese =
    hasVietnameseDiacritic(firstChar) &&
    firstChar === firstChar.toLocaleUpperCase("vi-VN") &&
    firstChar !== firstChar.toLocaleLowerCase("vi-VN");
  const startsOk =
    /[A-Z0-9]/.test(firstChar) ||
    firstIsUpperVietnamese ||
    isAllowlistedStart(str);
  if (!startsOk) failures.push(`KHÔNG HOA CHỮ ĐẦU: ${path} = "${str}"`);
  const hasDiacriticOrAllowlisted =
    hasVietnameseDiacritic(str) || isAllowlistedStart(str);
  if (!hasDiacriticOrAllowlisted)
    failures.push(`KHÔNG CÓ DẤU: ${path} = "${str}"`);
}

function walk(node: unknown, path: string) {
  if (typeof node === "string") {
    checkString(path, node);
    return;
  }
  if (typeof node === "function") {
    const result = (node as (...args: unknown[]) => unknown)(1, "x", 2);
    expect(typeof result, `${path}(…) không trả về chuỗi`).toBe("string");
    checkString(`${path}(…)`, result as string);
    return;
  }
  if (node && typeof node === "object") {
    for (const [key, value] of Object.entries(node)) {
      walk(value, `${path}.${key}`);
    }
    return;
  }
  throw new Error(`${path}: giá trị không mong đợi (${typeof node})`);
}

describe("i18n/vi", () => {
  test("mọi chuỗi trong bảng vi đều hợp lệ (có dấu, viết hoa chữ đầu)", () => {
    walk(vi, "vi");
    expect(failures.join("\n")).toBe("");
  });
});
