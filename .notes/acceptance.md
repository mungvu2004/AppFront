# Đặc tả nghiệm thu định lượng — FloorUploadScreen

Layer 2 của DAG. Tài liệu này KHÔNG viết mã — nó là công thức để Layer 3 viết
`FloorUploadScreen.test.tsx` (và, ở mục (e), một spec Playwright bổ sung).
Mọi khẳng định về `src/lib/testing/**` dưới đây đã đối chiếu trực tiếp với mã
nguồn thật (`expectSevenStates.ts`, `sevenStateScenarios.ts`, `render.tsx`,
`src/api/__mocks__/client.ts`, `src/api/client.ts`, `src/mocks/spatial.ts`),
không chỉ dựa vào `.notes/contract-pattern.md`.

Màn: `src/screens/upload/FloorUploadScreen` — route `/projects/:id/upload`.
Tại thời điểm viết tài liệu này, thư mục màn **chưa tồn tại** và
`src/lib/upload/uploadTask.ts` (Layer 2 song song) **chưa có** —
`.notes/contract-upload.md` chưa xuất hiện trong worktree. Mục (b) vì vậy nêu
rõ phần nào Layer 3 phải tự đối chiếu lại với `contract-upload.md` khi file đó
xuất hiện.

## Dữ liệu nền đã xác nhận

- `src/api/__mocks__/client.ts` xuất `createMockApiClient()` — có nhóm
  `drawings.{initUpload, sendChunk, progress, complete}` (kiểu `DrawingsApi`
  trong `src/api/client.ts:170-175`), trả `Progress { id, progressPercent,
  startedAt, status, step }`.
- `MOCK_SPATIAL_PROJECT.levels` (`src/mocks/spatial.ts:7-32`) có đúng **4 tầng**,
  tên thật: `Tầng hầm` (`L-1`), `Tầng 1` (`L1`), `Tầng 2` (`L2`), `Tầng 3` (`L3`)
  — đây là 4 tên tầng mọi kịch bản dưới đây dùng, khớp "Thả 4 tệp → gán đúng 4
  tầng" trong tiêu chí.
- `src/lib/testing/fixtures.ts` là fixture cho QC (tường/phòng), **không có**
  fixture cho tệp tải lên. Test file dùng `new File([...], name, { type })`
  trực tiếp — đúng khuôn mẫu đã có trong
  `src/screens/account/AccountSettings/ProfileSection.test.tsx:146`.
- Repo không có `@testing-library/user-event` (không có trong `package.json`).
  Mọi tương tác dùng `fireEvent` từ `@testing-library/react`, đúng khuôn mẫu
  `ProfileSection.test.tsx:152` (`fireEvent.change(input, { target: { files } })`).
  Với kéo-thả, dùng `fireEvent.dragEnter/dragOver/drop(zone, { dataTransfer })`
  — jsdom không có `DataTransfer`, dataTransfer là object thường
  `{ files, items: [], types: ['Files'] }`.
- `expectSevenStates(renderScreen, scenarios)` (`expectSevenStates.ts:122-159`)
  ném lỗi nếu thiếu HOẶC lặp bất kỳ state nào trong 7 state của
  `SEVEN_STATES` (`sevenStateScenarios.ts:26-34`), và nếu bất kỳ lần render nào
  ném lỗi hoặc ra container rỗng (`childElementCount === 0 &&
  textContent.trim() === ''`).
- `renderWithProviders` (`render.tsx:232-256`) bọc `QueryClientProvider`
  (retry off) + trả `translate` (i18next thật đọc `src/i18n/vi.json`). Không
  tự bọc Router — nếu `FloorUploadScreenView` không dùng `useParams`/`useNavigate`
  trực tiếp (theo mục D, nó không nên), không cần thêm gì.

---

## (a) BẢY TRẠNG THÁI 7/7

**File:** `src/screens/upload/FloorUploadScreen/FloorUploadScreen.test.tsx`

