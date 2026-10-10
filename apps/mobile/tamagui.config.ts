import { createAnimations } from '@tamagui/animations-moti';
import { createFont, createTamagui, createTokens } from 'tamagui';

const animations = createAnimations({
  fast: { type: 'spring', damping: 18, stiffness: 280, mass: 0.7 },
  medium: { type: 'spring', damping: 20, stiffness: 180 },
  lazy: { type: 'spring', damping: 24, stiffness: 100 },
  press: { type: 'spring', damping: 12, stiffness: 400 },
  // Stitch "squishy" tactile feel
  bouncy: { type: 'spring', damping: 10, stiffness: 340, mass: 0.9 },
});

// Plus Jakarta Sans — headings / buttons
const headingFont = createFont({
  family: 'PlusJakartaSans',
  size: {
    1: 11, 2: 12, 3: 13, 4: 14, 5: 16, 6: 18,
    7: 20, 8: 24, 9: 28, 10: 32, 11: 40, 12: 48,
    true: 16,
  },
  lineHeight: {
    1: 14, 2: 16, 3: 18, 4: 20, 5: 22, 6: 24,
    7: 28, 8: 32, 9: 36, 10: 40, 11: 48, 12: 56,
  },
  weight: {
    1: '300', 2: '400', 3: '500', 4: '600',
    5: '700', 6: '800', true: '700',
  },
  letterSpacing: {
    1: 0.02, 2: 0, 3: -0.01, 4: -0.02, 5: -0.02,
  },
  face: {
    300: { normal: 'PlusJakartaSans_300Light' },
    400: { normal: 'PlusJakartaSans_400Regular' },
    500: { normal: 'PlusJakartaSans_500Medium' },
    600: { normal: 'PlusJakartaSans_600SemiBold' },
    700: { normal: 'PlusJakartaSans_700Bold' },
    800: { normal: 'PlusJakartaSans_800ExtraBold' },
  },
});

// Space Grotesk — body / data / labels
const bodyFont = createFont({
  family: 'SpaceGrotesk',
  size: {
    1: 11, 2: 12, 3: 13, 4: 14, 5: 15, 6: 16,
    7: 18, 8: 20, 9: 24, 10: 28,
    true: 16,
  },
  lineHeight: {
    1: 14, 2: 16, 3: 18, 4: 20, 5: 22, 6: 24,
    7: 28, 8: 30, 9: 34, 10: 38,
  },
  weight: {
    1: '300', 2: '400', 3: '500', 4: '600', 5: '700', true: '400',
  },
  letterSpacing: {
    1: 0.05, 2: 0.02, 3: 0, 4: 0, 5: -0.01,
  },
  face: {
    300: { normal: 'SpaceGrotesk_300Light' },
    400: { normal: 'SpaceGrotesk_400Regular' },
    500: { normal: 'SpaceGrotesk_500Medium' },
    600: { normal: 'SpaceGrotesk_600SemiBold' },
    700: { normal: 'SpaceGrotesk_700Bold' },
  },
});

// ── Vibrant Vitality palette ─────────────────────────────────────────────────
const palette = {
  // Primary — mint teal
  mint50:  '#ECFDF9',
  mint100: '#C7FAF3',
  mint200: '#90F5E8',
  mint300: '#4DE8D8',
  mint400: '#2DD4BF',  // ← Stitch primary / brand
  mint500: '#0FBFAB',
  mint600: '#009A8A',
  mint700: '#006b5f',  // ← dark primary
  mint800: '#004D45',
  mint900: '#003330',

  // Secondary — electric blue
  blue300: '#93C5FD',
  blue400: '#60A5FA',
  blue500: '#3B82F6',  // ← Stitch secondary
  blue600: '#2563EB',
  blue700: '#0058be',  // ← dark secondary

  // Tertiary / danger — rose
  rose300: '#FDA4AF',
  rose400: '#FB7185',
  rose500: '#F43F5E',  // ← Stitch tertiary
  rose600: '#E11D48',
  rose700: '#bc0b3b',

  // Accent — amber (from logo gradient)
  amber300: '#FCD34D',
  amber400: '#FBBF24',
  amber500: '#FFB24C',  // ← logo amber
  amber600: '#F59E0B',

  // Accent — lime (from logo gradient)
  lime400: '#A7FF3F',   // ← logo lime

  // Accent — cyan (from logo gradient)
  cyan400: '#62F4F1',   // ← logo cyan

  // Neutrals — warm-tinted for the off-white base
  neutral50:  '#F7F9FB',  // ← Stitch light background
  neutral100: '#F2F4F6',
  neutral200: '#E6E8EA',
  neutral300: '#D8DADC',
  neutral400: '#BACAC5',
  neutral500: '#6B7A76',
  neutral600: '#3C4A46',
  neutral700: '#26314D',  // ← logo dark stroke
  neutral800: '#1E293B',
  neutral850: '#131E2F',
  neutral900: '#0E1726',  // ← Stitch dark background base
  neutral950: '#080F1A',

  // Base
  white: '#FFFFFF',
  black: '#000000',

  // Onboarding / warm
  cream: '#FFF8EA',  // ← logo bracket / warm white
};

