# Khuôn dựng màn — ghi chú cho `CadBranchConfirm` (L1-C)

Đọc từ hai màn anh em mới nhất, cùng khu vực `pipeline`:
`src/screens/pipeline/PipelineGraph/**` (13 file) và
`src/screens/pipeline/ScaleCalibration/**` (13 file). Mọi trích dẫn dưới đây là
đường dẫn:dòng thật tại thời điểm viết ghi chú này.

---

## a) Sáu file R-59 và quy ước đặt tên file anh em

Khuôn thư mục của một màn (ví dụ `ScaleCalibration/`):

| File | Trách nhiệm |
|---|---|
| `<Name>.tsx` | View thuần — chỉ props, không store, không mạng (mục D) |
| `<Name>.container.tsx` | Nối route ↔ hook ↔ view, bọc `ScreenErrorBoundary` (R-62) |
| `use<Name>.ts` | Hook "suy nghĩ" — toàn bộ logic, định dạng số (A15), bảy trạng thái |
| `<Name>.test.tsx` | Test view qua props + test tích hợp qua hook thật (R-63/R-72) |
| `<Name>.stories.tsx` | Bảy story Storybook, một bộ dữ liệu dùng chung với test (R-70) |
| `types.ts` | Hợp đồng kiểu — API công khai duy nhất giữa hook và view |

File anh em phụ, đặt tên theo quy ước:

- `<name>Gateway.ts` (chữ thường đầu) — cổng dữ liệu, ví dụ
  `scaleCalibrationGateway.ts`, `pipelineGraphGateway.ts`. Export cả cổng thật
  (`createApp<Name>Gateway`) lẫn cổng giả (`createMock<Name>Gateway`).
- `<Name><Phần>.tsx` — mảnh view con, ví dụ `ScaleCalibrationCanvas.tsx`,
  `ScaleCalibrationPanel.tsx`, `ScaleCalibrationMethodDimension.tsx`,
  `ScaleCalibrationMethodReference.tsx`; hoặc `PipelineGraphOverview.tsx`,
  `PipelineGraphDetail.tsx`, `PipelineGraphPanel.tsx`.
- `<name>Text.ts` — bảng chuỗi tiếng Việt riêng của màn (thấy ở
  `pipelineGraphText.ts`; `ScaleCalibration` thì gộp chuỗi vào hằng `COPY` ngay
  trong hook thay vì tách file riêng — cả hai cách đều đang chạy, tuỳ độ dài).
- `use<Name>.test.ts` — test riêng cho hook, không cần DOM (thấy ở
  `useScaleCalibration.test.ts`).
- `index.ts` — đường nhập ổn định DUY NHẤT, xem mục g).

## b) `<Name>.container.tsx` bọc `ScreenErrorBoundary` (R-62)

Nguyên văn từ `ScaleCalibration/ScaleCalibration.container.tsx:1-16,77-121`:

```tsx
/** Cùng khuôn `ProcessingScreenCrashFallback` — R-62. */
function ScaleCalibrationCrashFallback({ report, retry }: ScreenErrorFallback) {
  return (
    <div className="absolute inset-0 flex items-center justify-center bg-bg-app">
      <EmptyState
        description={report.description.description}
        icon={<div aria-hidden="true" className="h-8 w-8 rounded-full bg-state-violation-tint" />}
        title={report.description.title}
        {...(report.retryable
          ? { action: { label: report.description.primaryButtonLabel, onClick: retry } }
          : {})}
      />
    </div>
  );
}

/** `<ScaleCalibrationContainer projectId={...} floorId={...} />` — màn thật, đã nối. */
export function ScaleCalibrationContainer(props: ScaleCalibrationContainerProps) {
  return (
    <ScreenErrorBoundary
      renderFallback={({ report, retry }) => (
        <ScaleCalibrationCrashFallback report={report} retry={retry} />
      )}
      screenId={SCREEN_ID}
    >
      <WiredScaleCalibration {...props} />
    </ScreenErrorBoundary>
  );
}
```

`ScreenErrorBoundary` và `ScreenErrorFallback` nhập từ
`@/components/feedback/ScreenErrorBoundary`. Phần dự phòng dựng bằng
`EmptyState` từ `report.description`, nên màn không bao giờ trắng (A11).

## c) Container lấy tham số route thế nào

Hai lớp tách rời, cùng khuôn `ProcessingScreen.container.tsx`
(`ScaleCalibration.container.tsx:123-169`):

