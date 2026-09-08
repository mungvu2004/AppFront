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
 * ## Vì sao có một lệnh nhập sẽ đỏ khi worker này chạy một mình
 *
 * Panel chi tiết (`ModelLibraryDetail`) thuộc phạm vi của một worker khác (L2-3), viết
 * song song trên nhánh riêng. Hợp đồng (`L2-2-brief.md` mục 2) yêu cầu nhập nó đúng tên
 * và đúng chữ ký `{ model: ModelLibraryDetailModel; actions: ModelLibraryActions }` ngay
 * từ bây giờ để lớp gộp ghép file đó vào sau — không tự viết file đó, không thay bằng
 * stub. Tới lúc bốn file của L2-2 được xác minh, `./ModelLibraryDetail` CHƯA TỒN TẠI nên
 * `pnpm typecheck` báo đúng một lỗi "Cannot find module" ở dòng nhập dưới đây; đây là kết
 * quả đã biết trước, không phải lỗi của bốn file thuộc phạm vi L2-2.
 */
import type { ReactNode } from 'react';

import { Boxes } from 'lucide-react';

import { EmptyState } from '@/components/feedback/EmptyState';
import { InlineAlert } from '@/components/feedback/InlineAlert';
import { Table } from '@/components/ui/Table';

import { ModelLibraryDetail } from './ModelLibraryDetail';
import { ModelLibrarySummary } from './ModelLibrarySummary';
import { ModelLibraryTable } from './ModelLibraryTable';
import { ModelLibraryToolbar } from './ModelLibraryToolbar';
import type { ModelLibraryProps } from './types';

const BREADCRUMB_NAV_LABEL = 'Đường dẫn trang';
const BREADCRUMB_PARENT = 'Quản trị';
const BREADCRUMB_CURRENT = 'Thư viện model';
const EMPTY_TITLE = 'chưa có model nào';
const EMPTY_DESCRIPTION = 'Thư viện chưa có model nào.';
const ERROR_TITLE = 'không tải được thư viện model';
const GENERIC_ERROR_MESSAGE = 'Đã có lỗi xảy ra.';
const LOADING_ROW_COUNT = 10;
const COLUMN_COUNT = 6;
const PREVIEW_HEADER = 'ảnh xem trước';

function ModelLibraryShell({ children }: { readonly children: ReactNode }) {
  return (
    <div className="mx-auto flex w-full max-w-[1200px] flex-col gap-4 p-6">
      <nav aria-label={BREADCRUMB_NAV_LABEL} className="text-[13px] text-text-secondary">
        <span>{BREADCRUMB_PARENT}</span>
        <span aria-hidden="true"> › </span>
        <span className="text-text-primary">{BREADCRUMB_CURRENT}</span>
      </nav>
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
        <InlineAlert level="violation" message={model.errorMessage ?? GENERIC_ERROR_MESSAGE} title={ERROR_TITLE} />
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
