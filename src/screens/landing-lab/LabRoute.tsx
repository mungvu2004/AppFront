/**
 * Chỉ bản dev: ba mẫu thử trang chủ v6, mỗi ý tưởng một thư mục riêng (`/welcome-lab/maquette|cinema|blueprint`).
 */

import { lazy, type ComponentType, type LazyExoticComponent } from 'react';
import { useParams } from 'react-router-dom';

const IDEAS: Record<string, LazyExoticComponent<ComponentType>> = {
  maquette: lazy(() => import('./maquette/index')),
  cinema: lazy(() => import('./cinema/index')),
  blueprint: lazy(() => import('./blueprint/index')),
};

export function LabRoute() {
  const { idea = '' } = useParams();
  const Idea = IDEAS[idea];
  return Idea ? <Idea /> : <p>Không có mẫu thử “{idea}”.</p>;
}
