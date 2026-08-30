# T1 — Hợp đồng props màn S-11 `PipelineFailure`

Hai file, chủ sở hữu duy nhất là lớp L1:

- `src/screens/pipeline/PipelineFailure/types.ts` — 27 kiểu xuất ra, không logic, không hằng số.
- `src/screens/pipeline/PipelineFailure/index.ts` — chỉ tái xuất kiểu (view/hook/container/gateway chưa tồn tại).

Cổng đã chạy: `pnpm typecheck` **0 lỗi**; `eslint` trên hai file **0 lỗi, 0 cảnh báo**;
`pnpm length` **đạt** (0 file vượt 400); `rg "TODO|FIXME|stub"` **rỗng**; không `any`;
không chuỗi bắt đầu bằng `/` hay `http` (R-65).

---

## 27 kiểu — mỗi kiểu một dòng

| # | Kiểu | Việc |
|---|---|---|
| 1 | `PipelineFailureState` | Bảy trạng thái A11, tên lấy nguyên từ `SEVEN_STATES`; JSDoc có bảng nghĩa từng nhánh trên màn này. |
| 2 | `PipelineFailureCopyAction` | Một nút sao chép: `label` ĐÃ tính sẵn ("Sao chép"/"Đã sao chép"), `ariaLabel`, `isCopied`, `onCopy`. View không đếm giờ. |
| 3 | `PipelineFailureReasonViewModel` | Khối lỗi ba trường đúng thứ tự: `summarySentence` · `causeSentence` · `codeLabel` (đã ghép "SEG-2041 · yêu cầu 8f2a-41"), kèm `copyCode`. |
| 4 | `PipelineFailureNextStepId` | `'retry-lower-threshold' \| 'upload-clearer' \| 'skip-floor'` — định danh ổn định cho test/telemetry. |
| 5 | `PipelineFailureNextStep` | Một hướng đi tiếp: `id`, `label`, `warningSentence: string \| null`, `isPrimary`, `onSelect`. |
| 6 | `PipelineFailureNextSteps` | Tuple **≥ 2 phần tử** — luật "luôn có ít nhất hai đường đi tiếp" ép bằng kiểu, không bằng bình luận. |
| 7 | `PipelineFailureKeptItem` | Một dòng kết quả đã giữ, cả câu ghép sẵn ("Nhận diện cửa và nội thất — 21 đối tượng"). Không trường màu/trạng thái (A5). |
| 8 | `PipelineFailureKeptWorkList` | Hình dạng đầy đủ của khối "Kết quả đã có": `items` + `captionSentence` in đậm ý. |
| 9 | `PipelineFailureKeptWorkLine` | Hình dạng rút gọn ở `error`: đúng MỘT dòng. |
| 10 | `PipelineFailureKeptWork` | Union hai hình dạng trên, phân biệt bằng `kind`. |
| 11 | `PipelineFailureFloorStatus` | Bí danh của `ProcessingStageStatus` (`ProcessingScreen/types.ts`, đã KHOÁ) — không dựng enum thứ hai. |
| 12 | `PipelineFailureFloorViewModel` | Một ô dải tầng: `label`, `status`, `statusLabel`, `isFailedFloor`. Dải LUÔN đủ bốn tầng. |
| 13 | `PipelineFailureLogLine` | Một dòng nhật ký chữ đều: `timeLabel` đã định dạng + `text`. |
| 14 | `PipelineFailureTechnicalDetails` | Khối gấp: `toggleLabel`, `isOpen`, `onToggle`, `logLines`, `copyLog`. Cả khối là `null` ở `forbidden`. |
| 15 | `PipelineFailureSupportLink` | Liên kết chìm "Báo lỗi cho hỗ trợ": `label`, `prefilledSummary` (mã lỗi + mã yêu cầu đã ghép), `onOpen`. **Không có `href`** (R-65). |
| 16 | `PipelineFailureRetryAttemptNotice` | Chế độ thường của bộ đếm: `kind: 'attempt'` + `attemptLabel` ("Lần thử 2"). |
| 17 | `PipelineFailureRetrySupportNotice` | Chế độ sau ngưỡng thất bại: `attemptLabel`, `suggestionSentence`, `copyAllLogs`, `supportLink`. |
| 18 | `PipelineFailureRetryNotice` | Union hai chế độ trên — hook chọn sẵn, view chỉ đọc `kind`, không so số (R-71). |
| 19 | `PipelineFailureRetryAction` | Nút "Thử lại bước này": `label`, `stepId`, `stepName`, `isRunning`, `onRetry`. `stepId` nói bằng kiểu rằng chạy lại ĐÚNG bước đó. |
| 20 | `PipelineFailureIdleBand` | `kind: 'idle'` — trạng thái `empty`, chỉ có `messageSentence`. |
| 21 | `PipelineFailureAlertBand` | `kind: 'alert'` — nội dung chính: `reason`, `retryAction`, `nextSteps` (`null` ở `forbidden`), `retryNotice`. |
| 22 | `PipelineFailureRetryingBand` | `kind: 'retrying'` — `steps: readonly PipelineStepData[]` cho `PipelineStepper` thay TẠI CHỖ, `stepperAriaLabel`, `liveMessage`. |
| 23 | `PipelineFailureResolvedBand` | `kind: 'resolved'` — `toastMessage`, `continueLabel`, `onContinue`; dải hoà tan rồi chuyển tiếp. |
| 24 | `PipelineFailureBand` | Union bốn nội dung có thể chiếm chỗ dải cảnh báo. |
| 25 | `PipelineFailureProps` | Props view, phẳng theo khuôn `ProcessingScreenProps`: `state`, `band`, `floors`, `keptWork`, `technicalDetails`, `collapsedSummaryLine`, `collapseToggleLabel`, `onToggleCollapse`, `motionDurationName`, `prefersReducedMotion`. |
| 26 | `PipelineFailureIdentity` | Ba mã định vị bước hỏng: `projectId`, `floorId`, `stepId`. |
| 27 | `PipelineFailureContainerProps` | R-73 — mở rộng `PipelineFailureIdentity` + `roles?`, `onResolved?`, `onDismiss?`, `onNavigate?`. Đủ để màn cha gắn màn này bằng một dòng. |

