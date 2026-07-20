'use client';

import React from 'react';
import { tokens } from '../tokens';
import { Logo } from './Logo';

interface SidebarProps {
  children: React.ReactNode;
}

interface SidebarItemProps {
  icon: React.ReactNode;
  label: string;
  active?: boolean;
  badge?: string | number;
  onClick?: () => void;
}

interface SidebarSectionProps {
  title?: string;
  children: React.ReactNode;
}

export function Sidebar({ children }: SidebarProps) {
  return (
    <aside
      style={{
        width: '260px',
        height: '100vh',
        backgroundColor: tokens.colors.surface,
        borderRight: `1px solid ${tokens.colors.border}`,
        display: 'flex',
        flexDirection: 'column',
        position: 'fixed',
        left: 0,
        top: 0,
        fontFamily: tokens.typography.fontSans,
      }}
    >
      <div style={{
        padding: tokens.spacing[6],
        borderBottom: `1px solid ${tokens.colors.border}`,
      }}>
        <Logo />
      </div>
      <nav style={{
        flex: 1,
        padding: tokens.spacing[3],
        overflowY: 'auto',
      }}>
        {children}
      </nav>
      <div style={{
        padding: tokens.spacing[4],
        borderTop: `1px solid ${tokens.colors.border}`,
      }}>
        <SidebarItem
          icon={<UserIcon />}
          label="Account"
        />
      </div>
    </aside>
  );
}

export function SidebarSection({ title, children }: SidebarSectionProps) {
  return (
    <div style={{ marginBottom: tokens.spacing[4] }}>
      {title && (
        <p style={{
          fontSize: tokens.typography.textXs,
          fontWeight: tokens.typography.weightMedium,
          color: tokens.colors.textTertiary,
          textTransform: 'uppercase',
          letterSpacing: tokens.typography.trackingWide,
          padding: `${tokens.spacing[2]} ${tokens.spacing[3]}`,
          marginBottom: tokens.spacing[1],
        }}>
          {title}
        </p>
      )}
      {children}
    </div>
  );
}

export function SidebarItem({ icon, label, active = false, badge, onClick }: SidebarItemProps) {
  const [isHovered, setIsHovered] = React.useState(false);

  return (
    <button
      onClick={onClick}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      style={{
        width: '100%',
        display: 'flex',
        alignItems: 'center',
        gap: tokens.spacing[3],
        padding: `${tokens.spacing[2.5]} ${tokens.spacing[3]}`,
        borderRadius: tokens.radius.lg,
        border: 'none',
        backgroundColor: active ? tokens.colors.accent : isHovered ? tokens.colors.accent : 'transparent',
        color: active ? tokens.colors.primary : tokens.colors.text,
        fontSize: tokens.typography.textBase,
        fontWeight: active ? tokens.typography.weightMedium : tokens.typography.weightNormal,
        fontFamily: tokens.typography.fontSans,
        cursor: 'pointer',
        transition: `all ${tokens.animation.durationFast} ${tokens.animation.easeDefault}`,
        textAlign: 'left',
      }}
    >
      <span style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        width: '20px',
        height: '20px',
        color: active ? tokens.colors.primary : tokens.colors.textSecondary,
      }}>
        {icon}
      </span>
      <span style={{ flex: 1 }}>{label}</span>
      {badge && (
        <span style={{
          fontSize: tokens.typography.textXs,
          fontWeight: tokens.typography.weightMedium,
          backgroundColor: tokens.colors.primary,
          color: tokens.colors.textInverse,
          padding: `${tokens.spacing[0.5]} ${tokens.spacing[2]}`,
          borderRadius: tokens.radius.full,
          minWidth: '20px',
          textAlign: 'center',
        }}>
          {badge}
        </span>
      )}
    </button>
  );
}

function UserIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.5">
      <circle cx="10" cy="6" r="3" />
      <path d="M3 18c0-3.5 3-6 7-6s7 2.5 7 6" strokeLinecap="round" />
    </svg>
  );
}

export function HomeIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.5">
      <path d="M3 10l7-7 7 7" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M5 9v8h10V9" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export function FolderIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.5">
      <path d="M2 6a2 2 0 012-2h4l2 2h6a2 2 0 012 2v6a2 2 0 01-2 2H4a2 2 0 01-2-2V6z" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export function UsersIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.5">
      <circle cx="7" cy="6" r="2.5" />
      <circle cx="14" cy="6" r="2.5" />
      <path d="M1 17c0-2.5 2.5-4.5 6-4.5S13 14.5 13 17" strokeLinecap="round" />
      <path d="M13 12.5c2.5 0 5 1.5 5 4.5" strokeLinecap="round" />
    </svg>
  );
}

export function ChartIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.5">
      <rect x="2" y="10" width="4" height="7" rx="1" />
      <rect x="8" y="6" width="4" height="11" rx="1" />
      <rect x="14" y="3" width="4" height="14" rx="1" />
    </svg>
  );
}

export function SettingsIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.5">
      <circle cx="10" cy="10" r="3" />
      <path d="M10 1v2M10 17v2M17.07 2.93l-1.41 1.41M4.34 15.66l-1.41 1.41M19 10h-2M3 10H1M17.07 17.07l-1.41-1.41M4.34 4.34L2.93 2.93" strokeLinecap="round" />
    </svg>
  );
}

export function DocumentIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.5">
      <path d="M4 2h8l4 4v12a1 1 0 01-1 1H4a1 1 0 01-1-1V3a1 1 0 011-1z" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M12 2v4h4" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M6 10h8M6 14h5" strokeLinecap="round" />
    </svg>
  );
}

export function GraduationIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.5">
      <path d="M10 2L1 7l9 5 9-5-9-5z" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M4 9v5c0 2 3 3 6 3s6-1 6-3V9" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M18 7v6" strokeLinecap="round" />
    </svg>
  );
}
