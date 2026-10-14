<!-- qa-sources fe=f748afb0 -->
# Phase 01 — FE coverage inventory (SCR-01, 02, 03, 04 + auth boundary of SCR-08…11, 37…41)

FE source: `F:/App/AppFront` HEAD `f748afb0` (previous stamp in the edge spec: `7735bcda`). Backend rules are in
`coverage/phase01-be.md` (separate agent); BE-rule gaps belong there, not here.

**Specs** — `M` = `tests/phase01_auth.spec.ts` (15) · `E` = `tests/phase01_auth_edge.spec.ts` (66) ·
`R` = `tests/phase01_recovery_edge.spec.ts` (30 at run time) · `U` = `tests/phase01_auth_ui.spec.ts` (28) ·
`A` = `tests/phase01_auth_api.spec.ts` (25, API layer, listed only for mock pairs). Test names are shortened;
"E·new" = added in this pass (describe "E01 FE refresh f748afb0"), "E·ext" = assertion added to an existing E test.

**Source abbreviations** — `SB` `src/routes/SessionBootstrap.tsx` · `SS` `src/routes/sessionSetup.ts` ·
`RF` `src/lib/auth/refresh.ts` · `AS` `src/screens/auth/AuthScreen/AuthScreen.tsx` · `UA` `…/AuthScreen/useAuthScreen.ts` ·
`AC` `…/AuthScreen/AuthScreen.container.tsx` · `FP` `…/AuthScreen/ForgotPasswordPanel.tsx` · `UF` `…/AuthScreen/useForgotPassword.ts` ·
`VP` `…/AuthScreen/ValuePanel.tsx` · `IA` `src/screens/auth/InvitationAccept/InvitationAccept.tsx` · `UI` `…/useInvitationAccept.ts` ·
`IC` `…/InvitationAccept.container.tsx` · `PR` `src/screens/auth/PasswordReset/PasswordReset.tsx` · `UP` `…/usePasswordReset.ts` ·
`PC` `…/PasswordReset.container.tsx` · `RS` `src/screens/auth/RecoveryShell.tsx` · `RSH` `src/screens/auth/recoveryShared.ts` ·
`FT` `src/screens/auth/fragmentToken.ts` · `PF` `src/screens/auth/PasswordField.tsx` · `RFo` `src/screens/auth/useReturnFocus.ts` ·
`RR` `src/screens/auth/RecoveryRoute.tsx` · `RT` `src/routes/router.tsx` · `PA` `src/routes/paths.ts` · copy = `src/i18n/vi.json` `auth.*`.

## What changed 7735bcda → f748afb0 on these screens (drives this pass)

| Change | Source | Effect on the suite |
|---|---|---|
| Gate notice decided by `pathname`, not by `?next=` | `SB:288-301, 401-403` | E "held response" test used `/?e01=gate` → stale (now no notice); rewritten to `/thong-bao?…`; `/?query` → no notice = E·new |
| Every /login strip (opening notices too) under "Đăng nhập"; strip action `lg fullWidth` (BUG-059) | `AS:111-116, 174-190` | E "[history state] opening notice … ABOVE the fields" stale → rewritten (UNDER); E·ext sizes |
| FIELD_ERROR_SLOT / _THREE_LINES on every box, no gap | `RS:41-54`, `AS:127-157`, `FP:65-70`, `IA:118-158`, `PR:93-120` | E·new "field room" ×3 |
| useReturnFocus on all four forms; catchDroppedFocus on the disabled-account way out | `RFo:16-46`, `AS:73, 119-125, 285-291, 359`, `FP:34`, `IA:73`, `PR:49` | E·ext (4 tests) |
| Forgot panel strip + "sent" block moved under the send button | `FP:79-99` | E·ext |
| Invitation warning + retry line moved under "Nhận lời mời" | `IA:161-176` | E·ext; R "signed in → warning … above the form" keeps a stale TITLE only (no position assert, other spec, not edited) |
| `?token=` in the query stripped from the URL (still not read) | `FT:81-108` | E "query token … URL untouched" ×2 stale → rewritten |
| RecoveryLink leaves modifier clicks to the browser | `RS:77-96` | E·new |
| Connection strip after the screen in DOM; "Ẩn" returns focus | `SB:70-122, 133-138, 315-321` | E·ext |
| `online`/`focus` restart the spent refresh ladder (also while `unknown`) | `RF:268-292` | E·new (page.clock) |
| /login column 24 px sides below 640 (BUG-052), top padding (BUG-058) | `AS:309-314` | E·new 375; 1024 no-scroll = U `U01_login_strips_1024` |

