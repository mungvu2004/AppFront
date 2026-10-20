/**
 * Thẻ "Phong cách" của trang 3D: chọn một trong năm bộ vật liệu/đồ đạc của cảnh (J6).
 * Phong cách chỉ đọc lúc mở trang (J9), nên đổi = ghi khoá rồi nạp lại trang — trước đó
 * lưu hết việc đang dở: Pascal lưu ngay → bộ tự lưu tầng xả → nạp lại.
 *
 * W4a: phong cách lưu THEO DỰ ÁN (cộng sự thấy cùng một nhà). Ai sửa được cài đặt thì PUT vào
 * dự án trước; người khác chỉ xem thử trên máy này (khoá riêng dự án, không gửi đi).
 */
import { ChevronDown } from 'lucide-react';
import { useState } from 'react';

import {
  DEFAULT_SCENE_STYLE,
  SCENE_STYLE_IDS,
  SCENE_STYLE_STORAGE_KEY,
  SCENE_STYLES,
  sceneStylePreviewKey,
  type SceneStyleId,
} from '@/lib/pascal/sceneStyles';

import { currentProjectSceneStyle, type ProjectSceneStyle } from './bridge';

export interface SceneStyleCardProps {
  /** Lưu ngay cảnh Pascal (lối Ctrl+S của editor) và đợi lượt ghi qua cầu. */
  readonly saveNow: () => Promise<void>;
  /** Xả mọi bộ tự lưu của AppFront (`flushAutosaves`). */
  readonly flushAutosaves: () => Promise<void>;
  readonly reload: () => void;
  /** Phong cách của dự án đang mở; mặc định đọc từ cầu (test cắm thẳng vào). */
  readonly source?: ProjectSceneStyle | null;
}

export function SceneStyleCard({ saveNow, flushAutosaves, reload, source = currentProjectSceneStyle() }: SceneStyleCardProps) {
  const current = source?.id ?? DEFAULT_SCENE_STYLE;
  const saveToProject = source?.saveToProject;
  // Khoá xem thử của dự án; chưa có dự án (không xảy ra sau khi cầu nạp xong) thì khoá chung J9.
  const localKey = source == null ? SCENE_STYLE_STORAGE_KEY : sceneStylePreviewKey(source.projectId);
  const [saving, setSaving] = useState(false);
  const [failed, setFailed] = useState(false);

  const choose = async (id: SceneStyleId) => {
    if (saving || id === current) return;
    if (saveToProject === undefined) {
      try {
        localStorage.setItem(localKey, id);
      } catch {
        // Bộ nhớ bị chặn: vẫn lưu + nạp lại, trang mở với phong cách mặc định.
      }
    }
    setSaving(true);
    setFailed(false);
    try {
      if (saveToProject !== undefined) {
        await saveToProject(id);
        // Bỏ bản xem thử cũ (nếu có) để phong cách của dự án thắng.
        try {
          localStorage.removeItem(localKey);
        } catch {
          // Bộ nhớ bị chặn: không có bản xem thử nào để bỏ.
        }
      }
      await saveNow();
      await flushAutosaves();
      reload();
    } catch {
      // Lưu hỏng thì KHÔNG nạp lại (mất việc dở). Lối máy: khoá đã ghi, lần mở sau vẫn theo phong cách mới.
      setSaving(false);
      setFailed(true);
    }
  };

  return (
    <details className="relative">
      <summary
        aria-label={`Phong cách: ${SCENE_STYLES[current].label} — mở danh sách phong cách`}
        className="flex h-8 shrink-0 cursor-pointer list-none items-center gap-1.5 rounded-xl border border-border bg-background/90 px-2.5 font-medium text-foreground text-xs shadow-2xl backdrop-blur-md hover:bg-accent [&::-webkit-details-marker]:hidden"
      >
        Phong cách
        <ChevronDown aria-hidden="true" className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
      </summary>
      <ul
        aria-label="Danh sách phong cách"
        className="absolute top-full left-0 z-50 mt-1 min-w-44 rounded-xl border border-border bg-popover/95 p-1 text-xs shadow-2xl backdrop-blur-xl"
      >
        {SCENE_STYLE_IDS.map((id) => (
          <li key={id}>
            <button
              aria-pressed={id === current}
              className="flex h-7 w-full items-center whitespace-nowrap rounded-lg px-2 text-left hover:bg-accent disabled:opacity-50 aria-pressed:bg-accent aria-pressed:font-semibold"
              disabled={saving}
              onClick={() => void choose(id)}
              type="button"
            >
              {SCENE_STYLES[id].label}
            </button>
          </li>
        ))}
        {saveToProject === undefined ? <li className="px-2 py-1 text-muted-foreground">Chỉ áp dụng trên máy này</li> : null}
        {saving ? <li className="px-2 py-1 text-muted-foreground">Đang lưu rồi tải lại…</li> : null}
        {failed ? (
          <li className="px-2 py-1 text-destructive" role="alert">
            Chưa lưu được — thử lại.
          </li>
        ) : null}
      </ul>
    </details>
  );
}
