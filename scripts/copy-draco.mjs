/**
 * Đặt bộ giải mã Draco của three vào `public/draco/`.
 *
 * Một `.glb` nén Draco chỉ mở được khi trình duyệt tải được `draco_decoder.wasm`
 * và hai file đi kèm từ một đường dẫn tĩnh; `DRACOLoader.setDecoderPath('/draco/')`
 * trong `src/lib/three/present/assets.ts` trỏ vào đúng chỗ này. Không có chúng
 * thì mô hình nén không mở được và món đồ giữ nguyên khối thủ tục — có báo lỗi
 * qua `onFallback`, không im lặng.
 *
 * Sao chép từ `node_modules/three` thay vì commit vào repo, để phiên bản bộ giải
 * mã luôn khớp với phiên bản three đang dùng. Chạy lại sau mỗi lần nâng three:
 * `pnpm draco`. Thư mục đích được gitignore.
 */
import { copyFileSync, mkdirSync, readdirSync } from 'node:fs';
import { join } from 'node:path';

const SOURCE = join('node_modules', 'three', 'examples', 'jsm', 'libs', 'draco', 'gltf');
const TARGET = join('public', 'draco');

/** Chỉ cần bộ giải mã; bộ mã hoá (`draco_encoder.js`) là việc của công cụ xuất. */
const WANTED = /^draco_(decoder\.(js|wasm)|wasm_wrapper\.js)$/;

mkdirSync(TARGET, { recursive: true });

const copied = readdirSync(SOURCE).filter((name) => WANTED.test(name));

for (const name of copied) {
  copyFileSync(join(SOURCE, name), join(TARGET, name));
}

console.log(`Đã chép ${String(copied.length)} file bộ giải mã Draco vào ${TARGET}/: ${copied.join(', ')}`);
