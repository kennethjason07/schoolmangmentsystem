import { useState, useEffect } from 'react';
import { Dimensions } from 'react-native';

const DESKTOP_BREAKPOINT = 900;

export default function useResponsive() {
  const [isDesktop, setIsDesktop] = useState(Dimensions.get('window').width >= DESKTOP_BREAKPOINT);

  useEffect(() => {
    const onChange = ({ window }) => {
      setIsDesktop(window.width >= DESKTOP_BREAKPOINT);
    };
    Dimensions.addEventListener('change', onChange);
    return () => Dimensions.removeEventListener('change', onChange);
  }, []);

  return { isDesktop };
} 