const tokens = createTokens({
  color: palette,
  space: {
    0: 0, 0.5: 2, 1: 4, 2: 8, 3: 12, 4: 16, 5: 20, 6: 24,
    7: 32, 8: 40, 9: 48, 10: 64,
    true: 16,
  },
  size: {
    0: 0, 1: 4, 2: 8, 3: 12, 4: 16, 5: 20, 6: 24, 7: 32,
    8: 40, 9: 48, 10: 64, 11: 80, 12: 96, 13: 112, 14: 128,
    true: 16,
  },
  // Stitch shape language: pill for buttons, 24px for cards
  radius: {
    0: 0, 1: 6, 2: 10, 3: 14, 4: 18, 5: 22, 6: 24, 7: 32, 8: 9999,
    true: 18,
  },
  zIndex: { 0: 0, 1: 100, 2: 200, 3: 300, 4: 400, 5: 500 },
});

// ── Light theme ──────────────────────────────────────────────────────────────
const lightTheme = {
  background:        palette.neutral50,
  backgroundHover:   palette.neutral100,
  backgroundPress:   palette.neutral200,

  // Glass / card surfaces
  surface:           palette.white,
  surfaceMuted:      palette.neutral100,
  surfaceGlass:      'rgba(255,255,255,0.72)',
  surfaceGlassDim:   'rgba(255,255,255,0.45)',

  borderColor:       palette.neutral400,
  borderGlass:       'rgba(255,255,255,0.6)',

  color:             palette.neutral700,       // on-surface text (dark, not pure black)
  colorMuted:        palette.neutral500,
  colorSubtle:       palette.neutral400,
  colorOnDark:       palette.cream,

  // Primary — mint teal
  primary:           palette.mint400,
  primaryDark:       palette.mint700,
  primaryPress:      palette.mint500,
  primarySoft:       palette.mint50,
  primaryGlass:      'rgba(45,212,191,0.15)',
  onPrimary:         palette.white,

  // Secondary — electric blue
  secondary:         palette.blue500,
  secondaryPress:    palette.blue600,
  secondarySoft:     'rgba(59,130,246,0.1)',
  onSecondary:       palette.white,

  // Status / accents
  success:           palette.mint400,
  warn:              palette.amber500,
  danger:            palette.rose500,
  dangerSoft:        'rgba(244,63,94,0.1)',

  // Logo accent colors
  accentCyan:        palette.cyan400,
  accentLime:        palette.lime400,
  accentAmber:       palette.amber500,

  // Shadows (colored glow)
  shadowColor:       'rgba(15, 23, 42, 0.08)',
  shadowPrimary:     'rgba(45,212,191,0.3)',
  shadowBlue:        'rgba(59,130,246,0.25)',
  shadowRose:        'rgba(244,63,94,0.25)',
};

