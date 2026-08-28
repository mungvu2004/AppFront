/**
 * Toàn bộ phần suy nghĩ của màn tải bản vẽ: đọc tầng, nhận tệp, ghép tầng, tải,
 * và quyết định khi nào lượt xử lý bắt đầu được.
 *
 * Mục D chia đôi: file này giữ trạng thái và làm mọi phép quyết định; view chỉ
 * vẽ những gì `types.ts` mô tả. Mọi con số người dùng đọc — cao độ, chiều cao,
 * dung lượng, phần trăm — đã thành chuỗi ở đây (A15), nên view không còn gì để
 * làm tròn hay quy đổi.
 *
 * ## Những thứ file này NỐI LẠI chứ không dựng lại (R-61, R-64)
 *
 * - **Danh sách tầng** — `useQuery` với `queryKeys.floor.list(projectId)`. Không
 *   một ô `useState` nào cho "đang tải" hay "lỗi đọc": cả hai thuộc về tầng query.
 *   `hooks/useShareLinks.ts` tự viết hai thứ đó và được luật gọi tên là ngoại lệ
 *   đi trước, không phải khuôn mẫu.
 * - **Cao độ trần** — `ceilingElevationMm` của `src/domain/axes/alignFloors`.
 *   Không có phép cộng cao độ nào viết trong file này.
 * - **Tầng chồng lấn / trùng cao độ** — `alignFloors(plans).issues` lọc lấy
 *   `kind === 'overlap'`, và câu tiếng Việt lấy NGUYÊN VĂN `issue.message`. Hai
 *   loại `unalignable` và `clearHeight` bị bỏ qua vì màn này không có trục dò
 *   được (`axes: []`) — đúng cách `useCreateProjectModal.ts:23-26` đã lọc.
 * - **Giới hạn** — `PROJECT_LIMITS` của `src/domain/project/limits`. Không một
 *   ngưỡng cao độ hay chiều cao nào viết tay trong màn (R-71).
 * - **Cắt khúc, song song, trần dung lượng, tần suất báo tiến độ** — `src/lib/upload`
 *   qua `floorUploadGateway`. File này KHÔNG bóp tiến độ lần thứ hai và KHÔNG
 *   đếm số lượt tải song song: `createUploadTask` đã giữ cả hai.
 * - **Hoàn tác một lượt xoá** — `createUndoTicket` (`src/lib/mutations/undoTicket.ts`)
 *   qua `gateway.createRemovalTicket`, cộng `onToast` tiêm vào. KHÔNG dùng
 *   `useUndoableToast`: hook đó lái undo/redo toàn cục của zundo qua store, một
 *   cơ chế khác hẳn và không liên quan tới danh sách tệp cục bộ của màn này.
 *
 * ## Chuyển động
 *
 * Đặc tả màn xin thẻ hiện ra trong **240 ms**. Thang chuyển động của repo có
 * đúng năm giá trị (120/180/260/340/700) và `local/no-raw-duration` ở mức lỗi,
 * nên 240 không viết được. Thẻ dùng `durationMs('standard')` = 260 ms. Nhịp so
 * le 24 ms thì hợp lệ nguyên vẹn: `STAGGER_STEP_MS` của `src/lib/motion/stagger.ts`
 * đúng bằng 24, nên `staggerDelayMs(index)` cho đúng con số đặc tả xin.
 *
 * ## Bảng vô hiệu hoá bộ đệm
 *
 * `src/lib/query/invalidation.ts` **chưa có** mục nào cho tải lên / gán lại /
 * gỡ bản vẽ (`WRITE_OPERATIONS` có 8 mục, không mục nào là của màn này), và
 * `src/lib/query/**` nằm ngoài ba nơi R-68 cho phép sửa. Vì vậy lượt vô hiệu
 * hoá gọi thẳng `queryClient.invalidateQueries` với khoá dựng từ `queryKeys` —
 * mượn tên một `WriteOperation` sẵn có thì bảng sẽ nói dối về việc vừa xảy ra.
 * Thêm mục cho ba thao tác này là một lượt riêng ở tầng dữ liệu.
 */

