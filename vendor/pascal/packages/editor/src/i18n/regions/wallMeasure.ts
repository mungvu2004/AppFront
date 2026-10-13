// Chuỗi của công cụ tường và công cụ đo (F-15 W2-B).
export const wallMeasure = {
  /** Nhãn của bốn loại bắt điểm khi vẽ/kéo tường (#7). */
  snapLabels: {
    endpoint: "Đầu mút",
    midpoint: "Giữa",
    intersection: "Giao điểm",
    wall: "Vuông góc",
    gridIntersection: "Giao trục",
  },
  /** Tên mặc định của phép đo vừa ghim (#62). */
  measurementName: (index: number) => `Phép đo ${index}`,
  /** Lỗi của bản nháp phép đo (A6). */
  draftErrors: {
    levelChanged: "Tầng đang xem đã đổi. Hãy bắt đầu một phép đo mới.",
    notPlanar: "Các điểm đo phải nằm trên cùng một mặt phẳng.",
    noArea: "Các điểm đo phải bao quanh một diện tích.",
    /** #67: vai chỉ xem đo được nhưng không ghim. */
    readOnlyPin: "Vai chỉ xem đo được nhưng không ghim được phép đo vào mô hình.",
  },
  /** Bảng "Bảng đỉnh" — sửa toạ độ hai đầu tường bằng số (#11). */
  vertexTable: {
    title: "Bảng đỉnh",
    empty: "Chọn một bức tường để sửa toạ độ hai đầu của nó.",
    readOnly: "Vai chỉ xem không sửa được đỉnh tường.",
    corner: "Đỉnh",
    cornerName: { start: "Đầu A", end: "Đầu B" },
    x: "Toạ độ x (m)",
    y: "Toạ độ y (m)",
    fieldLabel: (corner: string, axis: "x" | "y") => `Toạ độ ${axis} của ${corner}`,
    nudgeUp: (field: string) => `Tăng ${field} 10 mm`,
    nudgeDown: (field: string) => `Giảm ${field} 10 mm`,
    invalid: "Giá trị chưa hợp lệ nên toạ độ đã trở về số cũ.",
    hint: "Phím mũi tên lên/xuống dịch 10 mm, giữ Shift để dịch 100 mm. Tường nối ở đỉnh đi theo.",
  },
} as const;
