import React, { createContext, useContext, useState, useEffect, useRef } from 'react';
import { Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { supabase, authHelpers, dbHelpers } from './supabase';

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
    // Initialize auth state
    const initializeAuth = async () => {
      try {
        // Get current session
        const { data: { session }, error: sessionError } = await supabase.auth.getSession();
        
        if (sessionError) {
          console.error('Error getting session:', sessionError);
          setLoading(false);
          return;
        }

        if (session?.user) {
          await handleAuthChange(session.user);
        }
      } catch (error) {
        console.error('Error initializing auth:', error);
      } finally {
        setLoading(false);
      }
    };

    // Initialize auth state
    initializeAuth();

    // Listen for auth state changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        console.log('🔊 Auth state change event:', event, 'isSigningIn:', isSigningInRef.current);
        
        // Don't handle SIGNED_IN if we're in the middle of a manual sign-in process
        if (event === 'SIGNED_IN' && session?.user && !isSigningInRef.current) {
          console.log('🔊 Handling auth state change for SIGNED_IN');
          await handleAuthChange(session.user);
        } else if (event === 'SIGNED_IN' && isSigningInRef.current) {
          console.log('⏭️ Skipping auth state handler - manual sign-in in progress');
        } else if (event === 'SIGNED_OUT') {
          console.log('🔊 Handling auth state change for SIGNED_OUT');
          setUser(null);
          setUserType(null);
          isSigningInRef.current = false;
        }
      }
    );

    return () => subscription.unsubscribe();
  }, []);

  // Removed checkUser function since we now handle this in initializeAuth
  // The auth state is now managed through the auth state change listener and initial session check

  const handleAuthChange = async (authUser) => {
    console.log('🔄 handleAuthChange called with user:', authUser?.email);
    try {
      if (!authUser) {
        console.log('❌ No auth user provided, clearing state');
        setUser(null);
        setUserType(null);
        setLoading(false); // Ensure loading is false when no user
        return;
      }

      console.log('👤 Fetching user profile for:', authUser.email);
      // First get user profile without roles join to avoid foreign key issues during signup
      // Use case-insensitive search for email with timeout
      let userProfile = null;
      let error = null;
      let tenantId = null;
      
      try {
        console.log('🔍 Starting user profile query...');
        
        // First try with exact email match
        let profileQuery = supabase
          .from('users')
          .select('*')
          .eq('email', authUser.email)
          .maybeSingle();
        
        console.log('📧 Querying with exact email:', authUser.email);
        let result = await profileQuery;
        
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
          
          // Create basic user object from auth data only
          const fallbackUserData = {
            id: authUser.id,
            email: authUser.email,
            role_id: 1, // Default to admin for fallback
            photo_url: null,
            full_name: authUser.email.split('@')[0], // Use email prefix as name
            phone: '',
            created_at: new Date().toISOString()
          };
          
          console.log('🚨 Setting fallback user data:', fallbackUserData);
          setUser(fallbackUserData);
          setUserType('admin'); // Default to admin for fallback
          setLoading(false);
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
          role_id: 1, // Default to admin
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
        photo_url: userProfile?.photo_url || null,
        full_name: userProfile?.full_name || '',
        phone: userProfile?.phone || '',
        created_at: userProfile?.created_at || new Date().toISOString(),
        ...userProfile
      };

      console.log('👤 Final user data:', userData);
      console.log('🎭 Final role name:', roleName);

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
      
      // Sign in with Supabase Auth
      const { data: { session, user }, error: authError } = await supabase.auth.signInWithPassword({
        email,
        password
      });
      
      if (authError) {
        return { data: null, error: authError };
      }

      if (!user) {
        return { data: null, error: { message: 'Authentication failed' } };
      }

      // Get user profile (without roles join to avoid foreign key issues)
      // Use case-insensitive search for email
      let userQuery = supabase
        .from('users')
        .select('*')
        .ilike('email', email);
      
      // If tenant specified, filter by tenant
      if (targetTenantId) {
        userQuery = userQuery.eq('tenant_id', targetTenantId);
      }
      
      const { data: userProfile, error: profileError } = await userQuery.maybeSingle();

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
        if (userData.role_id) {
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
      const newUserData = {
        id: user.id, // Include the auth user ID
        email,
        role_id: userData.role_id,
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
        return { error: null };
      }
      
      // Attempt to sign out from Supabase
      const { error } = await authHelpers.signOut();
      
      if (error) {
        // If error is about missing session, treat it as success
        if (error.message?.includes('Auth session missing') || error.name === 'AuthSessionMissingError') {
          console.log('Session already missing, cleaning up local state');
          setUser(null);
          setUserType(null);
          return { error: null };
        }
        return { error };
      }
      
      // Clear local state
      setUser(null);
      setUserType(null);
      return { error: null };
    } catch (error) {
      console.error('Sign out error:', error);
      
      // If it's a session missing error, clear local state and treat as success
      if (error.message?.includes('Auth session missing') || error.name === 'AuthSessionMissingError') {
        console.log('Caught AuthSessionMissingError, cleaning up local state');
        setUser(null);
        setUserType(null);
        return { error: null };
      }
      
      return { error };
    } finally {
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