import { useEffect, useMemo, useRef, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';

import type { Floor } from '@/api/client';
import type { SelectOption } from '@/components/ui/Select';
import { alignFloors, ceilingElevationMm } from '@/domain/axes/alignFloors';
import type { FloorPlan } from '@/domain/axes/alignFloors';
import { PROJECT_LIMITS } from '@/domain/project/limits';
import type { LevelId } from '@/domain/spatial/types';
import { millimetres, millimetresToMetres } from '@/domain/units/types';
import type { Millimetres } from '@/domain/units/types';
import { can } from '@/lib/auth/permissions';
import { formatFileSize } from '@/lib/format/bytes';
import { formatLength } from '@/lib/format/measure';
import { formatNumber, formatPercent, MISSING_VALUE } from '@/lib/format/number';
import { staggerDelayMs } from '@/lib/motion/stagger';
import { durationMs } from '@/lib/motion/tokens';
import { queryKeys } from '@/lib/query/queryKeys';
import type { SevenState } from '@/lib/testing/sevenStateScenarios';
import {
  ACCEPTED_UPLOAD_EXTENSIONS,
  MAX_PDF_PAGE_COUNT,
  MAX_UPLOAD_FILE_SIZE_BYTES,
} from '@/lib/upload';
import type { UploadBranch, UploadRejection, UploadTask, UploadTaskState } from '@/lib/upload';
import { ROUTES } from '@/routes/paths';
import type { ProjectRole } from '@/types/project';

import type { FloorUploadGateway } from './floorUploadGateway';
import type {
  FloorUploadActions,
  FloorUploadBlockNotice,
  FloorUploadBlockReason,
  FloorUploadFileModel,
  FloorUploadFooterModel,
  FloorUploadInlineError,
  FloorUploadModel,
  FloorUploadRowModel,
  FloorUploadScreenViewProps,
  FloorUploadStatus,
  FloorUploadTrayItemModel,
  FloorUploadTrayModel,
} from './types';

/* -------------------------------------------------------------------------- */
/* Chuỗi hiển thị — khoá `vi.json` đi kèm để `expectVietnamese` có từ điển.     */
/* -------------------------------------------------------------------------- */

const COPY = Object.freeze({
  dropZoneTitle: 'Kéo thả bản vẽ vào đây, hoặc chọn tệp',
  dropZoneTitleKey: 'floorUpload.dropZone.title',
  selectFile: 'Chọn tệp',
  formatsKey: 'floorUpload.dropZone.formats',
  autoMatch: 'Ghép tự động từ tên tệp — kiểm tra lại',
  trayTitle: 'Tệp chưa gán tầng',
  trayTitleKey: 'floorUpload.unassignedTray',
  empty: 'Chưa có tầng nào có bản vẽ. Kéo thả tệp đầu tiên để bắt đầu.',
  emptyKey: 'floorUpload.emptyState',
  offline: 'Đang làm việc ngoại tuyến',
  offlineKey: 'floorUpload.offlineBanner',
  readOnly: 'Vai hiện tại chỉ được xem danh sách tệp, không tải lên và không sửa.',
  readOnlyKey: 'floorUpload.readOnlyNotice',
  counterKey: 'floorUpload.footer.counter',
  submit: 'Bắt đầu xử lý',
  submitKey: 'floorUpload.footer.submit',
  blockedTitle: 'Không thể bắt đầu xử lý',
  blockedTitleKey: 'floorUpload.blockedSubmit.title',
  uploadErrorTitleKey: 'errors.upload.title',
  validationErrorTitleKey: 'errors.validation.title',
});

const STATUS_LABELS: Readonly<Record<FloorUploadStatus, string>> = {
  waiting: 'chờ xử lý',
  uploading: 'đang tải lên',
  attached: 'đã gắn kèm',
  error: 'lỗi',
};

const STATUS_LABEL_KEYS: Readonly<Record<FloorUploadStatus, string>> = {
  waiting: 'floorUpload.status.waiting',
  uploading: 'floorUpload.status.uploading',
  attached: 'floorUpload.status.attached',
  error: 'floorUpload.status.error',
};

/**
 * Màu của huy hiệu, theo bốn mã trạng thái của `src/lib/viewmodel`.
 *
 * Xanh `'verified'` chỉ dành cho một tệp **người dùng tự gán** (A5). Một tệp
 * ghép tự động từ tên tệp là đầu ra của máy, nên nó nhận `'attention'` — xem
 * `statusVariantFor` bên dưới.
 */
const STATUS_VARIANTS = Object.freeze({
  waiting: 'neutral',
  uploading: 'neutral',
  attached: 'verified',
  error: 'violation',
} as const);

/* -------------------------------------------------------------------------- */
/* Lời phàn nàn — vị ngữ thuần, khuôn `useCreateProjectModal.ts:111-136`.       */
/* -------------------------------------------------------------------------- */

/** `null` khi cao độ dùng được; câu tiếng Việt khi không. */
function elevationProblemFor(elevationMm: Millimetres | null): string | null {
  if (elevationMm === null) {
    return null;
  }

  const elevationM = millimetresToMetres(elevationMm);

  if (elevationM < PROJECT_LIMITS.elevationMinM || elevationM > PROJECT_LIMITS.elevationMaxM) {
    return (
      `Cao độ vượt giới hạn cho phép (${formatNumber(PROJECT_LIMITS.elevationMinM)} ` +
      `đến ${formatNumber(PROJECT_LIMITS.elevationMaxM)} mét).`
    );
  }

  return null;
}

/** Câu cho một tệp bị từ chối. Số lấy từ chính lời từ chối, không viết tay (R-71). */
function rejectionSentence(reason: UploadRejection): string {
  switch (reason.kind) {
    case 'tooLarge':
      return (
        `Tệp nặng ${formatFileSize(reason.sizeBytes)}, vượt trần ` +
        `${formatFileSize(reason.maxSizeBytes)} của một tệp.`
      );
    case 'unsupportedFormat':
      return (
        `Định dạng ${reason.extension === '' ? 'chưa rõ' : reason.extension} chưa nhận được. ` +
        `Định dạng hỗ trợ: ${reason.acceptedExtensions.join(', ')}.`
      );
    case 'tooManyPages':
      return (
        `Tệp có ${formatNumber(reason.pageCount, { grouping: false })} trang, vượt trần ` +
        `${formatNumber(reason.maxPageCount, { grouping: false })} trang.`
      );
    case 'unreadable':
      return `Không đọc được nội dung tệp ${reason.extension === '' ? 'này' : reason.extension}.`;
  }
}

/** Lỗi kiểm tra tệp không bao giờ thử lại được: cùng một tệp sẽ bị từ chối y hệt. */
function rejectionError(reason: UploadRejection): FloorUploadInlineError {
  return {
    kind: reason.kind,
    sentence: rejectionSentence(reason),
    isRetryable: false,
    titleKey: COPY.validationErrorTitleKey,
  };
}

/* -------------------------------------------------------------------------- */
/* Tệp đang giữ trong màn.                                                     */
/* -------------------------------------------------------------------------- */

/** Một tệp người dùng vừa đưa vào, cùng mọi thứ màn biết về nó. */
interface Attachment {
  readonly id: string;
  readonly file: File;
  /** `null` nghĩa là đang nằm trong khay chưa gán tầng. */
  readonly floorId: string | null;
  readonly branch: UploadBranch | null;
  readonly pageCount: number | null;
  readonly selectedPage: string | null;
  /** Tầng do `guessFloorFromFileName` chọn, chưa ai xác nhận. */
  readonly isAutoMatched: boolean;
  readonly status: FloorUploadStatus;
  readonly percent: number;
  readonly problem: FloorUploadInlineError | null;
}

/** Trạng thái hàng suy ra từ trạng thái một lượt tải. */
function statusOfTask(taskState: UploadTaskState): FloorUploadStatus {
  switch (taskState.status) {
    case 'done':
      return 'attached';
    case 'failed':
      return 'error';
    case 'uploading':
      return 'uploading';
    case 'queued':
    case 'cancelled':
      return 'waiting';
  }
}

/* -------------------------------------------------------------------------- */
/* Cách xếp thu gọn — cùng mốc `ProjectSettings` và `ProjectDashboard` dùng.    */
/* -------------------------------------------------------------------------- */

const NARROW_VIEWPORT_QUERY = '(max-width: 1023px)';

function useNarrowViewport(): boolean {
  const [isNarrow, setNarrow] = useState(() =>
    typeof window === 'undefined' ? false : window.matchMedia(NARROW_VIEWPORT_QUERY).matches,
  );

  useEffect(() => {
    const media = window.matchMedia(NARROW_VIEWPORT_QUERY);
    setNarrow(media.matches);
    const listener = (event: MediaQueryListEvent): void => setNarrow(event.matches);
    media.addEventListener('change', listener);
    return () => media.removeEventListener('change', listener);
  }, []);

  return isNarrow;
}

/* -------------------------------------------------------------------------- */
/* Tuỳ chọn của hook.                                                          */
/* -------------------------------------------------------------------------- */

export interface FloorUploadToast {
  readonly message: string;
  readonly onUndo?: () => void;
}

export interface UseFloorUploadScreenOptions {
  readonly gateway: FloorUploadGateway;
  readonly projectId: string;
  readonly roles?: readonly ProjectRole[];
  /** Đồng hồ tiêm được (R-29) — vé hoàn tác đọc nó. */
  readonly now?: () => number;
  /** Ép cách xếp thu gọn, cho story hoặc test muốn một câu trả lời cố định. */
  readonly forceCollapsed?: boolean;
  /** Toast hoàn tác của A8. `Toast.Provider` do nơi gọi dựng, không phải hook. */
  readonly onToast?: (toast: FloorUploadToast) => void;
  /**
   * Điều hướng sau khi lượt xử lý bắt đầu.
   *
   * Hook KHÔNG gọi `useNavigate()` — nó phải test được không cần Router
   * (`renderWithProviders` không bọc Router). Container truyền `navigate` của
   * `react-router-dom` vào đây; đường dẫn đã dựng sẵn bằng hằng `ROUTES`, không
   * bao giờ là chuỗi viết thẳng (R-65).
   */
  readonly onNavigate?: (path: string) => void;
}

/** Vai mặc định khi nơi gọi không nói gì. Mảng rỗng vẫn là "không có quyền". */
const DEFAULT_ROLES: readonly ProjectRole[] = ['engineer'];

const LOAD_FAILURE_FALLBACK = 'Không tải được danh sách tầng của dự án.';

/* -------------------------------------------------------------------------- */
/* Hook.                                                                       */
/* -------------------------------------------------------------------------- */

export function useFloorUploadScreen(
  options: UseFloorUploadScreenOptions,
): FloorUploadScreenViewProps {
  const { gateway, projectId } = options;
  const roles = options.roles ?? DEFAULT_ROLES;
  const queryClient = useQueryClient();

  const [attachments, setAttachments] = useState<readonly Attachment[]>([]);
  const [dragDepth, setDragDepth] = useState(0);
  const [isOnline, setOnline] = useState(true);
  const [blockNotice, setBlockNotice] = useState<FloorUploadBlockNotice | null>(null);
  const [scrollToken, setScrollToken] = useState(0);
  const [isSubmitting, setSubmitting] = useState(false);

  const tasksRef = useRef(new Map<string, UploadTask>());
  const onlineRef = useRef(true);

  const detectedNarrow = useNarrowViewport();
  const isCollapsed = options.forceCollapsed ?? detectedNarrow;
  const canEdit = can('upload', 'floor', { roles });

  /* ---------------------------------------------------------------------- */
  /* Danh sách tầng (R-64).                                                  */
  /* ---------------------------------------------------------------------- */

  const floorsQuery = useQuery({
    queryKey: queryKeys.floor.list(projectId),
    queryFn: async (): Promise<readonly Floor[]> => {
      const result = await gateway.readFloors({ projectId });

      if (!result.ok) {
        throw new Error(gateway.describeApiFailure(result.error).sentence);
      }

      return result.data;
    },
  });

  const floors = useMemo<readonly Floor[]>(
    () => [...(floorsQuery.data ?? [])].sort((first, second) => first.order - second.order),
    [floorsQuery.data],
  );

  /* ---------------------------------------------------------------------- */
  /* Mạng — không hook nào bọc `createNetworkMonitor`, nên nối tay ở đây.     */
  /* ---------------------------------------------------------------------- */

  useEffect(() => {
    return gateway.watchNetwork((online) => {
      onlineRef.current = online;
      setOnline(online);
    });
  }, [gateway]);

  /* ---------------------------------------------------------------------- */
  /* Cao độ — chồng tầng qua `ceilingElevationMm`, không cộng tay (M-11).     */
  /* ---------------------------------------------------------------------- */

  const stack = useMemo(() => {
    const plans: FloorPlan[] = [];
    const floorIdByLevel = new Map<LevelId, string>();
    const elevationByFloor = new Map<string, Millimetres | null>();
    const ceilingByFloor = new Map<string, Millimetres | null>();

    for (const floor of floors) {
      const hasElevation = Number.isFinite(floor.elevationMm);
      const hasHeight = Number.isFinite(floor.heightMm) && floor.heightMm > 0;
      const elevationMm = hasElevation ? millimetres(floor.elevationMm) : null;

      elevationByFloor.set(floor.id, elevationMm);

      if (elevationMm === null || !hasHeight) {
        ceilingByFloor.set(floor.id, null);
        continue;
      }

      const levelId: LevelId = `L-${floor.id}`;
      const plan: FloorPlan = {
        levelId,
        name: floor.name,
        floorElevationMm: elevationMm,
        clearHeightMm: millimetres(floor.heightMm),
        axes: [],
      };

      plans.push(plan);
      floorIdByLevel.set(levelId, floor.id);
      // Trần của một tầng là chỗ tầng trên đứng lên. Đây là HÀM DUY NHẤT được
      // phép suy ra nó; cộng `elevationMm + heightMm` tại chỗ là điều R-61 cấm.
      ceilingByFloor.set(floor.id, ceilingElevationMm(plan));
    }

    // `alignFloors` chỉ được gọi khi có ít nhất hai tầng: một tầng đơn không
    // chồng lấn được với ai. Ba loại issue còn lại (`alignment`, `unalignable`,
    // `clearHeight`) bị bỏ qua vì màn này không có trục dò được — đúng cách
    // `useCreateProjectModal.ts` lọc.
    const overlaps =
      plans.length < 2
        ? []
        : alignFloors(plans).issues.filter((issue) => issue.kind === 'overlap');

    return { ceilingByFloor, elevationByFloor, floorIdByLevel, overlaps };
  }, [floors]);

  /* ---------------------------------------------------------------------- */
  /* Ghép tệp với tầng.                                                      */
  /* ---------------------------------------------------------------------- */

  // Mức tầng đọc từ CHÍNH tên tầng bằng đúng hàm đọc tên tệp, nên hai phía nói
  // cùng một ngôn ngữ: `"mat-bang-tang-2.pdf"` và `"Tầng 2"` cùng cho mức 2.
  const levelByFloorId = useMemo(() => {
    const levels = new Map<string, number>();

    for (const floor of floors) {
      const guess = gateway.guessFloor(floor.name);

      if (guess.ok) {
        levels.set(floor.id, guess.level);
      }
    }

    return levels;
  }, [floors, gateway]);

  const attachmentByFloor = useMemo(() => {
    const byFloor = new Map<string, Attachment>();

    for (const attachment of attachments) {
      if (attachment.floorId !== null && !byFloor.has(attachment.floorId)) {
        byFloor.set(attachment.floorId, attachment);
      }
    }

    return byFloor;
  }, [attachments]);

  /* ---------------------------------------------------------------------- */
  /* Vô hiệu hoá bộ đệm — xem đầu file về `invalidationMap` còn thiếu.        */
  /* ---------------------------------------------------------------------- */

  const invalidateFloor = (floorId: string): void => {
    void queryClient.invalidateQueries({ queryKey: queryKeys.drawing.byFloor(floorId) });
    void queryClient.invalidateQueries({ queryKey: queryKeys.floor.detail(floorId) });
    void queryClient.invalidateQueries({ queryKey: queryKeys.floor.list(projectId) });
  };

  /* ---------------------------------------------------------------------- */
  /* Một lượt tải.                                                           */
  /* ---------------------------------------------------------------------- */

  const patchAttachment = (id: string, patch: Partial<Attachment>): void => {
    setAttachments((previous) =>
      previous.map((attachment) => (attachment.id === id ? { ...attachment, ...patch } : attachment)),
    );
  };

  const applyTaskState = (id: string, floorId: string, taskState: UploadTaskState): void => {
    const status = statusOfTask(taskState);
    const failure = taskState.failure;
    const described = failure === null ? null : gateway.describeUploadFailure(failure);

    patchAttachment(id, {
      status,
      percent: taskState.percent,
      problem:
        described === null
          ? null
          : {
              // Lỗi truyền tải là một loại riêng của màn; `described.kind` là
              // loại của L-03 (`upload`, `network`…) và không phải cùng bảng.
              kind: 'transfer',
              sentence: described.sentence,
              isRetryable: described.isRetryable,
              titleKey: COPY.uploadErrorTitleKey,
            },
    });

    if (taskState.status === 'done') {
      invalidateFloor(floorId);
    }
  };

  const startUpload = (attachment: Attachment, floorId: string): void => {
    if (!onlineRef.current) {
      // Mất mạng: ghi ý định vào hàng đợi ngoại tuyến và để tệp ở "chờ xử lý".
      // Hàng đợi giữ dữ liệu thuần, không giữ được chính `File`.
      void gateway.enqueueOffline({
        projectId,
        floorId,
        fileName: attachment.file.name,
        sizeBytes: attachment.file.size,
      });
      patchAttachment(attachment.id, { status: 'waiting', percent: 0, problem: null });
      return;
    }

    const task = gateway.createUpload({
      file: attachment.file,
      floorId,
      projectId,
      id: attachment.id,
      onProgress: (taskState) => {
        applyTaskState(attachment.id, floorId, taskState);
      },
    });

    tasksRef.current.set(attachment.id, task);
    patchAttachment(attachment.id, { status: 'uploading', percent: 0, problem: null });

    void task.start().then((finalState) => {
      applyTaskState(attachment.id, floorId, finalState);
    });
  };

  /* ---------------------------------------------------------------------- */
  /* Nhận tệp.                                                               */
  /* ---------------------------------------------------------------------- */

  const takenFloorIds = (): ReadonlySet<string> => {
    const taken = new Set<string>();

    for (const attachment of attachments) {
      if (attachment.floorId !== null) {
        taken.add(attachment.floorId);
      }
    }

    for (const floor of floors) {
      if (floor.drawings.length > 0) {
        taken.add(floor.id);
      }
    }

    return taken;
  };

  const acceptFile = (file: File, claimed: Set<string>): void => {
    const id = gateway.createFileId();

    setAttachments((previous) => [
      ...previous,
      {
        id,
        file,
        floorId: null,
        branch: null,
        pageCount: null,
        selectedPage: null,
        isAutoMatched: false,
        status: 'waiting',
        percent: 0,
        problem: null,
      },
    ]);

    void gateway.validateFile(file).then((check) => {
      if (!check.ok) {
        patchAttachment(id, { status: 'error', problem: rejectionError(check.reason) });
        return;
      }

      const guess = gateway.guessFloor(file.name);
      const match = guess.ok
        ? (floors.find(
            (floor) => levelByFloorId.get(floor.id) === guess.level && !claimed.has(floor.id),
          ) ?? null)
        : null;

      if (match !== null) {
        claimed.add(match.id);
      }

      const next: Partial<Attachment> = {
        branch: check.branch,
        pageCount: check.pageCount ?? null,
        floorId: match?.id ?? null,
        isAutoMatched: match !== null,
        status: 'waiting',
      };

      patchAttachment(id, next);

      if (match !== null) {
        startUpload({ ...emptyAttachment(id, file), ...next }, match.id);
      }
    });
  };

  const acceptFiles = (files: readonly File[]): void => {
    if (!canEdit) {
      return;
    }

    const claimed = new Set(takenFloorIds());

    for (const file of files) {
      acceptFile(file, claimed);
    }
  };

  /* ---------------------------------------------------------------------- */
  /* Hành động trên một tệp.                                                 */
  /* ---------------------------------------------------------------------- */

  const findAttachment = (fileId: string): Attachment | null =>
    attachments.find((attachment) => attachment.id === fileId) ?? null;

  const cancelTask = (fileId: string): void => {
    tasksRef.current.get(fileId)?.cancel();
    tasksRef.current.delete(fileId);
  };

  const reassign = (fileId: string, floorId: string | null): void => {
    const attachment = findAttachment(fileId);

    if (!canEdit || attachment === null) {
      return;
    }

    cancelTask(fileId);
    patchAttachment(fileId, {
      floorId,
      // Người dùng vừa tự chọn, nên lời nhắc "ghép tự động, kiểm tra lại" hết vai.
      isAutoMatched: false,
      status: 'waiting',
      percent: 0,
      problem: null,
    });

    if (floorId !== null) {
      startUpload({ ...attachment, floorId, isAutoMatched: false }, floorId);
    }
  };

  const removeFile = (fileId: string): void => {
    const removed = findAttachment(fileId);

    if (!canEdit || removed === null) {
      return;
    }

    cancelTask(fileId);
    setAttachments((previous) => previous.filter((attachment) => attachment.id !== fileId));

    // A8 + D-05: xoá xảy ra NGAY, không hộp thoại xác nhận; đường về là một vé
    // 8 giây do chính vé giữ, nên ở đây không có bộ đếm thời gian nào.
    const ticket = gateway.createRemovalTicket({
      description: `Hoàn tác xoá bản vẽ ${removed.file.name}`,
      undo: () => {
        setAttachments((previous) =>
          previous.some((attachment) => attachment.id === removed.id)
            ? previous
            : [...previous, { ...removed, status: 'waiting', percent: 0, problem: null }],
        );
      },
      ...(options.now !== undefined ? { now: options.now } : {}),
    });

    options.onToast?.({
      message: `Đã xoá bản vẽ ${removed.file.name}`,
      onUndo: () => {
        ticket.undo();
      },
    });
  };

  /* ---------------------------------------------------------------------- */
  /* Lý do chặn và nút chính.                                                */
  /* ---------------------------------------------------------------------- */

  const blockReasons = useMemo<readonly FloorUploadBlockReason[]>(() => {
    const reasons: FloorUploadBlockReason[] = [];

    // `floor.name` đã là nhãn đầy đủ — API trả về `Tầng 2`, `Tầng hầm`, chứ
    // không trả về `2`. Mẫu câu trong `.notes/copy.md` viết `Tầng {{floorName}}`
    // với `{{floorName}}` là phần số, nên ghép thêm chữ `Tầng` vào đây là đọc
    // thành `Tầng Tầng 2 chưa có bản vẽ.`. Nhãn xuất hiện đúng một lần.
    for (const floor of floors) {
      const attachment = attachmentByFloor.get(floor.id) ?? null;
      const hasFile = attachment !== null || floor.drawings.length > 0;

      if (!hasFile) {
        reasons.push({
          floorId: floor.id,
          floorName: floor.name,
          kind: 'missingFile',
          sentence: `${floor.name} chưa có bản vẽ.`,
        });
      }

      const elevationMm = stack.elevationByFloor.get(floor.id) ?? null;
      const elevationProblem = elevationProblemFor(elevationMm);

      if (elevationMm === null || elevationProblem !== null) {
        reasons.push({
          floorId: floor.id,
          floorName: floor.name,
          kind: 'missingElevation',
          sentence: elevationProblem ?? `${floor.name} chưa nhập cao độ.`,
        });
      }

      if (attachment !== null && attachment.status === 'uploading') {
        reasons.push({
          floorId: floor.id,
          floorName: floor.name,
          kind: 'uploading',
          sentence: `${floor.name} đang tải lên bản vẽ.`,
        });
      }
    }

    for (const issue of stack.overlaps) {
      const floorId = stack.floorIdByLevel.get(issue.levelId);
      const floor = floors.find((candidate) => candidate.id === floorId) ?? null;

      if (floor === null) {
        continue;
      }

      reasons.push({
        floorId: floor.id,
        floorName: floor.name,
        kind: 'duplicateElevation',
        // Câu đã Việt hoá sẵn trong `src/domain`, nêu đúng hai tầng và số
        // milimét chồng lấn. Viết lại ở đây là tạo bản thứ hai sẽ lệch.
        sentence: issue.message,
      });
    }

    return reasons;
  }, [attachmentByFloor, floors, stack]);

  const canSubmit = canEdit && floors.length > 0 && blockReasons.length === 0;

  // Lý do cuối cùng được gỡ thì lời chặn biến mất theo, không đợi bấm lại.
  if (blockNotice !== null && blockReasons.length === 0) {
    setBlockNotice(null);
  }

  const submit = (): void => {
    if (!canEdit) {
      return;
    }

    if (!canSubmit) {
      // Nút chính KHÔNG bị vô hiệu hoá âm thầm: nó bấm được, và bấm lúc còn
      // thiếu thì nêu tên tầng cùng mã tầng để view cuộn tới đó.
      const first = blockReasons[0];

      if (first === undefined) {
        return;
      }

      const requestId = scrollToken + 1;

      setScrollToken(requestId);
      setBlockNotice({
        title: COPY.blockedTitle,
        titleKey: COPY.blockedTitleKey,
        reasons: blockReasons,
        scrollTo: { floorId: first.floorId, requestId },
      });
      return;
    }

    setSubmitting(true);
    setBlockNotice(null);
    options.onNavigate?.(ROUTES.project.pipeline(projectId));
  };

  /* ---------------------------------------------------------------------- */
  /* Mô hình.                                                                */
  /* ---------------------------------------------------------------------- */

  const reassignOptions = useMemo<readonly SelectOption[]>(
    () => floors.map((floor) => ({ value: floor.id, label: floor.name })),
    [floors],
  );

  const fileModelFor = (attachment: Attachment): FloorUploadFileModel => {
    const pageCountLabel =
      attachment.pageCount === null || attachment.pageCount <= 0
        ? null
        : `${formatNumber(attachment.pageCount, { grouping: false })} trang`;
    const sizeLabel = formatFileSize(attachment.file.size);
    const pageOptions =
      attachment.pageCount === null || attachment.pageCount <= 0
        ? []
        : Array.from({ length: Math.min(attachment.pageCount, MAX_PDF_PAGE_COUNT) }, (_unused, index) => {
            const page = formatNumber(index + 1, { grouping: false });
            return { value: page, label: `Trang ${page}` };
          });

    return {
      id: attachment.id,
      name: attachment.file.name,
      sizeLabel,
      pageCountLabel,
      isCadBranch: attachment.branch === 'cad',
      summaryLine: [attachment.file.name, sizeLabel, pageCountLabel]
        .filter((part): part is string => part !== null)
        .join(' · '),
      pageOptions,
      selectedPage: attachment.selectedPage,
    };
  };

  const statusVariantFor = (attachment: Attachment | null, status: FloorUploadStatus) =>
    status === 'attached' && attachment !== null && attachment.isAutoMatched
      ? ('attention' as const)
      : STATUS_VARIANTS[status];

  const rows = useMemo<readonly FloorUploadRowModel[]>(
    () =>
      floors.map((floor, index) => {
        const attachment = attachmentByFloor.get(floor.id) ?? null;
        const serverDrawing = floor.drawings[0] ?? null;
        const status: FloorUploadStatus =
          attachment !== null ? attachment.status : serverDrawing !== null ? 'attached' : 'waiting';
        const percent = attachment?.percent ?? (status === 'attached' ? 100 : 0);
        const elevationMm = stack.elevationByFloor.get(floor.id) ?? null;
        const ceilingMm = stack.ceilingByFloor.get(floor.id) ?? null;
        const isAutoMatched = attachment?.isAutoMatched ?? false;
        const file: FloorUploadFileModel | null =
          attachment !== null
            ? fileModelFor(attachment)
            : serverDrawing === null
              ? null
              : {
                  id: serverDrawing.id,
                  name: serverDrawing.name,
                  // `Drawing` của máy chủ không mang dung lượng; `formatFileSize`
                  // trả `MISSING_VALUE` cho `undefined`, nên cột vẫn thẳng hàng.
                  sizeLabel: formatFileSize(undefined),
                  pageCountLabel: null,
                  isCadBranch: false,
                  summaryLine: serverDrawing.name,
                  pageOptions: [],
                  selectedPage: null,
                };

        return {
          floorId: floor.id,
          name: floor.name,
          elevationLabel: elevationMm === null ? MISSING_VALUE : formatLength(elevationMm),
          ceilingElevationLabel: ceilingMm === null ? MISSING_VALUE : formatLength(ceilingMm),
          storeyHeightLabel: formatLength(floor.heightMm),
          file,
          status,
          statusVariant: statusVariantFor(attachment, status),
          statusLabel: STATUS_LABELS[status],
          statusLabelKey: STATUS_LABEL_KEYS[status],
          isAutoMatched,
          autoMatchHint: isAutoMatched ? COPY.autoMatch : null,
          percent,
          percentLabel: formatPercent(percent, { fractionDigits: 0, source: 'percent' }),
          progressAriaLabel:
            status === 'attached'
              ? `Tải xong ${file?.name ?? floor.name}`
              : `Đã tải ${formatPercent(percent, { fractionDigits: 0, source: 'percent' })} của ${file?.name ?? floor.name}`,
          error: attachment?.problem ?? null,
          reassignOptions: canEdit ? reassignOptions : [],
          canCancelUpload: canEdit && status === 'uploading',
          canRetryUpload: canEdit && attachment !== null && (attachment.problem?.isRetryable ?? false),
          canRemoveFile: canEdit && attachment !== null,
          removeLabel:
            canEdit && attachment !== null ? `Xoá bản vẽ ${attachment.file.name}` : null,
          revealDelayMs: staggerDelayMs(index),
          revealDurationMs: durationMs('standard'),
        };
      }),
    [attachmentByFloor, canEdit, floors, reassignOptions, stack],
  );

  const trayItems = useMemo<readonly FloorUploadTrayItemModel[]>(
    () =>
      attachments
        .filter((attachment) => attachment.floorId === null)
        .map((attachment) => {
          const model = fileModelFor(attachment);

          return {
            id: attachment.id,
            name: model.name,
            sizeLabel: model.sizeLabel,
            isCadBranch: model.isCadBranch,
            summaryLine: model.summaryLine,
            error: attachment.problem,
            assignOptions: canEdit ? reassignOptions : [],
            canRemoveFile: canEdit,
            removeLabel: canEdit ? `Xoá bản vẽ ${attachment.file.name}` : null,
          };
        }),
    [attachments, canEdit, reassignOptions],
  );

  const tray: FloorUploadTrayModel = {
    title: COPY.trayTitle,
    titleKey: COPY.trayTitleKey,
    items: trayItems,
    countLabel: `${formatNumber(trayItems.length, { grouping: false })} tệp`,
  };

  const doneCount = rows.filter((row) => row.status === 'attached').length;

  const footer: FloorUploadFooterModel = {
    doneCount,
    totalCount: rows.length,
    counterLabel:
      `${formatNumber(doneCount, { grouping: false })} / ` +
      `${formatNumber(rows.length, { grouping: false })} tầng đã có bản vẽ`,
    counterLabelKey: COPY.counterKey,
    submitLabel: COPY.submit,
    submitLabelKey: COPY.submitKey,
    canSubmit,
    blockReasons,
    isSubmitting,
  };

  /* ---------------------------------------------------------------------- */
  /* Bảy trạng thái (A11, R-63).                                             */
  /* ---------------------------------------------------------------------- */

  const loadFailure = floorsQuery.isError
    ? floorsQuery.error instanceof Error
      ? floorsQuery.error.message
      : LOAD_FAILURE_FALLBACK
    : null;

  const hasAnyFile = doneCount > 0 || attachments.length > 0;
  const hasUploading = rows.some((row) => row.status === 'uploading');

  const state = useMemo<SevenState>(() => {
    if (isCollapsed) return 'collapsed';
    if (!canEdit) return 'forbidden';
    if (floorsQuery.isPending) return 'loading';
    if (loadFailure !== null) return 'error';
    if (!hasAnyFile) return 'empty';
    // Lỗi của MỘT tệp không bao giờ leo lên đây: nó ở lại trong `row.error`.
    // `'error'` của cả màn chỉ dành cho lượt đọc danh sách tầng hỏng.
    if (hasUploading || doneCount < rows.length) return 'partial';
    return 'success';
  }, [
    canEdit,
    doneCount,
    floorsQuery.isPending,
    hasAnyFile,
    hasUploading,
    isCollapsed,
    loadFailure,
    rows.length,
  ]);

  const model: FloorUploadModel = {
    state,
    projectId,
    canEdit,
    isReadOnly: !canEdit,
    isCollapsed,
    isOffline: !isOnline,
    isDragActive: canEdit && dragDepth > 0,
    errorMessage: state === 'error' ? loadFailure : null,
    offlineNotice: isOnline ? null : COPY.offline,
    offlineNoticeKey: COPY.offlineKey,
    readOnlyNotice: canEdit ? null : COPY.readOnly,
    readOnlyNoticeKey: COPY.readOnlyKey,
    emptyMessage: COPY.empty,
    emptyMessageKey: COPY.emptyKey,
    dropZone: {
      title: COPY.dropZoneTitle,
      titleKey: COPY.dropZoneTitleKey,
      selectFileLabel: COPY.selectFile,
      // Cả hai con số lấy từ hằng của `src/lib/upload`; thư mục màn không chứa
      // một trần dung lượng nào viết tay.
      formatsLine:
        `Định dạng hỗ trợ: ${ACCEPTED_UPLOAD_EXTENSIONS.join(', ')}. ` +
        `Kích thước tối đa: ${formatFileSize(MAX_UPLOAD_FILE_SIZE_BYTES)}.`,
      acceptAttribute: ACCEPTED_UPLOAD_EXTENSIONS.join(','),
      isEnabled: canEdit,
    },
    floors: rows,
    tray,
    footer,
    blockNotice,
  };

  const actions: FloorUploadActions = {
    onFilesDropped: (files) => {
      setDragDepth(0);
      acceptFiles(files);
    },
    onFilesChosen: acceptFiles,
    onDragEnter: () => {
      if (canEdit) setDragDepth((depth) => depth + 1);
    },
    onDragLeave: () => {
      setDragDepth((depth) => (depth > 0 ? depth - 1 : 0));
    },
    onReassign: reassign,
    onPickPdfPage: (fileId, page) => patchAttachment(fileId, { selectedPage: page }),
    onCancelUpload: (fileId) => {
      if (canEdit) cancelTask(fileId);
    },
    onRetryUpload: (fileId) => {
      const attachment = findAttachment(fileId);

      if (!canEdit || attachment === null || attachment.floorId === null) {
        return;
      }

      startUpload(attachment, attachment.floorId);
    },
    onRemoveFile: removeFile,
    onSubmit: submit,
    // Lỗi của một tệp đóng lại một mình; không hàng nào khác đổi.
    onDismissError: (fileId) => patchAttachment(fileId, { problem: null }),
  };

  return { ...model, ...actions };
}

/** Khung một tệp vừa nhận, trước khi lượt kiểm tra trả lời. */
function emptyAttachment(id: string, file: File): Attachment {
  return {
    id,
    file,
    floorId: null,
    branch: null,
    pageCount: null,
    selectedPage: null,
    isAutoMatched: false,
    status: 'waiting',
    percent: 0,
    problem: null,
  };
}
