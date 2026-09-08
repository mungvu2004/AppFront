/**
 * Tầng logic của hộp thoại chia sẻ: nối, không chế (R-61).
 *
 * Mọi câu chữ và mọi con số ở đây đến từ một hàm có sẵn trong `src/lib`:
 *
 * | Thứ view nhận | Ai sinh ra nó |
 * |---|---|
 * | `form.problems` | `validateShareLinkRequest` — hook **không tự nghĩ câu lỗi** |
 * | `rows[].url` | `shareLinkUrl(link)` — hook **không nối chuỗi URL** |
 * | `rows[].expiryText` | `describeShareLinkExpiry(link, now)` (P-02) |
 * | `rows[].statusLabel` | `SHARE_LINK_STATUS_LABELS` |
 * | `embed.code` | `buildEmbedCode` — hook **không nối thẻ iframe** |
 * | `embed.view` | `resolveEmbedView(params)` — TĨNH, **không nạp three** |
 * | `savedAtLabel` | `formatClockTime` (A15: hook không tự định dạng giờ) |
 * | `params.viewpointCode` | `encodeViewpoint(viewpoint)` (R-08) |
 *
 * ## Trạng thái máy chủ đi bằng `useQuery`/`useMutation` (R-64)
 *
 * Lượt đọc danh sách là một `useQuery`, hai lượt ghi là hai `useMutation`, và
 * `isLoading`/`error` đọc ra từ đó — **không** một `useState` nào ở file này giữ
 * trạng thái mạng. Đây là điểm file này khác `src/hooks/useShareLinks.ts`: hook
 * đó tự viết `isLoading`/`error` bằng tay và R-64 ghi rõ nó là "ngoại lệ đi
 * trước, không phải khuôn mẫu". `useState` ở đây chỉ giữ **lựa chọn của người
 * dùng** và ba dấu hiệu chớp tắt (khoá vừa đổi, mục vừa chép, câu nhắc liên kết
 * cũ), đúng như `useExportPanel.ts` giữ lựa chọn định dạng của nó.
 *
 * `queryKeys` không có nhánh `shareLinks`, nên khoá nối thêm vào khoá chi tiết
 * dự án — xem {@link shareLinksQueryKey}. `applyInvalidation` cũng không dùng
 * được: `WRITE_OPERATIONS` (`src/lib/query/invalidation.ts:5`) không có phép ghi
 * nào của chia sẻ, và `src/lib/query` nằm ngoài phạm vi sửa (R-68). Nên hai lượt
 * ghi gọi thẳng `invalidateQueries` trên đúng khoá của mình.
 *
 * ## `embed.code` và `embed.view` luôn nói cùng một chuyện
 *
 * Cả hai dựng từ **cùng một** `EmbedParams` trong cùng một `useMemo` phụ thuộc:
 * đổi một khoá nhúng là cả hai tính lại cùng lúc. Đây là tiêu chí nghiệm thu, và
 * cách duy nhất giữ nó là không để hai đường dựng riêng — vì thế `embed.code` đi
 * qua `buildEmbedCode({ url, params, … })` chứ không qua `shareLinkEmbedCode`,
 * thứ trộn thêm `viewpointCode` của chính liên kết vào và có thể lệch khỏi
 * `params` mà khung xem trước đang vẽ.
 *
 * ## Bốn thứ đặc tả đòi mà hộp thoại này không có
 *
 * Mời người, phạm vi liên kết, ba công tắc quyền năng nhúng và hai công tắc
 * bảng — xem phần đầu `types.ts`. Không cái nào có chỗ nối ở tầng logic, nên
 * không cái nào có mặt ở đây dưới dạng một `TODO` hay một cờ luôn `false`.
 */

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import type { LevelId } from '@/domain/spatial/types';
import type { ShareExpiryChoice } from '@/hooks/useShareLinks';
import type { ColoringModeId } from '@/lib/coloring/modes';
import {
  buildEmbedCode,
  resolveEmbedView,
  type EmbedParams,
} from '@/lib/export/embedParams';
import {
  createShareLink,
  describeShareLinkExpiry,
  listShareLinks,
  revokeShareLink,
  selectActiveShareLinks,
  shareLinkUrl,
  SHARE_LINK_STATUS_LABELS,
  SHARE_PERMISSION_LABELS,
  validateShareLinkRequest,
  type CreateShareLinkRequest,
  type ShareLink,
  type ShareLinkRequestField,
  type ShareLinkStatus,
  type SharePermission,
} from '@/lib/export/shareLink';
import { formatClockTime } from '@/lib/format/datetime';
import { MOTION_DURATIONS_MS } from '@/lib/motion/tokens';
import { createUndoTicket } from '@/lib/mutations/undoTicket';
import type { SevenState } from '@/lib/testing/sevenStateScenarios';
import { encodeViewpoint } from '@/lib/three/camera/viewpointCodec';
import { useStore } from '@/store';

