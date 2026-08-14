# CLAUDE.md — app-front

Tài liệu luật của repo. Mục A–F là luật sản phẩm/thiết kế (không được sửa nếu
không có người duyệt). Mục 0 là bối cảnh kỹ thuật. Mục G là agent harness.
Khi mâu thuẫn với bất kỳ tài liệu nào khác (README, AGENTS.md, docs/), **file
này thắng**.

---

0. BỐI CẢNH DỰ ÁN

0.1 Sản phẩm và stack
- `app-front`: giao diện QC bản vẽ mặt bằng 2D/3D — tải bản vẽ lên, chạy
  pipeline, soát tường/trục/phòng/ô mở theo bộ rule, rồi xuất bản.
- React 18.3 + TypeScript 5.5 + Vite 5, gói bằng **pnpm** (có pnpm-workspace).
- State: zustand 4.5 + zundo (undo/redo). Data: @tanstack/react-query, zod.
- Canvas: three 0.166 + @react-three/fiber/drei (3D), d3-zoom (2D).
- UI: Tailwind 3.4 (token qua CSS variable), framer-motion, lucide-react,
  react-router-dom 6, react-hook-form, i18next.
- Kiểm thử: vitest 2 + @testing-library, Playwright 1.45 (e2e + visual),
  Storybook 8.2.

0.2 Bản đồ thư mục
| Đường dẫn | Vai trò |
|---|---|
| `src/components/{ui,shell,canvas,feedback,overlay}` | component dùng chung, chỉ render |
| `src/screens/**` | màn hình sản phẩm (qc, viewer, pipeline, rules, upload, export, project, dashboard, admin, billing, auth, onboarding, account, system) |
| `src/hooks/**` | hook logic dùng chung (`useX`) |
| `src/lib/**` | hàm thuần: geometry, rules, commands, autosave, format, scale, http, offline, versioning |
| `src/domain/**` | mô hình nghiệp vụ: axes, walls, rooms, openings, measure, spatial, rules, units |
| `src/store/**` | zustand slice + `commit.ts` (điểm vào duy nhất để đổi dữ liệu) |
| `src/styles/globals.css`, `tailwind.config.ts` | **nguồn token duy nhất** (màu, thời lượng, bóng) |
| `docs/**` | master-brief, architecture, đặc tả component/domain |
| `e2e/**` | Playwright spec + snapshot 1440px |
| `eslint-rules/` | rule ESLint nội bộ ép các bất biến |
| `.agent/`, `.claude/` | agent harness — xem mục G |

0.3 Lệnh chuẩn (chỉ dùng pnpm)
`pnpm dev` · `pnpm lint` · `pnpm typecheck` · `pnpm test` · `pnpm build` ·
`pnpm e2e` · `pnpm e2e:visual` (cập nhật snapshot) · `pnpm storybook`.
CI (`.github/workflows/ci.yml`) chạy tuần tự: lint → typecheck → unit → build →
visual. Không có lệnh nào được coi là "pass" nếu chưa chạy thật (mục E.10).

0.4 Ranh giới import — ESLint chặn cứng, đừng thử lách
- `src/lib/**` KHÔNG import `react`, `store`, `hooks`, `components`, `screens`.
- `src/hooks/**` KHÔNG import `components`, `screens`.
- `src/store/**` KHÔNG import `hooks`, `components`, `screens`.
- `src/components/**` KHÔNG import `screens`.
- `src/types/**` không import gì bên ngoài.

0.5 Bất biến nào được máy kiểm ở đâu
| Luật | Cơ chế kiểm |
|---|---|
| A1, B "cấm hex/rgb/hsl" | `local/no-raw-color` (eslint-rules/no-raw-color.js) |
| A10 "mọi thay đổi qua commit()" | `local/no-direct-set`, `local/no-draft-write-outside-commands` (tắt trong `src/store/**`) |
| D "tách logic/giao diện" | `no-restricted-imports` theo mục 0.4 |
| B "thời lượng animation" | chỉ 120/180/260/340/700 có trong `tailwind.config.ts` |
| A4 ba màu trạng thái | token `state.verified|attention|violation` |
| A11 bảy trạng thái, A12 bàn phím, A13 tương phản | story/test + review người — chưa có rule tự động |