## SCR-01 — Session gate (every protected route)

| # | Nhóm | Phần tử / trạng thái | Nguồn | Test phủ | Trạng thái |
|---|---|---|---|---|---|
| 1 | Navigation | Anonymous protected URL → `/login?next=<path+search encoded>` (replace) | `SB:288-301, 401` | M "anonymous /projects/x/floors redirects" · E "[held response] gated non-root URL with a query" | covered |
| 2 | Feedback | Opening notice `signInRequired` for a non-root path, carried in history state | `SB:297-299`, `AC:278-285, 356` | E "[held response] gated non-root…" · E "anonymous on a gated non-root path … read once" | covered |
| 3 | Feedback | Root `/` and `/?query` → no notice (BUG-007, pathname rule) | `SB:297` | E "…anonymous / → no notice" · E·new "anonymous /?query … NO notice" | covered |
| 4 | Feedback | `sessionEnded` notice after authenticated→anonymous (cross-tab) | `SB:367-371, 295-296` | M "refresh cookie gone: tab A back to /login, tab B…" | covered |
| 5 | Loading | PendingShell "Đang mở phiên" (role=status, aria-busy, visible line) while `unknown` | `SB:202-228, 281-285` | E "[held response] gated non-root…" | covered |
| 6 | Error | Server unreachable at bootstrap → GateScreen h1 "Mất kết nối máy chủ" + "Kiểm tra mạng rồi thử lại." + "Thử lại" | `SB:269-279, 391-396` | E "[mocked response] server unreachable at bootstrap" | covered |
| 7 | Error | Setup chunk fails → h1 "Chưa mở được ứng dụng" + "Tải lại trang" (reload) | `SB:257-267, 375-389, 408` | E "[mocked response] session layer never loads" | covered |
| 8 | Network | Retry ladder: 8 transient attempts (1…60 s backoff) then stop | `RF:46, 325-357`, `src/lib/auth/bootstrap.ts:88-109` | E·new "retry ladder stops after 8 attempts" | covered |
| 9 | Network | `online` / `focus` after the ladder is spent → one fresh attempt (also while `unknown`); ignored mid-ladder | `RF:268-292` | E·new same test (`online`; `focus` = same handler, not driven) | covered |
| 10 | Error | Mid-session loss → ConnectionStrip region "Trạng thái kết nối", fixed bottom, screen not moved; "Thử lại" | `SB:110-159, 315-321` | E "[mocked response] signed in, a refresh fails mid-session" | covered |
| 11 | Keyboard | Strip after the screen in DOM/Tab order; "Ẩn thông báo kết nối" hides it and returns focus (never `<body>`) | `SB:70-91, 116-122, 133-138, 318-320` | E·ext mid-session test (DOM order + focus after "Ẩn") | covered |
| 12 | Navigation | Gate in front of SCR-08/10/11/37/38/39/40 routes (prod build: dev routes not public, `*` gated) | `PA:203-230`, `SB:326-332`, `RT:336-390` | E·new "anonymous on the routes of SCR-08/10/11/37/38/39/40" | covered |
| 13 | Navigation | Public `/login`, `/login/invitation/*`, `/login/reset-password/*` render while anonymous/unknown | `SB:253-255`, `PA:203-207` | M/E/R (every SCR-02/03/04 test) | covered |
| 14 | State | `Fragment key={userId}` remounts screens on user change | `SB:317` | — (needs two real users in one tab) | UNKNOWN — NEED VERIFICATION (not producible safely in Phase 1) |

## SCR-02 — Login `/login` (sign-in form)

