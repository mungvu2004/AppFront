# Mã Pascal trong repo này

`packages/{core,viewer,editor,nodes}` chép từ upstream
`https://github.com/pascalorg/editor`, commit
`cd14090ef4d147a5de59aa4a100eab208f26e1da`, giấy phép **MIT** (`LICENSE` cạnh tệp này — phải giữ nguyên).
Không chép `node_modules/`, `dist/`, `.turbo/`, `tsconfig.tsbuildinfo`.

Bản chép **đã có sửa đổi của AppFront**, xem `git log -- vendor/pascal/packages`. Nâng phiên bản không còn là
chép đè cả thư mục: phải gộp lại các sửa đổi đó.

Tự host tài nguyên làm bằng `scripts/pascal-self-host.mjs` + `pascal-catalog-local.mjs` lúc build, không sửa `packages/`.

Mã riêng của AppFront nằm ở `src/` (trang 3D: `src/pascal-page/`, cầu dữ liệu: `src/lib/pascal/`),
nối vào Pascal qua alias của `vite.pascal.config.ts` (trỏ lối vào `dist/` về `src/`) và `pnpm.overrides`
(nối phụ thuộc nội bộ kiểu bun về workspace). Phần còn lại ở đây là của AppFront:
`shims/` (thay `next/image`, `next/link`), `assets/` (tài sản tự host, chép bằng
`scripts/copy-pascal-assets.mjs`; `assets/audios` từ `apps/editor/public/audios`), `scripts/`, `tooling/`.
