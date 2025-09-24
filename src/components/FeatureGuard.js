/**
 * FeatureGuard Component
 * 
 * Provides feature-based access control for screens and components.
 * Shows "Contact your service provider" message for blocked features.
 * Works on both web and mobile platforms.
 */

import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Dimensions,
  Platform,
  ActivityIndicator
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTenantFeatures } from '../hooks/useTenantFeatures';
import { getFeatureForScreen } from '../constants/featureMapping';

const { width, height } = Dimensions.get('window');

/**
 * FeatureGuard Component
 * 
 * @param {Object} props
 * @param {string} props.feature - The feature key to check access for
 * @param {string} props.screenName - Alternative way to specify feature via screen name
 * @param {React.ReactNode} props.children - Content to show if access is granted
 * @param {string} props.fallbackMessage - Custom message to show when access is denied
 * @param {boolean} props.showRetry - Whether to show retry button
 * @param {Function} props.onRetry - Callback for retry button
 * @param {React.ReactNode} props.loadingComponent - Custom loading component
 */
export const FeatureGuard = ({
  feature,
  screenName,
  children,
  fallbackMessage = "Contact your service provider",
  showRetry = false,
  onRetry,
  loadingComponent
}) => {
  const { 
    hasFeature, 
    isReady, 
    loading, 
    error, 
    tenantName,
    debugFeatureAccess 
  } = useTenantFeatures();

  // Determine the feature to check
  const featureToCheck = feature || getFeatureForScreen(screenName);

  // Debug feature access in development
  React.useEffect(() => {
    if (featureToCheck && (screenName || feature)) {
      debugFeatureAccess(featureToCheck, screenName || feature);
    }
  }, [featureToCheck, screenName, feature, debugFeatureAccess]);

  // Show loading state while tenant context is initializing
  if (!isReady || loading) {
    if (loadingComponent) {
      return loadingComponent;
    }

    return (
      <View style={styles.container}>
        <ActivityIndicator size="large" color="#2196F3" />
        <Text style={styles.loadingText}>Initializing access...</Text>
      </View>
    );
  }

  // Show error state if tenant context failed
  if (error) {
    return (
      <View style={styles.container}>
        <Ionicons name="alert-circle-outline" size={60} color="#F44336" />
        <Text style={styles.errorTitle}>Access Error</Text>
        <Text style={styles.errorMessage}>
          Unable to verify access permissions. Please try again.
        </Text>
        {showRetry && onRetry && (
          <TouchableOpacity style={styles.retryButton} onPress={onRetry}>
            <Text style={styles.retryButtonText}>Retry</Text>
          </TouchableOpacity>
        )}
      </View>
    );
  }

  // If no feature is specified, allow access (backward compatibility)
  if (!featureToCheck) {
    console.warn(`⚠️ FeatureGuard: No feature specified for screen '${screenName || 'Unknown'}'. Allowing access for backward compatibility.`);
    return children;
  }

  // Check if user has access to the feature
  const hasAccess = hasFeature(featureToCheck);

  // If access is granted, render children
  if (hasAccess) {
    return children;
  }

  // Access denied - show blocked message
  return (
    <View style={styles.container}>
      <View style={styles.blockedContent}>
        <Ionicons name="lock-closed-outline" size={80} color="#FF5722" />
        
        <Text style={styles.blockedTitle}>Access Restricted</Text>
        
        <Text style={styles.blockedMessage}>
          {fallbackMessage}
        </Text>
        
        <View style={styles.infoContainer}>
          <Text style={styles.infoText}>
            Feature: <Text style={styles.infoValue}>{featureToCheck}</Text>
          </Text>
          {tenantName && (
            <Text style={styles.infoText}>
              Organization: <Text style={styles.infoValue}>{tenantName}</Text>
            </Text>
          )}
        </View>

        {showRetry && onRetry && (
          <TouchableOpacity style={styles.contactButton} onPress={onRetry}>
            <Ionicons name="refresh-outline" size={20} color="#FFFFFF" />
            <Text style={styles.contactButtonText}>Retry</Text>
          </TouchableOpacity>
        )}

        <TouchableOpacity style={styles.contactButton}>
          <Ionicons name="call-outline" size={20} color="#FFFFFF" />
          <Text style={styles.contactButtonText}>Contact Support</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
};

/**
 * Higher-order component version of FeatureGuard
 */
export const withFeatureGuard = (feature, options = {}) => (WrappedComponent) => {
  const WithFeatureGuardComponent = (props) => (
    <FeatureGuard feature={feature} {...options}>
      <WrappedComponent {...props} />
    </FeatureGuard>
  );

  WithFeatureGuardComponent.displayName = `withFeatureGuard(${WrappedComponent.displayName || WrappedComponent.name})`;
  
  return WithFeatureGuardComponent;
};

/**
 * Hook for conditional rendering based on feature access
 */
export const useFeatureGuard = (feature) => {
  const { hasFeature, isReady, loading } = useTenantFeatures();
  
  return {
    hasAccess: hasFeature(feature),
    isReady,
    loading
  };
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FFFFFF',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
    minHeight: Platform.OS === 'web' ? height - 100 : undefined
  },
  loadingText: {
    marginTop: 16,
    fontSize: 16,
    color: '#666666',
    textAlign: 'center'
  },
  errorTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#F44336',
    marginTop: 16,
    textAlign: 'center'
  },
  errorMessage: {
    fontSize: 16,
    color: '#666666',
    marginTop: 8,
    textAlign: 'center',
    lineHeight: 24
  },
  blockedContent: {
    alignItems: 'center',
    maxWidth: 400,
    width: '100%'
  },
  blockedTitle: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#FF5722',
    marginTop: 24,
    textAlign: 'center'
  },
  blockedMessage: {
    fontSize: 18,
    color: '#333333',
    marginTop: 16,
    textAlign: 'center',
    lineHeight: 26,
    fontWeight: '500'
  },
  infoContainer: {
    marginTop: 32,
    padding: 16,
    backgroundColor: '#F5F5F5',
    borderRadius: 8,
    width: '100%'
  },
  infoText: {
    fontSize: 14,
    color: '#666666',
    marginBottom: 4
  },
  infoValue: {
    fontWeight: 'bold',
    color: '#333333'
  },
  contactButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FF5722',
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 8,
    marginTop: 16,
    elevation: 2,
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4
  },
  contactButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: 'bold',
    marginLeft: 8
  },
  retryButton: {
    backgroundColor: '#2196F3',
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 8,
    marginTop: 16
  },
  retryButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: 'bold'
  }
});

export default FeatureGuard;