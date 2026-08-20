import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import type { HttpError, Result } from '@/lib/http';
import type { ShareLinkGateway } from '@/lib/export/shareLink';
import { expectSevenStates } from '@/lib/testing/expectSevenStates';
import { SEVEN_STATES, type SevenState } from '@/lib/testing/sevenStateScenarios';
import type { ProjectRole } from '@/types/project';

import { ShareScreen, ShareScreenView, type ShareScreenViewProps } from './ShareScreen';

/* -------------------------------------------------------------------------- */
/* Fixtures.                                                                   */
/* -------------------------------------------------------------------------- */

const NOW = new Date('2026-08-17T09:00:00.000Z');
const PROJECT_ID = 'prj-4821';
const PROJECT_NAME = 'Chung cư Hoàng Anh';
const SHARE_URL = 'https://app.example.com/s/8f2c1d';

afterEach(() => {
  cleanup();
});

function wireLink(overrides: Readonly<Record<string, unknown>> = {}): Record<string, unknown> {
  return {
    id: 'shr-001',
    url: SHARE_URL,
    permission: 'view',
    status: 'active',
    createdAt: '2026-08-17T08:00:00.000Z',
    expiresAt: '2026-08-24T08:00:00.000Z',
    revokedAt: null,
    passwordProtected: false,
    viewpointCode: null,
    label: 'Gửi tư vấn giám sát',
    ...overrides,
  };
}

interface GatewayReplies {
  readonly create?: Result<unknown, HttpError>;
  readonly list?: Result<unknown, HttpError>;
  readonly revoke?: Result<unknown, HttpError>;
}

function stubGateway(replies: GatewayReplies = {}): ShareLinkGateway {
  return {
    create: async () => replies.create ?? { ok: true, data: wireLink({ id: 'shr-new' }) },
    list: async () => replies.list ?? { ok: true, data: [wireLink()] },
    revoke: async () =>
      replies.revoke ?? {
        ok: true,
        data: wireLink({ status: 'revoked', revokedAt: NOW.toISOString() }),
      },
  };
}

/* -------------------------------------------------------------------------- */
/* The view, in each of the seven states (invariant A11).                      */
/* -------------------------------------------------------------------------- */

const noop = (): void => undefined;

/**
 * Every prop the view takes, at rest.
 *
 * Written out rather than generated: the point of the seven-state check is that
 * a state is described exactly, and a fixture that filled in the gaps would let
 * a scenario pass while describing nothing in particular.
 */
function baseProps(): ShareScreenViewProps {
  return {
    projectName: PROJECT_NAME,
    state: 'success',
    canCreate: true,
    isCollapsed: false,
    isLoading: false,
    isCreating: false,
    isRevoking: false,
    rows: [],
    form: {
      permission: 'view',
      expiryChoice: '7d',
      passwordEnabled: false,
      password: '',
      includeViewpoint: true,
      toolbar: true,
    },
    formProblems: {},
    canSubmit: true,
    errorMessage: null,
    unreadableNotice: null,
    revoking: null,
    copiedId: null,
    viewpointAvailable: true,
    setPermission: noop,
    setExpiryChoice: noop,
    setPasswordEnabled: noop,
    setPassword: noop,
    setIncludeViewpoint: noop,
    setToolbar: noop,
    setCollapsed: noop,
    create: noop,
    reload: noop,
    copyUrl: noop,
    copyEmbedCode: noop,
    askRevoke: noop,
    cancelRevoke: noop,
    confirmRevoke: noop,
  };
}

const SAMPLE_ROW: ShareScreenViewProps['rows'][number] = {
  id: 'shr-001',
  url: SHARE_URL,
  embedCode: `<iframe src="${SHARE_URL}"></iframe>`,
  permissionLabel: 'chỉ xem',
  statusLabel: 'đang dùng được',
  tone: 'verified',
  expiryText: 'còn 6 ngày',
  passwordProtected: true,
  title: 'Gửi tư vấn giám sát',
  canRevoke: true,
};

