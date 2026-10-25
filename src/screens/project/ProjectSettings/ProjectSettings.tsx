/**
 * Màn cài đặt dự án (S-04, bản Z vòng 9 đã duyệt) — nơi một dự án được đặt tên,
 * đặt đơn vị đo, mời thành viên và, nếu thật sự cần, bị xoá. Route của nó là
 * `ROUTE_PATTERNS.projectSettings`.
 *
 * Hình dạng theo mẫu M5 Cài đặt, cùng khuôn S-05 (`AccountSettings`): **mục lục
 * trái dính** + mỗi nhóm MỘT khung `Section`. Ba câu của màn nằm ở `PageHead`:
 * làm gì (H1 động từ + đối tượng), trạng thái (chip + câu về vai + chỉ báo lưu).
 * Bước tiếp ("Quay lại Kiểm tra tầng") nằm ở thanh quy trình của dự án, ngoài màn.
 *
 * Mục D chia đôi: {@link ProjectSettingsView} nhận props và chỉ vẽ — không store,
 * không mạng, không `Date`, không một phép định dạng số nào cho
 * `local/no-raw-number` bắt được. Mọi chuỗi đã dựng xong ở `useProjectSettings`.
 *
 * ## Một nguồn cho nhóm
 *
 * Mục lục, dấu "Cần sửa" và việc có/không Vùng nguy hiểm đều sinh từ `props.tabs`
 * (hook đã bỏ nhóm nguy hiểm với vai không xoá được). `activeTab` giờ là "nhóm
 * đang xem": bấm mục lục gọi `setActiveTab` để `?tab=` vẫn đồng bộ (N4-04), và
 * lần dựng đầu cuộn tới nhóm đó.
 *
 * ## Không có nút lưu (A7)
 *
 * Sửa xong là thôi: 800 ms sau thao tác cuối, `createAutosave` tự gửi đi và
 * `SaveIndicator` ở dòng trạng thái nói ra điều đó (`role="status"`).
 *
 * ## Một chủ sở hữu lớp phủ
 *
 * Hộp xác nhận của hai việc nguy hiểm nằm ở file này chứ không ở
 * `DangerZoneTab.tsx`. Esc đóng nó qua `onClose` của `Modal.Root` (A12, R-54).
 *
 * ## Thu gọn
 *
 * Dưới 1024px mục lục trái nhường chỗ cho một ô `Select` "Nhóm cài đặt" để nhảy
 * tới nhóm; không dựng thêm component chung mới (R-68).
 */

import { useEffect, type ReactNode } from 'react';
import { AlertCircle, Building2, Ruler, Trash2, Users } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';

import { InlineAlert } from '@/components/feedback/InlineAlert';
import { BACK_TO_PROJECTS_LABEL } from '@/components/feedback/ProjectSpatialGate';
import { SaveIndicator } from '@/components/feedback/SaveIndicator';
import { Breadcrumb } from '@/components/shell/Breadcrumb';
import { PageHead } from '@/components/shell/PageHead';
import { Section } from '@/components/shell/Section';
import { Skeleton } from '@/components/feedback/Skeleton';
import { Toast, useToast } from '@/components/feedback/Toast';
import { Modal } from '@/components/overlay/Modal';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Select } from '@/components/ui/Select';
import viMessages from '@/i18n/vi.json';
import { cn } from '@/lib/utils';

import { DangerZoneTab } from './DangerZoneTab';
import { GeneralTab } from './GeneralTab';
import { MembersTab } from './MembersTab';
import { ProjectSettingsReloadDialog } from './ProjectSettingsReloadDialog';
import { UnitsTab } from './UnitsTab';
import {
  useProjectSettings,
  type ProjectSettingsTabId,
  type ProjectSettingsViewProps,
  type UseProjectSettingsOptions,
} from './useProjectSettings';

const TAB_GROUP_LABEL = 'Nhóm cài đặt';

/** Lớp vòng tiêu điểm chung cho liên kết trên nền khung. */
const FOCUS_RING =
  'focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-bg-surface';