| # | Nhóm | Phần tử / trạng thái | Nguồn | Test phủ | Trạng thái |
|---|---|---|---|---|---|
| 15 | Input | "Thư điện tử" type=email, autofocus on mount | `AS:130-143, 261-268` | E "[BUG-012] keyboard: email autofocused; Tab order…" | covered |
| 16 | Validation | Empty submit → "Chưa nhập thư điện tử." + "Chưa nhập mật khẩu.", no POST | `UA:613-635, 358-361` | E "empty submit" · U empty-submit shots | covered |
| 17 | Validation | Bad format on blur / submit → emailInvalid | `UA:380-383, 562-586` | M "bad Thư điện tử then blur" · E "<script>-like email" | covered |
| 18 | Validation | > 254 chars → emailTooLong, no POST | `UA:385-387`, `src/api/schemas/auth.ts:18-20` | E "email longer than 254 chars" · U long data | covered |
| 19 | Validation | Blur on an EMPTY box flags nothing (BUG-009) | `UA:562-569` | E "password rules: blur on an EMPTY box…" | covered |
| 20 | Validation | 7 chars → "Mật khẩu cần ít nhất 8 ký tự."; typing clears that field's problem | `UA:389-393, 530-542` | E "password rules…" | covered |
| 21 | State | `partial` only for a well-formed address + empty password; line under "Đăng nhập" | `UA:752-755`, `AS:192-197` | M "email filled, Mật khẩu empty → partial" · E "…only for a well-formed address" | covered |
| 22 | Layout | Each box keeps room for its complaint: complaints move neither boxes nor buttons (BUG-008) | `RS:41-48`, `AS:127-157` | E·new "every field keeps room for its complaint" · E·new 375 margins test | covered |
| 23 | Input | Eye "Hiện mật khẩu"/"Ẩn mật khẩu" toggles type; aria-controls; Enter/Space only toggle | `PF:26-60` | M eye test · E "Enter, then Space, on the focused eye button" | covered |
| 24 | Checkbox | "Ghi nhớ máy này": Space toggles once, Enter submits; posted as `rememberMe` | `AS:159-164, 92-102`, `UA:643-648` | E "Space toggles … Enter on the checkbox submits" · E "Ghi nhớ máy này off/on" | covered |
| 25 | Keyboard | Enter from any input submits once (native submit prevented) | `AS:92-102` | E "Enter in Mật khẩu submits exactly once" | covered |
| 26 | Keyboard | Tab order email → password → eye → checkbox → Đăng nhập → Quên mật khẩu | `AS:129-229` | E "[BUG-012] keyboard…" | covered |
| 27 | Keyboard | Focus returns to the last field after an attempt (fields disabled while sending) | `RFo:16-46`, `AS:73, 119-125` | E·ext "Enter in Mật khẩu … focus is back in Mật khẩu" | covered |
| 28 | Double submit | Two clicks in one tick → ONE POST (`inFlight` ref) | `UA:487, 613-641` | E "two clicks on Đăng nhập in the same tick" | covered |
| 29 | Loading | "Đang gửi…" + every control disabled while the session opens | `AS:69-72, 168-170`, `UA:743-745` | E "real sign-in: Đang gửi… with every control locked" | covered |
| 30 | Success | Success line under the button, then `onAuthenticated` → destination (replace) | `UA:652-667, 699-703`, `AC:340-342` | M "valid credentials → 204, refresh 200, /" · E "real sign-in…" | covered |
| 31 | Navigation | `?next=` / `state.from` honoured; open redirects (`//x`, `https:`, `javascript:`, `/\x`, `%2F%2F`, `/login` loop) → `/` | `AC:131-151, 327-338` | M next + open-redirect · E "?next= javascript:, /\host…" | covered |
| 32 | Navigation | Back after a gated sign-in skips /login | `SB:288-291`, `AC:341` | E "Back after a gated sign-in" | covered |
| 33 | Error | 401 INVALID_CREDENTIALS → strip + "Đặt lại mật khẩu" (same for unknown address) | `UA:265-266, 294-300` | M "ONE wrong password" · E "unknown address → the SAME 401…" | covered |
| 34 | Layout | Every strip (attempt results AND opening notices) under "Đăng nhập"; fields don't move | `AS:174-190` | E "unknown address…" · E (rewritten) "opening notice … UNDER" · E·ext signed-in strip · E·new reset-logout-offline (passwordReset notice) | covered |
| 35 | Layout | Strip action (reset / "Về danh sách dự án") full width, height of "Đăng nhập" (BUG-059) | `AS:111-116, 184-188` | E·ext "unknown address…" · E·ext "Ghi nhớ máy này…" (signed-in strip) · U 1024 strips | covered |
| 36 | Error | 429 → "Đã thử quá nhiều lần", locked 60 s regardless of Retry-After | `UA:260-262, 685-687`, `useLockout.ts` | E "[mocked response] 429 → … locked 60 s" | covered |
| 37 | Error | 403 ACCOUNT_DISABLED → form replaced (forbidden) + "Đăng nhập bằng tài khoản khác" → empty form | `UA:267-268, 603-607`, `AS:352-362` | E "[mocked response] 403 ACCOUNT_DISABLED…" | covered |
| 38 | Keyboard | Disabled-account way out catches the dropped focus; Enter on it | `AS:285-291, 359` | E·ext same test (toBeFocused + Enter) | covered |
| 39 | Error | 403 ORIGIN_MISMATCH strip, no reset action | `UA:269-270, 307-312` | E "[mocked response] 403 ORIGIN_MISMATCH" | covered |
| 40 | Error | 422 VALIDATION field email/password → under the box; other field → "Dữ liệu chưa phù hợp" | `UA:271-277, 675-683` | E "[mocked response] 422 VALIDATION…" | covered |
| 41 | Error | 500 → "Có trục trặc" + generic copy, not retried; network → description only, no title | `UA:331-340` | E "[mocked response] 500" · E "[mocked response] network failure" | covered |
| 42 | Error | 204 but refresh unreachable → signedInOffline, submit stays enabled (BUG-013) | `AC:166-191, 296-317, 348-352`, `UA:319-320` | E "[mocked response] login 204 but the follow-up refresh cannot reach the server" | covered |
| 43 | Error | 204 but no session (real refresh 401) → sessionNotOpened (BUG-014) | `AC:178-188`, `UA:321-322` | E "[mocked response] login 204 but the session does not open" | covered |
| 44 | State | Signed in on /login: form shown + "Bạn đang đăng nhập…" + "Về danh sách dự án" (no replace, Back → /login); hidden while sending | `AC:344-346, 378`, `UA:709-717` | M "signed in, /login shows the form" · E "Ghi nhớ máy này…" | covered |
| 45 | State | Opening notice from history: unknown key ignored, read once (F5 drops it), survives empty submit, replaced by first attempt | `AC:278-285, 356-370`, `UA:631-639, 719` | E "[history state] opening notice…" | covered |
| 46 | Data | Email sent trimmed, case kept; uppercase admin → 204 | `UA:643-648` | E "surrounding spaces + uppercase" · E "admin email in UPPERCASE" | covered |
| 47 | Feature off | No SSO button, no "Hoặc" divider (no host passes onSsoSignIn) | `UA:186-189, 781`, `AS:200-219` | M "no SSO flow wired" · E "[BUG-012] keyboard…" | n/a-by-design (asserted absent) |
| 48 | State | `collapsed` ("Mở lại biểu mẫu") — no host calls setCollapsed | `AS:316-321, 334-342`, `UA:589-591` | E·new "every field keeps room…" (asserts absent) | n/a-by-design (asserted absent) |
| 49 | Decoration | ValuePanel hero (lg+ only, aria-hidden canvas, not focusable); hidden < 1024 | `VP:39-144` | E "[BUG-012] keyboard… value panel shown at 1440 and not focusable" · E 375 "value panel gone" | covered |
| 50 | Error | WebGL/plan failure in the hero fails silently | `VP:61-68` | — (needs a GPU-less browser; not part of the run) | UNKNOWN — NEED VERIFICATION |
| 51 | Error | Screen crash → AuthCrashFallback (EmptyState, retry if retryable) | `AC:262-275, 392-401` | — (needs a code fault; no safe trigger on the real stack) | UNKNOWN — NEED VERIFICATION |
| 52 | Responsive | 375×812: no horizontal scroll, panel gone, strips/actions fit; 24 px sides (BUG-052); touch targets 44/46 px | `AS:309-315`, `PF:52`, `Input.tsx` | E compact ×3 · E "touch targets below 640 px" · E·new "375×812 · /login uses 24 px side margins" | covered |
| 53 | Responsive | 1024×768 tallest strip + action without vertical scroll (BUG-058) | `AS:309-314` | U "U01_login_strips_1024 [mocked response]" | covered |
| 54 | Keyboard × SCR-41 | `?` typed in a box is text; `?` on a button opens "Phím tắt"; Esc closes only the help, next Esc = panel back | `RT:301-333`, `src/lib/input/shortcutRegistry.ts:23-26`, `src/lib/tools/shortcuts.ts:189-209`, `FP:44-53` | E·new "SCR-02 × SCR-41 · ? typed in Thư điện tử stays text…" | covered |