// ── Dark theme ───────────────────────────────────────────────────────────────
const darkTheme = {
  background:        palette.neutral900,
  backgroundHover:   palette.neutral850,
  backgroundPress:   palette.neutral800,

  surface:           palette.neutral850,
  surfaceMuted:      palette.neutral800,
  surfaceGlass:      'rgba(14,23,38,0.72)',
  surfaceGlassDim:   'rgba(14,23,38,0.5)',

  borderColor:       'rgba(186,202,197,0.15)',
  borderGlass:       'rgba(255,255,255,0.1)',

  color:             palette.neutral200,
  colorMuted:        palette.neutral500,
  colorSubtle:       'rgba(186,202,197,0.5)',
  colorOnDark:       palette.cream,

  primary:           palette.mint400,
  primaryDark:       palette.mint300,
  primaryPress:      palette.mint500,
  primarySoft:       'rgba(45,212,191,0.15)',
  primaryGlass:      'rgba(45,212,191,0.12)',
  onPrimary:         palette.neutral950,

  secondary:         palette.blue400,
  secondaryPress:    palette.blue500,
  secondarySoft:     'rgba(96,165,250,0.12)',
  onSecondary:       palette.neutral950,

  success:           palette.mint400,
  warn:              palette.amber500,
  danger:            palette.rose400,
  dangerSoft:        'rgba(251,113,133,0.12)',

  accentCyan:        palette.cyan400,
  accentLime:        palette.lime400,
  accentAmber:       palette.amber500,

  shadowColor:       'rgba(0,0,0,0.5)',
  shadowPrimary:     'rgba(45,212,191,0.35)',
  shadowBlue:        'rgba(96,165,250,0.3)',
  shadowRose:        'rgba(251,113,133,0.3)',
};

// ── Config ───────────────────────────────────────────────────────────────────
const config = createTamagui({
  animations,
  defaultTheme: 'light',
  shouldAddPrefersColorThemes: true,
  themeClassNameOnRoot: false,
  fonts: { heading: headingFont as any, body: bodyFont as any },
  tokens,
  themes: { light: lightTheme, dark: darkTheme },
  shorthands: {
    p: 'padding', px: 'paddingHorizontal', py: 'paddingVertical',
    pt: 'paddingTop', pb: 'paddingBottom', pl: 'paddingLeft', pr: 'paddingRight',
    m: 'margin', mx: 'marginHorizontal', my: 'marginVertical',
    mt: 'marginTop', mb: 'marginBottom', ml: 'marginLeft', mr: 'marginRight',
    f: 'flex', fd: 'flexDirection', fw: 'flexWrap',
    fg: 'flexGrow', fs: 'flexShrink', fb: 'flexBasis',
    ai: 'alignItems', ac: 'alignContent', jc: 'justifyContent', als: 'alignSelf',
    w: 'width', h: 'height', mw: 'maxWidth', mah: 'maxHeight', miw: 'minWidth', mih: 'minHeight',
    bg: 'backgroundColor', bc: 'borderColor', boc: 'borderColor',
    br: 'borderRadius', bw: 'borderWidth',
    btw: 'borderTopWidth', brw: 'borderRightWidth', bbw: 'borderBottomWidth', blw: 'borderLeftWidth',
    o: 'opacity', pos: 'position',
    ta: 'textAlign',
  } as const,
});

export type Conf = typeof config;

export type AppShorthands = {
  p: 'padding'; px: 'paddingHorizontal'; py: 'paddingVertical';
  pt: 'paddingTop'; pb: 'paddingBottom'; pl: 'paddingLeft'; pr: 'paddingRight';
  m: 'margin'; mx: 'marginHorizontal'; my: 'marginVertical';
  mt: 'marginTop'; mb: 'marginBottom'; ml: 'marginLeft'; mr: 'marginRight';
  f: 'flex'; fd: 'flexDirection'; fw: 'flexWrap';
  fg: 'flexGrow'; fs: 'flexShrink'; fb: 'flexBasis';
  ai: 'alignItems'; ac: 'alignContent'; jc: 'justifyContent'; als: 'alignSelf';
  w: 'width'; h: 'height'; mw: 'maxWidth'; mah: 'maxHeight'; miw: 'minWidth'; mih: 'minHeight';
  bg: 'backgroundColor'; bc: 'borderColor'; boc: 'borderColor';
  br: 'borderRadius'; bw: 'borderWidth';
  btw: 'borderTopWidth'; brw: 'borderRightWidth'; bbw: 'borderBottomWidth'; blw: 'borderLeftWidth';
  o: 'opacity'; pos: 'position';
  ta: 'textAlign';
};

declare module 'tamagui' {
  interface TamaguiCustomConfig extends Conf { shorthands: AppShorthands }
}
declare module '@tamagui/core' {
  interface TamaguiCustomConfig extends Conf { shorthands: AppShorthands }
}
declare module '@tamagui/web' {
  interface TamaguiCustomConfig extends Conf { shorthands: AppShorthands }
}

export default config;
