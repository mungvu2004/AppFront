// Chuỗi của công cụ tường và công cụ đo (F-15 W2-B).
export const wallMeasure = {
  /** Nhãn của bốn loại bắt điểm khi vẽ/kéo tường (#7). */
  snapLabels: {
    endpoint: "Đầu mút",
    midpoint: "Giữa",
    intersection: "Giao điểm",
    wall: "Vuông góc",
  },
  /** Tên mặc định của phép đo vừa ghim (#62). */
  measurementName: (index: number) => `Phép đo ${index}`,
} as const;
