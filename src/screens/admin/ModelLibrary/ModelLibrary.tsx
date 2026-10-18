/**
 * S-25 — vỏ màn thư viện model dùng chung. View thuần (R-60, mục D): mọi dữ liệu qua
 * `ModelLibraryProps`, không chạm store/mạng, không nhập `three`.
 *
 * Bảy trạng thái A11 rẽ nhánh ở đây. "không có quyền" ở màn này nghĩa là CHỈ XEM, không
 * phải chặn xem — khác `VersionHistory` (nơi "forbidden" khoá cả màn): bảng vẫn vẽ đủ,
 * chỉ thêm một `InlineAlert` nói lý do. Vì vậy nhánh mặc định (không phải đang tải, rỗng
 * thật, hay lỗi) render đủ thanh công cụ + dải tóm tắt + bảng cho cả "một phần", "thành
 * công" lẫn "không có quyền"; sự khác biệt giữa ba trạng thái đó nằm trong dữ liệu
 * (`model.rows`, `model.readOnlyReason`), không phải trong nhánh JSX.
 *
 * ## Panel chi tiết đến từ một nhánh khác
 *
 * `ModelLibraryDetail` thuộc phạm vi của một worker khác (L2-3), viết song song trên nhánh
 * riêng. File này nhập nó đúng tên và đúng chữ ký
 * `{ model: ModelLibraryDetailModel; actions: ModelLibraryActions }` từ trước khi file kia
 * tồn tại — không tự viết, không thay bằng stub — nên tới lượt kiểm của L2-2 thì
 * `pnpm typecheck` báo đúng một lỗi "Cannot find module" ở dòng nhập dưới đây. Lỗi ấy đã
 * tan khi lớp gộp ghép bốn nhánh lại; nó được ghi lại ở đây để không ai đi tìm lại nguyên
 * nhân trong lịch sử.
 */
import type { ReactNode } from 'react';

import { Boxes } from 'lucide-react';

import { EmptyState } from '@/components/feedback/EmptyState';
import { InlineAlert } from '@/components/feedback/InlineAlert';
import { Table } from '@/components/ui/Table';
import { ROUTES } from '@/routes/paths';

import { ModelLibraryDetail } from './ModelLibraryDetail';
import { ModelLibrarySummary } from './ModelLibrarySummary';
import { ModelLibraryTable } from './ModelLibraryTable';
import { ModelLibraryToolbar } from './ModelLibraryToolbar';
import type { ModelLibraryProps } from './types';

const BREADCRUMB_NAV_LABEL = 'Đường dẫn trang';
const BREADCRUMB_PARENT = 'Quản trị';
const BREADCRUMB_CURRENT = 'Thư viện mẫu 3D';
const EMPTY_TITLE = 'Chưa có model nào';
const EMPTY_DESCRIPTION = 'Thư viện chưa có model nào.';
const ERROR_TITLE = 'Không tải được thư viện model';
const GENERIC_ERROR_MESSAGE = 'Đã có lỗi xảy ra.';
const RETRY_LABEL = 'Thử lại';
const LOADING_ROW_COUNT = 10;
const COLUMN_COUNT = 6;
const PREVIEW_HEADER = 'Ảnh xem trước';

function ModelLibraryShell({ children }: { readonly children: ReactNode }) {
  return (
    <div className="mx-auto flex w-full max-w-[1280px] flex-col gap-6 px-8 py-8 min-[1920px]:max-w-[1440px]">
      <nav aria-label={BREADCRUMB_NAV_LABEL} className="text-[13px] text-text-secondary">
        <a className="hover:text-text-primary hover:underline" href={ROUTES.adminUsers}>
          {BREADCRUMB_PARENT}
        </a>
        <span aria-hidden="true"> › </span>
        <span className="text-text-primary">{BREADCRUMB_CURRENT}</span>
      </nav>
      <h1 className="text-[20px] font-semibold text-text-primary">{BREADCRUMB_CURRENT}</h1>
      {children}
    </div>
  );
}

export function ModelLibrary({ actions, model }: ModelLibraryProps) {
  if (model.state === 'loading') {
    return (
      <ModelLibraryShell>
        <Table.Root>
          <Table.Header>
            <Table.Row>
              <Table.Head>
                <span className="sr-only">{PREVIEW_HEADER}</span>
              </Table.Head>
              <Table.Head>Tên</Table.Head>
              <Table.Head>Danh mục</Table.Head>
              <Table.Head>Kích thước bao</Table.Head>
              <Table.Head>Số tam giác</Table.Head>
              <Table.Head>Dung lượng</Table.Head>
            </Table.Row>
          </Table.Header>
          <Table.Body>
            <Table.Skeleton columns={COLUMN_COUNT} rows={LOADING_ROW_COUNT} />
          </Table.Body>
        </Table.Root>
      </ModelLibraryShell>
    );
  }

  if (model.isLibraryEmpty) {
    return (
      <ModelLibraryShell>
        <EmptyState description={EMPTY_DESCRIPTION} icon={<Boxes aria-hidden="true" />} title={EMPTY_TITLE} />
      </ModelLibraryShell>
    );
  }

  if (model.state === 'error') {
    return (
      <ModelLibraryShell>
        <InlineAlert
          action={{ label: RETRY_LABEL, onClick: actions.retryLoad }}
          level="violation"
          message={model.errorMessage ?? GENERIC_ERROR_MESSAGE}
          title={ERROR_TITLE}
        />
      </ModelLibraryShell>
    );
  }

  return (
    <ModelLibraryShell>
      {model.readOnlyReason !== null && <InlineAlert level="attention" message={model.readOnlyReason} />}
      <ModelLibraryToolbar actions={actions} model={model} />
      <ModelLibrarySummary summary={model.summary} />
      <ModelLibraryTable actions={actions} model={model} />
      {model.detail !== null && <ModelLibraryDetail actions={actions} model={model.detail} />}
    </ModelLibraryShell>
  );
}
