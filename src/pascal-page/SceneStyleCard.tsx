/**
 * Thẻ "Phong cách" của trang 3D: chọn một trong năm bộ vật liệu/đồ đạc của cảnh (J6).
 * Phong cách chỉ đọc lúc mở trang (J9), nên đổi = ghi khoá rồi nạp lại trang — trước đó
 * lưu hết việc đang dở: Pascal lưu ngay → bộ tự lưu tầng xả → nạp lại.
 *
 * W4a: phong cách lưu THEO DỰ ÁN (cộng sự thấy cùng một nhà). Ai sửa được cài đặt thì PUT vào
 * dự án trước; người khác chỉ xem thử trên máy này (khoá riêng dự án, không gửi đi).
 */
import { ChevronDown, Palette } from 'lucide-react';
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
    <details className="relative" data-appfront-menu="">
      <summary
        aria-label={`Phong cách: ${SCENE_STYLES[current].label} — mở danh sách phong cách`}
        className="flex h-8 shrink-0 cursor-pointer list-none items-center gap-1.5 whitespace-nowrap rounded-xl border border-[var(--pa-border)] bg-[var(--pa-surface)] px-2.5 font-medium text-[13px] text-[var(--pa-text)] shadow-[var(--pa-shadow-float)] transition-colors duration-[120ms] hover:bg-[var(--pa-sunken)] motion-reduce:transition-none outline-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--pa-accent)] [&::-webkit-details-marker]:hidden"
        title="Phong cách"
      >
        <Palette aria-hidden="true" className="h-4 w-4 shrink-0 @min-[1300px]/appbar:hidden" />
        <span className="hidden @min-[1300px]/appbar:inline">Phong cách</span>
        <ChevronDown aria-hidden="true" className="h-3.5 w-3.5 shrink-0 text-[var(--pa-text-3)]" />
      </summary>
      <ul
        aria-label="Danh sách phong cách"
        className="absolute top-full left-0 z-50 mt-1 min-w-44 rounded-xl border border-[var(--pa-border)] bg-[var(--pa-surface)] p-1 text-[13px] text-[var(--pa-text)] shadow-[var(--pa-shadow-overlay)]"
      >
        {SCENE_STYLE_IDS.map((id) => (
          <li key={id}>
            <button
              aria-pressed={id === current}
              className="flex h-8 w-full items-center whitespace-nowrap rounded-lg px-2 text-left text-[var(--pa-text-2)] transition-colors duration-[120ms] hover:bg-[var(--pa-sunken)] hover:text-[var(--pa-text)] aria-pressed:bg-[var(--pa-selected)] aria-pressed:font-medium aria-pressed:text-[var(--pa-accent)] disabled:opacity-50 motion-reduce:transition-none outline-none focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-[var(--pa-accent)]"
              disabled={saving}
              onClick={() => void choose(id)}
              type="button"
            >
              {SCENE_STYLES[id].label}
            </button>
          </li>
        ))}
        {saveToProject === undefined ? <li className="px-2 py-1 text-[12px] text-[var(--pa-text-3)]">Chỉ áp dụng trên máy này</li> : null}
        {saving ? <li className="px-2 py-1 text-[12px] text-[var(--pa-text-3)]">Đang lưu rồi tải lại…</li> : null}
        {failed ? (
          <li className="px-2 py-1 text-[12px] text-[var(--pa-danger)]" role="alert">
            Chưa lưu được — thử lại.
          </li>
        ) : null}
      </ul>
    </details>
  );
}
