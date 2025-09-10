import React, { createContext, useContext, useEffect, useState } from 'react';
import { supabase } from './supabase';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Platform } from 'react-native';

const AuthContext = createContext();

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

// Helper function to create a new tenant for a new user
const createNewTenantForUser = async (email, userData) => {
  console.log('🏢 Creating new tenant for user:', email);
  
  // Extract name for tenant
  const userName = userData.full_name || email.split('@')[0];
  const domainName = email.split('@')[1].split('.')[0];
  
  // Generate tenant subdomain
  const tenantSubdomain = `${userName.toLowerCase().replace(/\\s+/g, '-')}-${domainName}-${Date.now()}`.substring(0, 50);
  
  const tenantData = {
    name: `${userName}'s School`,
    subdomain: tenantSubdomain,
    status: 'active',
    subscription_plan: 'basic',
    max_students: 100,
    max_teachers: 10,
    max_classes: 20,
    contact_email: email,
    features: {
      messaging: true,
      attendance: true,
      fees: true,
      exams: true,
      reports: true,
      homework: true
    },
    settings: {
      timezone: 'Asia/Kolkata',
      academic_year_start_month: 4
    }
  };
  
  const { data: newTenant, error: tenantError } = await supabase
    .from('tenants')
    .insert([tenantData])
    .select()
    .single();
  
  if (tenantError) {
    console.error('❌ Failed to create tenant:', tenantError);
    throw new Error(`Failed to create tenant: ${tenantError.message}`);
  }
  
  console.log('✅ Created new tenant:', newTenant.name, 'ID:', newTenant.id);
  
  // Create roles for the new tenant
  const roles = [
    { role_name: 'Admin', tenant_id: newTenant.id },
    { role_name: 'Teacher', tenant_id: newTenant.id },
    { role_name: 'Parent', tenant_id: newTenant.id },
    { role_name: 'Student', tenant_id: newTenant.id }
  ];
  
  const { error: rolesError } = await supabase
    .from('roles')
    .insert(roles);
  
  if (rolesError) {
    console.log('⚠️ Warning: Could not create roles:', rolesError.message);
  }
  
  // Create basic school details
  try {
    await supabase
      .from('school_details')
      .insert([{
        tenant_id: newTenant.id,
        school_name: `${userName}'s School`,
        contact_email: email,
        address: 'Address not provided',
        phone: '+91 9876543210',
        principal_name: userName,
        established_year: new Date().getFullYear(),
        school_code: newTenant.subdomain.toUpperCase().substring(0, 6)
      }]);
  } catch (schoolError) {
    console.log('⚠️ Warning: Could not create school details:', schoolError);
  }
  
  return newTenant;
};

