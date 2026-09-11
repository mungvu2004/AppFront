/**
 * Những cánh cửa của màn `/m/du-an/:projectId` không đi qua react-query, và
 * những phép CHIẾU thuần từ dữ liệu có sẵn xuống hình dạng của
 * `mobileViewerTypes.ts`.
 *
 * ## Ba cửa, và vì sao chỉ ba
 *
 * Khảo sát `data-mobile-contract.md` mục (b) đã chốt: tầng · tường · phòng
 * KHÔNG đi qua mạng. Chúng đọc từ đồ thị `NormalizedSpatial` trong kho, và
 * `useMobileViewer` đọc kho bằng `useStore` để lượt vẽ lại xảy ra khi đồ thị
 * đổi — nên "đọc đồ thị" không phải một cửa của cổng này. Cái CÒN LẠI đi ra
 * ngoài ứng dụng đúng bốn thứ: một lượt HTTP lấy tên dự án, một bộ theo dõi
 * mạng, và hai lối ra trình duyệt (mở ứng dụng thư, chép vào bộ nhớ tạm).
 *
 * ## Chép khuôn `useViewer3D`, KHÔNG chép `useViewerShell`
 *
 * `useViewerShell.ts:409-410` mặc định dùng cổng GIẢ — chạy êm, không báo gì,
 * và hiện đúng bộ mẫu bốn tầng trên MỌI dự án thật. `useViewer3D.ts:386-388`
 * mặc định ngược lại: cổng thật đọc kho. Màn này theo `useViewer3D`. Bản giả
 * chỉ vào được bằng cách truyền tường minh vào `createMobileViewerGateway`.
 *
 * ## Phần chiếu: chọn TẬP CON, không viết công thức mới
 *
 * `P-03 "viewmodel gọn cho di động"` KHÔNG TỒN TẠI — khảo sát mục (c) đã chạy
 * `rg -n "compact|mobile" src/lib/viewmodel` và không có kết quả nào. Nên cách
 * đúng là gọi `toViewModel` y hệt máy tính rồi LỌC `attributes`: một phép chọn
 * tập con thuần trên một mảng đã có thứ tự, không phải một phép tính thứ hai.
 * Mọi con số ra màn hình vẫn do `src/lib/format` (A15, dấu thập phân là dấu
 * phẩy), và mọi phép đo vẫn do `src/domain/measure` (M-15).
 */

import { mockApiClient } from '@/api/__mocks__/client';
import type { ProjectsApi } from '@/api/client';
import type { Measurement } from '@/domain/measure/measure';
import { MEASUREMENT_LABELS } from '@/domain/measure/measure';
import { isEntityOfKind, type NormalizedSpatial } from '@/domain/spatial/normalize';
import type { LevelId } from '@/domain/spatial/types';
import { formatAngle, formatArea, formatLength } from '@/lib/format/measure';
import { createNetworkMonitor, type NetworkMonitor } from '@/lib/offline/networkMonitor';
import type { SelectableKind } from '@/lib/selection/selectionOps';
import type { EntityHit } from '@/lib/three/interaction/hitTest';
import { toViewModel } from '@/lib/viewmodel/toViewModel';
import type { ViewAttribute, ViewModel } from '@/lib/viewmodel/types';
import type { ViewerStorey } from '@/screens/viewer/ViewerShell';

import type {
  MobileViewerFloor,
  MobileViewerInfoRow,
  MobileViewerMeasurement,
  MobileViewerSelection,
} from './mobileViewerTypes';

/* -------------------------------------------------------------------------- */
/* 1. Cổng.                                                                    */
/* -------------------------------------------------------------------------- */

/** Bốn cửa ra ngoài ứng dụng, gom lại để một bài kiểm thay được cả bốn. */
export interface MobileViewerGateway {
  /** Cổng hẹp cho lượt đọc tên dự án; `projectDetailQueryOptions` nhận đúng cái này. */
  readonly projectsApi: Pick<ProjectsApi, 'read'>;
  /** T-09: dựng bộ theo dõi mạng. Gọi một lần cho mỗi lần gắn màn. */
  readonly createMonitor: () => NetworkMonitor;
  /** Mở ứng dụng thư của máy bằng một địa chỉ `mailto:`. */
  readonly openMail: (href: string) => void;
  /** Chép một chuỗi vào bộ nhớ tạm; `false` khi máy không cho. */
  readonly copyText: (text: string) => Promise<boolean>;
}

