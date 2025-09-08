/**
 * TenantErrorUtil - Utility for handling tenant-related errors conditionally
 * 
 * This utility provides methods to determine when tenant errors should be displayed
 * to users, ensuring that authentication-related errors are suppressed during
 * normal login flows.
 */

import { useAuth } from './AuthContext';

/**
 * Check if a tenant error should be displayed to the user
 */
export const shouldDisplayTenantError = (error, isAuthenticated = false) => {
  if (!error) return false;
  
  // Don't show errors if user is not authenticated (on login screen)
  if (!isAuthenticated) {
    console.log('🔍 TenantErrorUtil: User not authenticated, suppressing tenant error:', error);
    return false;
  }
  
  // List of authentication-related errors that should never be shown to users
  const suppressedErrorMessages = [
    'No authenticated user found',
    'No authenticated user',
    'User not authenticated', 
    'Authentication required',
    'Session expired',
    'Invalid JWT',
    'JWT expired',
    'No session found',
    'Auth session missing'
  ];
  
  // Check if this is a suppressed authentication error
  const isAuthError = suppressedErrorMessages.some(msg => 
    error.toLowerCase().includes(msg.toLowerCase())
  );
  
  if (isAuthError) {
    console.log('🔍 TenantErrorUtil: Authentication error suppressed:', error);
    return false;
  }
  
  // Show non-authentication tenant errors when user is authenticated
  return true;
};

/**
 * Get user-friendly error message for tenant errors
 */
export const getTenantErrorMessage = (error) => {
  if (!error) return null;
  
  // Map technical errors to user-friendly messages
  const errorMappings = {
    'User not assigned to any tenant': 'Your account is not associated with a school. Please contact your administrator.',
    'Invalid tenant': 'There is an issue with your school configuration. Please contact support.',
    'Tenant not found': 'School information could not be found. Please contact your administrator.',
    'Failed to load tenant': 'Unable to load school information. Please try again or contact support.',
  };
  
  // Look for a mapped message
  for (const [key, message] of Object.entries(errorMappings)) {
    if (error.includes(key)) {
      return message;
    }
  }
  
  // Return sanitized error message
  return `School configuration error: ${error}. Please contact your administrator.`;
};

/**
 * React Hook for conditional tenant error display
 */
export const useTenantErrorDisplay = (tenantError) => {
  const { user } = useAuth();
  const isAuthenticated = !!user;
  
  const shouldDisplay = shouldDisplayTenantError(tenantError, isAuthenticated);
  const userFriendlyMessage = shouldDisplay ? getTenantErrorMessage(tenantError) : null;
  
  return {
    shouldDisplay,
    message: userFriendlyMessage,
    originalError: tenantError
  };
};

/**
 * Component wrapper for conditional tenant error display
 */
export const TenantErrorDisplay = ({ error, children }) => {
  const { shouldDisplay, message } = useTenantErrorDisplay(error);
  
  if (!shouldDisplay) {
    return null;
  }
  
  // Default error display component
  if (children && typeof children === 'function') {
    return children({ message, originalError: error });
  }
  
  return children;
};

export default {
  shouldDisplayTenantError,
  getTenantErrorMessage,
  useTenantErrorDisplay,
  TenantErrorDisplay
};