## SCR-02 — "Quên mật khẩu" panel (same route)

| # | Nhóm | Phần tử / trạng thái | Nguồn | Test phủ | Trạng thái |
|---|---|---|---|---|---|
| 55 | Navigation | Open by click (BUG-009), Enter (BUG-011), Space; carries the typed address; focus in its box | `AS:270-273`, `UA:594-597` | M "[BUG-009] Quên mật khẩu…" · E "[BUG-009]…" · E "[BUG-011]…" · E "keyboard: the panel opens with the typed address" | covered |
| 56 | Navigation | "Quay lại đăng nhập" / Esc → back, focus on sign-in email, value kept | `FP:44-53, 100-106`, `AS:275-278` | M (Esc) · E "keyboard: … Quay lại đăng nhập (Enter) returns focus" | covered |
| 57 | Validation | Empty / invalid / > 254 → problem under the box, no POST | `UF:94-106` | E "invalid / empty address" · E "address longer than 254 chars" | covered |
| 58 | Success | 204 → neutral "sent" block in role=status, locked + sentHint; Enter does not resend; edit unlocks | `UF:73-77, 86-90, 118-121, 154-158`, `FP:85-99` | E "address with no account → 204…" · E Mailpit reset | covered |
| 59 | Layout | Strip and "sent" block UNDER the send button; field complaint moves nothing | `FP:65-70, 79-99` | E·ext "address with no account…" · E·ext "network / 403 / 500…" · E·new "every field keeps room…" | covered |
| 60 | Keyboard | Focus not dropped after a send / failure (useReturnFocus) | `FP:34, 57-63`, `RFo:16-46` | E·ext same two tests | covered |
| 61 | Loading / double submit | "Đang gửi…", box locked, double click → ONE {email} | `UF:68, 86-116` | E "[mocked response] sending…" | covered |
| 62 | Error | 429 → strip, locked max(Retry-After, 60) s; Retry-After 120 honoured (cap 120 s) | `RSH:136, 158-163`, `UF:136-138, 148`, `src/lib/http/retry.ts:7` | E "[mocked response] 429 → …" · E·new "429 with Retry-After 120…" | covered |
| 63 | Error | network / ORIGIN_MISMATCH / 500 strips; 422 email → box; Esc + reopen clears | `RSH:192-235`, `UF:126-134`, `UF:79-84` | E "[mocked response] network / 403 ORIGIN_MISMATCH / 500…" | covered |
| 64 | Responsive | 375: panel + its problem fit | `FP` | E "375×812: forgot panel…" | covered |

