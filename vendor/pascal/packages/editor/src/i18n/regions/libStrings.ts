// Chuỗi tiếng Việt cho các tệp lib/* của gói pascal (editor) — xem CLAUDE.md gốc cho
// quy ước đặt tên và vốn từ. Chỉ gom các chuỗi thật sự hiển thị cho người dùng (nhãn
// trong bảng kê xuất ra, văn bản hộp thoại xuất...), không gom log/console/so sánh nội bộ.
export const libStrings = {
  // Tên hiển thị mặc định của node trên cây và bảng thuộc tính (không đổi id/kind).
  nodeDisplay: {
    slab: 'Sàn',
  },
  glbExport: {
    item: 'Đồ đạc',
    wall: 'Tường',
    door: 'Cửa',
    window: 'Cửa sổ',
    cabinet: 'Tủ',
    slab: 'Sàn',
    ceiling: 'Trần',
    roof: 'Mái',
    fence: 'Hàng rào',
    column: 'Cột',
    stairs: 'Cầu thang',
  },
  floorplanExport: {
    floorPlanFallback: 'Mặt bằng',
    constructionSchedulesTitle: (levelLabel: string) => `${levelLabel} - Bảng kê thi công`,
    scheduleTitleContinued: (title: string) => `${title} (TIẾP THEO)`,
    scheduleIssueWarning: (issue: string) => `CẢNH BÁO: ${issue}`,
    levelFallback: (index: number) => `Tầng ${index}`,
  },
  printShellCompiler: {
    noShellMeshes: 'Không có lưới kết cấu nào để dựng khối bằng Manifold.',
    inputFailed: (nodeId: string, detail: string) => `Phần tử ${nodeId}: ${detail}`,
    inputRejected: 'Manifold từ chối dữ liệu vỏ đưa vào.',
    unionFailed: (status: string) => `Hợp khối Manifold thất bại với ${status}.`,
    noPrintableTriangles: 'Manifold không tạo ra tam giác nào in được.',
    compileFailed: 'Dựng khối Manifold thất bại.',
    workerUnavailable: 'Web Worker không khả dụng trong môi trường này.',
    workerFailed: 'Worker Manifold đã gặp lỗi.',
    workerUnreadableResponse: 'Worker Manifold trả về phản hồi không đọc được.',
    workerTimedOut: (seconds: number) => `Worker Manifold vượt quá ${seconds} giây.`,
    workerStartFailed: 'Không thể khởi động worker Manifold.',
    compiledWithDuration: (durationMs: string, offMainThread: boolean) =>
      `Dựng khối bằng Manifold trong ${durationMs}${
        offMainThread ? ' ngoài luồng chính' : ' qua bộ chạy thử trong tiến trình'
      }.`,
  },
  print3mf: {
    defaultTitle: 'Pascal - bản xuất để in',
    printModelName: 'Pascal - mô hình in',
  },
  parcelProvider: {
    noParcelService: 'Không có dịch vụ lô đất nào khả dụng.',
  },
  lotDropIn: {
    typeAddressFirst: 'Nhập địa chỉ trước đã.',
    parcelLookupFailed: 'Không tra được lô đất.',
    noParcelFound: 'Không tìm thấy lô đất cho địa chỉ đó.',
    noParcelReason: (reason: string) => `Không có lô đất: ${reason}`,
    parcelGeometryUnusable: 'Hình học lô đất không dùng được.',
    buildingRecentred: 'Đã đưa toà nhà về giữa lô',
    roadsUnavailable: (reason: string) => `Không lấy được đường (${reason})`,
    pascalMapUnavailable: (reason: string) => `Không lấy được Pascal Map (${reason})`,
  },
  lotTerrain: {
    noLotRing: 'Không có đường bao lô đất',
    elevationLookupFailed: 'Không tra được cao độ',
    noElevations: 'Không có cao độ nào',
    tooFewElevations: (valid: number, total: number) =>
      `Quá ít cao độ (${valid} trong ${total})`,
    noParcelOrigin: 'Không có gốc toạ độ lô đất',
    noTerrain: 'Không có địa hình',
    groundFlatWithin: (inches: number) => `Mặt đất phẳng trong khoảng ${inches}" (USGS)`,
    reliefAcrossLot: (feet: string, points: number, unread: number) =>
      `Địa hình: chênh ${feet}' trên lô đất (USGS, ${points} điểm${
        unread > 0 ? `, ${unread} điểm chưa đọc được` : ''
      })`,
    terrainReadFailed: (reason: string) =>
      `Không đọc được địa hình (${reason}) — mặt đất vẫn phẳng cho tới khi đọc được`,
  },
  levelPrintExport: {
    spanningNodeOmitted: (nodeType: string, id: string) =>
      `${nodeType} ${id} chạy xuyên nhiều tầng nên đã bị bỏ qua. Ẩn nó hoặc chia tách rõ ràng trước khi tải các phần theo tầng.`,
    noVisibleLevels: 'Không còn tầng nào hiển thị trong phạm vi in.',
    invalidPlinthDimensions: 'Mép bệ phải không âm và độ dày bệ phải lớn hơn không.',
    multiplePlinthBuildings: 'Bệ hiện chỉ áp dụng khi phạm vi in chứa đúng một toà nhà.',
    plinthMissingFootprint: 'Tầng thấp nhất đang hiển thị không có biên dạng để tạo bệ.',
    plinthLabel: 'Bệ',
    plinthExperimentalNotice:
      'Bệ là một phần hình chữ nhật riêng, suy ra từ biên dạng của tầng thấp nhất; việc tạo hình theo mặt bằng và điểm nối chưa được hỗ trợ.',
    levelPartsNoticeWorker:
      'Các phần theo tầng dùng cao độ tầng đã lưu và bộ dựng khối bán tự động chạy ở worker (Manifold); kích thước tường, sàn, mái và bệ đã biết được đo, còn các chi tiết mỏng phát hiện từ lưới và phần tự giao chưa được xử lý.',
    levelPartsNoticeSync:
      'Các phần theo tầng dùng cao độ tầng đã lưu và bộ dựng khối bán tự động (thử nghiệm, chạy đồng bộ); kích thước tường, sàn, mái và bệ đã biết được đo, còn việc chạy ở worker, chi tiết mỏng phát hiện từ lưới và phần tự giao chưa được xử lý.',
    levelPartsNoticeBasic:
      'Các phần theo tầng dùng cao độ tầng đã lưu và tách theo ý nghĩa kiến trúc, nhưng chưa được hợp khối thành vỏ in được.',
    levelPartsPackageName: 'Pascal - các phần theo tầng',
  },
  schedules: {
    verifyRoughOpening: 'Kiểm tra lại khung thô (R.O.)',
    exterior: 'Mặt ngoài',
    opening: 'Ô mở',
    hardwareNone: 'Không có',
    hardwareCloser: 'Bộ đóng cửa',
    hardwarePanicBar: 'Thanh thoát hiểm',
    hardwareThreshold: 'Ngưỡng cửa',
    hardwareStandard: 'Tiêu chuẩn',
    roomMissingNumber: (name: string) => `Phòng ${name} không có số phòng`,
    duplicateRoomNumber: (number: string, count: number) =>
      `Số phòng ${number} bị trùng (${count} phòng)`,
  },
} as const