---

A. 15 BẤT BIẾN
1. Mọi màu, khoảng cách, bo góc, bóng, thời lượng đều lấy từ token. Không có ngoại lệ.
2. Chỉ một màu nhấn. Không thêm màu thương hiệu thứ hai.
3. Chỉ hai cấp viền: hairline và default.
4. Chỉ ba màu trạng thái: verified, attention, violation.
5. Xanh verified chỉ dùng cho việc người dùng đã duyệt, không dùng cho kết quả AI.
6. Nhãn nhóm viết thường kiểu câu. IN HOA chỉ cho mã trục và mã lỗi.
7. Không có nút "Lưu". Hệ thống tự lưu sau 800ms và hiển thị "Đã lưu lúc 14:32".
8. Mọi thao tác thay đổi dữ liệu đều hoàn tác được, qua toast 8s có nút "Hoàn tác".
9. Không dùng modal chặn trong lúc QC. Modal chỉ cho tạo mới, xoá, và xuất bản.
10. Không gọi trực tiếp set() của store trong component; mọi thay đổi đi qua commit(patch, label).
11. Mọi component có đúng bảy trạng thái được xử lý: rỗng, đang tải, một phần, lỗi, thành công, không có quyền, thu gọn.
12. Bàn phím dùng được 100%; luôn có focus ring 2px offset 2px; Esc luôn đóng lớp trên cùng.
13. Tương phản chữ ≥ 4,5:1; caption ≥ 3:1.
14. Mọi số liệu mẫu phải dùng bộ dữ liệu chuẩn 48/21/34/14/4 và 248,60 m².
15. Dấu thập phân là dấu phẩy; đơn vị mm cho tường, m cho cao độ, m² cho diện tích.

B. DANH SÁCH CẤM
- Cấm hex/rgb/hsl trong src/components và src/screens.
- Cấm gradient, glow, neon, đổ bóng màu, viền phát sáng.
- Cấm chữ IN HOA cho nhãn giao diện.
- Cấm khối màu đặc lớn hơn 120px mỗi chiều.
- Cấm thời lượng animation ngoài 120/180/260/340/700 ms.
- Cấm gọi set() store trực tiếp trong component.
- Cấm viết logic tính toán trong component; logic phải ở src/lib hoặc hook.
- Cấm thêm dependency mới mà không nêu lý do trong phần báo cáo.
- Cấm tạo component mới nếu đã có component chung phù hợp trong src/components.
- Cấm để lại chip/nút dành cho lập trình viên (ví dụ "Toggle Empty State") trên màn hình sản phẩm; công cụ đó chỉ nằm ở route /design-system/states.
- Cấm dùng tiếng Việt hoặc tiếng Việt không dấu cho tên biến, hàm, type, interface, enum, hằng, field, file test, mô tả test, mock, fixture, id kỹ thuật, action, hook, component, story; tất cả phải dùng tiếng Anh.

C. QUY ƯỚC ĐẶT TÊN
- Component: PascalCase, một component một file, export named.
- Hook logic: useTaskName, đặt cạnh component hoặc trong src/hooks nếu dùng chung.
- Hàm thuần: camelCase trong src/lib, không import React.
- Store slice: nameSlice.ts, action là động từ tiếng Anh ngắn.
- Test: cùng tên file kèm .test.ts(x); e2e trong e2e/.
- Story: ComponentName.stories.tsx, mỗi trạng thái một story.

D. KIẾN TRÚC TÁCH LOGIC VÀ GIAO DIỆN (bắt buộc)
- Mỗi component phức tạp gồm hai phần: hook useX chứa toàn bộ trạng thái và tính toán, và view nhận props thuần rồi chỉ render.
- View không được gọi store, không gọi API, không tính toán hình học.
- Hook không được chứa JSX, không import token, không biết về Tailwind.
- Nhờ vậy view test được bằng props, hook test được không cần DOM.