```tsx
export function ScaleCalibrationRoute() {
  const { floorId, id } = useParams<{ floorId: string; id: string }>();
  const session = useSession();

  if (id === undefined || id.length === 0 || floorId === undefined || floorId.length === 0) {
    return (
      <div className="p-6">
        <InlineAlert level="violation" message={MISSING_PARAMS_MESSAGE} title={MISSING_PARAMS_TITLE} />
      </div>
    );
  }

  return <ScaleCalibrationRouteBody floorId={floorId} projectId={id} roles={session.roles} />;
}
```

- `<Name>Container>` KHÔNG gọi `useParams`/`useNavigate` — nhận mọi thứ qua
  props, nên test/story mở được nó bằng một dòng (R-73).
- `<Name>Route` là lớp DUY NHẤT biết tới router: đọc `useParams`, thiếu tham số
  thì hiện `InlineAlert` chứ không để trắng (A11), tham số đủ thì render
  `<Name>RouteBody>` (nơi mới gọi `useNavigate`, vì `useNavigate` cần provider
  thật — không gọi ở ngay `Route` để test không phải dựng router).
- Vai trò (`roles`) lấy từ `useSession()` (`@/hooks/useSession`), không tự chế.

## d) Hình dạng trả về của `use<Name>.ts`, nối `src/lib/query`/`mutations` (R-64), kiểu bảy trạng thái

**Trạng thái máy chủ đi qua `@tanstack/react-query`**, KHÔNG tự viết
`isLoading`/`error` bằng `useState` (đó là lý do `useShareLinks.ts` được ghi
chú trong CLAUDE.md là "ngoại lệ đi trước, không phải khuôn để chép"). Nguyên
văn `useScaleCalibration.ts:458-484`:

```ts
const query = useQuery({
  queryKey: queryKeys.drawing.byFloor(floorId),
  queryFn: async (): Promise<ScaleCalibrationRecord> => {
    const drawing = await gateway.readFloorDrawing({ floorId, projectId });
    if (!drawing.ok) {
      throw drawing.error;
    }
    const [strings, wallWidth, doorWidth, roomBox, targets] = await Promise.all([
      gateway.readDimensionStrings({ floorId, projectId }),
      gateway.readReferenceWallWidth({ floorId, projectId }),
      gateway.readTypicalDoorWidth({ floorId, projectId }),
      gateway.readLargestRoomBox({ floorId, projectId }),
      gateway.readSnapTargets({ floorId, projectId }),
    ]);
    return { drawing: drawing.data, dimensionStrings: strings.supported ? strings.value : EMPTY_ROWS, /* ... */ };
  },
});
```

`queryKeys` đến từ `@/lib/query/queryKeys` (`queryKeys.drawing.byFloor(floorId)`).
Ghi/áp thay đổi đi qua `commit(patch, label)` của `@/store/commit` (A10), KHÔNG
qua `set()` trực tiếp — xem `useScaleCalibration.ts:961-969` (`onApply`).
Tự lưu (A7) đi qua `useAutosave` (`@/hooks/useAutosave`).

**Bảy trạng thái là một UNION PHẲNG `status`** (không phải discriminated
union có payload khác nhau theo nhánh — mọi trường viewmodel LUÔN có mặt,
chỉ giá trị đổi theo `state`). Nguyên văn `ScaleCalibration/types.ts:87-94`
(giống hệt `PipelineGraph/types.ts:35-43`):

```ts
export type ScaleCalibrationState =
  | 'empty'
  | 'loading'
  | 'partial'
  | 'error'
  | 'success'
  | 'forbidden'
  | 'collapsed';
```

Kiểu trả về của hook mở rộng đúng props của view cộng vài trường riêng cho
container (`ScaleCalibration/types.ts:743-748`):

```ts
export interface UseScaleCalibrationResult extends ScaleCalibrationProps {
  readonly appliedScale: Scale | null;
  readonly aiInference: ScaleInference | null;
}
```

Và `ScaleCalibrationProps` (`types.ts:640-643`) là khuôn "mô hình cộng hành
động" (mục D):

```ts
export interface ScaleCalibrationProps {
  readonly model: ScaleCalibrationViewModel;
  readonly actions: ScaleCalibrationActions;
}
```

**Cách hook nhận tham số khi cổng dữ liệu chưa tồn tại lúc `types.ts` đóng
băng**: `types.ts` khai `UseScaleCalibrationOptions` (không có `gateway`);
hook tự MỞ RỘNG nó trong file của mình (`useScaleCalibration.ts:398-401`):

```ts
export interface UseScaleCalibrationHookOptions extends UseScaleCalibrationOptions {
  readonly gateway?: ScaleCalibrationGateway;
}
```

