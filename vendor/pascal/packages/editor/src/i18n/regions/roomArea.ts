// Chuỗi tiếng Việt cho bảng "Diện tích phòng" và lưới thẻ đồ đạc của editor Pascal
// (lib/floorplan/room-area.ts, components/ui/panels/room-area-panel.tsx,
// components/ui/item-catalog). Nhãn viết hoa chữ đầu (AppFront A6); số dùng dấu phẩy
// thập phân qua i18n/format (A15).

export const roomArea = {
  title: "Diện tích phòng",
  total: "Tổng diện tích",
  subtotal: "Tổng phụ",
  unnamedRoom: "Phòng chưa đặt tên",
  unknownLevel: "Tầng không rõ",
  noOccupancy: "Chưa đặt công năng",
  otherBand: "Khác",
  unmeasurable: (name: string) => `Không đo được "${name}" — đường bao chưa kín`,

  column: {
    number: "Số phòng",
    name: "Tên phòng",
    occupancy: "Công năng",
    area: "Diện tích",
  },

  groupBy: "Nhóm theo",
  groupByLevel: "Tầng",
  groupByOccupancy: "Công năng",
  sortBy: "Sắp xếp",
  sortAreaDesc: "Diện tích giảm dần",
  sortAreaAsc: "Diện tích tăng dần",
  sortName: "Tên phòng",
  levelFilter: "Lọc tầng",
  allLevels: "Mọi tầng",

  collapsed: "Thu gọn",
  collapsedHint: (count: number) => `${count} phòng lớn nhất`,
  fullTable: "Bảng toàn trang",
  copyTable: "Sao chép bảng",
  copied: "Đã sao chép bảng",

  statusLegend: "Chú giải",
  statusTrusted: "Máy đọc, chưa soát",
  statusSuspect: "Máy đọc, cần soát",
  statusReviewed: "Người duyệt đã xác minh",
  areaFormula: "Diện tích tính theo đường bao trong của tường (công thức dây giày)",
  openings: (doors: number, windows: number) => `${doors} cửa · ${windows} cửa sổ`,
  perimeter: "Chu vi",
  ceilingHeight: "Cao",

  emptyTitle: "Chưa có phòng nào đo được",
  emptyBody: "Phòng chỉ hiện ở đây khi đường bao tường đã kín.",
  detectSpaces: "Kiểm tra khe hở tường",
  gapsClosed: (rooms: number) => `Tìm thấy ${rooms} vùng kín — mở lại bảng để xem`,
  gapsOpen: "Chưa có vùng nào kín — còn khe hở giữa các tường",

  renameLabel: (name: string) => `Đổi tên phòng ${name}`,
  renamed: (name: string) => `Đã đổi tên thành "${name}"`,
  undoRename: "Hoàn tác",
  readOnlyRename: "Vai chỉ xem không đổi được tên phòng",
} as const;
