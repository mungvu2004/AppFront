<!-- qa-sources fe=82e18a88 -->
# Phase 07 — Account: FE coverage inventory

Screen SCR-33 Account Settings (`/tai-khoan`, `src/routes/router.tsx:60,390`). Source `F:/App/AppFront` @ 82e18a88.
Backend rules (N11 `GET /me`, N12 `PATCH /me` field rules and 422 codes, N13 `POST /me/password` 422/429/session
revocation, N14 `PUT /me/avatar` codes and 429) live in `coverage/phase07-be.md` (API spec), not here.

Test keys:
- **M** `tests/phase07_account.spec.ts` (serial, admin) — title quoted by key words.
- **E** `tests/phase07_account_edge.spec.ts` (non-serial, own context per test, one `engineer` invitee per worker) — `E07 · …` titles.
- **E02** `tests/phase02_dashboard_edge.spec.ts` (entry from the notification drawer gear).
- **UI** dedicated UI-verify spec `phase07_*_ui.spec.ts` (owner: qa-verify-ui step; not present yet, not counted here).

Path short names (under `src/screens/account/AccountSettings/`): `AS` AccountSettings.tsx, `ASC` AccountSettings.container.tsx,
`UAS` useAccountSettings.ts, `ASG` accountSettingsGateway.ts, `PS` ProfileSection.tsx, `ARD` AvatarReplaceDialog.tsx,
`UAP` useAccountPreferences.ts, `AP` AppearanceSection.tsx, `NS` NotificationsSection.tsx, `SS` ShortcutsSection.tsx,
`UAT` useAccountTables.ts, `PWS` PasswordSection.tsx, `UAA` useAccountAuth.ts, `AAG` accountAuthGateway.ts.
Others: `CA` src/lib/autosave/createAutosave.ts, `I18N` src/i18n/vi.json, `TST` src/components/feedback/Toast.tsx,
`INP` src/components/ui/Input.tsx, `FR` src/components/ui/FieldRow.tsx.

## Page — route, states, save indicator, undo

| # | Group | Element / state | Source (file:line) | Covering test | Status |
|---|---|---|---|---|---|
| 1 | Navigation | Anonymous → `/login?next=%2Ftai-khoan` (SessionBootstrap, G1); no `GET /api/me` | `src/routes/router.tsx:390` | E "anonymous visit → /login?next=%2Ftai-khoan" | covered |
| 2 | Navigation | Entry: dashboard drawer gear "Mở cài đặt thông báo" → `/tai-khoan#account-notifications` | `ASC:52-56` | E02 "Mở cài đặt thông báo goes to /tai-khoan" | covered |
| 3 | Keyboard | Hash deep link: scrollIntoView + `tabindex=-1` + focus on the block heading; again on `hashchange` | `ASC:57-85` | E "deep link #account-notifications focuses…; hash change moves focus" | covered |
| 4 | Network | `GET /api/me` (N11) on open; local-only blocks from module memory | `UAS:225-228`, `ASG:117-131` | M beforeAll, E every test (`openAccount`) | covered |
| 5 | State | Loading: every block `Skeleton preset="property-panel"`, no field | `AS:86`, `UAS:415` | E "loading state [held real response]" | covered |
| 6 | State | Read error: `InlineAlert` "Không tải được cài đặt tài khoản" + description replaces the blocks; "Thử lại" refetches | `AS:184-193`, `UAS:409-420` | E "[mocked response] GET /api/me 500 …" | covered (mock, unpairable 5xx) |
| 7 | State | Render crash → `ScreenErrorBoundary` fallback (`EmptyState` + retry) | `ASC:37-50,97-108` | — | gap (no way to crash the view on the real stack; P3) |
| 8 | Permission | No role gate: engineer gets the same five blocks | `AS:113-183`, plan G2 | E "non-admin (engineer) gets the whole screen" | covered |
| 9 | Feedback | Save indicator idle "Chưa có thay đổi" | `AS:110`, `I18N:67`, `src/hooks/useSaveIndicator.ts:37` | E "non-admin…", E "Họ tên emptied … retyping … sends nothing" | covered |
| 10 | Feedback | Saved "Đã lưu lúc …" | `src/hooks/useSaveIndicator.ts:44` | M row 1+2, E jobTitle/phone/debounce/offline | covered |
| 11 | Feedback | Local-only save "Chỉ giữ trong phiên này" | `UAS:109,315-318,422-423` | M row 1+2 / row 2, E theme keyboard / toggles / matrix / compact | covered |
| 12 | Feedback | Failed "Lưu thất bại. Hệ thống sẽ thử lưu lại ở lần chỉnh sửa tới." on a 4xx (no retry) | `I18N:70`, `CA:183-189` | E "Chức danh 121 … real 422", E "Họ tên emptied" | covered |
| 13 | Feedback | Offline "Ngoại tuyến — sẽ lưu khi có mạng", recheck every 5 s, flush when back online | `I18N:71`, `CA:80,161-165,176-179` | E "offline edit …" | covered |
| 14 | Feedback | Transient "Có thay đổi chờ đồng bộ" / "Đang lưu…" | `I18N:68-69`, `UAS:168-181` (toSaveState) | — | gap (sub-second states; P3) |
| 15 | Feedback | Transient-error retry 5/15/45 s (5xx/network mid-save) | `CA:181-200`, `src/lib/autosave/retrySchedule.ts` | — | gap (5xx not producible; P3) |
| 16 | Toast | Undo toast "Đã lưu cài đặt tài khoản." + "Hoàn tác" → PATCH with the previous value, no new ticket | `UAS:121,329-353`, `TST:120,149` | E "undo toast … Hoàn tác sends PATCH with the previous value" | covered |
| 17 | Toast | Toast grouping within 5 s; 8 s expiry; hover pauses | `src/lib/mutations/notificationBus.ts:8`, `src/lib/mutations/undoTicket.ts:18`, `TST:59-93` | — | gap (P3; hover used, not asserted) |