**Setup:** `renderWithProviders` + `expectSevenStates` + `SEVEN_STATES` từ
`@/lib/testing/sevenStateScenarios`. Không dùng `createSevenStateScenarios()`
mặc định (nó tạo dữ liệu hình "danh sách tường" — không khớp domain "tầng +
tệp"). Thay vào đó, tự liệt kê 7 kịch bản bằng `switch` cạn kiệt trên
`SevenState`, ánh xạ sang props cụ thể của `FloorUploadScreenView`
(`floors: FloorUploadCardModel[]`, `isOffline`, `canEdit`, `isCollapsed`, …
— tên trường thật do Layer 3 quyết định khi dựng view, nhưng phải tồn tại
field tương đương mỗi ý dưới đây).

**Code sketch** (cạn kiệt kiểu — nếu thiếu 1 case, `pnpm typecheck` đỏ **trước
khi** `expectSevenStates` kịp chạy, tức có 2 lớp bảo vệ độc lập: biên dịch và
runtime):

```tsx
import { SEVEN_STATES, type SevenState } from '@/lib/testing/sevenStateScenarios';
import { expectSevenStates } from '@/lib/testing/expectSevenStates';
import { renderWithProviders } from '@/lib/testing/render';
import { FloorUploadScreenView } from './FloorUploadScreen';

const FOUR_FLOORS = ['Tầng hầm', 'Tầng 1', 'Tầng 2', 'Tầng 3'] as const;

function scenarioFor(state: SevenState) /* : FloorUploadScreenViewProps */ {
  switch (state) {
    case 'empty':
      // 4 thẻ tầng rỗng + copy hướng dẫn (chưa có tệp nào được thả)
      return { ...base, floors: FOUR_FLOORS.map(emptyCard), isOffline: false, canEdit: true, isCollapsed: false };
    case 'loading':
      // ít nhất 1 thẻ đang có progress bar chạy
      return { ...base, floors: FOUR_FLOORS.map((n, i) => (i === 0 ? uploadingCard(n) : emptyCard(n))), isOffline: false, canEdit: true, isCollapsed: false };
    case 'partial':
      // đúng 3/4 đã gắn tệp; footer phải nêu tên tầng còn thiếu (kiểm ở mục d)
      return { ...base, floors: [...FOUR_FLOORS.slice(0, 3).map(attachedCard), emptyCard(FOUR_FLOORS[3])], isOffline: false, canEdit: true, isCollapsed: false };
    case 'error':
      // 1 tệp quá khổ + 1 tệp không đọc được, lỗi khoanh trong đúng thẻ của nó
      return { ...base, floors: [errorCard(FOUR_FLOORS[0], 'qua-kho'), errorCard(FOUR_FLOORS[1], 'khong-doc-duoc'), attachedCard(FOUR_FLOORS[2]), emptyCard(FOUR_FLOORS[3])], isOffline: false, canEdit: true, isCollapsed: false };
    case 'success':
      // 4/4, nút chính bật, bộ đếm chân trang chạy tới 4
      return { ...base, floors: FOUR_FLOORS.map(attachedCard), isOffline: false, canEdit: true, isCollapsed: false };
    case 'forbidden':
      // bảng chỉ đọc, không có vùng kéo-thả
      return { ...base, floors: FOUR_FLOORS.map(attachedCard), isOffline: false, canEdit: false, isCollapsed: false };
    case 'collapsed':
      // < 1024px: thẻ gập thành bảng dọc
      return { ...base, floors: FOUR_FLOORS.map(attachedCard), isOffline: false, canEdit: true, isCollapsed: true };
    default: {
      const exhaustive: never = state;
      throw new Error(`chưa xử lý trạng thái: ${String(exhaustive)}`);
    }
  }
}

it('renders all seven states of A11 — FloorUploadScreen', () => {
  expectSevenStates(
    (scenario) => {
      const { container, unmount } = renderWithProviders(
        <FloorUploadScreenView {...scenarioFor(scenario.state)} />,
      );
      return { container, unmount };
    },
    SEVEN_STATES.map((state) => ({ state, label: SEVEN_STATE_LABELS[state], rows: [], totalCount: 4, isLoading: state === 'loading', isCollapsed: state === 'collapsed', canView: state !== 'forbidden', error: null })),
  );
});
```

Chú ý: `expectSevenStates` chỉ đọc `scenario.state` để lập chỉ mục 7 trạng
thái (xem `indexByState`, `expectSevenStates.ts:73-100`) — các trường
`rows`/`totalCount`/`isLoading`/`isCollapsed`/`canView`/`error` trong mảng thứ
hai chỉ tồn tại để thỏa kiểu `SevenStateScenario[]`; props thật đưa vào view
đến từ `scenarioFor(scenario.state)`, không phải từ `scenario` đó. Đây là lý
do bản đồ phải làm bằng tay thay vì spread `{...scenario}` như
`ProjectSettings` — domain của `ProjectSettings` (thành viên) tình cờ khớp
hình "rows"; domain của màn này (4 thẻ tầng cố định) thì không.

**Vì sao harness chứng minh 7/7 chứ không phải 6/7:**
1. **Runtime:** `SEVEN_STATES.map(...)` luôn sinh đúng 7 phần tử với `state`
   lấy từ hằng `SEVEN_STATES` — không có chỗ nào gõ tay chuỗi trạng thái nên
   không thể gõ nhầm/bỏ sót một cái tên. Nếu ai đó xoá một `case`, TypeScript
   đỏ trước (xem điểm 2); nếu ai đó cố tình comment-out một phần tử trong
   mảng truyền vào `expectSevenStates`, hàm này ném lỗi liệt kê đúng tên trạng
   thái thiếu bằng tiếng Việt (`expectSevenStates.ts:90-97`) — test đỏ, không
   xanh giả.
2. **Compile-time:** `scenarioFor` dùng `switch` cạn kiệt với biến `never` ở
   `default` — bớt một `case` thì `pnpm typecheck` đỏ ngay, không đợi tới lúc
   chạy test.
3. Không dùng `.only`/`.skip` (R-70) nên không có đường tắt nào bỏ qua một
   trong bảy lần gọi `renderScreen`.

---

## (b) TỐC ĐỘ CẬP NHẬT TIẾN TRÌNH ≤ 4/GIÂY

**File:** `src/screens/upload/FloorUploadScreen/FloorUploadScreen.test.tsx`
(hoặc, nếu cần cô lập khỏi 7-state suite, một file anh em
`FloorUploadScreen.progress.test.tsx` — cùng thư mục, cùng import path, không
tính vào 6-file count vì đó là fragment test, xem mục D áp dụng tương tự cho
`.stories.tsx` phụ).

**Vấn đề cốt lõi:** `uploadTask` (song song, `src/lib/upload/uploadTask.ts`)
được throttle bằng clock injectable — nhưng test này không cần biết CHỮ KÝ
chính xác của `uploadTask`. Nó đo ở biên **màn hình thực sự nhận được bao
nhiêu lần cập nhật**, dùng cơ chế có sẵn của React thay vì đoán tên callback:
`React.Profiler`. `Profiler.onRender` bắn đúng một lần mỗi khi cây con nó bọc
**commit** một lần render mới — đây là định nghĩa chính xác của "một lần cập
nhật tới màn hình", bất kể cập nhật đó đến từ state trong hook, từ
`@tanstack/react-query`, hay từ store. Cách này KHÔNG cần biết
`uploadTask`'s callback shape, nên không vỡ khi `contract-upload.md` xuất hiện
với chữ ký khác giả định ban đầu.

**Setup:** `installFakeClock()` từ `@/lib/testing/fakeClock` + mock
`ApiClient` (từ `createMockApiClient()` trong `src/api/__mocks__/client.ts`,
hoặc gateway của màn bọc quanh nó) tiêm vào container/route props, đúng khuôn
mẫu dependency-injection ở mục (b) của `contract-pattern.md`. `fireEvent` thả
4 `File` (dùng `new File(['x'.repeat(N)], 'ban-ve.png', { type: 'image/png' })`)
vào input ẩn của dropzone, gán 4 tầng, rồi bấm "Bắt đầu xử lý".

**Code sketch:**

```tsx
import { Profiler } from 'react';
import { fireEvent, screen } from '@testing-library/react';
import { installFakeClock } from '@/lib/testing/fakeClock';
import { renderWithProviders } from '@/lib/testing/render';
import { createMockApiClient } from '@/api/__mocks__/client';
import { FloorUploadScreenContainer } from './FloorUploadScreen.container';

it('cập nhật tiến trình không quá 4 lần mỗi giây, và vẫn phát đủ mốc 100%', async () => {
  const clock = installFakeClock();
  const gateway = createTestGatewayFrom(createMockApiClient()); // gateway thật của màn, wrap quanh mock client

  let commits = 0;
  const onRender = () => { commits += 1; };

  renderWithProviders(
    <Profiler id="floor-upload" onRender={onRender}>
      <FloorUploadScreenContainer projectId="project-1" gateway={gateway} />
    </Profiler>,
  );

  const files = FOUR_FLOORS.map((name, i) => new File(['x'.repeat(1024)], `${name}.png`, { type: 'image/png' }));
  fireEvent.change(screen.getByLabelText(/chọn tệp|kéo tệp/i), { target: { files } });
  // ... gán mỗi file cho đúng 1 trong 4 thẻ tầng theo UI thật của Layer 3 ...
  fireEvent.click(screen.getByRole('button', { name: /bắt đầu xử lý/i }));
  await clock.flushMicrotasks();

  // Bỏ qua các commit của thao tác kick-off (mount, thả tệp, bấm nút) —
  // đo cửa sổ 1 giây "ổn định" ngay sau khi xử lý bắt đầu chạy.
  commits = 0;
  await clock.advance(1000);

  console.log(`[NGHIEM-B] cap nhat tien trinh trong 1 giay = ${commits}`);
  expect(
    commits,
    `cập nhật tiến trình phải ≤ 4 lần/giây, đo được ${commits} lần trong cửa sổ 1000ms mô phỏng`,
  ).toBeLessThanOrEqual(4);

  // Cạnh biên: mốc 100% không được bị throttle nuốt mất.
  await clock.runAllTimers();
  const hundredPercentBadges = screen.getAllByText(/100\s?%/u);
  expect(hundredPercentBadges, 'cả 4 thẻ tầng phải tới được 100% dù có throttle').toHaveLength(4);

  clock.restore();
});
```

**Số phải in ra:** `commits` — số nguyên lần commit của `<Profiler>` đo được
trong cửa sổ 1000ms mô phỏng ngay sau khi bấm "Bắt đầu xử lý". In bằng
`console.log('[NGHIEM-B] ...')` (tiền tố cố định, dễ `grep` từ log
`pnpm test`) **và** đưa vào message thứ hai của `expect(...)` để nó tự nổi
lên khi test đỏ. Layer 3 trích số này vào báo cáo hoàn thành bằng cách chạy:

```bash
pnpm test 2>&1 | grep "NGHIEM-B"
```

**Vì sao đo đúng "1 giây":** `installFakeClock` khởi động timer giả
(`vi.useFakeTimers`), `clock.advance(1000)` tua đúng 1000ms thời gian giả và
**đợi hết mọi promise mà timer đó tạo ra trước khi trả về**
(`fakeClock.ts:88-90`, dùng `vi.advanceTimersByTimeAsync`) — nên không có
race giữa "tua xong" và "React đã commit xong" làm đếm thiếu.

**Nếu `uploadTask` không throttle qua `setInterval`/`setTimeout` mà qua
`requestAnimationFrame`:** `installFakeClock` không giả `requestAnimationFrame`
(chỉ giả timer chuẩn). Nếu contract-upload.md (khi xuất hiện) cho thấy
`uploadTask` dùng rAF, Layer 3 phải bổ sung `vi.stubGlobal('requestAnimationFrame', ...)`
gọi qua timer giả trước khi cài `installFakeClock`, hoặc đợi
`contract-upload.md` xác nhận cơ chế thật rồi chỉnh sketch trên cho khớp —
đây là điểm DUY NHẤT trong tài liệu này phụ thuộc vào chữ ký chưa biết của
`uploadTask`, và Profiler-counting vẫn đúng bất kể chỉnh sửa đó.

---

## (c) GREP SỐ MA THUẬT

**File:** không phải file test — là một bước shell, chạy được trong Git Bash
trên Windows (`orca` PowerShell tool cũng chạy được nếu gọi qua `bash -lc`).

**Lệnh chính xác:**

```bash
grep -rnE '5242880|104857600|100 MB' src/screens/upload/FloorUploadScreen
```

**Kỳ vọng:** **rỗng** (exit code 1 của `grep`, không in dòng nào). Chạy sau
khi Layer 3 dựng xong 6 file, trước khi báo cáo hoàn thành — đặt trong cùng
bước với `pnpm verify` ở phần "Số phải báo cáo" bên dưới.

**Nếu KHÔNG rỗng:** nghĩa là màn đã tự viết lại một giới hạn dung lượng
(5 242 880 byte = 5 MB/tệp, 104 857 600 byte = 100 MB, hoặc chuỗi "100 MB")
thay vì gọi hằng số từ T-01/T-03 — vi phạm thẳng điều cấm
"Không tự viết giới hạn dung lượng" trong `[CAM TUYET DOI]`. Việc sửa không
phải nới lỏng grep (không thêm `--exclude`, không đổi con số) mà là sửa màn
để import hằng số thật.

**Vì sao đúng phạm vi:** lệnh trỏ vào chính thư mục màn
(`src/screens/upload/FloorUploadScreen`), không lọc theo đuôi file — quét cả
`.tsx`, `.ts`, `.stories.tsx`, `.test.tsx` bên trong, vì nếu con số rò vào
test hoặc story thì màn cũng đang được viết như thể giới hạn là của riêng nó.

---

## (d) NÚT CHẶN NÊU TÊN TẦNG THIẾU VÀ CUỘN TỚI ĐÓ

**File:** `src/screens/upload/FloorUploadScreen/FloorUploadScreen.test.tsx`

**Setup:** dùng `attachedCard`/`emptyCard` helper giống mục (a), dựng kịch
bản `partial`: 3/4 tầng có tệp, thiếu đúng `Tầng 2`. `Element.prototype.scrollIntoView`
không tồn tại trong jsdom — jsdom không cài đặt layout/scroll, nên gọi thẳng
`el.scrollIntoView()` trong code màn sẽ ném `TypeError` nếu không có gì gán
nó trước. Vì vậy test PHẢI gán một spy lên đúng chỗ đó trước khi render:

```tsx
it('nêu tên tầng thiếu và cuộn tới đó khi bấm nút chính lúc còn thiếu 1 tầng', () => {
  const scrollSpy = vi.fn();
  // Gán 1 lần cho mọi phần tử — jsdom không tự có scrollIntoView.
  Element.prototype.scrollIntoView = scrollSpy;

  const { container } = renderWithProviders(
    <FloorUploadScreenView {...partialScenarioMissing('Tầng 2')} />,
  );

  const submitButton = screen.getByRole('button', { name: /bắt đầu xử lý/i });

  // Cấm 9.x: không được vô hiệu nút chính mà không nêu lý do — nút phải
  // BẤM ĐƯỢC, danh sách lý do xuất hiện sau khi bấm, không phải trước đó
  // qua `disabled`.
  expect(submitButton).toBeEnabled();

  fireEvent.click(submitButton);

  // (i) tên tầng thiếu phải xuất hiện trong nội dung đã render
  expect(screen.getByText(/Tầng 2/)).toBeInTheDocument();

  // (ii) đúng phần tử chứa "Tầng 2" đó (hoặc phần tử cha gần nhất đại diện
  // cho thẻ tầng) phải là "this" mà scrollIntoView được gọi lên — không chỉ
  // "được gọi ở đâu đó trên trang".
  expect(scrollSpy).toHaveBeenCalledTimes(1);
  const scrolledElement = scrollSpy.mock.contexts[0] as HTMLElement;
  expect(
    scrolledElement.textContent,
    `scrollIntoView phải được gọi trên phần tử chứa tên tầng thiếu, gọi trên: "${scrolledElement.textContent}"`,
  ).toContain('Tầng 2');

  console.log(`[NGHIEM-D] ten-tang-thieu="Tầng 2" scroll-called=${scrollSpy.mock.calls.length}`);
});
```

**Vì sao `scrollSpy.mock.contexts[0]` đúng đối tượng "this":** Vitest (tương
thích API Jest) ghi lại `this` của mỗi lần gọi một `vi.fn()` vào
`mock.contexts` — không phải `mock.instances` (cái đó chỉ ghi khi hàm được
gọi bằng `new`). Vì `scrollIntoView` luôn được gọi dạng `el.scrollIntoView()`
(gọi phương thức, không phải constructor), `this` bên trong đúng là `el`, nên
`mock.contexts[0]` chính là phần tử DOM thật mà mã màn đã gọi lên — đây là
cách duy nhất phân biệt "cuộn đúng thẻ tầng thiếu" với "cuộn tới một chỗ nào
đó ngẫu nhiên trên trang", vì jsdom không có toạ độ cuộn thật để so sánh.

**Số phải báo cáo:** tên tầng thiếu tìm thấy (`"Tầng 2"`), và
`scrollSpy.mock.calls.length` (kỳ vọng đúng 1 — 0 nghĩa là không cuộn, > 1
nghĩa là cuộn nhiều nơi/nhiều lần, cả hai đều là thất bại đáng báo cáo dù
assertion trên đã bắt qua `toHaveBeenCalledTimes(1)`).

**Về cấm 9.x "không hộp thoại cho lỗi tệp":** danh sách lý do thiếu tầng ở
đây không phải lỗi tải tệp (đó là mục [CAM TUYET DOI] dòng 1, về lỗi MỘT tệp
cụ thể) — đây là việc chặn hành động submit khi thiếu dữ liệu, và A9 áp dụng
ngược lại: A9 chỉ bắt hộp thoại xác nhận cho hành động **không hoàn tác
được**; chặn submit không phải hành động, nên không cần hộp thoại — chỉ cần
không disable âm thầm (đã kiểm ở `toBeEnabled()` phía trên) và nêu lý do
ngay trên trang (đã kiểm ở `toBeInTheDocument()`).

---

## (e) DROP-ZONE KHÔNG ĐỔI KÍCH THƯỚC — CHÊNH LỆCH = 0

**Giới hạn thành thật của jsdom:** jsdom không chạy layout engine.
`getBoundingClientRect()` trên MỌI phần tử trong jsdom luôn trả về
`{ x: 0, y: 0, width: 0, height: 0, top: 0, right: 0, bottom: 0, left: 0 }`
trừ khi test tự mock nó. Một assertion kiểu
`expect(before.width - after.width).toBe(0)` đọc `getBoundingClientRect()`
thật trong jsdom sẽ LUÔN đúng (0 − 0 = 0) bất kể mã màn làm gì — đây chính là
"assertion trivially passes" mà đặc tả yêu cầu không được viết. Vì vậy mục
này tách làm hai phần: phần vitest kiểm cái jsdom kiểm được thật (class/style
không đổi ảnh hưởng box model), phần Playwright kiểm phép đo pixel thật.

### Phần 1 — vitest, kiểm class/style không ảnh hưởng box model

**File:** `FloorUploadScreen.test.tsx`

**Setup:** render trạng thái `empty` hoặc `success`, lấy `className` (và
`style` inline nếu có) của vùng thả trước và sau khi bắn `dragEnter`/`dragOver`.

```tsx
const SIZE_AFFECTING_CLASS = /^(w-|h-|min-w-|min-h-|max-w-|max-h-|p-|px-|py-|pt-|pr-|pb-|pl-|m-|mx-|my-|mt-|mr-|mb-|ml-|border-[0-9]|inset-|top-|right-|bottom-|left-|gap-)/;

it('vùng thả đổi màu viền/nền khi kéo tệp qua nhưng không đổi lớp ảnh hưởng kích thước', () => {
  const { container } = renderWithProviders(<FloorUploadScreenView {...emptyScenario} />);
  const zone = screen.getByTestId('floor-upload-dropzone'); // data-testid do Layer 3 đặt trên chính vùng thả

  const classesBefore = new Set(zone.className.split(/\s+/).filter(Boolean));
  const stylePropsBefore = zone.getAttribute('style');

  const dataTransfer = { files: [], items: [{ kind: 'file', type: 'image/png' }], types: ['Files'] };
  fireEvent.dragEnter(zone, { dataTransfer });
  fireEvent.dragOver(zone, { dataTransfer });

  const classesAfter = new Set(zone.className.split(/\s+/).filter(Boolean));
  const stylePropsAfter = zone.getAttribute('style');

  const added = [...classesAfter].filter((c) => !classesBefore.has(c));
  const removed = [...classesBefore].filter((c) => !classesAfter.has(c));
  const sizeAffecting = [...added, ...removed].filter((c) => SIZE_AFFECTING_CLASS.test(c));

  expect(
    sizeAffecting,
    `dragover không được đổi lớp ảnh hưởng kích thước, nhưng đổi: ${sizeAffecting.join(', ')}`,
  ).toEqual([]);
  // Đổi màu/nền là ĐÚNG kỳ vọng (border-accent, bg-*, opacity trên phần còn
  // lại của trang) — test này không cấm added/removed nói chung, chỉ cấm tập
  // con "size-affecting".
  expect(added.length + removed.length, 'phải có ít nhất 1 lớp đổi để phản hồi kéo-thả').toBeGreaterThan(0);
  expect(stylePropsAfter, 'không được chuyển sang style inline có width/height/padding/margin/border-width').not.toMatch(/(width|height|padding|margin|border-width)\s*:/);

  console.log(`[NGHIEM-E1] lop-doi-kich-thuoc=${sizeAffecting.length}`);
});
```

**Đọc trung thực assertion này đo được gì:** nó KHÔNG đo pixel. Nó đo "danh
sách lớp Tailwind/style bị thêm-bớt khi kéo-thả có nằm trong tập lớp có thể
ảnh hưởng box model không". Với `box-sizing: border-box` (Tailwind Preflight
áp toàn cục), đổi `border-*-width` (nếu có) về lý thuyết không đổi kích thước
NGOÀI của phần tử — nhưng test này vẫn liệt `border-[0-9]` vào danh sách cấm
vì Layer 3 hoàn toàn có thể bỏ `box-sizing: border-box` cho riêng phần tử này
qua một class khác, và cấm ở lớp còn an toàn hơn là tin vào một thuộc tính
global không được kiểm lại ở đây.

