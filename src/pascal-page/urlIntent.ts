/**
 * Ý định mở trang 3D từ đường dẫn cũ: `/3d/exploded` và `/3d/measure` chuyển tiếp sang
 * `editor3d.html?view=exploded` / `?tool=measure` (`src/routes/viewerRedirects.tsx`). Trang Pascal
 * áp ý định ấy MỘT lần, khi cảnh của dự án đã có tường (cảnh mặc định của editor chưa có), để lượt
 * nạp cảnh không xoá mất nó. Không có tham số thì không làm gì.
 */
type SceneNodes = Readonly<Record<string, { readonly type?: string } | undefined>>;

export interface UrlIntentStores {
  readonly scene: {
    getState(): { readonly nodes: SceneNodes };
    subscribe(listener: () => void): () => void;
  };
  readonly explodeLevels: () => void;
  readonly startMeasure: () => void;
}

export function applyUrlIntent(search: string, stores: UrlIntentStores): () => void {
  const query = new URLSearchParams(search);
  const exploded = query.get('view') === 'exploded';
  const measure = query.get('tool') === 'measure';
  if (!exploded && !measure) return () => {};

  let done = false;
  let unsubscribe: () => void = () => {};
  const apply = () => {
    if (done) return;
    if (!Object.values(stores.scene.getState().nodes).some((node) => node?.type === 'wall')) return;
    done = true;
    unsubscribe();
    if (exploded) stores.explodeLevels();
    if (measure) stores.startMeasure();
  };
  unsubscribe = stores.scene.subscribe(apply);
  apply();
  return () => {
    done = true;
    unsubscribe();
  };
}
