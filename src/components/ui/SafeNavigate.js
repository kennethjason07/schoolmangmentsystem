import React from 'react';
import { useNavigation } from '@react-navigation/native';

/**
 * A utility to safely navigate without losing state
 * This prevents common issues with navigation causing auth state resets
 */
export const useNavigateWithStatePreservation = () => {
  const navigation = useNavigation();
  
  /**
   * Navigate safely to a screen without causing state reset
   * @param {string} screenName - Name of the screen to navigate to
   * @param {Object} params - Parameters to pass to the screen
   */
  const navigateSafely = React.useCallback((screenName, params = {}) => {
    try {
      // First check if the screen exists in state
      const state = navigation.getState();
      const routeExists = state.routeNames.includes(screenName);
      
      console.log(`🧭 SafeNavigate: Navigating to ${screenName} (exists: ${routeExists})`);
      
      if (routeExists) {
        // Use navigation.navigate which preserves the navigation state
        navigation.navigate(screenName, params);
      } else {
        console.warn(`🧭 SafeNavigate: Screen "${screenName}" not found in navigation stack`);
        // Fallback - try anyway, just in case the state is stale
        navigation.navigate(screenName, params);
      }
    } catch (error) {
      console.error(`🧭 SafeNavigate: Error navigating to ${screenName}:`, error);
      // Last resort - force navigate but may reset state
      try {
        navigation.navigate(screenName, params);
      } catch (finalError) {
        console.error(`🧭 SafeNavigate: Critical navigation error:`, finalError);
      }
    }
  }, [navigation]);
  
  return navigateSafely;
};

/**
 * Higher-order component that provides safe navigation to any component
 * @param {React.Component} Component - Component to wrap
 */
export const withSafeNavigation = (Component) => {
  return (props) => {
    const navigateSafely = useNavigateWithStatePreservation();
    return <Component {...props} navigateSafely={navigateSafely} />;
  };
};

export default useNavigateWithStatePreservation;