## Profile

| # | Group | Element / state | Source (file:line) | Covering test | Status |
|---|---|---|---|---|---|
| 18 | State | Empty: initials avatar (`span[aria-label]`), "Chưa đặt" placeholders for job title / phone | `PS:126-132`, `UAP:155-158,608-609`, `src/components/ui/Avatar.tsx:37-43` | E "non-admin … empty-state placeholders, initials avatar" | covered |
| 19 | Input | "Họ tên" → `PATCH /api/me {fullName}` only | `PS:179-187`, `ASG:133-169` | E "Họ tên emptied" | covered |
| 20 | Validation | "Họ tên" empty → real 422 field fullName → "Họ tên cần từ 1 đến 120 ký tự, không chứa ký tự điều khiển." | `UAS:113,299-313` | E "Họ tên emptied → real 422" | covered |
| 21 | Validation | Retyping the saved value: problem cleared, no PATCH (draft = saved) | `UAS:281-288,364-376` | E "Họ tên emptied … retyping the saved name … sends nothing" | covered |
| 22 | Input | "Chức danh" → PATCH {jobTitle} only, reload keeps it | `PS:189-198` | M row 1+2 | covered |
| 23 | Validation | "Chức danh" 121 → 422 "Chức danh tối đa 120 ký tự…", `aria-invalid`; 120 → 200, error cleared | `UAS:114,299-313,364-376`, `INP:91,110-117` | E "Chức danh 121 characters … 120 characters" | covered |
| 24 | Validation | "Chức danh" of spaces → 200, cleared (response without jobTitle); reload → empty + placeholder | `ASG:62`, BE `apps/api/me/schemas.py:56-65` | E "Chức danh of spaces only" | covered |
| 25 | Input | "Điện thoại" 33 → 422 "Số điện thoại tối đa 32 ký tự."; 32 → 200 | `PS:219-230`, `UAS:115` | E "Điện thoại 33 characters … 32" | covered |
| 26 | Network | Burst of edits → one PATCH after 800 ms with the last value | `UAS:103`, `CA:205-216` | E "quick successive edits … ONE PATCH" | covered |
| 27 | Network | Max-wait 5 s under continuous typing | `CA:78,210-213` | — | gap (P3) |
| 28 | Select | "Ngôn ngữ" combobox → "Tiếng Anh" → PATCH {language:"en"}; back to vi | `PS:243-259`, `UAP:117-120` | E "Ngôn ngữ → Tiếng Anh … back to Tiếng Việt" | covered |
| 29 | Display | Email read-only (plain text, `isReadOnly` → no input) + short reason | `PS:200-217`, `INP:63-68`, `UAP:150,603,630` | E "non-admin…", E "Đổi thư điện tử" | covered |
| 30 | Button | "Đổi thư điện tử" → longer reason only, no request | `PS:204-211`, `UAP:151-153,632` | E "Đổi thư điện tử only swaps in the longer read-only reason" | covered |
| 31 | Layout | Email row: long address + "Đổi thư điện tử" overflow the card (1440 px) and the page (375 px, +310 px) | `PS:200-217`, `INP:63-68` | E "compact 375 px …" (fails: overflow 310 px, offenders in JSON) | covered — **app failure** |
| 32 | Display | Row flash on commit (340 ms) | `UAP:448-470`, `PS:116-120` | — | gap (visual, transient; P3) |

