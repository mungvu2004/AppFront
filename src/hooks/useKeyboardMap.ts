import { useEffect } from 'react';
import { useStore } from '../store';

/**
 * Global keyboard shortcuts mapping.
 * V: Chọn (Select)
 * W: Tường (Wall)
 * M: Kích thước (Dimension/Measure)
 * L: Lớp (Layer)
 * 2: 2D View
 * 3: 3D View
 * [: Zoom out
 * ]: Zoom in
 * Cmd/Ctrl+K: Command Palette (simulate focus)
 * Cmd/Ctrl+Z: Undo
 * ?: Help
 */
export function useKeyboardMap(
  onCommandPalette: () => void,
  onHelp: () => void,
  onZoom: (delta: number) => void,
  onSwitchView: (view: '2d' | '3d') => void
) {
  const setActiveLayer = useStore(state => state.setActiveLayer);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Ignore if typing in input
      if (['INPUT', 'TEXTAREA'].includes((e.target as HTMLElement).tagName)) return;

      const isMac = navigator.platform.toUpperCase().indexOf('MAC') >= 0;
      const cmdOrCtrl = isMac ? e.metaKey : e.ctrlKey;

      if (cmdOrCtrl) {
        if (e.key.toLowerCase() === 'z') {
          e.preventDefault();
          useStore.temporal.getState().undo();
        } else if (e.key.toLowerCase() === 'k') {
          e.preventDefault();
          onCommandPalette();
        }
        return; // Don't trigger single keys if modifier is pressed
      }

      switch (e.key.toLowerCase()) {
        case 'v':
          setActiveLayer(null);
          break;
        case 'w':
          setActiveLayer('wall');
          break;
        case 'm':
          setActiveLayer('dimension');
          break;
        case 'l':
          // could be something else, default to wall or custom
          setActiveLayer('door'); 
          break;
        case '2':
          onSwitchView('2d');
          break;
        case '3':
          onSwitchView('3d');
          break;
        case '[':
          onZoom(-1);
          break;
        case ']':
          onZoom(1);
          break;
        case '?':
          onHelp();
          break;
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onCommandPalette, onHelp, onZoom, onSwitchView, setActiveLayer]);
}
