/**
 * WiseOS Experimental Design Tokens
 * Apple Vision Pro / Linear / Vercel inspired
 * Scandinavian minimalism + Premium SaaS
 */

export const tokens = {
  colors: {
    // Core palette
    background: '#FAF9F7',
    surface: '#FFFFFF',
    primary: '#9B5A97',
    primaryHover: '#8A4E87',
    primaryMuted: '#F0E8F0',
    
    // Text hierarchy
    text: '#1C1A1E',
    textSecondary: '#57525A',
    textTertiary: '#8A858D',
    textInverse: '#FFFFFF',
    
    // Borders & dividers
    border: '#E8E2EC',
    borderSubtle: '#F0ECF2',
    borderFocus: '#9B5A97',
    
    // Accent & feedback
    accent: '#F0E8F0',
    accentHover: '#E8DDE8',
    
    // Status colors
    success: '#2D8A5F',
    successMuted: '#E8F5EE',
    warning: '#B8860B',
    warningMuted: '#FDF6E3',
    error: '#C74E4E',
    errorMuted: '#FCE8E8',
    info: '#4A7FB8',
    infoMuted: '#E8F0F8',
    
    // Glass effects
    glass: 'rgba(255, 255, 255, 0.72)',
    glassBorder: 'rgba(255, 255, 255, 0.18)',
    glassBackdrop: 'saturate(180%) blur(20px)',
    
    // Shadows
    shadowXs: '0 1px 2px rgba(28, 26, 30, 0.04)',
    shadowSm: '0 2px 4px rgba(28, 26, 30, 0.06)',
    shadowMd: '0 4px 12px rgba(28, 26, 30, 0.08)',
    shadowLg: '0 8px 24px rgba(28, 26, 30, 0.10)',
    shadowXl: '0 16px 48px rgba(28, 26, 30, 0.12)',
    shadowPrimary: '0 4px 14px rgba(155, 90, 151, 0.25)',
  },
  
  typography: {
    // Font families
    fontSans: '"Inter", -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
    fontMono: '"JetBrains Mono", "SF Mono", Monaco, monospace',
    
    // Font sizes (rem)
    textXs: '0.75rem',     // 12px
    textSm: '0.8125rem',   // 13px
    textBase: '0.875rem',  // 14px
    textMd: '0.9375rem',   // 15px
    textLg: '1rem',        // 16px
    textXl: '1.125rem',    // 18px
    text2xl: '1.375rem',   // 22px
    text3xl: '1.75rem',    // 28px
    text4xl: '2.25rem',    // 36px
    text5xl: '3rem',       // 48px
    
    // Line heights
    leadingTight: '1.2',
    leadingSnug: '1.35',
    leadingNormal: '1.5',
    leadingRelaxed: '1.625',
    
    // Font weights
    weightNormal: '400',
    weightMedium: '500',
    weightSemibold: '600',
    weightBold: '700',
    
    // Letter spacing
    trackingTighter: '-0.03em',
    trackingTight: '-0.015em',
    trackingNormal: '0',
    trackingWide: '0.025em',
  },
  
  spacing: {
    px: '1px',
    0: '0',
    0.5: '0.125rem',  // 2px
    1: '0.25rem',     // 4px
    1.5: '0.375rem',  // 6px
    2: '0.5rem',      // 8px
    2.5: '0.625rem',  // 10px
    3: '0.75rem',     // 12px
    4: '1rem',        // 16px
    5: '1.25rem',     // 20px
    6: '1.5rem',      // 24px
    8: '2rem',        // 32px
    10: '2.5rem',     // 40px
    12: '3rem',       // 48px
    16: '4rem',       // 64px
    20: '5rem',       // 80px
    24: '6rem',       // 96px
  },
  
  radius: {
    none: '0',
    sm: '0.375rem',   // 6px
    md: '0.5rem',     // 8px
    lg: '0.75rem',    // 12px
    xl: '1rem',       // 16px
    '2xl': '1.25rem', // 20px
    full: '9999px',
  },
  
  animation: {
    durationFast: '150ms',
    durationBase: '200ms',
    durationSlow: '300ms',
    durationSlower: '400ms',
    easeDefault: 'cubic-bezier(0.4, 0, 0.2, 1)',
    easeIn: 'cubic-bezier(0.4, 0, 1, 1)',
    easeOut: 'cubic-bezier(0, 0, 0.2, 1)',
    easeInOut: 'cubic-bezier(0.4, 0, 0.2, 1)',
    spring: 'cubic-bezier(0.34, 1.56, 0.64, 1)',
  },
  
  breakpoints: {
    sm: '640px',
    md: '768px',
    lg: '1024px',
    xl: '1280px',
    '2xl': '1536px',
  },
  
  zIndex: {
    dropdown: 1000,
    sticky: 1020,
    fixed: 1030,
    modalBackdrop: 1040,
    modal: 1050,
    popover: 1060,
    tooltip: 1070,
  },
} as const;

export type Tokens = typeof tokens;
export default tokens;
