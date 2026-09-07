'use client';

import React from 'react';
import { tokens } from '../tokens';

interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
  hint?: string;
  icon?: React.ReactNode;
}

export function Input({
  label,
  error,
  hint,
  icon,
  className = '',
  style,
  ...props
}: InputProps) {
  const [isFocused, setIsFocused] = React.useState(false);

  return (
    <div className={className} style={{ width: '100%' }}>
      {label && (
        <label
          style={{
            display: 'block',
            fontSize: tokens.typography.textSm,
            fontWeight: tokens.typography.weightMedium,
            color: tokens.colors.text,
            marginBottom: tokens.spacing[1.5],
            fontFamily: tokens.typography.fontSans,
          }}
        >
          {label}
        </label>
      )}
      <div style={{ position: 'relative' }}>
        {icon && (
          <div
            style={{
              position: 'absolute',
              left: tokens.spacing[3],
              top: '50%',
              transform: 'translateY(-50%)',
              color: tokens.colors.textTertiary,
              display: 'flex',
              alignItems: 'center',
            }}
          >
            {icon}
          </div>
        )}
        <input
          {...props}
          onFocus={(e) => {
            setIsFocused(true);
            props.onFocus?.(e);
          }}
          onBlur={(e) => {
            setIsFocused(false);
            props.onBlur?.(e);
          }}
          style={{
            width: '100%',
            height: '40px',
            padding: `0 ${tokens.spacing[3]}`,
            paddingLeft: icon ? tokens.spacing[10] : tokens.spacing[3],
            fontSize: tokens.typography.textBase,
            fontFamily: tokens.typography.fontSans,
            color: tokens.colors.text,
            backgroundColor: tokens.colors.surface,
            border: `1px solid ${error ? tokens.colors.error : isFocused ? tokens.colors.borderFocus : tokens.colors.border}`,
            borderRadius: tokens.radius.lg,
            outline: 'none',
            transition: `all ${tokens.animation.durationFast} ${tokens.animation.easeDefault}`,
            boxShadow: isFocused ? `0 0 0 3px ${tokens.colors.primaryMuted}` : 'none',
            ...style,
          }}
        />
      </div>
      {(error || hint) && (
        <p
          style={{
            fontSize: tokens.typography.textSm,
            color: error ? tokens.colors.error : tokens.colors.textTertiary,
            marginTop: tokens.spacing[1.5],
            fontFamily: tokens.typography.fontSans,
          }}
        >
          {error || hint}
        </p>
      )}
    </div>
  );
}

interface TextareaProps extends React.TextareaHTMLAttributes<HTMLTextAreaElement> {
  label?: string;
  error?: string;
  hint?: string;
}

export function Textarea({
  label,
  error,
  hint,
  className = '',
  style,
  ...props
}: TextareaProps) {
  const [isFocused, setIsFocused] = React.useState(false);

  return (
    <div className={className} style={{ width: '100%' }}>
      {label && (
        <label
          style={{
            display: 'block',
            fontSize: tokens.typography.textSm,
            fontWeight: tokens.typography.weightMedium,
            color: tokens.colors.text,
            marginBottom: tokens.spacing[1.5],
            fontFamily: tokens.typography.fontSans,
          }}
        >
          {label}
        </label>
      )}
      <textarea
        {...props}
        onFocus={(e) => {
          setIsFocused(true);
          props.onFocus?.(e);
        }}
        onBlur={(e) => {
          setIsFocused(false);
          props.onBlur?.(e);
        }}
        style={{
          width: '100%',
          minHeight: '100px',
          padding: tokens.spacing[3],
          fontSize: tokens.typography.textBase,
          fontFamily: tokens.typography.fontSans,
          color: tokens.colors.text,
          backgroundColor: tokens.colors.surface,
          border: `1px solid ${error ? tokens.colors.error : isFocused ? tokens.colors.borderFocus : tokens.colors.border}`,
          borderRadius: tokens.radius.lg,
          outline: 'none',
          resize: 'vertical',
          transition: `all ${tokens.animation.durationFast} ${tokens.animation.easeDefault}`,
          boxShadow: isFocused ? `0 0 0 3px ${tokens.colors.primaryMuted}` : 'none',
          ...style,
        }}
      />
      {(error || hint) && (
        <p
          style={{
            fontSize: tokens.typography.textSm,
            color: error ? tokens.colors.error : tokens.colors.textTertiary,
            marginTop: tokens.spacing[1.5],
            fontFamily: tokens.typography.fontSans,
          }}
        >
          {error || hint}
        </p>
      )}
    </div>
  );
}

interface SelectProps extends React.SelectHTMLAttributes<HTMLSelectElement> {
  label?: string;
  error?: string;
  options: { value: string; label: string }[];
}

export function Select({
  label,
  error,
  options,
  className = '',
  style,
  ...props
}: SelectProps) {
  const [isFocused, setIsFocused] = React.useState(false);

  return (
    <div className={className} style={{ width: '100%' }}>
      {label && (
        <label
          style={{
            display: 'block',
            fontSize: tokens.typography.textSm,
            fontWeight: tokens.typography.weightMedium,
            color: tokens.colors.text,
            marginBottom: tokens.spacing[1.5],
            fontFamily: tokens.typography.fontSans,
          }}
        >
          {label}
        </label>
      )}
      <select
        {...props}
        onFocus={(e) => {
          setIsFocused(true);
          props.onFocus?.(e);
        }}
        onBlur={(e) => {
          setIsFocused(false);
          props.onBlur?.(e);
        }}
        style={{
          width: '100%',
          height: '40px',
          padding: `0 ${tokens.spacing[3]}`,
          fontSize: tokens.typography.textBase,
          fontFamily: tokens.typography.fontSans,
          color: tokens.colors.text,
          backgroundColor: tokens.colors.surface,
          border: `1px solid ${error ? tokens.colors.error : isFocused ? tokens.colors.borderFocus : tokens.colors.border}`,
          borderRadius: tokens.radius.lg,
          outline: 'none',
          cursor: 'pointer',
          transition: `all ${tokens.animation.durationFast} ${tokens.animation.easeDefault}`,
          boxShadow: isFocused ? `0 0 0 3px ${tokens.colors.primaryMuted}` : 'none',
          ...style,
        }}
      >
        {options.map((opt) => (
          <option key={opt.value} value={opt.value}>
            {opt.label}
          </option>
        ))}
      </select>
      {error && (
        <p
          style={{
            fontSize: tokens.typography.textSm,
            color: tokens.colors.error,
            marginTop: tokens.spacing[1.5],
            fontFamily: tokens.typography.fontSans,
          }}
        >
          {error}
        </p>
      )}
    </div>
  );
}
