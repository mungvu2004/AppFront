/**
 * Mảnh dùng chung cho bản cuộn và bản tĩnh: đầu trang, thanh sáu bước, tiêu đề
 * ngắt dòng bằng tay, thẻ kiểm tra, lưới định dạng xuất, nút bắt đầu, chân trang.
 */

import { Fragment } from 'react';
import { Link } from 'react-router-dom';

import { levelPlanSvg } from '@/lib/landing/house/planSvg';
import type { ComplianceCheck, LandingHouse } from '@/lib/landing/types';
import { ROUTES } from '@/routes/paths';

import {
  CHECKS_HEAD,
  CTA_HINT,
  checkSummary,
  DESCRIPTOR,
  EXPORTS,
  failingChecks,
  FLOORS_HEAD,
  FOOTER_NOTE,
  levelName,
  PLAN_TAG,
  type SceneCopy,
  SKIP_LABEL,
  STEPS,
  stepNumber,
  WORDMARK,
} from './landing.copy';

export function Header({ onSkip }: { onSkip?: () => void }) {
  return (
    <header className="landing-header">
      <p className="landing-wordmark">
        <strong>{WORDMARK}</strong>
        <span>{DESCRIPTOR}</span>
      </p>
      <Link className="landing-navlink" to={ROUTES.login}>
        Đăng nhập
      </Link>
      <a
        className="landing-navlink"
        href="#bat-dau"
        onClick={
          onSkip === undefined
            ? undefined
            : (e) => {
                e.preventDefault();
                onSkip();
              }
        }
      >
        {SKIP_LABEL} <span aria-hidden="true">↓</span>
      </a>
    </header>
  );
}

/** Thanh sáu bước; overlay.ts ghi bước hiện tại (`data-active`, `--l-fill`) mỗi khung. */
export function StepRail({ onStep }: { onStep: (step: number) => void }) {
  return (
    <nav className="landing-rail" aria-label="Sáu bước">
      <ol>
        {STEPS.map((s, i) => (
          <li key={s.name} data-step={i} data-tone={s.tone}>
            <a
              href={`#buoc-${stepNumber(i)}`}
              onClick={(e) => {
                e.preventDefault();
                onStep(i);
              }}
            >
              <span className="landing-rail-num">{stepNumber(i)}</span>
              <span className="landing-rail-name">{s.name}</span>
              <span className="landing-rail-tick" aria-hidden="true" />
            </a>
          </li>
        ))}
      </ol>
    </nav>
  );
}

/** Tiêu đề theo dòng đã định sẵn; đúng một từ mang sắc nghĩa của cảnh. */
export function Title({ copy, level, delay }: { copy: SceneCopy; level: 1 | 2; delay?: string }) {
  const Heading = level === 1 ? 'h1' : 'h2';
  const accent = copy.accent;
  return (
    <Heading className="landing-title" data-delay={delay}>
      {copy.title?.map((line, i) => {
        const at = accent === undefined ? -1 : line.indexOf(accent.word);
        return (
          <Fragment key={line}>
            {i > 0 && ' '}
            <span className="landing-line">
            {at < 0 || accent === undefined ? (
              line
            ) : (
              <>
                {line.slice(0, at)}
                <em data-tone={accent.tone}>{accent.word}</em>
                {line.slice(at + accent.word.length)}
              </>
            )}
            </span>
          </Fragment>
        );
      })}
    </Heading>
  );
}

export function Eyebrow({ text, delay }: { text: string; delay?: string }) {
  return (
    <p className="landing-eyebrow" data-delay={delay}>
      {text}
    </p>
  );
}

/** Thẻ kết quả kiểm tra: chỉ dùng nhãn, giá trị và gợi ý có sẵn trong dữ liệu. */
export function ChecksCard({ checks, delay }: { checks: readonly ComplianceCheck[]; delay?: string }) {
  const sum = checkSummary(checks);
  return (
    <div className="landing-checks" data-delay={delay}>
      <p className="landing-checks-head">{CHECKS_HEAD}</p>
      <p className="landing-checks-sum">
        <span>
          <b>{sum.total}</b> mục
        </span>
        <span data-tone="jade">
          <b>{sum.pass}</b> đạt
        </span>
        <span data-tone="coral">
          <b>{sum.fail}</b> cần sửa
        </span>
      </p>
      <ul>
        {failingChecks(checks).map((c) => (
          <li key={c.id}>
            <span className="landing-checks-name">{c.name}</span>
            <span className="landing-checks-val">
              {c.value}
              {c.rule !== undefined && <span> → cần {c.rule}</span>}
            </span>
            {c.suggestion !== undefined && <span className="landing-checks-fix">{c.suggestion}</span>}
          </li>
        ))}
      </ul>
    </div>
  );
}

export function ExportGrid({ animated }: { animated: boolean }) {
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
        Bắt đầu dự án <span aria-hidden="true">→</span>
      </Link>
      <button type="button" className="landing-link" onClick={secondary.onClick}>
        {secondary.label}
      </button>
    </p>
  );
}

/** Nút bắt đầu ngay ở cảnh đầu: không cần cuộn hết trang mới tới được. Chưa có đăng ký, nên dẫn tới đăng nhập. */
export function HeroCta({ delay }: { delay?: string }) {
  return (
    <p className="landing-actions landing-hero-cta" data-delay={delay}>
      <Link className="landing-cta" to={ROUTES.login}>
        Bắt đầu dự án <span aria-hidden="true">→</span>
      </Link>
      <span className="landing-cta-hint">{CTA_HINT}</span>
    </p>
  );
}

/** Mặt bằng ở S01–S04 là tầng 1: nói rõ để khỏi lẫn với ba tầng ở S05+. */
export function PlanTag() {
  return <p className="landing-caption landing-plan-tag">{PLAN_TAG}</p>;
}

/** Một mặt bằng nhỏ cho mỗi tầng, vẽ từ cùng dữ liệu căn nhà, để thấy tầng 2 và 3 từ đâu ra. */
export function FloorStrip({ house, delay }: { house: LandingHouse; delay?: string }) {
  return (
    <figure className="landing-floors" data-delay={delay}>
      <ol>
        {house.plan.levels.map((l) => (
          <li key={l.id}>
            <span dangerouslySetInnerHTML={{ __html: levelPlanSvg(house, l.id) }} />
            {levelName(l.id)}
          </li>
        ))}
      </ol>
      <figcaption className="landing-caption">{FLOORS_HEAD}</figcaption>
    </figure>
  );
}

export function FooterStrip() {
  return (
    <div className="landing-footer-row">
      <span>{WORDMARK}</span>
      <Link to={ROUTES.login}>Đăng nhập</Link>
      <span>{FOOTER_NOTE}</span>
    </div>
  );
}
