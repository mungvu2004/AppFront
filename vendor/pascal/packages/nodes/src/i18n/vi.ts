/**
 * Bảng chuỗi tiếng Việt cho `packages/nodes` (F-15 T5b, A6).
 * Đối tượng `as const`, lồng theo loại node — không hàm `t()`, không thư viện i18n.
 * `wall/**` không nằm ở đây: khoá của nó thuộc việc gộp T4, xem `vi-T5b.fragment`.
 */
export const vi = {
  block: {
    catalogLabel: 'Khối',
    shortcuts: { place: 'Đặt khối', cancel: 'Huỷ' },
  },
  boxVent: {
    catalogLabel: 'Hộp thông gió',
    slots: { base: 'Đế', top: 'Mái' },
    shortcuts: { place: 'Đặt hộp thông gió lên mái', cancel: 'Huỷ' },
  },
  building: {
    catalogLabel: 'Toà nhà',
  },
  cabinet: {
    catalogLabel: 'Tủ mô-đun',
    moduleLabel: 'Mô-đun tủ',
    shortcuts: {
      place: 'Đặt tủ',
      placementType: 'Kiểu đặt',
      forcePlace: 'Đặt ép buộc',
      rotate: 'Xoay',
      cancelRun: 'Huỷ chuỗi / thoát',
    },
  },
  ceiling: {
    catalogLabel: 'Trần',
    catalogDescription: 'Mặt trần giới hạn theo đa giác, chứa đồ đạc gắn trần.',
    slotLabel: 'Trần',
    shortcuts: {
      traceOutline: 'Vẽ viền trần',
      finish: 'Hoàn tất trần',
      cancel: 'Huỷ',
    },
  },
  chimney: {
    catalogLabel: 'Ống khói',
    shortcuts: { place: 'Đặt ống khói lên mái', cancel: 'Huỷ' },
  },
  column: {
    catalogLabel: 'Cột',
    shortcuts: { place: 'Đặt cột', cancel: 'Huỷ' },
  },
  constructionDimension: {
    catalogLabel: 'Kích thước thi công',
    shortcuts: {
      pickWitnessPoint: 'Chọn điểm chuẩn',
      finishWitnesses: 'Hoàn tất các điểm chuẩn',
      placeDimensionLine: 'Đặt đường kích thước khi cần',
      removeLastWitness: 'Xoá điểm chuẩn cuối',
      stepBackOrCancel: 'Lùi lại hoặc huỷ',
    },
  },
  cupola: {
    catalogLabel: 'Chóp mái',
    slots: { base: 'Đế', body: 'Thân', roof: 'Mái', louvers: 'Lá chớp' },
    shortcuts: { place: 'Đặt chóp mái lên mái', cancel: 'Huỷ' },
  },
  door: {
    catalogLabel: 'Cửa',
    shortcuts: {
      place: 'Đặt cửa lên tường',
      flipSide: 'Đổi mặt',
      forcePlace: 'Đặt ép buộc',
      cancel: 'Huỷ',
    },
  },
  dormer: {
    catalogLabel: 'Cửa sổ mái',
    shortcuts: {
      place: 'Đặt cửa sổ mái lên mái',
      rotateGhost: 'Xoay hình mờ ±15°',
      cancel: 'Huỷ',
    },
  },
  downspout: {
    catalogLabel: 'Ống thoát nước mái',
    slots: { surface: 'Bề mặt' },
    shortcuts: {
      highlightOutlet: 'Tô sáng miệng thoát',
      drop: 'Thả ống thoát nước từ miệng thoát',
      cancel: 'Huỷ',
    },
  },
  ductFitting: {
    catalogLabel: 'Khớp nối ống gió',
    shortcuts: {
      place: 'Đặt khớp nối',
      snapOntoRun: 'Hút dính vào tuyến ống',
      rotate45: 'Xoay ±45°',
      switchAxis: 'Đổi trục xoay (Y → X → Z)',
      exit: 'Thoát',
    },
  },
  ductSegment: {
    catalogLabel: 'Ống gió',
    shortcuts: {
      startSegment: 'Bắt đầu đoạn ống',
      placeAndContinue: 'Đặt và tiếp tục',
      goVertical: 'Chuyển thẳng đứng ↕, bấm để đặt',
      diameterDownUp: 'Giảm / tăng đường kính ống',
      roundRectOval: 'Tròn / chữ nhật / oval',
      exitDrawing: 'Thoát vẽ',
    },
  },
  ductTerminal: {
    catalogLabel: 'Miệng gió',
    shortcuts: {
      place: 'Đặt miệng gió',
      mount: 'Gắn: sàn / trần / tường',
      rotate45FloorCeiling: 'Xoay ±45° (sàn / trần)',
      exit: 'Thoát',
    },
  },
  elevator: {
    catalogLabel: 'Thang máy',
    shortcuts: { place: 'Đặt thang máy', rotate: 'Xoay', cancel: 'Huỷ' },
  },
  eyebrowVent: {
    catalogLabel: 'Khe thông gió mái',
    slots: { hood: 'Mái che', louvers: 'Lá chớp' },
    shortcuts: { place: 'Đặt khe thông gió lên mái', cancel: 'Huỷ' },
  },
  fence: {
    catalogLabel: 'Hàng rào',
    shortcuts: { setStartEnd: 'Đặt điểm đầu / cuối hàng rào', cancel: 'Huỷ' },
  },
  guide: {
    catalogLabel: 'Đường dẫn',
  },
  gutter: {
    catalogLabel: 'Máng xối',
    slots: { gutter: 'Máng xối' },
    shortcuts: { place: 'Đặt máng xối lên mép mái', cancel: 'Huỷ' },
  },
  hvacEquipment: {
    catalogLabel: 'Thiết bị điều hoà',
    shortcuts: { place: 'Đặt thiết bị', rotate45: 'Xoay ±45°', exit: 'Thoát' },
  },
  importedMesh: {
    catalogLabel: 'Khối nhập từ tệp',
  },
  item: {
    catalogLabel: 'Đồ đạc',
    shortcuts: {
      place: 'Đặt đồ đạc',
      rotate: 'Xoay',
      cycleSnapping: 'Đổi kiểu hút dính',
      forcePlace: 'Đặt ép buộc',
      cancel: 'Huỷ',
    },
  },
  leanToExtension: {
    catalogLabel: 'Mái che',
    neighborEdgeLabel: 'Cạnh mái phụ liền kề',
    shortcuts: {
      placeOrSetNextPoint: 'Đặt mái che hoặc chọn điểm tiếp theo',
      rotateOrFlip: 'Xoay hoặc lật phía chuỗi',
      cycleShape: 'Đổi kiểu mái lệch / hai mái / cánh bướm',
      endOrCancel: 'Kết thúc chuỗi / huỷ',
    },
  },
  level: {
    catalogLabel: 'Tầng',
  },
  lineset: {
    catalogLabel: 'Tuyến cáp',
    shortcuts: {
      start: 'Bắt đầu tuyến cáp',
      placeLocked45: 'Đặt (khoá theo 45°)',
      goVertical: 'Chuyển thẳng đứng ↕, bấm để đặt',
      cancelStart: 'Huỷ điểm bắt đầu',
    },
  },
  liquidLine: {
    catalogLabel: 'Đường gas lỏng',
    shortcuts: {
      start: 'Bắt đầu đường gas lỏng',
      placeLocked45: 'Đặt (khoá theo 45°)',
      goVertical: 'Chuyển thẳng đứng ↕, bấm để đặt',
      followLineset: 'Theo: vẽ dọc tuyến cáp',
      cancel: 'Huỷ',
    },
  },
  measurement: {
    catalogLabel: 'Đo đạc',
    shortcuts: {
      placePoint: 'Đặt điểm đo',
      finish: 'Hoàn tất đo',
      removeLastPoint: 'Xoá điểm cuối',
      finishAndContinue: 'Hoàn tất và tiếp tục',
    },
  },
  pipeFitting: {
    catalogLabel: 'Khớp nối ống nước',
    shortcuts: {
      place: 'Đặt khớp nối',
      snapOntoRun: 'Hút dính vào tuyến ống',
      rotate45: 'Xoay ±45°',
      switchAxis: 'Đổi trục xoay (Y → X → Z)',
      exit: 'Thoát',
    },
  },
  pipeSegment: {
    catalogLabel: 'Ống thoát nước (DWV)',
    shortcuts: {
      startRun: 'Bắt đầu tuyến ống',
      placeAndContinue: 'Đặt và tiếp tục',
      wasteVent: 'Thoát nước / thông hơi',
      slopeLevel: 'Dốc / ngang',
      sizeDownUp: 'Giảm / tăng cỡ ống',
      verticalStack: 'Trục đứng ↕, bấm để đặt',
      exitDrawing: 'Thoát vẽ',
    },
  },
  pipeTrap: {
    catalogLabel: 'Xi phông',
    shortcuts: { place: 'Đặt bộ xi phông', rotate45: 'Xoay ±45°', exit: 'Thoát' },
  },
  proceduralItem: {
    catalogLabel: 'Đồ đạc dựng tự động',
  },
  ridgeVent: {
    catalogLabel: 'Khe thông gió nóc mái',
    shortcuts: { place: 'Đặt khe thông gió nóc lên mái', cancel: 'Huỷ' },
  },
  roof: {
    catalogLabel: 'Mái',
    shortcuts: {
      setFootprint: 'Đặt chu vi mái',
      placementGroup: 'Vị trí đặt',
      rotate90: 'Xoay hướng mái 90°',
      cancel: 'Huỷ',
      createFromGroup: 'Tạo từ',
      draw: 'Vẽ',
      room: 'Phòng',
    },
  },
  roofSegment: {
    catalogLabel: 'Đoạn mái',
  },
  scan: {
    catalogLabel: 'Chụp quét',
  },
  shelf: {
    catalogLabel: 'Kệ',
    shortcuts: { place: 'Đặt kệ', cancel: 'Huỷ' },
  },
  site: {
    catalogLabel: 'Khu đất',
    propertyLabel: 'Khu đất',
  },
  skylight: {
    catalogLabel: 'Cửa trời',
    shortcuts: { place: 'Đặt cửa trời lên mái', cancel: 'Huỷ' },
  },
  slab: {
    catalogLabel: 'Sàn bê tông',
    catalogDescription: 'Mặt sàn giới hạn theo đa giác, chứa đồ đạc đặt trên mặt sàn.',
    shortcuts: {
      traceOutline: 'Vẽ viền sàn',
      finish: 'Hoàn tất sàn',
      cancel: 'Huỷ',
    },
  },
  solarPanel: {
    catalogLabel: 'Tấm pin mặt trời',
    shortcuts: { place: 'Đặt tấm pin mặt trời lên mái', cancel: 'Huỷ' },
  },
  spawn: {
    catalogLabel: 'Điểm xuất phát',
    shortcuts: {
      place: 'Đặt điểm xuất phát',
      rotate: 'Xoay điểm xuất phát',
      cancel: 'Huỷ',
    },
  },
  stair: {
    catalogLabel: 'Cầu thang',
    shortcuts: { place: 'Đặt cầu thang', rotate: 'Xoay', cancel: 'Huỷ' },
  },
  stairSegment: {
    catalogLabel: 'Đoạn cầu thang',
  },
  structuralGrid: {
    catalogLabel: 'Lưới trục kết cấu',
    shortcuts: {
      startAxis: 'Bắt đầu trục lưới',
      finishAxis: 'Hoàn tất trục lưới',
      bypassSnapping: 'Bỏ qua hút dính',
      cancel: 'Huỷ',
    },
  },
  turbineVent: {
    catalogLabel: 'Chóp hút gió',
    slots: { base: 'Đế', head: 'Đầu' },
    shortcuts: { place: 'Đặt chóp hút gió lên mái', cancel: 'Huỷ' },
  },
  unit: {
    catalogLabel: 'Căn hộ',
  },
  /** `wall/**` do việc gộp M1 áp dụng (xem `vi-T5b.fragment`). */
  wall: {
    catalogLabel: 'Tường',
    presentationDescription:
      'Đoạn tường thẳng hoặc cong. Chứa cửa đi, cửa sổ, phần mở rộng mái lệch và vật gắn tường.',
    shortcuts: {
      setStartEnd: 'Đặt điểm đầu / cuối tường',
      shape: 'Hình dạng',
      shapeLine: 'Hình dạng: đường thẳng',
      shapeRectangle: 'Hình dạng: hình chữ nhật',
      shapeTooltip: 'Hình dạng tường — bấm hoặc nhấn R để đổi',
      cancel: 'Huỷ',
      splitAtMarks: 'Chia tại các vết đánh dấu',
      cuts: 'Vết cắt',
      cutsOne: 'Vết cắt: 1',
      cutsEven: (count: string) => `Vết cắt: ${count}, chia đều`,
      cutsTooltip: 'Số vết cắt — cuộn hoặc bấm để đổi',
      freePlacement: 'Đặt tự do',
    },
  },
  window: {
    catalogLabel: 'Cửa sổ',
    shortcuts: {
      place: 'Đặt cửa sổ lên tường',
      flipSide: 'Đổi mặt',
      forcePlace: 'Đặt ép buộc',
      cancel: 'Huỷ',
    },
  },
  zone: {
    catalogLabel: 'Vùng',
    catalogDescription: 'Vùng khu đất dạng đa giác (cỏ, nước, lát nền) với vật liệu chuyển sắc.',
    slotLabel: 'Vùng',
  },
} as const
