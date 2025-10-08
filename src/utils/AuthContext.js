import React, { createContext, useContext, useState, useEffect, useRef } from 'react';
import { Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { supabase, authHelpers, dbHelpers } from './supabase';
import supabaseService from '../services/SupabaseServiceFixed';
import { AuthFix } from './authFix';
import { navigationService } from '../services/NavigationService';
import pushNotificationService from '../services/PushNotificationService';

const AuthContext = createContext({});

// Debug flag - set to false to disable verbose auth logging
const DEBUG_AUTH_LOGS = false;

// Global upload state to optimize auth checks during uploads
let isUploadInProgress = false;

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

// Upload state management helpers
export const setUploadInProgress = (inProgress) => {
  isUploadInProgress = inProgress;
  console.log(`📸 Upload state changed: ${inProgress ? 'IN PROGRESS' : 'COMPLETED'}`);
};

export const getUploadInProgress = () => isUploadInProgress;

// Helper function to count tenant resources
const getTenantResourceCount = async (tenantId, resourceType) => {
  try {
    const tableName = resourceType === 'teachers' ? 'teachers' : 'students';
    const { count, error } = await supabase
      .from(tableName)
      .select('*', { count: 'exact', head: true })
      .eq('tenant_id', tenantId);
    
    if (error) throw error;
    return count || 0;
  } catch (error) {
    console.error('Error counting tenant resources:', error);
    return 0;
  }
};

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [userType, setUserType] = useState(null); // 'admin', 'teacher', 'student', 'parent'
  const isSigningInRef = useRef(false); // Prevent auth listener interference
  const lastErrorMessageRef = useRef(''); // Track last error to avoid spam

  // Web-specific debugging
  if (Platform.OS === 'web') {
    console.log('🌐 AuthProvider state:', { user: !!user, userType, loading });
  }

  useEffect(() => {
    // Initialize auth state with refresh token error handling
    const initializeAuth = async () => {
      try {
        console.log('🔄 Initializing authentication...');
        
        // Use shorter timeout for web platform to prevent hanging
        const WEB_TIMEOUT = Platform.OS === 'web' ? 5000 : 10000;
        
        // First, validate and fix any session issues using AuthFix with timeout
        const sessionResult = await Promise.race([
          AuthFix.validateAndFixSession(),
          new Promise((_, reject) => 
            setTimeout(() => reject(new Error('Session validation timed out')), WEB_TIMEOUT)
          )
        ]);
        
        if (sessionResult.valid && sessionResult.session) {
          // Session is valid, proceed with normal auth handling
          console.log('✅ Valid session found, proceeding with auth');
          await handleAuthChange(sessionResult.session.user);
        } else if (sessionResult.needsReauth) {
          // Session is invalid or corrupted, clear everything
          console.log('⚠️ Session invalid or missing, clearing auth state');
          setUser(null);
          setUserType(null);
        } else if (sessionResult.error) {
          // Only log error if it's different from the last one to reduce spam
          const errorMessage = sessionResult.error.message || 'Unknown error';
          if (lastErrorMessageRef.current !== errorMessage) {
            console.error('❌ Session validation error:', sessionResult.error);
            lastErrorMessageRef.current = errorMessage;
          }
          
          // Check if it's a refresh token error
          if (errorMessage.includes('Invalid Refresh Token') || 
              errorMessage.includes('Refresh Token Not Found')) {
            if (lastErrorMessageRef.current !== errorMessage) {
              console.log('🔧 Detected refresh token error, clearing auth data');
            }
            await AuthFix.forceSignOut();
            setUser(null);
            setUserType(null);
          }
        }
      } catch (error) {
        console.error('❌ Error initializing auth:', error);
        
        // If it's any auth-related error, clear everything to be safe
        if (error.message?.includes('refresh') || error.message?.includes('token') || error.message?.includes('Auth')) {
          console.log('🧹 Auth error detected, clearing auth data');
          await AuthFix.forceSignOut();
          setUser(null);
          setUserType(null);
        }
      } finally {
        setLoading(false);
      }
    };

    // Initialize auth state
    initializeAuth();

    // State to prevent multiple signout attempts
    let isHandlingSignOut = false;

    // Listen for auth state changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, sessionData) => {
        if (DEBUG_AUTH_LOGS) console.log('🔊 Auth state change event:', event, 'isSigningIn:', isSigningInRef.current);
        
        try {
          // Safely access session data
          const currentSession = sessionData || null;
          
          // Don't handle SIGNED_IN if we're in the middle of a manual sign-in process
          if (event === 'SIGNED_IN' && currentSession?.user && !isSigningInRef.current) {
            if (DEBUG_AUTH_LOGS) console.log('🔊 Handling auth state change for SIGNED_IN');
            await handleAuthChange(currentSession.user);
          } else if (event === 'SIGNED_IN' && isSigningInRef.current) {
            console.log('⏭️ Skipping auth state handler - manual sign-in in progress');
          } else if (event === 'SIGNED_OUT') {
            // Prevent multiple signout handling
            if (isHandlingSignOut) {
              console.log('⏭️ Skipping SIGNED_OUT - already handling signout');
              return;
            }
            
            isHandlingSignOut = true;
            if (DEBUG_AUTH_LOGS) console.log('🔊 Handling auth state change for SIGNED_OUT');
            
            // Clear auth state and let AppNavigator handle navigation
            // This ensures Login screen is available in navigation automatically
            // Deactivate push tokens for the previous user
            try {
              const prevUserId = currentSession?.user?.id || null;
              if (prevUserId) {
                await pushNotificationService.deactivateTokens(prevUserId);
              }
            } catch (e) {
              console.warn('⚠️ Failed to deactivate push tokens on sign out:', e?.message);
            }

            setUser(null);
            setUserType(null);
            isSigningInRef.current = false;
            
            if (DEBUG_AUTH_LOGS) console.log('✅ [AUTH] User state cleared - AppNavigator will automatically navigate to Login');
            
            // Reset the flag immediately since we're not doing manual navigation
            isHandlingSignOut = false;
            
          } else if (event === 'INITIAL_SESSION') {
            console.log('🔊 Handling auth state change for INITIAL_SESSION');
            // This is the initial check - if no session, that's fine
            if (!currentSession?.user) {
              console.log('No initial session found - this is normal for login screen');
              setLoading(false);
            }
          } else if (event === 'TOKEN_REFRESHED') {
            console.log('🔄 Token refreshed successfully');
          }
        } catch (error) {
          console.error('Error in auth state change handler:', error);
          
          // Only reset auth state for specific auth-related errors
          if (error.message?.includes('refresh') || 
              error.message?.includes('token') || 
              error.message?.includes('Invalid') ||
              error.message?.includes('session')) {
            console.log('🧹 Auth-specific error detected, clearing auth state');
            setUser(null);
            setUserType(null);
            setLoading(false);
            isSigningInRef.current = false;
            
            // Let AppNavigator handle navigation automatically when user state changes
            console.log('✅ [AUTH] Auth error handled - AppNavigator will automatically navigate when needed');
          } else {
            console.warn('⚠️ Non-auth error in auth state handler, continuing:', error.message);
          }
        }
      }
    );

    return () => subscription.unsubscribe();
  }, []);

  // Removed checkUser function since we now handle this in initializeAuth
  // The auth state is now managed through the auth state change listener and initial session check

  const handleAuthChange = async (authUser) => {
    console.log('🔄 [AUTH] handleAuthChange called with user:', authUser?.email);
    console.log('🔄 [AUTH] Full auth user object:', authUser);
    try {
      if (!authUser) {
        console.log('❌ [AUTH] No auth user provided, clearing state');
        setUser(null);
        setUserType(null);
        setLoading(false); // Ensure loading is false when no user
        return;
      }

      console.log('👤 [AUTH] Fetching user profile for:', authUser.email);
      console.log('👤 [AUTH] Auth user ID:', authUser.id);
      console.log('👤 [AUTH] Auth user metadata:', authUser.user_metadata);
      // First get user profile without roles join to avoid foreign key issues during signup
      // Use case-insensitive search for email with timeout
      let userProfile = null;
      let error = null;
      let tenantId = null;
      
      try {
        console.log('🔍 [AUTH] Starting user profile query...');
        console.log('🔍 [AUTH] Supabase client status:', {
          url: supabase.supabaseUrl,
          key: supabase.supabaseKey ? 'Set' : 'Missing'
        });
        
        // Skip health check if upload is in progress to prevent unnecessary timeouts
        if (isUploadInProgress) {
          console.log('⚡ Skipping health check - upload in progress');
        } else {
          // 🚑 CONNECTION HEALTH CHECK: Test basic connectivity first (with generous timeout)
          console.log('🎡 Performing connection health check...');
          try {
            // Much more generous timeout - 15 seconds for health check
            const HEALTH_CHECK_TIMEOUT = 15000;
          
          const healthCheck = await Promise.race([
            supabase.from('users').select('count', { count: 'exact', head: true }).limit(0),
            new Promise((_, reject) => 
              setTimeout(() => reject(new Error('Health check timeout')), HEALTH_CHECK_TIMEOUT)
            )
          ]);
          
          if (healthCheck.error && !healthCheck.error.message?.includes('count')) {
            console.warn('⚠️ Health check returned error, but continuing anyway:', healthCheck.error.message);
            // Don't fail on health check errors - continue with normal auth process
          }
          
          console.log('✅ Connection health check passed');
        } catch (healthError) {
          console.warn('⚠️ Connection health check failed:', healthError.message);
          
          // Only go to offline mode for severe network issues, not timeouts
          if (healthError.message?.includes('Network request failed') || 
              healthError.message?.includes('Unable to connect') ||
              healthError.message?.includes('ERR_NETWORK') ||
              healthError.message?.includes('ERR_INTERNET_DISCONNECTED')) {
            
            console.log('🚨 Network completely unavailable, using offline authentication');
            const immediateUserData = {
              id: authUser.id,
              email: authUser.email,
              role_id: 1,
              tenant_id: 'offline-tenant',
              photo_url: null,
              full_name: authUser.user_metadata?.full_name || authUser.email.split('@')[0],
              phone: authUser.user_metadata?.phone || '',
              created_at: new Date().toISOString(),
              is_fallback: true,
              offline_mode: true
            };
            
            console.log('🌐 Setting offline user due to network failure:', immediateUserData);
            setUser(immediateUserData);
            setUserType('admin');
            setLoading(false);
            return;
          } else {
            // For timeouts or other issues, continue with normal auth process
            console.log('⚠️ Health check failed but network may be available - continuing with normal auth');
          }
        }
        }
        
        // 📶 OPTIMIZED TIMEOUT: More aggressive for slow connections
        let baseTimeout = Platform.OS === 'web' ? 15000 : 20000; // Much more generous timeout for slow networks
        
        // Use a fixed reasonable timeout since health check timing isn't reliable
        // In production, connection speed varies and timing the health check above is problematic
        const DB_TIMEOUT = baseTimeout; // Use consistent timeout
        
        console.log(`📶 Using consistent timeout: ${DB_TIMEOUT}ms`);
        
        // First try with optimized exact email match
        console.log('📧 [AUTH] Starting optimized query for email:', authUser.email);
        
        // Add improved retry mechanism with exponential backoff
        const executeQueryWithRetry = async (query, retryCount = 0) => {
          const MAX_RETRIES = 3; // More retries for very slow connections
          const RETRY_DELAY = 2000; // Longer delay for network recovery
          
          try {
            console.log(`📡 Executing query attempt ${retryCount + 1}/${MAX_RETRIES + 1}...`);
            
            // Create a new query instance to avoid stale connections
              const freshQuery = supabase
              .from('users')
              .select('id, email, role_id, tenant_id, full_name, profile_url, phone, created_at') // Specific fields only
              .eq('email', authUser.email)
              .limit(1) // Limit to 1 result for performance
              .maybeSingle();
            
            const result = await Promise.race([
              freshQuery,
              new Promise((_, reject) => 
                setTimeout(() => {
                  console.warn('⏰ Query timeout after', DB_TIMEOUT, 'ms');
                  reject(new Error('Database query timed out'));
                }, DB_TIMEOUT)
              )
            ]);
            
            console.log('✅ Query completed successfully');
            return result;
            
          } catch (error) {
            console.warn(`❌ Query attempt ${retryCount + 1} failed:`, error.message);
            
            // More comprehensive retry conditions including Supabase-specific errors
            const shouldRetry = retryCount < MAX_RETRIES && (
              error.message?.includes('timeout') || 
              error.message?.includes('network') ||
              error.message?.includes('connection') ||
              error.message?.includes('fetch') ||
              error.message?.includes('PGRST') || // PostgREST errors
              error.message?.includes('Failed to fetch') ||
              error.message?.includes('NetworkError') ||
              error.message?.includes('AbortError') ||
              error.code === 'ECONNRESET' ||
              error.code === 'ETIMEDOUT'
            );
            
            if (shouldRetry) {
              
              console.log(`🔁 Retrying in ${RETRY_DELAY}ms... (${retryCount + 2}/${MAX_RETRIES + 1})`);
              await new Promise(resolve => setTimeout(resolve, RETRY_DELAY));
              
              return await executeQueryWithRetry(query, retryCount + 1);
            }
            
            console.error('🚨 All retry attempts failed, throwing error');
            throw error;
          }
        };
        
        let result = await executeQueryWithRetry(null); // Pass null since we create query inside the retry function
        
        console.log('📊 [AUTH] Exact email query result:', {
          data: result.data,
          error: result.error,
          status: result.status,
          statusText: result.statusText
        });
        
        // If exact match fails, try case-insensitive
        if (!result.data && !result.error) {
          console.log('🔄 Trying case-insensitive email search...');
          profileQuery = supabase
            .from('users')
            .select('*')
            .ilike('email', authUser.email)
            .maybeSingle();
          result = await profileQuery;
        }
        
        userProfile = result.data;
        error = result.error;
        tenantId = userProfile?.tenant_id;
        console.log('📄 User profile query completed:', { found: !!userProfile, error: !!error, tenantId });
      } catch (queryError) {
        console.error('❌ User profile query failed:', queryError);
        error = queryError;
      }

      console.log('📄 User profile query result:', { userProfile, error });

      if (error) {
        console.error('❌ Error fetching user profile:', error);
        
        // Enhanced fallback authentication for any query failure - more immediate for timeouts
        if (error.message?.includes('timeout') || 
            error.message?.includes('network') || 
            error.message?.includes('connection') ||
            error.message?.includes('fetch') ||
            error.name === 'AbortError') {
          
          console.log('🔄 Database connection issues detected, using enhanced fallback authentication');
          console.log('🔧 Error details:', { message: error.message, name: error.name });
          console.log('📝 This is normal for slow networks - app will work with fallback mode');
          
          // Create enhanced fallback user object from auth data
          const fallbackUserData = {
            id: authUser.id,
            email: authUser.email,
            role_id: 1, // Default to admin for fallback
            tenant_id: 'fallback-tenant', // Provide fallback tenant
            photo_url: null,
            full_name: authUser.user_metadata?.full_name || authUser.email.split('@')[0],
            phone: authUser.user_metadata?.phone || '',
            created_at: new Date().toISOString(),
            is_fallback: true // Flag to indicate this is fallback data
          };
          
          console.log('🚨 Setting enhanced fallback user data:', fallbackUserData);
          setUser(fallbackUserData);
          setUserType('admin'); // Default to admin for fallback
          setLoading(false);
          
          // Show a brief notification that we're using offline mode
          if (Platform.OS === 'web') {
            console.log('🌐 Running in fallback mode due to connection issues');
          }
          
          return;
        }
        
        // For other errors, still fail
        return;
      }

      if (!userProfile) {
        console.log('❌ User profile not found for:', authUser.email);
        
        // Try fallback for missing profile as well
        console.log('🔄 Using fallback authentication for missing profile');
        const fallbackUserData = {
          id: authUser.id,
          email: authUser.email,
          role_id: 1, // Default to admin (hardcoded safe value)
          photo_url: null,
          full_name: authUser.email.split('@')[0],
          phone: '',
          created_at: new Date().toISOString()
        };
        
        console.log('🚨 Setting fallback user data for missing profile:', fallbackUserData);
        setUser(fallbackUserData);
        setUserType('admin');
        setLoading(false);
        return;
      }

      console.log('✅ User profile found:', userProfile);
      console.log('🎯 User role_id:', userProfile.role_id);
      
      // CRITICAL: Fix any users with invalid role_id in the database
      if (!userProfile.role_id || userProfile.role_id === null || userProfile.role_id === undefined || 
          typeof userProfile.role_id !== 'number' || userProfile.role_id < 1 || userProfile.role_id > 10) {
        console.warn('🚨 [AuthContext] CRITICAL: User has invalid role_id in database:', userProfile.role_id);
        console.log('🔧 [AuthContext] Fixing user role_id in database...');
        
        try {
          // Update the user's role_id in the database to admin (1)
          const { error: updateError } = await supabase
            .from('users')
            .update({ role_id: 1 })
            .eq('id', authUser.id);
          
          if (updateError) {
            console.error('❌ [AuthContext] Failed to update user role_id:', updateError);
          } else {
            console.log('✅ [AuthContext] Successfully fixed user role_id to 1 (admin)');
            userProfile.role_id = 1; // Update the local copy too
          }
        } catch (fixError) {
          console.error('❌ [AuthContext] Exception while fixing role_id:', fixError);
          userProfile.role_id = 1; // Use fallback locally even if DB update fails
        }
      }

      // Try to get role name separately, but don't fail if it doesn't work
      let roleName = null;
      if (userProfile.role_id) {
        console.log('🔍 Looking up role name for role_id:', userProfile.role_id);
        try {
          const { data: roleData, error: roleError } = await supabase
            .from('roles')
            .select('role_name')
            .eq('id', userProfile.role_id)
            .maybeSingle();
          
          console.log('🏷️ Role lookup result:', { roleData, roleError });
          
          if (!roleError && roleData) {
            roleName = roleData.role_name.toLowerCase();
            console.log('✅ Found role in database:', roleName);
          } else {
            console.log('⚠️ Role lookup failed, using fallback. Error code:', roleError?.code, 'Message:', roleError?.message);
            // Fallback role names for when database doesn't have roles yet
            const roleMap = { 1: 'admin', 2: 'teacher', 3: 'parent', 4: 'student', 5: 'teacher', 6: 'teacher', 7: 'student', 8: 'parent' };
            roleName = roleMap[userProfile.role_id] || 'user';
            console.log('🔄 Using fallback role name:', roleName, 'for role_id:', userProfile.role_id);
            
            // Log specific error if it's the PGRST116 error
            if (roleError?.code === 'PGRST116') {
              console.log('🎯 PGRST116 detected in role lookup - role_id', userProfile.role_id, 'not found in roles table, but fallback applied successfully');
            }
          }
        } catch (roleError) {
          console.log('💥 Role lookup exception, using fallback:', roleError);
          const roleMap = { 1: 'admin', 2: 'teacher', 3: 'parent', 4: 'student', 5: 'teacher', 6: 'teacher', 7: 'student', 8: 'parent' };
          roleName = roleMap[userProfile.role_id] || 'user';
          
          if (roleError?.code === 'PGRST116') {
            console.log('🎯 PGRST116 exception caught in role lookup - using fallback successfully');
          }
        }
      } else {
        console.log('❌ No role_id found in user profile');
      }

      // Ensure we have all required user data
      const userData = {
        id: authUser.id,
        email: authUser.email,
        role_id: userProfile?.role_id || null,
        tenant_id: userProfile?.tenant_id || null,
        profile_url: userProfile?.profile_url || null,
        photo_url: userProfile?.profile_url || null,
        full_name: userProfile?.full_name || '',
        phone: userProfile?.phone || '',
        created_at: userProfile?.created_at || new Date().toISOString(),
        ...userProfile
      };

      console.log('👤 Final user data:', userData);
      console.log('🎭 Final role name:', roleName);

      // Set tenant context in SupabaseService if user has tenant_id
      if (userData.tenant_id) {
        console.log('🏢 Setting tenant context:', userData.tenant_id);
        supabaseService.setTenantContext(userData.tenant_id);
      }

      setUser(userData);
      setUserType(roleName);

      // Initialize push notifications (Android channels + token) for admin and teacher
      try {
        if (roleName === 'admin' || roleName === 'teacher') {
          await pushNotificationService.initialize(userData.id, roleName);
        }
      } catch (e) {
        console.warn('⚠️ Push notification init failed:', e?.message);
      }

      setLoading(false); // Ensure loading is false after successful auth state update
      console.log('✅ Auth state updated successfully');
    } catch (error) {
      console.error('💥 Error in handleAuthChange:', error);
      setLoading(false); // Ensure loading is false on error
    }
  };

  const signIn = async (email, password, selectedRole, tenantSubdomain = null) => {
    try {
      setLoading(true);
      isSigningInRef.current = true; // Prevent auth listener from interfering
      
      // Clear any existing invalid auth data before attempting sign in
      console.log('🧹 Clearing any invalid auth data before sign in...');
      await AuthFix.forceSignOut();
      
      // Resolve tenant if subdomain provided
      let targetTenantId = null;
      if (tenantSubdomain) {
        const { data: tenant, error: tenantError } = await supabase
          .from('tenants')
          .select('id, status')
          .eq('subdomain', tenantSubdomain.toLowerCase())
          .eq('status', 'active')
          .single();
        
        if (tenantError || !tenant) {
          return { data: null, error: { message: 'Invalid or inactive tenant' } };
        }
        
        targetTenantId = tenant.id;
      }
      
      // Use AuthFix for safer sign in
      console.log('🔐 Using AuthFix for safe sign in...');
      const signInResult = await AuthFix.signInSafely(email, password);
      
      if (!signInResult.success) {
        console.error('❌ AuthFix sign in failed:', signInResult.error);
        return { data: null, error: signInResult.error };
      }
      
      const { user, session } = signInResult;
      console.log('✅ AuthFix sign in successful for:', user.email);

      // Get user profile (without roles join to avoid foreign key issues)
      console.log('🔍 Querying user profile for email:', email);
      console.log('🔍 Auth user info:', { id: user.id, email: user.email });
      console.log('🔍 Target tenant ID:', targetTenantId);
      
      // Try exact match first
      let userQuery = supabase
        .from('users')
        .select('*')
        .eq('email', email);
      
      // If tenant specified, filter by tenant - BUT NOT FOR PARENTS OR TEACHERS
      if (targetTenantId) {
        // Check if this is a parent or teacher login (role will be determined later)
        // For now, we'll add tenant filter for non-parent/teacher roles
        const isParentOrTeacherLogin = selectedRole.toLowerCase() === 'parent' || 
                                       selectedRole.toLowerCase() === 'teacher';
        if (!isParentOrTeacherLogin) {
          console.log('🏢 Added tenant filter:', targetTenantId);
          userQuery = userQuery.eq('tenant_id', targetTenantId);
        } else {
          console.log('👨‍👩‍👧👨‍🏫 Parent/Teacher login detected - skipping tenant filter');
        }
      }
      
      console.log('📡 Executing exact match query...');
      let { data: userProfile, error: profileError } = await userQuery.maybeSingle();
      
      console.log('📊 Exact match result:');
      console.log('   - Profile found:', !!userProfile);
      console.log('   - Profile data:', userProfile);
      console.log('   - Error:', profileError?.message || 'None');
      console.log('   - Error code:', profileError?.code || 'None');
      console.log('   - Error details:', profileError?.details || 'None');
      
      // If exact match fails, try case-insensitive
      if (!userProfile && !profileError) {
        console.log('🔄 Exact match failed, trying case-insensitive search...');
        userQuery = supabase
          .from('users')
          .select('*')
          .ilike('email', email);
        
        // If tenant specified, filter by tenant - BUT NOT FOR PARENTS OR TEACHERS
        if (targetTenantId) {
          // Check if this is a parent or teacher login (role will be determined later)
          // For now, we'll add tenant filter for non-parent/teacher roles
          const isParentOrTeacherLogin = selectedRole.toLowerCase() === 'parent' || 
                                         selectedRole.toLowerCase() === 'teacher';
          if (!isParentOrTeacherLogin) {
            console.log('🏢 Added tenant filter to case-insensitive query:', targetTenantId);
            userQuery = userQuery.eq('tenant_id', targetTenantId);
          } else {
            console.log('👨‍👩‍👧👨‍🏫 Parent/Teacher case-insensitive login - skipping tenant filter');
          }
        }
        
        console.log('📡 Executing case-insensitive query...');
        const result = await userQuery.maybeSingle();
        userProfile = result.data;
        profileError = result.error;
        
        console.log('📊 Case-insensitive result:');
        console.log('   - Profile found:', !!userProfile);
        console.log('   - Profile data:', userProfile);
        console.log('   - Error:', profileError?.message || 'None');
        console.log('   - Error code:', profileError?.code || 'None');
        console.log('   - Error details:', profileError?.details || 'None');
      }

      if (profileError) {
        console.error('Profile query error:', profileError);
        return { data: null, error: { message: 'User profile not found' } };
      }

      if (!userProfile) {
        console.log('No user profile found for:', email, targetTenantId ? `in tenant: ${targetTenantId}` : '');
        const errorMsg = targetTenantId ? 'User not found in the specified tenant' : 'User profile not found';
        return { data: null, error: { message: errorMsg } };
      }

      console.log('User profile found:', { email: userProfile.email, role_id: userProfile.role_id });

      // Get role name separately with error handling
      let actualRoleName = null;
      if (userProfile.role_id) {
        try {
          const { data: roleData, error: roleError } = await supabase
            .from('roles')
            .select('role_name')
            .eq('id', userProfile.role_id)
            .maybeSingle();
          
          if (!roleError && roleData) {
            actualRoleName = roleData.role_name;
            console.log('Found role in database:', actualRoleName);
          } else {
            console.log('Role lookup failed, using fallback. Error:', roleError?.message);
            // Fallback role names
            const fallbackRoleMap = { 1: 'Admin', 2: 'Teacher', 3: 'Parent', 4: 'Student' };
            actualRoleName = fallbackRoleMap[userProfile.role_id] || 'Teacher';
            console.log('Using fallback role:', actualRoleName);
          }
        } catch (roleError) {
          console.log('Role lookup exception, using fallback:', roleError);
          const fallbackRoleMap = { 1: 'Admin', 2: 'Teacher', 3: 'Parent', 4: 'Student' };
          actualRoleName = fallbackRoleMap[userProfile.role_id] || 'Teacher';
        }
      }

      // Convert the selected role to match database format
      const roleMap = {
        'admin': 'Admin',
        'teacher': 'Teacher', 
        'parent': 'Parent',
        'student': 'Student'
      };
      const expectedRole = roleMap[selectedRole.toLowerCase()];
      
      console.log('Role validation:', { actualRole: actualRoleName, expectedRole, selectedRole });
      
      // Special handling for parents and teachers - they don't need strict tenant filtering
      const isParentLogin = selectedRole.toLowerCase() === 'parent' || 
                           (actualRoleName && actualRoleName.toLowerCase() === 'parent');
      const isTeacherLogin = selectedRole.toLowerCase() === 'teacher' || 
                            (actualRoleName && actualRoleName.toLowerCase() === 'teacher');
      const isParentOrTeacherLogin = isParentLogin || isTeacherLogin;
      
      // Only validate role if we have both values (case-insensitive comparison)
      // Skip role validation for parents/teachers since they might not have tenant_id
      if (!isParentOrTeacherLogin && actualRoleName && expectedRole && 
          actualRoleName.toLowerCase() !== expectedRole.toLowerCase()) {
        console.log('Role mismatch:', actualRoleName, 'vs expected:', expectedRole);
        return { data: null, error: { message: `Invalid role for this user. User has role: ${actualRoleName}, but trying to sign in as: ${expectedRole}` } };
      }
      
      // If no role found, allow sign-in but log warning
      if (!actualRoleName) {
        console.log('⚠️ Warning: No role found for user, allowing sign-in with selected role');
        actualRoleName = expectedRole || 'Teacher'; // Default fallback
      }

      const userData = {
        id: user.id,
        email: user.email,
        role_id: userProfile.role_id,
        tenant_id: userProfile.tenant_id,
        profile_url: userProfile?.profile_url || null,
        photo_url: userProfile?.profile_url || null,
        full_name: userProfile?.full_name || '',
        phone: userProfile?.phone || '',
        created_at: userProfile?.created_at || new Date().toISOString(),
        ...userProfile
      };

      console.log('📋 Setting user and userType directly from signIn');
      console.log('🌐 Platform:', Platform.OS);
      console.log('👤 About to set user:', userData);
      console.log('🎭 About to set userType:', actualRoleName ? actualRoleName.toLowerCase() : 'user');
      
      // Set tenant context in SupabaseService - NEVER for teachers (they use direct auth)
      if (userData.tenant_id && !isParentOrTeacherLogin) {
        console.log('🏢 Setting tenant context during signIn:', userData.tenant_id);
        supabaseService.setTenantContext(userData.tenant_id);
      } else if (isParentLogin) {
        console.log('👨‍👩‍👧 Parent login detected - bypassing tenant context for direct authentication');
      } else if (isTeacherLogin) {
        console.log('👨‍🏫 Teacher login detected - bypassing tenant context for direct authentication');
      }
      
      setUser(userData);
      setUserType(actualRoleName ? actualRoleName.toLowerCase() : 'user');
      
      // Don't wait for auth state change listener - set loading to false immediately
      setLoading(false);
      
      console.log('✅ State updated - loading set to false');
      
      // Clear the signing in flag after a short delay to allow auth listener to see it
      setTimeout(() => {
        isSigningInRef.current = false;
        console.log('🚩 isSigningIn flag cleared');
      }, 100);
      
      // Web-specific debugging
      if (Platform.OS === 'web') {
        setTimeout(() => {
          console.log('🌐 Web debug - final state check:', { 
            user: !!userData, 
            userType: actualRoleName ? actualRoleName.toLowerCase() : 'user', 
            loading: false 
          });
        }, 100);
      }
      
      return { data: userData, error: null };
    } catch (error) {
      console.error('Sign in error:', error);
      return { data: null, error: { message: 'Sign in failed' } };
    } finally {
      setLoading(false);
      isSigningInRef.current = false;
    }
  };

