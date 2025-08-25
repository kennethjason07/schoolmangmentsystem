import React, { createContext, useContext, useState, useEffect } from 'react';
import { supabase, authHelpers, dbHelpers } from './supabase';

const AuthContext = createContext({});

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [userType, setUserType] = useState(null); // 'admin', 'teacher', 'student', 'parent'

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
        if (event === 'SIGNED_IN' && session?.user) {
          await handleAuthChange(session.user);
        } else if (event === 'SIGNED_OUT') {
          setUser(null);
          setUserType(null);
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
        return;
      }

      console.log('👤 Fetching user profile for:', authUser.email);
      // First get user profile without roles join to avoid foreign key issues during signup
      const { data: userProfile, error } = await supabase
        .from('users')
        .select('*')
        .eq('email', authUser.email)
        .maybeSingle();

      console.log('📄 User profile query result:', { userProfile, error });

      if (error) {
        console.error('❌ Error fetching user profile:', error);
        return;
      }

      if (!userProfile) {
        console.log('❌ User profile not found for:', authUser.email);
        // Handle case where user profile doesn't exist
        setUser(null);
        setUserType(null);
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
            roleName = roleData.role_name;
            console.log('✅ Found role in database:', roleName);
          } else {
            console.log('⚠️ Role lookup failed, using fallback. Error code:', roleError?.code, 'Message:', roleError?.message);
            // Fallback role names for when database doesn't have roles yet
            const roleMap = { 1: 'Admin', 2: 'Teacher', 3: 'Parent', 4: 'Student' };
            roleName = roleMap[userProfile.role_id] || 'User';
            console.log('🔄 Using fallback role name:', roleName);
            
            // Log specific error if it's the PGRST116 error
            if (roleError?.code === 'PGRST116') {
              console.log('🎯 PGRST116 detected in role lookup - role_id', userProfile.role_id, 'not found in roles table, but fallback applied successfully');
            }
          }
        } catch (roleError) {
          console.log('💥 Role lookup exception, using fallback:', roleError);
          const roleMap = { 1: 'Admin', 2: 'Teacher', 3: 'Parent', 4: 'Student' };
          roleName = roleMap[userProfile.role_id] || 'User';
          
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
      console.log('✅ Auth state updated successfully');
    } catch (error) {
      console.error('💥 Error in handleAuthChange:', error);
    }
  };

  const signIn = async (email, password, selectedRole) => {
    try {
      setLoading(true);
      
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

      // Get user profile to verify role
      const { data: userProfile, error: profileError } = await supabase
        .from('users')
        .select('*, roles(role_name)')
        .eq('email', email)
        .maybeSingle();

      if (profileError) {
        return { data: null, error: { message: 'User profile not found' } };
      }

      if (!userProfile) {
        return { data: null, error: { message: 'User profile not found' } };
      }

      // Convert the selected role to match database format
      const roleMap = {
        'admin': 'Admin',
        'teacher': 'Teacher', 
        'parent': 'Parent',
        'student': 'Student'
      };
      const expectedRole = roleMap[selectedRole.toLowerCase()];
      
      if (userProfile.roles.role_name !== expectedRole) {
        console.log('Role mismatch:', userProfile.roles.role_name, 'vs expected:', expectedRole);
        return { data: null, error: { message: 'Invalid role for this user' } };
      }

      const userData = {
        id: user.id,
        email: user.email,
        role_id: userProfile.role_id,

        ...userProfile
      };

      setUser(userData);
      setUserType(userProfile.roles.role_name);
      
      return { data: userData, error: null };
    } catch (error) {
      console.error('Sign in error:', error);
      return { data: null, error: { message: 'Sign in failed' } };
    } finally {
      setLoading(false);
    }
  };

  const signUp = async (email, password, userData) => {
    console.log('📝 Starting signup process for:', email);
    console.log('📁 User data provided:', userData);
    try {
      setLoading(true);
      
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
        full_name: userData.full_name || '',
        phone: userData.phone || '',
        linked_student_id: userData.linked_student_id || null
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