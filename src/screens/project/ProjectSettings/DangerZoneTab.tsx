/**
 * Thẻ "vùng nguy hiểm": đúng hai việc, mỗi việc đúng một câu hậu quả.
 *
 * Hai việc này là hai thứ duy nhất trên màn mà A8 không phủ được — xoá rồi thì
 * không có đường hoàn tác — nên chúng là hai chỗ duy nhất được phép chặn bằng
 * hộp thoại (A9). Hộp thoại đó KHÔNG nằm ở đây mà ở `ProjectSettings.tsx`: mỗi
 * màn chỉ nên có một chủ sở hữu lớp phủ.
 *
 * "Đặt lại kết quả AI" từng nằm trong danh sách và đã bị bỏ khỏi lượt này: không
 * có endpoint nào chạy lại chuỗi xử lý cho một dự án (`src/api/endpoints.ts` chỉ
 * có nhóm `drawings` cho một lượt tải lên mới). Mã đề xuất cho lượt dữ liệu là
 * **T-02**.
 *
 * `Button variant="danger"` là nền `bg-danger-tint`, không phải khối đỏ đặc:
 * ba màu trạng thái của A4 dành cho trạng thái của bản vẽ, không dành cho nút.
 */

import { AlertTriangle } from 'lucide-react';

import { EmptyState } from '@/components/feedback/EmptyState';
import { Button } from '@/components/ui/Button';

import type { ProjectSettingsViewProps } from './useProjectSettings';

export type DangerZoneTabProps = Pick<
  ProjectSettingsViewProps,
  | 'floorCount'
  | 'deleteAllFloorsLabel'
  | 'deleteProjectLabel'
  | 'canDelete'
  | 'isDangerRunning'
  | 'pendingDanger'
  | 'requestDeleteAllFloors'
  | 'requestDeleteProject'
>;

export function DangerZoneTab(props: DangerZoneTabProps) {
  const { canDelete, isDangerRunning, pendingDanger } = props;
  const hasFloors = props.floorCount > 0;

  // Vai không xoá được gì thì không dựng nút nào cả, chỉ nói ra vì sao. Một nút
  // "Xoá dự án" bày ra rồi khoá lại là lời hứa rút lại ngay lúc vừa nói.
  // `useProjectSettings` cũng đã bỏ luôn thẻ này khỏi dải thẻ; đây là lớp chặn
  // thứ hai, cho mọi nơi gọi dựng thẳng thẻ bằng props.
  if (!canDelete) {
    return (
      <p className="text-[13px] text-text-secondary">
        Vai hiện tại không xoá được gì ở đây. Liên hệ quản trị dự án nếu cần.
      </p>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      {hasFloors ? (
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-border-default p-4">
          <div className="flex min-w-0 flex-col gap-1">
            <span className="text-[14px] font-medium text-text-primary">xoá mọi tầng</span>
            <p className="text-[13px] text-text-secondary">{props.deleteAllFloorsLabel}</p>
          </div>
          <Button
            variant="danger"
            onClick={props.requestDeleteAllFloors}
            disabled={isDangerRunning}
            loading={isDangerRunning && pendingDanger === 'deleteAllFloors'}
          >
            Xoá mọi tầng
          </Button>
        </div>
      ) : (
        <EmptyState
          icon={<AlertTriangle aria-hidden="true" />}
          title="Chưa có tầng nào"
          description="Dự án chưa có tầng nào, nên ở đây chưa có gì để xoá ngoài chính dự án."
        />
      )}

      <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-border-default p-4">
        <div className="flex min-w-0 flex-col gap-1">
          <span className="text-[14px] font-medium text-text-primary">xoá dự án</span>
          <p className="text-[13px] text-text-secondary">{props.deleteProjectLabel}</p>
        </div>
        <Button
          variant="danger"
          onClick={props.requestDeleteProject}
          disabled={isDangerRunning}
          loading={isDangerRunning && pendingDanger === 'deleteProject'}
        >
          Xoá dự án
        </Button>
      </div>
    </div>
  );
}
