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
    const sizeClass = size === 'profile' ? 'w-16 h-16' : 'w-7 h-7';
    const textClass = size === 'profile' ? 'text-2xl' : 'text-[12px]';

    // Initials: max 2 characters, keep as-is (do NOT uppercase per AGENTS.md rule)
    const displayInitials = initials?.substring(0, 2) ?? '';

    return (
      <div ref={ref} className={cn('relative inline-block shrink-0', sizeClass, className)}>
        <div
          className={cn(
            'w-full h-full rounded-full bg-bg-sunken flex items-center justify-center overflow-hidden',
            presence && 'ring-2 ring-accent ring-offset-2 ring-offset-bg-surface'
          )}
        >
          {src ? (
            <img
              src={src}
              alt={alt || initials || 'Avatar'}
              className="w-full h-full object-cover"
            />
          ) : (
            <span
              className={cn('font-medium text-text-secondary select-none', textClass)}
              aria-label={alt || initials}
            >
              {displayInitials}
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
  /** Max visible avatars before overflow "+N" chip (default: 3) */
  max?: number;
  className?: string;
}

const AvatarStack = forwardRef<HTMLDivElement, AvatarStackProps>(
  ({ avatars, max = 3, className = '' }, ref) => {
    const displayAvatars = avatars.slice(0, max);
    const remaining = Math.max(0, avatars.length - max);

    return (
      <div
        ref={ref}
        className={cn('flex items-center', className)}
        role="group"
        aria-label={`${avatars.length} người`}
      >
        {displayAvatars.map((avatar, index) => (
          <div
            key={avatar.initials ?? avatar.alt ?? avatar.src ?? `avatar-${index}`}
            className="relative ring-2 ring-bg-surface rounded-full shrink-0"
            style={{ marginLeft: index > 0 ? '-8px' : '0', zIndex: 10 - index }}
          >
            <AvatarRoot {...avatar} size="default" />
          </div>
        ))}
        {remaining > 0 && (
          <div
            className="relative ring-2 ring-bg-surface rounded-full flex items-center justify-center bg-bg-sunken text-text-secondary text-[12px] font-medium w-7 h-7 select-none shrink-0"
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

export { AvatarStack };
