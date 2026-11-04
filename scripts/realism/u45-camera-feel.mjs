/**
 * U45: cảm giác camera editor 3D (đo ở ui-review/video-giat-20261103). Logic thuần: src/pascal-page/cameraFeel.ts.
 *
 * 1. Nấc lăn chuột: camera-controls dùng `draggingSmoothTime` (0,03) cho bánh xe chứ không phải `smoothTime`, nên đổi
 *    `smoothTime` không có tác dụng. Đổi field này theo từng sự kiện wheel, trả lại khi kéo chuột (controlstart) để
 *    xoay vẫn bám tay.
 * 2. Trackpad: vuốt 2 ngón = kéo khung, chụm 2 ngón (ctrlKey) = zoom, chuột lăn vẫn zoom. Thư viện ép ctrlKey thành
 *    ACTION.ZOOM (đổi camera.zoom, làm méo phối cảnh), nên chụm ở phối cảnh tự gọi `dollyTo` và chặn thư viện.
 *    Nghe wheel ở cha của canvas: thư viện nghe ở đó (`events.connected`), wheel trên nhãn phòng cũng tới.
 * 3. Hết chạy camera thì tính lại hover một lần. Lúc chạy `use-node-events` nuốt enter/leave nhưng R3F vẫn cập nhật
 *    bảng hover của nó, nên `hoveredId` kẹt ở vật đã rời. Cancel + replay ra đúng một cặp leave/enter.
 * 4. Tường rời lưới gộp vì sáng (hover/chọn) quay lại khi hết sáng và camera đứng yên: chỉ viết lại draw group, không
 *    dựng lại buffer. Trước đó nó ở ngoài cả phiên: draw call tăng dần 178→220. Canvas vẽ theo yêu cầu nên không cần
 *    hẹn giờ: khung vẽ kế tiếp sẽ gộp. Gộp lại cả tầng cũng chờ camera đứng yên.
 * 5. Xem trước: bấm đơn vào sàn/phòng chọn zone, chọn zone làm camera bay tới bbox (hành vi viewer gốc). Bỏ phần bbox,
 *    camera đã lưu của node vẫn giữ; vào Xem trước đã có `fitModel`, chọn phòng đã có menu "Phòng ▾".
 */
const CAMERA = 'editor/src/components/editor/custom-camera-controls.tsx';
const POINTER = 'viewer/src/lib/pointer-events.ts';
const WALLS = 'nodes/src/wall/wall-batch-system.tsx';

