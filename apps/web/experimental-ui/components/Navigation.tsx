'use client';

import React from 'react';
import { tokens } from '../tokens';
import { Button, IconButton } from './Button';
import { Logo } from './Logo';

interface NavigationProps {
  transparent?: boolean;
}

export function Navigation({ transparent = false }: NavigationProps) {
  return (
    <header
      style={{
        position: 'sticky',
        top: 0,
        zIndex: tokens.zIndex.sticky,
        backgroundColor: transparent ? 'transparent' : tokens.colors.surface,
        backdropFilter: transparent ? tokens.colors.glassBackdrop : 'none',
        WebkitBackdropFilter: transparent ? tokens.colors.glassBackdrop : 'none',
        borderBottom: transparent ? 'none' : `1px solid ${tokens.colors.border}`,
      }}
    >
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          height: '64px',
          padding: `0 ${tokens.spacing[6]}`,
          maxWidth: '1440px',
          margin: '0 auto',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: tokens.spacing[8] }}>
          <Logo size="md" />
          <nav style={{ display: 'flex', gap: tokens.spacing[1] }}>
            <NavLink href="#" active>Dashboard</NavLink>
            <NavLink href="#">Classes</NavLink>
            <NavLink href="#">Assignments</NavLink>
            <NavLink href="#">Analytics</NavLink>
          </nav>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: tokens.spacing[3] }}>
          <IconButton variant="ghost" aria-label="Search">
            <SearchIcon />
          </IconButton>
          <IconButton variant="ghost" aria-label="Notifications">
            <BellIcon />
          </IconButton>
          <div
            style={{
              width: '1px',
              height: '24px',
              backgroundColor: tokens.colors.border,
              margin: `0 ${tokens.spacing[2]}`,
            }}
          />
          <Button variant="ghost" size="sm" style={{ gap: tokens.spacing[2] }}>
            <Avatar name="Teacher" size={28} />
            <span style={{ fontFamily: tokens.typography.fontSans }}>Teacher</span>
            <ChevronDownIcon />
          </Button>
        </div>
      </div>
    </header>
  );
}

interface NavLinkProps {
  href: string;
  children: React.ReactNode;
  active?: boolean;
}

function NavLink({ href, children, active = false }: NavLinkProps) {
  const [isHovered, setIsHovered] = React.useState(false);

  return (
    <a
      href={href}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      style={{
        display: 'flex',
        alignItems: 'center',
        padding: `${tokens.spacing[2]} ${tokens.spacing[3]}`,
        borderRadius: tokens.radius.md,
        fontSize: tokens.typography.textBase,
        fontWeight: active ? tokens.typography.weightMedium : tokens.typography.weightNormal,
        fontFamily: tokens.typography.fontSans,
        color: active ? tokens.colors.text : tokens.colors.textSecondary,
        backgroundColor: active ? tokens.colors.accent : isHovered ? tokens.colors.accent : 'transparent',
        textDecoration: 'none',
        transition: `all ${tokens.animation.durationFast} ${tokens.animation.easeDefault}`,
      }}
    >
      {children}
    </a>
  );
}

interface AvatarProps {
  name: string;
  src?: string;
  size?: number;
}

export function Avatar({ name, src, size = 32 }: AvatarProps) {
  const initials = name
    .split(' ')
    .map((n) => n[0])
    .join('')
    .slice(0, 2)
    .toUpperCase();

  if (src) {
    return (
      <img
        src={src}
        alt={name}
        style={{
          width: size,
          height: size,
          borderRadius: tokens.radius.full,
          objectFit: 'cover',
        }}
      />
    );
  }

  return (
    <div
      style={{
        width: size,
        height: size,
        borderRadius: tokens.radius.full,
        backgroundColor: tokens.colors.accent,
        color: tokens.colors.primary,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        fontSize: size * 0.4,
        fontWeight: tokens.typography.weightMedium,
        fontFamily: tokens.typography.fontSans,
      }}
    >
      {initials}
    </div>
  );
}

function SearchIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.5">
      <circle cx="9" cy="9" r="6" />
      <path d="M14 14l4 4" strokeLinecap="round" />
    </svg>
  );
}

function BellIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.5">
      <path d="M10 2a5 5 0 015 5v3l2 3H3l2-3V7a5 5 0 015-5z" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M8 17a2 2 0 004 0" strokeLinecap="round" />
    </svg>
  );
}

function ChevronDownIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5">
      <path d="M4 6l4 4 4-4" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}
