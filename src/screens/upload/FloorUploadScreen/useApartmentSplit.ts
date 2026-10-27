/**
 * K19 — "các tầng của một nhà, hay các căn hộ riêng?".
 *
 * Thả từ hai bản vẽ trở lên: màn luôn hỏi một câu trước khi gán.
 * "Các tầng của một nhà" đi đúng đường cũ (`acceptAsFloors`). "Các căn hộ riêng" tạo một
 * dự án nháp một tầng cho mỗi tệp (`createApartmentProject`, cùng `projects.create` của hộp
 * thoại tạo dự án) rồi tải tệp vào đó bằng chính `createUpload` của màn, và liệt kê các dự án
 * vừa tạo kèm nút mở.
 *
 * Tên tệp đều đọc ra tầng ("mat-bang-tang-2.png"…) vẫn hỏi: tên chỉ gợi ý, không chắc là
 * một nhà — câu chi tiết nói thêm điều tên tệp gợi ý.
 *
 * PDF nhiều trang ở nhánh căn riêng lấy trang 1 và hàng nói rõ điều đó.
 */

import { useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';

import { formatNumber } from '@/lib/format/number';
import { applyInvalidation } from '@/lib/query/invalidation';
import type { UploadRejection } from '@/lib/upload';
import { ROUTES } from '@/routes/paths';
import type { ViewStatusCode } from '@/lib/viewmodel/types';

import type { FloorUploadGateway } from './floorUploadGateway';
import type { FloorUploadActions, FloorUploadApartmentsModel, FloorUploadSplitPromptModel } from './types';

export const SPLIT_COPY = {
  question: 'Các bản vẽ này là các tầng của cùng một nhà, hay là các căn hộ riêng?',
  floors: 'Các tầng của một nhà',
  apartments: 'Các căn hộ riêng',
  title: 'Dự án vừa tạo',
  open: 'Mở dự án',
  dismiss: 'Ẩn danh sách',
  cancelled: 'Lượt tải đã dừng. Mở dự án để tải lại bản vẽ.',
  namesLookLikeFloors: 'Tên tệp gợi ý đây là các tầng, hãy chọn cho đúng.',
  pdfFirstPage: 'PDF nhiều trang: căn hộ riêng lấy trang 1.',
} as const;

type ApartmentStatus = 'creating' | 'uploading' | 'done' | 'error';

const STATUS: Readonly<Record<ApartmentStatus, { readonly label: string; readonly variant: ViewStatusCode }>> = {
  creating: { label: 'Đang tạo dự án', variant: 'neutral' },
  uploading: { label: 'Đang tải bản vẽ', variant: 'neutral' },
  // A5: xanh "đã xác minh" chỉ dành cho việc người duyệt — tải xong vẫn là trung tính.
  done: { label: 'Đã tải bản vẽ', variant: 'neutral' },
  error: { label: 'Chưa xong', variant: 'violation' },
};

interface ApartmentRow {
  readonly id: string;
  readonly file: File;
  readonly projectName: string;
  readonly status: ApartmentStatus;
  readonly problem: string | null;
  /** Câu báo không phải lỗi (PDF nhiều trang lấy trang 1). */
  readonly note: string | null;
  readonly projectId: string | null;
}

export interface UseApartmentSplitOptions {
  readonly gateway: FloorUploadGateway;
  /** Hỏi hay không. Tắt thì mọi lượt thả đi thẳng `acceptAsFloors`. */
  readonly enabled: boolean;
  /** Đường cũ: gán các tệp vào tầng của dự án này. */
  readonly acceptAsFloors: (files: readonly File[]) => void;
  /** Câu cho một tệp bị từ chối — cùng câu thẻ tầng dùng. */
  readonly describeRejection: (reason: UploadRejection) => string;
  readonly onNavigate?: ((path: string) => void) | undefined;
}

export interface ApartmentSplit {
  /** Thay cho `acceptFiles` ở vùng thả và hộp chọn tệp. */
  readonly offer: (files: readonly File[]) => void;
  readonly splitPrompt: FloorUploadSplitPromptModel | null;
  readonly apartments: FloorUploadApartmentsModel | null;
  readonly actions: Pick<
    FloorUploadActions,
    'onSplitAsFloors' | 'onSplitAsApartments' | 'onOpenApartment' | 'onDismissApartments'
  >;
}

function projectNameOf(fileName: string): string {
  const bare = fileName.replace(/\.[^.]+$/u, '').trim();

  return bare === '' ? fileName : bare;
}

const count = (value: number): string => formatNumber(value, { grouping: false });

const isPdf = (file: File): boolean => file.type === 'application/pdf' || /\.pdf$/iu.test(file.name);

/** Câu chi tiết dưới câu hỏi: số bản vẽ, gợi ý từ tên tệp, và trang PDF. */
function promptDetail(files: readonly File[], namesLookLikeFloors: boolean): string {
  return [
    `Bạn vừa chọn ${count(files.length)} bản vẽ. Căn hộ riêng thì mỗi bản vẽ thành một dự án mới.`,
    namesLookLikeFloors ? SPLIT_COPY.namesLookLikeFloors : null,
    files.some(isPdf) ? SPLIT_COPY.pdfFirstPage : null,
  ]
    .filter((part): part is string => part !== null)
    .join(' ');
}

/** Hàng nói rõ trang đã lấy khi PDF có nhiều trang. */
export function firstPageNote(pageCount: number): string {
  return `Đã lấy trang 1 trong ${count(pageCount)} trang. Cần trang khác thì mở dự án và tải lại.`;
}

export function useApartmentSplit(options: UseApartmentSplitOptions): ApartmentSplit {
  const { gateway } = options;
  const queryClient = useQueryClient();
  const [pending, setPending] = useState<readonly File[] | null>(null);
  const [rows, setRows] = useState<readonly ApartmentRow[]>([]);

  const patch = (id: string, next: Partial<ApartmentRow>): void => {
    setRows((previous) => previous.map((row) => (row.id === id ? { ...row, ...next } : row)));
  };

  const fail = (id: string, problem: string): void => {
    patch(id, { status: 'error', problem });
  };

  const run = async (row: ApartmentRow): Promise<void> => {
    const check = await gateway.validateFile(row.file);

    // Tệp hỏng không được thành một dự án rỗng.
    if (!check.ok) {
      fail(row.id, options.describeRejection(check.reason));
      return;
    }

    const created = await gateway.createApartmentProject({ name: row.projectName });

    if (!created.ok) {
      fail(row.id, gateway.describeApiFailure(created.error).sentence);
      return;
    }

    applyInvalidation(queryClient, 'createProject', {});
    const { floorId, projectId } = created.data;

    const isMultiPage = (check.pageCount ?? 0) > 1;

    patch(row.id, {
      status: 'uploading',
      projectId,
      note: isMultiPage ? firstPageNote(check.pageCount ?? 0) : null,
    });

    // ponytail: PDF nhiều trang lấy trang 1 (hàng nói rõ); chọn trang ngay tại đây khi người dùng cần.
    const task = gateway.createUpload({
      file: row.file,
      floorId,
      projectId,
      onProgress: () => undefined,
      ...(isMultiPage ? { pageIndex: 0 } : {}),
    });
    const final = await task.start();

    if (final.status === 'done') {
      patch(row.id, { status: 'done' });
      return;
    }

    fail(row.id, final.failure === null ? SPLIT_COPY.cancelled : gateway.describeUploadFailure(final.failure).sentence);
  };

  const offer = (files: readonly File[]): void => {
    if (!options.enabled || files.length < 2) {
      options.acceptAsFloors(files);
      return;
    }

    setPending((previous) => [...(previous ?? []), ...files]);
  };

  const splitAsApartments = (): void => {
    if (pending === null) return;

    const next = pending.map<ApartmentRow>((file) => ({
      id: gateway.createFileId(),
      file,
      projectName: projectNameOf(file.name),
      status: 'creating',
      problem: null,
      note: null,
      projectId: null,
    }));

    setPending(null);
    setRows((previous) => [...previous, ...next]);

    for (const row of next) {
      run(row).catch((error: unknown) => {
        fail(row.id, gateway.describeApiFailure(error).sentence);
      });
    }
  };

  const doneCount = rows.filter((row) => row.status === 'done').length;

  return {
    offer,
    splitPrompt:
      pending === null
        ? null
        : {
            question: SPLIT_COPY.question,
            detail: promptDetail(
              pending,
              pending.every((file) => gateway.guessFloor(file.name).ok),
            ),
            floorsLabel: SPLIT_COPY.floors,
            apartmentsLabel: SPLIT_COPY.apartments,
          },
    apartments:
      rows.length === 0
        ? null
        : {
            title: SPLIT_COPY.title,
            summary: `Đã tải xong ${count(doneCount)} / ${count(rows.length)} bản vẽ, mỗi bản vẽ một dự án.`,
            openLabel: SPLIT_COPY.open,
            dismissLabel: SPLIT_COPY.dismiss,
            rows: rows.map((row) => ({
              id: row.id,
              projectName: row.projectName,
              fileName: row.file.name,
              statusLabel: STATUS[row.status].label,
              statusVariant: STATUS[row.status].variant,
              problem: row.problem,
              note: row.note,
              canOpen: row.projectId !== null && (row.status === 'done' || row.status === 'error'),
            })),
          },
    actions: {
      onSplitAsFloors: () => {
        if (pending === null) return;
        setPending(null);
        options.acceptAsFloors(pending);
      },
      onSplitAsApartments: splitAsApartments,
      onOpenApartment: (rowId) => {
        const row = rows.find((candidate) => candidate.id === rowId);

        if (row === undefined || row.projectId === null) return;
        // Tải xong: sang màn xử lý như "Bắt đầu xử lý". Hỏng: về màn tải của chính dự án đó.
        options.onNavigate?.(
          row.status === 'done' ? ROUTES.project.pipeline(row.projectId) : ROUTES.project.upload(row.projectId),
        );
      },
      onDismissApartments: () => {
        setRows((previous) => previous.filter((row) => row.status === 'creating' || row.status === 'uploading'));
      },
    },
  };
}
