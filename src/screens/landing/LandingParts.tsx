/** Mảnh dùng chung cho bản cuộn và bản tĩnh: hàng định dạng xuất, nút bắt đầu. */

import { Link } from 'react-router-dom';

import { ROUTES } from '@/routes/paths';

import { EXPORTS } from './landing.copy';

export function ExportRow({ animated }: { animated: boolean }) {
  return (
    <ul className="landing-exports" aria-label="Định dạng xuất">
      {EXPORTS.map((item) => (
        <li key={item.format} data-export={animated ? '' : undefined}>
          <strong>{item.format}</strong>
          <span>{item.label}</span>
        </li>
      ))}
    </ul>
  );
}

export function StartCta({ secondary }: { secondary: { label: string; onClick: () => void } }) {
  return (
    <p className="landing-actions">
      <Link id="bat-dau" className="landing-cta" to={ROUTES.login}>
        Bắt đầu dự án
      </Link>
      <button type="button" className="landing-link" onClick={secondary.onClick}>
        {secondary.label}
      </button>
    </p>
  );
}
