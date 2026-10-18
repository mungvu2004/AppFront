/**
 * Thêm và gỡ thành viên của một dự án — phần suy nghĩ của `MembersTab`.
 *
 * Tách khỏi `useProjectSettings` vì nó không dính gì tới bản nháp hay tự lưu:
 * mỗi việc là một lượt gọi riêng (N3, N4) và kết quả đến ngay.
 *
 * - **Thêm**: kết quả đã có thì "người này đã là thành viên", không vé. Thêm thật
 *   thì toast hoàn tác (A8) gọi N4; thông báo mời đã gửi thì không thu hồi được
 *   và toast nói rõ điều đó.
 * - **Gỡ**: hộp thoại hỏi trước (A9) rồi N4, không toast hoàn tác. Gỡ chính mình
 *   thì xong là rời màn, vì sau đó #24 trả 404.
 */

import { useEffect, useRef, useState } from 'react';
import type { QueryClient } from '@tanstack/react-query';

import type { ApiError } from '@/api/client';
import { describeError, toAppError } from '@/lib/errors';
import { createUndoTicket } from '@/lib/mutations/undoTicket';
import { applyInvalidation } from '@/lib/query/invalidation';
import { queryKeys } from '@/lib/query/queryKeys';

import type { ProjectSettingsGateway, ProjectSettingsMember, ProjectSettingsSnapshot } from './projectSettingsGateway';
import { readSettingsError } from './settingsErrors';

/** Khoá nút thêm tối thiểu khi gặp 429 (hạn mức theo giờ nên số giây của máy chủ chỉ là sàn). */
const RATE_LIMIT_LOCK_FLOOR_SECONDS = 60;
const MS_PER_SECOND = 1_000;

const SENTENCES = {
  emailRequired: 'Chưa nhập địa chỉ email.',
  alreadyMember: 'Người này đã là thành viên.',
  // N4-02: tài khoản đã được mời (chờ chấp nhận) vẫn thêm được, nên không nói "đang hoạt động".
  unavailable:
    'Không thêm được: chưa có tài khoản nào dùng email này. Quản trị viên mời người này ở Quản trị › Người dùng › Mời người dùng, rồi thêm lại ở đây.',
  badEmail: 'Địa chỉ email chưa đúng.',
  rateLimited: 'Bạn đã thêm nhiều thành viên trong giờ này; hãy thử lại sau.',
  lastEditor: 'Không gỡ được: dự án cần ít nhất một người sửa được cài đặt.',
  undoDescription: 'Hoàn tác việc thêm thành viên',
  undoFailed: 'Không gỡ lại được người vừa thêm.',
  keep: 'Để nguyên',
  close: 'Đóng',
  invitedPending: 'Đã gửi lời mời; thêm vào dự án sau khi họ chấp nhận.',
  remove: 'Gỡ',
} as const;

export interface MemberRemoveDialogModel {
  readonly title: string;
  readonly message: string;
  readonly error: string | null;
  readonly confirmLabel: string;
  readonly cancelLabel: string;
  readonly isRunning: boolean;
  /** G3-13: gỡ người quản trị duy nhất thì chặn hẳn, nút xác nhận bị ẩn. */
  readonly isBlocked: boolean;
}

export interface ProjectMembersModel {
  readonly memberEmail: string;
  readonly memberError: string | null;
  readonly isAddingMember: boolean;
  readonly isAddMemberLocked: boolean;
  /** N4-02: email vừa bị từ chối vì chưa có tài khoản, khi người dùng là quản trị hệ thống (mời được). */
  readonly inviteEmail: string | null;
  readonly isInvitingMember: boolean;
  readonly memberRemoveDialog: MemberRemoveDialogModel | null;
}

export interface ProjectMembersActions {
  readonly setMemberEmail: (value: string) => void;
  readonly addMember: () => void;
  readonly inviteMember: () => void;
  readonly requestRemoveMember: (userId: string) => void;
  readonly confirmRemoveMember: () => void;
  readonly cancelRemoveMember: () => void;
}

export interface UseProjectMembersOptions {
  readonly gateway: ProjectSettingsGateway;
  readonly projectId: string;
  readonly canEdit: boolean;
  readonly queryClient: QueryClient;
  /** Tên các thành viên hiện có, để đặt tên người trong hộp thoại và toast. */
  readonly memberNames: Readonly<Record<string, string>>;
  /** G3-13: id của quản trị viên duy nhất (nếu dự án chỉ có một), để chặn gỡ người đó. */
  readonly soleAdminId?: string | null | undefined;
  /** N4-02: quản trị hệ thống mời được email chưa có tài khoản ngay tại đây. */
  readonly canInvite?: boolean | undefined;
  readonly currentUserId?: string | undefined;
  readonly now?: (() => number) | undefined;
  readonly onToast?:
    | ((toast: { readonly message: string; readonly onUndo?: () => void; readonly state?: 'attention' | 'violation' }) => void)
    | undefined;
  readonly onSelfRemoved?: (() => void) | undefined;
}

