/**
 * Hook của S-25 — thư viện model dùng chung (`/admin/models`).
 *
 * View thuần chỉ nhận `model` + `actions` (mục D, R-60); tất cả phần còn lại của màn ở
 * đây. File này tiêu thụ `modelLibraryGateway.ts` và không dựng lại thứ gì trong đó —
 * `createModelLibraryGateway` là cửa vào duy nhất tới dữ liệu thư viện và tới khung xem
 * trước 3D.
 *
 * ## R-61 — file này NỐI LẠI logic đã có, không chứa công thức tự chế
 *
 * | Việc | Đi qua |
 * |---|---|
 * | Đọc danh mục / một mục | `libraryListQueryOptions` / `libraryDetailQueryOptions`, qua cổng |
 * | Lọc theo chip | `matchesLibraryFilter` (`src/api/schemas/library.ts:187`) |
 * | Tìm bỏ dấu | `foldForSearch` (`screens/viewer/Viewer3D/roomSearch.ts:60`) |
 * | Nhãn nhóm tiếng Việt | `FURNITURE_CATEGORY_LABELS` (`furnitureLibraryPanelTypes.ts:58`) |
 * | Định dạng số | `formatNumber` / `formatFileSize` / `formatLength` (`src/lib/format`) |
 * | "Nặng" và câu khuyến nghị | `checkBudget` + `SCENE_BUDGET` (`src/lib/three/perf/budget.ts`) |
 * | Câu lỗi tiếng Việt | `describeError(toAppError(…))` (`src/lib/errors`) |
 *
 * Hai lời nhập sâu vào thư mục màn khác là cố ý và có lý do đo được: cả
 * `furnitureLibraryPanelTypes.ts` lẫn `roomSearch.ts` đều là module LÁ, không nhập gì cả,
 * nên chúng đi vào bao đóng của tuyến `/admin/models` gần như miễn phí. Nhập cùng hai thứ
 * ấy qua `index.ts` của hai màn kia sẽ kéo theo cả `Viewer3D` và `src/store` — cổng kích
 * thước gói đo theo TỪNG tuyến, nên cái giá ấy là thật.
 *
 * ## Trạng thái máy chủ: `useQuery`, không `useState` (R-64)
 *
 * Không có một `useState` nào cho `isLoading` hay `error` ở đây. `useShareLinks.ts` tự
 * viết hai thứ ấy bằng tay và đó là **ngoại lệ đi trước, không phải khuôn mẫu**. `useState`
 * trong file này chỉ giữ lựa chọn của người dùng — ô tìm, chip lọc, kiểu xem, cột sắp,
 * mục đang mở — cộng vòng đời của MỘT khung xem trước 3D, thứ không phải trạng thái máy
 * chủ và không được nằm trong bộ nhớ đệm của react-query: một phiên WebGL bị bộ nhớ đệm
 * giữ lại là một ngữ cảnh không ai dọn.
 *
 * ## Ba quyết định đã chốt, chép lại để không ai gỡ nhầm
 *
 * 1. **Không bao giờ nạp quá MỘT model cùng lúc.** Lượt nạp sống trong đúng một `useEffect`
 *    có khoá là (canvas, `modelUrl`, `previewEpoch`); mở model khác thì phần dọn của lượt
 *    trước chạy trước
 *    khi lượt sau bắt đầu. `closeDetail` còn gọi `dispose()` thẳng tay trước cả lượt vẽ
 *    lại, nên "đóng panel là dọn ngay" không phụ thuộc vào lúc React chạy phần dọn (R-05).
 * 2. **`onToast` không bao giờ được gọi trong bản này.** A8 nói mọi THAY ĐỔI phải hoàn tác
 *    được kèm toast; màn này không có thay đổi nào — chín khả năng ghi đều `false` vì
 *    `LibraryApi` không có phương thức ghi. Một toast không có gì để hoàn tác sẽ là một lời
 *    hứa rỗng, nên hợp đồng giữ chỗ cho ngày có đường ghi thật, và hook không phát gì.
 * 3. **`isPreviewBroken` là "mục này không có ảnh xem trước dùng được".** Hợp đồng không có
 *    hành động nào để view báo ngược lên rằng thẻ `<img>` vừa hỏng — chỉ có
 *    `retryPreviewImage`. Nguồn duy nhất còn lại là `LibraryItem.previewUrl`, vốn là
 *    trường TUỲ CHỌN của schema (`library.ts:133`; hai mục trong bộ mẫu thiếu nó). Nên
 *    hàng thiếu ảnh hiện biểu tượng thay thế trung tính + nút thử lại, và "thử lại" là đọc
 *    lại danh mục qua tầng query chứ không phải nạp lại một URL không tồn tại.
 */

