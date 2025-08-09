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
    try {
      if (!authUser) {
        setUser(null);
        setUserType(null);
        return;
      }

      // Get user profile from users table
      const { data: userProfile, error } = await supabase
        .from('users')
        .select('*, roles(role_name)')
        .eq('email', authUser.email)
        .maybeSingle();

      if (error) {
        console.error('Error fetching user profile:', error);
        return;
      }

      if (!userProfile) {
        console.log('User profile not found, user needs to complete setup');
        // Handle case where user profile doesn't exist
        setUser(null);
        setUserType(null);
        return;
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

      setUser(userData);
      setUserType(userProfile.roles.role_name);
    } catch (error) {
      console.error('Error handling auth change:', error);
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

      if (userProfile.roles.role_name !== selectedRole) {
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
    try {
      setLoading(true);
      
      // First check if user already exists in our users table
      const { data: existingUser, error: checkError } = await supabase
        .from('users')
        .select('email')
        .eq('email', email)
        .maybeSingle();
      
      if (checkError && checkError.code !== 'PGRST116') { // PGRST116 means no rows found, which is what we want
        return { data: null, error: { message: 'Error checking existing user' } };
      }
      
      if (existingUser) {
        return { data: null, error: { message: 'An account with this email already exists. Please sign in instead.' } };
      }
      
      // Use Supabase Auth for signup
      const { data: { user, session }, error: authError } = await authHelpers.signUp(email, password, userData);
      
      if (authError) {
        // Handle specific auth errors
        if (authError.message.includes('User already registered')) {
          return { data: null, error: { message: 'An account with this email already exists. Please sign in instead.' } };
        }
        return { data: null, error: { message: authError?.message || 'Signup failed' } };
      }
      
      if (!user) {
        return { data: null, error: { message: 'Signup failed - no user created' } };
      }

      // Add user profile to users table
      const newUserData = {
        email,
        role_id: userData.role_id,
        name: userData.name || '',
        phone: userData.phone || '',
        linked_student_id: userData.linked_student_id || null,
        created_at: new Date().toISOString()
      };

      // Use upsert to handle potential race conditions
      const { data: profileData, error: profileError } = await supabase
        .from('users')
        .upsert(newUserData, { onConflict: 'email' })
        .select()
        .maybeSingle();

      if (profileError) {
        console.error('Profile creation error:', profileError);
        // If profile creation fails, clean up the auth session
        await supabase.auth.signOut();
        
        if (profileError.code === '23505') { // Unique constraint violation
          return { data: null, error: { message: 'An account with this email already exists. Please sign in instead.' } };
        }
        
        return { data: null, error: { message: 'Failed to create user profile. Please try again.' } };
      }

      const { data: roleData, error: roleError } = await supabase
        .from('roles')
        .select('role_name')
        .eq('id', userData.role_id)
        .single();

      if (roleError) {
        console.error('Role retrieval error:', roleError);
        await supabase.auth.signOut();
        return { data: null, error: { message: 'Failed to retrieve user role.' } };
      }

      const completeUserData = {
        id: user.id,
        email: user.email,
        role_id: userData.role_id,
        ...profileData
      };

      setUser(completeUserData);
      setUserType(roleData.role_name);
      
      return { data: completeUserData, error: null };
    } catch (error) {
      console.error('Sign up error:', error);
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