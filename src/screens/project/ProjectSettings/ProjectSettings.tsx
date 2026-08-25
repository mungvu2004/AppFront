/**
 * Màn cài đặt dự án — nơi một dự án được đặt tên, đặt đơn vị đo, và, nếu thật
 * sự cần, bị xoá. Route của nó là `ROUTE_PATTERNS.projectSettings`.
 *
 * Mục D chia đôi: {@link ProjectSettingsView} nhận props và chỉ vẽ — không store,
 * không mạng, không `Date`, không một phép định dạng số nào cho
 * `local/no-raw-number` bắt được. Mọi chuỗi đã dựng xong ở `useProjectSettings`.
 *
 * ## Không có nút lưu (A7)
 *
 * Sửa xong là thôi: 800 ms sau thao tác cuối, `createAutosave` tự gửi đi và
 * `SaveIndicator` nói ra trạng thái đó — một bản ở góc phải trên, một bản nhắc
 * lại ở thanh trạng thái dưới cùng, cả hai đều là `role="status"` nên trình đọc
 * màn hình nghe được mà không phải đi tìm.
 *
 * ## Một chủ sở hữu lớp phủ
 *
 * Hộp thoại xác nhận của hai việc nguy hiểm nằm ở file này chứ không ở
 * `DangerZoneTab.tsx`. Esc đóng nó qua `onClose` của `Modal.Root` (A12, R-54) —
 * không có `addEventListener('keydown')` nào trong thư mục màn này.
 *
 * ## Thu gọn
 *
 * `Tabs` không tự biết thu gọn, nên dưới 1024px view đổi dải thẻ thành một ô
 * `Select`. Đây là quyết định xếp chỗ của riêng màn này; không dựng thêm một
 * component chung mới cho nó (R-68).
 */

import { InlineAlert } from '@/components/feedback/InlineAlert';
import { SaveIndicator } from '@/components/feedback/SaveIndicator';
import { Skeleton } from '@/components/feedback/Skeleton';
import { Toast, useToast } from '@/components/feedback/Toast';
import { Modal } from '@/components/overlay/Modal';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Select } from '@/components/ui/Select';
import { Tabs } from '@/components/ui/Tabs';
import type { SevenState } from '@/lib/testing/sevenStateScenarios';

import { DangerZoneTab } from './DangerZoneTab';
import { GeneralTab } from './GeneralTab';
import { MembersTab } from './MembersTab';
import { UnitsTab } from './UnitsTab';
import {
  useProjectSettings,
  type ProjectSettingsTabId,
  type ProjectSettingsViewProps,
  type UseProjectSettingsOptions,
} from './useProjectSettings';

/**
 * Tên tiếng Việt của bảy trạng thái, đọc lên ở thanh trạng thái.
 *
 * Bản chép riêng chứ không nhập `SEVEN_STATE_LABELS` từ
 * `@/lib/testing/sevenStateScenarios`: module đó là hạ tầng test, bị loại khỏi
 * bản dựng độ phủ và không định đi vào sản phẩm, còn dòng chữ này là thứ người
 * dùng thật sự nghe.
 */
const STATE_LABELS: Readonly<Record<SevenState, string>> = {
  empty: 'rỗng',
  loading: 'đang tải',
  partial: 'một phần',
  error: 'lỗi',
  success: 'thành công',
  forbidden: 'không có quyền',
  collapsed: 'thu gọn',
};

const TAB_GROUP_LABEL = 'nhóm cài đặt';