import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import type { LibraryFilterId, LibraryItem } from '@/api/client';
import { LIBRARY_FILTER_IDS, matchesLibraryFilter } from '@/api/contracts';
import { describeError, toAppError } from '@/lib/errors';
import { formatFileSize } from '@/lib/format/bytes';
import { formatLength } from '@/lib/format/measure';
import { formatNumber } from '@/lib/format/number';
import { checkBudget, detectDeviceProfile, type DeviceProfile } from '@/lib/three/perf/budget';
import {
  FURNITURE_CATEGORY_LABELS,
  type FurnitureCategoryId,
} from '@/screens/viewer/FurnitureLibraryPanel/furnitureLibraryPanelTypes';
import { foldForSearch } from '@/screens/viewer/Viewer3D/roomSearch';

import { modelLibraryDetailKey, modelLibraryListKey } from './modelLibraryGateway';
import type {
  ModelLibraryActions,
  ModelLibraryDetailModel,
  ModelLibraryFieldModel,
  ModelLibraryFilterOption,
  ModelLibraryModel,
  ModelLibraryResult,
  ModelLibraryRowModel,
  ModelLibrarySortKey,
  ModelLibrarySummaryModel,
  ModelLibraryViewMode,
  ModelPreviewModel,
  ModelPreviewSession,
  ModelPreviewState,
  SevenState,
  SortDirection,
  UseModelLibraryOptions,
} from './types';

/* -------------------------------------------------------------------------- */
/* 1 — Chữ của hook (A6: viết thường, kiểu câu)                               */
/* -------------------------------------------------------------------------- */

/**
 * Mọi câu tiếng Việt hook sinh ra, gom một chỗ.
 *
 * Xuất khẩu để bài kiểm đối chiếu ĐÚNG chuỗi này thay vì gõ lại một bản thứ hai (R-70) —
 * cùng lý do `FURNITURE_LIBRARY_PANEL_TEXT` tồn tại ở panel thư viện nội thất.
 */
export const MODEL_LIBRARY_TEXT = {
  readOnlyReason:
    'vai trò của bạn chỉ xem được thư viện, nên mọi hành động sửa danh mục không hiện',
  autoSpinNote: 'khung xem trước không tự quay; kéo chuột trong khung để xoay model',
  loadFailed: 'không đọc được danh mục model',
  fieldBounds: 'kích thước bao',
  fieldTriangles: 'số tam giác',
  fieldFileSize: 'dung lượng',
  fieldGroup: 'nhóm',
} as const;

/* -------------------------------------------------------------------------- */
/* 2 — Nhãn nhóm: mượn bảng đã có, không viết bảng thứ hai                     */
/* -------------------------------------------------------------------------- */

/**
 * Mười id lọc của tầng API ↔ mười id chip của panel thư viện nội thất.
 *
 * Hai bảng đặt tên khác nhau ở đúng hai chỗ (`storage`↔`cabinet`, `technical`↔`equipment`)
 * — cùng phép đổi tên mà `LIBRARY_FILTER_BY_CATEGORY` (`furnitureLibraryPanelGateway.ts`)
 * đã khai theo chiều ngược lại. Không nhập bảng ấy về được: file kia kéo theo `@/store` và
 * cả tầng lệnh. Cái được chép ở đây là hai cái TÊN, còn CHỮ tiếng Việt vẫn có đúng một
 * nguồn là `FURNITURE_CATEGORY_LABELS`.
 */
