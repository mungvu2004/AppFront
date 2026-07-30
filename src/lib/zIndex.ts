// Thang z-index chuẩn của hệ thống. Mọi nơi phải dùng hằng này, cấm z-index rời.
export const Z_INDEX = {
  canvas: 0,
  canvasOverlay: 10,
  panel: 20,
  statusBar: 30,
  dropdown: 40,
  drawer: 50,
  modal: 60,
  commandPalette: 70,
  toast: 80,
  tooltip: 90
} as const;