/** Lối ra `mailto:` thật — điều hướng trình duyệt, không phải một lượt gọi mạng. */
function openMailInBrowser(href: string): void {
  if (typeof globalThis.location === 'undefined') {
    return;
  }

  globalThis.location.href = href;
}

/** Bộ nhớ tạm thật; máy không cấp quyền thì trả `false`, không ném. */
async function copyToClipboard(text: string): Promise<boolean> {
  const clipboard = globalThis.navigator?.clipboard as Clipboard | undefined;

  if (clipboard === undefined) {
    return false;
  }

  try {
    await clipboard.writeText(text);

    return true;
  } catch {
    return false;
  }
}

/**
 * Cổng thật, với chỗ tiêm cho từng cửa.
 *
 * @param overrides Cửa nào được truyền thì thay cửa thật; vắng thì dùng bản thật.
 * @returns Cổng đủ bốn cửa.
 */
export function createMobileViewerGateway(
  overrides: Partial<MobileViewerGateway> = {},
): MobileViewerGateway {
  return {
    projectsApi: overrides.projectsApi ?? mockApiClient.projects,
    createMonitor: overrides.createMonitor ?? ((): NetworkMonitor => createNetworkMonitor()),
    openMail: overrides.openMail ?? openMailInBrowser,
    copyText: overrides.copyText ?? copyToClipboard,
  };
}

/* -------------------------------------------------------------------------- */
/* 2. Mạng yếu — T-09.                                                         */
/* -------------------------------------------------------------------------- */

/**
 * "Mạng yếu" khác "mất mạng", và `NetworkMonitorStatus` phân biệt được.
 *
 * `status.online` là phép AND của hai trường, nên nó chỉ trả lời có/không.
 * Mạng YẾU là cảnh máy vẫn báo có kết nối vật lý (`browserOnline`) trong khi
 * lượt ping tới máy chủ không kịp trong `pingTimeoutMs` (`pingOnline === false`)
 * — đúng thứ xảy ra ở công trường. Mất hẳn là `browserOnline === false`, một
 * cảnh khác, và màn này đưa cả hai về `partial`: phần mô hình đã có trong kho
 * vẫn xem được, chỉ phần chưa tải về là thiếu.
 */
export function isNetworkDegraded(status: {
  readonly browserOnline: boolean;
  readonly pingOnline: boolean;
}): boolean {
  return !status.browserOnline || !status.pingOnline;
}

/* -------------------------------------------------------------------------- */
/* 3. Tầng.                                                                    */
/* -------------------------------------------------------------------------- */

/** Tiền tố cho một tầng chưa mang tên trong đồ thị. */
const UNNAMED_FLOOR_PREFIX = 'tầng ';

/** Mã vùng để hạ chữ hoa của nhãn tầng — cùng mã vùng `src/lib/format/number` dùng. */
const LOCALE = 'vi-VN';

/** Nhãn một tầng, viết thường kiểu câu (A6). Đồ thị chưa đặt tên thì gọi theo thứ tự. */
function floorLabelOf(storey: ViewerStorey): string {
  const name = storey.name.trim();

  return name === ''
    ? `${UNNAMED_FLOOR_PREFIX}${String(storey.order)}`
    : name.toLocaleLowerCase(LOCALE);
}

/**
 * Một tầng đã dựng xong hình thật chưa.
 *
 * Cùng phép đọc mà `shellDataOf` dùng để đặt `isPartial`: một tầng CÓ hình khi
 * đồ thị đã mang ít nhất một phòng trên tầng ấy. Đọc qua `byLevel` và
 * `isEntityOfKind` — hai cửa công khai của `src/domain/spatial` — chứ không
 * dựng lại chỉ mục riêng.
 */
function isFloorLoaded(spatial: NormalizedSpatial, levelId: LevelId): boolean {
  const ids = spatial.byLevel[levelId];

  if (ids === undefined) {
    return false;
  }

  return ids.some((id) => {
    const entity = spatial.byId[id];

    return entity !== undefined && isEntityOfKind('room', entity);
  });
}

const EMPTY_FLOORS: readonly MobileViewerFloor[] = Object.freeze([]);