/**
 * "Thu hồi" names two different buttons — the row's icon action, whose label
 * carries the link's title, and the confirm dialog's plain one. Scoping to a
 * region is how the exact name stays usable for both.
 */
function buttonNamed(container: HTMLElement, label: string): HTMLElement {
  return within(container).getByRole('button', { name: label });
}

/** One props object per state, keyed so a missing state cannot hide. */
const PROPS_BY_STATE: Readonly<Record<SevenState, () => ShareScreenViewProps>> = {
  empty: () => ({ ...baseProps(), state: 'empty', rows: [] }),
  loading: () => ({ ...baseProps(), state: 'loading', isLoading: true }),
  partial: () => ({
    ...baseProps(),
    state: 'partial',
    rows: [SAMPLE_ROW],
    unreadableNotice: '2 trong 3 liên kết không đọc được và không hiện ở đây.',
  }),
  error: () => ({
    ...baseProps(),
    state: 'error',
    errorMessage: 'không kết nối được máy chủ; liên kết chia sẻ chưa thay đổi',
  }),
  success: () => ({ ...baseProps(), state: 'success', rows: [SAMPLE_ROW] }),
  forbidden: () => ({
    ...baseProps(),
    state: 'forbidden',
    canCreate: false,
    // The hook clears `canRevoke` for an account that cannot share; a fixture
    // that left it on would test a screen this product never renders.
    rows: [{ ...SAMPLE_ROW, canRevoke: false }],
  }),
  collapsed: () => ({ ...baseProps(), state: 'collapsed', isCollapsed: true, rows: [SAMPLE_ROW] }),
};

describe('ShareScreenView, seven states', () => {
  it('renders something for every one of the seven', () => {
    expectSevenStates(
      (scenario) => render(<ShareScreenView {...PROPS_BY_STATE[scenario.state]()} />),
      SEVEN_STATES.map((state) => ({
        state,
        label: state,
        rows: [],
        totalCount: 0,
        isLoading: false,
        isCollapsed: false,
        canView: true,
        error: null,
      })),
    );
  });

  it('shows skeletons rather than an empty list while loading', () => {
    render(<ShareScreenView {...PROPS_BY_STATE.loading()} />);

    expect(screen.getByLabelText('đang tải liên kết')).toBeInTheDocument();
    expect(screen.queryByText('Chưa có liên kết nào')).not.toBeInTheDocument();
  });

  it('offers a retry when the list could not be loaded', () => {
    const reload = vi.fn();
    const { container } = render(<ShareScreenView {...PROPS_BY_STATE.error()} reload={reload} />);

    fireEvent.click(buttonNamed(container, 'Thử lại'));

    expect(reload).toHaveBeenCalledTimes(1);
  });

  it('says the list is incomplete rather than letting it look whole', () => {
    render(<ShareScreenView {...PROPS_BY_STATE.partial()} />);

    expect(screen.getByText('Danh sách chưa đầy đủ')).toBeInTheDocument();
    expect(screen.getByText(/2 trong 3 liên kết không đọc được/)).toBeInTheDocument();
    // The rows that did parse are still there to act on.
    expect(screen.getByText('Gửi tư vấn giám sát')).toBeInTheDocument();
  });

  it('removes the form but keeps the list when the account cannot share', () => {
    render(<ShareScreenView {...PROPS_BY_STATE.forbidden()} />);

    expect(screen.getByText('Không có quyền tạo liên kết')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Tạo liên kết/ })).not.toBeInTheDocument();
    // Hiding the list would turn a permission into an information gap.
    expect(screen.getByText('Gửi tư vấn giám sát')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /^Thu hồi Gửi/ })).not.toBeInTheDocument();
  });

  it('folds to a summary when collapsed', () => {
    render(<ShareScreenView {...PROPS_BY_STATE.collapsed()} />);

    expect(screen.getByText(/Phần chia sẻ đang thu gọn/)).toBeInTheDocument();
    expect(screen.queryByText('liên kết đang có')).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: /mở rộng/ })).toHaveAttribute(
      'aria-expanded',
      'false',
    );
  });
});