import {
  COLORING_OPTIONS,
  DEFAULT_EMBED_SIZE_PRESET_ID,
  DEFAULT_SHARE_EXPIRY_CHOICE,
  EMBED_SIZE_PRESETS,
  expiryDateFor,
  INITIAL_EMBED_PARAMS,
  matchEmbedSizePreset,
  MEMBERS_READ_ONLY_REASON,
  readShareLinkPermission,
  SHARE_EXPIRY_OPTIONS,
  SHARE_FORBIDDEN_REASON,
  SHARE_PERMISSION_OPTIONS,
  shareLinksQueryKey,
  toExpiryChoice,
  toLevelOptions,
} from './shareDialogGateway';
import type {
  EmbedEditableKey,
  MemberRowModel,
  ShareDialogActions,
  ShareDialogModel,
  ShareDialogResult,
  ShareLinkRowModel,
  UseShareDialogOptions,
} from './types';

/* -------------------------------------------------------------------------- */
/* Hằng số                                                                    */
/* -------------------------------------------------------------------------- */

/**
 * Dấu tích "đã chép" giữ bao lâu.
 *
 * Đặc tả viết 1,2 giây; thang chuyển động của mục B chỉ có 120/180/260/340/700,
 * nên con số đó không hợp lệ. 700 ms là tiền lệ đang chạy — `COPY_FLASH_MS` ở
 * `src/hooks/useShareLinks.ts:251` — và là mức duy nhất trong thang đủ lâu để
 * đọc được một dấu tích.
 */
const COPY_FLASH_MS = 700;

/** Mục "mã nhúng" trong `copiedTargetId`; các mục còn lại là id của liên kết. */
export const EMBED_COPY_TARGET_ID = 'embed-code';

/** Dưới mức này thì khung xem trước rời khỏi màn — trạng thái thứ bảy. */
const COLLAPSED_MEDIA_QUERY = '(max-width: 1279px)';

/** Ba màu trạng thái, đúng ba (A4). */
const TONE_BY_STATUS: Readonly<Record<ShareLinkStatus, ShareLinkRowModel['tone']>> = {
  /**
   * Xanh "đã xác minh" ở đây đánh dấu một việc **người dùng đã làm** — họ tạo
   * liên kết và máy chủ xác nhận nó đang chạy. A5 cấm suy đoán của máy đặt màu
   * này; không có suy đoán nào ở đây, chỉ có `status` máy chủ trả về.
   */
  active: 'verified',
  /** Hết hạn là việc cần làm gì đó: tạo lại một liên kết mới. */
  expired: 'attention',
  /** Thu hồi là việc đã xong theo đúng ý người dùng, không phải một vấn đề. */
  revoked: 'neutral',
};

const EMPTY_MEMBERS: readonly MemberRowModel[] = Object.freeze([]);
const EMPTY_LINKS: readonly ShareLink[] = Object.freeze([]);

/** Câu nhắc khi đổi khoá nhúng làm liên kết đã tạo không còn khớp. */
const STALE_LINK_NOTICE =
  'các liên kết đã tạo vẫn mở theo tuỳ chọn nhúng cũ; tạo một liên kết mới để dùng tuỳ chọn vừa đổi';