// Helper function to update auth user metadata with tenant_id
const updateAuthUserMetadata = async (userId, tenantId) => {
  try {
    // This would need to be done via a database function or edge function
    // as the client cannot directly update auth.users metadata
    console.log('ℹ️ Auth metadata update needed for user:', userId, 'tenant:', tenantId);
    console.log('ℹ️ This should be handled by a database trigger');
  } catch (error) {
    console.error('❌ Failed to update auth metadata:', error);
  }
};

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [userType, setUserType] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Get initial session
    const getInitialSession = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (session?.user) {
        await handleAuthChange(session.user, session);
      } else {
        setLoading(false);
      }
    };

    getInitialSession();

    // Listen for auth changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
      console.log('Auth state changed:', event);
      
      if (event === 'SIGNED_IN' && session?.user) {
        await handleAuthChange(session.user, session);
      } else if (event === 'SIGNED_OUT') {
        setUser(null);
        setUserType(null);
        setLoading(false);
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  const handleAuthChange = async (authUser, session) => {
    try {
      setLoading(true);
      console.log('Handling auth change for:', authUser.email);

      // Get user profile from database
      const { data: userProfile, error: profileError } = await supabase
        .from('users')
        .select('*')
        .eq('email', authUser.email)
        .single();

      if (profileError) {
        console.error('Error fetching user profile:', profileError);
        setLoading(false);
        return;
      }

      if (!userProfile) {
        console.error('No user profile found for:', authUser.email);
        setLoading(false);
        return;
      }

      // Get role name
      let roleName = 'user';
      if (userProfile.role_id) {
        const { data: roleData } = await supabase
          .from('roles')
          .select('role_name')
          .eq('id', userProfile.role_id)
          .eq('tenant_id', userProfile.tenant_id)
          .single();

        if (roleData) {
          roleName = roleData.role_name.toLowerCase();
        }
      }

      const userData = {
        id: authUser.id,
        email: authUser.email,
        tenant_id: userProfile.tenant_id,
        role_id: userProfile.role_id,
        full_name: userProfile.full_name,
        phone: userProfile.phone,
        ...userProfile
      };

      setUser(userData);
      setUserType(roleName);
      setLoading(false);
    } catch (error) {
      console.error('Error in handleAuthChange:', error);
      setLoading(false);
    }
  };

  const signIn = async (email, password, selectedRole, tenantSubdomain = null) => {
    try {
      setLoading(true);
      
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
      const { data: { user, session }, error: authError } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (authError) {
        console.error('Auth sign in failed:', authError);
        return { data: null, error: authError };
      }

      if (!user) {
        return { data: null, error: { message: 'Sign in failed - no user returned' } };
      }

      // Get user profile from database
      let { data: userProfile, error: profileError } = await supabase
        .from('users')
        .select('*')
        .eq('email', email);

      // If tenant specified, filter by tenant
      if (targetTenantId) {
        userProfile = userProfile?.filter(profile => profile.tenant_id === targetTenantId);
      }

      userProfile = userProfile?.[0]; // Get first match

      if (profileError) {
        console.error('Profile query error:', profileError);
        return { data: null, error: { message: 'User profile not found' } };
      }

      if (!userProfile) {
        const errorMsg = targetTenantId ? 'User not found in the specified tenant' : 'User profile not found';
        return { data: null, error: { message: errorMsg } };
      }

      // Validate role
      if (userProfile.role_id) {
        const { data: roleData } = await supabase
          .from('roles')
          .select('role_name')
          .eq('id', userProfile.role_id)
          .eq('tenant_id', userProfile.tenant_id)
          .single();

        if (roleData) {
          const roleMap = {
            'admin': 'Admin',
            'teacher': 'Teacher', 
            'parent': 'Parent',
            'student': 'Student'
          };
          const expectedRole = roleMap[selectedRole.toLowerCase()];
          
          if (expectedRole && roleData.role_name !== expectedRole) {
            return { data: null, error: { message: `Invalid role. User is ${roleData.role_name}, not ${expectedRole}` } };
          }
        }
      }

      const userData = {
        id: user.id,
        email: user.email,
        tenant_id: userProfile.tenant_id,
        role_id: userProfile.role_id,
        full_name: userProfile.full_name,
        phone: userProfile.phone,
        ...userProfile
      };

      setUser(userData);
      setUserType(selectedRole.toLowerCase());
      setLoading(false);

      return { data: userData, error: null };
    } catch (error) {
      console.error('Sign in error:', error);
      setLoading(false);
      return { data: null, error: { message: 'Sign in failed' } };
    }
  };

  const signUp = async (email, password, userData) => {
    console.log('📝 Enhanced signup process started for:', email);
    try {
      setLoading(true);
      
      // Check if user already exists
      const { data: existingUser } = await supabase
        .from('users')
        .select('email')
        .eq('email', email)
        .maybeSingle();
      
      if (existingUser) {
        return { data: null, error: { message: 'An account with this email already exists' } };
      }

      // Create Supabase auth user
      const { data: { user }, error: authError } = await supabase.auth.signUp({
        email,
        password,
      });

      if (authError) {
        console.error('Auth signup failed:', authError);
        return { data: null, error: authError };
      }

      if (!user) {
        return { data: null, error: { message: 'Signup failed - no user created' } };
      }

      console.log('✅ Auth user created:', user.id);

      // Create new tenant for this user
      const newTenant = await createNewTenantForUser(email, userData);
      
      // Prepare user data with new tenant
      const safeRoleId = typeof userData.role_id === 'number' && !isNaN(userData.role_id) ? userData.role_id : 1;
      
      const newUserData = {
        id: user.id,
        email,
        role_id: safeRoleId,
        tenant_id: newTenant.id, // Use the new tenant
        full_name: userData.full_name || '',
        phone: userData.phone || '',
        linked_student_id: userData.linked_student_id || null,
        linked_teacher_id: userData.linked_teacher_id || null,
        linked_parent_of: userData.linked_parent_of || null
      };

      console.log('📁 Creating user profile with tenant:', newTenant.id);

      // Create user profile in database
      const { data: profileData, error: profileError } = await supabase
        .from('users')
        .insert(newUserData)
        .select()
        .single();

      if (profileError) {
        console.error('❌ Profile creation error:', profileError);
        // Cleanup: remove the tenant and auth user
        await supabase.from('tenants').delete().eq('id', newTenant.id);
        await supabase.auth.signOut();
        
        return { data: null, error: { message: 'Failed to create user profile' } };
      }

      console.log('✅ User profile created with isolated tenant');

      // Update auth metadata (this should be handled by a database trigger)
      await updateAuthUserMetadata(user.id, newTenant.id);

      const completeUserData = {
        id: user.id,
        email: user.email,
        tenant_id: newTenant.id,
        tenant_name: newTenant.name,
        ...profileData
      };

      // Sign out after signup to force fresh login
      await supabase.auth.signOut();
      
      console.log('✅ Enhanced signup completed - user has isolated tenant');
      return { data: completeUserData, error: null };
    } catch (error) {
      console.error('💥 Enhanced signup error:', error);
      setLoading(false);
      return { data: null, error: { message: 'Signup failed. Please try again.' } };
    } finally {
      setLoading(false);
    }
  };

  const signOut = async () => {
    try {
      setLoading(true);
      const { error } = await supabase.auth.signOut();
      
      if (error) {
        console.error('Sign out error:', error);
        return { error };
      }

      setUser(null);
      setUserType(null);
      return { error: null };
    } catch (error) {
      console.error('Sign out error:', error);
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
