import { useState, useEffect } from 'react';
import { Dimensions } from 'react-native';

const DESKTOP_BREAKPOINT = 900;
const TABLET_BREAKPOINT = 600;

export default function useResponsive() {
  const [screenData, setScreenData] = useState(() => {
    const { width, height } = Dimensions.get('window');
    return {
      width,
      height,
      isDesktop: width >= DESKTOP_BREAKPOINT,
      isTablet: width >= TABLET_BREAKPOINT && width < DESKTOP_BREAKPOINT,
      isPhone: width < TABLET_BREAKPOINT
    };
  });

  useEffect(() => {
    const onChange = ({ window }) => {
      setScreenData({
        width: window.width,
        height: window.height,
        isDesktop: window.width >= DESKTOP_BREAKPOINT,
        isTablet: window.width >= TABLET_BREAKPOINT && window.width < DESKTOP_BREAKPOINT,
        isPhone: window.width < TABLET_BREAKPOINT
      });
    };

    const subscription = Dimensions.addEventListener('change', onChange);
    return () => subscription?.remove();
  }, []);

  // Helper function to get responsive picker height
  const getPickerHeight = () => {
    if (screenData.isDesktop) return 60;
    if (screenData.isTablet) return 55;
    return 50;
  };

  // Helper function to get responsive font size
  const getResponsiveFontSize = (baseSize) => {
    if (screenData.isDesktop) return baseSize + 2;
    if (screenData.isTablet) return baseSize + 1;
    return baseSize;
  };

  return {
    ...screenData,
    getPickerHeight,
    getResponsiveFontSize
  };
}