/* -------------------------------------------------------------------------- */
/* Bề ngang màn — trạng thái thứ bảy                                          */
/* -------------------------------------------------------------------------- */

/**
 * Màn có đang hẹp hơn 1280 không.
 *
 * Dựng riêng thay vì gọi `useAppShell()`: hook đó đọc và ghi `localStorage` cho
 * hai bảng bên của vỏ ứng dụng, thứ một hộp thoại không có việc gì phải chạm.
 * Chuỗi truy vấn giữ đúng mức `useAppShell.ts:73` đang dùng, nên hai nơi lật
 * cùng một lúc.
 */
function useIsCollapsed(): boolean {
  const [collapsed, setCollapsed] = useState(
    () => globalThis.matchMedia?.(COLLAPSED_MEDIA_QUERY).matches ?? false,
  );

  useEffect(() => {
    const media = globalThis.matchMedia?.(COLLAPSED_MEDIA_QUERY);
    if (media === undefined) {
      return;
    }

    setCollapsed(media.matches);
    const listen = (event: MediaQueryListEvent): void => setCollapsed(event.matches);
    media.addEventListener('change', listen);

    return () => media.removeEventListener('change', listen);
  }, []);

  return collapsed;
}

/* -------------------------------------------------------------------------- */
/* Dấu chớp tắt                                                               */
/* -------------------------------------------------------------------------- */

interface Flash<TValue> {
  readonly value: TValue;
  /** Đổi mỗi lần đặt lại, kể cả khi `value` không đổi — nếu không thì hiệu ứng không chạy lại. */
  readonly nonce: number;
}

/** Một giá trị tự bỏ sau `holdMs`. */
function useFlash<TValue>(holdMs: number): readonly [TValue | null, (value: TValue) => void] {
  const [flash, setFlash] = useState<Flash<TValue> | null>(null);

  useEffect(() => {
    if (flash === null) {
      return;
    }

    const timer = setTimeout(() => setFlash(null), holdMs);

    return () => clearTimeout(timer);
  }, [flash, holdMs]);

  const show = useCallback((value: TValue) => {
    setFlash((current) => ({ value, nonce: (current?.nonce ?? 0) + 1 }));
  }, []);

  return [flash?.value ?? null, show];
}

/* -------------------------------------------------------------------------- */
/* Bảng lỗi                                                                   */
/* -------------------------------------------------------------------------- */

/** `readonly ShareLinkRequestProblem[]` → bảng tra theo trường mà view đọc. */
function toProblemMap(
  request: CreateShareLinkRequest,
): Partial<Record<ShareLinkRequestField, string>> {
  const problems: Partial<Record<ShareLinkRequestField, string>> = {};

  for (const problem of validateShareLinkRequest(request)) {
    problems[problem.field] ??= problem.message;
  }

  return problems;
}

/** Câu người đọc thấy khi một lượt gọi hỏng. */
function messageOf(error: unknown): string {
  return error instanceof Error && error.message.length > 0
    ? error.message
    : 'không thực hiện được thao tác chia sẻ; hãy thử lại';
}

/**
 * Chép mặc định, khi nơi gọi không tiêm đường chép nào.
 *
 * Từ chối thay vì lặng lẽ thành công khi trình duyệt không mở bộ nhớ tạm ra
 * (ngữ cảnh không bảo mật, hoặc người dùng đã chặn quyền): một dấu tích "đã
 * chép" trên một lượt chép chưa từng xảy ra là lời nói dối đắt nhất màn này có
 * thể nói.
 */
function writeToClipboard(value: string): Promise<void> {
  const clipboard = globalThis.navigator?.clipboard;

  return clipboard === undefined
    ? Promise.reject(new Error('trình duyệt không cho trang này ghi vào bộ nhớ tạm'))
    : clipboard.writeText(value);
}

/* -------------------------------------------------------------------------- */
/* Hook                                                                        */
/* -------------------------------------------------------------------------- */

/**
 * Mọi thứ `ShareDialog` cần, dựng từ cổng chia sẻ, quyền và store.
 *
 * `const [model, actions] = useShareDialog({ gateway, projectId, roles });`
 */
