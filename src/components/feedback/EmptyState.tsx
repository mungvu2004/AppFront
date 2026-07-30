import React, { useEffect, useRef } from 'react';
import { Button } from '../ui/Button';

export interface EmptyStateProps {
  title: string;
  description: string;
  buttonText: string;
  onButtonClick: () => void;
  linkText?: string;
  onLinkClick?: () => void;
}

export function EmptyState({
  title,
  description,
  buttonText,
  onButtonClick,
  linkText,
  onLinkClick,
}: EmptyStateProps) {
  const svgRef = useRef<SVGSVGElement>(null);

  // Trigger CSS animation sau một microtask — không cần state, không gây extra render
  useEffect(() => {
    const el = svgRef.current;
    if (!el) return;
    // setAttribute trick để restart CSS animation mà không cần layout reflow
    el.classList.remove('animate-empty-icon-draw');
    el.setAttribute('data-anim', '0');
    requestAnimationFrame(() => {
      el.removeAttribute('data-anim');
      el.classList.add('animate-empty-icon-draw');
    });
  }, []);

  return (
    <div className="flex flex-col items-center justify-center p-8 text-center max-w-sm mx-auto">
      <svg
        ref={svgRef}
        width="32"
        height="32"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
        className="text-text-muted mb-4"
        aria-hidden="true"
        style={{ strokeDasharray: 100, strokeDashoffset: 0 }}
      >
        <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
        <polyline points="14 2 14 8 20 8" />
        <line x1="12" y1="18" x2="12" y2="12" />
        <line x1="9" y1="15" x2="15" y2="15" />
      </svg>
      
      <h3 className="text-lg font-medium text-text-primary mb-2">
        {title}
      </h3>
      <p className="text-[15px] text-text-secondary mb-6">
        {description}
      </p>
      
      <Button
        variant="primary"
        onClick={onButtonClick}
        className="mb-4"
      >
        {buttonText}
      </Button>

      {linkText && onLinkClick && (
        <Button
          variant="ghost"
          onClick={onLinkClick}
        >
          {linkText}
        </Button>
      )}
    </div>
  );
}
