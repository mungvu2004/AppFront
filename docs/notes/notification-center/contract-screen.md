# NotificationCenter — chỗ đặc tả nói sai, và cái đã làm thay

**Phạm vi:** `src/screens/system/NotificationCenter/**`.
**Vì sao có file này:** đặc tả của màn khẳng định bốn mảng logic "đã có, chỉ gọi lại".
Ba trong số đó không tồn tại như đã tả. Người dựng màn sau sẽ đọc đúng bản đặc tả ấy và
vấp lại đúng ba chỗ này, nên chúng được ghi ra đây thay vì nằm trong một báo cáo trôi qua.

Cách đọc: mỗi mục nêu **đặc tả nói gì · repo có gì thật · đã làm gì thay**.

---

## 1. Kênh T-06 không chở được thông báo

**Đặc tả nói:** *"Thông báo mới đến qua kênh của T-06 — không tự mở kết nối SSE riêng."*

**Thật ra:** `createEventChannel` (`src/lib/realtime/eventChannel.ts:66`) khoá cứng kiểu
gói tin của nó:

```ts
export interface ChannelEvent {
  type: 'progress';
  data: Progress;
}
```

và phân tích mọi gói tin nhận được bằng `ProgressSchema.strict`. Nó không generic. Một
thông báo — có `id`, `kind`, `projectId`, đối tượng đích — không đi qua được cái cổng ấy.

`createProgressStream` (`progressStream.ts:62`) **có** generic `TPatch` và có cả cửa
`toSseEvent` để đổi hình gói tin, nhưng lớp dưới nó vẫn là `createEventChannel`, nên gói
tin trên dây vẫn phải là `Progress`. Và nó **tự mở `EventSource`** — tức đúng thứ chính
câu đặc tả trên cấm. Cộng thêm: không có điểm cuối nào để mở tới (xem mục 2).

**Đã làm thay:** màn không mở kết nối nào cả, nó **nhận** nguồn từ ngoài vào qua
`NotificationCenterGateway.subscribe(listener)`. Đó là cửa duy nhất thông báo mới đi vào
màn — trong cả thư mục màn không có `new EventSource`, không `fetch`, không `setInterval`.

> Hệ quả cần biết: hôm nay nguồn ấy là bộ nhớ của chính cổng, nên **không có thông báo
> thời gian thực thật**. Việc trượt-vào-đầu, nháy `--bg-selected`, chuông nghiêng và giữ
> vị trí cuộn đều chạy và đều được kiểm — chỉ là thứ kích hoạt chúng hôm nay là test và
> story, không phải máy chủ.

---

## 2. Tầng dữ liệu không có thực thể thông báo nào

**Đặc tả nói:** *"D-01, D-03 truy vấn và làm mới; D-04 đánh dấu đã đọc lạc quan."*

**Thật ra:** hạ tầng thì có (`queryKeys`, `cachePolicy`, `invalidation`,
`createOptimisticMutation`), nhưng không có gì để cắm vào:

| Tìm cái gì | Ở đâu | Kết quả |
|---|---|---|
| nhóm `notifications` | `src/api/endpoints.ts` | KHÔNG CÓ (11 nhóm, không nhóm nào là nó) |
| thực thể thông báo | `src/api/client.ts` | KHÔNG CÓ |
| nhánh `notification` | `src/lib/query/queryKeys.ts` | KHÔNG CÓ |
| phép ghi liên quan | `WRITE_OPERATIONS` | KHÔNG CÓ |

`src/lib/mutations/notificationBus.ts` **không phải** thứ này. Nó là bus toast
(`title`/`description`/`type`/`undoTicket`) — không có `isRead`, không có `projectId`,
không có đối tượng đích, không có điểm đến điều hướng. Tên giống nhau thôi.

**Đã làm thay:** `notificationCenterGateway.ts` giữ bộ nhớ trong, theo đúng tiền lệ đã ghi
của `screens/account/AccountSettings/accountSettingsGateway.ts` (nợ T-08) và
`screens/pipeline/ProcessingScreen/processingGateway.ts`. Khoá truy vấn là một hằng cục bộ
theo tiền lệ `useAccountSettings.ts:79` — **không** dùng `createQueryKeyFactory`, vì hàm đó
là `const` cục bộ ở `queryKeys.ts:39` và không hề được export.

