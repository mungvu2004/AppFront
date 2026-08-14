# AGENTS.md — app-front

Bản tóm tắt cho mọi agent làm việc trên repo này (Claude Code, Codex, Cursor…).
**Nguồn sự thật là `CLAUDE.md`**; file này chỉ rút gọn. Khi hai bên mâu thuẫn,
theo `CLAUDE.md`. Chi tiết harness: `.agent/ARCHITECTURE.md`.

## 1. Dự án

Giao diện QC bản vẽ mặt bằng 2D/3D: tải lên → pipeline → soát tường/trục/phòng/
ô mở theo rule → xuất bản.

React 18 · TypeScript 5.5 · Vite 5 · **pnpm** · Tailwind 3.4 (token qua CSS
variable) · zustand + zundo · @tanstack/react-query · zod · three +
@react-three/fiber (3D) · d3-zoom (2D) · vitest · Playwright · Storybook 8.

## 2. Lệnh (chỉ dùng pnpm)

`pnpm dev` · `pnpm lint` · `pnpm typecheck` · `pnpm test` · `pnpm build` ·
`pnpm e2e` · `pnpm e2e:visual` · `pnpm storybook`
CI chạy tuần tự: lint → typecheck → unit → build → visual.

## 3. Bản đồ thư mục

| Đường dẫn | Vai trò |
|---|---|
| `src/components/{ui,shell,canvas,feedback,overlay}` | component dùng chung, chỉ render |
| `src/screens/**` | màn hình sản phẩm |
| `src/hooks/**` | hook logic (`useX`) |
| `src/lib/**` | hàm thuần (geometry, rules, commands, format, autosave…) |
| `src/domain/**` | mô hình nghiệp vụ (axes, walls, rooms, openings, measure, units) |
| `src/store/**` | zustand slice + `commit.ts` |
| `src/styles/globals.css` + `tailwind.config.ts` | nguồn token duy nhất |
| `e2e/`, `docs/`, `eslint-rules/`, `.agent/`, `.claude/` | e2e, đặc tả, rule nội bộ, harness |

## 4. Luật cứng (rút gọn mục A/B của CLAUDE.md)

1. Chỉ dùng token cho màu/khoảng cách/bo góc/bóng/thời lượng. Cấm hex/rgb/hsl
   trong `src/components` và `src/screens` (`local/no-raw-color` chặn).
2. Một màu nhấn; hai cấp viền; ba màu trạng thái (verified/attention/violation).
   Xanh verified chỉ cho việc người dùng đã duyệt, không cho kết quả AI.
3. Cấm gradient, glow, neon, bóng màu; cấm khối màu đặc > 120px mỗi chiều.
4. Nhãn giao diện viết thường kiểu câu; IN HOA chỉ cho mã trục và mã lỗi.
5. Thời lượng animation chỉ 120/180/260/340/700 ms, có `prefers-reduced-motion`.
6. Không nút "Lưu": tự lưu sau 800ms, hiện "Đã lưu lúc 14:32". Mọi thay đổi dữ
   liệu hoàn tác được qua toast 8s.
7. Không modal chặn khi QC; modal chỉ cho tạo mới, xoá, xuất bản.
8. Không gọi `set()` của store trong component — đi qua `commit(patch, label)`
   (`local/no-direct-set`, `local/no-draft-write-outside-commands` chặn).
9. Không tính toán trong component; logic ở `src/lib` hoặc hook.
10. Mỗi component xử lý đủ bảy trạng thái: rỗng, đang tải, một phần, lỗi,
    thành công, không có quyền, thu gọn.
11. Bàn phím 100%, focus ring 2px offset 2px, Esc đóng lớp trên cùng.
    Tương phản chữ ≥ 4,5:1 (caption ≥ 3:1).
12. Số liệu mẫu luôn dùng bộ chuẩn 48/21/34/14/4 và 248,60 m². Dấu thập phân là
    dấu phẩy; mm cho tường, m cho cao độ, m² cho diện tích.
13. Không thêm dependency mà không nêu lý do trong báo cáo; không tạo component
    mới nếu `src/components` đã có cái phù hợp.
14. Không để lại chip/nút của lập trình viên trên màn hình sản phẩm; công cụ đó
    chỉ ở route `/design-system/states`.
15. **Mọi định danh phải bằng tiếng Anh**: biến, hàm, type, interface, enum,
    hằng, field, file test, mô tả test, mock, fixture, id kỹ thuật, action,
    hook, component, story. Văn xuôi tài liệu thì tiếng Việt.

## 5. Kiến trúc và đặt tên

- Component phức tạp tách đôi: hook `useX` giữ state + tính toán; view nhận
  props thuần rồi chỉ render. View không gọi store/API/hình học. Hook không
  chứa JSX, không import token, không biết Tailwind.
- Ranh giới import (ESLint chặn): `lib` ✗ react/store/hooks/components/screens ·
  `hooks` ✗ components/screens · `store` ✗ hooks/components/screens ·
  `components` ✗ screens · `types` không import gì bên ngoài.
- Tên: component PascalCase một file một component (export named); hook
  `useTaskName`; hàm thuần camelCase trong `src/lib`; slice `nameSlice.ts`,
  action là động từ tiếng Anh ngắn; test `*.test.ts(x)` cạnh file; story
  `ComponentName.stories.tsx`, mỗi trạng thái một story.

## 6. Definition of Done (bản chuẩn: CLAUDE.md mục E)

Cuối mỗi lượt phải in bảng 11 dòng kèm đạt/không đạt và **bằng chứng** (lệnh đã
chạy, số dòng grep): (1) không hex/rgb/hsl · (2) bảy trạng thái có story/test ·
(3) bàn phím + focus ring + Esc · (4) tương phản · (5) năm mốc thời lượng +
reduced-motion · (6) không gradient/neon/khối > 120px/nhãn IN HOA · (7) bộ dữ
liệu mẫu chuẩn · (8) ảnh chụp 1440px · (9) CI xanh · (10) **cấm báo pass khi
chưa chạy lệnh thật** · (11) định danh tiếng Anh.
Dòng không áp dụng thì ghi "không áp dụng" kèm lý do, không ghi "đạt".

## 7. Harness — điều agent cần biết

- Hook `PreToolUse` (`.agent/hooks/pre_tool_use.py`) chạy **fail-closed**: lệnh
  nguy hiểm, ghi vào đường dẫn được bảo vệ, hay đọc file bí mật đều bị chặn
  (exit 2). Bị chặn nghĩa là đổi cách làm, không phải tìm cách lách.
- Không ghi được (và không được tìm cách ghi): `.claude/settings*.json`,
  `.agent/policy/**`, `.agent/HARNESS.yaml`, `.agent/runtime/policy.py`,
  `.agent/hooks/pre_tool_use.py`, `.githooks/**`, `.env*`. Bản gốc của chúng ở
  `.agent/deploy/` và do người vận hành áp bằng tay.
- Nhánh `master`/`main` được bảo vệ; `git push --force` và
  `git commit --no-verify` bị chặn ở cả hai lớp.
- Nới luật chỉ qua PR có người duyệt. Chỉ được đề xuất **siết**, không tự nới.
- Subagent: chỉ `orchestrator` được uỷ quyền; `architect-planner` (read-only),
  `software-engineer`, `qa-test-engineer`, `devops-secops` là lá, không sinh
  agent con.
- Kiểm tra harness: `bash .agent/tests/verify_install.sh`, sau đó các
  `smoke_*.sh` và `redteam.sh` trong `.agent/tests/`.