### Phần 2 — Playwright, phép đo pixel thật (khuyến nghị bắt buộc, không phải tuỳ chọn)

Vì Phần 1 không chứng minh được "chênh lệch pixel = 0" — chỉ chứng minh "mã
không cố tình đổi lớp kích thước" — đặc tả (e) chỉ được nghiệm thu ĐẦY ĐỦ khi
có thêm bước này. Đây là "phương án thay thế trung thực gần nhất" đặc tả yêu
cầu khi 1 tiêu chí không đo được bằng công cụ hiện có (ở đây: jsdom).

**File:** `e2e/floor-upload.spec.ts` (thư mục `e2e/` đã tồn tại — xem
`e2e/motion.spec.ts` làm khuôn mẫu tương tác, không phải khuôn mẫu ảnh — file
mới không cần snapshot `.png`, nên không vướng bẫy đã biết #6 về ảnh chuẩn
`linux` còn thiếu).

**Điều kiện tiên quyết đáng nói rõ:** theo CLAUDE.md mục "Trạng thái hiện
tại", `src/routes.tsx`/router **chưa gắn** vào `main.tsx` — `App.tsx` là bảng
chọn 9 màn demo dùng `useState`. Nếu tới lúc Layer 3 hoàn thành, màn
`/projects/:id/upload` vẫn chỉ vào được qua bảng chọn đó (như
`openMotionScreen` trong `e2e/motion.spec.ts:12-17` bấm nút đổi màn, không
`page.goto` thẳng route), spec dưới đây phải mở màn theo cách đó thay vì
`page.goto('/projects/x/upload')`. Nếu Layer 3 (hoặc một Layer khác trong DAG)
đã gắn router thật trước khi spec này chạy, dùng `page.goto` thẳng route.

