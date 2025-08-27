import React from 'react';
import {
  ScrollView,
  View,
  StyleSheet,
  Dimensions,
  Platform,
} from 'react-native';

const { width: screenWidth, height: screenHeight } = Dimensions.get('window');

// Determine if we're on a large screen (PC/tablet)
const isLargeScreen = screenWidth >= 768;
const isPC = Platform.OS === 'web' || screenWidth >= 1024;

const ResponsiveScrollView = ({
  children,
  style,
  contentContainerStyle,
  showsVerticalScrollIndicator = true,
  showsHorizontalScrollIndicator = false,
  keyboardShouldPersistTaps = 'handled',
  refreshControl,
  maxWidth = 1200, // Maximum width for PC screens
  centerContent = true, // Whether to center content on large screens
  padding = 16,
  ...props
}) => {
  const responsiveStyles = {
    container: {
      flex: 1,
      backgroundColor: '#f5f5f5',
      ...style,
    },
    scrollViewContent: {
      flexGrow: 1,
      paddingHorizontal: isLargeScreen ? Math.max(padding, 20) : padding,
      paddingVertical: padding,
      ...(isPC && centerContent && {
        alignItems: 'center',
        justifyContent: 'flex-start',
      }),
      ...contentContainerStyle,
    },
    contentWrapper: isPC && centerContent ? {
      width: '100%',
      maxWidth: maxWidth,
      alignSelf: 'center',
    } : {},
  };

  return (
    <View style={responsiveStyles.container}>
      <ScrollView
        contentContainerStyle={responsiveStyles.scrollViewContent}
        showsVerticalScrollIndicator={showsVerticalScrollIndicator}
        showsHorizontalScrollIndicator={showsHorizontalScrollIndicator}
        keyboardShouldPersistTaps={keyboardShouldPersistTaps}
        refreshControl={refreshControl}
        scrollEventThrottle={16}
        {...props}
      >
        {isPC && centerContent ? (
          <View style={responsiveStyles.contentWrapper}>
            {children}
          </View>
        ) : (
          children
        )}
      </ScrollView>
    </View>
  );
};

// Responsive grid component for cards/items
export const ResponsiveGrid = ({
  children,
  style,
  spacing = 16,
  minItemWidth = 300,
  maxColumns = 4,
}) => {
  const numColumns = isPC 
    ? Math.min(Math.floor(screenWidth / minItemWidth), maxColumns)
    : isLargeScreen 
    ? Math.min(Math.floor(screenWidth / minItemWidth), 2)
    : 1;

  const gridStyles = {
    container: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      justifyContent: numColumns === 1 ? 'center' : 'space-between',
      marginHorizontal: -spacing / 2,
      ...style,
    },
    item: {
      width: numColumns === 1 
        ? '100%' 
        : `${(100 / numColumns)}%`,
      paddingHorizontal: spacing / 2,
      marginBottom: spacing,
    },
  };

  return (
    <View style={gridStyles.container}>
      {React.Children.map(children, (child, index) => (
        <View key={index} style={gridStyles.item}>
          {child}
        </View>
      ))}
    </View>
  );
};

// Responsive container for forms and content
export const ResponsiveContainer = ({
  children,
  style,
  maxWidth = 800,
  padding = 20,
}) => {
  const containerStyles = {
    width: '100%',
    maxWidth: isPC ? maxWidth : '100%',
    alignSelf: 'center',
    padding: isLargeScreen ? padding : 16,
    ...style,
  };

  return (
    <View style={containerStyles}>
      {children}
    </View>
  );
};

// Responsive modal container
export const ResponsiveModal = ({
  children,
  style,
  maxWidth = 600,
  maxHeight = '90%',
}) => {
  const modalStyles = {
    flex: isPC ? 0 : 1,
    width: isPC ? Math.min(screenWidth * 0.9, maxWidth) : '100%',
    maxHeight: isPC ? Math.min(screenHeight * 0.9, typeof maxHeight === 'string' ? screenHeight * 0.9 : maxHeight) : '100%',
    alignSelf: 'center',
    marginTop: isPC ? 'auto' : 0,
    marginBottom: isPC ? 'auto' : 0,
    ...style,
  };

  return (
    <View style={modalStyles}>
      {children}
    </View>
  );
};

export { isLargeScreen, isPC, screenWidth, screenHeight };
export default ResponsiveScrollView;
