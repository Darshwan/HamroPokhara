import type { TextStyle } from 'react-native';

export const Colors = {
  primary: '#003b5a',
  primaryContainer: '#1a5276',
  primaryFixed: '#cbe6ff',
  primaryFixedDim: '#9bccf6',
  onPrimary: '#ffffff',
  onPrimaryContainer: '#94c5ee',
  onPrimaryFixedVariant: '#0e4b6e',

  secondary: '#af2f23',
  secondaryContainer: '#fe6856',
  onSecondary: '#ffffff',

  background: '#f7faf9',
  surface: '#f7faf9',
  surfaceContainerLowest: '#ffffff',
  surfaceContainerLow: '#f1f4f3',
  surfaceContainer: '#ebeeed',
  surfaceContainerHigh: '#e6e9e8',
  surfaceContainerHighest: '#e0e3e2',

  onSurface: '#181c1c',
  onSurfaceVariant: '#41474e',
  outline: '#72787f',
  outlineVariant: '#c1c7cf',

  error: '#ba1a1a',
  errorContainer: '#ffdad6',

  success: '#2d7a52',
  successLight: '#d9f2e3',

  gold: '#c8a84b',
  goldLight: '#f5f0e0',
};

export const Fonts = {
  regular: 'Inter_400Regular',
  medium: 'Inter_500Medium',
  semiBold: 'Inter_600SemiBold',
  bold: 'Inter_700Bold',
  extraBold: 'Inter_800ExtraBold',
};

type TypographyScale = {
  display: TextStyle;
  h1: TextStyle;
  h2: TextStyle;
  h3: TextStyle;
  title: TextStyle;
  subtitle: TextStyle;
  body: TextStyle;
  bodyStrong: TextStyle;
  caption: TextStyle;
  overline: TextStyle;
  button: TextStyle;
  mono: TextStyle;
};

export const Typography: TypographyScale = {
  display: { fontSize: 32, fontWeight: '900', letterSpacing: -0.8 },
  h1: { fontSize: 28, fontWeight: '800', letterSpacing: -0.6 },
  h2: { fontSize: 22, fontWeight: '800', letterSpacing: -0.4 },
  h3: { fontSize: 18, fontWeight: '700', letterSpacing: -0.2 },
  title: { fontSize: 16, fontWeight: '700' },
  subtitle: { fontSize: 13, fontWeight: '500' },
  body: { fontSize: 14, fontWeight: '400' },
  bodyStrong: { fontSize: 14, fontWeight: '600' },
  caption: { fontSize: 11, fontWeight: '500', letterSpacing: 0.2 },
  overline: { fontSize: 10, fontWeight: '700', letterSpacing: 1, textTransform: 'uppercase' },
  button: { fontSize: 15, fontWeight: '700' },
  mono: { fontSize: 12, fontFamily: 'monospace' },
};

export const Radius = {
  sm: 8,
  md: 12,
  lg: 16,
  xl: 24,
  xxl: 32,
  full: 9999,
};

export const Shadow = {
  sm: {
    shadowColor: '#003b5a',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 4,
    elevation: 2,
  },
  md: {
    shadowColor: '#003b5a',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.10,
    shadowRadius: 12,
    elevation: 5,
  },
  lg: {
    shadowColor: '#003b5a',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.14,
    shadowRadius: 24,
    elevation: 10,
  },
};