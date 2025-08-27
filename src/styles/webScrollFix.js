import { Platform } from 'react-native';

/**
 * Web-compatible ScrollView styles to fix scrolling issues in web view
 * These styles ensure proper scrolling behavior across all platforms
 */
export const webScrollViewStyles = {
  // Main ScrollView container style
  scrollView: {
    flex: 1,
    ...(Platform.OS === 'web' && {
      height: '100vh',
      overflowY: 'auto',
      overflowX: 'hidden',
      WebkitOverflowScrolling: 'touch', // Smooth scrolling on iOS web
      scrollBehavior: 'smooth', // Smooth scrolling behavior
      msOverflowStyle: '-ms-autohiding-scrollbar', // For Edge/IE
      '::-webkit-scrollbar': { width: '8px' }, // Customize scrollbar for WebKit browsers
    }),
  },
  
  // Content container style for proper web scrolling
  scrollViewContent: {
    flexGrow: 1,
    paddingBottom: Platform.OS === 'web' ? 100 : 20, // Extra bottom padding for web
    ...(Platform.OS === 'web' && {
      minHeight: '100%',
      display: 'flex',
      flexDirection: 'column',
    }),
  },
  
  // Modal ScrollView styles
  modalScrollView: {
    flex: 1,
    maxHeight: Platform.OS === 'web' ? '80vh' : '100%',
    ...(Platform.OS === 'web' && {
      overflowY: 'auto',
      overflowX: 'hidden',
    }),
  },
  
  modalScrollViewContent: {
    flexGrow: 1,
    padding: 20,
    paddingBottom: 30,
    ...(Platform.OS === 'web' && {
      minHeight: '100%',
    }),
  },
  
  // Nested ScrollView styles (for components inside other ScrollViews)
  nestedScrollView: {
    flex: 1,
    ...(Platform.OS === 'web' && {
      height: 'auto',
      maxHeight: '60vh',
      overflowY: 'auto',
      overflowX: 'hidden',
    }),
  },
  
  nestedScrollViewContent: {
    flexGrow: 1,
    ...(Platform.OS === 'web' && {
      minHeight: 'auto',
    }),
  },
};

/**
 * Utility function to get proper ScrollView props for web compatibility
 * @param {Object} options - Configuration options
 * @param {boolean} options.isModal - Whether this is inside a modal
 * @param {boolean} options.isNested - Whether this is a nested ScrollView
 * @returns {Object} Props to spread onto ScrollView component
 */
export const getWebScrollProps = ({ isModal = false, isNested = false } = {}) => {
  const baseProps = {
    showsVerticalScrollIndicator: true,
    showsHorizontalScrollIndicator: false,
    keyboardShouldPersistTaps: 'handled',
    nestedScrollEnabled: true,
  };

  if (Platform.OS === 'web') {
    return {
      ...baseProps,
      scrollEventThrottle: 16,
      bounces: false,
      alwaysBounceVertical: false,
      ...(isModal && {
        bounces: false,
        overScrollMode: 'never',
      }),
    };
  }

  return {
    ...baseProps,
    bounces: true,
    alwaysBounceVertical: true,
  };
};

/**
 * Container style for screens to ensure proper layout
 */
export const webContainerStyle = {
  flex: 1,
  ...(Platform.OS === 'web' && {
    height: '100vh',
    overflow: 'hidden',
    display: 'flex',
    flexDirection: 'column',
  }),
};
