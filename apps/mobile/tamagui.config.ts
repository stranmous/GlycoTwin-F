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

// Nunito — Warm Companion primary font across headings, body, and numeric readouts
const headingFont = createFont({
  family: 'Nunito',
  size: {
    1: 11, 2: 12, 3: 13, 4: 14, 5: 16, 6: 18,
    7: 20, 8: 24, 9: 28, 10: 32, 11: 36, 12: 44,
    true: 16,
  },
  lineHeight: {
    1: 14, 2: 16, 3: 18, 4: 20, 5: 22, 6: 24,
    7: 28, 8: 32, 9: 36, 10: 40, 11: 44, 12: 52,
  },
  weight: {
    1: '300', 2: '400', 3: '500', 4: '600',
    5: '700', 6: '800', true: '700',
  },
  letterSpacing: {
    1: 0.02, 2: 0, 3: -0.01, 4: -0.02, 5: -0.03,
  },
  face: {
    300: { normal: 'Nunito_300Light' },
    400: { normal: 'Nunito_400Regular' },
    500: { normal: 'Nunito_500Medium' },
    600: { normal: 'Nunito_600SemiBold' },
    700: { normal: 'Nunito_700Bold' },
    800: { normal: 'Nunito_800ExtraBold' },
    900: { normal: 'Nunito_900Black' },
  },
});

const bodyFont = createFont({
  family: 'Nunito',
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
    1: 0.02, 2: 0.01, 3: 0, 4: 0, 5: -0.01,
  },
  face: {
    300: { normal: 'Nunito_300Light' },
    400: { normal: 'Nunito_400Regular' },
    500: { normal: 'Nunito_500Medium' },
    600: { normal: 'Nunito_600SemiBold' },
    700: { normal: 'Nunito_700Bold' },
    800: { normal: 'Nunito_800ExtraBold' },
    900: { normal: 'Nunito_900Black' },
  },
});

// ── Warm Companion palette ───────────────────────────────────────────────────
const palette = {
  // Brand & Semantic
  teal50:          '#EAF7EE',
  teal100:         '#D4F5E9',  // Mint
  teal200:         '#A6F0B9',
  teal300:         '#84F6E6',
  teal400:         '#66D9CA',
  teal500:         '#2AA89A',  // Primary warm teal
  teal600:         '#006A61',  // Deep teal text accent
  teal700:         '#005048',
  teal800:         '#003631',
  teal900:         '#00201C',

  // Soft Sage (in-range 70–180 mg/dL)
  sage:            '#81C995',
  sageDark:        '#236B40',
  sageContainer:   '#A6F0B9',

  // Soft Coral (above-range)
  coral:           '#FF8A80',
  coralLight:      '#FFDAD6',
  coralDark:       '#BA1A1A',

  // Warm Amber (educational disclaimers & moderate carbs)
  amber:           '#FFB347',
  butter:          '#FFF3CD',

  // Muted Rose (below-range & destructive)
  rose:            '#E57373',

  // Pastel Tints
  peach:           '#FFE5D9',
  mint:            '#D4F5E9',
  lavender:        '#E8DEF8',

  // Warm Light Neutrals
  canvasCream:     '#FFFBF5',  // Primary cream canvas
  oatFill:         '#FFF5EB',  // Secondary oat container fill
  surfaceCard:     '#FFFFFF',  // Crisp elevated card
  charcoalText:    '#3D3D3D',  // Primary text
  stoneGrayText:   '#8E8E8E',  // Secondary text
  darkCharcoal:    '#1B1C1C',
  borderLight:     'rgba(61,61,61,0.06)',

  // Warm Espresso Dark Neutrals
  darkCanvas:      '#1C1917',  // Espresso dark canvas
  darkSurface:     '#292524',  // Espresso dark surface
  darkSurfaceHigh: '#3D3935',
  darkBorder:      'rgba(255,255,255,0.08)',
  darkText:        '#F5F5F4',
  darkTextMuted:   '#A8A29E',
  darkTextSubtle:  '#78716C',

  // Base
  white:           '#FFFFFF',
  black:           '#000000',
  cream:           '#FFF8EA',
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
  // Warm Companion shape language: full pill (9999px) for buttons/chips, 20-24px for cards
  radius: {
    0: 0, 1: 6, 2: 10, 3: 14, 4: 18, 5: 20, 6: 24, 7: 32, 8: 9999,
    true: 20,
  },
  zIndex: { 0: 0, 1: 100, 2: 200, 3: 300, 4: 400, 5: 500 },
});

