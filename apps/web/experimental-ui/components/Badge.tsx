'use client';

import React from 'react';
import { tokens } from '../tokens';

type BadgeVariant = 'default' | 'primary' | 'success' | 'warning' | 'error' | 'info';
type BadgeSize = 'sm' | 'md';

interface BadgeProps {
  children: React.ReactNode;
  variant?: BadgeVariant;
  size?: BadgeSize;
  dot?: boolean;
  className?: string;
}

const variantStyles: Record<BadgeVariant, { bg: string; text: string; dot: string }> = {
  default: {
    bg: tokens.colors.accent,
    text: tokens.colors.textSecondary,
    dot: tokens.colors.textTertiary,
  },
  primary: {
    bg: tokens.colors.primaryMuted,
    text: tokens.colors.primary,
    dot: tokens.colors.primary,
  },
  success: {
    bg: tokens.colors.successMuted,
    text: tokens.colors.success,
    dot: tokens.colors.success,
  },
  warning: {
    bg: tokens.colors.warningMuted,
    text: tokens.colors.warning,
    dot: tokens.colors.warning,
  },
  error: {
    bg: tokens.colors.errorMuted,
    text: tokens.colors.error,
    dot: tokens.colors.error,
  },
  info: {
    bg: tokens.colors.infoMuted,
    text: tokens.colors.info,
    dot: tokens.colors.info,
  },
};

const sizeStyles: Record<BadgeSize, React.CSSProperties> = {
  sm: {
    fontSize: tokens.typography.textXs,
    padding: `${tokens.spacing[0.5]} ${tokens.spacing[2]}`,
    gap: tokens.spacing[1],
  },
  md: {
    fontSize: tokens.typography.textSm,
    padding: `${tokens.spacing[1]} ${tokens.spacing[2.5]}`,
    gap: tokens.spacing[1.5],
  },
};

export function Badge({
  children,
  variant = 'default',
  size = 'md',
  dot = false,
  className = '',
}: BadgeProps) {
  const { bg, text, dot: dotColor } = variantStyles[variant];

  return (
    <span
      className={className}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        fontFamily: tokens.typography.fontSans,
        fontWeight: tokens.typography.weightMedium,
        borderRadius: tokens.radius.full,
        backgroundColor: bg,
        color: text,
        whiteSpace: 'nowrap',
        ...sizeStyles[size],
      }}
    >
      {dot && (
        <span
          style={{
            width: '6px',
            height: '6px',
            borderRadius: tokens.radius.full,
            backgroundColor: dotColor,
          }}
        />
      )}
      {children}
    </span>
  );
}

interface StatusBadgeProps {
  status: 'active' | 'inactive' | 'pending' | 'completed' | 'error';
  className?: string;
}

const statusMap: Record<StatusBadgeProps['status'], { label: string; variant: BadgeVariant }> = {
  active: { label: 'Active', variant: 'success' },
  inactive: { label: 'Inactive', variant: 'default' },
  pending: { label: 'Pending', variant: 'warning' },
  completed: { label: 'Completed', variant: 'primary' },
  error: { label: 'Error', variant: 'error' },
};

export function StatusBadge({ status, className = '' }: StatusBadgeProps) {
  const { label, variant } = statusMap[status];
  return (
    <Badge variant={variant} dot className={className}>
      {label}
    </Badge>
  );
}