const CATEGORY_BY_FILTER: Readonly<Record<LibraryFilterId, FurnitureCategoryId>> = {
  all: 'all',
  table: 'table',
  chair: 'chair',
  bed: 'bed',
  sofa: 'sofa',
  storage: 'cabinet',
  sanitary: 'sanitary',
  kitchen: 'kitchen',
  technical: 'equipment',
  mine: 'mine',
};

/** Nhãn tiếng Việt của một chip lọc, hoặc của nhóm một mục. */
export function libraryFilterLabel(filterId: LibraryFilterId): string {
  return FURNITURE_CATEGORY_LABELS[CATEGORY_BY_FILTER[filterId]];
}

/* -------------------------------------------------------------------------- */
/* 3 — Một hàng: định dạng xảy ra ở đây, không ở view (A15)                    */
/* -------------------------------------------------------------------------- */

/**
 * Ba chiều bao, mỗi số đi qua `formatLength`.
 *
 * Đơn vị lặp lại ở cả ba vế chứ không viết một lần ở cuối: gộp nó lại đòi tự chia
 * mm cho 1.000, đúng phép quy đổi mà `local/no-raw-number` chặn và docblock hợp đồng cấm.
 * `src/lib/format` không có hàm ghép ba chiều — cùng khoảng trống mà
 * `dimensionsLabelOf` của panel thư viện nội thất đã ghi nhận.
 */
function boundsLabelOf(item: LibraryItem): string {
  return [item.widthMm, item.depthMm, item.heightMm]
    .map((valueMm) => formatLength(valueMm, { unit: 'm' }))
    .join(' × ');
}

/**
 * Model này có nặng hơn ngân sách hiệu năng của cảnh không (R-04).
 *
 * Cùng phép đo mà `isHeavyLibraryItem` (`furnitureLibraryPanelGateway.ts:183-222`) đang
 * dùng, với đúng giới hạn đã biết của nó: cảnh nền được tính bằng KHÔNG, nên mọi `true` là
 * một cảnh báo thật còn `false` có thể là âm tính giả. `SCENE_BUDGET.maxTriangles` là
 * ngưỡng DUY NHẤT — repo không có `maxTrianglesPerModel`, và một ngưỡng mềm bịa ra là đúng
 * thứ R-71 cấm.
 *
 * Câu khuyến nghị lấy nguyên `BudgetWarning.message`; hook không tự viết một câu có số
 * trong đó.
 */
function heavyVerdictOf(
  item: LibraryItem,
  profile: DeviceProfile,
): { readonly isHeavy: boolean; readonly heavyAdvice: string | null } {
  const warnings = checkBudget(
    {
      drawCalls: 0,
      graphicsMemoryMb: 0,
      materials: 0,
      triangles: item.triangleCount,
    },
    profile,
  );

  return { isHeavy: warnings.length > 0, heavyAdvice: warnings[0]?.message ?? null };
}

/** Một mục thư viện, đã định dạng sẵn cho mắt người. */
function buildRow(item: LibraryItem, profile: DeviceProfile): ModelLibraryRowModel {
  const verdict = heavyVerdictOf(item, profile);

  return {
    id: item.id,
    name: item.name,
    groupLabel: libraryFilterLabel(item.group),
    boundsLabel: boundsLabelOf(item),
    triangleCountLabel: formatNumber(item.triangleCount),
    fileSizeLabel: formatFileSize(item.fileSizeBytes),
    triangleCount: item.triangleCount,
    fileSizeBytes: item.fileSizeBytes,
    // Nhân, không chia: đây là thể tích hộp bao để SẮP XẾP, không phải một lượt quy đổi
    // đơn vị, và nó không bao giờ được render thẳng.
    boundsVolumeMm3: item.widthMm * item.depthMm * item.heightMm,
    previewUrl: item.previewUrl ?? null,
    isPreviewBroken: item.previewUrl === undefined,
    ...verdict,
  };
}