---

## ĐIỂM CẦN BIẾT CHO WORKER LỚP SAU

1. **`types.ts` ĐÓNG BĂNG.** Thiếu một trường, sai một kiểu, cần thêm một prop →
   `orca orchestration ask` hỏi điều phối viên. Không tự sửa, kể cả người viết nó.
   Cách hợp lệ duy nhất để mở rộng: khai kiểu `extends` trong **file của bạn**
   (đúng khuôn `UseScaleCalibrationHookOptions extends UseScaleCalibrationOptions`).

2. **Cổng dữ liệu KHÔNG có prop trong `PipelineFailureContainerProps`.**
   `pipelineFailureGateway.ts` chưa tồn tại ở lớp L1 nên không import được — sẽ hỏng
   `pnpm typecheck`. Worker sở hữu cổng dữ liệu viết trong file của mình:
   `interface XxxContainerProps extends PipelineFailureContainerProps { readonly gateway?: PipelineFailureGateway }`.

3. **`index.ts` mới chỉ tái xuất kiểu.** Khi view/hook/container/gateway đã có, bổ sung
   `export { PipelineFailure }`, `export { PipelineFailureContainer, ... }`,
   `export { usePipelineFailure, ... }`, và kiểu cổng dữ liệu (test/story phải cắm bản
   giả vào, R-73). **Không tái xuất phần con của view.**

4. **KHÔNG có `PipelineFailureRoute`.** Điều phối viên đã chốt: không route mới. Màn cha
   gắn `PipelineFailureContainer` vào khung S-10 tại chỗ. Đừng dựng `ROUTE_PATTERNS` mới.

5. **Bộ đếm lần thử: ngưỡng sống trong HOOK, không trong view và không trong hợp đồng.**
   Hook chọn `kind: 'attempt'` hay `kind: 'support'`. View chỉ đọc `kind`. Ngưỡng "3 lần"
   phải là một hằng số ĐẶT TÊN trong hook, không phải số `3` rải trong nhánh `if` (R-71).

6. **Nhãn nút sao chép ĐÃ tính sẵn.** `PipelineFailureCopyAction.label` đổi thành
   "Đã sao chép" rồi trả về — **hook** giữ `setTimeout`, view tuyệt đối không. `isCopied`
   để view đổi biểu tượng mà không so chuỗi.

7. **A5 thắng chữ trong đặc tả gốc.** Đặc tả gọi mỗi dòng "Kết quả đã có" là "chấm đã
   duyệt", nhưng đó là đầu ra AI chưa ai duyệt — xanh "đã xác minh" chỉ đánh dấu việc
   người duyệt. Nên `PipelineFailureKeptItem` KHÔNG có trường trạng thái/màu, và view
   phải vẽ chấm **trung tính**, không dùng token `state-verified`.

8. **260ms, khai bằng token.** `PipelineFailureProps.motionDurationName` là
   `MotionDurationName`; giá trị đúng là `'standard'`. View lấy mili-giây qua
   `durationMs(name, { reducedMotion })` — **không** viết `240`, không viết `260`.

9. **`PipelineFailureRetryingBand.steps` là `readonly PipelineStepData[]`,** còn
   `PipelineStepperProps.steps` là mảng ghi được (component có trước quy ước `readonly`).
   View trải một bản sao mới khi chuyển sang: `<PipelineStepper steps={[...band.steps]} />`.
   **Đừng** sửa `PipelineStepper` — `src/components/**` ngoài phạm vi được sửa.

10. **`null` nghĩa là "không áp dụng ở trạng thái này", không phải trường biến mất.**
    Đúng hai chỗ được `null`, và chỉ ở `forbidden`: `PipelineFailureProps.technicalDetails`
    và `PipelineFailureAlertBand.nextSteps`.

11. **Không nhánh nào của view được trả `null`** — `collapsed` còn `collapsedSummaryLine`
    + nút mở lại, `empty` còn `PipelineFailureIdleBand`. Màn trắng là thất bại duy nhất
    A11 tồn tại để chặn.

12. **Ba lối ra của màn cha** đều tuỳ chọn: `onResolved` (thử lại xong → chuyển tiếp),
    `onDismiss` (đóng dải), `onNavigate` (hướng "Tải lên bản vẽ rõ hơn"). Hook dựng đường
    dẫn từ bảng đường dẫn rồi đẩy chuỗi qua `onNavigate`; container không viết đường dẫn.

13. **Chuỗi tiếng Việt là của worker T4** (`src/i18n/vi.json`). Hợp đồng này chỉ nêu ví dụ
    trong JSDoc; đừng coi chúng là bản chốt của câu chữ.