```ts
import { expect, test } from '@playwright/test';

test('vùng thả không đổi kích thước khi kéo tệp qua', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto('/'); // hoặc page.goto('/projects/project-1/upload') nếu router đã gắn
  // ... điều hướng tới FloorUploadScreen theo cách thật của App.tsx tại thời điểm chạy ...

  const zone = page.getByTestId('floor-upload-dropzone');
  const before = await zone.boundingBox();
  expect(before, 'vùng thả phải có box đo được trước khi kéo').not.toBeNull();

  // Playwright không có API "kéo tệp qua" mức thấp built-in tương đương
  // fireEvent.dragOver; dùng dispatchEvent thủ công trên chính trang.
  await zone.dispatchEvent('dragenter', { dataTransfer: new DataTransfer() });
  await zone.dispatchEvent('dragover', { dataTransfer: new DataTransfer() });

  const after = await zone.boundingBox();
  expect(after, 'vùng thả phải vẫn đo được box sau khi kéo').not.toBeNull();

  const deltaW = Math.abs((after!.width) - (before!.width));
  const deltaH = Math.abs((after!.height) - (before!.height));

  console.log(`[NGHIEM-E2] deltaW=${deltaW} deltaH=${deltaH}`);
  expect(deltaW, `chiều rộng vùng thả lệch ${deltaW}px khi kéo tệp qua`).toBe(0);
  expect(deltaH, `chiều cao vùng thả lệch ${deltaH}px khi kéo tệp qua`).toBe(0);
});
```

