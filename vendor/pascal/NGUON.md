# Mã Pascal trong repo này

`packages/{core,viewer,editor,nodes}` là bản chép **nguyên vẹn** của upstream
`https://github.com/pascalorg/editor` (clone tại `F:/pascal-editor`), commit
`cd14090ef4d147a5de59aa4a100eab208f26e1da`, giấy phép **MIT** (`LICENSE` cạnh tệp này — phải giữ nguyên).
Không chép `node_modules/`, `dist/`, `.turbo/`, `tsconfig.tsbuildinfo`.

**KHÔNG được sửa gì trong `packages/`.** Kiểm: `diff -rq -x node_modules F:/pascal-editor/packages/<gói> vendor/pascal/packages/<gói>`
phải rỗng. Nâng phiên bản = chép lại cả thư mục từ upstream (`robocopy /MIR /XD node_modules dist .turbo`).

Mã riêng của AppFront nằm ở `src/` (trang 3D: `src/pascal-page/`, cầu dữ liệu: `src/lib/pascal/`),
nối vào Pascal qua alias của `vite.pascal.config.ts` (trỏ lối vào `dist/` về `src/`) và `pnpm.overrides`
(nối phụ thuộc nội bộ kiểu bun về workspace). Phần còn lại ở đây là của AppFront:
`shims/` (thay `next/image`, `next/link`), `assets/` (tài sản tự host, chép bằng
`scripts/copy-pascal-assets.mjs`; `assets/audios` từ `apps/editor/public/audios`), `scripts/`, `tooling/`.
