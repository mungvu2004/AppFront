import type { RequiredLayerKey } from './floorReviewGateModel';
import { QC_LAYERS, qcStepOf } from './qcLayers';

const STEP_KEYS = QC_LAYERS.filter((layer) => layer.group === 'step').map((layer) => layer.key);

/**
 * Bước bắt buộc còn việc đầu tiên sau màn đang mở (bỏ qua bước đã xong, U28: không mời "Tiếp: Tường"
 * khi tường đã duyệt hết); `undefined` khi sau màn không còn bước nào dở (hết bước của tầng).
 */
export function stepAfter(
  pathname: string,
  projectId: string,
  floorId: string,
  isDone: (key: RequiredLayerKey) => boolean = () => false,
): RequiredLayerKey | undefined {
  const here = QC_LAYERS.find((layer) => layer.route(projectId, floorId) === pathname);
  const step = here === undefined ? null : qcStepOf(here.key);
  const later = STEP_KEYS.slice((step === null ? 0 : STEP_KEYS.indexOf(step)) + 1) as RequiredLayerKey[];
  return later.find((key) => !isDone(key));
}