interface RemoveTarget {
  readonly id: string;
  readonly isSoleAdmin: boolean;
  readonly name: string;
  readonly isSelf: boolean;
}

function addFailureSentence(error: ApiError): { sentence: string; lockSeconds: number | null } {
  const info = readSettingsError(error);

  if (info.status === 429 || info.code === 'RATE_LIMITED') {
    const lockSeconds = Math.max(info.retryAfterSeconds ?? 0, RATE_LIMIT_LOCK_FLOOR_SECONDS);

    return { sentence: SENTENCES.rateLimited, lockSeconds };
  }

  if (info.code === 'MEMBER_USER_UNAVAILABLE') {
    return { sentence: SENTENCES.unavailable, lockSeconds: null };
  }

  if (info.status === 422 && info.field === 'email') {
    return { sentence: SENTENCES.badEmail, lockSeconds: null };
  }

  return { sentence: describeError(toAppError(error)).description, lockSeconds: null };
}

function removeFailureSentence(error: ApiError): string {
  const info = readSettingsError(error);

  if (info.code === 'MEMBER_LAST_EDITOR') {
    return SENTENCES.lastEditor;
  }

  return describeError(toAppError(error)).description;
}

export function useProjectMembers(
  options: UseProjectMembersOptions,
): ProjectMembersModel & ProjectMembersActions {
  const { gateway, projectId, canEdit, queryClient } = options;

  const [memberEmail, setMemberEmailState] = useState('');
  const [memberError, setMemberError] = useState<string | null>(null);
  const [isAddingMember, setAddingMember] = useState(false);
  const [isAddMemberLocked, setAddMemberLocked] = useState(false);
  const [removeTarget, setRemoveTarget] = useState<RemoveTarget | null>(null);
  const [removeError, setRemoveError] = useState<string | null>(null);
  const [isRemoving, setRemoving] = useState(false);
  const [inviteEmail, setInviteEmail] = useState<string | null>(null);
  const [isInvitingMember, setInvitingMember] = useState(false);
  const lockTimerRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  useEffect(
    () => () => {
      clearTimeout(lockTimerRef.current);
    },
    [],
  );

  // G2-15: ghi ngay vào bộ đệm của màn (khoá `projectSettingsQueryKey`, viết tay để tránh vòng import)
  // để dòng mới hiện liền, không chờ lượt tải lại (~2 s trên máy thật).
  const patchMembers = (update: (members: readonly ProjectSettingsMember[]) => readonly ProjectSettingsMember[]): void => {
    queryClient.setQueryData<ProjectSettingsSnapshot>([...queryKeys.project.detail(projectId), 'settings'], (snapshot) =>
      snapshot === undefined ? snapshot : { ...snapshot, members: update(snapshot.members) },
    );
  };

  const invalidate = (operation: 'addProjectMember' | 'removeProjectMember'): void => {
    applyInvalidation(queryClient, operation, { projectId });
  };

  const lockAddButton = (seconds: number): void => {
    clearTimeout(lockTimerRef.current);
    setAddMemberLocked(true);
    lockTimerRef.current = setTimeout(() => {
      setAddMemberLocked(false);
    }, seconds * MS_PER_SECOND);
  };

  const removeMemberById = (userId: string) =>
    gateway.removeMember({ projectId, userId });

  const addMember = (): void => {
    if (!canEdit || isAddingMember || isAddMemberLocked) return;

    const email = memberEmail.trim().toLowerCase();

    if (email.length === 0) {
      setMemberError(SENTENCES.emailRequired);
      return;
    }

    // G3-12: form tắt kiểm tra của trình duyệt (bong bóng tiếng Anh), nên tự chặn ở đây.
    if (!/^[^\s@]+@[^\s@]+$/u.test(email)) {
      setMemberError(SENTENCES.badEmail);
      return;
    }

    setAddingMember(true);
    setMemberError(null);
    setInviteEmail(null);

    void gateway.addMember({ projectId, email }).then((result) => {
      setAddingMember(false);

      if (!result.ok) {
        const failure = addFailureSentence(result.error);
        setMemberError(failure.sentence);

        if (failure.sentence === SENTENCES.unavailable && options.canInvite === true) {
          setInviteEmail(email);
        }

        if (failure.lockSeconds !== null) {
          lockAddButton(failure.lockSeconds);
        }

        return;
      }

      if (result.data.alreadyMember) {
        setMemberError(SENTENCES.alreadyMember);
        return;
      }

      finishAdd(result.data.member, `Đã thêm ${result.data.member.name} vào dự án.`);
    });
  };

  const inviteMember = (): void => {
    if (!canEdit || inviteEmail === null || isInvitingMember) return;

    const email = inviteEmail;
    setInvitingMember(true);

    void gateway.inviteUser({ email }).then(async (invited) => {
      if (!invited.ok) {
        setInvitingMember(false);
        setMemberError(addFailureSentence(invited.error).sentence);
        return;
      }

      // Người đã mời (chờ chấp nhận) thêm được vào dự án ngay; máy chủ không cho thì báo chờ.
      const added = await gateway.addMember({ projectId, email });
      setInvitingMember(false);
      setInviteEmail(null);
      setMemberError(null);

      if (added.ok && !added.data.alreadyMember) {
        finishAdd(added.data.member, `Đã mời và thêm ${added.data.member.name} vào dự án (chờ họ chấp nhận lời mời).`);
        return;
      }

      setMemberEmailState('');
      options.onToast?.({ message: SENTENCES.invitedPending });
    });
  };

  function finishAdd(member: ProjectSettingsMember, message: string): void {
      setMemberEmailState('');
      patchMembers((members) => (members.some((row) => row.id === member.id) ? members : [...members, member]));
      invalidate('addProjectMember');

      const ticket = createUndoTicket({
        description: SENTENCES.undoDescription,
        undo: () => {
          void removeMemberById(member.id).then((undone) => {
            if (undone.ok) {
              patchMembers((members) => members.filter((row) => row.id !== member.id));
              invalidate('removeProjectMember');
            } else {
              options.onToast?.({ message: SENTENCES.undoFailed, state: 'violation' });
            }
          });
        },
        ...(options.now !== undefined ? { now: options.now } : {}),
      });

      options.onToast?.({
        // G2-16: câu ngắn để không bị cắt; nút "Hoàn tác" tự nói là gỡ lại người này.
        message,
        onUndo: () => {
          ticket.undo();
        },
      });
  }

  const requestRemoveMember = (userId: string): void => {
    if (!canEdit) return;

    setRemoveTarget({
      id: userId,
      isSoleAdmin: userId === options.soleAdminId,
      name: options.memberNames[userId] ?? '',
      isSelf: userId === options.currentUserId,
    });
    setRemoveError(null);
  };

  const cancelRemoveMember = (): void => {
    if (isRemoving) return;
    setRemoveTarget(null);
    setRemoveError(null);
  };

  const confirmRemoveMember = (): void => {
    if (removeTarget === null || isRemoving || removeTarget.isSoleAdmin) return;

    const target = removeTarget;
    setRemoving(true);
    setRemoveError(null);

    void removeMemberById(target.id).then((result) => {
      setRemoving(false);

      // 404 `member`: đã gỡ từ trước, coi như xong.
      const gone = result.ok ? null : readSettingsError(result.error);
      const alreadyGone = gone !== null && gone.status === 404 && gone.resource === 'member';

      if (!result.ok && !alreadyGone) {
        setRemoveError(removeFailureSentence(result.error));
        return;
      }

      setRemoveTarget(null);

      if (target.isSelf) {
        // Không vô hiệu hoá: #24 sắp trả 404 cho chính người này.
        options.onSelfRemoved?.();
        return;
      }

      patchMembers((members) => members.filter((row) => row.id !== target.id));
      invalidate('removeProjectMember');
      options.onToast?.({ message: `Đã gỡ ${target.name} khỏi dự án.` });
    });
  };

  const memberRemoveDialog: MemberRemoveDialogModel | null =
    removeTarget === null
      ? null
      : {
          title: removeTarget.isSoleAdmin
            ? `Chưa gỡ được ${removeTarget.name}`
            : `Gỡ ${removeTarget.name} khỏi dự án?`,
          message: removeTarget.isSoleAdmin
            ? `${removeTarget.name} là quản trị viên duy nhất của dự án. Gỡ người này thì dự án không còn ai quản trị. Hãy thêm một quản trị viên khác trước.`
            : removeTarget.isSelf
            ? 'Bạn sẽ mất quyền xem dự án này. Muốn quay lại phải nhờ người khác thêm lại.'
            : 'Người này sẽ không còn truy cập được dự án. Muốn quay lại phải thêm lại.',
          error: removeError,
          confirmLabel: SENTENCES.remove,
          cancelLabel: removeTarget.isSoleAdmin ? SENTENCES.close : SENTENCES.keep,
          isRunning: isRemoving,
          isBlocked: removeTarget.isSoleAdmin,
        };

  return {
    memberEmail,
    memberError,
    isAddingMember,
    isAddMemberLocked,
    inviteEmail,
    isInvitingMember,
    memberRemoveDialog,
    setMemberEmail: (value) => {
      setMemberEmailState(value);
      setMemberError(null);
      setInviteEmail(null);
    },
    addMember,
    inviteMember,
    requestRemoveMember,
    confirmRemoveMember,
    cancelRemoveMember,
  };
}