## Avatar

| # | Group | Element / state | Source (file:line) | Covering test | Status |
|---|---|---|---|---|---|
| 33 | Input | "Đổi ảnh" `<label>` → file input (png/jpeg) | `PS:133-160` | M row 4, E avatar tests | covered |
| 34 | Validation | Type not png/jpeg → "Chỉ nhận ảnh PNG hoặc JPEG.", no dialog, no PUT | `UAP:174,528-532`, `PS:170-174` | E "avatar rejected on the spot: GIF …" | covered |
| 35 | Validation | > 512 KB → "Ảnh tối đa 512 KB. Hãy chọn ảnh nhỏ hơn.", previous problem cleared | `UAP:163,175,526,534-538` | E "… 512 KB + 1 byte …" | covered |
| 36 | Boundary | Exactly 524 288 B passes (base64 = 699 052, not >) → dialog with preview "Ảnh đại diện mới" | `UAP:163,166,534,548`, `ARD:40-46` | E "avatar of exactly 512 KB passes the local checks" | covered |
| 37 | Validation | base64 > 699 052 → "Ảnh quá lớn, hãy chọn ảnh nhỏ hơn." | `UAP:176,548-551` | — | n/a-by-design (unreachable: any file ≤ 524 288 B encodes to ≤ 699 052) |
| 38 | State | "Đang tải ảnh lên…" status while reading / sending | `PS:163-167`, `UAP:159,542,573` | — | gap (transient; P3) |
| 39 | Error | FileReader failure → "Không đọc được ảnh này…" | `UAP:179,556` | — | gap (not producible from a test file; P3) |
| 40 | Dialog | A9 "Đặt ảnh đại diện?" + "Sau khi đặt chỉ thay được, không gỡ được." / "Thay ảnh đại diện?" + "Ảnh cũ không khôi phục được." | `ARD:30-33`, `UAP:618` | M row 4 (either title), E "avatar real upload … next pick asks Thay ảnh đại diện?" | covered |
| 41 | Dialog | "Huỷ" closes, no PUT | `ARD:51-53`, `UAP:562-566` | M row 4, E "avatar real upload" (second pick) | covered |
| 42 | Keyboard | Esc closes the dialog, no PUT | `ARD:36`, `src/components/overlay/Modal.tsx:64,78` | E "avatar of exactly 512 KB … Esc closes it" | covered |
| 43 | Network | "Thay ảnh" → `PUT /api/me/avatar` 200 → image shown with `alt "Ảnh đại diện của {name}"` | `UAP:568-599,583,607-609` | E "avatar real upload … ONE PUT … image shown" | covered |
| 44 | Double submit | Double click "Thay ảnh" → one PUT (`isAvatarUploading` guard, button `loading`) | `UAP:569`, `ARD:54-56` | E "avatar real upload: double click" | covered |
| 45 | Error | Real 422 FILE_TYPE_MISMATCH → "Nội dung tệp không khớp loại ảnh. Chọn lại tệp PNG hoặc JPEG.", dialog closed | `UAP:177,199-200,585-598` | E "avatar whose bytes are not an image → real 422" | covered |
| 46 | Error | Other N14 codes (AVATAR_TYPE_UNSUPPORTED, AVATAR_DIMENSIONS_EXCEEDED, IMAGE_TOO_LARGE, FILE_CORRUPT, VALIDATION contentBase64) → copy | `UAP:193-224` | — | gap (codes proven in the API spec; UI copy P3) |
| 47 | Error | 429 → "Đã thử nhiều lần…" + picker locked ≥ 60 s | `UAP:169,180,216-220,506-514`, `PS:137` | — | gap (needs 11 PUTs / 15 min per user; limit in API spec; P3) |
| 48 | Keyboard | "Đổi ảnh" focus ring + Enter opens the picker | `PS:147-160` | — | gap (native file chooser; P3) |

