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
 * Logo Icon - Isolated component for easy replacement
 * 
 * To update the logo:
 * 1. Replace the SVG content below with the new logo
 * 2. Or use an <img> tag pointing to the logo file
 * 
 * Example with image:
 * return <img src="/wiseos-logo-new.png" alt="WiseOS" width={size} height={size} />;
 */
function LogoIcon({ size }: { size: number }) {
  return (
    <div
      style={{
        width: size,
        height: size,
        borderRadius: tokens.radius.lg,
        background: `linear-gradient(135deg, ${tokens.colors.primary} 0%, #7B4A77 100%)`,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        boxShadow: tokens.colors.shadowPrimary,
      }}
    >
      <svg
        width={size * 0.6}
        height={size * 0.6}
        viewBox="0 0 24 24"
        fill="none"
        stroke="white"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <path d="M12 2L2 7l10 5 10-5-10-5z" />
        <path d="M2 17l10 5 10-5" />
        <path d="M2 12l10 5 10-5" />
      </svg>
    </div>
  );
}

export function LogoMark({ size = 32 }: { size?: number }) {
  return <LogoIcon size={size} />;
}