E. DEFINITION OF DONE — 11 điều, áp dụng cho mọi lượt sau
1. Không có hex/rgb/hsl trong src/components và src/screens.
2. Bảy trạng thái đều có story hoặc test.
3. Bàn phím 100%, focus ring đúng, Esc đóng lớp trên.
4. Tương phản ≥ 4,5:1 (caption ≥ 3:1).
5. Chuyển động chỉ dùng 5 mốc thời lượng, có prefers-reduced-motion.
6. Không gradient, không neon, không khối màu quá 120px, không nhãn IN HOA.
7. Dùng đúng bộ dữ liệu mẫu chuẩn.
8. Có ảnh chụp ở 1440px kèm trong phần báo cáo.
9. CI xanh: lint, typecheck, unit, build, visual snapshot.
10. Cấm báo cáo pass/thành công cho các lệnh kiểm tra (lint, typecheck, test, build...) nếu chưa thực sự chạy lệnh và có kết quả cuối cùng. Bắt buộc phải có log chứng minh.
11. Không dùng tiếng Việt hoặc tiếng Việt không dấu cho tên biến, hàm, type, interface, enum, hằng, field, file test, mô tả test, mock, fixture, id kỹ thuật, action, hook, component, story; tất cả phải dùng tiếng Anh.

F. CHECKLIST TỰ KIỂM TRƯỚC KHI TRẢ LỜI
Mỗi lượt, trước khi kết thúc, agent phải in ra bảng 11 dòng của mục E kèm đạt/không đạt và bằng chứng (lệnh đã chạy, số dòng grep).
Dòng nào không áp dụng (ví dụ lượt chỉ sửa tài liệu) thì ghi "không áp dụng" kèm lý do — không được ghi "đạt".

---

G. AGENT HARNESS (`.agent/` — đã đủ 7 phase)

Thiết kế chi tiết: `.agent/ARCHITECTURE.md`. Cấu hình trung tâm:
`.agent/HARNESS.yaml` (validate bằng `.agent/schema/harness.schema.json`).
Runtime là Claude Code; harness chỉ móc vào lifecycle hook, không thay engine.

G.1 Bản đồ `.agent/`
| Thư mục | Nội dung |
|---|---|
| `hooks/` | 6 hook lifecycle (xem G.3) |
| `runtime/` | `policy.py` (phân tích lệnh), `engine.py` (state machine), `state_store.py` (khoá file, ghi nguyên tử) |
| `schema/` | JSON Schema cho harness, state, telemetry |
| `mcp/` | ma trận quyền MCP + server nội bộ (stdio, Python) |
| `workflows/` | 3 DAG nhiều bước (G.7) |
| `evals/` | bộ case + `runner.py` để đo hồi quy chính sách |
| `tools/` | `code-search.sh`, `security-scan.py` + `tools_schema.json` |
| `sandboxes/` | Dockerfile + compose cách ly (non-root, source read-only, no network) |
| `deploy/` | **bản gốc** của những file agent không được ghi (G.10) |
| `tests/` | 6 smoke + `redteam.sh` + `verify_install.sh` |
| `memory/`, `telemetry/` | state phiên + số liệu, không commit nội dung |

G.2 Các chốt chặn an toàn
1. **Lớp 1 — `permissions.deny`** trong `.claude/settings.json`: chặn cứng
   `rm -rf /`, `git push --force`, `git commit --no-verify`, đọc/ghi `.env`,
   ghi `.claude/settings*.json`, `.agent/policy/**`, `.githooks/**`. Không phụ
   thuộc hook, còn hiệu lực cả khi `disableAllHooks`.
2. **Lớp 2 — hook PreToolUse** `.agent/hooks/pre_tool_use.py` → `runtime/policy.py`:
   tách token bằng `shlex`, đệ quy vào `$( )`/backtick, kiểm nhánh được bảo vệ
   (`master`, `main`), `protected_paths`, `secret_globs`, allowlist binary.
   **FAIL-CLOSED** (exit 2): payload hỏng hay config hỏng thì chặn. Watchdog nội
   bộ 3000ms < timeout 5s khai trong settings.json.
