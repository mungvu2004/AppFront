# Prompt logic còn thiếu của màn S-44 `/khong-co-quyen`

**Trạng thái:** màn S-44 đã dựng xong và đã gộp vào `master` (`3859950`). Bốn năng lực
dưới đây **chưa có tầng logic**, nên trong `accessDeniedGateway.ts` chúng là `false` và
khối giao diện tương ứng rời khỏi DOM. Màn không hỏng, nó chỉ nói ít hơn.

File này là **đặc tả cho vòng logic tiếp theo**, viết theo R-69: "thiếu logic thì DỪNG và
đề xuất một prompt logic mới, không tự chế". Đây là phần "đề xuất" ấy.

Ngày một trong bốn khoản có thật, việc phải làm ở màn là **lật một cờ** trong
`accessDeniedGateway.ts` — không dòng nào của view, hook hay test phải sửa. Hợp đồng
`accessDeniedModel.ts` đã chừa sẵn chỗ.

---

## T-05 — Endpoint xin quyền truy cập

**Vì sao cần:** đây là phần trung tâm của đặc tả S-44, và là hành động duy nhất người bị
chặn có thể tự làm. Không có nó, màn chỉ nói được "bạn không vào được" rồi để người dùng
tự đi tìm đồng nghiệp.

**Đã tìm và không thấy:** `ENDPOINTS` có 13 nhóm; toàn bộ khoá phẳng là `acceptInvite ·
activity · assess · changeRole · chunk · complete · corners · create · delete · detail ·
disable · enable · floor · initUpload · invite · layer · list · login · markAllRead ·
markRead · memberships · progress · read · register · remove · reorder · resendInvite ·
straighten · stream · update · version`. Mọi khoá liên quan tới thành viên
(`invite`, `changeRole`, `remove`, `memberships`) đều là hành động **của chủ dự án theo
chiều ngược lại** — mời người vào, không phải người ngoài xin vào.

`requestAccess` của `CollaborationLayer` là tính năng **khác**: xin lại khoá sửa một đối
tượng bên trong dự án đã vào được. Nó cũng đang tắt.

**Cần bổ sung:**

| Việc | Hình dạng đề xuất |
|---|---|
| Endpoint | `ENDPOINTS.projects.requestAccess(projectId)` → `POST /projects/{id}/access-requests` |
| Thân yêu cầu | `{ note?: string }` — lý do người dùng tự viết, tuỳ chọn (đặc tả nói "không bắt buộc") |
| Trả về | `{ id, status: 'pending' | 'approved' | 'declined', requestedAt: string, declineMessage?: string }` |
| Client | `client.projects.requestAccess(...)` trả `ApiResult<AccessRequest>` |
| Mutation | `src/lib/mutations/` — dùng `createOptimisticMutation` đã có |

**Ràng buộc quan trọng — không được bỏ qua:** endpoint này người **chưa có quyền** gọi
được. Đó là điều làm nó khác mọi endpoint dự án khác hiện có, và là lý do nó không thể
nằm sau cùng một phép kiểm quyền. Máy chủ phải phân biệt "không được xem dự án" với
"không được xin quyền", nếu không màn sẽ nhận 403 cho chính hành động sinh ra để xử lý 403.

**Chặn gửi lại 10 phút:** repo **không có** helper throttle/cooldown/rateLimit nào trong
`src/lib` (đã tìm). `600_000` duy nhất tồn tại là `gcTime` của `cachePolicy` — thời gian
dọn bộ đệm, không liên quan. Hôm nay `REQUEST_COOLDOWN_MS` là hằng có tên sống trong thư
mục màn. Nếu nhiều màn cần chặn gửi lại thì đó là lúc nâng nó lên `src/lib`, **không phải
trước đó**.

Khi có: `canRequestAccess: true` và cấp `submitAccessRequest` cho cổng.

---

## Chủ dự án — trường còn thiếu trên `Project`

**Vì sao cần:** đặc tả S-44 bắt buộc "nêu rõ **ai cấp được quyền**". Hôm nay màn nói được
điều đó một cách chung chung, nhưng không chỉ được đích danh ai.

**Đã tìm và không thấy:** `src/types/project.ts:10-17` —
`{ id, name, created_at, updated_at, thumbnail_url?, members: ProjectMember[] }`.
Không `owner`, không `ownerId`, không `createdBy`. `ProjectMember` có
`{ id, name, role: 'admin'|'engineer'|'viewer', avatar_url? }`.

**Hai việc, đừng gộp:**

