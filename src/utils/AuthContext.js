import React, { createContext, useContext, useState, useEffect, useRef } from 'react';
import { Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { supabase, authHelpers, dbHelpers } from './supabase';
import supabaseService from '../services/SupabaseServiceFixed';
import { AuthFix } from './authFix';

const AuthContext = createContext({});

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

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
          console.error('❌ Session validation error:', sessionResult.error);
          // Check if it's a refresh token error
          if (sessionResult.error.message?.includes('Invalid Refresh Token') || 
              sessionResult.error.message?.includes('Refresh Token Not Found')) {
            console.log('🔧 Detected refresh token error, clearing auth data');
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

    // Listen for auth state changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, sessionData) => {
        console.log('🔊 Auth state change event:', event, 'isSigningIn:', isSigningInRef.current);
        
        try {
          // Safely access session data
          const currentSession = sessionData || null;
          
          // Don't handle SIGNED_IN if we're in the middle of a manual sign-in process
          if (event === 'SIGNED_IN' && currentSession?.user && !isSigningInRef.current) {
            console.log('🔊 Handling auth state change for SIGNED_IN');
            await handleAuthChange(currentSession.user);
          } else if (event === 'SIGNED_IN' && isSigningInRef.current) {
            console.log('⏭️ Skipping auth state handler - manual sign-in in progress');
          } else if (event === 'SIGNED_OUT') {
            console.log('🔊 Handling auth state change for SIGNED_OUT');
            setUser(null);
            setUserType(null);
            isSigningInRef.current = false;
          }
        } catch (error) {
          console.error('Error updating Supabase context:', error);
          // If there's an error, reset the auth state to prevent app crashes
          setUser(null);
          setUserType(null);
          setLoading(false);
          isSigningInRef.current = false;
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
        
        // Use shorter timeout for web platform database queries
        const DB_TIMEOUT = Platform.OS === 'web' ? 6000 : 10000;
        
        // First try with exact email match with timeout
        let profileQuery = supabase
          .from('users')
          .select('*')
          .eq('email', authUser.email)
          .maybeSingle();
        
        console.log('📧 [AUTH] Querying with exact email:', authUser.email);
        console.log('📧 [AUTH] Query object:', profileQuery);
        
        let result = await Promise.race([
          profileQuery,
          new Promise((_, reject) => 
            setTimeout(() => reject(new Error('Database query timed out')), DB_TIMEOUT)
          )
        ]);
        
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
        
        // If it's a timeout or connection error, try fallback authentication
        if (error.message?.includes('timeout') || error.message?.includes('network') || error.name === 'AbortError') {
          console.log('🔄 Using fallback authentication due to connection issues');
          
          // Create basic user object from auth data only - DO NOT DEFAULT TO ADMIN
          console.log('⚠️ [AUTH] Database timeout/network error - cannot determine user role safely');
          console.log('⚠️ [AUTH] User email:', authUser.email);
          console.log('⚠️ [AUTH] Refusing to default to admin role due to connection issues');
          
          // Don't set user data if we can't verify the role - force re-login
          setUser(null);
          setUserType(null);
          setLoading(false);
          return;
        }
        
        // For other errors, still fail
        return;
      }

      if (!userProfile) {
        console.log('❌ User profile not found for:', authUser.email);
        
        // Missing user profile - this is a critical issue, don't default to admin
        console.log('❌ [AUTH] User profile not found in database for:', authUser.email);
        console.log('❌ [AUTH] This indicates a database inconsistency - refusing to proceed');
        console.log('❌ [AUTH] User must be properly registered in users table');
        
        // Don't create fallback user data - force proper registration
        setUser(null);
        setUserType(null);
        setLoading(false);
        return;
      }

      console.log('✅ User profile found:', userProfile);
      console.log('🎯 User role_id:', userProfile.role_id);
      
      // Log the role_id for debugging but don't auto-fix it
      if (!userProfile.role_id || userProfile.role_id === null || userProfile.role_id === undefined) {
        console.warn('⚠️ [AuthContext] User has null/undefined role_id in database:', userProfile.role_id);
        console.log('🎯 [AuthContext] User email:', authUser.email);
        console.log('🎯 [AuthContext] User profile:', userProfile);
      } else if (typeof userProfile.role_id !== 'number') {
        console.warn('⚠️ [AuthContext] User has non-numeric role_id:', userProfile.role_id, 'type:', typeof userProfile.role_id);
      } else {
      console.log('✅ [AUTH] User has valid role_id:', userProfile.role_id);
      }
      
      // CRITICAL DEBUG: Log the exact role_id for parent login debugging
      console.log('🐞 [PARENT-DEBUG] ===== ROLE_ID DEBUG =====');
      console.log('🐞 [PARENT-DEBUG] User email:', authUser.email);
      console.log('🐞 [PARENT-DEBUG] Full user profile:', JSON.stringify(userProfile, null, 2));
      console.log('🐞 [PARENT-DEBUG] User role_id:', userProfile.role_id);
      console.log('🐞 [PARENT-DEBUG] role_id type:', typeof userProfile.role_id);
      console.log('🐞 [PARENT-DEBUG] role_id === 3?', userProfile.role_id === 3);
      console.log('🐞 [PARENT-DEBUG] role_id == 3?', userProfile.role_id == 3);
      console.log('🐞 [PARENT-DEBUG] =============================');

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
            const roleMap = { 1: 'admin', 2: 'teacher', 3: 'parent', 4: 'student' };
            roleName = roleMap[userProfile.role_id] || 'admin'; // Default to admin for unknown roles
            console.log('🔄 Using fallback role name:', roleName, 'for role_id:', userProfile.role_id);
            
            // Log specific error if it's the PGRST116 error
            if (roleError?.code === 'PGRST116') {
              console.log('🎯 PGRST116 detected in role lookup - role_id', userProfile.role_id, 'not found in roles table, but fallback applied successfully');
            }
          }
        } catch (roleError) {
          console.log('💥 Role lookup exception, using fallback:', roleError);
          const roleMap = { 1: 'admin', 2: 'teacher', 3: 'parent', 4: 'student' };
          roleName = roleMap[userProfile.role_id] || 'admin'; // Default to admin for unknown roles
          
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
        photo_url: userProfile?.photo_url || null,
        full_name: userProfile?.full_name || '',
        phone: userProfile?.phone || '',
        created_at: userProfile?.created_at || new Date().toISOString(),
        ...userProfile
      };

      console.log('👤 Final user data:', userData);
      console.log('🎭 Final role name:', roleName);
      
      // EMERGENCY DEBUG: Alert if parent becomes admin
      if (authUser.email && authUser.email.toLowerCase().includes('parent') && roleName !== 'parent') {
        console.error('🚨 CRITICAL BUG DETECTED: Parent user getting non-parent role!');
        console.error('🚨 Email:', authUser.email);
        console.error('🚨 Expected role: parent');
        console.error('🚨 Actual role:', roleName);
        console.error('🚨 User role_id:', userProfile?.role_id);
        // Don't proceed with wrong role
        alert('CRITICAL ERROR: Parent user is being assigned wrong role. Check console logs.');
        return;
      }

      // Set tenant context in SupabaseService if user has tenant_id
      if (userData.tenant_id) {
        console.log('🏢 Setting tenant context:', userData.tenant_id);
        supabaseService.setTenantContext(userData.tenant_id);
      }

      setUser(userData);
      setUserType(roleName);
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
      
      // If tenant specified, filter by tenant
      if (targetTenantId) {
        userQuery = userQuery.eq('tenant_id', targetTenantId);
        console.log('🏢 Added tenant filter:', targetTenantId);
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
        
        if (targetTenantId) {
          userQuery = userQuery.eq('tenant_id', targetTenantId);
          console.log('🏢 Added tenant filter to case-insensitive query:', targetTenantId);
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
            actualRoleName = fallbackRoleMap[userProfile.role_id] || 'Admin'; // Default to Admin for unknown roles
            console.log('Using fallback role:', actualRoleName);
          }
        } catch (roleError) {
          console.log('Role lookup exception, using fallback:', roleError);
          const fallbackRoleMap = { 1: 'Admin', 2: 'Teacher', 3: 'Parent', 4: 'Student' };
          actualRoleName = fallbackRoleMap[userProfile.role_id] || 'Admin'; // Default to Admin for unknown roles
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
      
      // Only validate role if we have both values (case-insensitive comparison)
      if (actualRoleName && expectedRole && actualRoleName.toLowerCase() !== expectedRole.toLowerCase()) {
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
        photo_url: userProfile?.photo_url || null,
        full_name: userProfile?.full_name || '',
        phone: userProfile?.phone || '',
        created_at: userProfile?.created_at || new Date().toISOString(),
        ...userProfile
      };

      console.log('📋 Setting user and userType directly from signIn');
      console.log('🌐 Platform:', Platform.OS);
      console.log('👤 About to set user:', userData);
      console.log('🎭 About to set userType:', actualRoleName ? actualRoleName.toLowerCase() : 'user');
      
      // Set tenant context in SupabaseService
      if (userData.tenant_id) {
        console.log('🏢 Setting tenant context during signIn:', userData.tenant_id);
        supabaseService.setTenantContext(userData.tenant_id);
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

  const signUp = async (email, password, userData, tenantId = null) => {
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
      const { data: { user, session }, error: authError } = await authHelpers.signUp(email, password, userData);
      
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
    console.log('🚪 [AUTH] signOut function called');
    console.log('🚪 [AUTH] Current user before logout:', user?.email);
    console.log('🚪 [AUTH] Current userType before logout:', userType);
    
    try {
      console.log('🚪 [AUTH] Setting loading to true');
      setLoading(true);
      
      // Check if there's a current session
      console.log('🚪 [AUTH] Checking for current session...');
      const { data: { session }, error: sessionError } = await supabase.auth.getSession();
      
      console.log('🚪 [AUTH] Session check result:', {
        hasSession: !!session,
        sessionError: sessionError?.message || 'None',
        userId: session?.user?.id || 'None'
      });
      
      if (sessionError) {
        console.log('⚠️ [AUTH] Session error during logout:', sessionError);
      }
      
      if (!session) {
        // No session exists, user is already logged out
        console.log('✅ [AUTH] No active session found, cleaning up local state');
        setUser(null);
        setUserType(null);
        console.log('✅ [AUTH] Local state cleared (no session case)');
        return { error: null };
      }
      
      // Attempt to sign out from Supabase
      console.log('🚪 [AUTH] Attempting to sign out from Supabase...');
      console.log('🚪 [AUTH] authHelpers.signOut available:', typeof authHelpers.signOut);
      
      const { error } = await authHelpers.signOut();
      
      console.log('🚪 [AUTH] Supabase signOut result:', {
        hasError: !!error,
        errorMessage: error?.message || 'None',
        errorName: error?.name || 'None'
      });
      
      if (error) {
        // If error is about missing session, treat it as success
        if (error.message?.includes('Auth session missing') || error.name === 'AuthSessionMissingError') {
          console.log('✅ [AUTH] Session already missing during signOut, cleaning up local state');
          setUser(null);
          setUserType(null);
          console.log('✅ [AUTH] Local state cleared (missing session case)');
          return { error: null };
        }
        console.error('❌ [AUTH] SignOut error returned:', error);
        return { error };
      }
      
      // Clear local state
      console.log('🧹 [AUTH] Clearing local state after successful signOut');
      setUser(null);
      setUserType(null);
      console.log('✅ [AUTH] Local state cleared successfully');
      
      // Verify state is cleared
      setTimeout(() => {
        console.log('🔍 [AUTH] Post-signOut verification - user should be null:', user);
        console.log('🔍 [AUTH] Post-signOut verification - userType should be null:', userType);
      }, 100);
      
      return { error: null };
    } catch (error) {
      console.error('💥 [AUTH] Sign out error caught:', error);
      console.error('💥 [AUTH] Error name:', error.name);
      console.error('💥 [AUTH] Error message:', error.message);
      console.error('💥 [AUTH] Error stack:', error.stack);
      
      // If it's a session missing error, clear local state and treat as success
      if (error.message?.includes('Auth session missing') || error.name === 'AuthSessionMissingError') {
        console.log('✅ [AUTH] Caught AuthSessionMissingError, cleaning up local state');
        setUser(null);
        setUserType(null);
        console.log('✅ [AUTH] Local state cleared (exception case)');
        return { error: null };
      }
      
      console.error('❌ [AUTH] Unexpected signOut error:', error);
      return { error };
    } finally {
      console.log('🔄 [AUTH] Setting loading to false in signOut finally block');
      setLoading(false);
    }
  };

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