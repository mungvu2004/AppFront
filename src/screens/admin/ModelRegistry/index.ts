/**
 * `/admin/training/models` — registry model của chuỗi xử lý (F-11). Đường nhập duy nhất của
 * thư mục; `src/routes/router.tsx` nạp lười {@link ModelRegistryRoute}.
 *
 * Bốn file anh em (`ModelRegistryVersionTable`, `ModelRegistryDetail`,
 * `ModelRegistryActivateDialog`, các file logic) là phần con của một màn, không phải
 * component dùng chung.
 */

export { ModelRegistry } from './ModelRegistry';
export { ModelRegistryContainer, ModelRegistryRoute } from './ModelRegistry.container';
export type { ModelRegistryContainerProps } from './ModelRegistry.container';
export { canManageModels, createModelRegistryGateway } from './modelRegistryGateway';
export type { ModelRegistryGateway } from './modelRegistryGateway';
export { COLLAPSE_BREAKPOINT_PX, MODEL_REGISTRY_TEXT, useModelRegistry } from './useModelRegistry';
export type { ModelRegistryResult, UseModelRegistryOptions } from './useModelRegistry';
export type { ModelRegistryActions, ModelRegistryProps, ModelRegistryViewModel } from './types';