> Hệ quả cần biết: gốc khoá mới không nằm trong `TIER_BY_DOMAIN`, nên nó rơi về bậc cache
> `'default'` 30 giây. Đó là lựa chọn có ý thức, đã ghi trong chú thích của hook — không
> phải tai nạn. Chính `queryKeys.ts` cảnh báo về cái bẫy này ở phần chú thích miền `user`.

---

## 3. O-02 không nằm ở `src/lib`, và bộ giải mã của S-05 là private

**Đặc tả nói:** *"O-02 cờ bật tắt từng loại thông báo, đồng bộ với S-05."*

**Thật ra:** `src/lib/telemetry/flags.ts` là **cờ tính năng của hệ thống**
(`FEATURE_FLAG_KEYS`), không phải tuỳ chọn của người dùng. Ma trận thật nằm ở màn cài đặt
tài khoản, và nó đóng kín:

- `AccountDraft.notifications` cố ý là `Readonly<Record<string, unknown>>`
  (`accountDraft.ts:53`) — *"hình dạng thật của từng khối thuộc về người dựng khối đó"*.
- Bộ giải mã `readMatrix` cùng `NOTIFICATION_EVENTS` là **private** trong
  `useAccountTables.ts:115,154`. Không export.
- `AccountSettings` là màn đã xong, nên R-68 cấm thêm một dòng export vào đó.

Chép `readMatrix` sang thư mục màn này sẽ tạo nguồn sự thật thứ hai — đúng thứ R-71 cấm.

**Đã làm thay:** cổng tự giữ `enabledKinds` (mặc định bật hết), và nút cài đặt trong tấm
trượt **điều hướng sang `ROUTES.account`**. Đó là "đồng bộ với S-05" làm được thật hôm nay:
một chủ sở hữu, một chỗ sửa. Năm sự việc của ma trận được lấy đúng mã
(`aiCompleted`, `violationFound`, `projectInvite`, `commentMention`) để hai nơi không đặt
tên khác nhau cho cùng một việc; `morningDigest` cố ý không có mặt vì nó gộp nhiều việc
nên không dẫn tới một đối tượng cụ thể — mà đó là cấm tuyệt đối của màn này.

---

## 4. Hai chỗ nhỏ hơn

**240 ms không tồn tại.** Đặc tả ghi *"trượt vào đầu trong 240ms"*. Thang chuyển động chỉ
có `120 / 180 / 260 / 340 / 700` (`MOTION_DURATIONS_MS`), và `local/no-raw-duration` ở mức
`error`. Dùng `standard` (260).

**Nút "Chấp nhận" chưa có việc để làm.** Đặc tả nêu nó làm ví dụ cho hành động trong dòng.
Nhưng không có `acceptInvite` ở bất kỳ đâu trong `src/api`, `src/lib`, `src/domain`,
`src/store`; `src/api/client.ts:512,516` chỉ có `invite()` và `resendInvite()`, và đó là
**quản trị viên gửi** lời mời, không phải người nhận chấp nhận. Một nút ghi "chấp nhận" mà
chỉ điều hướng là fake, đúng thứ R-69 cấm — nên nhãn tạm đổi thành "xem lời mời", đích vẫn
là chính dự án. Kiểu `'accept'` giữ nguyên trong hợp đồng làm ô chờ.

---

## Nợ đã ghi: T-09

Một lượt riêng ở tầng logic, **không** gộp vào lượt dựng màn (R-68):

1. Thêm nhóm `notifications` vào `src/api/endpoints.ts` + schema thực thể trong
   `src/api/schemas/`.
2. Thêm nhánh `queryKeys.notification` **và** một dòng trong `TIER_BY_DOMAIN`, để nó không
   im lặng rơi về bậc 30 giây.
3. Một kênh thời gian thực chở được gói tin không phải `Progress` — hoặc cho
   `createEventChannel` nhận schema làm tham số (mặc định `ProgressSchema`, giữ tương
   thích ngược cho `progressStream`), hoặc một module anh em.
4. `acceptInvite` cho người nhận lời mời, rồi trả nhãn "chấp nhận" về đúng chỗ của nó.

Khi có T-09, **`notificationCenterGateway.ts` là file duy nhất phải sửa** — chữ ký
`NotificationCenterGateway` không đổi, và hook, view, test, story không đổi một dòng nào.
