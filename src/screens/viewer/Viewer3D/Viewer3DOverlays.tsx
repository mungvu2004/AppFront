/**
 * Hai lớp vẽ ĐÈ lên khung nhìn của `Viewer3D`, và vì sao chúng không đi qua
 * `inspectorSections`.
 *
 * Bốn panel của `Viewer3DPanels.tsx` là NỘI DUNG của cột thanh tra bên phải.
 * Hai thứ ở đây thì không: cả hai đều khai `absolute inset-0` ở gốc của chính
 * chúng (`CollaborationLayer.tsx:343`, `WallGeometryEditor.tsx:145,199`), tức
 * chúng đòi một khung `relative` phủ đúng khung nhìn 3D. Nhét chúng vào cột
 * 344 sẽ là đặt con trỏ của người khác và tay nắm hình học lên một cái panel
 * thay vì lên mô hình.
 *
 * ## `CollaborationLayer` — một dòng, và ranh giới lỗi đã nằm sẵn trong nó
 *
 * Docblock của nó khai "bất cứ màn nào cũng gắn được bằng một dòng", và
 * `CollaborationLayer.container.tsx:123-135` đã tự bọc `ScreenErrorBoundary`
 * quanh mình (R-62) — đúng thứ nó nói là bắt buộc, vì một ngoại lệ trong một
 * lớp phủ không có ranh giới sẽ kéo sập cả cây React của màn chủ. Nên ở đây
 * KHÔNG có ranh giới thứ hai: hai ranh giới lồng nhau không an toàn gấp đôi,
 * chúng chỉ làm mờ chỗ lỗi thật sự bị bắt.
 *
 * Mọi tuỳ chọn của nó đều tuỳ chọn, và bốn năng lực của nó đang tắt
 * (`useCollaborationLayer.ts:46-52`), nên hôm nay lớp này vẽ đúng nhóm ảnh một
 * người cộng câu "chỉ có bạn". Đó là trạng thái THẬT của hệ thống, không phải
 * một chỗ dựng tạm.
 *
 * ## `WallGeometryEditor` — một CHẾ ĐỘ, không phải một panel
 *
 * `WallGeometryEditor.container.tsx:17` nói thẳng: "màn này là một CHẾ ĐỘ bên
 * trong `Viewer3D`". Nên nó không có nút bật riêng nằm cạnh ba bảng phụ: nó
 * bật khi người dùng đang chọn MỘT BỨC TƯỜNG và bấm nút vào chế độ ở cột thanh
 * tra, và tắt bằng "Xong" của chính nó, bằng Esc (A12), hoặc khi vùng chọn
 * không còn là tường.
 *
 * ## `onGeometryChanged` KHÔNG được truyền, và đó là câu trả lời trung thực
 *
 * Prop ấy tuỳ chọn, và docblock của nó nói nó dùng để "nơi gọi dựng lại theo".
 * `Viewer3D` dựng lại RỒI, và không qua nó: lớp phủ ghi qua tầng lệnh vào
 * `spatial` của kho, `Viewer3D.container.tsx` đăng ký đúng lát kho ấy
 * (`useStore((state) => state.spatial)`), nên một lượt ghi hình học đã kéo
 * `useViewer3D` dựng lại cảnh qua đường có sẵn. Thêm một callback nữa ở đây sẽ
 * là một sợi dây thứ hai nói cùng một điều — và nếu nó rỗng thì là đúng thứ
 * callback chết mà R-73 cấm.
 *
 * `isCollapsed` ở đây luôn `false`: khung nhìn thu gọn là chuyện của bề ngang
 * cửa sổ, và `Viewer3D` chưa đo bề ngang ở đâu. Một `true` bịa ra sẽ dựng
 * trạng thái 7 của lớp phủ mà không có khung nhìn thu gọn nào đứng sau — đúng
 * thứ E.10 cấm.
 */

import { lazy, Suspense } from 'react';

/**
 * Hai lớp phủ nạp theo nhu cầu, không nhập tĩnh.
 *
 * Nhập tĩnh sáu panel và lớp phủ đẩy chunk của màn `viewer/Viewer3D` lên
 * **375,8 KiB trên ngân sách 280 KiB**. Cổng kích thước gói đòi tách chunk chứ
 * không nới số, nên cả hai xuống `lazy`.
 *
 * `WallGeometryEditor` chỉ dựng khi đang ở chế độ sửa hình học, nên nó gần như
 * miễn phí. `CollaborationLayer` thì dựng luôn — nạp động ở đây đổi một lượt
 * tải phụ lấy việc nó rời khỏi bao đóng tĩnh của màn; lớp phủ cộng tác không
 * phải thứ người dùng chờ ở khung hình đầu tiên.
 */
const CollaborationLayerContainer = lazy(async () => ({
  default: (await import('@/screens/system/CollaborationLayer')).CollaborationLayerContainer,
}));
const WallGeometryEditorContainer = lazy(async () => ({
  default: (await import('@/screens/viewer/WallGeometryEditor')).WallGeometryEditorContainer,
}));

export interface Viewer3DOverlaysProps {
  /** Chế độ sửa hình học tường đang bật. `false` ⇒ lớp phủ ấy không được dựng. */
  readonly isWallEditing: boolean;
  /** Bức tường đang sửa; `null` thì lớp phủ tự ở trạng thái "chưa chọn tường nào". */
  readonly wallId: string | null;
  /** Cả vùng chọn — nhiều tường thì lớp phủ chỉ cho đổi chiều cao. */
  readonly selectedWallIds: readonly string[];
  /** Camera đang ở phép chiếu trực giao của lát cắt ⇒ lớp phủ khoá việc sửa. */
  readonly isSectionOrthographic: boolean;
  /** "Xong", hoặc Esc ở lớp ngoài cùng — thoát chế độ sửa. */
  readonly onExitWallEditMode: () => void;
}

export function Viewer3DOverlays(props: Viewer3DOverlaysProps) {
  return (
    <>
      {/* Không có phần dự phòng nhìn thấy được: lớp phủ vắng mặt trong lúc chunk
          đang tải là đúng, một khung xương lơ lửng trên khung nhìn 3D thì không. */}
      <Suspense fallback={null}>
        <CollaborationLayerContainer />
      </Suspense>

      {props.isWallEditing && (
        <Suspense fallback={null}>
          <WallGeometryEditorContainer
            isCollapsed={false}
            isSectionOrthographic={props.isSectionOrthographic}
            onExitEditMode={props.onExitWallEditMode}
            selectedWallIds={props.selectedWallIds}
            wallId={props.wallId}
          />
        </Suspense>
      )}
    </>
  );
}
