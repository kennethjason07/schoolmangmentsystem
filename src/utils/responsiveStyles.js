import { Dimensions, Platform } from 'react-native';

const { width, height } = Dimensions.get('window');

// Breakpoints
const DESKTOP_BREAKPOINT = 900;
const TABLET_BREAKPOINT = 600;

// Device detection
export const isDesktop = width >= DESKTOP_BREAKPOINT;
export const isTablet = width >= TABLET_BREAKPOINT && width < DESKTOP_BREAKPOINT;
export const isPhone = width < TABLET_BREAKPOINT;

// Responsive picker styles
export const getResponsivePickerStyle = () => {
  const baseStyle = {
    width: '100%',
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 8,
    backgroundColor: '#fff',
    paddingHorizontal: 12,
  };

  if (isDesktop) {
    return {
      ...baseStyle,
      height: 60,
      fontSize: 16,
      paddingVertical: 16,
    };
  }
  
  if (isTablet) {
    return {
      ...baseStyle,
      height: 55,
      fontSize: 15,
      paddingVertical: 14,
    };
  }
  
  return {
    ...baseStyle,
    height: 50,
    fontSize: 14,
    paddingVertical: 12,
  };
};

// Responsive text input styles
export const getResponsiveTextInputStyle = () => {
  const baseStyle = {
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 8,
    backgroundColor: '#fff',
    paddingHorizontal: 12,
  };

  if (isDesktop) {
    return {
      ...baseStyle,
      height: 50,
      fontSize: 16,
      paddingVertical: 12,
    };
  }
  
  if (isTablet) {
    return {
      ...baseStyle,
      height: 48,
      fontSize: 15,
      paddingVertical: 12,
    };
  }
  
  return {
    ...baseStyle,
    height: 45,
    fontSize: 14,
    paddingVertical: 10,
  };
};

// Responsive font sizes
export const getResponsiveFontSize = (baseSize) => {
  if (isDesktop) return baseSize + 2;
  if (isTablet) return baseSize + 1;
  return baseSize;
};

// Responsive spacing
export const getResponsiveSpacing = (baseSpacing) => {
  if (isDesktop) return baseSpacing * 1.5;
  if (isTablet) return baseSpacing * 1.25;
  return baseSpacing;
};

// Common responsive styles
export const responsiveStyles = {
  // Picker styles
  picker: getResponsivePickerStyle(),
  
  // Text input styles
  textInput: getResponsiveTextInputStyle(),
  
  // Container padding
  containerPadding: {
    padding: getResponsiveSpacing(16),
  },
  
  // Card styles
  card: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: getResponsiveSpacing(16),
    marginBottom: getResponsiveSpacing(12),
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
  },
  
  // Button styles
  button: {
    height: isTablet ? 50 : 45,
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: getResponsiveSpacing(16),
  },
  
  // Header text
  headerText: {
    fontSize: getResponsiveFontSize(18),
    fontWeight: '600',
    color: '#333',
  },
  
  // Body text
  bodyText: {
    fontSize: getResponsiveFontSize(14),
    color: '#666',
    lineHeight: getResponsiveFontSize(20),
  },
  
  // Label text
  labelText: {
    fontSize: getResponsiveFontSize(14),
    fontWeight: '600',
    color: '#333',
    marginBottom: 8,
  },
};

export default responsiveStyles;