/* -------------------------------------------------------------------------- */
/* The view's behaviour.                                                       */
/* -------------------------------------------------------------------------- */

describe('ShareScreenView', () => {
  it('shows a link without ever showing its password', () => {
    render(<ShareScreenView {...PROPS_BY_STATE.success()} />);

    expect(screen.getByText('có mật khẩu')).toBeInTheDocument();
    expect(screen.getByText(SHARE_URL)).toBeInTheDocument();
    expect(screen.getByText('chỉ xem · còn 6 ngày')).toBeInTheDocument();
  });

  it('offers copying the address and the embed snippet separately', () => {
    const copyUrl = vi.fn();
    const copyEmbedCode = vi.fn();
    render(
      <ShareScreenView {...PROPS_BY_STATE.success()} copyUrl={copyUrl} copyEmbedCode={copyEmbedCode} />,
    );

    fireEvent.click(screen.getByRole('button', { name: 'Chép liên kết Gửi tư vấn giám sát' }));
    fireEvent.click(screen.getByRole('button', { name: 'Chép mã nhúng Gửi tư vấn giám sát' }));

    expect(copyUrl).toHaveBeenCalledWith('shr-001');
    expect(copyEmbedCode).toHaveBeenCalledWith('shr-001');
  });

  it('asks before revoking, and says the revoke cannot be undone', () => {
    const confirmRevoke = vi.fn();
    render(
      <ShareScreenView
        {...PROPS_BY_STATE.success()}
        revoking={SAMPLE_ROW}
        confirmRevoke={confirmRevoke}
      />,
    );

    const dialog = screen.getByRole('dialog');
    expect(dialog).toHaveAttribute('aria-modal', 'true');
    expect(screen.getByText(/Không hoàn tác được/)).toBeInTheDocument();

    fireEvent.click(buttonNamed(dialog, 'Thu hồi'));

    expect(confirmRevoke).toHaveBeenCalledTimes(1);
  });

  it('closes the confirm dialog on Esc (invariant A12)', async () => {
    const cancelRevoke = vi.fn();
    render(
      <ShareScreenView
        {...PROPS_BY_STATE.success()}
        revoking={SAMPLE_ROW}
        cancelRevoke={cancelRevoke}
      />,
    );

    fireEvent.keyDown(screen.getByRole('dialog'), { key: 'Escape' });

    await waitFor(() => {
      expect(cancelRevoke).toHaveBeenCalled();
    });
  });

  it('hides the password field until the lock is switched on', () => {
    const { rerender } = render(<ShareScreenView {...baseProps()} />);
    expect(screen.queryByLabelText('mật khẩu của liên kết')).not.toBeInTheDocument();

    const withPassword = baseProps();
    rerender(
      <ShareScreenView
        {...withPassword}
        form={{ ...withPassword.form, passwordEnabled: true }}
      />,
    );

    const field = screen.getByLabelText('mật khẩu của liên kết');
    expect(field).toHaveAttribute('type', 'password');
    expect(screen.getByText(/không nằm trong đường dẫn/)).toBeInTheDocument();
  });

  it('explains why the viewpoint switch is unavailable rather than just disabling it', () => {
    const props = baseProps();
    render(<ShareScreenView {...props} viewpointAvailable={false} />);

    expect(screen.getByText(/Chưa có góc nhìn nào để gắn/)).toBeInTheDocument();
  });

  it('refuses to submit while the form has a complaint', () => {
    const create = vi.fn();
    render(<ShareScreenView {...baseProps()} canSubmit={false} create={create} />);

    const button = screen.getByRole('button', { name: /Tạo liên kết/ });
    expect(button).toBeDisabled();

    fireEvent.click(button);
    expect(create).not.toHaveBeenCalled();
  });
});

/* -------------------------------------------------------------------------- */
/* The screen, wired to its hook.                                              */
/* -------------------------------------------------------------------------- */

const ENGINEER: readonly ProjectRole[] = ['engineer'];
const VIEWER: readonly ProjectRole[] = ['viewer'];