## SCR-03 — Invitation `/login/invitation#token=…`

| # | Nhóm | Phần tử / trạng thái | Nguồn | Test phủ | Trạng thái |
|---|---|---|---|---|---|
| 65 | Token | `#token` read once and stripped before any await; reload → dead-end | `FT:81-108`, `UI:131-135` | M "#token=bogus … #token stripped" · R "reload after the #token was stripped" | covered |
| 66 | Token | No hash / empty / no key / 513 chars → "incomplete link" dead-end + deadEndSubtitle; 512 → form | `UI:132-135, 182, 340`, `IA:80-99` | M "without a hash is the dead-end" · R "unusable #fragments…" | covered |
| 67 | Token | `?token=` in the query: not read, stripped from the URL, other keys kept | `FT:86-98` | E (rewritten) "invitation ?token= in the QUERY…" | covered |
| 68 | Navigation | Dead-end "Về trang đăng nhập" (client nav); Ctrl+click → browser new tab | `RS:77-113` | R "dead-end Về trang đăng nhập → /login" · E·new "Ctrl+click on Về trang đăng nhập" | covered |
| 69 | Validation | Empty → three "chưa nhập"; mismatch; name > 120; password < 8; typing clears | `UI:110-122, 187-211`, `RSH:250-268` | M mismatch · E "Họ và tên autofocused; Enter on the empty form" · R "client rules…" | covered |
| 70 | Layout | Complaints move neither the submit button (FIELD_ERROR_SLOT_THREE_LINES on the name) | `IA:118-158`, `RS:41-54` | E·new "Enter on the empty recovery form…" | covered |
| 71 | Input | Eye per password box (aria-controls its own input); 8-char hint describes the first box | `PF:26-60`, `IA:134-145` | E "password boxes: one eye per box…" | covered |
| 72 | Error | 422 INVITATION_TOKEN_INVALID → "expired" dead-end | `UI:182, 244`, `RSH:165-170` | E "invitation #token=bogus + valid matching passwords → 422" | covered |
| 73 | Error | 422 field fullName (bidi) / password → copy under that box | `UI:246-252`, `RSH:274-276` | E "real BE: name with U+202E" · R "[mocked response] 422 VALIDATION field fullName / password" | covered |
| 74 | Error | 500 / network / 429 / ORIGIN_MISMATCH strips under the button; 429 locks | `RSH:192-235`, `IA:176` | E "[mocked response] 500 … 429 …" · R network / 429 / 403 / slow 500 | covered |
| 75 | Keyboard | Focus back on the submit button after a failed attempt | `IA:73, 111-116`, `RFo` | E·ext "[mocked response] 500 …" (non-429 kinds) | covered |
| 76 | Session | Pending session → form `aria-busy`, submit disabled | `IA:114`, `UI:188, 334`, `IC:31` | E `openRecoveryForm` waits for enabled (implicit) | covered (implicit) |
| 77 | Session | Server unreachable at load → strip + "Thử lại"; pending/failed line; success → focus on "Họ và tên" | `IA:52-60, 103-109, 169-174`, `UI:277-292, 341-348` | E "[mocked response] server unreachable at load…" · R same | covered |
| 78 | Layout | Retry line + signed-in warning UNDER "Nhận lời mời" | `IA:161-176` | E·ext "server unreachable at load…" (retry line) · E·ext "admin email in UPPERCASE … invitation warning" | covered |
| 79 | Session | Signed in → "Nhận lời mời sẽ đăng xuất tài khoản đang đăng nhập." | `UI:330-333` | R "signed in → … warning" · E·ext UPPERCASE test | covered |
| 80 | Success | 204 → "Đã nhận lời mời. Đang mở tài khoản…" → session → `/` | `UI:221-233`, `IA:169-174` | E Mailpit "real invitation link" · R "[mocked response] signed in, 204" | covered |
| 81 | Error | 204 but no session → "Đã nhận lời mời nhưng chưa mở được phiên…", form locked, link → /login | `UI:235-238, 318-321`, `IA:178-184` | R "[mocked response] 204 but no session" | covered |
| 82 | Double submit | Slow 500: "Đang gửi…", fields locked, double click → ONE request | `UI:187-188, 213-216` | R "[mocked response] slow 500…" | covered |
| 83 | State | `collapsed` / "Mở lại biểu mẫu" — routes pass no isCollapsed | `IA:84-92`, `IC:51` | E·new "Enter on the empty recovery form…" (absent) | n/a-by-design (asserted absent) |
| 84 | Error | Crash → RecoveryRoute CrashFallback | `RR:13-43` | — | UNKNOWN — NEED VERIFICATION (no safe trigger) |
| 85 | Responsive | 375: form fits, 24 px sides | `RS:23-24` | R "375×812: form fits" · E "touch targets … recovery screens use 24 px" | covered |