export function useShareDialog(options: UseShareDialogOptions): ShareDialogResult {
  const { gateway, projectId, roles } = options;
  const viewpoint = options.viewpoint ?? null;
  const members = options.members ?? EMPTY_MEMBERS;
  const { onToast, onDismiss, copyToClipboard } = options;

  const nowFn = options.now;
  const readNow = useCallback((): Date => nowFn?.() ?? new Date(), [nowFn]);

  const queryClient = useQueryClient();
  const isCollapsed = useIsCollapsed();
  const levels = useStore((state) => state.floors);

  /* ---------------------------------------------------------------------- */
  /* Quyền                                                                   */
  /* ---------------------------------------------------------------------- */

  const canCreateLink = useMemo(() => readShareLinkPermission(roles), [roles]);

  /* ---------------------------------------------------------------------- */
  /* Lựa chọn của người dùng — thứ duy nhất `useState` giữ                   */
  /* ---------------------------------------------------------------------- */

  const [permission, setPermissionState] = useState<SharePermission>('view');
  const [expiryChoice, setExpiryChoice] = useState<ShareExpiryChoice>(DEFAULT_SHARE_EXPIRY_CHOICE);
  const [passwordEnabled, setPasswordEnabledState] = useState(false);
  const [password, setPassword] = useState('');
  const [includeViewpoint, setIncludeViewpoint] = useState(false);

  const [embedDraft, setEmbedDraft] = useState<EmbedParams>(INITIAL_EMBED_PARAMS);
  const [widthPx, setWidthPx] = useState(
    () => EMBED_SIZE_PRESETS.find((preset) => preset.id === DEFAULT_EMBED_SIZE_PRESET_ID)?.widthPx ?? 0,
  );
  const [heightPx, setHeightPx] = useState(
    () =>
      EMBED_SIZE_PRESETS.find((preset) => preset.id === DEFAULT_EMBED_SIZE_PRESET_ID)?.heightPx ?? 0,
  );

  const [savedAtMs, setSavedAtMs] = useState<number | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [staleLinkNotice, setStaleLinkNotice] = useState<string | null>(null);

  const [recentlyChangedKey, flashEmbedKey] = useFlash<EmbedEditableKey>(
    MOTION_DURATIONS_MS.standard,
  );
  const [copiedTargetId, flashCopied] = useFlash<string>(COPY_FLASH_MS);

  /* ---------------------------------------------------------------------- */
  /* Danh sách liên kết — `useQuery` (R-64)                                  */
  /* ---------------------------------------------------------------------- */

  const listQuery = useQuery({
    queryKey: shareLinksQueryKey(projectId),
    queryFn: async ({ signal }): Promise<readonly ShareLink[]> => {
      const result = await listShareLinks(gateway, { projectId, signal });
      if (!result.ok) {
        throw new Error(result.error.message);
      }

      return result.data.links;
    },
    enabled: canCreateLink,
  });

  const links = listQuery.data ?? EMPTY_LINKS;
  const activeLinks = useMemo(() => selectActiveShareLinks(links), [links]);

  /**
   * Liên kết mà mã nhúng nói về.
   *
   * Liên kết còn dùng được mới nhất; không có cái nào thì không có mã nhúng để
   * chép, và mục nhúng rời khỏi màn thay vì hiện một khung `<iframe>` trỏ vào
   * hư không.
   */
  const embedLink = activeLinks[activeLinks.length - 1] ?? null;

  /* ---------------------------------------------------------------------- */
  /* Khoá nhúng — `code` và `view` dựng từ CÙNG một `EmbedParams`            */
  /* ---------------------------------------------------------------------- */

  /**
   * Mã góc nhìn, hoặc `null`.
   *
   * `encodeViewpoint` ném `RangeError` với một góc nhìn không đặt vào liên kết
   * được (toạ độ `NaN`, mô hình xa vô lý, mã tầng không mã hoá được). Bắt lại và
   * bỏ mã đi là đúng ở **khung xem trước**; lượt tạo liên kết thì không im lặng
   * như vậy — `createShareLink` gọi lại `encodeViewpoint` và trả về một câu lỗi
   * ở trường `viewpoint` thay vì gửi một liên kết mở sai chỗ.
   */
  const viewpointCode = useMemo<string | null>(() => {
    if (!includeViewpoint || viewpoint === null) {
      return null;
    }

    try {
      return encodeViewpoint(viewpoint);
    } catch {
      return null;
    }
  }, [includeViewpoint, viewpoint]);

  const embedParams = useMemo<EmbedParams>(
    () => ({ ...embedDraft, viewpointCode }),
    [embedDraft, viewpointCode],
  );

  const embedView = useMemo(() => resolveEmbedView(embedParams), [embedParams]);

  const embedCode = useMemo(
    () =>
      embedLink === null
        ? ''
        : buildEmbedCode({ url: embedLink.url, params: embedParams, widthPx, heightPx }),
    [embedLink, embedParams, widthPx, heightPx],
  );

  /* ---------------------------------------------------------------------- */
  /* Form                                                                    */
  /* ---------------------------------------------------------------------- */

  const buildRequest = useCallback(
    (now: Date): CreateShareLinkRequest => ({
      projectId,
      permission,
      expiresAt: expiryDateFor(expiryChoice, now),
      ...(passwordEnabled ? { password } : {}),
      viewpoint: includeViewpoint ? viewpoint : null,
      embed: embedParams,
      now,
    }),
    [projectId, permission, expiryChoice, passwordEnabled, password, includeViewpoint, viewpoint, embedParams],
  );

  const problems = useMemo(() => toProblemMap(buildRequest(readNow())), [buildRequest, readNow]);

  /* ---------------------------------------------------------------------- */
  /* Hai lượt ghi — `useMutation` (R-64)                                     */
  /* ---------------------------------------------------------------------- */

  const invalidateLinks = useCallback((): void => {
    void queryClient.invalidateQueries({ queryKey: shareLinksQueryKey(projectId) });
  }, [queryClient, projectId]);

  const createMutation = useMutation<ShareLink, Error, void>({
    mutationFn: async () => {
      const result = await createShareLink(gateway, buildRequest(readNow()));
      if (!result.ok) {
        throw new Error(result.error.message);
      }

      return result.data;
    },
    onSuccess: () => {
      setActionError(null);
      setStaleLinkNotice(null);
      setSavedAtMs(readNow().getTime());
      invalidateLinks();
      onToast?.({ message: 'đã tạo liên kết chia sẻ' });
    },
    onError: (error) => setActionError(messageOf(error)),
  });

  const revokeMutation = useMutation<ShareLink, Error, string>({
    mutationFn: async (linkId) => {
      const result = await revokeShareLink(gateway, { projectId, linkId });
      if (!result.ok) {
        throw new Error(result.error.message);
      }

      return result.data;
    },
    onSuccess: () => {
      setActionError(null);
      setSavedAtMs(readNow().getTime());
      invalidateLinks();
      onToast?.({ message: 'đã thu hồi liên kết' });
    },
    onError: (error) => setActionError(messageOf(error)),
  });

  /* ---------------------------------------------------------------------- */
  /* Chép                                                                    */
  /* ---------------------------------------------------------------------- */

  const copy = useCallback(
    (targetId: string, text: string, toastMessage: string): void => {
      if (text.length === 0) {
        return;
      }

      const write = copyToClipboard ?? writeToClipboard;

      void Promise.resolve(write(text)).then(
        () => {
          flashCopied(targetId);
          onToast?.({ message: toastMessage });
        },
        () => setActionError('không chép được vào bộ nhớ tạm; hãy chọn và chép thủ công'),
      );
    },
    [copyToClipboard, flashCopied, onToast],
  );

  /* ---------------------------------------------------------------------- */
  /* Hàng liên kết                                                           */
  /* ---------------------------------------------------------------------- */

  const rows = useMemo<readonly ShareLinkRowModel[]>(() => {
    const now = readNow();

    return links.map((link) => {
      const expiry = describeShareLinkExpiry(link, now);

      return {
        id: link.id,
        url: shareLinkUrl(link),
        permissionLabel: SHARE_PERMISSION_LABELS[link.permission],
        statusLabel: SHARE_LINK_STATUS_LABELS[expiry.status],
        tone: TONE_BY_STATUS[expiry.status],
        expiryText: expiry.text,
        passwordProtected: link.passwordProtected,
        canRevoke: canCreateLink && expiry.status === 'active',
      };
    });
  }, [links, readNow, canCreateLink]);

  /* ---------------------------------------------------------------------- */
  /* Bảy trạng thái (A11)                                                    */
  /* ---------------------------------------------------------------------- */

  const isBusy = listQuery.isPending || createMutation.isPending || revokeMutation.isPending;
  const errorMessage =
    actionError ?? (listQuery.error === null ? null : messageOf(listQuery.error));

  /**
   * Thứ tự quyết định, và vì sao theo thứ tự đó.
   *
   * Quyền đi trước tất cả: không tạo được liên kết thì mọi thứ phía sau là câu
   * hỏi không cần trả lời. Rồi tới lượt gọi đang chạy, rồi tới lỗi — một lỗi vừa
   * xảy ra quan trọng hơn số hàng đang có. `collapsed` là chuyện bề ngang màn,
   * đứng trước ba trạng thái đọc từ dữ liệu vì nó đúng bất kể dữ liệu ra sao.
   */
  const state = useMemo<SevenState>(() => {
    if (!canCreateLink) {
      return 'forbidden';
    }
    if (isBusy) {
      return 'loading';
    }
    if (errorMessage !== null) {
      return 'error';
    }
    if (isCollapsed) {
      return 'collapsed';
    }
    if (links.length === 0) {
      return 'empty';
    }

    return activeLinks.length === 0 ? 'partial' : 'success';
  }, [canCreateLink, isBusy, errorMessage, isCollapsed, links.length, activeLinks.length]);

  /* ---------------------------------------------------------------------- */
  /* Việc làm được                                                           */
  /* ---------------------------------------------------------------------- */

  /**
   * Đổi quyền truy cập là chỗ DUY NHẤT của màn dùng hoàn tác (A8, D-05).
   *
   * Mọi thay đổi khác ở đây hoặc không mất gì khi làm lại (đổi một khoá nhúng),
   * hoặc đã có đường quay lại của riêng nó (thu hồi một liên kết là một lượt
   * ghi máy chủ, không phải một lần bấm nhầm). Quyền thì khác: nó quyết định
   * người nhận liên kết làm được gì, nên nó đi kèm một vé hoàn tác và một toast
   * mang `onUndo`.
   */
  const setPermission = useCallback(
    (next: SharePermission): void => {
      const previous = permission;
      if (previous === next) {
        return;
      }

      setPermissionState(next);

      const ticket = createUndoTicket({
        description: `đổi quyền chia sẻ sang ${SHARE_PERMISSION_LABELS[next]}`,
        undo: () => setPermissionState(previous),
      });

      onToast?.({
        message: `đã đổi quyền chia sẻ sang ${SHARE_PERMISSION_LABELS[next]}`,
        onUndo: () => {
          ticket.undo();
        },
      });
    },
    [permission, onToast],
  );

  /**
   * Đổi một khoá nhúng.
   *
   * Ba việc mỗi lần: ghi khoá, chớp dấu "vừa đổi" trong 260 ms, và — nếu đang có
   * liên kết còn dùng được — đặt câu nhắc rằng những liên kết ấy vẫn mở theo
   * tuỳ chọn cũ. Câu nhắc là một dòng chữ, không phải một hộp thoại: người dùng
   * không mất gì, họ chỉ cần biết.
   */
  const changeEmbed = useCallback(
    (key: EmbedEditableKey, next: Partial<EmbedParams>): void => {
      setEmbedDraft((current) => ({ ...current, ...next }));
      flashEmbedKey(key);

      if (activeLinks.length > 0) {
        setStaleLinkNotice(STALE_LINK_NOTICE);
      }
    },
    [flashEmbedKey, activeLinks.length],
  );

  const actions = useMemo<ShareDialogActions>(
    () => ({
      setPermission,
      setExpiryChoice: (id: string) => setExpiryChoice(toExpiryChoice(id)),
      setPasswordEnabled: (enabled: boolean) => {
        setPasswordEnabledState(enabled);
        // Tắt khoá thứ hai thì mật khẩu vừa gõ rời khỏi bộ nhớ ngay, không nằm
        // chờ trong state cho tới lần bật sau.
        if (!enabled) {
          setPassword('');
        }
      },
      setPassword,
      setIncludeViewpoint: (include: boolean) => {
        setIncludeViewpoint(include);
        flashEmbedKey('viewpointCode');
      },
      createLink: () => createMutation.mutate(),
      revokeLink: (id: string) => revokeMutation.mutate(id),
      copyLink: (id: string) => {
        const row = rows.find((candidate) => candidate.id === id);
        if (row !== undefined) {
          copy(id, row.url, 'đã chép liên kết');
        }
      },
      copyEmbedCode: () => copy(EMBED_COPY_TARGET_ID, embedCode, 'đã chép mã nhúng'),
      setEmbedLevel: (levelId: LevelId | null) => changeEmbed('levelId', { levelId }),
      setEmbedColoring: (coloring: ColoringModeId | null) => changeEmbed('coloring', { coloring }),
      setEmbedToolbar: (toolbar: boolean) => changeEmbed('toolbar', { toolbar }),
      setEmbedSizePreset: (presetId: string) => {
        const preset = EMBED_SIZE_PRESETS.find((candidate) => candidate.id === presetId);
        if (preset !== undefined) {
          setWidthPx(preset.widthPx);
          setHeightPx(preset.heightPx);
        }
      },
      setEmbedWidth: setWidthPx,
      setEmbedHeight: setHeightPx,
      dismiss: () => onDismiss?.(),
    }),
    [setPermission, flashEmbedKey, createMutation, revokeMutation, rows, copy, embedCode, changeEmbed, onDismiss],
  );

  /* ---------------------------------------------------------------------- */
  /* Model                                                                   */
  /* ---------------------------------------------------------------------- */

  const model = useMemo<ShareDialogModel>(
    () => ({
      state,
      savedAtLabel: savedAtMs === null ? null : `Đã lưu lúc ${formatClockTime(savedAtMs)}`,
      canCreateLink,
      noPermissionReason: canCreateLink ? null : SHARE_FORBIDDEN_REASON,
      members,
      membersReadOnlyReason: MEMBERS_READ_ONLY_REASON,
      form: {
        permission,
        permissionOptions: SHARE_PERMISSION_OPTIONS,
        expiryChoiceId: expiryChoice,
        expiryChoices: SHARE_EXPIRY_OPTIONS,
        passwordEnabled,
        password,
        includeViewpoint,
        problems,
        canSubmit: canCreateLink && Object.keys(problems).length === 0 && !isBusy,
      },
      rows,
      embed: {
        params: embedParams,
        view: embedView,
        code: embedCode,
        widthPx,
        heightPx,
        levelOptions: toLevelOptions(levels),
        coloringOptions: COLORING_OPTIONS,
        sizePresets: EMBED_SIZE_PRESETS,
        activeSizePresetId: matchEmbedSizePreset(widthPx, heightPx),
        recentlyChangedKey,
        previewHidden: isCollapsed,
      },
      copiedTargetId,
      errorMessage,
      staleLinkNotice,
    }),
    [
      state,
      savedAtMs,
      canCreateLink,
      members,
      permission,
      expiryChoice,
      passwordEnabled,
      password,
      includeViewpoint,
      problems,
      isBusy,
      rows,
      embedParams,
      embedView,
      embedCode,
      widthPx,
      heightPx,
      levels,
      recentlyChangedKey,
      isCollapsed,
      copiedTargetId,
      errorMessage,
      staleLinkNotice,
    ],
  );

  return [model, actions];
}