3. **Git hook commit-time** (`.agent/deploy/githooks/`): chốt độc lập với Claude
   Code, vẫn chạy khi hook bị tắt.
4. **Lớp 3 — sandbox Docker** (`.agent/sandboxes/`) cho lệnh không nằm trong
   allowlist: non-root, source read-only, `--network=none`, `cap_drop ALL`.

Nguyên tắc: mọi họ lệnh nguy hiểm phải xuất hiện ở **cả** lớp 1 và lớp 2
(`smoke_guardrail.sh` infra-4 và `redteam.sh` 8b kiểm điều này).

G.3 Vòng đời hook
| Sự kiện | Handler | Chế độ |
|---|---|---|
| SessionStart | `session_start.py` | FAIL-OPEN — khởi tạo state, bơm nhánh git vào context |
| PreToolUse | `pre_tool_use.py` | **FAIL-CLOSED** — guardrail |
| PostToolUse | `post_tool_use.py` | FAIL-OPEN, async — đếm tool_calls |
| PostToolUseFailure | `post_tool_use_failure.py` | FAIL-OPEN, async — đếm lỗi/retry |
| ConfigChange | `config_change.py` | **FAIL-CLOSED** — đối chiếu sha256 policy với ledger |
| SessionEnd | `session_end.py` | FAIL-OPEN, ≤1s — chốt state, so ngân sách, ghi telemetry |

State là một file JSON duy nhất (`.agent/memory/state.json`), khoá ở mức OS và
ghi bằng `os.replace`.

G.4 Subagent và uỷ quyền (`.claude/agents/`)
```
orchestrator (agent duy nhất có tool Agent)
  ├── architect-planner  (read-only: Read/Grep/Glob/WebFetch — lập kế hoạch, contract)
  ├── software-engineer  (code trong src/, chạy lint/typecheck/test)
  ├── qa-test-engineer   (test, story bảy trạng thái, snapshot 1440px)
  └── devops-secops      (CI, Docker, audit bảo mật — chỉ được SIẾT, không được nới)
```
`CLAUDE_CODE_MAX_SUBAGENT_SPAWN_DEPTH=2`; các agent lá đã gỡ tool `Agent` nên
không thể tự sinh agent (redteam scenario 4).

G.5 Skills (`.claude/skills/`)
`api-contract-design` · `ui-component-design` · `tdd-refactoring` ·
`database-ops` · `git-advanced` · `performance-profiling` · `security-audit` ·
`docker-containerization`. Mỗi skill đã gắn với luật của repo này — ưu tiên
dùng skill thay vì tự nghĩ quy trình mới.

G.6 MCP
`.mcp.json` khai 8 server: filesystem, git, database (sqlite read-only),
github, puppeteer, memory, fetch, internal-api (server Python nội bộ).
Ma trận quyền ở `.agent/mcp/permissions.json`, mặc định `ask_user`; nhóm
`blocked` gồm ghi `.claude/**`, `.agent/policy/**`, `.env`, `git_push --force`,
`git_reset --hard`, DDL của database, `merge_pull_request`. `fetch` chỉ được
gọi trong `domain_allowlist`.

G.7 Workflows (`.agent/workflows/`)
DAG khai báo bằng YAML, có `depends_on`, chạy qua orchestrator:
`feature-development` (plan → contract → implement → unit test ∥ security
review → report) · `hotfix-patch` (repro → locate → fix → verify → report) ·
`database-migration` (design → seed ∥ implement → test → report).

G.8 Adaptive policy — tiến hoá bất đối xứng
- **Siết** (`deny`/`warn`) có thể tự khai thác từ telemetry:
  `collect.py → mine.py → candidate → shadow → enforce`, mỗi rule bắt buộc có
  `expires_at`.
