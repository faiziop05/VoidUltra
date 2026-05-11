export const theme = {
  colors: {
    background: '#FFFFFF',     // Clean white
    surface: '#F9F9F9',        // Off-white for modals/inputs
    darkSurface: '#121212',    // Deep dark for premium elements
    border: '#EAEAEA',         // Very subtle dividing lines
    primary: '#000000',        // Deep black for main text
    secondary: '#8E8E93',      // iOS grey for secondary text/icons
    textOnDark: '#FFFFFF',     // White text for dark surfaces
    accent: '#000000',         // Black/Blue accent depending on context, using black or dark grey for default
    danger: '#FF3B30',         // Standard iOS red
    tint: '#007AFF',           // Standard iOS blue
    warning: '#FFCC00',        // For the lock icon
  },
  typography: {
    fontFamily: {
      regular: 'System', 
      bold: 'System',
    },
    sizes: {
      tiny: 12,
      small: 14,
      body: 16,
      h2: 20,
      h1: 28,
      title: 34,
    }
  },
  spacing: {
    xs: 4,
    sm: 8,
    md: 16,
    lg: 24,
    xl: 32,
    xxl: 48,
  },
  radii: {
    sm: 8,
    md: 12,
    lg: 16,
    full: 9999,
  }
};