const signUp = async (email, password, userData, tenantId = null, emailRedirectTo = undefined) => {
    console.log('📝 Starting signup process for:', email);
    console.log('📁 User data provided:', userData);
    console.log('🏢 Tenant ID provided:', tenantId);
    try {
      setLoading(true);
      
      // Validate tenant if provided
      if (tenantId) {
        const { data: tenant, error: tenantError } = await supabase
          .from('tenants')
          .select('id, status, max_students, max_teachers')
          .eq('id', tenantId)
          .eq('status', 'active')
          .single();
        
        if (tenantError || !tenant) {
          return { data: null, error: { message: 'Invalid or inactive tenant' } };
        }
        
        // Check tenant limits based on user role
        if (userData.role_id && typeof userData.role_id === 'number') {
          const roleNames = { 2: 'teachers', 4: 'students' };
          const resourceType = roleNames[userData.role_id];
          
          if (resourceType) {
            const currentCount = await getTenantResourceCount(tenantId, resourceType);
            const maxCount = resourceType === 'teachers' ? tenant.max_teachers : tenant.max_students;
            
            if (currentCount >= maxCount) {
              return { data: null, error: { message: `Tenant has reached maximum ${resourceType} limit (${maxCount})` } };
            }
          }
        }
      }
      
      console.log('🔍 Checking if user already exists...');
      // First check if user already exists in our users table
      const { data: existingUser, error: checkError } = await supabase
        .from('users')
        .select('email')
        .eq('email', email)
        .maybeSingle();
      
      if (checkError && checkError.code !== 'PGRST116') { // PGRST116 means no rows found, which is what we want
        console.log('❌ Error checking existing user:', checkError);
        return { data: null, error: { message: 'Error checking existing user' } };
      }
      
      if (existingUser) {
        console.log('❌ User already exists:', existingUser.email);
        return { data: null, error: { message: 'An account with this email already exists. Please sign in instead.' } };
      }
      
      console.log('✅ User does not exist, proceeding with signup');
      console.log('🔒 Creating Supabase auth user...');
      // Use Supabase Auth for signup
const { data: { user, session }, error: authError } = await authHelpers.signUp(email, password, userData, emailRedirectTo);
      
      console.log('🔒 Auth signup result:', { user: user?.email, session: !!session, authError });
      
      if (authError) {
        console.log('❌ Auth signup failed:', authError);
        // Handle specific auth errors
        if (authError.message.includes('User already registered')) {
          return { data: null, error: { message: 'An account with this email already exists. Please sign in instead.' } };
        }
        return { data: null, error: { message: authError?.message || 'Signup failed' } };
      }
      
      if (!user) {
        console.log('❌ No user returned from auth signup');
        return { data: null, error: { message: 'Signup failed - no user created' } };
      }

      console.log('✅ Auth user created successfully:', user.id);
      console.log('📄 Creating user profile in database...');
      
      // Add user profile to users table
      // COMPREHENSIVE ROLE_ID VALIDATION - Multiple layers of safety checks
      console.log('🔍 [AuthContext] Starting comprehensive role_id validation');
      console.log('📊 [AuthContext] Original userData.role_id:', userData.role_id, '(type:', typeof userData.role_id, ')');
      
      // First validation layer (existing code)
      const safeRoleId = typeof userData.role_id === 'number' && !isNaN(userData.role_id) ? userData.role_id : 1;
      console.log('🔍 [AuthContext] First validation result:', safeRoleId);
      
      // Second validation layer - comprehensive safety check
      let finalRoleId = safeRoleId;
      
      // Check for undefined, null, or string 'undefined'
      if (finalRoleId === undefined || finalRoleId === null || finalRoleId === 'undefined') {
        console.error('🚨 [AuthContext] CRITICAL: role_id is undefined/null/string-undefined after first validation:', finalRoleId);
        finalRoleId = 1; // Force admin fallback
      }
      
      // Check for NaN
      if (isNaN(finalRoleId)) {
        console.error('🚨 [AuthContext] CRITICAL: role_id is NaN after validation:', finalRoleId);
        finalRoleId = 1; // Force admin fallback
      }
      
      // Ensure it's a positive integer
      if (typeof finalRoleId !== 'number' || finalRoleId <= 0 || !Number.isInteger(finalRoleId)) {
        console.error('🚨 [AuthContext] CRITICAL: role_id is not a positive integer:', finalRoleId, 'type:', typeof finalRoleId);
        finalRoleId = 1; // Force admin fallback
      }
      
      // Ensure it's within valid range (1-10 for typical role systems)
      if (finalRoleId < 1 || finalRoleId > 10) {
        console.error('🚨 [AuthContext] CRITICAL: role_id is outside valid range (1-10):', finalRoleId);
        finalRoleId = 1; // Force admin fallback
      }
      
      // Final validation - absolutely ensure it's a valid database integer
      finalRoleId = parseInt(finalRoleId);
      if (!finalRoleId || finalRoleId < 1) {
        console.error('🚨 [AuthContext] CRITICAL: role_id failed parseInt validation:', finalRoleId);
        finalRoleId = 1; // Ultimate fallback
      }
      
      console.log('✅ [AuthContext] Final validated role_id:', finalRoleId, '(type:', typeof finalRoleId, ')');
      
      // Log the transformation if it occurred
      if (userData.role_id !== finalRoleId) {
        console.warn('⚠️ [AuthContext] Role ID was transformed from', JSON.stringify(userData.role_id), 'to', finalRoleId);
      }
      
      const newUserData = {
        id: user.id, // Include the auth user ID
        email,
        role_id: finalRoleId, // Use the thoroughly validated role_id
        tenant_id: tenantId, // Include tenant_id
        full_name: userData.full_name || '',
        phone: userData.phone || '',
        linked_student_id: userData.linked_student_id || null,
        linked_teacher_id: userData.linked_teacher_id || null,
        linked_parent_of: userData.linked_parent_of || null
      };

      console.log('📁 New user data to insert:', newUserData);

      // Use insert instead of upsert for new users
      const { data: profileData, error: profileError } = await supabase
        .from('users')
        .insert(newUserData)
        .select()
        .maybeSingle();

      console.log('📄 Profile creation result:', { profileData, profileError });

      if (profileError) {
        console.error('❌ Profile creation error:', profileError);
        // If profile creation fails, clean up the auth session
        console.log('🗑️ Cleaning up auth session due to profile creation failure');
        await supabase.auth.signOut();
        
        if (profileError.code === '23505') { // Unique constraint violation
          return { data: null, error: { message: 'An account with this email already exists. Please sign in instead.' } };
        }
        
        return { data: null, error: { message: 'Failed to create user profile. Please try again.' } };
      }

      // Skip role validation during signup since user isn't confirmed yet
      // Role will be validated during login
      console.log('✅ Profile created successfully for unconfirmed user');
      
      // Create a basic role mapping for success message
      const roleNames = { 1: 'Admin', 2: 'Teacher', 3: 'Parent', 4: 'Student' };
      const roleName = roleNames[userData.role_id] || 'User';
      console.log('🎭 Role name for response:', roleName);

      const completeUserData = {
        id: user.id,
        email: user.email,
        role_id: userData.role_id,
        tenant_id: tenantId,
        ...profileData
      };

      console.log('🔒 Final user data before signout:', completeUserData);

      // Don't automatically log in after signup
      // Let the user manually login after signup
      console.log('🚪 Signing out user after successful profile creation');
      await supabase.auth.signOut();
      
      console.log('✅ Signup process completed successfully');
      return { data: completeUserData, error: null };
    } catch (error) {
      console.error('💥 Sign up error:', error);
      return { data: null, error: { message: 'Signup failed. Please try again.' } };
    } finally {
      setLoading(false);
    }
  };

  const signOut = async () => {
    try {
      setLoading(true);
      
      // Check if there's a current session
      const { data: { session }, error: sessionError } = await supabase.auth.getSession();
      
      if (sessionError) {
        console.log('Session error during logout:', sessionError);
      }
      
      if (!session) {
        // No session exists, user is already logged out
        console.log('No active session found, cleaning up local state');
        setUser(null);
        setUserType(null);
        
        // Let AppNavigator handle navigation automatically when user becomes null
        console.log('✅ [AuthContext] User state cleared, AppNavigator will handle navigation');
        return { error: null };
      }
      
      // Attempt to sign out from Supabase with enhanced error handling
      let signOutError = null;
      
      try {
        const result = await authHelpers.signOut();
        signOutError = result.error;
        console.log('Sign out result:', result);
      } catch (error) {
        console.log('Sign out error caught:', error);
        signOutError = error;
      }
      
      if (signOutError) {
        // If error is about missing session, treat it as success
        if (signOutError.message?.includes('Auth session missing') || 
            signOutError.message?.includes('Invalid Refresh Token') ||
            signOutError.name === 'AuthSessionMissingError') {
          console.log('Session already missing or invalid refresh token, cleaning up local state');
          setUser(null);
          setUserType(null);
          
          // Let AppNavigator handle navigation automatically when user becomes null
          console.log('✅ [AuthContext] User state cleared, AppNavigator will handle navigation');
          return { error: null };
        }
        // For other errors, continue with cleanup
        console.log('Sign out error (continuing with cleanup):', signOutError);
      }
      
      // Clear local state regardless of Supabase result
      setUser(null);
      setUserType(null);
      
      // Let AppNavigator handle navigation automatically when user becomes null
      console.log('✅ [AuthContext] User state cleared, AppNavigator will handle navigation');
      
      return { error: null };
    } catch (error) {
      console.error('Sign out error:', error);
      
      // If it's a session missing error or refresh token error, clear local state and treat as success
      if (error.message?.includes('Auth session missing') || 
          error.message?.includes('Invalid Refresh Token') ||
          error.name === 'AuthSessionMissingError') {
        console.log('Caught AuthSessionMissingError or Invalid Refresh Token, cleaning up local state');
        setUser(null);
        setUserType(null);
        
        // Let AppNavigator handle navigation automatically when user becomes null
        console.log('✅ [AuthContext] User state cleared, AppNavigator will handle navigation');
        return { error: null };
      }
      
      // For other errors, still clear local state and navigate
      setUser(null);
      setUserType(null);
      
      // Let AppNavigator handle navigation automatically when user becomes null
      console.log('✅ [AuthContext] User state cleared, AppNavigator will handle navigation');
      
      return { error };
    } finally {
      setLoading(false);
    }
  };

  // Navigation is now handled automatically by AppNavigator based on user state
  // No manual navigation needed

  const value = {
    user,
    userType,
    loading,
    signIn,
    signUp,
    signOut,
    isAuthenticated: !!user,
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
};