// Gợi ý phím ở ô trợ giúp ngữ cảnh khi đang chọn đối tượng (lib/contextual-help.ts).
// Nhãn viết hoa chữ đầu (AppFront A6).
import { toFixedVi } from "../format";

export const contextualHelp = {
  addOrRemove: "Thêm hoặc bỏ đối tượng khỏi vùng chọn",
  moveSelection: "Bấm hoặc kéo vùng chọn để di chuyển cả nhóm",
  rotateSelection: "Xoay vùng chọn ±45°",
  groupSelection: "Gộp vùng chọn (chỉ trong phiên)",
  ungroupSelection: "Tách nhóm của phiên",
  clearSelection: "Bỏ chọn (hoặc bấm ra ngoài)",
  mepRunHandle: "Bấm chấm điều khiển để hiện mũi tên di chuyển",
  mepRunDetach: "Tách mối nối khi kéo mũi tên",
  mepFittingHandle: "Bấm chấm điều khiển để hiện tay nắm di chuyển và xoay",
  mepFittingRotate: "Xoay phụ kiện ±45°",
  mepFittingAxis: "Đổi trục xoay (Y → X → Z)",
  dragMovable: "Kéo đối tượng đang chọn",
  rotateSelected: "Kéo sang trái hoặc phải để xoay đối tượng đang chọn",
  openingRadius: "Chỉnh bán kính góc của một cạnh",
  // Nhãn ba thao tác máy ảnh ở hộp gợi ý đỉnh canvas (khoá theo CameraHintAction).
  cameraAction: { Pan: "Kéo", Rotate: "Xoay", Zoom: "Thu phóng" },
  // Bảng gợi ý công cụ tường: chip chế độ bắt điểm, bước lưới, kiểu liên tục (F-15 H7).
  snapModeLabel: { grid: "Lưới", lines: "Đường gióng", angles: "Góc", off: "Tắt" },
  snapping: (mode: string) => `Bắt điểm: ${mode}`,
  snappingTooltip: "Chế độ bắt điểm — bấm hoặc nhấn Shift để đổi",
  gridStep: (value: number) => `Lưới: ${toFixedVi(value, 2)} m`,
  gridStepTooltip: "Bước lưới — bấm hoặc nhấn Ctrl để đổi",
  wallContinuation: { room: "Phòng (tự khép)", single: "Tường đơn" },
} as const;
