'use client';

import React from 'react';
import { tokens } from './tokens';

interface TextProps {
  children: React.ReactNode;
  className?: string;
  style?: React.CSSProperties;
  as?: 'p' | 'span' | 'div' | 'label';
}

interface HeadingProps {
  children: React.ReactNode;
  className?: string;
  style?: React.CSSProperties;
}

const baseStyles = {
  fontFamily: tokens.typography.fontSans,
  color: tokens.colors.text,
};

export function DisplayXL({ children, className = '', style }: HeadingProps) {
  return (
    <h1
      className={className}
      style={{
        ...baseStyles,
        fontSize: tokens.typography.text5xl,
        fontWeight: tokens.typography.weightBold,
        lineHeight: tokens.typography.leadingTight,
        letterSpacing: tokens.typography.trackingTighter,
        ...style,
      }}
    >
      {children}
    </h1>
  );
}

export function DisplayLg({ children, className = '', style }: HeadingProps) {
  return (
    <h1
      className={className}
      style={{
        ...baseStyles,
        fontSize: tokens.typography.text4xl,
        fontWeight: tokens.typography.weightBold,
        lineHeight: tokens.typography.leadingTight,
        letterSpacing: tokens.typography.trackingTighter,
        ...style,
      }}
    >
      {children}
    </h1>
  );
}

export function Heading1({ children, className = '', style }: HeadingProps) {
  return (
    <h1
      className={className}
      style={{
        ...baseStyles,
        fontSize: tokens.typography.text3xl,
        fontWeight: tokens.typography.weightSemibold,
        lineHeight: tokens.typography.leadingTight,
        letterSpacing: tokens.typography.trackingTight,
        ...style,
      }}
    >
      {children}
    </h1>
  );
}

export function Heading2({ children, className = '', style }: HeadingProps) {
  return (
    <h2
      className={className}
      style={{
        ...baseStyles,
        fontSize: tokens.typography.text2xl,
        fontWeight: tokens.typography.weightSemibold,
        lineHeight: tokens.typography.leadingSnug,
        letterSpacing: tokens.typography.trackingTight,
        ...style,
      }}
    >
      {children}
    </h2>
  );
}

export function Heading3({ children, className = '', style }: HeadingProps) {
  return (
    <h3
      className={className}
      style={{
        ...baseStyles,
        fontSize: tokens.typography.textXl,
        fontWeight: tokens.typography.weightSemibold,
        lineHeight: tokens.typography.leadingSnug,
        ...style,
      }}
    >
      {children}
    </h3>
  );
}

export function Heading4({ children, className = '', style }: HeadingProps) {
  return (
    <h4
      className={className}
      style={{
        ...baseStyles,
        fontSize: tokens.typography.textLg,
        fontWeight: tokens.typography.weightMedium,
        lineHeight: tokens.typography.leadingSnug,
        ...style,
      }}
    >
      {children}
    </h4>
  );
}

export function BodyLarge({ children, className = '', style, as: Component = 'p' }: TextProps) {
  return (
    <Component
      className={className}
      style={{
        ...baseStyles,
        fontSize: tokens.typography.textMd,
        fontWeight: tokens.typography.weightNormal,
        lineHeight: tokens.typography.leadingRelaxed,
        ...style,
      }}
    >
      {children}
    </Component>
  );
}

export function Body({ children, className = '', style, as: Component = 'p' }: TextProps) {
  return (
    <Component
      className={className}
      style={{
        ...baseStyles,
        fontSize: tokens.typography.textBase,
        fontWeight: tokens.typography.weightNormal,
        lineHeight: tokens.typography.leadingNormal,
        ...style,
      }}
    >
      {children}
    </Component>
  );
}

export function BodySmall({ children, className = '', style, as: Component = 'p' }: TextProps) {
  return (
    <Component
      className={className}
      style={{
        ...baseStyles,
        fontSize: tokens.typography.textSm,
        fontWeight: tokens.typography.weightNormal,
        lineHeight: tokens.typography.leadingNormal,
        color: tokens.colors.textSecondary,
        ...style,
      }}
    >
      {children}
    </Component>
  );
}

export function Caption({ children, className = '', style, as: Component = 'span' }: TextProps) {
  return (
    <Component
      className={className}
      style={{
        ...baseStyles,
        fontSize: tokens.typography.textXs,
        fontWeight: tokens.typography.weightMedium,
        lineHeight: tokens.typography.leadingNormal,
        color: tokens.colors.textTertiary,
        letterSpacing: tokens.typography.trackingWide,
        textTransform: 'uppercase' as const,
        ...style,
      }}
    >
      {children}
    </Component>
  );
}

export function Code({ children, className = '' }: TextProps) {
  return (
    <code
      className={className}
      style={{
        fontFamily: tokens.typography.fontMono,
        fontSize: tokens.typography.textSm,
        backgroundColor: tokens.colors.accent,
        padding: `${tokens.spacing[0.5]} ${tokens.spacing[1.5]}`,
        borderRadius: tokens.radius.sm,
        color: tokens.colors.text,
      }}
    >
      {children}
    </code>
  );
}