/** Dải tầng của thanh dưới, theo thứ tự từ dưới lên mà `storeysOf` đã sắp. */
export function floorsOf(
  spatial: NormalizedSpatial | null,
  storeys: readonly ViewerStorey[],
): readonly MobileViewerFloor[] {
  if (spatial === null) {
    return EMPTY_FLOORS;
  }

  return storeys.map((storey) => ({
    id: storey.id,
    label: floorLabelOf(storey),
    isLoaded: isFloorLoaded(spatial, storey.id),
  }));
}

/* -------------------------------------------------------------------------- */
/* 4. Thứ đang chọn — tấm thông tin CHỈ ĐỌC.                                   */
/* -------------------------------------------------------------------------- */

/** Tên tiếng Việt của từng loại đối tượng bắt được, viết thường kiểu câu (A6). */
export const MOBILE_KIND_LABELS: Readonly<Record<SelectableKind, string>> = Object.freeze({
  wall: 'tường',
  opening: 'ô mở',
  room: 'phòng',
  furniture: 'đồ nội thất',
  axis: 'trục',
  dimension: 'kích thước',
});

/**
 * Thuộc tính nào SỐNG SÓT trên điện thoại, theo loại.
 *
 * Quyết định nghiệp vụ của khảo sát mục (c), không phải một hàm có sẵn nào: giữ
 * đúng những con số một kỹ sư đứng tại chỗ đối chiếu được với thước dây, bỏ
 * những thứ chỉ có nghĩa khi ngồi duyệt (độ tin cậy của AI — cũng là thứ A5
 * cấm đọc thành "đã xác minh" — và các phép đếm).
 *
 * Nhãn chép NGUYÊN VĂN từ `toViewModel`: đó là nguồn sự thật đang chạy trên máy
 * tính, và hạ chữ hoa ở đây sẽ đẻ ra một bản chữ khác chỉ có trên di động.
 */
const KEPT_ATTRIBUTES: Readonly<Record<SelectableKind, readonly string[]>> = Object.freeze({
  wall: Object.freeze(['Bề dày', 'Chiều dài']),
  opening: Object.freeze(['Bề rộng', 'Chiều cao']),
  room: Object.freeze(['Diện tích']),
  furniture: Object.freeze(['Chiều rộng', 'Chiều sâu']),
  axis: Object.freeze([]),
  dimension: Object.freeze([]),
});

/** Một `ViewAttribute` xuống một dòng của tấm thông tin. `value` đã là chuỗi đã định dạng. */
function toInfoRow(attribute: ViewAttribute): MobileViewerInfoRow {
  return {
    id: attribute.label,
    label: attribute.label,
    value: attribute.unit === undefined ? attribute.value : `${attribute.value} ${attribute.unit}`,
  };
}

/** `toViewModel` cho đúng loại của một thực thể, hoặc `null` khi loại không có viewmodel. */
function viewModelOf(spatial: NormalizedSpatial, entityId: string): ViewModel | null {
  const entity = spatial.byId[entityId];

  if (entity === undefined) {
    return null;
  }

  if (isEntityOfKind('wall', entity)) {
    return toViewModel({ kind: 'wall', wall: entity });
  }

  if (isEntityOfKind('opening', entity)) {
    return toViewModel({ kind: 'opening', opening: entity });
  }

  if (isEntityOfKind('room', entity)) {
    return toViewModel({ kind: 'room', room: entity });
  }

  if (isEntityOfKind('furniture', entity)) {
    return toViewModel({ kind: 'furniture', furniture: entity });
  }

  // Trục và kích thước không có bản dựng nào trong `src/lib/viewmodel` — năm
  // hàm ở đó phủ tường, ô mở, phòng, đồ nội thất và vi phạm. Chạm trúng một
  // trong hai loại ấy là "không có gì để nói", không phải một sự cố.
  return null;
}

/**
 * Một cú chạm trúng đối tượng → tấm thông tin chỉ đọc.
 *
 * @param hit Thứ cảnh 3D bắt được, hoặc `null` khi chạm vào chỗ trống.
 * @param spatial Đồ thị đang xem.
 * @param canEditOnDesktop Vai của người đang xem CÓ sửa được trên máy tính không.
 * @returns `null` khi không còn gì để hiện.
 */
