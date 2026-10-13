// Bảng chuỗi tiếng Việt cho trình soạn Pascal (vendor). Nhập trực tiếp:
// `import { vi } from "<đường dẫn tới>/i18n/vi"` rồi dùng `vi.<vùng>.<khoá>`.
// Mỗi nhóm bên dưới được viết trong một tệp riêng ở `./regions/` để nhiều người có thể
// sửa song song mà không đụng tệp của nhau; tệp này chỉ ghép chúng lại một chỗ.
import { contextualHelp } from "./regions/contextualHelp";
import { controlsAndPanels } from "./regions/controlsAndPanels";
import { editorAndViewer } from "./regions/editorAndViewer";
import { editorRoot } from "./regions/editorRootDoNotEdit";
import { libStrings } from "./regions/libStrings";
import { primitivesAndSidebar } from "./regions/primitivesAndSidebar";
import { furnitureClash } from "./regions/furnitureClash";
import { furnitureLibrary } from "./regions/furnitureLibrary";
import { overlayLevels } from "./regions/overlayLevels";
import { roomArea } from "./regions/roomArea";
import { wallMeasure } from "./regions/wallMeasure";

export const vi = {
  ...controlsAndPanels,
  ...editorAndViewer,
  ...libStrings,
  ...primitivesAndSidebar,
  // Chuỗi UI của components/editor/index.tsx — đã áp dụng tại chỗ ở việc gộp M1.
  editorRoot,
  // Bảng "Diện tích phòng" + lưới thẻ đồ đạc (F-15 W2-D).
  roomArea,
  // Bảng phụ "Thư viện đồ đạc" (F-15 W2-D).
  furnitureLibrary,
  // Dấu "tầng có ảnh nguồn / hình học" trên bộ chọn tầng (F-15 W2-D #96).
  overlayLevels,
  // Bảng "Va chạm đồ đạc" (F-15 W2-A #22).
  furnitureClash,
  // Nhãn bắt điểm của tường + tên phép đo (F-15 W2-B).
  wallMeasure,
  // Gợi ý phím khi đang chọn đối tượng (F-15 S14).
  contextualHelp,
} as const;
