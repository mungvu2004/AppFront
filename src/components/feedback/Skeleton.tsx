import React from 'react';

export interface SkeletonProps {
  className?: string;
}

export function Skeleton({ className = '' }: SkeletonProps) {
  return (
    <div className={`relative overflow-hidden bg-bg-sunken ${className}`}>
      <div 
        className="absolute top-0 bottom-0 -left-1/4 w-1/4 bg-white/55 animate-skeleton-scan" 
      />
    </div>
  );
}
