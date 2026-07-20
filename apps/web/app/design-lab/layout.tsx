'use client';

import React from 'react';
import { tokens } from '../../experimental-ui';

/**
 * Design Lab Layout
 * 
 * Isolated experimental layout for the redesign.
 * This layout is completely separate from production.
 */
export default function DesignLabLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div
      style={{
        minHeight: '100vh',
        backgroundColor: tokens.colors.background,
        fontFamily: tokens.typography.fontSans,
      }}
    >
      {/* Experimental banner */}
      <div
        style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          height: '32px',
          backgroundColor: tokens.colors.primary,
          color: tokens.colors.textInverse,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontSize: tokens.typography.textXs,
          fontWeight: tokens.typography.weightMedium,
          letterSpacing: tokens.typography.trackingWide,
          textTransform: 'uppercase',
          zIndex: tokens.zIndex.fixed + 10,
        }}
      >
        🧪 Design Lab — Experimental UI Preview
      </div>
      
      {/* Main content with offset for banner */}
      <div style={{ paddingTop: '32px' }}>
        {children}
      </div>
    </div>
  );
}