export const RULES = {
  [CAMERA]: [
    [
      "import useEditor from '../../store/use-editor'\n",
      "import useEditor from '../../store/use-editor'\n" +
        "import { classifyWheel, DRAG_SMOOTH_S, pinchScale, WHEEL_ZOOM_SMOOTH_S } from '@pascal-camera-feel'\n",
    ],
    [
      '    const onWheel = () => {\n      beginLocalCameraInteraction()\n',
      '    let lastWheelPanAt = Number.NEGATIVE_INFINITY\n' +
        '    const onWheel = (event: WheelEvent) => {\n' +
        '      const now = performance.now()\n' +
        '      const kind = classifyWheel(event, now - lastWheelPanAt)\n' +
        "      if (kind === 'pan') lastWheelPanAt = now\n" +
        '      const control = controls.current\n' +
        '      if (control) {\n' +
        "        const perspective = cameraMode !== 'orthographic'\n" +
        "        control.draggingSmoothTime = kind === 'zoom' ? WHEEL_ZOOM_SMOOTH_S : DRAG_SMOOTH_S\n" +
        "        control.mouseButtons.wheel = kind === 'pan'\n" +
        '          ? CameraControlsImpl.ACTION.SCREEN_PAN\n' +
        '          : perspective ? CameraControlsImpl.ACTION.DOLLY : CameraControlsImpl.ACTION.ZOOM\n' +
        "        if (kind === 'pinch' && perspective) {\n" +
        '          event.preventDefault()\n' +
        '          event.stopImmediatePropagation()\n' +
        '          control.getSpherical(keyboardPanSpherical)\n' +
        '          void control.dollyTo(keyboardPanSpherical.radius * pinchScale(event.deltaY), true)\n' +
        '        }\n' +
        '      }\n' +
        '      beginLocalCameraInteraction()\n',
    ],
    [
      "    gl.domElement.addEventListener('wheel', onWheel, { capture: true, passive: true })\n",
      '    const wheelTarget = gl.domElement.parentElement ?? gl.domElement\n' +
        "    wheelTarget.addEventListener('wheel', onWheel, { capture: true, passive: false })\n",
    ],
    [
      "      gl.domElement.removeEventListener('wheel', onWheel, true)\n",
      "      wheelTarget.removeEventListener('wheel', onWheel, true)\n",
    ],
    [
      '  const handleControlStart = useCallback(() => {\n',
      '  const handleControlStart = useCallback(() => {\n' +
        '    if (controls.current) controls.current.draggingSmoothTime = DRAG_SMOOTH_S\n',
    ],
    [
      '    if (!previewTargetNodeId) return\n\n' +
        '    // Calculate camera position from bounding box\n' +
        '    const object3D = sceneRegistry.nodes.get(previewTargetNodeId)\n' +
        '    if (!object3D) return\n\n' +
        '    tempBox.setFromObject(object3D)\n' +
        '    tempBox.getCenter(tempCenter)\n' +
        '    tempBox.getSize(tempSize)\n\n' +
        '    const maxDim = Math.max(tempSize.x, tempSize.y, tempSize.z)\n' +
        '    const distance = Math.max(maxDim * 2, 15)\n\n' +
        '    controls.current.setLookAt(\n' +
        '      tempCenter.x + distance * 0.7,\n' +
        '      tempCenter.y + distance * 0.5,\n' +
        '      tempCenter.z + distance * 0.7,\n' +
        '      tempCenter.x,\n' +
        '      tempCenter.y,\n' +
        '      tempCenter.z,\n' +
        '      true,\n' +
        '    )\n' +
        '  }, [isPreviewMode, isFirstPersonMode, previewTargetNodeId])\n',
      '  }, [isPreviewMode, isFirstPersonMode, previewTargetNodeId])\n',
    ],
  ],
  [POINTER]: [
    [
      '  return manager\n}\n\nfunction makeId(',
      '  const { connect, disconnect } = manager\n' +
        '  let stopHoverRefresh: (() => void) | null = null\n' +
        '  const refreshHover = () => {\n' +
        '    const { events, internal } = store.getState()\n' +
        '    if (useViewer.getState().inputDragging || internal.capturedMap.size > 0) return\n' +
        '    ;(manager.handlers!.onPointerCancel as () => void)()\n' +
        '    useViewer.setState({ hoveredId: null })\n' +
        "    if ((events.connected as HTMLElement | undefined)?.matches?.(':hover')) manager.update?.()\n" +
        '  }\n' +
        '  manager.connect = (target) => {\n' +
        '    connect?.(target)\n' +
        '    stopHoverRefresh?.()\n' +
        '    stopHoverRefresh = useViewer.subscribe((state, previous) => {\n' +
        '      if (previous.cameraDragging && !state.cameraDragging) refreshHover()\n' +
        '    })\n' +
        '  }\n' +
        '  manager.disconnect = () => {\n' +
        '    stopHoverRefresh?.()\n' +
        '    stopHoverRefresh = null\n' +
        '    disconnect?.()\n' +
        '  }\n' +
        '  return manager\n}\n\nfunction makeId(',
    ],
  ],
  [WALLS]: [
    [
      "} from './wall-batch'\n",
      "} from './wall-batch'\nimport { wallsReadyToRejoin } from '@pascal-camera-feel'\n",
    ],
    [
      'const changedWalls = new Set<string>()\n',
      'const changedWalls = new Set<string>()\nconst litReleasedWalls = new Map<string, BatchRecord>()\n',
    ],
    ['      changedWalls.clear()\n', '      changedWalls.clear()\n      litReleasedWalls.clear()\n'],
    [
      'function disposeLevelBatches(levelId: string) {\n',
      '/** Trả một tường vừa hết sáng về lưới gộp nó đã rời. Lưới đã bị dựng lại, hoặc tường đổi vật liệu/bị ẩn: để ngưỡng gộp lại của tầng quyết. */\n' +
        'function rejoinWall(nodeId: string, record: BatchRecord) {\n' +
        '  const node = useScene.getState().nodes[nodeId as AnyNodeId]\n' +
        "  const candidate = node?.type === 'wall' ? toCandidate(nodeId, node as WallNode) : null\n" +
        '  if (\n' +
        '    !batchesByLevel.get(record.levelId)?.includes(record) ||\n' +
        '    !candidate ||\n' +
        '    materialSetKey(candidate.materials) !== materialSetKey(record.mesh.material as Material[])\n' +
        '  ) {\n' +
        '    staleLevels.add(record.levelId)\n' +
        '    return\n' +
        '  }\n' +
        '  record.hidden.delete(nodeId)\n' +
        '  applyWallBatchGroups(record.batch, record.hidden)\n' +
        '  batchByNode.set(nodeId, record)\n' +
        '  hideBatchedWall(candidate.mesh)\n' +
        '}\n\n' +
        'function disposeLevelBatches(levelId: string) {\n',
    ],
    [
      '    releaseWall(nodeId)\n  }\n  changedWalls.clear()\n',
      '    litReleasedWalls.delete(nodeId)\n    releaseWall(nodeId)\n  }\n  changedWalls.clear()\n',
    ],
    [
      '    if (record) staleLevels.add(record.levelId)\n    releaseWall(nodeId)\n    changed = true\n',
      '    if (record) litReleasedWalls.set(nodeId, record)\n    releaseWall(nodeId)\n    changed = true\n',
    ],
    [
      '  if (changed) lastWallChangeAtMs = now\n',
      '  if (changed) lastWallChangeAtMs = now\n' +
        '  for (const nodeId of wallsReadyToRejoin(\n' +
        '    litReleasedWalls.keys(),\n' +
        '    tintedWalls,\n' +
        '    useViewer.getState().cameraDragging,\n' +
        '    now - lastWallChangeAtMs,\n' +
        '    BATCH_SETTLE_MS,\n' +
        '  )) {\n' +
        '    const record = litReleasedWalls.get(nodeId)!\n' +
        '    litReleasedWalls.delete(nodeId)\n' +
        '    rejoinWall(nodeId, record)\n' +
        '  }\n',
    ],
    [
      '    !changed && getPendingWallRebuildCount() === 0 && now - lastWallChangeAtMs >= BATCH_SETTLE_MS\n',
      '    !changed &&\n' +
        '    getPendingWallRebuildCount() === 0 &&\n' +
        '    now - lastWallChangeAtMs >= BATCH_SETTLE_MS &&\n' +
        '    !useViewer.getState().cameraDragging\n',
    ],
  ],
};