/* -------------------------------------------------------------------------- */
/* 4 — Lọc, tìm, sắp                                                          */
/* -------------------------------------------------------------------------- */

/** Ô tìm: bỏ dấu ở CẢ HAI phía, đúng cách ô tìm đối tượng của `Viewer3D` làm. */
function matchesSearchText(name: string, query: string): boolean {
  const needle = foldForSearch(query).trim();

  return needle === '' || foldForSearch(name).includes(needle);
}

/**
 * So hai hàng theo một khoá.
 *
 * Ba khoá số sắp trên SỐ THÔ (`triangleCount`, `fileSizeBytes`, `boundsVolumeMm3`), không
 * trên chuỗi đã định dạng — `"1.240.000"` sắp theo chữ sẽ đứng trước `"8.400"`. Hai khoá
 * chữ sắp theo `localeCompare('vi')` để "Đ" đứng đúng chỗ của nó trong bảng chữ cái tiếng
 * Việt; nhóm sắp theo NHÃN vì đó là thứ người đọc thấy, và nó là một cái tên chứ không
 * phải một con số.
 */
function compareRows(
  left: ModelLibraryRowModel,
  right: ModelLibraryRowModel,
  key: ModelLibrarySortKey,
): number {
  switch (key) {
    case 'name':
      return left.name.localeCompare(right.name, 'vi');
    case 'group':
      return left.groupLabel.localeCompare(right.groupLabel, 'vi');
    case 'bounds':
      return left.boundsVolumeMm3 - right.boundsVolumeMm3;
    case 'triangles':
      return left.triangleCount - right.triangleCount;
    case 'fileSize':
      return left.fileSizeBytes - right.fileSizeBytes;
  }
}

/* -------------------------------------------------------------------------- */
/* 5 — Dải tóm tắt và panel chi tiết                                          */
/* -------------------------------------------------------------------------- */

/**
 * Ba con số trên đầu bảng, tính trên NHỮNG HÀNG ĐANG HIỆN.
 *
 * Dải nằm ngay trên bảng, nên một con số phớt lờ chip lọc đang bật sẽ mâu thuẫn với bảng
 * ngay dưới nó. "Thư viện rỗng thật" là câu hỏi khác, và `ModelLibraryModel.isLibraryEmpty`
 * mới là chỗ trả lời nó.
 */
function buildSummary(rows: readonly ModelLibraryRowModel[]): ModelLibrarySummaryModel {
  let totalSizeBytes = 0;
  let heavyCount = 0;

  for (const row of rows) {
    totalSizeBytes += row.fileSizeBytes;
    if (row.isHeavy) {
      heavyCount += 1;
    }
  }

  return {
    totalCountLabel: formatNumber(rows.length),
    totalSizeLabel: formatFileSize(totalSizeBytes),
    heavyCountLabel: formatNumber(heavyCount),
    isAllWithinBudget: heavyCount === 0,
  };
}

/** Bốn dòng `FieldRow` của panel chi tiết; ba dòng đầu là chữ đều. */
function buildFields(row: ModelLibraryRowModel): readonly ModelLibraryFieldModel[] {
  return [
    { label: MODEL_LIBRARY_TEXT.fieldBounds, value: row.boundsLabel, isNumeric: true },
    { label: MODEL_LIBRARY_TEXT.fieldTriangles, value: row.triangleCountLabel, isNumeric: true },
    { label: MODEL_LIBRARY_TEXT.fieldFileSize, value: row.fileSizeLabel, isNumeric: true },
    { label: MODEL_LIBRARY_TEXT.fieldGroup, value: row.groupLabel, isNumeric: false },
  ];
}