## Appearance

| # | Group | Element / state | Source (file:line) | Covering test | Status |
|---|---|---|---|---|---|
| 49 | Radiogroup | "Chủ đề" click → `<html class=dark>` + `localStorage['app-theme-mode']`, memory only | `AP:60-64,197-205`, `UAP:472-488` | M row 1+2 | covered |
| 50 | Keyboard | "Chủ đề" ArrowRight / ArrowLeft: check + focus the neighbour, theme applied | `AP:124-149` | E "Chủ đề by keyboard" | covered |
| 51 | Logic | "Theo hệ thống" resolves through `prefers-color-scheme` | `UAP:322-333` | E "Chủ đề by keyboard" (when the start is Tối) | covered (branch depends on the start theme) |
| 52 | Switch | "Dùng nền tối cho khung nhìn 3D" | `AP:207-218`, `UAP:385` | E "Dùng nền tối …, Hiện lưới …, Gọn" | covered |
| 53 | Switch | "Giảm chuyển động" → `html[data-reduced-motion=true]` | `AP:220-227`, `UAP:490-502` | M row 2 | covered |
| 54 | Switch | "Hiện lưới 100 mm" | `AP:229-236`, `UAP:387` | E toggles test, E reload test | covered |
| 55 | Radiogroup | "Mật độ hiển thị" Gọn → rows `min-h` 40 → 36 px (profile rows too) | `AP:238-246`, `UAP:133-148,604`, `FR:62-70` | E toggles test | covered |
| 56 | Refresh | Reload: local-only settings back to defaults; theme kept (localStorage) | `ASG:97-98,126-130`, `UAP:371-373,384-388` | E "reload: local-only settings … fall back; the theme survives" | covered |
| 57 | Layout | "Chủ đề" segmented control overflows at 375 px ("Theo hệ thống" right edge 381 px) | `AP:137-175` | E "compact 375 px …" (JSON offenders) | covered — **app failure** (same test as #31) |

## Notifications

| # | Group | Element / state | Source (file:line) | Covering test | Status |
|---|---|---|---|---|---|
| 58 | Table | 5 events × 2 channels checkboxes, defaults from `fallback` | `UAT:97-143,156-175,345-360`, `NS:129-170` | E "notification matrix: 5 × 2 defaults" | covered |
| 59 | Checkbox | Click → memory only, local-only label | `NS:158-163`, `UAT:325-343` | M row 2 | covered |
| 60 | Keyboard | Space on a focused checkbox toggles it | `NS:158-163` | E "notification matrix … Space" | covered |
| 61 | Layout | < 640 px: list of named groups (`role=group` aria-labelledby the event) with two switches | `NS:95-126`, `UAT:274-300` | E "compact 375 px …" | covered (test fails on #31/#57, the list itself passed) |

## Shortcuts

| # | Group | Element / state | Source (file:line) | Covering test | Status |
|---|---|---|---|---|---|
| 62 | Search | "Tìm phím tắt" filters; count status "Đang hiện N trong T phím tắt." | `SS:115-128`, `UAT:364-385` | M row 3, E "Tìm phím tắt ignores case and diacritics" | covered |
| 63 | Search | Case / diacritics folded ("HOAN TAC" → 2, "dong lop" → 1) | `UAT:364-377`, `src/lib/format/fold.ts:36-38` | E shortcuts test | covered |
| 64 | State | No match → "Không có phím tắt nào khớp với ô tìm." | `SS:170-176`, `UAT:399` | E shortcuts test (M when "Ctrl" matches 0) | covered |
| 65 | State | Cleared → all rows + "T phím tắt đang có hiệu lực." | `UAT:382-384` | E shortcuts test | covered |
| 66 | Display | Key caps as pressed ("Ctrl", "Esc") | `UAT:242-246` | — | gap (visible in evidence, not asserted; P3) |

## Password

| # | Group | Element / state | Source (file:line) | Covering test | Status |
|---|---|---|---|---|---|
| 67 | Button | "Đổi mật khẩu" disabled until the three fields are filled | `PWS:195-204`, `UAA:650-655` | E "password checks on the spot" | covered |
| 68 | Validation | New < 8 → "Mật khẩu cần ít nhất 8 ký tự." | `UAA:82,163-165` | E password local | covered |
| 69 | Validation | No digit → "Mật khẩu cần có cả chữ và số." | `UAA:83,136-139,167-169` | E password local | covered |
| 70 | Validation | Same as current → "Mật khẩu mới phải khác mật khẩu hiện tại." | `UAA:84,371-374,387` | E password local | covered |
| 71 | Validation | Confirm differs → "Hai ô mật khẩu chưa khớp nhau." | `UAA:85,375,648` | E password local | covered |
| 72 | Display | Strength "Độ mạnh: yếu / khá / mạnh" | `PWS:74-76,106-129`, `UAA:181-191` | E password local | covered |
| 73 | Keyboard | Enter in a field submits the form | `PWS:145-153` | E password local | covered |
| 74 | Validation | After a submit, clearing current → "Chưa nhập mật khẩu hiện tại." | `UAA:79,644-646` | E password local | covered |
| 75 | Error | Real 422 CURRENT_PASSWORD_INCORRECT → "Mật khẩu hiện tại không đúng." on the current field; editing clears it | `AAG:175-177`, `UAA:80,356-364,416-423` | E "wrong current password, double-clicked …" | covered |
| 76 | Double submit | Double click → one `POST /api/me/password` | `UAA:354,378,394` | E wrong-current test | covered |
| 77 | Success | 204 → "Đã đổi mật khẩu. Các phiên đăng nhập khác đã bị đăng xuất.", fields cleared; own session kept | `UAA:86,406-411`, `PWS:191-193` | E "password change succeeds (test user)" | covered |
| 78 | Error | 429 → "Đã thử nhiều lần. Hãy đợi vài phút rồi thử lại." + button locked ≥ 60 s | `AAG:179-189`, `UAA:87,426-437` | — | gap (needs 6 POSTs / 15 min per user; limit in API spec; P3) |
| 79 | Error | Unavailable (5xx/network) → "Không đổi được mật khẩu lúc này…"; next wrong-current adds "Có thể mật khẩu đã đổi…" | `UAA:88-89,417-421,440-441` | — | gap (5xx not producible; P3) |
| 80 | State | SSO "Do quản trị viên công ty quản lý." read-only block | `PWS:60,134-143` | — | n/a-by-design (`AAG:152` isManagedExternally always false) |

## Hidden by design

| # | Group | Element / state | Source (file:line) | Covering test | Status |
|---|---|---|---|---|---|
| 81 | Section | "Phiên đăng nhập" absent | `AS:161-170`, `AAG:142` | M row 5, E "non-admin …" | covered (n/a-by-design asserted) |
| 82 | Section | "Vùng nguy hiểm" / "Xoá tài khoản" absent | `AS:172-182`, `AAG:142` | M row 5, E "non-admin …" | covered (n/a-by-design asserted) |
| 83 | Layout | Four viewports (1440/1024/768/375) layout metrics | whole screen | UI (not present) | gap (owner: qa-verify-ui) |

## Summary

- FE rows: 83 — covered 66 (incl. 2 "absent as designed" rows asserted, 2 rows covered by an app failure), gap 15,
  n/a-by-design 2, UNKNOWN 0.
- Edge spec: 27 tests, 1 `[mocked response]` (3.7 % < 35 %): `GET /api/me` 500 — `unpairable: 5xx is not producible on
  the shared stack` (row for `coverage/phase07-be.md`). One more test only holds the real `GET /api/me` response.
- App failures found by the author run: #31 / #57 — at 375 px the page scrolls 310 px sideways (read-only email
  `span.flex-1.truncate` + "Đổi thư điện tử" button, and the "Chủ đề" segment "Theo hệ thống"); at 1440 px the
  "Đổi thư điện tử" button already sits outside the card (evidence `E07_jobtitle_121_rejected.png`).
- Gap priority: (1) luồng chính — none open; (2) lỗi — #78/#47 429 locks, #79/#15 5xx paths, #46 avatar BE codes UI copy,
  #7 crash fallback; (3) biên — #27 max-wait, #17 toast grouping/expiry, #48 avatar picker by keyboard;
  (4) hiển thị — #14 transient indicator labels, #32 row flash, #38 uploading status, #66 key caps, #83 UI-verify spec.
