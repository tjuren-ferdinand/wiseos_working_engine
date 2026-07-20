'use client';

import React from 'react';
import { tokens } from '../tokens';

interface LogoProps {
  size?: 'sm' | 'md' | 'lg';
  showText?: boolean;
  className?: string;
}

const sizeMap = {
  sm: { icon: 24, text: tokens.typography.textBase },
  md: { icon: 32, text: tokens.typography.textLg },
  lg: { icon: 40, text: tokens.typography.textXl },
};

/**
 * WiseOS Logo Component
 * 
 * This component serves as the single source of truth for the logo.
 * When a new logo is provided, update the LogoIcon component below.
 * 
 * Current: Placeholder gradient mark
 * TODO: Replace with official WiseOS logo when provided
 */
export function Logo({ size = 'md', showText = true, className = '' }: LogoProps) {
  const { icon, text } = sizeMap[size];

  return (
    <div
      className={className}
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: tokens.spacing[3],
      }}
    >
      <LogoIcon size={icon} />
      {showText && (
        <span
          style={{
            fontFamily: tokens.typography.fontSans,
            fontSize: text,
            fontWeight: tokens.typography.weightSemibold,
            color: tokens.colors.text,
            letterSpacing: tokens.typography.trackingTight,
          }}
        >
          WiseOS
        </span>
      )}
    </div>
  );
}

/**
 * Logo Icon - Uses the official WiseOS logo
 */
function LogoIcon({ size }: { size: number }) {
  return (
    <img 
      src="/logotype_new.png" 
      alt="WiseOS" 
      width={size * 3}
      height={size}
      style={{
        height: size,
        width: 'auto',
        objectFit: 'contain',
      }}
    />
  );
}

export function LogoMark({ size = 32 }: { size?: number }) {
  return <LogoIcon size={size} />;
}