Đây CHÍNH LÀ cách hợp lệ duy nhất để một worker tầng 2 thêm tham số mà không
sửa `types.ts` — L2-A (viết hook) làm y hệt cho `CadBranchConfirm`.

## e) `<Name>.test.tsx` — mẫu gọi bốn hàm khẳng định dùng chung

Chữ ký thật, `src/lib/testing/`:

```ts
// expectSevenStates.ts:122-125
export function expectSevenStates(
  renderScreen: ScreenRenderer,
  scenarios: readonly SevenStateScenario[],
): void

// expectAccessible.ts:960-963
export function expectAccessible(
  subject: TestSubject,
  options: AccessibilityOptions = {},
): void

// expectVietnamese.ts:714
export function expectVietnamese(subject: TestSubject, options: VietnameseOptions = {}): void

// expectNoRawColor.ts:307
export function expectNoRawColor(target: string, options: NoRawColorOptions = {}): void
```

Mẫu gọi thật, `ScaleCalibration.test.tsx:503-517,562-592`:

```tsx
describe('ScaleCalibration — bảy trạng thái (A11, R-63)', () => {
  it('vẽ đủ bảy trạng thái, không lần nào ném lỗi và không lần nào ra màn trắng', () => {
    let rendered = 0;
    expectSevenStates((scenario) => {
      const { container, unmount } = renderWithProviders(
        <ScaleCalibration {...scenarioFor(scenario.state)} />,
      );
      rendered += 1;
      return { container, unmount };
    }, scenarioIndex());
    expect(rendered).toBe(SEVEN_STATES.length);
  });
});

describe('ScaleCalibration — khả năng tiếp cận, tiếng Việt, màu (R-72)', () => {
  it('đi qua expectAccessible ở trạng thái đầy đủ nhất', () => {
    const { container } = renderWithProviders(<ScaleCalibration {...scenarioFor('success')} />);
    expectAccessible(container);
  });

  it('mọi chuỗi hiển thị là tiếng Việt có dấu', () => {
    const { container } = renderWithProviders(<ScaleCalibration {...scenarioFor('success')} />);
    expectVietnamese(container, { allowWords: ALLOWED_WORDS, ignore: [MACHINE_ERROR_CODE] });
  });

  it('không mã màu thô trong bất kỳ file nào của thư mục màn (A1)', () => {
    for (const file of readdirSync(SCREEN_DIRECTORY)) {
      expectNoRawColor(`${SCREEN_DIRECTORY}/${file}`);
    }
  });
});
```

`scenarioIndex()` chuyển đổi mảng story sang `readonly SevenStateScenario[]`
theo hình dạng của `@/lib/testing/sevenStateScenarios`. Hai lớp render: **chỉ
props** (bảy trạng thái, a11y, tiếng Việt, màu) và **qua hook thật + view thật
+ cổng của bộ mẫu** (kịch bản nghiệm thu, xem `NGHIEM-2`/`NGHIEM-3` trong file
gốc) — bộ mẫu là bộ chuẩn A14, không bịa bảng dữ liệu thứ hai (R-70).

## f) `<Name>.stories.tsx` — bảy story và bẫy CSF

`scenarioFor(state)` (`ScaleCalibration.stories.tsx:362-380`) dựng một
`ScaleCalibrationProps` đầy đủ cho một trạng thái; test import lại đúng hàm
này (không viết bộ dữ liệu thứ hai). Story chỉ dựng `<ScaleCalibration
{...props} />` — không container, không provider, không cổng mạng thật (mục
D).

**Bẫy CSF đã biết**: CSF coi MỌI export có tên là một story, kể cả một hằng số
không phải component. Gặp một export không phải story (ví dụ
`APPROVED_WALL_COUNT`, một số), Storybook ném `Cannot create property
'parameters' on number '12'` và LÀM TRẮNG CẢ FILE. Cách sửa —
`PipelineGraph.stories.tsx:359-381`:

```ts
/**
 * `excludeStories` KHÔNG phải chuyện gọn gàng, nó là sửa lỗi. ...
 */
const meta = {
  title: 'Màn hình/Sơ đồ xử lý',
  component: PipelineGraph,
  parameters: { layout: 'fullscreen' },
  excludeStories: [
    'APPROVED_WALL_COUNT',
    'SEVEN_SCENARIOS',
    'scenarioFor',
    'aiBranchScenario',
    'detailScenario',
    // ...
  ],
};
```

Mọi export không phải story (hằng số, hàm dựng kịch bản mà test cần import
lại) PHẢI được liệt kê trong `meta.excludeStories`.

## g) `sevenStateScenarios.ts`, `render.ts`, `fixtures` cho sẵn gì

