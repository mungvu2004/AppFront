/**
 * Đầu dò cho bài e2e (`?probe=1`): `window.__pascalProbe` đọc trạng thái cảnh Pascal mà
 * không cần chụp hình. Không có cờ thì không gắn gì. Thân đầu dò ở `./createProbe`.
 */
import { emitter, sceneRegistry, useInteractive, useScene } from '@pascal-app/core';
import { useViewer } from '@pascal-app/viewer';

import { installPascalProbe, type PascalProbe } from './createProbe';

declare global {
  interface Window {
    __pascalProbe?: PascalProbe;
  }
}

installPascalProbe(window.location.search, window, { useScene, useViewer, sceneRegistry, emitter, useInteractive });