describe('ShareScreen', () => {
  it('loads the project’s links and lists them', async () => {
    render(
      <ShareScreen
        projectName={PROJECT_NAME}
        gateway={stubGateway()}
        projectId={PROJECT_ID}
        roles={ENGINEER}
        now={() => NOW}
      />,
    );

    expect(await screen.findByText('Gửi tư vấn giám sát')).toBeInTheDocument();
    expect(screen.getByText('chỉ xem · còn 6 ngày')).toBeInTheDocument();
  });

  it('drops the form for a role that cannot share', async () => {
    render(
      <ShareScreen
        projectName={PROJECT_NAME}
        gateway={stubGateway()}
        projectId={PROJECT_ID}
        roles={VIEWER}
        now={() => NOW}
      />,
    );

    expect(await screen.findByText('Không có quyền tạo liên kết')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Tạo liên kết/ })).not.toBeInTheDocument();
  });

  it('adds a created link to the list and offers an undo (invariant A8)', async () => {
    const onToast = vi.fn();
    render(
      <ShareScreen
        projectName={PROJECT_NAME}
        gateway={stubGateway()}
        projectId={PROJECT_ID}
        roles={ENGINEER}
        now={() => NOW}
        onToast={onToast}
      />,
    );

    fireEvent.click(await screen.findByRole('button', { name: /Tạo liên kết/ }));

    await waitFor(() => {
      expect(onToast).toHaveBeenCalledTimes(1);
    });
    const toast = onToast.mock.calls[0]?.[0] as { message: string; onUndo?: () => void };
    expect(toast.message).toBe('Đã tạo liên kết chia sẻ.');
    // Undoing a share means taking it back — the only honest undo there is.
    expect(typeof toast.onUndo).toBe('function');
  });

  it('surfaces a transport failure instead of an empty list', async () => {
    render(
      <ShareScreen
        projectName={PROJECT_NAME}
        gateway={stubGateway({
          list: { ok: false, error: { kind: 'network', requestId: 'r', retryable: true, raw: null } },
        })}
        projectId={PROJECT_ID}
        roles={ENGINEER}
        now={() => NOW}
      />,
    );

    expect(await screen.findByText('Không tải được danh sách liên kết')).toBeInTheDocument();
    expect(screen.queryByText('Chưa có liên kết nào')).not.toBeInTheDocument();
  });

  it('reaches the "một phần" state when the server sent a row it could not read', async () => {
    render(
      <ShareScreen
        projectName={PROJECT_NAME}
        gateway={stubGateway({ list: { ok: true, data: [wireLink(), { id: 'broken' }] } })}
        projectId={PROJECT_ID}
        roles={ENGINEER}
        now={() => NOW}
      />,
    );

    expect(await screen.findByText('Danh sách chưa đầy đủ')).toBeInTheDocument();
  });

  it('takes a link back through the confirm dialog', async () => {
    render(
      <ShareScreen
        projectName={PROJECT_NAME}
        gateway={stubGateway()}
        projectId={PROJECT_ID}
        roles={ENGINEER}
        now={() => NOW}
      />,
    );

    fireEvent.click(await screen.findByRole('button', { name: 'Thu hồi Gửi tư vấn giám sát' }));
    fireEvent.click(buttonNamed(await screen.findByRole('dialog'), 'Thu hồi'));

    expect(await screen.findByText('đã thu hồi')).toBeInTheDocument();
  });

  it('copies the address without putting anything secret in it', async () => {
    const copied: string[] = [];
    render(
      <ShareScreen
        projectName={PROJECT_NAME}
        gateway={stubGateway()}
        projectId={PROJECT_ID}
        roles={ENGINEER}
        now={() => NOW}
        copyToClipboard={(text) => {
          copied.push(text);
        }}
      />,
    );

    fireEvent.click(
      await screen.findByRole('button', { name: 'Chép liên kết Gửi tư vấn giám sát' }),
    );

    await waitFor(() => {
      expect(copied).toHaveLength(1);
    });
    expect(copied[0]).toContain(SHARE_URL);
    expect(copied[0]).not.toContain('password');
  });
});
