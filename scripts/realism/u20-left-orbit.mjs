/**
 * UX41 U20: keo chuot trai tren nen 3D thi xoay, khong quet chon hang loat (kem nut Xoa).
 * Quet chon: giu Shift/Ctrl/Cmd khi keo, hoac cong cu chon vung (PlaneBoxSelectTool, khong doi).
 * Logic o src/pascal-page/realism/leftOrbit.ts (alias @pascal-realism).
 *
 * Chi doi ScreenRectangleSelectTool: no chi bat dau khi khong tay cam / keo-doi vat nao gianh con tro
 * (isBoxSelectPointerSuppressed), nen xoay chi xay ra khi keo tren nen hoac tren vat chua chon.
 * Camera-controls van de chuot trai = NONE: doi o do thi tay cam va keo-doi vat cung xoay theo.
 */
const FILE = 'editor/src/components/tools/select/box-select-tool.tsx';

export const RULES = {
  [FILE]: [
    [
      "import { PlaneBoxSelectTool } from './plane-box-select-tool'\n",
      "import { PlaneBoxSelectTool } from './plane-box-select-tool'\n" +
        "import { ORBIT_START_PX as ORBIT_START_PX_U20, orbitBy as orbitByU20, wantsBoxSelect as wantsBoxSelectU20 } from '@pascal-realism/leftOrbit'\n",
    ],
    ['  const { camera, gl } = useThree()\n', '  const { camera, gl, get: getThreeU20 } = useThree()\n'],
    [
      '  const spaceDownRef = useRef(false)\n',
      '  const spaceDownRef = useRef(false)\n  const orbitFromU20 = useRef<{ x: number; y: number } | null>(null)\n',
    ],
    // resetDrag
    [
      '    pointerDownRef.current = false\n    isDraggingRef.current = false\n    pointerIdRef.current = null\n',
      '    pointerDownRef.current = false\n    isDraggingRef.current = false\n    pointerIdRef.current = null\n    orbitFromU20.current = null\n',
    ],
    // pointerdown: khong phim phu = xoay
    [
      '      pointerIdRef.current = event.pointerId\n',
      '      pointerIdRef.current = event.pointerId\n' +
        '      orbitFromU20.current = wantsBoxSelectU20(event) ? null : { x: event.clientX, y: event.clientY }\n',
    ],
    // pointermove: xoay thay cho khung chon
    [
      '      if (!isDraggingRef.current && dragDistance >= SCREEN_RECTANGLE_SELECTION_DRAG_THRESHOLD_PX) {\n',
      '      const orbitFrom = orbitFromU20.current\n' +
        '      if (orbitFrom) {\n' +
        '        if (!isDraggingRef.current && dragDistance < ORBIT_START_PX_U20) return\n' +
        '        isDraggingRef.current = true\n' +
        '        markBoxSelectHandled()\n' +
        '        event.preventDefault()\n' +
        '        orbitByU20(getThreeU20().controls, event.clientX - orbitFrom.x, event.clientY - orbitFrom.y, canvas.clientHeight)\n' +
        '        orbitFromU20.current = { x: event.clientX, y: event.clientY }\n' +
        '        return\n' +
        '      }\n' +
        '      if (!isDraggingRef.current && dragDistance >= SCREEN_RECTANGLE_SELECTION_DRAG_THRESHOLD_PX) {\n',
    ],
    // pointerup: xoay xong thi khong chon gi, nuot cu click ngay sau
    [
      '      if (isDraggingRef.current) {\n        event.preventDefault()\n',
      '      if (orbitFromU20.current) {\n' +
        '        if (isDraggingRef.current) markBoxSelectHandled()\n' +
        '        resetDrag()\n' +
        '        return\n' +
        '      }\n' +
        '      if (isDraggingRef.current) {\n        event.preventDefault()\n',
    ],
  ],
};
