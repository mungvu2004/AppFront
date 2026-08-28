/**
 * Đường nhập ổn định của màn tải bản vẽ.
 *
 * Nơi gọi viết `@/screens/upload/FloorUploadScreen` và không phải biết màn này
 * gồm mấy file — R-22 tách view thành các phần anh em (vùng thả, thẻ tầng, khay,
 * chân trang) và những phần ấy cố ý **không** được tái xuất ở đây: chúng là mảnh
 * của một view, không phải API của màn.
 */

export { FloorUploadScreenView } from './FloorUploadScreen';
export {
  FloorUploadRoute,
  FloorUploadScreenContainer,
  type FloorUploadScreenContainerProps,
} from './FloorUploadScreen.container';
export {
  useFloorUploadScreen,
  type FloorUploadToast,
  type UseFloorUploadScreenOptions,
} from './useFloorUploadScreen';
export {
  createAppFloorUploadGateway,
  createFloorUploadGateway,
  UNDO_WINDOW_MS,
  type CreateFloorUploadGatewayOptions,
  type CreateFloorUploadInput,
  type CreateRemovalTicketInput,
  type EnqueueOfflineUploadInput,
  type FloorUploadFailure,
  type FloorUploadGateway,
  type ReadProjectFloorsInput,
} from './floorUploadGateway';
export type {
  FloorUploadActions,
  FloorUploadBlockNotice,
  FloorUploadBlockReason,
  FloorUploadBlockReasonKind,
  FloorUploadDropZoneModel,
  FloorUploadErrorKind,
  FloorUploadFileModel,
  FloorUploadFooterModel,
  FloorUploadInlineError,
  FloorUploadModel,
  FloorUploadRowModel,
  FloorUploadScreenViewProps,
  FloorUploadScrollRequest,
  FloorUploadStatus,
  FloorUploadTrayItemModel,
  FloorUploadTrayModel,
} from './types';
