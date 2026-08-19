/**
 * tokens.ts
 *
 * Centralized semantic design tokens for ChainBudget Mobile.
 * Provides consistent color palettes, surface levels, typography contrast,
 * borders, inputs, and navigation styling across Light and Dark themes.
 */

export type ThemeMode = 'system' | 'light' | 'dark';
export type ThemeType = 'light' | 'dark';

export interface ThemeColors {
  // Base backgrounds
  background: string;
  backgroundSecondary: string;
  surface: string;
  surfaceElevated: string;
  card: string;
  cardGlass: string;
  modalBackdrop: string;

  // Text colors
  textPrimary: string;
  textSecondary: string;
  textMuted: string;
  textInverse: string;

  // Brand & Accents
  primary: string;
  primaryHover: string;
  primaryMuted: string;
  accentFuchsia: string;
  accentPurple: string;
  accentCyan: string;
  accentBlue: string;

  // Borders & Dividers
  border: string;
  borderSubtle: string;
  borderStrong: string;
  borderFocus: string;

  // Status & Semantic feedback
  success: string;
  successBg: string;
  successBorder: string;
  error: string;
  errorBg: string;
  errorBorder: string;
  warning: string;
  warningBg: string;
  warningBorder: string;
  info: string;
  infoBg: string;
  infoBorder: string;

  // Form Controls
  inputBackground: string;
  inputBorder: string;
  inputPlaceholder: string;

  // Navigation & System Bars
  tabBarBackground: string;
  tabBarBorder: string;
  tabBarActive: string;
  tabBarInactive: string;
  headerBackground: string;
  headerText: string;
  statusBarStyle: 'light' | 'dark';

  // Skeletons
  skeletonFrom: string;
  skeletonTo: string;
}

export const darkTheme: ThemeColors = {
  // Base backgrounds
  background: '#09090b',
  backgroundSecondary: '#121216',
  surface: '#151520',
  surfaceElevated: '#1a1a28',
  card: '#161622',
  cardGlass: 'rgba(255, 255, 255, 0.05)',
  modalBackdrop: 'rgba(0, 0, 0, 0.82)',

  // Text colors
  textPrimary: '#ffffff',
  textSecondary: 'rgba(255, 255, 255, 0.70)',
  textMuted: 'rgba(255, 255, 255, 0.40)',
  textInverse: '#09090b',

  // Brand & Accents
  primary: '#e879f9',
  primaryHover: '#d946ef',
  primaryMuted: 'rgba(232, 121, 249, 0.15)',
  accentFuchsia: '#e879f9',
  accentPurple: '#a855f7',
  accentCyan: '#22d3ee',
  accentBlue: '#38bdf8',

  // Borders & Dividers
  border: 'rgba(255, 255, 255, 0.10)',
  borderSubtle: 'rgba(255, 255, 255, 0.06)',
  borderStrong: 'rgba(255, 255, 255, 0.20)',
  borderFocus: '#e879f9',

  // Status & Semantic feedback
  success: '#4ade80',
  successBg: 'rgba(74, 222, 128, 0.12)',
  successBorder: 'rgba(74, 222, 128, 0.30)',
  error: '#ef4444',
  errorBg: 'rgba(239, 68, 68, 0.12)',
  errorBorder: 'rgba(239, 68, 68, 0.30)',
  warning: '#f59e0b',
  warningBg: 'rgba(245, 158, 11, 0.12)',
  warningBorder: 'rgba(245, 158, 11, 0.30)',
  info: '#38bdf8',
  infoBg: 'rgba(56, 189, 248, 0.12)',
  infoBorder: 'rgba(56, 189, 248, 0.30)',

  // Form Controls
  inputBackground: 'rgba(0, 0, 0, 0.45)',
  inputBorder: 'rgba(255, 255, 255, 0.12)',
  inputPlaceholder: '#666677',

  // Navigation & System Bars
  tabBarBackground: '#09090b',
  tabBarBorder: '#202028',
  tabBarActive: '#e879f9',
  tabBarInactive: '#888899',
  headerBackground: '#09090b',
  headerText: '#ffffff',
  statusBarStyle: 'light',

  // Skeletons
  skeletonFrom: '#1f1f2e',
  skeletonTo: '#2e2e42',
};

export const lightTheme: ThemeColors = {
  // Base backgrounds
  background: '#f8fafc',
  backgroundSecondary: '#f1f5f9',
  surface: '#ffffff',
  surfaceElevated: '#f8fafc',
  card: '#ffffff',
  cardGlass: 'rgba(0, 0, 0, 0.03)',
  modalBackdrop: 'rgba(15, 23, 42, 0.65)',

  // Text colors
  textPrimary: '#0f172a',
  textSecondary: '#475569',
  textMuted: '#94a3b8',
  textInverse: '#ffffff',

  // Brand & Accents
  primary: '#c026d3',
  primaryHover: '#a21caf',
  primaryMuted: 'rgba(192, 38, 211, 0.10)',
  accentFuchsia: '#c026d3',
  accentPurple: '#9333ea',
  accentCyan: '#0891b2',
  accentBlue: '#0284c7',

  // Borders & Dividers
  border: '#e2e8f0',
  borderSubtle: '#f1f5f9',
  borderStrong: '#cbd5e1',
  borderFocus: '#c026d3',

  // Status & Semantic feedback
  success: '#16a34a',
  successBg: 'rgba(22, 163, 74, 0.10)',
  successBorder: 'rgba(22, 163, 74, 0.25)',
  error: '#dc2626',
  errorBg: 'rgba(220, 38, 38, 0.10)',
  errorBorder: 'rgba(220, 38, 38, 0.25)',
  warning: '#d97706',
  warningBg: 'rgba(217, 119, 6, 0.10)',
  warningBorder: 'rgba(217, 119, 6, 0.25)',
  info: '#0284c7',
  infoBg: 'rgba(2, 132, 199, 0.10)',
  infoBorder: 'rgba(2, 132, 199, 0.25)',

  // Form Controls
  inputBackground: '#f1f5f9',
  inputBorder: '#cbd5e1',
  inputPlaceholder: '#94a3b8',

  // Navigation & System Bars
  tabBarBackground: '#ffffff',
  tabBarBorder: '#e2e8f0',
  tabBarActive: '#c026d3',
  tabBarInactive: '#94a3b8',
  headerBackground: '#ffffff',
  headerText: '#0f172a',
  statusBarStyle: 'dark',

  // Skeletons
  skeletonFrom: '#e2e8f0',
  skeletonTo: '#cbd5e1',
};
