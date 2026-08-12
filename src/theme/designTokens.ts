import { Platform } from 'react-native';

/**
 * TDF Design Tokens
 *
 * Shared visual constants extracted from the web theme to keep mobile in sync.
 * Import these instead of hard-coding colors in components.
 */

export const palette = {
  primary: '#8b5cf6',
  primaryDark: '#7c3aed',
  secondary: '#f43f5e',
  secondaryDark: '#e11d48',
  background: '#ffffff',
  backgroundDark: '#0a0a0f',
  surface: '#f8f7f5',
  surfaceDark: '#12121a',
  text: '#111113',
  textDark: '#f4f4f5',
  textSecondary: '#5a5a63',
  textSecondaryDark: '#a1a1aa',
  divider: 'rgba(0,0,0,0.06)',
  dividerDark: 'rgba(255,255,255,0.06)',
  actionHover: 'rgba(0,0,0,0.04)',
  actionHoverDark: 'rgba(255,255,255,0.04)',
} as const;

export const radii = {
  sm: 6,
  md: 10,
  lg: 12,
  xl: 16,
  full: 999,
} as const;

export const shadows = {
  sm: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 2,
    elevation: 1,
  },
  md: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.06,
    shadowRadius: 8,
    elevation: 3,
  },
  lg: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.08,
    shadowRadius: 16,
    elevation: 6,
  },
  primaryGlow: {
    shadowColor: palette.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.35,
    shadowRadius: 8,
    elevation: 6,
  },
} as const;

export const typography = {
  // React Native accepts one installed family rather than a CSS fallback list.
  // Until Inter is bundled, use each platform's deterministic system face.
  fontFamily: Platform.select({ ios: 'System', android: 'sans-serif', default: 'system-ui' }),
  sizes: {
    xs: 10,
    sm: 12,
    base: 14,
    md: 15,
    lg: 18,
    xl: 22,
    '2xl': 28,
  },
  weights: {
    normal: '400',
    medium: '500',
    semibold: '600',
    bold: '700',
  },
} as const;

export const spacing = {
  px: 1,
  0.5: 2,
  1: 4,
  1.5: 6,
  2: 8,
  2.5: 10,
  3: 12,
  4: 16,
  5: 20,
  6: 24,
  8: 32,
  10: 40,
  12: 48,
} as const;