- `@/lib/testing/sevenStateScenarios.ts`: hằng `SEVEN_STATES` (mảng bảy chuỗi,
  đúng thứ tự A11), `SEVEN_STATE_LABELS` (nhãn tiếng Việt của từng trạng
  thái), kiểu `SevenState`, `SevenStateScenario`, và hàm generator
  `createSevenStateScenarios(options?)` dựng hình dạng "list screen" mặc
  định (rows/totalCount/isLoading/…) — một màn hình dạng khác (như
  `CadBranchConfirm`) tự viết mảng bảy phần tử riêng, chỉ dùng chung
  `SEVEN_STATES`/`SEVEN_STATE_LABELS` để không lệch tên/thứ tự.
- `@/lib/testing/render.ts`: `renderWithProviders` (bọc Provider chuẩn của dự
  án khi render trong test) và `createTestQueryClient` (một `QueryClient` mới,
  cấu hình tắt retry cho test).
- `@/lib/testing/fixtures`: `createCleanBuildingScenario()` — dựng đồ thị
  không gian sạch của bộ mẫu chuẩn A14 (34 phòng, 248,60 m²) để seed store
  trong test tích hợp.

## h) Đăng ký route — chép nguyên khuôn `ScaleCalibration`

`src/routes/paths.ts:66` (mẫu cho `ScaleCalibration`, `CadBranchConfirm` sẽ
thêm dòng tương tự — KHÔNG được sửa trong phạm vi task này):

```ts
projectScale: `${PROJECTS_ROOT}/:id/floors/:floorId/scale`,
```

`src/routes/router.tsx:30,80` (mẫu lazy-load + đăng ký):

```ts
const RouteScaleCalibration = lazy(() => import('../screens/pipeline/ScaleCalibration').then(m => ({ default: m.ScaleCalibrationRoute })));
// ...
{ path: ROUTE_PATTERNS.projectScale, element: suspended(<RouteScaleCalibration />) },
```

Màn `CadBranchConfirm` khi được dựng (task khác, không phải task này) sẽ thêm
`cadConfirm: \`${PROJECTS_ROOT}/:id/floors/:floorId/cad-confirm\`,` vào
`ROUTE_PATTERNS` + `ROUTES`, và một dòng `RouteCadBranchConfirm` +
đăng ký trong `router.tsx`, đúng khuôn trên. Container/hook/view của
`CadBranchConfirm` phải nhập `@/routes/paths` (để lấy `ROUTES.project.*` khi
điều hướng — R-65) chứ KHÔNG BAO GIỜ nhập `@/routes` (đó là nơi
`RouterProvider`/router thật sống, và `src/screens/**` không được kéo nó vào
— sẽ tạo vòng lặp `router.tsx` → `screens/**` → `routes/router.tsx`).

## i) Chuỗi mới vào `src/i18n/vi.json`, và `expectVietnamese` dùng nó thế nào

`src/i18n/vi.json` **không phải bảng dịch lúc chạy** — chuỗi hiển thị viết
thẳng tiếng Việt trong hook (`COPY = {...}` hoặc `<name>Text.ts`). File JSON
này là **từ điển để kiểm tra**: nó chứa toàn bộ chuỗi tiếng Việt "đã được
duyệt" của sản phẩm, theo namespace tên màn (ví dụ khoá gốc
`"scaleCalibration"`, `"pipelineGraph"` đã có sẵn trong file — xem cấu trúc:
`{ breadcrumb, screen, currentScale, method, dimensionMethod, ... }` lồng dưới
namespace đó).

`expectVietnamese` (`@/lib/testing/expectVietnamese.ts:25-31`) dùng file này
làm nguồn "từ vựng đã biết đúng": mọi từ có trong `vi.json` được chấp nhận
ngay, và nó còn dùng để GỢI Ý lỗi chính tả (chuỗi không dấu trùng với một mục
đã bỏ dấu trong file thì bị báo là thiếu dấu). Việc thêm namespace
`"cadBranchConfirm"` vào `vi.json` (và viết chuỗi trong hook/text file khớp
với nó) thuộc phạm vi worker khác (L1-D / L2-A) — task này KHÔNG được chạm
`src/i18n/**` (whitelist đã cấm rõ).

---

## Kết luận cho `types.ts`

`CadBranchConfirm` chép đúng khuôn `ScaleCalibrationState` /
`PipelineGraphState`: một union bảy chuỗi phẳng, tên lấy nguyên từ
`SEVEN_STATES`. Không phát minh khuôn thứ ba (ví dụ discriminated union theo
state) — xem file `types.ts` đã viết cùng thư mục với ghi chú này.