## SCR-04 — Password reset `/login/reset-password#token=…`

| # | Nhóm | Phần tử / trạng thái | Nguồn | Test phủ | Trạng thái |
|---|---|---|---|---|---|
| 86 | Token | No hash / unusable fragments / reload → "incomplete" dead-end + deadEndSubtitle | `UP:97-101, 141, 252`, `PR:71-79` | M "without a hash is the dead-end" · R unusable fragments + reload | covered |
| 87 | Token | `?token=` in the query: not read, stripped | `FT:86-98` | E (rewritten) "reset ?token= in the QUERY…" | covered |
| 88 | Validation | Empty / < 8 / mismatch → under the boxes, no request | `UP:145-165`, `RSH:250-268` | R "short new password … mismatch" · R "Enter on the empty form" | covered |
| 89 | Layout | Complaints move neither "Đổi mật khẩu" nor "Về trang đăng nhập" | `PR:93-128` | E·new "Enter on the empty recovery form…" | covered |
| 90 | Navigation | "Về trang đăng nhập" under the button on the usable form (BUG-050); modifier click left to the browser | `PR:128`, `RS:77-96` | E "the usable reset form has Về trang đăng nhập…" · E·new Ctrl+click (dead-end) | covered |
| 91 | Error | 422 PASSWORD_RESET_TOKEN_INVALID / VALIDATION token → "expired" dead-end | `UP:141, 191`, `RSH:165-170` | E "reset #token=bogus … [mocked response] 422" · R "[mocked response] 422 VALIDATION field token" | covered |
| 92 | Error | 422 field newPassword → under "Mật khẩu mới" | `UP:193-196` | R "[mocked response] 422 VALIDATION field newPassword" | covered |
| 93 | Error | 500 / network / 429 / ORIGIN strips under the button; focus back on the button | `RSH:192-235`, `PR:49, 82-86, 126` | E "[mocked response] 500 …" (+E·ext focus) · R network / 429 / 403 | covered |
| 94 | Success | 204 → success line → signOut → `/login` with "Đã đổi mật khẩu…" (once; F5 drops it) | `UP:172-185`, `PC:30` | E Mailpit real reset · R "[mocked response] 204 → success line…" | covered |
| 95 | Error | 204 but the logout cannot reach the server → still `/login` + notice (finally) | `UP:178-183`, `src/lib/auth/session.ts:199-208` | E·new "reset 204 but the logout cannot reach the server" | covered |
| 96 | State | `collapsed` unreachable | `PR:62-70`, `PC:37` | E·new "Enter on the empty recovery form…" | n/a-by-design (asserted absent) |
| 97 | Responsive | 375: fits, 24 px margins | `RS:23-24` | R 375 · E touch targets | covered |

