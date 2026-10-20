/**
 * Thân đầu dò `?probe=1` (I5), tách khỏi `./probe` để vitest chạy được: hàm nhận store
 * Pascal qua tham số, không nhập `@pascal-app/*` (vitest không nạp được gói khi chưa dựng
 * `dist/*.js`). Nơi gắn store thật lên `window` là `./probe`.
 *
 * Chỉ đọc store, trừ `setCamera`. Lượt hỏng tải mô hình đọc từ `useViewer.itemLoadFailures`
 * (vendor `nodes/src/item/renderer.tsx`), "đã xong" đọc từ `userData.itemModelSettled` trên
 * nhóm item trong `sceneRegistry`.
 *
 * Giới hạn của `setCamera`: đi qua sự kiện `camera-controls:apply-pose` của editor, nên máy
 * quay **trượt dần** tới tư thế mới qua vài khung (không nhảy ngay), và bị bỏ qua ở chế độ
 * góc nhìn thứ nhất. Bài kiểm phải chờ một nhịp trước khi chụp.
 */

type Vec3 = [number, number, number];

export interface PascalProbe {
  ready(): boolean;
  counts(): Record<string, number>;
  itemLoadFailures(): Record<string, unknown>;
  materials(): { slabs: Record<string, string | undefined>; walls: Record<string, unknown> };
  shading(): string | undefined;
  setCamera(pos: Vec3, target: Vec3, fov: number | 'top-ortho'): void;
}

interface LooseNode {
  readonly type: string;
  readonly slots?: Record<string, string>;
  readonly materialPreset?: string;
  readonly skirting?: unknown;
  readonly crown?: unknown;
}

type CameraPose =
  | { position: Vec3; target: Vec3; projection: 'orthographic' }
  | { position: Vec3; target: Vec3; projection: 'perspective'; fov: number };

/** Đúng phần store Pascal mà đầu dò đọc; `./probe` truyền store thật vào. */
export interface PascalProbeStores {
  readonly useScene: { getState(): { nodes: object } };
  readonly useViewer: { getState(): { itemLoadFailures: object; shading?: string } };
  readonly sceneRegistry: { nodes: { get(id: string): { userData: Record<string, unknown> } | undefined } };
  readonly emitter: { emit(event: 'camera-controls:apply-pose', pose: CameraPose): void };
}

export const createPascalProbe = ({ useScene, useViewer, sceneRegistry, emitter }: PascalProbeStores): PascalProbe => {
  const entries = () => Object.entries(useScene.getState().nodes as Record<string, LooseNode>);
  const entriesOf = (type: string) => entries().filter(([, n]) => n.type === type);

  return {
    // Có node và mọi item đã ổn (tải xong hoặc hỏng hẳn). Cảnh mặc định của editor trước khi
    // `onLoad` về cũng "sẵn sàng" — bài kiểm ghép thêm `counts()` với số mong đợi.
    ready: () =>
      entries().length > 0 &&
      entriesOf('item').every(([id]) => sceneRegistry.nodes.get(id)?.userData.itemModelSettled === true),
    counts: () => {
      const counts: Record<string, number> = {};
      for (const [, { type }] of entries()) counts[type] = (counts[type] ?? 0) + 1;
      return counts;
    },
    itemLoadFailures: () => ({ ...useViewer.getState().itemLoadFailures }),
    materials: () => ({
      slabs: Object.fromEntries(entriesOf('slab').map(([id, n]) => [id, n.slots?.surface ?? n.materialPreset])),
      walls: Object.fromEntries(
        entriesOf('wall').map(([id, n]) => [id, { slots: n.slots, skirting: n.skirting, crown: n.crown }]),
      ),
    }),
    shading: () => useViewer.getState().shading,
    setCamera: (position, target, fov) =>
      emitter.emit(
        'camera-controls:apply-pose',
        fov === 'top-ortho'
          ? { position, target, projection: 'orthographic' }
          : { position, target, projection: 'perspective', fov },
      ),
  };
};

/** Gắn đầu dò lên `window` khi và chỉ khi `?probe=1`; không cờ thì không làm gì. */
export const installPascalProbe = (search: string, target: { __pascalProbe?: PascalProbe }, stores: PascalProbeStores) => {
  if (new URLSearchParams(search).get('probe') === '1') target.__pascalProbe = createPascalProbe(stores);
};