/** Màn cài đặt như một hàm của props — test và story dựng thẳng cái này. */
export function ProjectSettingsView(props: ProjectSettingsViewProps) {
  const { state } = props;
  const isCollapsed = state === 'collapsed';
  const selectTab = (value: string): void => props.setActiveTab(value as ProjectSettingsTabId);

  return (
    <div className="min-h-screen bg-bg-app">
      <div className="mx-auto flex max-w-[720px] flex-col gap-6 p-8">
        <header className="flex flex-wrap items-start justify-between gap-4">
          <div className="flex min-w-0 flex-col gap-1">
            <h1 className="text-[20px] font-semibold text-text-primary">cài đặt dự án</h1>
            <p className="text-[13px] text-text-secondary">
              Thông tin chung, đơn vị đo, thành viên và hai việc không hoàn tác được.
            </p>
          </div>
          <SaveIndicator saveState={props.saveState} label={props.saveLabel} />
        </header>

        {props.isReadOnly && (
          <p className="text-[13px] text-text-secondary">
            Vai hiện tại chỉ xem được cài đặt, không sửa và không xoá.
          </p>
        )}

        {props.conflictMessage !== null && (
          <InlineAlert
            level="attention"
            title="Cài đặt đã đổi ở nơi khác"
            message={props.conflictMessage}
            action={{ label: 'Tải lại', onClick: props.reloadSettings, variant: 'secondary' }}
          />
        )}

        {state === 'error' ? (
          <InlineAlert
            level="violation"
            title="Không tải được cài đặt dự án"
            message={props.errorMessage ?? ''}
            action={{ label: 'Thử lại', onClick: props.retryLoad, variant: 'secondary' }}
          />
        ) : state === 'loading' ? (
          <Skeleton preset="property-panel" />
        ) : (
          <>
            {isCollapsed && (
              <Select
                label={TAB_GROUP_LABEL}
                options={props.tabs.map((tab) => ({ value: tab.id, label: tab.label }))}
                value={props.activeTab}
                onChange={selectTab}
              />
            )}
            <Tabs.Root activeId={props.activeTab} onChange={selectTab}>
              {!isCollapsed && (
                <Tabs.List aria-label={TAB_GROUP_LABEL}>
                  {props.tabs.map((tab) => (
                    <Tabs.Tab key={tab.id} id={tab.id} badge={tab.problemCount}>
                      {tab.label}
                    </Tabs.Tab>
                  ))}
                </Tabs.List>
              )}
              <div className="pt-4">
                <Tabs.Panel id="general">
                  <GeneralTab {...props} />
                </Tabs.Panel>
                <Tabs.Panel id="units">
                  <UnitsTab {...props} />
                </Tabs.Panel>
                <Tabs.Panel id="members">
                  <MembersTab {...props} />
                </Tabs.Panel>
                <Tabs.Panel id="danger">
                  <DangerZoneTab {...props} />
                </Tabs.Panel>
              </div>
            </Tabs.Root>
          </>
        )}

        <footer className="flex flex-wrap items-center justify-between gap-3 border-t border-border-default pt-4">
          <SaveIndicator saveState={props.saveState} label={props.saveLabel} />
          <span className="text-[13px] text-text-secondary">trạng thái: {STATE_LABELS[state]}</span>
        </footer>
      </div>

      {/* A9: hai việc A8 không phủ được, nên đây là chỗ duy nhất được hỏi trước. */}
      <Modal.Root isOpen={props.pendingDanger !== null} onClose={props.cancelDanger} width={480}>
        <Modal.Header>{props.dangerDialogTitle}</Modal.Header>
        <Modal.Body>
          <div className="flex flex-col gap-3">
            <p className="text-[14px] text-text-primary">{props.dangerDialogMessage}</p>
            {props.dangerConfirmationExpected !== null && (
              <Input
                label="gõ lại tên dự án để xác nhận"
                value={props.dangerConfirmationText}
                onChange={(event) => props.setDangerConfirmationText(event.target.value)}
                hint={props.dangerConfirmationExpected}
                disabled={props.isDangerRunning}
              />
            )}
          </div>
        </Modal.Body>
        <Modal.Footer>
          <Button variant="ghost" onClick={props.cancelDanger} disabled={props.isDangerRunning}>
            Để nguyên
          </Button>
          <Button
            variant="danger"
            onClick={props.confirmDanger}
            disabled={!props.canConfirmDanger}
            loading={props.isDangerRunning}
          >
            {props.dangerConfirmLabel}
          </Button>
        </Modal.Footer>
      </Modal.Root>
    </div>
  );
}

export interface ProjectSettingsProps extends Omit<UseProjectSettingsOptions, 'onToast'> {}

/**
 * Màn cài đặt đã nối với hook và với `Toast.Provider` gần nhất.
 *
 * Xuất riêng (chứ không chỉ dùng ở dưới) để `ProjectSettings.container.tsx` gắn
 * nó dưới `Toast.Provider` của chính nó. Cố ý KHÔNG gọi `useNavigate` ở đây:
 * router nằm ở `ProjectSettingsRoute`, nhờ vậy story và test dựng được view mà
 * không cần `MemoryRouter`.
 */
export function ProjectSettingsConnected(options: ProjectSettingsProps) {
  const { addToast } = useToast();
  const props = useProjectSettings({ ...options, onToast: addToast });

  return <ProjectSettingsView {...props} />;
}

/**
 * `ProjectSettings` đứng một mình — tự mang `Toast.Provider`.
 *
 * Dành cho story, test và bảng chọn demo; route thật là `ProjectSettingsRoute`
 * (`./ProjectSettings.container`).
 */
export function ProjectSettings(options: ProjectSettingsProps) {
  return (
    <Toast.Provider>
      <ProjectSettingsConnected {...options} />
    </Toast.Provider>
  );
}
