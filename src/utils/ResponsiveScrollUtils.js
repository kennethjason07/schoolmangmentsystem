import { Platform, Dimensions } from 'react-native';

// Get screen dimensions
const { width: screenWidth, height: screenHeight } = Dimensions.get('window');

/**
 * Responsive scroll configuration for Teacher dashboard screens
 * Provides consistent scroll behavior across mobile, tablet, and web platforms
 */
export const getResponsiveScrollProps = (options = {}) => {
  const {
    enableRefresh = true,
    showVerticalIndicator = false,
    showHorizontalIndicator = false,
    keyboardDismissMode = 'interactive',
    keyboardShouldPersistTaps = 'handled',
    contentInsetAdjustmentBehavior = 'automatic',
  } = options;

  return {
    // Core scroll properties
    showsVerticalScrollIndicator: showVerticalIndicator,
    showsHorizontalScrollIndicator: showHorizontalIndicator,
    keyboardDismissMode,
    keyboardShouldPersistTaps,
    
    // iOS specific
    ...(Platform.OS === 'ios' && {
      contentInsetAdjustmentBehavior,
      bounces: true,
      alwaysBounceVertical: false,
    }),
    
    // Android specific
    ...(Platform.OS === 'android' && {
      nestedScrollEnabled: true,
      overScrollMode: 'auto',
    }),
    
    // Web specific
    ...(Platform.OS === 'web' && {
      nestedScrollEnabled: true,
    }),
  };
};

/**
 * Responsive content container styles for ScrollView
 */
export const getResponsiveContentStyle = (options = {}) => {
  const {
    minHeight = true,
    flexGrow = true,
    paddingBottom = 20,
  } = options;

  return {
    ...(flexGrow && { flexGrow: 1 }),
    ...(minHeight && { minHeight: screenHeight * 0.8 }),
    paddingBottom,
    
    // Web-specific scrolling enhancements
    ...(Platform.OS === 'web' && {
      overflow: 'auto',
      WebkitOverflowScrolling: 'touch',
      scrollbarWidth: 'thin',
    }),
  };
};

/**
 * Responsive grid layout configuration
 * Adapts column count based on screen width
 */
export const getResponsiveGridConfig = () => {
  const isTablet = screenWidth >= 768;
  const isDesktop = screenWidth >= 1024;
  
  return {
    numColumns: isDesktop ? 3 : isTablet ? 2 : 1,
    columnWrapperStyle: (isTablet || isDesktop) ? {
      justifyContent: 'space-between',
      paddingHorizontal: 8,
    } : null,
    itemWidth: isDesktop ? '32%' : isTablet ? '48%' : '100%',
  };
};

/**
 * Responsive card sizing
 */
export const getResponsiveCardWidth = (itemsPerRow = 2) => {
  const padding = 32; // Total horizontal padding
  const margin = 16; // Margin between items
  const availableWidth = screenWidth - padding;
  const itemWidth = (availableWidth - (margin * (itemsPerRow - 1))) / itemsPerRow;
  
  return {
    width: itemWidth,
    maxWidth: Platform.OS === 'web' ? 400 : itemWidth,
  };
};

/**
 * Responsive section spacing
 */
export const getResponsiveSectionSpacing = () => {
  const isTablet = screenWidth >= 768;
  const isDesktop = screenWidth >= 1024;
  
  return {
    sectionMarginHorizontal: isDesktop ? 24 : isTablet ? 16 : 12,
    sectionMarginVertical: isDesktop ? 20 : isTablet ? 16 : 12,
    itemSpacing: isDesktop ? 16 : isTablet ? 12 : 8,
  };
};

/**
 * Platform-specific refresh control configuration
 */
export const getRefreshControlConfig = (refreshing, onRefresh, colors = ['#1976d2']) => {
  return {
    refreshing,
    onRefresh,
    colors, // Android
    tintColor: colors[0], // iOS
    titleColor: colors[0], // iOS
    title: 'Pull to refresh', // iOS
  };
};

/**
 * Responsive modal configuration
 */
export const getResponsiveModalConfig = () => {
  const isTablet = screenWidth >= 768;
  const isDesktop = screenWidth >= 1024;
  
  return {
    modalWidth: isDesktop ? '50%' : isTablet ? '70%' : '90%',
    modalMaxWidth: isDesktop ? 600 : isTablet ? 500 : screenWidth * 0.9,
    modalMaxHeight: '80%',
  };
};

/**
 * Responsive text scaling
 */
export const getResponsiveTextSizes = () => {
  const isTablet = screenWidth >= 768;
  const isDesktop = screenWidth >= 1024;
  
  const scale = isDesktop ? 1.1 : isTablet ? 1.05 : 1;
  
  return {
    title: Math.round(24 * scale),
    subtitle: Math.round(18 * scale),
    body: Math.round(16 * scale),
    caption: Math.round(14 * scale),
    small: Math.round(12 * scale),
  };
};

/**
 * Check if device is in landscape mode
 */
export const isLandscape = () => screenWidth > screenHeight;

/**
 * Get safe content width for different screen sizes
 */
export const getSafeContentWidth = () => {
  const isTablet = screenWidth >= 768;
  const isDesktop = screenWidth >= 1024;
  
  if (isDesktop) {
    return Math.min(screenWidth * 0.8, 1200);
  } else if (isTablet) {
    return Math.min(screenWidth * 0.9, 800);
  } else {
    return screenWidth * 0.95;
  }
};

export default {
  getResponsiveScrollProps,
  getResponsiveContentStyle,
  getResponsiveGridConfig,
  getResponsiveCardWidth,
  getResponsiveSectionSpacing,
  getRefreshControlConfig,
  getResponsiveModalConfig,
  getResponsiveTextSizes,
  isLandscape,
  getSafeContentWidth,
  screenWidth,
  screenHeight,
};