const GROUP_ICONS: Record<ProjectSettingsTabId, LucideIcon> = {
  general: Building2,
  units: Ruler,
  members: Users,
  danger: Trash2,
};

/** Câu mô tả ở đầu khung mỗi nhóm (demo Z/S-04). */
const GROUP_DESCRIPTIONS: Record<ProjectSettingsTabId, string> = {
  general: 'Tên và mã hiện ở danh sách dự án, khung tên khi xuất',
  units: 'Áp dụng cho mọi tầng, kể cả kích thước khi xuất',
  members: 'Vai là vai toàn hệ thống, áp dụng cho mọi dự án của người đó',
  danger: 'Không hoàn tác được nên mỗi việc hỏi lại một lần',
};

/** Neo khung của một nhóm; mục lục, ô chọn thu gọn và lần cuộn đầu dùng chung. */
const groupAnchor = (id: ProjectSettingsTabId): string => `project-settings-${id}`;

interface GroupBlockProps {
  readonly id: ProjectSettingsTabId;
  readonly title: string;
  readonly children: ReactNode;
}

/** Một nhóm cài đặt trong khung `Section`; `<h2>` mang neo cho mục lục. */
function GroupBlock({ id, title, children }: GroupBlockProps) {
  const anchor = groupAnchor(id);

  return (
    <Section flush id={anchor} aria-labelledby={`${anchor}-title`} className="scroll-mt-6">
      <div className="flex min-h-14 items-center gap-3 border-b border-border-default px-5 py-4">
        <h2
          id={`${anchor}-title`}
          className={cn(
            'whitespace-nowrap text-heading',
            id === 'danger' ? 'text-state-violation-text' : 'text-text-primary',
          )}
        >
          {title}
        </h2>
        <p className="ml-auto hidden truncate text-[13px] text-text-secondary xl:block">{GROUP_DESCRIPTIONS[id]}</p>
      </div>
      <div className="px-5 py-4">{children}</div>
    </Section>
  );
}

type GroupModel = ProjectSettingsViewProps['tabs'][number];

/** Mục lục trái: một khung dính; Vùng nguy hiểm tách sau một vạch. */
function SettingsToc(props: ProjectSettingsViewProps) {
  const renderEntry = (tab: GroupModel) => {
    const Icon = GROUP_ICONS[tab.id];
    const isCurrent = tab.id === props.activeTab;

    return (
      <a
        key={tab.id}
        href={`#${groupAnchor(tab.id)}`}
        aria-current={isCurrent ? 'true' : undefined}
        onClick={() => props.setActiveTab(tab.id)}
        className={cn(
          'flex h-10 items-center gap-2 rounded-md px-3 text-[14px] hover:bg-bg-hover',
          tab.id === 'danger' ? 'text-state-violation-text' : 'text-text-primary',
          isCurrent && 'bg-bg-hover',
          FOCUS_RING,
        )}
      >
        <Icon aria-hidden="true" className="h-4 w-4 shrink-0" />
        {tab.label}
        {tab.problemCount > 0 ? (
          <span className="ml-auto inline-flex items-center gap-1 text-[12px] text-state-violation-text">
            <AlertCircle aria-hidden="true" className="h-3.5 w-3.5" />
            Cần sửa
          </span>
        ) : tab.id === 'members' ? (
          <span className="ml-auto hidden text-[12px] text-text-secondary xl:inline">{props.memberCountLabel}</span>
        ) : null}
      </a>
    );
  };
  const groups = props.tabs.filter((tab) => tab.id !== 'danger');
  const danger = props.tabs.find((tab) => tab.id === 'danger');

  return (
    <nav aria-label="Mục trong trang" className="sticky top-6 flex flex-col rounded-xl bg-bg-surface p-2 shadow-panel">
      {groups.map(renderEntry)}
      {danger === undefined ? null : (
        <>
          <hr className="mx-1 my-2 border-0 border-t border-border-default" />
          {renderEntry(danger)}
        </>
      )}
    </nav>
  );
}

