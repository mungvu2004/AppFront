/**
 * Đặt tài sản mà màn Pascal cần vào `public/`, để không lượt chạy nào đi xin CDN ngoài.
 *
 * Đo ngày 2026-09-28 trên một cảnh AppFront **vẽ thật** trong Chromium: viewer gửi
 * **10 yêu cầu ra ngoài**, tới hai đích khác nhau.
 *
 *   1. `https://editor.pascal.app/material/…` — bốn tệp `.ktx2` của vật liệu vữa mặc
 *      định (basecolor, normal, roughness, ao). Pascal ghép URL bằng
 *      `` `${ASSETS_CDN_URL}${path}` `` (`viewer/src/lib/asset-url.ts`), và
 *      `ASSETS_CDN_URL` mặc định là chính CDN ấy. Script này chép thư mục vật liệu
 *      vào `public/pascal/`, còn `vite.config.ts` đặt `NEXT_PUBLIC_ASSETS_CDN_URL`
 *      thành `/pascal` để đường ghép trỏ về chính mình.
 *
 *      **Chuỗi rỗng KHÔNG tắt được CDN**: dòng khai là `process.env.X || '<CDN>'`, và
 *      `''` là falsy nên nó rơi thẳng về mặc định. Phải đặt một đường dẫn thật.
 *
 *   2. `https://cdn.jsdelivr.net/gh/pmndrs/drei-assets@master/basis/` — bộ giải Basis
 *      mà `viewer/src/lib/ktx2-loader.ts` khai cứng. `three` vốn đã đóng gói sẵn hai
 *      tệp ấy, nên chép từ `node_modules/three` và đổi đường khai thành `/basis/`.
 *
 * Cả hai đều là vi phạm `connect-src` của CSP, và cả hai đều để lộ hoạt động người
 * dùng cho bên thứ ba. Chúng **không** nằm trong danh sách 4 vi phạm đã đóng trước
 * đây — lần đo ấy chạy trên một cảnh chưa vẽ được nên chưa đòi tệp nào.
 *
 * Cùng khuôn với `copy-draco.mjs`: thư mục đích được gitignore, nguồn là tệp đã có
 * trong repo hoặc trong `node_modules`, và lệnh chạy lại được bất cứ lúc nào bằng
 * `pnpm pascal:assets`. Chạy lại sau mỗi lần nâng `three` hoặc đổi tài sản Pascal.
 */
import { cpSync, copyFileSync, mkdirSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';

/** Vật liệu của Pascal: nguồn nằm trong repo, ở thư mục mã đã chép về. */
const MATERIAL_SOURCE = join('vendor', 'pascal', 'assets', 'material');
const MATERIAL_TARGET = join('public', 'pascal', 'material');

/** Bộ giải Basis: `three` đóng gói sẵn, khỏi tải từ jsDelivr. */
const BASIS_SOURCE = join('node_modules', 'three', 'examples', 'jsm', 'libs', 'basis');
const BASIS_TARGET = join('public', 'basis');

/** Chỉ cần bộ giải; `README.md` đi kèm không phục vụ lượt chạy nào. */
const BASIS_WANTED = /^basis_transcoder\.(js|wasm)$/;

/** Đếm đệ quy, để dòng tổng kết nói được số thật chứ không nói "xong". */
const countFiles = (dir) => {
  let total = 0;
  for (const entry of readdirSync(dir)) {
    const path = join(dir, entry);
    total += statSync(path).isDirectory() ? countFiles(path) : 1;
  }
  return total;
};

mkdirSync(MATERIAL_TARGET, { recursive: true });
cpSync(MATERIAL_SOURCE, MATERIAL_TARGET, { recursive: true });
const materialCount = countFiles(MATERIAL_TARGET);

mkdirSync(BASIS_TARGET, { recursive: true });
const basisCopied = readdirSync(BASIS_SOURCE).filter((name) => BASIS_WANTED.test(name));
for (const name of basisCopied) {
  copyFileSync(join(BASIS_SOURCE, name), join(BASIS_TARGET, name));
}

console.log(`Đã chép ${String(materialCount)} tệp vật liệu Pascal vào ${MATERIAL_TARGET}/`);
console.log(`Đã chép ${String(basisCopied.length)} tệp bộ giải Basis vào ${BASIS_TARGET}/: ${basisCopied.join(', ')}`);
