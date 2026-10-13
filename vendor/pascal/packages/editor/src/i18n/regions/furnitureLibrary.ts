// Chuỗi tiếng Việt cho bảng phụ "Thư viện đồ đạc" của editor Pascal
// (components/ui/panels/furniture-library-panel.tsx, components/ui/item-catalog).
// Nhãn viết hoa chữ đầu (AppFront A6). Chín nhóm dưới đây chép đúng nhãn của màn
// `src/screens/viewer/FurnitureLibraryPanel` để người dùng không phải học lại tên nhóm.

export const furnitureLibrary = {
  title: "Thư viện đồ đạc",
  searchLabel: "Tìm đồ đạc",
  searchPlaceholder: "Tên hoặc nhóm, không cần dấu",
  groupLabel: "Nhóm nội thất",
  readOnlyNotice: "Vai chỉ xem: không thêm được đồ đạc",
  monochromeNotice: "Thẻ đơn sắc để màu nhấn chỉ dành cho thứ bấm được",
  emptyTitle: "Không có đồ đạc nào khớp",
  emptyBody: "Bỏ dấu, bớt chữ, hoặc chọn nhóm khác.",
  count: (shown: number) => `${shown} mẫu`,

  group: {
    all: "Tất cả",
    table: "Bàn",
    chair: "Ghế",
    bed: "Giường",
    sofa: "Ghế sofa",
    cabinet: "Tủ kệ",
    sanitary: "Thiết bị vệ sinh",
    kitchen: "Bếp",
    equipment: "Thiết bị kỹ thuật",
    mine: "Của tôi",
  },
} as const;
