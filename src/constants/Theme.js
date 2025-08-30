// Enhanced Theme System for VidyaSethu
import { Platform } from 'react-native';
import Colors from './Colors';

export const Typography = {
  // Font families
  families: {
    regular: Platform.OS === 'ios' ? 'System' : 'Roboto',
    medium: Platform.OS === 'ios' ? 'System' : 'Roboto-Medium',
    bold: Platform.OS === 'ios' ? 'System' : 'Roboto-Bold',
  },

  // Font sizes
  sizes: {
    xs: 10,
    sm: 12,
    base: 14,
    lg: 16,
    xl: 18,
    '2xl': 20,
    '3xl': 24,
    '4xl': 28,
    '5xl': 32,
    '6xl': 36,
  },

  // Line heights
  lineHeights: {
    xs: 14,
    sm: 16,
    base: 20,
    lg: 22,
    xl: 24,
    '2xl': 28,
    '3xl': 32,
    '4xl': 36,
    '5xl': 40,
    '6xl': 44,
  },

  // Font weights
  weights: {
    light: '300',
    normal: '400',
    medium: '500',
    semibold: '600',
    bold: '700',
    extrabold: '800',
    black: '900',
  }
};

export const Spacing = {
  xs: 4,
  sm: 8,
  md: 12,
  base: 16,
  lg: 20,
  xl: 24,
  '2xl': 32,
  '3xl': 48,
  '4xl': 64,
  '5xl': 80,
  '6xl': 96,
};

export const BorderRadius = {
  none: 0,
  sm: 4,
  base: 8,
  md: 12,
  lg: 16,
  xl: 20,
  '2xl': 24,
  '3xl': 32,
  full: 9999,
};

