/** Cầu dữ liệu AppBack ↔ Pascal cho trang 3D riêng (`public/editor3d.html`). */
export interface PascalSceneGraph {
  readonly nodes: Record<string, unknown>;
  readonly rootNodeIds: readonly string[];
  readonly installedPlugins?: readonly string[];
  /** Vật liệu riêng của cảnh, khoá theo id — editor chuyển thẳng cho `setScene` (`scene.ts` applySceneGraphToEditor). */
  readonly materials?: Readonly<Record<string, unknown>>;
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
}