- **Nới** (`allow`) là bất khả thi trên đường tự động: `compile.py` từ chối mọi
  rule `effect: allow` và từ chối cả file nếu có field lạ.
- `rules.source.yaml` chỉ người sửa. Hash sha256 của bản compile ghi vào
  `ledger.jsonl`; hook ConfigChange so hash mỗi lần config đổi.

G.9 Chạy kiểm thử harness
```
bash .agent/tests/verify_install.sh     # RED/GREEN từng lớp — chạy đầu tiên
bash .agent/tests/smoke_guardrail.sh    # phase 1
bash .agent/tests/smoke_lifecycle.sh    # phase 2
bash .agent/tests/smoke_agents.sh       # phase 3
bash .agent/tests/smoke_mcp.sh          # phase 4
bash .agent/tests/smoke_workflows.sh    # phase 5
bash .agent/tests/smoke_policy.sh       # phase 6
bash .agent/tests/redteam.sh            # 8 kịch bản tấn công, phải chặn hết
python .agent/evals/runner.py --dry-run # xu hướng false-positive
```
Cần `python` (3.11) + `PyYAML`; `redteam.sh`/sandbox cần `docker`.

G.10 File do người vận hành sở hữu (agent KHÔNG ghi được)
| Đích (được bảo vệ) | Bản gốc |
|---|---|
| `.claude/settings.json` | `.agent/deploy/settings.json` |
| `.githooks/{pre,post}-commit` | `.agent/deploy/githooks/*` |
| `.agent/policy/**` | `.agent/deploy/policy/*` |

Nới luật (thêm allow, gỡ `protected_paths`, thêm binary vào
`allowed_binaries`) = sửa `HARNESS.yaml`/`settings.json` **qua PR có người
duyệt**, rồi áp bằng tay từ `deploy/`. Agent không tự làm được và không được
tìm cách đi vòng.

Trạng thái cài đặt tại 2026-08-14 (`verify_install.sh`, log thật):
- Lớp 1 `permissions.deny`: **GREEN**.
- `.claude/settings.json` mới có `PreToolUse` — **chưa** áp bản Phase-2 (thiếu
  `env` và 5 hook còn lại). Áp: copy `.agent/deploy/settings.json` đè lên rồi
  mở phiên mới đã trust.
- Git hook: **chưa cài** (`core.hooksPath` chưa set). Cài:
  `cp .agent/deploy/githooks/* .githooks/ && chmod +x .githooks/* && git config core.hooksPath .githooks`.
- `.agent/policy/` chưa tồn tại (mới có bản gốc trong `deploy/`) → hook
  ConfigChange chưa có ledger để đối chiếu.
- 6 smoke suite: **GREEN**.

G.11 Kill switch
Khi guardrail chặn nhầm lúc khẩn cấp: `claude --settings '{"disableAllHooks": true}'`.
Chỉ **người vận hành** được tắt (agent không được đề xuất tự tắt để đi tiếp);
ghi lý do + thời điểm vào `.agent/telemetry/killswitch.log`; bật lại ngay khi
xong. Khi hook tắt, vẫn còn: `permissions.deny`, git hook, sandbox Docker.

G.12 Trần chi phí một phiên (`HARNESS.yaml: budgets`)
400 tool call · 240 phút · 30 phiên/ngày. `session_end.py` ghi phần so sánh vào
telemetry; vượt trần là tín hiệu chia nhỏ việc, không phải tín hiệu nới trần.

---

H. TÀI LIỆU LIÊN QUAN
- `AGENTS.md` — bản rút gọn cho agent không phải Claude Code. Là bản sao dẫn
  chiếu, không phải nguồn sự thật; sửa luật thì sửa file này trước.
- `.agent/ARCHITECTURE.md` — thiết kế harness, lý do chọn giải pháp, chủ sở hữu
  và nhịp rà soát quý.
- `docs/master-brief.md`, `docs/architecture.md`, `docs/domain-contracts.md`,
  `docs/components-*.md` — đặc tả sản phẩm và component.
- `README.md` — danh sách lệnh.
