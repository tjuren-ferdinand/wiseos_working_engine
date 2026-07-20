'use client';

import React from 'react';
import { tokens } from '../tokens';

type CardVariant = 'default' | 'elevated' | 'outlined' | 'glass';

interface CardProps {
  children: React.ReactNode;
  variant?: CardVariant;
  padding?: 'none' | 'sm' | 'md' | 'lg';
  hover?: boolean;
  className?: string;
  style?: React.CSSProperties;
  onClick?: () => void;
}

const paddingMap = {
  none: '0',
  sm: tokens.spacing[4],
  md: tokens.spacing[6],
  lg: tokens.spacing[8],
};

export function Card({
  children,
  variant = 'default',
  padding = 'md',
  hover = false,
  className = '',
  style,
  onClick,
}: CardProps) {
  const [isHovered, setIsHovered] = React.useState(false);

  const baseStyle: React.CSSProperties = {
    backgroundColor: tokens.colors.surface,
    borderRadius: tokens.radius.xl,
    padding: paddingMap[padding],
    transition: `all ${tokens.animation.durationBase} ${tokens.animation.easeDefault}`,
    cursor: onClick ? 'pointer' : 'default',
  };

  const variantStyles: Record<CardVariant, React.CSSProperties> = {
    default: {
      border: `1px solid ${tokens.colors.border}`,
      boxShadow: tokens.colors.shadowXs,
    },
    elevated: {
      border: `1px solid ${tokens.colors.borderSubtle}`,
      boxShadow: tokens.colors.shadowMd,
    },
    outlined: {
      border: `1px solid ${tokens.colors.border}`,
      boxShadow: 'none',
    },
    glass: {
      backgroundColor: tokens.colors.glass,
      backdropFilter: tokens.colors.glassBackdrop,
      WebkitBackdropFilter: tokens.colors.glassBackdrop,
      border: `1px solid ${tokens.colors.glassBorder}`,
      boxShadow: tokens.colors.shadowSm,
    },
  };

  const hoverStyles: React.CSSProperties = hover && isHovered ? {
    boxShadow: tokens.colors.shadowLg,
    transform: 'translateY(-2px)',
    borderColor: tokens.colors.borderFocus,
  } : {};

  return (
    <div
      className={className}
      style={{ ...baseStyle, ...variantStyles[variant], ...hoverStyles, ...style }}
      onClick={onClick}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      {children}
    </div>
  );
}

interface CardHeaderProps {
  children: React.ReactNode;
  action?: React.ReactNode;
  className?: string;
}

export function CardHeader({ children, action, className = '' }: CardHeaderProps) {
  return (
    <div
      className={className}
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        marginBottom: tokens.spacing[4],
      }}
    >
      <div>{children}</div>
      {action && <div>{action}</div>}
    </div>
  );
}

interface CardContentProps {
  children: React.ReactNode;
  className?: string;
}

export function CardContent({ children, className = '' }: CardContentProps) {
  return <div className={className}>{children}</div>;
}

interface CardFooterProps {
  children: React.ReactNode;
  className?: string;
}

export function CardFooter({ children, className = '' }: CardFooterProps) {
  return (
    <div
      className={className}
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'flex-end',
        gap: tokens.spacing[3],
        marginTop: tokens.spacing[4],
        paddingTop: tokens.spacing[4],
        borderTop: `1px solid ${tokens.colors.border}`,
      }}
    >
      {children}
    </div>
  );
}

interface StatCardProps {
  label: string;
  value: string | number;
  change?: {
    value: string;
    positive?: boolean;
  };
  icon?: React.ReactNode;
}

export function StatCard({ label, value, change, icon }: StatCardProps) {
  return (
    <Card variant="default" padding="md">
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between' }}>
        <div>
          <p style={{
            fontSize: tokens.typography.textSm,
            color: tokens.colors.textSecondary,
            marginBottom: tokens.spacing[1],
            fontFamily: tokens.typography.fontSans,
          }}>
            {label}
          </p>
          <p style={{
            fontSize: tokens.typography.text3xl,
            fontWeight: tokens.typography.weightSemibold,
            color: tokens.colors.text,
            fontFamily: tokens.typography.fontSans,
            letterSpacing: tokens.typography.trackingTight,
          }}>
            {value}
          </p>
          {change && (
            <p style={{
              fontSize: tokens.typography.textSm,
              color: change.positive ? tokens.colors.success : tokens.colors.error,
              marginTop: tokens.spacing[1],
              fontFamily: tokens.typography.fontSans,
            }}>
              {change.positive ? '↑' : '↓'} {change.value}
            </p>
          )}
        </div>
        {icon && (
          <div style={{
            width: '40px',
            height: '40px',
            borderRadius: tokens.radius.lg,
            backgroundColor: tokens.colors.accent,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: tokens.colors.primary,
          }}>
            {icon}
          </div>
        )}
      </div>
    </Card>
  );
}
