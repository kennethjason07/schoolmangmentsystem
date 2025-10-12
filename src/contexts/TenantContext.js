import React, { createContext, useContext, useEffect, useState } from 'react';
import { supabase } from '../utils/supabase';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { getCurrentUserTenantByEmail } from '../utils/getTenantByEmail';
import { validateTenantAccess, createTenantQuery } from '../utils/tenantValidation';
// REMOVED: Circular dependency fix - import tenant helpers dynamically when needed
// import { initializeTenantHelpers, resetTenantHelpers } from '../utils/tenantHelpers';
// DISABLED: Auto-importing test utilities that run database queries before login
// import { runAllProductionTests } from '../utils/supabaseProductionTest';
// import { testTenantQueryHelper, createTenantQuery, executeTenantQuery } from '../utils/tenantQueryHelper';
// import '../utils/quickSupabaseTest'; // Auto-run quick tests
// import '../utils/testFixedTenantBuilder'; // Auto-run fixed builder tests

const TenantContext = createContext({});

export const useTenant = () => {
  const context = useContext(TenantContext);
  if (!context) {
    throw new Error('useTenant must be used within a TenantProvider');
  }
  return context;
};

// Alias for backward compatibility
export const useTenantContext = useTenant;

/**
 * 🚀 ENHANCED TENANT ACCESS HOOK
 * Enhanced tenant access with mandatory validation
 * Now includes performance monitoring and health checks
 */
export const useTenantAccess = () => {
  const context = useTenant();
  
  // Enhanced validation
  if (!context.tenantId && context.isReady) {
    console.warn('⚠️ ENHANCED TENANT SYSTEM: Tenant ID not available but context is ready. This may indicate a configuration issue.');
  }

  return {
    // Reliable tenant ID access
    getTenantId: context.getTenantId,
    tenantId: context.tenantId,
    
    // State checks
    isReady: context.isReady,
    isLoading: context.loading,
    tenantInitialized: context.tenantInitialized,
    tenantFullyLoaded: context.tenantFullyLoaded,  // 🚀 FIX: Export fully loaded state
    
    // Tenant info - only show when fully loaded
    tenant: context.tenantFullyLoaded ? context.currentTenant : null,
    tenantName: context.tenantFullyLoaded ? context.tenantName : null,  // 🚀 FIX: Only show name when fully loaded
    
    // Error handling
    error: context.error,
    
    // Initialization control
    initializeTenant: context.initializeTenant,
    
    // 🚀 BREAKING CHANGE: New health monitoring features
    healthStatus: {
      isHealthy: context.isReady && !context.error && context.tenantId && context.tenantFullyLoaded,  // 🚀 FIX: Include fully loaded check
      lastCheck: Date.now(),
      issues: context.error ? [context.error] : []
    }
  };
};

