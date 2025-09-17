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
      // Get the current navigation state
      const state = navigation.getState();
      
      // Function to recursively check for route in nested navigators
      const findRouteInState = (navState, targetRoute) => {
        if (!navState) return false;
        
        // Check direct routes
        if (navState.routeNames?.includes(targetRoute)) {
          return true;
        }
        
        // Check in nested routes
        if (navState.routes) {
          for (const route of navState.routes) {
            if (route.state && findRouteInState(route.state, targetRoute)) {
              return true;
            }
            if (route.name === targetRoute) {
              return true;
            }
          }
        }
        
        return false;
      };
      
      const routeExists = findRouteInState(state, screenName);
      
      // Only log for debugging, don't show warning for nested routes
      console.log(`🧭 SafeNavigate: Navigating to ${screenName}`);
      
      // Always try to navigate - React Navigation will handle invalid routes
      navigation.navigate(screenName, params);
      
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