## SCR-08, 09, 10, 11, 37, 38, 39, 40, 41 — only their auth boundary belongs to Phase 01

Element-level inventories of these screens are owned by their phases (`phase03_pipeline`, `phase08_admin`,
`phase09_roles_matrix`, `phase10_system_routes`, `phase11_teardown`) and are NOT re-inventoried here (Phase 01
must not edit or run those specs). Rows below = what Phase 01 touches + the plan rows with their owning test.

| # | Nhóm | Phần tử / trạng thái | Nguồn | Test phủ | Trạng thái |
|---|---|---|---|---|---|
| 98 | Gate | Anonymous `/projects/:id/settings` (SCR-08), `/upload` (SCR-10), `/quality` (SCR-11), `/admin/users` (SCR-37), `/khong-co-quyen` (SCR-38), unknown path (SCR-39), `/demo` (SCR-40, prod) → login + notice | `PA:203-230`, `SB:288-301, 326-332` | E·new "anonymous on the routes of SCR-08/10/11/37/38/39/40" | covered |
| 99 | Gate | Anonymous `/projects/x/floors` (SCR-09) | same | M "anonymous /projects/x/floors redirects" | covered |
| 100 | SCR-41 | `?` / Esc on /login (UndoShortcuts wraps public routes too) | `RT:301-333` | E·new "SCR-02 × SCR-41…" | covered |
| 101 | SCR-41 | `?` opens GlobalShortcutHelp on NotFound, Esc closes | `RT:301-333` | `phase10_shortcuts_edge` FL-10K-01 | covered (phase 10) |
| 102 | SCR-38 | "Đăng nhập bằng tài khoản khác" → POST logout → `/login` (state.from); "Về danh sách dự án" → `/` | `src/screens/system/AccessDenied/*` | `phase11_teardown` "SCR-38 …" ×2 | covered (phase 11) |
| 103 | SCR-37 | Invite user (sends mail) → token consumed by SCR-03 | `src/screens/admin/UserManagement/*` | `phase08_admin` "Mời người dùng (opt-in)"; SCR-03 side via API invitation in E Mailpit test | covered (phase 08 opt-in) / E (API) |
| 104 | SCR-39 | NotFound page (signed in) | `src/screens/system/NotFound/*` | `phase10_notfound_edge` FL-10N-01..03 | covered (phase 10) |
| 105 | SCR-40 | Dev routes render on the mock dev server; NotFound on the prod build when signed in | `PA:221-230` | `phase10_dev_*` (devTest) + `phase10_dev_e_edge` FL-10E-19 | covered (phase 10) |
| 106 | SCR-08…11 | Plan rows (settings tabs/notes/address/units; floors add/rename/reorder/height/elevation/hide; upload/blocked/reject; quality report/corners/straighten/continue) | plan §4 Phase 3, 11 | `phase03_pipeline`, `phase09_roles_matrix`, `phase11_teardown` | covered (owning phases) |
| 107 | SCR-08…11, 37…41 | Every other element/state of these screens | their source dirs | — | UNKNOWN — NEED VERIFICATION in their own phase inventories (out of Phase 01 scope) |

