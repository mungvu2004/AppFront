export const vi = {
  gpuFallback: {
    title: 'Trình xem 3D không khả dụng',
    body: 'Trình duyệt hoặc môi trường này không khởi tạo được WebGPU hay WebGL, nên Pascal không dựng được cảnh 3D ở đây. Hãy mở trình soạn trong một trình duyệt có bật gia tốc phần cứng.',
  },
  sectionPlane: {
    label: 'Mặt cắt',
    off: 'Tắt mặt cắt',
  },
  viewCube: {
    ariaLabel: 'Hướng nhìn',
    faces: {
      top: 'Trên',
      front: 'Trước',
      back: 'Sau',
      left: 'Trái',
      right: 'Phải',
      iso: 'Phối cảnh',
    },
  },
  perfPanel: {
    dockAriaLabel: 'Ghim bảng sang cạnh',
    triangles: 'Tam giác',
    thousand: 'nghìn',
  },
} as const
