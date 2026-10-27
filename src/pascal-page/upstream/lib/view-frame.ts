/**
 * AppFront addition (UX-R2 K38), not an upstream file. One "frame the model" for the first open,
 * a floor switch, leaving Preview and the "Xem toàn bộ mô hình" button.
 *
 * Solo mode shows ONE floor, but that floor still sits at its stacked height (`baseY`, e.g. 6.6 m
 * for the third floor) and the other floors' walls still count in the plan bounds — so the old
 * whole-model frame (target y = 0, union of all floors) put the visible floor at the top edge,
 * under the toolbar and the scale banner. Here solo mode frames the selected floor only, at its
 * own height; stacked/exploded still frame the whole model.
 */
import { emitter, useScene } from '@pascal-app/core'
import { getLevelPresentationY, useViewer } from '@pascal-app/viewer'
import { computeSceneBoundsXZ } from '../../../../vendor/pascal/packages/editor/src/lib/scene-bounds'
import { fitPose, planBoundsXZ } from './fit-on-ready'

/** Bounds + base height of what the camera should frame now. */
export function viewedFrame() {
  const { nodes } = useScene.getState()
  const { levelMode, selection } = useViewer.getState()
  const levelId = levelMode === 'solo' ? selection.levelId : null
  const level = levelId ? planBoundsXZ(nodes, levelId) : null
  if (levelId && level) return { bounds: level, baseY: getLevelPresentationY(levelId, nodes, levelMode) }
  // FE3D-FIX-004 V14: frame walls + zones; vendor bounds only for a scene without either.
  return { bounds: planBoundsXZ(nodes) ?? computeSceneBoundsXZ(nodes), baseY: 0 }
}

/** Frame the viewed floor (solo) or the whole model; `apply-pose`, because upstream's `fit-scene` is ignored in Preview. */
export function fitModel() {
  const { bounds, baseY } = viewedFrame()
  emitter.emit('camera-controls:apply-pose', fitPose(bounds, useViewer.getState().cameraMode, undefined, baseY))
}