export function selectionOf(
  hit: EntityHit | null,
  spatial: NormalizedSpatial | null,
  canEditOnDesktop: boolean,
): MobileViewerSelection | null {
  if (hit === null || spatial === null) {
    return null;
  }

  const model = viewModelOf(spatial, hit.entityId);

  if (model === null) {
    return null;
  }

  const kept = KEPT_ATTRIBUTES[hit.kind];

  return {
    entityId: hit.entityId,
    kindLabel: MOBILE_KIND_LABELS[hit.kind],
    title: model.label,
    rows: model.attributes.filter((attribute) => kept.includes(attribute.label)).map(toInfoRow),
    // Câu mời "mở trên máy tính để sửa" chỉ có nghĩa với người THẬT SỰ sửa
    // được ở đó. Với vai chỉ xem, sửa là việc không xảy ra ở đâu cả, nên màn
    // không mời — thà không có câu nào còn hơn một câu dẫn tới ngõ cụt.
    needsDesktopToEdit: canEditOnDesktop && kept.length > 0,
  };
}

/* -------------------------------------------------------------------------- */
/* 5. Đo — M-15.                                                               */
/* -------------------------------------------------------------------------- */

/** Con số HEADLINE của mỗi loại phép đo — cái người ta chấm hai điểm để biết. */
function measurementValueLabel(measurement: Measurement): string {
  switch (measurement.kind) {
    case 'distance':
    case 'perpendicular':
      return formatLength(measurement.lengthMm);
    case 'chain':
      return formatLength(measurement.totalMm);
    case 'height':
      return formatLength(measurement.heightMm);
    case 'area':
      return formatArea(measurement.areaM2);
    case 'angle':
      return formatAngle(measurement.angleDeg);
  }
}

/**
 * Một phép đo đã xong → một dòng đã định dạng.
 *
 * Không có phép tính nào ở đây: `measurement` đã mang sẵn số milimét do
 * `src/domain/measure` tính, và định dạng đi qua `src/lib/format/measure` nên
 * dấu thập phân là dấu phẩy và đơn vị tự đổi mm ↔ m ở ngưỡng của repo (A15).
 */
export function toMobileMeasurement(
  measurement: Measurement,
  id: string,
): MobileViewerMeasurement {
  return {
    id,
    kindLabel: MEASUREMENT_LABELS[measurement.kind],
    valueLabel: measurementValueLabel(measurement),
  };
}

/* -------------------------------------------------------------------------- */
/* 6. Gửi liên kết qua thư — X-04.                                             */
/* -------------------------------------------------------------------------- */

/** Dòng chủ đề của thư, đứng trước tên dự án. */
const MAIL_SUBJECT_PREFIX = 'liên kết xem mô hình dự án ';

/**
 * Câu giải thích trong thân thư.
 *
 * Đặc tả cấm "một nút xám không giải thích": người nhận phải hiểu vì sao họ
 * được gửi một đường dẫn, và người gửi phải thấy trước mình sắp gửi cái gì.
 */
const MAIL_BODY_LEAD =
  'mục này chỉ sửa được trên máy tính, nên đây là liên kết mở đúng dự án đó bằng trình duyệt máy tính:';

/**
 * Địa chỉ `mailto:` cho nút "gửi liên kết sang máy tính".
 *
 * Khảo sát mục (g) đã chạy `rg -in "mailto|sendEmail"` trên cả `src` và chốt
 * NOT FOUND: không có đường gửi thư nào trong repo, `ShareLinkGateway` chỉ biết
 * tạo · liệt kê · thu hồi. Nên đường hợp lệ duy nhất là tạo liên kết thật rồi
 * bàn giao cho ứng dụng thư của máy. `mailto:` là điều hướng trình duyệt, không
 * phải một lượt gọi mạng, nên nó không đi qua `src/lib/http` và không phạm
 * `local/no-fetch-outside-http`.
 */
export function desktopLinkMailtoHref(projectName: string, url: string): string {
  const subject = encodeURIComponent(`${MAIL_SUBJECT_PREFIX}${projectName}`);
  const body = encodeURIComponent(`${MAIL_BODY_LEAD}\n\n${url}`);

  return `mailto:?subject=${subject}&body=${body}`;
}