Đây là phép đo pixel THẬT — chạy trên Chromium thật (`playwright.config.ts`),
có layout engine thật, nên `boundingBox()` trả toạ độ/khích thước thật, khác
hẳn `getBoundingClientRect()` giả trong jsdom ở Phần 1.

**Nếu Layer 3 không thể chạy Playwright trong môi trường của họ (ví dụ máy
DAG không có Chromium cài sẵn):** báo rõ trong phần "Số phải báo cáo" rằng
`[NGHIEM-E2]` KHÔNG chạy được, kèm lý do — đừng báo "đạt" cho bước chưa chạy
(E.10). Phần 1 (vitest) vẫn phải chạy và qua trong mọi trường hợp; nó là điều
kiện cần, không phải điều kiện đủ, cho tiêu chí (e).

---

## NHỮNG CON SỐ PHẢI BÁO CÁO

Checklist cho báo cáo hoàn thành của Layer 3 (`worker_done --body` hoặc
tương đương). Không có số = chưa xong (theo Định nghĩa hoàn thành của chính
Layer 3, kế thừa nguyên tắc E.10/R-58 của tài liệu này):

- [ ] `pnpm typecheck` — đạt/lỗi (nếu lỗi: số lỗi)
- [ ] `pnpm lint` — số lỗi + số cảnh báo (cảnh báo cũng là lỗi, `--max-warnings 0`)
- [ ] `pnpm test` — số file test qua/hỏng, số case qua/hỏng
- [ ] Mục (a): `expectSevenStates` — x/7 trạng thái qua (kỳ vọng 7/7)
- [ ] Mục (b): `[NGHIEM-B]` — số lần cập nhật tiến trình đo được trong cửa sổ
      1 giây mô phỏng (kỳ vọng ≤ 4), và kết quả assertion "100% không bị nuốt"
      (đạt/hỏng)
- [ ] Mục (c): số dòng khớp của
      `grep -rnE '5242880|104857600|100 MB' src/screens/upload/FloorUploadScreen`
      (kỳ vọng 0)
- [ ] Mục (d): tên tầng thiếu tìm thấy trong DOM (kỳ vọng `"Tầng 2"` hoặc tầng
      tương ứng kịch bản thật), kết quả assertion nút chính KHÔNG bị disable
      âm thầm (đạt/hỏng), và `scrollSpy.mock.calls.length` (kỳ vọng đúng 1,
      gọi trên đúng phần tử chứa tên tầng thiếu)
- [ ] Mục (e) Phần 1: `[NGHIEM-E1]` — số lớp "ảnh hưởng kích thước" bị
      thêm/bớt khi dragover (kỳ vọng 0)
- [ ] Mục (e) Phần 2: `[NGHIEM-E2]` — `deltaW`/`deltaH` đo bằng Playwright
      (kỳ vọng cả hai = 0), HOẶC ghi rõ "chưa chạy được" kèm lý do nếu môi
      trường không có Chromium — không được báo "đạt" nếu không chạy