// ── Warm Light theme ─────────────────────────────────────────────────────────
const lightTheme = {
  background:        palette.canvasCream,      // #FFFBF5
  backgroundHover:   palette.oatFill,          // #FFF5EB
  backgroundPress:   '#FCEFE2',
  backgroundPrimary: palette.canvasCream,
  backgroundSecondary: palette.oatFill,

  surface:           palette.surfaceCard,      // #FFFFFF
  surfaceMuted:      palette.oatFill,          // #FFF5EB
  surfaceCard:       palette.surfaceCard,
  surfaceGlass:      'rgba(255,255,255,0.88)',
  surfaceGlassDim:   'rgba(255,255,255,0.65)',

  borderColor:       palette.borderLight,      // rgba(61,61,61,0.06)
  borderGlass:       'rgba(61,61,61,0.08)',

  color:             palette.charcoalText,     // #3D3D3D
  colorMuted:        palette.stoneGrayText,    // #8E8E8E
  colorSubtle:       '#A8A8A8',
  colorOnDark:       palette.cream,

  // Primary — Warm Teal
  primary:           palette.teal500,          // #2AA89A
  primaryDark:       palette.teal600,          // #006A61
  primaryPress:      '#238E82',
  primarySoft:       palette.mint,             // #D4F5E9
  primaryGlass:      'rgba(42,168,154,0.12)',
  onPrimary:         palette.white,

  // Secondary — Deep Sage
  secondary:         palette.sageDark,         // #236B40
  secondaryPress:    '#1B5231',
  secondarySoft:     palette.mint,
  onSecondary:       palette.white,

  // Status & Range
  success:           palette.sage,             // #81C995 (in-range 70-180)
  warn:              palette.amber,            // #FFB347 (caution / moderate carbs)
  danger:            palette.rose,             // #E57373 (below-range / destructive)
  dangerSoft:        '#FFEBEA',

  rangeAbove:        palette.coral,            // #FF8A80
  rangeWarning:      palette.amber,            // #FFB347
  rangeBelow:        palette.rose,             // #E57373
  rangeInRange:      palette.sage,             // #81C995

  // Pastels
  pastelPeach:       palette.peach,            // #FFE5D9
  pastelMint:        palette.mint,             // #D4F5E9
  pastelButter:      palette.butter,           // #FFF3CD
  pastelLavender:    palette.lavender,         // #E8DEF8

  // Diffused Warm Shadows
  shadowColor:       'rgba(61,61,61,0.06)',
  shadowPrimary:     'rgba(42,168,154,0.25)',
  shadowBlue:        'rgba(42,168,154,0.18)',
  shadowRose:        'rgba(229,115,115,0.22)',
};

// ── Warm Espresso Dark theme ─────────────────────────────────────────────────
const darkTheme = {
  background:        palette.darkCanvas,       // #1C1917
  backgroundHover:   '#24201E',
  backgroundPress:   '#2E2A27',
  backgroundPrimary: palette.darkCanvas,
  backgroundSecondary: palette.darkSurface,

  surface:           palette.darkSurface,      // #292524
  surfaceMuted:      palette.darkSurfaceHigh,  // #3D3935
  surfaceCard:       palette.darkSurface,
  surfaceGlass:      'rgba(41,37,36,0.85)',
  surfaceGlassDim:   'rgba(41,37,36,0.65)',

  borderColor:       palette.darkBorder,
  borderGlass:       'rgba(255,255,255,0.06)',

  color:             palette.darkText,         // #F5F5F4
  colorMuted:        palette.darkTextMuted,    // #A8A29E
  colorSubtle:       palette.darkTextSubtle,
  colorOnDark:       palette.cream,

  primary:           palette.teal500,          // #2AA89A
  primaryDark:       palette.teal400,
  primaryPress:      '#238E82',
  primarySoft:       'rgba(42,168,154,0.18)',
  primaryGlass:      'rgba(42,168,154,0.12)',
  onPrimary:         palette.white,

  secondary:         palette.sage,
  secondaryPress:    '#6AB07E',
  secondarySoft:     'rgba(129,201,149,0.15)',
  onSecondary:       palette.darkCanvas,

  success:           palette.sage,
  warn:              palette.amber,
  danger:            palette.rose,
  dangerSoft:        'rgba(229,115,115,0.15)',

  rangeAbove:        palette.coral,
  rangeWarning:      palette.amber,
  rangeBelow:        palette.rose,
  rangeInRange:      palette.sage,

  pastelPeach:       '#3D2F28',
  pastelMint:        '#1D352E',
  pastelButter:      '#38321F',
  pastelLavender:    '#2E253A',

  shadowColor:       'rgba(0,0,0,0.5)',
  shadowPrimary:     'rgba(42,168,154,0.25)',
  shadowBlue:        'rgba(42,168,154,0.2)',
  shadowRose:        'rgba(229,115,115,0.25)',
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
