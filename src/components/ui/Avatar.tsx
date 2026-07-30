import React from 'react';

export interface AvatarProps {
  src?: string;
  initials?: string;
  size?: 'default' | 'profile';
  presence?: boolean;
  className?: string;
}

export function Avatar({ src, initials, size = 'default', presence = false, className = '' }: AvatarProps) {
  const sizeClass = size === 'profile' ? 'w-[64px] h-[64px]' : 'w-[28px] h-[28px]';
  const textClass = size === 'profile' ? 'text-[24px]' : 'text-[12px]';
  
  return (
    <div className={`relative inline-block ${sizeClass} ${className}`}>
      <div 
        className={`w-full h-full rounded-full bg-bg-sunken flex items-center justify-center overflow-hidden
          ${presence ? 'ring-2 ring-accent ring-offset-2 ring-offset-bg-surface' : ''}
        `}
      >
        {src ? (
          <img src={src} alt={initials || 'Avatar'} className="w-full h-full object-cover" />
        ) : (
          <span className={`font-medium text-text-secondary uppercase select-none ${textClass}`}>
            {initials?.substring(0, 2)}
          </span>
        )}
      </div>
    </div>
  );
}

export interface AvatarStackProps {
  avatars: AvatarProps[];
  className?: string;
}

export function AvatarStack({ avatars, className = '' }: AvatarStackProps) {
  const displayAvatars = avatars.slice(0, 3);
  const remaining = Math.max(0, avatars.length - 3);

  return (
    <div className={`flex items-center ${className}`}>
      {displayAvatars.map((avatar, index) => (
        <div 
          key={index} 
          className="relative ring-2 ring-bg-surface rounded-full"
          style={{ marginLeft: index > 0 ? '-8px' : '0', zIndex: 10 - index }}
        >
          <Avatar {...avatar} size="default" />
        </div>
      ))}
      {remaining > 0 && (
        <div 
          className="relative ring-2 ring-bg-surface rounded-full flex items-center justify-center bg-bg-sunken text-text-secondary text-[12px] font-medium w-[28px] h-[28px] select-none"
          style={{ marginLeft: '-8px', zIndex: 0 }}
        >
          +{remaining}
        </div>
      )}
    </div>
  );
}