/** Câu thứ hai của dòng trạng thái: vai này làm được gì ở đây. */
function roleSentence(props: ProjectSettingsViewProps): string {
  if (props.isReadOnly) return viMessages.project.settings.readOnlyNotice;
  return props.canDelete
    ? 'Vai Quản trị: sửa được mọi mục, kể cả xoá dự án.'
    : 'Sửa được thông tin, đơn vị đo và thành viên. Chỉ quản trị viên xoá được tầng hoặc dự án.';
}

/** Cuộn tới khung một nhóm (jsdom không có `scrollIntoView`). */
function scrollToGroup(id: ProjectSettingsTabId): void {
  const target = document.getElementById(groupAnchor(id));
  if (target !== null && typeof target.scrollIntoView === 'function') target.scrollIntoView({ block: 'start' });
}

/** Màn cài đặt như một hàm của props — test và story dựng thẳng cái này. */
export function ProjectSettingsView(props: ProjectSettingsViewProps) {
  const { state } = props;
  const isCollapsed = state === 'collapsed';
  const showForm = state !== 'error' && state !== 'loading';
  // 404 thì thử lại vô ích — lối ra là danh sách dự án; lỗi khác chỉ có "Thử lại" khi thử lại được.
  const loadErrorAction =
    props.isProjectMissing && props.backToProjects !== null
      ? { label: BACK_TO_PROJECTS_LABEL, onClick: props.backToProjects, variant: 'secondary' as const }
      : props.canRetryLoad
        ? { label: 'Thử lại', onClick: props.retryLoad, variant: 'secondary' as const }
        : null;
  const selectTab = (value: string): void => {
    props.setActiveTab(value as ProjectSettingsTabId);
    scrollToGroup(value as ProjectSettingsTabId);
  };
  const titleOf = (id: ProjectSettingsTabId): string => props.tabs.find((tab) => tab.id === id)?.label ?? '';
  const hasDanger = props.tabs.some((tab) => tab.id === 'danger');

  // N4-04: `?tab=` mở đúng nhóm — mọi nhóm cùng hiện, nên "mở" là cuộn tới khung đó, một lần khi biểu mẫu hiện.
  const initialTab = props.activeTab;
  useEffect(() => {
    if (showForm && initialTab !== 'general') scrollToGroup(initialTab);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- chỉ cuộn lần đầu biểu mẫu hiện, không đuổi theo mỗi cú bấm mục lục.
  }, [showForm]);

  return (
    <div className="min-h-screen bg-bg-app">
      <div className="mx-auto w-full max-w-[1344px] px-8 pb-12 pt-6">
        {/* N0-05: Dự án › <tên dự án> › Cài đặt dự án. */}
        <div className="mb-4">
          <Breadcrumb
            items={[
              {
                id: 'projects',
                label: 'Dự án',
                ...(props.backToProjects !== null ? { onClick: props.backToProjects } : {}),
              },
              ...(props.projectTitle.length > 0 ? [{ id: 'project', label: props.projectTitle }] : []),
              { id: 'current', label: viMessages.project.settings.title },
            ]}
          />
        </div>
        <PageHead
          eyebrow={props.projectTitle.length > 0 ? `Dự án ${props.projectTitle} · Cài đặt` : 'Cài đặt dự án'}
          title="Đặt thông tin, đơn vị đo và thành viên của dự án"
          status={
            // Lỗi tải thì chưa có gì để lưu: không chip, không chỉ báo (BUG-078).
            showForm ? (
              <>
                {props.isReadOnly ? (
                  <Badge variant="neutral">Chỉ xem</Badge>
                ) : (
                  <Badge variant="verified">Tự lưu khi bạn sửa</Badge>
                )}
                <span>{roleSentence(props)}</span>
                {/* Một nguồn: chỉ báo lưu tự nói "chưa lưu vì còn ô cần sửa" khi hook từ chối lượt lưu. */}
                {props.isReadOnly ? null : <SaveIndicator saveState={props.saveState} label={props.saveLabel} />}
              </>
            ) : null
          }
        />

        <div className="flex flex-col gap-4">
          {props.conflictMessage !== null && (
            <InlineAlert
              level="attention"
              title="Cài đặt đã đổi ở nơi khác"
              message={props.conflictMessage}
              action={{ label: 'Tải lại', onClick: props.reloadSettings, variant: 'secondary' }}
            />
          )}

          {props.saveFailureMessage !== null && (
            <InlineAlert level="attention" title="Chưa lưu hết" message={props.saveFailureMessage} />
          )}

          {state === 'error' ? (
            <InlineAlert
              level="violation"
              title="Không tải được cài đặt dự án"
              message={props.errorMessage ?? ''}
              {...(loadErrorAction !== null ? { action: loadErrorAction } : {})}
            />
          ) : state === 'loading' ? (
            <Skeleton preset="property-panel" />
          ) : (
            <div
              className={cn(
                'grid items-start gap-5',
                isCollapsed
                  ? 'grid-cols-1'
                  : 'grid-cols-[200px_minmax(0,1fr)] xl:grid-cols-[240px_minmax(0,1fr)] xl:gap-6',
              )}
            >
              {isCollapsed ? (
                <Select
                  label={TAB_GROUP_LABEL}
                  options={props.tabs.map((tab) => ({ value: tab.id, label: tab.label }))}
                  value={props.activeTab}
                  onChange={selectTab}
                />
              ) : (
                <SettingsToc {...props} />
              )}

              <div className="flex min-w-0 flex-col gap-4">
                <GroupBlock id="general" title={titleOf('general')}>
                  <GeneralTab {...props} />
                </GroupBlock>
                <GroupBlock id="units" title={titleOf('units')}>
                  <UnitsTab {...props} />
                </GroupBlock>
                <GroupBlock id="members" title={titleOf('members')}>
                  <MembersTab {...props} />
                </GroupBlock>
                {/* Vai không xoá được gì: khung và mục lục ẩn hẳn (hook đã bỏ nhóm này khỏi `tabs`). */}
                {hasDanger ? (
                  <GroupBlock id="danger" title={titleOf('danger')}>
                    <DangerZoneTab {...props} />
                  </GroupBlock>
                ) : null}
              </div>
            </div>
          )}
        </div>
      </div>

      <ProjectSettingsReloadDialog
        isOpen={props.isReloadDialogOpen}
        onConfirm={props.confirmReload}
        onCancel={props.cancelReload}
      />

      {/* A9: hai việc A8 không phủ được, nên đây là chỗ duy nhất được hỏi trước. */}
      <Modal.Root isOpen={props.pendingDanger !== null} onClose={props.cancelDanger} width={480}>
        <Modal.Header>{props.dangerDialogTitle}</Modal.Header>
        <Modal.Body>
          <div className="flex flex-col gap-3">
            <p className="text-[14px] text-text-primary">{props.dangerDialogMessage}</p>
            {props.dangerDialogError !== null && (
              <InlineAlert level="violation" message={props.dangerDialogError} />
            )}
            {props.dangerConfirmationExpected !== null && (
              <Input
                label="Gõ lại tên dự án để xác nhận"
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
 * Xuất riêng để `ProjectSettings.container.tsx` gắn nó dưới `Toast.Provider` của
 * chính nó. Cố ý KHÔNG gọi `useNavigate` ở đây: router nằm ở `ProjectSettingsRoute`.
 */
export function ProjectSettingsConnected(options: ProjectSettingsProps) {
  const { addToast } = useToast();
  const props = useProjectSettings({ ...options, onToast: addToast });

  return <ProjectSettingsView {...props} />;
}

/**
 * `ProjectSettings` đứng một mình — tự mang `Toast.Provider`.
 *
 * Dành cho story, test và bảng chọn demo; route thật là `ProjectSettingsRoute`.
 */
export function ProjectSettings(options: ProjectSettingsProps) {
  return (
    <Toast.Provider>
      <ProjectSettingsConnected {...options} />
    </Toast.Provider>
  );
}