## Mock pairs (UI tests titled "[mocked response]")

| UI test (spec) | Pair | Status |
|---|---|---|
| E gate "server unreachable at bootstrap" · E "signed in, a refresh fails mid-session" · E·new "retry ladder" · E "login 204 but the follow-up refresh cannot reach the server" · E/R "network failure" strips · E/R invitation "server unreachable at load" · E·new "reset 204 but the logout cannot reach the server" (logout half) | — | unpairable: network loss |
| E "session layer never loads (lazy JS chunks fail)" | — | unpairable: static asset failure, no API involved |
| E/R/U 429 strips (login, forgot, accept, confirm), E·new "429 with Retry-After 120" | A01 "5 attempts … 6th → 429 RATE_LIMITED + Retry-After" (login) | login: paired · recovery: unpairable: IP-wide recovery lockout (10/900 s shared with the whole run) |
| E/R 500 strips (login, forgot, accept, confirm) | — | unpairable: 5xx not producible safely |
| E/R 403 ORIGIN_MISMATCH strips | A01 "foreign or missing Origin → 403 ORIGIN_MISMATCH on all six routes" | paired |
| E 403 ACCOUNT_DISABLED | A01 invitation accept … "right password 403 ACCOUNT_DISABLED" | paired |
| E 422 VALIDATION login (password / unknown field) | A01 "login 422 VALIDATION field password" + "unknown key" | paired |
| E/R 422 VALIDATION recovery (email / token / fullName / newPassword) | A01 "recovery routes — body rules, real 422 for every mocked 422" + "513-character token" | paired |
| E reset 422 PASSWORD_RESET_TOKEN_INVALID | A01 password-reset … "token single-use → 422 PASSWORD_RESET_TOKEN_INVALID" | paired |
| E "login 204 but the session does not open" (204 without cookie) | A01 refresh "without a cookie → 401" | paired |
| R "204 but no session" (invitation) · R/E "204 → success line…" (reset, accept) · E·new reset 204 half | A01 invitations/accept 204 · A01 password-reset/confirm 204 (real Mailpit tokens) | paired |
| E forgot "sending… double click" (held 204) | A01 password-reset request 204 | paired |
| U "U01_login_strips_1024" | uses the same mocked kinds as above | paired / unpairable as above |

## Summary

- FE rows: **107** (SCR-01 14, SCR-02 sign-in 40, panel 10, SCR-03 21, SCR-04 12, boundary 10).
  covered **98** (incl. 6 owned by other phases), n/a-by-design asserted **4** (rows 47, 48, 83, 96),
  UNKNOWN **5** (rows 14, 50, 51, 84, 107), gap **0** after this pass (BE gaps: `coverage/phase01-be.md`).
- This pass: 4 stale E tests rewritten for f748afb0 (gate notice, opening-notice position, 2 × query token),
  10 E tests extended (focus return ×4, BUG-059 sizes ×2, panel layout ×2, invitation warning/retry line ×2,
  connection strip order/focus), **10 new E tests**.
- Mocked share (UI layers M+E+R+U, run-time counts): 37 / 139 = **27 %** ≤ `maxMockedShare` 0.35; every mocked UI
  test is paired or `unpairable` above.
- Known stale text outside this file's ownership: R "signed in → … warning above the form" (title says "above";
  the warning is under the button since 67e23fac; the test does not assert position, so it still passes).
- Priority for the run: SCR-01 gate rewrites → login/notice position → recovery query token → new field-room,
  ladder, SCR-41 and Retry-After cases.
