import React, { forwardRef } from 'react';
import { cn } from '../../lib/utils';

// ─── Avatar.Root ──────────────────────────────────────────────────────────────

export interface AvatarProps {
  src?: string;
  initials?: string;
  size?: 'default' | 'profile';
  presence?: boolean;
  className?: string;
  alt?: string;
}

const AvatarRoot = forwardRef<HTMLDivElement, AvatarProps>(
  ({ src, initials, size = 'default', presence = false, className = '', alt }, ref) => {
    const sizeClass = size === 'profile' ? 'w-[64px] h-[64px]' : 'w-[28px] h-[28px]';
    const textClass = size === 'profile' ? 'text-[24px]' : 'text-[12px]';

    return (
      <div ref={ref} className={cn('relative inline-block', sizeClass, className)}>
        <div
          className={cn(
            'w-full h-full rounded-full bg-bg-sunken flex items-center justify-center overflow-hidden',
            presence && 'ring-2 ring-accent ring-offset-2 ring-offset-bg-surface'
          )}
        >
          {src ? (
            <img src={src} alt={alt || initials || 'Avatar'} className="w-full h-full object-cover" />
          ) : (
            <span
              className={cn('font-medium text-text-secondary uppercase select-none', textClass)}
              aria-label={alt || initials}
            >
              {initials?.substring(0, 2)}
            </span>
          )}
        </div>
      </div>
    );
  }
);
AvatarRoot.displayName = 'Avatar.Root';

// ─── Avatar.Stack ─────────────────────────────────────────────────────────────

export interface AvatarStackProps {
  avatars: AvatarProps[];
  max?: number;
  className?: string;
}

const AvatarStack = forwardRef<HTMLDivElement, AvatarStackProps>(
  ({ avatars, max = 3, className = '' }, ref) => {
    const displayAvatars = avatars.slice(0, max);
    const remaining = Math.max(0, avatars.length - max);

    return (
      <div ref={ref} className={cn('flex items-center', className)}>
        {displayAvatars.map((avatar, index) => (
          <div
            key={index}
            className="relative ring-2 ring-bg-surface rounded-full"
            style={{ marginLeft: index > 0 ? '-8px' : '0', zIndex: 10 - index }}
          >
            <AvatarRoot {...avatar} size="default" />
          </div>
        ))}
        {remaining > 0 && (
          <div
            className="relative ring-2 ring-bg-surface rounded-full flex items-center justify-center bg-bg-sunken text-text-secondary text-[12px] font-medium w-[28px] h-[28px] select-none"
            style={{ marginLeft: '-8px', zIndex: 0 }}
            aria-label={`+${remaining} người khác`}
          >
            +{remaining}
          </div>
        )}
      </div>
    );
  }
);
AvatarStack.displayName = 'Avatar.Stack';

// ─── Namespace ────────────────────────────────────────────────────────────────

export const Avatar = Object.assign(AvatarRoot, {
  Root: AvatarRoot,
  Stack: AvatarStack,
});

// ─── Legacy named export ──────────────────────────────────────────────────────

export { AvatarStack };
