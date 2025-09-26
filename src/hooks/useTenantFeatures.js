/**
 * useTenantFeatures Hook
 * 
 * Integrates with the existing enhanced tenant system to provide
 * feature-based access control functionality.
 */

import { useContext, useState, useEffect } from 'react';
import TenantContext from '../contexts/TenantContext';
import { useAuth } from '../utils/AuthContext';
import { supabase } from '../utils/supabase';
import { DEFAULT_FEATURES, FEATURES, isValidFeature, isFeaturesAll } from '../constants/featureMapping';

/**
 * Hook to check user feature permissions
 * Uses user-level features stored in users.features column
 */
export const useTenantFeatures = () => {
  const context = useContext(TenantContext);
  const { user } = useAuth();
  
  // User features state
  const [userFeatures, setUserFeatures] = useState({});
  const [featuresLoading, setFeaturesLoading] = useState(true);
  const [featuresError, setFeaturesError] = useState(null);
  
  if (!context) {
    throw new Error('🚨 useTenantFeatures must be used within a TenantProvider');
  }

  const { 
    currentTenant, 
    isReady, 
    loading, 
    error, 
    tenantId 
  } = context;
  
  // Load user features from database
  useEffect(() => {
    const loadUserFeatures = async () => {
      if (!user?.id || !isReady) {
        return;
      }
      
      try {
        setFeaturesLoading(true);
        setFeaturesError(null);
        
        console.log('🔍 Loading user features for user ID:', user.id);
        
        const { data: userData, error: userError } = await supabase
          .from('users')
          .select('id, email, features')
          .eq('id', user.id)
          .single();
        
        if (userError) {
          throw userError;
        }
        
        const features = userData?.features || {};
        console.log('✅ Loaded user features:', features);
        setUserFeatures(features);
        
      } catch (err) {
        console.error('❌ Error loading user features:', err);
        setFeaturesError(err.message);
        setUserFeatures({}); // Default to no permissions
      } finally {
        setFeaturesLoading(false);
      }
    };
    
    loadUserFeatures();
  }, [user?.id, isReady]);

  /**
   * Check if a specific feature is enabled for the current user
   * @param {string} featureKey - The feature key to check (e.g., 'stationary_management')
   * @returns {boolean} - Whether the feature is enabled
   */
  const hasFeature = (featureKey) => {
    // Validate feature key
    if (!featureKey || !isValidFeature(featureKey)) {
      console.warn(`⚠️ useTenantFeatures: Invalid feature key '${featureKey}'`);
      return false;
    }

    // If user features are still loading, deny access for security
    if (featuresLoading || !user?.id) {
      console.log(`🔒 useTenantFeatures: User features loading or no user, denying access to '${featureKey}'`);
      return false;
    }
    
    // If there was an error loading features, deny access
    if (featuresError) {
      console.log(`🔒 useTenantFeatures: Features error, denying access to '${featureKey}': ${featuresError}`);
      return false;
    }

    // 🌟 CHECK FOR FEATURES-ALL FIRST
    // If user has features-all enabled, grant access to all regular features
    const hasFeaturesAll = userFeatures[FEATURES.FEATURES_ALL] === true;
    if (hasFeaturesAll && !isFeaturesAll(featureKey)) {
      console.log(`🌟 useTenantFeatures: User has 'features-all' permission, granting access to '${featureKey}' for user ${user.email}`);
      return true;
    }

    // Check if feature is explicitly enabled for this user
    const hasAccess = userFeatures[featureKey] === true;
    
    console.log(`🔍 useTenantFeatures: Feature '${featureKey}' access: ${hasAccess ? 'GRANTED' : 'DENIED'} for user ${user.email}`);
    
    return hasAccess;
  };

  /**
   * Check if multiple features are enabled
   * @param {string[]} featureKeys - Array of feature keys to check
   * @returns {Object} - Object mapping feature keys to their access status
   */
  const hasFeatures = (featureKeys) => {
    if (!Array.isArray(featureKeys)) {
      console.warn('⚠️ useTenantFeatures: hasFeatures expects an array of feature keys');
      return {};
    }

    const result = {};
    featureKeys.forEach(key => {
      result[key] = hasFeature(key);
    });

    return result;
  };

  /**
   * Check if any of the provided features is enabled
   * @param {string[]} featureKeys - Array of feature keys to check
   * @returns {boolean} - Whether at least one feature is enabled
   */
  const hasAnyFeature = (featureKeys) => {
    if (!Array.isArray(featureKeys)) {
      return false;
    }

    return featureKeys.some(key => hasFeature(key));
  };

  /**
   * Check if all provided features are enabled
   * @param {string[]} featureKeys - Array of feature keys to check
   * @returns {boolean} - Whether all features are enabled
   */
  const hasAllFeatures = (featureKeys) => {
    if (!Array.isArray(featureKeys)) {
      return false;
    }

    return featureKeys.every(key => hasFeature(key));
  };

  /**
   * Get all enabled features for the current user
   * @returns {string[]} - Array of enabled feature keys
   */
  const getEnabledFeatures = () => {
    if (featuresLoading || !user?.id || featuresError) {
      return [];
    }

    // If user has features-all, return all regular features plus features-all itself
    const hasFeaturesAll = userFeatures[FEATURES.FEATURES_ALL] === true;
    if (hasFeaturesAll) {
      const { getAllRegularFeatures } = require('../constants/featureMapping');
      const allRegularFeatures = getAllRegularFeatures();
      return [FEATURES.FEATURES_ALL, ...allRegularFeatures];
    }

    return Object.keys(userFeatures).filter(key => userFeatures[key] === true);
  };

  /**
   * Get feature access summary
   * @returns {Object} - Summary of feature access status
   */
  const getFeaturesSummary = () => {
    const enabledFeatures = getEnabledFeatures();
    const totalFeatures = Object.keys(DEFAULT_FEATURES).length;
    
    return {
      enabled: enabledFeatures,
      enabledCount: enabledFeatures.length,
      totalCount: totalFeatures,
      userName: user?.email || 'Unknown',
      userId: user?.id,
      tenantName: currentTenant?.name || 'Unknown',
      tenantId: tenantId,
      isReady: !featuresLoading && !featuresError && user?.id
    };
  };

  /**
   * Development helper to log feature access
   * @param {string} featureKey - Feature to check and log
   * @param {string} context - Context for the log (e.g., screen name)
   */
  const debugFeatureAccess = (featureKey, context = 'Unknown') => {
    if (process.env.NODE_ENV === 'development') {
      const access = hasFeature(featureKey);
      const userName = user?.email || 'Unknown';
      console.log(`🔍 [${context}] Feature '${featureKey}' -> ${access ? '✅ GRANTED' : '❌ DENIED'} for user '${userName}'`);
    }
  };

  return {
    // Core feature checking
    hasFeature,
    hasFeatures,
    hasAnyFeature,
    hasAllFeatures,
    
    // Feature information
    getEnabledFeatures,
    getFeaturesSummary,
    
    // State information
    isReady: !featuresLoading && !featuresError && user?.id,
    loading: featuresLoading,
    error: featuresError,
    
    // User information  
    user: user,
    userName: user?.email,
    userId: user?.id,
    
    // Tenant information
    tenant: currentTenant,
    tenantName: currentTenant?.name,
    tenantId,
    
    // Development helpers
    debugFeatureAccess
  };
};

export default useTenantFeatures;