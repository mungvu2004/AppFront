/**
 * Gói tính năng của framer-motion, tách riêng để `LazyMotion` nạp bằng `import()`.
 *
 * ## Vì sao phải là một file riêng
 *
 * `LazyMotion` nhận `features` ở hai dạng: một gói đã nạp sẵn, hoặc một hàm trả
 * `Promise`. Dạng thứ nhất nghe gọn hơn nhưng **đã đo và hỏng**: `domMax` nhập
 * tĩnh từ `MotionProvider` kéo cả gói tính năng vào **chunk khởi động**, và
 * `pnpm size` đổi từ một cổng đỏ thành hai —
 * `màn hình đầu tiên` 143,5 → 179,5 / 175 và `chunk JS lớn nhất` 179,5 / 170,
 * đổi lại `Viewer3D` 280,6 → 245,2. Lãi một chỗ, lỗ hai chỗ.
 *
 * Nên nó phải đi qua `import()`. Và `import()` phải trỏ vào **file này** chứ
 * không phải thẳng `'framer-motion'`: nhập động cả gói thì rollup coi là "dùng
 * cả module" và giữ nguyên luôn cả proxy `motion` — đúng cái bẫy đã ghi ở
 * `docs/notes/bundle-size.md` §5 (hình dạng câu `import()` đổi 26,8 KiB). Một
 * file chỉ tái xuất đúng một tên thì rollup rung được phần còn lại.
 *
 * ## Vì sao `domMax`
 *
 * `domAnimation` nhẹ hơn nhưng KHÔNG gánh `layoutId` (`ui/SegmentedControl.tsx:163`,
 * `ui/Table.tsx:76`) và `drag` (`overlay/Drawer.tsx:207`). Chọn nhầm thì hai thứ
 * đó **im lặng không chạy** — không lỗi, không cảnh báo, chỉ là hoạt ảnh biến mất.
 */
export { domMax as default } from 'framer-motion';
