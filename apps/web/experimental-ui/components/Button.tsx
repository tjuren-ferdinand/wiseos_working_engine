'use client';

import React from 'react';
import { tokens } from '../tokens';

type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'danger';
type ButtonSize = 'sm' | 'md' | 'lg';

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  icon?: React.ReactNode;
  iconPosition?: 'left' | 'right';
  loading?: boolean;
  fullWidth?: boolean;
}

const variantStyles: Record<ButtonVariant, React.CSSProperties> = {
  primary: {
    backgroundColor: tokens.colors.primary,
    color: tokens.colors.textInverse,
    border: 'none',
    boxShadow: tokens.colors.shadowPrimary,
  },
  secondary: {
    backgroundColor: tokens.colors.surface,
    color: tokens.colors.text,
    border: `1px solid ${tokens.colors.border}`,
    boxShadow: tokens.colors.shadowXs,
  },
  ghost: {
    backgroundColor: 'transparent',
    color: tokens.colors.textSecondary,
    border: 'none',
  },
  danger: {
    backgroundColor: tokens.colors.error,
    color: tokens.colors.textInverse,
    border: 'none',
  },
};

const sizeStyles: Record<ButtonSize, React.CSSProperties> = {
  sm: {
    height: '32px',
    padding: `0 ${tokens.spacing[3]}`,
    fontSize: tokens.typography.textSm,
    borderRadius: tokens.radius.md,
    gap: tokens.spacing[1.5],
  },
  md: {
    height: '40px',
    padding: `0 ${tokens.spacing[4]}`,
    fontSize: tokens.typography.textBase,
    borderRadius: tokens.radius.lg,
    gap: tokens.spacing[2],
  },
  lg: {
    height: '48px',
    padding: `0 ${tokens.spacing[6]}`,
    fontSize: tokens.typography.textMd,
    borderRadius: tokens.radius.lg,
    gap: tokens.spacing[2.5],
  },
};

export function Button({
  children,
  variant = 'primary',
  size = 'md',
  icon,
  iconPosition = 'left',
  loading = false,
  fullWidth = false,
  disabled,
  style,
  ...props
}: ButtonProps) {
  const [isHovered, setIsHovered] = React.useState(false);
  const [isPressed, setIsPressed] = React.useState(false);

  const baseStyle: React.CSSProperties = {
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontFamily: tokens.typography.fontSans,
    fontWeight: tokens.typography.weightMedium,
    cursor: disabled || loading ? 'not-allowed' : 'pointer',
    opacity: disabled ? 0.5 : 1,
    transition: `all ${tokens.animation.durationBase} ${tokens.animation.easeDefault}`,
    outline: 'none',
    width: fullWidth ? '100%' : 'auto',
    ...variantStyles[variant],
    ...sizeStyles[size],
    ...(isHovered && !disabled && !loading ? getHoverStyles(variant) : {}),
    ...(isPressed && !disabled && !loading ? { transform: 'scale(0.98)' } : {}),
    ...style,
  };

  function getHoverStyles(v: ButtonVariant): React.CSSProperties {
    switch (v) {
      case 'primary':
        return { backgroundColor: tokens.colors.primaryHover };
      case 'secondary':
        return { backgroundColor: tokens.colors.accent, borderColor: tokens.colors.borderFocus };
      case 'ghost':
        return { backgroundColor: tokens.colors.accent };
      case 'danger':
        return { backgroundColor: '#B54545' };
      default:
        return {};
    }
  }

  return (
    <button
      {...props}
      disabled={disabled || loading}
      style={baseStyle}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => { setIsHovered(false); setIsPressed(false); }}
      onMouseDown={() => setIsPressed(true)}
      onMouseUp={() => setIsPressed(false)}
    >
      {loading && (
        <svg
          width="16"
          height="16"
          viewBox="0 0 16 16"
          fill="none"
          style={{ animation: 'spin 1s linear infinite' }}
        >
          <circle cx="8" cy="8" r="6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeDasharray="32" strokeDashoffset="12" />
        </svg>
      )}
      {!loading && icon && iconPosition === 'left' && icon}
      {children}
      {!loading && icon && iconPosition === 'right' && icon}
    </button>
  );
}

export function IconButton({
  children,
  variant = 'ghost',
  size = 'md',
  ...props
}: Omit<ButtonProps, 'icon' | 'iconPosition'>) {
  const sizeMap: Record<ButtonSize, string> = {
    sm: '32px',
    md: '40px',
    lg: '48px',
  };

  return (
    <Button
      {...props}
      variant={variant}
      size={size}
      style={{
        width: sizeMap[size],
        padding: 0,
        ...props.style,
      }}
    >
      {children}
    </Button>
  );
}