1. **Trường chủ trên `Project`** — hoặc `ownerId: string` trỏ vào `members`, hoặc một
   `owner: ProjectMember`. Vai `admin` đã tồn tại nhưng "admin" và "chủ" không cùng nghĩa:
   một dự án có thể có nhiều admin, mà câu "liên hệ ai" cần đúng một người.

2. **Đường đọc được khi CHƯA có quyền.** Đây mới là phần khó, và là lý do khoản này không
   tự giải quyết bằng cách thêm một trường. `projects.read` trả đúng cái 403 vừa chặn
   người dùng, nên `members` hiện **không với tới được từ màn này**. Cần một hình chiếu
   tối thiểu, an toàn để lộ: chỉ tên + email của người cấp được quyền, không kèm gì khác
   về dự án.

   Gợi ý: gộp vào chính phản hồi 403 của T-05, hoặc một endpoint riêng
   `GET /projects/{id}/access-contact`.

**Ràng buộc:** khoản 2 là quyết định **lộ thông tin**, không phải quyết định kiểu dữ liệu.
Tên và email của một người là dữ liệu cá nhân; để một người lạ đọc được chúng chỉ bằng
cách gõ một `projectId` là một cách rò rỉ. Phải có người duyệt, và mặc định phải là
**không lộ** — đúng như `canShowOwner: false` hôm nay.

Khi có: `canShowOwner: true`.

---

## Xác thực mật khẩu liên kết chia sẻ

**Vì sao cần:** một trong ba lý do 403 mà đặc tả nêu là "sai mật khẩu liên kết", và bố cục
có ô nhập mật khẩu.

**Đã tìm và không thấy:** `shareLink.ts` nhận mật khẩu **duy nhất lúc tạo** liên kết
(`ShareLinkCreateBody.password`, `MIN_SHARE_PASSWORD_LENGTH = 6`,
`MAX_SHARE_PASSWORD_LENGTH = 128`). `ShareLink` chỉ mang `passwordProtected: boolean` —
docblock của nó nói thẳng: "Whether a password is required — never which one."
Không hàm nào nhận mật khẩu để **mở khoá**.

**Cần bổ sung:** `POST /share-links/{token}/unlock` với thân `{ password: string }`, trả
về phiên xem hoặc lỗi. Đặt cạnh `SHARE_LINK_ENDPOINTS` đã có.

**Ràng buộc:** đây là điểm đoán mật khẩu, nên nó cần giới hạn số lần thử ở **máy chủ**.
Giới hạn ở phía trình duyệt không phải giới hạn.

Khi có: `canSubmitLinkPassword: true` và cấp `submitLinkPassword` cho cổng.

---

## Mã lý do 403 — hợp đồng máy chủ chưa ai ký

**Trạng thái hôm nay:** màn phân biệt ba lý do bằng cách nhận ra một **từ** trong
`AppError.code` (`resolveAccessDeniedReason`): `REVOK` → thu hồi, `EXPIR` → hết hạn,
`PASSWORD` → mật khẩu, còn lại → trung tính.

Cách này hoạt động vì `toAppError` **giữ nguyên `code` của máy chủ**
(`fromHttpError` → `resolveCode`), chỉ `kind` mới bị gộp thành `'forbidden'`.

**Vì sao chỉ nhận ra một từ chứ không tra bảng mã cứng:** repo không định nghĩa bộ mã 403
của máy chủ ở đâu cả. Viết `'SHARE_LINK_REVOKED' -> 'revoked'` là bịa ra một hợp đồng
không bên nào ký, và nó sẽ im lặng sai vào ngày máy chủ gửi `LINK_WAS_REVOKED`.

**Nếu vòng sau chốt được bộ mã thật với đội máy chủ**, hãy ghi nó vào một chỗ dùng chung
(cạnh `APP_ERROR_KIND_CONFIG`), rồi `resolveAccessDeniedReason` tra bảng đó thay vì đoán
từ. Từ vựng ba trạng thái đã có sẵn: `ShareLinkStatus = 'active' | 'expired' | 'revoked'`.

---

## Kiểm lại sau khi làm xong bất kỳ khoản nào

```bash
# 1. Lật cờ trong cổng, KHÔNG sửa view/hook/test
src/screens/system/AccessDenied/accessDeniedGateway.ts

# 2. Khối tương ứng phải QUAY LẠI DOM, và bài kiểm "cổng tắt ⇒ rời khỏi DOM" vẫn phải xanh
pnpm vitest run src/screens/system/AccessDenied

# 3. Cổng tổng
pnpm verify
```

Nếu phải sửa `AccessDenied.tsx` hay `useAccessDenied.ts` để lật được cờ, thì hợp đồng
`accessDeniedModel.ts` đã thiếu chỗ — sửa hợp đồng trước, đừng vá ở view.