export const TenantProvider = ({ children }) => {
  console.log('🏗️ TenantProvider: Component initialized');
  
  // DISABLED: Database query tests before authentication
  // These tests are now only run after successful authentication
  // console.log('🧪 TenantProvider: Running successful query pattern tests...');
  // try {
  //   // Test only the working tenant query helper with the known tenant ID
  //   const testTenantId = 'b8f8b5f0-1234-4567-8901-123456789000';
  //   console.log('🧪 TenantProvider: Testing working tenant patterns with tenant:', testTenantId);
  //   testTenantQueryHelper(testTenantId).then(success => {
  //     console.log('🧪 TenantProvider: ✅ All tenant query tests:', success ? 'PASSED' : 'FAILED');
  //     if (success) {
  //       console.log('🎉 TENANT QUERIES FULLY OPERATIONAL!');
  //     }
  //   }).catch(error => {
  //     console.error('🧪 TenantProvider: Tenant query test error:', error);
  //   });
  //   
  // } catch (testError) {
  //   console.error('🧪 TenantProvider: Query tests failed:', testError);
  // }
  
  const [currentTenant, setCurrentTenant] = useState(null);
  const [availableTenants, setAvailableTenants] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  
  // 🚀 FIX: Prevent flash of incorrect tenant name during loading
  const [tenantFullyLoaded, setTenantFullyLoaded] = useState(false);
  
  // 🚀 ENHANCED: Cached tenant ID for reliable access
  const [cachedTenantId, setCachedTenantId] = useState(null);
  const [tenantInitialized, setTenantInitialized] = useState(false);
  
  console.log('🔍 TenantProvider: Current state:', {
    currentTenant: currentTenant ? 'SET' : 'NULL',
    loading,
    error: error || 'none'
  });

  // Load tenant data on app start - using enhanced initialization
  useEffect(() => {
    console.log('🚀 TenantProvider: useEffect TRIGGERED - starting enhanced tenant initialization');
    
    const initializeTenantData = async () => {
      try {
        console.log('🚀 TenantProvider: Calling initializeTenant...');
        const result = await initializeTenant();
        
        if (result.success) {
          console.log('✅ TenantProvider: Tenant initialization successful:', {
            tenantId: result.tenantId,
            fromCache: result.fromCache,
            fromStorage: result.fromStorage
          });
        } else if (result.isAuthError) {
          console.log('🚀 TenantProvider: Auth error during initialization (expected during login)');
          // Don't treat auth errors as real errors during startup
        } else {
          console.error('❌ TenantProvider: Tenant initialization failed:', result.error);
        }
      } catch (error) {
        console.error('❌ TenantProvider: Failed to initialize tenant:', error);
        setError(`Failed to initialize: ${error.message}`);
        setLoading(false);
      }
    };
    
    // Only initialize tenant if we're not on the login screen
    // Check if we're in a navigation context and what screen we're on
    initializeTenantData();
    
    console.log('🚀 TenantProvider: useEffect setup complete');
  }, []);
  
  // 🚀 ENHANCED: Auto-initialize tenant when user authenticates
  useEffect(() => {
    const checkUserAndInitializeTenant = async () => {
      // Only proceed if we haven't initialized tenant yet
      if (tenantInitialized) {
        return;
      }
      
      try {
        // Check if user is authenticated
        const { data: { user }, error: authError } = await supabase.auth.getUser();
        
        if (!authError && user) {
          console.log('🚀 TenantContext: User authenticated, triggering tenant initialization:', user.email);
          
          // Auto-initialize tenant using email-based lookup
          await loadTenantFromStorage();
        }
      } catch (error) {
        // Silent error - we don't want to break the app if this fails
        console.warn('⚠️ TenantContext: Error during auto-initialization:', error);
      }
    };
    
    // Check for authenticated user and initialize if needed
    checkUserAndInitializeTenant();
    
    // Also listen for auth state changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
      if (event === 'SIGNED_IN' && session?.user && !tenantInitialized) {
        console.log('🚀 TenantContext: User signed in, auto-initializing tenant:', session.user.email);
        await loadTenantFromStorage();
      } else if (event === 'SIGNED_OUT') {
        console.log('🚀 TenantContext: User signed out, clearing tenant data');
        await clearTenant();
      } else if (event === 'SIGNED_IN') {
        // 🚀 FIX: Clear fully loaded state on new sign in to prevent stale data
        setTenantFullyLoaded(false);
      }
    });
    
    return () => {
      subscription?.unsubscribe();
    };
  }, [tenantInitialized]);

  // 🚀 ENHANCED: Get cached tenant ID (most reliable method)
  const getCachedTenantId = () => {
    if (cachedTenantId) {
      console.log('🚀 TenantContext: Using cached tenant ID:', cachedTenantId);
      return cachedTenantId;
    }
    
    if (currentTenant?.id) {
      console.log('🚀 TenantContext: Using current tenant ID:', currentTenant.id);
      setCachedTenantId(currentTenant.id);
      return currentTenant.id;
    }
    
    console.warn('⚠️ TenantContext: No cached tenant ID available');
    return null;
  };
  
  // 🚀 ENHANCED: Initialize tenant once and cache it
  const initializeTenant = async () => {
    if (tenantInitialized) {
      console.log('🚀 TenantContext: Tenant already initialized, using cached data');
      return {
        success: true,
        tenantId: cachedTenantId,
        tenant: currentTenant,
        fromCache: true
      };
    }
    
    try {
      setLoading(true);
      setError(null);
      
      console.log('🚀 TenantContext: Initializing tenant for first time...');
      
      // Try to load from AsyncStorage first (skip on web for performance)
      let storedTenantId = null;
      try {
        // On web, AsyncStorage can be slow, so we skip it if we already have tenant data
        if (typeof window === 'undefined' || !currentTenant?.id) {
          storedTenantId = await AsyncStorage.getItem('currentTenantId');
        }
        
        if (storedTenantId && currentTenant?.id === storedTenantId) {
          console.log('🚀 TenantContext: Using stored tenant ID:', storedTenantId);
          setCachedTenantId(storedTenantId);
          setTenantInitialized(true);
          return {
            success: true,
            tenantId: storedTenantId,
            tenant: currentTenant,
            fromStorage: true
          };
        }
      } catch (asyncStorageError) {
        console.warn('⚠️ TenantContext: AsyncStorage error (continuing without cache):', asyncStorageError);
      }
      
      // Fetch tenant via email lookup (one-time initialization)
      const result = await getCurrentUserTenantByEmail();
      
      if (!result.success) {
        // Handle authentication errors gracefully
        const authErrorMessages = [
          'No authenticated user found',
          'No authenticated user',
          'User not authenticated'
        ];
        
        const isAuthError = authErrorMessages.some(msg => 
          result.error?.includes(msg) || result.error === msg
        );
        
        if (isAuthError) {
          console.log('🚀 TenantContext: Auth error during initialization (normal during login):', result.error);
          return { success: false, isAuthError: true, error: result.error };
        } else {
          console.error('❌ TenantContext: Failed to initialize tenant:', result.error);
          setError(result.error);
          return { success: false, error: result.error };
        }
      }
      
      // Successfully got tenant data
      const { tenant, tenantId } = result.data;
      console.log('✅ TenantContext: Successfully initialized tenant:', {
        id: tenant.id,
        name: tenant.name,
        status: tenant.status
      });
      
      // Cache the data
      setCurrentTenant(tenant);
      setCachedTenantId(tenantId);
      setTenantInitialized(true);
      
      // 🚀 ENHANCED: Initialize tenant helpers for global access
      try {
        // 🚀 FIX: Use dynamic import to prevent circular dependency
        const { initializeTenantHelpers } = await import('../utils/tenantHelpers');
        initializeTenantHelpers(tenantId);
        console.log('🚀 TenantContext: Tenant helpers initialized successfully (initializeTenant)');
      } catch (helperError) {
        console.warn('⚠️ TenantContext: Error initializing tenant helpers (initializeTenant):', helperError);
      }
      
      // Persist to storage (non-blocking on web)
      if (typeof window === 'undefined') {
        // On native, persist synchronously
        await AsyncStorage.setItem('currentTenantId', tenantId);
      } else {
        // On web, persist asynchronously without blocking
        AsyncStorage.setItem('currentTenantId', tenantId).catch(err => 
          console.warn('⚠️ TenantContext: Failed to persist tenant ID:', err)
        );
      }
      
      // Update Supabase context
      await updateSupabaseContext(tenantId);
      
      return {
        success: true,
        tenantId,
        tenant,
        initialized: true
      };
      
    } catch (error) {
      console.error('❌ TenantContext: Error during tenant initialization:', error);
      setError(error.message);
      return { success: false, error: error.message };
    } finally {
      setLoading(false);
    }
  };
  
  // Email-based tenant loading - uses email instead of Auth ID
  const loadTenantFromStorage = async () => {
    try {
      setLoading(true);
      setError(null);
      console.log('🔍 TenantContext: Starting email-based tenant loading...');
      console.log('🔍 TenantContext: Timestamp:', new Date().toISOString());
      console.log('🔍 TenantContext: Current state before loading:', {
        currentTenant: currentTenant ? 'SET' : 'NULL',
        loading,
        error: error || 'none'
      });
      
      // Use the email-based lookup function
      console.log('🔍 TenantContext: Calling getCurrentUserTenantByEmail()...');
      const result = await getCurrentUserTenantByEmail();
      console.log('🔍 TenantContext: getCurrentUserTenantByEmail result:', {
        success: result.success,
        hasData: !!result.data,
        error: result.error || 'none',
        isAuthError: result.isAuthError || false,
        code: result.code || 'none'
      });
      
      if (!result.success) {
        // Check if this is just "no authenticated user" or other expected authentication errors
        const authErrorMessages = [
          'No authenticated user found',
          'No authenticated user',
          'User not authenticated',
          'Authentication required',
          'Session expired'
        ];
        
        const isAuthError = authErrorMessages.some(msg => 
          result.error?.includes(msg) || result.error === msg
        );
        
        if (isAuthError) {
          console.log('🔍 TenantContext: Authentication error detected - this is normal for login screen:', result.error);
          // Don't set this as an error - it's expected behavior during authentication flow
          setCurrentTenant(null);
          setError(null); // Clear any previous errors
        } else {
          console.error('❌ TenantContext: Email-based tenant lookup failed:', result.error);
          // Only set error for non-authentication issues
          setError(result.error);
          setCurrentTenant(null);
        }
        } else {
          console.log('✅ TenantContext: Successfully loaded tenant via email:', {
            id: result.data.tenant.id,
            name: result.data.tenant.name,
            email: result.data.userRecord.email,
            status: result.data.tenant.status
          });
          
          // 🚀 FIX: Set tenant data atomically to prevent race condition
          setCurrentTenant(result.data.tenant);
          setCachedTenantId(result.data.tenant.id);
          setTenantInitialized(true);
          setTenantFullyLoaded(true);  // 🚀 NEW: Mark as fully loaded
          
          // 🚀 ENHANCED: Initialize tenant helpers for global access
          try {
            // 🚀 FIX: Use dynamic import to prevent circular dependency
            const { initializeTenantHelpers } = await import('../utils/tenantHelpers');
            initializeTenantHelpers(result.data.tenant.id);
            console.log('🚀 TenantContext: Tenant helpers initialized successfully');
          } catch (helperError) {
            console.warn('⚠️ TenantContext: Error initializing tenant helpers:', helperError);
          }
          
          // Cache the tenant ID in storage
          await AsyncStorage.setItem('currentTenantId', result.data.tenant.id);
          
          console.log('🎉 TenantContext: Email-based tenant loading completed successfully!');
        }
      
    } catch (error) {
      console.error('❌ TenantContext: Email-based tenant loading failed:', error);
      
      // List of authentication-related error messages that should be suppressed on login screen
      const authErrorMessages = [
        'authenticated user',
        'No authenticated user found',
        'User not authenticated', 
        'Authentication required',
        'Session expired',
        'Invalid JWT',
        'JWT expired'
      ];
      
      // Check if this is an authentication error
      const isAuthError = authErrorMessages.some(msg => 
        error.message?.includes(msg)
      );
      
      if (isAuthError) {
        console.log('🔍 TenantContext: Authentication error suppressed (normal for login flow):', error.message);
        setError(null); // Don't show authentication errors to users
      } else {
        // Only set error for non-authentication issues
        setError(error.message);
      }
      setCurrentTenant(null);
    } finally {
      setLoading(false);
    }
  };
  
  // Load tenant from authenticated user's profile
  const loadTenantFromUserProfile = async () => {
    try {
      console.log('🔍 TenantContext: Loading tenant from user profile...');
      
      const { data: { user }, error: authError } = await supabase.auth.getUser();
      if (authError || !user) {
        console.error('❌ TenantContext: No authenticated user found');
        setError('No authenticated user found. Please log in.');
        return;
      }
      
      console.log('👤 TenantContext: Authenticated user:', user.email);
      console.log('👤 TenantContext: User auth ID:', user.id);
      
      // Get user's tenant from users table with comprehensive debugging
      console.log('🔍 TenantContext: Querying users table for tenant_id...');
      const { data: userRecord, error: userError } = await supabase
        .from('users')
        .select('tenant_id, email, full_name, id, created_at')
        .eq('id', user.id)
        .single();
      
      console.log('📊 TenantContext: Raw database query result:', {
        userRecord,
        userError: userError?.message,
        queryUserId: user.id
      });
      
      if (userError) {
        console.error('❌ TenantContext: Error fetching user record:', userError);
        setError('Cannot fetch user record from database.');
        return;
      }
      
      console.log('📄 TenantContext: User database record:', {
        email: userRecord?.email,
        tenant_id: userRecord?.tenant_id,
        full_name: userRecord?.full_name
      });
      
      if (userRecord?.tenant_id) {
        console.log('✅ TenantContext: Found user tenant_id:', userRecord.tenant_id);
        
        // 🔍 DEBUGGING: Check if this tenant actually exists
        const { data: tenantValidation } = await supabase
          .from('tenants')
          .select('id, name, status')
          .eq('id', userRecord.tenant_id)
          .single();
        
        if (tenantValidation) {
          console.log('✅ TenantContext: User\'s assigned tenant is valid:', tenantValidation);
          
          // Check if this tenant has any stationary data (for information only)
          const { data: stationaryCheck } = await supabase
            .from('stationary_items')
            .select('id')
            .eq('tenant_id', userRecord.tenant_id)
            .limit(1);
          
          console.log('📆 TenantContext: Data check for user tenant (info only):', {
            tenant_id: userRecord.tenant_id,
            tenant_name: tenantValidation.name,
            has_stationary_data: stationaryCheck?.length > 0,
            note: 'Will use this tenant regardless of data availability'
          });
          
          // Use this tenant regardless of whether it has data or not
          await loadTenantById(userRecord.tenant_id);
        } else {
          console.error('❌ TenantContext: User assigned to invalid/inactive tenant:', userRecord.tenant_id);
          setError(`User assigned to invalid tenant: ${userRecord.tenant_id}`);
        }
      } else {
        console.error('❌ TenantContext: User has no tenant_id assigned');
        setError('User not assigned to any tenant. Please contact administrator.');
      }
    } catch (error) {
      console.error('❌ TenantContext: Error loading tenant from user profile:', error);
      setError(`Error loading tenant: ${error.message}`);
    }
  };

  // Load tenant by ID
  const loadTenantById = async (tenantId) => {
    try {
      console.log('🔍 TenantContext: Loading tenant by ID:', tenantId);
      console.log('🔍 TenantContext: Tenant ID type:', typeof tenantId);
      console.log('🔍 TenantContext: Is placeholder ID?', tenantId === 'b8f8b5f0-1234-4567-8901-123456789000');
      
      const { data: tenant, error } = await supabase
        .from('tenants')
        .select('*')
        .eq('id', tenantId)
        .eq('status', 'active')
        .single();

      if (error) {
        console.error('❌ TenantContext: Error fetching tenant:', error);
        throw error;
      }

      if (tenant) {
        console.log('✅ TenantContext: Successfully loaded tenant:', { 
          id: tenant.id, 
          name: tenant.name, 
          subdomain: tenant.subdomain 
        });
        
        setCurrentTenant(tenant);
        await AsyncStorage.setItem('currentTenantId', tenant.id);
        
        // Update Supabase client with tenant context
        await updateSupabaseContext(tenant.id);
      } else {
        console.error('❌ TenantContext: No tenant found with ID:', tenantId);
        throw new Error(`Tenant not found: ${tenantId}`);
      }
    } catch (error) {
      console.error('❌ TenantContext: Error loading tenant by ID:', tenantId, error);
      throw error;
    }
  };

  // Load tenant based on user's actual assignment - NO SWITCHING TO OTHER TENANTS
  const loadUserSpecificTenant = async () => {
    try {
      console.log('🔍 TenantContext: Loading user-specific tenant only...');
      
      // Get current authenticated user
      const { data: { user }, error: authError } = await supabase.auth.getUser();
      if (authError || !user) {
        console.log('⚠️ TenantContext: No authenticated user found');
        return;
      }
      
      console.log('👤 TenantContext: Getting tenant for user:', user.email);
      
      // Get user's assigned tenant_id from database
      const { data: userRecord, error: userError } = await supabase
        .from('users')
        .select('tenant_id, email')
        .eq('id', user.id)
        .single();
      
      if (userError) {
        console.error('❌ TenantContext: Cannot get user record:', userError);
        return;
      }
      
      if (!userRecord.tenant_id) {
        console.error('❌ TenantContext: User has no tenant_id assigned:', user.email);
        console.error('❌ This user needs to be assigned to a tenant in the database.');
        setError('User not assigned to any tenant. Please contact administrator.');
        return;
      }
      
      console.log('✅ TenantContext: User tenant_id found:', userRecord.tenant_id);
      
      // Load the user's specific tenant (even if it has no data)
      const { data: userTenant, error: tenantError } = await supabase
        .from('tenants')
        .select('*')
        .eq('id', userRecord.tenant_id)
        .single();
      
      if (tenantError || !userTenant) {
        console.error('❌ TenantContext: User assigned to invalid tenant:', userRecord.tenant_id);
        setError(`User assigned to invalid tenant: ${userRecord.tenant_id}`);
        return;
      }
      
      console.log('✅ TenantContext: Using user\'s assigned tenant:', {
        id: userTenant.id,
        name: userTenant.name,
        status: userTenant.status
      });
      
      // Set the user's tenant (regardless of data availability)
      setCurrentTenant(userTenant);
      await AsyncStorage.setItem('currentTenantId', userTenant.id);
      await updateSupabaseContext(userTenant.id);
      
    } catch (error) {
      console.error('❌ Error loading user-specific tenant:', error);
      setError('Failed to load user tenant information.');
    }
  };
  
  // Ensure current user has a tenant assigned
  const ensureUserHasTenant = async (tenantId) => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      
      console.log('🔍 Ensuring user has tenant assigned...');
      
      // Check if user already has this tenant
      const { data: userRecord } = await supabase
        .from('users')
        .select('tenant_id')
        .eq('id', user.id)
        .single();
      
      if (!userRecord?.tenant_id || userRecord.tenant_id !== tenantId) {
        console.log('🔧 Assigning user to tenant:', tenantId);
        
        const { error: updateError } = await supabase
          .from('users')
          .update({ tenant_id: tenantId })
          .eq('id', user.id);
        
        if (updateError) {
          console.error('❌ Error assigning user to tenant:', updateError);
        } else {
          console.log('✅ User successfully assigned to tenant');
        }
      } else {
        console.log('✅ User already has correct tenant assigned');
      }
    } catch (error) {
      console.error('❌ Error in ensureUserHasTenant:', error);
    }
  };

  // Update Supabase context with tenant ID
  const updateSupabaseContext = async (tenantId) => {
    try {
      console.log('🏢 Setting tenant context for:', tenantId);
      
      // Get current session to check if user is authenticated
      const { data: { session }, error: sessionError } = await supabase.auth.getSession();
      
      if (!sessionError && session?.user) {  
        // Update JWT claims with tenant_id (this would typically be done server-side)
        // For now, we'll use a configuration setting - but handle errors gracefully
        try {
          await supabase.rpc('set_config', {
            setting_name: 'app.current_tenant_id',
            setting_value: tenantId
          });
          console.log('✅ Successfully set tenant context via RPC');
        } catch (rpcError) {
          // If the RPC doesn't exist or fails, that's okay - we'll use client-side context
          console.warn('⚠️ set_config RPC not available or failed:', rpcError.message);
          console.log('📍 Continuing with client-side tenant context for tenant:', tenantId);
          // We don't throw here to avoid breaking the app flow
        }
      } else {
        console.log('No active session found, skipping RPC call');
      }
    } catch (error) {
      console.error('❌ Error updating Supabase context:', error);
      // Don't throw the error to prevent breaking the app
      // The application can still work with client-side tenant filtering
    }
  };

  // DISABLED: Switch to a different tenant - strict tenant enforcement
  const switchTenant = async (tenantId) => {
    console.error('❌ TenantContext: Tenant switching disabled for security');
    throw new Error('Tenant switching is not allowed in strict tenant mode');
  };

  // Load available tenants for current user
  const loadAvailableTenants = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      
      if (!user) return;

      // Get user's tenant access
      const { data: userRecord, error: userError } = await supabase
        .from('users')
        .select('tenant_id, roles(role_name)')
        .eq('id', user.id)
        .single();

      if (userError) throw userError;

      let tenantQuery = supabase
        .from('tenants')
        .select('*')
        .eq('status', 'active');

      // If user is not super_admin, limit to their tenant
      if (userRecord?.roles?.role_name !== 'super_admin') {
        tenantQuery = tenantQuery.eq('id', userRecord.tenant_id);
      }

      const { data: tenants, error: tenantsError } = await tenantQuery;
      
      if (tenantsError) throw tenantsError;

      setAvailableTenants(tenants || []);
    } catch (error) {
      console.error('Error loading available tenants:', error);
    }
  };

  // Create new tenant (super admin only)
  const createTenant = async (tenantData) => {
    try {
      setLoading(true);
      setError(null);

      // Validate required fields
      if (!tenantData.name || !tenantData.subdomain) {
        throw new Error('Tenant name and subdomain are required');
      }

      // Check if subdomain is already taken
      const { data: existingTenant } = await supabase
        .from('tenants')
        .select('id')
        .eq('subdomain', tenantData.subdomain.toLowerCase())
        .single();

      if (existingTenant) {
        throw new Error('Subdomain already exists');
      }

      // Create tenant using the database function
      const { data: newTenantId, error: createError } = await supabase
        .rpc('create_tenant', {
          tenant_name: tenantData.name,
          tenant_subdomain: tenantData.subdomain.toLowerCase(),
          contact_email: tenantData.contact_email || null,
          contact_phone: tenantData.contact_phone || null
        });

      if (createError) throw createError;

      // Load the newly created tenant
      await loadTenantById(newTenantId);
      await loadAvailableTenants();

      return newTenantId;
    } catch (error) {
      console.error('Error creating tenant:', error);
      setError(error.message);
      throw error;
    } finally {
      setLoading(false);
    }
  };

  // Update current tenant
  const updateTenant = async (updates) => {
    try {
      if (!currentTenant) throw new Error('No current tenant selected');

      setLoading(true);
      setError(null);

      const { data: updatedTenant, error } = await supabase
        .from('tenants')
        .update({
          ...updates,
          updated_at: new Date().toISOString()
        })
        .eq('id', currentTenant.id)
        .select()
        .single();

      if (error) throw error;

      setCurrentTenant(updatedTenant);
      return updatedTenant;
    } catch (error) {
      console.error('Error updating tenant:', error);
      setError(error.message);
      throw error;
    } finally {
      setLoading(false);
    }
  };

  // Get tenant features/permissions
  const getTenantFeatures = () => {
    if (!currentTenant?.features) return {};
    return currentTenant.features;
  };

  // Check if tenant has specific feature
  const hasFeature = (featureName) => {
    const features = getTenantFeatures();
    return features[featureName] === true;
  };

  // Get tenant limits
  const getTenantLimits = () => {
    if (!currentTenant) return {};
    return {
      maxStudents: currentTenant.max_students || 500,
      maxTeachers: currentTenant.max_teachers || 50,
      maxClasses: currentTenant.max_classes || 20,
    };
  };

  // Check if tenant can add more of a resource type
  const canAddMore = async (resourceType) => {
    if (!currentTenant) return false;

    const limits = getTenantLimits();
    
    try {
      let currentCount = 0;
      
      switch (resourceType) {
        case 'students':
          const { count: studentCount } = await supabase
            .from('students')
            .select('*', { count: 'exact', head: true })
            .eq('tenant_id', currentTenant.id);
          currentCount = studentCount || 0;
          return currentCount < limits.maxStudents;
          
        case 'teachers':
          const { count: teacherCount } = await supabase
            .from('teachers')
            .select('*', { count: 'exact', head: true })
            .eq('tenant_id', currentTenant.id);
          currentCount = teacherCount || 0;
          return currentCount < limits.maxTeachers;
          
        case 'classes':
          const { count: classCount } = await supabase
            .from('classes')
            .select('*', { count: 'exact', head: true })
            .eq('tenant_id', currentTenant.id);
          currentCount = classCount || 0;
          return currentCount < limits.maxClasses;
          
        default:
          return true;
      }
    } catch (error) {
      console.error('Error checking resource limits:', error);
      return false;
    }
  };

  // Manually retry tenant loading (for debugging)
  const retryTenantLoading = async () => {
    console.log('🔄 TenantContext: Manual retry tenant loading...');
    await loadTenantFromStorage();
  };
  
  // Enhanced manual tenant loading with detailed debugging
  const debugTenantLoading = async () => {
    console.log('📝 TenantContext: DEBUG - Starting enhanced tenant loading debug...');
    
    try {
      // Step 1: Check current auth state
      console.log('📝 Step 1: Checking auth state...');
      const { data: { user }, error: authError } = await supabase.auth.getUser();
      console.log('📝 Auth state result:', {
        hasUser: !!user,
        userEmail: user?.email || 'none',
        authError: authError?.message || 'none'
      });
      
      if (!user) {
        console.log('📝 Auth issue detected - user not authenticated');
        return { success: false, issue: 'not_authenticated' };
      }
      
      // Step 2: Test tenant lookup directly
      console.log('📝 Step 2: Testing tenant lookup directly...');
      const { getTenantIdByEmail } = await import('../utils/getTenantByEmail');
      const directResult = await getTenantIdByEmail(user.email);
      console.log('📝 Direct tenant lookup result:', {
        success: directResult.success,
        error: directResult.error || 'none',
        hasTenantData: !!directResult.data
      });
      
      if (directResult.success) {
        console.log('📝 SUCCESS - Manual tenant loading should work');
        console.log('📝 Triggering actual tenant loading...');
        await loadTenantFromStorage();
        return { success: true, tenant: directResult.data.tenant };
      } else {
        console.log('📝 FAILED - Issue with tenant lookup:', directResult.error);
        return { success: false, issue: 'tenant_lookup_failed', error: directResult.error };
      }
      
    } catch (error) {
      console.error('📝 ERROR in debug tenant loading:', error);
      return { success: false, issue: 'exception', error: error.message };
    }
  };

  // Clear tenant data (on logout) - enhanced to clear cache
  const clearTenant = async () => {
    try {
      console.log('🧼 TenantContext: Clearing all tenant data...');
      
      await AsyncStorage.removeItem('currentTenantId');
      setCurrentTenant(null);
      setAvailableTenants([]);
      setCachedTenantId(null);
      setTenantInitialized(false);
      setTenantFullyLoaded(false);  // 🚀 FIX: Reset fully loaded state
      setError(null);
      setLoading(true); // Reset to loading state
      
      // 🚀 ENHANCED: Reset tenant helpers
      try {
        // 🚀 FIX: Use dynamic import to prevent circular dependency
        const { resetTenantHelpers } = await import('../utils/tenantHelpers');
        resetTenantHelpers();
      } catch (helperError) {
        console.warn('⚠️ TenantContext: Error resetting tenant helpers:', helperError);
      }
      
      console.log('✅ TenantContext: All tenant data cleared successfully');
    } catch (error) {
      console.error('❌ Error clearing tenant data:', error);
    }
  };

  // Get tenant settings with defaults
  const getTenantSettings = () => {
    if (!currentTenant?.settings) return {};
    return {
      timezone: currentTenant.timezone || 'UTC',
      academicYearStartMonth: currentTenant.academic_year_start_month || 4,
      ...currentTenant.settings
    };
  };

  const value = {
    // Current tenant state
    currentTenant,
    availableTenants,
    loading,
    error,
    
    // 🚀 ENHANCED: Reliable tenant ID access
    tenantId: getCachedTenantId(), // Always use cached version
    cachedTenantId,
    tenantInitialized,
    tenantFullyLoaded,  // 🚀 FIX: Export fully loaded state
    
    // 🚀 ENHANCED: Reliable tenant access methods
    getTenantId: getCachedTenantId,
    isReady: tenantInitialized && !loading && cachedTenantId && tenantFullyLoaded,  // 🚀 FIX: Include fully loaded check
    initializeTenant,
    
    // Tenant management
    switchTenant,
    createTenant,
    updateTenant,
    loadAvailableTenants,
    clearTenant,
    retryTenantLoading,
    debugTenantLoading,
    
    // Feature checks
    getTenantFeatures,
    hasFeature,
    getTenantLimits,
    canAddMore,
    getTenantSettings,
    
    // Helper methods
    isMultiTenant: availableTenants.length > 1,
    tenantName: (tenantFullyLoaded && currentTenant?.name) || null,  // 🚀 FIX: Only show name when fully loaded
    tenantSubdomain: currentTenant?.subdomain || null,
    
    // 🚀 ENHANCED: Tenant-aware query helpers with cached tenant ID
    createTenantAwareQuery: (tableName) => {
      // Check if tenant is ready
      if (!tenantInitialized || loading) {
        console.warn('❌ Tenant context is still loading, cannot create query yet');
        throw new Error('Tenant context is loading. Please wait...');
      }
      
      const tenantId = getCachedTenantId();
      if (!tenantId) {
        console.warn('❌ No cached tenant ID for tenant-aware query creation');
        throw new Error('No tenant context available. Please contact administrator.');
      }
      
      console.log(`🔍 Creating tenant-aware query for '${tableName}' with cached tenant_id: ${tenantId}`);
      return createTenantQuery(tenantId, tableName);
    },
    
    // 🚀 ENHANCED: Quick tenant ID access for database operations
    getQueryTenantId: () => {
      const tenantId = getCachedTenantId();
      if (!tenantId) {
        throw new Error('No tenant context available for database queries. Please ensure user is logged in and tenant is initialized.');
      }
      return tenantId;
    },
    
    // Validate tenant access for current user
    validateCurrentTenantAccess: async (screenName = 'Unknown') => {
      const tenantId = currentTenant?.id;
      if (!tenantId) {
        return {
          isValid: false,
          tenant: null,
          error: 'No tenant context available. Please contact administrator.'
        };
      }
      
      const { data: { user }, error: authError } = await supabase.auth.getUser();
      if (authError || !user) {
        return {
          isValid: false,
          tenant: null,
          error: 'User not authenticated.'
        };
      }
      
      return await validateTenantAccess(tenantId, user.id, screenName);
    },
    
    // Safe tenant query execution with automatic validation
    executeSafeTenantQuery: async (tableName, queryOptions = {}) => {
      try {
        // Validate tenant access first
        const validation = await value.validateCurrentTenantAccess(`${tableName} Query`);
        if (!validation.isValid) {
          console.error(`❌ Tenant validation failed for ${tableName}:`, validation.error);
          return { data: null, error: new Error(validation.error) };
        }
        
        const tenantId = currentTenant?.id;
        const queryBuilder = createTenantQuery(tenantId, tableName);
        
        // Apply query options
        let query = queryBuilder.select(queryOptions.select || '*');
        
        if (queryOptions.filters) {
          Object.entries(queryOptions.filters).forEach(([column, value]) => {
            query = query.eq(column, value);
          });
        }
        
        if (queryOptions.orderBy) {
          query = query.order(queryOptions.orderBy.column || queryOptions.orderBy, 
            queryOptions.orderBy.ascending ? { ascending: true } : { ascending: false }
          );
        }
        
        if (queryOptions.limit) {
          query = query.limit(queryOptions.limit);
        }
        
        const result = await query.execute();
        
        // Additional client-side validation
        if (result.data && Array.isArray(result.data)) {
          const invalidItems = result.data.filter(item => item.tenant_id !== tenantId);
          if (invalidItems.length > 0) {
            console.error(`❌ Data validation failed: Found ${invalidItems.length} items with wrong tenant_id`);
            return { data: null, error: new Error('Data integrity violation detected') };
          }
        }
        
        console.log(`✅ Safe tenant query for '${tableName}' completed: ${result.data?.length || 0} records`);
        return result;
        
      } catch (error) {
        console.error(`❌ Safe tenant query failed for '${tableName}':`, error);
        return { data: null, error };
      }
    },
  };

  return (
    <TenantContext.Provider value={value}>
      {children}
    </TenantContext.Provider>
  );
};

export default TenantContext;
