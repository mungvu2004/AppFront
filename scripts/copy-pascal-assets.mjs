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
import { copyFileSync, existsSync, mkdirSync, readFileSync, readdirSync, statSync } from 'node:fs';
import { join, dirname } from 'node:path';

/** Vật liệu của Pascal: nguồn nằm trong repo, ở thư mục mã đã chép về. */
const MATERIAL_SOURCE = join('vendor', 'pascal', 'assets', 'material');
const MATERIAL_TARGET = join('public', 'pascal', 'material');

/** Bộ giải Basis: `three` đóng gói sẵn, khỏi tải từ jsDelivr. */
const BASIS_SOURCE = join('node_modules', 'three', 'examples', 'jsm', 'libs', 'basis');
const BASIS_TARGET = join('public', 'basis');

/** Chỉ cần bộ giải; `README.md` đi kèm không phục vụ lượt chạy nào. */
const BASIS_WANTED = /^basis_transcoder\.(js|wasm)$/;

/**
 * Bản kê vật liệu của Pascal — nguồn duy nhất nói tệp nào SẼ được gọi lúc chạy.
 *
 * Đo ngày 2026-09-29: bản kê trỏ tới **249** tệp `.ktx2`, repo chỉ commit **62**
 * (17 trong 65 vật liệu). 187 tệp còn lại sống trên CDN của Pascal, và tự host
 * mà không đối chiếu thì chúng thành **404 trong im lặng** — đúng thứ đã xảy ra
 * với `woodplank_48`: bốn lượt gọi hỏng, mặt gỗ ra không có vân, không một dòng
 * báo nào. Lượt chép nay nói ra con số ấy.
 */
const LIBRARY_SOURCE = join('vendor', 'pascal', 'packages', 'core', 'src', 'material-library.ts');

/**
 * Chỉ chép thứ lúc chạy CÓ gọi tới.
 *
 * Đo trên một cảnh thật (`e2e/pascal-viewer.spec.ts`): 12 lượt gọi tài sản, cả
 * 12 đều là `.ktx2`. Không một lượt nào chạm `.webp` hay `.jpg` — chúng là ảnh
 * NGUỒN và ảnh xem trước của bảng chọn vật liệu, mà màn chỉ-xem không dựng bảng
 * ấy. Chép cả cụm là 17 330,7 KiB; chép đúng `.ktx2` là 6 526,4 KiB.
 *
 * Ngày nào mở phần sửa và bảng chọn vật liệu hiện ra, thêm `.webp` vào đây —
 * đừng gỡ dòng này đi mà không đo lại.
 */
const MATERIAL_WANTED = /\.ktx2$/;

/** Đếm đệ quy, để dòng tổng kết nói được số thật chứ không nói "xong". */
const countFiles = (dir) => {
  let total = 0;
  for (const entry of readdirSync(dir)) {
    const path = join(dir, entry);
    total += statSync(path).isDirectory() ? countFiles(path) : 1;
  }
  return total;
};

/** Mọi tệp dưới `dir`, đường dẫn tương đối so với chính nó. */
const walk = (dir, prefix = '') => {
  const found = [];
  for (const entry of readdirSync(dir)) {
    const path = join(dir, entry);
    const rel = prefix === '' ? entry : `${prefix}/${entry}`;
    if (statSync(path).isDirectory()) found.push(...walk(path, rel));
    else found.push(rel);
  }
  return found;
};

mkdirSync(MATERIAL_TARGET, { recursive: true });

let materialCount = 0;
for (const rel of walk(MATERIAL_SOURCE)) {
  if (!MATERIAL_WANTED.test(rel)) continue;
  const target = join(MATERIAL_TARGET, rel);
  mkdirSync(dirname(target), { recursive: true });
  copyFileSync(join(MATERIAL_SOURCE, rel), target);
  materialCount += 1;
}

/*
 * Đối chiếu bản kê với thứ vừa chép. Không ném lỗi: 187 tệp thiếu là trạng thái
 * THẬT của repo Pascal, không phải hỏng cài đặt, và ném ở đây sẽ chặn cả `pnpm
 * dev`. Nhưng nó phải được NÓI RA — một con số in ra mỗi lượt dựng là thứ duy
 * nhất ngăn nó lại thành 404 không ai thấy.
 */
const referenced = [
  ...new Set(
    [...readFileSync(LIBRARY_SOURCE, 'utf8').matchAll(/'(\/material\/[^']+\.ktx2)'/g)].map(
      (match) => match[1].replace('/material/', ''),
    ),
  ),
];
const missing = referenced.filter((rel) => !existsSync(join(MATERIAL_TARGET, rel)));

mkdirSync(BASIS_TARGET, { recursive: true });
const basisCopied = readdirSync(BASIS_SOURCE).filter((name) => BASIS_WANTED.test(name));
for (const name of basisCopied) {
  copyFileSync(join(BASIS_SOURCE, name), join(BASIS_TARGET, name));
}

console.log(`Đã chép ${String(materialCount)} tệp vật liệu Pascal vào ${MATERIAL_TARGET}/`);

if (missing.length > 0) {
  const materials = [...new Set(missing.map((rel) => rel.split('/')[1]))];
  console.warn(
    `CẢNH BÁO: bản kê vật liệu trỏ tới ${String(referenced.length)} tệp .ktx2, ` +
      `THIẾU ${String(missing.length)} (${String(materials.length)} vật liệu). ` +
      'Repo Pascal chỉ commit một phần; phần còn lại sống trên CDN của họ. ' +
      'Cảnh nào dùng tới chúng sẽ nhận 404 và mất vân bề mặt. ' +
      `Vật liệu thiếu: ${materials.slice(0, 6).join(', ')}` +
      (materials.length > 6 ? ` … và ${String(materials.length - 6)} nữa.` : '.'),
  );
}
console.log(`Đã chép ${String(basisCopied.length)} tệp bộ giải Basis vào ${BASIS_TARGET}/: ${basisCopied.join(', ')}`);
