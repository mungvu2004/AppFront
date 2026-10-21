/** Cầu dữ liệu AppBack ↔ Pascal cho trang 3D riêng (`public/editor3d.html`). */
export interface PascalSceneGraph {
  readonly nodes: Record<string, unknown>;
  readonly rootNodeIds: readonly string[];
  readonly installedPlugins?: readonly string[];
  /** Vật liệu riêng của cảnh, khoá theo id — editor chuyển thẳng cho `setScene` (`scene.ts` applySceneGraphToEditor). */
  readonly materials?: Readonly<Record<string, unknown>>;
}

/** Trạng thái lưu THẬT của tầng (lượt PUT N16), cho thẻ trên trang Pascal. */
export interface PascalSaveStatus {
  /** `blocked` = máy chủ từ chối (409/422/403) — cần tải lại tầng; `failed` = lượt gửi hỏng, sửa tiếp sẽ thử lại. */
  readonly state: 'saving' | 'saved' | 'failed' | 'blocked';
  /** "Đã lưu lúc HH:mm" / "Lưu thất bại" của bộ tự lưu, `null` khi chưa lưu lần nào. */
  readonly label: string | null;
  readonly blockMessage: string | null;
  /** Bỏ bản chưa lưu được của tầng bị khối rồi nạp lại trang theo bản máy chủ. */
  readonly onReloadFloor: () => void;
  /** "Chưa lưu được: màu sàn, … — sẽ có ở bản sau." (mỗi nhãn một lần mỗi phiên). */
  readonly notice: string | null;
  /** `alert` = lượt sửa vừa bị từ chối (N1), thẻ phải hiện như cảnh báo (`role="alert"`); còn lại `info`. */
  readonly noticeTone?: 'info' | 'alert';
  readonly dismissNotice: () => void;
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
  readonly onSave: (scene: unknown) => Promise<void>;
  /** Vắng khi chỉ đọc (không có gì để lưu). */
  readonly save?: PascalSaveStatus;
}
