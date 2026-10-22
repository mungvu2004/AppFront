/**
 * Thử mô hình 3D tương tác: cảnh nướng sáng sẵn từ Cycles, mở đúng góc máy của khung hình dựng sẵn rồi cho kéo
 * xoay, cuộn phóng to. `?scene=maquette|house&pose=end|interior`.
 */

import { useEffect, useRef } from 'react';
import { useSearchParams } from 'react-router-dom';

import './live.css';
import { createLiveViewer } from '@/lib/landing-lab/live/viewer';

declare global {
  interface Window {
    __liveReady?: Promise<void>;
    __livePose?: (name: string) => void;
    __liveBench?: (n: number) => number[];
  }
}

const SCENES = new Set(['maquette', 'house']);

export default function Live() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [params] = useSearchParams();
  const asked = params.get('scene') ?? 'maquette';
  const scene = SCENES.has(asked) ? asked : 'maquette';
  const pose = params.get('pose') ?? 'end';

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return undefined;
    const v = createLiveViewer(canvas, `/landing-lab/live/${scene}`, pose);
    window.__liveReady = v.ready;
    window.__livePose = v.setPose;
    window.__liveBench = v.bench;
    return () => v.dispose();
  }, [scene, pose]);

  return (
    <div className="lv">
      <canvas className="lv-canvas" ref={canvasRef} />
      <p className="lv-note">Dữ liệu minh hoạ · kéo để xoay, cuộn để phóng to</p>
    </div>
  );
}