export const Shadows = {
  none: {
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0,
    shadowRadius: 0,
    elevation: 0,
  },
  sm: {
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 2,
  },
  base: {
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  md: {
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 6,
    elevation: 4,
  },
  lg: {
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.15,
    shadowRadius: 12,
    elevation: 8,
  },
  xl: {
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.2,
    shadowRadius: 16,
    elevation: 12,
  },
};

export const Layout = {
  screen: {
    paddingHorizontal: Spacing.base,
    paddingVertical: Spacing.base,
  },
  container: {
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.lg,
  },
  section: {
    marginBottom: Spacing.xl,
  },
  grid: {
    gap: Spacing.md,
  },
  card: {
    padding: Spacing.base,
    borderRadius: BorderRadius.md,
    marginBottom: Spacing.md,
  },
};

// Text style presets
export const TextStyles = {
  // Headings
  h1: {
    fontFamily: Typography.families.bold,
    fontSize: Typography.sizes['5xl'],
    lineHeight: Typography.lineHeights['5xl'],
    fontWeight: Typography.weights.bold,
    color: Colors.text,
  },
  h2: {
    fontFamily: Typography.families.bold,
    fontSize: Typography.sizes['4xl'],
    lineHeight: Typography.lineHeights['4xl'],
    fontWeight: Typography.weights.bold,
    color: Colors.text,
  },
  h3: {
    fontFamily: Typography.families.bold,
    fontSize: Typography.sizes['3xl'],
    lineHeight: Typography.lineHeights['3xl'],
    fontWeight: Typography.weights.semibold,
    color: Colors.text,
  },
  h4: {
    fontFamily: Typography.families.medium,
    fontSize: Typography.sizes['2xl'],
    lineHeight: Typography.lineHeights['2xl'],
    fontWeight: Typography.weights.semibold,
    color: Colors.text,
  },
  h5: {
    fontFamily: Typography.families.medium,
    fontSize: Typography.sizes.xl,
    lineHeight: Typography.lineHeights.xl,
    fontWeight: Typography.weights.medium,
    color: Colors.text,
  },
  h6: {
    fontFamily: Typography.families.medium,
    fontSize: Typography.sizes.lg,
    lineHeight: Typography.lineHeights.lg,
    fontWeight: Typography.weights.medium,
    color: Colors.text,
  },

  // Body text
  bodyLarge: {
    fontFamily: Typography.families.regular,
    fontSize: Typography.sizes.lg,
    lineHeight: Typography.lineHeights.lg,
    fontWeight: Typography.weights.normal,
    color: Colors.text,
  },
  body: {
    fontFamily: Typography.families.regular,
    fontSize: Typography.sizes.base,
    lineHeight: Typography.lineHeights.base,
    fontWeight: Typography.weights.normal,
    color: Colors.text,
  },
  bodySmall: {
    fontFamily: Typography.families.regular,
    fontSize: Typography.sizes.sm,
    lineHeight: Typography.lineHeights.sm,
    fontWeight: Typography.weights.normal,
    color: Colors.textSecondary,
  },

  // Labels and captions
  label: {
    fontFamily: Typography.families.medium,
    fontSize: Typography.sizes.base,
    lineHeight: Typography.lineHeights.base,
    fontWeight: Typography.weights.medium,
    color: Colors.text,
  },
  labelSmall: {
    fontFamily: Typography.families.medium,
    fontSize: Typography.sizes.sm,
    lineHeight: Typography.lineHeights.sm,
    fontWeight: Typography.weights.medium,
    color: Colors.textSecondary,
  },
  caption: {
    fontFamily: Typography.families.regular,
    fontSize: Typography.sizes.xs,
    lineHeight: Typography.lineHeights.xs,
    fontWeight: Typography.weights.normal,
    color: Colors.textLight,
  },

  // Button text
  button: {
    fontFamily: Typography.families.medium,
    fontSize: Typography.sizes.base,
    lineHeight: Typography.lineHeights.base,
    fontWeight: Typography.weights.medium,
  },
  buttonSmall: {
    fontFamily: Typography.families.medium,
    fontSize: Typography.sizes.sm,
    lineHeight: Typography.lineHeights.sm,
    fontWeight: Typography.weights.medium,
  },
  buttonLarge: {
    fontFamily: Typography.families.medium,
    fontSize: Typography.sizes.lg,
    lineHeight: Typography.lineHeights.lg,
    fontWeight: Typography.weights.medium,
  },
};

// Component style presets
export const ComponentStyles = {
  card: {
    backgroundColor: Colors.surface,
    borderRadius: BorderRadius.md,
    ...Shadows.base,
    padding: Spacing.base,
  },
  cardElevated: {
    backgroundColor: Colors.surface,
    borderRadius: BorderRadius.lg,
    ...Shadows.lg,
    padding: Spacing.lg,
  },
  button: {
    borderRadius: BorderRadius.base,
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  input: {
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: BorderRadius.base,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    fontSize: Typography.sizes.base,
    color: Colors.text,
  },
  badge: {
    borderRadius: BorderRadius.full,
    paddingHorizontal: Spacing.sm,
    paddingVertical: Spacing.xs,
    alignItems: 'center',
    justifyContent: 'center',
  },
};

// Animation presets
export const Animations = {
  timing: {
    fast: 150,
    base: 200,
    slow: 300,
    slower: 500,
  },
  easing: {
    ease: 'ease',
    easeIn: 'ease-in',
    easeOut: 'ease-out',
    easeInOut: 'ease-in-out',
  },
};

// Role-based theme variations
export const RoleThemes = {
  admin: {
    primary: Colors.admin.primary,
    secondary: Colors.admin.secondary,
    background: Colors.admin.background,
    surface: Colors.admin.surface,
    text: Colors.admin.text,
    accent: '#673AB7',
    gradient: ['#673AB7', '#9C27B0'],
  },
  teacher: {
    primary: Colors.teacher.primary,
    secondary: Colors.teacher.secondary,
    background: Colors.teacher.background,
    surface: Colors.teacher.surface,
    text: Colors.teacher.text,
    accent: '#4CAF50',
    gradient: ['#4CAF50', '#8BC34A'],
  },
  student: {
    primary: Colors.student.primary,
    secondary: Colors.student.secondary,
    background: Colors.student.background,
    surface: Colors.student.surface,
    text: Colors.student.text,
    accent: '#2196F3',
    gradient: ['#2196F3', '#03A9F4'],
  },
  parent: {
    primary: Colors.parent.primary,
    secondary: Colors.parent.secondary,
    background: Colors.parent.background,
    surface: Colors.parent.surface,
    text: Colors.parent.text,
    accent: '#FF9800',
    gradient: ['#FF9800', '#FFC107'],
  },
};

export default {
  Typography,
  Spacing,
  BorderRadius,
  Shadows,
  Layout,
  TextStyles,
  ComponentStyles,
  Animations,
  RoleThemes,
  Colors,
};