/** Vòng đời một khung xem trước, giữ ngoài bộ nhớ đệm của react-query — xem docblock đầu file. */
interface PreviewRuntime {
  readonly state: ModelPreviewState;
  readonly measuredTriangleCount: number | null;
  readonly errorMessage: string | null;
}

const IDLE_PREVIEW: PreviewRuntime = Object.freeze({
  state: 'idle',
  measuredTriangleCount: null,
  errorMessage: null,
});

/* -------------------------------------------------------------------------- */
/* 6 — Hook                                                                   */
/* -------------------------------------------------------------------------- */

export function useModelLibrary(options: UseModelLibraryOptions): ModelLibraryResult {
  const { gateway } = options;
  const isNarrow = options.isNarrow ?? false;
  const openPreview = gateway.openPreview;

  const queryClient = useQueryClient();

  /* ---- Lựa chọn của người dùng ----------------------------------------- */

  const [searchText, setSearchText] = useState('');
  const [filterId, setFilterId] = useState<LibraryFilterId>('all');
  const [viewMode, setViewMode] = useState<ModelLibraryViewMode>('table');
  const [sort, setSort] = useState<{
    readonly key: ModelLibrarySortKey;
    readonly direction: SortDirection;
  }>({ key: 'name', direction: 'asc' });
  const [openModelId, setOpenModelId] = useState<string | null>(null);
  const [canvas, setCanvas] = useState<HTMLCanvasElement | null>(null);
  /**
   * Lượt xem trước hiện tại. Tăng mỗi lần `openDetail` được gọi — KỂ CẢ khi id không đổi.
   *
   * `setOpenModelId` một mình không đủ: `useState` bỏ qua lần đặt trùng giá trị, nên mở lại
   * chính model đang mở sẽ không dựng lại gì. Nút "thử lại" của khung 3D lại đi đúng đường
   * đó (`ModelLibraryDetail.tsx`), nên nếu thiếu con số này nó là một nút chết (R-69).
   * Effect nạp model đọc nó như một phụ thuộc, nên tăng nó = dọn phiên cũ (phần dọn của
   * effect) rồi mở phiên mới.
   */
  const [previewEpoch, setPreviewEpoch] = useState(0);

  /* ---- Đọc: danh mục và một mục ---------------------------------------- */

  const listQuery = useQuery({
    queryKey: modelLibraryListKey(),
    queryFn: ({ signal }): Promise<readonly LibraryItem[]> => gateway.listModels(signal),
  });

  const detailQuery = useQuery({
    queryKey: modelLibraryDetailKey(openModelId ?? ''),
    queryFn: ({ signal }): Promise<LibraryItem> => {
      if (openModelId === null) {
        return Promise.reject(new Error(MODEL_LIBRARY_TEXT.loadFailed));
      }

      return gateway.readModel(openModelId, signal);
    },
    enabled: openModelId !== null,
  });

  /* ---- Hàng, chip, dải tóm tắt ------------------------------------------ */

  const items = useMemo((): readonly LibraryItem[] => listQuery.data ?? [], [listQuery.data]);

  // `detectDeviceProfile()` đọc `matchMedia`; gọi nó một lần cho cả bảng thay vì một lần
  // cho mỗi hàng.
  const deviceProfile = useMemo((): DeviceProfile => detectDeviceProfile(), []);

  /** Trạng thái 3: danh mục có hàng, nhưng vài mục không có ảnh xem trước dùng được. */
  const hasBrokenPreview = useMemo(
    (): boolean => items.some((item) => item.previewUrl === undefined),
    [items],
  );

  const rows = useMemo((): readonly ModelLibraryRowModel[] => {
    const visible = items
      .filter(
        (item) => matchesLibraryFilter(item, filterId) && matchesSearchText(item.name, searchText),
      )
      .map((item) => buildRow(item, deviceProfile));
    const ordered = [...visible].sort((left, right) => compareRows(left, right, sort.key));

    return sort.direction === 'asc' ? ordered : ordered.reverse();
  }, [items, filterId, searchText, sort, deviceProfile]);

  /**
   * Mười chip, đếm trên CẢ danh mục.
   *
   * Số trên một chip phải nói "bấm vào đây thì có bao nhiêu", nên nó không được đổi theo
   * chip đang bật hay theo ô tìm — nếu không, mọi chip chưa bật sẽ hiện số 0.
   */
  const filterOptions = useMemo(
    (): readonly ModelLibraryFilterOption[] =>
      LIBRARY_FILTER_IDS.map((id) => ({
        id,
        label: libraryFilterLabel(id),
        count: items.filter((item) => matchesLibraryFilter(item, id)).length,
      })),
    [items],
  );

  const summary = useMemo(() => buildSummary(rows), [rows]);

  /* ---- Khung xem trước 3D ----------------------------------------------- */

  const [preview, setPreview] = useState<PreviewRuntime>(IDLE_PREVIEW);
  /** Phiên đang sống, giữ song song trong một ref để `closeDetail` dọn được NGAY. */
  const sessionRef = useRef<ModelPreviewSession | null>(null);

  const openItem = useMemo((): LibraryItem | null => {
    if (openModelId === null) {
      return null;
    }

    return detailQuery.data ?? items.find((item) => item.id === openModelId) ?? null;
  }, [openModelId, detailQuery.data, items]);

  const modelUrl = openItem?.modelUrl ?? null;

  useEffect(() => {
    if (canvas === null || modelUrl === null || openPreview === undefined) {
      return undefined;
    }

    const controller = new AbortController();
    let cancelled = false;

    setPreview({ state: 'loading', measuredTriangleCount: null, errorMessage: null });

    void openPreview(canvas, modelUrl, controller.signal).then(
      (session) => {
        if (cancelled) {
          // Panel đã đóng trong lúc model đang về: dọn ngay thay vì để một ngữ cảnh WebGL
          // sống mà không ai cầm.
          session.dispose();

          return;
        }

        sessionRef.current = session;
        setPreview({
          state: 'ready',
          measuredTriangleCount: session.measuredTriangleCount,
          errorMessage: null,
        });
      },
      (error: unknown) => {
        if (cancelled) {
          return;
        }

        setPreview({
          state: 'failed',
          measuredTriangleCount: null,
          errorMessage: describeError(toAppError(error)).description,
        });
      },
    );

    return (): void => {
      cancelled = true;
      controller.abort();
      sessionRef.current?.dispose();
      sessionRef.current = null;
      setPreview(IDLE_PREVIEW);
    };
    // `previewEpoch` không được đọc trong thân effect: nó ở đây để một lượt "thử lại" trên
    // cùng model vẫn chạy lại toàn bộ vòng dọn-rồi-nạp ở trên.
  }, [canvas, modelUrl, openPreview, previewEpoch]);

  const previewModel = useMemo(
    (): ModelPreviewModel => ({
      state: preview.state,
      measuredTriangleCountLabel:
        preview.measuredTriangleCount === null
          ? null
          : formatNumber(preview.measuredTriangleCount),
      errorMessage: preview.errorMessage,
      autoSpinNote: gateway.capabilities.canAutoSpin ? null : MODEL_LIBRARY_TEXT.autoSpinNote,
    }),
    [preview, gateway.capabilities.canAutoSpin],
  );

  const detail = useMemo((): ModelLibraryDetailModel | null => {
    if (openItem === null) {
      return null;
    }

    const row = buildRow(openItem, deviceProfile);

    return { item: row, fields: buildFields(row), preview: previewModel };
  }, [openItem, deviceProfile, previewModel]);

  /* ---- Bảy trạng thái --------------------------------------------------- */

  /**
   * Chỉ lượt đọc DANH MỤC mới đưa màn vào trạng thái 4.
   *
   * Một lượt đọc chi tiết hỏng không được biến cả màn thành lỗi: bảng vẫn đúng, và
   * {@link openItem} lùi về bản sao của mục ấy trong danh sách, nên panel vẫn mở với cùng
   * bốn dòng thông tin. Câu tiếng Việt lấy từ `toAppError` chứ không tự chế.
   */
  const errorMessage = useMemo(
    (): string | null =>
      listQuery.error === null ? null : describeError(toAppError(listQuery.error)).description,
    [listQuery.error],
  );

  const isLibraryEmpty = !listQuery.isPending && errorMessage === null && items.length === 0;

  const state = useMemo((): SevenState => {
    if (!gateway.capabilities.canManage) {
      return 'forbidden';
    }
    if (listQuery.isPending) {
      return 'loading';
    }
    if (errorMessage !== null) {
      return 'error';
    }
    if (isNarrow) {
      return 'collapsed';
    }
    if (isLibraryEmpty) {
      return 'empty';
    }

    return hasBrokenPreview ? 'partial' : 'success';
  }, [
    gateway.capabilities.canManage,
    listQuery.isPending,
    errorMessage,
    isNarrow,
    isLibraryEmpty,
    hasBrokenPreview,
  ]);

  /* ---- Việc làm được ---------------------------------------------------- */

  const openDetail = useCallback((modelId: string): void => {
    setOpenModelId(modelId);
    setPreviewEpoch((epoch) => epoch + 1);
  }, []);

  const closeDetail = useCallback((): void => {
    // Dọn THẲNG TAY, không đợi phần dọn của effect: hợp đồng nói đóng panel là dọn cảnh
    // ngay tại đây (R-05). `dispose()` an toàn khi gọi hai lần, nên phần dọn của effect
    // chạy sau đó không làm gì thêm.
    sessionRef.current?.dispose();
    sessionRef.current = null;
    setOpenModelId(null);
  }, []);

  const actions = useMemo(
    (): ModelLibraryActions => ({
      setSearchText,
      setFilter: setFilterId,
      setViewMode,
      sortBy: (key): void => {
        setSort((previous) =>
          previous.key === key
            ? { key, direction: previous.direction === 'asc' ? 'desc' : 'asc' }
            : { key, direction: 'asc' },
        );
      },
      openDetail,
      closeDetail,
      attachPreviewCanvas: setCanvas,
      retryPreviewImage: (modelId): void => {
        // Ảnh xem trước đến từ chính `LibraryItem.previewUrl`, nên "thử lại" là đọc lại
        // mục ấy và cả danh mục — không có đường tải ảnh riêng nào để gọi lại.
        void queryClient.invalidateQueries({ queryKey: modelLibraryDetailKey(modelId) });
        void queryClient.invalidateQueries({ queryKey: modelLibraryListKey() });
      },
      retryLoad: (): void => {
        void queryClient.invalidateQueries({ queryKey: modelLibraryListKey() });
      },
    }),
    [closeDetail, openDetail, queryClient],
  );

  const model = useMemo(
    (): ModelLibraryModel => ({
      state,
      capabilities: gateway.capabilities,
      rows,
      summary,
      viewMode,
      sortKey: sort.key,
      sortDirection: sort.direction,
      searchText,
      filterId,
      filterOptions,
      detail,
      isNarrow,
      errorMessage,
      readOnlyReason: gateway.capabilities.canManage ? null : MODEL_LIBRARY_TEXT.readOnlyReason,
      isLibraryEmpty,
    }),
    [
      state,
      gateway.capabilities,
      rows,
      summary,
      viewMode,
      sort,
      searchText,
      filterId,
      filterOptions,
      detail,
      isNarrow,
      errorMessage,
      isLibraryEmpty,
    ],
  );

  return [model, actions];
}
