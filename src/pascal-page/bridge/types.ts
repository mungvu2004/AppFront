/** Cầu dữ liệu AppBack ↔ Pascal cho trang 3D riêng (`public/editor3d.html`). */
export interface PascalSceneGraph {
  readonly nodes: Record<string, unknown>;
  readonly rootNodeIds: readonly string[];
  readonly installedPlugins?: readonly string[];
  /** Vật liệu riêng của cảnh, khoá theo id — editor chuyển thẳng cho `setScene` (`scene.ts` applySceneGraphToEditor). */
  readonly materials?: Readonly<Record<string, unknown>>;
}

/** Hộp hỏi trước một việc làm mất dữ liệu (tải lại tầng, xoá nhiều — C4). */
export interface PascalConfirm {
  readonly title: string;
  readonly body: string;
  readonly confirmLabel: string;
  readonly onConfirm: () => void;
  readonly onCancel: () => void;
}

/** Một thông báo nổi. `alert` = lượt sửa vừa bị từ chối (N1, `role="alert"`); `info` = câu báo thường. */
export interface PascalNotice {
  readonly id: number;
  readonly tone: 'info' | 'alert';
  readonly text: string;
  readonly createdAt: number;
}

/** Trạng thái lưu THẬT của tầng (lượt PUT N16), cho thẻ trên trang Pascal. */
export interface PascalSaveStatus {
  /**
   * `blocked` = máy chủ từ chối (409/422/403) — cần tải lại tầng; `failed` = lượt gửi hỏng, sửa tiếp sẽ thử lại;
   * `offline` = mất mạng, sửa còn chờ gửi; `session` = phiên đăng nhập đã hết (câu ở `blockMessage`).
   */
  readonly state: 'saving' | 'saved' | 'failed' | 'blocked' | 'offline' | 'session';
  /** "Đã lưu lúc HH:mm" / "Lưu thất bại" của bộ tự lưu, `null` khi chưa lưu lần nào. */
  readonly label: string | null;
  /** Lý do của `blocked` / `session`. */
  readonly blockMessage: string | null;
  /** "Tải lại tầng": có sửa chưa lưu thì mở `confirm` trước, xác nhận mới bỏ bản ấy và nạp bản máy chủ. */
  readonly onReloadFloor: () => void;
  /**
   * Thông báo nổi, mỗi câu một mục riêng (không gộp — câu báo thường không bị nhuộm đỏ vì dính câu lỗi).
   * Thẻ tự gỡ sau vài giây (dừng khi rê chuột / có tiêu điểm); người dùng đóng sớm bằng `dismissNotice`.
   */
  readonly notices: readonly PascalNotice[];
  readonly dismissNotice: (id: number) => void;
  /** Đường "Đăng nhập lại" (quay về đúng mô hình 3D) khi `state` là `session`. */
  readonly loginHref?: string;
  /** Hộp xác nhận đang mở, `null`/vắng khi không hỏi gì. */
  readonly confirm?: PascalConfirm | null;
}

export interface PascalBridge {
  readonly status: 'loading' | 'ready' | 'error';
  readonly error?: string;
  readonly projectName?: string;
  /** Người chỉ có quyền xem: trang khoá sửa (acquireSceneReadOnlyLease) và không gọi onSave. */
  readonly readOnly: boolean;
  /** Đường về AppFront, vd `/projects/<id>/floors`. */
  readonly backHref: string;
  readonly onLoad: () => Promise<PascalSceneGraph>;
  /**
   * Mốc "trước" của lượt sửa đầu = cảnh Pascal đang giữ ngay sau `onLoad`. `setScene` điền mặc định
   * lược đồ (`visible`, `frontSide: 'unknown'`, hàng chục trường cửa…); so với cảnh chưa điền thì lượt
   * sửa đầu kéo theo mọi node, và tường/cửa đã duyệt mất dấu dù không ai đụng tới.
   */
  readonly rebaseLoaded: (scene: PascalSceneGraph) => void;
  readonly onSave: (scene: unknown) => Promise<void>;
  /** Vắng khi chỉ đọc (không có gì để lưu). */
  readonly save?: PascalSaveStatus;
}
