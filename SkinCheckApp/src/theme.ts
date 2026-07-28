// Shared design tokens for a modern, premium look across the app.
// Dark theme with a teal-to-cyan gradient accent, consistent with the
// score-range colors already used in scoring logic (kept unchanged since
// those are functional, not just decorative).

export const colors = {
  bg: '#0B0E14',
  surface: '#151922',
  surfaceElevated: '#1B202C',
  border: '#232838',
  textPrimary: '#F5F7FA',
  textSecondary: '#8B93A7',
  textMuted: '#5C6478',
  accentStart: '#00D9A3',
  accentEnd: '#00B4D8',
  danger: '#FF6B6B',
  dangerBg: 'rgba(255,107,107,0.12)',
  dangerBorder: 'rgba(255,107,107,0.3)',
  warning: '#FFB84D',
};

export const gradients = {
  primary: [colors.accentStart, colors.accentEnd],
  danger: ['#FF6B6B', '#EE4266'],
};

export const radius = {
  sm: 10,
  md: 16,
  lg: 22,
  pill: 999,
};

export const spacing = {
  xs: 4,
  sm: 8,
  md: 16,
  lg: 24,
  xl: 32,
};

export const typography = {
  display: { fontSize: 28, fontWeight: '800' as const, letterSpacing: -0.5 },
  title: { fontSize: 18, fontWeight: '700' as const },
  body: { fontSize: 14, fontWeight: '400' as const },
  caption: { fontSize: 12.5, fontWeight: '500' as const },
};

export const shadow = {
  card: {
    shadowColor: '#000000',
    shadowOpacity: 0.25,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 8 },
    elevation: 6,
  },
};
